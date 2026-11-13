/* Pestaña APARTADOS: recordatorio de los que están por vencer, lista y abonos */
(function () {
  const { h, money } = UI;
  const Views = (window.Views = window.Views || {});
  const est = { filtro: 'abiertos', q: '', tel: '' };
  const dueno = () => Store.S.user.rol === 'dueno';
  const tipo = e => ({ Apartado: 'info', Liquidado: 'ok', Vencido: 'mal' }[e] || '');

  function abonar(a, despues) {
    const idOp = Store.nuevoId();
    const monto = UI.dinero({ value: a.saldo }), forma = h('select', null, UI.opciones(HOOD.ABONO_FORMAS));
    const msg = h('div', { class: 'aviso mal', style: { display: 'none' } });
    UI.modal({ titulo: 'Abono de apartado · ' + a.cliente, ancho: '420px', cuerpo: h('div', null, h('p', { class: 'muted' }, a.items + ' · falta ' + money(a.saldo) + '. Si se liquida, pasa a venta y se paga la comisión.'),
      h('div', { class: 'grid2' }, UI.campo('Monto', monto), UI.campo('Forma', forma)), msg),
      acciones: [{ texto: 'Cancelar', tipo: 'ghost' }, { texto: 'Registrar abono', tipo: 'primary', cerrar: false, onclick: async (cerrar, btn) => {
        btn.disabled = true;
        const args = { id: a.id, monto: UI.leerNum(monto.value), forma: forma.value };
        const r = dueno() ? await Store.hacer('apartado_abono', args) : await Store.hacerEnLinea('apartado_abono', args, idOp);
        btn.disabled = false;
        if (!r.ok) { msg.textContent = r.msg; msg.style.display = ''; return; }
        cerrar(); UI.toast(r.liquidado ? 'Apartado liquidado ✓' : 'Abono registrado', 'ok'); if (despues) despues();
      } }] });
  }

  function fila(a, onclick) {
    const dias = a.dias !== undefined ? a.dias : null;
    return h('div', { class: 'item' + (onclick ? ' clic' : ''), onclick },
      h('div', { class: 'grow' }, h('div', { class: 't1' }, a.cliente), h('div', { class: 't2' }, a.items),
        h('div', { class: 't2' }, a.tel + ' · apartado ' + UI.fechaCorta(a.fecha) + (a.estado === 'Apartado' && a.limite ? ' · límite ' + UI.fecha(a.limite) + ' (' + UI.dias(dias) + ')' : a.cierre ? ' · cerrado ' + UI.fechaCorta(a.cierre) : '')),
        a.estado === 'Apartado' ? UI.progreso(a.total ? a.pagado / a.total : 0) : null),
      h('div', { style: { textAlign: 'right' } }, h('div', { class: 'monto' }, a.estado === 'Apartado' ? 'Falta ' + money(a.saldo) : money(a.total)),
        a.alerta ? UI.badge(a.alerta, a.alerta === 'Vencido' ? 'mal' : 'ambar') : UI.badge(a.estado, tipo(a.estado))));
  }

  function vistaDueno(root, db) {
    const hoy = Store.hoy(), todos = HOOD.listaApartados(db, hoy);
    const abiertos = todos.filter(a => a.estado === 'Apartado'), alerta = abiertos.filter(a => a.alerta);
    root.appendChild(h('div', { class: 'titulo-vista' }, h('h2', null, 'Apartados'), h('small', null, 'Para apartar un producto, arma el carrito en Venta y elige "Apartar". Cualquier persona puede apartar: no necesita estar registrada.')));
    root.appendChild(h('div', { class: 'kpis' }, UI.kpi('Apartados abiertos', abiertos.length, 'piezas reservadas'), UI.kpi('Por cobrar', money(abiertos.reduce((a, x) => a + x.saldo, 0)), 'saldo de abiertos'),
      UI.kpi('Por vencer (≤ ' + db.config.avisoDias + ' días)', alerta.filter(a => a.alerta === 'Por vencer').length, '', alerta.length ? 'ambar' : 'ok'), UI.kpi('Vencidos sin cerrar', alerta.filter(a => a.alerta === 'Vencido').length, 'se cierran solos a la 1 a.m.', alerta.some(a => a.alerta === 'Vencido') ? 'mal' : 'ok')));
    if (alerta.length) root.appendChild(h('div', { class: 'aviso ambar' }, h('div', { class: 'fuerte' }, '⏰ Recordatorio: apartados por vencer'),
      alerta.map(a => h('div', { class: 'fila sp', style: { padding: '3px 0' } }, h('span', null, a.cliente + ' · ' + UI.dias(a.dias) + ' (' + UI.fechaCorta(a.limite) + ')'), h('span', { class: 'num fuerte' }, 'falta ' + money(a.saldo))))));
    else root.appendChild(h('div', { class: 'aviso ok' }, 'Ningún apartado vence en los próximos ' + db.config.avisoDias + ' días.'));
    const caja = h('div', { class: 'card' });
    function pintar() {
      UI.vaciar(caja);
      caja.appendChild(h('div', { class: 'fila', style: { marginBottom: '10px' } }, UI.segmentos([['abiertos', 'Abiertos'], ['liquidados', 'Liquidados'], ['vencidos', 'Vencidos'], ['todos', 'Todos']], est.filtro, id => { est.filtro = id; pintar(); })));
      const q = UI.norm(est.q), mapa = { abiertos: 'Apartado', liquidados: 'Liquidado', vencidos: 'Vencido' };
      const datos = todos.filter(a => (est.filtro === 'todos' || a.estado === mapa[est.filtro]) && (!q || UI.norm(a.cliente + ' ' + a.tel + ' ' + a.items).indexOf(q) >= 0));
      if (!datos.length) { caja.appendChild(UI.vacio('No hay apartados con ese filtro.')); return; }
      caja.appendChild(h('div', { class: 'lista' }, datos.map(a => fila(a, a.estado === 'Apartado' ? () => abonar(a, () => App.refresh()) : null))));
    }
    root.appendChild(h('div', { class: 'buscar' }, UI.entrada({ type: 'search', placeholder: 'Buscar por cliente, celular o producto…', value: est.q, oninput: ev => { est.q = ev.target.value; pintar(); } })));
    root.appendChild(caja); pintar();
  }

  function vistaVendedor(root, db) {
    const a = Views.avisosActuales().apartados;
    root.appendChild(h('div', { class: 'titulo-vista' }, h('h2', null, 'Apartados')));
    root.appendChild(a.length ? h('div', { class: 'aviso ' + (a.some(x => x.dias < 0) ? 'mal' : 'ambar') }, h('div', { class: 'fuerte' }, '⏰ Apartados por vencer o vencidos'),
      a.sort((x, y) => x.dias - y.dias).map(x => h('div', { class: 'fila sp' }, h('span', null, x.nombre + ' · ' + UI.dias(x.dias)), h('span', { class: 'num fuerte' }, 'falta ' + money(x.saldo))))) :
      h('div', { class: 'aviso ok' }, 'Ningún apartado vence en los próximos ' + db.config.avisoDias + ' días.'));
    const tel = UI.entrada({ type: 'tel', inputmode: 'numeric', maxlength: 14, placeholder: 'Celular del cliente (10 dígitos)', value: est.tel });
    const res = h('div');
    async function buscar() {
      UI.vaciar(res); est.tel = tel.value;
      const t10 = HOOD.tel10(tel.value);
      if (t10.length !== 10) { res.appendChild(h('div', { class: 'aviso mal' }, 'Escribe los 10 dígitos del celular')); return; }
      res.appendChild(UI.vacio('Consultando…'));
      const r = await Store.consultar('q_apartados', t10);
      UI.vaciar(res);
      if (!r.ok) { res.appendChild(h('div', { class: 'aviso mal' }, r.msg)); return; }
      const lista = r.apartados.map(x => Object.assign({ cliente: r.nombre || t10, tel: t10, dias: x.limite ? HOOD.difDias(x.limite, Store.hoy()) : null, alerta: x.estado === 'Apartado' && x.limite ? (HOOD.difDias(x.limite, Store.hoy()) < 0 ? 'Vencido' : HOOD.difDias(x.limite, Store.hoy()) <= db.config.avisoDias ? 'Por vencer' : '') : '' }, x));
      res.appendChild(h('div', { class: 'card' }, h('h3', null, r.nombre || 'Cliente sin registro'), !lista.length ? UI.vacio('Este cliente no tiene apartados.') :
        h('div', { class: 'lista' }, lista.map(x => fila(x, x.estado === 'Apartado' ? () => abonar(x, buscar) : null)))));
    }
    tel.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });
    root.appendChild(h('div', { class: 'card' }, h('div', { class: 'fila' }, h('div', { style: { flex: 1, minWidth: '200px' } }, tel), h('button', { class: 'btn primary', type: 'button', onclick: buscar }, 'Consultar apartados')),
      h('small', null, 'Para apartar, arma el carrito en Venta y elige "Apartar". Cualquier persona puede apartar: no necesita estar registrada. Consultar y abonar necesita internet. Toca un apartado abierto para registrar un abono.')));
    root.appendChild(res);
    if (est.tel && HOOD.tel10(est.tel).length === 10 && navigator.onLine) buscar();
  }

  Views.apartados = { titulo: 'Apartados', icono: 'apartados', render(root) { const db = Store.view(); if (dueno()) vistaDueno(root, db); else vistaVendedor(root, db); } };
})();
