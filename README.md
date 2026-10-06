# wedding

Static hub for wedding micro-sites — single-file invitation pages and poster pages. No build step, everything served as-is.

## Structure

| Path | Content |
| --- | --- |
| `index.html` | Landing page linking to all sub-sites |
| `inv-b/` `inv-g/` `inv-o/` | Single-file invitation pages (entry: `index.html`, self-hosted font subsets in `fonts/`) |
| `poster/` | Chinese & western posters (`poster/chinese/poster.html`, `poster/western/poster-western.html`), render sources in `poster/src/` |

Conventions: directories/files starting with `_` are local build artifacts and are not committed. Font subsets are rebuilt after copy changes; CI checks coverage on every push.

## Deploy (Cloudflare Pages)

Git integration: connect this repo, framework preset **None**, build command **(empty)**, output dir `/` — or just accept `wrangler.toml` defaults.

Direct upload: `npx wrangler pages deploy .`
