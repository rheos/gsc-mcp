// The 4 read-only Search Console tools, as MCP tool definitions (JSON Schema input)
// + a dispatcher. Logic mirrors the stdio dev server; only the transport differs.

const RO = { readOnlyHint: true, openWorldHint: true };

export const TOOLS = [
  {
    name: 'gsc_list_sites',
    description:
      'List every Search Console property (site) the account can access, with permission level. Call this first to get exact siteUrl values for the other tools.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: RO,
  },
  {
    name: 'gsc_search_analytics',
    description:
      'Query Search Console search performance (clicks, impressions, CTR, average position), grouped by the requested dimensions. Dates are YYYY-MM-DD; GSC data lags ~2-3 days. Omit dimensions for site-wide totals.',
    inputSchema: {
      type: 'object',
      properties: {
        siteUrl: {
          type: 'string',
          description:
            'Property URL EXACTLY as in Search Console, e.g. "https://devweb.org/" or "sc-domain:devweb.org". Get exact values from gsc_list_sites.',
        },
        startDate: { type: 'string', description: 'YYYY-MM-DD' },
        endDate: { type: 'string', description: 'YYYY-MM-DD' },
        dimensions: {
          type: 'array',
          items: { type: 'string', enum: ['query', 'page', 'country', 'device', 'date', 'searchAppearance'] },
          description: 'Group rows by these. Omit for a single totals row.',
        },
        rowLimit: { type: 'integer', minimum: 1, maximum: 25000, default: 50 },
        type: {
          type: 'string',
          enum: ['web', 'image', 'video', 'news', 'discover', 'googleNews'],
          description: 'Search type. Default web.',
        },
        query: { type: 'string', description: 'Optional: only rows whose query contains this substring.' },
      },
      required: ['siteUrl', 'startDate', 'endDate'],
      additionalProperties: false,
    },
    annotations: RO,
  },
  {
    name: 'gsc_inspect_url',
    description:
      "Inspect a single URL's index status in Google (coverage state, last crawl, indexing verdict, mobile usability, rich results) — the URL Inspection tool.",
    inputSchema: {
      type: 'object',
      properties: {
        siteUrl: { type: 'string', description: 'The property URL that owns the inspected URL (from gsc_list_sites).' },
        inspectionUrl: { type: 'string', description: 'Full URL to inspect, e.g. https://devweb.org/articles/...' },
      },
      required: ['siteUrl', 'inspectionUrl'],
      additionalProperties: false,
    },
    annotations: RO,
  },
  {
    name: 'gsc_list_sitemaps',
    description:
      'List sitemaps submitted for a property, with last-submitted/downloaded times, processing status, and error/warning counts.',
    inputSchema: {
      type: 'object',
      properties: { siteUrl: { type: 'string', description: 'Property URL (from gsc_list_sites).' } },
      required: ['siteUrl'],
      additionalProperties: false,
    },
    annotations: RO,
  },
];

const ok = (obj) => ({
  content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }],
  isError: false,
});
const fail = (e) => ({
  content: [
    {
      type: 'text',
      text: `Error: ${e?.errors?.[0]?.message || e?.response?.data?.error?.message || e?.message || String(e)}`,
    },
  ],
  isError: true,
});

// Dispatch a tools/call. Returns the MCP { content, isError } envelope — tool-level
// failures come back as isError:true (a successful JSON-RPC response), per the spec.
export async function dispatch(clients, name, args = {}) {
  const { webmasters, searchconsole } = clients;
  switch (name) {
    case 'gsc_list_sites': {
      try {
        const { data } = await webmasters.sites.list();
        return ok((data.siteEntry || []).map((s) => ({ siteUrl: s.siteUrl, permission: s.permissionLevel })));
      } catch (e) {
        return fail(e);
      }
    }
    case 'gsc_search_analytics': {
      const { siteUrl, startDate, endDate, dimensions, rowLimit = 50, type, query } = args;
      try {
        const requestBody = { startDate, endDate, rowLimit };
        if (dimensions?.length) requestBody.dimensions = dimensions;
        if (type) requestBody.type = type;
        if (query)
          requestBody.dimensionFilterGroups = [
            { filters: [{ dimension: 'query', operator: 'contains', expression: query }] },
          ];
        const { data } = await webmasters.searchanalytics.query({ siteUrl, requestBody });
        return ok({ rowCount: (data.rows || []).length, rows: data.rows || [] });
      } catch (e) {
        return fail(e);
      }
    }
    case 'gsc_inspect_url': {
      const { siteUrl, inspectionUrl } = args;
      try {
        const { data } = await searchconsole.urlInspection.index.inspect({ requestBody: { siteUrl, inspectionUrl } });
        return ok(data);
      } catch (e) {
        return fail(e);
      }
    }
    case 'gsc_list_sitemaps': {
      const { siteUrl } = args;
      try {
        const { data } = await webmasters.sitemaps.list({ siteUrl });
        return ok(data.sitemap || []);
      } catch (e) {
        return fail(e);
      }
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
