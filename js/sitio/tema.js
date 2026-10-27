// =================== DISENO DE LA TIENDA (editor del panel, fase 1) ===================
// Un "tema" es un objeto pequeno con los colores, la forma de los botones, las esquinas de las fotos y el
// tamano de los titulos. Lo usan la tienda (para aplicarlo) y el panel (vista previa y validacion).
// POKA-YOKE:
// - validarTema() deja pasar solo campos conocidos y valores con formato correcto (lo demas vuelve al original).
// - cssDeTema() escribe CSS SOLO para lo que cambio respecto al original: con el tema original la tienda se ve
//   exactamente igual que sin editor.
// - problemasTema() avisa si un texto no se leeria sobre su fondo (contraste WCAG < 4.5); el panel no deja
//   publicar mientras haya problemas.

const TEMA_BASE = {
  acento: '#a7c4d6',        // glaciar: detalles, etiquetas, barra de puntos, flechas
  barraFondo: '#a7c4d6',    // barra de arriba ("Envios a todo Panama")
  barraTexto: '#09090b',
  botonFondo: '#09090b',    // botones principales: Comprar por WhatsApp, Cotizar, Comprar ahora
  botonTexto: '#ffffff',
  oscuro: '#0b0b0c',        // secciones oscuras (Encuentra tu proximo reloj, reloj de Panama)
  carrusel: '#c3d6e3',      // color de arriba del degradado del carrusel "Mas vendidos"
  formaBotones: 'original', // original | recta | suave | pildora
  esquinasFotos: -1,        // -1 = como estan; 0 a 24 px
  escalaTitulos: 100        // 85 a 125 (%)
};
const FORMAS = { original: null, recta: '0px', suave: '10px', pildora: '999px' };
const COLORES = ['acento', 'barraFondo', 'barraTexto', 'botonFondo', 'botonTexto', 'oscuro', 'carrusel'];
const RE_HEX = /^#[0-9a-f]{6}$/;

