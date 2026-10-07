// 主页访问密码门：仅拦截 / 与 /index.html（见 wrangler.toml 的 run_worker_first），
// 其余子页面不经过此脚本，直接命中静态资产。

const PASSWORD = "0";
const COOKIE = "wedding_gate24"; // v2：改名以作废用户浏览器里旧的 30 天 cookie
const MAX_AGE = 60 * 60 * 24;    // 免密期 24 小时

const TOKEN = [...new Uint8Array(
  await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`wedding-gate-v1:${PASSWORD}`))
)].map(b => b.toString(16).padStart(2, "0")).join("");

function gatePage(error = "") {
  return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>囍 · 周煜全 &amp; 张令仪 · 婚礼请柬</title>
<meta property="og:site_name" content="周煜全 &amp; 张令仪 · 婚礼请柬">
<meta property="og:title" content="周煜全 &amp; 张令仪 · 婚礼请柬">
<meta property="og:description" content="谨定于2027年1月26日（农历丙午年腊月十九），湖南桃源沙坪张府，敬备喜宴，恭候光临。">
<meta property="og:image" content="https://wedding.mynameisyork.workers.dev/images/share.png">
<meta property="og:image:secure_url" content="https://wedding.mynameisyork.workers.dev/images/share.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="500">
<meta property="og:image:height" content="500">
<meta property="og:image:alt" content="囍 · 周煜全与张令仪婚礼请柬">
<meta itemprop="name" content="周煜全 &amp; 张令仪 · 婚礼请柬">
<meta itemprop="description" content="谨定于2027年1月26日（农历丙午年腊月十九），湖南桃源沙坪张府，敬备喜宴，恭候光临。">
<meta itemprop="image" content="https://wedding.mynameisyork.workers.dev/images/share.png">
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
  .error {
    margin-top: 18px;
    font-size: 13px;
    letter-spacing: 2px;
    color: #ffb4a2;
  }
  .hint24 {
    margin-top: 16px;
    font-size: 12px;
    letter-spacing: 2px;
    color: rgba(243,226,192,.5);
  }
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
</body>
</html>`, {
    status: error ? 401 : 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
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

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname !== "/" && pathname !== "/index.html") return env.ASSETS.fetch(request);

    if (request.method === "POST") {
      let password = "";
      try {
        password = (await request.formData()).get("password") || "";
      } catch {
        // 非表单格式的 POST 一律按密码错误处理，避免抛 500
      }
      if (String(password).trim() === PASSWORD) {
        return new Response(null, {
          status: 302,
          headers: {
            "Location": "/",
            "Set-Cookie": `${COOKIE}=${TOKEN}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax`,
          },
        });
      }
      return gatePage("密码不正确，请重试");
    }

    if ((request.headers.get("Cookie") || "").includes(`${COOKIE}=${TOKEN}`)) {
      const res = await env.ASSETS.fetch(request);
      if ((res.headers.get("content-type") || "").includes("text/html")) {
        let html = await res.text();
        html = html.replace("<body>", "<body>" + HINT_HTML, 1);
        return new Response(html, res);
      }
      return res;
    }
    return gatePage();
  },
};
