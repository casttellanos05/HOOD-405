/* Pestaña CONFIGURACIÓN (dueño): vendedores y PINs, comisiones, códigos de descuento, metas, plazos y contraseña */
(function () {
  const { h, money } = UI;
  const Views = (window.Views = window.Views || {});
  let borrador = null, original = '';
  const clon = x => JSON.parse(JSON.stringify(x));
  const porc = v => Math.round(HOOD.num(v) * 10000) / 100;            // 0.1 -> 10
  const dePorc = v => Math.max(0, Math.min(1, Math.round(UI.leerNum(v) * 100) / 10000)); // 10 -> 0.1
  const CLAVES = ['vendedores', 'codigos', 'metas', 'periodoMetas', 'plazoCredito', 'plazoApartado', 'minApartado', 'avisoDias', 'comTarjeta', 'fondo', 'catGastos'];
  const sucio = () => JSON.stringify(CLAVES.map(k => borrador[k])) !== original;

  function cargar(db) {
    const base = {}; CLAVES.forEach(k => { base[k] = clon(db.config[k]); });
    if (!base.catGastos || !base.catGastos.length) base.catGastos = HOOD.CAT_GASTOS_BASE.slice();
    original = JSON.stringify(CLAVES.map(k => base[k]));
    borrador = Object.assign(clon(db.config), base);
  }

  function seccion(titulo, ayuda, ...cuerpo) { return h('div', { class: 'card' }, h('h3', null, titulo), ayuda ? h('p', { class: 'muted', style: { marginTop: '-4px' } }, ayuda) : null, cuerpo); }
  const num = (obj, k, o) => UI.dinero(Object.assign({ value: obj[k], oninput: ev => { obj[k] = UI.leerNum(ev.target.value); marcar(); } }, o || {}));
  const pctIn = (obj, k) => UI.dinero({ value: porc(obj[k]), step: '0.1', max: '100', oninput: ev => { obj[k] = dePorc(ev.target.value); marcar(); } });
  const txt = (obj, k, o) => UI.entrada(Object.assign({ value: obj[k] || '', oninput: ev => { obj[k] = ev.target.value; marcar(); } }, o || {}));
  const fecha = (obj, k) => h('input', { type: 'date', value: obj[k] || '', onchange: ev => { obj[k] = ev.target.value; marcar(); } });
  let barra = null;
  function marcar() { if (barra) barra.classList.toggle('oculto', !sucio()); const b = document.getElementById('cfg-barra'); if (b) b.style.display = sucio() ? '' : 'none'; }

  Views.config = {
    titulo: 'Configuración', icono: 'config',
    render(root) {
      const db = Store.view();
      if (!borrador || !sucio()) cargar(db);
      const B = borrador, nuevosV = HOOD.num(B.vendedores.length) - db.config.vendedores.length;

      root.appendChild(h('div', { class: 'titulo-vista' }, h('h2', null, 'Configuración'), h('button', { class: 'btn', type: 'button', onclick: () => App.cuenta() }, UI.icono('sync'), 'Conexión y dispositivo')));

      /* ----- vendedores ----- */
      const tv = h('div');
      function pintarV() {
        UI.vaciar(tv);
        const existentes = db.config.vendedores.map(v => v.nombre);
        B.vendedores.forEach((v, i) => {
          const esViejo = existentes.indexOf(v.nombre) >= 0 && i < existentes.length;
          tv.appendChild(h('div', { class: 'card', style: { background: '#fff', boxShadow: 'none', border: '1px solid var(--line)' } },
            h('div', { class: 'cab' }, h('div', { class: 'fuerte' }, v.nombre || 'Vendedor nuevo'), !esViejo ? h('button', { class: 'btn chico ghost', type: 'button', onclick: () => { B.vendedores.splice(i, 1); pintarV(); marcar(); } }, 'Quitar') : UI.badge(v.baja && v.baja <= Store.hoy() ? 'De baja' : v.baja ? 'Baja ' + UI.fechaCorta(v.baja) : 'Activo', v.baja ? 'mal' : 'ok')),
            h('div', { class: 'grid2' }, UI.campo('Nombre', txt(v, 'nombre', { disabled: esViejo, oninput: ev => { v.nombre = ev.target.value; marcar(); } })), UI.campo('PIN de acceso', txt(v, 'pin', { type: 'text', placeholder: 'mínimo 4' }))),
            h('div', { class: 'grid3' }, UI.campo('Comisión (%)', pctIn(v, 'pct')),
              UI.campo('Se calcula sobre', h('select', { onchange: ev => { v.base = ev.target.value; marcar(); } }, UI.opciones([['Utilidad', 'La utilidad'], ['Total', 'El valor total vendido']], v.base))),
              UI.campo('Pago semanal (sueldo fijo)', num(v, 'sueldo'))),
            h('div', { class: 'grid2' }, UI.campo('Fecha de alta', fecha(v, 'alta'), 'El sueldo corre desde esta semana.'), UI.campo('Fecha de baja', fecha(v, 'baja'), 'Con baja ya no puede entrar. No se borra: conserva su historial.')),
            esViejo ? (v.baja ? h('button', { class: 'btn chico', type: 'button', onclick: () => { v.baja = ''; pintarV(); marcar(); } }, 'Reactivar a ' + v.nombre)
              : h('button', { class: 'btn chico ghost', type: 'button', onclick: async () => {
                if (!await UI.confirmar('Quitar a ' + v.nombre, 'Ya no podrá entrar a la app ni se le cargará sueldo. Su historial de ventas, comisiones y pagos se conserva. Lo que se le deba sigue pendiente en Corte semanal. Después de confirmar, pulsa "Guardar cambios".', 'Quitar empleado', true)) return;
                v.baja = Store.hoy(); pintarV(); marcar();
              } }, 'Quitar empleado (conserva su historial)')) : null));
        });
        if (B.vendedores.length < 10) tv.appendChild(h('button', { class: 'btn', type: 'button', onclick: () => { B.vendedores.push({ nombre: '', pin: '', pct: 0.05, base: 'Utilidad', sueldo: 0, alta: Store.hoy(), baja: '' }); pintarV(); marcar(); } }, UI.icono('mas'), 'Agregar vendedor'));
      }
      pintarV();
      root.appendChild(seccion('Empleados: pago semanal y comisiones', 'Cada empleado entra con su PIN. Aquí se registra su pago semanal; las comisiones se suman solas en Corte semanal. La comisión se guarda en cada venta con el porcentaje vigente en ese momento.', tv));

      /* ----- códigos ----- */
      const tc = h('div');
      function pintarC() {
        UI.vaciar(tc);
        if (!B.codigos.length) tc.appendChild(UI.vacio('Todavía no hay códigos de descuento.'));
        B.codigos.forEach((k, i) => tc.appendChild(h('div', { class: 'card', style: { background: '#fff', boxShadow: 'none', border: '1px solid var(--line)' } },
          h('div', { class: 'cab' }, h('label', { class: 'check', style: { margin: 0 } }, h('input', { type: 'checkbox', checked: k.activo !== false, onchange: ev => { k.activo = ev.target.checked; marcar(); } }), 'Activo'), h('button', { class: 'btn chico ghost', type: 'button', onclick: () => { B.codigos.splice(i, 1); pintarC(); marcar(); } }, 'Quitar')),
          h('div', { class: 'grid3' }, UI.campo('Código', txt(k, 'codigo', { autocapitalize: 'characters', placeholder: 'BUENFIN', oninput: ev => { k.codigo = ev.target.value.toUpperCase().replace(/\s+/g, ''); ev.target.value = k.codigo; marcar(); } })),
            UI.campo('Descuento (%)', pctIn(k, 'pct')), UI.campo('Vence (opcional)', fecha(k, 'vence'))),
          h('div', { class: 'grid2' }, UI.campo('Nota / para quién es', txt(k, 'nota', { placeholder: 'Ej. clientes frecuentes' })),
            UI.campo('Compras a crédito', h('label', { class: 'check', style: { margin: 0 } }, h('input', { type: 'checkbox', checked: k.credito === true, onchange: ev => { k.credito = ev.target.checked; marcar(); } }), 'Válido también a crédito'),
              k.credito === true ? 'Sí se puede usar al vender a crédito.' : 'Normalmente no: solo en compras de contado, apartados y tarjeta.')))));
        tc.appendChild(h('button', { class: 'btn', type: 'button', onclick: () => { B.codigos.push({ codigo: '', pct: 0.1, activo: true, vence: '', nota: '', credito: false }); pintarC(); marcar(); } }, UI.icono('mas'), 'Agregar código'));
      }
      pintarC();
      root.appendChild(seccion('Códigos de descuento', 'El vendedor escribe el código al cobrar; no puede ver la lista de códigos. Por regla general un código NO vale en compras a crédito: márcalo solo si quieres permitirlo.', tc));

      /* ----- categorías de gasto ----- */
      const tg = h('div');
      function pintarG() {
        UI.vaciar(tg);
        const usadas = {}; db.gastos.forEach(g => { if (HOOD.num(g[HOOD.CG.MONTO]) > 0) usadas[String(g[HOOD.CG.CAT] || '').toLowerCase()] = 1; });
        tg.appendChild(h('div', { class: 'chips-cat' }, B.catGastos.map((c, i) => h('span', { class: 'chip-cat' }, c,
          HOOD.esSueldos(c) ? h('small', null, ' (fija)') : usadas[c.toLowerCase()] ? h('small', null, ' (en uso)') : h('button', { type: 'button', 'aria-label': 'Quitar ' + c, onclick: () => { B.catGastos.splice(i, 1); pintarG(); marcar(); } }, '×')))));
        const nueva = UI.entrada({ placeholder: 'Ej. Publicidad en redes', maxlength: 40 });
        const agregar = () => { const n = nueva.value.replace(/[,;|]/g, ' ').replace(/\s+/g, ' ').trim(); if (!n) return; if (B.catGastos.some(c => c.toLowerCase() === n.toLowerCase())) { UI.toast('Esa categoría ya existe', 'mal'); return; } B.catGastos.push(n); pintarG(); marcar(); };
        nueva.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } });
        tg.appendChild(h('div', { class: 'fila', style: { marginTop: '10px' } }, h('div', { style: { flex: 1 } }, nueva), h('button', { class: 'btn', type: 'button', onclick: agregar }, UI.icono('mas'), 'Agregar categoría')));
      }
      pintarG();
      root.appendChild(seccion('Categorías de gasto', 'Son las opciones que aparecen al registrar un gasto. "Sueldos" se llena sola con los pagos del Corte semanal.', tg));

      /* ----- plazos y cobros ----- */
      root.appendChild(h('div', { class: 'cols dos' },
        seccion('Créditos y apartados', null,
          h('div', { class: 'grid2' }, UI.campo('Plazo de crédito (días)', num(B, 'plazoCredito', { step: '1' })), UI.campo('Plazo de apartado (días)', num(B, 'plazoApartado', { step: '1' }))),
          h('div', { class: 'grid2' }, UI.campo('Primer abono mínimo del apartado (%)', pctIn(B, 'minApartado')), UI.campo('Avisar cuántos días antes de vencer', num(B, 'avisoDias', { step: '1' }), 'Aparece como leyenda en la pantalla de Venta.'))),
        seccion('Cobros y caja', null,
          h('div', { class: 'grid2' }, UI.campo('Comisión de tarjeta (%)', pctIn(B, 'comTarjeta'), 'La paga el cliente.'), UI.campo('Fondo de caja inicial', num(B, 'fondo'), 'Efectivo con el que abres cada día.')),
          h('small', null, 'Formas de cobro: ' + db.config.formas.join(', ') + '.'))));

      /* ----- metas ----- */
      const tm = h('div');
      function pintarM() {
        UI.vaciar(tm);
        tm.appendChild(UI.campo('Las metas se miden por', h('select', { onchange: ev => { B.periodoMetas = ev.target.value; marcar(); } }, UI.opciones([['Semana', 'Semana'], ['Mes', 'Mes']], B.periodoMetas))));
        B.metas.forEach((m, i) => tm.appendChild(h('div', { class: 'grid2' }, UI.campo('Meta ' + (i + 1) + ' · ventas a lograr', num(m, 'monto')), h('div', { class: 'fila', style: { alignItems: 'flex-end' } }, h('div', { style: { flex: 1 } }, UI.campo('Premio', txt(m, 'premio', { placeholder: 'Ej. Bono $500' }))),
          h('button', { class: 'btn chico ghost', type: 'button', style: { marginBottom: '10px' }, onclick: () => { B.metas.splice(i, 1); pintarM(); marcar(); } }, 'Quitar')))));
        if (B.metas.length < 5) tm.appendChild(h('button', { class: 'btn', type: 'button', onclick: () => { B.metas.push({ monto: 0, premio: '' }); pintarM(); marcar(); } }, UI.icono('mas'), 'Agregar meta'));
      }
      pintarM();
      root.appendChild(seccion('Metas de los vendedores', 'Cada vendedor ve su avance en la pantalla de Venta.', tm));

      /* ----- contraseña ----- */
      const p1 = UI.entrada({ type: 'password', placeholder: 'Nueva contraseña (mínimo 6)', autocomplete: 'new-password' }), p2 = UI.entrada({ type: 'password', placeholder: 'Repite la contraseña', autocomplete: 'new-password' });
      const msgp = h('div', { class: 'aviso mal', style: { display: 'none' } });
      root.appendChild(seccion('Contraseña del dueño', 'Con ella ves todo lo que el vendedor no ve. Cambiarla necesita internet.', h('div', { class: 'grid2' }, UI.campo('Nueva contraseña', p1), UI.campo('Repetir', p2)), msgp,
        h('button', { class: 'btn', type: 'button', onclick: async ev => {
          msgp.style.display = 'none';
          if (p1.value !== p2.value) { msgp.textContent = 'Las contraseñas no coinciden'; msgp.style.display = ''; return; }
          const btn = ev.currentTarget; btn.disabled = true;
          const r = await Store.hacerEnLinea('config', { duenoPass: p1.value });
          btn.disabled = false;
          if (!r.ok) { msgp.textContent = r.msg; msgp.style.display = ''; return; }
          await Store.claveCambiada(p1.value); p1.value = p2.value = ''; UI.toast('Contraseña cambiada', 'ok');
        } }, 'Cambiar contraseña')));

      /* ----- barra de guardado ----- */
      const err = h('div', { class: 'aviso mal', style: { display: 'none', margin: '0 0 8px' } });
      barra = h('div', { id: 'cfg-barra', style: { position: 'sticky', bottom: 'calc(var(--nav-h) + 8px)', display: sucio() ? '' : 'none', zIndex: 15 } },
        h('div', { class: 'card', style: { boxShadow: '0 4px 18px rgba(0,0,0,.25)', marginBottom: 0 } }, err,
          h('div', { class: 'fila sp' }, h('span', { class: 'fuerte' }, 'Tienes cambios sin guardar'),
            h('div', { class: 'fila' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { borrador = null; App.refresh(); } }, 'Descartar'),
              h('button', { class: 'btn primary', type: 'button', onclick: async ev => {
                const btn = ev.currentTarget; btn.disabled = true; err.style.display = 'none';
                const args = {}; CLAVES.forEach(k => { args[k] = clon(B[k]); });
                const r = await Store.hacer('config', args);
                btn.disabled = false;
                if (!r.ok) { err.textContent = r.msg; err.style.display = ''; return; }
                borrador = null; UI.toast('Configuración guardada', 'ok'); App.refresh();
              } }, 'Guardar cambios')))));
      root.appendChild(barra);
    }
  };
})();
