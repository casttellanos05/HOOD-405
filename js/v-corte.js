/* Pestaña CORTE (dueño): corte diario de caja y corte semanal con nómina (sueldo + comisiones), pagos y pendientes */
(function () {
  const { h, money } = UI;
  const Views = (window.Views = window.Views || {});
  const est = { sub: 'diario', fecha: '', semana: '' };

  const fila = (et, val, cls) => h('div', { class: 'fila sp', style: { padding: '4px 0' } }, h('span', { class: cls || '' }, et), h('span', { class: 'num ' + (cls || '') }, val));

  function diario(root, db) {
    const hoy = Store.hoy();
    if (!est.fecha) est.fecha = hoy;
    const fecha = est.fecha, c = HOOD.corteDiario(db, fecha, hoy), p = c.periodo;
    root.appendChild(h('div', { class: 'fila sp', style: { marginBottom: '10px' } },
      h('div', { class: 'fecha-nav' },
        h('button', { class: 'btn chico', type: 'button', onclick: () => { est.fecha = HOOD.sumaDias(fecha, -1); App.refresh(); } }, '‹'),
        h('input', { type: 'date', value: fecha, max: hoy, style: { width: 'auto' }, onchange: ev => { if (ev.target.value) { est.fecha = ev.target.value; App.refresh(); } } }),
        h('button', { class: 'btn chico', type: 'button', disabled: fecha >= hoy, onclick: () => { est.fecha = HOOD.sumaDias(fecha, 1); App.refresh(); } }, '›')),
      fecha !== hoy ? h('button', { class: 'btn chico', type: 'button', onclick: () => { est.fecha = hoy; App.refresh(); } }, 'Hoy') : null));
    root.appendChild(h('div', { class: 'kpis' }, UI.kpi('Total cobrado', money(c.totalCobrado), 'ventas de contado + abonos', 'ok'), UI.kpi('Efectivo', money(c.efectivo)),
      UI.kpi('Transferencia', money(c.transferencia)), UI.kpi('Tarjeta', money(c.tarjeta), 'incluye comisión del banco')));

    // ----- caja -----
    const contado = UI.dinero({ placeholder: 'Cuenta el efectivo y escríbelo', value: c.corte ? c.corte.contado : '' });
    const notas = UI.entrada({ placeholder: 'Notas del corte (opcional)', value: c.corte ? c.corte.notas : '' });
    const dif = h('div', { class: 'aviso info' }, 'Escribe el efectivo contado para ver la diferencia.');
    const calc = () => {
      if (contado.value === '') { dif.className = 'aviso info'; dif.textContent = 'Escribe el efectivo contado para ver la diferencia.'; return; }
      const d = HOOD.r2(UI.leerNum(contado.value) - c.esperado);
      dif.className = 'aviso ' + (d === 0 ? 'ok' : d > 0 ? 'ambar' : 'mal');
      dif.textContent = d === 0 ? 'La caja cuadra.' : (d > 0 ? 'Sobran ' : 'Faltan ') + money(Math.abs(d));
    };
    contado.addEventListener('input', calc); calc();
    root.appendChild(h('div', { class: 'card' }, h('h3', null, 'Caja: efectivo que debe haber'),
      fila('Fondo de caja inicial', money(c.fondo)), fila('+ Ventas en efectivo', money(c.ventas.Efectivo || 0)), fila('+ Abonos en efectivo', money(c.abonosForma.Efectivo || 0)),
      fila('− Gastos pagados en efectivo', money(c.gastosEfectivo)), fila('− Compras de mercancía en efectivo', money(c.comprasEfectivo)),
      h('div', { style: { borderTop: '1px solid var(--line)', marginTop: '6px', paddingTop: '6px' } }, fila('EFECTIVO QUE DEBE HABER', money(c.esperado), 'fuerte')),
      h('div', { style: { marginTop: '12px' } }, UI.campo('Efectivo contado', contado), dif, UI.campo('Notas', notas),
        c.corte ? h('div', { class: 'aviso ok' }, 'Corte cerrado a las ' + UI.hora(c.corte.hora) + ' por ' + c.corte.usuario + ': esperado ' + money(c.corte.esperado) + ', contado ' + money(c.corte.contado) + ', diferencia ' + money(c.corte.dif) + '.') : null,
        h('button', { class: 'btn primary grande', type: 'button', onclick: async ev => {
          if (contado.value === '') { UI.toast('Escribe el efectivo contado', 'mal'); return; }
          const btn = ev.currentTarget; btn.disabled = true;
          const r = await Store.hacer('corte', { fecha, contado: UI.leerNum(contado.value), notas: notas.value });
          btn.disabled = false;
          if (!r.ok) { UI.toast(r.msg, 'mal', 5000); return; }
          UI.toast('Corte guardado · diferencia ' + money(r.diferencia), r.diferencia === 0 ? 'ok' : '', 5000); App.refresh();
        } }, c.corte ? 'Guardar otro corte de este día' : 'Cerrar corte del día'))));

    // ----- línea: últimos 7 días -----
    const ult = HOOD.serie(db, HOOD.sumaDias(fecha, -6), fecha, 'dia', hoy);
    root.appendChild(h('div', { class: 'card' }, h('h3', null, 'Últimos 7 días'),
      UI.lineas(ult.map(d => ({ et: UI.diaSemana(d.ini) + ' ' + d.ini.slice(8), v: [d.cobrado, d.util] })), [{ nombre: 'Cobrado', color: '#4c6a84', area: true }, { nombre: 'Utilidad cobrada', color: '#2f7d5b' }], 190)));

    // ----- ventas del día -----
    root.appendChild(h('div', { class: 'cols dos' },
      h('div', { class: 'card' }, h('h3', null, 'Ventas del día'),
        fila('Tickets', UI.num(p.tickets)), fila('Artículos vendidos', UI.num(p.articulos)), fila('Ventas de contado', money(p.contado)), fila('Vendido a crédito (por cobrar)', money(p.credito)),
        fila('Apartados liquidados', money(p.apartLiq)), fila('Abonos recibidos', money(p.abonos)), fila('Descuentos dados', money(p.descuentos)),
        fila('Utilidad cobrada', money(p.util), 'fuerte'), fila('Comisiones generadas', money(p.comisiones)), fila('Gastos del día', money(p.gastosOp)),
        p.vendedores.length ? h('div', { style: { marginTop: '10px' } }, h('h3', null, 'Por vendedor'), p.vendedores.map(v => fila(v.vendedor, money(v.vendido) + (v.abonos ? ' · abonos ' + money(v.abonos) : '')))) : null),
      h('div', { class: 'card' }, h('h3', null, 'Tickets (' + c.tickets.length + ')'),
        !c.tickets.length ? UI.vacio('Sin ventas este día.') : h('div', { class: 'lista' }, c.tickets.map(t => h('div', { class: 'item' },
          h('div', { class: 'grow' }, h('div', { class: 't1' }, t.items.join(', ')), h('div', { class: 't2' }, UI.hora(t.hora) + ' · ' + t.pago + ' · ' + t.vendedor)), h('div', { class: 'monto' }, money(t.total))))),
        c.abonos.length ? h('div', null, h('h3', { style: { marginTop: '12px' } }, 'Abonos'), h('div', { class: 'lista' }, c.abonos.map(a => h('div', { class: 'item' },
          h('div', { class: 'grow' }, h('div', { class: 't1' }, a.cliente), h('div', { class: 't2' }, UI.hora(a.hora) + ' · ' + a.forma + (a.apartado ? ' · apartado' : ' · crédito'))), h('div', { class: 'monto' }, money(a.monto)))))) : null)));
  }

  /* ---------- semanal ---------- */
  /** Paga a un empleado. El monto se aplica primero a las semanas más antiguas con saldo; lo que no se pague pasa a la semana siguiente como remanente. */
  function pagar(e, semanaActual) {
    const pend = e.atrasadas.map(a => ({ semana: a.semana, pendiente: a.pendiente })).concat(e.pendiente > 0.004 ? [{ semana: semanaActual, pendiente: e.pendiente }] : []).filter(x => x.pendiente > 0.004).sort((x, y) => x.semana.localeCompare(y.semana));
    const total = HOOD.r2(pend.reduce((a, x) => a + x.pendiente, 0));
    const monto = UI.dinero({ value: total > 0 ? total : '' }), forma = h('select', null, UI.opciones(HOOD.ABONO_FORMAS)), nota = UI.entrada({ placeholder: 'Nota (opcional)' });
    const quedara = h('div', { class: 'aviso info' });
    const calc = () => { const m = UI.leerNum(monto.value), resto = HOOD.r2(total - m); quedara.textContent = resto > 0.004 ? 'Quedará pendiente ' + money(resto) + ': pasa a la próxima semana como remanente.' : resto < -0.004 ? 'Es más de lo que se le debe (' + money(total) + ').' : 'Se paga todo lo que se le debe.'; };
    monto.addEventListener('input', calc); calc();
    const msg = h('div', { class: 'aviso mal', style: { display: 'none' } });
    UI.modal({ titulo: 'Pagar a ' + e.nombre, cuerpo: h('div', null,
      h('div', { class: 'totales' }, pend.map(x => h('div', { class: 'f' }, h('span', null, x.semana === semanaActual ? 'Esta semana (sueldo + comisiones)' : 'Remanente de la semana del ' + UI.fecha(x.semana)), h('span', { class: 'num' }, money(x.pendiente)))),
        h('div', { class: 'f t' }, h('span', null, 'Pago total'), h('span', { class: 'num' }, money(total)))),
      h('div', { class: 'grid2' }, UI.campo('Monto que pagas ahora', monto), UI.campo('Forma', forma)), quedara, UI.campo('Nota', nota), msg,
      h('small', null, 'Se registra como gasto en la categoría Sueldos y baja de la caja si pagas en efectivo.')),
      acciones: [{ texto: 'Cancelar', tipo: 'ghost' }, { texto: 'Registrar pago', tipo: 'primary', cerrar: false, onclick: async (cerrar, btn) => {
        let resto = HOOD.r2(UI.leerNum(monto.value));
        if (!(resto > 0)) { msg.textContent = 'Escribe el monto que vas a pagar'; msg.style.display = ''; return; }
        if (resto > total + 0.004) { msg.textContent = 'No puedes pagar más de lo que se le debe (' + money(total) + ')'; msg.style.display = ''; return; }
        btn.disabled = true;
        for (const x of pend) {
          if (resto <= 0.004) break;
          const parte = HOOD.r2(Math.min(resto, x.pendiente));
          const r = await Store.hacer('pago', { vendedor: e.nombre, semana: x.semana, monto: parte, forma: forma.value, nota: nota.value });
          if (!r.ok) { btn.disabled = false; msg.textContent = r.msg; msg.style.display = ''; App.refresh(); return; }
          resto = HOOD.r2(resto - parte);
        }
        btn.disabled = false; cerrar(); UI.toast('Pago registrado', 'ok'); App.refresh();
      } }] });
  }

  function semanal(root, db) {
    const hoy = Store.hoy(), tope = HOOD.lunesDe(hoy);
    if (!est.semana) est.semana = tope;
    const lunes = est.semana, dom = HOOD.sumaDias(lunes, 6);
    const p = HOOD.periodo(db, lunes, dom, hoy), nom = HOOD.nomina(db, lunes, hoy);
    root.appendChild(h('div', { class: 'fila sp', style: { marginBottom: '10px' } },
      h('div', { class: 'fecha-nav' }, h('button', { class: 'btn chico', type: 'button', onclick: () => { est.semana = HOOD.sumaDias(lunes, -7); App.refresh(); } }, '‹'),
        h('span', { class: 't', style: { minWidth: '210px' } }, UI.fechaCorta(lunes) + ' al ' + UI.fecha(dom)),
        h('button', { class: 'btn chico', type: 'button', disabled: lunes >= tope, onclick: () => { est.semana = HOOD.sumaDias(lunes, 7); App.refresh(); } }, '›')),
      lunes !== tope ? h('button', { class: 'btn chico', type: 'button', onclick: () => { est.semana = tope; App.refresh(); } }, 'Esta semana') : null));

    const pendienteTotal = HOOD.r2(nom.reduce((a, e) => a + e.pendienteTotal, 0));
    root.appendChild(h('div', { class: 'kpis' }, UI.kpi('Vendido', money(p.vendido), p.tickets + ' tickets · ' + UI.num(p.articulos) + ' artículos'), UI.kpi('Cobrado', money(p.cobrado), 'contado + abonos'),
      UI.kpi('Utilidad neta', money(p.utilNeta), 'después de gastos y nómina', p.utilNeta >= 0 ? 'ok' : 'mal'), UI.kpi('Pendiente de pagar al equipo', money(pendienteTotal), 'sueldo + comisiones', pendienteTotal > 0 ? 'ambar' : 'ok')));

    const dias = HOOD.serie(db, lunes, dom, 'dia', hoy);
    root.appendChild(h('div', { class: 'cols dos' },
      h('div', { class: 'card' }, h('h3', null, 'Resultado de la semana'),
        fila('Ventas de contado', money(p.contado)), fila('Abonos recibidos', money(p.abonos)), fila('Vendido a crédito (por cobrar)', money(p.credito)),
        fila('Utilidad cobrada', money(p.util), 'fuerte'), fila('− Gastos operativos', money(p.gastosOp)), fila('− Comisiones de vendedores', money(p.comisiones)), fila('− Sueldos fijos', money(p.sueldos)),
        h('div', { style: { borderTop: '1px solid var(--line)', marginTop: '6px', paddingTop: '6px' } }, fila('UTILIDAD NETA', money(p.utilNeta), 'fuerte ' + (p.utilNeta >= 0 ? 'ok' : 'mal'))),
        fila('Compras de mercancía (reinversión)', money(p.reinversion), 'muted'), fila('Pagado al equipo esta semana', money(p.nominaPagada), 'muted')),
      h('div', { class: 'card' }, h('h3', null, 'Día por día'),
        UI.lineas(dias.filter(d => d.ini <= hoy).map(d => ({ et: UI.diaSemana(d.ini) + ' ' + d.ini.slice(8), v: [d.cobrado, d.util] })), [{ nombre: 'Cobrado', color: '#4c6a84', area: true }, { nombre: 'Utilidad cobrada', color: '#2f7d5b' }], 200))));

    // ----- nómina: sueldo + comisiones (automático) + remanente = pago total -----
    const activos = nom.filter(e => e.devengado || e.pagado || e.pendienteTotal || e.atrasadas.length || !e.baja);
    root.appendChild(h('div', { class: 'card' }, h('div', { class: 'cab' }, h('h3', null, 'Pago del equipo'), pendienteTotal > 0 ? UI.badge('Por pagar ' + money(pendienteTotal), 'ambar') : UI.badge('Todo pagado', 'ok')),
      h('small', null, 'Las comisiones se suman solas al sueldo. Lo que no se pague pasa a la próxima semana como remanente.'),
      !activos.length ? UI.vacio('Aún no hay empleados. Agrégalos en Config.') : activos.map(e => {
        const remanente = HOOD.r2(e.atrasadas.reduce((a, x) => a + x.pendiente, 0)), totalPagar = e.pendienteTotal;
        return h('div', { class: 'card', style: { background: '#fff', boxShadow: 'none', border: '1px solid var(--line)', marginTop: '10px' } },
          h('div', { class: 'cab' }, h('div', { class: 'fuerte' }, e.nombre + (e.baja ? ' (baja)' : '')), h('small', null, 'Comisión ' + UI.pct(e.pct) + ' sobre ' + (e.base === 'Total' ? 'el valor total' : 'la utilidad'))),
          fila('Sueldo semanal', money(e.sueldo)), fila('+ Comisiones de la semana', money(e.comision)),
          remanente > 0.004 ? fila('+ Remanente de semanas pasadas', money(remanente), 'ambar fuerte') : null,
          h('div', { style: { borderTop: '1px solid var(--line)', marginTop: '4px', paddingTop: '4px' } }, fila('PAGO TOTAL', money(e.devengado + remanente), 'fuerte')),
          e.pagado > 0 ? fila('− Ya pagado esta semana', money(e.pagado)) : null,
          fila('Por pagar', money(totalPagar), totalPagar > 0.004 ? 'fuerte ambar' : 'ok'),
          e.pagos.length ? h('div', { style: { margin: '6px 0' } }, e.pagos.map(g => h('div', { class: 'fila sp', style: { fontSize: '13px' } },
            h('span', { class: 'muted' }, UI.fecha(g.fecha) + ' · ' + g.forma + (g.nota ? ' · ' + g.nota : '')), h('span', null, h('span', { class: 'num' }, money(g.monto) + ' '),
              g.monto > 0 ? h('button', { class: 'btn chico ghost', type: 'button', onclick: async () => {
                if (!await UI.confirmar('Eliminar pago', 'Se borra el pago de ' + money(g.monto) + ' a ' + e.nombre + ' y su gasto de Sueldos. Lo pagado vuelve a quedar pendiente en esta semana.', 'Eliminar pago', true)) return;
                const r = await Store.hacer('pago_anular', { id: g.id }); if (!r.ok) { UI.toast(r.msg, 'mal'); return; } UI.toast('Pago eliminado'); App.refresh();
              } }, 'Eliminar') : null)))) : null,
          totalPagar > 0.004 ? h('button', { class: 'btn acento', type: 'button', style: { marginTop: '6px' }, onclick: () => pagar(e, lunes) }, 'Registrar pago') : null,
          e.atrasadas.length ? h('small', { style: { display: 'block', marginTop: '6px' } }, 'Remanente: ' + e.atrasadas.map(a => 'semana del ' + UI.fechaCorta(a.semana) + ' ' + money(a.pendiente)).join(' · ')) : null);
      })));
  }

  Views.corte = {
    titulo: 'Corte', icono: 'corte',
    render(root) {
      const db = Store.view();
      root.appendChild(h('div', { class: 'titulo-vista' }, UI.segmentos([['diario', 'Corte diario'], ['semanal', 'Corte semanal']], est.sub, id => { est.sub = id; App.refresh(); })));
      if (est.sub === 'semanal') semanal(root, db); else diario(root, db);
    }
  };
})();
