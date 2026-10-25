// =================== WORKER DE LA TIENDA (aphillipsstore.com) ===================
// Sirve los archivos del repositorio (catalogo, panel, css, js, img) desde Cloudflare.
//   /                -> catalogo publico (catalogo.html). Con ?id=<reloj> la vista previa del link
//                       (WhatsApp, Facebook...) muestra la foto, el nombre y el estado de ese reloj.
//   /admin           -> panel privado (index.html)
//   /guia-de-tamanos -> guia de tamanos con probador (guia-de-tamanos.html; acepta ?mm=42)
//   /preguntas       -> preguntas frecuentes (preguntas.html; /preguntas.html redirige aqui)
//   /legal           -> terminos, garantia, devoluciones, privacidad y cookies (legal.html; /legal.html redirige aqui)
//   /admin/          -> redirige a /admin (las rutas relativas del panel cuelgan de "/")
//   /manifest.json   -> la app instalable del panel abre /admin en este dominio
//   www.             -> redirige al dominio sin www
//   /__/auth/, /__/firebase/ -> se reenvian a Firebase (login de Google con nuestro dominio)
//   /relojes, /relojes-hombre, /relojes-mujer, /invicta, /bulova, /technomarine -> el catalogo en esa seccion,
//                       con su propio titulo y descripcion para Google
//   /sitemap.xml     -> lista para Google: el catalogo, sus secciones y un enlace por cada reloj publicado (no vendido)
// /catalogo.html redirige a / y /index.html a /admin (direcciones sin .html).
// Todo lo demas se sirve tal cual (css/, js/, img/...).
// En GitHub Pages los archivos siguen funcionando igual: este Worker no los modifica.

const DOMINIO = 'aphillipsstore.com';
const FIREBASE = 'https://aphillips-store-733df.firebaseapp.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // siempre por conexion segura: http:// y www. van a https://aphillipsstore.com (sin esto, quien entraba
    // por un enlace "http://" veia "No seguro" en el navegador)
    if (url.protocol === 'http:' || url.hostname === 'www.' + DOMINIO) {
      url.protocol = 'https:';
      url.hostname = DOMINIO;
      return Response.redirect(url.toString(), 301);
    }

    // Paginas del login de Firebase (ventana de Google): se piden a Firebase tal cual
    if (url.pathname.startsWith('/__/auth/') || url.pathname.startsWith('/__/firebase/')) {
      return fetch(new Request(FIREBASE + url.pathname + url.search, request), { redirect: 'manual' });
    }

    if (url.pathname === '/sitemap.xml') return await sitemap(env);
    // icono de la pestana que algunos navegadores piden por defecto
    if (url.pathname === '/favicon.ico') return servir(env, request, '/img/favicon-48.png');

    // direcciones limpias: nunca se muestra .html (los ?id= y #seccion se conservan)
    if (url.pathname === '/catalogo.html') { url.pathname = '/'; return Response.redirect(url.toString(), 301); }
    if (url.pathname === '/index.html') { url.pathname = '/admin'; return Response.redirect(url.toString(), 301); }

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

    // secciones con direccion propia para Google (/relojes-hombre, /invicta...): es el catalogo con su
    // titulo, descripcion y canonica; al abrirse pasa a la vista de siempre (/#hombre, /#marca-invicta)
    if (SECCIONES[url.pathname]) return seccion(await servir(env, request, '/catalogo.html'), url.pathname);

    // pagina legal con direccion limpia: /legal (la vieja /legal.html redirige; el #seccion lo conserva el navegador)
    if (url.pathname === '/legal.html') { url.pathname = '/legal'; return Response.redirect(url.toString(), 301); }
    if (url.pathname === '/legal') return conCabeceras(await servir(env, request, '/legal.html'));
    if (url.pathname === '/preguntas.html') { url.pathname = '/preguntas'; return Response.redirect(url.toString(), 301); }
    if (url.pathname === '/preguntas') return conCabeceras(await servir(env, request, '/preguntas.html'));
    if (url.pathname === '/guia-de-tamanos.html') { url.pathname = '/guia-de-tamanos'; return Response.redirect(url.toString(), 301); }
    if (url.pathname === '/guia-de-tamanos') return conCabeceras(await servir(env, request, '/guia-de-tamanos.html'));

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

