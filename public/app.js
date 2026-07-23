const wakeBtn = document.getElementById("wakeBtn");
const statusEl = document.getElementById("status");
const targetNameEl = document.getElementById("targetName");

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.className = `status${kind ? ` is-${kind}` : ""}`;
  wakeBtn.classList.remove("is-sending", "is-ok", "is-err");
  if (kind === "busy") wakeBtn.classList.add("is-sending");
  if (kind === "ok") wakeBtn.classList.add("is-ok");
  if (kind === "err") wakeBtn.classList.add("is-err");
}

async function loadTarget() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return;
    const data = await res.json();
    targetNameEl.textContent = data.name || "My PC";
  } catch {
    targetNameEl.textContent = "My PC";
  }
}

async function wake() {
  setStatus("Sending magic packet…", "busy");
  wakeBtn.disabled = true;

  try {
    const res = await fetch("/api/wake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Wake request failed");
    }
    setStatus("Packet sent — your PC should wake", "ok");
  } catch (err) {
    setStatus(err.message || "Wake failed", "err");
  } finally {
    wakeBtn.disabled = false;
  }
}

wakeBtn.addEventListener("click", wake);
loadTarget().then(() => setStatus("Ready"));
