// =================== CONTENIDO DE LA TIENDA (Tienda > Contenido en el panel) ===================
// Fase 4: fotos del banner y de las secciones de la portada, como se ve la tienda al compartirla (Google,
// WhatsApp, Facebook), preguntas frecuentes (editar, ocultar o agregar) y notas en la pagina legal.
// Misma validacion en la API (cloudflare/fotos-worker, validarSitioContenido): si cambias una, cambia la otra.
// Las fotos solo pueden ser de fotos.aphillipsstore.com/relojes/sitio/ (las sube el panel).

const RE_FOTO = /^https:\/\/fotos\.aphillipsstore\.com\/relojes\/sitio\/[A-Za-z0-9._-]+$/;
// clave: [selector en la portada, nombre, ayuda]
const FOTOS = {
  hero: ['#hero img', 'Banner principal (computadora)', 'Horizontal, de al menos 1600 px de ancho.'],
  heroMovil: ['#hero source', 'Banner principal (celular)', 'Vertical. Si no pones una, el celular usa la de computadora.'],
  genHombre: ['.gen-hombre img', 'Relojes de hombre', 'Vertical o cuadrada.'],
  genMujer: ['.gen-mujer img', 'Relojes de mujer', 'Vertical o cuadrada.'],
  futPortada: ['.fut-hero img', 'El futuro: foto grande', 'Horizontal.'],
  futMini: ['.fut-mini-foto img', 'El futuro: foto pequeña', 'Vertical.'],
  futFicha: ['.fut-ficha img', 'El futuro: reloj de la ficha', 'El reloj solo. Puedes quitarle el fondo blanco.'],
  futCard1: ['.fut-card-a img', 'Encuentra tu próximo reloj: tarjeta 1', 'Vertical.'],
  futCard2: ['.fut-card-b img', 'Encuentra tu próximo reloj: tarjeta 2', 'Vertical.'],
  marcaInvicta: ['.marcas-grid a[href="/invicta"] .marca-foto img', 'Marcas: Invicta', 'Vertical o cuadrada.'],
  marcaBulova: ['.marcas-grid a[href="/bulova"] .marca-foto img', 'Marcas: Bulova', 'Vertical o cuadrada.'],
  marcaTechno: ['.marcas-grid a[href="/technomarine"] .marca-foto img', 'Marcas: TechnoMarine', 'Vertical o cuadrada.']
};
const SEO_BASE = {
  titulo: 'APHILLIPS STORE — Relojes originales en Panamá',
  descripcion: 'Relojes originales en Panamá: disponibles, en tránsito y bajo pedido. Mira fotos y precios y compra por WhatsApp en APHILLIPS STORE.',
  compartir: 'Relojes disponibles ahora. Toca uno para ver detalles y escribir por WhatsApp.'
};
const TEMAS_FAQ = { comprar: 'Comprar', pagos: 'Pagos', apartados: 'Apartados', pedidos: 'Bajo pedido', envios: 'Envíos', garantia: 'Garantía',
  devoluciones: 'Devoluciones', relojes: 'Sobre los relojes', cuenta: 'Mi cuenta', boletin: 'Boletín' };
const SECCIONES_LEGAL = { terminos: 'Términos y condiciones', apartados: 'Apartados', envios: 'Envíos y entregas', garantia: 'Garantía',
  devoluciones: 'Cambios y devoluciones', privacidad: 'Política de privacidad', cookies: 'Cookies y almacenamiento' };
const MAX = { titulo: 65, descripcion: 160, pregunta: 120, respuesta: 600, nuevas: 30, nota: 800 };

function txt(v, max){ return String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
// con saltos de linea (respuestas y notas)
function parrafos(v, max){
  return String(v == null ? '' : v).replace(/\r/g, '').replace(/[\u0000-\u0009\u000b-\u001f<>]/g, ' ').split('\n')
    .map(function(l){ return l.replace(/\s+/g, ' ').trim(); }).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}
// clave de una pregunta: su texto sin acentos ni signos
function claveFaq(t){ return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); }

