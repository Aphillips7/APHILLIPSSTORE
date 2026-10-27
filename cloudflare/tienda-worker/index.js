// =================== WORKER DE LA TIENDA (aphillipsstore.com) ===================
// Sirve los archivos del repositorio (catalogo, panel, css, js, img) desde Cloudflare.
//   /                -> catalogo publico (catalogo.html). El enlace viejo /?id=<reloj> redirige a /reloj-...
//   /reloj-<nombre>-<clave> -> pagina propia de cada reloj: el catalogo con su titulo, foto, precio y datos para
//                       Google; la vista previa del link (WhatsApp, Facebook...) muestra ese reloj.
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
//   /productos.xml   -> lista de productos para Google Merchant Center (Shopping): relojes disponibles con precio
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
    if (url.pathname === '/productos.xml') return await feedMerchant(env);
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
      // enlace viejo /?id=<reloj>: redirige para siempre a la direccion propia del reloj (Google pasa todo a la nueva)
      const id = url.searchParams.get('id');
      if (id) {
        const r = /^[A-Za-z0-9_-]{1,120}$/.test(id) ? await relojDelCatalogo(id, env) : null;
        if (r) return Response.redirect('https://' + DOMINIO + rutaReloj(r), 301);
      }
      const pagina = await servir(env, request, '/catalogo.html');
      // la vista previa del panel pone su propio borrador: se le sirve la portada tal cual
      if (url.searchParams.has('vista-previa') || !pagina.ok) return conCabeceras(pagina);
      return conCabeceras(portadaPublicada(pagina, await sitioPublicado(env)));
    }
    // pagina propia de cada reloj: /reloj-nombre-clave (el catalogo con el titulo, foto y datos de ese reloj)
    const mReloj = url.pathname.match(/^\/reloj-[a-z0-9-]*-([a-z0-9]{1,40})\/?$/);
    if (mReloj) {
      const d = await catalogo(env);
      const r = d ? (d.relojes || []).find((x) => claveReloj(x.id) === mReloj[1]) || null : null;
      if (!r) return Response.redirect('https://' + DOMINIO + '/relojes', 302);   // ya no esta publicado
      if (url.pathname !== rutaReloj(r)) return Response.redirect('https://' + DOMINIO + rutaReloj(r), 301);   // le cambiaron el nombre
      return vistaPreviaReloj(conCabeceras(await servir(env, request, '/catalogo.html')), r, ofertaActiva(await promosSitio(env), r));
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
    if (r.estado !== 'vendido' && /^[A-Za-z0-9_-]{1,120}$/.test(r.id || '')) urls.push('https://' + DOMINIO + rutaReloj(r));
  }
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => '  <url><loc>' + u + '</loc></url>').join('\n') + '\n</urlset>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}

