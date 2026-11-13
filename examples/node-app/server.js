// Smallest possible PushPad-compatible Node app: listens on PORT (80 on the server) and answers / and /health.
const http = require('http');

const port = process.env.PORT || 3000;
const started = new Date().toISOString();

http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"status":"ok"}');
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><meta charset="utf-8"><title>Node app on PushPad</title>
<body style="font:18px/1.6 ui-monospace,monospace;background:#e4e4e4;padding:12vh 8vw">
<p style="background:#ff6a1a;display:inline-block;padding:0 .6rem">NODE APP</p>
<h1>Hello from a Node server on PushPad.</h1><p>Started ${started}. Try <a href="/health">/health</a>.</p></body>`);
}).listen(port, () => console.log('listening on ' + port));
