/* HOOD 405 · datos locales, cola de operaciones y sincronización
 *
 * - Lo que el servidor sabe llega como "foto" (snapshot) y se guarda en el dispositivo (IndexedDB).
 * - Todo lo que haces se guarda como "operación" en una cola. La pantalla muestra la foto + la cola aplicada con el mismo núcleo (core.js)
 *   que usa el servidor, por eso funciona igual sin internet.
 * - Al haber internet las operaciones se envían; el servidor decide (es la autoridad) y regresa una foto nueva.
 */
const Store = (() => {
  const LS = (() => { try { return window.localStorage; } catch (e) { return { getItem: () => null, setItem() {}, removeItem() {} }; } })();
  const SS = (() => { try { return window.sessionStorage; } catch (e) { return { getItem: () => null, setItem() {}, removeItem() {} }; } })();

  /* ---------- IndexedDB (con respaldo en memoria) ---------- */
  const memoria = {};
  let dbp = null;
  const idb = () => dbp || (dbp = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('sin IndexedDB'));
    const r = indexedDB.open('hood405', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  async function kvGet(k) {
    try { const d = await idb(); return await new Promise((res, rej) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
    catch (e) { return memoria[k]; }
  }
  async function kvSet(k, v) {
    memoria[k] = v;
    try { const d = await idb(); await new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
    catch (e) { /* queda en memoria */ }
  }

  /* ---------- estado ---------- */
  const S = {
    api: LS.getItem('hood_api') || (window.HOOD_CONFIG && window.HOOD_CONFIG.apiUrl) || '',
    users: [], user: null, key: '', snap: null, rev: '0',
    queue: [], rejected: [], view: null, hoy: UI.hoyLocal(),
    online: navigator.onLine, syncing: false, lastSync: 0, lastError: '', listo: false
  };
  const subs = [];
  const on = fn => { subs.push(fn); return () => subs.splice(subs.indexOf(fn), 1); };
  const emit = (tipo) => subs.slice().forEach(f => { try { f(tipo); } catch (e) { console.error(e); } });

  const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const clon = x => JSON.parse(JSON.stringify(x));

  /* ---------- proyección local: foto del servidor + cola ---------- */
  function ctxDe(cfg, nombre) {
    if (S.user.rol === 'dueno' && nombre === cfg.duenoNombre) return { rol: 'dueno', usuario: nombre };
    return cfg.vendedores.some(v => v.nombre === nombre) ? { rol: 'vendedor', usuario: nombre } : null;
  }
  const mias = () => S.queue.filter(o => S.user && (S.user.rol === 'dueno' || o.por === S.user.usuario));
  function rebuild() {
    S.hoy = UI.hoyLocal();
    if (!S.snap) { S.view = null; return; }
    const db = HOOD.normalizar(clon(S.snap.db));
    mias().forEach(op => { const ctx = ctxDe(db.config, op.por); if (ctx) HOOD.aplicarSeguro(db, op, ctx); });
    S.view = db;
  }

  /* ---------- guardado ---------- */
  const guardarCola = () => kvSet('queue', S.queue);
  const guardarRechazos = () => kvSet('rejected', S.rejected);
  const guardarSnap = () => (S.user ? kvSet('snap:' + S.user.usuario, { snap: S.snap, rev: S.rev, t: S.lastSync }) : Promise.resolve());
  const guardarUsuarios = () => kvSet('users', S.users);

  async function iniciar() {
    S.users = (await kvGet('users')) || [];
    S.queue = (await kvGet('queue')) || [];
    S.rejected = (await kvGet('rejected')) || [];
    S.listo = true;
    emit('data');
  }

  /* ---------- red ---------- */
  async function llamar(body, ms) {
    if (!S.api) throw Object.assign(new Error('Falta la dirección de conexión'), { config: true });
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 45000);
    let resp;
    try { resp = await fetch(S.api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctl.signal, redirect: 'follow' }); }
    catch (e) { throw Object.assign(new Error('Sin conexión con el servidor'), { red: true }); }
    finally { clearTimeout(t); }
    let txt = '';
    try { txt = await resp.text(); return JSON.parse(txt); }
    catch (e) { throw Object.assign(new Error('La dirección de conexión no responde como la app espera. Revisa que sea la URL de la aplicación web (termina en /exec) y que el acceso sea "Cualquier persona".'), { config: true }); }
  }
  const esRed = e => e && (e.red || e.name === 'AbortError');

  /* ---------- sesión ---------- */
  function hashClave(salt, clave) { return HOOD.sha256(salt + '|' + clave); }

  async function entrar(clave, apiNueva) {
    clave = String(clave || '').trim();
    if (!clave) return { ok: false, msg: 'Escribe tu PIN o contraseña' };
    if (apiNueva !== undefined) { S.api = String(apiNueva).trim(); LS.setItem('hood_api', S.api); }
    const conocido = S.users.find(u => hashClave(u.salt, clave) === u.hash);
    // 1) con internet se valida contra el servidor (siempre manda la última palabra)
    if (S.api && (navigator.onLine || !conocido)) {
      try {
        const r = await llamar({ a: 'sync', k: clave, ops: [], full: true }, 30000);
        if (!r.ok) {
          if (r.auth === false && conocido) { S.users = S.users.filter(u => u !== conocido); await guardarUsuarios(); }
          return { ok: false, msg: r.msg || 'No se pudo entrar' };
        }
        const salt = nuevoId();
        S.users = S.users.filter(u => u.usuario !== r.usuario);
        S.users.push({ salt, hash: hashClave(salt, clave), rol: r.rol, usuario: r.usuario });
        await guardarUsuarios();
        S.user = { rol: r.rol, usuario: r.usuario }; S.key = clave;
        S.snap = r.snap; S.rev = r.rev; S.lastSync = Date.now(); S.online = true; S.lastError = '';
        await guardarSnap();
        SS.setItem('hood_k', clave);
        rebuild(); emit('login'); sincronizarPronto();
        return { ok: true };
      } catch (e) { if (!esRed(e)) return { ok: false, msg: e.message }; S.online = false; }
    }
    // 2) sin internet: solo entra quien ya había entrado antes en este dispositivo
    if (!conocido) return { ok: false, msg: S.api ? 'Sin internet. La primera vez que entras en este dispositivo se necesita conexión.' : 'Pega primero la dirección de conexión.' };
    const guardado = await kvGet('snap:' + conocido.usuario);
    if (!guardado || !guardado.snap) return { ok: false, msg: 'Sin internet y todavía no hay datos guardados en este dispositivo.' };
    S.user = { rol: conocido.rol, usuario: conocido.usuario }; S.key = clave;
    S.snap = guardado.snap; S.rev = guardado.rev; S.lastSync = guardado.t || 0;
    SS.setItem('hood_k', clave);
    rebuild(); emit('login');
    return { ok: true, offline: true };
  }

  async function reanudar() {
    const k = SS.getItem('hood_k');
    if (!k || S.user) return false;
    const r = await entrar(k);
    if (!r.ok) SS.removeItem('hood_k');
    return r.ok;
  }

  function salir() {
    S.user = null; S.key = ''; S.snap = null; S.view = null; SS.removeItem('hood_k');
    emit('logout');
  }

  /* ---------- operaciones ---------- */
  /** Guarda una operación en la cola (y la aplica a la pantalla al instante). Devuelve el resultado local. */
  async function hacer(tipo, args) {
    if (!S.user || !S.view) return { ok: false, msg: 'Inicia sesión' };
    if (S.user.rol === 'vendedor' && !HOOD.OFFLINE_VENDEDOR[tipo]) return { ok: false, msg: 'Esta acción necesita conexión' };
    const op = { id: nuevoId(), tipo, por: S.user.usuario, f: UI.hoyLocal(), h: UI.horaLocal(), args };
    const ctx = ctxDe(S.view.config, op.por);
    const r = HOOD.aplicarSeguro(S.view, op, ctx);
    if (!r.ok) { rebuild(); return r; }
    S.queue.push(op);
    await guardarCola();
    emit('data');
    sincronizarPronto();
    return Object.assign({ pendiente: true }, r);
  }

  /** Para acciones del vendedor que necesitan consultar cuentas en el servidor (crédito, abonos, apartados). No se encolan. */
  async function hacerEnLinea(tipo, args, idOp) {
    if (!S.user) return { ok: false, msg: 'Inicia sesión' };
    const op = { id: idOp || nuevoId(), tipo, por: S.user.usuario, f: UI.hoyLocal(), h: UI.horaLocal(), args };
    try {
      const r = await llamar({ a: 'sync', k: S.key, ops: [op], rev: S.rev }, 40000);
      if (!r.ok) return { ok: false, msg: r.msg || 'No se pudo completar', retry: !!r.retry };
      if (r.snap) { S.snap = r.snap; S.rev = r.rev; S.lastSync = Date.now(); await guardarSnap(); rebuild(); emit('data'); }
      const res = (r.res || {})[op.id] || { ok: false, msg: 'El servidor no respondió esta operación' };
      S.online = true; emit('status');
      return res;
    } catch (e) {
      if (esRed(e)) { S.online = false; emit('status'); return { ok: false, red: true, msg: 'Sin conexión. Esta acción necesita internet; vuelve a intentarlo.' }; }
      return { ok: false, msg: e.message };
    }
  }

  /** Consultas de solo lectura al servidor (cuenta de un cliente, apartados de un cliente). */
  async function consultar(a, tel) {
    if (!S.user) return { ok: false, msg: 'Inicia sesión' };
    try { const r = await llamar({ a, k: S.key, tel }, 30000); S.online = true; return r; }
    catch (e) { if (esRed(e)) { S.online = false; emit('status'); return { ok: false, red: true, msg: 'Sin conexión. Esta consulta necesita internet.' }; } return { ok: false, msg: e.message }; }
  }

  /* ---------- sincronización ---------- */
  let temporizador = null;
  function sincronizarPronto() { clearTimeout(temporizador); temporizador = setTimeout(() => sync(), 400); }

  async function sync(o) {
    o = o || {};
    if (S.syncing || !S.user || !S.key || !S.api) return;
    if (!navigator.onLine && !o.forzar) { S.online = false; emit('status'); return; }
    S.syncing = true; emit('status');
    try {
      for (let vuelta = 0; vuelta < 12; vuelta++) {
        const lote = mias().slice(0, 40);
        const r = await llamar({ a: 'sync', k: S.key, ops: lote, rev: S.rev, full: !!(o.completo || !S.snap) });
        S.online = true;
        if (!r.ok) {
          if (r.auth === false) { S.lastError = 'Tu PIN o contraseña cambió. Vuelve a entrar.'; emit('authfail'); break; }
          S.lastError = r.msg || 'No se pudo sincronizar';
          break;
        }
        S.lastError = '';
        const enviadas = {}; lote.forEach(x => { enviadas[x.id] = x; });
        let cambioCola = false;
        lote.forEach(x => {
          const res = (r.res || {})[x.id];
          if (!res && r.same) return;
          if (res && res.retry) return;
          S.queue = S.queue.filter(y => y.id !== x.id); cambioCola = true;
          if (!res || res.ok === false) S.rejected.push({ id: x.id, tipo: x.tipo, por: x.por, f: x.f, h: x.h, resumen: resumenOp(x), msg: res && res.msg ? res.msg : 'El servidor no la aceptó', t: Date.now() });
        });
        if (r.snap) { S.snap = r.snap; S.rev = r.rev; }
        else if (r.same && S.snap) S.snap.hoy = r.hoy;
        S.lastSync = Date.now();
        if (cambioCola) { await guardarCola(); await guardarRechazos(); }
        if (r.snap) await guardarSnap();
        rebuild(); emit('data');
        if (!mias().length || r.same) break;
      }
    } catch (e) {
      if (esRed(e)) { S.online = false; S.lastError = ''; }
      else S.lastError = e.message;
    } finally { S.syncing = false; emit('status'); }
  }

  function resumenOp(op) {
    const a = op.args || {};
    if (op.tipo === 'venta') {
      const items = (a.items || []).map(i => { const p = S.snap && S.snap.db.productos.find(x => String(x[0]) === String(i.codigo)); return (p ? HOOD.textoProd(p) : i.codigo) + ' ×' + i.cantidad; });
      return 'Venta (' + (a.pago || '') + '): ' + items.join(', ');
    }
    return { gasto: 'Gasto: ' + (a.concepto || ''), pago: 'Pago a ' + (a.vendedor || ''), entrada: 'Compra de ' + (a.codigo || ''), producto_alta: 'Alta de ' + (a.codigo || ''),
      config: 'Cambios en Configuración', abono: 'Abono', apartado: 'Apartado', corte: 'Corte de caja', cliente: 'Cliente ' + (a.nombre || '') }[op.tipo] || op.tipo;
  }

  async function descartarRechazos() { S.rejected = []; await guardarRechazos(); emit('status'); }
  async function quitarRechazo(id) { S.rejected = S.rejected.filter(x => x.id !== id); await guardarRechazos(); emit('status'); }

  function setApi(url) { S.api = String(url || '').trim(); LS.setItem('hood_api', S.api); emit('status'); }

  /** Cambió la contraseña o PIN del usuario actual: actualiza la clave en memoria y el acceso sin internet. */
  async function claveCambiada(nueva) {
    S.key = nueva; SS.setItem('hood_k', nueva);
    const u = S.users.find(x => x.usuario === S.user.usuario);
    if (u) { u.salt = nuevoId(); u.hash = hashClave(u.salt, nueva); await guardarUsuarios(); }
  }

  window.addEventListener('online', () => { S.online = true; emit('status'); sync(); });
  window.addEventListener('offline', () => { S.online = false; emit('status'); });
  setInterval(() => { if (S.user && !document.hidden && navigator.onLine) sync(); }, 90000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.user) { rebuild(); emit('data'); sync(); } });

  return { S, on, iniciar, entrar, reanudar, salir, hacer, hacerEnLinea, consultar, sync, descartarRechazos, quitarRechazo, setApi, claveCambiada, pendientes: () => mias().length,
    view: () => S.view, hoy: () => S.hoy, rebuild: () => { rebuild(); emit('data'); }, nuevoId };
})();
