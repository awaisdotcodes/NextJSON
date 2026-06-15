// NextJSON v4.0 - JSON Parser, Formatter, and Viewer
(function() {
  'use strict';

  // DOM Elements
  const jsonOutput = document.getElementById('json-output');
  const rawOutput = document.getElementById('raw-output');
  const jsonContainer = document.getElementById('json-container');
  const rawContainer = document.getElementById('raw-container');
  const diffContainer = document.getElementById('diff-container');
  const graphContainer = document.getElementById('graph-container');
  const uiContainer = document.getElementById('ui-container');
  const uiCanvas = document.getElementById('ui-canvas');
  const tableViewContainer = document.getElementById('table-view-container');
  const tableContent = document.getElementById('table-content');
  const graphInfoPanel = document.getElementById('graph-info-panel');
  const infoPanelContent = document.getElementById('info-panel-content');
  const loading = document.getElementById('loading');
  const stats = document.getElementById('stats');
  const toast = document.getElementById('toast');
  const contextMenu = document.getElementById('context-menu');
  const breadcrumbBar = document.getElementById('breadcrumb-bar');
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const searchKeys = document.getElementById('search-keys');
  const searchValues = document.getElementById('search-values');
  const searchCase = document.getElementById('search-case');
  const searchResults = document.getElementById('search-results');
  const diffInput = document.getElementById('diff-input');
  const diffCompare = document.getElementById('diff-compare');
  const diffClear = document.getElementById('diff-clear');
  const diffResults = document.getElementById('diff-results');
  const jqInput = document.getElementById('jq-input');
  const jqResults = document.getElementById('jq-results');
  const editModeBanner = document.getElementById('edit-mode-banner');
  const graphqlBanner = document.getElementById('graphql-banner');
  const dateTooltip = document.getElementById('date-tooltip');
  const importModal = document.getElementById('import-modal');

  // State
  let jsonData = null;
  let originalJsonData = null;
  let rawJson = '';
  let sourceUrl = '';
  let currentView = 'tree';
  let selectedRow = null;
  let selectedPath = '';
  let selectedKey = '';
  let selectedValue = null;
  let selectedType = '';
  let allRows = [];
  let zoomLevel = 100;
  let treeGraph = null;
  let uiRenderer = null;
  let jqEngine = null;
  let editMode = false;
  let pendingEdits = {};
  let formatDates = false;
  let currentTheme = 'light';
  let focusedRowIndex = -1;
  let isGraphQL = false;
  let graphqlView = 'all';
  let isMinified = false;
  let editingPath = '';
  let editingKey = '';
  
  // Undo/Redo state
  let undoStack = [];
  let redoStack = [];
  const MAX_UNDO_HISTORY = 50;

  init();

  function init() {
    loadTheme();
    loadJson();
    setupEventListeners();
    setupKeyboardNavigation();
    if (typeof JQLite !== 'undefined') {
      jqEngine = new JQLite();
    }
  }

  // ============================================
  // THEME HANDLING
  // ============================================
  function loadTheme() {
    const saved = localStorage.getItem('sourcetree-theme');
    if (saved) {
      currentTheme = saved;
    } else {
      // Default to light unless the user's OS prefers dark
      currentTheme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
    applyTheme();
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    // Update active state in legacy theme menu
    document.querySelectorAll('.theme-item').forEach(item => {
      item.classList.toggle('active', item.dataset.theme === currentTheme);
    });
    // Sync the Split Pro sun/moon segmented control
    const lightBtn = document.getElementById('theme-light-btn');
    const darkBtn = document.getElementById('theme-dark-btn');
    if (lightBtn && darkBtn) {
      const isLight = currentTheme === 'light';
      lightBtn.classList.toggle('active', isLight);
      darkBtn.classList.toggle('active', !isLight);
    }
    // Legacy theme button (kept for compatibility — element is hidden)
    const themeLabels = { dark: 'Dark', light: 'Light', monokai: 'Monokai', dracula: 'Dracula', nord: 'Nord', solarized: 'Solarized', github: 'GitHub Dark' };
    const themeColors = { dark: '#0f0f12', light: '#fafaf9', monokai: '#272822', dracula: '#282a36', nord: '#2e3440', solarized: '#002b36', github: '#0d1117' };
    const dot = document.querySelector('#theme-btn .theme-btn-dot');
    const label = document.querySelector('#theme-btn .theme-btn-label');
    if (dot) {
      dot.style.background = themeColors[currentTheme] || '#0f0f12';
      dot.style.border = currentTheme === 'light' ? '1px solid #aaa' : 'none';
    }
    if (label) label.textContent = themeLabels[currentTheme] || currentTheme;
  }

  function setTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('sourcetree-theme', currentTheme);
    applyTheme();
    hideDropdowns();
    const themeName = theme.charAt(0).toUpperCase() + theme.slice(1);
    showToast(`✓ Theme applied: ${themeName}`);
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================
  function setupEventListeners() {
    // Click on JSON row to select it for keyboard navigation
    document.getElementById('json-output').addEventListener('click', (e) => {
      const row = e.target.closest('.json-row');
      if (row && !e.target.closest('.toggle') && !e.target.closest('.value a')) {
        const rows = Array.from(document.querySelectorAll('.json-row:not(.filtered-out)'));
        focusedRowIndex = rows.indexOf(row);
        focusRow(row);
      }
    });
    
    // Use event delegation for dropdown toggles - single document listener
    document.addEventListener('click', function(e) {
      // Check if clicked on See more button
      const seeMoreBtn = e.target.closest('.see-more-btn');
      if (seeMoreBtn) {
        e.preventDefault();
        e.stopPropagation();
        const valueSpan = seeMoreBtn.closest('.value');
        expandTruncatedValue(valueSpan);
        return;
      }
      
      // Check if clicked on See less button
      const seeLessBtn = e.target.closest('.see-less-btn');
      if (seeLessBtn) {
        e.preventDefault();
        e.stopPropagation();
        const valueSpan = seeLessBtn.closest('.value');
        collapseTruncatedValue(valueSpan);
        return;
      }
      
      // Check if clicked on truncated value text (anywhere on the value)
      const truncatedValue = e.target.closest('.value');
      if (truncatedValue) {
        const truncatedText = truncatedValue.querySelector('.truncated-text');
        const fullText = truncatedValue.querySelector('.full-text');
        
        // Only handle if this is a truncated value
        if (truncatedText && fullText) {
          // Don't interfere with link clicks
          if (e.target.tagName === 'A') return;
          
          e.preventDefault();
          e.stopPropagation();
          
          // Check current state and toggle
          if (truncatedText.style.display === 'none') {
            collapseTruncatedValue(truncatedValue);
          } else {
            expandTruncatedValue(truncatedValue);
          }
          return;
        }
      }
      
      // Check if clicked on dropdown toggle button or its children
      const toggleBtn = e.target.closest('.dropdown-toggle');
      if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        const dropdown = toggleBtn.closest('.dropdown');
        const wasOpen = dropdown.classList.contains('open');
        // Close all dropdowns first
        document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
        // Toggle current dropdown
        if (!wasOpen) {
          dropdown.classList.add('open');
        }
        return;
      }
      
      // Check if clicked on theme item
      const themeItem = e.target.closest('.theme-item');
      if (themeItem) {
        e.stopPropagation();
        setTheme(themeItem.dataset.theme);
        document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
        return;
      }
      
      // Check if clicked on dropdown item with action
      const actionItem = e.target.closest('.dropdown-item[data-action], .osp-pop-item[data-action]');
      if (actionItem) {
        e.stopPropagation();
        handleDropdownAction(actionItem.dataset.action);
        document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
        return;
      }
      
      // Close dropdowns if clicked outside
      if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
      }
    });
    
    // Basic controls
    document.getElementById('expand-all')?.addEventListener('click', expandAll);
    document.getElementById('collapse-all')?.addEventListener('click', collapseAll);
    document.getElementById('compare-btn')?.addEventListener('click', toggleCompareView);
    document.getElementById('graph-btn')?.addEventListener('click', toggleGraphView);
    document.getElementById('ui-btn')?.addEventListener('click', toggleUIView);
    document.getElementById('table-btn')?.addEventListener('click', toggleTableView);
    document.getElementById('raw-btn')?.addEventListener('click', toggleRawView);
    document.getElementById('import-url-btn')?.addEventListener('click', showImportModal);
    
    // Undo/Redo controls
    document.getElementById('undo-btn')?.addEventListener('click', undo);
    document.getElementById('redo-btn')?.addEventListener('click', redo);
    
    // Graph controls
    document.getElementById('graph-back')?.addEventListener('click', () => switchView('tree'));
    document.getElementById('graph-zoom-in')?.addEventListener('click', () => graphZoomIn());
    document.getElementById('graph-zoom-out')?.addEventListener('click', () => graphZoomOut());
    document.getElementById('graph-reset')?.addEventListener('click', () => graphResetView());
    document.getElementById('graph-expand-all')?.addEventListener('click', () => graphExpandAll());
    document.getElementById('graph-collapse-all')?.addEventListener('click', () => graphCollapseAll());
    document.getElementById('close-info-panel')?.addEventListener('click', () => graphInfoPanel.classList.remove('visible'));
    
    // UI controls
    document.getElementById('ui-back')?.addEventListener('click', () => switchView('tree'));
    
    // Table controls
    document.getElementById('table-back')?.addEventListener('click', () => switchView('tree'));
    document.getElementById('table-export-csv')?.addEventListener('click', exportTableCSV);
    document.getElementById('table-export-json')?.addEventListener('click', exportTableJSON);
    document.getElementById('table-export-excel')?.addEventListener('click', exportTableExcel);
    
    // Diff controls
    document.getElementById('diff-back')?.addEventListener('click', () => switchView('tree'));
    
    // Search
    searchInput?.addEventListener('input', () => {
      // Show/hide clear button
      if (searchInput.value.length > 0) {
        searchClear?.classList.add('visible');
      } else {
        searchClear?.classList.remove('visible');
      }
      debounce(performSearch, 200)();
    });
    searchClear?.addEventListener('click', clearSearch);
    searchKeys?.addEventListener('change', performSearch);
    searchValues?.addEventListener('change', performSearch);
    searchCase?.addEventListener('change', performSearch);
    
    // Search navigation
    document.getElementById('search-prev')?.addEventListener('click', goToPrevMatch);
    document.getElementById('search-next')?.addEventListener('click', goToNextMatch);
    
    // JQ Modal
    document.getElementById('jq-mode-btn')?.addEventListener('click', openJqModal);
    document.getElementById('jq-modal-close')?.addEventListener('click', closeJqModal);
    document.getElementById('jq-modal')?.querySelector('.modal-backdrop')?.addEventListener('click', closeJqModal);
    document.getElementById('jq-run')?.addEventListener('click', runJqQuery);
    document.getElementById('jq-clear')?.addEventListener('click', clearJqInput);
    document.getElementById('jq-copy-result')?.addEventListener('click', copyJqResult);
    jqInput?.addEventListener('keydown', (e) => { 
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        runJqQuery(); 
      }
    });
    document.querySelectorAll('.jq-example').forEach(btn => {
      btn.addEventListener('click', () => {
        jqInput.value = btn.dataset.query;
        runJqQuery();
      });
    });
    
    // Diff
    diffCompare?.addEventListener('click', performDiff);
    diffClear?.addEventListener('click', () => { diffInput.value=''; diffResults.innerHTML=''; });
    
    // GraphQL tabs
    document.querySelectorAll('.graphql-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.graphql-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        graphqlView = tab.dataset.view;
        renderJson();
      });
    });
    
    // Import modal
    document.getElementById('import-modal-close')?.addEventListener('click', hideImportModal);
    document.getElementById('import-cancel')?.addEventListener('click', hideImportModal);
    document.getElementById('import-fetch')?.addEventListener('click', fetchFromUrl);
    document.querySelectorAll('#import-modal .modal-backdrop').forEach(el => el.addEventListener('click', hideImportModal));
    
    // Edit modal
    document.getElementById('edit-modal-close')?.addEventListener('click', hideEditModal);
    document.getElementById('edit-modal-cancel')?.addEventListener('click', hideEditModal);
    document.getElementById('edit-modal-save')?.addEventListener('click', saveEditModal);
    document.querySelectorAll('#edit-modal .modal-backdrop').forEach(el => el.addEventListener('click', hideEditModal));
    
    // Breadcrumb copy button
    document.getElementById('breadcrumb-copy')?.addEventListener('click', copyBreadcrumbPath);
    
    // Context menu items
    document.getElementById('ctx-copy-path')?.addEventListener('click', () => { hideContextMenu(); navigator.clipboard.writeText(selectedPath||'root').then(()=>showToast('Copied path')); });
    document.getElementById('ctx-copy-key')?.addEventListener('click', () => { hideContextMenu(); if(selectedKey)navigator.clipboard.writeText(selectedKey).then(()=>showToast('Copied key')); });
    document.getElementById('ctx-copy-value')?.addEventListener('click', () => { hideContextMenu(); const s=typeof selectedValue==='object'?JSON.stringify(selectedValue,null,2):String(selectedValue); navigator.clipboard.writeText(s).then(()=>showToast('Copied value')); });
    document.getElementById('ctx-copy-complete')?.addEventListener('click', copyComplete);
    document.getElementById('ctx-edit')?.addEventListener('click', openEditModal);
    document.getElementById('ctx-view-table')?.addEventListener('click', viewAsTable);
    document.getElementById('ctx-search-google')?.addEventListener('click', searchGoogle);
    document.getElementById('ctx-highlight-keys')?.addEventListener('click', highlightMatchingKeys);
    document.getElementById('ctx-filter-key')?.addEventListener('click', filterByKey);
    document.getElementById('ctx-detect-type')?.addEventListener('click', showDataType);
    
    // Copy path as different formats
    document.getElementById('ctx-path-dot')?.addEventListener('click', () => copyPathAs('dot'));
    document.getElementById('ctx-path-bracket')?.addEventListener('click', () => copyPathAs('bracket'));
    document.getElementById('ctx-path-pointer')?.addEventListener('click', () => copyPathAs('pointer'));
    document.getElementById('ctx-path-jsonpath')?.addEventListener('click', () => copyPathAs('jsonpath'));
    document.getElementById('ctx-path-jq')?.addEventListener('click', () => copyPathAs('jq'));
    
    // Add/Delete key
    document.getElementById('ctx-add-key')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openAddKeyModal();
    });
    document.getElementById('ctx-delete-key')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openDeleteKeyModal();
    });
    
    // Add key modal
    document.getElementById('add-key-modal-close')?.addEventListener('click', hideAddKeyModal);
    document.getElementById('add-key-cancel')?.addEventListener('click', hideAddKeyModal);
    document.getElementById('add-key-confirm')?.addEventListener('click', confirmAddKey);
    document.querySelector('#add-key-modal .modal-backdrop')?.addEventListener('click', hideAddKeyModal);
    
    // Type select change - update value input
    document.getElementById('add-key-type')?.addEventListener('change', (e) => {
      updateValueInputForType(e.target.value);
    });
    
    // Delete key modal
    document.getElementById('delete-key-modal-close')?.addEventListener('click', hideDeleteKeyModal);
    document.getElementById('delete-key-cancel')?.addEventListener('click', hideDeleteKeyModal);
    document.getElementById('delete-key-confirm')?.addEventListener('click', confirmDeleteKey);
    document.querySelector('#delete-key-modal .modal-backdrop')?.addEventListener('click', hideDeleteKeyModal);
    
    // Global click to hide context menu
    document.addEventListener('click', (e) => {
      hideContextMenu();
      hideDropdowns(e);
    });
    
    // Hide context menu on scroll, window blur, or Esc
    document.addEventListener('scroll', hideContextMenu, true);
    window.addEventListener('scroll', hideContextMenu, true);
    window.addEventListener('blur', hideContextMenu);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && contextMenu && contextMenu.style.display === 'block') {
        hideContextMenu();
      }
    });
    
    // Right-click context menu
    document.addEventListener('contextmenu', handleContextMenu);
    
    // Dropdown toggles (matches both legacy .btn and Split Pro .osp-tb-btn toggles)
    document.querySelectorAll('.dropdown > .btn, .dropdown > .osp-tb-btn.dropdown-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = btn.parentElement;
        const wasOpen = dropdown.classList.contains('open');
        hideDropdowns();
        if (!wasOpen) dropdown.classList.add('open');
      });
    });

    setupSplitProUI();
  }

  // ============================================
  // SPLIT PRO UI WIRING
  // ============================================
  let wrapOn = true;
  let sortKeysOn = false;
  let findPopOpen = false;

  function setupSplitProUI() {
    // Theme segmented (sun / moon)
    document.getElementById('theme-light-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      setTheme('light');
    });
    document.getElementById('theme-dark-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      setTheme('dark');
    });

    // View segmented Tree button (Raw is wired through existing #raw-btn handler)
    document.getElementById('tree-seg-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      switchToTreeView();
    });

    // Find advanced popover
    const findPop = document.getElementById('find-popover');
    const findOptsBtn = document.getElementById('find-opts-btn');
    findOptsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      findPopOpen = !findPopOpen;
      if (findPop) findPop.classList.toggle('open', findPopOpen);
      updateFindOptsActive();
    });
    document.addEventListener('click', (e) => {
      if (findPopOpen && findPop && !findPop.contains(e.target) && !findOptsBtn.contains(e.target)) {
        findPopOpen = false;
        findPop.classList.remove('open');
      }
    });

    // Find option items inside popover (toggle hidden checkbox + visual cb)
    const wireFindOpt = (itemId, cbId, hiddenInputId) => {
      const item = document.getElementById(itemId);
      const cb = document.getElementById(cbId);
      const hidden = document.getElementById(hiddenInputId);
      item?.addEventListener('click', (e) => {
        e.stopPropagation();
        const next = !hidden.checked;
        hidden.checked = next;
        cb?.classList.toggle('on', next);
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
        updateFindOptsActive();
      });
    };
    wireFindOpt('find-opt-keys', 'search-keys-cb', 'search-keys');
    wireFindOpt('find-opt-values', 'search-values-cb', 'search-values');
    wireFindOpt('find-opt-case', 'search-case-cb', 'search-case');

    // JQ quick-input inside find popover — open full panel on Enter
    document.getElementById('jq-quick-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const v = e.target.value.trim();
        if (v) {
          const fullJq = document.getElementById('jq-input');
          if (fullJq) fullJq.value = v;
        }
        findPopOpen = false;
        findPop?.classList.remove('open');
        openJqModal();
      }
    });

    // Wrap toggle (raw view word-wrap)
    const wrapItem = document.getElementById('more-wrap');
    const wrapCb = document.getElementById('wrap-cb');
    wrapItem?.addEventListener('click', (e) => {
      e.stopPropagation();
      wrapOn = !wrapOn;
      wrapCb.classList.toggle('on', wrapOn);
      wrapCb.innerHTML = wrapOn ? '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5.2L4 7.2L8 3"/></svg>' : '';
      const rc = document.getElementById('raw-container');
      if (rc) rc.classList.toggle('no-wrap', !wrapOn);
    });

    // Sort keys toggle (visual only — alphabetizes object keys via re-render)
    const sortItem = document.getElementById('more-sort-keys');
    const sortCb = document.getElementById('sort-keys-cb');
    sortItem?.addEventListener('click', (e) => {
      e.stopPropagation();
      sortKeysOn = !sortKeysOn;
      sortCb.classList.toggle('on', sortKeysOn);
      sortCb.innerHTML = sortKeysOn ? '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5.2L4 7.2L8 3"/></svg>' : '';
      // Apply sort by reordering jsonData (in-place is risky — mutate a working copy)
      if (typeof jsonData === 'object' && jsonData !== null) {
        try {
          const sorted = sortKeysOn ? sortKeysDeep(originalJsonData || jsonData) : (originalJsonData || jsonData);
          if (!originalJsonData) originalJsonData = JSON.parse(JSON.stringify(jsonData));
          jsonData = sorted;
          renderJson(false);
        } catch (_) {}
      }
    });

    // Hits count display in find input
    const searchHitsEl = document.getElementById('search-hits');
    const updateHits = () => {
      if (!searchHitsEl) return;
      if (searchInput.value.trim() && searchMatches.length > 0) {
        searchHitsEl.textContent = searchMatches.length;
        searchHitsEl.style.display = '';
      } else {
        searchHitsEl.textContent = '';
        searchHitsEl.style.display = 'none';
      }
    };
    searchInput?.addEventListener('input', () => setTimeout(updateHits, 240));
    document.addEventListener('search-updated', updateHits);

    // Update copy/export button label after copy
    const copyBtnLabel = document.getElementById('copy-btn-label');
    document.addEventListener('copy-flash', () => {
      if (copyBtnLabel) {
        copyBtnLabel.textContent = 'Copied';
        setTimeout(() => { copyBtnLabel.textContent = 'Copy'; }, 1400);
      }
    });

    // Mark active view in More menu
    syncMoreMenuActive();

    // Wire the Fetch URL modal interactions
    setupFetchUrlModalUI();
    // Wire the Edit raw JSON modal
    setupEditRawModalUI();
  }

  // ============================================
  // EDIT RAW JSON MODAL
  // ============================================
  function setupEditRawModalUI() {
    const modal = document.getElementById('edit-raw-modal');
    const input = document.getElementById('edit-raw-input');
    const errorEl = document.getElementById('edit-raw-error');
    const sizeBadge = document.getElementById('er-size');
    const openBtn = document.getElementById('edit-raw-btn');
    const closeBtn = document.getElementById('edit-raw-close');
    const cancelBtn = document.getElementById('edit-raw-cancel');
    const saveBtn = document.getElementById('edit-raw-save');
    if (!modal || !input || !openBtn || !saveBtn) return;

    const show = () => {
      if (jsonData == null) { showToast('No JSON loaded'); return; }
      try {
        const formatted = JSON.stringify(jsonData, null, 2);
        input.value = formatted;
        if (sizeBadge) sizeBadge.textContent = humanBytes(byteLength(formatted));
        errorEl.style.display = 'none';
        modal.style.display = 'flex';
        setTimeout(() => { input.focus(); input.setSelectionRange(0, 0); input.scrollTop = 0; }, 0);
      } catch (e) { showToast('Failed to load JSON for editing'); }
    };
    const hide = () => { modal.style.display = 'none'; errorEl.style.display = 'none'; };

    const save = () => {
      const text = input.value;
      let parsed;
      try { parsed = JSON.parse(text); }
      catch (e) {
        errorEl.textContent = e.message;
        errorEl.style.display = 'block';
        return;
      }
      // Diff old vs new BEFORE swapping jsonData so we know which
      // paths the user touched and can expand only those.
      const changedPaths = diffJsonPaths(jsonData, parsed);

      // Push the prior JSON onto the undo stack BEFORE we mutate it.
      saveUndoState();

      // Capture currently-collapsed paths so we can restore them after
      // re-render (otherwise the tree would be fully expanded).
      const collapsedBefore = new Set();
      jsonOutput.querySelectorAll('.json-row.expandable.collapsed').forEach(r => {
        if (r.dataset.path) collapsedBefore.add(r.dataset.path);
      });

      jsonData = parsed;
      originalJsonData = JSON.parse(JSON.stringify(parsed));
      rawJson = JSON.stringify(parsed, null, 2);
      renderJson(false);
      updateStats();
      const rawOut = document.getElementById('raw-output');
      if (rawOut) rawOut.textContent = rawJson;
      // Reflect the new undo history in the toolbar buttons.
      updateUndoRedoButtons();

      // Re-collapse anything that was collapsed before, EXCEPT
      // ancestors of paths the user just changed (those should
      // remain open so the new value is visible).
      const ancestorsOfChanges = new Set();
      changedPaths.forEach(p => {
        ancestorsOf(p).forEach(a => ancestorsOfChanges.add(a));
      });
      jsonOutput.querySelectorAll('.json-row.expandable').forEach(row => {
        const p = row.dataset.path || '';
        if (collapsedBefore.has(p) && !ancestorsOfChanges.has(p)) {
          collapseRow(row);
        }
      });

      hide();
      showToast(changedPaths.length ? 'JSON updated' : 'No changes');
    };

    // Helpers scoped here so they capture the modal's variables but
    // can also be reused by other parts of the file via the closure.
    function collapseRow(row) {
      row.classList.add('collapsed');
      let next = row.nextElementSibling;
      if (next?.classList.contains('json-children')) { next.classList.add('collapsed'); next = next.nextElementSibling; }
      if (next?.classList.contains('bracket-close')) next.classList.add('collapsed');
    }

    openBtn.addEventListener('click', show);
    closeBtn?.addEventListener('click', hide);
    cancelBtn?.addEventListener('click', hide);
    saveBtn.addEventListener('click', save);
    modal.querySelector('.modal-backdrop')?.addEventListener('click', hide);

    input.addEventListener('input', () => {
      // Hide stale error as the user edits.
      if (errorEl.style.display === 'block') errorEl.style.display = 'none';
      if (sizeBadge) sizeBadge.textContent = humanBytes(byteLength(input.value));
    });
    input.addEventListener('keydown', (e) => {
      // ⌘S / Ctrl+S → save
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        save();
        return;
      }
      // Tab inserts two spaces instead of changing focus.
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = input.selectionStart;
        const end = input.selectionEnd;
        input.value = input.value.slice(0, start) + '  ' + input.value.slice(end);
        input.selectionStart = input.selectionEnd = start + 2;
        return;
      }
      // Enter → preserve current line's indentation, plus an extra
      // indent level if the previous non-space char was '{' or '['.
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const value = input.value;
        // Find the start of the current line.
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const currentLine = value.slice(lineStart, start);
        const indentMatch = currentLine.match(/^[ \t]*/);
        let indent = indentMatch ? indentMatch[0] : '';
        // Look at the last non-whitespace char before the cursor to
        // decide whether to add an extra indent step.
        let i = start - 1;
        while (i >= 0 && /\s/.test(value[i])) i--;
        const prev = i >= 0 ? value[i] : '';
        if (prev === '{' || prev === '[') indent += '  ';
        // Also: if the next char is the matching closer, push it down a line.
        const nextCh = value[end] || '';
        let insert = '\n' + indent;
        let cursorOffset = insert.length;
        if ((prev === '{' && nextCh === '}') || (prev === '[' && nextCh === ']')) {
          insert += '\n' + indent.slice(2);
        }
        input.value = value.slice(0, start) + insert + value.slice(end);
        input.selectionStart = input.selectionEnd = start + cursorOffset;
        return;
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display !== 'none') {
        e.preventDefault();
        hide();
      }
    });
  }

  function updateFindOptsActive() {
    const btn = document.getElementById('find-opts-btn');
    if (!btn) return;
    const k = document.getElementById('search-keys')?.checked;
    const v = document.getElementById('search-values')?.checked;
    const c = document.getElementById('search-case')?.checked;
    const jq = document.getElementById('jq-quick-input')?.value;
    const active = (k === false) || (v === false) || c || (jq && jq.trim());
    btn.classList.toggle('on', !!active);
  }

  function switchToTreeView() {
    if (typeof switchView === 'function') {
      switchView('tree');
    }
    document.getElementById('tree-seg-btn')?.classList.add('active');
    document.getElementById('raw-btn')?.classList.remove('active');
    syncMoreMenuActive();
  }

  function syncMoreMenuActive() {
    const v = currentView || 'tree';
    document.querySelectorAll('.osp-pop-item[data-view-target]').forEach(item => {
      item.classList.toggle('is-active', item.getAttribute('data-view-target') === v);
    });
    document.getElementById('tree-seg-btn')?.classList.toggle('active', v === 'tree');
    document.getElementById('raw-btn')?.classList.toggle('active', v === 'raw');
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

  // ============================================
  // KEYBOARD NAVIGATION
  // ============================================
  function setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      // Handle Undo/Redo globally (even in inputs for these specific shortcuts)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      
      // Ctrl+F to focus search input
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
        return;
      }
      
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (currentView !== 'tree') return;
      
      // Get only visible rows (not filtered out and not inside collapsed parents)
      const rows = Array.from(document.querySelectorAll('.json-row:not(.filtered-out)')).filter(row => {
        // Check if row is visible (not hidden by collapsed parent)
        return row.offsetParent !== null && row.style.display !== 'none';
      });
      if (rows.length === 0) return;
      
      // Update focused index based on currently focused row
      const currentFocused = document.querySelector('.json-row.focused');
      if (currentFocused) {
        focusedRowIndex = rows.indexOf(currentFocused);
      }
      
      switch(e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (focusedRowIndex < 0) focusedRowIndex = -1;
          focusedRowIndex = Math.min(focusedRowIndex + 1, rows.length - 1);
          focusRow(rows[focusedRowIndex]);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (focusedRowIndex < 0) focusedRowIndex = rows.length;
          focusedRowIndex = Math.max(focusedRowIndex - 1, 0);
          focusRow(rows[focusedRowIndex]);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (focusedRowIndex >= 0) expandRow(rows[focusedRowIndex]);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (focusedRowIndex >= 0) collapseRow(rows[focusedRowIndex]);
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedRowIndex >= 0) toggleRow(rows[focusedRowIndex]);
          break;
        case 'c':
          if (e.ctrlKey || e.metaKey) {
            if (focusedRowIndex >= 0 && selectedValue !== null) {
              const s = typeof selectedValue === 'object' ? JSON.stringify(selectedValue, null, 2) : String(selectedValue);
              navigator.clipboard.writeText(s).then(() => showToast('Copied value'));
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          clearRowSelection();
          break;
      }
    });
  }

  function focusRow(row) {
    // Clear both focused and selected classes
    document.querySelectorAll('.json-row.focused').forEach(r => r.classList.remove('focused'));
    document.querySelectorAll('.json-row.selected').forEach(r => r.classList.remove('selected'));
    if (row) {
      row.classList.add('focused');
      row.classList.add('selected');
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      // Update selected values
      selectedRow = row;
      selectedPath = row.dataset.path || '';
      selectedKey = row.dataset.key || '';
      selectedType = row.dataset.type || '';
      selectedValue = getValueAtPath(jsonData, selectedPath);
      updateBreadcrumb(selectedPath);
    }
  }

  function clearRowSelection() {
    document.querySelectorAll('.json-row.focused').forEach(r => r.classList.remove('focused'));
    document.querySelectorAll('.json-row.selected').forEach(r => r.classList.remove('selected'));
    focusedRowIndex = -1;
    selectedRow = null;
  }

  function expandRow(row) {
    const toggle = row.querySelector('.toggle');
    if (toggle && row.classList.contains('collapsed')) {
      toggle.click();
    }
  }

  function collapseRow(row) {
    const toggle = row.querySelector('.toggle');
    if (toggle && !row.classList.contains('collapsed')) {
      toggle.click();
    }
  }

  function toggleRow(row) {
    const toggle = row.querySelector('.toggle');
    if (toggle) toggle.click();
  }

  // ============================================
  // JSON LOADING
  // ============================================
  function loadJson() {
    // Get JSON from chrome storage (set by content script)
    chrome.storage.local.get(['jsonToFormat', 'jsonSourceUrl'], (result) => {
      if (result.jsonToFormat) {
        try {
          rawJson = result.jsonToFormat;
          jsonData = JSON.parse(rawJson);
          originalJsonData = JSON.parse(rawJson);
          sourceUrl = result.jsonSourceUrl || '';
          
          // Clear storage after loading
          chrome.storage.local.remove(['jsonToFormat', 'jsonSourceUrl']);
          
          // Check for GraphQL response
          isGraphQL = jsonData && typeof jsonData === 'object' && ('data' in jsonData || 'errors' in jsonData);
          if (isGraphQL) {
            graphqlBanner.style.display = 'flex';
          }
          
          renderJson(true); // Initial load - collapse all except first level
          updateStats();
          loading.style.display = 'none';
        } catch (e) {
          loading.innerHTML = `<div class="error">❌ Invalid JSON: ${e.message}</div>`;
        }
      } else {
        // No JSON in storage - show helpful message
        loading.innerHTML = `
          <div class="empty-state-content">
            <img src="../icons/logo.png" alt="NextJSON" class="empty-state-logo">
            <h2 class="empty-state-title">No JSON loaded</h2>
            <p class="empty-state-desc">Navigate to any <code>.json</code> URL or API endpoint<br>and it will be formatted here automatically.</p>
            <div class="empty-state-hints">
              <div class="empty-hint"><span class="empty-hint-key">Popup</span> Paste JSON via the extension icon</div>
              <div class="empty-hint"><span class="empty-hint-key">Import URL</span> Fetch JSON from any endpoint</div>
            </div>
          </div>`;
      }
    });
  }

  function renderJson(initialLoad = false) {
    let dataToRender = jsonData;
    
    // Handle GraphQL view filtering
    if (isGraphQL && graphqlView !== 'all') {
      if (graphqlView === 'data' && jsonData.data) {
        dataToRender = jsonData.data;
      } else if (graphqlView === 'errors' && jsonData.errors) {
        dataToRender = jsonData.errors;
      }
    }
    
    jsonOutput.innerHTML = '';
    allRows = [];
    const html = renderValue(dataToRender, '', '', 0);
    jsonOutput.innerHTML = html;
    rawOutput.textContent = JSON.stringify(jsonData, null, 2);
    
    // Attach event listeners
    jsonOutput.querySelectorAll('.toggle').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = el.closest('.json-row');
        const children = row.nextElementSibling;
        const closingBracket = children?.nextElementSibling;
        
        row.classList.toggle('collapsed');
        if (children && children.classList.contains('json-children')) {
          children.classList.toggle('collapsed');
        }
        if (closingBracket && closingBracket.classList.contains('bracket-close')) {
          closingBracket.classList.toggle('collapsed');
        }
        // CSS rotates the chevron based on .collapsed class — no textContent swap needed
      });
    });
    
    jsonOutput.querySelectorAll('.json-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // The .toggle SVG path forwards its click to the toggle handler
        // attached above; ignore here so we don't double-fire.
        if (e.target.closest('.toggle')) return;
        // Don't trigger expand on link clicks or while user is selecting.
        if (e.target.tagName === 'A') return;
        if (window.getSelection && window.getSelection().toString()) return;

        // Click anywhere on an expandable row toggles it. Always select
        // the row so the breadcrumb / context-menu state stays in sync.
        selectRow(row);
        if (row.classList.contains('expandable')) {
          const toggle = row.querySelector('.toggle');
          if (toggle) toggle.click();
        }
      });
    });
    
    // Setup date tooltips
    if (formatDates) {
      setupDateTooltips();
    }
    
    // On initial load, collapse all except first two levels
    if (initialLoad) {
      collapseAllExceptFirstTwoLevels();
    }
  }
  
  function collapseAllExceptFirstTwoLevels() {
    // Find all expandable rows that are deeper than level 1
    jsonOutput.querySelectorAll('.json-row.expandable').forEach(row => {
      const paddingLeft = parseInt(row.style.paddingLeft) || 0;
      const depth = paddingLeft / 16;
      
      // Collapse anything deeper than second level (depth > 1)
      // depth 0 = root, depth 1 = first level children - both stay open
      if (depth > 1) {
        const toggle = row.querySelector('.toggle');
        const children = row.nextElementSibling;
        const closingBracket = children?.nextElementSibling;
        
        if (!row.classList.contains('collapsed')) {
          row.classList.add('collapsed');
          if (children && children.classList.contains('json-children')) {
            children.classList.add('collapsed');
          }
          if (closingBracket && closingBracket.classList.contains('bracket-close')) {
            closingBracket.classList.add('collapsed');
          }
        }
      }
    });
  }

  function renderJsonPreserveState() {
    // Save collapsed state before re-rendering
    const collapsedPaths = new Set();
    jsonOutput.querySelectorAll('.json-row.expandable.collapsed').forEach(row => {
      collapsedPaths.add(row.dataset.path);
    });
    
    // Re-render
    renderJson(false);
    
    // Restore collapsed state
    jsonOutput.querySelectorAll('.json-row.expandable').forEach(row => {
      const path = row.dataset.path;
      if (collapsedPaths.has(path)) {
        const children = row.nextElementSibling;
        const closingBracket = children?.nextElementSibling;

        row.classList.add('collapsed');
        if (children && children.classList.contains('json-children')) {
          children.classList.add('collapsed');
        }
        if (closingBracket && closingBracket.classList.contains('bracket-close')) {
          closingBracket.classList.add('collapsed');
        }
      }
    });
  }

  function renderValue(value, key, path, depth, isLast = true) {
    const type = getType(value);
    const indent = depth * 16;
    const pathStr = path || 'root';
    const comma = isLast ? '' : ',';
    let html = '';
    
    if (type === 'object' || type === 'array') {
      const isArray = type === 'array';
      const bracket = isArray ? '[' : '{';
      const closeBracket = isArray ? ']' : '}';
      const entries = isArray ? value : Object.entries(value);
      const count = isArray ? value.length : entries.length;
      
      html += `<div class="json-row expandable" data-path="${pathStr}" data-key="${key}" data-type="${type}" style="padding-left:${indent}px">`;
      html += `<span class="toggle"><svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 1.5L6 4.5L2 7.5"/></svg></span>`;
      if (key !== null && key !== undefined && key !== '') {
        if (typeof key === 'number') {
          html += `<span class="index">${key}</span><span class="colon">: </span>`;
        } else {
          html += `<span class="key">"${escapeHtml(key)}"</span><span class="colon">: </span>`;
        }
      }
      html += `<span class="bracket">${bracket}</span>`;
      html += `</div>`;
      html += `<div class="json-children">`;
      
      if (isArray) {
        value.forEach((item, i) => {
          const itemPath = path ? `${path}[${i}]` : `[${i}]`;
          html += renderValue(item, i, itemPath, depth + 1, i === value.length - 1);
        });
      } else {
        const keys = Object.keys(value);
        keys.forEach((k, i) => {
          const itemPath = path ? `${path}.${k}` : k;
          html += renderValue(value[k], k, itemPath, depth + 1, i === keys.length - 1);
        });
      }
      
      html += `</div>`;
      html += `<div class="json-row bracket-close" style="padding-left:${indent}px"><span class="toggle-empty"></span><span class="bracket">${closeBracket}${comma}</span></div>`;
    } else {
      html += `<div class="json-row" data-path="${pathStr}" data-key="${key}" data-type="${type}" style="padding-left:${indent}px">`;
      html += `<span class="toggle-empty"></span>`;
      if (key !== null && key !== undefined && key !== '') {
        if (typeof key === 'number') {
          html += `<span class="index">${key}</span><span class="colon">: </span>`;
        } else {
          html += `<span class="key">"${escapeHtml(key)}"</span><span class="colon">: </span>`;
        }
      }
      html += renderPrimitive(value, type, pathStr, comma);
      html += `</div>`;
    }
    
    return html;
  }

  function renderPrimitive(value, type, path, comma = '') {
    let displayValue = value;
    let extraClass = '';
    let tooltip = '';
    const MAX_LENGTH = 175;
    
    // Date formatting
    if (formatDates && type === 'string' && isDateString(value)) {
      const formatted = formatDateValue(value);
      tooltip = ` data-date="${escapeHtml(value)}" title="${formatted.full}"`;
      extraClass = ' date-value';
    }
    
    // Detect timestamps
    if (formatDates && type === 'number' && isTimestamp(value)) {
      const formatted = formatTimestamp(value);
      tooltip = ` data-timestamp="${value}" title="${formatted.full}"`;
      extraClass = ' timestamp-value';
    }
    
    if (type === 'string') {
      const strValue = String(displayValue);
      // Check if URL
      if (isUrl(value)) {
        if (strValue.length > MAX_LENGTH) {
          const truncated = strValue.substring(0, MAX_LENGTH);
          return `<span class="value string url${extraClass}"${tooltip}>"<a href="${escapeHtml(value)}" target="_blank" rel="noopener"><span class="truncated-text">${escapeHtml(truncated)}</span></a><span class="truncated-indicator">...</span>"<button class="see-more-btn">See more</button><span class="full-text" style="display:none;"><a href="${escapeHtml(value)}" target="_blank" rel="noopener">${escapeHtml(strValue)}</a></span><button class="see-less-btn" style="display:none;">See less</button></span>${comma}`;
        }
        return `<span class="value string url${extraClass}"${tooltip}>"<a href="${escapeHtml(value)}" target="_blank" rel="noopener">${escapeHtml(value)}</a>"</span>${comma}`;
      }
      // Truncate long strings
      if (strValue.length > MAX_LENGTH) {
        const truncated = strValue.substring(0, MAX_LENGTH);
        return `<span class="value string${extraClass}"${tooltip}>"<span class="truncated-text">${escapeHtml(truncated)}</span><span class="truncated-indicator">...</span>"<button class="see-more-btn">See more</button><span class="full-text" style="display:none;">${escapeHtml(strValue)}</span><button class="see-less-btn" style="display:none;">See less</button></span>${comma}`;
      }
      return `<span class="value string${extraClass}"${tooltip}>"${escapeHtml(displayValue)}"</span>${comma}`;
    }
    if (type === 'number') return `<span class="value number${extraClass}"${tooltip}>${value}</span>${comma}`;
    if (type === 'boolean') return `<span class="value boolean">${value}</span>${comma}`;
    if (type === 'null') return `<span class="value null">null</span>${comma}`;
    return `<span class="value">${escapeHtml(String(value))}</span>${comma}`;
  }

  // ============================================
  // DATE/TIME FORMATTING
  // ============================================
  function isDateString(str) {
    if (typeof str !== 'string') return false;
    // ISO 8601 format
    if (/^\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}/.test(str)) return true;
    // Other common formats
    if (/^\d{4}\/\d{2}\/\d{2}/.test(str)) return true;
    return false;
  }

  function isTimestamp(num) {
    if (typeof num !== 'number') return false;
    // Unix timestamp (seconds) - between 1970 and 2100
    if (num > 0 && num < 4102444800) return true;
    // Millisecond timestamp
    if (num > 1000000000000 && num < 4102444800000) return true;
    return false;
  }

  function formatDateValue(str) {
    try {
      const date = new Date(str);
      if (isNaN(date.getTime())) return { short: str, full: str };
      
      const short = date.toLocaleDateString('en-US', { 
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const full = date.toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
      });
      const relative = getRelativeTime(date);
      
      return { short, full, relative };
    } catch {
      return { short: str, full: str };
    }
  }

  function formatTimestamp(num) {
    try {
      // Convert seconds to milliseconds if needed
      const ms = num > 1000000000000 ? num : num * 1000;
      const date = new Date(ms);
      return formatDateValue(date.toISOString());
    } catch {
      return { short: String(num), full: String(num) };
    }
  }

  function getRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 30) return '';
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }

  function toggleDateFormatting() {
    formatDates = !formatDates;
    renderJson();
    showToast(formatDates ? 'Date formatting enabled' : 'Date formatting disabled');
  }

  function setupDateTooltips() {
    document.querySelectorAll('.date-value, .timestamp-value').forEach(el => {
      el.addEventListener('mouseenter', (e) => {
        const value = el.dataset.date || el.dataset.timestamp;
        if (!value) return;
        
        const formatted = el.dataset.date ? formatDateValue(value) : formatTimestamp(Number(value));
        
        document.getElementById('date-formatted').textContent = formatted.short;
        document.getElementById('date-relative').textContent = formatted.relative || '';
        document.getElementById('date-original').textContent = `Original: ${value}`;
        
        dateTooltip.style.display = 'block';
        dateTooltip.style.left = e.pageX + 10 + 'px';
        dateTooltip.style.top = e.pageY + 10 + 'px';
      });
      
      el.addEventListener('mouseleave', () => {
        dateTooltip.style.display = 'none';
      });
    });
  }

  // ============================================
  // JQ QUERY MODAL
  // ============================================
  const jqModal = document.getElementById('jq-modal');
  
  function openJqModal() {
    if (jqModal) {
      jqModal.style.display = 'flex';
      jqInput?.focus();
    }
  }
  
  function closeJqModal() {
    if (jqModal) {
      jqModal.style.display = 'none';
      // Clear input and results
      if (jqInput) jqInput.value = '';
      if (jqResults) jqResults.innerHTML = '<span class="jq-placeholder">Run a query to see results...</span>';
      lastJqResult = '';
    }
  }

  let lastJqResult = ''; // Store for copy button
  
  function runJqQuery() {
    const query = jqInput.value.trim();
    if (!query) {
      jqResults.innerHTML = '<span class="jq-placeholder">Run a query to see results...</span>';
      lastJqResult = '';
      return;
    }
    
    if (!jqEngine) {
      jqResults.innerHTML = '<span class="jq-error">JQ engine not loaded</span>';
      return;
    }
    
    try {
      const result = jqEngine.query(jsonData, query);
      lastJqResult = JSON.stringify(result, null, 2);
      jqResults.innerHTML = escapeHtml(lastJqResult);
    } catch (e) {
      jqResults.innerHTML = `<span class="jq-error">Error: ${escapeHtml(e.message)}</span>`;
      lastJqResult = '';
    }
  }
  
  function copyJqResult() {
    if (lastJqResult) {
      navigator.clipboard.writeText(lastJqResult).then(() => showToast('Result copied!'));
    } else {
      showToast('No result to copy');
    }
  }
  
  function clearJqInput() {
    if (jqInput) {
      jqInput.value = '';
      jqInput.focus();
    }
    jqResults.innerHTML = '<span class="jq-placeholder">Run a query to see results...</span>';
    lastJqResult = '';
  }

  // ============================================
  // MINIFY / PRETTIFY TOGGLE
  // ============================================
  function toggleMinifyPrettify() {
    const btn = document.getElementById('minify-btn');
    const btnText = btn.querySelector('span');
    
    if (isMinified) {
      // Switch to prettified
      rawJson = JSON.stringify(jsonData, null, 2);
      isMinified = false;
      btnText.textContent = 'Minify';
      showToast('JSON prettified');
    } else {
      // Switch to minified
      rawJson = JSON.stringify(jsonData);
      isMinified = true;
      btnText.textContent = 'Prettify';
      showToast('JSON minified');
    }
    
    // Update raw view if active
    if (currentView === 'raw') {
      rawOutput.textContent = rawJson;
    }
    
    renderJson();
  }

  function exportMinified() {
    const minified = JSON.stringify(jsonData);
    downloadFile(minified, 'export_minified.json', 'application/json');
  }

  // ============================================
  // EDIT MODAL (from context menu)
  // ============================================
  const editModal = document.getElementById('edit-modal');
  
  function openEditModal() {
    hideContextMenu();
    
    if (!selectedPath && !selectedKey) {
      showToast('No item selected');
      return;
    }
    
    editingPath = selectedPath;
    editingKey = selectedKey;
    
    const keyInput = document.getElementById('edit-key-input');
    const valueInput = document.getElementById('edit-value-input');
    
    keyInput.value = selectedKey || '';
    
    // Format value for editing
    if (selectedValue === null) {
      valueInput.value = 'null';
    } else if (typeof selectedValue === 'object') {
      valueInput.value = JSON.stringify(selectedValue, null, 2);
    } else if (typeof selectedValue === 'string') {
      valueInput.value = JSON.stringify(selectedValue);
    } else {
      valueInput.value = String(selectedValue);
    }
    
    editModal.style.display = 'flex';
    keyInput.focus();
  }
  
  function hideEditModal() {
    editModal.style.display = 'none';
  }
  
  function saveEditModal() {
    const newKey = document.getElementById('edit-key-input').value.trim();
    const valueStr = document.getElementById('edit-value-input').value.trim();
    
    if (!newKey) {
      showToast('Key cannot be empty');
      return;
    }
    
    // Save state for undo
    saveUndoState();
    
    let newValue;
    try {
      newValue = JSON.parse(valueStr);
    } catch (e) {
      // If it's not valid JSON, treat as string
      newValue = valueStr;
    }
    
    // Apply the edit - navigate to parent object
    const pathParts = editingPath.split(/\.(?![^\[]*\])/).filter(p => p && p !== 'root');
    let parent = jsonData;
    let lastKey = editingKey;
    
    // Handle array index notation in path
    for (let i = 0; i < pathParts.length - 1; i++) {
      let part = pathParts[i];
      // Check for array notation like "items[0]"
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        parent = parent[arrayMatch[1]][parseInt(arrayMatch[2])];
      } else if (part.match(/^\[\d+\]$/)) {
        // Just array index
        parent = parent[parseInt(part.replace(/[\[\]]/g, ''))];
      } else {
        parent = parent[part];
      }
    }
    
    // Get the last part to determine actual parent
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      const arrayMatch = lastPart.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        parent = parent[arrayMatch[1]];
        lastKey = parseInt(arrayMatch[2]);
      } else if (lastPart.match(/^\[\d+\]$/)) {
        lastKey = parseInt(lastPart.replace(/[\[\]]/g, ''));
      } else {
        // For object properties, we need to go one level up
        // The path points to the value, not the parent
      }
    }
    
    // Handle key rename while preserving order
    if (typeof parent === 'object' && !Array.isArray(parent)) {
      if (editingKey !== newKey) {
        // Rename key while preserving order
        const newObj = {};
        for (const k of Object.keys(parent)) {
          if (k === editingKey) {
            newObj[newKey] = newValue;
          } else {
            newObj[k] = parent[k];
          }
        }
        // Replace parent contents
        for (const k of Object.keys(parent)) {
          delete parent[k];
        }
        for (const k of Object.keys(newObj)) {
          parent[k] = newObj[k];
        }
      } else {
        parent[editingKey] = newValue;
      }
    } else if (Array.isArray(parent)) {
      const idx = typeof lastKey === 'number' ? lastKey : parseInt(editingKey.replace(/[\[\]]/g, ''));
      parent[idx] = newValue;
    }
    
    // Update rawJson
    rawJson = JSON.stringify(jsonData, null, 2);
    
    hideEditModal();
    renderJsonPreserveState();
    updateUndoRedoButtons();
    showToast('Changes saved');
  }

  // ============================================
  // IMPORT FROM URL
  // ============================================
  // ============================================
  // FETCH URL MODAL — Split Pro
  // ============================================
  let fuMethod = 'GET';
  let fuRecents = [];

  function showImportModal() {
    importModal.style.display = 'flex';
    // Reset error
    const errorEl = document.getElementById('import-error');
    if (errorEl) errorEl.style.display = 'none';
    // Restore Fetch button label
    resetFetchBtn();
    // Ensure at least one header row exists
    const list = document.getElementById('fu-headers');
    if (list && list.children.length === 0) {
      addHeaderRow('Accept', 'application/json');
    }
    // Render recent URLs
    renderRecents();
    // Focus URL input
    setTimeout(() => document.getElementById('import-url-input')?.focus(), 0);
  }

  function hideImportModal() {
    importModal.style.display = 'none';
    document.getElementById('import-url-input').value = '';
    const errorEl = document.getElementById('import-error');
    if (errorEl) errorEl.style.display = 'none';
    // Close method picker if open
    document.getElementById('fu-method-pop')?.setAttribute('hidden', '');
    resetFetchBtn();
  }

  function resetFetchBtn() {
    const btn = document.getElementById('import-fetch');
    if (!btn) return;
    btn.disabled = false;
    btn.innerHTML = 'Fetch <span class="arrow">→</span>';
  }

  function setFuMethod(m) {
    fuMethod = m;
    const label = document.getElementById('fu-method-label');
    const badge = document.getElementById('fu-method-badge');
    if (label) label.textContent = m;
    if (badge) badge.textContent = m;
  }

  function getCurrentHeaders() {
    const list = document.getElementById('fu-headers');
    if (!list) return {};
    const headers = {};
    list.querySelectorAll('.fu-kv').forEach(row => {
      const k = row.querySelector('.k')?.value.trim();
      const v = row.querySelector('.v')?.value.trim();
      if (k) headers[k] = v || '';
    });
    return headers;
  }

  function addHeaderRow(key = '', value = '') {
    const list = document.getElementById('fu-headers');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'fu-kv';
    row.innerHTML = `
      <input class="k" type="text" placeholder="Header" value="${escapeHtml(key)}">
      <input class="v" type="text" placeholder="Value" value="${escapeHtml(value)}">
      <button class="x" type="button" aria-label="Remove">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 2.5L8.5 8.5M8.5 2.5L2.5 8.5"/></svg>
      </button>
    `;
    row.querySelector('.x').addEventListener('click', () => row.remove());
    list.appendChild(row);
  }

  function loadRecents(cb) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['fu_recents'], (res) => {
        fuRecents = Array.isArray(res.fu_recents) ? res.fu_recents : [];
        cb && cb();
      });
    } else {
      try {
        fuRecents = JSON.parse(localStorage.getItem('fu_recents') || '[]');
      } catch (_) { fuRecents = []; }
      cb && cb();
    }
  }

  function saveRecents() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ fu_recents: fuRecents });
    } else {
      try { localStorage.setItem('fu_recents', JSON.stringify(fuRecents)); } catch (_) {}
    }
  }

  function pushRecent(url, method) {
    fuRecents = [{ url, method, ts: Date.now() }, ...fuRecents.filter(r => r.url !== url)].slice(0, 5);
    saveRecents();
  }

  function relativeTime(ts) {
    const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    if (d === 1) return 'yesterday';
    if (d < 7) return d + 'd ago';
    return new Date(ts).toLocaleDateString();
  }

  function renderRecents() {
    const wrap = document.getElementById('fu-recents');
    if (!wrap) return;
    loadRecents(() => {
      if (!fuRecents.length) {
        wrap.innerHTML = '<div class="fu-recents-empty">No recent URLs yet.</div>';
        return;
      }
      wrap.innerHTML = fuRecents.map(r => `
        <div class="fu-recent" data-url="${escapeHtml(r.url)}" data-method="${escapeHtml(r.method || 'GET')}">
          <span class="ico"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9.5a3 3 0 0 0 4.24 0l2-2a3 3 0 0 0-4.24-4.24l-1 1"/><path d="M9 6.5a3 3 0 0 0-4.24 0l-2 2a3 3 0 0 0 4.24 4.24l1-1"/></svg></span>
          <span class="url">${escapeHtml(r.url)}</span>
          <span class="ago">${escapeHtml(relativeTime(r.ts || Date.now()))}</span>
        </div>
      `).join('');
      wrap.querySelectorAll('.fu-recent').forEach(el => {
        el.addEventListener('click', () => {
          const url = el.dataset.url;
          const method = el.dataset.method || 'GET';
          const input = document.getElementById('import-url-input');
          if (input) input.value = url;
          setFuMethod(method);
          input?.focus();
        });
      });
    });
  }

  function fetchFromUrl() {
    const url = document.getElementById('import-url-input').value.trim();
    const errorEl = document.getElementById('import-error');
    const fetchBtn = document.getElementById('import-fetch');

    if (errorEl) errorEl.style.display = 'none';

    if (!url) {
      if (errorEl) {
        errorEl.textContent = 'Please enter a URL';
        errorEl.style.display = 'block';
      }
      return;
    }

    try { new URL(url); }
    catch (e) {
      if (errorEl) {
        errorEl.textContent = 'Invalid URL format. Please enter a valid URL.';
        errorEl.style.display = 'block';
      }
      return;
    }

    // Loading state — disable + label
    fetchBtn.disabled = true;
    fetchBtn.innerHTML = 'Fetching… <span class="arrow">→</span>';

    const headers = getCurrentHeaders();

    chrome.runtime.sendMessage({ type: 'FETCH_URL', url, method: fuMethod, headers }, (response) => {
      resetFetchBtn();

      if (response && response.success) {
        try {
          jsonData = JSON.parse(response.data);
          originalJsonData = JSON.parse(response.data);
          rawJson = response.data;
          sourceUrl = url;
          pushRecent(url, fuMethod);
          renderJson(true);
          updateStats();
          hideImportModal();
          showToast('JSON loaded successfully!');
        } catch (e) {
          if (errorEl) {
            errorEl.textContent = 'Failed to parse response as JSON: ' + e.message;
            errorEl.style.display = 'block';
          }
        }
      } else {
        const errorMsg = response?.error || 'Failed to fetch data from this URL';
        if (errorEl) {
          errorEl.textContent = errorMsg;
          errorEl.style.display = 'block';
        }
      }
    });
  }

  function setupFetchUrlModalUI() {
    const methodBtn = document.getElementById('fu-method-btn');
    const methodPop = document.getElementById('fu-method-pop');
    methodBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!methodPop) return;
      methodPop.toggleAttribute('hidden');
    });
    methodPop?.querySelectorAll('.fu-method-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        setFuMethod(item.dataset.method);
        methodPop.setAttribute('hidden', '');
      });
    });
    document.addEventListener('click', (e) => {
      if (methodPop && !methodPop.hasAttribute('hidden')) {
        if (!methodPop.contains(e.target) && e.target !== methodBtn && !methodBtn?.contains(e.target)) {
          methodPop.setAttribute('hidden', '');
        }
      }
    });

    document.getElementById('fu-add-header')?.addEventListener('click', (e) => {
      e.stopPropagation();
      addHeaderRow();
    });

    // Enter in URL input → fetch
    document.getElementById('import-url-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        fetchFromUrl();
      }
    });

    // Esc closes modal when open
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && importModal && importModal.style.display !== 'none') {
        hideImportModal();
      }
    });
  }

  // ============================================
  // TABLE VIEW FOR ARRAYS
  // ============================================
  function toggleTableView() {
    if (currentView === 'table') {
      switchView('tree');
    } else {
      switchView('table');
    }
  }

  // Store current table data for exports
  let currentTableData = null;
  let currentTableKeys = [];

  function renderTableView(data, path) {
    let arrayData = data || findFirstArray(jsonData);
    
    if (!Array.isArray(arrayData) || arrayData.length === 0) {
      tableContent.innerHTML = '<p class="table-placeholder">No array data found. Select an array from tree view.</p>';
      document.getElementById('table-info').textContent = 'No array data';
      currentTableData = null;
      currentTableKeys = [];
      return;
    }
    
    // Store for exports
    currentTableData = arrayData;
    
    // Get all unique keys from array items
    const allKeys = new Set();
    arrayData.forEach(item => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        Object.keys(item).forEach(k => allKeys.add(k));
      }
    });
    
    const keys = Array.from(allKeys);
    currentTableKeys = keys;
    
    if (keys.length === 0) {
      // Simple array of primitives
      tableContent.innerHTML = `
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>#</th><th>Value</th></tr></thead>
            <tbody>
              ${arrayData.map((v, i) => `<tr><td>${i}</td><td>${formatTableCell(v)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      // Array of objects
      tableContent.innerHTML = `
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>#</th>${keys.map(k => `<th>${escapeHtml(k)}</th>`).join('')}</tr></thead>
            <tbody>
              ${arrayData.map((item, i) => `
                <tr>
                  <td>${i}</td>
                  ${keys.map(k => `<td title="${escapeHtml(String(item?.[k] ?? ''))}">${formatTableCell(item?.[k])}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    
    document.getElementById('table-info').textContent = `${arrayData.length} rows × ${keys.length || 1} columns`;
  }

  function formatTableCell(value) {
    if (value === null) return '<span class="null">null</span>';
    if (value === undefined) return '<span class="null">—</span>';
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    if (typeof value === 'object') return '<span class="object">{...}</span>';
    if (typeof value === 'string' && isUrl(value)) {
      return `<a href="${escapeHtml(value)}" target="_blank">🔗 Link</a>`;
    }
    const str = String(value);
    return escapeHtml(str.length > 50 ? str.substring(0, 50) + '...' : str);
  }

  function findFirstArray(obj, maxDepth = 3, depth = 0) {
    if (depth > maxDepth) return null;
    if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') {
      return obj;
    }
    if (obj && typeof obj === 'object') {
      for (const value of Object.values(obj)) {
        const found = findFirstArray(value, maxDepth, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  function viewAsTable() {
    hideContextMenu();
    if (Array.isArray(selectedValue)) {
      switchView('table');
      renderTableView(selectedValue, selectedPath);
    } else {
      showToast('Selected value is not an array');
    }
  }

  function exportTableCSV() {
    const table = tableContent.querySelector('table');
    if (!table) {
      showToast('No table to export');
      return;
    }
    
    const rows = Array.from(table.querySelectorAll('tr'));
    const csv = rows.map(row => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      return cells.map(cell => `"${cell.textContent.replace(/"/g, '""')}"`).join(',');
    }).join('\n');
    
    downloadFile(csv, 'export_csv.csv', 'text/csv');
    showToast('CSV file downloaded!');
  }

  function exportTableJSON() {
    if (!currentTableData) {
      showToast('No table data to export');
      return;
    }
    
    const jsonStr = JSON.stringify(currentTableData, null, 2);
    downloadFile(jsonStr, 'export_json.json', 'application/json');
    showToast('JSON file downloaded!');
  }

  function exportTableExcel() {
    if (!currentTableData || currentTableData.length === 0) {
      showToast('No table data to export');
      return;
    }
    
    const keys = currentTableKeys.length > 0 ? currentTableKeys : ['Value'];
    
    // Create proper XLSX file using minimal Office Open XML format
    const sheetData = [];
    
    // Header row
    const headerRow = ['#', ...keys];
    sheetData.push(headerRow);
    
    // Data rows
    currentTableData.forEach((item, index) => {
      const row = [index];
      if (keys.length > 0 && keys[0] !== 'Value') {
        keys.forEach(key => {
          const value = item?.[key];
          row.push(formatXlsxCell(value));
        });
      } else {
        row.push(formatXlsxCell(item));
      }
      sheetData.push(row);
    });
    
    // Generate XLSX
    const xlsx = createXlsx(sheetData);
    downloadBlob(xlsx, 'export_excel.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    showToast('Excel file downloaded!');
  }

  function formatXlsxCell(value) {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  }

  function createXlsx(data) {
    // Create sheet XML
    let sheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    sheetXml += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    sheetXml += '<sheetData>';
    
    data.forEach((row, rowIndex) => {
      sheetXml += `<row r="${rowIndex + 1}">`;
      row.forEach((cell, colIndex) => {
        const cellRef = getColLetter(colIndex) + (rowIndex + 1);
        const cellValue = cell;
        
        if (typeof cellValue === 'number') {
          sheetXml += `<c r="${cellRef}"><v>${cellValue}</v></c>`;
        } else if (typeof cellValue === 'boolean') {
          sheetXml += `<c r="${cellRef}" t="b"><v>${cellValue ? 1 : 0}</v></c>`;
        } else {
          const escaped = String(cellValue).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          sheetXml += `<c r="${cellRef}" t="inlineStr"><is><t>${escaped}</t></is></c>`;
        }
      });
      sheetXml += '</row>';
    });
    
    sheetXml += '</sheetData></worksheet>';
    
    // Create workbook XML
    const workbookXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>';
    
    // Create relationships
    const relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '</Relationships>';
    
    const rootRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';
    
    // Content types
    const contentTypesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '</Types>';
    
    // Create ZIP file manually (minimal implementation)
    return createZipBlob([
      { name: '[Content_Types].xml', content: contentTypesXml },
      { name: '_rels/.rels', content: rootRelsXml },
      { name: 'xl/workbook.xml', content: workbookXml },
      { name: 'xl/_rels/workbook.xml.rels', content: relsXml },
      { name: 'xl/worksheets/sheet1.xml', content: sheetXml }
    ]);
  }

  function getColLetter(index) {
    let letter = '';
    while (index >= 0) {
      letter = String.fromCharCode((index % 26) + 65) + letter;
      index = Math.floor(index / 26) - 1;
    }
    return letter;
  }

  function createZipBlob(files) {
    // Simple ZIP file creator
    const encoder = new TextEncoder();
    const crc32Table = makeCrc32Table();
    
    let localHeaders = [];
    let centralHeaders = [];
    let offset = 0;
    
    files.forEach(file => {
      const nameBytes = encoder.encode(file.name);
      const contentBytes = encoder.encode(file.content);
      const crc = crc32(contentBytes, crc32Table);
      
      // Local file header
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const localView = new DataView(localHeader.buffer);
      localView.setUint32(0, 0x04034b50, true); // signature
      localView.setUint16(4, 20, true); // version needed
      localView.setUint16(6, 0, true); // flags
      localView.setUint16(8, 0, true); // compression (none)
      localView.setUint16(10, 0, true); // mod time
      localView.setUint16(12, 0, true); // mod date
      localView.setUint32(14, crc, true); // crc32
      localView.setUint32(18, contentBytes.length, true); // compressed size
      localView.setUint32(22, contentBytes.length, true); // uncompressed size
      localView.setUint16(26, nameBytes.length, true); // filename length
      localView.setUint16(28, 0, true); // extra field length
      localHeader.set(nameBytes, 30);
      
      localHeaders.push({ header: localHeader, content: contentBytes, offset: offset });
      offset += localHeader.length + contentBytes.length;
      
      // Central directory header
      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(centralHeader.buffer);
      centralView.setUint32(0, 0x02014b50, true); // signature
      centralView.setUint16(4, 20, true); // version made by
      centralView.setUint16(6, 20, true); // version needed
      centralView.setUint16(8, 0, true); // flags
      centralView.setUint16(10, 0, true); // compression
      centralView.setUint16(12, 0, true); // mod time
      centralView.setUint16(14, 0, true); // mod date
      centralView.setUint32(16, crc, true); // crc32
      centralView.setUint32(20, contentBytes.length, true); // compressed size
      centralView.setUint32(24, contentBytes.length, true); // uncompressed size
      centralView.setUint16(28, nameBytes.length, true); // filename length
      centralView.setUint16(30, 0, true); // extra field length
      centralView.setUint16(32, 0, true); // comment length
      centralView.setUint16(34, 0, true); // disk number
      centralView.setUint16(36, 0, true); // internal attributes
      centralView.setUint32(38, 0, true); // external attributes
      centralView.setUint32(42, localHeaders[localHeaders.length - 1].offset, true); // offset
      centralHeader.set(nameBytes, 46);
      
      centralHeaders.push(centralHeader);
    });
    
    // Calculate central directory size
    const centralDirSize = centralHeaders.reduce((sum, h) => sum + h.length, 0);
    const centralDirOffset = offset;
    
    // End of central directory
    const endRecord = new Uint8Array(22);
    const endView = new DataView(endRecord.buffer);
    endView.setUint32(0, 0x06054b50, true); // signature
    endView.setUint16(4, 0, true); // disk number
    endView.setUint16(6, 0, true); // central dir disk
    endView.setUint16(8, files.length, true); // entries on disk
    endView.setUint16(10, files.length, true); // total entries
    endView.setUint32(12, centralDirSize, true); // central dir size
    endView.setUint32(16, centralDirOffset, true); // central dir offset
    endView.setUint16(20, 0, true); // comment length
    
    // Combine all parts
    const totalSize = offset + centralDirSize + 22;
    const zipData = new Uint8Array(totalSize);
    let pos = 0;
    
    localHeaders.forEach(item => {
      zipData.set(item.header, pos);
      pos += item.header.length;
      zipData.set(item.content, pos);
      pos += item.content.length;
    });
    
    centralHeaders.forEach(header => {
      zipData.set(header, pos);
      pos += header.length;
    });
    
    zipData.set(endRecord, pos);
    
    return new Blob([zipData], { type: 'application/zip' });
  }

  function makeCrc32Table() {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    return table;
  }

  function crc32(bytes, table) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function downloadBlob(blob, filename, mimeType) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function formatCsvCell(value) {
    if (value === null || value === undefined) {
      return '""';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    if (typeof value === 'object') {
      return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
    }
    return `"${String(value).replace(/"/g, '""')}"`;
  }

  function formatExcelCell(value) {
    if (value === null || value === undefined) {
      return { type: 'String', value: '' };
    }
    if (typeof value === 'number') {
      return { type: 'Number', value: String(value) };
    }
    if (typeof value === 'boolean') {
      return { type: 'String', value: value ? 'true' : 'false' };
    }
    if (typeof value === 'object') {
      return { type: 'String', value: escapeXml(JSON.stringify(value)) };
    }
    return { type: 'String', value: escapeXml(String(value)) };
  }

  function escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ============================================
  // VIEW SWITCHING
  // ============================================
  function switchView(v) {
    currentView = v;
    jsonContainer.style.display = v === 'tree' ? 'block' : 'none';
    rawContainer.style.display = v === 'raw' ? 'block' : 'none';
    diffContainer.style.display = v === 'diff' ? 'block' : 'none';
    graphContainer.style.display = v === 'graph' ? 'flex' : 'none';
    uiContainer.style.display = v === 'ui' ? 'flex' : 'none';
    tableViewContainer.style.display = v === 'table' ? 'flex' : 'none';

    // Update active view button highlight. Clear .active off both the
    // legacy .btn-view elements AND the Split Pro More-menu items that
    // share their IDs, otherwise switching views would let each click
    // accumulate an .active class on the previous item.
    const viewBtnMap = { raw: 'raw-btn', diff: 'compare-btn', graph: 'graph-btn', ui: 'ui-btn', table: 'table-btn' };
    document.querySelectorAll('.btn-view').forEach(b => b.classList.remove('active'));
    Object.values(viewBtnMap).forEach(id => document.getElementById(id)?.classList.remove('active'));
    if (viewBtnMap[v]) document.getElementById(viewBtnMap[v])?.classList.add('active');

    // Hide search bar for views that don't use it
    const searchBarEl = document.querySelector('.search-bar');
    if (searchBarEl) searchBarEl.classList.toggle('search-hidden', !['tree', 'raw'].includes(v));

    // Reset button states
    if (v !== 'diff') {
      diffInput.value = '';
      diffResults.innerHTML = '';
    }

    // Render view-specific content
    if (v === 'graph') renderGraphView();
    if (v === 'ui') renderUIView();
    if (v === 'table') renderTableView();

    // Sync Split Pro active markers (Tree/Raw segmented + More menu)
    if (typeof syncMoreMenuActive === 'function') syncMoreMenuActive();
  }

  function toggleRawView() {
    // In Split Pro segmented mode, Raw always switches to raw view
    // (Tree segmented switches back to tree)
    switchView('raw');
  }

  function toggleCompareView() {
    switchView(currentView === 'diff' ? 'tree' : 'diff');
  }

  function toggleGraphView() {
    switchView(currentView === 'graph' ? 'tree' : 'graph');
  }

  function toggleUIView() {
    switchView(currentView === 'ui' ? 'tree' : 'ui');
  }

  function renderGraphView() {
    if (!jsonData) return;
    if (typeof TreeGraph !== 'undefined') {
      const canvas = document.getElementById('graph-canvas');
      treeGraph = new TreeGraph(canvas, jsonData, {
        onNodeClick: (node) => {
          graphInfoPanel.classList.add('visible');
          infoPanelContent.innerHTML = `
            <div class="info-row"><span class="info-label">Path:</span> ${node.path || 'root'}</div>
            <div class="info-row"><span class="info-label">Type:</span> <span class="type-badge type-${node.type}">${node.type}</span></div>
            <div class="info-row"><span class="info-label">Value:</span> <pre>${escapeHtml(JSON.stringify(node.value, null, 2).substring(0, 500))}</pre></div>
          `;
        }
      });
    }
  }

  function renderUIView() {
    if (!jsonData) return;
    if (typeof UIRenderer !== 'undefined') {
      uiRenderer = new UIRenderer(uiCanvas, jsonData);
    }
  }

  function graphZoomIn() { if (treeGraph) treeGraph.zoomIn(); }
  function graphZoomOut() { if (treeGraph) treeGraph.zoomOut(); }
  function graphResetView() { if (treeGraph) treeGraph.resetView(); }
  function graphExpandAll() { if (treeGraph) treeGraph.expandAll(); }
  function graphCollapseAll() { if (treeGraph) treeGraph.collapseAll(); }

  // ============================================
  // SEARCH
  // ============================================
  // Search state for navigation
  let searchMatches = [];
  let currentMatchIndex = -1;
  
  function performSearch() {
    const query = searchInput.value.trim();
    if (!query) {
      clearSearch();
      return;
    }
    
    const inKeys = searchKeys.checked;
    const inValues = searchValues.checked;
    const caseSensitive = searchCase.checked;
    
    const searchQuery = caseSensitive ? query : query.toLowerCase();
    const matches = [];
    
    // Check if query looks like a path (contains . or [])
    const isPathQuery = /[.\[\]]/.test(query);
    
    function search(obj, path) {
      if (obj === null || obj === undefined) return;
      
      if (typeof obj === 'object') {
        const entries = Array.isArray(obj) ? obj.map((v, i) => [i, v]) : Object.entries(obj);
        for (const [key, value] of entries) {
          const keyStr = String(key);
          const keyMatch = caseSensitive ? keyStr : keyStr.toLowerCase();
          const currentPath = Array.isArray(obj) ? `${path}[${key}]` : (path ? `${path}.${key}` : key);
          const pathMatch = caseSensitive ? currentPath : currentPath.toLowerCase();
          
          // Check if path matches (for path-based queries)
          if (isPathQuery && pathMatch.includes(searchQuery)) {
            matches.push({ path: currentPath, key: keyStr, type: 'path' });
          } else {
            // Standard key/value search
            if (inKeys && keyMatch.includes(searchQuery)) {
              matches.push({ path: currentPath, key: keyStr, type: 'key' });
            }
            
            if (inValues && typeof value !== 'object') {
              const valStr = String(value);
              const valMatch = caseSensitive ? valStr : valStr.toLowerCase();
              if (valMatch.includes(searchQuery)) {
                matches.push({ path: currentPath, value: valStr, type: 'value' });
              }
            }
          }
          
          search(value, currentPath);
        }
      }
    }
    
    search(jsonData, '');
    
    // Deduplicate matches by path
    const uniqueMatches = [];
    const seenPaths = new Set();
    for (const m of matches) {
      if (!seenPaths.has(m.path)) {
        seenPaths.add(m.path);
        uniqueMatches.push(m);
      }
    }
    
    // Store matches for navigation
    searchMatches = uniqueMatches;
    currentMatchIndex = uniqueMatches.length > 0 ? 0 : -1;
    
    // Clear all highlights first
    document.querySelectorAll('.json-row.search-match').forEach(el => el.classList.remove('search-match'));
    
    // Update search results and navigation
    updateSearchNavigation();
    
    // Go to first match (this will expand parents only for that match and highlight it)
    if (uniqueMatches.length > 0) {
      goToMatch(0);
    }
  }
  
  function updateSearchNavigation() {
    const searchNav = document.getElementById('search-nav');
    const searchNavInfo = document.getElementById('search-nav-info');
    const prevBtn = document.getElementById('search-prev');
    const nextBtn = document.getElementById('search-next');
    
    if (searchMatches.length > 0) {
      searchNav?.classList.add('visible');
      searchNavInfo.textContent = `${currentMatchIndex + 1} / ${searchMatches.length}`;
      prevBtn.disabled = currentMatchIndex <= 0;
      nextBtn.disabled = currentMatchIndex >= searchMatches.length - 1;
      searchResults.innerHTML = '';
    } else {
      searchNav?.classList.remove('visible');
      if (searchInput.value.trim()) {
        searchResults.innerHTML = '<span class="no-match">No matches</span>';
      }
    }
  }
  
  function goToMatch(index) {
    if (index < 0 || index >= searchMatches.length) return;
    
    // Remove previous highlight
    document.querySelectorAll('.json-row.search-match').forEach(el => el.classList.remove('search-match'));
    
    currentMatchIndex = index;
    const match = searchMatches[index];
    
    // Expand parents only for this match
    expandParentsToPath(match.path);
    
    const row = document.querySelector(`.json-row[data-path="${CSS.escape(match.path)}"]`);
    
    if (row) {
      // Highlight only the current match
      row.classList.add('search-match');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    updateSearchNavigation();
  }
  
  function goToPrevMatch() {
    if (currentMatchIndex > 0) {
      goToMatch(currentMatchIndex - 1);
    }
  }
  
  function goToNextMatch() {
    if (currentMatchIndex < searchMatches.length - 1) {
      goToMatch(currentMatchIndex + 1);
    }
  }

  function expandParentsToPath(path) {
    // Parse the path and expand each parent
    const parts = [];
    let current = '';
    let i = 0;
    
    while (i < path.length) {
      if (path[i] === '.') {
        if (current) parts.push(current);
        current = '';
        i++;
      } else if (path[i] === '[') {
        if (current) parts.push(current);
        current = '';
        let bracketContent = '';
        i++; // skip [
        while (i < path.length && path[i] !== ']') {
          bracketContent += path[i];
          i++;
        }
        parts.push(`[${bracketContent}]`);
        i++; // skip ]
      } else {
        current += path[i];
        i++;
      }
    }
    if (current) parts.push(current);
    
    // Build up paths and expand each
    let buildPath = '';
    for (let j = 0; j < parts.length - 1; j++) {
      const part = parts[j];
      if (part.startsWith('[')) {
        buildPath += part;
      } else {
        buildPath = buildPath ? `${buildPath}.${part}` : part;
      }
      
      // Find the toggle for this path and expand it
      const row = document.querySelector(`.json-row[data-path="${CSS.escape(buildPath)}"]`);
      if (row) {
        const toggle = row.querySelector('.toggle');
        if (toggle && row.classList.contains('collapsed')) {
          toggle.click();
        }
      }
    }
  }

  function clearSearch() {
    searchInput.value = '';
    searchResults.innerHTML = '';
    searchClear?.classList.remove('visible');
    document.querySelectorAll('.json-row.search-match').forEach(el => el.classList.remove('search-match'));
    searchMatches = [];
    currentMatchIndex = -1;
    document.getElementById('search-nav')?.classList.remove('visible');
    // Focus the search input so user can type immediately
    searchInput.focus();
  }

  // ============================================
  // DIFF
  // ============================================
  function performDiff() {
    const inp = diffInput.value.trim();
    if (!inp) { showToast('Paste JSON to compare'); return; }
    
    let cmp;
    try { cmp = JSON.parse(inp); } catch (e) { showToast('Invalid JSON: ' + e.message); return; }
    
    const d = { added: [], removed: [], changed: [] };
    
    function compare(a, b, p) {
      const t1 = getType(a), t2 = getType(b);
      if (t1 !== t2) { d.changed.push({ path: p, from: a, to: b }); return; }
      
      if (t1 === 'object' && !Array.isArray(a)) {
        const k1 = Object.keys(a || {}), k2 = Object.keys(b || {});
        const all = new Set([...k1, ...k2]);
        all.forEach(k => {
          const np = p ? p + '.' + k : k;
          if (!(k in a)) d.added.push({ path: np, value: b[k] });
          else if (!(k in b)) d.removed.push({ path: np, value: a[k] });
          else compare(a[k], b[k], np);
        });
      } else if (Array.isArray(a)) {
        const mx = Math.max(a.length, b.length);
        for (let i = 0; i < mx; i++) {
          const np = `${p}[${i}]`;
          if (i >= a.length) d.added.push({ path: np, value: b[i] });
          else if (i >= b.length) d.removed.push({ path: np, value: a[i] });
          else compare(a[i], b[i], np);
        }
      } else if (a !== b) {
        d.changed.push({ path: p || 'root', from: a, to: b });
      }
    }
    
    compare(jsonData, cmp, '');
    
    const tot = d.added.length + d.removed.length + d.changed.length;
    let h = `<div class="diff-summary">
      <span class="added">+ ${d.added.length} added</span>
      <span class="removed">− ${d.removed.length} removed</span>
      <span class="changed">~ ${d.changed.length} changed</span>
    </div>`;
    
    if (!tot) {
      h += '<div class="diff-identical">✓ Both JSON documents are identical</div>';
    } else {
      if (d.added.length) {
        h += '<div class="diff-section"><h4>Added</h4>';
        d.added.forEach(x => h += `<div class="diff-item added"><code>${x.path}</code>: ${escapeHtml(JSON.stringify(x.value).substring(0, 100))}</div>`);
        h += '</div>';
      }
      if (d.removed.length) {
        h += '<div class="diff-section"><h4>Removed</h4>';
        d.removed.forEach(x => h += `<div class="diff-item removed"><code>${x.path}</code>: ${escapeHtml(JSON.stringify(x.value).substring(0, 100))}</div>`);
        h += '</div>';
      }
      if (d.changed.length) {
        h += '<div class="diff-section"><h4>Changed</h4>';
        d.changed.forEach(x => h += `<div class="diff-item changed"><code>${x.path}</code>: <span class="from">${escapeHtml(JSON.stringify(x.from).substring(0, 50))}</span> → <span class="to">${escapeHtml(JSON.stringify(x.to).substring(0, 50))}</span></div>`);
        h += '</div>';
      }
    }
    
    diffResults.innerHTML = h;
  }

  // ============================================
  // EXPORT FUNCTIONS
  // ============================================
  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2)).then(() => showToast('✓ Copied Raw JSON'));
  }

  function copyMinified() {
    navigator.clipboard.writeText(JSON.stringify(jsonData)).then(() => showToast('✓ Copied Minified JSON'));
  }

  function copyFullAsCurl() {
    const value = JSON.stringify(jsonData);
    const curl = `curl -X POST -H "Content-Type: application/json" -d '${value.replace(/'/g, "'\\''")}' YOUR_URL_HERE`;
    navigator.clipboard.writeText(curl).then(() => showToast('✓ Copied as cURL'));
  }

  function copyFullAsJS() {
    const js = `const data = ${JSON.stringify(jsonData, null, 2)};`;
    navigator.clipboard.writeText(js).then(() => showToast('✓ Copied as JavaScript'));
  }

  function copyFullAsPython() {
    const py = `data = ${JSON.stringify(jsonData, null, 2).replace(/null/g, 'None').replace(/true/g, 'True').replace(/false/g, 'False')}`;
    navigator.clipboard.writeText(py).then(() => showToast('✓ Copied as Python'));
  }

  function copyFullAsTypeScript() {
    const iface = generateTypeScriptInterface(jsonData, 'RootObject');
    navigator.clipboard.writeText(iface).then(() => showToast('✓ Copied TypeScript Interface'));
  }

  function exportJSON() {
    downloadFile(JSON.stringify(jsonData, null, 2), 'export_json.json', 'application/json');
  }

  function exportMinifiedJSON() {
    downloadFile(JSON.stringify(jsonData), 'export_min.json', 'application/json');
  }

  function copyCurrentPath() {
    const p = selectedPath || 'root';
    navigator.clipboard.writeText(p).then(() => showToast('✓ Copied path: ' + p));
  }

  function exportCSV() {
    // Find the best array to export
    let dataToExport = jsonData;
    
    // If the root is not an array, try to find an array inside
    if (!Array.isArray(dataToExport)) {
      dataToExport = findFirstArrayForExport(jsonData);
    }
    
    if (!dataToExport || !Array.isArray(dataToExport)) {
      // No array found - export as key-value pairs
      const rows = [['Key', 'Value', 'Type']];
      flattenObjectToCSVRows(jsonData, '', rows);
      const csvContent = rows.map(row => row.map(cell => escapeCSVCell(cell)).join(',')).join('\n');
      downloadFile(csvContent, 'export.csv', 'text/csv');
      return;
    }
    
    // Get all unique keys from array items (including nested keys with dot notation)
    const allKeys = new Set();
    dataToExport.forEach(item => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        collectFlatKeys(item, '', allKeys);
      }
    });
    
    const keys = Array.from(allKeys);
    
    if (keys.length === 0) {
      // Simple array of primitives
      const rows = [['#', 'Value']];
      dataToExport.forEach((item, index) => {
        rows.push([index, formatCSVValue(item)]);
      });
      const csvContent = rows.map(row => row.map(cell => escapeCSVCell(cell)).join(',')).join('\n');
      downloadFile(csvContent, 'export.csv', 'text/csv');
      return;
    }
    
    // Build CSV with flattened nested objects
    const rows = [];
    
    // Header row
    rows.push(['#', ...keys]);
    
    // Data rows
    dataToExport.forEach((item, index) => {
      const row = [index];
      keys.forEach(key => {
        const value = getNestedValue(item, key);
        row.push(formatCSVValue(value));
      });
      rows.push(row);
    });
    
    const csvContent = rows.map(row => row.map(cell => escapeCSVCell(cell)).join(',')).join('\n');
    downloadFile(csvContent, 'export.csv', 'text/csv');
  }
  
  function collectFlatKeys(obj, prefix, keysSet) {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively collect nested object keys
        collectFlatKeys(value, fullKey, keysSet);
      } else {
        keysSet.add(fullKey);
      }
    }
  }
  
  function getNestedValue(obj, path) {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return '';
      current = current[part];
    }
    return current;
  }
  
  function formatCSVValue(value) {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.join('; ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
  
  function escapeCSVCell(value) {
    const str = String(value);
    // If the value contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
  
  function flattenObjectToCSVRows(obj, prefix, rows) {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        flattenObjectToCSVRows(value, fullKey, rows);
      } else {
        const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
        rows.push([fullKey, formatCSVValue(value), type]);
      }
    }
  }

  function exportExcel() {
    // Find the best array to export (like table view does)
    let dataToExport = jsonData;
    
    // If the root is not an array, try to find an array inside
    if (!Array.isArray(dataToExport)) {
      dataToExport = findFirstArrayForExport(jsonData);
    }
    
    if (!dataToExport) {
      // No array found - export as key-value pairs
      const sheetData = [['Key', 'Value', 'Type']];
      flattenObjectToRows(jsonData, '', sheetData);
      const xlsx = createXlsx(sheetData);
      downloadBlob(xlsx, 'export_excel.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return;
    }
    
    // Convert array to tabular format
    const sheetData = [];
    
    // Get all unique keys from array items (including nested keys)
    const allKeys = new Set();
    dataToExport.forEach(item => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        collectKeys(item, '', allKeys);
      }
    });
    
    const keys = Array.from(allKeys);
    
    if (keys.length > 0) {
      // Header row
      sheetData.push(['#', ...keys]);
      
      // Data rows
      dataToExport.forEach((item, index) => {
        const row = [index];
        keys.forEach(key => {
          const value = getNestedValue(item, key);
          row.push(formatExcelValue(value));
        });
        sheetData.push(row);
      });
    } else {
      // Simple array of primitives
      sheetData.push(['#', 'Value']);
      dataToExport.forEach((item, index) => {
        sheetData.push([index, formatExcelValue(item)]);
      });
    }
    
    const xlsx = createXlsx(sheetData);
    downloadBlob(xlsx, 'export_excel.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  function findFirstArrayForExport(obj, maxDepth = 3, depth = 0) {
    if (depth > maxDepth) return null;
    if (Array.isArray(obj) && obj.length > 0) {
      return obj;
    }
    if (obj && typeof obj === 'object') {
      for (const value of Object.values(obj)) {
        const found = findFirstArrayForExport(value, maxDepth, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  function collectKeys(obj, prefix, keysSet, maxDepth = 2, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > maxDepth) return;
    
    Object.keys(obj).forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      
      if (value && typeof value === 'object' && !Array.isArray(value) && depth < maxDepth) {
        // Recurse into nested objects
        collectKeys(value, fullKey, keysSet, maxDepth, depth + 1);
      } else {
        keysSet.add(fullKey);
      }
    });
  }

  function getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  function formatExcelValue(value) {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (Array.isArray(value)) {
      // For arrays, show count or simple values
      if (value.length === 0) return '[]';
      if (value.every(v => typeof v !== 'object')) {
        return value.join(', ');
      }
      return `[${value.length} items]`;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  function flattenObjectToRows(obj, prefix, rows, maxDepth = 3, depth = 0) {
    if (depth > maxDepth || obj === null || obj === undefined) return;
    
    if (typeof obj !== 'object') {
      rows.push([prefix || 'value', obj, typeof obj]);
      return;
    }
    
    Object.entries(obj).forEach(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value === null || value === undefined) {
        rows.push([fullKey, '', 'null']);
      } else if (Array.isArray(value)) {
        rows.push([fullKey, `[${value.length} items]`, 'array']);
      } else if (typeof value === 'object') {
        flattenObjectToRows(value, fullKey, rows, maxDepth, depth + 1);
      } else {
        rows.push([fullKey, value, typeof value]);
      }
    });
  }

  function exportYAML() {
    const yaml = jsonToYaml(jsonData);
    downloadFile(yaml, 'export_yaml.yaml', 'text/yaml');
  }

  function jsonToYaml(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    if (obj === null) return 'null';
    if (typeof obj === 'boolean') return obj ? 'true' : 'false';
    if (typeof obj === 'number') return String(obj);
    if (typeof obj === 'string') {
      if (obj.includes('\n') || obj.includes(':') || obj.includes('#')) {
        return `"${obj.replace(/"/g, '\\"')}"`;
      }
      return obj;
    }
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      return '\n' + obj.map(item => `${spaces}- ${jsonToYaml(item, indent + 1).trimStart()}`).join('\n');
    }
    if (typeof obj === 'object') {
      const entries = Object.entries(obj);
      if (entries.length === 0) return '{}';
      return '\n' + entries.map(([k, v]) => {
        const value = jsonToYaml(v, indent + 1);
        if (typeof v === 'object' && v !== null) {
          return `${spaces}${k}:${value}`;
        }
        return `${spaces}${k}: ${value}`;
      }).join('\n');
    }
    return String(obj);
  }

  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✓ Exported ${filename}`);
  }

  // ============================================
  // CONTEXT MENU ACTIONS
  // ============================================
  function handleContextMenu(e) {
    const row = e.target.closest('.json-row');
    if (!row || !jsonContainer.contains(row)) return;

    e.preventDefault();
    selectRow(row);

    // Mark only the right-clicked row so the user can see what the
    // open context menu refers to. Always clear other rows first to
    // prevent multiple highlights from accumulating.
    document.querySelectorAll('.json-row.context-active').forEach(r => r.classList.remove('context-active'));
    row.classList.add('context-active');
    
    // ── Live preview text in the meta column for each item ──
    const setText = (id, txt) => { const el = document.getElementById(id); if (el) { el.textContent = txt; el.title = txt; } };
    const dotPath = selectedPath || 'root';
    setText('ctx-meta-path', dotPath);

    // Key preview ("email") — only show when this row has a string key
    const isArrayElement = /\[\d+\]$/.test(selectedPath || '');
    const showKey = !!selectedKey && !isArrayElement;
    setText('ctx-meta-key', showKey ? `"${selectedKey}"` : '—');

    // Value preview — truncated at 24 chars with ellipsis
    setText('ctx-meta-value', formatValuePreview(selectedValue, selectedType));

    // Submenu live previews
    setText('ctx-meta-dot', convertToDotPath(selectedPath));
    setText('ctx-meta-bracket', convertToBracket(selectedPath));
    setText('ctx-meta-pointer', convertToJSONPointer(selectedPath));
    setText('ctx-meta-jsonpath', convertToJSONPath(selectedPath));
    setText('ctx-meta-jq', convertToJQ(selectedPath));

    // Type badge: text + color class
    const typeBadge = document.getElementById('ctx-type-badge');
    if (typeBadge) {
      typeBadge.textContent = selectedType || '—';
      typeBadge.className = `badge t-${selectedType}`;
    }
    
    // Add key — context-aware label (sibling vs inside, key vs item)
    const addKeyOption = document.getElementById('ctx-add-key');
    const addKeyLabel = document.getElementById('ctx-add-key-label');
    if (addKeyOption && addKeyLabel) {
      const isContainer = selectedType === 'object' || selectedType === 'array';
      addKeyOption.style.display = 'flex';
      addKeyLabel.textContent = isContainer
        ? (selectedType === 'array' ? 'Add item inside' : 'Add key inside')
        : (isArrayElement ? 'Add item below' : 'Add key below');
    }

    // Delete — hidden at root; danger styling lives in the .ctx-item.danger class
    const deleteKeyOption = document.getElementById('ctx-delete-key');
    const deleteLabel = document.getElementById('ctx-delete-label');
    if (deleteKeyOption && deleteLabel) {
      if (!selectedPath || selectedPath === 'root') {
        deleteKeyOption.style.display = 'none';
      } else {
        deleteKeyOption.style.display = 'flex';
        deleteLabel.textContent = selectedType === 'object'
          ? 'Delete object'
          : selectedType === 'array'
            ? 'Delete array'
            : (isArrayElement ? 'Delete item' : 'Delete key');
      }
    }

    // Edit value — only for primitives
    const editOption = document.getElementById('ctx-edit');
    if (editOption) {
      editOption.style.display = (selectedType === 'object' || selectedType === 'array') ? 'none' : 'flex';
    }

    // Copy key — hide for array elements (no string key)
    const copyKey = document.getElementById('ctx-copy-key');
    if (copyKey) copyKey.style.display = showKey ? 'flex' : 'none';
    
    contextMenu.style.display = 'block';
    
    // Calculate position to keep menu within viewport
    const menuRect = contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Use clientX/clientY for viewport-relative calculations
    let posX = e.clientX;
    let posY = e.clientY;
    
    // Adjust horizontal position if menu goes off right edge
    if (posX + menuRect.width > viewportWidth) {
      posX = posX - menuRect.width;
    }
    
    // Adjust vertical position if menu goes off bottom edge
    if (posY + menuRect.height > viewportHeight) {
      posY = posY - menuRect.height;
    }
    
    // Ensure menu doesn't go off left or top edge
    posX = Math.max(5, posX);
    posY = Math.max(5, posY);
    
    // Use fixed positioning relative to viewport
    contextMenu.style.position = 'fixed';
    contextMenu.style.left = posX + 'px';
    contextMenu.style.top = posY + 'px';

    // If there's not enough room to the right of the menu for the 200px
    // submenu, flip it to the left side.
    const subAnchor = contextMenu.querySelector('.ctx-sub-anchor');
    if (subAnchor) {
      const SUB_WIDTH = 206; // 200 + 6 gap
      const fitsRight = (posX + contextMenu.offsetWidth + SUB_WIDTH) <= viewportWidth;
      subAnchor.classList.toggle('flip-left', !fitsRight);
    }
  }

  function hideContextMenu() {
    contextMenu.style.display = 'none';
    document.querySelectorAll('.json-row.context-active').forEach(r => r.classList.remove('context-active'));
  }

  function selectRow(row) {
    // Clear both focused and selected classes from all rows
    document.querySelectorAll('.json-row.focused').forEach(r => r.classList.remove('focused'));
    document.querySelectorAll('.json-row.selected').forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');
    selectedRow = row;
    selectedPath = row.dataset.path || '';
    selectedKey = row.dataset.key || '';
    selectedType = row.dataset.type || '';
    selectedValue = getValueAtPath(jsonData, selectedPath);
    updateBreadcrumb(selectedPath);
  }

  function copyAsCurl() {
    hideContextMenu();
    const value = typeof selectedValue === 'object' ? JSON.stringify(selectedValue) : String(selectedValue);
    const curl = `curl -X POST -H "Content-Type: application/json" -d '${value.replace(/'/g, "'\\''")}' YOUR_URL_HERE`;
    navigator.clipboard.writeText(curl).then(() => showToast('Copied as cURL'));
  }

  function copyAsJS() {
    hideContextMenu();
    const js = `const data = ${JSON.stringify(selectedValue, null, 2)};`;
    navigator.clipboard.writeText(js).then(() => showToast('Copied as JavaScript'));
  }

  function copyAsPython() {
    hideContextMenu();
    const py = `data = ${JSON.stringify(selectedValue, null, 2).replace(/null/g, 'None').replace(/true/g, 'True').replace(/false/g, 'False')}`;
    navigator.clipboard.writeText(py).then(() => showToast('Copied as Python'));
  }

  function copyAsTypeScript() {
    hideContextMenu();
    const ts = generateTypeScriptInterface(selectedValue, 'Data');
    navigator.clipboard.writeText(ts).then(() => showToast('Copied TypeScript interface'));
  }

  function generateTypeScriptInterface(obj, name) {
    if (obj === null) return `type ${name} = null;`;
    if (typeof obj !== 'object') return `type ${name} = ${typeof obj};`;
    
    if (Array.isArray(obj)) {
      if (obj.length === 0) return `type ${name} = any[];`;
      const itemType = typeof obj[0] === 'object' ? `${name}Item` : typeof obj[0];
      let result = `type ${name} = ${itemType}[];`;
      if (typeof obj[0] === 'object' && obj[0] !== null) {
        result += '\n\n' + generateTypeScriptInterface(obj[0], `${name}Item`);
      }
      return result;
    }
    
    let result = `interface ${name} {\n`;
    for (const [key, value] of Object.entries(obj)) {
      const type = value === null ? 'null' : Array.isArray(value) ? 'any[]' : typeof value;
      result += `  ${key}: ${type};\n`;
    }
    result += '}';
    return result;
  }

  function searchGoogle() {
    hideContextMenu();
    // Prefer value over key for search
    const query = selectedValue !== null && selectedValue !== undefined ? String(selectedValue) : selectedKey;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
  }

  function highlightMatchingKeys() {
    hideContextMenu();
    if (!selectedKey) return;
    
    document.querySelectorAll('.json-row').forEach(row => {
      row.classList.remove('highlight-match');
      if (row.dataset.key === selectedKey) {
        row.classList.add('highlight-match');
      }
    });
    showToast(`Highlighted all "${selectedKey}" keys`);
    
    // Add listeners to clear highlights on click away or escape
    const clearHighlights = () => {
      document.querySelectorAll('.json-row.highlight-match').forEach(row => {
        row.classList.remove('highlight-match');
      });
      document.removeEventListener('click', onClickAway);
      document.removeEventListener('keydown', onEscape);
    };
    
    const onClickAway = (e) => {
      // Check if click is not on a highlighted row
      if (!e.target.closest('.json-row.highlight-match')) {
        clearHighlights();
      }
    };
    
    const onEscape = (e) => {
      if (e.key === 'Escape') {
        clearHighlights();
      }
    };
    
    // Use setTimeout to avoid immediate trigger from current click
    setTimeout(() => {
      document.addEventListener('click', onClickAway);
      document.addEventListener('keydown', onEscape);
    }, 100);
  }

  function filterByKey() {
    hideContextMenu();
    if (!selectedKey) return;
    searchInput.value = selectedKey;
    // Show clear button since there's now text in the input
    searchClear?.classList.add('visible');
    performSearch();
  }

  function showDataType() {
    hideContextMenu();
    showToast(`Type: ${selectedType}`);
  }

  // ============================================
  // COPY COMPLETE OBJECT/ARRAY
  // ============================================
  // "Copy entry" — emits `"key": value` for object members,
  // bare `value` for array elements, and the full JSON for root.
  function copyComplete() {
    hideContextMenu();

    let valueToCopy;
    if (!selectedPath || selectedPath === 'root') {
      valueToCopy = jsonData;
    } else {
      valueToCopy = getValueAtPath(jsonData, selectedPath);
    }
    if (valueToCopy === undefined) { showToast('Nothing to copy'); return; }

    const isArrayElement = /\[\d+\]$/.test(selectedPath || '');
    const isRoot = !selectedPath || selectedPath === 'root';
    const valueText = JSON.stringify(valueToCopy, null, 2);

    let copyText;
    if (isRoot) copyText = valueText;
    else if (isArrayElement) copyText = valueText;
    else if (selectedKey) copyText = `"${selectedKey}": ${valueText}`;
    else copyText = valueText;

    navigator.clipboard.writeText(copyText).then(() => showToast('Copied entry'));
  }

  // ============================================
  // COPY PATH AS DIFFERENT FORMATS
  // ============================================
  function copyPathAs(format) {
    hideContextMenu();
    const path = selectedPath || 'root';
    let formattedPath = '';
    let label = format;

    switch (format) {
      case 'dot': formattedPath = convertToDotPath(path); label = 'dot notation'; break;
      case 'bracket': formattedPath = convertToBracket(path); label = 'bracket'; break;
      case 'pointer': formattedPath = convertToJSONPointer(path); label = 'JSON Pointer'; break;
      case 'jsonpath': formattedPath = convertToJSONPath(path); label = 'JSONPath'; break;
      case 'jq': formattedPath = convertToJQ(path); label = 'jq filter'; break;
      case 'javascript': formattedPath = convertToJavaScript(path); label = 'JavaScript'; break;
      case 'python': formattedPath = convertToPython(path); label = 'Python'; break;
      default: formattedPath = path;
    }

    navigator.clipboard.writeText(formattedPath).then(() => {
      showToast(`Copied ${label}`);
    });
  }

  function convertToDotPath(path) {
    if (!path || path === 'root') return '';
    return path;
  }

  function convertToBracket(path) {
    if (!path || path === 'root') return '';
    const parts = parsePath(path);
    return parts.map(p => p.type === 'index' ? `[${p.value}]` : `["${p.value}"]`).join('');
  }

  function convertToJSONPointer(path) {
    if (!path || path === 'root') return '/';
    const parts = parsePath(path);
    // RFC 6901: escape ~ → ~0 and / → ~1
    return '/' + parts.map(p => {
      const v = String(p.value);
      return v.replace(/~/g, '~0').replace(/\//g, '~1');
    }).join('/');
  }

  function convertToJSONPath(path) {
    if (!path || path === 'root') return '$';
    return '$.' + path;
  }

  function convertToJQ(path) {
    if (!path || path === 'root') return '.';
    return '.' + path;
  }
  
  function convertToJavaScript(path) {
    if (!path || path === 'root') return 'data';
    // Convert to safe optional chaining
    const parts = parsePath(path);
    let result = 'data';
    for (const part of parts) {
      if (part.type === 'index') {
        result += `?.[${part.value}]`;
      } else {
        result += `?.['${part.value}']`;
      }
    }
    return result;
  }
  
  function convertToPython(path) {
    if (!path || path === 'root') return 'data';
    // Convert to safe .get() chain
    const parts = parsePath(path);
    let result = 'data';
    for (const part of parts) {
      if (part.type === 'index') {
        result += `[${part.value}]`;
      } else {
        result = `${result}.get('${part.value}', {})`;
      }
    }
    // Remove trailing .get('...', {}) for the last item - we want the value not {}
    // Actually keep as is for safety, user can adjust
    return result;
  }
  
  function parsePath(path) {
    const parts = [];
    let i = 0;
    let current = '';
    
    while (i < path.length) {
      if (path[i] === '.') {
        if (current) {
          parts.push({ type: 'key', value: current });
          current = '';
        }
        i++;
      } else if (path[i] === '[') {
        if (current) {
          parts.push({ type: 'key', value: current });
          current = '';
        }
        i++; // skip [
        let indexStr = '';
        while (i < path.length && path[i] !== ']') {
          indexStr += path[i];
          i++;
        }
        parts.push({ type: 'index', value: parseInt(indexStr) });
        i++; // skip ]
      } else {
        current += path[i];
        i++;
      }
    }
    if (current) {
      parts.push({ type: 'key', value: current });
    }
    return parts;
  }

  // ============================================
  // ADD / DELETE KEY
  // ============================================
  // Store target for add key operation
  let addKeyTargetPath = null;
  let addKeyTargetIsArray = false;
  let addKeyAfterKey = null; // Key to insert after (for sibling insertion)
  let newlyAddedPath = null; // Track newly added item for highlighting
  
  function openAddKeyModal() {
    hideContextMenu();
    
    // Use the already-selected values from context menu
    // selectedPath and selectedValue are already set by selectRow() when context menu opened
    
    const isContainer = selectedType === 'object' || selectedType === 'array';
    
    if (isContainer) {
      // Adding inside this object/array
      addKeyTargetPath = selectedPath || 'root';
      addKeyAfterKey = null; // Add at end
    } else {
      // Adding as sibling - need to find parent
      const lastDot = selectedPath.lastIndexOf('.');
      const lastBracket = selectedPath.lastIndexOf('[');
      const splitPoint = Math.max(lastDot, lastBracket);
      
      if (splitPoint === -1) {
        // Top-level key, parent is root
        addKeyTargetPath = 'root';
        addKeyAfterKey = selectedPath;
      } else if (lastBracket > lastDot) {
        // Parent is array
        addKeyTargetPath = selectedPath.substring(0, lastBracket);
        addKeyAfterKey = parseInt(selectedPath.substring(lastBracket + 1, selectedPath.length - 1));
      } else {
        // Parent is object
        addKeyTargetPath = selectedPath.substring(0, lastDot);
        addKeyAfterKey = selectedPath.substring(lastDot + 1);
      }
    }
    
    // Get the parent value
    const targetValue = addKeyTargetPath === 'root' ? jsonData : getValueAtPath(jsonData, addKeyTargetPath);
    
    // Check if parent is object or array
    addKeyTargetIsArray = Array.isArray(targetValue);
    const isObject = typeof targetValue === 'object' && targetValue !== null && !addKeyTargetIsArray;
    
    if (!addKeyTargetIsArray && !isObject) {
      showToast('Cannot add key here');
      return;
    }
    
    const addKeyModal = document.getElementById('add-key-modal');
    const keyNameInput = document.getElementById('add-key-name');
    const keyTypeSelect = document.getElementById('add-key-type');
    
    if (!addKeyModal || !keyNameInput || !keyTypeSelect) {
      showToast('Error: Modal elements not found');
      return;
    }
    
    // Reset inputs
    keyNameInput.value = '';
    keyTypeSelect.value = 'string';
    
    // Reset all value inputs
    document.querySelectorAll('.add-key-value-input').forEach(input => {
      if (input.tagName === 'INPUT' && !input.disabled) {
        input.value = '';
      }
    });
    
    // Show only string input by default
    updateValueInputForType('string');
    
    // Update modal title based on type
    const modalTitle = addKeyModal.querySelector('.modal-header h3');
    if (modalTitle) {
      modalTitle.textContent = addKeyTargetIsArray ? 'Add New Item' : 'Add New Key';
    }
    
    // If adding to array, disable key name
    if (addKeyTargetIsArray) {
      keyNameInput.value = '[new index]';
      keyNameInput.disabled = true;
    } else {
      keyNameInput.disabled = false;
    }
    
    // Show the modal
    addKeyModal.style.display = 'flex';
    
    // Focus appropriate input
    setTimeout(() => {
      if (!addKeyTargetIsArray) {
        keyNameInput.focus();
      } else {
        document.getElementById('add-key-value-string')?.focus();
      }
    }, 50);
  }
  
  function updateValueInputForType(type) {
    const valueLabel = document.getElementById('add-key-value-label');
    
    // Hide all value inputs
    document.querySelectorAll('.add-key-value-input').forEach(input => {
      input.style.display = 'none';
    });
    
    // Show the appropriate input based on type
    switch (type) {
      case 'string':
        document.getElementById('add-key-value-string').style.display = 'block';
        valueLabel.style.display = 'block';
        break;
      case 'number':
        document.getElementById('add-key-value-number').style.display = 'block';
        valueLabel.style.display = 'block';
        break;
      case 'boolean':
        document.getElementById('add-key-value-boolean').style.display = 'block';
        valueLabel.style.display = 'block';
        break;
      case 'null':
        document.getElementById('add-key-value-null').style.display = 'block';
        valueLabel.style.display = 'block';
        break;
      case 'object':
        document.getElementById('add-key-value-object').style.display = 'block';
        valueLabel.style.display = 'block';
        break;
      case 'array':
        document.getElementById('add-key-value-array').style.display = 'block';
        valueLabel.style.display = 'block';
        break;
    }
  }
  
  function hideAddKeyModal() {
    document.getElementById('add-key-modal').style.display = 'none';
  }
  
  function confirmAddKey() {
    const keyName = document.getElementById('add-key-name').value.trim();
    const keyType = document.getElementById('add-key-type').value;
    
    // Validate - only need key name for objects
    if (!addKeyTargetIsArray && !keyName) {
      showToast('Please enter a key name');
      return;
    }
    
    // Get value from the appropriate input based on type
    let parsedValue;
    switch (keyType) {
      case 'string':
        parsedValue = document.getElementById('add-key-value-string').value;
        break;
      case 'number':
        const numVal = document.getElementById('add-key-value-number').value;
        parsedValue = numVal === '' ? 0 : parseFloat(numVal);
        break;
      case 'boolean':
        parsedValue = document.getElementById('add-key-value-boolean').value === 'true';
        break;
      case 'null':
        parsedValue = null;
        break;
      case 'object':
        parsedValue = {};
        break;
      case 'array':
        parsedValue = [];
        break;
      default:
        parsedValue = '';
    }
    
    // Save state for undo
    saveUndoState();
    
    // Get parent object/array using stored path
    let parentValue;
    if (!addKeyTargetPath || addKeyTargetPath === 'root') {
      parentValue = jsonData;
    } else {
      parentValue = getValueAtPath(jsonData, addKeyTargetPath);
    }
    
    if (parentValue === undefined || parentValue === null) {
      showToast('Error: Could not find target location');
      hideAddKeyModal();
      return;
    }
    
    // Calculate the path of the newly added item
    let newPath;
    
    if (Array.isArray(parentValue)) {
      let insertIndex;
      if (addKeyAfterKey !== null && typeof addKeyAfterKey === 'number') {
        // Insert after specific index
        insertIndex = addKeyAfterKey + 1;
        parentValue.splice(insertIndex, 0, parsedValue);
      } else {
        // Add at end
        insertIndex = parentValue.length;
        parentValue.push(parsedValue);
      }
      // Build the new path
      newPath = addKeyTargetPath === 'root' 
        ? `[${insertIndex}]` 
        : `${addKeyTargetPath}[${insertIndex}]`;
      showToast('Added new item');
    } else if (typeof parentValue === 'object') {
      if (addKeyAfterKey !== null) {
        // Insert after specific key - need to rebuild object to maintain order
        const newObj = {};
        let inserted = false;
        for (const k of Object.keys(parentValue)) {
          newObj[k] = parentValue[k];
          if (k === addKeyAfterKey) {
            newObj[keyName] = parsedValue;
            inserted = true;
          }
        }
        // If key wasn't found (shouldn't happen), add at end
        if (!inserted) {
          newObj[keyName] = parsedValue;
        }
        // Replace parent contents
        for (const k of Object.keys(parentValue)) {
          delete parentValue[k];
        }
        for (const k of Object.keys(newObj)) {
          parentValue[k] = newObj[k];
        }
      } else {
        // Add at end
        parentValue[keyName] = parsedValue;
      }
      // Build the new path
      newPath = addKeyTargetPath === 'root' 
        ? keyName 
        : `${addKeyTargetPath}.${keyName}`;
      showToast(`Added key "${keyName}"`);
    } else {
      showToast('Cannot add key to this value');
      hideAddKeyModal();
      return;
    }
    
    // Store the newly added path for highlighting
    newlyAddedPath = newPath;
    
    hideAddKeyModal();
    renderJsonPreserveState();
    updateUndoRedoButtons();
    
    // Highlight the newly added row
    highlightNewlyAdded(newPath);
  }
  
  function highlightNewlyAdded(path) {
    // Find the row with this path and highlight it
    const row = document.querySelector(`.json-row[data-path="${CSS.escape(path)}"]`);
    if (row) {
      row.classList.add('newly-added');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Set up click-away and escape listeners to remove highlight
      const removeHighlight = () => {
        row.classList.remove('newly-added');
        document.removeEventListener('click', clickHandler);
        document.removeEventListener('keydown', escHandler);
      };
      
      const clickHandler = (e) => {
        // Only remove if clicking outside the highlighted row
        if (!row.contains(e.target)) {
          removeHighlight();
        }
      };
      
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          removeHighlight();
        }
      };
      
      // Delay adding listeners to avoid immediate trigger
      setTimeout(() => {
        document.addEventListener('click', clickHandler);
        document.addEventListener('keydown', escHandler);
      }, 100);
    }
  }

  function openDeleteKeyModal() {
    hideContextMenu();
    
    if (!selectedPath || selectedPath === 'root') {
      showToast('Cannot delete root');
      return;
    }
    
    const deleteModal = document.getElementById('delete-key-modal');
    const deletePreview = document.getElementById('delete-preview');
    const modalTitle = deleteModal.querySelector('.modal-header h3');
    
    // Update title based on what we're deleting
    if (modalTitle) {
      if (selectedType === 'object') {
        modalTitle.textContent = 'Delete Object';
      } else if (selectedType === 'array') {
        modalTitle.textContent = 'Delete Array';
      } else {
        modalTitle.textContent = 'Delete Key';
      }
    }
    
    // Show preview of what will be deleted
    let previewValue;
    if (typeof selectedValue === 'object') {
      if (Array.isArray(selectedValue)) {
        previewValue = `Array [${selectedValue.length} items]`;
      } else if (selectedValue === null) {
        previewValue = 'null';
      } else {
        previewValue = `Object {${Object.keys(selectedValue).length} keys}`;
      }
    } else {
      previewValue = JSON.stringify(selectedValue);
    }
    
    deletePreview.innerHTML = `<strong>${selectedKey}</strong>: ${previewValue}`;
    
    deleteModal.style.display = 'flex';
  }
  
  function hideDeleteKeyModal() {
    document.getElementById('delete-key-modal').style.display = 'none';
  }
  
  function confirmDeleteKey() {
    if (!selectedPath || selectedPath === 'root') return;
    
    // Save state for undo
    saveUndoState();
    
    // Find parent path and key
    const lastDot = selectedPath.lastIndexOf('.');
    const lastBracket = selectedPath.lastIndexOf('[');
    const splitPoint = Math.max(lastDot, lastBracket);
    
    let parentPath, keyToDelete;
    
    if (splitPoint === -1) {
      // Top-level key
      parentPath = '';
      keyToDelete = selectedPath;
    } else if (lastBracket > lastDot) {
      // Array index
      parentPath = selectedPath.substring(0, lastBracket);
      keyToDelete = parseInt(selectedPath.substring(lastBracket + 1, selectedPath.length - 1));
    } else {
      // Object key
      parentPath = selectedPath.substring(0, lastDot);
      keyToDelete = selectedPath.substring(lastDot + 1);
    }
    
    const parent = parentPath ? getValueAtPath(jsonData, parentPath) : jsonData;
    
    if (Array.isArray(parent)) {
      parent.splice(keyToDelete, 1);
      showToast('Deleted array item');
    } else if (typeof parent === 'object' && parent !== null) {
      delete parent[keyToDelete];
      showToast(`Deleted key "${keyToDelete}"`);
    }
    
    hideDeleteKeyModal();
    renderJsonPreserveState();
    updateUndoRedoButtons();
  }

  // ============================================
  // TYPESCRIPT INTERFACE GENERATOR
  // ============================================
  function generateTypeScriptInterfaces(data, rootName = 'Root') {
    const interfaces = [];
    const usedNames = new Set();
    
    function getUniqueName(baseName) {
      if (!baseName) baseName = 'Unknown';
      // Ensure valid name
      let name = baseName.charAt(0).toUpperCase() + baseName.slice(1);
      name = name.replace(/[^a-zA-Z0-9]/g, '');
      if (!name) name = 'Unknown';
      
      let uniqueName = name;
      let counter = 1;
      while (usedNames.has(uniqueName)) {
        uniqueName = `${name}${counter}`;
        counter++;
      }
      usedNames.add(uniqueName);
      return uniqueName;
    }
    
    function inferType(value, suggestedName) {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      
      const jsType = typeof value;
      
      if (jsType === 'string') return 'string';
      if (jsType === 'number') return 'number';
      if (jsType === 'boolean') return 'boolean';
      
      if (Array.isArray(value)) {
        if (value.length === 0) return 'unknown[]';
        
        const firstItem = value[0];
        
        // If array of objects, create interface for the item type
        if (typeof firstItem === 'object' && firstItem !== null && !Array.isArray(firstItem)) {
          const itemInterfaceName = getUniqueName(suggestedName + 'Item');
          createInterface(firstItem, itemInterfaceName);
          return `${itemInterfaceName}[]`;
        }
        
        // Array of primitives or arrays
        const itemType = inferType(firstItem, suggestedName);
        return `${itemType}[]`;
      }
      
      if (jsType === 'object') {
        // Create a new interface for this object
        const interfaceName = getUniqueName(suggestedName);
        createInterface(value, interfaceName);
        return interfaceName;
      }
      
      return 'unknown';
    }
    
    function createInterface(obj, interfaceName) {
      const props = [];
      
      for (const [key, value] of Object.entries(obj)) {
        // Generate suggested name from key
        const suggestedName = key.charAt(0).toUpperCase() + key.slice(1).replace(/[^a-zA-Z0-9]/g, '');
        const propType = inferType(value, suggestedName);
        
        // Escape key if needed
        const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
        
        // Check if value could be null
        const isNullable = value === null;
        props.push(`  ${safeKey}: ${propType};`);
      }
      
      interfaces.push(`interface ${interfaceName} {\n${props.join('\n')}\n}`);
    }
    
    // Start processing
    if (Array.isArray(data)) {
      if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
        const itemName = getUniqueName('Item');
        createInterface(data[0], itemName);
        interfaces.push(`type ${rootName} = ${itemName}[];`);
      } else {
        const itemType = data.length > 0 ? inferType(data[0], 'Item') : 'unknown';
        interfaces.push(`type ${rootName} = ${itemType}[];`);
      }
    } else if (typeof data === 'object' && data !== null) {
      usedNames.add(rootName); // Reserve root name
      createInterface(data, rootName);
    } else {
      interfaces.push(`type ${rootName} = ${inferType(data, 'Value')};`);
    }
    
    // Return interfaces in correct order (dependencies first, root last)
    return interfaces.join('\n\n');
  }
  
  function exportTypeScript() {
    const tsCode = generateTypeScriptInterfaces(jsonData, 'Root');
    const header = '// Generated by NextJSON\n// TypeScript Interfaces\n\n';
    downloadFile(header + tsCode, 'types.ts', 'text/typescript');
    showToast('TypeScript interfaces exported');
  }

  // ============================================
  // UNDO / REDO
  // ============================================
  function saveUndoState() {
    // Deep clone current state
    const state = JSON.stringify(jsonData);
    undoStack.push(state);
    
    // Limit stack size
    if (undoStack.length > MAX_UNDO_HISTORY) {
      undoStack.shift();
    }
    
    // Clear redo stack when new change is made
    redoStack = [];
  }
  
  function undo() {
    if (undoStack.length === 0) {
      showToast('Nothing to undo');
      return;
    }
    
    // Save current state to redo stack
    redoStack.push(JSON.stringify(jsonData));
    
    // Restore previous state
    const previousState = undoStack.pop();
    jsonData = JSON.parse(previousState);
    
    renderJsonPreserveState();
    updateUndoRedoButtons();
    showToast('Undo');
  }
  
  function redo() {
    if (redoStack.length === 0) {
      showToast('Nothing to redo');
      return;
    }
    
    // Save current state to undo stack
    undoStack.push(JSON.stringify(jsonData));
    
    // Restore next state
    const nextState = redoStack.pop();
    jsonData = JSON.parse(nextState);
    
    renderJsonPreserveState();
    updateUndoRedoButtons();
    showToast('Redo');
  }
  
  function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const undoRedoGroup = document.getElementById('undo-redo-group');
    
    // Show/hide the group based on whether there's any history
    if (undoStack.length > 0 || redoStack.length > 0) {
      undoRedoGroup.style.display = 'flex';
    } else {
      undoRedoGroup.style.display = 'none';
    }
    
    // Enable/disable buttons
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  function getType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  function getPreview(value, type) {
    if (type === 'array') {
      if (value.length === 0) return '';
      const first = value[0];
      if (typeof first === 'object') return '';
      return escapeHtml(String(first).substring(0, 30));
    }
    return '';
  }

  function getValueAtPath(obj, path) {
    if (!path || path === 'root') return obj;
    
    const parts = path.match(/[^.\[\]]+|\[\d+\]/g) || [];
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      
      if (part.startsWith('[') && part.endsWith(']')) {
        const index = parseInt(part.slice(1, -1));
        current = current[index];
      } else {
        current = current[part];
      }
    }
    
    return current;
  }

  function setValueAtPath(obj, path, value) {
    if (!path || path === 'root') return;
    
    const parts = path.match(/[^.\[\]]+|\[\d+\]/g) || [];
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part.startsWith('[') && part.endsWith(']')) {
        current = current[parseInt(part.slice(1, -1))];
      } else {
        current = current[part];
      }
    }
    
    const lastPart = parts[parts.length - 1];
    if (lastPart.startsWith('[') && lastPart.endsWith(']')) {
      current[parseInt(lastPart.slice(1, -1))] = value;
    } else {
      current[lastPart] = value;
    }
  }

  function isUrl(str) {
    return typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'));
  }

  function expandTruncatedValue(valueSpan) {
    const truncatedText = valueSpan.querySelector('.truncated-text');
    const fullText = valueSpan.querySelector('.full-text');
    const indicator = valueSpan.querySelector('.truncated-indicator');
    const seeMoreBtn = valueSpan.querySelector('.see-more-btn');
    const seeLessBtn = valueSpan.querySelector('.see-less-btn');
    
    if (truncatedText && fullText) {
      truncatedText.style.display = 'none';
      if (indicator) indicator.style.display = 'none';
      if (seeMoreBtn) seeMoreBtn.style.display = 'none';
      fullText.style.display = 'inline';
      if (seeLessBtn) seeLessBtn.style.display = 'inline';
    }
  }

  function collapseTruncatedValue(valueSpan) {
    const truncatedText = valueSpan.querySelector('.truncated-text');
    const fullText = valueSpan.querySelector('.full-text');
    const indicator = valueSpan.querySelector('.truncated-indicator');
    const seeMoreBtn = valueSpan.querySelector('.see-more-btn');
    const seeLessBtn = valueSpan.querySelector('.see-less-btn');
    
    if (truncatedText && fullText) {
      truncatedText.style.display = 'inline';
      if (indicator) indicator.style.display = 'inline';
      if (seeMoreBtn) seeMoreBtn.style.display = 'inline';
      fullText.style.display = 'none';
      if (seeLessBtn) seeLessBtn.style.display = 'none';
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Walk old + new JSON in parallel and collect dot-paths whose values
  // differ. Used by the Edit JSON modal to know which subtrees to keep
  // expanded after save.
  function diffJsonPaths(oldVal, newVal, path = '', out = []) {
    if (oldVal === newVal) return out;
    const t = (v) => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
    const ta = t(oldVal), tb = t(newVal);
    if (ta !== tb) { out.push(path || 'root'); return out; }
    if (ta === 'object') {
      const a = oldVal || {}, b = newVal || {};
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      keys.forEach(k => {
        const np = path ? `${path}.${k}` : k;
        if (!(k in a) || !(k in b)) { out.push(np); return; }
        diffJsonPaths(a[k], b[k], np, out);
      });
    } else if (ta === 'array') {
      const max = Math.max(oldVal.length, newVal.length);
      for (let i = 0; i < max; i++) {
        const np = `${path}[${i}]`;
        if (i >= oldVal.length || i >= newVal.length) { out.push(np); continue; }
        diffJsonPaths(oldVal[i], newVal[i], np, out);
      }
    } else if (oldVal !== newVal) {
      out.push(path || 'root');
    }
    return out;
  }

  // Given a path like "user.profile.email" or "items[2].name", return all
  // its CUMULATIVE ancestor paths (including itself). For "user.email"
  // → ["user", "user.email"]. For "items[0].name" → ["items",
  // "items[0]", "items[0].name"].
  function ancestorsOf(path) {
    if (!path || path === 'root') return [];
    const out = [];
    let acc = '';
    let i = 0;
    while (i < path.length) {
      const ch = path[i];
      if (ch === '.') {
        if (acc && !acc.endsWith('.')) out.push(acc);
        acc += '.';
        i++;
      } else if (ch === '[') {
        if (acc && !acc.endsWith('.') && !acc.endsWith(']')) out.push(acc);
        let j = i;
        while (j < path.length && path[j] !== ']') j++;
        acc += path.slice(i, j + 1);
        i = j + 1;
      } else {
        acc += ch;
        i++;
      }
    }
    if (acc) out.push(acc);
    return out;
  }

  // Truncated literal preview for the context menu's meta column.
  // Strings keep their quotes (and escaping); objects/arrays serialize.
  function formatValuePreview(value, type) {
    let text;
    if (value === undefined) text = '';
    else if (type === 'string') text = JSON.stringify(value);
    else if (type === 'object' || type === 'array') {
      try { text = JSON.stringify(value); } catch (_) { text = ''; }
    } else {
      text = String(value);
    }
    const MAX = 24;
    if (text.length > MAX) text = text.slice(0, MAX) + '…';
    return text;
  }

  function debounce(fn, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }

  function handleDropdownAction(action) {
    switch(action) {
      case 'copy-json': copyJson(); break;
      case 'copy-minified': copyMinified(); break;
      case 'copy-path': copyCurrentPath(); break;
      case 'copy-curl': copyFullAsCurl(); break;
      case 'copy-js': copyFullAsJS(); break;
      case 'copy-python': copyFullAsPython(); break;
      case 'copy-typescript': copyFullAsTypeScript(); break;
      case 'export-json': exportJSON(); break;
      case 'export-minified': exportMinifiedJSON(); break;
      case 'export-csv': exportCSV(); break;
      case 'export-excel': exportExcel(); break;
      case 'export-yaml': exportYAML(); break;
      case 'export-typescript': exportTypeScript(); break;
    }
  }

  function hideDropdowns() {
    document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
  }

  function updateStats() {
    const count = countNodes(jsonData);
    if (stats) {
      stats.innerHTML = `<span class="stat">${count.total} nodes</span><span class="stat">${count.objects} objects</span><span class="stat">${count.arrays} arrays</span>`;
    }
    // Split Pro bottom status bar
    const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setText('stats-nodes', count.total.toLocaleString() + ' nodes');
    setText('stats-objects', count.objects.toLocaleString() + ' objects');
    setText('stats-arrays', count.arrays.toLocaleString() + ' arrays');
    setText('stats-depth', 'depth ' + count.depth);
    try {
      const formatted = JSON.stringify(jsonData, null, 2);
      const minified = JSON.stringify(jsonData);
      setText('stats-size', humanBytes(byteLength(formatted)));
      const fmtBadge = document.getElementById('copy-formatted-size');
      const minBadge = document.getElementById('copy-min-size');
      if (fmtBadge) fmtBadge.textContent = humanBytes(byteLength(formatted));
      if (minBadge) minBadge.textContent = humanBytes(byteLength(minified));
    } catch (_) {}
  }

  function byteLength(s) {
    return new Blob([s]).size;
  }

  function humanBytes(n) {
    if (!n && n !== 0) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }

  function countNodes(obj, counts = { total: 0, objects: 0, arrays: 0, depth: 0 }, depth = 0) {
    counts.total++;
    if (depth > counts.depth) counts.depth = depth;
    if (Array.isArray(obj)) {
      counts.arrays++;
      obj.forEach(item => countNodes(item, counts, depth + 1));
    } else if (obj !== null && typeof obj === 'object') {
      counts.objects++;
      Object.values(obj).forEach(val => countNodes(val, counts, depth + 1));
    }
    return counts;
  }

  function expandAll() {
    document.querySelectorAll('.json-row.expandable.collapsed').forEach(row => {
      row.classList.remove('collapsed');
      const children = row.nextElementSibling;
      const closingBracket = children?.nextElementSibling;
      if (children?.classList.contains('json-children')) {
        children.classList.remove('collapsed');
      }
      if (closingBracket?.classList.contains('bracket-close')) {
        closingBracket.classList.remove('collapsed');
      }
    });
    showToast('All expanded');
  }

  function collapseAll() {
    document.querySelectorAll('.json-row.expandable:not(.collapsed)').forEach(row => {
      row.classList.add('collapsed');
      const children = row.nextElementSibling;
      const closingBracket = children?.nextElementSibling;
      if (children?.classList.contains('json-children')) {
        children.classList.add('collapsed');
      }
      if (closingBracket?.classList.contains('bracket-close')) {
        closingBracket.classList.add('collapsed');
      }
    });
    showToast('All collapsed');
  }

  function applyZoom() {
    jsonOutput.style.fontSize = `${zoomLevel}%`;
    document.getElementById('zoom-label').textContent = `${zoomLevel}%`;
  }

  function updateBreadcrumb(path) {
    const breadcrumbContent = breadcrumbBar.querySelector('.breadcrumb-content');
    if (!breadcrumbContent) return;

    if (!path) {
      breadcrumbContent.innerHTML = '<span class="crumb-empty">$ — hover a node to track</span>';
      return;
    }

    const parts = path.split(/\.|\[/).filter(Boolean);
    let html = '<span class="breadcrumb-item" data-path="">$</span>';
    let currentPath = '';

    parts.forEach((part, i) => {
      const isIndex = part.endsWith(']');
      const cleanPart = part.replace(']', '');
      currentPath += isIndex ? `[${cleanPart}]` : (i === 0 ? cleanPart : `.${cleanPart}`);
      html += `<span class="breadcrumb-separator">›</span><span class="breadcrumb-item" data-path="${currentPath}">${cleanPart}</span>`;
    });

    breadcrumbContent.innerHTML = html;

    breadcrumbContent.querySelectorAll('.breadcrumb-item').forEach(item => {
      item.addEventListener('click', () => {
        const p = item.dataset.path;
        const row = document.querySelector(`.json-row[data-path="${p}"]`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          selectRow(row);
        }
      });
    });
  }

  function copyBreadcrumbPath() {
    const path = selectedPath || 'root';
    const copyBtn = document.getElementById('breadcrumb-copy');
    
    navigator.clipboard.writeText(path).then(() => {
      showToast('Path copied: ' + path);
      
      // Change icon to checkmark
      if (copyBtn) {
        const originalIcon = copyBtn.innerHTML;
        copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style="color: #86de74;"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>';
        copyBtn.classList.add('copied');
        
        // Revert back after 1.5 seconds
        setTimeout(() => {
          copyBtn.innerHTML = originalIcon;
          copyBtn.classList.remove('copied');
        }, 1500);
      }
    });
  }

  function showToast(message, type = '') {
    toast.textContent = message;
    toast.className = 'toast' + (type ? ' toast-' + type : '');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // Expose showToast globally for inline handlers
  window.showToast = showToast;

})();
