#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/install-ngrok-service.sh"
  exit 1
fi

USER_NAME="${SUDO_USER:-micheal}"
USER_HOME="$(getent passwd "${USER_NAME}" | cut -d: -f6)"
NGROK_BIN="$(command -v ngrok || true)"
CONFIG_FILE="${USER_HOME}/.config/ngrok/ngrok.yml"
SERVICE_DST="/etc/systemd/system/ngrok.service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "${NGROK_BIN}" ]]; then
  echo "ngrok not found in PATH. Install ngrok first."
  exit 1
fi

if [[ ! -f "${CONFIG_FILE}" ]]; then
  echo "Missing ${CONFIG_FILE}"
  echo "Create it with both tunnels first, then rerun this script."
  exit 1
fi

# Stop any manual ngrok so systemd owns it
pkill -u "${USER_NAME}" ngrok 2>/dev/null || true

sed \
  -e "s|User=micheal|User=${USER_NAME}|g" \
  -e "s|WorkingDirectory=/home/micheal|WorkingDirectory=${USER_HOME}|g" \
  -e "s|/usr/local/bin/ngrok|${NGROK_BIN}|g" \
  -e "s|/home/micheal/.config/ngrok/ngrok.yml|${CONFIG_FILE}|g" \
  "${SCRIPT_DIR}/ngrok.service" > "${SERVICE_DST}"

systemctl daemon-reload
systemctl enable --now ngrok.service

echo
echo "ngrok service installed."
echo "  status:  systemctl status ngrok"
echo "  logs:    journalctl -u ngrok -f"
echo "  restart: sudo systemctl restart ngrok"
echo
systemctl --no-pager --full status ngrok.service || true
