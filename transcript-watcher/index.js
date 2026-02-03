#!/usr/bin/env node
/**
 * OpenClaw Transcript Watcher
 * 
 * Monitors transcript .jsonl files for new entries and extracts
 * turn/usage data to push to the Observatory.
 */

import fs from 'fs';
import path from 'path';
import { watch } from 'chokidar';

const OBSERVATORY_URL = process.env.OBSERVATORY_URL || 'http://localhost:3200';
const GATEWAY_ID = process.env.GATEWAY_ID || 'clawdbot1';
const TRANSCRIPTS_DIR = process.env.TRANSCRIPTS_DIR || path.join(process.env.HOME, '.openclaw/agents/main/sessions');
const SESSIONS_FILE = path.join(TRANSCRIPTS_DIR, 'sessions.json');

// Track file positions to only read new lines
const filePositions = new Map();

// Track session key mappings (sessionId -> sessionKey)
const sessionKeyMap = new Map();

/**
 * Load session mappings from sessions.json
 */
function loadSessionMappings() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      for (const [sessionKey, entry] of Object.entries(data)) {
        if (entry.sessionId) {
          sessionKeyMap.set(entry.sessionId, sessionKey);
        }
      }
      console.log(`[watcher] Loaded ${sessionKeyMap.size} session mappings`);
    }
  } catch (err) {
    console.error('[watcher] Failed to load session mappings:', err.message);
  }
}

/**
 * Get session key from filename (sessionId.jsonl)
 */
function getSessionKey(filename) {
  const sessionId = path.basename(filename, '.jsonl');
  return sessionKeyMap.get(sessionId) || `unknown:${sessionId}`;
}

/**
 * Send events to Observatory
 */
async function sendToObservatory(events) {
  if (events.length === 0) return;
  
  try {
    const response = await fetch(`${OBSERVATORY_URL}/api/v1/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    });
    
    if (!response.ok) {
      console.error(`[watcher] Failed to send events: ${response.status}`);
    } else {
      console.log(`[watcher] Sent ${events.length} events to observatory`);
    }
  } catch (err) {
    console.error('[watcher] Failed to send events:', err.message);
  }
}

/**
 * Parse a transcript line and extract turn data
 */
function parseTranscriptLine(line, sessionKey) {
  try {
    const entry = JSON.parse(line);
    
    // Only process assistant messages with usage data
    if (entry.type !== 'message' || entry.message?.role !== 'assistant') {
      return null;
    }
    
    const msg = entry.message;
    if (!msg.usage) return null;
    
    const usage = msg.usage;
    const cost = usage.cost || {};
    
    // Map to observatory schema
    const event = {
      timestamp: entry.timestamp || new Date().toISOString(),
      gatewayId: GATEWAY_ID,
      sessionKey: sessionKey,
      eventType: 'turn.completed',  // Note: 'completed' not 'complete'
      agentId: sessionKey.split(':')[1] || 'unknown',
      turnId: entry.id,
      messageId: entry.parentId,
      
      // Token metrics (map to observatory schema)
      tokens: {
        input: usage.input || 0,
        output: usage.output || 0,
        total: usage.totalTokens || ((usage.input || 0) + (usage.output || 0)),
        // contextUsed/contextMax not in transcript, would need from elsewhere
      },
      
      // Cost metrics (map to observatory schema)
      cost: {
        inputCost: (cost.input || 0) + (cost.cacheRead || 0) + (cost.cacheWrite || 0),
        outputCost: cost.output || 0,
        totalCost: cost.total || 0,
      },
      
      // Model info
      model: {
        provider: msg.provider || 'unknown',
        modelId: msg.model || 'unknown',
      },
      
      // Extra data in payload
      payload: {
        stopReason: msg.stopReason,
        api: msg.api,
        cacheRead: usage.cacheRead,
        cacheWrite: usage.cacheWrite,
      },
    };
    
    return event;
  } catch (err) {
    // Silently ignore parse errors (incomplete lines, etc.)
    return null;
  }
}

/**
 * Process new lines from a transcript file
 */
async function processFile(filepath) {
  const sessionKey = getSessionKey(filepath);
  const currentPos = filePositions.get(filepath) || 0;
  
  try {
    const stat = fs.statSync(filepath);
    if (stat.size <= currentPos) return;
    
    // Read new content
    const fd = fs.openSync(filepath, 'r');
    const buffer = Buffer.alloc(stat.size - currentPos);
    fs.readSync(fd, buffer, 0, buffer.length, currentPos);
    fs.closeSync(fd);
    
    // Update position
    filePositions.set(filepath, stat.size);
    
    // Parse lines
    const lines = buffer.toString('utf8').split('\n').filter(l => l.trim());
    const events = [];
    
    for (const line of lines) {
      const event = parseTranscriptLine(line, sessionKey);
      if (event) {
        events.push(event);
      }
    }
    
    if (events.length > 0) {
      await sendToObservatory(events);
    }
  } catch (err) {
    console.error(`[watcher] Error processing ${filepath}:`, err.message);
  }
}

/**
 * Initialize watcher
 */
function startWatcher() {
  console.log(`[watcher] Starting transcript watcher`);
  console.log(`[watcher] Monitoring: ${TRANSCRIPTS_DIR}`);
  console.log(`[watcher] Observatory: ${OBSERVATORY_URL}`);
  console.log(`[watcher] Gateway ID: ${GATEWAY_ID}`);
  
  // Load initial session mappings
  loadSessionMappings();
  
  // Watch for session.json changes to update mappings
  if (fs.existsSync(SESSIONS_FILE)) {
    watch(SESSIONS_FILE).on('change', () => {
      console.log('[watcher] Sessions file changed, reloading mappings');
      loadSessionMappings();
    });
  }
  
  // Watch transcript files
  const watcher = watch(path.join(TRANSCRIPTS_DIR, '*.jsonl'), {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  });
  
  watcher.on('add', (filepath) => {
    console.log(`[watcher] New transcript: ${path.basename(filepath)}`);
    // Start from current position (don't replay history)
    const stat = fs.statSync(filepath);
    filePositions.set(filepath, stat.size);
  });
  
  watcher.on('change', (filepath) => {
    processFile(filepath);
  });
  
  watcher.on('error', (err) => {
    console.error('[watcher] Watcher error:', err);
  });
  
  console.log('[watcher] Watcher started');
}

// Start
startWatcher();
