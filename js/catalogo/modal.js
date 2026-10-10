import { relojes } from './datos.js';
import { _favoritos } from './favoritos.js';
import { incMetrica } from './metricas.js';
import { _destEsc as esc, toast } from './ui.js';
import { WHATSAPP_NUM } from './whatsapp.js';
import { textoETA } from '../products.js';

let _idAbierto = null;

// Etiqueta de estado (misma en la grilla y en la pagina del reloj)
const ETIQUETAS = {
  disponible: { txt:'Disponible', cls:'disponible' },
  transito:   { txt:'En tránsito', cls:'transito' },
  bajopedido: { txt:'Bajo pedido', cls:'pedido' },
  vendido:    { txt:'Agotado', cls:'agotado' }
};
function etiquetaEstado(estado){ return ETIQUETAS[estado] || ETIQUETAS.disponible; }

// Brazalete de 3 filas: eslabones laterales redondeados y centrales pulidos, alternados
function eslabones(){
  var s = '<path d="M34 3.5c4-1 20-1 24 0M34 60.5c4 1 20 1 24 0"/>';
  for(var y = 5; y < 50; y += 8.6){
    s += '<rect x="34" y="'+y+'" width="7" height="7.4" rx="2"/><rect x="51" y="'+y+'" width="7" height="7.4" rx="2"/>';
    s += '<rect x="42.6" y="'+(y+3.2)+'" width="6.8" height="7.4" rx="1.6"/><path d="M44.5 '+(y+5.2)+'h3"/>';
  }
  return s;
}

// Iconos de linea detallados (estilo TAG Heuer) para cada grupo de especificaciones
const SVG = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const ICONOS = {
  // calibre visto por detras: rotor, volante, rueda dentada, rubies y tornillos
  movimiento: SVG+
    '<circle cx="32" cy="32" r="29"/><circle cx="32" cy="32" r="26"/>'+
    '<path d="M9.6 29.5A22.5 22.5 0 0 1 54.4 29.5H36.2a4.3 4.3 0 0 0-8.4 0z"/><path d="M14.5 26.2A18 18 0 0 1 49.5 26.2"/><path d="M19 22.5A14 14 0 0 1 45 22.5" stroke-dasharray="1.2 2"/>'+
    '<circle cx="32" cy="29.5" r="1.6"/>'+
    '<circle cx="21" cy="44" r="6.5"/><circle cx="21" cy="44" r="4.6"/><path d="M21 39.4v9.2M16.4 44h9.2"/><circle cx="21" cy="44" r="1"/>'+
    '<circle cx="43.5" cy="44" r="6.2" stroke-width="2.2" stroke-dasharray="1.15 1.3"/><circle cx="43.5" cy="44" r="4.4"/><circle cx="43.5" cy="44" r="1.1"/>'+
    '<path d="M27.5 44h9.6"/><circle cx="32" cy="52.5" r="1.3"/><circle cx="32" cy="38.5" r="1"/>'+
    '<circle cx="12" cy="36" r="1.6"/><path d="M11 37l2-2"/><circle cx="52" cy="36" r="1.6"/><path d="M51 37l2-2"/><circle cx="32" cy="57.5" r="1.4"/><path d="M31 58.5l2-2"/>'+
  '</svg>',
  // caja vista de frente: asas, bisel con marcas, corona y pulsadores
  caja: SVG+
    '<path d="M21 13.5 23.5 4h17L43 13.5M21 50.5 23.5 60h17L43 50.5"/><path d="M26 4.5v4M38 4.5v4M26 55.5v4M38 55.5v4"/>'+
    '<circle cx="32" cy="32" r="21"/><circle cx="32" cy="32" r="17.5"/><circle cx="32" cy="32" r="19.25" stroke-width="2" stroke-dasharray=".7 9.38"/>'+
    '<circle cx="32" cy="32" r="14"/><path d="M22.5 25.5a11 11 0 0 1 6-6"/>'+
    '<path d="M53 29.5h3.5v5H53"/><rect x="56.5" y="28" width="3.5" height="8" rx="1"/><path d="M57.3 30h1.9M57.3 32h1.9M57.3 34h1.9"/>'+
    '<path d="M48.5 19.5l2.6-2.3 2 2.2-2.6 2.3M48.5 44.5l2.6 2.3 2-2.2-2.6-2.3"/>'+
  '</svg>',
  // esfera: indices, minutero, agujas, subesfera y ventana de fecha
  esfera: SVG+
    '<circle cx="32" cy="32" r="28"/><circle cx="32" cy="32" r="24.5"/>'+
    '<circle cx="32" cy="32" r="22.5" stroke-width="1.6" stroke-dasharray=".35 2.005"/><circle cx="32" cy="32" r="20" stroke-width="3" stroke-dasharray="1.2 9.27"/>'+
    '<circle cx="32" cy="43" r="5.5"/><path d="M32 43l2.5-3"/><rect x="42" y="29.5" width="7" height="5" rx=".5"/>'+
    '<path d="M32 32 23.5 21.5" stroke-width="2.2"/><path d="M32 32 44.5 16" stroke-width="1.5"/><path d="M32 36V11" stroke-width=".8"/>'+
    '<circle cx="32" cy="32" r="1.8" fill="currentColor"/>'+
  '</svg>',
  // correa de piel con hebilla + brazalete de eslabones
  correa: SVG+
    '<path d="M10 4h12v56H10z"/><path d="M12.5 8v10M19.5 8v10"/><circle cx="16" cy="26" r="1"/><circle cx="16" cy="31" r="1"/><circle cx="16" cy="36" r="1"/>'+
    '<rect x="8.5" y="41" width="3" height="8" rx="1"/><rect x="20.5" y="41" width="3" height="8" rx="1"/><path d="M8 41h16v12H8z"/><path d="M16 41v8.5"/><path d="M9.5 44h13"/>'+
    eslabones()+
  '</svg>',
  // certificado con sello
  info: SVG+
    '<path d="M12 6h30l10 10v42H12z"/><path d="M42 6v10h10"/><path d="M18 18h18M18 23h26M18 28h26M18 33h16"/>'+
    '<circle cx="40" cy="44" r="7"/><circle cx="40" cy="44" r="4.5" stroke-dasharray="1 1.2"/><path d="M35.5 49.5 33 58l4-2 2 3.5 1.5-8M44.5 49.5 47 58l-4-2-2 3.5"/>'+
  '</svg>'
};

