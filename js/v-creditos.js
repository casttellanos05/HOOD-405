/* Pestaña CRÉDITOS: el dueño da de alta clientes y ve cuánto falta por cobrar y los días de cada uno; el vendedor consulta y cobra abonos */
(function () {
  const { h, money } = UI;
  const Views = (window.Views = window.Views || {});
  const est = { filtro: 'todos', q: '', tel: '', cuenta: null };
  const tipoEstado = e => ({ 'Vencido': 'mal', 'Por vencer': 'ambar', 'Vigente': 'info', 'Sin deuda': 'ok', 'Vencida': 'mal', 'Vigente ': 'info', 'Pagada': 'ok' }[e] || '');
  const dueno = () => Store.S.user.rol === 'dueno';

  /** Ventana de abono. Dueño: se guarda en la cola (funciona sin internet). Vendedor: necesita internet. */
  function abonar(tel, nombre, saldo, despues) {
    const idOp = Store.nuevoId();
    const monto = UI.dinero({ value: saldo > 0 ? saldo : '' }), forma = h('select', null, UI.opciones(HOOD.ABONO_FORMAS));
    const msg = h('div', { class: 'aviso mal', style: { display: 'none' } });
    UI.modal({ titulo: 'Abono de ' + nombre, ancho: '420px', cuerpo: h('div', null, h('p', { class: 'muted' }, 'Debe ' + money(saldo) + '. El abono paga primero la compra más antigua.'),
      h('div', { class: 'grid2' }, UI.campo('Monto', monto), UI.campo('Forma', forma)), msg),
      acciones: [{ texto: 'Cancelar', tipo: 'ghost' }, { texto: 'Registrar abono', tipo: 'primary', cerrar: false, onclick: async (cerrar, btn) => {
        btn.disabled = true;
        const args = { tel, monto: UI.leerNum(monto.value), forma: forma.value };
        const r = dueno() ? await Store.hacer('abono', args) : await Store.hacerEnLinea('abono', args, idOp);
        btn.disabled = false;
        if (!r.ok) { msg.textContent = r.msg; msg.style.display = ''; return; }
        cerrar(); UI.toast('Abono de ' + money(args.monto) + ' registrado', 'ok'); if (despues) despues();
      } }] });
  }

  /** Detalle de una cuenta (compras con días y abonos). c viene de listaCreditos (dueño) o de cuentaCliente (vendedor). */
  function cuentaCard(c, esDueno) {
    const compras = c.compras || [], abonos = c.abonos || [];
    const adeudado = esDueno ? c.saldo : c.adeudado;
    return h('div', null,
      h('div', { class: 'kpis tres' }, UI.kpi('Debe', money(adeudado), '', adeudado > 0 ? 'ambar' : 'ok'), UI.kpi('Compras a crédito', money(c.total)), UI.kpi('Pagado', money(c.pagado))),
      c.bloqueado ? h('div', { class: 'aviso mal' }, 'Esta cuenta alcanzó su límite de crédito: no se pueden agregar compras hasta que abone.') : null,
      h('h3', null, 'Compras'), !compras.length ? UI.vacio('Sin compras a crédito.') : h('div', { class: 'lista' }, compras.map(p => h('div', { class: 'item' },
        h('div', { class: 'grow' }, h('div', { class: 't1' }, p.items || ''), h('div', { class: 't2' }, UI.fecha(p.fecha) + ' · límite ' + UI.fecha(p.limite) + (p.saldo > 0 ? ' · ' + UI.dias(p.dias !== undefined && p.dias !== null ? p.dias : HOOD.difDias(p.limite, Store.hoy())) : '')),
          UI.progreso(p.total ? p.pagado / p.total : 0, p.saldo <= 0 ? 'ok' : (p.estado === 'Vencida' ? 'mal' : ''))),
        h('div', { style: { textAlign: 'right' } }, h('div', { class: 'monto' }, money(p.saldo > 0 ? p.saldo : p.total)), UI.badge(p.estado, tipoEstado(p.estado)))))),
      abonos.length ? h('div', null, h('h3', { style: { marginTop: '14px' } }, 'Abonos'), h('div', { class: 'lista' }, abonos.slice(0, 20).map(a => h('div', { class: 'item' },
        h('div', { class: 'grow' }, h('div', { class: 't1' }, UI.fecha(a.fecha)), h('div', { class: 't2' }, a.forma)), h('div', { class: 'monto' }, money(a.monto)))))) : null);
  }

  function editarCliente(c) {
    const f = { tel: UI.entrada({ type: 'tel', inputmode: 'numeric', value: c ? c.tel : '', maxlength: 14, disabled: !!c }), nombre: UI.entrada({ value: c ? c.nombre : '', placeholder: 'Nombre completo' }),
      limite: UI.dinero({ value: c ? c.limite : '', placeholder: '0.00' }), activo: h('input', { type: 'checkbox', checked: c ? c.activo : true }) };
    const msg = h('div', { class: 'aviso mal', style: { display: 'none' } });
    UI.modal({ titulo: c ? 'Editar cliente de crédito' : 'Dar de alta cliente de crédito', ancho: '440px', cuerpo: h('div', null, UI.campo('Celular (10 dígitos)', f.tel), UI.campo('Nombre completo', f.nombre),
      UI.campo('Límite de crédito', f.limite, 'Máximo que puede deber a la vez.'), h('label', { class: 'check' }, f.activo, 'Autorizado (puede comprar a crédito). Quita la palomita para darlo de baja.'), msg),
      acciones: [{ texto: 'Cancelar', tipo: 'ghost' }, { texto: 'Guardar', tipo: 'primary', cerrar: false, onclick: async (cerrar, btn) => {
        btn.disabled = true;
        const r = await Store.hacer('cliente', { tel: f.tel.value, nombre: f.nombre.value, limite: UI.leerNum(f.limite.value), activo: f.activo.checked });
        btn.disabled = false;
        if (!r.ok) { msg.textContent = r.msg; msg.style.display = ''; return; }
        cerrar(); UI.toast(c ? 'Cliente actualizado' : 'Cliente dado de alta', 'ok'); App.refresh();
      } }] });
  }

  function detalleDueno(c) {
    const m = UI.modal({ titulo: c.nombre + ' · ' + c.tel, ancho: '640px', cuerpo: h('div', null, h('div', { class: 'fila', style: { marginBottom: '10px' } }, UI.badge(c.estado, tipoEstado(c.estado)),
      c.prox && c.saldo > 0 ? h('small', null, 'Próximo vencimiento: ' + UI.fecha(c.prox) + ' (' + UI.dias(c.dias) + ')') : null, h('small', null, 'Límite ' + money(c.limite) + (c.activo ? '' : ' · inactivo'))),
      cuentaCard(c, true)),
      acciones: [{ texto: 'Editar cliente', tipo: 'ghost', cerrar: false, onclick: () => { m.cerrar(); editarCliente(c); } },
        { texto: 'Registrar abono', tipo: 'primary', disabled: c.saldo <= 0, cerrar: false, onclick: () => { m.cerrar(); abonar(c.tel, c.nombre, c.saldo, () => App.refresh()); } }] });
  }

  /** Da de baja / de alta a un cliente (conserva su historial y lo que debe). */
  async function cambiarAlta(c) {
    const baja = c.activo;
    if (!await UI.confirmar(baja ? 'Dar de baja' : 'Dar de alta', baja ? c.nombre + ' ya no podrá comprar a crédito. Su historial y lo que debe se conservan y puede seguir abonando.' : c.nombre + ' volverá a poder comprar a crédito hasta su límite de ' + money(c.limite) + '.', baja ? 'Dar de baja' : 'Dar de alta', baja)) return;
    const r = await Store.hacer('cliente', { tel: c.tel, nombre: c.nombre, limite: c.limite, activo: !baja });
    if (!r.ok) { UI.toast(r.msg, 'mal', 5000); return; }
    UI.toast(c.nombre + (baja ? ' dado de baja' : ' dado de alta'), 'ok'); App.refresh();
  }

  function vistaDueno(root, db) {
    const hoy = Store.hoy(), lista = HOOD.listaCreditos(db, hoy);
    const deuda = lista.filter(c => c.saldo > 0), total = HOOD.r2(deuda.reduce((a, c) => a + c.saldo, 0));
    const venc = lista.filter(c => c.estado === 'Vencido'), por = lista.filter(c => c.estado === 'Por vencer');
    const autorizados = lista.filter(c => c.activo), bajas = lista.filter(c => !c.activo);
    root.appendChild(h('div', { class: 'titulo-vista' }, h('h2', null, 'Créditos'), h('button', { class: 'btn primary', type: 'button', onclick: () => editarCliente(null) }, UI.icono('mas'), 'Dar de alta cliente')));
    root.appendChild(h('div', { class: 'kpis' }, UI.kpi('Por cobrar', money(total), deuda.length + ' clientes con deuda', total > 0 ? 'ambar' : 'ok'), UI.kpi('Vencidos', venc.length, money(venc.reduce((a, c) => a + c.saldo, 0)), venc.length ? 'mal' : 'ok'),
      UI.kpi('Por vencer (≤ ' + db.config.avisoDias + ' días)', por.length, money(por.reduce((a, c) => a + c.saldo, 0)), por.length ? 'ambar' : 'ok'), UI.kpi('Clientes autorizados', autorizados.length, bajas.length ? bajas.length + ' de baja' : 'a crédito')));
    root.appendChild(h('div', { class: 'aviso info' }, 'Solo los clientes que das de alta aquí pueden comprar a crédito. Los apartados son aparte: cualquier persona puede apartar desde Venta.'));
    const caja = h('div', { class: 'card' });
    function pintar() {
      UI.vaciar(caja);
      caja.appendChild(h('div', { class: 'fila', style: { marginBottom: '10px' } }, UI.segmentos([['todos', 'Autorizados (' + autorizados.length + ')'], ['deuda', 'Con deuda'], ['vencer', 'Por vencer'], ['baja', 'De baja (' + bajas.length + ')']], est.filtro, id => { est.filtro = id; pintar(); })));
      const q = UI.norm(est.q);
      const datos = lista.filter(c => (est.filtro === 'baja' ? !c.activo : est.filtro === 'deuda' ? c.saldo > 0 : est.filtro === 'vencer' ? (c.estado === 'Vencido' || c.estado === 'Por vencer') : c.activo) && (!q || UI.norm(c.nombre + ' ' + c.tel).indexOf(q) >= 0))
        .sort((a, b) => est.filtro === 'todos' || est.filtro === 'baja' ? a.nombre.localeCompare(b.nombre, 'es') : 0);
      if (!datos.length) { caja.appendChild(UI.vacio(est.filtro === 'todos' ? 'Todavía no hay clientes autorizados. Agrega el primero con "Dar de alta cliente".' : 'No hay clientes con ese filtro.')); return; }
      caja.appendChild(h('div', { class: 'lista' }, datos.map(c => h('div', { class: 'item clic' + (c.activo ? '' : ' baja'), onclick: () => detalleDueno(c) },
        h('div', { class: 'grow' }, h('div', { class: 't1' }, c.nombre + (c.activo ? '' : ' (de baja)')),
          h('div', { class: 't2' }, c.tel + ' · límite ' + money(c.limite) + (c.activo ? ' · disponible ' + money(c.disponible) : '')),
          c.saldo > 0 && c.prox ? h('div', { class: 't2' }, 'Debe ' + money(c.saldo) + ' · vence ' + UI.fechaCorta(c.prox) + ' (' + UI.dias(c.dias) + ')') : null,
          c.limite ? UI.progreso(c.saldo / c.limite, c.saldo >= c.limite ? 'mal' : '') : null),
        h('div', { style: { textAlign: 'right', display: 'grid', gap: '6px' } }, h('div', { class: 'monto' }, money(c.saldo)), UI.badge(c.estado, tipoEstado(c.estado)),
          h('button', { class: 'btn chico ' + (c.activo ? 'ghost' : 'primary'), type: 'button', onclick: ev => { ev.stopPropagation(); cambiarAlta(c); } }, c.activo ? 'Dar de baja' : 'Dar de alta'))))));
    }
    root.appendChild(h('div', { class: 'buscar' }, UI.entrada({ type: 'search', placeholder: 'Buscar por nombre o celular…', value: est.q, oninput: ev => { est.q = ev.target.value; pintar(); } })));
    root.appendChild(caja); pintar();
  }

  function vistaVendedor(root, db) {
    const a = Views.avisosActuales().creditos;
    root.appendChild(h('div', { class: 'titulo-vista' }, h('h2', null, 'Créditos')));
    root.appendChild(a.length ? h('div', { class: 'aviso ' + (a.some(x => x.dias < 0) ? 'mal' : 'ambar') }, h('div', { class: 'fuerte' }, 'Créditos por vencer o vencidos'),
      a.sort((x, y) => x.dias - y.dias).map(x => h('div', { class: 'fila sp' }, h('span', null, x.nombre + ' · ' + UI.dias(x.dias)), h('span', { class: 'num fuerte' }, money(x.saldo))))) :
      h('div', { class: 'aviso ok' }, 'Ningún crédito vence en los próximos ' + db.config.avisoDias + ' días.'));
    const tel = UI.entrada({ type: 'tel', inputmode: 'numeric', maxlength: 14, placeholder: 'Celular del cliente (10 dígitos)', value: est.tel });
    const res = h('div');
    async function buscar() {
      UI.vaciar(res); est.cuenta = null;
      const t10 = HOOD.tel10(tel.value); est.tel = tel.value;
      if (t10.length !== 10) { res.appendChild(h('div', { class: 'aviso mal' }, 'Escribe los 10 dígitos del celular')); return; }
      res.appendChild(UI.vacio('Consultando…'));
      const r = await Store.consultar('q_cliente', t10);
      UI.vaciar(res);
      if (!r.ok) { res.appendChild(h('div', { class: 'aviso mal' }, r.msg)); return; }
      est.cuenta = r;
      res.appendChild(h('div', { class: 'card' }, h('div', { class: 'cab' }, h('h3', null, r.nombre), h('small', null, r.tel)), cuentaCard(r, false),
        h('button', { class: 'btn primary grande', type: 'button', style: { marginTop: '12px' }, disabled: r.adeudado <= 0, onclick: () => abonar(r.tel, r.nombre, r.adeudado, buscar) }, 'Registrar abono')));
    }
    tel.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });
    root.appendChild(h('div', { class: 'card' }, h('div', { class: 'fila' }, h('div', { style: { flex: 1, minWidth: '200px' } }, tel), h('button', { class: 'btn primary', type: 'button', onclick: buscar }, 'Consultar cuenta')),
      h('small', null, 'Para vender a crédito, arma el carrito en Venta y elige "Crédito" (solo clientes dados de alta por el dueño). Consultar cuentas y registrar abonos necesita internet.')));
    root.appendChild(res);
    if (est.tel && HOOD.tel10(est.tel).length === 10 && navigator.onLine) buscar();
  }

  Views.creditos = { titulo: 'Créditos', icono: 'creditos', render(root) { const db = Store.view(); if (dueno()) vistaDueno(root, db); else vistaVendedor(root, db); } };
})();
