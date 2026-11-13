/* Pestaña RESUMEN (dueño): lo vendido, lo comprado y toda la información por semana, mes y año */
(function () {
  const { h, money } = UI;
  const Views = (window.Views = window.Views || {});
  const est = { modo: 'semana', ref: '' };

  function rango(modo, ref) {
    if (modo === 'semana') { const i = HOOD.lunesDe(ref); return { ini: i, fin: HOOD.sumaDias(i, 6), paso: 'dia', etiqueta: UI.fechaCorta(i) + ' al ' + UI.fecha(HOOD.sumaDias(i, 6)) }; }
    if (modo === 'mes') { const i = HOOD.iniMes(ref); return { ini: i, fin: HOOD.finMes(i), paso: 'dia', etiqueta: UI.mesLargo(i) }; }
    const a = ref.slice(0, 4); return { ini: a + '-01-01', fin: a + '-12-31', paso: 'mes', etiqueta: 'Año ' + a };
  }
  const mover = (modo, ini, d) => modo === 'semana' ? HOOD.sumaDias(ini, 7 * d) : modo === 'mes' ? HOOD.iniMes(HOOD.sumaDias(d < 0 ? ini : HOOD.finMes(ini), d < 0 ? -1 : 1)) : (Number(ini.slice(0, 4)) + d) + '-01-01';
  const fila = (et, val, cls) => h('div', { class: 'fila sp', style: { padding: '4px 0' } }, h('span', { class: cls || '' }, et), h('span', { class: 'num ' + (cls || '') }, val));

  Views.resumen = {
    titulo: 'Resumen', icono: 'resumen',
    render(root) {
      const db = Store.view(), hoy = Store.hoy();
      if (!est.ref) est.ref = hoy;
      const r = rango(est.modo, est.ref), p = HOOD.periodo(db, r.ini, r.fin, hoy);
      const futuro = r.fin >= hoy;
      root.appendChild(h('div', { class: 'titulo-vista' }, UI.segmentos([['semana', 'Semana'], ['mes', 'Mes'], ['anio', 'Año']], est.modo, id => { est.modo = id; est.ref = hoy; App.refresh(); }),
        h('div', { class: 'fecha-nav' }, h('button', { class: 'btn chico', type: 'button', onclick: () => { est.ref = mover(est.modo, r.ini, -1); App.refresh(); } }, '‹'),
          h('span', { class: 't', style: { minWidth: '190px' } }, r.etiqueta), h('button', { class: 'btn chico', type: 'button', disabled: futuro, onclick: () => { est.ref = mover(est.modo, r.ini, 1); App.refresh(); } }, '›')),
        h('button', { class: 'btn', type: 'button', onclick: () => Informe.resumen(est.modo, r) }, UI.icono('imprimir'), 'Imprimir / PDF')));

      root.appendChild(h('div', { class: 'kpis' }, UI.kpi('Vendido', money(p.vendido), p.tickets + ' tickets · ' + UI.num(p.articulos) + ' artículos'), UI.kpi('Comprado (reinversión)', money(p.reinversion), 'mercancía para el inventario'),
        UI.kpi('Cobrado', money(p.cobrado), 'contado + abonos', 'ok'), UI.kpi('Utilidad neta', money(p.utilNeta), 'después de gastos y nómina', p.utilNeta >= 0 ? 'ok' : 'mal')));

      // Gráfica de líneas: ventas por mes del año que estás viendo
      const anio = r.ini.slice(0, 4);
      const meses = HOOD.serie(db, anio + '-01-01', anio + '-12-31', 'mes', hoy).filter(s => s.ini <= hoy);
      const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      root.appendChild(h('div', { class: 'card' }, h('h3', null, 'Ventas por mes · ' + anio),
        UI.lineas(meses.map(s => ({ et: MES[Number(s.ini.slice(5, 7)) - 1], v: est.modo === 'anio' ? [s.vendido, s.cobrado, s.neto] : [s.vendido] })),
          est.modo === 'anio' ? [{ nombre: 'Vendido', color: '#4c6a84', area: true }, { nombre: 'Cobrado', color: '#8aa4ba' }, { nombre: 'Utilidad neta', color: '#2f7d5b' }] : [{ nombre: 'Vendido', color: '#4c6a84', area: true }], 230),
        h('small', null, 'Cada punto es un mes. Toca un punto para ver el monto.')));
      if (est.modo !== 'anio') {
        const serie = HOOD.serie(db, r.ini, r.fin, 'dia', hoy).filter(s => s.ini <= hoy);
        const et = s => est.modo === 'semana' ? UI.diaSemana(s.ini) + ' ' + s.ini.slice(8) : s.ini.slice(8);
        root.appendChild(h('div', { class: 'card' }, h('h3', null, 'Movimiento por día · ' + r.etiqueta),
          UI.lineas(serie.map(s => ({ et: et(s), v: [s.vendido, s.cobrado] })), [{ nombre: 'Vendido', color: '#4c6a84', area: true }, { nombre: 'Cobrado', color: '#2f7d5b' }], 200)));
      }

      // por cobrar (a hoy, no depende del periodo)
      const cred = HOOD.listaCreditos(db, hoy), ap = HOOD.listaApartados(db, hoy);
      const porCobrar = HOOD.r2(cred.reduce((a, c) => a + c.saldo, 0)), apSaldo = HOOD.r2(ap.filter(a => a.estado === 'Apartado').reduce((a, x) => a + x.saldo, 0));

      root.appendChild(h('div', { class: 'cols dos' },
        h('div', { class: 'card' }, h('h3', null, 'Estado de resultados'),
          fila('Ventas de contado', money(p.contado)), fila('Abonos recibidos', money(p.abonos)), fila('Apartados liquidados', money(p.apartLiq)), fila('Vendido a crédito (por cobrar)', money(p.credito)),
          fila('Utilidad cobrada', money(p.util), 'fuerte'), fila('− Gastos operativos', money(p.gastosOp)), fila('− Comisiones de vendedores', money(p.comisiones)), fila('− Sueldos fijos', money(p.sueldos)),
          h('div', { style: { borderTop: '1px solid var(--line)', marginTop: '6px', paddingTop: '6px' } }, fila('UTILIDAD NETA', money(p.utilNeta), 'fuerte ' + (p.utilNeta >= 0 ? 'ok' : 'mal'))),
          fila('Descuentos dados', money(p.descuentos), 'muted'), fila('Ticket promedio', money(p.ticketPromedio), 'muted'), fila('Comisión de tarjeta (del banco)', money(p.tarjeta), 'muted'), fila('Pagado al equipo en el periodo', money(p.nominaPagada), 'muted')),
        h('div', { class: 'card' }, h('h3', null, 'Cómo te pagaron'),
          Object.keys(p.porPago).length ? Object.keys(p.porPago).map(k => fila(k, money(p.porPago[k]))) : UI.vacio('Sin ventas de contado.'),
          Object.keys(p.abonosPorForma).length ? h('div', { style: { marginTop: '8px' } }, h('div', { class: 'muted fuerte' }, 'Abonos'), Object.keys(p.abonosPorForma).map(k => fila(k, money(p.abonosPorForma[k])))) : null,
          h('div', { style: { borderTop: '1px solid var(--line)', marginTop: '10px', paddingTop: '8px' } }, h('h3', null, 'Por cobrar hoy'), fila('Créditos de clientes', money(porCobrar), porCobrar > 0 ? 'ambar fuerte' : ''), fila('Saldo de apartados abiertos', money(apSaldo))))));

      const cats = Object.keys(p.porCategoria).map(k => ({ c: k, m: p.porCategoria[k] })).sort((x, y) => y.m - x.m);
      root.appendChild(h('div', { class: 'cols dos' },
        h('div', { class: 'card' }, h('h3', null, 'Por vendedor'), !p.vendedores.length ? UI.vacio('Sin ventas en el periodo.') : p.vendedores.map(v => h('div', { class: 'item' },
          h('div', { class: 'grow' }, h('div', { class: 't1' }, v.vendedor), h('div', { class: 't2' }, 'a crédito ' + money(v.credito) + ' · abonos ' + money(v.abonos) + ' · comisión ' + money(v.comision))), h('div', { class: 'monto' }, money(v.vendido))))),
        h('div', { class: 'card' }, h('h3', null, 'Gastos por categoría'), !cats.length ? UI.vacio('Sin gastos en el periodo.') : cats.map(x => fila(x.c, money(x.m))))));
    }
  };
})();
