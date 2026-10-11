# -*- coding: utf-8 -*-
"""重建自托管字体子集：从 _fontsrc/ 的源 TTF 按页面实际用字重新子集化。

背景：页面里出现但子集缺失的字**不会报错**，只会静默降级到系统字体
（手机/微信里就表现为「这几个字字体不一样」）。所以每次改正文文案后
必须重跑本脚本。

用法（在仓库根目录执行）：
    python inv-g/tools/_build_fonts.py inv-g
"""
import os
import re
import sys
import html as htmllib

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FONTSRC = os.path.join(ROOT, "inv-w", "_fontsrc")


def collect_text(html_path):
    src = open(html_path, encoding="utf-8").read()
    body = re.sub(r"<!--.*?-->", "", src, flags=re.S)
    body = re.sub(r"<(style|script)\b.*?</\1>", "", body, flags=re.S | re.I)
    return htmllib.unescape(re.sub(r"<[^>]+>", "", body))


def needed_chars(text):
    need = {c for c in text if c.isprintable()}
    need |= set("0123456789")
    need |= {chr(c) for c in range(0x20, 0x7F)}
    need |= {chr(c) for c in range(0x3000, 0x3040)}
    need |= {chr(c) for c in range(0xFF01, 0xFF61)}

    def ignorable(c):
        cp = ord(c)
        if c.isspace():
            return True
        return (
            0x1F000 <= cp <= 0x1FAFF
            or 0x2600 <= cp <= 0x27BF
            or 0x2190 <= cp <= 0x21FF
            or 0x2B00 <= cp <= 0x2BFF
            or cp in (0xFE0F, 0x200D)
        )

    return {c for c in need if not ignorable(c)}


def build(src_ttf, out_woff2, chars, family_ok):
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.desubroutinize = True
    opts.drop_tables += ["DSIG"]
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    font = subset.load_font(src_ttf, opts)
    subsetter = subset.Subsetter(options=opts)
    subsetter.populate(text="".join(sorted(chars)))
    subsetter.subset(font)
    subset.save_font(font, out_woff2, opts)
    got = set(TTFont(out_woff2, lazy=True).getBestCmap().keys())
    lack = sorted(c for c in chars if ord(c) not in got)
    if lack:
        print("  !! 源字体本身缺: %s" % "".join(lack))
        sys.exit(1)
    print("  -> %s  %d 字  %.1f KB" % (os.path.basename(out_woff2), len(got),
                                       os.path.getsize(out_woff2) / 1024))


def main():
    project = sys.argv[1] if len(sys.argv) > 1 else "inv-g"
    pdir = os.path.abspath(os.path.join(ROOT, project))
    entry = os.path.join(pdir, "index.html")
    fdir = os.path.join(pdir, "fonts")
    if not os.path.exists(entry):
        sys.exit("!! 找不到 " + entry)
    if not os.path.isdir(FONTSRC):
        sys.exit("!! 找不到源字体目录 " + FONTSRC)

    chars = needed_chars(collect_text(entry))
    print("[重建] %s  需要 %d 个字符" % (project, len(chars)))

    jobs = [
        ("NotoSerifSC-400.ttf", "NotoSerifSC-400.woff2"),
        ("NotoSerifSC-700.ttf", "NotoSerifSC-700.woff2"),
        # MaShanZheng 没有 _fontsrc 源 TTF，且它是毛笔体装饰字体，
        # 正文不用它渲染「各位亲人」，故不重建（改了文案也不影响它）。
    ]
    for src_name, out_name in jobs:
        src_ttf = os.path.join(FONTSRC, src_name)
        if not os.path.exists(src_ttf):
            print("  -- 跳过 %s（无源文件）" % src_name)
            continue
        print("  build %s" % src_name)
        build(src_ttf, os.path.join(fdir, out_name), chars, True)

    print("[完成] 请接着跑 %s/tools/_check_font_coverage.py %s 验证"
          % (project, project))


if __name__ == "__main__":
    main()