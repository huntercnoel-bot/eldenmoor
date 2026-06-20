// net.js — talks to the Eldenmoor multiplayer server over a WebSocket.
// Connects to the same host/port the game was served from.

export function createNet() {
  let ws = null;
  const handlers = {};

  function on(type, fn) { handlers[type] = fn; }
  function emit(type, data) { const h = handlers[type]; if (h) h(data); }

  function connect() {
    return new Promise((resolve, reject) => {
      try {
        const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
        ws = new WebSocket(proto + location.host);
      } catch (e) { reject(e); return; }
      let settled = false;
      const done = (fn, arg) => { if (settled) return; settled = true; clearTimeout(to); fn(arg); };
      const to = setTimeout(() => done(reject, new Error('timeout')), 5000);   // don't hang forever (e.g. no server)
      ws.onopen = () => done(resolve);
      ws.onerror = () => done(reject, new Error('Could not reach the server.'));
      ws.onclose = () => emit('close');
      ws.onmessage = (ev) => {
        let d; try { d = JSON.parse(ev.data); } catch (e) { return; }
        emit(d.t, d);
      };
    });
  }

  function send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
  function ready() { return !!ws && ws.readyState === 1; }

  return { connect, send, on, ready };
}
