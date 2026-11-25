import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { handle } from './worker.mjs';

const publicPath = fileURLToPath(new URL('../public', import.meta.url));
const port = Number(process.env.PORT || 4713);
const host = process.env.HOST || '127.0.0.1';
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf', '.json': 'application/json', '.zip': 'application/zip'
};

const env = {
  SHANGFU_ORIGIN: process.env.SHANGFU_ORIGIN,
  SHANGFU_SERVICE_TOKEN: process.env.SHANGFU_SERVICE_TOKEN,
  REQUIRE_PASSWORD: process.env.REQUIRE_PASSWORD,
  ACCESS_PASSWORD_HASH: process.env.ACCESS_PASSWORD_HASH,
  SESSION_SECRET: process.env.SESSION_SECRET,
  OLLAMA_URL: process.env.OLLAMA_URL,
  OLLAMA_MODEL: process.env.OLLAMA_MODEL,
  OLLAMA_TOKEN: process.env.OLLAMA_TOKEN,
  ASSETS: {
    async fetch(request) {
      const { pathname } = new URL(request.url);
      const path = resolve(publicPath, '.' + pathname);
      if (!path.startsWith(publicPath + sep)) return new Response(null, { status: 404 });
      try {
        const bytes = await readFile(path);
        return new Response(request.method === 'HEAD' ? null : bytes, {
          headers: { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream', 'Content-Length': String(bytes.byteLength) }
        });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    }
  }
};

// For the full local stack, use the same authenticated Cloudflare image bindings
// as the hosted workbench. Text inference still goes to the configured Ollama.
const cloudPhotos=process.env.SHANGFU_REMOTE_IMAGES === '1'
  ? await (await import('wrangler')).getPlatformProxy({configPath:fileURLToPath(new URL('../wrangler.jsonc',import.meta.url)),envFiles:[],persist:false,remoteBindings:true})
  : null;
if (cloudPhotos) {
  env.AI=cloudPhotos.env.AI;
  env.IMAGES=cloudPhotos.env.IMAGES;
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://' + (req.headers.host || host + ':' + port));
    const init = { method: req.method, headers: req.headers };
    if (req.method !== 'HEAD' && req.method !== 'GET') {
      init.body = Readable.toWeb(req);
      init.duplex = 'half';
    }
    const result = await handle(new Request(url, init), env);
    res.writeHead(result.status, Object.fromEntries(result.headers));
    if (result.body) Readable.fromWeb(result.body).on('error', () => res.destroy()).pipe(res);
    else res.end();
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('服务请求失败');
  }
});
server.on('close',()=>cloudPhotos?.dispose());
server.listen(port, host, () => console.log(`海派定制顾问 http://${host}:${port}/design-agent`));
