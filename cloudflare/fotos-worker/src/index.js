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
//   GET    /destacados         -> { ids } relojes a la venta con mas clics (publica, para el carrusel de la portada)
//   GET    /catalogo           -> { relojes:[...], _ts }  (copia publica, en cache 30 s)
//   POST   /metricas           cuerpo (texto JSON) [[id, "vistas"|"aperturas"|"clics"], ...]
//   GET    /salud              -> { ok: true }
//   POST   /errores            cuerpo (texto JSON) { m, f, l, p, n }: error de JavaScript de la tienda o el panel (limite por IP)
// Rutas de admin:
//   PUT    /catalogo           cuerpo { relojes:[...] } -> publica la copia (se quitan campos no publicos)
//   GET    /metricas           -> { metricas: { id: {vistas, aperturas, clics, _ultima} }, importado }
//   POST   /metricas/importar  cuerpo { metricas: {...} } suma las metricas antiguas de Firestore (solo una vez)
//   POST   /fotos?reloj=<id>   cuerpo = la imagen (WebP/JPEG/PNG, max 4 MB) -> { url, clave }
//   POST   /fotos?reloj=<id>&mini=<clave>  guarda la miniatura de esa foto en miniaturas/<clave> (tarjetas del catalogo)
//   DELETE /fotos?clave=<clave>  borra una foto (solo claves "relojes/...")
//   GET    /datos/resumen      -> { version, hashes: { col: { id: hash } } }   (datos del panel, etapa 3)
//   GET    /datos?desde=<n>    -> { version, docs: [{col, id, datos, borrado, version}] }  (cambios desde n)
//   POST   /datos/lote         cuerpo { ops: [{col, id, json} | {col, id, borrar:true}] } -> { ok, version, hashes }
//   GET    /respaldos          -> { respaldos: [{ nombre, bytes, fecha }] }   (respaldos automaticos)
//   GET    /respaldos/archivo?nombre=<n>  descarga un respaldo (mismo formato que "Exportar respaldo")
//   POST   /mantenimiento      hace ahora el respaldo y la limpieza de fotos (lo mismo que el cron diario)
//
// Rutas de clientes (cualquier cuenta con sesion de Firebase; cada uno SOLO ve y cambia lo suyo):
//   GET    /cuenta             -> { perfil, favoritos, avisos, vinculado, esAdmin }  (crea la cuenta la 1.a vez;
//                              perfil.completo = false hasta tener nombre, apellido, WhatsApp, terminos y mayor de edad)
//   PUT    /cuenta/perfil      { nombre, apellido, telefono, cedula?, nacimiento?, muneca?, contacto?, novedades?,
//                                direccion?: { provincia, ciudad, linea, referencia }, terminos?, mayorEdad? }
//   POST   /cuenta/registro    lo mismo que /cuenta/perfil, pero se acepta antes de verificar el correo (al crear la cuenta)
//   GET    /cuenta/pedidos     -> { pedidos }   sus pedidos hechos por WhatsApp, con el estado y el historial
//   POST   /cuenta/pedidos     { numero, relojId } -> crea el pedido (o devuelve el que ya tiene abierto de ese reloj)
//   POST   /cuenta/pedidos/cancelar { numero }  solo mientras esta "solicitado"
//   PUT    /cuenta/favoritos   { ids: [...] }  (reemplaza la lista, max 100)
//   POST   /cuenta/avisos      { tipo: 'reloj'|'marca', valor }   DELETE /cuenta/avisos?tipo=&valor=
//   GET    /cuenta/compras     -> compras y apartados (solo si el admin vinculo la cuenta a un cliente)
//   DELETE /cuenta             borra la cuenta y sus datos
//   POST   /cuenta/verificacion  envia (desde noreply@aphillipsstore.com) el correo para verificar la cuenta
// Publica (sin sesion), con limites por correo y por IP:
//   POST   /correo/recuperar   { email } -> envia el correo para crear una contrasena nueva (siempre { ok })
// Boletin (publicas, con limites por IP):
//   POST   /boletin            { email, nombre? } -> guarda el suscriptor y le manda un correo de bienvenida (siempre { ok })
//   GET    /boletin/baja?t=    da de baja al suscriptor del enlace del correo (pagina simple)
//   GET    /admin/boletin      -> { suscriptores: [{ email, nombre, activo, creado, baja }] }   (solo admin)
//   POST   /admin/boletin/enviar { asunto, texto, boton?, enlace?, prueba } -> correo a los suscriptores (o prueba a info@)
//   GET    /admin/errores?dias=7 -> errores de JavaScript agrupados (solo admin)
//   GET    /admin/avisos/correo -> avisos de clientes que se enviarian por correo; POST los envia (solo admin)
//   GET    /admin/informe      -> informe semanal en HTML; POST /admin/informe/enviar lo manda a info@ (solo admin)
// Rutas de admin para cuentas:
//   GET    /admin/cuentas      -> todas las cuentas con sus avisos y cuantos favoritos tienen
//   POST   /admin/cuentas/vincular  { uid, clienteId|null }
//   POST   /admin/cuentas/codigo    { uid, codigo }  -> la cuenta toma el numero de cliente (mas antiguo) de su ficha del panel
//   POST   /admin/clientes/codigos  { n }            -> n numeros de cliente nuevos (AP-00042) para clientes creados en el panel
//   GET    /sitio                    -> diseno publicado de la tienda (publica; la usa js/sitio/aplicar.js)
//   GET    /admin/sitio              -> diseno publicado + historial (ultimas 30 versiones)
//   POST   /admin/sitio  { tema, nota } -> publica un diseno (validado y con contraste suficiente)
//   GET/POST /admin/sitio/temas  { temas: [{ nombre, tema }] } -> temas guardados por el dueno (max. 20)
//   POST   /admin/avisos/avisado    { uid, tipo, valor, estado, precio }  (marca el WhatsApp como enviado)
//   GET    /admin/pedidos      -> pedidos con los datos de la cuenta (codigo, nombre, WhatsApp)
//   POST   /admin/pedidos/estado    { numero, estado, entrega?, tracking?, nota? }  (solo pasos permitidos)
//
// Tarea diaria (cron, 3:00 a. m. de Panama): respaldo de los datos en el bucket PRIVADO
// aphillips-respaldos (se guardan RETENCION_DIAS dias) y borrado de fotos que ningun reloj usa
// desde hace mas de 30 dias.
//   POST   /datos/estado       cuerpo { id, estadoEsperado, cambios, quitar } -> { ok, version, datos }
//                              cambio de estado de un reloj sin venta doble (409 si cambio en otro dispositivo)

const TIPOS = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_BYTES = 4 * 1024 * 1024;
const RE_CLAVE_FOTO = /^relojes\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/;
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// Unicos campos que pueden salir al publico (igual que camposPublicos() en js/products.js).
// Todo lo demas (costo, proveedor, margen, serie, tracking...) se descarta aqui aunque llegue.
const CAMPOS_PUBLICOS = ['id', 'nombre', 'sku', 'coleccion', 'genero', 'mm', 'materialCaja', 'materialCorrea',
  'colorEsfera', 'movimiento', 'agua', 'cristal', 'color', 'ficha', 'calibre', 'l2l', 'grosor', 'corona', 'materialBisel', 'colorBisel', 'materialEsfera', 'anchoCorrea', 'largoCorrea', 'colorCorrea', 'notas', 'descripcion', 'eta', 'precio', 'foto', 'fotos',
  'estado', '_ts', 'fotoCompartir'];
const CLAVE_CATALOGO = 'publico/catalogo.json';
const URL_CACHE_CATALOGO = 'https://api.aphillipsstore.com/__cache/catalogo';
const CAMPOS_METRICA = ['vistas', 'aperturas', 'clics'];
const MAX_ENVIOS_METRICAS = 200;   // por IP cada 10 minutos (ver sumarMetricas)

