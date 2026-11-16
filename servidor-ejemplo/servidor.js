/* Servidor de EJEMPLO para probar la conexión de la página (no es el servidor final).
   Muestra exactamente qué rutas usa la página y qué JSON espera. Sin dependencias: solo Node.js 18+.
     node servidor.js            -> http://localhost:3000/api
   Los datos se guardan en datos.json junto a este archivo.
   En el servidor real: MySQL en lugar de datos.json, bcrypt en lugar de scrypt, HTTPS, y la blockchain del equipo. */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const PORT = +process.env.PORT || 3000;
const ADMIN_CODE = process.env.ADMIN_CODE || 'LOMBRI-2026';
const FILE = path.join(__dirname, 'datos.json');
const PRESENTACIONES = [5, 25, 50];   // kg por unidad que se venden
const SEED = [
  ['LF-2025-001', 'Lombriferti (fertilizante)', 50, '2025-09-21', 550, 12, 'Fertilizante orgánico a base de composta.'],
  ['LF-2025-002', 'Lombriferti (fertilizante)', 50, '2025-09-21', 550, 8, ''],
  ['LF-2025-007', 'Lombriferti (fertilizante)', 25, '2025-09-25', 300, 6, 'Presentación grande para huertos y jardines.'],
  ['LF-2025-010', 'Lombriferti (fertilizante)', 5, '2025-09-28', 75, 15, 'Presentación chica para macetas y plantas de casa.'],
].map(([codigo, tipo, kgPorUnidad, fechaProduccion, precio, stock, descripcion]) => ({ codigo, tipo, kgPorUnidad, fechaProduccion, precio, stock, descripcion, fotoUrl: null, loteOrigen: null }));

let db = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { usuarios: [], lotes: SEED, pedidos: [], recuperaciones: {} };
const guardar = () => fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
const sesiones = new Map();   // token -> id de usuario (en el servidor real: JWT o tabla de sesiones)

const hoy = () => new Date().toISOString().slice(0, 10);
const hash = (pass, sal = crypto.randomBytes(16).toString('hex')) => sal + ':' + crypto.scryptSync(pass, sal, 32).toString('hex');
const passOk = (pass, h) => { const [sal] = h.split(':'); return crypto.timingSafeEqual(Buffer.from(hash(pass, sal)), Buffer.from(h)); };
const pub = u => ({ id: u.id, nombre: u.nombre, email: u.email, telefono: u.telefono, rol: u.rol });
const huella = l => crypto.createHash('sha256').update([l.codigo, l.tipo, l.kgPorUnidad, l.fechaProduccion, l.loteOrigen || ''].join('|')).digest('hex');

class Err extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const quien = req => { const t = (req.headers.authorization || '').replace(/^Bearer /, ''); const id = sesiones.get(t); return db.usuarios.find(u => u.id === id) || null; };
const necesita = (req, rol) => { const u = quien(req); if (!u) throw new Err(401, 'Inicia sesión para continuar.'); if (rol && u.rol !== rol) throw new Err(403, 'No tienes permiso para esto.'); return u; };
const sesionNueva = u => { const token = crypto.randomBytes(24).toString('hex'); sesiones.set(token, u.id); return { token, usuario: pub(u) }; };

/* Trazabilidad de un lote: etapas con fechas reales registradas.
   ETAPAS_LOTE = etapas que el administrador registra con POST /lotes/:codigo/etapa (las oficiales las define el equipo). */
const ETAPAS_LOTE = ['Producción', 'Transporte', 'Distribución', 'En punto de venta'];
function trazabilidad(l) {
  const ventas = db.pedidos.filter(p => p.estado !== 'cancelado' && p.items.some(i => i.lote === l.codigo)).map(p => p.fecha).sort();
  const hechas = l.etapas && l.etapas.length ? l.etapas : [{ nombre: 'Producción', fecha: l.fechaProduccion }];   // lotes viejos sin etapas guardadas
  const etapas = [
    ...(l.loteOrigen ? [{ nombre: 'Recepción de residuos', fecha: null, detalle: 'Ref. ' + l.loteOrigen }] : []),
    ...hechas,
    { nombre: 'Primera venta', fecha: ventas[0] || null },
  ];
  const { etapas: _, ...datos } = l;
  return { ...datos, etapas, siguienteEtapa: ETAPAS_LOTE[hechas.length] || null, huella: huella(l), verificado: true, blockchain: null /* { red, transaccion } cuando se conecte */ };
}

