// =================== PORTADA A TU MEDIDA (editor de la tienda, fase 2) ===================
// Orden y visibilidad de las secciones de la portada, textos editables, relojes de "Mas vendidos" y a que reloj
// lleva cada boton de "El futuro en tu muneca". Lo usan la tienda (aplicarPortada) y el panel (validarPortada).
// POKA-YOKE: solo textos con largo maximo (sin HTML: se escapa todo; **negrita** y saltos de linea permitidos),
// ids de relojes con formato valido, secciones conocidas. Un texto vacio = el texto original de la pagina.

const SECCIONES = [
  { id: 'destacados', nombre: 'Más vendidos (carrusel)' },
  { id: 'generos', nombre: 'Relojes de hombre / mujer' },
  { id: 'futuro', nombre: 'El futuro en tu muñeca' },
  { id: 'marcas', nombre: 'Marcas' }
];
// clave: [selector, largo maximo, multilinea, grupo, etiqueta]
const TEXTOS = {
  barra: ['.barra-aviso', 60, false, 'Barra de arriba', 'Mensaje de la barra'],
  heroEti: ['.hero-eyebrow', 60, false, 'Banner principal', 'Texto pequeño sobre el título'],
  heroTitulo: ['.hero-title', 70, true, 'Banner principal', 'Título'],
  heroBoton: ['.hero .hero-btn', 24, false, 'Banner principal', 'Botón'],
  destTitulo: ['#dest-tabs .dest-tab', 40, false, 'Más vendidos', 'Título del carrusel'],
  genHombre: ['.gen-hombre .gen-titulo', 40, true, 'Hombre / mujer', 'Título de hombre'],
  genMujer: ['.gen-mujer .gen-titulo', 40, true, 'Hombre / mujer', 'Título de mujer'],
  genBoton: ['#generos .hero-btn', 24, false, 'Hombre / mujer', 'Botones'],
  futEti: ['.fut-claro .fut-eti', 40, false, 'El futuro en tu muñeca', 'Texto pequeño sobre el título'],
  futTitulo: ['.fut-titulo', 60, true, 'El futuro en tu muñeca', 'Título'],
  futDesc: ['.fut-desc', 260, true, 'El futuro en tu muñeca', 'Descripción'],
  futComprar: ['.fut-comprar', 24, false, 'El futuro en tu muñeca', 'Botón Comprar ahora'],
  fichaNombre: ['.fut-ficha b', 40, false, 'El futuro en tu muñeca', 'Ficha del reloj: nombre'],
  fichaDesc: ['.fut-ficha span', 120, false, 'El futuro en tu muñeca', 'Ficha del reloj: descripción'],
  fut2Eti: ['.fut-oscuro .fut-eti', 40, false, 'Encuentra tu próximo reloj', 'Texto pequeño sobre el título'],
  fut2Titulo: ['.fut-titulo-2', 60, false, 'Encuentra tu próximo reloj', 'Título'],
  card1Nombre: ['.fut-card-a .fut-card-pie b', 40, false, 'Encuentra tu próximo reloj', 'Tarjeta 1: nombre'],
  card1Desc: ['.fut-card-a .fut-card-pie span', 120, false, 'Encuentra tu próximo reloj', 'Tarjeta 1: descripción'],
  card2Nombre: ['.fut-card-b .fut-card-pie b', 40, false, 'Encuentra tu próximo reloj', 'Tarjeta 2: nombre'],
  card2Desc: ['.fut-card-b .fut-card-pie span', 120, false, 'Encuentra tu próximo reloj', 'Tarjeta 2: descripción'],
  marcasTitulo: ['.marcas-titulo', 40, false, 'Marcas', 'Título'],
  marcasSub: ['.marcas-sub', 160, false, 'Marcas', 'Frase']
};
// botones que abren un reloj: clave -> selector del boton
const ENLACES = {
  futComprar: ['.fut-comprar', 'Botón "Comprar ahora"'],
  futCard1: ['.fut-card-a .fut-esq button', 'Flecha de la tarjeta 1'],
  futCard2: ['.fut-card-b .fut-esq button', 'Flecha de la tarjeta 2']
};
const RE_ID = /^[A-Za-z0-9_-]{1,120}$/;
const MAX_DESTACADOS = 12;

