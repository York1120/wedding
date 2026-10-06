/* 海报可视化编辑器：注入到自包含 poster.html 中。
   编辑模式开启后可拖动元素、双击改字、±字号、隐藏，并可导出 PNG / HTML。
   所有 UI 节点均带 data-noexport，不会出现在导出结果里。 */
(function () {
  if (window.__posterEditor) return;
  window.__posterEditor = true;

  var stage = document.getElementById('stage');
  var W = stage.offsetWidth, H = stage.offsetHeight;

  /* 两套海报可拖动元素的并集（各自不存在的类名不会命中） */
  var MOVABLE = ['.photo-wrap', '.arch', '.calligraphy', '.blessing', '.corner-xi-l1', '.corner-xi-l2',
    '.xi-hero', '.salute', '.verse', '.name-l', '.name-r', '.seal-medal', '.divider',
    '.sec-label', '.time-1', '.time-2', '.loc-1', '.loc-2', '.host', '.footline',
    '.corner-xi-r1', '.corner-xi-r2',
    '.sprig-top', '.eyebrow', '.name-1', '.amp', '.name-2', '.cn-names',
    '.stem-l', '.stem-r', '.slot-label', '.presence',
    '.date-1', '.date-2', '.date-cn', '.div-sm',
    '.venue-1', '.venue-2', '.venue-cn', '.seal', '.host-cn'].join(',');

  var style = document.createElement('style');
  style.setAttribute('data-noexport', '');
  style.textContent = [
    '#ed-bar{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:99999;',
    'display:flex;gap:6px;align-items:center;background:rgba(22,14,10,.85);padding:8px 12px;',
    'border-radius:10px;font:13px/1.4 system-ui,sans-serif;color:#f3e8d2;box-shadow:0 6px 24px rgba(0,0,0,.4)}',
    '#ed-bar button{background:#3d2c20;border:1px solid #a98e5f;color:#f3e8d2;border-radius:6px;',
    'padding:4px 11px;cursor:pointer;font-size:13px;font-family:inherit}',
    '#ed-bar button:hover{background:#5a3f2b}',
    '#ed-bar button.primary{background:#8a6a3a;border-color:#d8bd85}',
    '#ed-bar .ed-hint{opacity:.65;margin-left:8px;font-size:12px}',
    '#ed-bar[hidden]{display:none}',
    '.ed-on img{-webkit-user-drag:none;user-select:none}',
    '.ed-on :is(' + MOVABLE + '){cursor:move}',
    '.ed-on :is(' + MOVABLE + '):hover{outline:1.5px dashed rgba(255,235,190,.75);outline-offset:2px}',
    '[contenteditable="true"]{outline:2px solid #e8c87c!important;cursor:text!important;user-select:text}',
    '#ed-selbox{position:absolute;border:1.5px dashed #e8c87c;pointer-events:none;z-index:9990;display:none}',
    '#ed-guide{position:absolute;top:0;width:1px;height:100%;background:rgba(232,200,124,.8);',
    'pointer-events:none;z-index:9989;display:none}'
  ].join('');
  document.head.appendChild(style);

  var bar = document.createElement('div');
  bar.setAttribute('data-noexport', '');
  bar.id = 'ed-bar';
  bar.innerHTML =
    '<button id="ed-toggle" class="primary">✏ 编辑</button>' +
    '<span id="ed-tools" hidden>' +
    '<button data-act="minus">字号 −</button>' +
    '<button data-act="plus">字号 ＋</button>' +
    '<button data-act="center">居中</button>' +
    '<button data-act="hide">隐藏</button>' +
    '<button data-act="png">导出 PNG</button>' +
    '<button data-act="html">导出 HTML</button>' +
    '<button data-act="reset">恢复默认</button>' +
    '<span class="ed-hint">拖动移动 · 双击改字 · 方向键微调(Shift×10) · Del 隐藏</span>' +
    '</span>';
  document.body.appendChild(bar);

  var tools = bar.querySelector('#ed-tools');
  var selbox = document.createElement('div');
  var guide = document.createElement('div');
  selbox.id = 'ed-selbox'; guide.id = 'ed-guide';
  selbox.setAttribute('data-noexport', ''); guide.setAttribute('data-noexport', '');
  stage.appendChild(selbox); stage.appendChild(guide);

  var snapshot = stage.innerHTML;
  var editMode = false, selected = null;

  function fitScale() { return stage.getBoundingClientRect().width / stage.offsetWidth; }
  function stageOrigin() { return stage.getBoundingClientRect(); }

  /* 把元素的定位“落”为具体像素（清除 50%/translate 类居中写法），之后拖动只改 left/top。
     坐标必须相对元素真实的定位父级 offsetParent 计算，否则会跳位。 */
  function materialize(el) {
    if (el.style.left && el.style.transform === 'none') return;
    var s = fitScale();
    var op = el.offsetParent || stage;
    var or = op.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    el.style.position = 'absolute';
    el.style.left = ((r.left - or.left) / s) + 'px';
    el.style.top = ((r.top - or.top) / s) + 'px';
    el.style.width = (r.width / s) + 'px';
    el.style.transform = 'none';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.margin = '0';
  }

  function syncSelbox() {
    if (!selected) { selbox.style.display = 'none'; return; }
    var s = fitScale(), sr = stageOrigin(), r = selected.getBoundingClientRect();
    selbox.style.display = 'block';
    selbox.style.left = ((r.left - sr.left) / s - 4) + 'px';
    selbox.style.top = ((r.top - sr.top) / s - 4) + 'px';
    selbox.style.width = (r.width / s + 8) + 'px';
    selbox.style.height = (r.height / s + 8) + 'px';
  }

  function select(el) { selected = el; syncSelbox(); }
  function deselect() { selected = null; selbox.style.display = 'none'; }

  function setEditMode(on) {
    editMode = on;
    stage.classList.toggle('ed-on', on);
    tools.hidden = !on;
    bar.querySelector('#ed-toggle').textContent = on ? '✓ 完成' : '✏ 编辑';
    if (!on) { deselect(); if (document.activeElement) document.activeElement.blur(); }
  }

  /* ---------- 拖动 + 双击检测（pointerdown 的 preventDefault 会抑制原生 dblclick，
     因此用两次快速 pointerdown 自行检测双击） ---------- */
  var lastTap = { t: 0, el: null };

  function startTextEdit(el) {
    el.contentEditable = 'true';
    el.focus();
    var range = document.createRange(); range.selectNodeContents(el);
    var sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    el.addEventListener('blur', function () { el.contentEditable = 'false'; }, { once: true });
  }

  stage.addEventListener('pointerdown', function (ev) {
    if (!editMode) return;
    var el = ev.target.closest(MOVABLE);
    if (!el) { deselect(); return; }
    var active = document.activeElement;
    if (active && active.isContentEditable && active !== el) active.blur();
    if (active === el && el.isContentEditable) return; /* 编辑中：让光标正常落点 */
    var now = Date.now();
    if (lastTap.el === el && now - lastTap.t < 450) {
      lastTap = { t: 0, el: null };
      if (el.innerText.trim() && el.tagName !== 'IMG') { startTextEdit(el); return; }
    }
    lastTap = { t: now, el: el };
    ev.preventDefault();
    select(el);
    materialize(el);
    var s = fitScale(), sr = stageOrigin();
    var startL = parseFloat(el.style.left), startT = parseFloat(el.style.top);
    var px = ev.clientX, py = ev.clientY;

    function onMove(e) {
      var dx = (e.clientX - px) / s, dy = (e.clientY - py) / s;
      var nl = startL + dx, nt = startT + dy;
      var par = el.offsetParent || stage;
      var cw = (par === stage ? W : par.getBoundingClientRect().width / s);
      var center = cw / 2, elc = nl + el.offsetWidth / 2;
      if (Math.abs(elc - center) < 9) {
        nl = center - el.offsetWidth / 2;
        var pr = par.getBoundingClientRect();
        guide.style.display = 'block';
        guide.style.left = ((pr.left - sr.left) / s + cw / 2) + 'px';
      } else guide.style.display = 'none';
      el.style.left = nl + 'px';
      el.style.top = nt + 'px';
      syncSelbox();
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      guide.style.display = 'none';
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
  stage.addEventListener('dragstart', function (e) { if (editMode) e.preventDefault(); });

  /* ---------- 双击改字（保留触摸板等无鼠标场景的原生事件兜底） ---------- */
  stage.addEventListener('dblclick', function (ev) {
    if (!editMode || document.activeElement && document.activeElement.isContentEditable) return;
    var el = ev.target.closest(MOVABLE);
    if (!el || !el.innerText.trim() || el.tagName === 'IMG') return;
    startTextEdit(el);
  });

  /* ---------- 键盘 ---------- */
  document.addEventListener('keydown', function (e) {
    if (!editMode) return;
    if (document.activeElement && document.activeElement.isContentEditable) {
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }
    if (!selected) return;
    var step = e.shiftKey ? 10 : 1;
    var map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (map[e.key]) {
      e.preventDefault();
      materialize(selected);
      selected.style.left = (parseFloat(selected.style.left) + map[e.key][0]) + 'px';
      selected.style.top = (parseFloat(selected.style.top) + map[e.key][1]) + 'px';
      syncSelbox();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault(); selected.style.display = 'none'; deselect();
    } else if (e.key === 'Escape') deselect();
  });

  /* ---------- 工具栏 ---------- */
  function resize(el, f) {
    if (el.tagName === 'IMG' || el.classList.contains('photo-wrap')) {
      el.style.width = (el.offsetWidth * f) + 'px';
      if (el.classList.contains('photo-wrap')) el.style.height = (el.offsetHeight * f) + 'px';
    } else {
      var fs = parseFloat(getComputedStyle(el).fontSize);
      el.style.fontSize = (fs * f) + 'px';
    }
    syncSelbox();
  }

  bar.addEventListener('click', function (ev) {
    var act = ev.target.dataset && ev.target.dataset.act;
    if (ev.target.id === 'ed-toggle') { setEditMode(!editMode); return; }
    if (!act) return;
    if (act === 'png') return exportPNG();
    if (act === 'html') return exportHTML();
    if (act === 'reset') {
      stage.innerHTML = snapshot;
      stage.appendChild(selbox); stage.appendChild(guide);
      deselect(); return;
    }
    if (!selected) { alert('请先点选一个元素'); return; }
    if (act === 'minus') resize(selected, 1 / 1.06);
    if (act === 'plus') resize(selected, 1.06);
    if (act === 'center') {
      materialize(selected);
      var par = selected.offsetParent || stage;
      var cw = (par === stage ? W : par.getBoundingClientRect().width / fitScale());
      selected.style.left = ((cw - selected.offsetWidth) / 2) + 'px';
      syncSelbox();
    }
    if (act === 'hide') { selected.style.display = 'none'; deselect(); }
  });

  /* ---------- 导出 ---------- */
  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  function exportPNG() {
    if (selected) deselect();
    document.fonts.ready.then(function () {
      var s = 2;
      var clone = stage.cloneNode(true);
      clone.style.transform = 'none';
      clone.style.boxShadow = 'none';
      clone.querySelectorAll('[data-noexport]').forEach(function (n) { n.remove(); });
      var wrap = document.createElement('div');
      wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      wrap.style.cssText = 'width:' + W + 'px;height:' + H + 'px;position:relative;transform:scale(' + s + ');transform-origin:0 0;';
      var st = document.createElement('style');
      st.textContent = document.querySelector('style:not([data-noexport])').textContent;
      wrap.appendChild(st); wrap.appendChild(clone);
      var fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      fo.setAttribute('width', W * s); fo.setAttribute('height', H * s); fo.appendChild(wrap);
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.setAttribute('width', W * s); svg.setAttribute('height', H * s);
      svg.setAttribute('viewBox', '0 0 ' + W * s + ' ' + H * s);
      svg.appendChild(fo);
      /* file:// 页面下 blob URL 的 SVG 会污染画布, data URL 不会 */
      var url = 'data:image/svg+xml;charset=utf-8,' +
        encodeURIComponent(new XMLSerializer().serializeToString(svg));
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas');
        cv.width = W * s; cv.height = H * s;
        cv.getContext('2d').drawImage(img, 0, 0, W * s, H * s);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { download(b, 'poster-edited.png'); }, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); alert('导出失败，请改用「导出 HTML」'); };
      img.src = url;
    });
  }

  function exportHTML() {
    if (selected) deselect();
    selbox.style.display = 'none'; guide.style.display = 'none';
    var html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
    download(new Blob([html], { type: 'text/html;charset=utf-8' }), 'poster-edited.html');
  }
})();