function spec(label, val){
  if(!val) return '';
  return '<div class="spec-row"><span>'+esc(label)+' : </span><b>'+val+'</b></div>';
}

// Un grupo dentro de "Especificaciones tecnicas": icono + titulo + datos
function grupo(icono, titulo, filas){
  if(!filas) return '';
  return '<div class="esp-grupo"><span class="esp-ico">'+ICONOS[icono]+'</span><div class="esp-txt"><h3 class="esp-titulo">'+titulo+'</h3>'+filas+'</div></div>';
}

// Una barra desplegable (details/summary: se abre y cierra sin JS)
function barra(titulo, contenido){
  if(!contenido) return '';
  return '<details class="det">'+
    '<summary class="det-btn"><span class="det-titulo">'+titulo+'</span><span class="det-mas" aria-hidden="true"></span></summary>'+
    '<div class="det-panel">'+contenido+'</div>'+
  '</details>';
}

function min(t){ return String(t||'').toLowerCase(); }

// Si el reloj no tiene descripcion escrita, se arma una con sus datos
function descripcionAuto(r){
  var gen = r.genero==='hombre' ? 'para hombre' : r.genero==='mujer' ? 'para mujer' : r.genero==='unisex' ? 'unisex' : '';
  var t = esc(r.nombre||'Este reloj')+' es un reloj'+(gen?' '+gen:'');
  if(r.movimiento) t += ' con movimiento '+esc(min(r.movimiento));
  if(r.mm) t += ', caja de '+esc(r.mm)+' mm'+(r.materialCaja?' en '+esc(min(r.materialCaja)):'');
  if(r.colorEsfera) t += ' y esfera '+esc(min(r.colorEsfera));
  t += '.';
  if(r.materialCorrea) t += ' Correa de '+esc(min(r.materialCorrea))+'.';
  if(r.agua) t += ' Resistencia al agua: '+esc(r.agua)+'.';
  return t;
}

