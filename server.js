const http = require("http");
const dgram = require("dgram");
const fs = require("fs");
const path = require("path");
const { networkInterfaces } = require("os");

const PORT = Number(process.env.PORT) || 3847;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

function parseMac(mac) {
  const cleaned = String(mac || "")
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "");
  if (cleaned.length !== 12) return null;
  const bytes = [];
  for (let i = 0; i < 12; i += 2) {
    bytes.push(parseInt(cleaned.slice(i, i + 2), 16));
  }
  return Buffer.from(bytes);
}

function buildMagicPacket(macBuf) {
  const packet = Buffer.alloc(102);
  packet.fill(0xff, 0, 6);
  for (let i = 1; i <= 16; i++) {
    macBuf.copy(packet, i * 6);
  }
  return packet;
}

function isBroadcastIp(ip) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip);
}

function localIpv4Hints() {
  const nets = networkInterfaces();
  const hints = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        const parts = net.address.split(".").map(Number);
        const mask = (net.netmask || "255.255.255.0").split(".").map(Number);
        const broadcast = parts
          .map((octet, i) => (octet & mask[i]) | (~mask[i] & 255))
          .join(".");
        hints.push({
          iface: name,
          address: net.address,
          broadcast,
        });
      }
    }
  }
  return hints;
}

function sendWake({ mac, broadcast, port }) {
  return new Promise((resolve, reject) => {
    const macBuf = parseMac(mac);
    if (!macBuf) {
      reject(new Error("Invalid MAC address. Use format AA:BB:CC:DD:EE:FF"));
      return;
    }
    const target = broadcast || "255.255.255.255";
    if (!isBroadcastIp(target)) {
      reject(new Error("Invalid broadcast / IP address"));
      return;
    }
    const udpPort = Number(port) || 9;
    if (!Number.isInteger(udpPort) || udpPort < 1 || udpPort > 65535) {
      reject(new Error("Port must be between 1 and 65535"));
      return;
    }

    const packet = buildMagicPacket(macBuf);
    const socket = dgram.createSocket("udp4");

    socket.once("error", (err) => {
      try {
        socket.close();
      } catch (_) {
        /* ignore */
      }
      reject(err);
    });

    socket.bind(() => {
      try {
        socket.setBroadcast(true);
      } catch (err) {
        socket.close();
        reject(err);
        return;
      }

      socket.send(packet, 0, packet.length, udpPort, target, (err) => {
        socket.close();
        if (err) reject(err);
        else {
          resolve({
            mac: [...macBuf]
              .map((b) => b.toString(16).padStart(2, "0"))
              .join(":")
              .toUpperCase(),
            broadcast: target,
            port: udpPort,
            bytes: packet.length,
          });
        }
      });
    });
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1e6) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safe);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404).end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || "").split("?")[0];

  if (req.method === "GET" && url === "/api/network") {
    sendJson(res, 200, { interfaces: localIpv4Hints() });
    return;
  }

  if (req.method === "POST" && url === "/api/wake") {
    try {
      const body = await readBody(req);
      const result = await sendWake(body);
      sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
      sendJson(res, 400, { ok: false, error: err.message || String(err) });
    }
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405).end("Method not allowed");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`PC Open — Wake-on-LAN ready at http://localhost:${PORT}`);
  console.log("Open that URL from any device on your network to wake your PC.");
});
