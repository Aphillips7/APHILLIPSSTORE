// =================== API DE LA TIENDA (api.aphillipsstore.com) ===================
// Worker "aphillips-fotos". Fotos en R2, catalogo publico en R2 y metricas en D1.
//
// Seguridad de las rutas de admin: el panel envia su sesion de Firebase
// (ID token, "Authorization: Bearer ...") y aqui se verifica:
//   - la firma RS256 con las llaves publicas de Google,
//   - que sea de este proyecto (aud / iss) y que no haya vencido,
//   - que el usuario (sub) sea OWNER_UID.
//
// Rutas publicas (cualquier visitante):
//   GET    /catalogo           -> { relojes:[...], _ts }  (copia publica, en cache 30 s)
//   POST   /metricas           cuerpo (texto JSON) [[id, "vistas"|"aperturas"|"clics"], ...]
//   GET    /salud              -> { ok: true }
// Rutas de admin:
//   PUT    /catalogo           cuerpo { relojes:[...] } -> publica la copia (se quitan campos no publicos)
//   GET    /metricas           -> { metricas: { id: {vistas, aperturas, clics, _ultima} }, importado }
//   POST   /metricas/importar  cuerpo { metricas: {...} } suma las metricas antiguas de Firestore (solo una vez)
//   POST   /fotos?reloj=<id>   cuerpo = la imagen (WebP/JPEG/PNG, max 4 MB) -> { url, clave }
//   DELETE /fotos?clave=<clave>  borra una foto (solo claves "relojes/...")
//   GET    /datos/resumen      -> { version, hashes: { col: { id: hash } } }   (datos del panel, etapa 3)
//   GET    /datos?desde=<n>    -> { version, docs: [{col, id, datos, borrado, version}] }  (cambios desde n)
//   POST   /datos/lote         cuerpo { ops: [{col, id, json} | {col, id, borrar:true}] } -> { ok, version, hashes }
//   POST   /datos/estado       cuerpo { id, estadoEsperado, cambios, quitar } -> { ok, version, datos }
//                              cambio de estado de un reloj sin venta doble (409 si cambio en otro dispositivo)

const TIPOS = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_BYTES = 4 * 1024 * 1024;
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// Unicos campos que pueden salir al publico (igual que camposPublicos() en js/products.js).
// Todo lo demas (costo, proveedor, margen, serie, tracking...) se descarta aqui aunque llegue.
const CAMPOS_PUBLICOS = ['id', 'nombre', 'sku', 'coleccion', 'genero', 'mm', 'materialCaja', 'materialCorrea',
  'colorEsfera', 'movimiento', 'agua', 'cristal', 'color', 'notas', 'descripcion', 'eta', 'precio', 'foto', 'fotos',
  'estado', '_ts'];
