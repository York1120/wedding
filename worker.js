// 主页访问密码门：仅拦截 / 与 /index.html（见 wrangler.toml 的 run_worker_first），
// 其余子页面不经过此脚本，直接命中静态资产。

const PASSWORD = "0";
const COOKIE = "wedding_gate";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 天免重复输入

const TOKEN = [...new Uint8Array(
  await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`wedding-gate-v1:${PASSWORD}`))
)].map(b => b.toString(16).padStart(2, "0")).join("");

function gatePage(error = "") {
  return new Response(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>囍 · 访问验证</title>
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
</body>
</html>`, {
    status: error ? 401 : 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname !== "/" && pathname !== "/index.html") return env.ASSETS.fetch(request);

    if (request.method === "POST") {
      const form = await request.formData();
      if ((form.get("password") || "").trim() === PASSWORD) {
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
      return env.ASSETS.fetch(request);
    }
    return gatePage();
  },
};
