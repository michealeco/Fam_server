const { backendBase, backendHeaders } = require("./_backend");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const upstream = await fetch(`${backendBase()}/api/config`, {
      headers: backendHeaders(),
    });
    const data = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json({
      name: data.name || "My PC",
    });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: err.message || "Could not reach Ubuntu wake server",
      name: "My PC",
    });
  }
};