const CLAVE_CATALOGO = 'publico/catalogo.json';
const URL_CACHE_CATALOGO = 'https://api.aphillipsstore.com/__cache/catalogo';
const CAMPOS_METRICA = ['vistas', 'aperturas', 'clics'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ruta = url.pathname, metodo = request.method;
    const publica = (ruta === '/catalogo' && metodo === 'GET') || ruta === '/metricas' && metodo === 'POST';
    const cors = encabezadosCors(request, env, publica);

    if (metodo === 'OPTIONS') return new Response(null, { status: 204, headers: encabezadosCors(request, env, ruta === '/catalogo' || ruta === '/metricas') });
    if (ruta === '/salud') return json({ ok: true }, 200, cors);

    // ---------- publicas ----------
    if (ruta === '/catalogo' && metodo === 'GET') return leerCatalogo(request, env, cors);
    if (ruta === '/metricas' && metodo === 'POST') return sumarMetricas(request, env, cors);

    const conocida = (ruta === '/catalogo' && metodo === 'PUT') || (ruta === '/metricas' && metodo === 'GET') ||
      (ruta === '/metricas/importar' && metodo === 'POST') ||
      (ruta === '/fotos' && (metodo === 'POST' || metodo === 'DELETE')) ||
      ((ruta === '/datos' || ruta === '/datos/resumen') && metodo === 'GET') || ((ruta === '/datos/lote' || ruta === '/datos/estado') && metodo === 'POST');
    if (!conocida) return json({ error: 'No encontrado' }, 404, cors);

    // ---------- solo el admin ----------
    let uid;
    try {
      uid = await verificarTokenFirebase(request.headers.get('Authorization'), env);
    } catch (e) {
      return json({ error: 'Sesion invalida: ' + e.message }, 401, cors);
    }
    // OWNER_UID puede traer espacios o saltos de linea al guardarlo; tambien admite varios separados por coma
    const duenos = String(env.OWNER_UID || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!duenos.includes(uid)) return json({ error: 'Sin permiso (tu UID es ' + uid + ')' }, 403, cors);

    if (ruta === '/catalogo') return publicarCatalogo(request, env, cors);
    if (ruta === '/metricas') return leerMetricas(env, cors);
    if (ruta === '/metricas/importar') return importarMetricas(request, env, cors);
    if (ruta === '/datos/resumen') return resumenDatos(env, cors);
    if (ruta === '/datos') return cambiosDatos(url, env, cors);
    if (ruta === '/datos/lote') return loteDatos(request, env, cors);
    if (ruta === '/datos/estado') return cambiarEstado(request, env, cors);

    if (metodo === 'POST') {
      const reloj = (url.searchParams.get('reloj') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
      if (!reloj) return json({ error: 'Falta el id del reloj' }, 400, cors);
      const tipo = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
      const ext = TIPOS[tipo];
      if (!ext) return json({ error: 'Formato no permitido (usa WebP, JPEG o PNG)' }, 415, cors);
      const largo = Number(request.headers.get('Content-Length') || 0);
      if (largo > MAX_BYTES) return json({ error: 'La foto pesa mas de 4 MB' }, 413, cors);

      const datos = await request.arrayBuffer();
      if (!datos.byteLength) return json({ error: 'La foto esta vacia' }, 400, cors);
      if (datos.byteLength > MAX_BYTES) return json({ error: 'La foto pesa mas de 4 MB' }, 413, cors);

      const clave = 'relojes/' + reloj + '/' + Date.now() + '-' + crypto.randomUUID().slice(0, 8) + '.' + ext;
      await env.FOTOS.put(clave, datos, {
        httpMetadata: { contentType: tipo, cacheControl: 'public, max-age=31536000, immutable' }
      });
      return json({ url: env.FOTOS_URL_BASE + '/' + clave, clave }, 201, cors);
    }

    // DELETE
    const clave = url.searchParams.get('clave') || '';
    if (!/^relojes\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(clave)) return json({ error: 'Clave invalida' }, 400, cors);
    await env.FOTOS.delete(clave);
    return json({ ok: true }, 200, cors);
  }
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}

