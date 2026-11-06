// 7-Segment GPIO Viewer
// Reads a GPIO register every time the debugger halts and draws a 7-seg display.
const vscode = require('vscode');

let panel = null;
let lastState = { value: null, status: 'Waiting for debugger to halt…' };

function cfg() {
  const c = vscode.workspace.getConfiguration('ssegViewer');
  return {
    address: c.get('address', '0x40020814'),
    bitOffset: c.get('bitOffset', 0),
    activeLow: c.get('activeLow', false),
    autoOpen: c.get('autoOpen', true),
  };
}

// Read a 32-bit word. Try PlatformIO's custom read-memory, then DAP readMemory
// (cortex-debug etc.), then fall back to a GDB expression.
async function readWord(session, threadId) {
  const { address } = cfg();
  const addrNum = Number(address);
  const errors = [];

  if (session.type === 'platformio-debug') {
    try {
      const res = await session.customRequest('read-memory', { address: addrNum, length: 4 });
      if (res && Array.isArray(res.bytes) && res.bytes.length >= 4) {
        return Buffer.from(res.bytes.slice(0, 4)).readUInt32LE(0);
      }
      errors.push('read-memory: ' + JSON.stringify(res));
    } catch (e) { errors.push('read-memory: ' + (e.message || e)); }
  }

  try {
    const res = await session.customRequest('readMemory', { memoryReference: address, count: 4 });
    if (res && res.data) {
      const buf = Buffer.from(res.data, 'base64');
      if (buf.length >= 4) return buf.readUInt32LE(0);
    }
  } catch (_) { /* adapter may not support readMemory */ }

  let frameId;
  try {
    if (threadId === undefined) {
      const t = await session.customRequest('threads');
      threadId = t && t.threads && t.threads[0] && t.threads[0].id;
    }
    if (threadId !== undefined) {
      const st = await session.customRequest('stackTrace', { threadId, startFrame: 0, levels: 1 });
      frameId = st && st.stackFrames && st.stackFrames[0] && st.stackFrames[0].id;
    }
  } catch (_) { /* no frame: evaluate globally */ }

  const expr = `*(unsigned int *)${address}`;
  for (const context of ['watch', 'hover']) {
    try {
      const r = await session.customRequest('evaluate', { expression: expr, frameId, context });
      const m = r && typeof r.result === 'string' && r.result.trim().match(/^(0x[0-9a-f]+|\d+)/i);
      if (m) return Number(m[1]) >>> 0;
      errors.push(`evaluate/${context}: ${r && r.result}`);
    } catch (e) { errors.push(`evaluate/${context}: ${e.message || e}`); }
  }
  throw new Error(`Could not read ${address} [${session.type}] — ${errors.join(' | ')}`);
}

async function update(session, threadId) {
  if (!session) {
    lastState = { value: null, status: 'No active debug session' };
  } else {
    try {
      const value = await readWord(session, threadId);
      lastState = { value, status: `Read at ${new Date().toLocaleTimeString()}` };
    } catch (e) {
      lastState = { value: lastState.value, status: String(e.message || e) };
    }
  }
  render();
}

function render() {
  if (!panel) return;
  const { address, bitOffset, activeLow } = cfg();
  panel.webview.postMessage({ ...lastState, address, bitOffset, activeLow });
}

function showPanel(context) {
  if (panel) { panel.reveal(vscode.ViewColumn.Beside, true); return; }
  panel = vscode.window.createWebviewPanel(
    'ssegViewer', '7-Seg', { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: true, retainContextWhenHidden: true }
  );
  panel.webview.html = html();
  panel.onDidDispose(() => { panel = null; }, null, context.subscriptions);
  panel.webview.onDidReceiveMessage(m => {
    if (m === 'ready') render();
    if (m === 'refresh') update(vscode.debug.activeDebugSession);
  }, null, context.subscriptions);
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('ssegViewer.show', () => showPanel(context)),
    vscode.commands.registerCommand('ssegViewer.refresh', () => update(vscode.debug.activeDebugSession)),

    vscode.debug.registerDebugAdapterTrackerFactory('*', {
      createDebugAdapterTracker(session) {
        return {
          onDidSendMessage(msg) {
            if (msg.type === 'event' && msg.event === 'stopped') {
              const threadId = msg.body && msg.body.threadId;
              // Small delay so the adapter finishes its own stop handling first.
              setTimeout(() => update(session, threadId), 50);
            }
          },
        };
      },
    }),

    vscode.debug.onDidStartDebugSession(() => {
      if (cfg().autoOpen) showPanel(context);
      lastState = { value: null, status: 'Running… (halt or hit a breakpoint to read)' };
      render();
    }),
    vscode.debug.onDidTerminateDebugSession(() => {
      lastState = { ...lastState, status: 'Debug session ended (showing last value)' };
      render();
    }),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('ssegViewer')) render();
    })
  );
}