function hex(v){
  var t = String(v == null ? '' : v).trim().toLowerCase();
  if(/^#[0-9a-f]{3}$/.test(t)) t = '#' + t[1] + t[1] + t[2] + t[2] + t[3] + t[3];
  return RE_HEX.test(t) ? t : null;
}
function validarTema(t){
  t = t && typeof t === 'object' ? t : {};
  var out = {};
  COLORES.forEach(function(k){ out[k] = hex(t[k]) || TEMA_BASE[k]; });
  out.formaBotones = Object.prototype.hasOwnProperty.call(FORMAS, t.formaBotones) ? t.formaBotones : TEMA_BASE.formaBotones;
  var e = Math.round(Number(t.esquinasFotos));
  out.esquinasFotos = isFinite(e) && e >= 0 && e <= 24 ? e : -1;
  var s = Math.round(Number(t.escalaTitulos));
  out.escalaTitulos = isFinite(s) && s >= 85 && s <= 125 ? s : 100;
  return out;
}
function iguales(a, b){ a = validarTema(a); b = validarTema(b); return Object.keys(TEMA_BASE).every(function(k){ return a[k] === b[k]; }); }

// ---------- color ----------
function rgb(h){ h = hex(h) || '#000000'; return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function luminancia(h){
  return rgb(h).map(function(c){ c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); })
    .reduce(function(a, c, i){ return a + c * [0.2126, 0.7152, 0.0722][i]; }, 0);
}
function contraste(a, b){ var x = luminancia(a), y = luminancia(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function mezclar(a, b, t){ var x = rgb(a), y = rgb(b); return '#' + x.map(function(c, i){ return ('0' + Math.round(c + (y[i] - c) * t).toString(16)).slice(-2); }).join(''); }
function rgba(h, a){ var c = rgb(h); return 'rgba(' + c.join(',') + ',' + a + ')'; }

// Pares texto/fondo que deben leerse bien (minimo 4.5:1)
function problemasTema(t){
  t = validarTema(t);
  var pares = [
    ['Barra de arriba', t.barraTexto, t.barraFondo],
    ['Botones principales', t.botonTexto, t.botonFondo],
    ['Etiquetas y botones glaciar (texto negro encima)', '#09090b', t.acento],
    ['Secciones oscuras (texto blanco encima)', '#ffffff', t.oscuro]
  ];
  return pares.map(function(p){ return { donde: p[0], ratio: Math.round(contraste(p[1], p[2]) * 10) / 10 }; })
    .filter(function(x){ return x.ratio < 4.5; });
}

// ---------- CSS ----------
// Solo lo que cambio: con el tema original devuelve '' (la tienda queda exactamente como esta)
function cssDeTema(t){
  t = validarTema(t);
  var b = TEMA_BASE, c = [];
  if(t.acento !== b.acento){
    c.push('html.glaciar,:root{--glaciar:' + t.acento + ';}');
    c.push('html.glaciar .hora{--hora-punto:' + rgba(t.acento, 0.85) + ';}');
    c.push('#futuro{--fut-gl:' + t.acento + ';}');
  }
  if(t.barraFondo !== b.barraFondo || t.barraTexto !== b.barraTexto)
    c.push('html.glaciar .barra-aviso,.barra-aviso{background:' + t.barraFondo + ';color:' + t.barraTexto + ';}');
  if(t.botonFondo !== b.botonFondo || t.botonTexto !== b.botonTexto){
    c.push('.btn-wa,.card-cotizar,.fut-comprar{background:' + t.botonFondo + ';border-color:' + t.botonFondo + ';color:' + t.botonTexto + ';}');
    c.push('.btn-wa:hover,.card-cotizar:hover,.fut-comprar:hover{background:' + t.botonFondo + ';color:' + t.botonTexto + ';filter:brightness(1.12);}');
  }
  if(FORMAS[t.formaBotones]) c.push('.btn-wa,.card-cotizar,.fut-comprar,.hero-btn{border-radius:' + FORMAS[t.formaBotones] + ';}');
  if(t.oscuro !== b.oscuro) c.push('#futuro{--fut-oscuro:' + t.oscuro + ';}.hora{background:' + t.oscuro + ';}');
  if(t.carrusel !== b.carrusel){
    var g = t.carrusel;
    c.push('html.glaciar #destacados,#destacados{--dgrad:linear-gradient(180deg,' + g + ' 0%,' + mezclar(g, '#ffffff', 0.25) + ' 25%,' +
      mezclar(g, '#ffffff', 0.5) + ' 50%,' + mezclar(g, '#ffffff', 0.75) + ' 75%,#fff 100%);}');
  }
  if(t.esquinasFotos >= 0) c.push('.card-foto,.dest-foto,.gen-tile,.marca-foto,.par-foto{border-radius:' + t.esquinasFotos + 'px;overflow:hidden;}');
  if(t.escalaTitulos !== 100)
    c.push('.hero-title,.gen-titulo,.marcas-titulo,.fut-titulo,.fut-titulo-2,.cat-titulo,.par-titulo,.fav-titulo{zoom:' + (t.escalaTitulos / 100) + ';}');
  return c.join('\n');
}

// Temas listos para elegir con un toque
const TEMAS_LISTOS = [
  { id: 'original', nombre: 'Original (glaciar)', tema: Object.assign({}, TEMA_BASE) },
  { id: 'negro', nombre: 'Clásico negro', tema: Object.assign({}, TEMA_BASE, { acento: '#d4d4d8', barraFondo: '#09090b', barraTexto: '#ffffff', carrusel: '#e4e4e7' }) },
  { id: 'dorado', nombre: 'Dorado', tema: Object.assign({}, TEMA_BASE, { acento: '#d4b46a', barraFondo: '#d4b46a', barraTexto: '#09090b', carrusel: '#ead9b0' }) },
  { id: 'navidad', nombre: 'Navidad', tema: Object.assign({}, TEMA_BASE, { acento: '#e7b9b9', barraFondo: '#8b1e2d', barraTexto: '#ffffff', botonFondo: '#8b1e2d', oscuro: '#123524', carrusel: '#f0d4d4' }) },
  { id: 'blackfriday', nombre: 'Black Friday', tema: Object.assign({}, TEMA_BASE, { acento: '#facc15', barraFondo: '#09090b', barraTexto: '#facc15', carrusel: '#e4e4e7', formaBotones: 'recta' }) }
];

export { COLORES, FORMAS, TEMA_BASE, TEMAS_LISTOS, contraste, cssDeTema, iguales, problemasTema, validarTema };
