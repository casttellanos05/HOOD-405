/* Pestaña GASTOS (dueño): registrar gastos y ver los del mes por categoría */
(function () {
  const { h, money } = UI;
  const Views = (window.Views = window.Views || {});
  const est = { mes: '' };
  const catsConfig = db => (db.config.catGastos && db.config.catGastos.length ? db.config.catGastos : HOOD.CAT_GASTOS_BASE).filter(c => !HOOD.esSueldos(c));

  function nuevo(db) {
    const hoy = Store.hoy();
    const cats = catsConfig(db);
    const f = { concepto: UI.entrada({ placeholder: 'Ej. Recibo de luz' }), monto: UI.dinero({ placeholder: '0.00' }), fecha: h('input', { type: 'date', value: hoy, max: hoy }),
      cat: h('select', null, UI.opciones(cats, cats.indexOf('Otros') >= 0 ? 'Otros' : cats[0])), efectivo: h('input', { type: 'checkbox', checked: true }), notas: UI.entrada({ placeholder: 'Notas (opcional)' }) };
    const msg = h('div', { class: 'aviso mal', style: { display: 'none' } });
    UI.modal({ titulo: 'Nuevo gasto', cuerpo: h('div', null, UI.campo('Concepto', f.concepto), h('div', { class: 'grid2' }, UI.campo('Monto', f.monto), UI.campo('Fecha', f.fecha)),
      UI.campo('Categoría', f.cat), UI.campo('Notas', f.notas), h('label', { class: 'check' }, f.efectivo, 'Pagado en efectivo (resta de la caja del corte)'), msg,
      h('small', null, 'Los sueldos no se registran aquí: se pagan en Corte > Semanal y aparecen en la categoría Sueldos. Las categorías nuevas se agregan en Config.')),
      acciones: [{ texto: 'Cancelar', tipo: 'ghost' }, { texto: 'Guardar gasto', tipo: 'primary', cerrar: false, onclick: async (cerrar, btn) => {
        btn.disabled = true;
        const r = await Store.hacer('gasto', { concepto: f.concepto.value, monto: UI.leerNum(f.monto.value), fecha: f.fecha.value, cat: f.cat.value, efectivo: f.efectivo.checked, notas: f.notas.value });
        btn.disabled = false;
        if (!r.ok) { msg.textContent = r.msg; msg.style.display = ''; return; }
        cerrar(); UI.toast('Gasto registrado', 'ok'); App.refresh();
      } }] });
  }

  Views.gastos = {
    titulo: 'Gastos', icono: 'gastos',
    render(root) {
      const db = Store.view(), hoy = Store.hoy();
      if (!est.mes) est.mes = HOOD.iniMes(hoy);
      const ini = est.mes, fin = HOOD.finMes(ini);
      const lista = db.gastos.filter(g => g[HOOD.CG.FECHA] !== '' && g[HOOD.CG.FECHA] >= ini && g[HOOD.CG.FECHA] <= fin).slice().sort((a, b) => String(b[HOOD.CG.FECHA]).localeCompare(String(a[HOOD.CG.FECHA])));
      const vigentes = lista.filter(g => HOOD.num(g[HOOD.CG.MONTO]) > 0);
      const op = vigentes.filter(g => !HOOD.esSueldos(g[HOOD.CG.CAT])), nom = vigentes.filter(g => HOOD.esSueldos(g[HOOD.CG.CAT]));
      const sum = a => HOOD.r2(a.reduce((x, g) => x + HOOD.num(g[HOOD.CG.MONTO]), 0));
      const porCat = {};
      vigentes.forEach(g => { const c = HOOD.esSueldos(g[HOOD.CG.CAT]) ? 'Sueldos' : (g[HOOD.CG.CAT] || 'Otros'); porCat[c] = HOOD.r2((porCat[c] || 0) + HOOD.num(g[HOOD.CG.MONTO])); });
      const cats = Object.keys(porCat).map(c => ({ c, m: porCat[c] })).sort((a, b) => b.m - a.m);

      root.appendChild(h('div', { class: 'titulo-vista' },
        h('div', { class: 'fecha-nav' }, h('button', { class: 'btn chico', type: 'button', onclick: () => { est.mes = HOOD.iniMes(HOOD.sumaDias(ini, -1)); App.refresh(); } }, '‹'),
          h('span', { class: 't' }, UI.mesLargo(ini)), h('button', { class: 'btn chico', type: 'button', disabled: fin >= hoy, onclick: () => { est.mes = HOOD.sumaDias(fin, 1); App.refresh(); } }, '›')),
        h('button', { class: 'btn primary', type: 'button', onclick: () => nuevo(db) }, UI.icono('mas'), 'Nuevo gasto')));
      root.appendChild(h('div', { class: 'kpis tres' }, UI.kpi('Otros gastos del mes', money(sum(op)), op.length + ' registros'), UI.kpi('Sueldos pagados', money(sum(nom)), 'pagos al equipo'), UI.kpi('Total salido', money(sum(op) + sum(nom)))));
      root.appendChild(h('div', { class: 'cols dos' },
        h('div', { class: 'card' }, h('h3', null, 'Por categoría (' + UI.mesLargo(ini) + ')'), !cats.length ? UI.vacio('Sin gastos este mes.') : h('div', { class: 'lista' }, cats.map(x => h('div', { class: 'item' },
          h('div', { class: 'grow' }, h('div', { class: 't1' }, x.c), UI.progreso(x.m / cats[0].m)), h('div', { class: 'monto' }, money(x.m)))))),
        h('div', { class: 'card' }, h('h3', null, 'Registros'), !lista.length ? UI.vacio('Sin gastos este mes.') : h('div', { class: 'lista' }, lista.map(g => {
          const anulado = HOOD.num(g[HOOD.CG.MONTO]) <= 0, esNom = HOOD.esSueldos(g[HOOD.CG.CAT]);
          return h('div', { class: 'item', style: anulado ? { opacity: .5 } : null }, h('div', { class: 'grow' }, h('div', { class: 't1' }, g[HOOD.CG.CONCEPTO]),
            h('div', { class: 't2' }, UI.fecha(g[HOOD.CG.FECHA]) + ' · ' + (esNom ? 'Sueldos' : (g[HOOD.CG.CAT] || 'Otros')) + (g[HOOD.CG.EFECTIVO] === 'SI' ? ' · efectivo' : '') + (g[HOOD.CG.NOTAS] ? ' · ' + g[HOOD.CG.NOTAS] : ''))),
            h('div', { class: 'monto' }, anulado ? UI.badge('anulado') : money(g[HOOD.CG.MONTO])),
            !anulado && !esNom ? h('button', { class: 'btn chico ghost', type: 'button', onclick: async () => {
              if (!await UI.confirmar('Anular gasto', 'Se anula "' + g[HOOD.CG.CONCEPTO] + '" por ' + money(g[HOOD.CG.MONTO]) + '.', 'Anular', true)) return;
              const r = await Store.hacer('gasto_anular', { id: g[HOOD.CG.ID] }); if (!r.ok) { UI.toast(r.msg, 'mal'); return; } UI.toast('Gasto anulado'); App.refresh();
            } }, 'Anular') : null);
        })))));
    }
  };
})();
