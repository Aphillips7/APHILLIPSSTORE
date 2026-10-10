import { relojes } from './datos.js';
import { _favoritos } from './favoritos.js';
import { incMetrica } from './metricas.js';
import { vibrar } from './ui.js';

const WHATSAPP_NUM = '50762615442';

// Boton flotante de WhatsApp
document.getElementById('fab-wa').href = 'https://wa.me/'+WHATSAPP_NUM+'?text='+encodeURIComponent('Hola! Tengo una pregunta sobre el catalogo de relojes.');
document.getElementById('fab-wa').addEventListener('click', function(){ vibrar(10); });

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
  var msg = 'Hola! Me interesan estos relojes del catalogo:\n'+lineas.join('\n')+'\n¿Me confirman disponibilidad?';
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
  var msg = encodeURIComponent('Hola! Quiero cotizar el modelo '+(r.nombre||'reloj')+(r.sku?' (Ref. '+r.sku+')':'')+' que vi en el catalogo bajo pedido.');
  incMetrica(id, 'clics');
  window.open('https://wa.me/'+WHATSAPP_NUM+'?text='+msg, '_blank');
}

export { confirmarWa, confirmarWaFavoritos, cotizarDirecto, WHATSAPP_NUM };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { confirmarWa, confirmarWaFavoritos, cotizarDirecto });
