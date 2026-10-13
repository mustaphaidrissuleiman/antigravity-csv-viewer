import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Response, SidecarApp } from 'sidecar_sdk';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.ANTIGRAVITY_EXECUTABLE_DATA_DIR || join(HERE, '.data');
const STATE_FILE = join(DATA_DIR, 'state.json');

const app = new SidecarApp();

// ---------------------------------------------------------------------------
// Static Files & Serving Helpers
// ---------------------------------------------------------------------------

const readLocal = (name) => readFileSync(join(HERE, name), 'utf8');

const serveIndex = () => readLocal('index.html');
const serveAppJs = () => readLocal('app.js');
const serveStyles = () => new Response(readLocal('styles.css'), { contentType: 'text/css' });

let cachedPapaParse = null;
const servePapaParse = () => {
  if (!cachedPapaParse) cachedPapaParse = readLocal('lib/papaparse.min.js');
  return cachedPapaParse;
};

// Root & alternate entrypoints
app.page('/', serveIndex);
app.page('/index.html', serveIndex);
app.page('/open', serveIndex);
app.page('/viewer', serveIndex);
app.page('/panel', serveIndex);
app.page('/panel/', serveIndex);
app.page('/panel/index.html', serveIndex);

// App scripts & styles
app.page('/app.js', serveAppJs);
app.page('/panel/app.js', serveAppJs);

app.api('/styles.css', serveStyles, 'GET');
app.api('/panel/styles.css', serveStyles, 'GET');

// Vendored PapaParse
app.page('/lib/papaparse.min.js', servePapaParse);
app.page('/panel/lib/papaparse.min.js', servePapaParse);

// ---------------------------------------------------------------------------
// File Search & Path Resolution
// ---------------------------------------------------------------------------

function searchForFileByName(dirPath, targetName, maxDepth = 4, currentDepth = 0) {
  if (currentDepth > maxDepth || !existsSync(dirPath)) return null;
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'vendor') continue;
      const full = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const found = searchForFileByName(full, targetName, maxDepth, currentDepth + 1);
        if (found) return found;
      } else if (entry.isFile() && entry.name.toLowerCase() === targetName.toLowerCase()) {
        return full;
      }
    }
  } catch {}
  return null;
}

function resolveFilePath(inputPath, workspaceUris = []) {
  if (!inputPath || typeof inputPath !== 'string') return null;

  let cleaned = inputPath.trim();

  // Strip enclosing quotes
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
      (cleaned.startsWith('`') && cleaned.endsWith('`'))) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Handle file:// URIs
  if (cleaned.startsWith('file://')) {
    try {
      cleaned = fileURLToPath(cleaned);
    } catch {
      cleaned = cleaned.replace(/^file:\/\//, '');
    }
  }

  // Handle tilde ~
  if (cleaned === '~' || cleaned.startsWith('~/')) {
    cleaned = join(homedir(), cleaned.slice(2));
  }

  // 1. Direct path check
  if (existsSync(cleaned) && statSync(cleaned).isFile()) {
    return cleaned;
  }

  // 2. URL-decoded path check
  try {
    const decoded = decodeURIComponent(cleaned);
    if (existsSync(decoded) && statSync(decoded).isFile()) {
      return decoded;
    }
  } catch {}

  // 3. Candidate directories
  const candidateBases = [];

  if (Array.isArray(workspaceUris)) {
    for (const uri of workspaceUris) {
      try {
        const p = uri.startsWith('file://') ? fileURLToPath(uri) : decodeURIComponent(uri);
        if (existsSync(p)) candidateBases.push(p);
      } catch {}
    }
  }

  candidateBases.push(process.cwd());
  candidateBases.push(join(homedir(), '.gemini/antigravity/scratch'));
  candidateBases.push(join(homedir(), 'Downloads'));
  candidateBases.push(join(homedir(), 'Documents'));
  candidateBases.push(join(homedir(), 'Desktop'));

  // Test joining base with cleaned / decoded paths
  for (const base of candidateBases) {
    if (!existsSync(base)) continue;
    try {
      const candidate = join(base, cleaned);
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return candidate;
      }
      const decodedCandidate = join(base, decodeURIComponent(cleaned));
      if (existsSync(decodedCandidate) && statSync(decodedCandidate).isFile()) {
        return decodedCandidate;
      }
    } catch {}
  }

  // 4. Fuzzy fallback: search by basename in candidate bases
  const targetBaseName = basename(cleaned);
  if (targetBaseName) {
    for (const base of candidateBases) {
      if (!existsSync(base)) continue;
      const found = searchForFileByName(base, targetBaseName, 4);
      if (found) return found;
    }
  }

  return null;
}