function html() {
  return /* html */ `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 16px; }
  .wrap { display: flex; flex-direction: column; align-items: center; gap: 14px; }
  svg { width: 180px; height: auto; background: #111; border-radius: 8px; padding: 12px; }
  .seg { fill: #2a0d0d; transition: fill .08s; }
  .seg.on { fill: #ff3b30; filter: drop-shadow(0 0 4px #ff3b30); }
  table { border-collapse: collapse; font-family: var(--vscode-editor-font-family); font-size: 12px; }
  td, th { padding: 2px 6px; text-align: center; border: 1px solid var(--vscode-panel-border); }
  td.on { background: #ff3b3055; }
  .meta { font-family: var(--vscode-editor-font-family); font-size: 12px; text-align: center; line-height: 1.6; }
  .status { opacity: .7; font-size: 11px; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 0; padding: 4px 12px; cursor: pointer; }
</style></head>
<body><div class="wrap">
  <svg viewBox="0 0 120 200">
    <g transform="skewX(-6) translate(14 0)">
      <polygon id="a" class="seg" points="22,10 82,10 92,18 82,26 22,26 12,18"/>
      <polygon id="b" class="seg" points="86,22 94,30 94,92 86,100 78,92 78,30"/>
      <polygon id="c" class="seg" points="86,104 94,112 94,174 86,182 78,174 78,112"/>
      <polygon id="d" class="seg" points="22,178 82,178 92,186 82,194 22,194 12,186"/>
      <polygon id="e" class="seg" points="16,104 24,112 24,174 16,182 8,174 8,112"/>
      <polygon id="f" class="seg" points="16,22 24,30 24,92 16,100 8,92 8,30"/>
      <polygon id="g" class="seg" points="22,94 82,94 90,102 82,110 22,110 14,102"/>
    </g>
    <circle id="dp" class="seg" cx="112" cy="188" r="7"/>
  </svg>
  <table><tr id="hdr"></tr><tr id="bits"></tr></table>
  <div class="meta"><div id="raw">—</div><div id="addr"></div><div class="status" id="status"></div></div>
  <button id="refresh">Refresh</button>
</div>
<script>
  const vscode = acquireVsCodeApi();
  const names = ['a','b','c','d','e','f','g','dp'];
  document.getElementById('refresh').onclick = () => vscode.postMessage('refresh');
  window.addEventListener('message', ({ data }) => {
    const { value, status, address, bitOffset, activeLow } = data;
    document.getElementById('status').textContent = status || '';
    document.getElementById('addr').textContent = address + ', bits ' + bitOffset + '–' + (bitOffset + 7) + (activeLow ? ' (active-low)' : '');
    let hdr = '', bits = '';
    names.forEach((n, i) => {
      const bit = value == null ? 0 : (value >>> (bitOffset + i)) & 1;
      const on = value != null && (activeLow ? bit === 0 : bit === 1);
      document.getElementById(n).classList.toggle('on', on);
      hdr += '<th>' + n + '</th>';
      bits += '<td class="' + (on ? 'on' : '') + '">' + (value == null ? '·' : bit) + '</td>';
    });
    document.getElementById('hdr').innerHTML = hdr;
    document.getElementById('bits').innerHTML = bits;
    document.getElementById('raw').textContent = value == null ? '—'
      : '0x' + value.toString(16).toUpperCase().padStart(8, '0') + '  (byte 0x' + ((value >>> bitOffset) & 0xFF).toString(16).toUpperCase().padStart(2, '0') + ')';
  });
  vscode.postMessage('ready');
</script></body></html>`;
}

function deactivate() {}

module.exports = { activate, deactivate };
