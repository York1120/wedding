# -*- coding: utf-8 -*-
"""
校验: 页面里出现的字, 自托管字体子集是否全部覆盖。
缺字不会报错, 只会静默降级到系统字体 —— 手机上才发现字体不一致, 所以必须主动检查。

用法: python check_font_coverage.py [项目目录]
退出码: 0 全覆盖 / 1 有缺字
"""
import html as htmllib
import os
import re
import sys

from fontTools.ttLib import TTFont


def collect_text(html_path):
    src = open(html_path, encoding="utf-8").read()
    body = re.sub(r"<!--.*?-->", "", src, flags=re.S)
    body = re.sub(r"<(style|script)\b.*?</\1>", "", body, flags=re.S | re.I)
    return htmllib.unescape(re.sub(r"<[^>]+>", "", body))


def main():
    project = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
    entry = os.path.join(project, "index.html")
    fonts_dir = os.path.join(project, "fonts")
    if not os.path.exists(entry):
        sys.exit(f"!! 找不到 {entry}")
    if not os.path.isdir(fonts_dir):
        sys.exit(f"!! 找不到 {fonts_dir}")

    text = collect_text(entry)
    # 页面里要渲染的字符: 正文 + 数字 + 拉丁 + CJK 标点 + 全角
    need = {c for c in text if c.isprintable()}
    need |= set("0123456789")
    need |= {chr(c) for c in range(0x20, 0x7F)}
    need |= {chr(c) for c in range(0x3000, 0x3040)}
    need |= {chr(c) for c in range(0xFF01, 0xFF61)}

    woff2s = sorted(f for f in os.listdir(fonts_dir) if f.endswith(".woff2"))
    if not woff2s:
        sys.exit("!! fonts/ 下没有 woff2")

    exact = set()
    for f in woff2s:
        font = TTFont(os.path.join(fonts_dir, f), fontNumber=0, lazy=True)
        exact |= set(font.getBestCmap().keys())
        font.close()

    missing = sorted(c for c in need if ord(c) not in exact)
    # 空白与 emoji 不算缺字: 前者不渲染, 后者一律由系统 emoji 字体提供
    def is_ignorable(c):
        cp = ord(c)
        if c.isspace():
            return True
        return (0x1F000 <= cp <= 0x1FAFF or 0x2600 <= cp <= 0x27BF
                or 0x2190 <= cp <= 0x21FF or 0x2B00 <= cp <= 0x2BFF
                or cp in (0xFE0F, 0x200D))
    missing = [c for c in missing if not is_ignorable(c)]

    print(f"[字体覆盖] 页面需要 {len(need)} 个字符; 子集共 {len(woff2s)} 个文件")
    if not missing:
        print("[字体覆盖] 全部覆盖 ✓")
        return 0
    print(f"[字体覆盖] ✗ 缺 {len(missing)} 个字: {''.join(missing)}")
    print("           -> 重跑 tools/_build_fonts.py 重建子集")
    return 1


if __name__ == "__main__":
    sys.exit(main())
