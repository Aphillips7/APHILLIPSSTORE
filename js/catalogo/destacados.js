// =================== CARRUSEL DESTACADOS ===================
// Modelos del carrusel (aun no estan en el catalogo). En "fotos": la 1.ª es el reloj de frente, las demas
// (muñeca, detalle...) aparecen con las flechitas de la tarjeta. "precio" y "etiqueta" se muestran solo si tienen texto.
import { _destEsc } from './ui.js';

var DEST_LOCAL = [
 {
  "nombre": "Invicta",
  "detalle": "Pro Diver Automático",
  "precio": "",
  "etiqueta": "",
  "fotos": [
   "img/destacado-1.webp"
  ]
 },
 {
  "nombre": "Invicta",
  "detalle": "Pro Diver Automático",
  "precio": "",
  "etiqueta": "",
  "fotos": [
   "img/destacado-2.webp"
  ]
 },
 {
  "nombre": "Invicta",
  "detalle": "Pro Diver Automático",
  "precio": "",
  "etiqueta": "",
  "fotos": [
   "img/destacado-3.webp"
  ]
 }
];


function _destVis(){ var t=document.getElementById('dest-track'); return Math.max(1, parseInt(getComputedStyle(t).getPropertyValue('--vis'))||3); }
var _bolsa = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 8h13l-1 12h-11z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/></svg>';
var _chevI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
var _chevD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';

