/* AETHERTABLE — zero-dependency server for the 2D D&D simulator.
 *
 * Serves the game, manages a portable local Ollama instance (the default
 * Dungeon Master), and optionally bridges to the GitHub Copilot CLI for
 * players who would rather have a larger model narrate.
 *
 * Adapted from the sibling ACCORD project's server, which had already solved
 * the awkward parts: orphaned GPU runners, honest speed measurement, and
 * getting a terminal-shaped CLI to behave like a chat endpoint.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8177);
const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

/* ---------------------------------------------------------- AI location --
   The portable runtime and its models are several gigabytes. If a sibling
   game in the same folder already has them, use those rather than making the
   player download a second copy; DND_AI_DIR overrides, and install-ai.ps1
   populates the local folder for a standalone install. Resolution order is
   deliberate: an explicit override, then our own folder, then a sibling. */
function resolveAiDir() {
  const candidates = [];
  if (process.env.DND_AI_DIR) candidates.push(path.resolve(process.env.DND_AI_DIR));
  candidates.push(path.join(ROOT, 'ai'));
  candidates.push(path.join(path.dirname(ROOT), 'NegotiatorGame', 'ai'));
  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, 'ollama', 'ollama.exe'))) return dir;
    } catch (e) { /* unreadable candidate, try the next */ }
  }
  return path.join(ROOT, 'ai');
}

const AI_DIR = resolveAiDir();
const OLLAMA_EXE = path.join(AI_DIR, 'ollama', 'ollama.exe');
const MODELS_DIR = path.join(AI_DIR, 'models');
const SHARED_AI = AI_DIR !== path.join(ROOT, 'ai');

/* Finished sessions are written by the server, not downloaded by the browser:
   a download needs a user gesture, which an unattended AI playtest cannot
   make. DND_EXPORT_DIR moves them. */
const EXPORT_DIR = path.resolve(process.env.DND_EXPORT_DIR || path.join(ROOT, 'exports'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(body);
}
function sendJson(res, code, obj) {
  send(res, code, JSON.stringify(obj), 'application/json');
}

/** Collect a request body with a hard ceiling, so a large or hostile upload
    cannot exhaust memory. */
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0, done = false;
    req.on('data', c => {
      if (done) return;
      size += c.length;
      if (size > max) { done = true; req.destroy(); reject(new Error('request too large')); return; }
      chunks.push(c);
    });
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks).toString('utf8')); } });
    req.on('error', e => { if (!done) { done = true; reject(e); } });
  });
}

/** Rebuild an export filename from scratch. Never trust the caller's: take the
    basename, keep only characters that cannot mean anything to a path, and
    impose the extension. Anything unusable becomes a timestamp. */
function safeExportName(raw, ext) {
  const suffix = ext || '.json';
  let name = path.basename(String(raw || ''));
  name = name.replace(/\.(json|md|txt)$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+/, '').replace(/-+/g, '-').slice(0, 120);
  if (!name) name = 'aethertable-' + new Date().toISOString().replace(/[:.]/g, '-');
  return name + suffix;
}

/* ---------------------------------------------------------- ollama boot -- */
let ollamaProc = null;

/* A model runner (llama-server.exe) whose parent Ollama dies keeps its GPU
   memory allocated indefinitely — observed holding 6.7 GB on an 8 GB card,
   which silently makes generation several times slower. Always tear down the
   whole tree we started. */
function killTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      require('child_process').execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'],
        { stdio: 'ignore', windowsHide: true });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch (e) { /* already gone */ }
}

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (ollamaProc && ollamaProc.pid) killTree(ollamaProc.pid);
  try { server.close(); } catch (e) { /* ignore */ }
  process.exit(code === undefined ? 0 : code);
}

/** Model runners orphaned by a previous session.

    Boot warms and measures the model; if an orphan is still holding the GPU,
    the figure shown to the player is several times the real one and the model
    chooser downgrades itself for no reason. Only runners whose parent process
    is gone, and only ones belonging to this installation, are touched — a
    system-wide Ollama the player uses for other work is never disturbed. */
