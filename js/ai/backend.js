/*
 * backend.js — one interface over three very different ways of getting words.
 *
 *   offline   deterministic templates. No model, no network, always available.
 *   ollama    a small local model, streamed as NDJSON through our own server.
 *   copilot   a large hosted model via the Copilot CLI, also NDJSON-shaped.
 *
 * Callers say what they want and never learn which backend answered. That is
 * what lets the whole referee/narrator pipeline be tested against recorded
 * fixtures, and it is why a player can switch Dungeon Masters mid-session.
 *
 * The one number that must never drift is NUM_CTX. Ollama keys its loaded
 * runner on the context size, so a referee call at 4096 followed by a narrator
 * call at 8192 reloads the model between every single turn. It is pinned here,
 * matched in server.js warmUp(), and asserted by a test.
 */
(function (global) {
  'use strict';

  /* Pinned. See the comment above before changing this — and change
     DND_NUM_CTX in server.js in the same commit. */
  var NUM_CTX = 8192;

  var PROFILES = {
    /* Structured classification. Cold and short: we want the most probable
       parse, not an interesting one. Never streamed — the whole object has to
       exist before anything can be done with it. */
    referee: { temperature: 0.2, top_p: 0.9, num_predict: 200, stream: false, repeat_penalty: 1.0 },
    /* Prose. 0.7 rather than 0.85 because small models derail noticeably above
       that, and repeat_penalty because they reach for the same opening image
       ("The air...", "You feel...") turn after turn. */
    /* 200 rather than 320: the live battery showed small models fill whatever
       budget they are given, and a rambling paragraph reads worse than a tight
       one. The sentence cap in the stage direction does the real work; this is
       the hard ceiling behind it. */
    narrator: { temperature: 0.7, top_p: 0.9, num_predict: 200, stream: true, repeat_penalty: 1.15 },
    /* A single NPC line. Short and a little warmer than narration. */
    voice: { temperature: 0.8, top_p: 0.92, num_predict: 90, stream: true, repeat_penalty: 1.12 },
    /* Compression. Deterministic, and the one place thinking earns its cost. */
    summary: { temperature: 0.1, top_p: 0.9, num_predict: 260, stream: false, repeat_penalty: 1.0, think: true },
    /* An AI player seat choosing a move. Structured, unhurried. */
    agent: { temperature: 0.4, top_p: 0.9, num_predict: 400, stream: false, repeat_penalty: 1.0 },
  };

  var state = {
    kind: 'offline',            // offline | ollama | copilot | fixture
    model: null,
    endpoint: '/api/chat',
    copilotEndpoint: '/api/copilot/chat',
    agentEndpoint: '/api/agent/move',
    status: null,
    fixtures: null,             // set by tests: { key -> response }
    fixtureLog: [],
    calls: 0,
    lastError: null,
  };

  function configure(opts) {
    opts = opts || {};
    if (opts.kind) state.kind = opts.kind;
    if (opts.model !== undefined) state.model = opts.model;
    if (opts.fixtures) state.fixtures = opts.fixtures;
    if (opts.endpoint) state.endpoint = opts.endpoint;
    return current();
  }

  function current() {
    return { kind: state.kind, model: state.model, numCtx: NUM_CTX, calls: state.calls };
  }

  function isCopilot() { return state.kind === 'copilot'; }
  function isOffline() { return state.kind === 'offline'; }
  function available() { return state.kind !== 'offline'; }

  /** Ask the server what it has. Never throws; a dead server means offline. */
  function refreshStatus(fetchImpl) {
    var f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!f) return Promise.resolve(null);
    return f('/api/status')
      .then(function (r) { return r.json(); })
      .then(function (j) { state.status = j; return j; })
      .catch(function () { state.status = null; return null; });
  }

  /* ------------------------------------------------------------ fixtures --
     A recorded-response backend. This is what makes the whole AI pipeline
     deterministically testable: the referee, the gates, the repair loop and
     the narrator can all be exercised end to end with no model anywhere. */
  function fixtureKey(req) {
    var msgs = req.messages || [];
    var last = msgs.length ? msgs[msgs.length - 1].content : '';
    return (req.profile || 'narrator') + ':' + String(last).slice(0, 160);
  }

  function fromFixture(req) {
    var key = fixtureKey(req);
    state.fixtureLog.push(key);
    var f = state.fixtures || {};
    if (Object.prototype.hasOwnProperty.call(f, key)) return f[key];
    /* A prefix match, so a fixture can be keyed on a stable opening phrase
       rather than an exact prompt that changes whenever wording is tuned. */
    var hit = Object.keys(f).filter(function (k) { return key.indexOf(k) === 0 || k.indexOf(key) === 0; })[0];
    if (hit) return f[hit];
    if (Object.prototype.hasOwnProperty.call(f, '*')) return f['*'];
    return null;
  }

  /* -------------------------------------------------------------- calls --- */

  /**
   * The single entry point.
   *
   * @param {object} req
   *   profile   'referee'|'narrator'|'voice'|'summary'|'agent'
   *   messages  [{role, content}]
   *   format    a JSON Schema object -> constrained decoding (Ollama)
   *   onToken   fn(text) called as prose streams in
   *   signal    an AbortSignal
   *   turnEpoch captured so a stale answer can be discarded by the caller
   * @returns {Promise<{text, kind, aborted, ms}>}
   */
  function chat(req) {
    req = req || {};
    var profile = PROFILES[req.profile] || PROFILES.narrator;
    var started = Date.now();
    state.calls++;

    if (state.kind === 'fixture') {
      var canned = fromFixture(req);
      if (canned == null) {
        return Promise.reject(new Error('no fixture for: ' + fixtureKey(req)));
      }
      if (req.onToken) req.onToken(canned);
      return Promise.resolve({ text: canned, kind: 'fixture', ms: 0 });
    }

    if (state.kind === 'offline') {
      return Promise.reject(new Error('offline: no model backend configured'));
    }

    var f = req.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!f) return Promise.reject(new Error('no fetch available'));

    if (state.kind === 'copilot') {
      /* The CLI cannot stream and cannot take a JSON schema, so structured
         requests are asked for in words and recovered defensively server-side.
         Same NDJSON reply shape, so the reader below needs no special case. */
      return f(state.copilotEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: state.model,
          messages: req.messages,
          json: !!req.format,
        }),
        signal: req.signal,
      }).then(function (r) { return readNdjson(r, req.onToken); })
        .then(function (text) { return { text: text, kind: 'copilot', ms: Date.now() - started }; });
    }

    var body = {
      model: state.model,
      messages: req.messages,
      stream: profile.stream !== false,
      /* Thinking is off for everything the player waits on: it multiplies
         latency and can leak chain-of-thought into narration. Summarisation is
         the one place it pays for itself. */
      think: !!profile.think,
      keep_alive: -1,
      options: {
        temperature: req.temperature != null ? req.temperature : profile.temperature,
        top_p: profile.top_p,
        num_predict: req.numPredict || profile.num_predict,
        num_ctx: NUM_CTX,
        repeat_penalty: profile.repeat_penalty,
      },
    };
    if (req.seed != null) body.options.seed = req.seed;
    if (req.format) body.format = req.format;
    if (req.stop) body.options.stop = req.stop;

    return f(state.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: req.signal,
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (d) { throw new Error('backend ' + r.status + ': ' + d); });
      }
      return readNdjson(r, req.onToken);
    }).then(function (text) {
      return { text: text, kind: 'ollama', ms: Date.now() - started };
    }).catch(function (e) {
      state.lastError = String((e && e.message) || e);
      throw e;
    });
  }

  /**
   * Read Ollama's NDJSON stream. One JSON object per line, each carrying the
   * next fragment; the last has done:true. Buffered by line because a chunk
   * boundary can fall mid-object.
   */
  function readNdjson(response, onToken) {
    if (!response.body || !response.body.getReader) {
      /* Node's fetch without a stream reader, or a mocked response. */
      return response.text().then(function (raw) { return joinNdjson(raw, onToken); });
    }
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '', out = '';
    function pump() {
      return reader.read().then(function (res) {
        if (res.done) {
          if (buffer.trim()) out += extractContent(buffer);
          return out;
        }
        buffer += decoder.decode(res.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop();
        for (var i = 0; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          var piece = extractContent(lines[i]);
          if (piece) { out += piece; if (onToken) onToken(piece); }
        }
        return pump();
      });
    }
    return pump();
  }

  function joinNdjson(raw, onToken) {
    var out = '';
    String(raw).split('\n').forEach(function (line) {
      if (!line.trim()) return;
      var piece = extractContent(line);
      if (piece) { out += piece; if (onToken) onToken(piece); }
    });
    return out;
  }

  function extractContent(line) {
    try {
      var j = JSON.parse(line);
      if (j.message && typeof j.message.content === 'string') return j.message.content;
      if (typeof j.response === 'string') return j.response;
      if (j.error) throw new Error(j.error);
      return '';
    } catch (e) {
      /* A line that is not JSON is not fatal — the CLI backend occasionally
         emits a stray blank. Only a parsed {error} is worth raising. */
      if (e && /^\{/.test(line.trim())) throw e;
      return '';
    }
  }

  /* --------------------------------------------------------- post-process -- */

  /**
   * Strip the artefacts small models produce regardless of instruction.
   * Applied to every piece of prose before it reaches the player.
   */
  function cleanProse(raw) {
    var s = String(raw || '');
    /* Reasoning traces. Belt and braces: think:false should prevent these, but
       a model that ignores it must not leak its scratchpad into the fiction. */
    s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
    s = s.replace(/<\/?think>/gi, '');
    /* A stage direction the model echoed back instead of performing. */
    s = s.replace(/\[(?:STAGE DIRECTION|OOC|SYSTEM)[\s\S]*?\]/gi, '');
    /* Asterisk emotes belong to chat roleplay, not to a narrator's prose. */
    s = s.replace(/(^|\s)\*[^*\n]{1,80}\*(?=\s|$)/g, '$1');
    /* Assistant scaffolding. */
    s = s.replace(/^\s*(?:Sure[,!]?|Certainly[,!]?|Of course[,!]?|Here(?:'s| is)[^\n:]*:)\s*/i, '');
    s = s.replace(/^\s*(?:DM|Dungeon Master|Narrator)\s*:\s*/i, '');
    s = s.replace(/^\s*```(?:\w+)?\s*/,'').replace(/\s*```\s*$/,'');
    /* Trailing offers to help, which no narrator has ever made. */
    s = s.replace(/\n+\s*(?:What (?:would you like|do you) .*|Let me know .*|Would you like .*)$/i, '');
    return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /** Truncate to the last complete sentence, so a token cap never cuts mid-word. */
  function trimToSentence(text, maxWords) {
    var s = String(text || '').trim();
    if (maxWords) {
      var words = s.split(/\s+/);
      if (words.length > maxWords) s = words.slice(0, maxWords).join(' ');
    }
    var m = s.match(/^[\s\S]*[.!?]["')\u201d\u2019\]]?/);
    /* Keep the whole thing only when trimming would leave almost nothing —
       one very long unfinished sentence reads better than a two-word stub.
       Otherwise a dangling fragment is always worse than a clean stop. */
    if (m && m[0].length >= 15 && m[0].length > s.length * 0.25) return m[0].trim();
    return s.trim();
  }

  var api = {
    NUM_CTX: NUM_CTX,
    PROFILES: PROFILES,
    configure: configure,
    current: current,
    isCopilot: isCopilot,
    isOffline: isOffline,
    available: available,
    refreshStatus: refreshStatus,
    chat: chat,
    cleanProse: cleanProse,
    trimToSentence: trimToSentence,
    _state: state,
    _fixtureKey: fixtureKey,
  };

  global.DND = global.DND || {};
  global.DND.Backend = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
