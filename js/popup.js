// NextJSON · Popup Pro — Chrome popup at 800x600.
// Vanilla JS, two modes: input (Paste / Fetch URL) -> output (tree / raw).
(function () {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────
  const state = {
    mode: 'input',          // 'input' | 'output'
    source: 'paste',        // 'paste' | 'fetch'
    view: 'tree',           // 'tree' | 'raw'
    dark: false,
    input: '',
    url: '',
    method: 'GET',
    headers: [{ k: 'Accept', v: 'application/json' }],
    fetchState: 'idle',     // 'idle' | 'loading' | 'error'
    fetchError: '',
    data: null,
    parsed: { ok: false, empty: true, value: null, error: null },
    formatted: '',
    minified: '',
    nodeStats: { keys: 0, arrays: 0, primitives: 0, objects: 0, depth: 0 },
    search: '',
    searchKeys: true,
    searchValues: true,
    caseSensitive: false,
    sortKeys: false,
    wrap: true,
    renderInPopup: false,  // false = open Format/Fetch result in new tab (default); true = stay in popup
    expandSig: 0,
    defaultDepth: 2,
    findOpen: false,
    copyOpen: false,
    exportOpen: false,
    moreOpen: false,
    recents: [],
    copied: false,
  };

  // ─── DOM refs ────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const dom = {
    body: document.body,
    html: document.documentElement,
    outputToolsLeft: $('pp-output-tools-left'),
    outputToolsRight: $('pp-output-tools-right'),
    sourceBtn: $('source-btn'),
    themeSeg: $('theme-seg'),
    viewSeg: $('view-seg'),
    expandBtn: $('expand-btn'),
    collapseBtn: $('collapse-btn'),
    findInput: $('find-input'),
    findHits: $('find-hits'),
    findOptsBtn: $('find-opts-btn'),
    findPop: $('find-pop'),
    optKeys: $('opt-keys'),
    optValues: $('opt-values'),
    optCase: $('opt-case'),
    cbKeys: $('cb-keys'),
    cbValues: $('cb-values'),
    cbCase: $('cb-case'),
    copyBtn: $('copy-btn'),
    copyPop: $('copy-pop'),
    copyIconDefault: $('copy-icon-default'),
    copyIconCheck: $('copy-icon-check'),
    copyFormattedSize: $('copy-formatted-size'),
    copyMinifiedSize: $('copy-minified-size'),
    exportBtn: $('export-btn'),
    exportPop: $('export-pop'),
    moreBtn: $('more-btn'),
    morePop: $('more-pop'),
    optSort: $('opt-sort'),
    cbSort: $('cb-sort'),
    optWrap: $('opt-wrap'),
    cbWrap: $('cb-wrap'),
    optFullpage: $('opt-fullpage'),
    openHerePaste: $('open-here-paste'),
    openHereFetch: $('open-here-fetch'),
    cbOpenHerePaste: $('cb-open-here-paste'),
    cbOpenHereFetch: $('cb-open-here-fetch'),

    input: $('pp-input'),
    output: $('pp-output'),
    paneFetch: $('pane-fetch'),
    panePaste: $('pane-paste'),
    pasteInput: $('paste-input'),
    pasteMeta: $('paste-meta'),
    pasteMetaState: $('paste-meta-state'),
    formatBtn: $('format-btn'),

    methodSeg: $('method-seg'),
    urlInput: $('url-input'),
    fetchBtn: $('fetch-btn'),
    fetchStatus: $('fetch-status'),
    headersList: $('headers-list'),
    addHeaderBtn: $('add-header-btn'),
    recentsList: $('recents-list'),

    treeWrap: $('tree-wrap'),
    rawPre: $('raw-pre'),

    statusLeft: $('status-left'),
    statusSize: $('status-size'),

    tabs: document.querySelectorAll('.pp-tab'),
  };

  // ─── Helpers ─────────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function bytesOf(s) { return new Blob([s || '']).size; }
  function humanBytes(n) {
    if (!n && n !== 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }
  function relativeTime(ts) {
    const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24); if (d === 1) return 'yesterday';
    if (d < 7) return d + 'd ago';
    return new Date(ts).toLocaleDateString();
  }
  function parseJSON(text) {
    if (!text || !text.trim()) return { ok: false, empty: true, value: null, error: null };
    try { return { ok: true, empty: false, value: JSON.parse(text), error: null }; }
    catch (e) {
      const m = String(e.message).match(/at position (\d+)/);
      let line = 1, col = 1;
      if (m) {
        const pos = parseInt(m[1], 10);
        const upto = text.slice(0, pos);
        const lines = upto.split('\n');
        line = lines.length;
        col = lines[lines.length - 1].length + 1;
      }
      return { ok: false, empty: false, value: null, error: { message: e.message, line, col } };
    }
  }
  function formatJSON(v) { try { return JSON.stringify(v, null, 2); } catch (_) { return ''; } }
  function minifyJSON(v) { try { return JSON.stringify(v); } catch (_) { return ''; } }
  function statsJSON(v) {
    const out = { keys: 0, arrays: 0, primitives: 0, objects: 0, depth: 0 };
    function walk(node, d) {
      if (d > out.depth) out.depth = d;
      if (Array.isArray(node)) {
        out.arrays++;
        node.forEach(it => walk(it, d + 1));
      } else if (node !== null && typeof node === 'object') {
        out.objects++;
        Object.keys(node).forEach(k => { out.keys++; walk(node[k], d + 1); });
      } else {
        out.primitives++;
      }
    }
    walk(v, 0);
    return out;
  }
  function sortKeysDeep(v) {
    if (Array.isArray(v)) return v.map(sortKeysDeep);
    if (v && typeof v === 'object') {
      const out = {};
      Object.keys(v).sort().forEach(k => { out[k] = sortKeysDeep(v[k]); });
      return out;
    }
    return v;
  }
  function downloadFile(name, contents, mime) {
    const blob = new Blob([contents], { type: mime || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function checkSvg() {
    return '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5.2L4 7.2L8 3"/></svg>';
  }

  // ─── Persistence ─────────────────────────────────────────────────────
  function loadPersisted(cb) {
    // pp_renderInPopup is intentionally NOT persisted — "Open here"
    // resets to off every time the popup opens.
    const keys = ['pp_dark', 'pp_sortKeys', 'pp_wrap', 'pp_recents'];
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(keys, (res) => {
        if (typeof res.pp_dark === 'boolean') state.dark = res.pp_dark;
        if (typeof res.pp_sortKeys === 'boolean') state.sortKeys = res.pp_sortKeys;
        if (typeof res.pp_wrap === 'boolean') state.wrap = res.pp_wrap;
        state.recents = Array.isArray(res.pp_recents) ? res.pp_recents : [];
        state.renderInPopup = false;
        cb && cb();
      });
    } else {
      state.renderInPopup = false;
      cb && cb();
    }
  }
  function persist(key, val) {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [key]: val });
    }
  }

  // ─── Tree renderer ───────────────────────────────────────────────────
  function highlightStr(text, kind) {
    const q = state.search;
    if (!q) return escapeHtml(text);
    if (kind === 'key' && !state.searchKeys) return escapeHtml(text);
    if (kind === 'value' && !state.searchValues) return escapeHtml(text);
    const flags = state.caseSensitive ? 'g' : 'gi';
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const rx = new RegExp(escaped, flags);
      return escapeHtml(text).replace(rx, (m) => `<span class="jt-hit">${m}</span>`);
    } catch (_) { return escapeHtml(text); }
  }

  function countHits() {
    if (!state.search || !state.formatted) return 0;
    const hay = state.caseSensitive ? state.formatted : state.formatted.toLowerCase();
    const needle = state.caseSensitive ? state.search : state.search.toLowerCase();
    let n = 0, i = 0;
    while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
    return n;
  }

  function renderValue(v, key, isLast, depth, isInArrayParent, indexInArray) {
    const indent = depth * 16;
    const t = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
    const comma = isLast ? '' : '<span class="pp-punct">,</span>';
    let out = '';

    const keyHtml = key !== null && key !== undefined && key !== ''
      ? (isInArrayParent
        ? ''
        : `<span class="pp-key">"${highlightStr(String(key), 'key')}"</span><span class="pp-punct">: </span>`)
      : '';

    if (t === 'object' || t === 'array') {
      const open = t === 'array' ? '[' : '{';
      const close = t === 'array' ? ']' : '}';
      const length = t === 'array' ? v.length : Object.keys(v).length;
      const empty = length === 0;
      const collapsed = !empty && depth >= state.defaultDepth;

      out += `<div class="pp-row${collapsed ? ' collapsed' : ''} expandable" style="padding-left:${indent}px">`;
      if (empty) {
        out += `<span class="pp-toggle-empty"></span>`;
        out += keyHtml;
        out += `<span class="pp-bracket">${open}${close}</span>${comma}`;
        out += `</div>`;
      } else {
        out += `<button class="pp-toggle" type="button"><svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 1.5L6 4.5L2 7.5"/></svg></button>`;
        out += keyHtml;
        out += `<span class="pp-bracket">${open}</span>`;
        out += `</div>`;
        out += `<div class="pp-children">`;
        if (t === 'array') {
          v.forEach((item, i) => {
            out += renderValue(item, i, i === v.length - 1, depth + 1, true, i);
          });
        } else {
          const keys = Object.keys(v);
          keys.forEach((k, i) => {
            out += renderValue(v[k], k, i === keys.length - 1, depth + 1, false, null);
          });
        }
        out += `</div>`;
        out += `<div class="pp-row bracket-close" style="padding-left:${indent}px"><span class="pp-toggle-empty"></span><span class="pp-bracket">${close}</span>${comma}</div>`;
      }
    } else {
      let valueHtml = '';
      if (t === 'string') valueHtml = `<span class="pp-string">"${highlightStr(v, 'value')}"</span>`;
      else if (t === 'number') valueHtml = `<span class="pp-number">${highlightStr(String(v), 'value')}</span>`;
      else if (t === 'boolean') valueHtml = `<span class="pp-bool">${v}</span>`;
      else if (t === 'null') valueHtml = `<span class="pp-null">null</span>`;
      else valueHtml = `<span>${escapeHtml(String(v))}</span>`;

      out += `<div class="pp-row" style="padding-left:${indent}px">`;
      out += `<span class="pp-toggle-empty"></span>`;
      out += keyHtml;
      out += valueHtml;
      out += comma;
      out += `</div>`;
    }
    return out;
  }

  function renderTree() {
    if (!state.data) { dom.treeWrap.innerHTML = ''; return; }
    state.defaultDepth = state.expandSig > 0 ? 999 : (state.expandSig < 0 ? 0 : 2);
    const data = state.sortKeys ? sortKeysDeep(state.data) : state.data;
    dom.treeWrap.innerHTML = renderValue(data, null, true, 0, false, null);
    // Click anywhere on an expandable row toggles it (the chevron is
    // included via event bubbling). Skip when the user is selecting
    // text or clicking a link inside the row.
    const toggleRow = (row) => {
      const collapsed = row.classList.toggle('collapsed');
      let next = row.nextElementSibling;
      if (next && next.classList.contains('pp-children')) {
        next.style.display = collapsed ? 'none' : '';
        next = next.nextElementSibling;
      }
      if (next && next.classList.contains('bracket-close')) {
        next.style.display = collapsed ? 'none' : '';
      }
    };
    dom.treeWrap.querySelectorAll('.pp-row.expandable').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') return;
        if (window.getSelection && window.getSelection().toString()) return;
        toggleRow(row);
      });
    });
    // Apply default collapsed state (hide children for collapsed rows)
    dom.treeWrap.querySelectorAll('.pp-row.collapsed').forEach(row => {
      let next = row.nextElementSibling;
      if (next && next.classList.contains('pp-children')) { next.style.display = 'none'; next = next.nextElementSibling; }
      if (next && next.classList.contains('bracket-close')) next.style.display = 'none';
    });
  }

  // ─── Render orchestrator ────────────────────────────────────────────
  function applyTheme() {
    dom.html.setAttribute('data-theme', state.dark ? 'dark' : 'light');
    dom.themeSeg.querySelectorAll('.pp-seg-btn').forEach(b => {
      b.classList.toggle('active', (b.dataset.theme === 'dark') === state.dark);
    });
  }

  function recomputeFromInput() { state.parsed = parseJSON(state.input); }
  function recomputeFromData() {
    if (state.data == null) {
      state.formatted = ''; state.minified = '';
      state.nodeStats = { keys: 0, arrays: 0, primitives: 0, objects: 0, depth: 0 };
      return;
    }
    const d = state.sortKeys ? sortKeysDeep(state.data) : state.data;
    state.formatted = formatJSON(d);
    state.minified = minifyJSON(d);
    state.nodeStats = statsJSON(state.data);
  }

  function renderTopBarMode() {
    const isOutput = state.mode === 'output';
    dom.outputToolsLeft.hidden = !isOutput;
    dom.outputToolsRight.hidden = !isOutput;
    dom.sourceBtn.disabled = !isOutput;
  }

  function renderInputView() {
    const showInput = state.mode === 'input';
    dom.input.hidden = !showInput;
    dom.output.hidden = showInput;
    if (!showInput) return;
    dom.tabs.forEach(t => t.classList.toggle('active', t.dataset.source === state.source));
    dom.panePaste.hidden = state.source !== 'paste';
    dom.paneFetch.hidden = state.source !== 'fetch';

    if (state.parsed.empty) {
      dom.pasteMetaState.innerHTML = `○ awaiting input`;
      dom.formatBtn.disabled = true;
    } else if (state.parsed.ok) {
      dom.pasteMetaState.innerHTML = `<span class="ok">● valid</span>&nbsp;&nbsp;${humanBytes(bytesOf(state.input))}&nbsp;·&nbsp;${state.input.split('\n').length} lines`;
      dom.formatBtn.disabled = false;
    } else {
      const e = state.parsed.error;
      dom.pasteMetaState.innerHTML = `<span class="err">● ${escapeHtml(e.message)}</span>&nbsp;&nbsp;L${e.line}:${e.col}`;
      dom.formatBtn.disabled = true;
    }

    dom.methodSeg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.method === state.method);
    });

    if (state.fetchState === 'error') {
      dom.fetchStatus.hidden = false;
      dom.fetchStatus.classList.add('err');
      dom.fetchStatus.textContent = `● ${state.fetchError}`;
    } else if (state.fetchState === 'loading') {
      dom.fetchStatus.hidden = false;
      dom.fetchStatus.classList.remove('err');
      dom.fetchStatus.textContent = `● fetching…`;
    } else {
      dom.fetchStatus.hidden = true;
    }
    dom.fetchBtn.disabled = !state.url || state.fetchState === 'loading';
    dom.fetchBtn.innerHTML = state.fetchState === 'loading'
      ? 'Fetching… <span class="arrow">→</span>'
      : 'Fetch <span class="arrow">→</span>';

    renderHeaders();
    renderRecents();
  }

  function renderOutputView() {
    if (state.mode !== 'output') return;
    dom.viewSeg.querySelectorAll('.pp-seg-btn').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
    if (state.view === 'tree') {
      dom.treeWrap.hidden = false;
      dom.rawPre.hidden = true;
      renderTree();
    } else {
      dom.treeWrap.hidden = true;
      dom.rawPre.hidden = false;
      dom.rawPre.classList.toggle('no-wrap', !state.wrap);
      dom.rawPre.textContent = state.formatted;
    }
    const n = countHits();
    dom.findHits.textContent = state.search && n > 0 ? String(n) : '';
    dom.findOptsBtn.classList.toggle('on', !state.searchKeys || !state.searchValues || state.caseSensitive);
    if (dom.copyFormattedSize) dom.copyFormattedSize.textContent = humanBytes(bytesOf(state.formatted));
    if (dom.copyMinifiedSize) dom.copyMinifiedSize.textContent = humanBytes(bytesOf(state.minified));
  }

  function renderStatus() {
    const left = dom.statusLeft;
    if (state.mode === 'input' && state.source === 'paste') {
      if (state.parsed.empty) left.innerHTML = '○ paste JSON to begin';
      else if (state.parsed.ok) left.innerHTML = '<span class="ok">● valid</span>&nbsp;&nbsp;ready to format';
      else left.innerHTML = `<span class="err">● invalid · L${state.parsed.error.line}:${state.parsed.error.col}</span>`;
      dom.statusSize.textContent = '';
    } else if (state.mode === 'input' && state.source === 'fetch') {
      if (state.fetchState === 'loading') left.innerHTML = '● fetching…';
      else if (state.fetchState === 'error') left.innerHTML = `<span class="err">● ${escapeHtml(state.fetchError)}</span>`;
      else {
        let host = 'no url';
        try { host = state.url ? new URL(state.url.startsWith('http') ? state.url : 'https://' + state.url).host : 'no url'; }
        catch (_) { host = 'no url'; }
        left.innerHTML = `<span>○ ready</span>&nbsp;&nbsp;${escapeHtml(state.method + ' ' + host)}`;
      }
      dom.statusSize.textContent = '';
    } else if (state.mode === 'output') {
      const s = state.nodeStats;
      const total = (s.keys + s.arrays + s.primitives) || 0;
      left.innerHTML = `<span class="ok">● parsed</span>&nbsp;&nbsp;${total} nodes&nbsp;·&nbsp;depth ${s.depth}`;
      dom.statusSize.textContent = humanBytes(bytesOf(state.formatted));
    }
  }

  function render() {
    applyTheme();
    applyPopupSize();
    renderTopBarMode();
    renderInputView();
    renderOutputView();
    renderStatus();
  }

  // Chrome resizes the popup window to fit <html>/body explicit sizes.
  // Input mode = compact 750x550; output mode = full 800x600 so the
  // tree has more breathing room.
  function applyPopupSize() {
    const isOutput = state.mode === 'output';
    const w = isOutput ? '800px' : '750px';
    const h = isOutput ? '600px' : '550px';
    document.documentElement.style.width = w;
    document.documentElement.style.height = h;
    document.body.style.width = w;
    document.body.style.height = h;
  }

  // ─── Headers + Recents ───────────────────────────────────────────────
  function renderHeaders() {
    dom.headersList.innerHTML = '';
    state.headers.forEach((h, i) => {
      const row = document.createElement('div');
      row.className = 'pp-kv-row';
      row.innerHTML = `
        <input class="k" placeholder="Header" value="${escapeHtml(h.k)}">
        <input class="v" placeholder="Value" value="${escapeHtml(h.v)}">
        <button class="x" type="button" aria-label="Remove">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 2.5L8.5 8.5M8.5 2.5L2.5 8.5"/></svg>
        </button>`;
      const [kEl, vEl] = row.querySelectorAll('input');
      kEl.addEventListener('input', () => { state.headers[i].k = kEl.value; });
      vEl.addEventListener('input', () => { state.headers[i].v = vEl.value; });
      row.querySelector('.x').addEventListener('click', () => {
        state.headers.splice(i, 1);
        renderHeaders();
      });
      dom.headersList.appendChild(row);
    });
  }
  function renderRecents() {
    if (!state.recents.length) {
      dom.recentsList.innerHTML = '<div class="pp-recents-empty">No recent fetches yet.</div>';
      return;
    }
    dom.recentsList.innerHTML = state.recents.map((r, i) => `
      <div class="pp-recent-row" data-idx="${i}">
        <span class="ico"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9.5a3 3 0 0 0 4.24 0l2-2a3 3 0 0 0-4.24-4.24l-1 1"/><path d="M9 6.5a3 3 0 0 0-4.24 0l-2 2a3 3 0 0 0 4.24 4.24l1-1"/></svg></span>
        <span class="url">${escapeHtml(r.url)}</span>
        <span class="ago">${escapeHtml(relativeTime(r.ts || Date.now()))}</span>
      </div>
    `).join('');
    dom.recentsList.querySelectorAll('.pp-recent-row').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        const r = state.recents[idx];
        if (!r) return;
        state.url = r.url;
        if (r.method) state.method = r.method;
        dom.urlInput.value = r.url;
        renderInputView();
        dom.urlInput.focus();
      });
    });
  }
  function pushRecent(url, method) {
    state.recents = [{ url, method, ts: Date.now() }, ...state.recents.filter(r => r.url !== url)].slice(0, 5);
    persist('pp_recents', state.recents);
  }

  // ─── Popovers ────────────────────────────────────────────────────────
  function closeAllPopovers() {
    state.findOpen = state.copyOpen = state.exportOpen = state.moreOpen = false;
    dom.findPop.hidden = true;
    dom.copyPop.hidden = true;
    dom.exportPop.hidden = true;
    dom.morePop.hidden = true;
  }
  function togglePop(which) {
    const map = {
      find: ['findOpen', dom.findPop],
      copy: ['copyOpen', dom.copyPop],
      'export': ['exportOpen', dom.exportPop],
      more: ['moreOpen', dom.morePop],
    };
    const [k, popEl] = map[which];
    const next = !state[k];
    closeAllPopovers();
    state[k] = next;
    popEl.hidden = !next;
  }

  // ─── Routing helpers ─────────────────────────────────────────────────
  // Where do we send the parsed JSON? In-popup output mode if the user
  // opted in via "Open here"; otherwise the full-page viewer in a new tab.
  function presentParsed() {
    if (state.renderInPopup) {
      state.mode = 'output';
      render();
    } else {
      openFullPage();
    }
  }

  function runFormat() {
    if (!state.parsed.ok) return;
    state.data = state.parsed.value;
    recomputeFromData();
    presentParsed();
  }

  function syncOpenHereChips() {
    const cb = state.renderInPopup ? checkSvg() : '';
    [dom.cbOpenHerePaste, dom.cbOpenHereFetch].forEach(el => {
      if (!el) return;
      el.classList.toggle('on', state.renderInPopup);
      el.innerHTML = cb;
    });
  }

  // ─── Fetch ───────────────────────────────────────────────────────────
  function doFetch() {
    if (!state.url) return;
    state.fetchState = 'loading';
    state.fetchError = '';
    renderInputView(); renderStatus();
    const headers = {};
    state.headers.forEach(h => { if (h.k && h.k.trim()) headers[h.k] = h.v || ''; });
    chrome.runtime.sendMessage(
      { type: 'FETCH_URL', url: state.url, method: state.method, headers },
      (response) => {
        if (response && response.success) {
          try {
            state.data = JSON.parse(response.data);
            state.input = JSON.stringify(state.data, null, 2);
            dom.pasteInput.value = state.input;
            recomputeFromInput();
            recomputeFromData();
            pushRecent(state.url, state.method);
            state.fetchState = 'idle';
            state.fetchError = '';
            presentParsed();
          } catch (e) {
            state.fetchState = 'error';
            state.fetchError = 'Failed to parse JSON: ' + e.message;
            renderInputView(); renderStatus();
          }
        } else {
          state.fetchState = 'error';
          state.fetchError = (response && response.error) || 'Failed to fetch';
          renderInputView(); renderStatus();
        }
      }
    );
  }

  // ─── Wiring ──────────────────────────────────────────────────────────
  function wireEvents() {
    dom.themeSeg.querySelectorAll('.pp-seg-btn').forEach(b => {
      b.addEventListener('click', () => {
        state.dark = b.dataset.theme === 'dark';
        persist('pp_dark', state.dark);
        applyTheme();
      });
    });

    dom.viewSeg.querySelectorAll('.pp-seg-btn').forEach(b => {
      b.addEventListener('click', () => {
        state.view = b.dataset.view;
        renderOutputView();
      });
    });

    dom.expandBtn.addEventListener('click', () => { state.expandSig += 100; renderOutputView(); });
    dom.collapseBtn.addEventListener('click', () => { state.expandSig -= 100; renderOutputView(); });

    dom.sourceBtn.addEventListener('click', () => {
      if (state.mode === 'output') {
        state.mode = 'input';
        render();
        setTimeout(() => dom.pasteInput.focus(), 0);
      }
    });

    dom.tabs.forEach(t => t.addEventListener('click', () => {
      state.source = t.dataset.source;
      renderInputView(); renderStatus();
      setTimeout(() => (state.source === 'paste' ? dom.pasteInput : dom.urlInput).focus(), 0);
    }));

    dom.pasteInput.addEventListener('input', () => {
      state.input = dom.pasteInput.value;
      recomputeFromInput();
      renderInputView(); renderStatus();
    });
    dom.pasteInput.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        runFormat();
      }
    });

    dom.formatBtn.addEventListener('click', runFormat);

    dom.urlInput.addEventListener('input', () => {
      state.url = dom.urlInput.value;
      renderStatus();
      dom.fetchBtn.disabled = !state.url || state.fetchState === 'loading';
    });
    dom.urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); doFetch(); }
    });
    dom.fetchBtn.addEventListener('click', doFetch);

    dom.methodSeg.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        state.method = b.dataset.method;
        dom.methodSeg.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
        renderStatus();
      });
    });

    dom.addHeaderBtn.addEventListener('click', () => {
      state.headers.push({ k: '', v: '' });
      renderHeaders();
    });

    // "Open here" toggle — shared by paste + fetch panes. Session-only
    // (does NOT persist to chrome.storage.local), so the next time the
    // popup is opened it always starts unchecked.
    const onToggleOpenHere = (e) => {
      e.stopPropagation();
      state.renderInPopup = !state.renderInPopup;
      syncOpenHereChips();
    };
    dom.openHerePaste?.addEventListener('click', onToggleOpenHere);
    dom.openHereFetch?.addEventListener('click', onToggleOpenHere);

    dom.findInput.addEventListener('input', () => {
      state.search = dom.findInput.value;
      renderOutputView();
    });
    dom.findOptsBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePop('find'); });
    const wireOpt = (item, cb, key) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        state[key] = !state[key];
        cb.classList.toggle('on', state[key]);
        cb.innerHTML = state[key] ? checkSvg() : '';
        renderOutputView();
      });
    };
    wireOpt(dom.optKeys, dom.cbKeys, 'searchKeys');
    wireOpt(dom.optValues, dom.cbValues, 'searchValues');
    wireOpt(dom.optCase, dom.cbCase, 'caseSensitive');

    dom.copyBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePop('copy'); });
    dom.copyPop.querySelectorAll('[data-copy]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const which = item.dataset.copy;
        const text = which === 'minified' ? state.minified : state.formatted;
        navigator.clipboard?.writeText(text);
        flashCopy();
        closeAllPopovers();
      });
    });

    dom.exportBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePop('export'); });
    dom.exportPop.querySelectorAll('[data-export]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const which = item.dataset.export;
        if (which === 'json') downloadFile('data.json', state.formatted);
        else if (which === 'min') downloadFile('data.min.json', state.minified);
        // CSV / YAML / XML are flat-list placeholders per the design (no-op).
        closeAllPopovers();
      });
    });

    dom.moreBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePop('more'); });
    dom.optSort.addEventListener('click', (e) => {
      e.stopPropagation();
      state.sortKeys = !state.sortKeys;
      dom.cbSort.classList.toggle('on', state.sortKeys);
      dom.cbSort.innerHTML = state.sortKeys ? checkSvg() : '';
      persist('pp_sortKeys', state.sortKeys);
      recomputeFromData();
      renderOutputView();
      renderStatus();
    });
    dom.optWrap.addEventListener('click', (e) => {
      e.stopPropagation();
      state.wrap = !state.wrap;
      dom.cbWrap.classList.toggle('on', state.wrap);
      dom.cbWrap.innerHTML = state.wrap ? checkSvg() : '';
      persist('pp_wrap', state.wrap);
      renderOutputView();
    });
    dom.optFullpage.addEventListener('click', (e) => {
      e.stopPropagation();
      openFullPage();
    });

    document.addEventListener('click', (e) => {
      const inside = e.target.closest('.pp-pop-anchor') || e.target.closest('#pp-find');
      if (!inside) closeAllPopovers();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const any = state.findOpen || state.copyOpen || state.exportOpen || state.moreOpen;
        if (any) { e.preventDefault(); closeAllPopovers(); }
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'o' || e.key === 'O')) {
        if (state.mode === 'output') { e.preventDefault(); openFullPage(); }
      }
    });
  }

  function flashCopy() {
    state.copied = true;
    dom.copyIconDefault.hidden = true;
    dom.copyIconCheck.hidden = false;
    setTimeout(() => {
      state.copied = false;
      dom.copyIconDefault.hidden = false;
      dom.copyIconCheck.hidden = true;
    }, 1400);
  }

  function openFullPage() {
    if (!state.data) return;
    if (chrome && chrome.storage && chrome.storage.local) {
      // Use the same storage keys the viewer reads (see viewer.js loadJson).
      chrome.storage.local.set({
        jsonToFormat: state.formatted,
        jsonSourceUrl: state.url || '',
      }, () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('html/viewer.html') });
        window.close();
      });
    }
  }

  // ─── Init ────────────────────────────────────────────────────────────
  function init() {
    loadPersisted(() => {
      dom.cbSort.classList.toggle('on', state.sortKeys);
      dom.cbSort.innerHTML = state.sortKeys ? checkSvg() : '';
      dom.cbWrap.classList.toggle('on', state.wrap);
      dom.cbWrap.innerHTML = state.wrap ? checkSvg() : '';
      syncOpenHereChips();
      wireEvents();
      recomputeFromInput();
      render();
      setTimeout(() => dom.pasteInput.focus(), 0);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
