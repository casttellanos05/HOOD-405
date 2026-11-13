/* Pestaña MIS COMISIONES (vendedor): lo que lleva ganado esta semana, por ticket y por mes. Nunca muestra costos ni utilidad. */
(function () {
  const { h, money } = UI;
  const Views = (window.Views = window.Views || {});
  Views.comisiones = {
    titulo: 'Mis comisiones', icono: 'comisiones',
    render(root) {
      const db = Store.view(), S = Store.S, hoy = Store.hoy();
      const c = HOOD.misComisiones(db, S.user.usuario, hoy), v = (db.config.vendedores || []).find(x => x.nombre === S.user.usuario);
      const pend = c.tickets.some(t => t.pendiente);
      root.appendChild(h('div', { class: 'titulo-vista' }, h('h2', null, 'Mis comisiones')));
      root.appendChild(h('div', { class: 'kpis tres' }, UI.kpi('Esta semana', money(c.semana), v ? 'Comisión del ' + UI.pct(v.pct) + (v.base === 'Total' ? ' del valor vendido' : ' de la utilidad') : '', 'ok'),
        UI.kpi('Vendido en la semana', money(c.tickets.reduce((a, t) => a + t.total, 0)), c.tickets.length + ' tickets'), UI.kpi('Este mes', money(c.meses[c.mesActual].c), 'vendido ' + money(c.meses[c.mesActual].v))));
      if (pend) root.appendChild(h('div', { class: 'aviso ambar' }, 'Algunas ventas dicen "por confirmar": el servidor calcula tu comisión final cuando el dispositivo se sincroniza con internet.'));
      const m = c.meta;
      if (m.metas.length) {
        root.appendChild(h('div', { class: 'card' }, h('h3', null, 'Tus metas de la ' + m.periodo), h('div', { class: 'fila sp' }, h('span', null, 'Vendido'), h('span', { class: 'num fuerte' }, money(m.vendido))),
          m.metas.map(x => h('div', { style: { margin: '8px 0' } }, h('div', { class: 'fila sp' }, h('span', null, money(x.monto) + (x.premio ? ' · ' + x.premio : '')), h('span', { class: m.vendido >= x.monto ? 'ok fuerte' : 'muted' }, m.vendido >= x.monto ? '✓ Lograda' : 'faltan ' + money(x.monto - m.vendido))),
            UI.progreso(m.vendido / x.monto, m.vendido >= x.monto ? 'ok' : '')))));
      }
      root.appendChild(h('div', { class: 'cols dos' },
        h('div', { class: 'card' }, h('h3', null, 'Tickets de esta semana'), !c.tickets.length ? UI.vacio('Todavía no hay ventas esta semana.') : h('div', { class: 'lista' }, c.tickets.map(t => h('div', { class: 'item' },
          h('div', { class: 'grow' }, h('div', { class: 't1' }, UI.fecha(t.fecha) + (t.credito ? ' · crédito' : t.apartado ? ' · apartado' : '')), h('div', { class: 't2' }, 'Venta ' + money(t.total))),
          h('div', { class: 'monto' }, t.pendiente ? UI.badge('por confirmar', 'ambar') : money(t.comision)))))),
        h('div', { class: 'card' }, h('h3', null, 'Por mes (' + hoy.slice(0, 4) + ')'), UI.barras(c.meses.map((m, i) => ({ et: UI.fechaCorta(hoy.slice(0, 4) + '-' + String(i + 1).padStart(2, '0') + '-01').split(' ')[1], v: [m.c] })), ['#2f7d5b'], ['Comisión'], 200))));
    }
  };
})();