function sweepOrphanRunners() {
  if (process.platform !== 'win32') return Promise.resolve(0);
  const dir = path.join(AI_DIR, 'ollama').toLowerCase().replace(/'/g, "''");
  const script =
    '$root = \'' + dir + '\';' +
    '$all = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue;' +
    '$alive = @{}; $all | ForEach-Object { $alive[$_.ProcessId] = $true };' +
    '$all | Where-Object { $_.Name -eq \'llama-server.exe\' -and $_.ExecutablePath -and ' +
    '$_.ExecutablePath.ToLower().StartsWith($root) -and -not $alive[$_.ParentProcessId] } | ' +
    'ForEach-Object { $_.ProcessId }';
  return new Promise(resolve => {
    let out = '', done = false;
    const finish = n => { if (!done) { done = true; resolve(n); } };
    const p = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true });
    p.stdout.on('data', d => { out += d; });
    p.on('error', () => finish(0));
    p.on('close', () => {
      let killed = 0;
      String(out).split(/\r?\n/).forEach(line => {
        const pid = parseInt(String(line).trim(), 10);
        if (!Number.isFinite(pid) || pid <= 0) return;
        killTree(pid);
        killed++;
      });
      if (killed) console.log('  * reclaimed ' + killed + ' orphaned model runner' +
        (killed === 1 ? '' : 's') + ' from a previous session');
      finish(killed);
    });
    setTimeout(() => { try { p.kill(); } catch (e) { /* gone */ } finish(0); }, 6000);
  });
}

function startOllama() {
  if (!fs.existsSync(OLLAMA_EXE)) {
    console.log('  ! portable Ollama not found at', OLLAMA_EXE);
    console.log('    Run install-ai.cmd, or play with the Offline Dungeon Master.');
    return;
  }
  ollamaProc = spawn(OLLAMA_EXE, ['serve'], {
    env: Object.assign({}, process.env, {
      OLLAMA_MODELS: MODELS_DIR,
      OLLAMA_HOST: '127.0.0.1:11434',
      OLLAMA_KEEP_ALIVE: '-1',
      OLLAMA_MAX_LOADED_MODELS: '1',
      OLLAMA_NUM_PARALLEL: '1',
      OLLAMA_FLASH_ATTENTION: '1',
    }),
    stdio: 'ignore', windowsHide: true,
  });
  ollamaProc.on('error', e => console.log('  ! could not start Ollama:', e.message));
}