export default {
  async scheduled(evento, env, ctx) {
    ctx.waitUntil(mantenimiento(env, 'automatico'));
    // avisos a clientes por correo (reloj disponible, bajo de precio o marca con nuevos), si esta activado
    if (env.AVISOS_CORREO === '1') ctx.waitUntil(avisosPorCorreo(env, true).catch((e) => console.log('avisos por correo', e.message)));
    // informe semanal: solo los lunes y solo si esta activado (INFORME_SEMANAL = "1")
    if (env.INFORME_SEMANAL === '1' && new Date(evento.scheduledTime || Date.now()).getUTCDay() === 1) {
      ctx.waitUntil(enviarInforme(env).catch((e) => console.log('informe semanal', e.message)));
    }
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    const ruta = url.pathname, metodo = request.method;
    const publica = ((ruta === '/catalogo' || ruta === '/destacados' || ruta === '/sitio') && metodo === 'GET') || ruta === '/metricas' && metodo === 'POST' || ruta === '/boletin' || ruta === '/errores';
    const cors = encabezadosCors(request, env, publica);

    if (metodo === 'OPTIONS') return new Response(null, { status: 204, headers: encabezadosCors(request, env, ruta === '/catalogo' || ruta === '/destacados' || ruta === '/sitio' || ruta === '/metricas' || ruta === '/boletin' || ruta === '/errores') });
    if (ruta === '/salud') return json({ ok: true }, 200, cors);

    // ---------- publicas ----------
    if (ruta === '/catalogo' && metodo === 'GET') return leerCatalogo(request, env, cors);
    if (ruta === '/destacados' && metodo === 'GET') return destacadosPublicos(env, cors);
    if (ruta === '/sitio' && metodo === 'GET') return sitioPublico(env, cors);
    if (ruta === '/metricas' && metodo === 'POST') return sumarMetricas(request, env, cors);
    if (ruta === '/errores' && metodo === 'POST') return registrarError(request, env, cors);

    // ---------- boletin (publicas, con limites) ----------
    if (ruta === '/boletin' && metodo === 'POST') return suscribirBoletin(request, env, cors);
    if (ruta === '/boletin/baja' && metodo === 'GET') return bajaBoletin(url, env);

    // ---------- recuperar contrasena (publica, con limites) ----------
    if (ruta === '/correo/recuperar' && metodo === 'POST') return correoRecuperar(request, env, cors);

    // ---------- cuentas de clientes (su propia sesion) ----------
    if (ruta === '/cuenta' || ruta.startsWith('/cuenta/')) {
      let sesion;
      try { sesion = await verificarSesionFirebase(request.headers.get('Authorization'), env); }
      catch (e) { return json({ error: 'Sesion invalida: ' + e.message }, 401, cors); }
      const proveedor = sesion.firebase && sesion.firebase.sign_in_provider;
      if (!proveedor || proveedor === 'anonymous' || proveedor === 'custom') return json({ error: 'Inicia sesion con tu cuenta' }, 403, cors);
      // el correo de verificacion se pide justamente antes de estar verificado
      if (ruta === '/cuenta/verificacion' && metodo === 'POST') return correoVerificacion(request, env, cors, sesion);
      // los datos del registro (WhatsApp, terminos...) se guardan justo al crear la cuenta, antes de verificar
      if (ruta === '/cuenta/registro' && metodo === 'POST') return rutaCuenta(ruta, metodo, request, url, env, cors, sesion);
      // cuentas con correo y contrasena: deben verificar el correo (el dueno queda exento)
      if (proveedor === 'password' && !sesion.email_verified && !esDueno(sesion.sub, env)) {
        return json({ error: 'Verifica tu correo para usar tu cuenta.', falta: 'verificacion' }, 403, cors);
      }
      return rutaCuenta(ruta, metodo, request, url, env, cors, sesion);
    }

    const conocida = (ruta === '/catalogo' && metodo === 'PUT') || (ruta === '/metricas' && metodo === 'GET') ||
      (ruta === '/metricas/importar' && metodo === 'POST') ||
      (ruta === '/fotos' && (metodo === 'POST' || metodo === 'DELETE')) ||
      ((ruta === '/datos' || ruta === '/datos/resumen') && metodo === 'GET') || ((ruta === '/datos/lote' || ruta === '/datos/estado' || ruta === '/mantenimiento') && metodo === 'POST') ||
      ((ruta === '/respaldos' || ruta === '/respaldos/archivo') && metodo === 'GET') ||
      ((ruta === '/admin/cuentas' || ruta === '/admin/boletin' || ruta === '/admin/informe') && metodo === 'GET') || (ruta === '/admin/informe/enviar' && metodo === 'POST') || (ruta === '/admin/avisos/correo' && (metodo === 'GET' || metodo === 'POST')) || (ruta === '/admin/errores' && metodo === 'GET') || (ruta === '/admin/boletin/enviar' && metodo === 'POST') || ((ruta === '/admin/cuentas/vincular' || ruta === '/admin/cuentas/codigo' || ruta === '/admin/clientes/codigos' || ruta === '/admin/sitio' || ruta === '/admin/sitio/temas' || ruta === '/admin/avisos/avisado' || ruta === '/admin/pedidos/estado') && metodo === 'POST') || (ruta === '/admin/pedidos' && metodo === 'GET') || ((ruta === '/admin/sitio' || ruta === '/admin/sitio/temas') && metodo === 'GET');
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
    if (!duenos.includes(uid)) return json({ error: 'Sin permiso' }, 403, cors);

    if (ruta === '/catalogo') return publicarCatalogo(request, env, cors);
    if (ruta === '/metricas') return leerMetricas(env, cors);
    if (ruta === '/metricas/importar') return importarMetricas(request, env, cors);
    if (ruta === '/datos/resumen') return resumenDatos(env, cors);
    if (ruta === '/datos') return cambiosDatos(url, env, cors);
    if (ruta === '/datos/lote') return loteDatos(request, env, cors);
    if (ruta === '/datos/estado') return cambiarEstado(request, env, cors);
    if (ruta === '/mantenimiento') return json(await mantenimiento(env, 'manual'), 200, cors);
    if (ruta === '/respaldos') return listarRespaldos(env, cors);
    if (ruta === '/respaldos/archivo') return descargarRespaldo(url, env, cors);
    if (ruta === '/admin/cuentas') return adminCuentas(env, cors);
    if (ruta === '/admin/boletin') return adminBoletin(env, cors);
    if (ruta === '/admin/boletin/enviar') return enviarBoletin(request, env, cors);
    if (ruta === '/admin/informe') return new Response(htmlInforme(await datosInforme(env)), { headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    if (ruta === '/admin/errores') return json({ errores: await resumenErrores(env, Math.min(30, Math.max(1, Number(url.searchParams.get('dias')) || 7))) }, 200, cors);
    if (ruta === '/admin/avisos/correo') return json(await avisosPorCorreo(env, metodo === 'POST'), 200, cors);
    if (ruta === '/admin/informe/enviar') { try { return json(await enviarInforme(env), 200, cors); } catch (e) { return json({ error: e.message }, 502, cors); } }
    if (ruta === '/admin/cuentas/vincular') return adminVincular(request, env, cors);
    if (ruta === '/admin/cuentas/codigo') return adminCodigoCuenta(request, env, cors);
    if (ruta === '/admin/clientes/codigos') return adminNuevosCodigos(request, env, cors);
    if (ruta === '/admin/sitio') return metodo === 'GET' ? adminSitio(env, cors) : publicarSitio(request, env, cors);
    if (ruta === '/admin/sitio/temas') return metodo === 'GET' ? adminTemas(env, cors) : guardarTemas(request, env, cors);
    if (ruta === '/admin/avisos/avisado') return adminAvisado(request, env, cors);
    if (ruta === '/admin/pedidos') return adminPedidos(env, cors);
    if (ruta === '/admin/pedidos/estado') return adminEstadoPedido(request, env, cors);

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

      // ?mini=<clave de una foto>: es su miniatura (para las tarjetas del catalogo); va en miniaturas/<clave>
      const mini = url.searchParams.get('mini');
      if (mini !== null) {
        if (!RE_CLAVE_FOTO.test(mini) || !mini.startsWith('relojes/' + reloj + '/')) return json({ error: 'Clave invalida' }, 400, cors);
        await env.FOTOS.put('miniaturas/' + mini, datos, { httpMetadata: { contentType: tipo, cacheControl: 'public, max-age=31536000, immutable' } });
        return json({ url: env.FOTOS_URL_BASE + '/miniaturas/' + mini }, 201, cors);
      }
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
  const relojes = datos.relojes.filter((r) => r && typeof r.id === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(r.id)).map((r) => {
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
  // Limite por IP para que nadie infle los contadores a base de envios. El catalogo envia como
  // maximo cada 20 s, asi que 200 cada 10 min deja margen para varios visitantes que compartan
  // IP (datos moviles). Pasado el limite se responde ok sin sumar (la pagina no muestra error).
  const ip = await sha256(request.headers.get('CF-Connecting-IP') || 'sin-ip');
  if (!(await dentroDelLimite(env, 'met:' + ip, MAX_ENVIOS_METRICAS, 10 * MINUTO))) return json({ ok: true, sumadas: 0 }, 200, cors);
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

// ---------- destacados (publica) ----------
// Los relojes con mas clics a WhatsApp (y luego mas aperturas) que siguen a la venta en el catalogo
// publico. Solo devuelve sus ids en orden: nada privado. Cache de 10 minutos.
async function destacadosPublicos(env, cors) {
  const obj = await env.FOTOS.get(CLAVE_CATALOGO);
  let relojes = [];
  try { relojes = obj ? (JSON.parse(await obj.text()).relojes || []) : []; } catch (e) {}
  const aLaVenta = new Set(relojes.filter((r) => ['disponible', 'transito', 'bajopedido'].includes(r.estado)).map((r) => r.id));
  const { results } = await env.DB.prepare('SELECT id FROM metricas WHERE clics > 0 OR aperturas > 0 ORDER BY clics DESC, aperturas DESC, vistas DESC LIMIT 60').all();
  const ids = results.map((r) => r.id).filter((id) => aLaVenta.has(id)).slice(0, 8);
  return new Response(JSON.stringify({ ids }), { headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=600' } });
}

// ---------- cuentas de clientes ----------
const MARCAS = ['invicta', 'bulova', 'technomarine'];
const MAX_FAVORITOS = 100;
const MAX_AVISOS = 50;
const RE_ID = /^[A-Za-z0-9_-]{1,120}$/;
function esDueno(uid, env) {
  return String(env.OWNER_UID || '').split(',').map((x) => x.trim()).filter(Boolean).includes(uid);
}
function limpiarTexto(t, max) { return String(t == null ? '' : t).replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max); }
// WhatsApp: solo digitos (con + opcional al inicio); 7 a 15 digitos
function limpiarTelefono(t) {
  const s = String(t == null ? '' : t).trim();
  if (!s) return '';
  const digitos = s.replace(/[^0-9]/g, '');
  if (digitos.length < 7 || digitos.length > 15) return null;
  return (s.startsWith('+') ? '+' : '') + digitos;
}
async function leerJson(request) { try { return await request.json(); } catch (e) { return null; } }

async function rutaCuenta(ruta, metodo, request, url, env, cors, sesion) {
  const uid = sesion.sub;
  const ahora = Date.now();
  // la cuenta se crea la primera vez que el cliente entra y recibe su numero de cliente (AP-00012) del
  // contador compartido con los clientes del panel: unico y nunca se repite
  await env.DB.prepare('INSERT INTO cuentas (uid, email, nombre, telefono, creado, actualizado) VALUES (?1, ?2, ?3, \'\', ?4, ?4) ' +
    'ON CONFLICT(uid) DO UPDATE SET email = excluded.email').bind(uid, limpiarTexto(sesion.email, 120), limpiarTexto(sesion.name, 60), ahora).run();
  const sinCodigo = await env.DB.prepare('SELECT codigo FROM cuentas WHERE uid = ?1').bind(uid).first();
  if (sinCodigo && !sinCodigo.codigo) {
    const [cod] = await nuevosCodigosCliente(env, 1);
    await env.DB.prepare('UPDATE cuentas SET codigo = ?2 WHERE uid = ?1 AND codigo IS NULL').bind(uid, cod).run();
  }

  if (ruta === '/cuenta' && metodo === 'GET') {
    const c = await env.DB.prepare('SELECT * FROM cuentas WHERE uid = ?1').bind(uid).first();
    const fav = await env.DB.prepare('SELECT reloj_id FROM favoritos WHERE uid = ?1 ORDER BY creado').bind(uid).all();
    const av = await env.DB.prepare('SELECT tipo, valor, creado FROM avisos WHERE uid = ?1 ORDER BY creado DESC').bind(uid).all();
    return json({
      perfil: perfilDe(c),
      favoritos: fav.results.map((r) => r.reloj_id),
      avisos: av.results,
      vinculado: !!c.cliente_id,
      esAdmin: esDueno(uid, env)
    }, 200, cors);
  }
  if (ruta === '/cuenta' && metodo === 'DELETE') {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM favoritos WHERE uid = ?1').bind(uid),
      env.DB.prepare('DELETE FROM avisos WHERE uid = ?1').bind(uid),
      env.DB.prepare("DELETE FROM pedidos WHERE uid = ?1 AND estado IN ('solicitado', 'cancelado')").bind(uid),
      env.DB.prepare('DELETE FROM cuentas WHERE uid = ?1').bind(uid)
    ]);
    return json({ ok: true }, 200, cors);
  }
  if ((ruta === '/cuenta/perfil' && metodo === 'PUT') || (ruta === '/cuenta/registro' && metodo === 'POST')) return guardarPerfilCuenta(uid, request, env, cors);
  if (ruta === '/cuenta/favoritos' && metodo === 'PUT') {
    const b = await leerJson(request);
    if (!b || !Array.isArray(b.ids)) return json({ error: 'Faltan los favoritos' }, 400, cors);
    const ids = [...new Set(b.ids.filter((x) => typeof x === 'string' && RE_ID.test(x)))].slice(0, MAX_FAVORITOS);
    const insertar = env.DB.prepare('INSERT OR IGNORE INTO favoritos (uid, reloj_id, creado) VALUES (?1, ?2, ?3)');
    await env.DB.batch([env.DB.prepare('DELETE FROM favoritos WHERE uid = ?1').bind(uid), ...ids.map((id, i) => insertar.bind(uid, id, ahora + i))]);
    return json({ ok: true, favoritos: ids }, 200, cors);
  }
  if (ruta === '/cuenta/avisos' && metodo === 'POST') {
    const b = await leerJson(request);
    if (!b || (b.tipo !== 'reloj' && b.tipo !== 'marca') || typeof b.valor !== 'string') return json({ error: 'Aviso invalido' }, 400, cors);
    const c = await env.DB.prepare('SELECT telefono FROM cuentas WHERE uid = ?1').bind(uid).first();
    if (!c.telefono) return json({ error: 'Agrega tu WhatsApp en Mi cuenta para poder avisarte.', falta: 'telefono' }, 400, cors);
    const n = await env.DB.prepare('SELECT count(*) AS n FROM avisos WHERE uid = ?1').bind(uid).first();
    if (n.n >= MAX_AVISOS) return json({ error: 'Llegaste al maximo de ' + MAX_AVISOS + ' avisos.' }, 400, cors);
    let estado = '', precio = 0;
    if (b.tipo === 'reloj') {
      const r = await relojPublico(b.valor, env);
      if (!r) return json({ error: 'Ese reloj ya no esta en el catalogo' }, 404, cors);
      estado = r.estado || ''; precio = Number(r.precio) || 0;
    } else if (!MARCAS.includes(b.valor)) return json({ error: 'Marca desconocida' }, 400, cors);
    await env.DB.prepare('INSERT INTO avisos (uid, tipo, valor, estado_base, precio_base, creado) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ' +
      'ON CONFLICT(uid, tipo, valor) DO NOTHING').bind(uid, b.tipo, b.valor, estado, precio, ahora).run();
    return json({ ok: true }, 200, cors);
  }
  if (ruta === '/cuenta/avisos' && metodo === 'DELETE') {
    await env.DB.prepare('DELETE FROM avisos WHERE uid = ?1 AND tipo = ?2 AND valor = ?3')
      .bind(uid, url.searchParams.get('tipo') || '', url.searchParams.get('valor') || '').run();
    return json({ ok: true }, 200, cors);
  }
  if (ruta === '/cuenta/compras' && metodo === 'GET') return comprasCliente(uid, env, cors);
  if (ruta === '/cuenta/pedidos' && metodo === 'GET') return pedidosCliente(uid, env, cors);
  if (ruta === '/cuenta/pedidos' && metodo === 'POST') return crearPedido(uid, request, env, cors);
  if (ruta === '/cuenta/pedidos/cancelar' && metodo === 'POST') return cancelarPedidoCliente(uid, request, env, cors);
  return json({ error: 'No encontrado' }, 404, cors);
}

// ---------- perfil completo, codigo de cliente y pedidos ----------
// WhatsApp normalizado: solo digitos. 7 u 8 digitos = Panama (se le pone 507). Otros paises: con su
// codigo (8 a 15 digitos). Devuelve { norm, bonito } o null si no es un numero valido.
function normalizarTelefono(t) {
  let d = String(t == null ? '' : t).replace(/[^0-9]/g, '');
  if (!d) return { norm: '', bonito: '' };
  if (d.length === 7 || d.length === 8) d = '507' + d;
  if (d.length < 10 || d.length > 15) return null;
  if (d.startsWith('507') && (d.length === 10 || d.length === 11)) {
    const n = d.slice(3);
    return { norm: d, bonito: '+507 ' + (n.length === 8 ? n.slice(0, 4) + '-' + n.slice(4) : n.slice(0, 3) + '-' + n.slice(3)) };
  }
  return { norm: d, bonito: '+' + d };
}
const PROVINCIAS = ['Bocas del Toro', 'Chiriqui', 'Cocle', 'Colon', 'Darien', 'Herrera', 'Los Santos', 'Panama', 'Panama Oeste', 'Veraguas',
  'Comarca Guna Yala', 'Comarca Embera-Wounaan', 'Comarca Ngabe-Bugle'];
const CONTACTOS = ['whatsapp', 'llamada', 'correo'];
function leerDireccion(txt) { try { const d = JSON.parse(txt || '{}'); return d && typeof d === 'object' ? d : {}; } catch (e) { return {}; } }
function perfilDe(c) {
  return {
    codigo: c.codigo || '', email: c.email || '', nombre: c.nombre || '', apellido: c.apellido || '',
    telefono: c.telefono || '', cedula: c.cedula || '', nacimiento: c.nacimiento || '', muneca: c.muneca || '',
    contacto: c.contacto || 'whatsapp', novedades: !!c.novedades, direccion: leerDireccion(c.direccion),
    terminos: !!c.terminos, mayorEdad: !!c.mayor_edad,
    completo: !!(c.nombre && c.apellido && c.tel_norm && c.terminos && c.mayor_edad)
  };
}
function edadDe(fecha) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha || '');
  if (!m) return -1;
  const n = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])), hoy = new Date();
  if (isNaN(n) || +m[1] < 1900) return -1;
  let e = hoy.getUTCFullYear() - n.getUTCFullYear();
  if (hoy.getUTCMonth() < n.getUTCMonth() || (hoy.getUTCMonth() === n.getUTCMonth() && hoy.getUTCDate() < n.getUTCDate())) e--;
  return e;
}
// Guarda el perfil. Poka-yoke en el servidor: aunque alguien salte las validaciones del navegador,
// aqui no entra un WhatsApp invalido o repetido, ni una cuenta sin aceptar terminos y ser mayor de edad.
async function guardarPerfilCuenta(uid, request, env, cors) {
  const b = await leerJson(request);
  if (!b) return json({ error: 'Datos invalidos' }, 400, cors);
  const c = await env.DB.prepare('SELECT * FROM cuentas WHERE uid = ?1').bind(uid).first();
  const nombre = limpiarTexto(b.nombre, 60), apellido = limpiarTexto(b.apellido, 60);
  if (!nombre) return json({ error: 'Escribe tu nombre.', campo: 'nombre' }, 400, cors);
  if (!apellido) return json({ error: 'Escribe tu apellido.', campo: 'apellido' }, 400, cors);
  const tel = normalizarTelefono(b.telefono);
  if (!tel || !tel.norm) return json({ error: 'Revisa tu telefono: 8 digitos si es de Panama, o con el codigo de tu pais.', campo: 'telefono' }, 400, cors);
  const otro = await env.DB.prepare('SELECT codigo FROM cuentas WHERE tel_norm = ?1 AND uid <> ?2').bind(tel.norm, uid).first();
  if (otro) return json({ error: 'Ese telefono ya esta registrado en otra cuenta. Si es tuyo, inicia sesion con esa cuenta o escribenos.', campo: 'telefono' }, 409, cors);
  const terminos = c.terminos || (b.terminos === true ? Date.now() : 0);
  const mayor = c.mayor_edad || (b.mayorEdad === true ? Date.now() : 0);
  if (!terminos) return json({ error: 'Para crear tu cuenta debes aceptar los terminos y la politica de privacidad.', campo: 'terminos' }, 400, cors);
  if (!mayor) return json({ error: 'Debes confirmar que eres mayor de 18 anos.', campo: 'mayorEdad' }, 400, cors);
  const nacimiento = limpiarTexto(b.nacimiento, 10);
  if (nacimiento) {
    const e = edadDe(nacimiento);
    if (e < 0 || e > 110) return json({ error: 'Revisa tu fecha de nacimiento.', campo: 'nacimiento' }, 400, cors);
    if (e < 18) return json({ error: 'Debes ser mayor de 18 anos.', campo: 'nacimiento' }, 400, cors);
  }
  let muneca = String(b.muneca == null ? '' : b.muneca).replace(',', '.').trim();
  if (muneca) {
    const n = Number(muneca);
    if (!(n >= 12 && n <= 25)) return json({ error: 'La medida de tu muneca va en centimetros (entre 12 y 25).', campo: 'muneca' }, 400, cors);
    muneca = String(Math.round(n * 10) / 10);
  }
  const contacto = CONTACTOS.includes(b.contacto) ? b.contacto : (c.contacto || 'whatsapp');
  const novedades = b.novedades === undefined ? (c.novedades ? 1 : 0) : (b.novedades === true ? 1 : 0);
  let direccion = leerDireccion(c.direccion);
  if (b.direccion && typeof b.direccion === 'object') {
    const d = b.direccion;
    direccion = {
      provincia: PROVINCIAS.includes(d.provincia) ? d.provincia : '',
      ciudad: limpiarTexto(d.ciudad, 80), linea: limpiarTexto(d.linea, 160), referencia: limpiarTexto(d.referencia, 160)
    };
    if ((direccion.linea || direccion.ciudad) && !direccion.provincia) return json({ error: 'Elige la provincia de tu direccion.', campo: 'provincia' }, 400, cors);
  }
  try {
    await env.DB.prepare('UPDATE cuentas SET nombre = ?2, apellido = ?3, telefono = ?4, tel_norm = ?5, terminos = ?6, mayor_edad = ?7, novedades = ?8, ' +
      'cedula = ?9, nacimiento = ?10, muneca = ?11, contacto = ?12, direccion = ?13, actualizado = ?14 WHERE uid = ?1')
      .bind(uid, nombre, apellido, tel.bonito, tel.norm, terminos, mayor, novedades, limpiarTexto(b.cedula, 20).toUpperCase(),
        nacimiento, muneca, contacto, JSON.stringify(direccion), Date.now()).run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message))) return json({ error: 'Ese telefono ya esta registrado en otra cuenta.', campo: 'telefono' }, 409, cors);
    throw e;
  }
  try { await unirConClientePanel(uid, tel.norm, env); } catch (e) { console.error('unir cliente', e && e.message); }
  const nueva = await env.DB.prepare('SELECT * FROM cuentas WHERE uid = ?1').bind(uid).first();
  return json({ ok: true, perfil: perfilDe(nueva) }, 200, cors);
}

