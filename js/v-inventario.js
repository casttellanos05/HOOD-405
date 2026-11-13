/* Pestaña INVENTARIO (dueño): existencias, alta de productos nuevos y compras (reinversión) */
(function () {
  const { h, money } = UI;
  const Views = (window.Views = window.Views || {});
  const est = { sub: 'existencias', q: '', filtro: 'todos', mes: '', max: 40 };


  /** Formulario de producto nuevo = compra inicial = reinversión. */
  function formNuevo(db) {
    const f = {
      codigo: UI.entrada({ placeholder: 'Ej. P010' }), nombre: UI.entrada({ placeholder: 'Ej. Playera oversize' }),
      talla: UI.entrada({ placeholder: 'M, G, 32…' }), color: UI.entrada({ placeholder: 'Negro' }),
      costo: UI.dinero({ placeholder: '0.00' }), precio: UI.dinero({ placeholder: '0.00' }), cant: UI.dinero({ step: '1', placeholder: '0' }), min: UI.dinero({ step: '1', value: '2' }),
      efectivo: h('input', { type: 'checkbox' }), notas: UI.entrada({ placeholder: 'Proveedor, factura…' })
    };
    const resumen = h('div', { class: 'aviso info' });
    const msg = h('div', { class: 'aviso mal', style: { display: 'none' } });
    const calc = () => {
      const c = UI.leerNum(f.costo.value), p = UI.leerNum(f.precio.value), n = Math.floor(UI.leerNum(f.cant.value));
      resumen.textContent = 'Reinversión: ' + money(c * n) + (p > 0 && c > 0 ? ' · Utilidad por pieza: ' + money(p - c) + ' (' + UI.pct((p - c) / p) + ' del precio)' : '');
    };
    ['costo', 'precio', 'cant'].forEach(k => f[k].addEventListener('input', calc)); calc();
    const cuerpo = h('div', null,
      h('div', { class: 'grid2' }, UI.campo('Código', f.codigo), UI.campo('Nombre', f.nombre)),
      h('div', { class: 'grid2' }, UI.campo('Talla', f.talla), UI.campo('Color', f.color)),
      h('div', { class: 'grid2' }, UI.campo('Costo por pieza', f.costo), UI.campo('Precio de venta', f.precio)),
      h('div', { class: 'grid2' }, UI.campo('Piezas compradas', f.cant), UI.campo('Stock mínimo (aviso)', f.min)),
      UI.campo('Notas', f.notas), h('label', { class: 'check' }, f.efectivo, 'Se pagó en efectivo (resta de la caja del corte)'), resumen, msg);
    UI.modal({ titulo: 'Nuevo producto', cuerpo, acciones: [{ texto: 'Cancelar', tipo: 'ghost' }, { texto: 'Guardar', tipo: 'primary', cerrar: false, onclick: async (cerrar, btn) => {
      btn.disabled = true;
      const r = await Store.hacer('producto_alta', { codigo: f.codigo.value, nombre: f.nombre.value, cat: '', talla: f.talla.value, color: f.color.value,
        costo: UI.leerNum(f.costo.value), precio: UI.leerNum(f.precio.value), cant: Math.floor(UI.leerNum(f.cant.value)), min: Math.floor(UI.leerNum(f.min.value)),
        efectivo: f.efectivo.checked, notas: f.notas.value });
      btn.disabled = false;
      if (!r.ok) { msg.textContent = r.msg; msg.style.display = ''; return; }
      cerrar(); UI.toast('Producto guardado' + (r.reinversion ? ' · reinversión ' + money(r.reinversion) : ''), 'ok'); App.refresh();
    } }] });
  }

  /** Detalle de un producto: editar, registrar compra y ver su historial de compras. */
  function detalle(p) {
    const db = Store.view(), C = HOOD.CPR;
    const compras = db.entradas.filter(e => String(e[HOOD.CE.CODIGO]) === String(p.codigo) && e[HOOD.CE.FECHA] !== '').slice().reverse();
    const f = {
      nombre: UI.entrada({ value: p.nombre }), talla: UI.entrada({ value: p.talla }), color: UI.entrada({ value: p.color }),
      costo: UI.dinero({ value: p.costo }), precio: UI.dinero({ value: p.precio }), min: UI.dinero({ step: '1', value: p.min }), activo: h('input', { type: 'checkbox', checked: p.activo })
    };
    const msg = h('div', { class: 'aviso mal', style: { display: 'none' } });
    const comp = { cant: UI.dinero({ step: '1', placeholder: 'Piezas' }), costo: UI.dinero({ value: p.costo }), efectivo: h('input', { type: 'checkbox' }), notas: UI.entrada({ placeholder: 'Notas (opcional)' }), act: h('input', { type: 'checkbox' }) };
    const msg2 = h('div', { class: 'aviso mal', style: { display: 'none' } });
    const cuerpo = h('div', null,
      h('div', { class: 'kpis', style: { marginBottom: '8px' } }, UI.kpi('Existencia', UI.num(p.existencia), p.estado, p.estado === 'OK' ? 'ok' : 'mal'), UI.kpi('Vendido', UI.num(p.vendido), p.porPagar ? p.porPagar + ' por pagar (crédito)' : ''),
        UI.kpi('Apartado', UI.num(p.apartado)), UI.kpi('Valor a costo', money(p.valorCosto))),
      h('h3', null, 'Registrar compra (reinversión)'),
      h('div', { class: 'grid2' }, UI.campo('Piezas compradas', comp.cant), UI.campo('Costo por pieza', comp.costo)),
      UI.campo('Notas', comp.notas),
      h('label', { class: 'check' }, comp.efectivo, 'Pagado en efectivo'), h('label', { class: 'check' }, comp.act, 'Usar este costo como costo actual del producto'), msg2,
      h('button', { class: 'btn acento', type: 'button', onclick: async ev => {
        const btn = ev.currentTarget; btn.disabled = true;
        const r = await Store.hacer('entrada', { codigo: p.codigo, cant: Math.floor(UI.leerNum(comp.cant.value)), costo: UI.leerNum(comp.costo.value), efectivo: comp.efectivo.checked, notas: comp.notas.value, actualizarCosto: comp.act.checked });
        btn.disabled = false;
        if (!r.ok) { msg2.textContent = r.msg; msg2.style.display = ''; return; }
        m.cerrar(); UI.toast('Compra registrada · reinversión ' + money(r.reinversion), 'ok'); App.refresh();
      } }, 'Registrar compra'),
      h('hr', { style: { border: 0, borderTop: '1px solid var(--line)', margin: '16px 0' } }),
      h('h3', null, 'Datos del producto'),
      UI.campo('Nombre', f.nombre),
      h('div', { class: 'grid2' }, UI.campo('Talla', f.talla), UI.campo('Color', f.color)),
      h('div', { class: 'grid3' }, UI.campo('Costo', f.costo), UI.campo('Precio', f.precio), UI.campo('Stock mínimo', f.min)),
      h('label', { class: 'check' }, f.activo, 'Activo (visible para vender)'), msg,
      compras.length ? h('div', null, h('h3', { style: { marginTop: '14px' } }, 'Compras de este producto'),
        h('div', { class: 'lista' }, compras.slice(0, 15).map(e => h('div', { class: 'item' },
          h('div', { class: 'grow' }, h('div', { class: 't1' }, UI.fecha(e[HOOD.CE.FECHA]) + ' · ' + UI.num(e[HOOD.CE.CANT]) + ' pzs'), h('div', { class: 't2' }, 'a ' + money(e[HOOD.CE.COSTO]) + ' c/u' + (e[HOOD.CE.NOTAS] ? ' · ' + e[HOOD.CE.NOTAS] : ''))),
          h('div', { class: 'monto' }, money(e[HOOD.CE.TOTAL])),
          HOOD.num(e[HOOD.CE.CANT]) > 0 ? h('button', { class: 'btn chico ghost', type: 'button', onclick: async () => {
            if (!await UI.confirmar('Anular compra', 'Se quitan ' + e[HOOD.CE.CANT] + ' piezas de la existencia y la reinversión de ' + money(e[HOOD.CE.TOTAL]) + '. ¿Continuar?', 'Anular', true)) return;
            const r = await Store.hacer('entrada_anular', { id: e[HOOD.CE.ID] });
            if (!r.ok) { UI.toast(r.msg, 'mal', 5000); return; }
            m.cerrar(); UI.toast('Compra anulada'); App.refresh();
          } }, 'Anular') : null)))) : null);
    const m = UI.modal({ titulo: p.texto, cuerpo, ancho: '640px', acciones: [{ texto: 'Cerrar', tipo: 'ghost' }, { texto: 'Guardar datos', tipo: 'primary', cerrar: false, onclick: async (cerrar, btn) => {
      btn.disabled = true;
      const r = await Store.hacer('producto_edit', { codigo: p.codigo, nombre: f.nombre.value, cat: p.cat, talla: f.talla.value, color: f.color.value, costo: UI.leerNum(f.costo.value), precio: UI.leerNum(f.precio.value), min: Math.floor(UI.leerNum(f.min.value)), activo: f.activo.checked });
      btn.disabled = false;
      if (!r.ok) { msg.textContent = r.msg; msg.style.display = ''; return; }
      cerrar(); UI.toast('Producto actualizado', 'ok'); App.refresh();
    } }] });
  }

  function existencias(root, db) {
    const inv = HOOD.inventario(db);
    const activos = inv.filter(p => p.activo);
    const piezas = activos.reduce((a, p) => a + Math.max(0, p.existencia), 0);
    const agot = activos.filter(p => p.estado === 'AGOTADO').length;
    root.appendChild(h('div', { class: 'kpis' }, UI.kpi('Piezas disponibles', UI.num(piezas), activos.length + ' productos activos'),
      UI.kpi('Valor a costo', money0(activos.reduce((a, p) => a + p.valorCosto, 0)), 'lo que tienes invertido'),
      UI.kpi('Valor a precio', money0(activos.reduce((a, p) => a + p.valorPrecio, 0)), 'si todo se vende'),
      UI.kpi('Agotados', agot, agot ? 'productos sin existencia' : 'nada agotado', agot ? 'ambar' : 'ok')));
    const lista = h('div', { class: 'resultados' });
    const chips = h('div', { class: 'fila', style: { marginBottom: '2px' } });
    const cmp = (a, b) => String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true });
    function pintar() {
      UI.vaciar(chips);
      chips.appendChild(UI.segmentos([['todos', 'Todos'], ['agotado', 'Agotados (' + agot + ')'], ['inactivo', 'Inactivos']], est.filtro, id => { est.filtro = id; est.max = 40; pintar(); }));
      UI.vaciar(lista);
      const q = UI.norm(est.q).trim(), palabras = q ? q.split(/\s+/) : [];
      const datos = inv.filter(p => (est.filtro === 'inactivo' ? !p.activo : p.activo) && (est.filtro === 'agotado' ? p.estado === 'AGOTADO' : true) &&
        (!q || (c => c.indexOf(q) >= 0 || palabras.every(w => UI.norm(p.texto + ' ' + p.codigo).indexOf(w) >= 0))(UI.norm(String(p.codigo)))))
        .sort((a, b) => {
          if (!q) return cmp(a, b);
          const ra = UI.norm(String(a.codigo)) === q ? 0 : UI.norm(String(a.codigo)).indexOf(q) === 0 ? 1 : 2, rb = UI.norm(String(b.codigo)) === q ? 0 : UI.norm(String(b.codigo)).indexOf(q) === 0 ? 1 : 2;
          return ra - rb || cmp(a, b);
        });
      if (!datos.length) { lista.appendChild(UI.vacio(q ? 'Ningún producto con “' + est.q.trim() + '”' : 'No hay productos con este filtro.')); return; }
      lista.appendChild(h('div', { class: 'res-cab' }, datos.length + (datos.length === 1 ? ' producto' : ' productos') + (datos.length > est.max ? ' · mostrando ' + est.max + ' (busca por código para encontrar uno)' : '')));
      datos.slice(0, est.max).forEach(p => lista.appendChild(h('button', { type: 'button', class: 'res inv ' + (p.estado === 'AGOTADO' ? 'sin' : p.estado === 'BAJO' ? 'bajo' : ''), onclick: () => detalle(p) },
        h('span', { class: 'cod' }, String(p.codigo)),
        h('span', { class: 'desc' }, h('span', { class: 'n' }, p.nombre), h('small', null, [p.talla, p.color].filter(Boolean).join(' · '))),
        h('span', { class: 'ex' }, 'Costo ' + money(p.costo) + (p.apartado ? ' · ' + p.apartado + ' apartadas' : '')),
        h('span', { class: 'pr num' }, money(p.precio), h('small', { class: 'exi' }, p.existencia <= 0 ? 'Agotado' : UI.num(p.existencia) + ' en existencia')),
        h('span', { class: 'mas' }, '›'))));
      if (datos.length > est.max) lista.appendChild(h('button', { class: 'btn', type: 'button', onclick: () => { est.max += 40; pintar(); } }, 'Mostrar 40 más'));
    }
    root.appendChild(h('div', { class: 'buscar' }, UI.entrada({ type: 'search', class: 'busca-grande', placeholder: 'Buscar por código del producto…', value: est.q, autocomplete: 'off', oninput: ev => { est.q = ev.target.value; est.max = 40; pintar(); } })));
    root.appendChild(chips); root.appendChild(lista); pintar();
  }
  const money0 = UI.money0;

  function compras(root, db) {
    const hoy = Store.hoy();
    if (!est.mes) est.mes = HOOD.iniMes(hoy);
    const ini = est.mes, fin = HOOD.finMes(ini);
    const lista = db.entradas.filter(e => e[HOOD.CE.FECHA] !== '' && e[HOOD.CE.FECHA] >= ini && e[HOOD.CE.FECHA] <= fin).slice().reverse();
    const total = lista.reduce((a, e) => a + HOOD.num(e[HOOD.CE.TOTAL]), 0), pzs = lista.reduce((a, e) => a + HOOD.num(e[HOOD.CE.CANT]), 0);
    const anio = HOOD.r2(db.entradas.filter(e => e[HOOD.CE.FECHA] !== '' && String(e[HOOD.CE.FECHA]).slice(0, 4) === ini.slice(0, 4)).reduce((a, e) => a + HOOD.num(e[HOOD.CE.TOTAL]), 0));
    const nombre = c => { const p = db.productos.find(r => String(r[0]) === String(c)); return p ? HOOD.textoProd(p) : c; };
    root.appendChild(h('div', { class: 'fila sp', style: { marginBottom: '10px' } },
      h('div', { class: 'fecha-nav' }, h('button', { class: 'btn chico', type: 'button', onclick: () => { est.mes = HOOD.iniMes(HOOD.sumaDias(ini, -1)); App.refresh(); } }, '‹'),
        h('span', { class: 't' }, UI.mesLargo(ini)), h('button', { class: 'btn chico', type: 'button', disabled: fin >= hoy, onclick: () => { est.mes = HOOD.sumaDias(fin, 1); App.refresh(); } }, '›'))));
    root.appendChild(h('div', { class: 'kpis tres' }, UI.kpi('Reinversión del mes', money(total), 'compras de mercancía'), UI.kpi('Piezas compradas', UI.num(pzs)), UI.kpi('Reinversión del año', money(anio))));
    root.appendChild(h('div', { class: 'card' }, !lista.length ? UI.vacio('No hay compras registradas este mes.') : h('div', { class: 'lista' }, lista.map(e => h('div', { class: 'item' },
      h('div', { class: 'grow' }, h('div', { class: 't1' }, nombre(e[HOOD.CE.CODIGO]) + ' ×' + UI.num(e[HOOD.CE.CANT])),
        h('div', { class: 't2' }, UI.fecha(e[HOOD.CE.FECHA]) + (HOOD.num(e[HOOD.CE.COSTO]) ? ' · ' + money(e[HOOD.CE.COSTO]) + ' c/u' : '') + (e[HOOD.CE.EFECTIVO] === 'SI' ? ' · efectivo' : '') + (e[HOOD.CE.NOTAS] ? ' · ' + e[HOOD.CE.NOTAS] : ''))),
      h('div', { class: 'monto' }, money(e[HOOD.CE.TOTAL])))))));
  }

  Views.inventario = {
    titulo: 'Inventario', icono: 'inventario',
    render(root) {
      const db = Store.view();
      root.appendChild(h('div', { class: 'titulo-vista' }, UI.segmentos([['existencias', 'Existencias'], ['compras', 'Compras (reinversión)']], est.sub, id => { est.sub = id; App.refresh(); }),
        h('button', { class: 'btn primary', type: 'button', onclick: () => formNuevo(db) }, UI.icono('mas'), 'Nuevo producto')));
      if (est.sub === 'compras') compras(root, db); else existencias(root, db);
    }
  };
})();
