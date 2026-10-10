// =================== WORKER DE LA TIENDA (aphillipsstore.com) ===================
// Sirve los archivos del repositorio (catalogo, panel, css, js, img) desde Cloudflare.
//   /                -> catalogo publico (catalogo.html)
//   /admin           -> panel privado (index.html)
//   /admin/          -> redirige a /admin (las rutas relativas del panel cuelgan de "/")
//   /manifest.json   -> la app instalable del panel abre /admin en este dominio
//   www.             -> redirige al dominio sin www
// Todo lo demas se sirve tal cual (catalogo.html, index.html, css/, js/, img/...).
// En GitHub Pages los archivos siguen funcionando igual: este Worker no los modifica.

const DOMINIO = 'aphillipsstore.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname === 'www.' + DOMINIO) {
      url.hostname = DOMINIO;
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === '/admin/') {
      url.pathname = '/admin';
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === '/') return conCabeceras(await servir(env, request, '/catalogo.html'));
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
