/* HOOD 405 · informe imprimible del Resumen (semana, mes o año). Se ve en pantalla como una hoja y se manda a "Imprimir / Guardar como PDF". */
const Informe = (() => {
  const { h, money } = UI;
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const TITULO = { semana: 'Resumen semanal', mes: 'Resumen mensual', anio: 'Resumen anual' };
  let abierto = null;

  const kpi = (et, val, nota, tono) => h('div', { class: 'inf-kpi ' + (tono || '') }, h('div', { class: 'et' }, et), h('div', { class: 'val' }, val), nota ? h('div', { class: 'nota' }, nota) : null);
  const fila = (et, val, cls) => h('tr', { class: cls || '' }, h('td', null, et), h('td', { class: 'num' }, val));
  const tabla = (...filas) => h('table', { class: 'inf-tabla' }, h('tbody', null, filas));

  /** Abre la vista previa del informe. modo: 'semana' | 'mes' | 'anio'; r: { ini, fin, etiqueta } */
  function resumen(modo, r) {
    cerrar();
    const db = Store.view(), hoy = Store.hoy();
    const p = HOOD.periodo(db, r.ini, r.fin, hoy);
    const cred = HOOD.listaCreditos(db, hoy), ap = HOOD.listaApartados(db, hoy);
    const porCobrar = HOOD.r2(cred.reduce((a, c) => a + c.saldo, 0)), apSaldo = HOOD.r2(ap.filter(a => a.estado === 'Apartado').reduce((a, x) => a + x.saldo, 0));
    const paso = modo === 'anio' ? 'mes' : 'dia';
    const serie = HOOD.serie(db, r.ini, r.fin, paso, hoy).filter(s => s.ini <= hoy);
    const et = s => (paso === 'mes' ? MES[Number(s.ini.slice(5, 7)) - 1] : modo === 'semana' ? UI.diaSemana(s.ini) + ' ' + s.ini.slice(8) : s.ini.slice(8));
    const cats = Object.keys(p.porCategoria).map(k => ({ c: k, m: p.porCategoria[k] })).sort((x, y) => y.m - x.m);
    const maxCat = Math.max(1, ...cats.map(x => x.m));
    const vend = p.vendedores.slice().sort((a, b) => b.vendido - a.vendido);
    const ahora = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });

    const hoja = h('div', { class: 'hoja' },
      h('div', { class: 'inf-cab' }, h('img', { src: 'icons/icon-192.png', alt: '' }),
        h('div', null, h('div', { class: 'marca' }, 'HOOD 405'), h('div', { class: 'tit' }, TITULO[modo]), h('div', { class: 'per' }, r.etiqueta))),
      h('div', { class: 'inf-kpis' },
        kpi('Vendido', money(p.vendido), p.tickets + ' tickets · ' + UI.num(p.articulos) + ' artículos'),
        kpi('Cobrado', money(p.cobrado), 'contado + abonos', 'ok'),
        kpi('Utilidad neta', money(p.utilNeta), 'después de gastos y nómina', p.utilNeta >= 0 ? 'ok' : 'mal'),
        kpi('Comprado (reinversión)', money(p.reinversion), 'mercancía para el inventario'),
        kpi('Ticket promedio', money(p.ticketPromedio), 'por venta'),
        kpi('Descuentos dados', money(p.descuentos), 'en el periodo')),
      h('div', { class: 'inf-sec no-corte' }, h('h2', null, modo === 'anio' ? 'Ventas por mes' : 'Ventas por día'),
        UI.lineas(serie.map(s => ({ et: et(s), v: [s.vendido, s.cobrado] })), [{ nombre: 'Vendido', color: '#4c6a84', area: true }, { nombre: 'Cobrado', color: '#2f7d5b' }], 210)),
      h('div', { class: 'inf-dos no-corte' },
        h('div', { class: 'inf-sec' }, h('h2', null, 'Estado de resultados'),
          tabla(fila('Ventas de contado', money(p.contado)), fila('Abonos recibidos', money(p.abonos)), fila('Apartados liquidados', money(p.apartLiq)), fila('Vendido a crédito (por cobrar)', money(p.credito)),
            fila('Utilidad cobrada', money(p.util), 'fuerte'), fila('− Gastos operativos', money(p.gastosOp)), fila('− Comisiones de vendedores', money(p.comisiones)), fila('− Sueldos fijos', money(p.sueldos)),
            fila('UTILIDAD NETA', money(p.utilNeta), 'total ' + (p.utilNeta >= 0 ? 'ok' : 'mal')))),
        h('div', { class: 'inf-sec' }, h('h2', null, 'Cómo te pagaron'),
          tabla.apply(null, Object.keys(p.porPago).map(k => fila(k, money(p.porPago[k]))).concat(Object.keys(p.abonosPorForma).map(k => fila('Abonos · ' + k, money(p.abonosPorForma[k]))))
            .concat([fila('Comisión de tarjeta (del banco)', money(p.tarjeta), 'suave')])),
          h('h2', { style: { marginTop: '12px' } }, 'Por cobrar hoy'),
          tabla(fila('Créditos de clientes', money(porCobrar)), fila('Saldo de apartados abiertos', money(apSaldo))))),
      h('div', { class: 'inf-dos no-corte' },
        h('div', { class: 'inf-sec' }, h('h2', null, 'Gastos por categoría'),
          !cats.length ? h('div', { class: 'suave' }, 'Sin gastos en el periodo.') : h('div', null, cats.map(x => h('div', { class: 'inf-barra' },
            h('div', { class: 'fila-b' }, h('span', null, x.c), h('span', { class: 'num' }, money(x.m))), h('div', { class: 'tira' }, h('div', { style: { width: (x.m / maxCat * 100) + '%' } })))))),
        h('div', { class: 'inf-sec' }, h('h2', null, 'Por vendedor'),
          !vend.length ? h('div', { class: 'suave' }, 'Sin ventas en el periodo.') : h('table', { class: 'inf-tabla' },
            h('thead', null, h('tr', null, h('th', null, ''), h('th', { class: 'num' }, 'Vendido'), h('th', { class: 'num' }, 'Comisión'))),
            h('tbody', null, vend.map((v, i) => h('tr', null, h('td', null, (i === 0 && v.vendido > 0 ? '🏆 ' : '') + v.vendedor), h('td', { class: 'num' }, money(v.vendido)), h('td', { class: 'num' }, money(v.comision)))))))),
      h('div', { class: 'inf-pie' }, 'HOOD 405 · Generado el ' + ahora + ' · Las cifras salen de lo registrado en la app.'));

    const barra = h('div', { class: 'inf-barra-top' },
      h('div', { class: 'fuerte' }, TITULO[modo] + ' · ' + r.etiqueta),
      h('div', { class: 'fila' }, h('button', { class: 'btn primary', type: 'button', onclick: imprimir }, 'Imprimir / Guardar PDF'), h('button', { class: 'btn', type: 'button', onclick: cerrar }, 'Cerrar')));
    abierto = h('div', { id: 'informe' }, barra, h('div', { class: 'inf-ayuda' }, 'En la ventana de impresión elige "Guardar como PDF" como destino. En iPhone o iPad: Compartir > Imprimir > pellizca la vista previa para obtener el PDF.'), hoja);
    document.body.appendChild(abierto);
    document.body.classList.add('con-informe');
  }

  function imprimir() {
    document.body.classList.add('imprimiendo');
    const fin = () => { document.body.classList.remove('imprimiendo'); window.removeEventListener('afterprint', fin); };
    window.addEventListener('afterprint', fin);
    setTimeout(() => { try { window.print(); } catch (e) { fin(); } if (!('onafterprint' in window)) setTimeout(fin, 1500); }, 80);
  }

  function cerrar() {
    if (abierto) { abierto.remove(); abierto = null; }
    document.body.classList.remove('con-informe', 'imprimiendo');
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && abierto && !UI.hayModal()) cerrar(); });

  return { resumen, cerrar, imprimir };
})();
