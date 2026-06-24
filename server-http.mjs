#!/usr/bin/env node
// gsc MCP — Streamable-HTTP (JSON-RPC 2.0) transport.
// Mirrors the M.O.T. /api/mcp handler: single POST endpoint, all messages are
// JSON-RPC 2.0, responses are always application/json (no SSE — tools are short
// async calls and are awaited). Auth: api key from ?api_key= or Authorization: Bearer,
// timing-safe compared to GSC_MCP_API_KEY. Reached in prod via Apache ProxyPass
// mcp.example.com/gsc -> 127.0.0.1:PORT/mcp.
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { makeClients } from './lib/gsc.mjs';
import { TOOLS, dispatch } from './lib/tools.mjs';

const PORT = parseInt(process.env.PORT || '3120', 10);
const HOST = process.env.HOST || '127.0.0.1';
const API_KEY = process.env.GSC_MCP_API_KEY || '';
const TOKEN_PATH = process.env.GSC_TOKEN || path.join(os.homedir(), 'Documents/exampleco/keys/oauth/gsc-token.json');
const PROTOCOL_VERSION = '2024-11-05';

if (!API_KEY) {
  console.error('[gsc-mcp] FATAL: GSC_MCP_API_KEY is not set.');
  process.exit(1);
}

let clients;
try {
  clients = makeClients(TOKEN_PATH);
} catch (e) {
  console.error('[gsc-mcp] FATAL:', e.message);
  process.exit(1);
}

function keyOk(req, url) {
  const header = req.headers['authorization'] || '';
  const fromHeader = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  const fromQuery = url.searchParams.get('api_key');
  const token = fromHeader || fromQuery;
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(API_KEY);
  return a.length === b.length && timingSafeEqual(a, b);
}

const send = (res, status, body) => {
  const payload = body === null ? '' : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
};
const rpcResult = (res, id, result) => send(res, 200, { jsonrpc: '2.0', id, result });
const rpcError = (res, id, code, message) => send(res, 200, { jsonrpc: '2.0', id, error: { code, message } });

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Unauthenticated health check (for deploy.sh / monitoring).
  if (req.method === 'GET' && url.pathname.endsWith('/health')) {
    return send(res, 200, { status: 'ok', server: 'gsc', tools: TOOLS.length });
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST' });
    return res.end(JSON.stringify({ error: 'method not allowed' }));
  }

  if (!keyOk(req, url)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'unauthorized' }));
  }

  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 1_000_000) req.destroy(); // 1MB guard
  });
  req.on('end', async () => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return rpcError(res, null, -32700, 'Parse error');
    }
    if (msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      return rpcError(res, msg?.id ?? null, -32600, 'Invalid Request');
    }
    // Notifications (no id) — acknowledge with 202, no body.
    if (!('id' in msg)) return send(res, 202, null);

    const { id, method, params } = msg;
    try {
      switch (method) {
        case 'initialize':
          return rpcResult(res, id ?? null, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: { name: 'gsc', version: '1.0.0' },
          });
        case 'ping':
          return rpcResult(res, id ?? null, {});
        case 'tools/list':
          return rpcResult(res, id ?? null, { tools: TOOLS });
        case 'tools/call': {
          const p = params || {};
          if (!p.name) return rpcError(res, id ?? null, -32602, 'Missing tool name');
          console.log(`[gsc-mcp] call: ${p.name}(${Object.keys(p.arguments || {}).join(',')})`);
          const result = await dispatch(clients, p.name, p.arguments || {});
          return rpcResult(res, id ?? null, result);
        }
        default:
          return rpcError(res, id ?? null, -32601, `Method not found: ${method}`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Internal error';
      if (method === 'tools/call') {
        console.error(`[gsc-mcp] error: ${(params || {}).name || 'unknown'}: ${message}`);
        return rpcResult(res, id ?? null, { content: [{ type: 'text', text: message }], isError: true });
      }
      return rpcError(res, id ?? null, -32603, message);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.error(`[gsc-mcp] ready on http://${HOST}:${PORT} (${TOOLS.length} tools)`);
});