// publica = true: cualquier origen (catalogo y metricas). Si no, solo los origenes de la tienda.
function encabezadosCors(request, env, publica) {
  const origen = request.headers.get('Origin') || '';
  const permitidos = (env.ORIGENES_PERMITIDOS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (permitidos.includes(origen)) h['Access-Control-Allow-Origin'] = origen;
  else if (publica) h['Access-Control-Allow-Origin'] = '*';
  return h;
}

// ---------- catalogo publico (copia en R2, servida con cache) ----------
// Con ETag: si el navegador ya tiene la version actual (If-None-Match) se responde 304 sin cuerpo,
// asi el catalogo abierto solo se vuelve a descargar cuando de verdad cambio.
async function leerCatalogo(request, env, cors) {
  const cache = caches.default;
  let res = await cache.match(URL_CACHE_CATALOGO);
  if (!res) {
    const obj = await env.FOTOS.get(CLAVE_CATALOGO);
    if (!obj) return json({ relojes: null, error: 'Catalogo aun no publicado' }, 404, cors);
    res = new Response(await obj.text(), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=30', 'ETag': obj.httpEtag }
    });
    await cache.put(URL_CACHE_CATALOGO, res.clone());
  }
  const etag = res.headers.get('ETag');
  const pedido = (request.headers.get('If-None-Match') || '').replace(/^W\//, '');
  if (etag && pedido && pedido === etag.replace(/^W\//, '')) {
    return new Response(null, { status: 304, headers: { ...cors, 'ETag': etag, 'Cache-Control': 'public, max-age=30' } });
  }
  return conCors(res, cors);
}

async function publicarCatalogo(request, env, cors) {
  let datos;
  try { datos = await request.json(); } catch (e) { return json({ error: 'JSON invalido' }, 400, cors); }
  if (!datos || !Array.isArray(datos.relojes)) return json({ error: 'Falta la lista de relojes' }, 400, cors);
  if (datos.relojes.length > 2000) return json({ error: 'Demasiados relojes' }, 413, cors);
  // segunda capa de proteccion: solo pasan los campos publicos
  const relojes = datos.relojes.filter((r) => r && typeof r.id === 'string' && r.id).map((r) => {
    const limpio = {};
    for (const k of CAMPOS_PUBLICOS) if (r[k] !== undefined) limpio[k] = r[k];
    return limpio;
  });
  const cuerpo = JSON.stringify({ relojes, _ts: Date.now() });
  await env.FOTOS.put(CLAVE_CATALOGO, cuerpo, { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  await caches.default.delete(URL_CACHE_CATALOGO);
  _idsCatalogo = { ids: new Set(relojes.map((r) => r.id)), vence: Date.now() + 60000 };
  return json({ ok: true, relojes: relojes.length }, 200, cors);
}

function conCors(res, cors) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}

// ---------- metricas (D1) ----------
// Ids de relojes del catalogo publicado, para no aceptar metricas de ids inventados
let _idsCatalogo = { ids: null, vence: 0 };
async function idsCatalogo(env) {
  if (_idsCatalogo.ids && Date.now() < _idsCatalogo.vence) return _idsCatalogo.ids;
  const obj = await env.FOTOS.get(CLAVE_CATALOGO);
  let ids = new Set();
  if (obj) { try { ids = new Set((JSON.parse(await obj.text()).relojes || []).map((r) => r.id)); } catch (e) {} }
  _idsCatalogo = { ids, vence: Date.now() + 60000 };
  return ids;
}

async function sumarMetricas(request, env, cors) {
  let eventos;
  try { eventos = JSON.parse(await request.text()); } catch (e) { return json({ error: 'JSON invalido' }, 400, cors); }
  if (!Array.isArray(eventos)) return json({ error: 'Formato invalido' }, 400, cors);
  const validos = await idsCatalogo(env);
  // cada visita cuenta como maximo 1 vista / 1 apertura / 1 clic por reloj
  const suma = new Map();
  for (const ev of eventos.slice(0, 300)) {
    if (!Array.isArray(ev)) continue;
    const [id, campo] = ev;
    if (typeof id !== 'string' || !CAMPOS_METRICA.includes(campo) || !validos.has(id)) continue;
    const s = suma.get(id) || { vistas: 0, aperturas: 0, clics: 0 };
    s[campo] = 1;
    suma.set(id, s);
  }
  if (!suma.size) return json({ ok: true, sumadas: 0 }, 200, cors);
  const ahora = Date.now();
  const sql = 'INSERT INTO metricas (id, vistas, aperturas, clics, ultima) VALUES (?1, ?2, ?3, ?4, ?5) ' +
    'ON CONFLICT(id) DO UPDATE SET vistas = vistas + excluded.vistas, aperturas = aperturas + excluded.aperturas, ' +
    'clics = clics + excluded.clics, ultima = excluded.ultima';
  const stmt = env.DB.prepare(sql);
  await env.DB.batch([...suma].map(([id, s]) => stmt.bind(id, s.vistas, s.aperturas, s.clics, ahora)));
  return json({ ok: true, sumadas: suma.size }, 200, cors);
}

async function leerMetricas(env, cors) {
  const { results } = await env.DB.prepare('SELECT id, vistas, aperturas, clics, ultima FROM metricas').all();
  const metricas = {};
  for (const r of results) metricas[r.id] = { vistas: r.vistas, aperturas: r.aperturas, clics: r.clics, _ultima: r.ultima };
  const marca = await env.DB.prepare("SELECT valor FROM ajustes WHERE nombre = 'metricas_importadas'").first();
  return json({ metricas, importado: !!marca }, 200, cors);
}

// Suma una sola vez las metricas antiguas de Firestore. La marca va en la misma transaccion:
// si ya existe, el INSERT falla y no se suma nada (no se puede importar dos veces).
async function importarMetricas(request, env, cors) {
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'JSON invalido' }, 400, cors); }
  const m = b && b.metricas && typeof b.metricas === 'object' ? b.metricas : null;
  if (!m) return json({ error: 'Faltan las metricas' }, 400, cors);
  const num = (v) => Math.max(0, Math.min(1e7, Math.floor(Number(v) || 0)));
  const sumar = env.DB.prepare('INSERT INTO metricas (id, vistas, aperturas, clics, ultima) VALUES (?1, ?2, ?3, ?4, ?5) ' +
    'ON CONFLICT(id) DO UPDATE SET vistas = vistas + excluded.vistas, aperturas = aperturas + excluded.aperturas, ' +
    'clics = clics + excluded.clics, ultima = MAX(COALESCE(ultima, 0), excluded.ultima)');
  const sentencias = [env.DB.prepare("INSERT INTO ajustes (nombre, valor) VALUES ('metricas_importadas', ?1)").bind(String(Date.now()))];
  for (const [id, v] of Object.entries(m).slice(0, 5000)) {
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(id) || !v || typeof v !== 'object') continue;
    sentencias.push(sumar.bind(id, num(v.vistas), num(v.aperturas), num(v.clics), num(v._ultima)));
  }
  try { await env.DB.batch(sentencias); } catch (e) { return json({ error: 'Las metricas ya se habian importado' }, 409, cors); }
  return json({ ok: true, importadas: sentencias.length - 1 }, 200, cors);
}

