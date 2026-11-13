/* Pestaña VENTA (dueño y vendedor): productos, carrito, descuento, forma de cobro, crédito y apartado, leyenda de vencimientos */
(function () {
  const { h, money } = UI;
  const Views = (window.Views = window.Views || {});
  const est = { cart: {}, q: '', cod: '', pago: '', max: 40 };

  const esCredApart = f => /cr[eé]dito|apartado/i.test(f);
  const productos = db => db.productos.filter(r => r[0] !== '' && r[0] != null && HOOD.activoProd(r));
  const porCodigo = (db, c) => db.productos.find(r => String(r[0]) === String(c));
  /** Búsqueda por código (primero), luego por nombre, talla o color. Máx. 40 resultados. */
  function buscarProductos(db, q) {
    const n = UI.norm(q).trim();
    if (!n) return [];
    const palabras = n.split(/\s+/);
    const out = [];
    productos(db).forEach(p => {
      const cod = UI.norm(String(p[0])), txt = UI.norm(HOOD.textoProd(p));
      let rank = -1;
      if (cod === n) rank = 0; else if (cod.indexOf(n) === 0) rank = 1; else if (cod.indexOf(n) >= 0) rank = 2; else if (palabras.every(w => txt.indexOf(w) >= 0 || cod.indexOf(w) >= 0)) rank = 3;
      if (rank >= 0) out.push({ p, rank });
    });
    return out.sort((a, b) => a.rank - b.rank || String(a.p[0]).localeCompare(String(b.p[0]), 'es', { numeric: true }));
  }
  const itemsCarrito = () => Object.keys(est.cart).map(c => ({ codigo: c, cantidad: est.cart[c] }));

  /** Totales del carrito con las mismas reglas del servidor. */
  function totales(db) {
    let subtotal = 0, piezas = 0;
    Object.keys(est.cart).forEach(c => { const p = porCodigo(db, c); if (p) { subtotal += est.cart[c] * HOOD.num(p[HOOD.CPR.PRECIO]); piezas += est.cart[c]; } });
    subtotal = HOOD.r2(subtotal);
    let pctDesc = 0, codMsg = '';
    if (est.cod.trim()) {
      const ci = HOOD.codigoInfo(db, est.cod, Store.hoy());
      if (!ci.ok) codMsg = ci.msg;
      else if (est.pago === 'Crédito' && !ci.credito) codMsg = 'El código ' + ci.codigo + ' no es válido en compras a crédito. Quítalo o elige otra forma de cobro.';
      else pctDesc = ci.pct;
    }
    const desc = HOOD.r2(subtotal * pctDesc), total = HOOD.r2(subtotal - desc);
    const tarj = /tarjeta/i.test(est.pago) ? HOOD.r2(total * HOOD.num(db.config.comTarjeta)) : 0;
    return { subtotal, piezas, pctDesc, desc, total, tarj, cobrar: HOOD.r2(total + tarj), codMsg };
  }

  /** Avisos de vencimiento para la leyenda: créditos y apartados que vencen en los próximos N días. */
  function avisosActuales() {
    const S = Store.S, db = Store.view(), hoy = Store.hoy();
    if (S.user.rol === 'dueno') return HOOD.avisos(db, hoy);
    const lim = Number(db.config.avisoDias) || 0, a = (S.snap && S.snap.avisos) || { creditos: [], apartados: [] };
    const f = x => Object.assign({}, x, { dias: HOOD.difDias(x.limite, hoy) });
    return { creditos: a.creditos.map(f).filter(x => x.dias <= lim), apartados: a.apartados.map(f).filter(x => x.dias <= lim) };
  }
  Views.avisosActuales = avisosActuales;

  function leyenda(db) {
    const a = avisosActuales(), lim = Number(db.config.avisoDias) || 0;
    const linea = (x, tipo) => h('div', { class: 'item' }, h('div', { class: 'grow' }, h('div', { class: 't1' }, x.nombre), h('div', { class: 't2' }, tipo + ' · ' + UI.dias(x.dias) + ' · límite ' + UI.fecha(x.limite))),
      h('div', { class: 'monto' }, money(x.saldo)));
    if (!a.creditos.length && !a.apartados.length) return h('div', { class: 'aviso ok leyenda-venta' }, 'Sin créditos ni apartados por vencer en los próximos ' + lim + ' días.');
    const vencido = [].concat(a.creditos, a.apartados).some(x => x.dias < 0);
    return h('div', { class: 'aviso ' + (vencido ? 'mal' : 'ambar') + ' leyenda-venta' },
      h('div', { class: 'fuerte' }, '⚠ Por vencer (próximos ' + lim + ' días) o vencidos'),
      h('div', { class: 'lista' }, a.creditos.sort((x, y) => x.dias - y.dias).map(x => linea(x, 'Crédito')), a.apartados.sort((x, y) => x.dias - y.dias).map(x => linea(x, 'Apartado'))));
  }

  function metaBarra(db) {
    const S = Store.S;
    if (S.user.rol !== 'vendedor') return null;
    const m = HOOD.meta(db, S.user.usuario, Store.hoy());
    if (!m.metas.length) return null;
    const sig = m.metas.find(x => m.vendido < x.monto), ult = m.metas[m.metas.length - 1];
    const meta = sig || ult;
    return h('div', { class: 'card' },
      h('div', { class: 'fila sp' }, h('span', { class: 'fuerte' }, 'Tu meta de la ' + m.periodo), h('span', { class: 'num fuerte' }, money(m.vendido) + ' / ' + money(meta.monto))),
      UI.progreso(m.vendido / meta.monto, sig ? '' : 'ok'),
      h('small', null, sig ? (meta.premio ? 'Premio: ' + meta.premio + ' · ' : '') + 'te faltan ' + money(meta.monto - m.vendido) : '¡Cumpliste todas tus metas!' + (meta.premio ? ' ' + meta.premio : '')));
  }

  Views.venta = {
    titulo: 'Venta', icono: 'venta',
    render(root) {
      const db = Store.view(), S = Store.S;
      const formas = db.config.formas.filter(f => !esCredApart(f)).concat(['Crédito', 'Apartado']);
      if (est.pago && formas.indexOf(est.pago) < 0) est.pago = '';

      const resultados = h('div', { class: 'resultados' });
      const carro = h('div', { class: 'card carrito sticky' });
      let buscador = null;

      /** Lista de productos: sin texto muestra todos (por código); al escribir se filtra y se resalta lo que coincide con el código. */
      function pintarProductos() {
        UI.vaciar(resultados);
        const q = est.q.trim(), nq = UI.norm(q);
        const todos = q ? buscarProductos(db, q).map(x => x.p) : productos(db).slice().sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'es', { numeric: true }));
        if (!todos.length) { resultados.appendChild(UI.vacio(q ? 'Ningún producto con “' + q + '”' : 'Todavía no hay productos. El dueño los da de alta en Inventario.')); return; }
        const lista = todos.slice(0, est.max);
        resultados.appendChild(h('div', { class: 'res-cab' }, todos.length + (todos.length === 1 ? ' producto' : ' productos') + (q ? '' : ' · escribe el código para filtrar')));
        const codigo = c => {
          const t = String(c), i = nq ? UI.norm(t).indexOf(nq) : -1;
          return i < 0 ? t : h('span', null, t.slice(0, i), h('b', { class: 'coin' }, t.slice(i, i + nq.length)), t.slice(i + nq.length));
        };
        lista.forEach(p => {
          const c = p[0], disp = HOOD.num(p[HOOD.CPR.DISP]), en = est.cart[c] || 0, min = HOOD.num(p[HOOD.CPR.MIN]);
          resultados.appendChild(h('button', { type: 'button', class: 'res ' + (disp <= 0 ? 'agotado' : disp <= min ? 'bajo' : ''), disabled: disp <= 0, onclick: () => { agregar(c); limpiarBusqueda(); } },
            h('span', { class: 'cod' }, codigo(c)),
            h('span', { class: 'desc' }, h('span', { class: 'n' }, p[HOOD.CPR.NOMBRE]), h('small', null, [p[HOOD.CPR.TALLA], p[HOOD.CPR.COLOR]].filter(Boolean).join(' · '))),
            h('span', { class: 'ex' }, disp <= 0 ? 'Agotado' : (disp - en) + ' disp.' + (en ? ' · ' + en + ' en carrito' : '')),
            h('span', { class: 'pr num' }, money(p[HOOD.CPR.PRECIO])),
            h('span', { class: 'mas' }, disp <= 0 ? '' : '+')));
        });
        if (todos.length > est.max) resultados.appendChild(h('button', { class: 'btn', type: 'button', onclick: () => { est.max += 40; pintarProductos(); } }, 'Mostrar 40 más (' + (todos.length - est.max) + ' restantes)'));
      }
      function limpiarBusqueda() { est.q = ''; est.max = 40; if (buscador) { buscador.value = ''; buscador.focus(); } pintarProductos(); }
      function agregar(c) {
        const p = porCodigo(db, c), disp = HOOD.num(p[HOOD.CPR.DISP]);
        if ((est.cart[c] || 0) + 1 > disp) { UI.toast('No hay más existencia de ' + HOOD.textoProd(p), 'mal'); return; }
        est.cart[c] = (est.cart[c] || 0) + 1; pintarCarro();
      }
      function cambiar(c, d) {
        const p = porCodigo(db, c), disp = HOOD.num(p[HOOD.CPR.DISP]);
        const n = (est.cart[c] || 0) + d;
        if (n > disp) { UI.toast('No hay más existencia', 'mal'); return; }
        if (n <= 0) delete est.cart[c]; else est.cart[c] = n;
        pintarProductos(); pintarCarro();
      }
      /** Enter (o el lector de códigos): agrega si el código es exacto o si solo hay un resultado. */
      function enter() {
        const r = buscarProductos(db, est.q);
        if (!r.length) { UI.toast('Ningún producto con ese código', 'mal'); return; }
        const dis = r.filter(x => HOOD.num(x.p[HOOD.CPR.DISP]) > 0);
        const exacto = r.find(x => x.rank === 0);
        const elegido = exacto || (r.length === 1 ? r[0] : null);
        if (!elegido) { UI.toast('Hay ' + r.length + ' resultados: toca el correcto', ''); return; }
        if (HOOD.num(elegido.p[HOOD.CPR.DISP]) <= 0) { UI.toast(HOOD.textoProd(elegido.p) + ' está agotado', 'mal'); return; }
        agregar(elegido.p[0]); limpiarBusqueda();
      }

      function pintarCarro() {
        UI.vaciar(carro);
        const t = totales(db), claves = Object.keys(est.cart);
        carro.appendChild(h('div', { class: 'cab' }, h('h3', null, 'Carrito' + (t.piezas ? ' (' + t.piezas + ')' : '')),
          claves.length ? h('button', { class: 'btn chico ghost', type: 'button', onclick: () => { est.cart = {}; est.cod = ''; est.pago = ''; pintarProductos(); pintarCarro(); } }, 'Vaciar') : null));
        if (!claves.length) { carro.appendChild(UI.vacio('Busca un producto por su código para agregarlo')); return; }
        claves.forEach(c => {
          const p = porCodigo(db, c);
          carro.appendChild(h('div', { class: 'linea' },
            h('div', null, h('div', { class: 'fuerte' }, HOOD.textoProd(p)), h('small', null, c + ' · ' + money(p[HOOD.CPR.PRECIO]) + ' c/u')),
            h('div', { class: 'cant' }, h('button', { type: 'button', onclick: () => cambiar(c, -1), 'aria-label': 'Quitar uno' }, '−'), h('span', null, est.cart[c]), h('button', { type: 'button', onclick: () => cambiar(c, 1), 'aria-label': 'Agregar uno' }, '+')),
            h('div', { class: 'monto num fuerte' }, money(est.cart[c] * p[HOOD.CPR.PRECIO]))));
        });
        const cod = UI.entrada({ placeholder: 'Código de descuento', value: est.cod, autocapitalize: 'characters', oninput: ev => { est.cod = ev.target.value; pintarTotales(); } });
        carro.appendChild(h('div', { style: { marginTop: '10px' } }, UI.campo('Código de descuento (opcional)', cod)));
        const tot = h('div', { id: 'tot-venta' });
        carro.appendChild(tot);
        carro.appendChild(h('div', { class: 'fuerte', style: { marginTop: '6px' } }, 'Forma de cobro'));
        carro.appendChild(h('div', { class: 'formas' }, formas.map(f => h('button', { type: 'button', class: est.pago === f ? 'on' : '', onclick: () => { est.pago = f; pintarCarro(); } }, f === 'Apartado' ? 'Apartar' : f))));
        carro.appendChild(h('button', { class: 'btn primary grande', type: 'button', id: 'btn-cobrar', onclick: cobrar }, 'Cobrar'));
        pintarTotales();
      }
      function pintarTotales() {
        const tot = document.getElementById('tot-venta'); if (!tot) return;
        const t = totales(db);
        const bc = document.getElementById('btn-cobrar'); if (bc) bc.textContent = est.pago === 'Apartado' ? 'Apartar · ' + money(t.total) : est.pago === 'Crédito' ? 'Crédito · ' + money(t.total) : 'Cobrar ' + money(t.cobrar);
        UI.vaciar(tot);
        tot.appendChild(h('div', { class: 'totales' },
          h('div', { class: 'f' }, h('span', null, 'Subtotal'), h('span', { class: 'num' }, money(t.subtotal))),
          t.pctDesc ? h('div', { class: 'f ok' }, h('span', null, 'Descuento (' + UI.pct(t.pctDesc) + ')'), h('span', { class: 'num' }, '−' + money(t.desc))) : null,
          t.codMsg ? h('div', { class: 'f mal' }, h('span', null, t.codMsg)) : null,
          t.tarj ? h('div', { class: 'f' }, h('span', null, 'Comisión de tarjeta (' + UI.pct(db.config.comTarjeta) + ')'), h('span', { class: 'num' }, money(t.tarj))) : null,
          h('div', { class: 'f t' }, h('span', null, est.pago === 'Crédito' || est.pago === 'Apartado' ? 'Total' : 'A cobrar'), h('span', { class: 'num' }, money(est.pago === 'Crédito' || est.pago === 'Apartado' ? t.total : t.cobrar)))));
      }

      async function cobrar() {
        const t = totales(db);
        if (!est.pago) { UI.toast('Elige la forma de cobro', 'mal'); return; }
        if (t.codMsg) { UI.toast(t.codMsg, 'mal'); return; }
        if (est.pago === 'Crédito') return abrirCredito(t);
        if (est.pago === 'Apartado') return abrirApartado(t);
        const btn = document.getElementById('btn-cobrar'); if (btn) btn.disabled = true;
        const r = await Store.hacer('venta', { items: itemsCarrito(), pago: est.pago, cod: est.cod.trim() });
        if (btn) btn.disabled = false;
        if (!r.ok) { UI.toast(r.msg || 'No se pudo registrar la venta', 'mal', 5000); return; }
        exito({ titulo: 'Venta registrada', total: r.total, cobrar: r.cobrado, pago: est.pago, desc: r.descuento, pendiente: true });
        est.cart = {}; est.cod = ''; est.pago = '';
        App.refresh();
      }

      function exito(o) {
        const offline = !Store.S.online;
        UI.modal({ titulo: '', ancho: '420px', cuerpo: h('div', { class: 'exito' }, h('div', { class: 'palomita' }, '✓'), h('h2', null, o.titulo),
          h('div', { class: 'grande num' }, money(o.cobrar !== undefined ? o.cobrar : o.total)),
          o.pago ? h('div', null, o.pago + (o.desc ? ' · descuento ' + money(o.desc) : '')) : null,
          o.extra ? h('div', { class: 'muted' }, o.extra) : null,
          o.pendiente && offline ? h('div', { class: 'aviso ambar', style: { marginTop: '10px' } }, 'Sin internet: la venta quedó guardada en este dispositivo y se enviará sola al volver la conexión.') : null),
          acciones: [{ texto: 'Listo', tipo: 'primary' }] });
      }

      /* ---------- crédito ---------- */
      function abrirCredito(t) {
        const idOp = Store.nuevoId();
        let cuenta = null, sinCred = false;
        const tel = UI.entrada({ type: 'tel', inputmode: 'numeric', maxlength: 14, placeholder: '10 dígitos' });
        const info = h('div');
        const primer = UI.dinero({ value: '0' }), forma = h('select', null, UI.opciones(HOOD.ABONO_FORMAS));
        const msg = h('div', { class: 'aviso mal', style: { display: 'none' } });
        const err = m => { msg.textContent = m; msg.style.display = m ? '' : 'none'; };
        async function buscar() {
          err(''); cuenta = null; sinCred = false; UI.vaciar(info);
          const t10 = HOOD.tel10(tel.value);
          if (t10.length !== 10) { err('Escribe los 10 dígitos del celular'); return; }
          const r = Store.S.user.rol === 'dueno' ? HOOD.cuentaCliente(db, t10, Store.hoy(), t.total) : await Store.consultar('q_cliente', t10, t.total);
          if (!r.ok) { err('Este cliente no está autorizado para comprar a crédito. ' + (Store.S.user.rol === 'dueno' ? 'Dalo de alta en la pestaña Créditos.' : 'El dueño debe darlo de alta en Créditos.') + ' Si quiere llevarse la prenda, puede apartarla.'); return; }
          cuenta = r;
          info.appendChild(h('div', { class: 'card', style: { background: '#fff' } }, h('div', { class: 'fuerte' }, r.nombre),
            h('div', { class: 'fila sp' }, h('span', null, 'Debe actualmente'), h('span', { class: 'num fuerte' }, money(r.adeudado))),
            r.alcanza === false ? h('div', { class: 'aviso mal', style: { marginTop: '8px' } }, 'Sin crédito disponible para esta compra (' + money(t.total) + '). No se puede vender a crédito; el cliente puede pagar de contado o apartar.') : h('div', { class: 'aviso ok', style: { marginTop: '8px' } }, 'Crédito autorizado: sí alcanza para esta compra.')));
          sinCred = r.alcanza === false; if (sinCred) cuenta = null;
        }
        tel.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } });
        const m = UI.modal({ titulo: 'Venta a crédito · ' + money(t.total), cuerpo: h('div', null,
          h('div', { class: 'fila' }, h('div', { style: { flex: 1 } }, UI.campo('Celular del cliente', tel)), h('button', { class: 'btn', type: 'button', onclick: buscar, style: { marginBottom: '10px' } }, 'Buscar')),
          info, msg,
          h('div', { class: 'grid2' }, UI.campo('Primer pago (opcional)', primer), UI.campo('Forma del pago', forma)),
          h('small', null, 'Plazo: ' + db.config.plazoCredito + ' días.')),
          acciones: [{ texto: 'Cancelar', tipo: 'ghost' }, { texto: 'Registrar crédito', tipo: 'primary', cerrar: false, onclick: async (cerrar, btn) => {
            if (!cuenta) { await buscar(); if (!cuenta) { err(sinCred ? 'Sin crédito disponible para esta compra. No se puede vender a crédito.' : (msg.textContent || 'Escribe el celular del cliente y pulsa Buscar')); return; } }
            btn.disabled = true; err('');
            const args = { tel: cuenta.tel, items: itemsCarrito(), cod: est.cod.trim(), primer: UI.leerNum(primer.value), forma: forma.value };
            const r = Store.S.user.rol === 'dueno' ? await Store.hacer('credito', args) : await Store.hacerEnLinea('credito', args, idOp);
            btn.disabled = false;
            if (!r.ok) { err(r.msg || 'No se pudo registrar'); return; }
            cerrar();
            exito({ titulo: 'Crédito registrado', total: r.total, cobrar: r.total, pago: 'A nombre de ' + cuenta.nombre, extra: r.primer ? 'Primer pago: ' + money(r.primer) : '', pendiente: Store.S.user.rol === 'dueno' });
            est.cart = {}; est.cod = ''; est.pago = ''; App.refresh();
          } }] });
        return m;
      }

      /* ---------- apartado: cualquier persona puede apartar (no necesita estar dada de alta) ---------- */
      function abrirApartado(t) {
        const idOp = Store.nuevoId();
        const pctMin = HOOD.minApartado(db), minimo = HOOD.r2(t.total * pctMin);
        const tel = UI.entrada({ type: 'tel', inputmode: 'numeric', maxlength: 14, placeholder: '10 dígitos' });
        const nombre = UI.entrada({ placeholder: 'Nombre completo' });
        const campoNombre = UI.campo('Nombre del cliente (cliente nuevo)', nombre);
        const conocido = h('div', { class: 'aviso ok', style: { display: 'none' } });
        campoNombre.style.display = 'none';
        const primer = UI.dinero({ value: String(minimo) }), forma = h('select', null, UI.opciones(HOOD.ABONO_FORMAS));
        const msg = h('div', { class: 'aviso mal', style: { display: 'none' } });
        const err = m => { msg.textContent = m; msg.style.display = m ? '' : 'none'; };
        let ultimo = '', nombreConocido = '';
        async function buscar() {
          const t10 = HOOD.tel10(tel.value);
          if (t10.length !== 10) { campoNombre.style.display = 'none'; conocido.style.display = 'none'; ultimo = ''; nombreConocido = ''; return; }
          if (t10 === ultimo) return;
          ultimo = t10; err('');
          let r = null;
          try { r = Store.S.user.rol === 'dueno' ? HOOD.cuentaApartados(db, t10) : await Store.consultar('q_apartados', t10); } catch (e) { r = null; }
          if (t10 !== ultimo) return;
          if (r && r.ok && r.nombre) {
            nombreConocido = r.nombre; campoNombre.style.display = 'none';
            conocido.textContent = 'Cliente: ' + r.nombre + (r.apartados && r.apartados.some(a => a.estado === 'Apartado') ? ' · ya tiene apartados abiertos' : ''); conocido.style.display = '';
          } else {
            nombreConocido = ''; conocido.style.display = 'none'; campoNombre.style.display = '';
            if (!r || !r.ok) { campoNombre.querySelector('.et').textContent = 'Nombre del cliente (no se pudo consultar; escríbelo)'; }
          }
        }
        tel.addEventListener('input', buscar);
        UI.modal({ titulo: 'Apartar · ' + money(t.total), cuerpo: h('div', null,
          UI.campo('Celular del cliente', tel), conocido, campoNombre, msg,
          h('div', { class: 'grid2' }, UI.campo('Cuánto deja de apartado', primer, 'Mínimo ' + money(minimo) + ' (' + UI.pct(pctMin) + ' del total)'), UI.campo('Forma del pago', forma)),
          h('small', null, 'Tiene ' + db.config.plazoApartado + ' días para liquidar. Si no liquida, lo abonado se queda como ingreso y la pieza vuelve a la existencia.')),
          acciones: [{ texto: 'Cancelar', tipo: 'ghost' }, { texto: 'Registrar apartado', tipo: 'primary', cerrar: false, onclick: async (cerrar, btn) => {
            if (HOOD.tel10(tel.value).length !== 10) { err('Escribe los 10 dígitos del celular'); return; }
            await buscar();
            btn.disabled = true; err('');
            const args = { tel: HOOD.tel10(tel.value), nombre: nombreConocido || nombre.value, items: itemsCarrito(), cod: est.cod.trim(), primer: UI.leerNum(primer.value), forma: forma.value };
            const r = Store.S.user.rol === 'dueno' ? await Store.hacer('apartado', args) : await Store.hacerEnLinea('apartado', args, idOp);
            btn.disabled = false;
            if (!r.ok) { err(r.msg || 'No se pudo registrar'); return; }
            cerrar();
            exito({ titulo: 'Apartado registrado', total: r.total, cobrar: args.primer, pago: 'Dejó de apartado (' + args.forma + ')', extra: r.limite ? 'Fecha límite: ' + UI.fecha(r.limite) : '', pendiente: Store.S.user.rol === 'dueno' });
            est.cart = {}; est.cod = ''; est.pago = ''; App.refresh();
          } }] });
      }

      buscador = UI.entrada({ type: 'search', class: 'busca-grande', placeholder: 'Código del producto…', value: est.q, autocomplete: 'off', autocapitalize: 'characters', enterkeyhint: 'search',
        oninput: ev => { est.q = ev.target.value; est.max = 40; pintarProductos(); }, onkeydown: ev => { if (ev.key === 'Enter') { ev.preventDefault(); enter(); } } });
      root.appendChild(h('div', { class: 'venta' },
        h('div', { class: 'col-buscar' }, metaBarra(db), h('div', { class: 'buscar' }, buscador), resultados),
        carro));
      root.appendChild(leyenda(db));
      pintarProductos(); pintarCarro();
      if (matchMedia('(min-width: 900px)').matches) setTimeout(() => buscador.focus(), 30);
    }
  };
})();
