function backendBase() {
  const base = (process.env.PC_OPEN_API_URL || "").replace(/\/$/, "");
  if (!base) {
    throw new Error(
      "Set PC_OPEN_API_URL in Vercel to your Ubuntu server URL (e.g. https://wake.yourdomain.com)"
    );
  }
  return base;
}

function backendHeaders() {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  const token = process.env.PC_OPEN_WAKE_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

module.exports = { backendBase, backendHeaders };
