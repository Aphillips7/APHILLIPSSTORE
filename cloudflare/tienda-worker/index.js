// =================== WORKER DE LA TIENDA (aphillipsstore.com) ===================
// Sirve los archivos del repositorio (catalogo, panel, css, js, img) desde Cloudflare.
//   /                -> catalogo publico (catalogo.html). Con ?id=<reloj> la vista previa del link
//                       (WhatsApp, Facebook...) muestra la foto, el nombre y el estado de ese reloj.
//   /admin           -> panel privado (index.html)
//   /admin/          -> redirige a /admin (las rutas relativas del panel cuelgan de "/")
//   /manifest.json   -> la app instalable del panel abre /admin en este dominio
//   www.             -> redirige al dominio sin www
//   /__/auth/, /__/firebase/ -> se reenvian a Firebase (login de Google con nuestro dominio)
//   /sitemap.xml     -> lista para Google: el catalogo y un enlace por cada reloj publicado (no vendido)
// Todo lo demas se sirve tal cual (catalogo.html, index.html, css/, js/, img/...).
// En GitHub Pages los archivos siguen funcionando igual: este Worker no los modifica.

const DOMINIO = 'aphillipsstore.com';
const FIREBASE = 'https://aphillips-store-733df.firebaseapp.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === 'www.' + DOMINIO) {
      url.hostname = DOMINIO;
      return Response.redirect(url.toString(), 301);
    }

    // Paginas del login de Firebase (ventana de Google): se piden a Firebase tal cual
    if (url.pathname.startsWith('/__/auth/') || url.pathname.startsWith('/__/firebase/')) {
      return fetch(new Request(FIREBASE + url.pathname + url.search, request), { redirect: 'manual' });
    }

    if (url.pathname === '/sitemap.xml') return await sitemap(env);

    if (url.pathname === '/admin/') {
      url.pathname = '/admin';
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === '/') {
      const pagina = conCabeceras(await servir(env, request, '/catalogo.html'));
      const id = url.searchParams.get('id');
      return id ? await vistaPreviaReloj(pagina, id, url, env) : pagina;
    }
    if (url.pathname === '/admin') return conCabeceras(await servir(env, request, '/index.html'), true);

    if (url.pathname === '/manifest.json') {
      const res = await servir(env, request, '/manifest.json');
      if (!res.ok) return res;
      const m = await res.json();
      m.start_url = '/admin';
      m.scope = '/';
      m.id = '/admin';
      return new Response(JSON.stringify(m), {
        headers: { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'no-cache' }
      });
    }

    const res = await env.ASSETS.fetch(request);
    const tipo = res.headers.get('Content-Type') || '';
    return tipo.includes('text/html') ? conCabeceras(res, url.pathname === '/index.html') : res;
  }
};

// ---------- sitemap para Google ----------
async function sitemap(env) {
  const d = await catalogo(env);
  const urls = ['https://' + DOMINIO + '/'];
  for (const r of (d && d.relojes) || []) {
    if (r.estado !== 'vendido' && /^[A-Za-z0-9_-]{1,120}$/.test(r.id || '')) urls.push('https://' + DOMINIO + '/?id=' + r.id);
  }
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => '  <url><loc>' + u + '</loc></url>').join('\n') + '\n</urlset>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}

// ---------- vista previa del link de un reloj ----------
const ESTADOS = { disponible: 'Disponible', transito: 'En tránsito', bajopedido: 'Bajo pedido', vendido: 'Agotado' };