const RE_PEDIDO = /^P-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/;
const PASOS_PEDIDO = { solicitado: ['confirmado', 'cancelado'], confirmado: ['pagado', 'cancelado'], pagado: ['enviado', 'entregado'], enviado: ['entregado'], entregado: [], cancelado: [] };
const MAX_PEDIDOS_ABIERTOS = 10;
function pedidoDe(f) {
  let h = []; try { h = JSON.parse(f.historial || '[]'); } catch (e) {}
  return { numero: f.numero, relojId: f.reloj_id, reloj: f.reloj, sku: f.sku, foto: f.foto, precio: f.precio, estado: f.estado,
    entrega: f.entrega, direccion: leerDireccion(f.direccion), tracking: f.tracking, nota: f.nota, historial: h, creado: f.creado, actualizado: f.actualizado };
}
async function pedidosCliente(uid, env, cors) {
  const r = await env.DB.prepare('SELECT * FROM pedidos WHERE uid = ?1 ORDER BY creado DESC LIMIT 100').bind(uid).all();
  return json({ pedidos: r.results.map(pedidoDe) }, 200, cors);
}
async function crearPedido(uid, request, env, cors) {
  const b = await leerJson(request);
  if (!b || !RE_PEDIDO.test(b.numero || '') || typeof b.relojId !== 'string') return json({ error: 'Pedido invalido' }, 400, cors);
  const c = await env.DB.prepare('SELECT * FROM cuentas WHERE uid = ?1').bind(uid).first();
  if (!perfilDe(c).completo) return json({ error: 'Completa tus datos en Mi cuenta para hacer pedidos.', falta: 'perfil' }, 400, cors);
  // si ya tiene un pedido abierto de ese reloj, se usa ese (no se duplica con cada toque)
  const abierto = await env.DB.prepare("SELECT * FROM pedidos WHERE uid = ?1 AND reloj_id = ?2 AND estado IN ('solicitado', 'confirmado') ORDER BY creado DESC").bind(uid, b.relojId).first();
  if (abierto) return json({ ok: true, existente: true, pedido: pedidoDe(abierto) }, 200, cors);
  const n = await env.DB.prepare("SELECT count(*) AS n FROM pedidos WHERE uid = ?1 AND estado IN ('solicitado', 'confirmado')").bind(uid).first();
  if (n.n >= MAX_PEDIDOS_ABIERTOS) return json({ error: 'Tienes muchos pedidos abiertos. Escribenos por WhatsApp para continuarlos.' }, 429, cors);
  const r = await relojPublico(b.relojId, env);
  if (!r) return json({ error: 'Ese reloj ya no esta en el catalogo.' }, 404, cors);
  if (!['disponible', 'transito', 'bajopedido'].includes(r.estado)) return json({ error: 'Ese reloj ya no esta disponible.' }, 409, cors);
  const ahora = Date.now();
  const foto = typeof r.foto === 'string' && r.foto.startsWith('https://') ? r.foto : '';
  const historial = JSON.stringify([{ estado: 'solicitado', fecha: ahora }]);
  try {
    await env.DB.prepare('INSERT INTO pedidos (numero, uid, reloj_id, reloj, sku, foto, precio, estado, direccion, historial, creado, actualizado) ' +
      "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'solicitado', ?8, ?9, ?10, ?10)")
      .bind(b.numero, uid, r.id, limpiarTexto(r.nombre, 120), limpiarTexto(r.sku, 40), foto, Number(r.precio) || 0, c.direccion || '{}', historial, ahora).run();
  } catch (e) {
    if (/UNIQUE|PRIMARY/i.test(String(e && e.message))) return json({ error: 'Numero de pedido repetido', repetido: true }, 409, cors);
    throw e;
  }
  const f = await env.DB.prepare('SELECT * FROM pedidos WHERE numero = ?1').bind(b.numero).first();
  return json({ ok: true, pedido: pedidoDe(f) }, 200, cors);
}
async function cancelarPedidoCliente(uid, request, env, cors) {
  const b = await leerJson(request);
  if (!b || !RE_PEDIDO.test(b.numero || '')) return json({ error: 'Pedido invalido' }, 400, cors);
  const f = await env.DB.prepare('SELECT * FROM pedidos WHERE numero = ?1 AND uid = ?2').bind(b.numero, uid).first();
  if (!f) return json({ error: 'No encontrado' }, 404, cors);
  if (f.estado !== 'solicitado') return json({ error: 'Este pedido ya fue confirmado; para cambiarlo escribenos por WhatsApp.' }, 409, cors);
  const h = pedidoDe(f).historial; h.push({ estado: 'cancelado', fecha: Date.now(), nota: 'Cancelado por el cliente' });
  await env.DB.prepare("UPDATE pedidos SET estado = 'cancelado', historial = ?2, actualizado = ?3 WHERE numero = ?1").bind(b.numero, JSON.stringify(h), Date.now()).run();
  return json({ ok: true }, 200, cors);
}
async function adminPedidos(env, cors) {
  const r = await env.DB.prepare('SELECT p.*, c.codigo, c.nombre AS c_nombre, c.apellido AS c_apellido, c.telefono AS c_tel, c.email AS c_email, c.cliente_id AS c_cliente ' +
    'FROM pedidos p LEFT JOIN cuentas c ON c.uid = p.uid ORDER BY p.creado DESC LIMIT 300').all();
  return json({ pedidos: r.results.map((f) => Object.assign(pedidoDe(f), {
    uid: f.uid, cuenta: f.codigo ? { codigo: f.codigo, nombre: f.c_nombre, apellido: f.c_apellido, telefono: f.c_tel, email: f.c_email, clienteId: f.c_cliente || '' } : null
  })) }, 200, cors);
}
async function adminEstadoPedido(request, env, cors) {
  const b = await leerJson(request);
  if (!b || !RE_PEDIDO.test(b.numero || '')) return json({ error: 'Pedido invalido' }, 400, cors);
  const f = await env.DB.prepare('SELECT * FROM pedidos WHERE numero = ?1').bind(b.numero).first();
  if (!f) return json({ error: 'No encontrado' }, 404, cors);
  // poka-yoke: solo se avanza por los pasos permitidos (no se puede, por ejemplo, entregar algo cancelado)
  if (!(PASOS_PEDIDO[f.estado] || []).includes(b.estado)) return json({ error: 'No se puede pasar de "' + f.estado + '" a "' + b.estado + '".' }, 409, cors);
  const entrega = b.entrega === 'envio' || b.entrega === 'retiro' ? b.entrega : f.entrega;
  const tracking = b.tracking !== undefined ? limpiarTexto(b.tracking, 80) : f.tracking;
  const nota = b.nota !== undefined ? limpiarTexto(b.nota, 300) : f.nota;
  const h = pedidoDe(f).historial; h.push({ estado: b.estado, fecha: Date.now(), nota: limpiarTexto(b.nota, 300) || undefined });
  await env.DB.prepare('UPDATE pedidos SET estado = ?2, entrega = ?3, tracking = ?4, nota = ?5, historial = ?6, actualizado = ?7 WHERE numero = ?1')
    .bind(b.numero, b.estado, entrega, tracking, nota, JSON.stringify(h), Date.now()).run();
  const n = await env.DB.prepare('SELECT * FROM pedidos WHERE numero = ?1').bind(b.numero).first();
  return json({ ok: true, pedido: pedidoDe(n) }, 200, cors);
}