function ollamaUp() {
  return new Promise(resolve => {
    const req = http.get(OLLAMA + '/api/version', r => { r.resume(); resolve(r.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.setTimeout(1200, () => { req.destroy(); resolve(false); });
  });
}

/* ------------------------------------------------------ speed measuring --
   VRAM tells us what fits, not how fast the GPU is allowed to run: a laptop
   power profile or another program holding the card can halve throughput with
   nothing else looking wrong. So time a real generation and let that drive the
   recommendation.

   num_ctx MUST match js/ai/backend.js DEFAULTS.numCtx, or Ollama reloads the
   runner on the first real call and the measurement was wasted. */
const NUM_CTX = Number(process.env.DND_NUM_CTX || 8192);
/* A narration turn, not a chat line — this is what we are budgeting for. */
const REPLY_TOKENS = Number(process.env.DND_REPLY_TOKENS || 220);
/* Deliberately generous. This is a turn-based game whose prose streams into
   the log as it arrives, so several seconds is unremarkable; a tight budget
   would demote the best writer for no benefit the player would notice. */
const TARGET_REPLY_MS = Number(process.env.DND_TARGET_REPLY_MS || 12000);

let perf = { model: null, tokPerSec: null, overheadMs: null, projectedReplyMs: null };
let chosenModel = null;   // what startup settled on, after measuring

function measureModel(model) {
  return new Promise(resolve => {
    const body = JSON.stringify({
      model, think: false, stream: false, keep_alive: -1,
      options: { num_predict: 24, num_ctx: NUM_CTX },
      messages: [{ role: 'user', content: 'Describe a torchlit stone corridor in two sentences.' }],
    });
    const t0 = Date.now();
    const req = http.request(OLLAMA + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, r => {
      let d = '';
      r.on('data', c => { d += c; });
      r.on('end', () => {
        try {
          const j = JSON.parse(d);
          const wall = Date.now() - t0;
          const genMs = (j.eval_duration || 0) / 1e6;
          /* Loading weights is a one-time cost, not per-reply overhead. Kept
             separate so a cold sample can be discarded rather than believed. */
          const loadMs = (j.load_duration || 0) / 1e6;
          const promptMs = (j.prompt_eval_duration || 0) / 1e6;
          const tps = j.eval_count && genMs ? j.eval_count / (genMs / 1000) : null;
          const overhead = Math.max(0, wall - genMs);
          resolve({
            model, tokPerSec: tps ? +tps.toFixed(1) : null,
            overheadMs: Math.round(overhead),
            loadMs: Math.round(loadMs),
            promptMs: Math.round(promptMs),
            at: Date.now(),
            projectedReplyMs: tps ? Math.round(overhead + (REPLY_TOKENS / tps) * 1000) : null,
          });
        } catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(body); req.end();
  });
}

/* A sample that had to read weights off disk is not a per-reply latency. */
const COLD_LOAD_MS = 2000;

function warmUp(model) {
  const attempt = n => measureModel(model).then(p => {
    if (n <= 0 || (p && p.tokPerSec && p.loadMs < COLD_LOAD_MS)) return p;
    return attempt(n - 1);
  });
  return measureModel(model)
    .then(() => attempt(3))
    .then(p => {
      if (!p) { console.log('  * model warm: ' + model); return null; }
      perf = p;
      console.log('  * model warm: ' + model + '  (' + p.tokPerSec + ' tok/s, ' +
        p.overheadMs + 'ms overhead' + (p.loadMs >= COLD_LOAD_MS ? ' [still cold]' : '') +
        ' -> ~' + p.projectedReplyMs + 'ms per narration)');
      return p;
    });
}

/* Conditions change while a session runs — another program takes the GPU, or
   gives it back. Re-measure when stale, throttled to one at a time and never
   on the request path. */
const PERF_STALE_MS = 90000;
let remeasuring = false;

function refreshPerfIfStale() {
  if (remeasuring) return;
  const m = perf && perf.model;
  if (!m) return;
  if (perf.at && Date.now() - perf.at < PERF_STALE_MS) return;
  remeasuring = true;
  measureModel(m).then(p => {
    if (p && p.tokPerSec && p.loadMs < COLD_LOAD_MS) perf = p;
  }).catch(() => {}).then(() => { remeasuring = false; });
}

/* --------------------------------------------------------- VRAM probe -- */
function freeVramMiB() {
  return new Promise(resolve => {
    const p = spawn('nvidia-smi', ['--query-gpu=memory.free', '--format=csv,noheader,nounits'],
      { windowsHide: true });
    let out = '';
    p.stdout.on('data', d => { out += d; });
    p.on('error', () => resolve(null));
    p.on('close', () => {
      const n = parseInt(String(out).trim().split(/\r?\n/)[0], 10);
      resolve(Number.isFinite(n) ? n : null);
    });
  });
}

/** Rough resident cost of each option, in MiB, at our default context. */
const MODEL_VRAM = { 'qwen3.5:4b': 3500, 'llama3.2:3b': 2400, 'qwen3:1.7b': 1700 };
/** Best writer first — this is the preference order, not a speed ranking. */
const MODEL_ORDER = ['qwen3:1.7b', 'llama3.2:3b', 'qwen3.5:4b'];
const STEP_DOWN = { 'qwen3.5:4b': 'llama3.2:3b', 'llama3.2:3b': 'qwen3:1.7b' };
const BROWSER_RESERVE_MIB = 900;

/** Never let a diagnostic call hang a route: "unknown" beats "never answers". */
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function getJson(pathname, ms) {
  return withTimeout(new Promise(resolve => {
    const req = http.get(OLLAMA + pathname, r => {
      let d = '';
      r.on('data', c => { d += c; });
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(ms, () => { req.destroy(); resolve(null); });
  }), ms + 200, null);
}

let vramCache = { at: 0, value: null };
function freeVramCached() {
  if (Date.now() - vramCache.at < 3000) return Promise.resolve(vramCache.value);
  return withTimeout(freeVramMiB(), 2500, null).then(v => {
    vramCache = { at: Date.now(), value: v };
    return v;
  });
}

/* ================================================= GitHub Copilot CLI ====
   An entirely OPTIONAL second Dungeon Master, and the way AI-controlled player
   seats think. The game always defaults to the local model: nothing here runs
   unless the player explicitly picks a Copilot model, and no game state leaves
   the machine unless they do.

   The CLI is an autonomous coding agent by default, which is completely wrong
   for this — it would happily read the repository or run commands. Every tool
   and MCP server is switched off, which is not only a safety measure: in the
   sibling project it cut the prompt from 36.1k tokens to 3.6k and the cost per
   reply by roughly ten times, because the tool definitions dominated the
   request. */
const COPILOT_ARGS_BASE = [
  '--disable-builtin-mcps',     // no GitHub API access
  '--no-custom-instructions',   // ignore any AGENTS.md near the game
  '--no-color',                 // ANSI codes would land in the narration
  '--no-ask-user',              // never block waiting for a human
  /* A Dungeon Master needs no tools. Switching the MCP servers off did not
     take away the CLI's own built-ins, so a prompt-injected reply could still
     have reached a shell — and the prompt is partly composed of text a player
     typed. The narrator's whole job is to write prose; every tool that can
     touch the machine is refused by name.

     Denied rather than restricted with --available-tools so that a tool added
     to the CLI in a later version is not silently granted; a new tool arriving
     is far more likely than one of these being renamed. */
  '--deny-tool', 'shell',
  '--deny-tool', 'write',
  '--deny-tool', 'edit',
  '--deny-tool', 'create',
  '--deny-tool', 'view',
  '--deny-tool', 'glob',
  '--deny-tool', 'grep',
  '--deny-tool', 'fetch',
  '--deny-tool', 'task',
  '--log-level', 'none',
  '--stream', 'off',
];

/* A model name goes into an argument vector, never a shell, and is checked
   against a conservative pattern anyway. */
const COPILOT_MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** Offered in the UI. Never the default — tests/copilot.test.js enforces that
    the first option in every model picker is a local model. */
const COPILOT_MODELS = [
  'claude-opus-5', 'claude-sonnet-5', 'claude-opus-4.8',
  'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.4',
  'gemini-3.1-pro-preview',
];

let copilotStatus = null;      // cached probe: { available, detail }

function probeCopilot() {
  if (copilotStatus) return Promise.resolve(copilotStatus);
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; copilotStatus = v; resolve(v); } };
    let p;
    try {
      p = spawn('copilot', ['--version'], { windowsHide: true, shell: false });
    } catch (e) {
      return finish({ available: false, detail: 'GitHub Copilot CLI is not installed' });
    }
    let out = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { out += d; });
    p.on('error', () => finish({ available: false, detail: 'GitHub Copilot CLI is not on PATH' }));
    p.on('close', code => finish(code === 0
      ? { available: true, detail: out.trim().split(/\r?\n/)[0] || 'installed' }
      : { available: false, detail: 'copilot --version failed' }));
    setTimeout(() => { try { p.kill(); } catch (e) {} finish({ available: false, detail: 'copilot did not respond' }); }, 8000);
  });
}

/* The CLI writes for a terminal, not for a game: a tool-status banner, then
   the reply, then a telemetry footer. Only the middle is narration. */
function cleanCopilotOutput(raw) {
  const s = String(raw || '').replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');
  const lines = s.split(/\r?\n/);
  const keep = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) { keep.push(''); continue; }
    if (/^[●○*•]\s/.test(t)) continue;                       // tool/status banner
    if (/^(Changes|AI Credits|Tokens|Resume|Session|Total duration)\b/.test(t)) continue;
    if (/^Unknown tool name/i.test(t)) continue;
    if (/^[↑↓]\s/.test(t)) continue;
    keep.push(line);
  }
  /* The CLI hard-wraps to the terminal width. Those breaks belong to the
     console, not the writing, and would show up as ragged mid-sentence line
     breaks in the log. Rejoin wrapped lines, leave paragraph breaks alone. */
  return keep.join('\n')
    .replace(/([^\n])\n(?!\n)[ \t]*(?=\S)/g, '$1 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function copilotChat(model, prompt, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (!COPILOT_MODEL_RE.test(model)) return reject(new Error('invalid model name'));
    /* The prompt goes in on STDIN, not as an argument: Windows caps a command
       line at about 32k characters and a full board description exceeds that.
       stdin has no such limit. */
    const args = ['--model', model].concat(COPILOT_ARGS_BASE);
    let p;
    try {
      /* The agent's working directory is a scratch folder rather than the
         game, so even a failure of the tool lockdown has nothing to read. */
      p = spawn('copilot', args, { windowsHide: true, shell: false, cwd: os.tmpdir() });
    } catch (e) { return reject(e); }
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('error', reject);
    try { p.stdin.write(String(prompt || '')); p.stdin.end(); }
    catch (e) { return reject(e); }
    const timer = setTimeout(() => {
      /* p.kill() signals only the launcher; the CLI's own child keeps running,
         holding a model slot and, on Windows, its share of VRAM. Take the
         whole tree down. */
      killTree(p.pid);
      try { p.kill(); } catch (e) { /* already gone */ }
      reject(new Error('copilot timed out'));
    }, timeoutMs || 300000);
    p.on('close', code => {
      clearTimeout(timer);
      const text = cleanCopilotOutput(out);
      if (!text) return reject(new Error(cleanCopilotOutput(err) || ('copilot exited ' + code)));
      resolve(text);
    });
  });
}

/** Recover a JSON object from model output that may be fenced or wrapped in
    prose. Failing a turn over punctuation is not acceptable. */
function recoverJson(text) {
  let raw = String(text || '');
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1];
  const brace = raw.match(/\{[\s\S]*\}/);
  if (!brace) return null;
  try { return JSON.parse(brace[0]); } catch (e) { /* fall through */ }
  /* One repair pass for the two things models actually get wrong: trailing
     commas, and smart quotes pasted in from prose. */
  const patched = brace[0]
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
  try { return JSON.parse(patched); } catch (e) { return null; }
}

