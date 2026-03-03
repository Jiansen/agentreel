const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const net = require("net");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const vncWsPort = parseInt(process.env.AGENTREEL_VNC_WS_PORT || "6080", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url || "/", true));
  });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "/");

    if (pathname === "/vnc-ws") {
      const upstream = net.createConnection(vncWsPort, "127.0.0.1", () => {
        const raw =
          `GET /websockify HTTP/1.1\r\n` +
          `Host: 127.0.0.1:${vncWsPort}\r\n` +
          `Upgrade: websocket\r\n` +
          `Connection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${req.headers["sec-websocket-key"]}\r\n` +
          `Sec-WebSocket-Version: ${req.headers["sec-websocket-version"]}\r\n` +
          (req.headers["sec-websocket-protocol"]
            ? `Sec-WebSocket-Protocol: ${req.headers["sec-websocket-protocol"]}\r\n`
            : "") +
          `\r\n`;
        upstream.write(raw);
        upstream.pipe(socket);
        socket.pipe(upstream);
      });

      upstream.on("error", () => socket.destroy());
      socket.on("error", () => upstream.destroy());
      return;
    }

    socket.destroy();
  });

  server.listen(port, () => {
    console.log(`> AgentReel ready on http://localhost:${port}`);
    console.log(`> VNC WebSocket proxy: ws://localhost:${port}/vnc-ws → localhost:${vncWsPort}`);
  });
});
