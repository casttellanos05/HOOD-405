/* HOOD 405 · arranque, acceso, barra superior, pestañas y ventana de cuenta */
const App = (() => {
  const { h } = UI;
  const raiz = document.getElementById('app');
  const TABS = {
    dueno: ['venta', 'inventario', 'corte', 'gastos', 'resumen', 'creditos', 'apartados', 'config'],
    vendedor: ['venta', 'comisiones', 'creditos', 'apartados']
  };
  const NOMBRES = { venta: 'Venta', inventario: 'Inventario', corte: 'Corte', gastos: 'Gastos', resumen: 'Resumen', creditos: 'Créditos', apartados: 'Apartados', config: 'Config', comisiones: 'Comisiones' };
  let tab = 'venta', vista = null, estadoEl = null, navEl = null, sucio = false, instalador = null, swNuevo = null;

  /* ---------- acceso ---------- */
  function pantallaAcceso(msgInicial) {
    UI.vaciar(raiz);
    const S = Store.S;
    const clave = UI.entrada({ type: 'password', placeholder: 'PIN o contraseña', autocomplete: 'current-password', inputmode: 'text' });
    const api = UI.entrada({ type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec', value: S.api });
    const msg = h('div', { class: 'msg' }, msgInicial || '');
    const btn = h('button', { class: 'btn primary', type: 'button' }, 'Entrar');
    async function entrar() {
      msg.textContent = ''; btn.disabled = true; btn.textContent = 'Entrando…';
      const r = await Store.entrar(clave.value, api.value);
      btn.disabled = false; btn.textContent = 'Entrar';
      if (!r.ok) { msg.textContent = r.msg; clave.select(); return; }
      if (r.offline) UI.toast('Sin internet: trabajando con los datos guardados en este dispositivo.');
    }
    btn.addEventListener('click', entrar);
    clave.addEventListener('keydown', e => { if (e.key === 'Enter') entrar(); });
    raiz.appendChild(h('div', { class: 'acceso' }, h('div', { class: 'acceso-caja' },
      h('img', { src: 'icons/icon-192.png', alt: 'HOOD 405' }), h('h1', null, 'HOOD 405'), h('div', { class: 'muted' }, 'Punto de venta y control del negocio'),
      UI.campo('Tu PIN o contraseña', clave), btn, msg,
      h('details', { open: !S.api }, h('summary', null, 'Conexión con el Google Sheet'), h('div', { style: { marginTop: '8px' } }, UI.campo('Dirección de la aplicación web (Apps Script)', api, 'Solo se pide una vez en cada dispositivo.'))),
      !navigator.onLine ? h('div', { class: 'aviso ambar', style: { marginTop: '12px', marginBottom: 0 } }, 'Sin internet. Podrás entrar si ya habías entrado antes en este dispositivo.') : null)));
    setTimeout(() => { const a = document.activeElement; if (!a || a === document.body) clave.focus(); }, 60);
  }

  /* ---------- estructura de la app ---------- */
  function armar() {
    UI.vaciar(raiz);
    const S = Store.S, tabs = TABS[S.user.rol];
    if (tabs.indexOf(tab) < 0) tab = 'venta';
    estadoEl = h('button', { class: 'estado', type: 'button', onclick: cuenta }, h('i'), h('span'));
    navEl = h('nav', { class: 'nav', 'aria-label': 'Secciones' });
    vista = h('main', { class: 'cuerpo', id: 'vista' });
    raiz.appendChild(h('div', { class: 'app' },
      h('header', { class: 'top' }, h('img', { class: 'logo', src: 'icons/icon-192.png', alt: '' }), h('div', null, h('div', { class: 'tit' }, 'HOOD 405'), h('div', { class: 'quien' }, S.user.usuario + (S.user.rol === 'dueno' ? ' · dueño' : ' · vendedor'))),
        h('div', { class: 'sp' }), estadoEl, h('button', { class: 'ib', type: 'button', title: 'Cuenta y conexión', 'aria-label': 'Cuenta y conexión', onclick: cuenta }, UI.icono('config'))),
      navEl, vista));
    pintarNav(); pintarEstado(); render();
  }

  function contadores() {
    const db = Store.view(); if (!db) return {};
    const a = Views.avisosActuales();
    return { creditos: a.creditos.length, apartados: a.apartados.length };
  }
  function pintarNav() {
    if (!navEl) return;
    UI.vaciar(navEl);
    const c = contadores();
    TABS[Store.S.user.rol].forEach(t => navEl.appendChild(h('button', { type: 'button', class: t === tab ? 'on' : '', onclick: () => ir(t), 'aria-current': t === tab ? 'page' : null },
      UI.icono(Views[t].icono), h('span', null, NOMBRES[t]), c[t] ? h('span', { class: 'punto' }, c[t]) : null)));
  }
  function ir(t) { tab = t; sucio = false; pintarNav(); render(); window.scrollTo({ top: 0 }); }

  function bannerRechazos() {
    const R = Store.S.rejected;
    if (!R.length) return null;
    return h('div', { class: 'aviso mal' }, h('div', { class: 'fuerte' }, R.length === 1 ? 'Una operación no se pudo guardar en el servidor' : R.length + ' operaciones no se pudieron guardar en el servidor'),
      R.slice(-5).map(x => h('div', { class: 'fila sp', style: { padding: '4px 0' } }, h('span', null, h('b', null, x.resumen), ' — ', x.msg, ' ', h('small', null, '(' + UI.fecha(x.f) + ' ' + UI.hora(x.h) + ')')),
        h('button', { class: 'btn chico', type: 'button', onclick: () => Store.quitarRechazo(x.id).then(render) }, 'Entendido'))),
      h('small', null, 'Revísalo: por ejemplo, si se vendió la última pieza en otro dispositivo, esa venta no pudo entrar.'));
  }

  function render() {
    if (!vista || !Store.S.user || !Store.view()) return;
    sucio = false;
    const y = window.scrollY;
    UI.vaciar(vista);
    const b = bannerRechazos(); if (b) vista.appendChild(b);
    try { Views[tab].render(vista); }
    catch (e) { console.error(e); vista.appendChild(h('div', { class: 'aviso mal' }, 'Ocurrió un error al mostrar esta pantalla: ' + e.message)); }
    pintarNav();
    window.scrollTo({ top: y });
  }

  function pintarEstado() {
    if (!estadoEl) return;
    const S = Store.S, n = Store.pendientes();
    let clase = '', t;
    if (S.syncing) { clase = 'sync'; t = 'Sincronizando…'; }
    else if (S.lastError) { clase = 'err'; t = 'Sin sincronizar'; }
    else if (!S.online || !navigator.onLine) { clase = 'off'; t = 'Sin internet' + (n ? ' · ' + n + ' pendiente' + (n > 1 ? 's' : '') : ''); }
    else if (n) { clase = 'sync'; t = n + ' por enviar'; }
    else t = 'Al día';
    estadoEl.className = 'estado ' + clase;
    estadoEl.lastChild.textContent = t;
  }

  /* ---------- ventana de cuenta ---------- */
  function cuenta() {
    const S = Store.S, n = Store.pendientes();
    const api = UI.entrada({ type: 'url', value: S.api, placeholder: 'https://script.google.com/macros/s/…/exec' });
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const m = UI.modal({ titulo: 'Cuenta y conexión', ancho: '520px', cuerpo: h('div', null,
      h('div', { class: 'card', style: { background: '#fff', boxShadow: 'none', border: '1px solid var(--line)' } },
        h('div', { class: 'fila sp' }, h('span', { class: 'muted' }, 'Usuario'), h('b', null, S.user.usuario + (S.user.rol === 'dueno' ? ' (dueño)' : ' (vendedor)'))),
        h('div', { class: 'fila sp' }, h('span', { class: 'muted' }, 'Estado'), h('b', { class: S.online ? 'ok' : 'ambar' }, S.online && navigator.onLine ? 'Con internet' : 'Sin internet')),
        h('div', { class: 'fila sp' }, h('span', { class: 'muted' }, 'Última sincronización'), h('b', null, S.lastSync ? new Date(S.lastSync).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : 'nunca')),
        h('div', { class: 'fila sp' }, h('span', { class: 'muted' }, 'Operaciones por enviar'), h('b', { class: n ? 'ambar' : 'ok' }, n)),
        S.lastError ? h('div', { class: 'aviso mal', style: { marginTop: '8px', marginBottom: 0 } }, S.lastError) : null),
      h('button', { class: 'btn acento grande', type: 'button', onclick: () => { Store.sync({ completo: true, forzar: true }); m.cerrar(); UI.toast('Sincronizando…'); } }, UI.icono('sync'), 'Sincronizar ahora'),
      S.user.rol === 'dueno' ? h('div', { style: { marginTop: '14px' } }, UI.campo('Dirección de la aplicación web (Apps Script)', api, 'Cámbiala solo si publicas una nueva implementación del script.'),
        h('button', { class: 'btn chico', type: 'button', onclick: () => { Store.setApi(api.value); UI.toast('Dirección guardada', 'ok'); } }, 'Guardar dirección')) : null,
      !instalada ? h('div', { class: 'card', style: { marginTop: '14px', background: '#fff', boxShadow: 'none', border: '1px solid var(--line)' } }, h('h3', null, 'Instalar la app'),
        instalador ? h('button', { class: 'btn primary', type: 'button', onclick: async () => { instalador.prompt(); await instalador.userChoice; instalador = null; m.cerrar(); } }, 'Instalar en este dispositivo')
          : h('small', null, ios ? 'En iPhone/iPad: toca el botón Compartir y elige "Agregar a pantalla de inicio".' : 'En el navegador abre el menú (⋮) y elige "Instalar app" o "Agregar a pantalla de inicio". En computadora aparece un ícono de instalar en la barra de direcciones.')) : null,
      swNuevo ? h('button', { class: 'btn primary grande', type: 'button', style: { marginTop: '12px' }, onclick: () => swNuevo.postMessage('SKIP_WAITING') }, 'Hay una versión nueva · Actualizar') : null),
      acciones: [{ texto: 'Cerrar', tipo: 'ghost' }, { texto: 'Cerrar sesión', tipo: 'danger', onclick: async (cerrar) => {
        if (n && !await UI.confirmar('Hay operaciones sin enviar', 'Tienes ' + n + ' operación(es) guardadas en este dispositivo que aún no llegan al servidor. Se conservan y se enviarán la próxima vez que entres con internet. ¿Cerrar sesión?', 'Cerrar sesión', true)) return;
        cerrar(); Store.salir();
      } }] });
  }

  /* ---------- eventos ---------- */
  function enfocandoCampo() { const a = document.activeElement; return a && vista && vista.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox'; }
  Store.on(tipo => {
    if (tipo === 'login') { tab = 'venta'; armar(); }
    else if (tipo === 'logout') pantallaAcceso();
    else if (tipo === 'authfail') { Store.salir(); setTimeout(() => pantallaAcceso('Tu PIN o contraseña cambió. Vuelve a entrar.'), 50); }
    else if (tipo === 'status') { pintarEstado(); if (vista) { const b = vista.querySelector('.aviso.mal'); if (!b && Store.S.rejected.length) render(); } }
    else if (tipo === 'data') { pintarEstado(); pintarNav(); if (UI.hayModal() || enfocandoCampo()) sucio = true; else render(); }
  });
  document.addEventListener('hood-modal-cerrado', () => { if (sucio && !enfocandoCampo()) render(); });
  document.addEventListener('focusout', () => setTimeout(() => { if (sucio && !UI.hayModal() && !enfocandoCampo()) render(); }, 150));
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); instalador = e; });
  window.addEventListener('appinstalled', () => { instalador = null; });

  /* ---------- service worker ---------- */
  function registrarSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js').then(reg => {
      const aviso = w => { swNuevo = w; UI.toast('Hay una versión nueva de la app. Ábrela en el menú Cuenta para actualizar.', '', 6000); };
      if (reg.waiting && navigator.serviceWorker.controller) aviso(reg.waiting);
      reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) aviso(w); }); });
      setInterval(() => reg.update().catch(() => {}), 3600e3);
    }).catch(() => {});
    // Recarga solo al ACTUALIZAR una app ya instalada (no en la primera instalación, donde el service worker toma el control por primera vez).
    const habiaControlador = !!navigator.serviceWorker.controller;
    let recargado = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!habiaControlador || recargado) return; recargado = true; location.reload(); });
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }

  async function iniciar() {
    registrarSW();
    await Store.iniciar();
    pantallaAcceso();
    Store.reanudar().catch(() => {});
  }

  return { refresh: render, cuenta, iniciar, ir };
})();
document.addEventListener('DOMContentLoaded', () => App.iniciar());