// ---------- lista de productos para Google Merchant Center (Shopping) ----------
// Google la lee sola cada 24 h. Solo van los relojes disponibles con precio (Google exige precio y una fecha
// para los que estan en camino); todo sale del catalogo publico, nunca de datos privados.
const XML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
function xmlEsc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => XML_ESC[c]); }
// ---------- ofertas (Tienda > Promociones del panel) ----------
// La tienda muestra el precio de oferta: Google (ficha y Merchant Center) recibe el mismo precio para que
// coincidan. Una oferta vale solo si es menor al precio normal, el reloj no esta vendido y no vencio.
function diaPanama() { return new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10); }
// configuracion publicada desde el editor de la tienda del panel (api /sitio); null si no responde
async function sitioPublicado(env) {
  try {
    const pedido = new Request('https://api.aphillipsstore.com/sitio');
    const r = env.API ? await env.API.fetch(pedido) : await fetch(pedido);
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
}
async function promosSitio(env) { const d = await sitioPublicado(env); return d ? d.promos || null : null; }

// ---------- portada con lo publicado en Tienda > Contenido ----------
// Fotos del banner y de las secciones, titulo, descripcion e imagen para compartir: se ponen en el HTML
// (Google y WhatsApp no ejecutan el JS de la tienda). js/sitio/contenido.js hace lo mismo en el navegador.
const RE_FOTO_SITIO = /^https:\/\/fotos\.aphillipsstore\.com\/relojes\/sitio\/[A-Za-z0-9._-]+$/;
const FOTOS_PORTADA = {
  hero: '#hero img', heroMovil: '#hero source', genHombre: '.gen-hombre img', genMujer: '.gen-mujer img',
  futPortada: '.fut-hero img', futMini: '.fut-mini-foto img', futFicha: '.fut-ficha img', futCard1: '.fut-card-a img', futCard2: '.fut-card-b img',
  marcaInvicta: '.marcas-grid a[href="/invicta"] .marca-foto img', marcaBulova: '.marcas-grid a[href="/bulova"] .marca-foto img',
  marcaTechno: '.marcas-grid a[href="/technomarine"] .marca-foto img'
};
function portadaPublicada(pagina, sitio) {
  const c = sitio && sitio.contenido;
  if (!c) return pagina;
  const fotos = {};
  for (const k of Object.keys(FOTOS_PORTADA)) if (c.fotos && RE_FOTO_SITIO.test(c.fotos[k] || '')) fotos[k] = c.fotos[k];
  if (fotos.hero && !fotos.heroMovil) fotos.heroMovil = fotos.hero;
  const seo = c.seo || {}, meta = {};
  if (seo.titulo) { meta['og:title'] = seo.titulo; meta['twitter:title'] = seo.titulo; }
  if (seo.descripcion) { meta.description = seo.descripcion; meta['og:description'] = seo.descripcion; meta['twitter:description'] = seo.descripcion; }
  if (RE_FOTO_SITIO.test(seo.imagen || '')) { meta['og:image'] = seo.imagen; meta['twitter:image'] = seo.imagen; }
  if (!Object.keys(fotos).length && !Object.keys(meta).length) return pagina;
  let rw = new HTMLRewriter();
  if (seo.titulo) rw = rw.on('title', { element(e) { e.setInnerContent(seo.titulo); } });
  if (Object.keys(meta).length) rw = rw.on('meta', { element(e) {
    const clave = e.getAttribute('property') || e.getAttribute('name');
    if (clave && meta[clave] !== undefined) e.setAttribute('content', meta[clave]);
  } });
  for (const k of Object.keys(fotos)) {
    rw = rw.on(FOTOS_PORTADA[k], { element(e) {
      const attr = k === 'heroMovil' ? 'srcset' : 'src';
      // la tienda guarda la foto original para la vista previa del panel
      e.setAttribute('data-orig', e.getAttribute(attr) || '');
      e.setAttribute(attr, fotos[k]);
    } });
  }
  return rw.transform(pagina);
}
function ofertaActiva(promos, r) {
  if (!promos || !Array.isArray(promos.ofertas) || !(Number(r.precio) > 0) || r.estado === 'vendido') return null;
  const o = promos.ofertas.find((x) => x.id === r.id);
  if (!o || !(Number(o.precio) > 0 && Number(o.precio) < Number(r.precio))) return null;
  if (o.hasta && o.hasta < diaPanama()) return null;
  return { precio: Number(o.precio), hasta: o.hasta || '' };
}

async function feedMerchant(env) {
  const d = await catalogo(env);
  if (!d) return new Response('Catalogo no disponible', { status: 503 });
  const promos = await promosSitio(env);
  const GENERO = { hombre: 'male', mujer: 'female', unisex: 'unisex' };
  const items = (d.relojes || []).filter((r) => r.estado === 'disponible' && Number(r.precio) > 0).map((r) => {
    const fotos = (Array.isArray(r.fotos) && r.fotos.length ? r.fotos : [r.foto]).filter((f) => typeof f === 'string' && f.startsWith('https://'));
    if (!fotos.length) return '';
    const texto = (r.nombre || '') + ' ' + (r.coleccion || '');
    const marca = MARCAS_TIENDA.find((m) => texto.toLowerCase().includes(m.toLowerCase()));
    const tipo = r.genero === 'mujer' ? 'Reloj para mujer' : r.genero === 'hombre' ? 'Reloj para hombre' : 'Reloj';
    const titulo = [r.nombre, r.sku, '-', tipo, r.mm ? r.mm + ' mm' : '', r.movimiento].filter(Boolean).join(' ');
    const caja = [r.mm ? r.mm + ' mm' : '', r.materialCaja ? 'de ' + String(r.materialCaja).toLowerCase() : ''].filter(Boolean).join(' ');
    const detalles = [r.movimiento, caja ? 'caja ' + caja : '', r.colorEsfera ? 'esfera ' + String(r.colorEsfera).toLowerCase() : '',
      r.cristal ? 'cristal ' + r.cristal : ''].filter(Boolean).join(', ');
    const descripcion = (r.descripcion || ((r.nombre || 'Reloj') + ' original' + (detalles ? ': ' + detalles : '') + '.')) +
      ' Garantía de 1 año y envío a todo Panamá. APHILLIPS STORE.';
    const campos = [
      ['g:id', r.id], ['g:title', titulo.slice(0, 150)], ['g:description', descripcion.slice(0, 5000)],
      ['g:link', 'https://' + DOMINIO + rutaReloj(r)], ['g:image_link', fotos[0]],
      ...fotos.slice(1, 10).map((f) => ['g:additional_image_link', f]),
      ['g:availability', 'in_stock'], ['g:price', Number(r.precio).toFixed(2) + ' USD'], ['g:condition', 'new'],
      ...(() => { const of = ofertaActiva(promos, r); if (!of) return [];
        const c = [['g:sale_price', of.precio.toFixed(2) + ' USD']];
        if (of.hasta) c.push(['g:sale_price_effective_date', diaPanama() + 'T00:00-05:00/' + of.hasta + 'T23:59-05:00']);
        return c; })(),
      ['g:google_product_category', '201'], ['g:product_type', 'Relojes > ' + (marca || 'Otras marcas')], ['g:age_group', 'adult']
    ];
    if (marca) campos.push(['g:brand', marca]);
    if (r.sku) campos.push(['g:mpn', r.sku]);
    if (!marca || !r.sku) campos.push(['g:identifier_exists', 'no']);
    if (GENERO[r.genero]) campos.push(['g:gender', GENERO[r.genero]]);
    if (r.color || r.colorEsfera) campos.push(['g:color', r.color || r.colorEsfera]);
    return '    <item>\n' + campos.map(([k, v]) => '      <' + k + '>' + xmlEsc(v) + '</' + k + '>').join('\n') + '\n    </item>';
  }).filter(Boolean);
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n' +
    '    <title>APHILLIPS STORE</title>\n    <link>https://' + DOMINIO + '/</link>\n    <description>Relojes originales en Panamá</description>\n' +
    items.join('\n') + '\n  </channel>\n</rss>\n';
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
// Direccion propia de cada reloj: /reloj-technomarine-manta-ray-cstuzqs (nombre sin acentos + clave, la ultima
// parte del id). Es la misma funcion que js/catalogo/ui.js: si cambias una, cambia la otra.
function claveReloj(id) {
  const c = String(id || '').split('_').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
  return c || String(id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function rutaReloj(r) {
  const slug = String((r && r.nombre) || 'reloj').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '') || 'reloj';
  return '/reloj-' + slug + '-' + claveReloj(r && r.id);
}
function vistaPreviaReloj(pagina, r, oferta) {
  if (!pagina.ok) return pagina;
  const titulo = (r.nombre || 'Reloj') + ' — APHILLIPS STORE';
  const partes = [ESTADOS[r.estado] || ''];
  if ((r.estado === 'disponible' || r.estado === 'transito') && r.precio > 0) partes.push(oferta ? 'En oferta: $' + oferta.precio + ' (antes $' + r.precio + ')' : '$' + r.precio);
  partes.push(r.estado === 'bajopedido' ? 'Cotiza por WhatsApp' : 'Escríbenos por WhatsApp');
  const descripcion = partes.filter(Boolean).join(' · ');
  const imagen = imagenCompartir(r);
  const enlace = 'https://' + DOMINIO + rutaReloj(r);
  const meta = {
    'og:title': titulo, 'twitter:title': titulo,
    'og:description': descripcion, 'twitter:description': descripcion, description: descripcion
  };
  if (imagen) { meta['og:image'] = imagen; meta['twitter:image'] = imagen; }
  const datosGoogle = productoJsonLd(r, enlace, oferta);
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
function productoJsonLd(r, enlace, oferta) {
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
    p.offers = { '@type': 'Offer', url: enlace, priceCurrency: 'USD', price: (oferta ? oferta.precio : Number(r.precio)).toFixed(2),
      ...(oferta && oferta.hasta ? { priceValidUntil: oferta.hasta } : {}),
      availability: 'https://schema.org/' + DISPONIBILIDAD[r.estado], itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'APHILLIPS STORE' } };
  }
  // migas de pan: Inicio > marca (o Relojes) > reloj; Google las muestra en vez de la direccion
  const seccionMarca = marca ? '/' + marca.toLowerCase() : '/relojes';
  const migas = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://' + DOMINIO + '/' },
    { '@type': 'ListItem', position: 2, name: marca ? 'Relojes ' + marca : 'Relojes', item: 'https://' + DOMINIO + seccionMarca },
    { '@type': 'ListItem', position: 3, name: r.nombre || 'Reloj', item: enlace }] };
  // Sin oferta (bajo pedido, sin precio) no se manda el producto: Google lo marca como error critico
  // ("Debe especificarse offers, review o aggregateRating"). Solo van las migas de pan.
  // "<" escapado para que el texto nunca pueda cerrar la etiqueta <script>
  return JSON.stringify(p.offers ? [p, migas] : [migas]).replace(/</g, '\\u003c');
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
// Carrusel: las fotos se descargan desde fotos.aphillipsstore.com para quitarles el fondo blanco y se muestran
// como imagen generada en el navegador (blob:), ver js/catalogo/destacados.js.
// frame-ancestors 'self': la tienda solo puede verse dentro de una pagina del mismo sitio (la vista previa del
// editor de diseno del panel); cualquier otro sitio sigue sin poder meterla en un marco.
const CSP_CATALOGO = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; " +
  "img-src 'self' https: data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; " +
  "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com https://static.cloudflareinsights.com; " +
  "connect-src 'self' https://api.aphillipsstore.com https://fotos.aphillipsstore.com https://*.googleapis.com https://cloudflareinsights.com; " +
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
