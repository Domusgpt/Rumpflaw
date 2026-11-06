#!/usr/bin/env node
/**
 * serve.mjs — tiny zero-dependency static server for local preview and automated tests.
 *   node scripts/serve.mjs [dir=dist] [port=4173]
 * Serves 404.html for missing paths (mirrors GitHub Pages behaviour).
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, normalize } from 'node:path';

const dir = resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || process.env.PORT || 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.ico': 'image/x-icon',
};

export function startServer({ root = dir, listenPort = port } = {}) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
      let file = join(root, p);
      if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
      let s = await stat(file).catch(() => null);
      if (s?.isDirectory()) { file = join(file, 'index.html'); s = await stat(file).catch(() => null); }
      if (!s) {
        const nf = await readFile(join(root, '404.html')).catch(() => null);
        res.writeHead(404, { 'content-type': TYPES['.html'] }).end(nf || 'Not found');
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });
  return new Promise((r) => server.listen(listenPort, '127.0.0.1', () => r(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().then(() => console.log(`Serving ${dir} at http://127.0.0.1:${port}/`));
}