function texto(v, max){ return String(v == null ? '' : v).replace(/[\u0000-\u0009\u000b-\u001f<>]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max); }
function validarPortada(p){
  p = p && typeof p === 'object' ? p : {};
  var out = { secciones: [], textos: {}, destacados: [], enlaces: {} };
  var vistas = {};
  (Array.isArray(p.secciones) ? p.secciones : []).forEach(function(s){
    if(s && SECCIONES.some(function(x){ return x.id === s.id; }) && !vistas[s.id]){ vistas[s.id] = 1; out.secciones.push({ id: s.id, visible: s.visible !== false }); }
  });
  SECCIONES.forEach(function(x){ if(!vistas[x.id]) out.secciones.push({ id: x.id, visible: true }); });   // las que falten, al final y visibles
  var t = p.textos && typeof p.textos === 'object' ? p.textos : {};
  Object.keys(TEXTOS).forEach(function(k){ var v = texto(t[k], TEXTOS[k][1]); if(!TEXTOS[k][2]) v = v.replace(/\n/g, ' '); if(v) out.textos[k] = v; });
  (Array.isArray(p.destacados) ? p.destacados : []).forEach(function(id){ if(RE_ID.test(String(id)) && out.destacados.indexOf(id) === -1 && out.destacados.length < MAX_DESTACADOS) out.destacados.push(String(id)); });
  var e = p.enlaces && typeof p.enlaces === 'object' ? p.enlaces : {};
  Object.keys(ENLACES).forEach(function(k){ if(RE_ID.test(String(e[k] || ''))) out.enlaces[k] = String(e[k]); });
  return out;
}

// ---------- en la tienda ----------
function esc(t){ return String(t).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
// texto seguro: se escapa todo y luego **negrita** y saltos de linea
function formato(t){ return esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }
function aplicarPortada(p){
  p = validarPortada(p);
  // textos (el original se guarda la primera vez para poder volver a el)
  Object.keys(TEXTOS).forEach(function(k){
    document.querySelectorAll(TEXTOS[k][0]).forEach(function(el){
      if(k === 'futComprar'){   // solo el texto: el boton tiene su flecha adentro
        var nodo = Array.prototype.find.call(el.childNodes, function(n){ return n.nodeType === 3; });
        if(!nodo) return;
        if(el.dataset.orig == null) el.dataset.orig = nodo.textContent;
        nodo.textContent = p.textos[k] || el.dataset.orig;
        return;
      }
      if(el.dataset.orig == null) el.dataset.orig = el.innerHTML;
      var nuevo = p.textos[k] ? formato(p.textos[k]) : el.dataset.orig;
      if(el.innerHTML !== nuevo) el.innerHTML = nuevo;
    });
  });
  // botones que abren un reloj
  Object.keys(ENLACES).forEach(function(k){
    document.querySelectorAll(ENLACES[k][0]).forEach(function(b){
      if(b.dataset.origClick == null) b.dataset.origClick = b.getAttribute('onclick') || '';
      b.setAttribute('onclick', p.enlaces[k] ? "abrir('" + p.enlaces[k] + "')" : b.dataset.origClick);
    });
  });
  // orden y visibilidad de las secciones (solo entre las de la portada, antes del catalogo)
  var ancla = document.getElementById('catalogo');
  if(ancla){
    p.secciones.forEach(function(s){
      var el = document.getElementById(s.id); if(!el) return;
      ancla.parentNode.insertBefore(el, ancla);
      el.classList.toggle('sitio-oculta', !s.visible);
    });
    if(!document.getElementById('sitio-oculta-css')){
      var st = document.createElement('style'); st.id = 'sitio-oculta-css'; st.textContent = '.sitio-oculta{display:none !important;}'; document.head.appendChild(st);
    }
  }
  window.__sitioPortada = p;
  try{ document.dispatchEvent(new CustomEvent('sitio-portada', { detail: p })); }catch(e){}
}

export { ENLACES, MAX_DESTACADOS, SECCIONES, TEXTOS, aplicarPortada, validarPortada };
