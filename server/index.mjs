import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const config = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
  demoEnabled: process.env.DEMO_ENABLED === 'true',
};
function publicKey(key) {
  if (key.startsWith('sb_publishable_')) return true;
  try {
    return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon';
  } catch {
    return false;
  }
}
if (
  (config.supabaseUrl || config.supabaseKey) &&
  (!/^https:\/\//.test(config.supabaseUrl) || !publicKey(config.supabaseKey))
)
  throw new Error(
    'Configure uma URL HTTPS e uma chave publicável (ou anon). Chaves administrativas não são permitidas.',
  );
if (!config.demoEnabled && (!config.supabaseUrl || !config.supabaseKey))
  throw new Error(
    'Supabase não configurado. Defina as variáveis ou habilite explicitamente DEMO_ENABLED=true para demonstração.',
  );
const index = await readFile(resolve(root, 'index.html'));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};
const csp = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: ${config.supabaseUrl || ''}; connect-src 'self' ${config.supabaseUrl || ''} ${config.supabaseUrl.replace('https:', 'wss:') || ''}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`;
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(
        req.method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok', service: 'pixote-crm' }),
      );
      return;
    }
    if (pathname === '/config.json') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(config));
      return;
    }
    const path = resolve(root, '.' + pathname);
    if (!path.startsWith(root + sep) && path !== root) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (pathname.split('/').some((p) => p.startsWith('.'))) {
      res.writeHead(404);
      res.end();
      return;
    }
    let body;
    let type;
    let immutable = false;
    try {
      const info = await stat(path);
      if (!info.isFile()) throw new Error('not-file');
      body = await readFile(path);
      type = mime[extname(path)] || 'application/octet-stream';
      immutable = pathname.startsWith('/assets/');
    } catch {
      if (extname(pathname)) {
        res.writeHead(404);
        res.end();
        return;
      }
      body = index;
      type = mime['.html'];
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Content-Length': body.length,
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
  }
});
const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () =>
  console.log(`Pixote CRM disponível em http://localhost:${port}`),
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