async function catalogo(env) {
  try {
    const pedido = new Request('https://api.aphillipsstore.com/catalogo');
    const r = env.API ? await env.API.fetch(pedido) : await fetch(pedido);
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
}
async function relojDelCatalogo(id, env) {
  const d = await catalogo(env);
  return d ? (d.relojes || []).find((x) => x.id === id) || null : null;
}
function imagenCompartir(r) {
  if (r.fotoCompartir) return r.fotoCompartir;
  const f = typeof r.foto === 'string' && r.foto.startsWith('https://') ? r.foto : '';
  return f || null;
}
async function vistaPreviaReloj(pagina, id, url, env) {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(id) || !pagina.ok) return pagina;
  const r = await relojDelCatalogo(id, env);
  if (!r) return pagina;
  const titulo = (r.nombre || 'Reloj') + ' — Aphillips Store';
  const partes = [ESTADOS[r.estado] || ''];
  if ((r.estado === 'disponible' || r.estado === 'transito') && r.precio > 0) partes.push('$' + r.precio);
  partes.push(r.estado === 'bajopedido' ? 'Cotiza por WhatsApp' : 'Escríbenos por WhatsApp');
  const descripcion = partes.filter(Boolean).join(' · ');
  const imagen = imagenCompartir(r);
  const enlace = 'https://' + DOMINIO + '/?id=' + encodeURIComponent(id);
  const meta = {
    'og:title': titulo, 'twitter:title': titulo,
    'og:description': descripcion, 'twitter:description': descripcion, description: descripcion
  };
  if (imagen) { meta['og:image'] = imagen; meta['twitter:image'] = imagen; }
  return new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(titulo); } })
    // para Google cada reloj es su propia pagina (no una copia del catalogo)
    .on('link[rel="canonical"]', { element(e) { e.setAttribute('href', enlace); } })
    .on('meta', { element(e) {
      const clave = e.getAttribute('property') || e.getAttribute('name');
      if (clave && meta[clave] !== undefined) e.setAttribute('content', meta[clave]);
      if (clave === 'og:type') e.after('<meta property="og:url" content="' + enlace + '">', { html: true });
    } })
    .transform(pagina);
}

// Pide un archivo concreto al almacen de archivos manteniendo metodo y cabeceras
function servir(env, request, ruta) {
  const destino = new URL(request.url);
  destino.pathname = ruta;
  destino.search = '';
  return env.ASSETS.fetch(new Request(destino.toString(), request));
}

// Content-Security-Policy. Como el sitio usa <script> y onclick en linea, script-src lleva
// 'unsafe-inline' (la defensa real contra XSS es escapar los datos del catalogo en el JS); la CSP
// anade object-src 'none', base-uri y frame-ancestors (anti-clickjacking) y acota de donde se cargan
// imagenes, conexiones y scripts.
// Firebase Auth carga apis.google.com al iniciar (tambien con login de correo) y crea un iframe
// en /__/auth/ de este dominio.
// Catalogo: "Mi cuenta" carga Firebase Auth desde gstatic al abrirse; los clientes entran con
// correo/contrasena o con Google. Fuentes Jost y Syne de Google Fonts (css/catalogo/base.css).
// Panel: Firebase Auth (solo correo y contrasena), qrcode (cdnjs) y la fuente Satoshi de
// Fontshare (css/panel/base.css).
// Ambos: Cloudflare Web Analytics (Cloudflare inserta el script beacon y envia a cloudflareinsights.com).
const CSP_CATALOGO = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; " +
  "img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; " +
  "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com https://static.cloudflareinsights.com; " +
  "connect-src 'self' https://api.aphillipsstore.com https://*.googleapis.com https://cloudflareinsights.com; " +
  "frame-src 'self' https://*.firebaseapp.com; form-action 'self'";
const CSP_PANEL = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; " +
  "img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://api.fontshare.com; " +
  "font-src 'self' https://cdn.fontshare.com; " +
  "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://cdnjs.cloudflare.com https://apis.google.com https://static.cloudflareinsights.com; " +
  "connect-src 'self' https://api.aphillipsstore.com https://*.googleapis.com https://cloudflareinsights.com; " +
  "frame-src 'self' https://*.firebaseapp.com; form-action 'self'";

// Cabeceras de seguridad para las paginas; el panel ademas no se deja meter en iframes ni indexar
function conCabeceras(res, esPanel) {
  const h = new Headers(res.headers);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Cache-Control', 'no-cache');
  // El panel ya se probo (login y datos sin avisos): su CSP esta activa.
  // FASE DE PRUEBA del catalogo: va en "solo reporte" (no bloquea, solo avisa en la consola)
  // hasta probar "Mi cuenta" entrando con Google; si entra sin avisos "[Report Only] Refused...",
  // cambiar su cabecera a 'Content-Security-Policy' para activarla.
  if (esPanel) {
    h.set('Content-Security-Policy', CSP_PANEL);
    h.set('X-Frame-Options', 'DENY');
    h.set('X-Robots-Tag', 'noindex, nofollow');
  } else {
    h.set('Content-Security-Policy-Report-Only', CSP_CATALOGO);
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