async function relojPublico(id, env) {
  if (!RE_ID.test(id)) return null;
  const obj = await env.FOTOS.get(CLAVE_CATALOGO);
  if (!obj) return null;
  try { return (JSON.parse(await obj.text()).relojes || []).find((r) => r.id === id) || null; } catch (e) { return null; }
}

// Solo datos que el cliente ya conoce (lo que pago y lo que le falta). Nunca costos ni margenes.
async function comprasCliente(uid, env, cors) {
  const c = await env.DB.prepare('SELECT cliente_id FROM cuentas WHERE uid = ?1').bind(uid).first();
  if (!c || !c.cliente_id) return json({ vinculado: false, compras: [], apartados: [] }, 200, cors);
  const cid = c.cliente_id;
  const movs = await env.DB.prepare("SELECT datos FROM docs WHERE col = 'movimientos' AND borrado = 0 AND json_extract(datos, '$.clienteId') = ?1").bind(cid).all();
  const compras = [];
  for (const f of movs.results) {
    let m; try { m = JSON.parse(f.datos); } catch (e) { continue; }
    if (m.tipo !== 'venta' && m.tipo !== 'abono') continue;
    compras.push({ tipo: m.tipo, descripcion: limpiarTexto(m.desc, 160), monto: Number(m.monto) || 0, fecha: m.fecha || '', _ts: m._ts || 0 });
  }
  compras.sort((a, b) => b._ts - a._ts);
  const inv = await env.DB.prepare("SELECT id, datos FROM docs WHERE col = 'inventario' AND borrado = 0 AND json_extract(datos, '$.reserva.clienteId') = ?1").bind(cid).all();
  const apartados = [];
  for (const f of inv.results) {
    let p; try { p = JSON.parse(f.datos); } catch (e) { continue; }
    if (p.estado !== 'reservado' || !p.reserva) continue;
    const abonado = (p.reserva.abonos || []).reduce((t, a) => t + (Number(a.monto) || 0), 0);
    const acordado = Number(p.reserva.precioAcordado) || 0;
    apartados.push({ id: f.id, reloj: limpiarTexto(p.nombre, 120), sku: limpiarTexto(p.sku, 40), foto: typeof p.foto === 'string' && p.foto.startsWith('https://') ? p.foto : '',
      precioAcordado: acordado, abonado, saldo: Math.max(0, acordado - abonado), desde: p.reserva.fechaInicio || '' });
  }
  return json({ vinculado: true, compras, apartados }, 200, cors);
}

async function adminCuentas(env, cors) {
  const cuentas = (await env.DB.prepare('SELECT uid, codigo, email, nombre, apellido, telefono, novedades, cliente_id, creado FROM cuentas ORDER BY creado DESC').all()).results;
  const favs = (await env.DB.prepare('SELECT uid, count(*) AS n FROM favoritos GROUP BY uid').all()).results;
  const avisos = (await env.DB.prepare('SELECT uid, tipo, valor, estado_base, precio_base, creado, avisado FROM avisos').all()).results;
  const nFav = Object.fromEntries(favs.map((r) => [r.uid, r.n]));
  const porUid = {};
  for (const a of avisos) (porUid[a.uid] || (porUid[a.uid] = [])).push(a);
  return json({ cuentas: cuentas.map((c) => ({ ...c, favoritos: nFav[c.uid] || 0, avisos: porUid[c.uid] || [] })) }, 200, cors);
}
// ---------- numero de cliente (AP-00012), uno solo por persona ----------
// Un solo contador para las cuentas de la tienda y los clientes creados en el panel, asi nunca se repite.
// Al arrancar se pone por encima del numero mas alto que ya exista (cuentas viejas y clientes del panel).
const RE_CODIGO = /^AP-(\d{5,9})$/;
function numeroCodigo(c) { const m = RE_CODIGO.exec(String(c || '')); return m ? Number(m[1]) : 0; }
function textoCodigo(n) { return 'AP-' + String(n).padStart(5, '0'); }
async function nuevosCodigosCliente(env, n) {
  const a = await env.DB.prepare("SELECT MAX(CAST(substr(codigo, 4) AS INTEGER)) AS m FROM cuentas WHERE codigo LIKE 'AP-%'").first();
  const b = await env.DB.prepare("SELECT MAX(CAST(substr(json_extract(datos, '$.codigo'), 4) AS INTEGER)) AS m FROM docs WHERE col = 'clientes' AND borrado = 0 AND json_extract(datos, '$.codigo') LIKE 'AP-%'").first();
  const piso = Math.max(Number(a && a.m) || 0, Number(b && b.m) || 0);
  await env.DB.prepare("INSERT INTO contador (nombre, valor) VALUES ('codigo_cliente', ?1) ON CONFLICT(nombre) DO UPDATE SET valor = MAX(valor, excluded.valor)").bind(piso).run();
  const r = await env.DB.prepare("UPDATE contador SET valor = valor + ?1 WHERE nombre = 'codigo_cliente' RETURNING valor").bind(n).first();
  const fin = Number(r.valor), out = [];
  for (let i = fin - n + 1; i <= fin; i++) out.push(textoCodigo(i));
  return out;
}
async function adminNuevosCodigos(request, env, cors) {
  const b = await leerJson(request);
  const n = Math.floor(Number(b && b.n));
  if (!(n >= 1 && n <= 500)) return json({ error: 'Cantidad invalida' }, 400, cors);
  return json({ codigos: await nuevosCodigosCliente(env, n) }, 200, cors);
}
// La cuenta toma el numero de su ficha del panel cuando ese es mas antiguo (queda un solo numero por persona)
async function adminCodigoCuenta(request, env, cors) {
  const b = await leerJson(request);
  if (!b || typeof b.uid !== 'string' || !RE_CODIGO.test(String(b.codigo || ''))) return json({ error: 'Datos invalidos' }, 400, cors);
  const otra = await env.DB.prepare('SELECT uid FROM cuentas WHERE codigo = ?1 AND uid <> ?2').bind(b.codigo, b.uid).first();
  if (otra) return json({ error: 'Ese numero ya es de otra cuenta' }, 409, cors);
  await env.DB.prepare('UPDATE cuentas SET codigo = ?2, actualizado = ?3 WHERE uid = ?1').bind(b.uid, b.codigo, Date.now()).run();
  return json({ ok: true }, 200, cors);
}
// Cuando un cliente guarda su WhatsApp y ese numero ya esta en un cliente del panel, la cuenta se vincula
// sola (ve sus compras y apartados) y se queda con el numero de cliente mas antiguo de los dos.
async function unirConClientePanel(uid, telNorm, env) {
  if (!telNorm) return;
  const c = await env.DB.prepare('SELECT codigo, cliente_id FROM cuentas WHERE uid = ?1').bind(uid).first();
  if (!c || c.cliente_id) return;
  const filas = (await env.DB.prepare("SELECT id, datos FROM docs WHERE col = 'clientes' AND borrado = 0").all()).results;
  let elegido = null;
  for (const f of filas) {
    let cl; try { cl = JSON.parse(f.datos); } catch (e) { continue; }
    const t = normalizarTelefono(cl.tel || cl.telefono || '');
    if (!t || t.norm !== telNorm || !RE_ID.test(f.id)) continue;
    if (!elegido || (Number(cl._ts) || 0) < (Number(elegido.cl._ts) || 0)) elegido = { id: f.id, cl };   // el mas antiguo
  }
  if (!elegido) return;
  await env.DB.prepare('UPDATE cuentas SET cliente_id = ?2, actualizado = ?3 WHERE uid = ?1').bind(uid, elegido.id, Date.now()).run();
  const suyo = numeroCodigo(elegido.cl.codigo), mio = numeroCodigo(c.codigo);
  if (suyo && (!mio || suyo < mio)) {
    const otra = await env.DB.prepare('SELECT uid FROM cuentas WHERE codigo = ?1 AND uid <> ?2').bind(elegido.cl.codigo, uid).first();
    if (!otra) await env.DB.prepare('UPDATE cuentas SET codigo = ?2 WHERE uid = ?1').bind(uid, elegido.cl.codigo).run();
  }
}

// ---------- diseno de la tienda (editor del panel) ----------
// Misma validacion que js/sitio/tema.js (si cambias una, cambia la otra). Se guarda en la tabla "ajustes":
// sitio_publicado = { version, fecha, nota, tema } y sitio_historial = [ las 30 versiones anteriores ].
const SITIO_BASE = { acento: '#a7c4d6', barraFondo: '#a7c4d6', barraTexto: '#09090b', botonFondo: '#09090b', botonTexto: '#ffffff',
  oscuro: '#0b0b0c', carrusel: '#c3d6e3', formaBotones: 'original', esquinasFotos: -1, escalaTitulos: 100 };