// ---------- datos del panel (D1, etapa 3) ----------
// Copia de las colecciones de Firestore del panel. Solo el admin puede leer o escribir.
const COLECCIONES_DATOS = ['inventario', 'movimientos', 'clientes', 'config', 'authSettings'];
const MAX_DOC = 900 * 1024;
const MAX_OPS = 200;
const MAX_CAMBIOS = 5000;

async function sha256(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function versionActual(env) {
  const r = await env.DB.prepare("SELECT valor FROM contador WHERE nombre = 'docs'").first();
  return r ? r.valor : 0;
}

async function resumenDatos(env, cors) {
  const { results } = await env.DB.prepare('SELECT col, id, hash FROM docs WHERE borrado = 0').all();
  const hashes = {};
  for (const c of COLECCIONES_DATOS) hashes[c] = {};
  for (const r of results) (hashes[r.col] || (hashes[r.col] = {}))[r.id] = r.hash;
  return json({ version: await versionActual(env), hashes }, 200, cors);
}

// Se lee primero el contador y despues solo las filas hasta ese numero: una escritura que entre a la
// mitad queda con un numero mayor y llega en la siguiente consulta (nunca se pierde).
async function cambiosDatos(url, env, cors) {
  const desde = Math.max(0, parseInt(url.searchParams.get('desde') || '0', 10) || 0);
  let hasta = await versionActual(env);
  const { results } = await env.DB.prepare(
    'SELECT col, id, datos, borrado, version FROM docs WHERE version > ?1 AND version <= ?2 ORDER BY version LIMIT ?3')
    .bind(desde, hasta, MAX_CAMBIOS + 1).all();
  let filas = results;
  if (filas.length > MAX_CAMBIOS) {   // demasiados: se entregan por partes, sin cortar una misma version
    hasta = filas[MAX_CAMBIOS - 1].version - 1;
    filas = filas.filter((r) => r.version <= hasta);
  }
  const docs = filas.map((r) => ({ col: r.col, id: r.id, borrado: !!r.borrado, version: r.version, datos: r.borrado ? null : JSON.parse(r.datos) }));
  return json({ version: hasta, completo: filas.length === results.length, docs }, 200, cors);
}

// JSON con las claves ordenadas (igual que canonico() del panel)
function canonico(v) {
  if (Array.isArray(v)) return '[' + v.map(canonico).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canonico(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}

const NOMBRES_ESTADO = { disponible: 'disponible', transito: 'en transito', bajopedido: 'bajo pedido', reservado: 'reservado', vendido: 'vendido' };
// Igual que cambiarEstadoSeguro() del panel con Firestore: solo escribe si el estado en la nube sigue
// siendo el que se veia en pantalla. La escritura se condiciona a la huella leida, asi que si otro
// dispositivo escribio entre la lectura y la escritura, no se aplica y se avisa.
async function cambiarEstado(request, env, cors) {
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'JSON invalido' }, 400, cors); }
  if (!b || typeof b.id !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(b.id)) return json({ error: 'Id invalido' }, 400, cors);
  if (!b.cambios || typeof b.cambios !== 'object' || Array.isArray(b.cambios)) return json({ error: 'Faltan los cambios' }, 400, cors);
  const fila = await env.DB.prepare("SELECT datos, hash FROM docs WHERE col = 'inventario' AND id = ?1 AND borrado = 0").bind(b.id).first();
  if (!fila) return json({ conflicto: true, error: 'Este reloj ya no existe en la nube (pudo eliminarse en otro dispositivo).' }, 409, cors);
  const actual = JSON.parse(fila.datos);
  if (actual.estado !== b.estadoEsperado || (b.cambios.estado === 'vendido' && actual.estado === 'vendido')) {
    const quien = actual.reserva && actual.reserva.clienteNombre ? ' (reserva de ' + actual.reserva.clienteNombre + ')' : '';
    return json({ conflicto: true, error: 'Este reloj cambio a "' + (NOMBRES_ESTADO[actual.estado] || actual.estado) + '"' + quien +
      ' desde otro dispositivo. No se registro nada; refresca y revisa antes de continuar.' }, 409, cors);
  }
  const final = Object.assign({}, actual, b.cambios);
  (Array.isArray(b.quitar) ? b.quitar : []).forEach((k) => { delete final[k]; });
  const texto = canonico(final);
  const h = await sha256(texto);
  const r = await env.DB.batch([
    env.DB.prepare("UPDATE contador SET valor = valor + 1 WHERE nombre = 'docs'"),
    env.DB.prepare("UPDATE docs SET datos = ?1, hash = ?2, version = (SELECT valor FROM contador WHERE nombre = 'docs') " +
      "WHERE col = 'inventario' AND id = ?3 AND hash = ?4 AND borrado = 0").bind(texto, h, b.id, fila.hash)
  ]);
  if (!r[1].meta || r[1].meta.changes !== 1) {
    return json({ conflicto: true, error: 'Este reloj se modifico en otro dispositivo en este mismo momento. No se registro nada; intentalo de nuevo.' }, 409, cors);
  }
  return json({ ok: true, version: await versionActual(env), datos: final }, 200, cors);
}

