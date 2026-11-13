/**
 * HOOD 405 · Núcleo de negocio
 * Este MISMO archivo corre en el navegador (modo sin internet) y en Apps Script (servidor, archivo Core.gs).
 * No usa nada del navegador ni de Google: solo JavaScript puro. Las fechas son texto "aaaa-mm-dd" y las horas "hh:mm:ss".
 *
 * Idea central: cada cosa que se hace en la app es una "operación" {id, tipo, por, f, h, args}.
 * El servidor ejecuta la operación contra el Sheet (autoridad). El navegador la ejecuta contra su copia local
 * para mostrar el resultado al instante aunque no haya internet, y la reenvía cuando vuelve la conexión.
 */
var HOOD = (function () {
  'use strict';

  /* ============================================================
   * 1. UTILIDADES
   * ============================================================ */
  const r2 = x => Math.round(Number(x) * 100) / 100;
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
  const nn = v => (v === null || v === undefined || v === '' ? null : num(v));
  const tel10 = t => String(t == null ? '' : t).replace(/\D/g, '').slice(-10);
  const p2 = n => (n < 10 ? '0' : '') + n;
  const esFecha = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s));
  const esHora = s => /^\d{2}:\d{2}(:\d{2})?$/.test(String(s));
  const str = v => (v === null || v === undefined ? '' : String(v));

  /** Convierte 10, 0.1 o "10%" en 0.10 (máximo 100%). */
  function pct(v) {
    let n;
    if (typeof v === 'string') {
      n = parseFloat(v.replace('%', '').replace(',', '.'));
      if (v.indexOf('%') >= 0) n = n / 100;
    } else n = Number(v);
    if (!isFinite(n)) n = 0;
    if (n > 1) n = n / 100;
    return Math.max(0, Math.min(1, n));
  }

  // ----- fechas (texto aaaa-mm-dd, sin zonas horarias) -----
  const ms = f => { const a = String(f).split('-'); return Date.UTC(+a[0], +a[1] - 1, +a[2]); };
  const dstr = t => { const d = new Date(t); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); };
  const sumaDias = (f, n) => dstr(ms(f) + n * 864e5);
  const difDias = (a, b) => Math.round((ms(a) - ms(b)) / 864e5);
  const lunesDe = f => sumaDias(f, -((new Date(ms(f)).getUTCDay() + 6) % 7));
  const iniMes = f => String(f).slice(0, 8) + '01';
  const finMes = f => { const d = new Date(ms(f)); return dstr(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)); };

  /** SHA-256 en JavaScript puro (para validar códigos de descuento sin revelarlos al vendedor). */
  function sha256(texto) {
    const b = [];
    for (let i = 0; i < texto.length; i++) {
      let c = texto.charCodeAt(i);
      if (c < 128) b.push(c);
      else if (c < 2048) b.push(192 | (c >> 6), 128 | (c & 63));
      else if (c >= 0xd800 && c < 0xdc00) {
        const c2 = texto.charCodeAt(++i);
        c = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
        b.push(240 | (c >> 18), 128 | ((c >> 12) & 63), 128 | ((c >> 6) & 63), 128 | (c & 63));
      } else b.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
    }
    const K = [], H = [];
    const rot = (x, n) => (x >>> n) | (x << (32 - n));
    for (let cand = 2, n = 0; n < 64; cand++) {
      let primo = true;
      for (let d = 2; d * d <= cand; d++) if (cand % d === 0) { primo = false; break; }
      if (!primo) continue;
      if (n < 8) H[n] = (Math.pow(cand, 1 / 2) % 1) * 4294967296 | 0;
      K[n++] = (Math.pow(cand, 1 / 3) % 1) * 4294967296 | 0;
    }
    const len = b.length * 8;
    b.push(0x80);
    while (b.length % 64 !== 56) b.push(0);
    for (let i = 7; i >= 0; i--) b.push(i >= 4 ? 0 : (len >>> (i * 8)) & 255);
    const w = new Array(64);
    for (let o = 0; o < b.length; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = (b[o + i * 4] << 24) | (b[o + i * 4 + 1] << 16) | (b[o + i * 4 + 2] << 8) | b[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rot(w[i - 15], 7) ^ rot(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rot(w[i - 2], 17) ^ rot(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let [a, bb, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => ('00000000' + (x >>> 0).toString(16)).slice(-8)).join('');
  }

  /* ============================================================
   * 2. COLUMNAS (idénticas a las hojas del Sheet)
   * ============================================================ */
  const CV = { ID: 0, FECHA: 1, HORA: 2, CODIGO: 3, PRODUCTO: 4, CANT: 5, PRECIO: 6, TOTAL: 7, COSTO: 8, UTIL: 9, PAGO: 10, VENDEDOR: 11,
    COM_TARJ: 12, COBRADO: 13, COD_DESC: 14, PCT_DESC: 15, DESC: 16, NOTA: 17, PCT_COM: 18, COM: 19, SEMANA: 20, TEL: 21, ESTADO: 22, VENCE: 23 };
  const CA = { ID: 0, FECHA: 1, HORA: 2, TEL: 3, CLIENTE: 4, MONTO: 5, FORMA: 6, UTIL: 7, VENDEDOR: 8, NOTA: 9, APART: 10 };
  const CP = { ID: 0, FECHA: 1, HORA: 2, TEL: 3, CLIENTE: 4, CODIGO: 5, PRODUCTO: 6, CANT: 7, PRECIO: 8, TOTAL: 9, COSTO: 10, UTIL: 11, VENDEDOR: 12,
    PCT_COM: 13, VENCE: 14, ABONADO: 15, SALDO: 16, ESTADO: 17, CIERRE: 18, COD_DESC: 19, PCT_DESC: 20, DESC: 21 };
  const CPR = { CODIGO: 0, NOMBRE: 1, CAT: 2, TALLA: 3, COLOR: 4, COSTO: 5, PRECIO: 6, STOCK: 7, MIN: 8, ACTIVO: 9, DISP: 10 }; // DISP no existe en el Sheet: se calcula
  const CE = { FECHA: 0, CODIGO: 1, CANT: 2, NOTAS: 3, COSTO: 4, TOTAL: 5, EFECTIVO: 6, ID: 7 };
  const CC = { TEL: 0, NOMBRE: 1, LIMITE: 2, ACTIVO: 3, COMPRAS: 4, ABONOS: 5, SALDO: 6, PROX: 7, ATRASO: 8, ESTADO: 9 };
  const CG = { FECHA: 0, CONCEPTO: 1, MONTO: 2, EFECTIVO: 3, CAT: 4, ID: 5, NOTAS: 6 };
  const CPG = { ID: 0, FECHA: 1, HORA: 2, VENDEDOR: 3, SEMANA: 4, MONTO: 5, FORMA: 6, NOTA: 7, GASTO: 8 };
  const CCT = { ID: 0, FECHA: 1, HORA: 2, USUARIO: 3, ESPERADO: 4, CONTADO: 5, DIF: 6, EFECTIVO: 7, TRANSF: 8, TARJETA: 9, NOTAS: 10 };

  /** Cómo se guarda cada tabla en el Sheet (lo usa el servidor para leer y escribir). */
  const TABLAS = {
    productos: { hoja: 'Productos', cols: 10, fechas: [], horas: [], textos: [0] },
    entradas: { hoja: 'Entradas', cols: 8, fechas: [0], horas: [], textos: [1, 7] },
    ventas: { hoja: 'Ventas', cols: 24, fechas: [1, 20, 23], horas: [2], textos: [3, 21] },
    abonos: { hoja: 'Abonos', cols: 11, fechas: [1], horas: [2], textos: [3, 10] },
    apartados: { hoja: 'Apartados', cols: 22, fechas: [1, 14, 18], horas: [2], textos: [3, 5] },
    clientes: { hoja: 'Clientes', cols: 10, fechas: [7], horas: [], textos: [0] },
    gastos: { hoja: 'Gastos', cols: 7, fechas: [0], horas: [], textos: [5] },
    pagos: { hoja: 'Pagos', cols: 9, fechas: [1, 4], horas: [2], textos: [8] },
    cortes: { hoja: 'Cortes', cols: 11, fechas: [1], horas: [2], textos: [] }
  };

  const ABONO_FORMAS = ['Efectivo', 'Transferencia'];
  const SOLO_DUENO = { producto_alta: 1, producto_edit: 1, entrada: 1, entrada_editar: 1, entrada_anular: 1, gasto: 1, gasto_anular: 1, pago: 1, pago_anular: 1, corte: 1, cliente: 1, config: 1, cancelar: 1 };

  /* ============================================================
   * 3. BASE DE DATOS EN MEMORIA
   * ============================================================ */
  const CAT_GASTOS_BASE = ['Sueldos', 'Remodelación local', 'Productos de limpieza', 'Mantenimiento', 'Marketing', 'Otros'];
  /** Los pagos a empleados se guardan como gasto de categoría Sueldos (antes Nómina); no cuentan como gasto operativo porque ya van en la nómina devengada. */
  const esSueldos = c => /^(n[oó]mina|sueldos?)$/i.test(String(c || '').trim());
  function configBase() {
    return { formas: ['Efectivo', 'Transferencia', 'Tarjeta'], duenoPass: '', duenoNombre: 'Dueño', vendedores: [], codigos: [],
      plazoCredito: 40, periodoMetas: 'Semana', fondo: 0, metas: [], plazoApartado: 30, minApartado: 0.1, avisoDias: 5, comTarjeta: 0.08, catGastos: CAT_GASTOS_BASE.slice() };
  }
  function nuevaDb() {
    const db = { config: configBase() };
    Object.keys(TABLAS).forEach(k => { db[k] = []; });
    return db;
  }
  function normalizar(db) {
    Object.keys(TABLAS).forEach(k => { if (!Array.isArray(db[k])) db[k] = []; });
    db.config = Object.assign(configBase(), db.config || {});
    return db;
  }

  const textoProd = p => str(p[CPR.NOMBRE]) + (p[CPR.TALLA] ? ' ' + p[CPR.TALLA] : '') + (p[CPR.COLOR] ? ' ' + p[CPR.COLOR] : '');
  const activoProd = p => str(p[CPR.ACTIVO]).trim().toUpperCase() !== 'NO';
  function mapaProd(db) {
    const m = {};
    db.productos.forEach(r => { if (r[0] !== '' && r[0] != null) m[String(r[0])] = r; });
    return m;
  }
  function sumDisp(db, codigo, delta) {
    const p = mapaProd(db)[String(codigo)];
    if (p) p[CPR.DISP] = num(p[CPR.DISP]) + delta;
  }
  const vendedorDe = (db, nombre) => db.config.vendedores.find(v => v.nombre === nombre) || null;
  const baseDe = (db, nombre) => { const v = vendedorDe(db, nombre); return v && v.base === 'Total' ? 'Total' : 'Utilidad'; };

  /** Existencia = stock inicial + entradas − vendido − por pagar (crédito) − apartado vigente. Solo en el servidor (tiene todas las tablas). */
  function recomputeDisp(db) {
    const ent = {}, ven = {}, apa = {};
    db.entradas.forEach(r => { const c = str(r[CE.CODIGO]); if (c !== '') ent[c] = (ent[c] || 0) + num(r[CE.CANT]); });
    db.ventas.forEach(r => { if (r[CV.ID] === '') return; const c = str(r[CV.CODIGO]); ven[c] = (ven[c] || 0) + num(r[CV.CANT]); });
    db.apartados.forEach(r => { if (r[CP.ID] === '' || r[CP.ESTADO] !== 'Apartado') return; const c = str(r[CP.CODIGO]); apa[c] = (apa[c] || 0) + num(r[CP.CANT]); });
    db.productos.forEach(r => {
      if (r[0] === '' || r[0] == null) return;
      const c = String(r[0]);
      r[CPR.DISP] = num(r[CPR.STOCK]) + (ent[c] || 0) - (ven[c] || 0) - (apa[c] || 0);
    });
  }

  /** Reparte un monto entre varias líneas en proporción a su base; la suma sale exacta. */
  function repartir(monto, bases) {
    const suma = bases.reduce((a, b) => a + b, 0);
    let acum = 0;
    return bases.map((b, k) => {
      let parte = 0;
      if (monto > 0 && suma > 0) parte = (k === bases.length - 1) ? r2(monto - acum) : r2(monto * b / suma);
      acum = r2(acum + parte);
      return parte;
    });
  }

  /** Comisión del vendedor: sobre la utilidad (nunca negativa) o sobre el total vendido. */
  function calcCom(util, total, pctCom, base) {
    if (base === 'Total') return r2(Math.max(0, num(total)) * pctCom);
    if (util === null || util === undefined || util === '') return null; // el navegador del vendedor no conoce el costo: se calcula al sincronizar
    return r2(Math.max(0, num(util)) * pctCom);
  }

  /** Datos de la operación que se usan para fechar y numerar las filas que crea. */
  function sello(op) {
    const h = String(op.h).length === 5 ? op.h + ':00' : String(op.h);
    const r = String(op.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-4);
    return { fecha: op.f, hora: h, tallo: op.f.slice(2).replace(/-/g, '') + h.replace(/:/g, '') + (r ? '-' + r : '') };
  }

  /* ============================================================
   * 4. DESCUENTOS
   * ============================================================ */
  function codigoInfo(db, texto, hoy) {
    const buscado = String(texto || '').trim().toUpperCase();
    if (!buscado) return { ok: false, msg: 'Escribe un código' };
    const lista = db.config.codigos || [];
    const h = lista.some(c => c.h) ? sha256(buscado) : '';
    for (const c of lista) {
      const coincide = c.h ? c.h === h : String(c.codigo || '').trim().toUpperCase() === buscado;
      if (!coincide) continue;
      if (c.activo === false) return { ok: false, msg: 'Código no disponible' };
      if (c.vence && c.vence < hoy) return { ok: false, msg: 'Código vencido' };
      const p = pct(c.pct);
      if (p <= 0) return { ok: false, msg: 'Código sin descuento configurado' };
      return { ok: true, codigo: buscado, pct: p, credito: c.credito === true };
    }
    return { ok: false, msg: 'Código inválido' };
  }

  /* ============================================================
   * 5. CRÉDITO PROPIO
   *    Una compra a crédito baja el inventario y paga comisión al instante, pero no cuenta como cobrada.
   *    Cada abono entra como dinero cobrado y paga primero la compra más antigua.
   * ============================================================ */
  function creditos(db, hoy) {
    const cli = {}, porId = {};
    const get = t => cli[t] || (cli[t] = { compras: [], abonos: [], total: 0, pagado: 0, saldo: 0 });
    db.ventas.forEach(f => {
      if (f[CV.PAGO] !== 'Crédito' || f[CV.ID] === '') return;
      const c = get(tel10(f[CV.TEL]));
      let p = porId[f[CV.ID]];
      if (!p) { p = porId[f[CV.ID]] = { id: f[CV.ID], fecha: f[CV.FECHA], limite: f[CV.VENCE], total: 0, util: 0, filas: [], items: [] }; c.compras.push(p); }
      p.total = r2(p.total + num(f[CV.TOTAL]));
      p.util = r2(p.util + num(f[CV.UTIL]));
      p.filas.push(f);
      p.items.push(f[CV.PRODUCTO] + ' ×' + f[CV.CANT]);
      c.total = r2(c.total + num(f[CV.TOTAL]));
    });
    db.abonos.forEach(f => {
      if (f[CA.ID] === '' || str(f[CA.APART]) !== '') return; // los abonos de apartados no pagan crédito
      const c = get(tel10(f[CA.TEL]));
      c.abonos.push({ fecha: f[CA.FECHA], monto: num(f[CA.MONTO]), forma: f[CA.FORMA] });
      c.pagado = r2(c.pagado + num(f[CA.MONTO]));
    });
    Object.keys(cli).forEach(t => {
      let resto = cli[t].pagado;
      cli[t].compras.forEach(p => {
        p.pagado = r2(Math.min(p.total, resto));
        resto = r2(resto - p.pagado);
        p.saldo = r2(p.total - p.pagado);
        p.estado = p.saldo <= 0 ? 'Pagada' : (hoy > p.limite ? 'Vencida' : 'Vigente');
      });
      cli[t].saldo = r2(cli[t].total - cli[t].pagado);
    });
    return cli;
  }

  /** Actualiza el Estado de cada línea de Ventas (Cobrada / Por pagar / Pagada) y las columnas calculadas de Clientes. */
  function recalcular(db, hoy) {
    const cli = creditos(db, hoy);
    db.ventas.forEach(f => { if (f[CV.ID] !== '') f[CV.ESTADO] = f[CV.PAGO] === 'Crédito' ? 'Por pagar' : 'Cobrada'; });
    Object.keys(cli).forEach(t => cli[t].compras.forEach(p => {
      if (p.estado === 'Pagada') p.filas.forEach(f => { f[CV.ESTADO] = 'Pagada'; });
    }));
    const aviso = num(db.config.avisoDias);
    db.clientes.forEach(f => {
      if (f[CC.TEL] === '' || f[CC.TEL] == null) { for (let k = 4; k <= 9; k++) f[k] = ''; return; }
      const c = cli[tel10(f[CC.TEL])];
      if (!c) { f[4] = 0; f[5] = 0; f[6] = 0; f[7] = ''; f[8] = 0; f[9] = 'Sin deuda'; return; }
      const pend = c.compras.filter(p => p.saldo > 0);
      const prox = pend.length ? pend.map(p => p.limite).sort()[0] : '';
      const atraso = prox && hoy > prox ? difDias(hoy, prox) : 0;
      f[4] = c.total; f[5] = c.pagado; f[6] = c.saldo; f[7] = prox; f[8] = atraso;
      f[9] = c.saldo <= 0 ? 'Sin deuda' : (atraso > 0 ? 'VENCIDO' : (prox && difDias(prox, hoy) <= aviso ? 'POR VENCER' : 'Vigente'));
    });
  }

  function clienteActivo(db, telRaw) {
    const t = tel10(telRaw);
    if (t.length !== 10) return null;
    for (const f of db.clientes) {
      if (tel10(f[CC.TEL]) === t && str(f[CC.ACTIVO]).trim().toUpperCase() !== 'NO') return { tel: t, nombre: str(f[CC.NOMBRE]), limite: num(f[CC.LIMITE]) };
    }
    return null;
  }

  /** Agrega una fila a Abonos. apart = ID del apartado (vacío si es abono de crédito). */
  function guardarAbono(db, st, o) {
    const f = new Array(11).fill('');
    f[CA.ID] = o.id || ('A' + st.tallo);
    f[CA.FECHA] = st.fecha; f[CA.HORA] = st.hora; f[CA.TEL] = o.tel; f[CA.CLIENTE] = o.cliente; f[CA.MONTO] = o.monto;
    f[CA.FORMA] = o.forma; f[CA.UTIL] = r2(o.util); f[CA.VENDEDOR] = o.vendedor; f[CA.NOTA] = o.nota; f[CA.APART] = o.apart || '';
    db.abonos.push(f);
  }

  /** Guarda un abono de crédito y calcula la parte de utilidad que representa (proporcional a las compras que paga). */
  function abonarCredito(db, st, tel, monto, forma, vendedor, nombre) {
    const c = creditos(db, st.fecha)[tel] || { compras: [] };
    let resto = monto, util = 0;
    c.compras.forEach(p => {
      if (resto > 0 && p.saldo > 0) {
        const x = Math.min(resto, p.saldo);
        util += p.total > 0 ? x * p.util / p.total : 0;
        resto = r2(resto - x);
      }
    });
    guardarAbono(db, st, { tel, cliente: nombre, monto, forma, util, vendedor, nota: 'Abono cuenta ' + nombre });
  }

  /* ============================================================
   * 6. VENTAS
   *    Precios, costos, descuentos, comisión de tarjeta y comisión del vendedor se calculan aquí, nunca en la pantalla.
   *    Orden: descuento → utilidad → límite de crédito → comisión de tarjeta → comisión del vendedor.
   * ============================================================ */
  function filaVenta(o) {
    const f = new Array(24).fill('');
    f[CV.ID] = o.id; f[CV.FECHA] = o.fecha; f[CV.HORA] = o.hora;
    f[CV.CODIGO] = o.codigo; f[CV.PRODUCTO] = o.nombre; f[CV.CANT] = o.cant;
    f[CV.PRECIO] = o.precio; f[CV.TOTAL] = o.total; f[CV.COSTO] = o.costo; f[CV.UTIL] = o.util;
    f[CV.PAGO] = o.pago; f[CV.VENDEDOR] = o.vendedor;
    f[CV.COM_TARJ] = o.comTarj; f[CV.COBRADO] = r2(o.total + o.comTarj);
    f[CV.COD_DESC] = o.codDesc; f[CV.PCT_DESC] = o.pctDesc; f[CV.DESC] = o.desc; f[CV.NOTA] = o.nota;
    f[CV.PCT_COM] = o.pctCom; f[CV.COM] = calcCom(o.util, o.total, o.pctCom, o.base);
    f[CV.SEMANA] = o.semana; f[CV.TEL] = o.tel; f[CV.ESTADO] = o.estado; f[CV.VENCE] = o.vence;
    return f;
  }

  /** Arma las líneas del carrito validando existencia. Devuelve {lineas, subtotal} o {ok:false,msg}. */
  function armarLineas(db, items) {
    if (!Array.isArray(items) || !items.length) return { ok: false, msg: 'El carrito está vacío' };
    const prods = mapaProd(db), cant = {};
    for (const it of items) {
      const c = String(it.codigo), n = Math.floor(num(it.cantidad));
      if (!(n > 0)) return { ok: false, msg: 'Cantidad inválida' };
      cant[c] = (cant[c] || 0) + n;
    }
    const lineas = [];
    let subtotal = 0;
    for (const codigo of Object.keys(cant)) {
      const p = prods[codigo], n = cant[codigo];
      if (!p || !activoProd(p)) return { ok: false, msg: 'Producto no disponible: ' + codigo };
      const nombre = textoProd(p);
      if (n > num(p[CPR.DISP])) return { ok: false, msg: 'No hay existencia suficiente de ' + nombre };
      const precio = num(p[CPR.PRECIO]);
      lineas.push({ codigo, nombre, cant: n, precio, costo: nn(p[CPR.COSTO]), total: r2(n * precio) });
      subtotal = r2(subtotal + n * precio);
    }
    return { ok: true, lineas, subtotal };
  }

  /** Aplica el descuento: baja el total y la utilidad de cada línea. */
  function aplicarDescuento(lineas, subtotal, pctDesc) {
    const descTotal = r2(subtotal * pctDesc);
    const descL = repartir(descTotal, lineas.map(l => l.total));
    lineas.forEach((l, k) => {
      l.desc = descL[k];
      l.total = r2(l.total - l.desc);
      l.util = l.costo === null ? null : r2(l.total - l.cant * l.costo);
    });
    return { descTotal, neto: r2(lineas.reduce((a, l) => a + l.total, 0)) };
  }

  function vender(db, op, ctx, cred) {
    const a = op.args || {}, st = sello(op), hoy = st.fecha;
    const pago = cred ? 'Crédito' : String(a.pago || '');
    if (!cred && (db.config.formas.indexOf(pago) < 0 || /cr[eé]dito|apartado/i.test(pago))) return { ok: false, msg: 'Elige la forma de cobro' };
    let desc = null;
    if (String(a.cod || '').trim()) {
      desc = codigoInfo(db, a.cod, hoy); if (!desc.ok) return desc;
      if (cred && !desc.credito) return { ok: false, msg: 'El código ' + desc.codigo + ' no es válido en compras a crédito. Quítalo o cobra de contado.' };
    }
    const L = armarLineas(db, a.items);
    if (!L.ok) return L;
    const lineas = L.lineas;
    const pctDesc = desc ? desc.pct : 0;
    const { descTotal, neto } = aplicarDescuento(lineas, L.subtotal, pctDesc);

    let vence = '', primer = 0;
    if (cred) {
      const c = creditos(db, hoy)[cred.cl.tel] || { saldo: 0 };
      primer = Math.min(cred.primer, neto);
      if (c.saldo >= cred.cl.limite || c.saldo + neto - primer > cred.cl.limite) return { ok: false, msg: 'Sin crédito disponible: esta compra excede el crédito autorizado del cliente' };
      vence = sumaDias(hoy, num(db.config.plazoCredito) || 40);
    }
    const comTarjeta = /tarjeta/i.test(pago) ? r2(neto * num(db.config.comTarjeta)) : 0;
    const comL = repartir(comTarjeta, lineas.map(l => l.total));
    const v = ctx.vend, pctCom = pct(v.pct), base = v.base === 'Total' ? 'Total' : 'Utilidad';
    const id = 'V' + st.tallo, semana = lunesDe(hoy);
    const nota = descTotal > 0 ? 'Descuento aplicado con código ' + desc.codigo + ' (' + (Math.round(pctDesc * 10000) / 100) + '%)' : '';
    lineas.forEach((l, k) => {
      db.ventas.push(filaVenta({ id, fecha: hoy, hora: st.hora, codigo: l.codigo, nombre: l.nombre, cant: l.cant, precio: l.precio, total: l.total,
        costo: l.costo, util: l.util, pago, vendedor: ctx.usuario, comTarj: comL[k], codDesc: descTotal > 0 ? desc.codigo : '',
        pctDesc: descTotal > 0 ? pctDesc : '', desc: l.desc, nota, pctCom, base, semana, tel: cred ? cred.cl.tel : '',
        estado: cred ? 'Por pagar' : 'Cobrada', vence }));
      sumDisp(db, l.codigo, -l.cant);
    });
    if (cred && primer > 0) abonarCredito(db, st, cred.cl.tel, primer, cred.forma, ctx.usuario, cred.cl.nombre);
    if (cred) recalcular(db, hoy);
    return { ok: true, id, subtotal: L.subtotal, descuento: descTotal, total: neto, comision: comTarjeta, cobrado: r2(neto + comTarjeta), primer };
  }

  function opVenta(db, op, ctx) { return vender(db, op, ctx, null); }

  function opCredito(db, op, ctx) {
    const a = op.args || {};
    const cl = clienteActivo(db, a.tel);
    if (!cl) return { ok: false, msg: 'Cuenta no encontrada' };
    const pp = r2(Math.max(0, num(a.primer)));
    if (pp > 0 && ABONO_FORMAS.indexOf(a.forma) < 0) return { ok: false, msg: 'El primer pago es en efectivo o transferencia' };
    return vender(db, op, ctx, { cl, primer: pp, forma: a.forma });
  }

  function opAbono(db, op, ctx) {
    const a = op.args || {}, st = sello(op);
    const monto = r2(num(a.monto));
    if (!(monto > 0)) return { ok: false, msg: 'Escribe un monto válido' };
    if (ABONO_FORMAS.indexOf(a.forma) < 0) return { ok: false, msg: 'El abono es en efectivo o transferencia' };
    const cl = clienteActivo(db, a.tel);
    if (!cl) return { ok: false, msg: 'Cuenta no encontrada' };
    const c = creditos(db, st.fecha)[cl.tel];
    if (!c || monto > c.saldo) return { ok: false, msg: 'El abono no puede ser mayor que la deuda' };
    abonarCredito(db, st, cl.tel, monto, a.forma, ctx.usuario, cl.nombre);
    recalcular(db, st.fecha);
    return { ok: true, monto };
  }

  /* ============================================================
   * 7. APARTADOS
   *    El producto queda reservado (sale de la existencia) mientras el cliente lo paga con abonos.
   *    Al liquidar se crea la venta y se paga la comisión. Si vence, la pieza vuelve a la existencia y lo abonado queda como ingreso.
   * ============================================================ */
  function apartados(db) {
    const mapa = {};
    db.apartados.forEach(f => {
      if (f[CP.ID] === '' || f[CP.ID] == null) return;
      let a = mapa[f[CP.ID]];
      if (!a) {
        a = mapa[f[CP.ID]] = { id: f[CP.ID], fecha: f[CP.FECHA], tel: tel10(f[CP.TEL]), cliente: str(f[CP.CLIENTE]), vendedor: str(f[CP.VENDEDOR]),
          pct: num(f[CP.PCT_COM]), limite: f[CP.VENCE], estado: str(f[CP.ESTADO] || 'Apartado'), cierre: f[CP.CIERRE],
          total: 0, util: 0, pagado: 0, saldo: 0, lineas: [] };
      }
      a.total = r2(a.total + num(f[CP.TOTAL]));
      a.util = r2(a.util + num(f[CP.UTIL]));
      a.lineas.push(f);
    });
    db.abonos.forEach(r => {
      const a = str(r[CA.APART]) !== '' ? mapa[r[CA.APART]] : null;
      if (a) a.pagado = r2(a.pagado + num(r[CA.MONTO]));
    });
    Object.keys(mapa).forEach(id => { mapa[id].saldo = r2(mapa[id].total - mapa[id].pagado); });
    return mapa;
  }

  /** Escribe en las líneas de Apartados lo calculado: abonado, saldo, estado y fecha de cierre. cambios = { id: {estado, cierre} }. */
  function sincronizarApartados(db, cambios) {
    const mapa = apartados(db);
    Object.keys(cambios || {}).forEach(id => { if (mapa[id]) Object.assign(mapa[id], cambios[id]); });
    Object.keys(mapa).forEach(id => {
      const a = mapa[id];
      a.lineas.forEach(f => { f[CP.ABONADO] = a.pagado; f[CP.SALDO] = a.saldo; f[CP.ESTADO] = a.estado; f[CP.CIERRE] = a.cierre || ''; });
    });
  }

  /** Marca como Vencido lo que pasó de su fecha límite sin liquidarse. Lo abonado se convierte en ingreso (utilidad). */
  function revisarApartados(db, hoy, hora) {
    const mapa = apartados(db), cambios = {};
    Object.keys(mapa).forEach(id => {
      const a = mapa[id];
      const limite = a.limite || '';
      if (a.estado !== 'Apartado' || a.saldo <= 0 || !limite || hoy <= limite) return;
      if (a.pagado > 0) {
        guardarAbono(db, { fecha: hoy, hora: hora || '00:00:00' }, { id: 'A' + a.id + 'V', tel: a.tel, cliente: a.cliente, monto: 0, forma: 'Vencimiento', util: a.pagado,
          vendedor: a.vendedor, nota: 'Apartado vencido: lo abonado se queda como ingreso', apart: a.id });
      }
      a.lineas.forEach(f => sumDisp(db, f[CP.CODIGO], num(f[CP.CANT])));
      cambios[id] = { estado: 'Vencido', cierre: hoy };
    });
    const n = Object.keys(cambios).length;
    if (n) sincronizarApartados(db, cambios);
    return n;
  }

  /** Convierte el apartado en venta: una fila por producto en Ventas, con la comisión del vendedor. */
  function liquidarApartado(db, a, st) {
    const base = baseDe(db, a.vendedor);
    a.lineas.forEach(f => {
      const desc = num(f[CP.DESC]), pctDesc = num(f[CP.PCT_DESC]);
      const nota = 'Apartado liquidado' + (desc > 0 ? ' · Descuento aplicado con código ' + f[CP.COD_DESC] + ' (' + (Math.round(pctDesc * 10000) / 100) + '%)' : '');
      db.ventas.push(filaVenta({ id: a.id, fecha: st.fecha, hora: st.hora, codigo: f[CP.CODIGO], nombre: f[CP.PRODUCTO], cant: num(f[CP.CANT]),
        precio: num(f[CP.PRECIO]), total: num(f[CP.TOTAL]), costo: nn(f[CP.COSTO]), util: nn(f[CP.UTIL]), pago: 'Apartado', vendedor: a.vendedor,
        comTarj: 0, codDesc: desc > 0 ? f[CP.COD_DESC] : '', pctDesc: desc > 0 ? pctDesc : '', desc, nota, pctCom: a.pct, base,
        semana: lunesDe(st.fecha), tel: a.tel, estado: 'Cobrada', vence: '' }));
    });
  }

  function nombreApartado(db, t, nombre) {
    const cl = clienteActivo(db, t);
    if (cl) return cl.nombre;
    const previo = Object.values(apartados(db)).find(a => a.tel === t);
    if (previo) return previo.cliente;
    const n = String(nombre || '').trim();
    return n.length >= 3 ? n : '';
  }

  const minApartado = db => { const v = db.config.minApartado; return v === '' || v == null ? 0.1 : pct(v); };

  function opApartado(db, op, ctx) {
    const a = op.args || {}, st = sello(op), hoy = st.fecha;
    const t = tel10(a.tel);
    if (t.length !== 10) return { ok: false, msg: 'Escribe los 10 dígitos del celular' };
    let desc = null;
    if (String(a.cod || '').trim()) { desc = codigoInfo(db, a.cod, hoy); if (!desc.ok) return desc; }
    revisarApartados(db, hoy, st.hora);
    const cliente = nombreApartado(db, t, a.nombre);
    if (!cliente) return { ok: false, msg: 'Escribe el nombre completo del cliente' };
    const L = armarLineas(db, a.items);
    if (!L.ok) return L;
    const lineas = L.lineas, pctDesc = desc ? desc.pct : 0;
    const { descTotal, neto: total } = aplicarDescuento(lineas, L.subtotal, pctDesc);
    const utilTotal = r2(lineas.reduce((x, l) => x + num(l.util), 0));
    const primer = r2(Math.max(0, num(a.primer)));
    const minimo = r2(total * minApartado(db));
    if (primer > total) return { ok: false, msg: 'El primer abono no puede ser mayor al total' };
    if (primer < minimo) return { ok: false, msg: 'El primer abono mínimo es $' + minimo.toFixed(2) };
    if (primer > 0 && ABONO_FORMAS.indexOf(a.forma) < 0) return { ok: false, msg: 'El abono es en efectivo o transferencia' };

    const id = 'P' + st.tallo;
    if (apartados(db)[id]) return { ok: false, msg: 'Apartado duplicado' };
    const vence = sumaDias(hoy, num(db.config.plazoApartado) || 30);
    const pctCom = pct(ctx.vend.pct);
    lineas.forEach(l => {
      const f = new Array(22).fill('');
      f[CP.ID] = id; f[CP.FECHA] = hoy; f[CP.HORA] = st.hora; f[CP.TEL] = t; f[CP.CLIENTE] = cliente;
      f[CP.CODIGO] = l.codigo; f[CP.PRODUCTO] = l.nombre; f[CP.CANT] = l.cant; f[CP.PRECIO] = l.precio; f[CP.TOTAL] = l.total;
      f[CP.COSTO] = l.costo; f[CP.UTIL] = l.util; f[CP.VENDEDOR] = ctx.usuario; f[CP.PCT_COM] = pctCom; f[CP.VENCE] = vence; f[CP.ESTADO] = 'Apartado';
      if (descTotal > 0) { f[CP.COD_DESC] = desc.codigo; f[CP.PCT_DESC] = pctDesc; f[CP.DESC] = l.desc; }
      db.apartados.push(f);
      sumDisp(db, l.codigo, -l.cant);
    });
    const liquidado = primer >= total;
    if (primer > 0) guardarAbono(db, st, { tel: t, cliente, monto: primer, forma: a.forma, util: liquidado ? utilTotal : 0, vendedor: ctx.usuario, nota: 'Abono apartado ' + cliente, apart: id });
    const cambios = {};
    if (liquidado) { liquidarApartado(db, apartados(db)[id], st); cambios[id] = { estado: 'Liquidado', cierre: hoy }; }
    sincronizarApartados(db, cambios);
    return { ok: true, id, subtotal: L.subtotal, descuento: descTotal, total, primer, liquidado, limite: vence };
  }

  function opApartadoAbono(db, op, ctx) {
    const a = op.args || {}, st = sello(op), hoy = st.fecha;
    const monto = r2(num(a.monto));
    if (!(monto > 0)) return { ok: false, msg: 'Escribe un monto válido' };
    if (ABONO_FORMAS.indexOf(a.forma) < 0) return { ok: false, msg: 'El abono es en efectivo o transferencia' };
    revisarApartados(db, hoy, st.hora);
    const ap = apartados(db)[a.id];
    if (!ap) return { ok: false, msg: 'Apartado no encontrado' };
    if (ap.estado !== 'Apartado') return { ok: false, msg: 'Este apartado ya está ' + ap.estado.toLowerCase() };
    if (monto > ap.saldo) return { ok: false, msg: 'El abono no puede ser mayor que la deuda' };
    const liquidado = r2(ap.saldo - monto) <= 0;
    guardarAbono(db, st, { tel: ap.tel, cliente: ap.cliente, monto, forma: a.forma, util: liquidado ? ap.util : 0, vendedor: ctx.usuario, nota: 'Abono apartado ' + ap.cliente, apart: ap.id });
    const cambios = {};
    if (liquidado) { liquidarApartado(db, ap, st); cambios[ap.id] = { estado: 'Liquidado', cierre: hoy }; }
    sincronizarApartados(db, cambios);
    return { ok: true, liquidado, id: ap.id };
  }

  /* ============================================================
   * 8. OPERACIONES DEL DUEÑO: inventario, compras (reinversión), gastos, nómina, cortes, clientes, configuración
   * ============================================================ */
  const fechaArg = (v, op) => (esFecha(v) && v <= op.f && difDias(op.f, v) <= 400 ? v : op.f);
  const sn = v => (v === true || String(v).toUpperCase() === 'SI' ? 'SI' : 'NO');

  function nuevaEntrada(db, op, st, o) {
    const total = o.reinv === false ? 0 : r2(o.cant * o.costo);
    db.entradas.push([o.fecha, o.codigo, o.cant, o.notas || '', o.reinv === false ? 0 : o.costo, total, sn(o.efectivo), 'E' + st.tallo]);
    sumDisp(db, o.codigo, o.cant);
    return total;
  }

  function opProductoAlta(db, op) {
    const a = op.args || {}, st = sello(op);
    const codigo = String(a.codigo || '').trim();
    if (!codigo) return { ok: false, msg: 'Escribe el código del producto' };
    if (mapaProd(db)[codigo]) return { ok: false, msg: 'Ya existe un producto con el código ' + codigo };
    const nombre = String(a.nombre || '').trim();
    if (nombre.length < 2) return { ok: false, msg: 'Escribe el nombre del producto' };
    const costo = r2(num(a.costo)), precio = r2(num(a.precio)), cant = Math.floor(num(a.cant)), min = Math.max(0, Math.floor(num(a.min)));
    if (!(precio > 0)) return { ok: false, msg: 'El precio de venta debe ser mayor a $0' };
    if (costo < 0) return { ok: false, msg: 'El costo no puede ser negativo' };
    if (cant < 0) return { ok: false, msg: 'La cantidad no puede ser negativa' };
    if (cant > 0 && costo === 0 && a.reinv !== false && a.costoCero !== true) return { ok: false, costoCero: true, msg: 'El costo por pieza es $0: la reinversión quedaría en $0. Escribe el costo, o confirma que no tuvo costo.' };
    db.productos.push([codigo, nombre, String(a.cat || '').trim(), String(a.talla || '').trim(), String(a.color || '').trim(), costo, precio, 0, min, 'SI', 0]);
    let total = 0;
    if (cant > 0) total = nuevaEntrada(db, op, st, { fecha: fechaArg(a.fecha, op), codigo, cant, costo, notas: a.notas || 'Alta de producto', efectivo: a.efectivo, reinv: a.reinv });
    return { ok: true, codigo, reinversion: total };
  }

  function opProductoEdit(db, op) {
    const a = op.args || {};
    const p = mapaProd(db)[String(a.codigo)];
    if (!p) return { ok: false, msg: 'Producto no encontrado' };
    const nombre = a.nombre !== undefined ? String(a.nombre).trim() : p[CPR.NOMBRE];
    if (nombre.length < 2) return { ok: false, msg: 'Escribe el nombre del producto' };
    const costo = a.costo !== undefined ? r2(num(a.costo)) : num(p[CPR.COSTO]);
    const precio = a.precio !== undefined ? r2(num(a.precio)) : num(p[CPR.PRECIO]);
    if (!(precio > 0)) return { ok: false, msg: 'El precio de venta debe ser mayor a $0' };
    if (costo < 0) return { ok: false, msg: 'El costo no puede ser negativo' };
    p[CPR.NOMBRE] = nombre;
    if (a.cat !== undefined) p[CPR.CAT] = String(a.cat).trim();
    if (a.talla !== undefined) p[CPR.TALLA] = String(a.talla).trim();
    if (a.color !== undefined) p[CPR.COLOR] = String(a.color).trim();
    p[CPR.COSTO] = costo; p[CPR.PRECIO] = precio;
    if (a.min !== undefined) p[CPR.MIN] = Math.max(0, Math.floor(num(a.min)));
    if (a.activo !== undefined) p[CPR.ACTIVO] = a.activo === false || String(a.activo).toUpperCase() === 'NO' ? 'NO' : 'SI';
    return { ok: true };
  }

  function opEntrada(db, op) {
    const a = op.args || {}, st = sello(op);
    const p = mapaProd(db)[String(a.codigo)];
    if (!p) return { ok: false, msg: 'Producto no encontrado' };
    const cant = Math.floor(num(a.cant));
    if (!(cant > 0)) return { ok: false, msg: 'Escribe cuántas piezas compraste' };
    const costo = a.costo === undefined || a.costo === '' ? num(p[CPR.COSTO]) : r2(num(a.costo));
    if (costo < 0) return { ok: false, msg: 'El costo no puede ser negativo' };
    if (costo === 0 && a.reinv !== false && a.costoCero !== true) return { ok: false, costoCero: true, msg: 'El costo por pieza es $0: la reinversión quedaría en $0. Escribe el costo, o confirma que no tuvo costo.' };
    const total = nuevaEntrada(db, op, st, { fecha: fechaArg(a.fecha, op), codigo: String(a.codigo), cant, costo, notas: a.notas, efectivo: a.efectivo, reinv: a.reinv });
    if (a.actualizarCosto && a.reinv !== false) p[CPR.COSTO] = costo;
    return { ok: true, reinversion: total };
  }

  /** Corrige una compra ya registrada (piezas, costo, fecha, notas). La existencia y la reinversión se ajustan solas. */
  function opEntradaEditar(db, op) {
    const a = op.args || {};
    const f = db.entradas.find(r => r[CE.ID] === a.id);
    if (!f) return { ok: false, msg: 'Compra no encontrada' };
    const antes = num(f[CE.CANT]);
    const cant = a.cant === undefined || a.cant === '' ? antes : Math.floor(num(a.cant));
    if (!(cant > 0)) return { ok: false, msg: 'Escribe cuántas piezas compraste' };
    const costo = a.costo === undefined || a.costo === '' ? num(f[CE.COSTO]) : r2(num(a.costo));
    if (costo < 0) return { ok: false, msg: 'El costo no puede ser negativo' };
    if (costo === 0 && a.costoCero !== true) return { ok: false, costoCero: true, msg: 'El costo por pieza es $0: la reinversión quedaría en $0. Escribe el costo, o confirma que no tuvo costo.' };
    const p = mapaProd(db)[String(f[CE.CODIGO])];
    if (p && num(p[CPR.DISP]) + (cant - antes) < 0) return { ok: false, msg: 'Ya se vendieron piezas de esa compra: no puedes dejarla con menos de ' + (antes - num(p[CPR.DISP])) + ' piezas' };
    f[CE.CANT] = cant; f[CE.COSTO] = costo; f[CE.TOTAL] = r2(cant * costo);
    if (a.fecha !== undefined && esFecha(a.fecha)) f[CE.FECHA] = fechaArg(a.fecha, op);
    if (a.notas !== undefined) f[CE.NOTAS] = String(a.notas);
    if (a.efectivo !== undefined) f[CE.EFECTIVO] = sn(a.efectivo);
    sumDisp(db, f[CE.CODIGO], cant - antes);
    if (a.actualizarCosto && p) p[CPR.COSTO] = costo;
    return { ok: true, reinversion: f[CE.TOTAL] };
  }

  /* ============================================================
   * 8b. CANCELACIONES
   *    Cancelar = BORRAR el registro de verdad y deshacer todo lo que provocó: existencias, abonos, pagos, gastos, comisiones.
   *    Lo que quedaría inconsistente (por ejemplo, borrar una venta a crédito que ya tiene abonos de más) se rechaza con un mensaje claro.
   * ============================================================ */
  function quitar(arr, fn) { let n = 0; for (let i = arr.length - 1; i >= 0; i--) if (fn(arr[i])) { arr.splice(i, 1); n++; } return n; }

  /** Vuelve a repartir la utilidad cobrada de los abonos de un cliente después de quitar una compra o un abono. */
  function reconstruirAbonosCredito(db, tel) {
    const compras = [], porId = {};
    db.ventas.forEach(f => {
      if (f[CV.ID] === '' || f[CV.PAGO] !== 'Crédito' || tel10(f[CV.TEL]) !== tel) return;
      const p = porId[f[CV.ID]] || (porId[f[CV.ID]] = { total: 0, util: 0, saldo: 0 });
      if (compras.indexOf(p) < 0) compras.push(p);
      p.total = r2(p.total + num(f[CV.TOTAL])); p.util = r2(p.util + num(f[CV.UTIL])); p.saldo = p.total;
    });
    db.abonos.forEach(f => {
      if (f[CA.ID] === '' || str(f[CA.APART]) !== '' || tel10(f[CA.TEL]) !== tel) return;
      let resto = num(f[CA.MONTO]), util = 0;
      compras.forEach(p => {
        if (resto > 0 && p.saldo > 0) { const x = Math.min(resto, p.saldo); util += p.total > 0 ? x * p.util / p.total : 0; p.saldo = r2(p.saldo - x); resto = r2(resto - x); }
      });
      f[CA.UTIL] = r2(util);
    });
  }

  function cancelarApartado(db, id) {
    const ap = apartados(db)[id];
    if (!ap) return { ok: false, msg: 'Apartado no encontrado' };
    // abierto o liquidado: la pieza estaba fuera de la existencia; vencido: ya había regresado
    if (ap.estado === 'Apartado' || ap.estado === 'Liquidado') ap.lineas.forEach(f => sumDisp(db, f[CP.CODIGO], num(f[CP.CANT])));
    quitar(db.ventas, f => f[CV.ID] === id && f[CV.PAGO] === 'Apartado');
    quitar(db.abonos, f => str(f[CA.APART]) === id);
    quitar(db.apartados, f => f[CP.ID] === id);
    return { ok: true };
  }

  function cancelarVenta(db, id) {
    const filas = db.ventas.filter(f => f[CV.ID] === id);
    if (!filas.length) return { ok: false, msg: 'Venta no encontrada' };
    if (filas[0][CV.PAGO] === 'Apartado') return cancelarApartado(db, id);
    const credito = filas[0][CV.PAGO] === 'Crédito', tel = tel10(filas[0][CV.TEL]), aid = 'A' + String(id).slice(1);
    if (credito) {
      const total = filas.reduce((x, f) => x + num(f[CV.TOTAL]), 0);
      const c = creditos(db, filas[0][CV.FECHA])[tel] || { total: 0, pagado: 0 };
      const primer = db.abonos.filter(f => f[CA.ID] === aid && str(f[CA.APART]) === '').reduce((x, f) => x + num(f[CA.MONTO]), 0);
      if (r2(c.pagado - primer) > r2(c.total - total) + 0.004) return { ok: false, msg: 'Este cliente ya abonó dinero que cubre otras compras. Cancela primero sus abonos más recientes (Cancelaciones > Abonos) y luego esta venta.' };
    }
    filas.forEach(f => sumDisp(db, f[CV.CODIGO], num(f[CV.CANT])));
    quitar(db.ventas, f => f[CV.ID] === id);
    if (credito) { quitar(db.abonos, f => f[CA.ID] === aid && str(f[CA.APART]) === ''); reconstruirAbonosCredito(db, tel); }
    return { ok: true };
  }

  function cancelarAbono(db, id) {
    const f = db.abonos.find(r => r[CA.ID] === id);
    if (!f) return { ok: false, msg: 'Abono no encontrado' };
    const aid = str(f[CA.APART]);
    if (aid !== '') {
      if (f[CA.FORMA] === 'Vencimiento') return { ok: false, msg: 'Es el registro del vencimiento de un apartado: cancela el apartado completo' };
      const ap = apartados(db)[aid];
      if (ap && ap.estado !== 'Apartado') return { ok: false, msg: 'Ese apartado ya está ' + ap.estado.toLowerCase() + ': cancela el apartado completo' };
      quitar(db.abonos, r => r[CA.ID] === id);
      return { ok: true };
    }
    const tel = tel10(f[CA.TEL]);
    quitar(db.abonos, r => r[CA.ID] === id);
    reconstruirAbonosCredito(db, tel);
    return { ok: true };
  }

  function cancelarPago(db, id) {
    const p = db.pagos.find(r => r[CPG.ID] === id);
    if (!p) return { ok: false, msg: 'Pago no encontrado' };
    quitar(db.gastos, g => g[CG.ID] === p[CPG.GASTO] && p[CPG.GASTO] !== '');
    quitar(db.pagos, r => r[CPG.ID] === id);
    return { ok: true };
  }

  function cancelarGasto(db, id) {
    const g = db.gastos.find(r => r[CG.ID] === id);
    if (!g) return { ok: false, msg: 'Gasto no encontrado' };
    const pago = db.pagos.find(r => r[CPG.GASTO] === id);
    if (pago) return cancelarPago(db, pago[CPG.ID]); // un gasto de sueldos y su pago son el mismo registro
    quitar(db.gastos, r => r[CG.ID] === id);
    return { ok: true };
  }

  function cancelarEntrada(db, id) {
    const f = db.entradas.find(r => r[CE.ID] === id);
    if (!f) return { ok: false, msg: 'Compra no encontrada' };
    const cant = num(f[CE.CANT]);
    const p = mapaProd(db)[String(f[CE.CODIGO])];
    if (cant > 0 && p && num(p[CPR.DISP]) - cant < 0) return { ok: false, msg: 'Ya se vendieron piezas de esa compra; no se puede cancelar. Si el costo estaba mal, edítala.' };
    if (cant > 0) sumDisp(db, f[CE.CODIGO], -cant);
    quitar(db.entradas, r => r[CE.ID] === id);
    return { ok: true };
  }

  function cancelarCorte(db, id) {
    if (!db.cortes.some(r => r[CCT.ID] === id)) return { ok: false, msg: 'Corte no encontrado' };
    quitar(db.cortes, r => r[CCT.ID] === id);
    return { ok: true };
  }

  function cancelarProducto(db, codigo) {
    const c = String(codigo), p = mapaProd(db)[c];
    if (!p) return { ok: false, msg: 'Producto no encontrado' };
    if (db.ventas.some(f => f[CV.ID] !== '' && String(f[CV.CODIGO]) === c) || db.apartados.some(f => f[CP.ID] !== '' && String(f[CP.CODIGO]) === c))
      return { ok: false, msg: 'Este producto ya tiene ventas o apartados. Para quitarlo del catálogo, desactívalo (Activo = NO) y conservarás su historial.' };
    quitar(db.entradas, r => String(r[CE.CODIGO]) === c);
    quitar(db.productos, r => String(r[0]) === c);
    return { ok: true };
  }

  function cancelarCliente(db, telRaw) {
    const t = tel10(telRaw);
    const f = db.clientes.find(r => tel10(r[CC.TEL]) === t);
    if (!f) return { ok: false, msg: 'Cliente no encontrado' };
    if (db.ventas.some(r => r[CV.ID] !== '' && r[CV.PAGO] === 'Crédito' && tel10(r[CV.TEL]) === t) || db.abonos.some(r => r[CA.ID] !== '' && tel10(r[CA.TEL]) === t) || db.apartados.some(r => r[CP.ID] !== '' && tel10(r[CP.TEL]) === t))
      return { ok: false, msg: 'Este cliente ya tiene compras a crédito, abonos o apartados. Si ya no le quieres dar crédito, dalo de baja en Créditos.' };
    quitar(db.clientes, r => tel10(r[CC.TEL]) === t);
    return { ok: true };
  }

  const CANCELAR = { venta: cancelarVenta, abono: cancelarAbono, apartado: cancelarApartado, compra: cancelarEntrada, gasto: cancelarGasto, pago: cancelarPago,
    corte: cancelarCorte, producto: cancelarProducto, cliente: cancelarCliente };

  function opCancelar(db, op) {
    const a = op.args || {};
    const fn = CANCELAR[a.que];
    if (!fn) return { ok: false, msg: 'No sé cancelar eso' };
    const id = a.que === 'producto' || a.que === 'cliente' ? a.id : String(a.id || '');
    if (id === '' || id == null) return { ok: false, msg: 'Falta el registro a cancelar' };
    return fn(db, id);
  }
  const opEntradaAnular = (db, op) => cancelarEntrada(db, String((op.args || {}).id));
  const opGastoAnular = (db, op) => cancelarGasto(db, String((op.args || {}).id));
  const opPagoAnular = (db, op) => cancelarPago(db, String((op.args || {}).id));

  function opGasto(db, op) {
    const a = op.args || {}, st = sello(op);
    const concepto = String(a.concepto || '').trim(), monto = r2(num(a.monto));
    if (concepto.length < 2) return { ok: false, msg: 'Escribe el concepto del gasto' };
    if (!(monto > 0)) return { ok: false, msg: 'El monto debe ser mayor a $0' };
    const cat = String(a.cat || 'Otros').trim() || 'Otros';
    if (esSueldos(cat)) return { ok: false, msg: 'Los sueldos se pagan en Corte > Semanal, así se descuentan de lo que se le debe a cada empleado' };
    const lista = db.config.catGastos && db.config.catGastos.length ? db.config.catGastos : CAT_GASTOS_BASE;
    if (!lista.some(c => c.toLowerCase() === cat.toLowerCase())) return { ok: false, msg: 'Elige una categoría de la lista (nuevas categorías se agregan en Config)' };
    db.gastos.push([fechaArg(a.fecha, op), concepto, monto, sn(a.efectivo), cat, 'G' + st.tallo, String(a.notas || '')]);
    return { ok: true };
  }

  function opPago(db, op) {
    const a = op.args || {}, st = sello(op);
    const v = vendedorDe(db, a.vendedor);
    if (!v) return { ok: false, msg: 'Empleado no encontrado' };
    const monto = r2(num(a.monto));
    if (!(monto > 0)) return { ok: false, msg: 'El monto debe ser mayor a $0' };
    if (ABONO_FORMAS.indexOf(a.forma) < 0) return { ok: false, msg: 'El pago es en efectivo o transferencia' };
    if (!esFecha(a.semana)) return { ok: false, msg: 'Semana inválida' };
    const semana = lunesDe(a.semana), gid = 'G' + st.tallo;
    const concepto = 'Pago a ' + v.nombre + ' · semana del ' + semana.slice(8) + '/' + semana.slice(5, 7);
    db.gastos.push([op.f, concepto, monto, a.forma === 'Efectivo' ? 'SI' : 'NO', 'Sueldos', gid, String(a.nota || '')]);
    db.pagos.push(['PG' + st.tallo, op.f, st.hora, v.nombre, semana, monto, a.forma, String(a.nota || ''), gid]);
    return { ok: true };
  }

  function opCorte(db, op, ctx) {
    const a = op.args || {}, st = sello(op);
    const fecha = esFecha(a.fecha) ? a.fecha : op.f;
    const contado = r2(num(a.contado));
    if (a.contado === '' || a.contado == null || contado < 0) return { ok: false, msg: 'Escribe el efectivo que contaste' };
    const c = corteDiario(db, fecha, op.f);
    db.cortes.push(['C' + st.tallo, fecha, st.hora, ctx.usuario, c.esperado, contado, r2(contado - c.esperado), c.efectivo, c.transferencia, c.tarjeta, String(a.notas || '')]);
    return { ok: true, esperado: c.esperado, diferencia: r2(contado - c.esperado) };
  }

  function opCliente(db, op) {
    const a = op.args || {};
    const t = tel10(a.tel);
    if (t.length !== 10) return { ok: false, msg: 'Escribe los 10 dígitos del celular' };
    const nombre = String(a.nombre || '').trim();
    if (nombre.length < 3) return { ok: false, msg: 'Escribe el nombre completo del cliente' };
    const limite = r2(num(a.limite));
    if (limite < 0) return { ok: false, msg: 'El límite no puede ser negativo' };
    const activo = a.activo === false || String(a.activo).toUpperCase() === 'NO' ? 'NO' : 'SI';
    const f = db.clientes.find(r => tel10(r[CC.TEL]) === t);
    if (f) { f[CC.NOMBRE] = nombre; f[CC.LIMITE] = limite; f[CC.ACTIVO] = activo; }
    else db.clientes.push([t, nombre, limite, activo, 0, 0, 0, '', 0, 'Sin deuda']);
    recalcular(db, op.f);
    return { ok: true, tel: t };
  }

  /** Revisa y normaliza la configuración que manda el dueño. */
  function validarConfig(db, c) {
    const o = Object.assign({}, db.config);
    const entero = (v, min, max, def) => { const n = Math.floor(num(v)); return n >= min && n <= max ? n : def; };
    if (c.duenoNombre !== undefined) o.duenoNombre = String(c.duenoNombre).trim() || 'Dueño';
    if (c.duenoPass !== undefined) {
      o.duenoPass = String(c.duenoPass).trim();
      if (o.duenoPass.length < 6) return { ok: false, msg: 'La contraseña del dueño debe tener al menos 6 caracteres' };
    }
    if (c.plazoCredito !== undefined) o.plazoCredito = entero(c.plazoCredito, 1, 365, 40);
    if (c.plazoApartado !== undefined) o.plazoApartado = entero(c.plazoApartado, 1, 365, 30);
    if (c.avisoDias !== undefined) o.avisoDias = entero(c.avisoDias, 0, 60, 5);
    if (c.minApartado !== undefined) o.minApartado = pct(c.minApartado);
    if (c.comTarjeta !== undefined) o.comTarjeta = Math.min(0.5, pct(c.comTarjeta));
    if (c.catGastos !== undefined) {
      const vistas = {}, cs = [];
      for (const x of c.catGastos) {
        const n = String(x || '').replace(/[,;|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
        if (!n || vistas[n.toLowerCase()]) continue;
        vistas[n.toLowerCase()] = 1; cs.push(n);
      }
      if (!cs.some(x => esSueldos(x))) cs.unshift('Sueldos');
      if (cs.length > 30) return { ok: false, msg: 'Máximo 30 categorías de gasto' };
      // las categorías que ya tienen gastos registrados no se pierden
      db.gastos.forEach(g => { const k = String(g[CG.CAT] || '').trim(); if (k && !esSueldos(k) && !vistas[k.toLowerCase()]) { vistas[k.toLowerCase()] = 1; cs.push(k); } });
      o.catGastos = cs;
    }
    if (c.fondo !== undefined) o.fondo = Math.max(0, r2(num(c.fondo)));
    if (c.periodoMetas !== undefined) o.periodoMetas = String(c.periodoMetas).toLowerCase() === 'mes' ? 'Mes' : 'Semana';
    if (c.metas !== undefined) o.metas = (c.metas || []).slice(0, 5).map(m => ({ monto: Math.max(0, r2(num(m.monto))), premio: String(m.premio || '').trim() })).filter(m => m.monto > 0).sort((x, y) => x.monto - y.monto);
    if (c.vendedores !== undefined) {
      if (c.vendedores.length > 10) return { ok: false, msg: 'Máximo 10 vendedores' };
      const nombres = {}, pines = {};
      const vs = [];
      for (const v of c.vendedores) {
        const nombre = String(v.nombre || '').trim(), pin = String(v.pin || '').trim();
        if (!nombre) return { ok: false, msg: 'Falta el nombre de un vendedor' };
        if (nombre.toLowerCase() === o.duenoNombre.toLowerCase()) return { ok: false, msg: 'Un vendedor no puede llamarse igual que el dueño' };
        if (nombres[nombre.toLowerCase()]) return { ok: false, msg: 'Hay dos vendedores llamados ' + nombre };
        nombres[nombre.toLowerCase()] = 1;
        if (pin.length < 4) return { ok: false, msg: 'El PIN de ' + nombre + ' debe tener al menos 4 caracteres' };
        if (pines[pin] || pin === o.duenoPass) return { ok: false, msg: 'El PIN de ' + nombre + ' ya está en uso' };
        pines[pin] = 1;
        const alta = esFecha(v.alta) ? v.alta : '', baja = esFecha(v.baja) ? v.baja : '';
        vs.push({ nombre, pin, pct: pct(v.pct), base: v.base === 'Total' ? 'Total' : 'Utilidad', sueldo: Math.max(0, r2(num(v.sueldo))), alta, baja });
      }
      // Los vendedores que ya existían no se pueden borrar (su historial quedaría huérfano): solo se dan de baja.
      const faltan = db.config.vendedores.filter(v => !vs.some(x => x.nombre === v.nombre));
      if (faltan.length) return { ok: false, msg: 'No se puede borrar a ' + faltan[0].nombre + ': ponle fecha de baja' };
      o.vendedores = vs;
    } else if (c.duenoPass !== undefined && db.config.vendedores.some(v => v.pin === o.duenoPass)) {
      return { ok: false, msg: 'La contraseña del dueño no puede ser igual al PIN de un vendedor' };
    }
    if (c.codigos !== undefined) {
      const vistos = {}, cs = [];
      for (const k of c.codigos) {
        const codigo = String(k.codigo || '').trim().toUpperCase().replace(/\s+/g, '');
        if (!codigo) continue;
        if (vistos[codigo]) return { ok: false, msg: 'El código ' + codigo + ' está repetido' };
        vistos[codigo] = 1;
        const p = pct(k.pct);
        if (p <= 0) return { ok: false, msg: 'El código ' + codigo + ' necesita un porcentaje mayor a 0' };
        cs.push({ codigo, pct: p, activo: !(k.activo === false || String(k.activo).toUpperCase() === 'NO'), vence: esFecha(k.vence) ? k.vence : '', nota: String(k.nota || '').trim(),
          credito: k.credito === true || String(k.credito).toUpperCase() === 'SI' });
      }
      o.codigos = cs;
    }
    return { ok: true, config: o };
  }

  function opConfig(db, op) {
    const r = validarConfig(db, op.args || {});
    if (!r.ok) return r;
    db.config = r.config;
    return { ok: true };
  }

  /* ============================================================
   * 9. DESPACHO DE OPERACIONES
   * ============================================================ */
  const OPS = {
    venta: opVenta, credito: opCredito, abono: opAbono, apartado: opApartado, apartado_abono: opApartadoAbono,
    producto_alta: opProductoAlta, producto_edit: opProductoEdit, entrada: opEntrada, entrada_editar: opEntradaEditar, entrada_anular: opEntradaAnular, cancelar: opCancelar,
    gasto: opGasto, gasto_anular: opGastoAnular, pago: opPago, pago_anular: opPagoAnular, corte: opCorte, cliente: opCliente, config: opConfig
  };
  /** Operaciones que el vendedor puede guardar en la cola sin internet (el resto necesita consultar cuentas en el servidor). */
  const OFFLINE_VENDEDOR = { venta: 1 };

  /** ctx = { rol: 'dueno' | 'vendedor', usuario }. Cada operación valida todo ANTES de modificar la base. */
  function aplicar(db, op, ctx) {
    if (!op || !OPS[op.tipo]) return { ok: false, msg: 'Operación desconocida' };
    if (!esFecha(op.f) || !esHora(op.h)) return { ok: false, msg: 'Fecha de la operación inválida' };
    if (SOLO_DUENO[op.tipo] && ctx.rol !== 'dueno') return { ok: false, msg: 'No autorizado' };
    const vend = ctx.rol === 'dueno' ? { nombre: ctx.usuario, pct: 0, base: 'Utilidad' } : vendedorDe(db, ctx.usuario);
    if (!vend) return { ok: false, msg: 'Vendedor no encontrado' };
    const r = OPS[op.tipo](db, op, Object.assign({}, ctx, { vend }));
    if (r.ok && op.tipo !== 'config') recalcular(db, op.f);
    return r;
  }

  /** Igual que aplicar, pero si algo truena a la mitad deja la base como estaba. */
  function aplicarSeguro(db, op, ctx) {
    const copia = JSON.stringify(db);
    try { return aplicar(db, op, ctx); }
    catch (e) {
      const prev = JSON.parse(copia);
      Object.keys(db).forEach(k => { delete db[k]; });
      Object.assign(db, prev);
      return { ok: false, msg: 'Error interno: ' + (e && e.message ? e.message : e) };
    }
  }

  /* ============================================================
   * 10. CONSULTAS Y REPORTES (solo leen)
   * ============================================================ */
  function inventario(db) {
    const ent = {}, comp = {}, ven = {}, por = {}, apa = {};
    db.entradas.forEach(r => { const c = str(r[CE.CODIGO]); if (c === '') return; ent[c] = (ent[c] || 0) + num(r[CE.CANT]); comp[c] = r2((comp[c] || 0) + num(r[CE.TOTAL])); });
    db.ventas.forEach(r => {
      if (r[CV.ID] === '') return;
      const c = str(r[CV.CODIGO]);
      if (r[CV.ESTADO] === 'Por pagar') por[c] = (por[c] || 0) + num(r[CV.CANT]); else ven[c] = (ven[c] || 0) + num(r[CV.CANT]);
    });
    db.apartados.forEach(r => { if (r[CP.ID] === '' || r[CP.ESTADO] !== 'Apartado') return; const c = str(r[CP.CODIGO]); apa[c] = (apa[c] || 0) + num(r[CP.CANT]); });
    return db.productos.filter(r => r[0] !== '' && r[0] != null).map(r => {
      const c = String(r[0]), stock = num(r[CPR.STOCK]);
      const existencia = stock + (ent[c] || 0) - (ven[c] || 0) - (por[c] || 0) - (apa[c] || 0);
      const min = num(r[CPR.MIN]), costo = num(r[CPR.COSTO]), precio = num(r[CPR.PRECIO]);
      return { codigo: c, nombre: str(r[CPR.NOMBRE]), cat: str(r[CPR.CAT]), talla: str(r[CPR.TALLA]), color: str(r[CPR.COLOR]), texto: textoProd(r),
        costo, precio, stockInicial: stock, entradas: ent[c] || 0, vendido: ven[c] || 0, porPagar: por[c] || 0, apartado: apa[c] || 0,
        existencia, min, estado: existencia <= 0 ? 'AGOTADO' : (existencia <= min ? 'BAJO' : 'OK'), activo: activoProd(r),
        valorCosto: r2(Math.max(0, existencia) * costo), valorPrecio: r2(Math.max(0, existencia) * precio), comprado: comp[c] || 0 };
    });
  }

  /** Semanas (lunes) con movimiento de nómina de un empleado, hasta la semana de hoy. */
  function semanasNomina(db, v, hoy) {
    const set = {}, tope = lunesDe(hoy);
    db.ventas.forEach(r => { if (r[CV.VENDEDOR] === v.nombre && r[CV.SEMANA] && num(r[CV.COM]) > 0) set[r[CV.SEMANA]] = 1; });
    db.pagos.forEach(r => { if (r[CPG.VENDEDOR] === v.nombre && r[CPG.SEMANA]) set[r[CPG.SEMANA]] = 1; });
    if (num(v.sueldo) > 0) {
      let w = v.alta ? lunesDe(v.alta) : tope;
      const fin = v.baja ? lunesDe(v.baja) : tope;
      while (w <= fin && w <= tope) { set[w] = 1; w = sumaDias(w, 7); }
    }
    return Object.keys(set).sort();
  }

  /** Lo que se le debe a un empleado en una semana: sueldo fijo + comisiones − lo ya pagado. */
  function nominaSemana(db, v, lunes, hoy) {
    const sueldo = sueldoActivo(v, lunes, hoy);
    let comision = 0, pagado = 0;
    db.ventas.forEach(r => { if (r[CV.VENDEDOR] === v.nombre && r[CV.SEMANA] === lunes) comision += num(r[CV.COM]); });
    const pagos = db.pagos.filter(r => r[CPG.VENDEDOR] === v.nombre && r[CPG.SEMANA] === lunes);
    pagos.forEach(r => { pagado += num(r[CPG.MONTO]); });
    comision = r2(comision); pagado = r2(pagado);
    return { semana: lunes, sueldo, comision, devengado: r2(sueldo + comision), pagado, pendiente: r2(sueldo + comision - pagado),
      pagos: pagos.map(r => ({ id: r[CPG.ID], fecha: r[CPG.FECHA], monto: num(r[CPG.MONTO]), forma: r[CPG.FORMA], nota: str(r[CPG.NOTA]) })) };
  }

  /** Nómina de la semana de cada empleado + semanas anteriores con saldo pendiente. */
  function nomina(db, lunes, hoy) {
    return db.config.vendedores.map(v => {
      const s = nominaSemana(db, v, lunes, hoy);
      const atrasadas = semanasNomina(db, v, hoy).filter(w => w < lunes).map(w => nominaSemana(db, v, w, hoy)).filter(x => Math.abs(x.pendiente) > 0.004);
      const pendienteTotal = r2(s.pendiente + atrasadas.reduce((a, x) => a + x.pendiente, 0));
      return Object.assign({ nombre: v.nombre, pct: v.pct, base: v.base, atrasadas, pendienteTotal, baja: v.baja }, s);
    });
  }

  /** Sueldo fijo que corre en una semana (lunes) para un empleado, según su fecha de alta y baja. */
  function sueldoActivo(v, lunes, hoy) {
    const tope = lunesDe(hoy);
    return num(v.sueldo) > 0 && lunes <= tope && lunes >= (v.alta ? lunesDe(v.alta) : tope) && (!v.baja || lunes <= lunesDe(v.baja)) ? num(v.sueldo) : 0;
  }

  /** Sueldo fijo devengado por UN empleado en el periodo (1/7 del sueldo semanal por día, hasta hoy). */
  function devengadoEmpleado(v, ini, fin, hoy) {
    const tope = hoy || fin, f2 = fin > tope ? tope : fin;
    if (f2 < ini || !(num(v.sueldo) > 0)) return 0;
    let sueldos = 0;
    for (let w = lunesDe(ini); w <= f2; w = sumaDias(w, 7)) {
      const a = w < ini ? ini : w, fw = sumaDias(w, 6), b = fw > f2 ? f2 : fw;
      const dias = difDias(b, a) + 1;
      if (dias > 0) sueldos += sueldoActivo(v, w, tope) * dias / 7;
    }
    return r2(sueldos);
  }

  /** Sueldos fijos devengados en el periodo por todos los empleados. */
  function devengadoNomina(db, ini, fin, hoy) {
    let t = 0;
    db.config.vendedores.forEach(v => { t += devengadoEmpleado(v, ini, fin, hoy); });
    return r2(t);
  }

  /** Todo lo que pasó entre dos fechas (inclusive). La utilidad cuenta solo lo cobrado (contado + abonos). */
  function periodo(db, ini, fin, hoy) {
    const en = f => f >= ini && f <= fin;
    const o = { tickets: 0, articulos: 0, contado: 0, apartLiq: 0, credito: 0, abonos: 0, util: 0, gastosOp: 0, nominaPagada: 0, comisiones: 0,
      descuentos: 0, tarjeta: 0, reinversion: 0, porPago: {}, abonosPorForma: {}, porVendedor: {}, productos: {}, gastosPorConcepto: {}, porCategoria: {} };
    const ids = {};
    db.ventas.forEach(f => {
      if (f[CV.ID] === '' || !en(f[CV.FECHA])) return;
      ids[f[CV.ID]] = 1;
      const total = num(f[CV.TOTAL]), cant = num(f[CV.CANT]), pg = f[CV.PAGO], vend = f[CV.VENDEDOR];
      o.articulos += cant;
      if (pg === 'Crédito') o.credito += total;
      else if (pg === 'Apartado') o.apartLiq += total;
      else { o.contado += total; o.util += num(f[CV.UTIL]); o.porPago[pg] = r2((o.porPago[pg] || 0) + num(f[CV.COBRADO])); }
      o.comisiones += num(f[CV.COM]); o.descuentos += num(f[CV.DESC]); o.tarjeta += num(f[CV.COM_TARJ]);
      const k = f[CV.PRODUCTO], pr = o.productos[k] || (o.productos[k] = { producto: k, piezas: 0, ventas: 0, util: 0 });
      pr.piezas += cant; pr.ventas += total; pr.util += num(f[CV.UTIL]);
      const vv = o.porVendedor[vend] || (o.porVendedor[vend] = { vendedor: vend, vendido: 0, credito: 0, abonos: 0, comision: 0 });
      vv.vendido += total; vv.comision += num(f[CV.COM]); if (pg === 'Crédito') vv.credito += total;
    });
    o.tickets = Object.keys(ids).length;
    db.abonos.forEach(f => {
      if (f[CA.ID] === '' || !en(f[CA.FECHA])) return;
      o.abonos += num(f[CA.MONTO]); o.util += num(f[CA.UTIL]);
      const fm = f[CA.FORMA];
      if (num(f[CA.MONTO]) > 0) o.abonosPorForma[fm] = r2((o.abonosPorForma[fm] || 0) + num(f[CA.MONTO]));
      const vv = o.porVendedor[f[CA.VENDEDOR]] || (o.porVendedor[f[CA.VENDEDOR]] = { vendedor: f[CA.VENDEDOR], vendido: 0, credito: 0, abonos: 0, comision: 0 });
      vv.abonos += num(f[CA.MONTO]);
    });
    db.gastos.forEach(g => {
      if (g[CG.FECHA] === '' || !en(g[CG.FECHA]) || num(g[CG.MONTO]) <= 0) return;
      const m = num(g[CG.MONTO]);
      if (esSueldos(g[CG.CAT])) o.nominaPagada += m; else { o.gastosOp += m; o.gastosPorConcepto[g[CG.CONCEPTO]] = r2((o.gastosPorConcepto[g[CG.CONCEPTO]] || 0) + m); }
      const cat = esSueldos(g[CG.CAT]) ? 'Sueldos' : (g[CG.CAT] || 'Otros');
      o.porCategoria[cat] = r2((o.porCategoria[cat] || 0) + m);
    });
    db.entradas.forEach(e => { if (e[CE.FECHA] !== '' && en(e[CE.FECHA])) o.reinversion += num(e[CE.TOTAL]); });
    o.sueldos = devengadoNomina(db, ini, fin, hoy || fin);
    ['tickets', 'articulos', 'contado', 'apartLiq', 'credito', 'abonos', 'util', 'gastosOp', 'nominaPagada', 'comisiones', 'descuentos', 'tarjeta', 'reinversion'].forEach(k => { o[k] = r2(o[k]); });
    o.cobrado = r2(o.contado + o.abonos);
    o.vendido = r2(o.contado + o.credito + o.apartLiq);
    o.nominaDevengada = r2(o.comisiones + o.sueldos);
    o.utilNeta = r2(o.util - o.gastosOp - o.nominaDevengada);
    o.ticketPromedio = o.tickets ? r2(o.vendido / o.tickets) : 0;
    o.productosTop = Object.keys(o.productos).map(k => o.productos[k]).sort((a, b) => b.piezas - a.piezas).slice(0, 15)
      .map(x => ({ producto: x.producto, piezas: x.piezas, ventas: r2(x.ventas), util: r2(x.util) }));
    o.vendedores = Object.keys(o.porVendedor).map(k => o.porVendedor[k]).map(x => ({ vendedor: x.vendedor, vendido: r2(x.vendido), credito: r2(x.credito), abonos: r2(x.abonos), comision: r2(x.comision) }));
    o.gastosLista = Object.keys(o.gastosPorConcepto).map(k => ({ concepto: k, monto: o.gastosPorConcepto[k] })).sort((a, b) => b.monto - a.monto);
    delete o.productos; delete o.porVendedor; delete o.gastosPorConcepto;
    return o;
  }

  /**
   * Resumen de cada vendedor en un periodo: ventas, utilidad generada, comisión, formas de pago, productos, serie para la gráfica y registro de tickets.
   * Solo lo usa el dueño (necesita costos y utilidad). Incluye al dueño y a vendedores dados de baja si vendieron en el periodo.
   */
  function resumenVendedores(db, ini, fin, hoy) {
    const en = f => f >= ini && f <= fin;
    const mensual = difDias(fin, ini) > 70;
    const llave = f => (mensual ? String(f).slice(0, 7) : f);
    const V = {};
    const nuevo = n => ({ vendedor: n, tickets: {}, articulos: 0, vendido: 0, contado: 0, credito: 0, apartLiq: 0, util: 0, comision: 0, descuentos: 0, abonos: 0,
      porPago: {}, productos: {}, dias: {}, lista: {} });
    const get = n => V[n] || (V[n] = nuevo(n));
    db.config.vendedores.forEach(v => { if (!v.baja || v.baja >= ini) get(v.nombre); });
    db.ventas.forEach(f => {
      if (f[CV.ID] === '' || !en(f[CV.FECHA])) return;
      const v = get(f[CV.VENDEDOR]), total = num(f[CV.TOTAL]), cant = num(f[CV.CANT]), pg = f[CV.PAGO];
      v.tickets[f[CV.ID]] = 1; v.articulos += cant; v.vendido += total; v.util += num(f[CV.UTIL]); v.comision += num(f[CV.COM]); v.descuentos += num(f[CV.DESC]);
      if (pg === 'Crédito') v.credito += total; else if (pg === 'Apartado') v.apartLiq += total; else v.contado += total;
      v.porPago[pg] = r2((v.porPago[pg] || 0) + total);
      const pr = v.productos[f[CV.PRODUCTO]] || (v.productos[f[CV.PRODUCTO]] = { producto: f[CV.PRODUCTO], piezas: 0, ventas: 0 });
      pr.piezas += cant; pr.ventas += total;
      const k = llave(f[CV.FECHA]); v.dias[k] = (v.dias[k] || 0) + total;
      const t = v.lista[f[CV.ID]] || (v.lista[f[CV.ID]] = { id: f[CV.ID], fecha: f[CV.FECHA], hora: f[CV.HORA], pago: pg, total: 0, util: 0, comision: 0, descuento: 0, items: [] });
      t.total = r2(t.total + total); t.util = r2(t.util + num(f[CV.UTIL])); t.comision = r2(t.comision + num(f[CV.COM])); t.descuento = r2(t.descuento + num(f[CV.DESC]));
      t.items.push(f[CV.PRODUCTO] + ' ×' + cant);
    });
    db.abonos.forEach(f => { if (f[CA.ID] !== '' && en(f[CA.FECHA]) && num(f[CA.MONTO]) > 0 && f[CA.VENDEDOR] !== '') get(f[CA.VENDEDOR]).abonos += num(f[CA.MONTO]); });
    const claves = [];
    for (let a = mensual ? iniMes(ini) : ini; a <= fin && claves.length < 400; a = mensual ? sumaDias(finMes(a), 1) : sumaDias(a, 1)) claves.push(mensual ? a.slice(0, 7) : a);
    const nom = {};
    nomina(db, lunesDe(hoy), hoy).forEach(x => { nom[x.nombre] = x; });
    const lista = Object.keys(V).map(n => {
      const v = V[n], cfg = vendedorDe(db, n), tk = Object.keys(v.tickets).length;
      const pagado = r2(db.pagos.filter(r => r[CPG.VENDEDOR] === n && en(r[CPG.FECHA])).reduce((x, r) => x + num(r[CPG.MONTO]), 0));
      const sueldo = cfg ? devengadoEmpleado(cfg, ini, fin, hoy) : 0;
      const mejorDia = Object.keys(v.dias).sort((a, b) => v.dias[b] - v.dias[a])[0];
      return { vendedor: n, esDueno: !cfg, baja: cfg ? cfg.baja : '', pct: cfg ? cfg.pct : 0, base: cfg ? cfg.base : '', tickets: tk, articulos: v.articulos, vendido: r2(v.vendido), contado: r2(v.contado),
        credito: r2(v.credito), apartLiq: r2(v.apartLiq), util: r2(v.util), comision: r2(v.comision), descuentos: r2(v.descuentos), abonos: r2(v.abonos),
        ticketPromedio: tk ? r2(v.vendido / tk) : 0, margen: v.vendido > 0 ? Math.round(v.util / v.vendido * 1000) / 1000 : 0,
        sueldo, devengado: r2(sueldo + v.comision), pagado, pendienteHoy: nom[n] ? nom[n].pendienteTotal : 0,
        mejorDia: mejorDia ? { clave: mejorDia, vendido: r2(v.dias[mejorDia]) } : null,
        porPago: v.porPago, productos: Object.keys(v.productos).map(k => v.productos[k]).sort((a, b) => b.piezas - a.piezas).slice(0, 8).map(x => ({ producto: x.producto, piezas: x.piezas, ventas: r2(x.ventas) })),
        serie: claves.map(k => ({ clave: k, vendido: r2(v.dias[k] || 0) })),
        ventas: Object.keys(v.lista).map(k => v.lista[k]).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)) };
    }).sort((a, b) => b.vendido - a.vendido || a.vendedor.localeCompare(b.vendedor));
    const conVentas = lista.filter(x => x.vendido > 0);
    const mejor = conVentas.length ? conVentas[0] : null;
    const mejorUtil = conVentas.length ? conVentas.slice().sort((a, b) => b.util - a.util)[0] : null;
    const total = r2(lista.reduce((x, v) => x + v.vendido, 0));
    return { ini, fin, mensual, claves, vendedores: lista, mejor: mejor ? mejor.vendedor : '', mejorUtil: mejorUtil ? mejorUtil.vendedor : '', total };
  }

  /** Serie para gráficas: paso = 'dia' | 'semana' | 'mes'. */
  function serie(db, ini, fin, paso, hoy) {
    const out = [];
    let a = ini;
    while (a <= fin && out.length < 400) {
      const b = paso === 'dia' ? a : paso === 'semana' ? sumaDias(a, 6) : finMes(a);
      const p = periodo(db, a, b > fin ? fin : b, hoy);
      out.push({ ini: a, fin: b, cobrado: p.cobrado, vendido: p.vendido, util: p.util, neto: p.utilNeta, gastos: r2(p.gastosOp + p.nominaPagada), reinversion: p.reinversion });
      a = paso === 'dia' ? sumaDias(a, 1) : paso === 'semana' ? sumaDias(a, 7) : sumaDias(finMes(a), 1);
    }
    return out;
  }

  /** Corte de caja de un día. */
  function corteDiario(db, fecha, hoy) {
    const formas = db.config.formas.filter(f => !/cr[eé]dito|apartado/i.test(f));
    const vf = {}, af = {};
    formas.forEach(f => { vf[f] = 0; af[f] = 0; });
    const tk = {}, abonos = [];
    db.ventas.forEach(r => {
      if (r[CV.ID] === '' || r[CV.FECHA] !== fecha) return;
      const pg = r[CV.PAGO];
      if (pg in vf) vf[pg] = r2(vf[pg] + num(r[CV.COBRADO]));
      const t = tk[r[CV.ID]] || (tk[r[CV.ID]] = { id: r[CV.ID], hora: r[CV.HORA], total: 0, pago: pg, vendedor: r[CV.VENDEDOR], items: [] });
      t.total = r2(t.total + num(r[CV.TOTAL])); t.items.push(r[CV.PRODUCTO] + ' ×' + r[CV.CANT]);
    });
    db.abonos.forEach(r => {
      if (r[CA.ID] === '' || r[CA.FECHA] !== fecha || !(num(r[CA.MONTO]) > 0)) return;
      if (r[CA.FORMA] in af) af[r[CA.FORMA]] = r2(af[r[CA.FORMA]] + num(r[CA.MONTO]));
      abonos.push({ hora: r[CA.HORA], cliente: r[CA.CLIENTE], monto: num(r[CA.MONTO]), forma: r[CA.FORMA], vendedor: r[CA.VENDEDOR], apartado: str(r[CA.APART]) !== '' });
    });
    let gastosEfectivo = 0, comprasEfectivo = 0;
    db.gastos.forEach(g => { if (g[CG.FECHA] === fecha && g[CG.EFECTIVO] === 'SI') gastosEfectivo += num(g[CG.MONTO]); });
    db.entradas.forEach(e => { if (e[CE.FECHA] === fecha && e[CE.EFECTIVO] === 'SI') comprasEfectivo += num(e[CE.TOTAL]); });
    gastosEfectivo = r2(gastosEfectivo); comprasEfectivo = r2(comprasEfectivo);
    const fondo = num(db.config.fondo);
    const efectivo = r2((vf.Efectivo || 0) + (af.Efectivo || 0));
    const esperado = r2(fondo + efectivo - gastosEfectivo - comprasEfectivo);
    const guardados = db.cortes.filter(c => c[CCT.FECHA] === fecha);
    const ultimo = guardados.length ? guardados[guardados.length - 1] : null;
    return { fecha, formas, ventas: vf, abonosForma: af, efectivo, transferencia: r2((vf.Transferencia || 0) + (af.Transferencia || 0)),
      tarjeta: r2(vf.Tarjeta || 0), totalCobrado: r2(formas.reduce((x, f) => x + vf[f] + af[f], 0)), fondo, gastosEfectivo, comprasEfectivo, esperado,
      tickets: Object.keys(tk).map(k => tk[k]).sort((a, b) => String(a.hora).localeCompare(String(b.hora))), abonos: abonos.sort((a, b) => String(a.hora).localeCompare(String(b.hora))),
      periodo: periodo(db, fecha, fecha, hoy || fecha),
      corte: ultimo ? { hora: ultimo[CCT.HORA], usuario: ultimo[CCT.USUARIO], esperado: num(ultimo[CCT.ESPERADO]), contado: num(ultimo[CCT.CONTADO]), dif: num(ultimo[CCT.DIF]), notas: str(ultimo[CCT.NOTAS]) } : null };
  }

  const estadoCredito = (dias, aviso) => (dias < 0 ? 'Vencido' : (dias <= aviso ? 'Por vencer' : 'Vigente'));

  /** Lista de clientes con crédito (para el dueño). */
  function listaCreditos(db, hoy) {
    const cli = creditos(db, hoy), aviso = num(db.config.avisoDias);
    const out = db.clientes.filter(f => f[CC.TEL] !== '' && f[CC.TEL] != null).map(f => {
      const t = tel10(f[CC.TEL]), c = cli[t] || { compras: [], abonos: [], total: 0, pagado: 0, saldo: 0 };
      const pend = c.compras.filter(p => p.saldo > 0);
      const prox = pend.length ? pend.map(p => p.limite).sort()[0] : '';
      const dias = prox ? difDias(prox, hoy) : null;
      return { tel: t, nombre: str(f[CC.NOMBRE]), limite: num(f[CC.LIMITE]), activo: str(f[CC.ACTIVO]).trim().toUpperCase() !== 'NO',
        total: c.total, pagado: c.pagado, saldo: c.saldo, prox, dias, estado: c.saldo <= 0 ? 'Sin deuda' : estadoCredito(dias, aviso),
        disponible: Math.max(0, r2(num(f[CC.LIMITE]) - c.saldo)),
        compras: c.compras.map(p => ({ id: p.id, fecha: p.fecha, limite: p.limite, total: p.total, pagado: p.pagado, saldo: p.saldo, estado: p.estado, items: p.items.join(', '),
          dias: p.saldo > 0 ? difDias(p.limite, hoy) : null })).reverse(),
        abonos: c.abonos.slice().reverse() };
    });
    const orden = { 'Vencido': 0, 'Por vencer': 1, 'Vigente': 2, 'Sin deuda': 3 };
    return out.sort((a, b) => orden[a.estado] - orden[b.estado] || (a.dias === null ? 1e9 : a.dias) - (b.dias === null ? 1e9 : b.dias) || a.nombre.localeCompare(b.nombre));
  }

  /** Lista de apartados con días restantes. */
  function listaApartados(db, hoy) {
    const aviso = num(db.config.avisoDias);
    return Object.values(apartados(db)).map(a => {
      const abierto = a.estado === 'Apartado';
      const dias = abierto && a.limite ? difDias(a.limite, hoy) : null;
      return { id: a.id, tel: a.tel, cliente: a.cliente, vendedor: a.vendedor, fecha: a.fecha, limite: a.limite, total: a.total, pagado: a.pagado, saldo: a.saldo,
        estado: a.estado, cierre: a.cierre, dias, alerta: abierto ? (dias < 0 ? 'Vencido' : (dias <= aviso ? 'Por vencer' : '')) : '',
        items: a.lineas.map(f => f[CP.PRODUCTO] + ' ×' + f[CP.CANT]).join(', ') };
    }).sort((a, b) => (a.estado === 'Apartado' ? 0 : 1) - (b.estado === 'Apartado' ? 0 : 1) || (a.dias === null ? 1e9 : a.dias) - (b.dias === null ? 1e9 : b.dias) || String(b.fecha).localeCompare(String(a.fecha)));
  }

  /** Avisos de vencimiento: créditos y apartados que vencen en los próximos N días (o ya vencieron). */
  function avisos(db, hoy) {
    const dias = num(db.config.avisoDias);
    const cr = listaCreditos(db, hoy).filter(c => c.saldo > 0 && c.dias !== null && c.dias <= dias)
      .map(c => ({ tel: c.tel, nombre: c.nombre, limite: c.prox, dias: c.dias, saldo: c.saldo }));
    const ap = listaApartados(db, hoy).filter(a => a.estado === 'Apartado' && a.saldo > 0 && a.dias !== null && a.dias <= dias)
      .map(a => ({ id: a.id, tel: a.tel, nombre: a.cliente, limite: a.limite, dias: a.dias, saldo: a.saldo }));
    return { creditos: cr, apartados: ap };
  }

  /** Cuenta que ve el VENDEDOR. Solo avisa si el límite ya se alcanzó; nunca muestra el crédito disponible. */
  function cuentaCliente(db, telRaw, hoy, monto) {
    const cl = clienteActivo(db, telRaw);
    if (!cl) return { ok: false, msg: 'No hay una cuenta con ese número' };
    const c = creditos(db, hoy)[cl.tel] || { compras: [], abonos: [], total: 0, pagado: 0, saldo: 0 };
    return { ok: true, tel: cl.tel, nombre: cl.nombre, total: c.total, pagado: c.pagado, adeudado: c.saldo, bloqueado: c.saldo >= cl.limite, alcanza: monto === undefined ? undefined : r2(c.saldo + num(monto)) <= cl.limite,
      compras: c.compras.map(p => ({ fecha: p.fecha, limite: p.limite, total: p.total, pagado: p.pagado, saldo: p.saldo, estado: p.estado, items: p.items.join(', ') })).reverse(),
      abonos: c.abonos.map(a => ({ fecha: a.fecha, monto: a.monto, forma: a.forma })).reverse() };
  }

  function cuentaApartados(db, telRaw) {
    const t = tel10(telRaw);
    if (t.length !== 10) return { ok: false, msg: 'Escribe los 10 dígitos del celular' };
    const lista = Object.values(apartados(db)).filter(a => a.tel === t);
    const cl = clienteActivo(db, t);
    const nombre = cl ? cl.nombre : (lista.length ? lista[0].cliente : '');
    return { ok: true, tel: t, nombre, conocido: !!nombre, plazo: num(db.config.plazoApartado) || 30, minPct: minApartado(db),
      apartados: lista.map(a => ({ id: a.id, fecha: a.fecha, limite: a.limite, total: a.total, pagado: a.pagado, saldo: a.saldo, estado: a.estado,
        items: a.lineas.map(f => f[CP.PRODUCTO] + ' ×' + f[CP.CANT]).join(', ') })).reverse() };
  }

  /** Avance del vendedor hacia las metas (ventas del periodo, contado y crédito). */
  function meta(db, usuario, hoy) {
    const mes = String(db.config.periodoMetas).toLowerCase() === 'mes';
    const metas = (db.config.metas || []).filter(m => num(m.monto) > 0).map(m => ({ monto: num(m.monto), premio: str(m.premio) }));
    const ini = mes ? iniMes(hoy) : lunesDe(hoy);
    let vendido = 0;
    db.ventas.forEach(f => { if (f[CV.ID] !== '' && f[CV.VENDEDOR] === usuario && f[CV.FECHA] >= ini) vendido += num(f[CV.TOTAL]); });
    return { periodo: mes ? 'mes' : 'semana', vendido: r2(vendido), metas };
  }

  /** Pestaña "Mis comisiones": solo comisión por ticket, nunca costos ni utilidad. */
  function misComisiones(db, usuario, hoy) {
    const lunes = lunesDe(hoy), anio = hoy.slice(0, 4);
    const meses = Array.from({ length: 12 }, () => ({ v: 0, c: 0 }));
    const tickets = {};
    let semana = 0;
    db.ventas.forEach(f => {
      if (f[CV.ID] === '' || f[CV.VENDEDOR] !== usuario) return;
      const com = f[CV.COM] === null || f[CV.COM] === '' ? 0 : num(f[CV.COM]);
      if (String(f[CV.FECHA]).slice(0, 4) === anio) { const m = Number(String(f[CV.FECHA]).slice(5, 7)) - 1; meses[m].v += num(f[CV.TOTAL]); meses[m].c += com; }
      if (f[CV.FECHA] >= lunes) {
        semana += com;
        const t = tickets[f[CV.ID]] || (tickets[f[CV.ID]] = { id: f[CV.ID], fecha: f[CV.FECHA], total: 0, comision: 0, pendiente: false, credito: f[CV.PAGO] === 'Crédito', apartado: f[CV.PAGO] === 'Apartado' });
        t.total = r2(t.total + num(f[CV.TOTAL])); t.comision = r2(t.comision + com);
        if (f[CV.COM] === null || f[CV.COM] === '') t.pendiente = true;
      }
    });
    return { semana: r2(semana), tickets: Object.keys(tickets).map(k => tickets[k]).reverse(), meses: meses.map(m => ({ v: r2(m.v), c: r2(m.c) })),
      mesActual: Number(hoy.slice(5, 7)) - 1, meta: meta(db, usuario, hoy) };
  }

  /* ============================================================
   * 11. FOTOS (SNAPSHOTS) QUE EL SERVIDOR ENTREGA A CADA ROL
   * ============================================================ */
  function snapshotDueno(db, hoy) {
    return { rol: 'dueno', usuario: db.config.duenoNombre, hoy,
      db: { productos: db.productos, entradas: db.entradas, ventas: db.ventas, abonos: db.abonos, apartados: db.apartados, clientes: db.clientes,
        gastos: db.gastos, pagos: db.pagos, cortes: db.cortes, config: db.config }, avisos: avisos(db, hoy) };
  }

  /** El vendedor NUNCA recibe costos, utilidad, gastos, otros vendedores, nombres de códigos de descuento ni PINs. */
  function snapshotVendedor(db, usuario, hoy) {
    const v = vendedorDe(db, usuario);
    const productos = db.productos.filter(r => r[0] !== '' && activoProd(r)).map(r => [r[0], r[1], r[2], r[3], r[4], null, r[6], 0, r[8], 'SI', num(r[CPR.DISP])]);
    const anio = hoy.slice(0, 4) + '-01-01';
    const ventas = db.ventas.filter(f => f[CV.ID] !== '' && f[CV.VENDEDOR] === usuario && f[CV.FECHA] >= anio)
      .map(f => { const c = f.slice(); c[CV.COSTO] = null; c[CV.UTIL] = null; c[CV.TEL] = ''; return c; });
    const cf = db.config;
    const config = { formas: cf.formas, plazoCredito: cf.plazoCredito, plazoApartado: cf.plazoApartado, minApartado: cf.minApartado, comTarjeta: cf.comTarjeta,
      periodoMetas: cf.periodoMetas, metas: cf.metas, avisoDias: cf.avisoDias, duenoNombre: '', duenoPass: '',
      vendedores: v ? [{ nombre: v.nombre, pct: v.pct, base: v.base }] : [],
      codigos: cf.codigos.filter(c => c.activo !== false).map(c => ({ h: sha256(String(c.codigo).toUpperCase()), pct: c.pct, vence: c.vence, activo: true, credito: c.credito === true })) };
    const av = avisos(db, hoy);
    av.creditos = av.creditos.map(x => ({ nombre: x.nombre, limite: x.limite, dias: x.dias, saldo: x.saldo }));
    av.apartados = av.apartados.map(x => ({ nombre: x.nombre, limite: x.limite, dias: x.dias, saldo: x.saldo }));
    return { rol: 'vendedor', usuario, hoy, db: Object.assign(nuevaDb(), { productos, ventas, config }), avisos: av };
  }

  return { CV, CA, CP, CPR, CE, CC, CG, CPG, CCT, TABLAS, ABONO_FORMAS, OFFLINE_VENDEDOR, SOLO_DUENO,
    r2, num, nn, tel10, pct, str, esFecha, esHora, sumaDias, difDias, lunesDe, iniMes, finMes, sha256,
    configBase, nuevaDb, normalizar, textoProd, activoProd, mapaProd, vendedorDe, clienteActivo, codigoInfo,
    recomputeDisp, recalcular, creditos, apartados, sincronizarApartados, revisarApartados, aplicar, aplicarSeguro, validarConfig,
    inventario, periodo, serie, resumenVendedores, corteDiario, nomina, nominaSemana, semanasNomina, listaCreditos, listaApartados, avisos,
    cuentaCliente, cuentaApartados, meta, misComisiones, snapshotDueno, snapshotVendedor, minApartado, esSueldos, CAT_GASTOS_BASE };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HOOD;