// ---------- secciones del catalogo con direccion propia ----------
const SECCIONES = {
  '/relojes': { hash: '#todos', titulo: 'Relojes originales en Panamá — APHILLIPS STORE',
    desc: 'Todos los relojes originales de APHILLIPS STORE: Invicta, Bulova y TechnoMarine para hombre y mujer. Disponibles, en tránsito y bajo pedido, con envío a todo Panamá.' },
  '/relojes-hombre': { hash: '#hombre', titulo: 'Relojes para hombre en Panamá — APHILLIPS STORE',
    desc: 'Relojes originales para hombre en Panamá: buceo, cronógrafos y automáticos de Invicta, Bulova y TechnoMarine. Garantía de 1 año y envío a todo el país.' },
  '/relojes-mujer': { hash: '#mujer', titulo: 'Relojes para mujer en Panamá — APHILLIPS STORE',
    desc: 'Relojes originales para mujer en Panamá: diseños elegantes y precisos de Invicta, Bulova y TechnoMarine. Garantía de 1 año y envío a todo el país.' },
  '/invicta': { hash: '#marca-invicta', titulo: 'Relojes Invicta originales en Panamá — APHILLIPS STORE',
    desc: 'Relojes Invicta originales en Panamá: Pro Diver, Speedway, Bolt y más. Precios, fotos reales, garantía de 1 año y envío a todo el país. Compra por WhatsApp.' },
  '/bulova': { hash: '#marca-bulova', titulo: 'Relojes Bulova originales en Panamá — APHILLIPS STORE',
    desc: 'Relojes Bulova originales en Panamá: automáticos, esqueleto y clásicos. Precios, fotos reales, garantía de 1 año y envío a todo el país. Compra por WhatsApp.' },
  '/technomarine': { hash: '#marca-technomarine', titulo: 'Relojes TechnoMarine originales en Panamá — APHILLIPS STORE',
    desc: 'Relojes TechnoMarine originales en Panamá: Manta Ray, Cruise y más, con estilo deportivo. Precios, fotos reales, garantía de 1 año y envío a todo el país.' }
};
function seccion(pagina, ruta) {
  if (!pagina.ok) return conCabeceras(pagina);
  const s = SECCIONES[ruta], enlace = 'https://' + DOMINIO + ruta;
  const meta = { 'og:title': s.titulo, 'twitter:title': s.titulo, 'og:description': s.desc, 'twitter:description': s.desc, description: s.desc };
  const res = new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(s.titulo); } })
    .on('link[rel="canonical"]', { element(e) { e.setAttribute('href', enlace); } })
    .on('meta', { element(e) {
      const clave = e.getAttribute('property') || e.getAttribute('name');
      if (clave && meta[clave] !== undefined) e.setAttribute('content', meta[clave]);
    } })
    // antes que todo lo demas: el catalogo arranca en la seccion (el hash de siempre)
    .on('head', { element(e) { e.prepend('<script>if(!location.hash)history.replaceState(null,"","/"+location.search+"' + s.hash + '");</script>', { html: true }); } })
    .transform(pagina);
  return conCabeceras(res);
}

// ---------- sitemap para Google ----------
async function sitemap(env) {
  const d = await catalogo(env);
  const urls = ['https://' + DOMINIO + '/', ...Object.keys(SECCIONES).map((r) => 'https://' + DOMINIO + r), 'https://' + DOMINIO + '/legal', 'https://' + DOMINIO + '/preguntas', 'https://' + DOMINIO + '/guia-de-tamanos'];
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
  const titulo = (r.nombre || 'Reloj') + ' — APHILLIPS STORE';
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
  const datosGoogle = productoJsonLd(r, enlace);
  return new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(titulo); } })
    // datos estructurados del producto: Google puede mostrar precio y disponibilidad en los resultados
    .on('head', { element(e) { e.append('<script type="application/ld+json">' + datosGoogle + '</script>', { html: true }); } })
    // para Google cada reloj es su propia pagina (no una copia del catalogo)
    .on('link[rel="canonical"]', { element(e) { e.setAttribute('href', enlace); } })
    .on('meta', { element(e) {
      const clave = e.getAttribute('property') || e.getAttribute('name');
      if (clave && meta[clave] !== undefined) e.setAttribute('content', meta[clave]);
      if (clave === 'og:type') e.after('<meta property="og:url" content="' + enlace + '">', { html: true });
    } })
    .transform(pagina);
}

