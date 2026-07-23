#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/pc-open}"
REPO_URL="${REPO_URL:-https://github.com/michealeco/Open-PC-Call.git}"
SERVICE_NAME="pc-open"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/install-ubuntu.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js 20..."
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if ! command -v git >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y git
fi

if [[ -d "${APP_DIR}/.git" ]]; then
  echo "Updating existing install in ${APP_DIR}..."
  git -C "${APP_DIR}" pull --ff-only
else
  echo "Cloning into ${APP_DIR}..."
  mkdir -p "$(dirname "${APP_DIR}")"
  git clone "${REPO_URL}" "${APP_DIR}"
fi

if [[ ! -f "${APP_DIR}/config.json" ]]; then
  cp "${APP_DIR}/config.example.json" "${APP_DIR}/config.json"
  echo "Created ${APP_DIR}/config.json — edit MAC / broadcast for your PC."
fi

id -u www-data >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin www-data
chown -R www-data:www-data "${APP_DIR}"

install -m 644 "${APP_DIR}/deploy/pc-open.service" /etc/systemd/system/${SERVICE_NAME}.service
systemctl daemon-reload
systemctl enable --now ${SERVICE_NAME}.service

HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "PC Open is running."
echo "  Local:   http://127.0.0.1:3847"
if [[ -n "${HOST_IP}" ]]; then
  echo "  Network: http://${HOST_IP}:3847"
fi
echo
echo "Edit target PC settings:"
echo "  sudo nano ${APP_DIR}/config.json"
echo "  sudo systemctl restart ${SERVICE_NAME}"
echo
systemctl --no-pager --full status ${SERVICE_NAME}.service || true
