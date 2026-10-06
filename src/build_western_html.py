# -*- coding: utf-8 -*-
"""Build self-contained poster-western.html: subset fonts, base64-embed,
wrap the 1500x2100 stage in a fit-to-viewport scaler."""
import base64
import io
import re

from fontTools import subset
from fontTools.ttLib import TTFont

CHARSET = (
    "THEWEDDINGCELEBRATIONOFLingyiYuquan张令仪周煜全"
    "REQUESTHONOUROFYURPRESNCETudaytwentysixhJanuay"
    "ZHANGFAMILYRESIDNCEShapingTownTaoyuanCounyChangdeHunan"
    "农历丙午年腊月十九张府思元刘萍敬邀照片位"
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    ".,·&-—()（）  "
)


def subset_font(path, charset):
    font = TTFont(path)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.desubroutinize = True
    ss = subset.Subsetter(opts)
    ss.populate(text=charset)
    ss.subset(font)
    buf = io.BytesIO()
    font.save(buf)
    return buf.getvalue()


def b64(data, mime):
    return f"data:{mime};base64," + base64.b64encode(data).decode()


src = open("poster_western.html", encoding="utf-8").read()

for fn in ["GreatVibes-400.ttf", "CormorantGaramond-400.ttf",
           "CormorantGaramond-500.ttf", "CormorantGaramond-600.ttf",
           "NotoSerifSC-400.ttf"]:
    data = subset_font(fn, CHARSET)
    src = src.replace(f"url('{fn}') format('truetype')", f"url('{b64(data, 'font/woff2')}') format('woff2')")
    print(f"{fn}: {len(data)/1024:.0f} KB")

# embed the arch photo
src = src.replace('src="photo.jpg"', 'src="' + b64(open("photo.jpg", "rb").read(), "image/jpeg") + '"')

scaler_css = """
  html, body {
    width: 100%; height: 100%; margin: 0; overflow: hidden;
    background: #20130A;
    display: flex; align-items: center; justify-content: center;
  }
  #stage {
    width: 1500px; height: 2100px; flex: none;
    transform-origin: center center;
    position: relative;
    background: var(--ivory);
    box-shadow: 0 30px 90px rgba(0, 0, 0, 0.5);
  }
"""
src = src.replace(
    "  html, body { width: 1500px; height: 2100px; overflow: hidden; }\n  body {\n    font-family: 'Cormorant', serif;\n    background: var(--ivory);\n    position: relative;\n  }",
    "  body {\n    font-family: 'Cormorant', serif;\n  }\n" + scaler_css,
)

scaler_js = """
<script>
  const stage = document.getElementById('stage');
  function fit() {
    const s = Math.min(innerWidth / 1500, innerHeight / 2100);
    stage.style.transform = 'scale(' + s + ')';
  }
  addEventListener('resize', fit);
  fit();
</script>
"""
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

open("../poster-western.html", "w", encoding="utf-8").write(src)
print(f"../poster-western.html: {len(src.encode())/1024:.0f} KB")

# inject the drag-and-drop editor (marked data-noexport, keeps exports clean)
editor = open("editor.js", encoding="utf-8").read()
src = src.replace("</body>", "<script data-noexport>\n" + editor + "\n</script>\n</body>")
open("../poster-western.html", "w", encoding="utf-8").write(src)
print(f"../poster-western.html (+editor): {len(src.encode())/1024:.0f} KB")
