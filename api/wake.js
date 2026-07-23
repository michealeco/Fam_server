const { backendBase, backendHeaders } = require("./_backend");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const upstream = await fetch(`${backendBase()}/api/wake`, {
      method: "POST",
      headers: backendHeaders(),
      body: "{}",
    });
    const data = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: err.message || "Could not reach Ubuntu wake server",
    });
  }
};
