# -*- coding: utf-8 -*-
"""Build self-contained poster.html: subset fonts to poster charset, base64-embed
all assets, wrap the 2200x2000 stage in a fit-to-viewport scaler."""
import base64
import html as htmllib
import io
import re

from fontTools import subset
from fontTools.ttLib import TTFont

CHARSET = (
    "尊敬的各位亲朋好友小女于归良辰已定吾有薄酒以谢良友敬备喜宴恭候台驾"
    "新郎周煜全新娘张令仪时间公历年月日星期二农历丙午腊十九地点湖南省常德"
    "市桃源县沙坪镇府张思元刘萍敬邀二〇二七年一月二十六日见佳偶天成百年好"
    "合吾家有喜囍"
    "0123456789（）·、，。：！？&—- "
)


def subset_font(path, charset):
    font = TTFont(path)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.desubroutinize = True
    opts.drop_tables += ["FFTM"]
    ss = subset.Subsetter(opts)
    ss.populate(text=charset)
    ss.subset(font)
    buf = io.BytesIO()
    font.save(buf)
    return buf.getvalue()


def b64(data, mime):
    return f"data:{mime};base64," + base64.b64encode(data).decode()


src = open("poster.html", encoding="utf-8").read()

fonts = {
    "MaShanZheng-400.ttf": ("font/woff2", "font-family: 'MaShanZheng';"),
    "NotoSerifSC-400.ttf": ("font/woff2", ""),
    "NotoSerifSC-700.ttf": ("font/woff2", ""),
}
for fn, (mime, _) in fonts.items():
    data = subset_font(fn, CHARSET)
    url = b64(data, mime)
    src = src.replace(f"url('{fn}') format('truetype')", f"url('{url}') format('woff2')")
    print(f"{fn}: {len(data)/1024:.0f} KB subset")

src = src.replace("photo1.jpg", b64(open("photo1.jpg", "rb").read(), "image/jpeg"))
src = src.replace("photo3.jpg", b64(open("photo3.jpg", "rb").read(), "image/jpeg"))
src = src.replace('src="xi.png"', 'src="' + b64(open("xi.png", "rb").read(), "image/png") + '"')

scaler_css = """
  html, body {
    width: 100%; height: 100%; margin: 0; overflow: hidden;
    background: #230a0a;
    display: flex; align-items: center; justify-content: center;
  }
  #stage {
    width: 2200px; height: 2000px; flex: none;
    transform-origin: center center;
    position: relative;
    box-shadow: 0 30px 90px rgba(0, 0, 0, 0.55);
  }
"""
src = src.replace(
    "  html, body { width: 2200px; height: 2000px; overflow: hidden; }\n\n  body {\n    font-family: 'NotoSerifSC', serif;\n    background: #8E2325;\n    position: relative;\n  }",
    scaler_css
    + "  body {\n    font-family: 'NotoSerifSC', serif;\n  }\n\n  #stage > * { position: absolute; }\n  .panel { top: 0; height: 2000px; }\n  .texture { inset: 0; }",
)

scaler_js = """
<script>
  const stage = document.getElementById('stage');
  function fit() {
    const s = Math.min(innerWidth / 2200, innerHeight / 2000);
    stage.style.transform = 'scale(' + s + ')';
  }
  addEventListener('resize', fit);
  fit();
</script>
"""

# wrap everything after <body> in #stage and append scaler script
body_open = src.index("<body>") + len("<body>")
body_close = src.index("</body>")
inner = src[body_open:body_close]
src = (
    src[:body_open]
    + '<div id="stage">'
    + inner
    + "</div>\n"
    + scaler_js
    + src[body_close:]
)
src = src.replace(
    "<title>",
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>',
)

src = src.replace(
    "<title>吾家有喜 · 张令仪 & 周煜全</title>",
    "<title>吾家有喜 · 张令仪 & 周煜全 婚礼海报</title>",
)

open("../poster.html", "w", encoding="utf-8").write(src)
print(f"../poster.html: {len(src.encode())/1024:.0f} KB")

# inject the drag-and-drop editor (marked data-noexport, keeps exports clean)
editor = open("editor.js", encoding="utf-8").read()
src = src.replace("</body>", "<script data-noexport>\n" + editor + "\n</script>\n</body>")
open("../poster.html", "w", encoding="utf-8").write(src)
print(f"../poster.html (+editor): {len(src.encode())/1024:.0f} KB")
