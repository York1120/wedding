# 腾讯云部署说明（密码门）

原来这个站跑在 Cloudflare Workers 上，首页密码由 `worker.js` 实现。
Worker 依赖 Cloudflare 的 `run_worker_first` 与 `env.ASSETS` 绑定，迁到腾讯云后
不会被任何进程执行，所以密码页消失。本目录的配置用 Node 服务把同一套逻辑重做。

## 架构

```
访客 → Nginx :443（TLS 终止）
          ↓ 反代
        Node 服务 127.0.0.1:3000（server.mjs）
          ├─ /  和 /index.html → 密码门（表单 + SHA-256 token + 24h cookie）
          └─ 其余路径 → 静态文件（带 Range、缓存策略、敏感路径屏蔽）
```

**Nginx 不要用 `root` 指向仓库目录**，所有静态文件都由 Node 服务发出，
这样 `worker.js`（内有明文密码）、`.git/`、`poster/src/` 才不会被直接下载。

## 一、准备 Node 环境

```bash
# 已装可跳过
node -v          # 需要 18 及以上
# Debian/Ubuntu 装 Node 20：
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 二、拉代码

```bash
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/York1120/wedding.git
sudo chown -R www-data:www-data /var/www/wedding
```

后续更新：

```bash
cd /var/www/wedding
sudo git pull
sudo systemctl restart wedding
```

> 私有仓库需要凭据。建议在服务器上配置 deploy key（只读），
> 不要用带 token 的 URL，避免 token 留在 `.git/config`。

## 三、设置访问密码

```bash
sudo tee /etc/wedding.env > /dev/null <<'EOF'
PORT=3000
HOST=127.0.0.1
WEDDING_PASSWORD=换成你的真实密码
EOF

sudo chmod 600 /etc/wedding.env
sudo chown root:root /etc/wedding.env
```

密码是**明文存储在环境文件**里（权限 600），服务启动时读取并计算 SHA-256 token。
改密码后需要 `sudo systemctl restart wedding`，同时旧 cookie 自动失效。

## 四、注册 systemd 服务

```bash
sudo cp /var/www/wedding/deploy/wedding.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wedding
sudo systemctl status wedding --no-pager
```

日志：

```bash
sudo journalctl -u wedding -f
```

## 五、配置 Nginx

```bash
sudo cp /var/www/wedding/deploy/nginx.conf.example /etc/nginx/conf.d/wedding.conf
# 把 ssl_certificate / ssl_certificate_key 改成你证书的真实路径
sudo nano /etc/nginx/conf.d/wedding.conf

sudo nginx -t && sudo systemctl reload nginx
```

**务必检查旧的站点配置**：如果之前有 `root /var/www/wedding;` 这样的
静态站点配置，要先删掉或禁用，否则它会和反代抢同一个 server_name。

## 六、验证清单

```bash
# 1. 首页应返回密码页（HTTP 200，含"请输入访问密码"）
curl -s https://wedding.yorkedu.cn/ | grep -c "请输入访问密码"

# 2. 密码页必须能看到备案号
curl -s https://wedding.yorkedu.cn/ | grep -c "粤ICP备2026169766号"

# 3. 错误密码返回 401
curl -s -o /dev/null -w "%{http_code}\n" -d "password=wrong" https://wedding.yorkedu.cn/

# 4. 正确密码返回 302 并下发 cookie
curl -s -o /dev/null -D - -d "password=你的密码" https://wedding.yorkedu.cn/ | grep -i "set-cookie"

# 5. 敏感文件必须 404
curl -s -o /dev/null -w "worker.js=%{http_code}\n" https://wedding.yorkedu.cn/worker.js
curl -s -o /dev/null -w ".git=%{http_code}\n"     https://wedding.yorkedu.cn/.git/config
curl -s -o /dev/null -w "poster/src=%{http_code}\n" https://wedding.yorkedu.cn/poster/src/poster.html

# 6. 子页面正常（未被密码拦）
curl -s -o /dev/null -w "inv-b=%{http_code}\n" https://wedding.yorkedu.cn/inv-b/

# 7. 音频支持 Range（iOS 播放 m4a 必需）
curl -s -o /dev/null -D - -H "Range: bytes=0-1023" https://wedding.yorkedu.cn/audio/bgm.m4a | head -3
```

## 七、备案相关说明

- **密码页本身也展示备案号**，所以即使审核人员被密码拦住，页面底部依然能看到
  `粤ICP备2026169766号` 和公安联网备案链接，不会因为"首页看不到备案信息"被判定不合格。
- 密码门只拦 `/` 和 `/index.html`，子页面（`/inv-b/`、`/poster/...`）保持公开，
  网站整体仍是可访问状态，不影响备案核查。
- 如果哪天管局要求站点完全公开，只需停掉门卫并把 Nginx 的 `root` 指回目录
  （同时记得把 `worker.js`、`.git`、`poster/src` 加入 `deny`）。
