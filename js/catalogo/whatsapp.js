import { relojes } from './datos.js';
import { _favoritos } from './favoritos.js';
import { incMetrica } from './metricas.js';
import { saludo, sesion } from './sesion.js';
import { vibrar } from './ui.js';

const WHATSAPP_NUM = '50762615442';

// Enlaces de contacto del encabezado y del pie de pagina
document.querySelectorAll('.wa-link').forEach(function(a){
  a.href = 'https://wa.me/'+WHATSAPP_NUM+'?text='+encodeURIComponent('¡Hola! Tengo una pregunta sobre Aphillips Store.');
});

// reloj abierto en la ficha (para crear el pedido al tocar "Comprar por WhatsApp")
let _relojAbierto = '';
document.addEventListener('reloj-abierto', function(e){ _relojAbierto = e.detail && e.detail.id || ''; });

// =================== CONFIRMACION AL ABRIR WHATSAPP ===================
function confirmarWa(el, e){
  if(el.dataset.animando==='1'){ e.preventDefault(); return; }
  e.preventDefault();
  el.dataset.animando = '1';
  var textoEl = el.querySelector('span');
  var original = textoEl.textContent;
  el.classList.add('confirmando');
  textoEl.textContent = '✓ Abriendo WhatsApp...';
  vibrar(10);
  var href = el.href;
  // con sesion: se crea el pedido (o se usa el que ya tiene abierto de este reloj) y su numero va en el
  // mensaje, para identificarlo al instante (el codigo de cliente no se le muestra al cliente)
  if(el.id === 'modal-wa' && _relojAbierto && typeof sesion.pedidoPara === 'function'){
    var numero = sesion.pedidoPara(_relojAbierto);
    if(numero){
      try{
        var u = new URL(href);
        u.searchParams.set('text', (u.searchParams.get('text') || '') + '\n\nPedido ' + numero);
        href = u.toString();
      }catch(err){}
    }
  }
  setTimeout(function(){
    window.open(href, '_blank');
    el.classList.remove('confirmando');
    textoEl.textContent = original;
    el.dataset.animando = '0';
  }, 480);
}
function confirmarWaFavoritos(el, e){
  e.preventDefault();
  if(el.dataset.animando==='1') return;
  var items = relojes.filter(function(r){ return _favoritos.has(r.id); });
  if(!items.length) return;
  el.dataset.animando = '1';
  var textoEl = document.getElementById('btn-wa-favoritos-texto');
  var original = textoEl.textContent;
  el.classList.add('confirmando');
  textoEl.textContent = '✓ Abriendo WhatsApp...';
  vibrar(10);
  var lineas = items.map(function(r){ return '• '+(r.nombre||'reloj')+(r.sku?' (Ref. '+r.sku+')':''); });
  var msg = saludo()+' Me interesan estos relojes del catálogo:\n'+lineas.join('\n')+'\n¿Me confirman disponibilidad?';
  var url = 'https://wa.me/'+WHATSAPP_NUM+'?text='+encodeURIComponent(msg);
  setTimeout(function(){
    window.open(url, '_blank');
    el.classList.remove('confirmando');
    textoEl.textContent = original;
    el.dataset.animando = '0';
  }, 480);
}

function cotizarDirecto(id){
  var r = relojes.find(function(x){ return x.id === id; });
  if(!r) return;
  vibrar(10);
  var msg = encodeURIComponent(saludo()+' Quiero cotizar el modelo '+(r.nombre||'reloj')+(r.sku?' (Ref. '+r.sku+')':'')+' que vi en el catálogo bajo pedido.\n' + 'https://aphillipsstore.com/?id=' + encodeURIComponent(r.id));
  incMetrica(id, 'clics');
  window.open('https://wa.me/'+WHATSAPP_NUM+'?text='+msg, '_blank');
}

export { confirmarWa, confirmarWaFavoritos, cotizarDirecto, WHATSAPP_NUM };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { confirmarWa, confirmarWaFavoritos, cotizarDirecto });
