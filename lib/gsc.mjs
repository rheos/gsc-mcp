// Google Search Console client factory.
// Auth: the `authorized_user` refresh-token JSON written by the local `auth.mjs`
// one-time consent flow (see the stdio dev server). On the box this file is placed
// out-of-repo and pointed at via the GSC_TOKEN env var.
import { google } from 'googleapis';
import fs from 'node:fs';

export function makeClients(tokenPath) {
  if (!fs.existsSync(tokenPath)) {
    throw new Error(
      `No GSC token at ${tokenPath}. Generate it with the gsc auth flow and place the ` +
        `authorized_user JSON there (or set GSC_TOKEN to its path).`,
    );
  }
  const auth = google.auth.fromJSON(JSON.parse(fs.readFileSync(tokenPath, 'utf8')));
  return {
    webmasters: google.webmasters({ version: 'v3', auth }),
    searchconsole: google.searchconsole({ version: 'v1', auth }),
  };
}
