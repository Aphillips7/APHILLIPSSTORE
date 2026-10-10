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

// Iconos de linea para cada barra desplegable
const ICONOS = {
  descripcion: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4h15l7 7v25H10z"/><path d="M25 4v7h7M15 18h12M15 23h12M15 28h8"/></svg>',
  movimiento: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="20" cy="20" r="16"/><circle cx="20" cy="20" r="11"/><path d="M20 9v4M20 27v4M9 20h4M27 20h4M12.2 12.2l2.8 2.8M25 25l2.8 2.8M12.2 27.8l2.8-2.8M25 15l2.8-2.8"/><circle cx="20" cy="20" r="3"/><circle cx="27.5" cy="13" r="1.4"/><circle cx="13" cy="27" r="1.4"/></svg>',
  caja: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5h14l2 6M13 5l-2 6M13 35h14l2-6M13 35l-2-6"/><circle cx="20" cy="20" r="11"/><circle cx="20" cy="20" r="8.5"/><path d="M31 18h3v4h-3"/></svg>',
  esfera: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="20" cy="20" r="15"/><path d="M20 7v3M20 30v3M7 20h3M30 20h3"/><path d="M20 20V12M20 20l6 4"/><circle cx="20" cy="20" r="1.3"/></svg>',
  correa: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h9v34H8zM23 3h9v34h-9z"/><path d="M6 13h13v8H6zM12.5 13v8"/><circle cx="27.5" cy="12" r=".8"/><circle cx="27.5" cy="18" r=".8"/><circle cx="27.5" cy="24" r=".8"/><path d="M23 30h9"/></svg>',
  info: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20.5V7a2 2 0 0 1 2-2h13.5L36 20.5 20.5 36z"/><circle cx="13" cy="13" r="2.5"/></svg>'
};

function spec(label, val){
  if(!val) return '';
  return '<div class="spec-row"><span>'+esc(label)+' : </span><b>'+val+'</b></div>';
}

// Una barra desplegable (details/summary: se abre y cierra sin JS)
function barra(icono, titulo, contenido, abierta){
  if(!contenido) return '';
  return '<details class="det"'+(abierta?' open':'')+'>'+
    '<summary class="det-btn"><span class="det-ico">'+ICONOS[icono]+'</span><span class="det-titulo">'+titulo+'</span><span class="det-mas" aria-hidden="true"></span></summary>'+
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

function copiarSku(e, sku){
  e.stopPropagation();
  if(navigator.clipboard){ navigator.clipboard.writeText(sku).then(function(){ toast('Referencia copiada: '+sku); }); }
}

function abrir(id){
  var r = relojes.find(function(x){ return x.id === id; });
  if(!r) return;
  _idAbierto = id;
  document.getElementById('modal-foto').innerHTML = r.foto ? '<img src="'+r.foto+'" alt="'+esc(r.nombre||'Reloj')+'" />' : '<span class="sinfoto">Sin foto</span>';

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

  // Barras desplegables: solo aparecen las que tienen informacion
  var desc = r.descripcion || r.notas;
  var genero = r.genero==='hombre'?'Hombre':r.genero==='mujer'?'Mujer':r.genero==='unisex'?'Unisex':'';
  document.getElementById('modal-specs').innerHTML =
    barra('descripcion', 'Descripción', '<p class="det-texto">'+(desc ? esc(desc) : descripcionAuto(r))+'</p>', true) +
    barra('movimiento', 'Movimiento', spec('Movimiento', esc(r.movimiento))) +
    barra('caja', 'Caja', spec('Tamaño', r.mm ? esc(r.mm)+' mm' : '') + spec('Material', esc(r.materialCaja)) + spec('Cristal', esc(r.cristal)) + spec('Resistencia al agua', esc(r.agua))) +
    barra('esfera', 'Esfera', spec('Color de esfera', esc(r.colorEsfera))) +
    barra('correa', 'Correa / Brazalete', spec('Material', esc(r.materialCorrea))) +
    barra('info', 'Información', spec('Referencia', esc(r.sku)) + spec('Colección', esc(r.coleccion)) + spec('Género', genero) + spec('Color', esc(r.color)));

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
Object.assign(window, { abrir, cerrar, copiarSku });
