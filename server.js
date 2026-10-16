'use strict';

const http = require('http');
const store = require('./src/store');
const { routes, BASE } = require('./src/routes');
const { SPEC } = require('./src/validate');

const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'; // ex.: https://meu-front.vercel.app (padrão: libera todos)

function compile(path) {
  const names = [];
  const re = path.replace(/:([a-z_]+)/gi, (_, n) => (names.push(n), '([^/]+)'));
  return { regex: new RegExp(`^${re}$`), names };
}
const compiled = routes.map((r) => ({ ...r, ...compile(r.path) }));

function send(res, status, data) {
  const body = data === undefined ? '' : JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 2 * 1024 * 1024) { reject(new store.HttpError(413, 'Payload muito grande')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const DOCS_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Materna API - Docs</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head>
<body><div id="ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: '/openapi.json', dom_id: '#ui' });</script></body></html>`;

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (CORS_ORIGIN !== '*') res.setHeader('Vary', 'Origin');

  try {
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const query = Object.fromEntries(url.searchParams);

    // utilitários (fora do Swagger)
    if (req.method === 'GET' && path === '/') {
      return send(res, 200, { api: 'Materna API (mock)', baseUrl: BASE, docs: '/docs', health: '/health', swagger: SPEC.info.version });
    }
    if (req.method === 'GET' && path === '/health') return send(res, 200, { status: 'ok' });
    if (req.method === 'GET' && path === '/openapi.json') return send(res, 200, SPEC);
    if (req.method === 'GET' && path === '/docs') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(DOCS_HTML);
    }
    if (req.method === 'POST' && path === '/_dev/reset') {
      store.reset();
      return send(res, 200, { message: 'Dados restaurados para o estado inicial' });
    }

    let route, params = {};
    const pathMatches = [];
    for (const r of compiled) {
      const m = r.regex.exec(path);
      if (!m) continue;
      pathMatches.push(r);
      if (r.method === req.method && !route) {
        route = r;
        r.names.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])));
      }
    }
    if (!route) {
      if (pathMatches.length) {
        res.setHeader('Allow', [...new Set(pathMatches.map((r) => r.method))].join(', '));
        return send(res, 405, { message: 'Método não permitido' });
      }
      return send(res, 404, { message: 'Rota não encontrada' });
    }

    let body;
    if (route.hasBody) {
      // valida o ID da URL antes do corpo, para devolver 400 (ID) antes de 415/400 (corpo)
      if (params.id !== undefined && !/^\d+$/.test(params.id)) return send(res, 400, { message: 'Invalid ID supplied' });
      if (!/^application\/json/i.test(req.headers['content-type'] || '')) {
        return send(res, 415, { message: 'Invalid Content-Type: use application/json' });
      }
      const raw = await readBody(req);
      try { body = JSON.parse(raw); } catch { return send(res, 400, { message: 'Invalid input: JSON malformado ou vazio' }); }
      if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        return send(res, 400, { message: 'Invalid input: o corpo deve ser um objeto JSON' });
      }
    } else {
      req.resume();
    }

    const result = route.handler({ params, query, body });
    return send(res, result.status || 200, result.data);
  } catch (err) {
    if (err instanceof store.HttpError) {
      return send(res, err.status, { message: err.message, ...(err.extra || {}) });
    }
    console.error(err);
    return send(res, 500, { message: 'Error Internal Server' });
  }
}

const server = http.createServer(handler);

if (require.main === module) {
  const PORT = process.env.PORT || 9090; // o Render injeta PORT automaticamente
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Materna API rodando na porta ${PORT}`);
    console.log(`Base: http://localhost:${PORT}${BASE}  |  Docs: http://localhost:${PORT}/docs`);
  });
}

module.exports = server;