function validarContenido(c){
  c = c && typeof c === 'object' ? c : {};
  var out = { fotos: {}, seo: {}, faq: { cambios: {}, nuevas: [] }, legal: {} };
  var f = c.fotos && typeof c.fotos === 'object' ? c.fotos : {};
  Object.keys(FOTOS).forEach(function(k){ if(typeof f[k] === 'string' && RE_FOTO.test(f[k])) out.fotos[k] = f[k]; });
  var s = c.seo && typeof c.seo === 'object' ? c.seo : {};
  var t = txt(s.titulo, MAX.titulo), d = txt(s.descripcion, MAX.descripcion);
  if(t) out.seo.titulo = t;
  if(d) out.seo.descripcion = d;
  if(typeof s.imagen === 'string' && RE_FOTO.test(s.imagen)) out.seo.imagen = s.imagen;
  var q = c.faq && typeof c.faq === 'object' ? c.faq : {}, cam = q.cambios && typeof q.cambios === 'object' ? q.cambios : {};
  Object.keys(cam).slice(0, 80).forEach(function(k){
    if(!/^[a-z0-9-]{1,60}$/.test(k) || !cam[k] || typeof cam[k] !== 'object') return;
    var x = {}, r = parrafos(cam[k].r, MAX.respuesta);
    if(cam[k].oculta === true) x.oculta = true;
    if(r) x.r = r;
    if(x.oculta || x.r) out.faq.cambios[k] = x;
  });
  (Array.isArray(q.nuevas) ? q.nuevas : []).forEach(function(n){
    if(!n || out.faq.nuevas.length >= MAX.nuevas) return;
    var p = txt(n.p, MAX.pregunta), r = parrafos(n.r, MAX.respuesta);
    if(p && r) out.faq.nuevas.push({ tema: TEMAS_FAQ[n.tema] ? n.tema : 'comprar', p: p, r: r });
  });
  var l = c.legal && typeof c.legal === 'object' ? c.legal : {};
  Object.keys(SECCIONES_LEGAL).forEach(function(k){ var n = parrafos(l[k], MAX.nota); if(n) out.legal[k] = n; });
  return out;
}

// texto con **negritas** y saltos de linea -> HTML seguro
function aHtml(t){
  var e = String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return e.split(/\n{2,}|\n/).filter(Boolean).map(function(l){ return '<p>' + l.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>') + '</p>'; }).join('');
}

// ---------- aplicar en la tienda ----------
function aplicarFotos(f){
  Object.keys(FOTOS).forEach(function(k){
    var e = document.querySelector(FOTOS[k][0]); if(!e) return;
    var attr = e.tagName === 'SOURCE' ? 'srcset' : 'src';
    if(e.dataset.orig === undefined) e.dataset.orig = e.getAttribute(attr) || '';
    // el banner del celular usa la foto de computadora si solo cambiaste esa
    var nueva = f[k] || (k === 'heroMovil' ? f.hero : '') || e.dataset.orig;
    if(e.getAttribute(attr) !== nueva) e.setAttribute(attr, nueva);
  });
}
function aplicarFaq(q){
  var lista = document.querySelectorAll('details.fq'); if(!lista.length) return;
  document.querySelectorAll('.fq-nueva').forEach(function(x){ x.remove(); });
  Array.prototype.forEach.call(lista, function(d){
    var s = d.querySelector('summary'), div = d.querySelector('div'); if(!s || !div) return;
    if(d.__orig === undefined) d.__orig = div.innerHTML;
    var c = q.cambios[claveFaq(s.textContent)] || {};
    d.hidden = !!c.oculta;
    var html = c.r ? aHtml(c.r) : d.__orig;
    if(div.innerHTML !== html) div.innerHTML = html;
  });
  q.nuevas.forEach(function(n){
    var sec = document.getElementById(n.tema); if(!sec) return;
    var d = document.createElement('details'); d.className = 'fq fq-nueva';
    var s = document.createElement('summary'); s.textContent = n.p;
    var div = document.createElement('div'); div.innerHTML = aHtml(n.r);
    d.appendChild(s); d.appendChild(div); sec.appendChild(d);
  });
  // datos para Google (FAQPage) con las preguntas que se ven
  var qs = Array.prototype.filter.call(document.querySelectorAll('details.fq'), function(d){ return !d.hidden; }).map(function(d){
    return { '@type': 'Question', name: d.querySelector('summary').textContent.trim(), acceptedAnswer: { '@type': 'Answer', text: d.querySelector('div').textContent.replace(/\s+/g, ' ').trim() } }; });
  var ld = Array.prototype.find.call(document.querySelectorAll('script[type="application/ld+json"]'), function(x){ return x.textContent.indexOf('FAQPage') !== -1; });
  if(ld) ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qs });
}
function aplicarLegal(l){
  if(!document.getElementById('terminos')) return;
  document.querySelectorAll('.lg-nota').forEach(function(x){ x.remove(); });
  Object.keys(l).forEach(function(k){
    var sec = document.getElementById(k); if(!sec) return;
    var n = document.createElement('div'); n.className = 'lg-nota'; n.innerHTML = aHtml(l[k]); sec.appendChild(n);
  });
}
function aplicarContenido(c){
  c = validarContenido(c);
  try{ aplicarFotos(c.fotos); }catch(e){}
  try{ aplicarFaq(c.faq); }catch(e){}
  try{ aplicarLegal(c.legal); }catch(e){}
}

export { FOTOS, MAX, RE_FOTO, SECCIONES_LEGAL, SEO_BASE, TEMAS_FAQ, aHtml, aplicarContenido, claveFaq, validarContenido };
