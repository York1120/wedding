#!/usr/bin/env node
/**
 * 婚礼请柬站 · 腾讯云门卫服务
 * ---------------------------------------------------------------------------
 * 这个文件替代了原来跑在 Cloudflare Workers 上的 worker.js。
 *
 * 为什么需要它：wrangler.toml 里的 `run_worker_first` 是 Cloudflare 专有指令，
 * 告诉它「首页请求先交给 worker」。换成 Nginx 托管静态文件后没人执行 worker，
 * index.html 会被原样返回，密码页就消失了。所以这里用 Node 把同一套逻辑重做一遍：
 *   1. `/` 与 `/index.html` 走密码门（表单 + SHA-256 token + 24 小时 cookie）
 *   2. 其余路径按静态文件返回，支持 Range（iOS 播 m4a 必需）
 *   3. 复刻 _headers 的缓存策略
 *   4. 屏蔽 .git、worker.js（里面有明文密码）、部署配置等不该公开的东西
 *   5. 密码页里也显示备案号 —— 审核人员被密码拦住时仍能看到备案信息
 *
 * 用法：
 *   WEDDING_PASSWORD=你的密码 PORT=3000 node server.mjs
 *   前面挂 Nginx 反代（见 deploy/nginx.conf.example）
 * ---------------------------------------------------------------------------
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const PASSWORD = process.env.WEDDING_PASSWORD || "0";
const COOKIE = "wedding_gate24";
const MAX_AGE = 60 * 60 * 24; // 免密期 24 小时
const TOKEN = crypto.createHash("sha256").update(`wedding-gate-v1:${PASSWORD}`).digest("hex");

const BEIAN_ICP = "粤ICP备2026169766号";
const BEIAN_PSB_CODE = "f623891cea7755205a7787259005b838";

/* ------------------------------------------------------------------ 密码页 */