const SITIO_COLORES = ['acento', 'barraFondo', 'barraTexto', 'botonFondo', 'botonTexto', 'oscuro', 'carrusel'];
const SITIO_FORMAS = ['original', 'recta', 'suave', 'pildora'];
function sitioHex(v) {
  let t = String(v == null ? '' : v).trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(t)) t = '#' + t[1] + t[1] + t[2] + t[2] + t[3] + t[3];
  return /^#[0-9a-f]{6}$/.test(t) ? t : null;
}
function validarSitioTema(t) {
  t = t && typeof t === 'object' ? t : {};
  const out = {};
  for (const k of SITIO_COLORES) out[k] = sitioHex(t[k]) || SITIO_BASE[k];
  out.formaBotones = SITIO_FORMAS.includes(t.formaBotones) ? t.formaBotones : 'original';
  const e = Math.round(Number(t.esquinasFotos)); out.esquinasFotos = isFinite(e) && e >= 0 && e <= 24 ? e : -1;
  const z = Math.round(Number(t.escalaTitulos)); out.escalaTitulos = isFinite(z) && z >= 85 && z <= 125 ? z : 100;
  return out;
}
function sitioLum(h) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
}
function sitioContraste(a, b) { const x = sitioLum(a), y = sitioLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function sitioProblemas(t) {
  return [[t.barraTexto, t.barraFondo], [t.botonTexto, t.botonFondo], ['#09090b', t.acento], ['#ffffff', t.oscuro]]
    .filter(([a, b]) => sitioContraste(a, b) < 4.5).length;
}
async function leerAjuste(env, nombre, porDefecto) {
  const f = await env.DB.prepare('SELECT valor FROM ajustes WHERE nombre = ?1').bind(nombre).first();
  if (!f) return porDefecto;
  try { return JSON.parse(f.valor); } catch (e) { return porDefecto; }
}
function guardarAjuste(env, nombre, valor) {
  return env.DB.prepare('INSERT INTO ajustes (nombre, valor) VALUES (?1, ?2) ON CONFLICT(nombre) DO UPDATE SET valor = excluded.valor').bind(nombre, JSON.stringify(valor));
}
async function sitioPublico(env, cors) {
  const p = await leerAjuste(env, 'sitio_publicado', { version: 0, tema: {} });
  return json({ version: p.version || 0, tema: validarSitioTema(p.tema) }, 200, { ...cors, 'Cache-Control': 'public, max-age=30' });
}
async function adminSitio(env, cors) {
  const p = await leerAjuste(env, 'sitio_publicado', { version: 0, tema: {} });
  const h = await leerAjuste(env, 'sitio_historial', []);
  return json({ publicado: { version: p.version || 0, fecha: p.fecha || 0, nota: p.nota || '', tema: validarSitioTema(p.tema) }, historial: Array.isArray(h) ? h : [] }, 200, cors);
}
async function publicarSitio(request, env, cors) {
  const b = await leerJson(request);
  if (!b || !b.tema) return json({ error: 'Falta el diseno' }, 400, cors);
  const tema = validarSitioTema(b.tema);
  if (sitioProblemas(tema)) return json({ error: 'Hay textos que no se leerian bien sobre su fondo. Corrige los colores marcados.' }, 400, cors);
  const antes = await leerAjuste(env, 'sitio_publicado', null);
  let hist = await leerAjuste(env, 'sitio_historial', []); if (!Array.isArray(hist)) hist = [];
  if (antes && antes.tema) hist.unshift(antes);
  hist = hist.slice(0, 30);
  const nuevo = { version: ((antes && antes.version) || 0) + 1, fecha: Date.now(), nota: limpiarTexto(b.nota, 80), tema };
  await env.DB.batch([guardarAjuste(env, 'sitio_publicado', nuevo), guardarAjuste(env, 'sitio_historial', hist)]);
  return json({ ok: true, publicado: nuevo }, 200, cors);
}
async function adminTemas(env, cors) {
  const t = await leerAjuste(env, 'sitio_temas', []);
  return json({ temas: Array.isArray(t) ? t : [] }, 200, cors);
}
async function guardarTemas(request, env, cors) {
  const b = await leerJson(request);
  if (!b || !Array.isArray(b.temas)) return json({ error: 'Datos invalidos' }, 400, cors);
  const temas = b.temas.slice(0, 20).map((x) => ({ nombre: limpiarTexto(x && x.nombre, 40) || 'Mi tema', tema: validarSitioTema(x && x.tema) }));
  await guardarAjuste(env, 'sitio_temas', temas).run();
  return json({ ok: true, temas }, 200, cors);
}
async function adminVincular(request, env, cors) {
  const b = await leerJson(request);
  if (!b || typeof b.uid !== 'string') return json({ error: 'Falta la cuenta' }, 400, cors);
  const cid = b.clienteId == null || b.clienteId === '' ? null : String(b.clienteId);
  if (cid !== null && !RE_ID.test(cid)) return json({ error: 'Cliente invalido' }, 400, cors);
  await env.DB.prepare('UPDATE cuentas SET cliente_id = ?2, actualizado = ?3 WHERE uid = ?1').bind(b.uid, cid, Date.now()).run();
  return json({ ok: true }, 200, cors);
}
async function adminAvisado(request, env, cors) {
  const b = await leerJson(request);
  if (!b || typeof b.uid !== 'string' || typeof b.tipo !== 'string' || typeof b.valor !== 'string') return json({ error: 'Aviso invalido' }, 400, cors);
  await env.DB.prepare('UPDATE avisos SET avisado = ?4, estado_base = ?5, precio_base = ?6 WHERE uid = ?1 AND tipo = ?2 AND valor = ?3')
    .bind(b.uid, b.tipo, b.valor, Date.now(), limpiarTexto(b.estado, 20), Number(b.precio) || 0).run();
  return json({ ok: true }, 200, cors);
}

// ---------- correos de la cuenta (verificacion y contrasena) ----------
// Firebase genera el enlace (con la llave de servicio FIREBASE_SA) y el correo sale con Cloudflare
// Email Sending desde noreply@aphillipsstore.com, con el diseno de la tienda. El enlace lleva a la
// tienda (?modo=verificar|contrasena&oobCode=...) y alli el catalogo termina la accion.
// Sin FIREBASE_SA o sin el binding EMAIL se responde 503 y el catalogo usa los correos de Firebase.
const REMITENTE = { email: 'noreply@aphillipsstore.com', name: 'APHILLIPS STORE' };
const RESPONDER_A = 'info@aphillipsstore.com';
const TIENDA = 'https://aphillipsstore.com/';
const MINUTO = 60000;

function b64urlTexto(t) { return b64urlDeBytes(new TextEncoder().encode(t)); }
function b64urlDeBytes(bytes) {
  let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
let _tokenGoogle = { token: null, vence: 0 };
async function tokenGoogle(env) {
  if (_tokenGoogle.token && Date.now() < _tokenGoogle.vence) return _tokenGoogle.token;
  // (al guardarlo desde PowerShell puede llegar con un BOM invisible al inicio)
  const sa = JSON.parse(String(env.FIREBASE_SA).replace(/^\uFEFF/, '').trim());
  const ahora = Math.floor(Date.now() / 1000);
  const cab = b64urlTexto(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const cuerpo = b64urlTexto(JSON.stringify({ iss: sa.client_email, aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/identitytoolkit' }));
  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const llave = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const firma = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', llave, new TextEncoder().encode(cab + '.' + cuerpo)));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + cab + '.' + cuerpo + '.' + b64urlDeBytes(firma) });
  const d = await r.json();
  if (!r.ok) throw new Error('token de Google: ' + (d.error_description || d.error || r.status));
  _tokenGoogle = { token: d.access_token, vence: Date.now() + Math.max(60, (d.expires_in || 3600) - 300) * 1000 };
  return d.access_token;
}
// tipo: 'VERIFY_EMAIL' | 'PASSWORD_RESET'. Devuelve el enlace a la tienda, o null si el correo no tiene cuenta.
async function enlaceFirebase(env, tipo, email) {
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/projects/' + env.FIREBASE_PROJECT_ID + '/accounts:sendOobCode', {
    method: 'POST', headers: { 'Authorization': 'Bearer ' + await tokenGoogle(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestType: tipo, email, returnOobLink: true })
  });
  const d = await r.json();
  if (!r.ok) {
    const msg = (d.error && d.error.message) || String(r.status);
    if (/EMAIL_NOT_FOUND|USER_NOT_FOUND/.test(msg)) return null;
    throw new Error('Firebase: ' + msg);
  }
  // con la proteccion contra enumeracion de correos, Firebase responde sin enlace si el correo no tiene cuenta
  if (!d.oobLink) return null;
  const codigo = new URL(d.oobLink).searchParams.get('oobCode');
  return TIENDA + '?modo=' + (tipo === 'VERIFY_EMAIL' ? 'verificar' : 'contrasena') + '&oobCode=' + encodeURIComponent(codigo);
}
function htmlCorreo({ titulo, saludo, texto, boton, enlace, nota, baja }) {
  const e = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Modo oscuro: Gmail (iPhone) invierte los colores y dejaba el logo y el boton en blanco. Lo negro se pinta
  // tambien como imagen de fondo (linear-gradient), que Gmail no invierte, y el texto del boton usa el truco
  // "gmail-blend" (u + .body ...: mix-blend-mode screen/difference) para seguir viendose blanco.
  const NEGRO = 'background-color:#000000;background-image:linear-gradient(#000000,#000000);';
  // colores de la tienda: encabezado y boton en azul glaciar con logo y letras negras (el fondo tambien va
  // como imagen para que el modo oscuro de Gmail no lo cambie)
  const GLACIAR = 'background-color:#A7C4D6;background-image:linear-gradient(#A7C4D6,#A7C4D6);';
  void NEGRO;
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>' + e(titulo) + '</title>' +
    '<style>u + .body .gb-scr{background:#000;mix-blend-mode:screen;} u + .body .gb-dif{background:#000;mix-blend-mode:difference;}</style></head>' +
    '<body class="body" style="margin:0;padding:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;color:#09090b;"><u></u>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;">' +
    // logo de la tienda (img/logo-correo.png); si el correo bloquea imagenes se ve el texto APHILLIPS
    '<tr><td bgcolor="#A7C4D6" style="' + GLACIAR + 'padding:24px 32px;text-align:center;"><img src="' + TIENDA + 'img/logo-correo-negro.png" width="240" alt="APHILLIPS" style="display:block;margin:0 auto;border:0;outline:none;width:240px;max-width:100%;height:auto;color:#000000;font-family:Georgia,serif;font-size:24px;letter-spacing:4px;font-weight:bold;"></td></tr>' +
    '<tr><td style="padding:36px 32px 8px;">' +
      '<p style="margin:0 0 14px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#6a6a6a;">' + e(titulo) + '</p>' +
      '<p style="margin:0 0 16px;font-size:16px;line-height:24px;">' + e(saludo) + '</p>' +
      '<p style="margin:0 0 28px;font-size:15px;line-height:23px;color:#333333;">' + e(texto).split(String.fromCharCode(10)).join('<br>') + '</p>' +
      '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#A7C4D6" style="' + GLACIAR + '">' +
        '<a href="' + e(enlace) + '" style="display:inline-block;padding:16px 30px;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#000000;text-decoration:none;' + GLACIAR + '">' +
          '<span style="display:block;color:#000000;">' + e(boton) + '</span></a>' +
      '</td></tr></table>' +
      '<p style="margin:28px 0 0;font-size:12px;line-height:18px;color:#6a6a6a;">Si el botón no funciona, copia este enlace en tu navegador:<br><a href="' + e(enlace) + '" style="color:#09090b;word-break:break-all;">' + e(enlace) + '</a></p>' +
      '<p style="margin:18px 0 0;font-size:12px;line-height:18px;color:#6a6a6a;">' + e(nota) + (baja ? ' <a href="' + e(baja) + '" style="color:#09090b;">Darme de baja</a>' : '') + '</p>' +
    '</td></tr>' +
    '<tr><td style="padding:28px 32px 32px;border-top:1px solid #e4e4e7;margin-top:24px;font-size:11px;line-height:17px;color:#8a8a8a;text-align:center;">' +
      'APHILLIPS STORE · Relojes en Panamá<br><a href="' + TIENDA + '" style="color:#8a8a8a;">aphillipsstore.com</a> · ¿Dudas? Responde a este correo.' +
    '</td></tr></table></td></tr></table></body></html>';
}
async function enviarCorreo(env, para, asunto, datos) {
  const texto = datos.saludo + '\n\n' + datos.texto + '\n\n' + datos.boton + ': ' + datos.enlace + '\n\n' + datos.nota + (datos.baja ? ' ' + datos.baja : '') + '\n\nAPHILLIPS STORE · aphillipsstore.com';
  await env.EMAIL.send({ from: REMITENTE, to: para, replyTo: RESPONDER_A, subject: asunto, html: htmlCorreo({ titulo: asunto, ...datos }), text: texto });
}
// cuantos envios hubo con esta clave en la ventana; si no paso el limite, anota uno nuevo
async function dentroDelLimite(env, clave, max, ventanaMs) {
  const r = await env.DB.prepare('SELECT count(*) AS n FROM envios WHERE clave = ?1 AND ts > ?2').bind(clave, Date.now() - ventanaMs).first();
  if (r && r.n >= max) return false;
  await env.DB.prepare('INSERT INTO envios (clave, ts) VALUES (?1, ?2)').bind(clave, Date.now()).run();
  return true;
}
function correoConfigurado(env) { return !!(env.EMAIL && env.FIREBASE_SA); }

async function correoVerificacion(request, env, cors, sesion) {
  if (!correoConfigurado(env)) return json({ error: 'Correo propio no configurado', respaldo: true }, 503, cors);
  if (!sesion.email) return json({ error: 'La cuenta no tiene correo' }, 400, cors);
  if (sesion.email_verified) return json({ ok: true, yaVerificado: true }, 200, cors);
  if (!(await dentroDelLimite(env, 'verif:' + sesion.sub, 1, MINUTO)) || !(await dentroDelLimite(env, 'verifdia:' + sesion.sub, 6, 1440 * MINUTO))) {
    return json({ error: 'Ya te enviamos un correo hace poco. Espera un momento antes de pedir otro.' }, 429, cors);
  }
  const b = (await leerJson(request)) || {};
  const nombre = limpiarTexto(b.nombre || sesion.name || '', 60).split(' ')[0];
  try {
    const enlace = await enlaceFirebase(env, 'VERIFY_EMAIL', sesion.email);
    if (!enlace) return json({ error: 'No encontramos la cuenta' }, 404, cors);
    await enviarCorreo(env, sesion.email, 'Activa tu cuenta de APHILLIPS STORE', {
      saludo: 'Hola' + (nombre ? ' ' + nombre : '') + ',',
      texto: 'Gracias por crear tu cuenta en APHILLIPS STORE. Toca el botón para confirmar tu correo y empezar a guardar tus favoritos y recibir avisos de tus relojes.',
      boton: 'Activar mi cuenta', enlace,
      nota: 'Si no creaste esta cuenta, puedes ignorar este correo.'
    });
    return json({ ok: true }, 200, cors);
  } catch (e) {
    console.log('correo verificacion', e.message);
    return json({ error: 'No se pudo enviar el correo', respaldo: true }, 502, cors);
  }
}

async function correoRecuperar(request, env, cors) {
  if (!correoConfigurado(env)) return json({ error: 'Correo propio no configurado', respaldo: true }, 503, cors);
  const b = await leerJson(request);
  const email = String((b && b.email) || '').trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Revisa el correo electrónico.' }, 400, cors);
  const ip = await sha256(request.headers.get('CF-Connecting-IP') || 'sin-ip');
  if (!(await dentroDelLimite(env, 'ip:' + ip, 20, 60 * MINUTO))) return json({ error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' }, 429, cors);
  // por correo: maximo 1 cada 2 minutos y 5 al dia; si se pasa, se responde ok igual (no se revela nada)
  if (!(await dentroDelLimite(env, 'clave:' + email, 1, 2 * MINUTO)) || !(await dentroDelLimite(env, 'clavedia:' + email, 5, 1440 * MINUTO))) return json({ ok: true }, 200, cors);
  try {
    const enlace = await enlaceFirebase(env, 'PASSWORD_RESET', email);
    if (enlace) {
      await enviarCorreo(env, email, 'Crea una contraseña nueva para APHILLIPS STORE', {
        saludo: 'Hola,',
        texto: 'Recibimos una solicitud para cambiar la contraseña de tu cuenta en APHILLIPS STORE. Toca el botón para crear una nueva.',
        boton: 'Crear contraseña nueva', enlace,
        nota: 'El enlace vence en 1 hora. Si no lo pediste, ignora este correo: tu contraseña no cambia.'
      });
    }
    return json({ ok: true }, 200, cors);   // mismo resultado exista o no la cuenta
  } catch (e) {
    console.log('correo recuperar', e.message);
    return json({ error: 'No se pudo enviar el correo', respaldo: true }, 502, cors);
  }
}

// ---------- boletin ----------
// solo caracteres normales de un correo (sin < > " ' ni espacios), dominio con punto y terminacion de letras
const RE_CORREO = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
async function suscribirBoletin(request, env, cors) {
  const b = await leerJson(request);
  const email = String((b && b.email) || '').trim().toLowerCase().slice(0, 120);
  if (!RE_CORREO.test(email)) return json({ error: 'Revisa el correo electrónico.' }, 400, cors);
  const nombre = limpiarTexto(b && b.nombre, 60);
  const ip = await sha256(request.headers.get('CF-Connecting-IP') || 'sin-ip');
  if (!(await dentroDelLimite(env, 'bol:' + ip, 10, 60 * MINUTO))) return json({ error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' }, 429, cors);
  const ahora = Date.now();
  const previo = await env.DB.prepare('SELECT activo, token FROM boletin WHERE email = ?1').bind(email).first();
  if (previo && previo.activo) return json({ ok: true, ya: true }, 200, cors);
  const token = previo ? previo.token : crypto.randomUUID().replace(/-/g, '');
  if (previo) await env.DB.prepare('UPDATE boletin SET activo = 1, baja = NULL, creado = ?2, nombre = COALESCE(?3, nombre) WHERE email = ?1').bind(email, ahora, nombre || null).run();
  else await env.DB.prepare('INSERT INTO boletin (email, nombre, activo, token, creado) VALUES (?1, ?2, 1, ?3, ?4)').bind(email, nombre || null, token, ahora).run();
  // correo de bienvenida (maximo 1 por correo al dia, por si alguien se suscribe y se da de baja varias veces)
  if (env.EMAIL && (await dentroDelLimite(env, 'boldia:' + email, 1, 1440 * MINUTO))) {
    try {
      const baja = 'https://api.aphillipsstore.com/boletin/baja?t=' + token;
      await enviarCorreo(env, email, 'Ya estás suscrito a APHILLIPS STORE', {
        saludo: 'Hola' + (nombre ? ' ' + nombre.split(' ')[0] : '') + ',',
        texto: 'Gracias por suscribirte. Te avisaremos cuando lleguen relojes nuevos, de ofertas especiales y de novedades de la tienda. Nada de spam: solo lo que vale la pena.',
        boton: 'Ver los relojes', enlace: 'https://aphillipsstore.com/',
        nota: '¿No quieres recibir más correos?', baja
      });
    } catch (e) { console.log('correo boletin', e.message); }
  }
  return json({ ok: true }, 200, cors);
}
async function bajaBoletin(url, env) {
  const t = String(url.searchParams.get('t') || '').replace(/[^a-f0-9]/g, '').slice(0, 40);
  let ok = false;
  if (t.length >= 16) {
    const r = await env.DB.prepare('UPDATE boletin SET activo = 0, baja = ?2 WHERE token = ?1 AND activo = 1').bind(t, Date.now()).run();
    ok = true;   // si ya estaba dado de baja tambien se muestra el mensaje
    if (!r.meta || r.meta.changes === 0) { const e = await env.DB.prepare('SELECT 1 FROM boletin WHERE token = ?1').bind(t).first(); ok = !!e; }
  }
  const msg = ok ? 'Listo, ya no recibirás más correos del boletín.' : 'Este enlace no es válido.';
  const html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Boletín — APHILLIPS STORE</title></head>' +
    '<body style="margin:0;font-family:Arial,sans-serif;background:#f4f4f5;color:#18181b;display:flex;min-height:100vh;align-items:center;justify-content:center;">' +
    '<div style="background:#fff;padding:32px 28px;max-width:420px;margin:16px;text-align:center;border-radius:12px;"><p style="font-size:17px;line-height:1.5;margin:0 0 20px;">' + msg + '</p>' +
    '<a href="https://aphillipsstore.com/" style="display:inline-block;background:#A7C4D6;color:#000;text-decoration:none;padding:12px 22px;font-size:13px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;">Volver a la tienda</a></div></body></html>';
  return new Response(html, { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
// Envio de un correo a todos los suscriptores activos (lo dispara el dueno desde el panel).
// { asunto, texto, boton?, enlace?, prueba } -> con prueba: true solo va a info@. Cada correo lleva su
// enlace de baja. Maximo 1 envio masivo cada 10 minutos (evita mandar dos veces por un doble toque).
async function enviarBoletin(request, env, cors) {
  if (!env.EMAIL) return json({ error: 'El envio de correos no esta configurado' }, 503, cors);
  const b = await leerJson(request);
  const asunto = limpiarTexto(b && b.asunto, 120);
  const texto = String((b && b.texto) || '').replace(/[\u0000-\u0009\u000b-\u001f]/g, '').trim().slice(0, 3000);
  const boton = limpiarTexto(b && b.boton, 40) || 'Ver la tienda';
  let enlace = String((b && b.enlace) || TIENDA).trim();
  if (!/^https:\/\/(www\.)?aphillipsstore\.com(\/|$)/.test(enlace)) enlace = TIENDA;   // solo enlaces a la tienda
  if (!asunto || !texto) return json({ error: 'Escribe el asunto y el texto' }, 400, cors);
  const datos = (para, baja) => ({ saludo: 'Hola,', texto, boton, enlace, nota: '¿No quieres recibir más correos?', baja });
  if (b.prueba) {
    await enviarCorreo(env, PARA_INFORME, '[Prueba] ' + asunto, datos(PARA_INFORME, TIENDA));
    return json({ ok: true, prueba: true, enviados: 1 }, 200, cors);
  }
  if (!(await dentroDelLimite(env, 'bolmasivo', 1, 10 * MINUTO))) return json({ error: 'Ya se envió un boletín hace menos de 10 minutos.' }, 429, cors);
  const subs = (await env.DB.prepare('SELECT email, token FROM boletin WHERE activo = 1 LIMIT 1000').all()).results;
  let enviados = 0, fallidos = 0;
  for (const s of subs) {
    try { await enviarCorreo(env, s.email, asunto, datos(s.email, 'https://api.aphillipsstore.com/boletin/baja?t=' + s.token)); enviados++; }
    catch (e) { fallidos++; console.log('boletin masivo', e.message); }
  }
  return json({ ok: true, enviados, fallidos }, 200, cors);
}
async function adminBoletin(env, cors) {
  const r = (await env.DB.prepare('SELECT email, nombre, activo, creado, baja FROM boletin ORDER BY creado DESC').all()).results;
  return json({ suscriptores: r }, 200, cors);
}

// ---------- errores de JavaScript (tienda y panel) ----------
// js/errores.js manda { m: mensaje, f: archivo, l: linea, p: pagina, n: navegador } como texto plano.
// Publica, con limite por IP (30 por hora). Solo se guardan textos cortos; nada personal.
async function registrarError(request, env, cors) {
  let b; try { b = JSON.parse(await request.text()); } catch (e) { return json({ ok: false }, 400, cors); }
  const corto = (t, n) => String(t == null ? '' : t).replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
  const mensaje = corto(b && b.m, 300);
  if (!mensaje) return json({ ok: false }, 400, cors);
  const ip = await sha256(request.headers.get('CF-Connecting-IP') || 'sin-ip');
  if (!(await dentroDelLimite(env, 'err:' + ip, 30, 60 * MINUTO))) return json({ ok: true }, 200, cors);
  try {
    await env.DB.prepare('INSERT INTO errores (ts, mensaje, fuente, linea, pagina, navegador) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
      .bind(Date.now(), mensaje, corto(b.f, 200), Math.max(0, Math.min(1e7, Number(b.l) || 0)), corto(b.p, 200), corto(b.n, 40)).run();
  } catch (e) { /* tabla aun no creada */ }
  return json({ ok: true }, 200, cors);
}
// Errores de los ultimos dias agrupados por mensaje (los mas repetidos primero)
async function resumenErrores(env, dias) {
  try {
    const { results } = await env.DB.prepare('SELECT mensaje, fuente, linea, count(*) AS veces, max(ts) AS ultimo, ' +
      'group_concat(DISTINCT navegador) AS navegadores, group_concat(DISTINCT pagina) AS paginas FROM errores WHERE ts >= ?1 ' +
      'GROUP BY mensaje, fuente, linea ORDER BY veces DESC LIMIT 50').bind(Date.now() - dias * DIA_MS).all();
    return results;
  } catch (e) { return []; }
}

// ---------- avisos por correo a los clientes ----------
// Mismo criterio que "Avisos para enviar" del panel (clientes/cuentas-web.js): un reloj pedido que ya
// esta disponible (o bajo de precio) y marcas con relojes nuevos desde el ultimo aviso. Se manda un
// correo al cliente y el aviso queda marcado como enviado (igual que al mandarlo por WhatsApp).
// Corre con el cron diario si AVISOS_CORREO = "1".
//   GET  /admin/avisos/correo   -> lista de lo que se enviaria (no envia nada)
//   POST /admin/avisos/correo   -> los envia ahora
const MARCAS_NOMBRE = { invicta: 'Invicta', bulova: 'Bulova', technomarine: 'TechnoMarine' };
const MAX_AVISOS_CORREO = 50;   // por ejecucion
function normalMarca(t) { return String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ''); }
async function avisosPorCorreo(env, enviar) {
  const obj = await env.FOTOS.get(CLAVE_CATALOGO);
  if (!obj) return { avisos: [] };
  const relojes = (JSON.parse(await obj.text()).relojes) || [];
  const porId = new Map(relojes.map((r) => [r.id, r]));
  const filas = (await env.DB.prepare('SELECT a.uid, a.tipo, a.valor, a.estado_base, a.precio_base, a.creado, a.avisado, c.email, c.nombre ' +
    'FROM avisos a JOIN cuentas c ON c.uid = a.uid').all()).results;
  const salida = [];
  for (const a of filas) {
    if (!a.email || salida.length >= MAX_AVISOS_CORREO) continue;
    let asunto = '', texto = '', enlace = '', boton = 'Ver el reloj', estadoNuevo = a.estado_base, precioNuevo = a.precio_base;
    if (a.tipo === 'reloj') {
      const r = porId.get(a.valor);
      if (!r || r.estado !== 'disponible') continue;
      const precio = Number(r.precio) || 0;
      const llego = a.estado_base !== 'disponible';
      const bajo = !llego && precio > 0 && a.precio_base > 0 && precio < a.precio_base;
      if (!llego && !bajo) continue;
      const nombre = r.nombre || 'El reloj';
      asunto = llego ? nombre + ' ya está disponible' : nombre + ' bajó de precio';
      texto = llego ? 'El ' + nombre + ' que pediste ya está disponible' + (precio ? ' por $' + precio : '') + '. Escríbenos por WhatsApp para apartarlo antes de que se agote.'
        : 'El ' + nombre + ' que te interesa bajó de $' + a.precio_base + ' a $' + precio + '. Escríbenos por WhatsApp si lo quieres.';
      enlace = TIENDA + '?id=' + encodeURIComponent(r.id);
      estadoNuevo = 'disponible'; precioNuevo = precio;
    } else if (a.tipo === 'marca') {
      const desde = Math.max(a.creado || 0, a.avisado || 0);
      const nuevos = relojes.filter((r) => (r.estado === 'disponible' || r.estado === 'transito') && (r._ts || 0) > desde &&
        normalMarca((r.nombre || '') + ' ' + (r.coleccion || '')).includes(a.valor));
      if (!nuevos.length) continue;
      const marca = MARCAS_NOMBRE[a.valor] || a.valor;
      const nombres = nuevos.slice(0, 3).map((r) => r.nombre).join(', ') + (nuevos.length > 3 ? ' y ' + (nuevos.length - 3) + ' más' : '');
      asunto = 'Llegaron relojes ' + marca + ' nuevos';
      texto = 'Llegaron relojes ' + marca + ' nuevos a la tienda: ' + nombres + '.';
      enlace = TIENDA + '#marca-' + a.valor; boton = 'Ver los relojes ' + marca;
    } else continue;
    salida.push({ email: a.email, tipo: a.tipo, valor: a.valor, asunto });
    if (!enviar) continue;
    try {
      await enviarCorreo(env, a.email, asunto, {
        saludo: 'Hola' + (a.nombre ? ' ' + String(a.nombre).split(' ')[0] : '') + ',', texto, boton, enlace,
        nota: 'Recibes este correo porque pediste un aviso en tu cuenta de APHILLIPS STORE. Puedes quitarlo cuando quieras desde "Mi cuenta".'
      });
      await env.DB.prepare('UPDATE avisos SET avisado = ?4, estado_base = ?5, precio_base = ?6 WHERE uid = ?1 AND tipo = ?2 AND valor = ?3')
        .bind(a.uid, a.tipo, a.valor, Date.now(), estadoNuevo || '', Number(precioNuevo) || 0).run();
    } catch (e) { console.log('aviso por correo', e.message); salida[salida.length - 1].error = e.message; }
  }
  return { avisos: salida, enviados: enviar ? salida.filter((x) => !x.error).length : 0 };
}

// ---------- informe semanal para el dueno ----------
// Cada lunes a las 3:00 a. m. (el mismo cron diario) manda a info@ un resumen de la semana: ventas,
// abonos y ganancia, relojes estancados, en transito hace mucho, apartados con saldo, cuentas y
// suscriptores nuevos y los relojes mas vistos. Se activa con la variable INFORME_SEMANAL = "1".
//   GET  /admin/informe          -> el informe en HTML (para verlo sin enviarlo)
//   POST /admin/informe/enviar   -> lo envia ahora (prueba)
const PARA_INFORME = 'info@aphillipsstore.com';
function fechaDMA(t) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(t || ''));
  return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : null;
}
async function datosInforme(env) {
  const ahora = Date.now(), desde = ahora - 7 * DIA_MS;
  const filas = (await env.DB.prepare("SELECT col, id, datos FROM docs WHERE borrado = 0 AND col IN ('inventario', 'movimientos')").all()).results;
  const inv = [], movs = [];
  for (const f of filas) {
    let d; try { d = JSON.parse(f.datos); } catch (e) { continue; }
    d.id = f.id;
    (f.col === 'inventario' ? inv : movs).push(d);
  }
  const num = (v) => Number(v) || 0;
  const suma = (l, f) => l.reduce((a, m) => a + (f ? f(m) : num(m.monto)), 0);
  const semana = movs.filter((m) => (m._ts || fechaDMA(m.fecha) || 0) >= desde);
  const ingresos = semana.filter((m) => m.tipo === 'venta' || m.tipo === 'abono');
  const r = {
    desde, hasta: ahora,
    numVentas: semana.filter((m) => m.tipo === 'venta' && !m._soloRegistro).length,
    numAbonos: semana.filter((m) => m.tipo === 'abono').length,
    ingresos: suma(ingresos), ganancia: suma(ingresos, (m) => num(m.monto) - num(m.costo)),
    compras: suma(semana.filter((m) => m.tipo === 'compra')), gastos: suma(semana.filter((m) => m.tipo === 'gasto')),
    estados: {}, estancados: [], transitoLargo: [], apartados: [], masVistos: []
  };
  const nombres = {};
  for (const p of inv) {
    nombres[p.id] = p.nombre;
    r.estados[p.estado] = (r.estados[p.estado] || 0) + 1;
    const alta = fechaDMA(p.fecha), dias = alta ? Math.floor((ahora - alta) / DIA_MS) : null;
    if (p.estado === 'disponible' && dias !== null && dias > 45) r.estancados.push({ nombre: p.nombre, dias, precio: num(p.precio) });
    if (p.estado === 'transito' && dias !== null && dias > 20) r.transitoLargo.push({ nombre: p.nombre, dias, paqueteria: p.paqueteria || '' });
    if (p.estado === 'reservado' && p.reserva) {
      const abonado = (p.reserva.abonos || []).reduce((a, x) => a + num(x.monto), 0);
      const saldo = Math.max(0, num(p.reserva.precioAcordado) - abonado);
      if (saldo > 0) r.apartados.push({ nombre: p.nombre, cliente: p.reserva.clienteNombre || '', saldo });
    }
  }
  r.estancados.sort((a, b) => b.dias - a.dias);
  const contar = async (sql, ...args) => { try { return (await env.DB.prepare(sql).bind(...args).first()).n || 0; } catch (e) { return 0; } };
  r.cuentasNuevas = await contar('SELECT count(*) AS n FROM cuentas WHERE creado >= ?1', desde);
  r.boletinNuevos = await contar('SELECT count(*) AS n FROM boletin WHERE activo = 1 AND creado >= ?1', desde);
  r.boletinTotal = await contar('SELECT count(*) AS n FROM boletin WHERE activo = 1');
  r.avisosActivos = await contar('SELECT count(*) AS n FROM avisos');
  r.errores = await resumenErrores(env, 7);
  try {
    const top = (await env.DB.prepare('SELECT id, vistas, aperturas, clics FROM metricas ORDER BY vistas DESC LIMIT 5').all()).results;
    r.masVistos = top.filter((m) => nombres[m.id]).map((m) => ({ nombre: nombres[m.id], vistas: m.vistas, aperturas: m.aperturas, clics: m.clics }));
  } catch (e) { /* sin metricas */ }
  return r;
}
function htmlInforme(r) {
  const e = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dinero = (n) => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US');
  const dia = (t) => new Date(t).toLocaleDateString('es-PA', { day: 'numeric', month: 'long', timeZone: 'America/Panama' });
  const NEGRO = 'background-color:#000000;background-image:linear-gradient(#000000,#000000);';
  const titulo = (t) => '<p style="margin:28px 0 10px;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#09090b;">' + t + '</p>';
  const fila = (a, b) => '<tr><td style="padding:8px 0;border-bottom:1px solid #ececef;font-size:14px;color:#3f3f46;">' + a + '</td><td style="padding:8px 0;border-bottom:1px solid #ececef;font-size:14px;text-align:right;font-weight:bold;color:#09090b;">' + b + '</td></tr>';
  const tabla = (filas) => '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + filas.join('') + '</table>';
  const vacio = (t) => '<p style="margin:0;font-size:13px;color:#71717a;">' + t + '</p>';
  const nEst = { disponible: 'Disponibles', transito: 'En tránsito', bajopedido: 'Bajo pedido', reservado: 'Apartados', vendido: 'Vendidos' };
  let c = '';
  c += titulo('La semana en números') + tabla([
    fila('Ventas', r.numVentas + (r.numAbonos ? ' · ' + r.numAbonos + ' abono' + (r.numAbonos !== 1 ? 's' : '') : '')),
    fila('Ingresos (ventas y abonos)', dinero(r.ingresos)), fila('Ganancia', dinero(r.ganancia)),
    fila('Compras de relojes', dinero(r.compras)), fila('Gastos', dinero(r.gastos))]);
  c += titulo('Inventario') + tabla(Object.keys(nEst).filter((k) => r.estados[k]).map((k) => fila(nEst[k], r.estados[k])));
  c += titulo('Para revisar');
  const pend = [];
  r.apartados.forEach((a) => pend.push(fila('Saldo por cobrar · ' + e(a.nombre) + (a.cliente ? ' (' + e(a.cliente) + ')' : ''), dinero(a.saldo))));
  r.transitoLargo.forEach((a) => pend.push(fila('En tránsito hace ' + a.dias + ' días · ' + e(a.nombre) + (a.paqueteria ? ' · ' + e(a.paqueteria) : ''), 'Revisar envío')));
  r.estancados.slice(0, 8).forEach((a) => pend.push(fila(e(a.nombre) + ' · ' + a.dias + ' días sin venderse', 'Rebajar' + (a.precio ? ' (' + dinero(a.precio) + ')' : ''))));
  c += pend.length ? tabla(pend) : vacio('Todo al día: no hay apartados con saldo, envíos atrasados ni relojes estancados.');
  c += titulo('Tienda en línea') + tabla([
    fila('Cuentas nuevas de clientes', r.cuentasNuevas), fila('Nuevos suscriptores del boletín', r.boletinNuevos + ' (total ' + r.boletinTotal + ')'),
    fila('Avisos pedidos por clientes', r.avisosActivos)]);
  c += titulo('Errores en la página') + (r.errores && r.errores.length ? tabla(r.errores.slice(0, 5).map((x) => fila(e(x.mensaje).slice(0, 90) + '<br><span style="font-size:11px;color:#71717a;">' + e(x.paginas || '').slice(0, 60) + ' · ' + e(x.navegadores || '') + '</span>', x.veces + ' vez' + (x.veces !== 1 ? 'es' : '')))) : vacio('Ningún error registrado esta semana.'));
  if (r.masVistos.length) c += titulo('Relojes más vistos (desde el inicio)') + tabla(r.masVistos.map((m) => fila(e(m.nombre), m.vistas + ' vistas · ' + m.clics + ' a WhatsApp')));
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light only"><title>Informe semanal — APHILLIPS STORE</title></head>' +
    '<body style="margin:0;padding:0;background:#f4f4f5;font-family:Helvetica,Arial,sans-serif;color:#09090b;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;">' +
    '<tr><td bgcolor="#A7C4D6" style="background-color:#A7C4D6;background-image:linear-gradient(#A7C4D6,#A7C4D6);padding:22px 32px;text-align:center;"><img src="' + TIENDA + 'img/logo-correo-negro.png" width="200" alt="APHILLIPS" style="display:block;margin:0 auto;border:0;width:200px;max-width:100%;height:auto;color:#ffffff;font-family:Georgia,serif;font-size:22px;letter-spacing:4px;font-weight:bold;"></td></tr>' +
    '<tr><td style="padding:28px 32px 32px;">' +
    '<p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#6a6a6a;">Informe semanal</p>' +
    '<p style="margin:6px 0 0;font-size:20px;font-weight:bold;">Del ' + dia(r.desde) + ' al ' + dia(r.hasta) + '</p>' + c +
    '<p style="margin:30px 0 0;font-size:12px;color:#71717a;">Los detalles están en tu panel: <a href="' + TIENDA + 'admin" style="color:#09090b;">aphillipsstore.com/admin</a></p>' +
    '</td></tr></table></td></tr></table></body></html>';
}
async function enviarInforme(env) {
  if (!env.EMAIL) throw new Error('falta el envio de correo');
  const r = await datosInforme(env);
  await env.EMAIL.send({ from: REMITENTE, to: PARA_INFORME, subject: 'Informe semanal de APHILLIPS STORE', html: htmlInforme(r),
    text: 'Informe semanal: ' + r.numVentas + ' ventas, ingresos $' + r.ingresos + ', ganancia $' + r.ganancia + '. Detalles en aphillipsstore.com/admin' });
  return { ok: true, ventas: r.numVentas, ingresos: r.ingresos };
}

// ---------- respaldos automaticos y limpieza de fotos ----------
const RETENCION_DIAS = 120;
const DIAS_FOTO_HUERFANA = 30;
const MAX_BORRAR_FOTOS = 500;
const DIA_MS = 86400000;

async function mantenimiento(env, tipo) {
  const informe = { tipo, fecha: new Date().toISOString() };
  try { informe.respaldo = await hacerRespaldo(env, tipo); } catch (e) { informe.respaldo = { error: e.message }; }
  try { informe.respaldosBorrados = await borrarRespaldosViejos(env); } catch (e) { informe.respaldosBorrados = { error: e.message }; }
  try { informe.fotos = await limpiarFotos(env); } catch (e) { informe.fotos = { error: e.message }; }
  try { await env.DB.prepare('DELETE FROM envios WHERE ts < ?1').bind(Date.now() - 2 * DIA_MS).run(); } catch (e) { /* tabla aun no creada */ }
  try { await env.DB.prepare('DELETE FROM errores WHERE ts < ?1').bind(Date.now() - 30 * DIA_MS).run(); } catch (e) { /* tabla aun no creada */ }
  console.log('mantenimiento', JSON.stringify(informe));
  return informe;
}

// Mismo formato que "Exportar respaldo" del panel (se puede restaurar con "Importar respaldo"),
// mas authSettings, metricas y los documentos borrados (por si hay que recuperar algo).
async function hacerRespaldo(env, tipo) {
  if (!env.RESPALDOS) throw new Error('falta el bucket de respaldos');
  const { results } = await env.DB.prepare('SELECT col, id, datos, borrado FROM docs').all();
  const r = { exportado: new Date().toISOString(), origen: 'cloudflare-' + tipo, version: await versionActual(env),
    inventario: [], movimientos: [], clientes: [], authSettings: {}, borrados: [] };
  for (const f of results) {
    let d; try { d = JSON.parse(f.datos); } catch (e) { continue; }
    if (f.borrado) { r.borrados.push({ col: f.col, id: f.id, datos: d }); continue; }
    if (f.col === 'config' && f.id === 'main') { r.meta = d.meta; r.tasks = d.tasks; r.weekTasks = d.weekTasks; r.ideas = d.ideas; }
    else if (f.col === 'authSettings') r.authSettings[f.id] = d;
    else if (r[f.col]) { d.id = f.id; r[f.col].push(d); }
  }
  ['inventario', 'movimientos', 'clientes'].forEach((c) => r[c].sort((a, b) => (b._ts || 0) - (a._ts || 0)));
  const met = await env.DB.prepare('SELECT id, vistas, aperturas, clics, ultima FROM metricas').all();
  r.metricas = {};
  for (const m of met.results) r.metricas[m.id] = { vistas: m.vistas, aperturas: m.aperturas, clics: m.clics, _ultima: m.ultima };
  try {
    r.cuentasTienda = (await env.DB.prepare('SELECT * FROM cuentas').all()).results;
    r.favoritosTienda = (await env.DB.prepare('SELECT * FROM favoritos').all()).results;
    r.avisosTienda = (await env.DB.prepare('SELECT * FROM avisos').all()).results;
  } catch (e) { /* tablas aun no creadas */ }
  const ahora = new Date();
  const dia = ahora.toISOString().slice(0, 10);
  const nombre = tipo === 'manual' ? dia + '-manual-' + ahora.toISOString().slice(11, 16).replace(':', '') : dia;
  const cuerpo = JSON.stringify(r);
  await env.RESPALDOS.put('respaldos/' + nombre + '.json', cuerpo, { httpMetadata: { contentType: 'application/json; charset=utf-8' } });
  return { nombre, bytes: cuerpo.length, relojes: r.inventario.length, movimientos: r.movimientos.length, clientes: r.clientes.length };
}

async function listarTodo(bucket, prefijo) {
  const todos = [];
  let cursor;
  do {
    const l = await bucket.list({ prefix: prefijo, cursor, limit: 1000 });
    todos.push(...l.objects);
    cursor = l.truncated ? l.cursor : undefined;
  } while (cursor);
  return todos;
}

async function borrarRespaldosViejos(env) {
  if (!env.RESPALDOS) return 0;
  const limite = Date.now() - RETENCION_DIAS * DIA_MS;
  const viejos = (await listarTodo(env.RESPALDOS, 'respaldos/')).filter((o) => o.uploaded.getTime() < limite).map((o) => o.key);
  if (viejos.length) await env.RESPALDOS.delete(viejos.slice(0, 1000));
  return viejos.length;
}

// Fotos que ningun reloj usa (ni como foto, ni en fotos[], ni como copia JPEG para compartir) y que
// se subieron hace mas de DIAS_FOTO_HUERFANA dias. Si no hay relojes (algo raro), no borra nada.
async function limpiarFotos(env) {
  const { results } = await env.DB.prepare("SELECT datos FROM docs WHERE col = 'inventario' AND borrado = 0").all();
  if (!results.length) return { revisadas: 0, borradas: 0, nota: 'sin relojes: no se borra nada' };
  const base = (env.FOTOS_URL_BASE || '') + '/';
  const usadas = new Set();
  const anotar = (u) => { if (typeof u === 'string' && u.startsWith(base)) usadas.add(u.slice(base.length)); };
  for (const f of results) {
    let d; try { d = JSON.parse(f.datos); } catch (e) { continue; }
    anotar(d.foto); anotar(d.fotoCompartir);
    (Array.isArray(d.fotos) ? d.fotos : []).forEach(anotar);
    Object.values(d.fotosJpg && typeof d.fotosJpg === 'object' ? d.fotosJpg : {}).forEach(anotar);
  }
  const limite = Date.now() - DIAS_FOTO_HUERFANA * DIA_MS;
  const objetos = await listarTodo(env.FOTOS, 'relojes/');
  const borrar = objetos.filter((o) => !usadas.has(o.key) && o.uploaded.getTime() < limite).map((o) => o.key).slice(0, MAX_BORRAR_FOTOS);
  if (borrar.length) await env.FOTOS.delete(borrar);
  // miniaturas cuya foto original ya no existe
  const existentes = new Set(objetos.map((o) => o.key).filter((k) => !borrar.includes(k)));
  const minis = await listarTodo(env.FOTOS, 'miniaturas/');
  const borrarMinis = minis.filter((o) => !existentes.has(o.key.slice('miniaturas/'.length))).map((o) => o.key).slice(0, MAX_BORRAR_FOTOS);
  if (borrarMinis.length) await env.FOTOS.delete(borrarMinis);
  return { revisadas: objetos.length, usadas: usadas.size, borradas: borrar.length, miniaturasBorradas: borrarMinis.length };
}

async function listarRespaldos(env, cors) {
  if (!env.RESPALDOS) return json({ respaldos: [] }, 200, cors);
  const lista = (await listarTodo(env.RESPALDOS, 'respaldos/'))
    .map((o) => ({ nombre: o.key.slice('respaldos/'.length).replace(/\.json$/, ''), bytes: o.size, fecha: o.uploaded.toISOString() }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  return json({ respaldos: lista }, 200, cors);
}

async function descargarRespaldo(url, env, cors) {
  const nombre = url.searchParams.get('nombre') || '';
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}(-manual-[0-9]{4})?$/.test(nombre)) return json({ error: 'Nombre invalido' }, 400, cors);
  const obj = env.RESPALDOS && await env.RESPALDOS.get('respaldos/' + nombre + '.json');
  if (!obj) return json({ error: 'No existe ese respaldo' }, 404, cors);
  return new Response(obj.body, { headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': 'attachment; filename="respaldo-tienda-' + nombre + '.json"', 'Cache-Control': 'no-store' } });
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
  return (await verificarSesionFirebase(cabecera, env)).sub;
}
// Devuelve el contenido del token (sub, email, name, firebase.sign_in_provider...) si es valido
async function verificarSesionFirebase(cabecera, env) {
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
  return payload;
}
