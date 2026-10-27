// =================== VENTAS Y PROMOCIONES (editor de la tienda, fase 3) ===================
// Barra de anuncios que rota, ofertas con precio tachado, etiquetas en las tarjetas, ventana emergente y los
// mensajes de WhatsApp. Lo usan la tienda (catalogo, carrusel, ficha) y el panel (validacion y editor).
// POKA-YOKE:
// - Una oferta solo se muestra si su precio es MENOR que el precio normal, el reloj no esta vendido y esta
//   dentro de sus fechas (las vencidas se apagan solas). El panel no deja publicar ofertas mal puestas.
// - Textos con largo maximo y sin HTML; fechas con formato aaaa-mm-dd; ids de relojes con formato valido.

const RE_ID = /^[A-Za-z0-9_-]{1,120}$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ETIQUETAS_LISTAS = ['Nuevo', 'Últimas unidades', 'Edición limitada', 'Más vendido', 'Recomendado', 'Oferta'];
const MAX = { anuncios: 6, ofertas: 60, etiquetas: 100 };
const WA_BASE = {
  comprar: 'Me interesa el {reloj} que vi en el catálogo, ¿sigue disponible?',
  cotizar: 'Quiero cotizar el modelo {reloj} que vi en el catálogo bajo pedido.'
};

function txt(v, max){ return String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function fecha(v){ v = String(v || '').trim(); return RE_FECHA.test(v) ? v : ''; }
function validarPromos(p){
  p = p && typeof p === 'object' ? p : {};
  var out = { anuncios: [], ofertas: [], etiquetas: [], popup: {}, wa: {} };
  (Array.isArray(p.anuncios) ? p.anuncios : []).forEach(function(a){
    var t = txt(a && a.texto, 70); if(t && out.anuncios.length < MAX.anuncios) out.anuncios.push({ texto: t, desde: fecha(a.desde), hasta: fecha(a.hasta) });
  });
  var vistos = {};
  (Array.isArray(p.ofertas) ? p.ofertas : []).forEach(function(o){
    if(!o || !RE_ID.test(String(o.id || '')) || vistos[o.id] || out.ofertas.length >= MAX.ofertas) return;
    var pr = Math.round(Number(o.precio) * 100) / 100; if(!(pr > 0 && pr < 1000000)) return;
    vistos[o.id] = 1; out.ofertas.push({ id: String(o.id), precio: pr, hasta: fecha(o.hasta) });
  });
  var ve = {};
  (Array.isArray(p.etiquetas) ? p.etiquetas : []).forEach(function(e){
    var t = txt(e && e.texto, 22);
    if(!e || !RE_ID.test(String(e.id || '')) || !t || ve[e.id] || out.etiquetas.length >= MAX.etiquetas) return;
    ve[e.id] = 1; out.etiquetas.push({ id: String(e.id), texto: t });
  });
  var q = p.popup && typeof p.popup === 'object' ? p.popup : {};
  out.popup = {
    activo: q.activo === true,
    titulo: txt(q.titulo, 50), texto: txt(q.texto, 220), boton: txt(q.boton, 24),
    destino: ['catalogo', 'boletin', 'reloj', 'ninguno'].indexOf(q.destino) !== -1 ? q.destino : 'catalogo',
    reloj: RE_ID.test(String(q.reloj || '')) ? String(q.reloj) : '',
    momento: q.momento === 'salida' ? 'salida' : 'entrada',
    segundos: Math.min(60, Math.max(2, Math.round(Number(q.segundos)) || 6)),
    desde: fecha(q.desde), hasta: fecha(q.hasta)
  };
  var w = p.wa && typeof p.wa === 'object' ? p.wa : {};
  ['comprar', 'cotizar'].forEach(function(k){ var t = txt(w[k], 300); if(t) out.wa[k] = t; });
  return out;
}

// ---------- fechas (dia de Panama del navegador del cliente) ----------
function hoy(){ var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function vigente(desde, hasta, dia){ dia = dia || hoy(); return (!desde || dia >= desde) && (!hasta || dia <= hasta); }

// ---------- para el catalogo ----------
function promos(){ return window.__promos || null; }
// oferta activa de un reloj: { precio, antes, pct, hasta } o null
function ofertaDe(r){
  var p = promos(); if(!p || !r || !(Number(r.precio) > 0) || r.estado === 'vendido') return null;
  var o = p.ofertas.find(function(x){ return x.id === r.id; });
  if(!o || !(o.precio < Number(r.precio)) || !vigente('', o.hasta)) return null;
  return { precio: o.precio, antes: Number(r.precio), pct: Math.round((1 - o.precio / Number(r.precio)) * 100), hasta: o.hasta };
}
function etiquetaDe(r){ var p = promos(); if(!p || !r) return ''; var e = p.etiquetas.find(function(x){ return x.id === r.id; }); return e ? e.texto : ''; }
function precioVisible(r){ var o = ofertaDe(r); return o ? o.precio : Number(r && r.precio) || 0; }
// mensaje de WhatsApp: {reloj} y {precio}
function mensajeWa(tipo, datos){
  var p = promos(), t = (p && p.wa && p.wa[tipo]) || WA_BASE[tipo] || '';
  // con oferta: si el mensaje no trae {precio}, el precio de oferta va junto al nombre (para no repetirlo)
  var reloj = (datos.reloj || '') + (datos.oferta && t.indexOf('{precio}') === -1 ? ' en oferta a ' + datos.oferta : '');
  return t.replace(/\{reloj\}/g, reloj).replace(/\{precio\}/g, datos.precio || '').replace(/\s+/g, ' ').trim();
}
function dinero(n){ return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }

export { ETIQUETAS_LISTAS, MAX, WA_BASE, dinero, etiquetaDe, hoy, mensajeWa, ofertaDe, precioVisible, validarPromos, vigente };
