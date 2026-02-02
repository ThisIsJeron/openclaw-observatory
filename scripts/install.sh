#!/bin/bash
set -e

# OpenClaw Observatory One-Line Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/thisisjeron/openclaw-observatory/main/scripts/install.sh | bash

echo "======================================"
echo "  OpenClaw Observatory Installer"
echo "======================================"
echo

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed."
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check for Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "Error: Docker Compose is not installed."
    echo "Please install Docker Compose first: https://docs.docker.com/compose/install/"
    exit 1
fi

# Create installation directory
INSTALL_DIR="${OBSERVATORY_DIR:-$HOME/observatory}"
echo "Installing to: $INSTALL_DIR"

if [ -d "$INSTALL_DIR" ]; then
    echo "Directory already exists. Updating..."
else
    mkdir -p "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Download docker-compose.yml
echo "Downloading configuration..."
curl -fsSL https://raw.githubusercontent.com/thisisjeron/openclaw-observatory/main/docker-compose.yml -o docker-compose.yml

# Download Grafana provisioning (optional)
mkdir -p grafana/provisioning/datasources grafana/provisioning/dashboards
curl -fsSL https://raw.githubusercontent.com/thisisjeron/openclaw-observatory/main/grafana/provisioning/datasources/observatory.yml -o grafana/provisioning/datasources/observatory.yml
curl -fsSL https://raw.githubusercontent.com/thisisjeron/openclaw-observatory/main/grafana/provisioning/dashboards/dashboards.yml -o grafana/provisioning/dashboards/dashboards.yml
curl -fsSL https://raw.githubusercontent.com/thisisjeron/openclaw-observatory/main/grafana/provisioning/dashboards/observatory-overview.json -o grafana/provisioning/dashboards/observatory-overview.json

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << 'EOF'
# Observatory Configuration
# Generate a secure token: openssl rand -hex 32
OBSERVATORY_TOKEN=

# Alert webhook (optional - Slack, Discord, etc.)
ALERT_WEBHOOK_URL=

# Grafana admin password (for --profile full)
GRAFANA_PASSWORD=admin

# Data retention in days
RETENTION_DAYS=30

# Log level (debug, info, warn, error)
LOG_LEVEL=info
EOF
    echo "Created .env file. Please edit it to set your OBSERVATORY_TOKEN."
fi

echo
echo "======================================"
echo "  Installation Complete!"
echo "======================================"
echo
echo "Quick Start:"
echo "  cd $INSTALL_DIR"
echo "  docker-compose up -d"
echo
echo "With Grafana (optional):"
echo "  docker-compose --profile full up -d"
echo
echo "Dashboard: http://localhost:3200"
echo "Grafana:   http://localhost:3000 (with --profile full)"
echo
echo "Configure your Clawdbot gateway to send events to:"
echo "  http://<your-server>:3200/api/v1/ingest"
echo