function gatePage(error = "") {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>囍 · 周煜全 &amp; 张令仪 · 婚礼请柬</title>
<meta property="og:site_name" content="周煜全 &amp; 张令仪 · 婚礼请柬">
<meta property="og:title" content="周煜全 &amp; 张令仪 · 婚礼请柬">
<meta property="og:description" content="谨定于2027年1月26日（农历丙午年腊月十九），湖南桃源沙坪张府，敬备喜宴，恭候光临。">
<meta property="og:image" content="https://wedding.yorkedu.cn/images/share.png">
<meta property="og:image:secure_url" content="https://wedding.yorkedu.cn/images/share.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="500">
<meta property="og:image:height" content="500">
<meta property="og:image:alt" content="囍 · 周煜全与张令仪婚礼请柬">
<meta name="robots" content="noindex, nofollow">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    min-height: 100vh;
    font-family: "Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", "Songti SC", serif;
    background: radial-gradient(ellipse at 50% 0%, #8f1f1f 0%, #6d1212 55%, #4f0c0c 100%);
    color: #f3e2c0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    text-align: center;
  }
  .xi { font-size: 72px; color: #e8c66a; line-height: 1; margin-bottom: 26px; }
  h1 { font-size: 22px; font-weight: normal; letter-spacing: 6px; }
  form { margin-top: 30px; display: flex; flex-direction: column; align-items: center; }
  input {
    width: 220px;
    padding: 11px 16px;
    font-size: 18px;
    letter-spacing: 6px;
    text-align: center;
    color: #6d1212;
    background: #fbf6ea;
    border: 1px solid #d9b36a;
    border-radius: 8px;
    outline: none;
  }
  input:focus { box-shadow: 0 0 0 3px rgba(232,198,106,.35); }
  button {
    margin-top: 18px;
    padding: 10px 44px;
    font-size: 16px;
    letter-spacing: 6px;
    font-family: inherit;
    color: #6d1212;
    background: linear-gradient(160deg, #fbf6ea, #f3e9d2);
    border: 1px solid #d9b36a;
    border-radius: 8px;
    cursor: pointer;
  }
  button:active { transform: translateY(1px); }
  .error { margin-top: 18px; font-size: 13px; letter-spacing: 2px; color: #ffb4a2; }
  .hint24 { margin-top: 16px; font-size: 12px; letter-spacing: 2px; color: rgba(243,226,192,.5); }
  .beian {
    margin-top: 44px;
    font-family: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
    font-size: 11px;
    line-height: 1.9;
    letter-spacing: .04em;
    color: rgba(201,163,92,.55);
  }
  .beian a { color: inherit; text-decoration: none; }
  .beian a:hover { text-decoration: underline; }
</style>
</head>
<body>
  <div class="xi">囍</div>
  <h1>请输入访问密码</h1>
  <form method="POST" action="/">
    <input type="password" name="password" autocomplete="off" autofocus>
    <button type="submit">进 入</button>
  </form>
  ${error ? `<div class="error">${error}</div>` : ""}
  <div class="hint24">验证后 24 小时内免密访问</div>
  <div class="beian">
    <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">${BEIAN_ICP}</a>
    <span style="opacity:.45;margin:0 8px;">·</span>
    <a href="https://beian.mps.gov.cn/#/query/webSearch?code=${BEIAN_PSB_CODE}" target="_blank" rel="noopener noreferrer">公安联网备案</a>
  </div>
</body>
</html>`;
}

// 免密进入时在主页顶部提示（数秒后自动淡出）
const HINT_HTML = `
<div id="gateHint" style="position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:999;
  background:rgba(0,0,0,.72);color:#F7E7C3;font:13px/1.5 'Kaiti SC','STKaiti','KaiTi',serif;letter-spacing:.12em;
  padding:8px 18px;border-radius:999px;border:1px solid rgba(232,198,106,.5);box-shadow:0 4px 16px rgba(0,0,0,.35);
  opacity:0;transition:opacity .6s ease .4s;pointer-events:none;white-space:nowrap">已验证，24小时内免密码访问</div>
<script>addEventListener('load',()=>{var h=document.getElementById('gateHint');if(!h)return;
requestAnimationFrame(function(){h.style.opacity=1});
setTimeout(function(){h.style.opacity=0;setTimeout(function(){h.remove()},800)},4200)});</script>`;

/* -------------------------------------------------------------- 静态文件层 */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webmanifest": "application/manifest+json",
};

/** 不该被公开访问的路径（对应 Cloudflare 的 .assetsignore + 额外加固） */
const DENY_PREFIX = [
  "/.git/",
  "/.github/",
  "/node_modules/",
  "/deploy/",
  "/_originals/",
  "/poster/src/",
];
const DENY_EXACT = new Set([
  "/worker.js",          // 里面有明文密码，绝对不能公开
  "/server.mjs",         // 本文件
  "/wrangler.toml",
  "/_headers",
  "/.assetsignore",
  "/.gitignore",
  "/README.md",
]);
/** 各类 README / 构建源，按后缀与文件名排除 */
function isDeniedPath(p) {
  if (DENY_EXACT.has(p)) return true;
  if (DENY_PREFIX.some((pre) => p.startsWith(pre))) return true;
  if (/\/README\.md$/i.test(p)) return true;
  if (/\/_[^/]+(\/|$)/.test(p)) return true;              // _fontsrc / _shots / _charset.txt
  if (/\/poster-design[^/]*\.md$/i.test(p)) return true;
  return false;
}

/** 复刻 _headers 里的缓存策略 */
function cacheControlFor(p) {
  if (/^\/inv-[a-z]+\/fonts\//.test(p)) return "public, max-age=3600, stale-while-revalidate=604800";
  if (p.startsWith("/images/") || p.startsWith("/audio/")) return "public, max-age=86400, stale-while-revalidate=604800";
  if (/^\/poster\/.+\/poster[^/]*\.html$/.test(p)) return "public, max-age=0, must-revalidate";
  if (p === "/poster/html2canvas-pro.min.js") return "public, max-age=31536000, immutable";
  return "no-cache";
}

/**
 * 把 URL 路径解析为磁盘路径，拒绝越界访问。
 * 目录请求（/inv-b/）会映射到 index.html。
 */
function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const rel = path.normalize(decoded).replace(/^([/\\])+/, "");
  const abs = path.join(ROOT, rel);
  // 防目录穿越
  if (!abs.startsWith(ROOT + path.sep) && abs !== ROOT) return null;
  return abs;
}

function sendFile(req, res, abs, urlPath) {
  let stat;
  try {
    stat = fs.statSync(abs);
  } catch {
    return send404(res);
  }

  // 目录 → 找 index.html；没有就 404（不列目录）
  if (stat.isDirectory()) {
    if (!urlPath.endsWith("/")) {
      res.writeHead(301, { Location: urlPath + "/" });
      return res.end();
    }
    const idx = path.join(abs, "index.html");
    if (!fs.existsSync(idx)) return send404(res);
    return sendFile(req, res, idx, urlPath + "index.html");
  }

  const ext = path.extname(abs).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  const headers = {
    "Content-Type": type,
    "Cache-Control": cacheControlFor(urlPath),
    ETag: etag,
    "Last-Modified": new Date(stat.mtimeMs).toUTCString(),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };

  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }

  // Range 支持：iOS/Safari 播放 m4a 依赖 206
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      let start = m[1] === "" ? null : Number(m[1]);
      let end = m[2] === "" ? null : Number(m[2]);
      if (start === null && end === null) {
        // 忽略非法 Range，退回整文件
      } else {
        if (start === null) {
          start = Math.max(0, stat.size - end);
          end = stat.size - 1;
        } else if (end === null || end >= stat.size) {
          end = stat.size - 1;
        }
        if (start > end || start >= stat.size) {
          res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
          return res.end();
        }
        res.writeHead(206, {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1,
        });
        return fs.createReadStream(abs, { start, end }).pipe(res);
      }
    }
  }

  headers["Accept-Ranges"] = "bytes";
  headers["Content-Length"] = stat.size;
  res.writeHead(200, headers);
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(abs).pipe(res);
}

function send404(res) {
  const p = path.join(ROOT, "404.html");
  if (fs.existsSync(p)) {
    const body = fs.readFileSync(p);
    res.writeHead(404, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": body.length,
      "Cache-Control": "no-cache",
    });
    return res.end(body);
  }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("404 Not Found");
}

/* ------------------------------------------------------------------ 服务入口 */

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  // 安全：屏蔽敏感路径
  if (isDeniedPath(pathname) || pathname.split("/").some((s) => s === ".git")) {
    return send404(res);
  }

  const isGate = pathname === "/" || pathname === "/index.html";

  // 非首页：直接静态返回
  if (!isGate) {
    const abs = resolveFile(pathname);
    if (!abs) return send404(res);
    return sendFile(req, res, abs, pathname);
  }

  // ---- 首页：密码门 ----
  if (req.method === "POST") {
    let body = "";
    let tooBig = false;
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4096) {
        tooBig = true;
        req.destroy();
      }
    });
    req.on("end", () => {
      if (tooBig) return;
      let password = "";
      try {
        password = new URLSearchParams(body).get("password") || "";
      } catch {
        // 非表单 POST 一律按密码错误处理
      }
      if (String(password).trim() === PASSWORD) {
        res.writeHead(302, {
          Location: "/",
          "Set-Cookie": `${COOKIE}=${TOKEN}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax`,
          "Cache-Control": "no-store",
        });
        return res.end();
      }
      const html = gatePage("密码不正确，请重试");
      res.writeHead(401, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(html);
    });
    req.on("error", () => {});
    return;
  }

  if ((req.headers.cookie || "").includes(`${COOKIE}=${TOKEN}`)) {
    const abs = path.join(ROOT, "index.html");
    let html;
    try {
      html = fs.readFileSync(abs, "utf8");
    } catch {
      return send404(res);
    }
    const out = html.replace("<body>", "<body>" + HINT_HTML);
    const buf = Buffer.from(out, "utf8");
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": buf.length,
      "Cache-Control": "no-cache",
    });
    return res.end(buf);
  }

  const html = gatePage();
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(html);
});

server.listen(PORT, HOST, () => {
  console.log(`[wedding] 门卫服务已启动 http://${HOST}:${PORT}`);
  console.log(`[wedding] 站点根目录 ${ROOT}`);
  console.log(`[wedding] 密码来源 ${process.env.WEDDING_PASSWORD ? "环境变量" : "默认值（请尽快设置 WEDDING_PASSWORD）"}`);
});
