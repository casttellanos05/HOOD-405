/* HOOD 405 · utilidades de interfaz (sin librerías) */
const UI = (() => {
  /** h('div', {class:'x', onclick: fn}, 'texto', hijo...) */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'readOnly') e[k] = !!v;
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    const add = x => {
      if (x === null || x === undefined || x === false) return;
      if (Array.isArray(x)) x.forEach(add);
      else e.appendChild(x.nodeType ? x : document.createTextNode(String(x)));
    };
    kids.forEach(add);
    return e;
  }
  const $ = (s, r) => (r || document).querySelector(s);
  const vaciar = e => { while (e.firstChild) e.removeChild(e.firstChild); return e; };

  const fmtMon = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
  const money = n => fmtMon.format(Number(n) || 0);
  const money0 = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n) || 0);
  const num = (n, d) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: d === undefined ? 0 : d }).format(Number(n) || 0);
  const pct = n => (Math.round((Number(n) || 0) * 10000) / 100) + '%';
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const pf = f => { const a = String(f).split('-'); return { y: +a[0], m: +a[1], d: +a[2] }; };
  const fecha = f => { if (!f) return '—'; const x = pf(f); return x.d + ' ' + MESES[x.m - 1] + ' ' + x.y; };
  const fechaCorta = f => { if (!f) return '—'; const x = pf(f); return x.d + ' ' + MESES[x.m - 1]; };
  const diaSemana = f => DIAS[new Date(Date.UTC(pf(f).y, pf(f).m - 1, pf(f).d)).getUTCDay()];
  const mesLargo = f => { const x = pf(f); return MESES_L[x.m - 1] + ' ' + x.y; };
  const hora = t => String(t || '').slice(0, 5);
  /** "faltan 3 días", "vence hoy", "vencido hace 2 días" */
  function dias(n) {
    if (n === null || n === undefined) return '';
    if (n < 0) return 'vencido hace ' + (-n) + (n === -1 ? ' día' : ' días');
    if (n === 0) return 'vence hoy';
    return 'faltan ' + n + (n === 1 ? ' día' : ' días');
  }
  const hoyLocal = () => { const d = new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
  const horaLocal = () => { const d = new Date(); return p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()); };
  const p2 = n => (n < 10 ? '0' : '') + n;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* ---------- avisos ---------- */
  function toast(texto, tipo, ms) {
    const cont = $('#toasts');
    const t = h('div', { class: 'toast ' + (tipo || '') }, texto);
    cont.appendChild(t);
    setTimeout(() => { t.classList.add('fuera'); setTimeout(() => t.remove(), 300); }, ms || 3500);
  }

  /* ---------- ventanas ---------- */
  const abiertos = [];
  /** modal({titulo, cuerpo: Node, acciones: [{texto, tipo, onclick(cerrar)}], ancho}) */
  function modal(o) {
    const cerrar = () => { const i = abiertos.indexOf(m); if (i >= 0) abiertos.splice(i, 1); fondo.remove(); document.body.classList.toggle('con-modal', abiertos.length > 0); if (o.alCerrar) o.alCerrar(); document.dispatchEvent(new Event('hood-modal-cerrado')); };
    const m = { cerrar, el: null };
    const cuerpo = h('div', { class: 'modal-cuerpo' }, o.cuerpo);
    const pie = o.acciones && o.acciones.length ? h('div', { class: 'modal-pie' }, o.acciones.map(a => h('button', {
      class: 'btn ' + (a.tipo || ''), type: 'button', id: a.id, disabled: a.disabled,
      onclick: ev => { if (a.cerrar === false) a.onclick(cerrar, ev.currentTarget); else { if (a.onclick) a.onclick(cerrar, ev.currentTarget); else cerrar(); } }
    }, a.texto))) : null;
    const caja = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', style: o.ancho ? { maxWidth: o.ancho } : null },
      h('div', { class: 'modal-cab' }, h('h2', null, o.titulo || ''), h('button', { class: 'cerrar', type: 'button', 'aria-label': 'Cerrar', onclick: cerrar }, '×')), cuerpo, pie);
    const fondo = h('div', { class: 'modal-fondo', onmousedown: ev => { if (ev.target === fondo && !o.fijo) cerrar(); } }, caja);
    document.body.appendChild(fondo); document.body.classList.add('con-modal');
    m.el = caja; abiertos.push(m);
    const primero = caja.querySelector('input:not([type=hidden]),select,textarea');
    if (primero && !o.sinFoco) setTimeout(() => primero.focus(), 50);
    return m;
  }
  const hayModal = () => abiertos.length > 0;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && abiertos.length) abiertos[abiertos.length - 1].cerrar(); });
  function confirmar(titulo, texto, textoBtn, peligro) {
    return new Promise(res => {
      let hecho = false;
      modal({ titulo, cuerpo: h('p', null, texto), alCerrar: () => { if (!hecho) res(false); }, acciones: [
        { texto: 'Cancelar', tipo: 'ghost' }, { texto: textoBtn || 'Aceptar', tipo: peligro ? 'danger' : 'primary', onclick: c => { hecho = true; res(true); c(); } }] });
    });
  }

  /* ---------- formularios ---------- */
  function campo(etiqueta, input, ayuda) { return h('label', { class: 'campo' }, h('span', { class: 'et' }, etiqueta), input, ayuda ? h('small', null, ayuda) : null); }
  const entrada = (o) => h('input', Object.assign({ type: 'text', autocomplete: 'off' }, o));
  const dinero = (o) => h('input', Object.assign({ type: 'number', inputmode: 'decimal', step: '0.01', min: '0', autocomplete: 'off' }, o));
  const opciones = (arr, sel) => arr.map(x => { const v = Array.isArray(x) ? x[0] : x, t = Array.isArray(x) ? x[1] : x; return h('option', { value: v, selected: String(v) === String(sel) }, t); });
  const leerNum = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };

  /** Segmentos tipo pestañas pequeñas. items: [[id, texto]], onsel(id) */
  function segmentos(items, activo, onsel) {
    return h('div', { class: 'seg', role: 'tablist' }, items.map(([id, t]) => h('button', { type: 'button', role: 'tab', class: id === activo ? 'on' : '', 'aria-selected': id === activo, onclick: () => onsel(id) }, t)));
  }
  const badge = (texto, tipo) => h('span', { class: 'badge ' + (tipo || '') }, texto);
  const kpi = (et, valor, nota, tipo) => h('div', { class: 'kpi ' + (tipo || '') }, h('div', { class: 'k-et' }, et), h('div', { class: 'k-val' }, valor), nota ? h('div', { class: 'k-nota' }, nota) : null);
  const vacio = (t) => h('div', { class: 'vacio' }, t);

  /* ---------- gráfica de barras (SVG) ---------- */
  /** datos: [{et, v:[a,b]}] ; colores: ['#..', '#..'] ; leyenda: ['Cobrado','Utilidad neta'] */
  function barras(datos, colores, leyenda, alto) {
    const W = 640, H = alto || 220, L = 46, B = 26, T = 10, R = 8;
    const vals = datos.reduce((a, d) => a.concat(d.v), []);
    const max = Math.max(1, ...vals), min = Math.min(0, ...vals);
    const rango = max - min, y = v => T + (H - T - B) * (1 - (v - min) / rango);
    const pasos = 4, paso = nice(rango / pasos);
    let svg = '';
    for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) {
      svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="g-linea"/><text x="${L - 6}" y="${y(v) + 4}" class="g-eje" text-anchor="end">${esc(abrev(v))}</text>`;
    }
    const ancho = (W - L - R) / datos.length, n = colores.length, bw = Math.max(2, Math.min(26, (ancho * 0.78) / n));
    datos.forEach((d, i) => {
      const x0 = L + ancho * i + (ancho - bw * n) / 2;
      d.v.forEach((v, k) => {
        const y1 = y(Math.max(v, 0)), y2 = y(Math.min(v, 0));
        svg += `<rect x="${x0 + k * bw}" y="${y1}" width="${bw - 1}" height="${Math.max(1, y2 - y1)}" rx="2" fill="${colores[k]}"><title>${esc(d.et)} · ${esc(leyenda[k])}: ${esc(money(v))}</title></rect>`;
      });
      const salto = Math.ceil(datos.length / 12);
      if (i % salto === 0) svg += `<text x="${L + ancho * i + ancho / 2}" y="${H - 8}" class="g-eje" text-anchor="middle">${esc(d.et)}</text>`;
    });
    if (min < 0) svg += `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" class="g-cero"/>`;
    const cont = h('div', { class: 'grafica' });
    cont.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica">${svg}</svg>`;
    cont.appendChild(h('div', { class: 'leyenda' }, leyenda.map((t, k) => h('span', null, h('i', { style: { background: colores[k] } }), t))));
    return cont;
  }
  /* ---------- gráfica de líneas (SVG) ---------- */
  /** datos: [{et, v:[a,b]}] ; series: [{nombre, color, area}] ; alto opcional. Un punto por dato; pasa el cursor o toca un punto para ver el monto. */
  function lineas(datos, series, alto) {
    const W = 640, H = alto || 220, L = 46, B = 26, T = 12, R = 12;
    const vals = datos.reduce((a, d) => a.concat(d.v), []);
    const max = Math.max(1, ...vals), min = Math.min(0, ...vals);
    const rango = max - min, y = v => T + (H - T - B) * (1 - (v - min) / rango);
    const n = datos.length, x = i => n === 1 ? (L + W - R) / 2 : L + (W - L - R) * i / (n - 1);
    const paso = nice(rango / 4);
    let svg = '';
    for (let v = Math.ceil(min / paso) * paso; v <= max + 1e-9; v += paso) {
      svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="g-linea"/><text x="${L - 6}" y="${y(v) + 4}" class="g-eje" text-anchor="end">${esc(abrev(v))}</text>`;
    }
    if (min < 0) svg += `<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" class="g-cero"/>`;
    const salto = Math.ceil(n / 12);
    datos.forEach((d, i) => { if (i % salto === 0) svg += `<text x="${x(i)}" y="${H - 8}" class="g-eje" text-anchor="${x(i) > W - 34 ? 'end' : x(i) < L + 12 ? 'start' : 'middle'}">${esc(d.et)}</text>`; });
    series.forEach((s, k) => {
      const pts = datos.map((d, i) => `${x(i).toFixed(1)},${y(d.v[k]).toFixed(1)}`).join(' ');
      if (s.area && n > 1) svg += `<polygon points="${x(0).toFixed(1)},${y(0).toFixed(1)} ${pts} ${x(n - 1).toFixed(1)},${y(0).toFixed(1)}" fill="${s.color}" opacity=".12"/>`;
      svg += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`;
      datos.forEach((d, i) => { svg += `<circle cx="${x(i).toFixed(1)}" cy="${y(d.v[k]).toFixed(1)}" r="${n > 20 ? 3 : 4.5}" fill="#fff" stroke="${s.color}" stroke-width="2.2"><title>${esc(d.et)} · ${esc(s.nombre)}: ${esc(money(d.v[k]))}</title></circle>`; });
    });
    const cont = h('div', { class: 'grafica' });
    cont.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica de líneas">${svg}</svg>`;
    if (series.length > 1) cont.appendChild(h('div', { class: 'leyenda' }, series.map(s => h('span', null, h('i', { style: { background: s.color } }), s.nombre))));
    return cont;
  }
  function nice(x) { const e = Math.pow(10, Math.floor(Math.log10(x || 1))), f = x / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; }
  function abrev(v) { const a = Math.abs(v); return (v < 0 ? '-' : '') + (a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1e3 ? Math.round(a / 100) / 10 + 'k' : Math.round(a)); }

  /** Barra de progreso. */
  const progreso = (p, tipo) => h('div', { class: 'prog ' + (tipo || '') }, h('div', { style: { width: Math.max(0, Math.min(100, p * 100)) + '%' } }));

  /** Íconos de trazo simple (24x24). */
  const ICONOS = {
    venta: 'M6 7h12l-1 12H7L6 7zm3 0a3 3 0 0 1 6 0',
    inventario: 'M4 8l8-4 8 4v8l-8 4-8-4V8zm0 0l8 4m0 0l8-4m-8 4v8',
    corte: 'M9 4h6l1 2h3v14H5V6h3l1-2zm-1 9l3 3 5-6',
    gastos: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zm3 5h6m-6 4h6',
    resumen: 'M5 20V10m5 10V4m5 16v-7m5 7H3',
    creditos: 'M3 7h18v10H3V7zm0 3h18m-14 5h3',
    apartados: 'M7 3h10v18l-5-4-5 4V3z',
    config: 'M5 7h9m4 0h1M5 17h3m4 0h7M14 5v4m-4 6v4',
    vendedores: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7 0a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5zM3 19c0-3.200 2.700-5 6-5s6 1.800 6 5m1.500-4.800c3-.4 5.500 1.200 5.500 4.800',
    cancelaciones: 'M5 7h14M10 7V4h4v3m-8 0l1 13h10l1-13M10 11v6m4-6v6',
    imprimir: 'M7 8V3h10v5M7 17H4v-7h16v7h-3M7 14h10v7H7v-7z',
    comisiones: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v10m-3-3.5c0 1 1.3 1.5 3 1.5s3-.6 3-1.8c0-2.7-6-1.2-6-3.9C9 9.600 10.300 9 12 9s3 .6 3 1.600',
    sync: 'M20 12a8 8 0 0 1-14 5.300M4 12a8 8 0 0 1 14-5.300M18 3v4h-4M6 21v-4h4',
    salir: 'M10 4H5v16h5m4-4l4-4-4-4m4 4H9',
    mas: 'M12 5v14M5 12h14'
  };
  const icono = (n, cls) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ico ' + (cls || '')); s.setAttribute('aria-hidden', 'true'); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', ICONOS[n] || ''); s.appendChild(p); return s; };

  return { h, $, vaciar, money, money0, num, pct, fecha, fechaCorta, diaSemana, mesLargo, hora, dias, hoyLocal, horaLocal, esc, norm, toast, modal, hayModal, confirmar, campo, entrada, dinero, opciones, leerNum, segmentos, badge, kpi, vacio, barras, lineas, progreso, icono };
})();