// ---------- galeria de fotos de la pagina del reloj ----------
// Usa r.fotos (fotos en la nube, en orden); si no hay, la foto principal r.foto.
let _galIdx = 0, _galN = 0;
function pintarGaleria(r){
  var cont = document.getElementById('modal-foto');
  var lista = (Array.isArray(r.fotos) && r.fotos.length) ? r.fotos : (r.foto ? [r.foto] : []);
  _galIdx = 0; _galN = lista.length;
  if(!_galN){ cont.innerHTML = '<span class="sinfoto">Sin foto</span>'; return; }
  var alt = esc(r.nombre || 'Reloj');
  var html = lista.map(function(src, i){
    return '<img class="pf-img'+(i===0?' on':'')+'" src="'+esc(src)+'" alt="'+alt+(_galN>1?' — foto '+(i+1)+' de '+_galN:'')+'"'+(i>0?' loading="lazy"':'')+' draggable="false" />';
  }).join('');
  if(_galN > 1){
    html += '<button type="button" class="pf-flecha izq" aria-label="Foto anterior" onclick="galeriaMover(-1)"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>'+
      '<button type="button" class="pf-flecha der" aria-label="Foto siguiente" onclick="galeriaMover(1)"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>'+
      '<div class="pf-puntos">'+lista.map(function(_, i){ return '<button type="button" class="pf-punto'+(i===0?' on':'')+'" aria-label="Ver foto '+(i+1)+'" onclick="galeriaIr('+i+')"></button>'; }).join('')+'</div>';
  }
  cont.innerHTML = html;
}
function galeriaIr(i){
  if(_galN < 2) return;
  _galIdx = ((i % _galN) + _galN) % _galN;
  var cont = document.getElementById('modal-foto');
  cont.querySelectorAll('.pf-img').forEach(function(im, k){ im.classList.toggle('on', k===_galIdx); });
  cont.querySelectorAll('.pf-punto').forEach(function(p, k){ p.classList.toggle('on', k===_galIdx); });
}
function galeriaMover(dir){ galeriaIr(_galIdx + dir); }
// deslizar con el dedo para cambiar de foto
(function(){
  var cont = document.getElementById('modal-foto'); if(!cont) return;
  var x0 = 0, y0 = 0;
  cont.addEventListener('touchstart', function(e){ var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, {passive:true});
  cont.addEventListener('touchend', function(e){
    var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    if(Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) galeriaMover(dx < 0 ? 1 : -1);
  }, {passive:true});
})();

function copiarSku(e, sku){
  e.stopPropagation();
  if(navigator.clipboard){ navigator.clipboard.writeText(sku).then(function(){ toast('Referencia copiada: '+sku); }); }
}

function abrir(id){
  var r = relojes.find(function(x){ return x.id === id; });
  if(!r) return;
  _idAbierto = id;
  pintarGaleria(r);

  var eti = etiquetaEstado(r.estado);
  var badgeEl = document.getElementById('modal-badge');
  badgeEl.className = 'prod-eti '+eti.cls;
  badgeEl.textContent = eti.txt;

  document.getElementById('modal-nombre').textContent = r.nombre || '';
  document.getElementById('modal-spec').textContent = [r.movimiento, r.mm ? r.mm+' mm' : '', r.materialCaja].filter(Boolean).join(', ');
  var skuHtml = r.sku ? '<span class="sku-copy" onclick="copiarSku(event,\''+esc(String(r.sku).replace(/\\/g,'\\\\').replace(/'/g,"\\'"))+'\')" title="Toca para copiar la referencia">'+esc(r.sku)+'</span>' : '';
  document.getElementById('modal-sub').innerHTML = skuHtml + (r.coleccion ? (r.sku?' · ':'')+esc(r.coleccion) : '');

  var fav = document.getElementById('modal-fav');
  fav.setAttribute('data-fav-id', id);
  fav.classList.toggle('activo', _favoritos.has(id));
  fav.onclick = function(e){ window.toggleFavorito(e, id); };

  var precioEl = document.getElementById('modal-precio');
  if(r.estado==='bajopedido'){ precioEl.textContent = 'Precio bajo cotización'; precioEl.className = 'prod-precio cotizar'; }
  else { precioEl.textContent = '$'+(r.precio||0).toLocaleString(); precioEl.className = 'prod-precio'; }

  // Nota debajo del boton: estado del reloj y notas extra
  var nota = '';
  if(r.estado==='transito') nota = textoETA(r.eta)+'. Puedes apartarlo desde ahora.';
  else if(r.estado==='bajopedido') nota = 'Modelo bajo pedido. Entrega estimada en 10-15 días hábiles tras abono inicial.';
  else if(r.estado==='vendido') nota = 'Este modelo se agotó. Escríbenos y te ayudamos a conseguir uno similar.';
  if(r.descripcion && r.notas) nota = (nota?nota+' ':'')+r.notas;
  var notasEl = document.getElementById('modal-notas');
  notasEl.textContent = nota;
  notasEl.style.display = nota ? '' : 'none';

  // Dos barras desplegables: Descripcion y Especificaciones tecnicas (todas juntas, cada grupo con su icono)
  var desc = r.descripcion || r.notas;
  var genero = r.genero==='hombre'?'Hombre':r.genero==='mujer'?'Mujer':r.genero==='unisex'?'Unisex':'';
  var especificaciones =
    grupo('movimiento', 'Movimiento', spec('Movimiento', esc(r.movimiento))) +
    grupo('caja', 'Caja', spec('Tamaño', r.mm ? esc(r.mm)+' mm' : '') + spec('Material', esc(r.materialCaja)) + spec('Cristal', esc(r.cristal)) + spec('Resistencia al agua', esc(r.agua))) +
    grupo('esfera', 'Esfera', spec('Color de esfera', esc(r.colorEsfera))) +
    grupo('correa', 'Correa / Brazalete', spec('Material', esc(r.materialCorrea))) +
    grupo('info', 'Información', spec('Referencia', esc(r.sku)) + spec('Colección', esc(r.coleccion)) + spec('Género', genero) + spec('Color', esc(r.color)));
  document.getElementById('modal-specs').innerHTML =
    barra('Descripción', '<p class="det-texto">'+(desc ? esc(desc) : descripcionAuto(r))+'</p>') +
    barra('Especificaciones técnicas', especificaciones);

  var waTexto = document.getElementById('modal-wa-texto');
  var nombreRef = (r.nombre||'reloj')+(r.sku?' (Ref. '+r.sku+')':'');
  var msg;
  if(r.estado==='transito'){
    waTexto.textContent = 'Apartar por WhatsApp';
    msg = 'Hola! Vi en el catalogo el '+nombreRef+' que esta en transito, ¿me lo pueden apartar?';
  } else if(r.estado==='vendido'){
    waTexto.textContent = 'Preguntar por uno similar';
    msg = 'Hola! Vi el '+nombreRef+' en el catalogo pero ya esta vendido, ¿tienen algo similar o se puede conseguir de nuevo?';
  } else if(r.estado==='bajopedido'){
    waTexto.textContent = 'Cotizar por WhatsApp';
    msg = 'Hola! Quiero cotizar el modelo '+nombreRef+' que vi en el catalogo bajo pedido.';
  } else {
    waTexto.textContent = 'Comprar por WhatsApp';
    msg = 'Hola! Me interesa el '+nombreRef+' que vi en el catalogo, ¿sigue disponible?';
  }
  document.getElementById('modal-wa').href = 'https://wa.me/'+WHATSAPP_NUM+'?text='+encodeURIComponent(msg);

  var hd = document.getElementById('site-header');
  if(hd) document.documentElement.style.setProperty('--header-h', hd.offsetHeight + 'px');
  var m = document.getElementById('modal');
  m.classList.add('open');
  m.setAttribute('aria-hidden', 'false');
  m.scrollTop = 0;
  document.body.classList.add('prod-abierto');
  document.body.style.overflow = 'hidden';
  if(navigator.vibrate){ navigator.vibrate(8); }
  if(!(history.state && history.state.modal===id)) history.pushState({modal:id}, '', '?id='+encodeURIComponent(id));
  incMetrica(id, 'aperturas');
}
function cerrarModalUI(){
  var m = document.getElementById('modal');
  m.classList.remove('open');
  m.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('prod-abierto');
  document.body.style.overflow = '';
  _idAbierto = null;
}
function cerrar(){
  if(history.state && history.state.modal){ history.back(); } else { cerrarModalUI(); }
}
window.addEventListener('popstate', function(){ cerrarModalUI(); });
document.addEventListener('keydown', function(e){ if(e.key==='Escape' && _idAbierto) cerrar(); });
document.getElementById('modal-wa').addEventListener('click', function(){ if(_idAbierto) incMetrica(_idAbierto,'clics'); });

export { _idAbierto, abrir, cerrar, cerrarModalUI, copiarSku, etiquetaEstado, spec };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { abrir, cerrar, copiarSku, galeriaIr, galeriaMover });
