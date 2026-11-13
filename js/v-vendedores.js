/* Pestaña VENDEDORES (dueño): resumen completo de cada vendedor, el mejor vendedor del periodo y el registro de sus ventas */
(function () {
  const { h, money } = UI;
  const Views = (window.Views = window.Views || {});
  const est = { modo: 'mes', ref: '', sel: '', max: 30 };
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function rango(modo, ref) {
    if (modo === 'semana') { const i = HOOD.lunesDe(ref); return { ini: i, fin: HOOD.sumaDias(i, 6), etiqueta: UI.fechaCorta(i) + ' al ' + UI.fecha(HOOD.sumaDias(i, 6)) }; }
    if (modo === 'mes') { const i = HOOD.iniMes(ref); return { ini: i, fin: HOOD.finMes(i), etiqueta: UI.mesLargo(i) }; }
    const a = ref.slice(0, 4); return { ini: a + '-01-01', fin: a + '-12-31', etiqueta: 'Año ' + a };
  }
  const mover = (modo, ini, d) => modo === 'semana' ? HOOD.sumaDias(ini, 7 * d) : modo === 'mes' ? HOOD.iniMes(HOOD.sumaDias(d < 0 ? ini : HOOD.finMes(ini), d < 0 ? -1 : 1)) : (Number(ini.slice(0, 4)) + d) + '-01-01';
  const fila = (et, val, cls) => h('div', { class: 'fila sp', style: { padding: '4px 0' } }, h('span', { class: cls || '' }, et), h('span', { class: 'num ' + (cls || '') }, val));
  const medalla = i => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1));
  const etiquetaSerie = (r, clave) => (r.mensual ? MES[Number(clave.slice(5, 7)) - 1] : (est.modo === 'semana' ? UI.diaSemana(clave) + ' ' : '') + clave.slice(8));

  Views.vendedores = {
    titulo: 'Vendedores', icono: 'vendedores',
    render(root) {
      const db = Store.view(), hoy = Store.hoy();
      if (!est.ref) est.ref = hoy;
      const r = rango(est.modo, est.ref), futuro = r.fin >= hoy;
      const R = HOOD.resumenVendedores(db, r.ini, r.fin, hoy);
      const lista = R.vendedores;

      root.appendChild(h('div', { class: 'titulo-vista' }, UI.segmentos([['semana', 'Semana'], ['mes', 'Mes'], ['anio', 'Año']], est.modo, id => { est.modo = id; est.ref = hoy; App.refresh(); }),
        h('div', { class: 'fecha-nav' }, h('button', { class: 'btn chico', type: 'button', onclick: () => { est.ref = mover(est.modo, r.ini, -1); App.refresh(); } }, '‹'),
          h('span', { class: 't', style: { minWidth: '190px' } }, r.etiqueta), h('button', { class: 'btn chico', type: 'button', disabled: futuro, onclick: () => { est.ref = mover(est.modo, r.ini, 1); App.refresh(); } }, '›'))));

      if (!lista.length) { root.appendChild(h('div', { class: 'card' }, UI.vacio('Todavía no hay vendedores. Agrégalos en Config > Empleados.'))); return; }
      const mejor = lista.find(x => x.vendedor === R.mejor), mejorU = lista.find(x => x.vendedor === R.mejorUtil);
      const tickets = lista.reduce((a, x) => a + x.tickets, 0);
      root.appendChild(h('div', { class: 'kpis' },
        UI.kpi('Vendido por el equipo', money(R.total), tickets + ' tickets'),
        UI.kpi('🏆 Mejor vendedor', mejor ? mejor.vendedor : '—', mejor ? money(mejor.vendido) + ' vendidos' : 'sin ventas en el periodo', mejor ? 'ok' : ''),
        UI.kpi('Más utilidad generada', mejorU ? mejorU.vendedor : '—', mejorU ? money(mejorU.util) : '', ''),
        UI.kpi('Comisiones del periodo', money(HOOD.r2(lista.reduce((a, x) => a + x.comision, 0))), 'sueldos fijos ' + money(HOOD.r2(lista.reduce((a, x) => a + x.sueldo, 0))))));

      /* ranking */
      const max = Math.max(1, ...lista.map(x => x.vendido));
      if (!est.sel || !lista.some(x => x.vendedor === est.sel)) est.sel = (mejor || lista[0]).vendedor;
      root.appendChild(h('div', { class: 'card' }, h('h3', null, 'Ranking de ventas'),
        h('div', { class: 'lista' }, lista.map((x, i) => h('button', { type: 'button', class: 'item rank' + (x.vendedor === est.sel ? ' sel' : ''), onclick: () => { est.sel = x.vendedor; est.max = 30; App.refresh(); } },
          h('span', { class: 'medalla' }, x.vendido > 0 ? medalla(i) : '–'),
          h('div', { class: 'grow' }, h('div', { class: 't1' }, x.vendedor, x.esDueno ? ' ' : '', x.esDueno ? UI.badge('dueño', 'info') : '', x.baja && x.baja <= hoy ? ' ' : '', x.baja && x.baja <= hoy ? UI.badge('de baja', 'mal') : ''),
            h('div', { class: 't2' }, x.tickets + ' tickets · ticket promedio ' + money(x.ticketPromedio) + ' · comisión ' + money(x.comision)),
            UI.progreso(x.vendido / max, 'ok')),
          h('div', { class: 'monto' }, money(x.vendido)))))));

      /* detalle */
      const v = lista.find(x => x.vendedor === est.sel);
      root.appendChild(h('div', { class: 'titulo-vista', style: { marginTop: '4px' } }, h('h2', null, v.vendedor), v.vendedor === R.mejor && v.vendido > 0 ? UI.badge('🏆 Mejor vendedor del periodo', 'ok') : null));
      root.appendChild(h('div', { class: 'kpis' },
        UI.kpi('Vendido', money(v.vendido), v.tickets + ' tickets · ' + UI.num(v.articulos) + ' artículos'),
        UI.kpi('Utilidad generada', money(v.util), v.vendido > 0 ? UI.pct(v.margen) + ' de lo vendido' : '', v.util >= 0 ? 'ok' : 'mal'),
        UI.kpi('Comisión ganada', money(v.comision), v.pct ? UI.pct(v.pct) + (v.base === 'Total' ? ' del total' : ' de la utilidad') : ''),
        UI.kpi('Ticket promedio', money(v.ticketPromedio), v.mejorDia ? 'mejor ' + (R.mensual ? 'mes' : 'día') + ': ' + etiquetaSerie(R, v.mejorDia.clave) + ' · ' + money(v.mejorDia.vendido) : '')));

      root.appendChild(h('div', { class: 'card' }, h('h3', null, 'Ventas de ' + v.vendedor + ' · ' + r.etiqueta),
        UI.lineas(v.serie.map(s => ({ et: etiquetaSerie(R, s.clave), v: [s.vendido] })), [{ nombre: 'Vendido', color: '#4c6a84', area: true }], 210),
        h('small', null, R.mensual ? 'Cada punto es un mes.' : 'Cada punto es un día.')));

      const formas = Object.keys(v.porPago).sort((a, b) => v.porPago[b] - v.porPago[a]);
      root.appendChild(h('div', { class: 'cols dos' },
        h('div', { class: 'card' }, h('h3', null, 'Cómo vendió'),
          fila('De contado', money(v.contado)), fila('A crédito (por cobrar)', money(v.credito)), fila('Apartados liquidados', money(v.apartLiq)),
          fila('Abonos que cobró', money(v.abonos), 'muted'), fila('Descuentos dados', money(v.descuentos), 'muted'),
          formas.length ? h('div', { style: { borderTop: '1px solid var(--line)', marginTop: '8px', paddingTop: '8px' } }, h('div', { class: 'muted fuerte' }, 'Por forma de cobro'), formas.map(k => fila(k, money(v.porPago[k])))) : null),
        h('div', { class: 'card' }, h('h3', null, 'Pago al empleado'),
          v.esDueno ? UI.vacio('El dueño no cobra sueldo ni comisión.') : h('div', null,
            fila('Sueldo fijo del periodo', money(v.sueldo)), fila('+ Comisiones', money(v.comision)),
            h('div', { style: { borderTop: '1px solid var(--line)', marginTop: '6px', paddingTop: '6px' } }, fila('Devengado', money(v.devengado), 'fuerte')),
            fila('Pagado en el periodo', money(v.pagado), 'muted'),
            fila('Pendiente por pagar hoy', money(v.pendienteHoy), v.pendienteHoy > 0 ? 'ambar fuerte' : 'muted'),
            h('small', null, 'El pendiente suma todas las semanas sin pagar (remanente). Se paga en Corte > Semanal.')))));

      /* registro de ventas */
      const ventas = v.ventas;
      const caja = h('div', { class: 'card' });
      caja.appendChild(h('h3', null, 'Registro de ventas · ' + ventas.length + (ventas.length === 1 ? ' ticket' : ' tickets')));
      if (!ventas.length) caja.appendChild(UI.vacio('Sin ventas en este periodo.'));
      else {
        caja.appendChild(h('div', { class: 'lista' }, ventas.slice(0, est.max).map(t => h('div', { class: 'item' },
          h('div', { class: 'grow' }, h('div', { class: 't1' }, UI.fecha(t.fecha) + ' · ' + UI.hora(t.hora) + ' · ' + t.pago), h('div', { class: 't2' }, t.items.join(', ')),
            h('div', { class: 't2' }, 'utilidad ' + money(t.util) + ' · comisión ' + money(t.comision) + (t.descuento ? ' · descuento ' + money(t.descuento) : ''))),
          h('div', { class: 'monto' }, money(t.total))))));
        if (ventas.length > est.max) caja.appendChild(h('button', { class: 'btn', type: 'button', style: { marginTop: '8px' }, onclick: () => { est.max += 30; App.refresh(); } }, 'Mostrar 30 más (' + (ventas.length - est.max) + ' restantes)'));
        caja.appendChild(h('small', { style: { display: 'block', marginTop: '8px' } }, 'Si una venta se registró por error, cancélala en Cancelaciones: se devuelven las piezas y se quita la comisión.'));
      }
      root.appendChild(caja);
    }
  };
})();
