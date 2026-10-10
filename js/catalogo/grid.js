import { relojes } from './datos.js';
import { _favoritos, toggleFavorito } from './favoritos.js';
import { _busOk, _facOk, _orden, actualizarFltUI } from './filtros.js';
import { _io } from './metricas.js';
import { abrir, etiquetaEstado } from './modal.js';
import { _genOk } from './vistas.js';
import { cotizarDirecto } from './whatsapp.js';
import { ordenPeso } from '../products.js';

let _vistaCompacta = false;
var _nItems = 0; // cuantos relojes quedan visibles tras filtros (lo usa el panel de filtros)

function setVista(n){ // celular: 2 columnas o 1 columna
  var grid = document.getElementById('grid');
  if(grid) grid.classList.toggle('vista-1', n===1);
  document.querySelectorAll('#vista-sel button').forEach(function(b){ b.classList.toggle('on', +b.getAttribute('data-v')===n); });
}

function render(){
  var grid = document.getElementById('grid');
  var items = relojes.filter(function(r){ return _genOk(r) && _busOk(r) && _facOk(r); });
  items.sort(function(a,b){
    var av = ordenPeso(a.estado), bv = ordenPeso(b.estado);
    if(av!==bv) return av-bv;
    if(_orden==='precio_asc') return (a.precio||0)-(b.precio||0);
    if(_orden==='precio_desc') return (b.precio||0)-(a.precio||0);
    return 0;
  });
  _nItems = items.length;
  var _cc = document.getElementById('cat-cuenta');
  if(_cc) _cc.textContent = relojes.length ? items.length+' reloj'+(items.length===1?'':'es') : '';
  if(!items.length){
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1;"><span>&#9082;</span>'+(relojes.length?'Sin resultados para tu busqueda.':'No hay relojes disponibles por el momento.')+'</div>';
    actualizarFltUI();
    return;
  }
  grid.innerHTML = items.map(function(r){
    var agotado = r.estado==='vendido';
    var pedido = r.estado==='bajopedido';
    var foto = r.foto ? '<img src="'+r.foto+'" alt="" loading="lazy" onerror="this.parentElement.innerHTML=\'<span class=sinfoto>Sin foto</span>\'" />' : '<span class="sinfoto">Sin foto</span>';
    var eti = etiquetaEstado(r.estado);
    var favBtn = '<button class="btn-favorito'+(_favoritos.has(r.id)?' activo':'')+'" data-fav-id="'+r.id+'" onclick="toggleFavorito(event,\''+r.id+'\')" aria-label="Favorito"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.7-4.35-9.33-8.2C1 10.28 1.5 6.8 4.36 5.1 6.6 3.77 9.3 4.5 11 6.3l1 1.05 1-1.05c1.7-1.8 4.4-2.53 6.64-1.2 2.86 1.7 3.36 5.18 1.69 7.7C18.7 16.65 12 21 12 21z"/></svg></button>';
    var spec = [r.movimiento, r.mm ? r.mm+' mm' : '', r.materialCaja].filter(Boolean).join(', ');
    if(!spec) spec = (r.sku?'Ref. '+r.sku:'')+(r.coleccion?(r.sku?' · ':'')+r.coleccion:'');
    var precioHtml = pedido ? '<button class="card-cotizar" onclick="event.stopPropagation();cotizarDirecto(\''+r.id+'\')"><svg viewBox="0 0 448 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>Cotizar por WhatsApp</button>' : '<div class="ci-precio">$'+(r.precio||0).toLocaleString()+'</div>';
    return '<div class="card'+(agotado?' card-agotado':'')+'" data-id="'+r.id+'" onclick="abrir(\''+r.id+'\')">'+
      '<div class="card-foto'+(agotado?' agotada':'')+'">'+foto+'</div>'+
      '<div class="card-info ci-tag">'+
        favBtn+
        '<div class="ci-txt">'+
          '<span class="ci-eti '+eti.cls+'">'+eti.txt+'</span>'+
          '<div class="ci-nombre">'+(r.nombre||'')+'</div>'+
          (spec?'<div class="ci-spec">'+spec+'</div>':'')+
          precioHtml+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
  var cards = grid.querySelectorAll('.card');
  cards.forEach(function(c){ if(_io){ _io.observe(c); } else { c.classList.add('visible'); } });
  actualizarFltUI();
}

export { _nItems, _vistaCompacta, render, setVista };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { setVista });