const rutas = {
  'POST /auth/registro': (req, b) => {
    const email = String(b.email || '').trim().toLowerCase(), telefono = String(b.telefono || '').trim(), digitos = telefono.replace(/\D/g, '');
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) throw new Err(400, 'El e-mail no es válido.');
    if (digitos.length < 8 || digitos.length > 15) throw new Err(400, 'Escribe un teléfono válido con la clave de tu país.');
    if (String(b.nombre || '').trim().length < 2) throw new Err(400, 'Escribe tu nombre.');
    if (String(b.password || '').length < 6) throw new Err(400, 'La contraseña debe tener al menos 6 caracteres.');
    if (b.codigoAdmin && String(b.codigoAdmin).toUpperCase() !== ADMIN_CODE) throw new Err(400, 'El código de administrador no es válido.');
    if (db.usuarios.some(u => u.email === email)) throw new Err(409, 'Ese e-mail ya tiene una cuenta. Inicia sesión.');
    if (db.usuarios.some(u => u.telefono.replace(/\D/g, '') === digitos)) throw new Err(409, 'Ese teléfono ya tiene una cuenta. Inicia sesión.');
    const u = { id: crypto.randomUUID(), nombre: b.nombre.trim(), email, telefono, rol: b.codigoAdmin ? 'admin' : 'cliente', password: hash(b.password) };
    db.usuarios.push(u); guardar(); return [201, sesionNueva(u)];
  },
  'POST /auth/login': (req, b) => {
    const id = String(b.usuario || '').trim().toLowerCase(), tel = id.replace(/\D/g, '');
    const mismo = g => { g = g.replace(/\D/g, ''); return g === tel || (tel.length >= 7 && g.endsWith(tel)); };   // con o sin clave de pais
    const u = db.usuarios.find(x => x.email === id || (!id.includes('@') && tel && mismo(x.telefono)));
    if (!u || !passOk(String(b.password || ''), u.password)) throw new Err(401, 'E-mail, teléfono o contraseña incorrectos.');
    return sesionNueva(u);
  },
  'GET /auth/yo': req => ({ usuario: pub(necesita(req)) }),
  'POST /auth/salir': req => { sesiones.delete((req.headers.authorization || '').replace(/^Bearer /, '')); return [204]; },
  'POST /auth/recuperar': (req, b) => {
    const u = db.usuarios.find(x => x.email === String(b.email || '').toLowerCase());
    if (u) { const codigo = String(crypto.randomInt(100000, 1000000)); db.recuperaciones[u.email] = { codigo, vence: Date.now() + 10 * 60000 }; guardar(); console.log(`[correo simulado] Código para ${u.email}: ${codigo}`); }
    return [204];   // siempre igual: no revela si el correo existe
  },
  'POST /auth/restablecer': (req, b) => {
    const email = String(b.email || '').toLowerCase(), r = db.recuperaciones[email], u = db.usuarios.find(x => x.email === email);
    if (!r || !u || r.codigo !== String(b.codigo) || Date.now() > r.vence) throw new Err(400, 'El código no es correcto o ya venció.');
    if (String(b.password || '').length < 6) throw new Err(400, 'La contraseña debe tener al menos 6 caracteres.');
    u.password = hash(b.password); delete db.recuperaciones[email]; guardar(); return [204];
  },

  'GET /lotes': () => db.lotes.map(({ etapas, ...l }) => l),
  'GET /lotes/:codigo': (req, b, p) => { const l = db.lotes.find(x => x.codigo === p.codigo); if (!l) throw new Err(404, 'No encontramos ese lote.'); return trazabilidad(l); },
  'POST /lotes': (req, b) => {
    necesita(req, 'admin');
    if (!b.codigo || !b.tipo || !(b.kgPorUnidad > 0) || !b.fechaProduccion) throw new Err(400, 'Faltan datos del lote.');
    if (!PRESENTACIONES.includes(+b.kgPorUnidad)) throw new Err(400, 'Solo se manejan presentaciones de 5, 25 y 50 kg.');
    if (db.lotes.some(x => x.codigo === b.codigo)) throw new Err(409, 'Ese lote ya existe.');
    const l = { codigo: b.codigo, tipo: b.tipo, kgPorUnidad: +b.kgPorUnidad, fechaProduccion: b.fechaProduccion, precio: +b.precio || 0, stock: Math.max(0, +b.stock || 0), descripcion: b.descripcion || '', fotoUrl: b.fotoUrl || null, loteOrigen: b.loteOrigen || null };
    l.etapas = [{ nombre: ETAPAS_LOTE[0], fecha: l.fechaProduccion }];   // al registrarse, el lote queda en su primera etapa (aqui se registraria en la blockchain)
    db.lotes.push(l); guardar(); return [201, l];
  },
  'POST /lotes/:codigo/etapa': (req, b, p) => {
    necesita(req, 'admin');
    const l = db.lotes.find(x => x.codigo === p.codigo); if (!l) throw new Err(404, 'No encontramos ese lote.');
    if (!l.etapas || !l.etapas.length) l.etapas = [{ nombre: ETAPAS_LOTE[0], fecha: l.fechaProduccion }];
    const sig = ETAPAS_LOTE[l.etapas.length]; if (!sig) throw new Err(409, 'Este lote ya pasó por todas sus etapas.');
    l.etapas.push({ nombre: sig, fecha: hoy(), ...(b.nota ? { detalle: String(b.nota).slice(0, 120) } : {}) });   // aqui se registraria en la blockchain
    guardar(); return trazabilidad(l);
  },
  'PUT /lotes/:codigo': (req, b, p) => {
    necesita(req, 'admin');
    const l = db.lotes.find(x => x.codigo === p.codigo); if (!l) throw new Err(404, 'No encontramos ese lote.');
    const vendido = db.pedidos.some(o => o.items.some(i => i.lote === l.codigo));
    if (!vendido && !PRESENTACIONES.includes(+b.kgPorUnidad)) throw new Err(400, 'Solo se manejan presentaciones de 5, 25 y 50 kg.');
    Object.assign(l, { precio: +b.precio, stock: Math.max(0, +b.stock || 0), descripcion: b.descripcion || '', fotoUrl: b.fotoUrl || null });
    if (!vendido) Object.assign(l, { tipo: b.tipo, kgPorUnidad: +b.kgPorUnidad, fechaProduccion: b.fechaProduccion, loteOrigen: b.loteOrigen || null });   // con ventas, la huella no cambia
    guardar(); return l;
  },
  'DELETE /lotes/:codigo': (req, b, p) => {
    necesita(req, 'admin');
    if (db.pedidos.some(o => o.items.some(i => i.lote === p.codigo))) throw new Err(409, 'Este lote tiene ventas, no se puede eliminar.');
    db.lotes = db.lotes.filter(x => x.codigo !== p.codigo); guardar(); return [204];
  },

  'GET /pedidos': req => { const u = necesita(req); return u.rol === 'admin' ? db.pedidos : db.pedidos.filter(o => o.cliente && o.cliente.id === u.id); },
  'POST /pedidos': (req, b) => {
    const u = necesita(req), directa = !!b.ventaDirecta;
    if (directa && u.rol !== 'admin') throw new Err(403, 'Solo el administrador registra ventas directas.');
    if (!Array.isArray(b.items) || !b.items.length) throw new Err(400, 'El pedido está vacío.');
    if (!directa && !b.direccion) throw new Err(400, 'Falta la dirección de entrega.');
    const items = b.items.map(i => {   // precios y existencias los decide el servidor
      const l = db.lotes.find(x => x.codigo === i.lote), q = Math.floor(+i.cantidad);
      if (!l) throw new Err(400, `El lote ${i.lote} ya no existe.`);
      if (!(q > 0) || q > l.stock) throw new Err(409, `Solo quedan ${l.stock} unidades de ${l.tipo} · ${l.kgPorUnidad} kg.`);
      return { l, q };
    });
    items.forEach(({ l, q }) => { l.stock -= q; });
    const subtotal = items.reduce((a, { l, q }) => a + q * l.precio, 0);
    const envio = 0;   // envio gratis en todos los pedidos
    const descuento = Math.max(0, Math.min(subtotal, Math.round(+b.descuento || 0)));   // TODO: calcularlo aquí cuando exista la tabla de cupones
    const pago = b.pago && b.pago.metodo === 'tarjeta' ? { metodo: 'tarjeta', marca: b.pago.marca, last4: String(b.pago.last4 || '').slice(-4), estado: 'aprobado', pagoId: String(crypto.randomInt(1e9, 1e10)) } : { metodo: directa ? 'directa' : 'efectivo', estado: 'pendiente' };
    const o = {
      id: crypto.randomUUID(), numero: String(crypto.randomInt(1e9, 1e10)), fecha: hoy(),
      cliente: directa ? null : { id: u.id, nombre: u.nombre, email: u.email },
      items: items.map(({ l, q }) => ({ lote: l.codigo, cantidad: q, precio: l.precio, tipo: l.tipo, kgPorUnidad: l.kgPorUnidad })),
      subtotal, descuento, cupon: descuento ? b.cupon || null : null, envio, total: subtotal - descuento + envio, pago,
      direccion: b.direccion || null, estado: directa ? 'entregado' : 'pendiente', historial: { [directa ? 'entregado' : 'pendiente']: hoy() },
    };
    db.pedidos.push(o); guardar(); return [201, o];
  },
  'PATCH /pedidos/:id': (req, b, p) => {
    necesita(req, 'admin');
    const o = db.pedidos.find(x => x.id === p.id); if (!o) throw new Err(404, 'No encontramos ese pedido.');
    const orden = ['pendiente', 'preparando', 'enviado', 'entregado'];
    if (!orden.includes(b.estado) || orden.indexOf(b.estado) <= orden.indexOf(o.estado)) throw new Err(400, 'Ese cambio de estado no es válido.');
    o.estado = b.estado; o.historial[b.estado] = hoy(); guardar(); return o;
  },
  'POST /pedidos/:id/cancelar': (req, b, p) => {
    const u = necesita(req), o = db.pedidos.find(x => x.id === p.id);
    if (!o || (u.rol !== 'admin' && (!o.cliente || o.cliente.id !== u.id))) throw new Err(404, 'No encontramos ese pedido.');
    if (!['pendiente', 'preparando'].includes(o.estado)) throw new Err(409, 'Este pedido ya no se puede cancelar.');
    o.items.forEach(i => { const l = db.lotes.find(x => x.codigo === i.lote); if (l) l.stock += i.cantidad; });
    o.estado = 'cancelado'; o.historial.cancelado = hoy(); guardar(); return o;
  },
};

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');   // en producción: solo el dominio de la página
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://x'), ruta = url.pathname.replace(/^\/api/, '').replace(/\/$/, '') || '/';
  let body = ''; for await (const c of req) body += c;
  try {
    let fn, params = {};
    for (const [k, f] of Object.entries(rutas)) {
      const [m, p] = k.split(' '); if (m !== req.method) continue;
      const rx = new RegExp('^' + p.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), mm = ruta.match(rx);
      if (mm) { fn = f; params = Object.fromEntries(Object.entries(mm.groups || {}).map(([a, v]) => [a, decodeURIComponent(v)])); break; }
    }
    if (!fn) throw new Err(404, 'Ruta no encontrada.');
    let out = await fn(req, body ? JSON.parse(body) : {}, params), status = 200;
    if (Array.isArray(out) && typeof out[0] === 'number' && out.length <= 2) [status, out] = out;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(out === undefined ? '' : JSON.stringify(out));
  } catch (e) {
    const status = e.status || (e instanceof SyntaxError ? 400 : 500);
    if (status === 500) console.error(e);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ error: status === 500 ? 'Error interno del servidor.' : e.message }));
  }
}).listen(PORT, () => console.log(`Servidor de ejemplo en http://localhost:${PORT}/api`));
