// CSV Viewer Frontend for Antigravity Side Panel
(function() {
  'use strict';

  // DOM Elements
  const fileInput = document.getElementById('fileInput');
  const openFileBtn = document.getElementById('openFileBtn');
  const askAgentBtn = document.getElementById('askAgentBtn');
  const fileBadge = document.getElementById('fileBadge');
  const badgeFileName = document.getElementById('badgeFileName');
  const badgeFileSize = document.getElementById('badgeFileSize');

  const subToolbar = document.getElementById('subToolbar');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const delimiterSelect = document.getElementById('delimiterSelect');
  const headerToggleBtn = document.getElementById('headerToggleBtn');
  const headerToggleText = document.getElementById('headerToggleText');
  const statsToggleBtn = document.getElementById('statsToggleBtn');
  const exportSelect = document.getElementById('exportSelect');

  const emptyState = document.getElementById('emptyState');
  const dropzone = document.getElementById('dropzone');
  const dropzonePickBtn = document.getElementById('dropzonePickBtn');
  const workspaceFilesSection = document.getElementById('workspaceFilesSection');
  const workspaceFileList = document.getElementById('workspaceFileList');

  const tableWrapper = document.getElementById('tableWrapper');
  const csvTable = document.getElementById('csvTable');
  const tableHead = document.getElementById('tableHead');
  const tableBody = document.getElementById('tableBody');

  const statsDrawer = document.getElementById('statsDrawer');
  const closeStatsBtn = document.getElementById('closeStatsBtn');
  const statsBody = document.getElementById('statsBody');

  const agentDrawer = document.getElementById('agentDrawer');
  const agentDrawerDocName = document.getElementById('agentDrawerDocName');
  const closeAgentBtn = document.getElementById('closeAgentBtn');
  const agentPromptInput = document.getElementById('agentPromptInput');
  const sendAgentPromptBtn = document.getElementById('sendAgentPromptBtn');

  const paginationBar = document.getElementById('paginationBar');
  const paginationInfo = document.getElementById('paginationInfo');
  const pageSizeSelect = document.getElementById('pageSizeSelect');
  const firstPageBtn = document.getElementById('firstPageBtn');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const pageInput = document.getElementById('pageInput');
  const totalPagesText = document.getElementById('totalPagesText');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const lastPageBtn = document.getElementById('lastPageBtn');

  const toastEl = document.getElementById('toast');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingMessage = document.getElementById('loadingMessage');

  // State
  let currentFilePath = null;
  let currentFileName = '';
  let currentFileSize = 0;
  let rawCsvText = '';

  let rawDataGrid = []; // Array of arrays
  let hasHeader = true;
  let headerNames = [];
  let columnTypes = []; // 'number' | 'date' | 'boolean' | 'string'
  let dataRows = []; // Array of row arrays (excluding header if hasHeader)

  let filteredRowIndices = []; // Indices into dataRows matching search
  let sortColIndex = null;
  let sortAscending = true;

  let currentPage = 1;
  let pageSize = 50;

  let activeDelimiter = 'auto';

  // ---------------------------------------------------------------------------
  // Utilities & Helpers
  // ---------------------------------------------------------------------------

  function showToast(msg, duration = 2500) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => {
      toastEl.classList.remove('show');
    }, duration);
  }

  function setLoading(visible, msg = 'Loading...') {
    if (!loadingOverlay) return;
    loadingMessage.textContent = msg;
    loadingOverlay.hidden = !visible;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  }

  function formatRelativeTime(mtimeMs) {
    if (!mtimeMs) return '';
    const diff = Math.floor((Date.now() - mtimeMs) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------------------------------------------------------------------------
  // Path & URL Extraction
  // ---------------------------------------------------------------------------

  function extractPathFromUrl(urlString) {
    if (!urlString || typeof urlString !== 'string') return null;
    try {
      const url = new URL(urlString, window.location.origin || 'http://localhost');
      let fileParam = url.searchParams.get('file') || url.searchParams.get('path');
      if (!fileParam && url.hash) {
        const hashPart = url.hash.replace(/^#\/?/, '');
        const hashQuery = hashPart.includes('?') ? hashPart.split('?')[1] : hashPart;
        const hashParams = new URLSearchParams(hashQuery);
        fileParam = hashParams.get('file') || hashParams.get('path');
      }
      if (!fileParam && urlString.includes('file=')) {
        const m = urlString.match(/[?&#]file=([^&#]+)/);
        if (m) fileParam = decodeURIComponent(m[1]);
      }
      if (!fileParam && urlString.includes('path=')) {
        const m = urlString.match(/[?&#]path=([^&#]+)/);
        if (m) fileParam = decodeURIComponent(m[1]);
      }
      if (fileParam) {
        fileParam = fileParam.trim();
        if ((fileParam.startsWith('"') && fileParam.endsWith('"')) ||
            (fileParam.startsWith("'") && fileParam.endsWith("'")) ||
            (fileParam.startsWith('`') && fileParam.endsWith('`'))) {
          fileParam = fileParam.slice(1, -1).trim();
        }
        return fileParam;
      }
    } catch (err) {
      console.debug('Failed to parse URL string', err);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Data Parsing & Type Inference
  // ---------------------------------------------------------------------------

  function inferType(values) {
    let nonNullCount = 0;
    let numCount = 0;
    let dateCount = 0;
    let boolCount = 0;

    for (const val of values) {
      if (val === null || val === undefined || String(val).trim() === '') continue;
      nonNullCount++;
      const s = String(val).trim();

      // Check Boolean
      if (/^(true|false|yes|no)$/i.test(s)) {
        boolCount++;
        continue;
      }

      // Check Number
      const cleanedNum = s.replace(/,/g, '');
      if (!isNaN(cleanedNum) && !isNaN(parseFloat(cleanedNum)) && isFinite(cleanedNum)) {
        numCount++;
        continue;
      }

      // Check Date
      if (s.length >= 8 && s.length <= 30 && !/^\d+$/.test(s)) {
        const d = Date.parse(s);
        if (!isNaN(d)) {
          dateCount++;
          continue;
        }
      }
    }

    if (nonNullCount === 0) return 'string';
    if (numCount / nonNullCount > 0.8) return 'number';
    if (boolCount / nonNullCount > 0.8) return 'boolean';
    if (dateCount / nonNullCount > 0.8) return 'date';
    return 'string';
  }

  function parseCsvData(text, forcedDelimiter = 'auto') {
    if (!text || typeof text !== 'string') return;
    rawCsvText = text;

    const parseOptions = {
      skipEmptyLines: 'greedy',
      fastMode: false,
    };

    if (forcedDelimiter && forcedDelimiter !== 'auto') {
      parseOptions.delimiter = forcedDelimiter;
    }

    const results = Papa.parse(text, parseOptions);
    if (!results || !results.data || results.data.length === 0) {
      showToast('No tabular data found in file');
      return;
    }

    rawDataGrid = results.data;
    const detectedDelim = results.meta?.delimiter;

    // Detect if first row looks like a header (mostly non-numeric strings)
    if (rawDataGrid.length > 1) {
      const firstRow = rawDataGrid[0];
      const secondRow = rawDataGrid[1];
      let row0Numeric = 0;
      let row1Numeric = 0;
      for (let i = 0; i < firstRow.length; i++) {
        if (!isNaN(parseFloat(String(firstRow[i]).trim()))) row0Numeric++;
        if (!isNaN(parseFloat(String(secondRow[i]).trim()))) row1Numeric++;
      }
      // If row 0 has fewer numbers than row 1, or row 0 is pure text, default hasHeader = true
      hasHeader = (row0Numeric < row1Numeric) || (row0Numeric === 0);
    } else {
      hasHeader = false;
    }

    applyHeaderAndProcess();

    // Update delimiter dropdown if auto-detected
    if (forcedDelimiter === 'auto' && detectedDelim) {
      const matchOpt = Array.from(delimiterSelect.options).find(o => o.value === detectedDelim);
      if (matchOpt) {
        delimiterSelect.value = detectedDelim;
      } else {
        delimiterSelect.value = 'auto';
      }
    }
  }

  function applyHeaderAndProcess() {
    if (rawDataGrid.length === 0) return;

    const maxCols = Math.max(...rawDataGrid.map(r => r.length));

    if (hasHeader && rawDataGrid.length > 0) {
      headerNames = [];
      const firstRow = rawDataGrid[0];
      for (let i = 0; i < maxCols; i++) {
        const val = firstRow[i];
        const name = (val !== undefined && String(val).trim() !== '')
          ? String(val).trim()
          : `Col ${i + 1}`;
        headerNames.push(name);
      }
      dataRows = rawDataGrid.slice(1);
    } else {
      headerNames = [];
      for (let i = 0; i < maxCols; i++) {
        headerNames.push(`Col ${i + 1}`);
      }
      dataRows = rawDataGrid.slice(0);
    }

    // Infer column types
    columnTypes = [];
    for (let c = 0; c < maxCols; c++) {
      const colValues = dataRows.map(r => r[c]);
      columnTypes.push(inferType(colValues));
    }

    headerToggleText.textContent = hasHeader ? 'Header: On' : 'Header: Off';

    // Reset sort and search
    sortColIndex = null;
    sortAscending = true;
    currentPage = 1;

    applyFilter();
    renderStats();
  }

  // ---------------------------------------------------------------------------
  // Filtering & Sorting
  // ---------------------------------------------------------------------------

  function applyFilter() {
    const q = (searchInput.value || '').trim().toLowerCase();
    clearSearchBtn.hidden = !q;

    if (!q) {
      filteredRowIndices = dataRows.map((_, i) => i);
    } else {
      filteredRowIndices = [];
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        let match = false;
        for (let j = 0; j < row.length; j++) {
          const val = row[j];
          if (val !== null && val !== undefined && String(val).toLowerCase().includes(q)) {
            match = true;
            break;
          }
        }
        if (match) filteredRowIndices.push(i);
      }
    }

    applySort();
  }

  function applySort() {
    if (sortColIndex !== null && sortColIndex >= 0) {
      const col = sortColIndex;
      const isNum = columnTypes[col] === 'number';
      const isDate = columnTypes[col] === 'date';

      filteredRowIndices.sort((a, b) => {
        let valA = dataRows[a][col];
        let valB = dataRows[b][col];

        if (valA === null || valA === undefined || valA === '') return 1;
        if (valB === null || valB === undefined || valB === '') return -1;

        if (isNum) {
          const nA = parseFloat(String(valA).replace(/,/g, ''));
          const nB = parseFloat(String(valB).replace(/,/g, ''));
          if (!isNaN(nA) && !isNaN(nB)) {
            return sortAscending ? nA - nB : nB - nA;
          }
        } else if (isDate) {
          const dA = Date.parse(valA);
          const dB = Date.parse(valB);
          if (!isNaN(dA) && !isNaN(dB)) {
            return sortAscending ? dA - dB : dB - dA;
          }
        }

        const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
        return sortAscending ? cmp : -cmp;
      });
    }

    currentPage = 1;
    renderTable();
  }

  // ---------------------------------------------------------------------------
  // Rendering Table & Pagination
  // ---------------------------------------------------------------------------

  function renderTable() {
    if (dataRows.length === 0 && rawDataGrid.length === 0) {
      emptyState.hidden = false;
      tableWrapper.hidden = true;
      subToolbar.hidden = true;
      paginationBar.hidden = true;
      fileBadge.hidden = true;
      return;
    }

    emptyState.hidden = true;
    tableWrapper.hidden = false;
    subToolbar.hidden = false;
    paginationBar.hidden = false;
    fileBadge.hidden = false;

    // Header rendering
    tableHead.innerHTML = '';
    const headRow = document.createElement('tr');

    // Sticky # column
    const indexTh = document.createElement('th');
    indexTh.className = 'row-index-col';
    indexTh.textContent = '#';
    headRow.appendChild(indexTh);

    headerNames.forEach((name, colIdx) => {
      const th = document.createElement('th');
      const sortActive = sortColIndex === colIdx;
      const sortChar = sortActive ? (sortAscending ? ' ▲' : ' ▼') : '';
      const type = columnTypes[colIdx] || 'string';

      th.innerHTML = `
        <div class="header-content">
          <span class="header-name">${escapeHtml(name)}</span>
          <div style="display:flex; align-items:center; gap:4px;">
            <span class="header-type-tag">${type}</span>
            <span class="sort-icon ${sortActive ? 'active' : ''}">${sortChar || '↕'}</span>
          </div>
        </div>
      `;

      th.addEventListener('click', () => {
        if (sortColIndex === colIdx) {
          if (sortAscending) {
            sortAscending = false;
          } else {
            sortColIndex = null;
            sortAscending = true;
          }
        } else {
          sortColIndex = colIdx;
          sortAscending = true;
        }
        applySort();
      });

      headRow.appendChild(th);
    });

    tableHead.appendChild(headRow);

    // Body rendering with pagination
    tableBody.innerHTML = '';

    const totalRows = filteredRowIndices.length;
    const effectivePageSize = pageSize === Infinity ? totalRows : pageSize;
    const totalPages = Math.max(1, Math.ceil(totalRows / (effectivePageSize || 1)));

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * effectivePageSize;
    const endIdx = Math.min(startIdx + effectivePageSize, totalRows);
    const visibleRowIndices = filteredRowIndices.slice(startIdx, endIdx);

    const q = (searchInput.value || '').trim().toLowerCase();

    const fragment = document.createDocumentFragment();

    visibleRowIndices.forEach((origRowIdx, idx) => {
      const row = dataRows[origRowIdx] || [];
      const tr = document.createElement('tr');

      // Row Index Cell
      const indexTd = document.createElement('td');
      indexTd.className = 'row-index-cell';
      indexTd.textContent = String(startIdx + idx + 1);
      tr.appendChild(indexTd);

      // Data Cells
      headerNames.forEach((_, colIdx) => {
        const td = document.createElement('td');
        const rawVal = row[colIdx];
        const isNum = columnTypes[colIdx] === 'number';

        if (isNum) td.classList.add('cell-num');

        if (rawVal === null || rawVal === undefined || String(rawVal).trim() === '') {
          td.classList.add('cell-empty');
          td.textContent = '—';
        } else {
          const valStr = String(rawVal);
          td.title = valStr; // Tooltip for full text

          if (q && valStr.toLowerCase().includes(q)) {
            // Highlight matching segment
            const lower = valStr.toLowerCase();
            const matchStart = lower.indexOf(q);
            const matchEnd = matchStart + q.length;

            const before = escapeHtml(valStr.slice(0, matchStart));
            const matchText = escapeHtml(valStr.slice(matchStart, matchEnd));
            const after = escapeHtml(valStr.slice(matchEnd));

            td.innerHTML = `${before}<mark class="highlight">${matchText}</mark>${after}`;
          } else {
            td.textContent = valStr;
          }
        }

        tr.appendChild(td);
      });

      fragment.appendChild(tr);
    });

    tableBody.appendChild(fragment);

    // Pagination info update
    const showingText = totalRows === 0
      ? 'No matching rows'
      : `Showing ${startIdx + 1}–${endIdx} of ${totalRows.toLocaleString()} rows (${headerNames.length} cols)`;
    paginationInfo.innerHTML = showingText;

    totalPagesText.textContent = String(totalPages);
    pageInput.value = String(currentPage);

    firstPageBtn.disabled = currentPage <= 1;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
    lastPageBtn.disabled = currentPage >= totalPages;
  }

  // ---------------------------------------------------------------------------
  // Statistics Drawer
  // ---------------------------------------------------------------------------

  function renderStats() {
    if (!statsBody) return;
    statsBody.innerHTML = '';

    const totalRows = dataRows.length;
    const totalCols = headerNames.length;

    // Overview card
    const overviewCard = document.createElement('div');
    overviewCard.className = 'stats-card';
    overviewCard.innerHTML = `
      <div class="stats-card-header">
        <span>Dataset Summary</span>
        <span style="font-size:10px; color:var(--muted-foreground);">${formatBytes(currentFileSize)}</span>
      </div>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">Total Rows</span>
          <span class="stat-value">${totalRows.toLocaleString()}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Columns</span>
          <span class="stat-value">${totalCols}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Header Row</span>
          <span class="stat-value">${hasHeader ? 'Detected' : 'None'}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Delimiter</span>
          <span class="stat-value">${activeDelimiter === 'auto' ? 'Auto-sniffed' : activeDelimiter}</span>
        </div>
      </div>
    `;
    statsBody.appendChild(overviewCard);

    // Per-column statistics
    headerNames.forEach((name, colIdx) => {
      const colValues = dataRows.map(r => r[colIdx]);
      const type = columnTypes[colIdx] || 'string';

      let nullCount = 0;
      let nonNullValues = [];
      const distinctSet = new Set();

      colValues.forEach(val => {
        if (val === null || val === undefined || String(val).trim() === '') {
          nullCount++;
        } else {
          nonNullValues.push(val);
          distinctSet.add(String(val).trim());
        }
      });

      const card = document.createElement('div');
      card.className = 'stats-card';

      let statsHtml = `
        <div class="stats-card-header">
          <span>${escapeHtml(name)}</span>
          <span class="header-type-tag">${type}</span>
        </div>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Distinct Values</span>
            <span class="stat-value">${distinctSet.size.toLocaleString()}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Missing / Null</span>
            <span class="stat-value">${nullCount} (${((nullCount / (totalRows || 1)) * 100).toFixed(0)}%)</span>
          </div>
      `;

      if (type === 'number' && nonNullValues.length > 0) {
        const nums = nonNullValues
          .map(v => parseFloat(String(v).replace(/,/g, '')))
          .filter(n => !isNaN(n));

        if (nums.length > 0) {
          const min = Math.min(...nums);
          const max = Math.max(...nums);
          const sum = nums.reduce((a, b) => a + b, 0);
          const avg = sum / nums.length;

          statsHtml += `
            <div class="stat-item">
              <span class="stat-label">Min</span>
              <span class="stat-value">${min.toLocaleString()}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Max</span>
              <span class="stat-value">${max.toLocaleString()}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Mean (Avg)</span>
              <span class="stat-value">${avg.toFixed(2)}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Sum</span>
              <span class="stat-value">${sum.toLocaleString()}</span>
            </div>
          `;
        }
      }

      statsHtml += `</div>`;
      card.innerHTML = statsHtml;
      statsBody.appendChild(card);
    });
  }

  // ---------------------------------------------------------------------------
  // Agent Integration
  // ---------------------------------------------------------------------------

  async function sendAgentMessage(userPrompt) {
    if (!userPrompt || !userPrompt.trim()) return;

    if (!window.sidecar || !window.sidecar.agent) {
      showToast('Agent messaging not available in standalone mode');
      return;
    }

    const sampleRows = dataRows.slice(0, 5).map(r => r.slice(0, 8));
    const headerSnippet = headerNames.slice(0, 8);

    // Build markdown table preview
    let previewMd = `| ${headerSnippet.join(' | ')} |\n| ${headerSnippet.map(() => '---').join(' | ')} |\n`;
    sampleRows.forEach(row => {
      previewMd += `| ${headerSnippet.map((_, i) => escapeHtml(row[i] ?? '')).join(' | ')} |\n`;
    });

    const datasetContext = `
[Dataset Context]
- File: ${currentFilePath || currentFileName || 'Untitled CSV'}
- Dimensions: ${dataRows.length.toLocaleString()} rows × ${headerNames.length} columns
- Columns: ${headerNames.join(', ')}

Sample preview (first ${sampleRows.length} rows):
${previewMd}
`;

    const fullMessage = `${userPrompt.trim()}\n\n${datasetContext}`;

    try {
      setLoading(true, 'Sending to Agent...');
      if (window.sidecar.conversationId) {
        await window.sidecar.agent.sendMessage(fullMessage);
        showToast('Prompt sent to Agent!');
      } else {
        await window.sidecar.agent.startConversation(fullMessage);
        showToast('Started new Agent conversation!');
      }
      agentDrawer.classList.remove('open');
      askAgentBtn.classList.remove('active');
    } catch (err) {
      console.error('Failed to send message to agent', err);
      showToast('Failed to contact agent: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Export & Copy Helpers
  // ---------------------------------------------------------------------------

  function handleExport(action) {
    if (!action || dataRows.length === 0) return;

    if (action === 'copy-csv') {
      const csvStr = Papa.unparse({
        fields: hasHeader ? headerNames : undefined,
        data: dataRows,
      });
      navigator.clipboard.writeText(csvStr)
        .then(() => showToast('Copied CSV to clipboard!'))
        .catch(() => showToast('Failed to copy to clipboard'));
    } else if (action === 'copy-json') {
      const jsonArr = dataRows.map(row => {
        const obj = {};
        headerNames.forEach((name, i) => {
          obj[name] = row[i];
        });
        return obj;
      });
      navigator.clipboard.writeText(JSON.stringify(jsonArr, null, 2))
        .then(() => showToast('Copied JSON to clipboard!'))
        .catch(() => showToast('Failed to copy to clipboard'));
    } else if (action === 'download-csv') {
      const csvStr = Papa.unparse({
        fields: hasHeader ? headerNames : undefined,
        data: dataRows,
      });
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (currentFileName || 'export').replace(/\.[^.]+$/, '') + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Downloaded CSV');
    } else if (action === 'download-json') {
      const jsonArr = dataRows.map(row => {
        const obj = {};
        headerNames.forEach((name, i) => {
          obj[name] = row[i];
        });
        return obj;
      });
      const blob = new Blob([JSON.stringify(jsonArr, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (currentFileName || 'export').replace(/\.[^.]+$/, '') + '.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Downloaded JSON');
    }

    exportSelect.value = '';
  }

  // ---------------------------------------------------------------------------
  // File Loading & Workspace Discovery
  // ---------------------------------------------------------------------------

  async function loadCsvByPath(filePath) {
    if (!filePath) return;
    setLoading(true, 'Loading CSV file...');

    try {
      let workspaceUris = [];
      if (window.sidecar && window.sidecar.getWorkspaceUris) {
        workspaceUris = await window.sidecar.getWorkspaceUris();
      }

      const res = await (window.sidecar ? window.sidecar.fetch : fetch)('/api/load-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, workspaceUris }),
      });

      const data = await res.json();
      if (!data.success) {
        showToast(data.error || 'Failed to load CSV');
        return;
      }

      currentFilePath = data.path;
      currentFileName = data.filename;
      currentFileSize = data.size;

      badgeFileName.textContent = currentFileName;
      badgeFileSize.textContent = formatBytes(currentFileSize);
      agentDrawerDocName.textContent = currentFileName;

      parseCsvData(data.content, activeDelimiter);

      // Save state
      if (window.sidecar && window.sidecar.fetch) {
        window.sidecar.fetch('/api/save-state', {
          method: 'POST',
          body: JSON.stringify({ lastOpenedPath: currentFilePath }),
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to load CSV', err);
      showToast('Error loading CSV: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadWorkspaceCsvs() {
    try {
      let workspaceUris = [];
      if (window.sidecar && window.sidecar.getWorkspaceUris) {
        workspaceUris = await window.sidecar.getWorkspaceUris();
      }

      const res = await (window.sidecar ? window.sidecar.fetch : fetch)('/api/workspace-csvs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceUris }),
      });

      const data = await res.json();
      const csvs = data.csvs || [];

      if (csvs.length > 0 && workspaceFileList) {
        workspaceFilesSection.hidden = false;
        workspaceFileList.innerHTML = '';
        csvs.slice(0, 8).forEach(item => {
          const div = document.createElement('div');
          div.className = 'file-item';
          div.innerHTML = `
            <span class="file-item-name" title="${escapeHtml(item.path)}">${escapeHtml(item.name)}</span>
            <span class="file-item-meta">${formatBytes(item.size)} · ${formatRelativeTime(item.mtime)}</span>
          `;
          div.addEventListener('click', () => loadCsvByPath(item.path));
          workspaceFileList.appendChild(div);
        });
      }
    } catch (err) {
      console.debug('Failed to load workspace CSVs', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Event Listeners & Setup
  // ---------------------------------------------------------------------------

  function setupEventListeners() {
    // Open file
    openFileBtn.addEventListener('click', () => fileInput.click());
    dropzonePickBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      currentFileName = file.name;
      currentFileSize = file.size;
      currentFilePath = file.name;

      badgeFileName.textContent = currentFileName;
      badgeFileSize.textContent = formatBytes(currentFileSize);
      agentDrawerDocName.textContent = currentFileName;

      setLoading(true, 'Reading file...');
      const reader = new FileReader();
      reader.onload = (ev) => {
        setLoading(false);
        parseCsvData(ev.target.result, activeDelimiter);
      };
      reader.onerror = () => {
        setLoading(false);
        showToast('Failed to read file');
      };
      reader.readAsText(file);
      fileInput.value = '';
    });

    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) {
        currentFileName = file.name;
        currentFileSize = file.size;
        currentFilePath = file.name;
        badgeFileName.textContent = currentFileName;
        badgeFileSize.textContent = formatBytes(currentFileSize);
        agentDrawerDocName.textContent = currentFileName;

        setLoading(true, 'Reading dropped file...');
        const reader = new FileReader();
        reader.onload = (ev) => {
          setLoading(false);
          parseCsvData(ev.target.result, activeDelimiter);
        };
        reader.readAsText(file);
      }
    });

    // Search
    let searchTimeout = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(applyFilter, 150);
    });
    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      applyFilter();
    });

    // Delimiter
    delimiterSelect.addEventListener('change', (e) => {
      activeDelimiter = e.target.value;
      if (rawCsvText) {
        parseCsvData(rawCsvText, activeDelimiter);
      }
    });

    // Header toggle
    headerToggleBtn.addEventListener('click', () => {
      hasHeader = !hasHeader;
      applyHeaderAndProcess();
    });

    // Stats toggle
    statsToggleBtn.addEventListener('click', () => {
      statsDrawer.classList.toggle('open');
      statsToggleBtn.classList.toggle('active', statsDrawer.classList.contains('open'));
    });
    closeStatsBtn.addEventListener('click', () => {
      statsDrawer.classList.remove('open');
      statsToggleBtn.classList.remove('active');
    });

    // Agent drawer
    askAgentBtn.addEventListener('click', () => {
      agentDrawer.classList.toggle('open');
      askAgentBtn.classList.toggle('active', agentDrawer.classList.contains('open'));
      if (agentDrawer.classList.contains('open')) {
        agentPromptInput.focus();
      }
    });
    closeAgentBtn.addEventListener('click', () => {
      agentDrawer.classList.remove('open');
      askAgentBtn.classList.remove('active');
    });

    // Prompt chips
    document.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        agentPromptInput.value = btn.getAttribute('data-prompt');
        agentPromptInput.focus();
      });
    });

    // Send Agent prompt
    sendAgentPromptBtn.addEventListener('click', () => {
      sendAgentMessage(agentPromptInput.value);
    });
    agentPromptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        sendAgentMessage(agentPromptInput.value);
      }
    });

    // Export dropdown
    exportSelect.addEventListener('change', (e) => {
      handleExport(e.target.value);
    });

    // Pagination controls
    pageSizeSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      pageSize = val === 'all' ? Infinity : parseInt(val, 10);
      currentPage = 1;
      renderTable();
    });

    firstPageBtn.addEventListener('click', () => {
      currentPage = 1;
      renderTable();
    });
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    });
    nextPageBtn.addEventListener('click', () => {
      const totalRows = filteredRowIndices.length;
      const totalPages = Math.ceil(totalRows / (pageSize === Infinity ? totalRows : pageSize));
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
      }
    });
    lastPageBtn.addEventListener('click', () => {
      const totalRows = filteredRowIndices.length;
      const totalPages = Math.ceil(totalRows / (pageSize === Infinity ? totalRows : pageSize));
      currentPage = totalPages;
      renderTable();
    });

    pageInput.addEventListener('change', () => {
      const val = parseInt(pageInput.value, 10);
      const totalRows = filteredRowIndices.length;
      const totalPages = Math.ceil(totalRows / (pageSize === Infinity ? totalRows : pageSize));
      if (!isNaN(val) && val >= 1 && val <= totalPages) {
        currentPage = val;
      }
      renderTable();
    });
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  async function init() {
    setupEventListeners();

    // Check URL parameters
    const fileParam = extractPathFromUrl(window.location.href);
    if (fileParam) {
      await loadCsvByPath(fileParam);
    } else {
      // Check last saved state
      try {
        const res = await (window.sidecar ? window.sidecar.fetch : fetch)('/api/get-state');
        const state = await res.json();
        if (state && state.lastOpenedPath) {
          await loadCsvByPath(state.lastOpenedPath);
        }
      } catch (err) {
        console.debug('No prior state found', err);
      }
    }

    // Discover workspace files
    await loadWorkspaceCsvs();

    // Listen to workspace changes
    if (window.sidecar && window.sidecar.onWorkspaceChange) {
      window.sidecar.onWorkspaceChange(() => {
        loadWorkspaceCsvs();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
