# wedding

Static hub for wedding micro-sites — single-file invitation pages and poster pages. No build step, everything served as-is.

## Structure

| Path | Content |
| --- | --- |
| `index.html` | Landing page linking to all sub-sites |
| `inv-b/` `inv-g/` `inv-o/` | Single-file invitation pages (entry: `index.html`, self-hosted font subsets in `fonts/`) |
| `inv-w/` | Western invitation (Ivory Ceremony: wax-seal envelope opening, Roman-arch photo niches) |
| `poster/` | Chinese & western posters (`poster/chinese/poster.html`, `poster/western/poster-western.html`), render sources in `poster/src/` |

Conventions: directories/files starting with `_` are local build artifacts and are not committed. Font subsets are rebuilt after copy changes; CI checks coverage on every push.

## Deploy (Cloudflare)

Git integration: every push to `main` auto-deploys as Workers static assets (config in `wrangler.toml`, no build step).

Manual deploy: `npx wrangler deploy`