async function loteDatos(request, env, cors) {
  let cuerpo;
  try { cuerpo = await request.json(); } catch (e) { return json({ error: 'JSON invalido' }, 400, cors); }
  const ops = cuerpo && Array.isArray(cuerpo.ops) ? cuerpo.ops : null;
  if (!ops || !ops.length) return json({ error: 'Faltan operaciones' }, 400, cors);
  if (ops.length > MAX_OPS) return json({ error: 'Maximo ' + MAX_OPS + ' operaciones por envio' }, 413, cors);

  const subir = env.DB.prepare("UPDATE contador SET valor = valor + 1 WHERE nombre = 'docs'");
  const guardar = env.DB.prepare(
    "INSERT INTO docs (col, id, datos, hash, version, borrado) VALUES (?1, ?2, ?3, ?4, (SELECT valor FROM contador WHERE nombre = 'docs'), 0) " +
    'ON CONFLICT(col, id) DO UPDATE SET datos = excluded.datos, hash = excluded.hash, version = excluded.version, borrado = 0');
  const borrar = env.DB.prepare(
    // se conserva el contenido (borrado = 1) por si hay que recuperarlo
    "UPDATE docs SET hash = '', borrado = 1, version = (SELECT valor FROM contador WHERE nombre = 'docs') WHERE col = ?1 AND id = ?2 AND borrado = 0");
  const sentencias = [subir];
  const hashes = {};
  for (const op of ops) {
    if (!op || !COLECCIONES_DATOS.includes(op.col)) return json({ error: 'Coleccion no permitida' }, 400, cors);
    if (typeof op.id !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(op.id)) return json({ error: 'Id invalido' }, 400, cors);
    if (op.borrar) { sentencias.push(borrar.bind(op.col, op.id)); continue; }
    if (typeof op.json !== 'string' || op.json.length > MAX_DOC) return json({ error: 'Documento invalido o muy grande: ' + op.id }, 400, cors);
    try { if (typeof JSON.parse(op.json) !== 'object') throw 0; } catch (e) { return json({ error: 'JSON invalido en ' + op.id }, 400, cors); }
    const h = await sha256(op.json);
    (hashes[op.col] || (hashes[op.col] = {}))[op.id] = h;
    sentencias.push(guardar.bind(op.col, op.id, op.json, h));
  }
  await env.DB.batch(sentencias);   // todo o nada (transaccion)
  return json({ ok: true, version: await versionActual(env), hashes }, 200, cors);
}

