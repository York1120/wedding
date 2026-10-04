# 张令仪 & 周煜全 · 婚礼请柬

中式红金风格电子请柬(女方父亲视角),微信内直接打开分享。

- **线上地址**:https://wedding-invitation-35805.app.workbuddy.host/
- **代码仓库**:https://github.com/York1120/wedding (本仓库,内容与线上一致)

## 文件结构

| 文件 | 说明 |
|---|---|
| `index.html` | 请柬页面(入口必须叫这个名) |
| `xi.png` | 书法囍字(从参考图抠出的透明底素材,页面多处引用) |
| `call-icon.png` | 来电灵动岛的 iOS 电话图标(模拟来电开场用) |
| `share.png` | 微信分享卡片缩略图 500x500 |
| `bgm.m4a` | 背景音乐(AAC,接听来电进入封面后自动播放,音乐钮可暂停/继续) |
| `bell.wav` | 来电铃声(清脆铃铛三敲,合成生成,来电页循环,接听即停) |
| `fonts/` | 自托管字体子集,由 `tools/_build_fonts.py` 生成,不要手改 |
| `tools/` | 字体裁剪 / 移动端检查脚本(不参与部署) |

照片约定:命名为 `图片1.jpg` / `图片2.jpg` / `图片3.jpg` 放在本目录即可自动显示。

## 修改流程

1. 改 `index.html`(或在照片位放图片);
2. **若增删了页面文字**,必须重跑 `python tools/_build_fonts.py` 重建字体子集
   (脚本会自动下载完整字体并按页面用字裁剪);
3. 用 workbuddy 应用重新发布(`workbuddy_sites_deploy`,directory 指向本目录);
4. 微信分享卡片信息在 `<head>` 的 `og:description` / `og:image` 中修改;
   分享地址变化时同步更新 `og:url` / `og:image` 两行。

## 注意事项

- 所有资源文件一律用 ASCII 文件名(中文文件名在 HTTP 层会 404);
- 页面不得引用 Google Fonts 域名(境内直连超时会卡首屏),字体必须自托管;
- 部署前确认 `_fontsrc/`、`_charset.txt` 等中间产物已清理(已在 .gitignore 中)。
