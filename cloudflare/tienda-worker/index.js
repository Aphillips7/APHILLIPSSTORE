// =================== WORKER DE LA TIENDA (aphillipsstore.com) ===================
// Sirve los archivos del repositorio (catalogo, panel, css, js, img) desde Cloudflare.
//   /                -> catalogo publico (catalogo.html). Con ?id=<reloj> la vista previa del link
//                       (WhatsApp, Facebook...) muestra la foto, el nombre y el estado de ese reloj.
//   /admin           -> panel privado (index.html)
//   /admin/          -> redirige a /admin (las rutas relativas del panel cuelgan de "/")
//   /manifest.json   -> la app instalable del panel abre /admin en este dominio
//   www.             -> redirige al dominio sin www
//   /__/auth/, /__/firebase/ -> se reenvian a Firebase (login de Google con nuestro dominio)
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

// ---------- vista previa del link de un reloj ----------
const ESTADOS = { disponible: 'Disponible', transito: 'En tránsito', bajopedido: 'Bajo pedido', vendido: 'Agotado' };

async function relojDelCatalogo(id, env) {
  try {
    const pedido = new Request('https://api.aphillipsstore.com/catalogo');
    const r = env.API ? await env.API.fetch(pedido) : await fetch(pedido);
    if (!r.ok) return null;
    const d = await r.json();
    return (d.relojes || []).find((x) => x.id === id) || null;
  } catch (e) { return null; }
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

// Cabeceras de seguridad para las paginas; el panel ademas no se deja meter en iframes ni indexar
function conCabeceras(res, esPanel) {
  const h = new Headers(res.headers);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Cache-Control', 'no-cache');
  if (esPanel) {
    h.set('X-Frame-Options', 'DENY');
    h.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
