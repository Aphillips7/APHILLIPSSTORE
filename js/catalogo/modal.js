import { relojes } from './datos.js';
import { incMetrica } from './metricas.js';
import { toast } from './ui.js';
import { WHATSAPP_NUM } from './whatsapp.js';
import { textoETA } from '../products.js';

let _idAbierto = null;

function spec(label, val){
  if(!val) return '';
  return '<div class="spec-row"><span>'+label+'</span><span>'+val+'</span></div>';
}

function copiarSku(e, sku){
  e.stopPropagation();
  if(navigator.clipboard){ navigator.clipboard.writeText(sku).then(function(){ toast('SKU copiado: '+sku); }); }
}

function abrir(id){
  var r = relojes.find(function(x){ return x.id === id; });
  if(!r) return;
  _idAbierto = id;
  document.getElementById('modal-foto').innerHTML = r.foto ? '<img src="'+r.foto+'" alt="" />' : '';
  var badgeEl = document.getElementById('modal-badge');
  if(r.estado==='transito'){ badgeEl.className='modal-badge camino'; badgeEl.textContent=textoETA(r.eta); badgeEl.style.display='inline-block'; }
  else if(r.estado==='vendido'){ badgeEl.className='modal-badge agotado'; badgeEl.textContent='Agotado'; badgeEl.style.display='inline-block'; }
  else if(r.estado==='bajopedido'){ badgeEl.className='modal-badge pedido'; badgeEl.textContent='Bajo pedido'; badgeEl.style.display='inline-block'; }
  else { badgeEl.style.display='none'; }
  document.getElementById('modal-nombre').textContent = r.nombre || '';
  var skuHtml = r.sku ? '<span class="sku-copy" onclick="copiarSku(event,\''+r.sku.replace(/'/g,"\\'")+'\')" title="Toca para copiar el SKU">Ref. '+r.sku+'</span>' : '';
  var colTxt = r.coleccion ? (r.sku?' · ':'')+r.coleccion : '';
  document.getElementById('modal-sub').innerHTML = skuHtml + colTxt;
  var precioEl = document.getElementById('modal-precio');
  if(r.estado==='bajopedido'){ precioEl.textContent = 'Precio bajo cotizacion'; precioEl.className = 'modal-precio cotizar'; }
  else { precioEl.textContent = '$'+(r.precio||0).toLocaleString(); precioEl.className = 'modal-precio'; }
  document.getElementById('modal-specs').innerHTML =
    spec('Genero', r.genero==='hombre'?'Hombre':r.genero==='mujer'?'Mujer':r.genero==='unisex'?'Unisex':'') +
    spec('Diametro', r.mm?r.mm+' mm':'') +
    spec('Caja', r.materialCaja) +
    spec('Correa', r.materialCorrea) +
    spec('Esfera', r.colorEsfera) +
    spec('Movimiento', r.movimiento) +
    spec('Resistencia agua', r.agua) +
    spec('Cristal', r.cristal) +
    spec('Color', r.color);
  var notasEl = document.getElementById('modal-notas');
  var notasTexto = r.notas || '';
  if(r.estado==='bajopedido'){ notasTexto = (notasTexto?notasTexto+' · ':'')+'Modelo bajo pedido. Entrega estimada en 10-15 dias habiles tras abono inicial.'; }
  if(notasTexto){ notasEl.textContent = notasTexto; notasEl.style.display='block'; } else { notasEl.style.display='none'; }
  var waTexto = document.getElementById('modal-wa-texto');
  var msg;
  if(r.estado==='transito'){
    waTexto.textContent = 'Apartar por WhatsApp';
    msg = encodeURIComponent('Hola! Vi en el catalogo el '+(r.nombre||'reloj')+(r.sku?' (Ref. '+r.sku+')':'')+' que esta en camino, ¿me lo pueden apartar?');
  } else if(r.estado==='vendido'){
    waTexto.textContent = 'Preguntar por uno similar';
    msg = encodeURIComponent('Hola! Vi el '+(r.nombre||'reloj')+(r.sku?' (Ref. '+r.sku+')':'')+' en el catalogo pero ya esta vendido, ¿tienen algo similar o se puede conseguir de nuevo?');
  } else if(r.estado==='bajopedido'){
    waTexto.textContent = 'Cotizar por WhatsApp';
    msg = encodeURIComponent('Hola! Quiero cotizar el modelo '+(r.nombre||'reloj')+(r.sku?' (Ref. '+r.sku+')':'')+' que vi en el catalogo bajo pedido.');
  } else {
    waTexto.textContent = 'Me interesa · escribir por WhatsApp';
    msg = encodeURIComponent('Hola! Me interesa el '+(r.nombre||'reloj')+(r.sku?' (Ref. '+r.sku+')':'')+' que vi en el catalogo, ¿sigue disponible?');
  }
  document.getElementById('modal-wa').href = 'https://wa.me/'+WHATSAPP_NUM+'?text='+msg;
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  if(navigator.vibrate){ navigator.vibrate(8); }
  history.pushState({modal:id}, '', '?id='+encodeURIComponent(id));
  incMetrica(id, 'aperturas');
}
function cerrarModalUI(){
  document.getElementById('modal').classList.remove('open');
  document.body.style.overflow = '';
  _idAbierto = null;
}
function cerrar(){
  if(history.state && history.state.modal){ history.back(); } else { cerrarModalUI(); }
}
window.addEventListener('popstate', function(){ cerrarModalUI(); });
document.getElementById('modal').addEventListener('click', function(e){ if(e.target===this) cerrar(); });
document.getElementById('modal-wa').addEventListener('click', function(){ if(_idAbierto) incMetrica(_idAbierto,'clics'); });

export { _idAbierto, abrir, cerrar, cerrarModalUI, copiarSku, spec };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { abrir, cerrar, copiarSku });
