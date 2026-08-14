# Google Search Console MCP server

A small, read-only Model Context Protocol server that gives agents access to Google Search Console analytics, URL inspection, sitemap status, and property listings over Streamable HTTP.

It exists to make Search Console data available to coding and reporting agents without granting write access to the underlying account.

## Tools

| Tool | Returns |
| --- | --- |
| `gsc_list_sites` | Accessible Search Console properties and permission levels |
| `gsc_search_analytics` | Clicks, impressions, CTR, and average position grouped by supported dimensions |
| `gsc_inspect_url` | Index coverage, crawl details, indexing verdict, and rich-result status |
| `gsc_list_sitemaps` | Submitted sitemaps with status, warning, and error counts |

All Google calls use the `webmasters.readonly` scope.

## How it works

- JSON-RPC 2.0 over a single `POST /mcp` endpoint
- MCP protocol version `2024-11-05`
- Streamable HTTP responses as `application/json`
- API-key authentication through an `Authorization: Bearer` header or `api_key` query parameter
- An unauthenticated `GET /health` endpoint for local health checks
- One configured Google identity per running process

## Prerequisites

- Node.js 20 or later
- A Google Cloud project with the Search Console API enabled
- An OAuth desktop client and an `authorized_user` token for a Google account that can access the required Search Console properties

The server does not run an interactive OAuth flow. Authorize the Google identity separately with the `https://www.googleapis.com/auth/webmasters.readonly` scope, store the resulting token JSON outside this repository, and set `GSC_TOKEN` to its absolute path. Google's [OAuth 2.0 documentation](https://developers.google.com/identity/protocols/oauth2) covers client setup and authorization.

## Local development

```bash
npm install
cp .env.example .env
npm start
```

Generate a local API key with `openssl rand -hex 32`, put it in `GSC_MCP_API_KEY`, and keep the server bound to `127.0.0.1` unless you have added a secure network boundary.

Check the service and list its tools:

```bash
curl -s http://127.0.0.1:3120/health

curl -s http://127.0.0.1:3120/mcp \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_API_KEY' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Configuration

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port, default `3120` |
| `HOST` | Bind address, default `127.0.0.1` |
| `GSC_MCP_API_KEY` | Key required by MCP requests |
| `GSC_TOKEN` | Absolute path to the Google `authorized_user` token JSON |

Prefer bearer-header authentication. Query-string keys can be captured in browser history, reverse-proxy logs, and monitoring systems.

For use outside localhost, terminate TLS at a trusted reverse proxy, keep the Google token off the web host where practical, and restrict network access to known clients. API keys, OAuth tokens, connector URLs, and deployment details should never be committed.

## License

This repository does not currently include an open-source license. A permissive license is under consideration because this server is intended to be a reusable developer utility.

Built at [Novadiem Studio](https://novadiem.com).
# gsc-mcp

Read-only Google Search Console MCP server with a Streamable HTTP JSON-RPC transport.

It exposes a small tool surface for agents that need Search Console data without giving them write access to Google Search Console.

## Tools

| Tool | Does |
|---|---|
| `gsc_list_sites` | List accessible Search Console properties and permission levels. |
| `gsc_search_analytics` | Return clicks, impressions, CTR, and average position grouped by query, page, country, device, date, or search appearance. |
| `gsc_inspect_url` | Run URL Inspection for index coverage, crawl, indexing verdict, and rich result status. |
| `gsc_list_sitemaps` | List submitted sitemaps with status and error/warning counts. |

All Google calls use the read-only `webmasters.readonly` scope.

## Transport And Auth

- JSON-RPC 2.0 over a single `POST /mcp` endpoint.
- MCP protocol version: `2024-11-05`.
- Responses are `application/json`.
- Auth accepts either `?api_key=<key>` or `Authorization: Bearer <key>`.
- `GET /health` is unauthenticated for local health checks.
- Google auth uses an `authorized_user` JSON file whose path is configured with `GSC_TOKEN`.

## Local Development

```bash
npm install
cp .env.example .env
npm start
```

Example local smoke test:

```bash
curl -s "http://127.0.0.1:3120/health"
curl -s "http://127.0.0.1:3120/mcp?api_key=dev-key" \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Configuration

See `.env.example` for the supported environment variables:

- `PORT`
- `HOST`
- `GSC_MCP_API_KEY`
- `GSC_TOKEN`

Keep API keys, OAuth token JSON files, deployment details, and private connector URLs out of git.