function findCsvs(dirPath, maxDepth = 4, currentDepth = 0) {
  if (currentDepth > maxDepth || !existsSync(dirPath)) return [];
  const results = [];
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'vendor' || entry.name === '.git') continue;
      const full = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...findCsvs(full, maxDepth, currentDepth + 1));
      } else if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.tab') || lower.endsWith('.dsv')) {
          try {
            const st = statSync(full);
            results.push({
              name: entry.name,
              path: full,
              size: st.size,
              mtime: st.mtimeMs,
            });
          } catch {}
        }
      }
    }
  } catch {}
  return results;
}

// ---------------------------------------------------------------------------
// APIs
// ---------------------------------------------------------------------------

app.api('/api/status', () => ({ ok: true, version: '1.0.0' }), 'GET');

app.api('/api/get-state', () => {
  if (!existsSync(STATE_FILE)) return { lastOpenedPath: null };
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { lastOpenedPath: null };
  }
}, 'GET');

app.api('/api/save-state', (data) => {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    const state = { lastOpenedPath: data?.lastOpenedPath || null, savedAt: Date.now() };
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    return state;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

app.api('/api/workspace-csvs', (data) => {
  const uris = Array.isArray(data?.workspaceUris) ? data.workspaceUris : [];
  const folders = [];

  for (const uri of uris) {
    try {
      const folderPath = uri.startsWith('file://') ? fileURLToPath(uri) : decodeURIComponent(uri);
      if (existsSync(folderPath)) folders.push(folderPath);
    } catch {}
  }

  // Include known scratch directory and user folders
  folders.push(join(homedir(), '.gemini/antigravity/scratch'));
  folders.push(join(homedir(), 'Downloads'));
  folders.push(join(homedir(), 'Documents'));

  const results = [];
  const checkedFolders = new Set();
  for (const folder of folders) {
    if (checkedFolders.has(folder) || !existsSync(folder)) continue;
    checkedFolders.add(folder);
    results.push(...findCsvs(folder, 4, 0));
  }

  const seen = new Set();
  const unique = [];
  for (const item of results) {
    if (!seen.has(item.path)) {
      seen.add(item.path);
      unique.push(item);
    }
  }
  unique.sort((a, b) => b.mtime - a.mtime);
  return { csvs: unique.slice(0, 50) };
});

app.api('/api/raw-csv', (data) => {
  const resolved = resolveFilePath(data?.path, data?.workspaceUris);
  if (!resolved) {
    return new Response(JSON.stringify({ error: `File not found: ${data?.path || ''}` }), {
      contentType: 'application/json',
      status: 404,
    });
  }
  const content = readFileSync(resolved, 'utf8');
  return new Response(content, {
    contentType: 'text/plain; charset=utf-8',
    headers: {
      'Content-Disposition': `inline; filename="${basename(resolved)}"`,
    },
  });
}, 'GET');

app.api('/api/load-csv', (data) => {
  const inputPath = data?.path;
  if (!inputPath) return { success: false, error: 'No path specified' };

  try {
    const resolved = resolveFilePath(inputPath, data?.workspaceUris);
    if (!resolved) {
      return { success: false, error: `File not found: ${inputPath}` };
    }

    const st = statSync(resolved);
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB limit for raw loading
    if (st.size > MAX_SIZE) {
      return {
        success: false,
        error: `File is too large (${(st.size / (1024 * 1024)).toFixed(1)}MB). Max supported size is 50MB.`,
      };
    }

    let content = readFileSync(resolved, 'utf8');
    // Strip UTF-8 BOM if present
    if (content.charCodeAt(0) === 0xFEFF) {
      content = content.slice(1);
    }

    return {
      success: true,
      path: resolved,
      filename: basename(resolved),
      size: st.size,
      mtime: st.mtimeMs,
      content,
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to read file: ${err.message || String(err)}`,
    };
  }
});

app.run();