// Carrusel infinito: la ventana (con las lineas entre tarjetas) queda fija y solo se desliza el contenido.
// Se dibujan copias a ambos lados y, al terminar de deslizar, se salta sin animacion a la posicion equivalente.
var _destN = 0, _destIdx = 0, _destC = 0, _destAnim = false, _destT = 0, _destHtml = [];
function _destMod(i){ return _destN ? ((i % _destN) + _destN) % _destN : 0; }
function _destPaso(){ var c=document.querySelector('#dest-track .dest-card'); return c ? c.getBoundingClientRect().width : 0; }
function _destCard(r){
  var fotos = (r.fotos||[]).map(function(src,i){ return '<img class="g'+(i===0?' on frente':'')+'" src="'+_destEsc(src)+'" alt="" draggable="false">'; }).join('');
  if(!fotos) fotos = '<span class="sinfoto">Sin foto</span>';
  var gal = (r.fotos||[]).length>1 ? '<button type="button" class="dest-gal izq" aria-label="Imagen anterior" onclick="destGal(this,-1)">'+_chevI+'</button><button type="button" class="dest-gal der" aria-label="Imagen siguiente" onclick="destGal(this,1)">'+_chevD+'</button>' : '';
  return '<div class="dest-card">'+
    '<div class="dest-foto">'+(r.etiqueta?'<span class="dest-badge">'+_destEsc(r.etiqueta)+'</span>':'')+fotos+gal+'</div>'+
    '<div class="dest-nombre">'+_destEsc(r.nombre)+'</div>'+
    (r.detalle?'<div class="dest-sub">'+_destEsc(r.detalle)+'</div>':'')+
    (r.precio?'<div class="dest-precio">'+_destEsc(r.precio)+'</div>':'')+
    '<div class="dest-comprar"><span>'+_bolsa+'Comprar ahora</span></div>'+
  '</div>';
}
function _destPos(anim){
  var t = document.getElementById('dest-track');
  if(anim) t.classList.add('anim'); else t.classList.remove('anim');
  t.style.setProperty('--pos', _destIdx + _destC);
  t.style.setProperty('--drag', '0px');
  if(!anim) void t.offsetWidth;
}
function renderDestacados(){
  var sec = document.getElementById('destacados'), track = document.getElementById('dest-track'); if(!track) return;
  _destN = DEST_LOCAL.length;
  if(!_destN){ sec.style.display='none'; return; }
  var vis = _destVis();
  _destC = _destN>1 ? vis+2 : 0;
  if(_destHtml.length !== _destN) _destHtml = DEST_LOCAL.map(_destCard);
  var h = '';
  for(var k=-_destC; k<_destN+_destC; k++) h += _destHtml[_destMod(k)];
  track.innerHTML = h;
  var dv = ''; for(var j=0; j<=vis; j++) dv += '<i style="--k:'+j+'"></i>';
  document.getElementById('dest-div').innerHTML = dv;
  _destAnim = false; _destIdx = _destMod(_destIdx);
  _destPos(false);
  destPuntos();
}
function destGal(btn, dir){ // cambia la imagen dentro de la tarjeta con fundido
  var foto = btn.closest('.dest-foto'), imgs = foto.querySelectorAll('.g'); if(imgs.length<2) return;
  var i = 0; imgs.forEach(function(im,k){ if(im.classList.contains('on')) i=k; });
  var n = (i+dir+imgs.length)%imgs.length;
  imgs[i].classList.remove('on'); imgs[n].classList.add('on');
}
function destPuntos(){
  var box = document.getElementById('dest-puntos');
  box.innerHTML = _destN>1 ? Array.apply(null,Array(_destN)).map(function(_,i){ return '<button type="button" class="dest-punto" aria-label="Ir al reloj '+(i+1)+'" onclick="destIr('+i+')"></button>'; }).join('') : '';
  document.getElementById('dest-nav').style.display = _destN>1 ? '' : 'none';
  destActualizar();
}
function _destFin(){
  if(!_destAnim) return;
  _destAnim = false;
  var m = _destMod(_destIdx);
  if(m !== _destIdx){ _destIdx = m; _destPos(false); }
}
function destMover(dir){
  if(_destN<2 || _destAnim) return;
  _destAnim = true; _destIdx += dir;
  _destPos(true); destActualizar();
  clearTimeout(_destT); _destT = setTimeout(_destFin, 800);
}
function destIr(pag){
  if(_destN<2 || _destAnim) return;
  var d = pag - _destMod(_destIdx); if(!d) return;
  if(Math.abs(d)===_destN-1) d = d>0 ? -1 : 1;
  if(Math.abs(d)===1){ destMover(d); }
  else { _destIdx = pag; _destPos(false); destActualizar(); }
}
function destTab(btn){ // por ahora solo cambia el subrayado; la funcion se configura despues
  document.querySelectorAll('#dest-tabs .dest-tab').forEach(function(b){ b.classList.toggle('on', b===btn); });
}
function destActualizar(){
  var pg = _destMod(_destIdx);
  document.querySelectorAll('#dest-puntos .dest-punto').forEach(function(d,i){ d.classList.toggle('on', i===pg); });
}
(function(){
  var t = document.getElementById('dest-track'), st = document.getElementById('dest-stage'); if(!t || !st) return;
  t.addEventListener('transitionend', function(e){ if(e.target===t && e.propertyName==='transform'){ clearTimeout(_destT); _destFin(); } });
  // arrastrar con el dedo o el mouse
  var x0=0, y0=0, dx=0, activo=false, movido=false;
  st.addEventListener('pointerdown', function(e){
    if(e.pointerType==='mouse' && e.button!==0) return;
    if(e.target.closest && e.target.closest('.dest-gal')) return;
    if(_destAnim || _destN<2) return;
    activo = true; movido = false; x0 = e.clientX; y0 = e.clientY; dx = 0;
  });
  st.addEventListener('pointermove', function(e){
    if(!activo) return;
    dx = e.clientX - x0;
    if(!movido){
      if(Math.abs(dx)<6) return;
      if(Math.abs(e.clientY-y0) > Math.abs(dx)){ activo = false; return; }
      movido = true; try{ st.setPointerCapture(e.pointerId); }catch(_){}
      st.classList.add('arrastrando'); t.classList.remove('anim');
    }
    t.style.setProperty('--drag', dx+'px');
  });
  function fin(){
    if(!activo) return; activo = false;
    if(!movido) return;
    st.classList.remove('arrastrando');
    var paso = _destPaso(), dir = 0;
    if(Math.abs(dx) > Math.min(60, paso*0.2)) dir = dx<0 ? 1 : -1;
    if(dir){ _destAnim = true; _destIdx += dir; clearTimeout(_destT); _destT = setTimeout(_destFin, 800); }
    _destPos(true); destActualizar();
  }
  st.addEventListener('pointerup', fin);
  st.addEventListener('pointercancel', fin);
  var ult = 0;
  window.addEventListener('resize', function(){ var v=_destVis(); if(v!==ult){ ult=v; renderDestacados(); } });
  renderDestacados(); ult = _destVis();
})();

export { _bolsa, _chevD, _chevI, _destAnim, _destC, _destCard, _destFin, _destHtml, _destIdx, _destMod, _destN, _destPaso, _destPos, _destT, _destVis, DEST_LOCAL, destActualizar, destGal, destIr, destMover, destPuntos, destTab, renderDestacados };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { destGal, destIr, destMover, destTab });
