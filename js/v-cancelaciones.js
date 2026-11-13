/* Pestaña CANCELACIONES (dueño): elimina cualquier registro (venta, compra, abono, apartado, gasto, pago, corte, producto, cliente)
 * y deshace todo lo que provocó: existencias, deudas, comisiones, sueldos pagados, cortes y reportes. */
(function () {
  const { h, money } = UI;
  const Views = (window.Views = window.Views || {});
  const est = { tipo: 'venta', q: '', max: 40 };
  const CV = HOOD.CV, CA = HOOD.CA, CE = HOOD.CE, CG = HOOD.CG, CPG = HOOD.CPG, CCT = HOOD.CCT, CC = HOOD.CC;
  const TIPOS = [['venta', 'Ventas'], ['compra', 'Compras'], ['abono', 'Abonos'], ['apartado', 'Apartados'], ['gasto', 'Gastos'], ['pago', 'Pagos'], ['corte', 'Cortes'], ['producto', 'Productos'], ['cliente', 'Clientes']];
  const SINGULAR = { venta: 'venta', compra: 'compra', abono: 'abono', apartado: 'apartado', gasto: 'gasto', pago: 'pago a empleado', corte: 'corte de caja', producto: 'producto', cliente: 'cliente' };
  const ord = (a, b) => (String(b.fecha) + String(b.hora || '')).localeCompare(String(a.fecha) + String(a.hora || ''));

  /** Arma la lista de registros de un tipo: { id, titulo, detalle, monto, fecha, hora, efecto } */
  function registros(tipo, db, hoy) {
    const nombreCli = tel => { const f = db.clientes.find(c => HOOD.tel10(c[CC.TEL]) === HOOD.tel10(tel)); return f ? f[CC.NOMBRE] : ''; };
    if (tipo === 'venta') {
      const tk = {};
      db.ventas.forEach(f => {
        if (f[CV.ID] === '' || f[CV.PAGO] === 'Apartado') return;
        const t = tk[f[CV.ID]] || (tk[f[CV.ID]] = { id: f[CV.ID], fecha: f[CV.FECHA], hora: f[CV.HORA], vendedor: f[CV.VENDEDOR], pago: f[CV.PAGO], tel: f[CV.TEL], total: 0, piezas: 0, items: [], com: 0 });
        t.total = HOOD.r2(t.total + HOOD.num(f[CV.TOTAL])); t.piezas += HOOD.num(f[CV.CANT]); t.com = HOOD.r2(t.com + HOOD.num(f[CV.COM])); t.items.push(f[CV.PRODUCTO] + ' ×' + f[CV.CANT]);
      });
      return Object.keys(tk).map(k => tk[k]).sort(ord).map(t => ({ id: t.id, fecha: t.fecha, hora: t.hora, monto: t.total,
        titulo: t.items.join(', '), detalle: UI.fecha(t.fecha) + ' ' + UI.hora(t.hora) + ' · ' + t.vendedor + ' · ' + t.pago + (t.pago === 'Crédito' ? ' · ' + (nombreCli(t.tel) || t.tel) : ''),
        efecto: ['Las ' + t.piezas + ' pieza(s) regresan a la existencia.', 'La venta desaparece del corte de caja, del resumen y de la cuenta de ' + t.vendedor + (t.com ? ' (se quita su comisión de ' + money(t.com) + ')' : '') + '.']
          .concat(t.pago === 'Crédito' ? ['Se borra también el primer pago de esa compra y baja la deuda del cliente. Si el cliente ya abonó dinero que cubre otras compras, primero cancela esos abonos.'] : []) }));
    }
    if (tipo === 'compra') {
      const prod = c => { const p = db.productos.find(r => String(r[0]) === String(c)); return p ? HOOD.textoProd(p) : String(c); };
      return db.entradas.filter(e => e[CE.FECHA] !== '' && e[CE.CODIGO] !== '').map(e => ({ id: e[CE.ID], fecha: e[CE.FECHA], hora: '', monto: HOOD.num(e[CE.TOTAL]),
        titulo: prod(e[CE.CODIGO]) + ' ×' + HOOD.num(e[CE.CANT]), detalle: UI.fecha(e[CE.FECHA]) + ' · ' + e[CE.CODIGO] + (HOOD.num(e[CE.COSTO]) ? ' · ' + money(e[CE.COSTO]) + ' c/u' : ' · sin costo') + (e[CE.NOTAS] ? ' · ' + e[CE.NOTAS] : ''),
        efecto: ['Salen ' + HOOD.num(e[CE.CANT]) + ' pieza(s) de la existencia.', 'Se borra su reinversión de ' + money(e[CE.TOTAL]) + ' de los reportes' + (e[CE.EFECTIVO] === 'SI' ? ' y del efectivo gastado en el corte de caja' : '') + '.',
          'No se puede si ya vendiste esas piezas. Si solo estaba mal el costo, mejor edítala en Inventario > Compras.'] })).sort(ord);
    }
    if (tipo === 'abono') {
      return db.abonos.filter(f => f[CA.ID] !== '' && HOOD.num(f[CA.MONTO]) > 0).map(f => {
        const ap = String(f[CA.APART] || '') !== '';
        return { id: f[CA.ID], fecha: f[CA.FECHA], hora: f[CA.HORA], monto: HOOD.num(f[CA.MONTO]),
          titulo: (f[CA.CLIENTE] || f[CA.TEL]) + (ap ? ' · abono de apartado' : ' · abono de crédito'),
          detalle: UI.fecha(f[CA.FECHA]) + ' ' + UI.hora(f[CA.HORA]) + ' · ' + f[CA.FORMA] + (f[CA.VENDEDOR] ? ' · cobró ' + f[CA.VENDEDOR] : ''),
          efecto: ['Desaparece del corte de caja y del resumen (' + f[CA.FORMA].toLowerCase() + ').', ap ? 'El saldo del apartado sube. Solo se puede en apartados abiertos; si ya está liquidado o vencido cancela el apartado completo.' : 'La deuda del cliente sube ' + money(f[CA.MONTO]) + ' y se recalcula la utilidad cobrada.'] };
      }).sort(ord);
    }
    if (tipo === 'apartado') {
      return HOOD.listaApartados(db, hoy).map(a => ({ id: a.id, fecha: a.fecha, hora: '', monto: a.total,
        titulo: a.cliente + ' · ' + a.items, detalle: UI.fecha(a.fecha) + ' · ' + a.estado + ' · pagado ' + money(a.pagado) + ' de ' + money(a.total) + ' · ' + a.vendedor,
        efecto: [a.estado === 'Vencido' ? 'Se borra el apartado y todo lo que abonó el cliente (ya se había contado como ingreso).' : 'Se borra el apartado y sus ' + money(a.pagado) + ' abonados: salen del corte de caja y del resumen.',
          a.estado === 'Liquidado' ? 'Como ya se liquidó, también se borra la venta que generó y la comisión del vendedor. Las piezas regresan a la existencia.' : a.estado === 'Apartado' ? 'Las piezas apartadas regresan a la existencia.' : 'Las piezas ya habían regresado a la existencia.'] })).sort(ord);
    }
    if (tipo === 'gasto') {
      return db.gastos.filter(g => g[CG.FECHA] !== '' && g[CG.ID] !== '').map(g => ({ id: g[CG.ID], fecha: g[CG.FECHA], hora: '', monto: HOOD.num(g[CG.MONTO]),
        titulo: g[CG.CONCEPTO], detalle: UI.fecha(g[CG.FECHA]) + ' · ' + (g[CG.CAT] || 'Otros') + (g[CG.EFECTIVO] === 'SI' ? ' · efectivo' : ''),
        efecto: ['Se borra y deja de restarse en gastos, utilidad neta y corte de caja' + (g[CG.EFECTIVO] === 'SI' ? ' (era en efectivo)' : '') + '.']
          .concat(HOOD.esSueldos(g[CG.CAT]) ? ['Es el pago de un sueldo: también se quita del Corte semanal y lo pagado vuelve a quedar pendiente.'] : []) })).sort(ord);
    }
    if (tipo === 'pago') {
      return db.pagos.filter(p => p[CPG.ID] !== '').map(p => ({ id: p[CPG.ID], fecha: p[CPG.FECHA], hora: p[CPG.HORA], monto: HOOD.num(p[CPG.MONTO]),
        titulo: 'Pago a ' + p[CPG.VENDEDOR] + ' · semana del ' + UI.fecha(p[CPG.SEMANA]), detalle: UI.fecha(p[CPG.FECHA]) + ' ' + UI.hora(p[CPG.HORA]) + ' · ' + p[CPG.FORMA] + (p[CPG.NOTA] ? ' · ' + p[CPG.NOTA] : ''),
        efecto: ['Se borra el pago y su gasto de Sueldos.', 'Lo pagado vuelve a quedar como pendiente de esa semana en el Corte semanal.'] })).sort(ord);
    }
    if (tipo === 'corte') {
      return db.cortes.filter(c => c[CCT.ID] !== '').map(c => ({ id: c[CCT.ID], fecha: c[CCT.FECHA], hora: c[CCT.HORA], monto: HOOD.num(c[CCT.CONTADO]),
        titulo: 'Corte del ' + UI.fecha(c[CCT.FECHA]) + ' · hecho por ' + c[CCT.USUARIO], detalle: 'Esperado ' + money(c[CCT.ESPERADO]) + ' · contado ' + money(c[CCT.CONTADO]) + ' · diferencia ' + money(c[CCT.DIF]),
        efecto: ['Se borra el registro del corte. Las ventas y los movimientos de ese día no cambian: solo podrás volver a hacer el corte.'] })).sort(ord);
    }
    if (tipo === 'producto') {
      return HOOD.inventario(db).map(p => ({ id: p.codigo, fecha: '', hora: '', monto: p.valorCosto,
        titulo: p.codigo + ' · ' + p.texto, detalle: UI.num(p.existencia) + ' en existencia · precio ' + money(p.precio) + ' · ' + (p.activo ? 'activo' : 'inactivo'),
        efecto: ['Se borra el producto y todas sus compras (su reinversión desaparece de los reportes).', 'Solo se puede si nunca se vendió ni se apartó. Si ya tiene historial, desactívalo en Inventario para quitarlo de la venta sin perder datos.'] }))
        .sort((a, b) => String(a.id).localeCompare(String(b.id), 'es', { numeric: true }));
    }
    return db.clientes.filter(f => f[CC.TEL] !== '' && f[CC.TEL] != null).map(f => ({ id: HOOD.tel10(f[CC.TEL]), fecha: '', hora: '', monto: HOOD.num(f[CC.LIMITE]),
      titulo: f[CC.NOMBRE], detalle: HOOD.tel10(f[CC.TEL]) + ' · límite de crédito ' + money(f[CC.LIMITE]) + ' · ' + (String(f[CC.ACTIVO]).toUpperCase() === 'NO' ? 'de baja' : 'autorizado'),
      efecto: ['Se borra el cliente de la lista de créditos.', 'Solo se puede si nunca compró a crédito, abonó ni apartó. Si ya tiene historial, dalo de baja en Créditos.'] }))
      .sort((a, b) => String(a.titulo).localeCompare(String(b.titulo), 'es'));
  }

  function confirmarEliminar(tipo, r) {
    const msg = h('div', { class: 'aviso mal', style: { display: 'none' } });
    const cuerpo = h('div', null,
      h('div', { class: 'fuerte', style: { fontSize: '16px' } }, r.titulo), h('div', { class: 'muted', style: { marginBottom: '10px' } }, r.detalle),
      h('div', { class: 'aviso ambar' }, h('div', { class: 'fuerte' }, 'Esto es lo que va a pasar:'), h('ul', { style: { margin: '6px 0 0 18px', padding: 0 } }, r.efecto.map(x => h('li', null, x)))),
      h('div', { class: 'fuerte' }, 'No se puede deshacer: el registro se borra de verdad.'), msg);
    UI.modal({ titulo: 'Eliminar ' + SINGULAR[tipo], cuerpo, ancho: '560px', acciones: [{ texto: 'No, conservar', tipo: 'ghost' },
      { texto: 'Sí, eliminar', tipo: 'danger', cerrar: false, onclick: async (cerrar, btn) => {
        btn.disabled = true;
        const res = await Store.hacer('cancelar', { que: tipo, id: r.id });
        btn.disabled = false;
        if (!res.ok) { msg.textContent = res.msg; msg.style.display = ''; return; }
        cerrar(); UI.toast('Eliminado: ' + SINGULAR[tipo], 'ok'); App.refresh();
      } }] });
  }

  Views.cancelaciones = {
    titulo: 'Cancelaciones', icono: 'cancelaciones',
    render(root) {
      const db = Store.view(), hoy = Store.hoy();
      root.appendChild(h('div', { class: 'titulo-vista' }, h('h2', null, 'Cancelaciones')));
      root.appendChild(h('div', { class: 'aviso info' }, 'Aquí eliminas un registro hecho por error. Se borra de verdad y se deshace todo lo que provocó (existencias, deudas, comisiones, cortes y reportes), sin dejar rastro en las demás secciones. Antes de borrar te explico qué va a cambiar.'));
      root.appendChild(h('div', { class: 'titulo-vista' }, UI.segmentos(TIPOS, est.tipo, id => { est.tipo = id; est.q = ''; est.max = 40; App.refresh(); })));
      const todos = registros(est.tipo, db, hoy);
      const lista = h('div', { class: 'card' });
      const buscador = UI.entrada({ type: 'search', class: 'busca-grande', placeholder: 'Buscar ' + SINGULAR[est.tipo] + ' (cliente, código, producto, fecha, vendedor…)', value: est.q, autocomplete: 'off', oninput: ev => { est.q = ev.target.value; est.max = 40; pintar(); } });
      root.appendChild(h('div', { class: 'buscar' }, buscador));
      root.appendChild(lista);
      function pintar() {
        UI.vaciar(lista);
        const q = UI.norm(est.q).trim(), palabras = q ? q.split(/\s+/) : [];
        const datos = q ? todos.filter(r => { const t = UI.norm(r.titulo + ' ' + r.detalle + ' ' + r.id); return palabras.every(w => t.indexOf(w) >= 0); }) : todos;
        if (!datos.length) { lista.appendChild(UI.vacio(q ? 'Nada coincide con “' + est.q.trim() + '”' : 'No hay registros de este tipo.')); return; }
        lista.appendChild(h('div', { class: 'res-cab' }, datos.length + (datos.length === 1 ? ' registro' : ' registros') + (datos.length > est.max ? ' · mostrando los primeros ' + est.max : '')));
        lista.appendChild(h('div', { class: 'lista' }, datos.slice(0, est.max).map(r => h('div', { class: 'item' },
          h('div', { class: 'grow' }, h('div', { class: 't1' }, r.titulo), h('div', { class: 't2' }, r.detalle)),
          h('div', { class: 'monto' }, est.tipo === 'producto' || est.tipo === 'cliente' ? '' : money(r.monto)),
          h('button', { class: 'btn chico peligro', type: 'button', onclick: () => confirmarEliminar(est.tipo, r) }, 'Eliminar')))));
        if (datos.length > est.max) lista.appendChild(h('button', { class: 'btn', type: 'button', style: { marginTop: '8px' }, onclick: () => { est.max += 40; pintar(); } }, 'Mostrar 40 más'));
      }
      pintar();
    }
  };
})();
