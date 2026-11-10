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

## Deploy

### 腾讯云（当前线上 · wedding.yorkedu.cn）

见 [deploy/README.md](deploy/README.md)：Node 门卫服务（`server.mjs`）+ Nginx 反代。

> ⚠️ `worker.js` 依赖 Cloudflare 运行时（`run_worker_first` + `env.ASSETS`）。
> 直接把这个仓库目录挂到 Nginx 静态托管，**首页密码会失效**，而且 `worker.js`
> 会被公开下载（内含明文密码）。腾讯云部署必须走 `server.mjs`。

### Cloudflare（备用）

Git integration: every push to `main` auto-deploys as Workers static assets (config in `wrangler.toml`, no build step).

Manual deploy: `npx wrangler deploy`
