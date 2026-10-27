// =================== CONTROL DE LA TIENDA (Tienda > Control en el panel) ===================
// Fase 5: aviso de vacaciones (franja arriba en todas las paginas y nota junto al boton de WhatsApp de la
// ficha) y conteo de vistas y toques por seccion de la portada.
// Misma validacion en la API (cloudflare/fotos-worker, validarSitioControl): si cambias una, cambia la otra.
import { hoy, vigente } from './promos.js';

const MAX_VACACIONES = 160;
// secciones que se cuentan (id del elemento en la portada -> nombre en el panel)
const SECCIONES_CLICS = { hero: 'Banner principal', destacados: 'Más vendidos', generos: 'Hombre / Mujer', futuro: 'El futuro en tu muñeca',
  marcas: 'Marcas', catalogo: 'Catálogo', popup: 'Ventana emergente' };

function fecha(v){ v = String(v || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''; }
function validarControl(c){
  c = c && typeof c === 'object' ? c : {};
  var v = c.vacaciones && typeof c.vacaciones === 'object' ? c.vacaciones : {};
  return { vacaciones: { activo: v.activo === true, texto: String(v.texto == null ? '' : v.texto).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_VACACIONES),
    desde: fecha(v.desde), hasta: fecha(v.hasta) } };
}
function vacacionesActivas(c){ var v = validarControl(c).vacaciones; return v.activo && v.texto && vigente(v.desde, v.hasta, hoy()) ? v : null; }

function aplicarControl(c){
  var v = vacacionesActivas(c);
  var franja = document.getElementById('aviso-vacaciones'), nota = document.getElementById('vac-nota');
  if(!v){ if(franja) franja.remove(); if(nota) nota.remove(); return; }
  if(!franja){
    franja = document.createElement('div'); franja.id = 'aviso-vacaciones'; franja.className = 'aviso-vacaciones'; franja.setAttribute('role', 'status');
    // en la tienda el encabezado va fijo arriba: la franja va dentro, debajo de la barra de anuncios
    var barra = document.querySelector('#site-header .barra-aviso');
    if(barra) barra.parentNode.insertBefore(franja, barra.nextSibling); else document.body.insertBefore(franja, document.body.firstChild);
  }
  franja.textContent = v.texto;
  // en la ficha, justo arriba del boton de WhatsApp (el cliente sabe que la respuesta puede tardar)
  var wa = document.getElementById('modal-wa');
  if(wa){
    if(!nota){ nota = document.createElement('p'); nota.id = 'vac-nota'; nota.className = 'vac-nota'; wa.parentNode.insertBefore(nota, wa); }
    nota.textContent = v.texto;
  }
}

// ---------- vistas y toques por seccion (solo en la portada) ----------
var _contando = false;
function contarSecciones(){
  if(_contando || window.__vistaPrevia || !document.getElementById('hero')) return;
  _contando = true;
  import('../catalogo/metricas.js').then(function(m){
    var vistas = {}, toques = {};
    function vista(id){ if(!vistas[id]){ vistas[id] = 1; m.incMetrica('sec:' + id, 'vistas'); } }
    function toque(id){ if(!toques[id]){ toques[id] = 1; m.incMetrica('sec:' + id, 'clics'); } }
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ vista(e.target.id); io.unobserve(e.target); } });
    }, { threshold: 0.35 }) : null;
    Object.keys(SECCIONES_CLICS).forEach(function(id){
      var s = document.getElementById(id); if(!s || id === 'popup') return;
      if(io) io.observe(s);
      s.addEventListener('click', function(e){ if(e.target.closest('a,button,[onclick]')) toque(id); }, true);
    });
    // ventana emergente (Tienda > Promociones): se cuenta al mostrarse y al tocar su boton
    document.addEventListener('click', function(e){ if(e.target.closest('.aph-popup-btn')) toque('popup'); }, true);
    new MutationObserver(function(){ if(document.querySelector('.aph-popup')) vista('popup'); }).observe(document.body, { childList: true });
  }).catch(function(){});
}

export { MAX_VACACIONES, SECCIONES_CLICS, aplicarControl, contarSecciones, vacacionesActivas, validarControl };
