/* Categorías de productos: lista única (sin repetidos por mayúsculas, acentos o plural), selector con "Nueva categoría" y piezas vendidas por categoría.
 * Todo se calcula en la app a partir de lo que ya está en Productos: no cambia el Sheet ni el servidor. */
(function () {
  const { h } = UI;
  const CPR = HOOD.CPR, CV = HOOD.CV;

  /** "Playeras", "playera" y "PLAYERAS " son la misma categoría. */
  const clave = s => UI.norm(String(s == null ? '' : s)).trim().replace(/\s+/g, ' ').split(' ').map(w => (w.length > 3 ? w.replace(/s$/, '') : w)).join(' ');

  /** Categorías existentes: [{ nombre, k, n }] sin repetidos; usa la forma de escribirla más frecuente. */
  function lista(db) {
    const g = {};
    db.productos.forEach(r => {
      if (r[0] === '' || r[0] == null) return;
      const c = String(r[CPR.CAT] == null ? '' : r[CPR.CAT]).trim().replace(/\s+/g, ' ');
      if (!c) return;
      const k = clave(c), x = g[k] || (g[k] = { k, vars: {}, n: 0 });
      x.vars[c] = (x.vars[c] || 0) + 1; x.n++;
    });
    return Object.keys(g).map(k => {
      const x = g[k], nombre = Object.keys(x.vars).sort((a, b) => x.vars[b] - x.vars[a] || a.localeCompare(b, 'es'))[0];
      return { nombre, k, n: x.n };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  /** Si ya existe una categoría igual (aunque cambie mayúsculas, acentos o plural) devuelve la ya existente. */
  function canonica(db, texto) {
    const t = String(texto == null ? '' : texto).trim().replace(/\s+/g, ' ');
    if (!t) return '';
    const k = clave(t), hit = lista(db).find(c => c.k === k);
    return hit ? hit.nombre : t;
  }

  /** Selector con las categorías existentes y la opción "➕ Nueva categoría…". Devuelve { el, valor(), nueva() }. */
  function selector(db, actual) {
    const cats = lista(db), act = String(actual == null ? '' : actual).trim(), k0 = act ? clave(act) : '';
    const sel = h('select', { 'aria-label': 'Categoría' });
    sel.appendChild(h('option', { value: '' }, 'Elige una categoría…'));
    cats.forEach(c => sel.appendChild(h('option', { value: c.nombre }, c.nombre)));
    const opNueva = h('option', { value: '__nueva' }, '➕ Nueva categoría…');
    sel.appendChild(opNueva);
    const hit = cats.find(c => c.k === k0);
    if (hit) sel.value = hit.nombre;
    else if (act) { sel.insertBefore(h('option', { value: act }, act), opNueva); sel.value = act; }
    const nueva = h('input', { type: 'text', maxlength: '40', autocomplete: 'off', placeholder: 'Escribe el nombre de la nueva categoría', style: { display: 'none', marginTop: '8px' } });
    sel.addEventListener('change', () => { const n = sel.value === '__nueva'; nueva.style.display = n ? '' : 'none'; if (n) nueva.focus(); });
    return {
      el: h('div', null, sel, nueva),
      valor: () => (sel.value === '__nueva' ? canonica(db, nueva.value) : sel.value),
      nueva: () => sel.value === '__nueva' && canonica(db, nueva.value) !== '' && !cats.some(c => c.k === clave(nueva.value))
    };
  }

  /** Piezas vendidas por categoría en el periodo (las mismas ventas que cuenta el Resumen). */
  function piezas(db, ini, fin) {
    const cat = {};
    db.productos.forEach(r => { if (r[0] !== '' && r[0] != null) cat[String(r[0])] = String(r[CPR.CAT] == null ? '' : r[CPR.CAT]).trim() || 'Sin categoría'; });
    const nombres = {}; lista(db).forEach(c => { nombres[c.k] = c.nombre; });
    const g = {}; let total = 0;
    db.ventas.forEach(f => {
      if (f[CV.ID] === '' || f[CV.FECHA] === '' || f[CV.FECHA] < ini || f[CV.FECHA] > fin) return;
      const n = HOOD.num(f[CV.CANT]); if (!(n > 0)) return;
      const c = cat[String(f[CV.CODIGO])] || 'Sin categoría', k = clave(c), x = g[k] || (g[k] = { categoria: nombres[k] || c, piezas: 0, vendido: 0 });
      x.piezas += n; x.vendido += HOOD.num(f[CV.TOTAL]); total += n;
    });
    const filas = Object.keys(g).map(k => g[k]).sort((a, b) => b.piezas - a.piezas || b.vendido - a.vendido);
    filas.forEach(x => { x.vendido = HOOD.r2(x.vendido); x.pct = total ? x.piezas / total : 0; });
    return { total, filas };
  }

  /** Gráfica de barras horizontales: una barra por categoría, la más vendida arriba y resaltada. */
  function grafica(r, vacio) {
    if (!r.filas.length) return h('div', { class: 'suave' }, vacio || 'Sin ventas en el periodo.');
    const max = Math.max(1, r.filas[0].piezas);
    return h('div', { class: 'barras-cat', role: 'img', 'aria-label': 'Piezas vendidas por categoría' }, r.filas.map((x, i) => h('div', { class: 'bc-fila' + (i === 0 ? ' lider' : '') },
      h('div', { class: 'bc-et' }, x.categoria),
      h('div', { class: 'bc-tira' }, h('div', { style: { width: Math.max(2, x.piezas / max * 100) + '%' } })),
      h('div', { class: 'bc-num' }, UI.num(x.piezas), h('small', null, ' · ' + Math.round(x.pct * 100) + '%')))));
  }

  /** Existencia por categoría (solo productos activos): piezas, productos, cuántos van bajos y cuántos agotados. De menos a más piezas. */
  function existencia(inv) {
    const g = {}, nombres = {};
    inv.filter(p => p.activo).forEach(p => {
      const c = String(p.cat || '').trim().replace(/\s+/g, ' ') || 'Sin categoría', k = clave(c);
      nombres[k] = nombres[k] || {}; nombres[k][c] = (nombres[k][c] || 0) + 1;
      const x = g[k] || (g[k] = { k, piezas: 0, productos: 0, bajos: 0, agotados: 0 });
      x.piezas += Math.max(0, p.existencia); x.productos++;
      if (p.estado === 'AGOTADO') x.agotados++; else if (p.estado === 'BAJO') x.bajos++;
    });
    return Object.keys(g).map(k => { const x = g[k], v = nombres[k]; x.categoria = Object.keys(v).sort((a, b) => v[b] - v[a] || a.localeCompare(b, 'es'))[0]; return x; })
      .sort((a, b) => a.piezas - b.piezas || a.categoria.localeCompare(b.categoria, 'es'));
  }

  /** Tarjeta "Piezas por categoría" para Inventario: barras de existencia; las categorías con productos bajos o agotados se marcan. */
  function tarjetaExistencia(inv) {
    const filas = existencia(inv);
    if (!filas.length) return null;
    const max = Math.max(1, ...filas.map(x => x.piezas));
    return h('div', { class: 'card' }, h('h3', null, 'Piezas por categoría'),
      h('div', { class: 'barras-cat stock', role: 'img', 'aria-label': 'Piezas disponibles por categoría' }, filas.map((x, i) => h('div', { class: 'bc-fila' + (x.agotados || x.bajos ? ' poco' : '') },
        h('div', { class: 'bc-et' }, x.categoria),
        h('div', { class: 'bc-tira' }, h('div', { style: { width: Math.max(2, x.piezas / max * 100) + '%' } })),
        h('div', { class: 'bc-num' }, UI.num(x.piezas), h('small', null, ' pzs'))))),
      h('div', { class: 'bc-notas' }, filas.filter(x => x.agotados || x.bajos).map(x => h('div', null, h('strong', null, x.categoria + ': '),
        [x.agotados ? x.agotados + (x.agotados === 1 ? ' producto agotado' : ' productos agotados') : '', x.bajos ? x.bajos + (x.bajos === 1 ? ' con existencia baja' : ' con existencia baja') : ''].filter(Boolean).join(' · ')))),
      filas.some(x => x.agotados || x.bajos) ? null : h('small', { class: 'suave' }, 'Ninguna categoría con productos bajos ni agotados.'),
      h('small', { class: 'suave', style: { display: 'block', marginTop: '6px' } }, 'Ordenadas de menos a más piezas. En ámbar: la categoría tiene productos bajos o agotados.'));
  }

  window.Cats = { clave, lista, canonica, selector, piezas, grafica, existencia, tarjetaExistencia };
})();