/* ------------------------------------------------------------- routing -- */

/**
 * Is this request really from the game running on this machine?
 *
 * The server listens on loopback, which stops another computer reaching it —
 * but not another *page* on this one. Any site open in the same browser could
 * POST to http://127.0.0.1:8787/api/... and drive the local models, and with
 * the Copilot bridge behind those routes that is somebody else's page spending
 * the user's credits and steering an agent.
 *
 * Three cheap checks close it:
 *   · Origin, when the browser sends one, must be this server. A cross-site
 *     fetch always carries an Origin the attacker cannot forge.
 *   · Host must be loopback, which defeats DNS rebinding — an attacker's
 *     hostname resolving to 127.0.0.1 arrives with their name in Host.
 *   · State-changing requests must be JSON. A plain HTML form cannot send
 *     application/json, so simple no-preflight form posts are ruled out.
 */
const LOOPBACK_HOST_RE = /^(127\.0\.0\.1|\[::1\]|localhost)(:\d+)?$/i;

function originAllowed(req) {
  const host = String(req.headers.host || '');
  if (!LOOPBACK_HOST_RE.test(host)) return { ok: false, why: 'host is not loopback: ' + host };

  const origin = req.headers.origin;
  if (origin) {
    let o;
    try { o = new URL(origin); } catch (e) { return { ok: false, why: 'unparsable origin' }; }
    if (!LOOPBACK_HOST_RE.test(o.host)) return { ok: false, why: 'cross-site origin: ' + origin };
    if (o.host !== host) return { ok: false, why: 'origin does not match host' };
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const ct = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    /* An empty body is fine — /api/copilot/warm carries its model in the query
       string — but anything with content must declare itself as JSON. */
    if (ct && ct !== 'application/json') return { ok: false, why: 'content type must be application/json' };
  }
  return { ok: true };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname.indexOf('/api/') === 0) {
    const gate = originAllowed(req);
    if (!gate.ok) {
      /* Deliberately terse to the caller and explicit in the log: the page
         that tried this should learn nothing, the user should learn everything. */
      console.warn('[server] refused a cross-site API request: ' + gate.why);
      return sendJson(res, 403, { error: 'forbidden' });
    }
  }

  if (url.pathname === '/api/copilot/status') {
    probeCopilot().then(s => sendJson(res, 200, Object.assign({ models: COPILOT_MODELS }, s)));
    return;
  }

  /* Selecting a Copilot voice fires this first. The CLI's first call of a
     session pays for start-up and authentication — measured at ~31s against
     ~8s for every call after — and taking that hit on the opening narration
     would look like the game had hung. */
  if (url.pathname === '/api/copilot/warm' && req.method === 'POST') {
    const model = url.searchParams.get('model') || '';
    sendJson(res, 202, { warming: true });
    copilotChat(model, 'Reply with the single word: ready', 120000).catch(() => {});
    return;
  }

  /* An AI-controlled player seat choosing its move. Takes the board and the
     list of moves the engine says are legal, and returns ONE index into that
     list. The caller validates the index against the same list, so a model can
     never name a move that does not exist. Long timeout: it is thinking about
     a large board and no narration is waiting on it. */
  if (url.pathname === '/api/agent/move' && req.method === 'POST') {
    readBody(req, 1 << 21).then(raw => {
      let body;
      try { body = JSON.parse(raw); } catch (e) { return sendJson(res, 400, { error: 'bad json' }); }
      copilotChat(String(body.model || ''), String(body.prompt || '')).then(text => {
        sendJson(res, 200, { choice: recoverJson(text), text });
      }).catch(e => {
        sendJson(res, 503, { error: 'agent unavailable', detail: String((e && e.message) || e) });
      });
    }).catch(e => sendJson(res, 400, { error: String((e && e.message) || e) }));
    return;
  }

  if (url.pathname === '/api/copilot/chat' && req.method === 'POST') {
    readBody(req, 1 << 21).then(raw => {
      let body;
      try { body = JSON.parse(raw); } catch (e) { return sendJson(res, 400, { error: 'bad json' }); }
      const msgs = Array.isArray(body.messages) ? body.messages : [];
      /* The CLI takes a single prompt, so roles are flattened. The closing
         instruction matters: without it the agent explains itself, offers to
         help, or wraps the narration in commentary. */
      const sys = msgs.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
      const rest = msgs.filter(m => m.role !== 'system')
        .map(m => (m.role === 'assistant' ? 'PREVIOUSLY YOU WROTE: ' : '') + m.content).join('\n\n');
      const closing = body.json
        ? 'Reply with the JSON object only. No preamble, no explanation, no markdown fence.'
        : 'Reply with the narration only. No preamble, no explanation, no headings, ' +
          'no bullet points, and do not offer to help with anything.';
      const prompt = [sys, rest, closing].filter(Boolean).join('\n\n');
      copilotChat(String(body.model || ''), prompt).then(text => {
        /* Answer in the same NDJSON shape the Ollama proxy returns, so the
           client's stream reader needs no special case for this backend. */
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' });
        res.end(JSON.stringify({ message: { role: 'assistant', content: text }, done: true }) + '\n');
      }).catch(e => {
        sendJson(res, 503, { error: 'copilot unavailable', detail: String((e && e.message) || e) });
      });
    }).catch(e => sendJson(res, 400, { error: String((e && e.message) || e) }));
    return;
  }

  /* Dumb pipe to Ollama. Deliberately does not parse or buffer: the client
     reads the NDJSON stream itself so narration can appear as it is written. */
  if (url.pathname === '/api/chat' && req.method === 'POST') {
    const MAX_BODY = 1 << 21;
    const chunks = [];
    let size = 0, aborted = false;
    req.on('data', c => {
      if (aborted) return;
      size += c.length;
      if (size > MAX_BODY) {
        aborted = true;
        sendJson(res, 413, { error: 'request too large' });
        req.destroy();
        return;
      }
      chunks.push(c);                      // keep Buffers: concatenating
    });                                    // strings would split multi-byte UTF-8
    req.on('end', () => {
      if (aborted) return;
      const body = Buffer.concat(chunks);
      const up = http.request(OLLAMA + '/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
      }, r => {
        res.writeHead(r.statusCode, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' });
        r.pipe(res);
      });
      up.on('error', e => {
        if (!res.headersSent) sendJson(res, 503, { error: 'ollama unavailable', detail: e.message });
        else res.end();
      });
      up.write(body); up.end();
    });
    req.on('error', () => {});
    return;
  }

  /* ------------------------------------------------------------ exports --
     The only routes that create files, so names are rebuilt from scratch
     rather than trusted, and the resolved path is re-checked afterwards. */
  if (url.pathname === '/api/export/dir') {
    sendJson(res, 200, { dir: EXPORT_DIR });
    return;
  }

  if (url.pathname === '/api/export' && req.method === 'POST') {
    readBody(req, 24 * 1024 * 1024).then(raw => {
      let payload;
      try { payload = JSON.parse(raw); } catch (e) {
        return sendJson(res, 400, { error: 'not JSON' });
      }
      if (!payload || typeof payload.save !== 'object' || payload.save === null) {
        return sendJson(res, 400, { error: 'no save in the request' });
      }
      try {
        fs.mkdirSync(EXPORT_DIR, { recursive: true });
        const written = [];
        const writeOne = (name, text) => {
          const full = path.join(EXPORT_DIR, name);
          if (path.dirname(path.resolve(full)) !== EXPORT_DIR) throw new Error('bad filename');
          fs.writeFileSync(full, text, 'utf8');
          written.push({ file: name, path: full, bytes: Buffer.byteLength(text) });
        };
        const base = safeExportName(payload.filename, '.json');
        writeOne(base, JSON.stringify(payload.save, null, 2));
        /* A companion Markdown transcript. The JSON is for reloading; this is
           for a human (or a reviewing model) to actually read afterwards. */
        if (typeof payload.markdown === 'string' && payload.markdown.trim()) {
          writeOne(base.replace(/\.json$/, '.md'), payload.markdown);
        }
        sendJson(res, 200, { ok: true, dir: EXPORT_DIR, written });
      } catch (e) {
        sendJson(res, 500, { error: String((e && e.message) || e) });
      }
    }).catch(e => sendJson(res, 400, { error: String((e && e.message) || e) }));
    return;
  }

  if (url.pathname === '/api/status') {
    refreshPerfIfStale();
    Promise.all([
      withTimeout(ollamaUp(), 2000, false),
      freeVramCached(),
      withTimeout(probeCopilot(), 9000, { available: false, detail: 'probe timed out' }),
    ]).then(async ([up, freeMiB, copilot]) => {
      let models = [], loaded = null;
      if (up) {
        const tags = await getJson('/api/tags', 2500);
        if (tags && Array.isArray(tags.models)) models = tags.models.map(m => m.name);
        const ps = await getJson('/api/ps', 2500);
        if (ps && Array.isArray(ps.models)) loaded = ps.models[0] || null;
      }
      const residentMiB = loaded ? Math.round((loaded.size_vram || 0) / 1048576) : 0;
      const rawFree = freeMiB === null ? null : freeMiB + residentMiB;
      const budget = rawFree === null ? null : Math.max(0, rawFree - BROWSER_RESERVE_MIB);

      /* Largest model that fits alongside the browser. Offline is never forced
         on VRAM alone — Ollama will share host memory, and that is the
         player's call to make. */
      let recommended = 'qwen3.5:4b', tight = false;
      if (budget !== null) {
        if (budget < MODEL_VRAM['qwen3.5:4b']) { recommended = 'llama3.2:3b'; tight = true; }
        if (budget < MODEL_VRAM['llama3.2:3b']) { recommended = 'qwen3:1.7b'; tight = true; }
      }
      /* VRAM says what fits; the measurement says how fast the card is
         actually running. If measuring made the server settle lower, honour it. */
      let slow = false;
      if (chosenModel && chosenModel !== recommended && models.indexOf(chosenModel) >= 0) {
        if (MODEL_ORDER.indexOf(chosenModel) < MODEL_ORDER.indexOf(recommended)) {
          recommended = chosenModel;
          slow = true;
        }
      }
      /* A better model already resident and answering inside budget must not
         be swapped out. "Would this fit if loaded now?" is the wrong question
         once it is loaded and working. */
      const residentName = loaded && loaded.name;
      const fullyOnGpu = loaded && loaded.size && loaded.size_vram >= loaded.size * 0.98;
      const meetingTarget = perf.model === residentName && perf.projectedReplyMs
        && perf.projectedReplyMs <= TARGET_REPLY_MS;
      if (residentName && fullyOnGpu && meetingTarget &&
          MODEL_ORDER.indexOf(residentName) > MODEL_ORDER.indexOf(recommended)) {
        recommended = residentName;
        tight = false; slow = false;
      }

      let hint = '';
      if (budget !== null && budget < MODEL_VRAM['qwen3:1.7b']) {
        hint = 'Very little GPU memory is free — another program is probably using the card. ' +
          'The Dungeon Master will still work, but will write more slowly until it is freed.';
      } else if (slow) {
        hint = 'The GPU is running below its rated speed (measured ' + perf.tokPerSec +
          ' tok/s), so a faster model was chosen. If another AI application is using the card, ' +
          'closing it will let the larger model be selected; you can also force one with -Model.';
      } else if (tight) {
        hint = 'GPU memory is limited, so a smaller and faster model was selected.';
      }

      sendJson(res, 200, {
        ok: true, ollama: up, models, freeMiB, budgetMiB: budget,
        loaded: residentName || null, recommended, tight, slow, hint,
        measured: perf.model ? perf : null,
        targetReplyMs: TARGET_REPLY_MS,
        copilot: Object.assign({ models: COPILOT_MODELS }, copilot),
        sharedAi: SHARED_AI, aiDir: AI_DIR, exportDir: EXPORT_DIR,
      });
    }).catch(e => {
      /* Status must always answer, even if a probe misbehaves. */
      if (!res.headersSent) sendJson(res, 200, { ok: false, ollama: false, models: [], error: String(e && e.message) });
    });
    return;
  }

  // static files
  let p;
  try { p = decodeURIComponent(url.pathname); } catch (e) { return send(res, 400, 'bad request'); }
  if (p === '/') p = '/index.html';
  /* A NUL byte makes fs.readFile throw synchronously rather than call back,
     which would take the whole server down with it. Any local page could send
     one with a plain <img src>, so reject it before it reaches fs. */
  if (p.indexOf('\0') !== -1) return send(res, 400, 'bad request');
  const file = path.join(ROOT, path.normalize(p).replace(/^([/\\])+/, ''));
  if (!file.startsWith(ROOT)) return send(res, 403, 'forbidden');
  /* Serve the game, not the folder it lives in. Traversal was already blocked,
     but everything *inside* the directory was fair game — saved games, the
     exports folder with its full transcripts, and anything else the user
     happened to leave here. A page in another tab could read all of it, so
     only the directories the game is actually made of are served. */
  if (!servable(file)) return send(res, 403, 'forbidden');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'not found');
    send(res, 200, data, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
  });
});

