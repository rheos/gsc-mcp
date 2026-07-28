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