// ---------- verificacion del ID token de Firebase (sin librerias) ----------
let cacheLlaves = { llaves: null, vence: 0 };

async function llavesGoogle() {
  if (cacheLlaves.llaves && Date.now() < cacheLlaves.vence) return cacheLlaves.llaves;
  const r = await fetch(JWKS_URL);
  if (!r.ok) throw new Error('no se pudieron obtener las llaves de Google');
  const { keys } = await r.json();
  const maxAge = Number((r.headers.get('Cache-Control') || '').match(/max-age=(\d+)/)?.[1] || 3600);
  cacheLlaves = { llaves: keys, vence: Date.now() + maxAge * 1000 };
  return keys;
}

function b64urlABytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlAJson(s) { return JSON.parse(new TextDecoder().decode(b64urlABytes(s))); }

async function verificarTokenFirebase(cabecera, env) {
  const m = /^Bearer\s+(.+)$/i.exec(cabecera || '');
  if (!m) throw new Error('falta el token');
  const partes = m[1].split('.');
  if (partes.length !== 3) throw new Error('token mal formado');
  const [h64, p64, f64] = partes;
  const header = b64urlAJson(h64);
  const payload = b64urlAJson(p64);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('algoritmo no valido');

  const ahora = Math.floor(Date.now() / 1000);
  const proyecto = env.FIREBASE_PROJECT_ID;
  if (payload.aud !== proyecto) throw new Error('proyecto incorrecto');
  if (payload.iss !== 'https://securetoken.google.com/' + proyecto) throw new Error('emisor incorrecto');
  if (typeof payload.exp !== 'number' || payload.exp < ahora - 60) throw new Error('token vencido');
  if (typeof payload.iat !== 'number' || payload.iat > ahora + 300) throw new Error('fecha del token no valida');
  if (!payload.sub) throw new Error('token sin usuario');

  const jwk = (await llavesGoogle()).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('llave desconocida');
  const llave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valido = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', llave, b64urlABytes(f64), new TextEncoder().encode(h64 + '.' + p64));
  if (!valido) throw new Error('firma no valida');
  return payload.sub;
}