/* The directories that make up the playable game, and the handful of files at
   the top level that belong to it. Anything else — exports, saves, notes,
   the research folder, a stray .env — is not served at all. */
const SERVE_DIRS = ['js', 'css', 'campaigns', 'assets', 'tools', 'docs'];
const SERVE_FILES = ['index.html', 'favicon.ico', 'manifest.json'];

function servable(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (!rel || rel.startsWith('..')) return false;
  const top = rel.split('/')[0];
  if (rel.indexOf('/') < 0) return SERVE_FILES.indexOf(rel) >= 0;
  return SERVE_DIRS.indexOf(top) >= 0;
}

/* A single malformed request must never end the session. */
server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
process.on('uncaughtException', e => {
  console.error('  ! recovered from uncaught error:', e && e.message);
});

/* Requiring this file must not start a server — the test suite pulls in the
   pure helpers to check them directly. */
module.exports = {
  cleanCopilotOutput, recoverJson, safeExportName,
  COPILOT_MODEL_RE, COPILOT_ARGS_BASE, COPILOT_MODELS,
  MODEL_VRAM, MODEL_ORDER, STEP_DOWN, TARGET_REPLY_MS,
};
if (require.main !== module) return;

server.listen(PORT, '127.0.0.1', async () => {
  console.log('');
  console.log('  AETHERTABLE  —  http://127.0.0.1:' + PORT);
  console.log('');
  if (SHARED_AI) console.log('  * using the AI runtime already installed at ' + AI_DIR);
  let up = await ollamaUp();
  /* Reclaim GPU memory before deciding anything, whether or not Ollama is
     already running: a runner left behind by an earlier session distorts both
     the VRAM reading and the speed measurement, and the recommendation is made
     from both. */
  await sweepOrphanRunners();
  if (!up) { console.log('  * starting portable Ollama...'); startOllama(); }
  for (let i = 0; i < 40 && !up; i++) {
    await new Promise(r => setTimeout(r, 500));
    up = await ollamaUp();
  }
  console.log(up ? '  * Ollama ready' : '  ! Ollama unavailable — the Offline Dungeon Master will narrate');
  if (!up) return;

  /* Warm the model the client will actually choose. Warming the largest one
     regardless would fill the card, the client would then pick a smaller one,
     and we would pay for two loads and strand the first. */
  let model = process.env.DND_MODEL;
  const forced = !!model;
  if (!model) {
    const freeMiB = await freeVramMiB();
    const budget = freeMiB === null ? null : Math.max(0, freeMiB - BROWSER_RESERVE_MIB);
    model = 'qwen3.5:4b';
    if (budget !== null) {
      if (budget < MODEL_VRAM['qwen3.5:4b']) model = 'llama3.2:3b';
      if (budget < MODEL_VRAM['llama3.2:3b']) model = 'qwen3:1.7b';
      if (budget < MODEL_VRAM['qwen3.5:4b']) {
        console.log('  * ' + (freeMiB === null ? '?' : freeMiB) + ' MiB GPU free — choosing ' +
          model + ' so it fits alongside the browser');
      }
    }
  } else {
    console.log('  * model pinned to ' + model + ' (speed step-down disabled)');
  }

  let p = await warmUp(model);
  /* Measured, not assumed. The budget is generous on purpose: this is a
     turn-based game and prose streams as it is written, so only a genuinely
     unusable model gets stepped down. */
  while (!forced && p && p.projectedReplyMs > TARGET_REPLY_MS) {
    const faster = STEP_DOWN[model];
    if (!faster) break;
    console.log('  * ~' + Math.round(p.projectedReplyMs / 1000) + 's per narration exceeds the ' +
      Math.round(TARGET_REPLY_MS / 1000) + 's budget — switching to ' + faster);
    model = faster;
    p = await warmUp(model);
  }
  chosenModel = model;
  console.log('  * ready — the Dungeon Master will narrate with ' + model +
    (p && p.projectedReplyMs ? ' in about ' + (p.projectedReplyMs / 1000).toFixed(1) + 's a turn' : ''));
  console.log('');
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('SIGHUP', () => shutdown(0));
process.on('exit', () => { if (ollamaProc && ollamaProc.pid) killTree(ollamaProc.pid); });
if (process.platform === 'win32' && process.stdin.isTTY) {
  try {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    rl.on('SIGINT', () => shutdown(0));
  } catch (e) { /* ignore */ }
}
