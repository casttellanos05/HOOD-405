/* Pestaña CATÁLOGO (dueño): sube la foto de cada prenda al repositorio del catálogo (GitHub) y guarda su nombre en el inventario.
 * Una prenda = mismo nombre + mismo color (las tallas comparten foto). Aparece en el catálogo público solo si tiene foto, está activa y tiene existencia.
 * La llave de GitHub se guarda ÚNICAMENTE en este aparato (nunca en el Sheet ni en el código). */
(function () {
  const { h, money } = UI;
  const Views = (window.Views = window.Views || {});
  const CPR = HOOD.CPR;
  const LLAVE = 'hood405.catalogo.gh';
  const est = { max: 60, maxCon: 30 };

  const leer = () => { try { return JSON.parse(localStorage.getItem(LLAVE)) || {}; } catch (e) { return {}; } };
  const guardarCfg = c => { try { localStorage.setItem(LLAVE, JSON.stringify(c)); } catch (e) { /* sin almacenamiento */ } };
  const listo = c => !!(c.repo && c.token);
  const baseUrl = c => (c.url || '').replace(/\/+$/, '');

  /* ---------- agrupar productos en prendas ---------- */
  function prendas(db) {
    const g = {};
    db.productos.forEach(r => {
      if (r[0] === '' || r[0] == null || !HOOD.activoProd(r)) return;
      const clave = UI.norm(String(r[CPR.NOMBRE])).trim() + '|' + UI.norm(String(r[CPR.COLOR])).trim();
      const x = g[clave] || (g[clave] = { clave, nombre: String(r[CPR.NOMBRE]), color: String(r[CPR.COLOR]), cat: String(r[CPR.CAT]), items: [] });
      const fs = String(r[CPR.FOTO] || '').split(',').map(z => z.trim()).filter(Boolean);
      x.items.push({ codigo: String(r[0]), talla: String(r[CPR.TALLA]), foto: fs[0] || '', foto2: fs[1] || '', disp: HOOD.num(r[CPR.DISP]), precio: HOOD.num(r[CPR.PRECIO]) });
    });
    return Object.keys(g).map(k => {
      const x = g[k];
      x.items.sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
      const con = x.items.filter(i => i.foto), sin = x.items.filter(i => !i.foto);
      x.foto = con.length ? con[0].foto : '';
      x.foto2 = con.length ? (con.find(i => i.foto === x.foto && i.foto2) || {}).foto2 || '' : '';
      x.sinFoto = sin;
      x.estado = !con.length ? 'sin' : (sin.length ? 'parcial' : 'con');
      x.piezas = x.items.reduce((s, i) => s + Math.max(0, i.disp), 0);
      return x;
    }).sort((a, b) => a.cat.localeCompare(b.cat, 'es') || a.nombre.localeCompare(b.nombre, 'es') || a.color.localeCompare(b.color, 'es'));
  }
  const tallas = x => x.items.map(i => i.talla || 'Única').join(' · ');
  const titulo = x => x.nombre + (x.color ? ' · ' + x.color : '');

  /* ---------- imagen: reducir en el aparato antes de subir ---------- */
  function cargarImagen(archivo) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(archivo), im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); res(im); };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No pude abrir esa imagen. Prueba con una foto JPG o PNG.')); };
      im.src = url;
    });
  }
  function aBlob(canvas, calidad) { return new Promise(res => canvas.toBlob(res, 'image/jpeg', calidad)); }
  /** Devuelve { blob, base64, ancho, alto } con lado mayor de 900 px y unos 100–250 KB. */
  async function reducir(archivo) {
    const im = await cargarImagen(archivo);
    const m = 900, k = Math.min(1, m / Math.max(im.naturalWidth, im.naturalHeight));
    const w = Math.max(1, Math.round(im.naturalWidth * k)), hh = Math.max(1, Math.round(im.naturalHeight * k));
    const c = document.createElement('canvas'); c.width = w; c.height = hh;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hh); ctx.drawImage(im, 0, 0, w, hh);
    let blob = null;
    for (const q of [0.84, 0.74, 0.64, 0.54]) { blob = await aBlob(c, q); if (blob && blob.size <= 260 * 1024) break; }
    if (!blob) throw new Error('No pude preparar la foto.');
    const base64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = () => rej(new Error('No pude leer la foto.')); fr.readAsDataURL(blob); });
    return { blob, base64, ancho: w, alto: hh };
  }

  /* ---------- GitHub ---------- */
  async function gh(cfg, metodo, ruta, cuerpo) {
    let r;
    try {
      r = await fetch('https://api.github.com/repos/' + cfg.repo + ruta, { method: metodo,
        headers: { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    } catch (e) { throw new Error('Sin conexión con GitHub. Revisa tu internet.'); }
    let datos = null; try { datos = await r.json(); } catch (e) { /* sin cuerpo */ }
    return { status: r.status, ok: r.ok, datos };
  }
  function errorGh(r) {
    if (r.status === 401) return 'GitHub no aceptó la llave (venció o está mal copiada). Cámbiala en “Conexión con GitHub”.';
    if (r.status === 403) return 'La llave no tiene permiso de escribir en ese repositorio (debe tener “Contents: Read and write”).';
    if (r.status === 404) return 'No encuentro ese repositorio o la llave no tiene acceso a él. Revisa el nombre (usuario/repositorio).';
    return 'GitHub respondió con un error (' + r.status + ')' + (r.datos && r.datos.message ? ': ' + r.datos.message : '') + '.';
  }
  const ruta = nombre => '/contents/fotos/' + encodeURIComponent(nombre) + '.jpg';
  async function subirArchivo(cfg, nombre, base64) {
    const rama = cfg.rama || 'main';
    const cuerpo = { message: 'Foto ' + nombre, content: base64, branch: rama };
    let r = await gh(cfg, 'PUT', ruta(nombre), cuerpo);
    if (r.status === 422 || r.status === 409) { // ya existe: hace falta su "sha" para reemplazarla
      const g = await gh(cfg, 'GET', ruta(nombre) + '?ref=' + encodeURIComponent(rama));
      if (g.ok && g.datos && g.datos.sha) r = await gh(cfg, 'PUT', ruta(nombre), Object.assign({ sha: g.datos.sha }, cuerpo));
    }
    if (!r.ok) throw new Error(errorGh(r));
  }
  async function borrarArchivo(cfg, nombre) { // mejor esfuerzo: deja el repositorio ordenado al cambiar una foto
    try {
      const rama = cfg.rama || 'main', g = await gh(cfg, 'GET', ruta(nombre) + '?ref=' + encodeURIComponent(rama));
      if (g.ok && g.datos && g.datos.sha) await gh(cfg, 'DELETE', ruta(nombre), { message: 'Quitar ' + nombre, sha: g.datos.sha, branch: rama });
    } catch (e) { /* no pasa nada: queda un archivo sin usar */ }
  }
  const nombreBase = x => String(x.items[0].codigo).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'prenda';

  /* ---------- ventanas ---------- */
  function conexion(alGuardar) {
    const c = leer();
    const repo = UI.entrada({ value: c.repo || '', placeholder: 'tu-usuario/hood405-catalogo', autocapitalize: 'none', spellcheck: false });
    const token = UI.entrada({ type: 'password', value: c.token || '', placeholder: 'github_pat_…', autocapitalize: 'none', spellcheck: false });
    const url = UI.entrada({ value: c.url || '', placeholder: 'https://tu-usuario.github.io/hood405-catalogo/', autocapitalize: 'none', spellcheck: false });
    const msg = h('div', { class: 'aviso mal', style: { display: 'none' } });
    const cuerpo = h('div', null,
      h('div', { class: 'aviso info' }, 'Estos datos se guardan solo en este aparato. Nadie más los ve (ni el Sheet, ni los vendedores).'),
      UI.campo('Repositorio del catálogo', repo, 'Con el formato usuario/repositorio.'),
      UI.campo('Llave de GitHub', token, 'Una llave “fine-grained” solo para ese repositorio, con permiso Contents: Read and write. Si pierdes este aparato, bórrala en GitHub y listo.'),
      UI.campo('Dirección pública del catálogo (opcional)', url, 'Sirve para ver las miniaturas aquí y abrir el catálogo.'),
      h('details', { class: 'ayuda-llave' }, h('summary', null, '¿Cómo creo la llave?'),
        h('ol', null,
          h('li', null, 'En github.com entra a Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.'),
          h('li', null, 'Ponle un nombre (por ejemplo “Catálogo HOOD”) y la fecha de vencimiento que quieras.'),
          h('li', null, 'En “Repository access” elige Only select repositories y escoge solo el repositorio del catálogo.'),
          h('li', null, 'En “Permissions → Repository permissions” pon Contents: Read and write.'),
          h('li', null, 'Genera la llave, cópiala y pégala arriba.'))),
      msg);
    UI.modal({ titulo: 'Conexión con GitHub', cuerpo, ancho: '560px', acciones: [{ texto: 'Cancelar', tipo: 'ghost' },
      { texto: 'Probar y guardar', tipo: 'primary', cerrar: false, onclick: async (cerrar, btn) => {
        const nuevo = { repo: repo.value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, ''), token: token.value.trim(), url: url.value.trim(), rama: 'main' };
        msg.style.display = 'none';
        if (!/^[\w.-]+\/[\w.-]+$/.test(nuevo.repo)) { msg.textContent = 'Escribe el repositorio como usuario/repositorio.'; msg.style.display = ''; return; }
        if (nuevo.token.length < 20) { msg.textContent = 'Pega la llave completa.'; msg.style.display = ''; return; }
        btn.disabled = true;
        try {
          const r = await gh(nuevo, 'GET', '');
          if (!r.ok) throw new Error(errorGh(r));
          if (r.datos && r.datos.permissions && r.datos.permissions.push === false) throw new Error('La llave solo puede leer ese repositorio. Necesita Contents: Read and write.');
          if (r.datos && r.datos.default_branch) nuevo.rama = r.datos.default_branch;
        } catch (e) { btn.disabled = false; msg.textContent = e.message; msg.style.display = ''; return; }
        btn.disabled = false; guardarCfg(nuevo); cerrar(); UI.toast('Conexión guardada', 'ok'); if (alGuardar) alGuardar(); else App.refresh();
      } }] });
  }

  /** Elegir foto → vista previa → subir. `x` es la prenda; `cambiar` indica que ya tenía foto. */
  function subirFoto(x, cambiar, slot) {
    slot = slot === 2 ? 2 : 1;
    const cfg = leer();
    if (!listo(cfg)) { conexion(() => subirFoto(x, cambiar, slot)); return; }
    if (!navigator.onLine) { UI.toast('Para subir fotos necesitas internet', 'mal'); return; }
    const archivo = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    document.body.appendChild(archivo);
    archivo.addEventListener('change', async () => {
      const f = archivo.files && archivo.files[0]; archivo.remove();
      if (!f) return;
      let img;
      try { img = await reducir(f); } catch (e) { UI.toast(e.message, 'mal', 5000); return; }
      vistaPrevia(x, cambiar, img, cfg, slot);
    });
    archivo.click();
  }

  function vistaPrevia(x, cambiar, img, cfg, slot) {
    slot = slot === 2 ? 2 : 1;
    const url = URL.createObjectURL(img.blob);
    const marcas = x.items.map(i => ({ i, cb: h('input', { type: 'checkbox', checked: true }) }));
    const msg = h('div', { class: 'aviso mal', style: { display: 'none' } });
    const cuerpo = h('div', null,
      h('div', { class: 'cat-prev' }, h('img', { src: url, alt: 'Vista previa de ' + titulo(x) })),
      h('div', { class: 'fuerte', style: { marginTop: '8px' } }, titulo(x)),
      h('div', { class: 'muted' }, Math.round(img.blob.size / 1024) + ' KB · ' + img.ancho + '×' + img.alto + ' px · quedó lista para subir'),
      h('div', { class: 'fuerte', style: { margin: '12px 0 4px' } }, 'Se aplica a estos códigos:'),
      h('div', { class: 'cat-codigos' }, marcas.map(m => h('label', { class: 'cat-cod' }, m.cb, h('span', null, m.i.codigo + (m.i.talla ? ' · ' + m.i.talla : ''))))),
      msg);
    const m = UI.modal({ titulo: slot === 2 ? (cambiar ? 'Cambiar segunda foto' : 'Subir segunda foto') : (cambiar ? 'Cambiar foto' : 'Subir foto'), cuerpo, ancho: '520px', alCerrar: () => URL.revokeObjectURL(url), acciones: [{ texto: 'Cancelar', tipo: 'ghost' },
      { texto: 'Subir foto', tipo: 'primary', cerrar: false, onclick: async (cerrar, btn) => {
        const codigos = marcas.filter(z => z.cb.checked).map(z => z.i.codigo);
        msg.style.display = 'none';
        if (!codigos.length) { msg.textContent = 'Marca al menos un código.'; msg.style.display = ''; return; }
        btn.disabled = true; btn.textContent = 'Subiendo…';
        const anterior = slot === 2 ? x.foto2 : x.foto;
        const base = nombreBase(x) + (slot === 2 ? '-2' : '');
        const nombre = cambiar && anterior ? base + '-' + Date.now().toString(36).slice(-4) : base;
        try {
          await subirArchivo(cfg, nombre, img.base64);
          // la columna guarda las dos fotos juntas: la que no se cambia se manda igual
          const r = await Store.hacer('producto_foto', slot === 2 ? { codigos, foto: x.foto, foto2: nombre } : { codigos, foto: nombre, foto2: x.foto2 || '' });
          if (!r.ok) throw new Error(r.msg || 'No se pudo guardar la foto en el inventario');
        } catch (e) { btn.disabled = false; btn.textContent = 'Subir foto'; msg.textContent = e.message; msg.style.display = ''; return; }
        if (cambiar && anterior && anterior !== nombre) borrarArchivo(cfg, anterior);
        cerrar(); UI.toast((slot === 2 ? 'Segunda foto subida' : 'Foto subida') + ' · aparece en el catálogo en 1–2 minutos', 'ok', 5000); App.refresh();
      } }] });
    return m;
  }

  async function usarFotoActual(x) {
    const r = await Store.hacer('producto_foto', { codigos: x.sinFoto.map(i => i.codigo), foto: x.foto, foto2: x.foto2 || '' });
    if (!r.ok) { UI.toast(r.msg, 'mal'); return; }
    UI.toast('Listo: las tallas nuevas usan la misma foto', 'ok'); App.refresh();
  }
  async function quitarFoto(x) {
    if (!await UI.confirmar('Quitar la foto', titulo(x) + ' dejará de verse en el catálogo hasta que le subas otra foto. El archivo se queda en GitHub.', 'Sí, quitar', true)) return;
    const r = await Store.hacer('producto_foto', { codigos: x.items.map(i => i.codigo), foto: '' });
    if (!r.ok) { UI.toast(r.msg, 'mal'); return; }
    UI.toast('Foto quitada', 'ok'); App.refresh();
  }

  async function quitarSegunda(x) {
    if (!await UI.confirmar('Quitar la segunda foto', titulo(x) + ' se queda solo con su foto principal. El archivo se queda en GitHub.', 'Sí, quitar', true)) return;
    const r = await Store.hacer('producto_foto', { codigos: x.items.map(i => i.codigo), foto: x.foto, foto2: '' });
    if (!r.ok) { UI.toast(r.msg, 'mal'); return; }
    UI.toast('Segunda foto quitada', 'ok'); App.refresh();
  }

  /* ---------- pantalla ---------- */
  Views.catalogo = {
    titulo: 'Catálogo', icono: 'catalogo',
    render(root) {
      const db = Store.view(), cfg = leer(), todas = prendas(db);
      const faltan = todas.filter(x => x.estado !== 'con'), tienen = todas.filter(x => x.estado === 'con');
      root.appendChild(h('div', { class: 'titulo-vista' }, h('h2', null, 'Catálogo'),
        h('div', { class: 'acciones' },
          baseUrl(cfg) ? h('a', { class: 'btn chico', href: baseUrl(cfg) + '/', target: '_blank', rel: 'noopener' }, 'Ver catálogo') : null,
          h('button', { class: 'btn chico', type: 'button', onclick: () => conexion() }, listo(cfg) ? 'Conexión con GitHub' : 'Conectar con GitHub'))));
      root.appendChild(h('div', { class: 'aviso info' }, 'Cada prenda aparece en el catálogo cuando tiene foto, está activa y hay existencia. Si se agota, se ve en gris una semana y luego se oculta. Una foto sirve para todas las tallas del mismo nombre y color.'));
      if (!listo(cfg)) root.appendChild(h('div', { class: 'aviso ambar' }, h('div', { class: 'fuerte' }, 'Primero conecta el repositorio del catálogo'),
        h('div', null, 'Necesitas hacerlo una sola vez en este aparato para poder subir fotos.'),
        h('button', { class: 'btn primary chico', type: 'button', style: { marginTop: '8px' }, onclick: () => conexion() }, 'Conectar con GitHub')));
      if (!todas.length) { root.appendChild(UI.vacio('Todavía no hay productos activos. Da de alta productos en Inventario.')); return; }

      /* Sin foto */
      const sin = h('div', { class: 'card' }, h('h3', null, 'Faltan por subir foto (' + faltan.length + ')'));
      if (!faltan.length) sin.appendChild(UI.vacio('Todas tus prendas tienen foto. 🎉'));
      else {
        sin.appendChild(h('div', { class: 'lista' }, faltan.slice(0, est.max).map(x => h('div', { class: 'item cat-item' },
          h('div', { class: 'grow' },
            h('div', { class: 't1' }, titulo(x)),
            h('div', { class: 't2' }, (x.cat ? x.cat + ' · ' : '') + 'tallas ' + tallas(x) + ' · ' + money(x.items[0].precio) + ' · ' + UI.num(x.piezas) + ' en existencia'),
            x.estado === 'parcial' ? h('div', { class: 't2 aviso-chico' }, 'Falta foto en: ' + x.sinFoto.map(i => i.talla || i.codigo).join(', ')) : null),
          x.estado === 'parcial' ? h('button', { class: 'btn chico', type: 'button', onclick: () => usarFotoActual(x) }, 'Usar la foto actual') : null,
          h('button', { class: 'btn primary chico', type: 'button', onclick: () => subirFoto(x, false) }, x.estado === 'parcial' ? 'Subir otra' : 'Subir foto')))));
        if (faltan.length > est.max) sin.appendChild(h('button', { class: 'btn', type: 'button', style: { marginTop: '8px' }, onclick: () => { est.max += 60; App.refresh(); } }, 'Mostrar más'));
      }
      root.appendChild(sin);

      /* Con foto */
      const con = h('div', { class: 'card' }, h('h3', null, 'Con foto en el catálogo (' + tienen.length + ')'));
      if (!tienen.length) con.appendChild(UI.vacio('Aún no has subido fotos.'));
      else {
        const mini = nom => baseUrl(cfg) && nom ? h('img', { class: 'cat-mini', loading: 'lazy', alt: '', src: baseUrl(cfg) + '/fotos/' + encodeURIComponent(nom) + '.jpg', onerror: ev => { ev.currentTarget.style.visibility = 'hidden'; } }) : null;
        con.appendChild(h('div', { class: 'lista' }, tienen.slice(0, est.maxCon).map(x => h('div', { class: 'item cat-item' },
          h('div', { class: 'cat-minis' }, mini(x.foto), mini(x.foto2)),
          h('div', { class: 'grow' }, h('div', { class: 't1' }, titulo(x)),
            h('div', { class: 't2' }, (x.cat ? x.cat + ' · ' : '') + 'tallas ' + tallas(x) + ' · ' + UI.num(x.piezas) + ' en existencia' + (x.piezas <= 0 ? ' · agotada' : '') + ' · ' + (x.foto2 ? '2 fotos' : '1 foto')),
            h('div', { class: 'cat-acciones' },
              h('button', { class: 'btn chico', type: 'button', onclick: () => subirFoto(x, true, 1) }, 'Cambiar foto'),
              h('button', { class: 'btn chico', type: 'button', onclick: () => subirFoto(x, !!x.foto2, 2) }, x.foto2 ? 'Cambiar 2.ª foto' : '+ Agregar 2.ª foto'),
              x.foto2 ? h('button', { class: 'btn chico peligro', type: 'button', onclick: () => quitarSegunda(x) }, 'Quitar 2.ª') : null,
              h('button', { class: 'btn chico peligro', type: 'button', onclick: () => quitarFoto(x) }, 'Quitar fotos')))))));
        if (tienen.length > est.maxCon) con.appendChild(h('button', { class: 'btn', type: 'button', style: { marginTop: '8px' }, onclick: () => { est.maxCon += 30; App.refresh(); } }, 'Mostrar más'));
      }
      root.appendChild(con);
    }
  };
})();