// schema.org/Product de un reloj (JSON para <script type="application/ld+json">). Sin precio
// (bajo pedido) no se pone oferta: Google la exige con precio.
const DISPONIBILIDAD = { disponible: 'InStock', transito: 'PreOrder', vendido: 'SoldOut' };
const MARCAS_TIENDA = ['Invicta', 'Bulova', 'TechnoMarine'];
function productoJsonLd(r, enlace) {
  const texto = (r.nombre || '') + ' ' + (r.coleccion || '');
  const marca = MARCAS_TIENDA.find((m) => texto.toLowerCase().includes(m.toLowerCase()));
  const fotos = (Array.isArray(r.fotos) && r.fotos.length ? r.fotos : [r.foto]).filter((f) => typeof f === 'string' && f.startsWith('https://')).slice(0, 6);
  const movimiento = String(r.movimiento || '').replace(/^cuarzo japon[eé]s$/i, 'Cuarzo');
  const descripcion = String(r.descripcion || r.notas || [r.nombre, movimiento, r.mm ? r.mm + ' mm' : '', r.materialCaja].filter(Boolean).join(', ')).slice(0, 500);
  const p = { '@context': 'https://schema.org', '@type': 'Product', name: r.nombre || 'Reloj', url: enlace, description: descripcion };
  if (fotos.length) p.image = fotos;
  if (r.sku) p.sku = String(r.sku);
  if (marca) p.brand = { '@type': 'Brand', name: marca };
  if (r.coleccion) p.model = String(r.coleccion);
  if (Number(r.precio) > 0 && DISPONIBILIDAD[r.estado]) {
    p.offers = { '@type': 'Offer', url: enlace, priceCurrency: 'USD', price: Number(r.precio).toFixed(2),
      availability: 'https://schema.org/' + DISPONIBILIDAD[r.estado], itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'APHILLIPS STORE' } };
  }
  // migas de pan: Inicio > marca (o Relojes) > reloj; Google las muestra en vez de la direccion
  const seccionMarca = marca ? '/' + marca.toLowerCase() : '/relojes';
  const migas = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://' + DOMINIO + '/' },
    { '@type': 'ListItem', position: 2, name: marca ? 'Relojes ' + marca : 'Relojes', item: 'https://' + DOMINIO + seccionMarca },
    { '@type': 'ListItem', position: 3, name: r.nombre || 'Reloj', item: enlace }] };
  // "<" escapado para que el texto nunca pueda cerrar la etiqueta <script>
  return JSON.stringify([p, migas]).replace(/</g, '\\u003c');
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
  "img-src 'self' https: data: blob:; style-src 'self' 'unsafe-inline' https://api.fontshare.com; " +
  "font-src 'self' https://cdn.fontshare.com; " +
  "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://cdnjs.cloudflare.com https://apis.google.com https://static.cloudflareinsights.com; " +
  "connect-src 'self' https://api.aphillipsstore.com https://*.googleapis.com https://cloudflareinsights.com; " +
  "frame-src 'self' https://*.firebaseapp.com; form-action 'self'";

// Cabeceras de seguridad para las paginas; el panel ademas no se deja meter en iframes ni indexar
function conCabeceras(res, esPanel) {
  const h = new Headers(res.headers);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // siempre HTTPS (6 meses) y sin acceso a camara, microfono, ubicacion ni pagos desde la pagina
  h.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  h.set('Cache-Control', 'no-cache');
  // Ambas CSP se probaron en produccion en modo solo-reporte (login del panel con correo y
  // "Mi cuenta" del catalogo con Google) sin avisos. Si se agrega un servicio externo nuevo,
  // hay que sumar su dominio aqui o el navegador lo bloqueara.
  h.set('Content-Security-Policy', esPanel ? CSP_PANEL : CSP_CATALOGO);
  if (esPanel) {
    h.set('X-Frame-Options', 'DENY');
    h.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
