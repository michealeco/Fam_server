const STORAGE_KEY = "pc-open-settings";

const macInput = document.getElementById("mac");
const broadcastInput = document.getElementById("broadcast");
const portInput = document.getElementById("port");
const wakeBtn = document.getElementById("wakeBtn");
const detectBtn = document.getElementById("detectBtn");
const statusEl = document.getElementById("status");
const hintEl = document.getElementById("hint");

function formatMac(value) {
  const hex = String(value || "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .slice(0, 12);
  return hex.match(/.{1,2}/g)?.join(":") ?? hex;
}

function applySettings(data) {
  if (!data) return;
  if (data.mac) macInput.value = formatMac(data.mac);
  if (data.broadcast) broadcastInput.value = data.broadcast;
  if (data.port) portInput.value = String(data.port);
  if (data.name) hintEl.textContent = `Target: ${data.name}`;
}

function loadLocalSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function loadSettings() {
  const local = loadLocalSettings();
  if (local?.mac) {
    applySettings(local);
    return;
  }

  try {
    const res = await fetch("/api/config");
    if (res.ok) applySettings(await res.json());
  } catch {
    /* server defaults optional */
  }
}

function saveSettings() {
  const payload = {
    mac: macInput.value.trim(),
    broadcast: broadcastInput.value.trim() || "255.255.255.255",
    port: Number(portInput.value) || 9,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.className = `status${kind ? ` is-${kind}` : ""}`;
  wakeBtn.classList.remove("is-sending", "is-ok", "is-err");
  if (kind === "busy") wakeBtn.classList.add("is-sending");
  if (kind === "ok") wakeBtn.classList.add("is-ok");
  if (kind === "err") wakeBtn.classList.add("is-err");
}

async function detectNetwork() {
  setStatus("Detecting network…", "busy");
  hintEl.textContent = "";
  try {
    const res = await fetch("/api/network");
    const data = await res.json();
    const first = data.interfaces?.[0];
    if (!first) {
      setStatus("No local network found", "err");
      hintEl.textContent =
        "This machine may only have loopback. Enter your LAN broadcast manually (often x.x.x.255).";
      return;
    }
    broadcastInput.value = first.broadcast;
    saveSettings();
    setStatus("Network detected", "ok");
    const list = data.interfaces
      .map((n) => `${n.iface}: ${n.address} → ${n.broadcast}`)
      .join(" · ");
    hintEl.textContent = list;
  } catch (err) {
    setStatus("Detect failed", "err");
    hintEl.textContent = err.message || String(err);
  }
}

async function wake() {
  const settings = saveSettings();
  if (!settings.mac) {
    setStatus("Enter a MAC address", "err");
    macInput.focus();
    return;
  }

  setStatus("Sending magic packet…", "busy");
  wakeBtn.disabled = true;

  try {
    const res = await fetch("/api/wake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Wake request failed");
    }
    setStatus(`Packet sent to ${data.mac}`, "ok");
    hintEl.textContent = `UDP ${data.broadcast}:${data.port} · ${data.bytes} bytes`;
  } catch (err) {
    setStatus("Wake failed", "err");
    hintEl.textContent = err.message || String(err);
  } finally {
    wakeBtn.disabled = false;
  }
}

macInput.addEventListener("blur", () => {
  macInput.value = formatMac(macInput.value);
  saveSettings();
});

macInput.addEventListener("input", () => {
  const caret = macInput.selectionStart;
  const before = macInput.value;
  const formatted = formatMac(before);
  if (formatted !== before) {
    macInput.value = formatted;
    const delta = formatted.length - before.length;
    const next = Math.max(0, (caret ?? formatted.length) + delta);
    macInput.setSelectionRange(next, next);
  }
});

[broadcastInput, portInput].forEach((el) => {
  el.addEventListener("change", saveSettings);
});

wakeBtn.addEventListener("click", wake);
detectBtn.addEventListener("click", detectNetwork);

document.getElementById("wakeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  wake();
});

loadSettings().then(() => setStatus("Ready"));
