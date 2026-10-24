import { relojes } from './datos.js';
import { _favoritos, toggleFavorito } from './favoritos.js';
import { _busOk, _facOk, _orden, actualizarFltUI } from './filtros.js';
import { _io } from './metricas.js';
import { abrir, etiquetaEstado } from './modal.js';
import { _filtroMarca, _genOk, _MARCAS } from './vistas.js';
import { ordenPeso } from '../products.js';
import { _destEsc as esc, miniatura, srcsetFoto } from './ui.js';

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
    var bus = document.getElementById('buscador'), hayBusqueda = bus && bus.value.trim();
    var msg;
    if(!relojes.length) msg = 'No hay relojes disponibles por el momento.';
    else if(hayBusqueda) msg = 'Sin resultados para tu búsqueda. Prueba con otra marca, modelo o material.';
    else if(_filtroMarca && _MARCAS[_filtroMarca]) msg = '<b>Aún no hay relojes '+_MARCAS[_filtroMarca].nombre+' en el catálogo.</b>Muy pronto tendremos novedades de esta marca. Si buscas un modelo en específico, escríbenos por WhatsApp y te ayudamos a conseguirlo.';
    else msg = 'No hay relojes con estos filtros.';
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1;">'+msg+'</div>';
    actualizarFltUI();
    return;
  }
  grid.innerHTML = items.map(function(r){
    var agotado = r.estado==='vendido';
    var pedido = r.estado==='bajopedido';
    // miniatura (mucho mas liviana); si no existe se usa la foto completa y, si tampoco, "Sin foto"
    var foto = r.foto ? '<img src="'+esc(miniatura(r.foto))+'"'+srcsetFoto(r.foto, '(max-width:600px) 50vw, (max-width:1100px) 33vw, 25vw')+' data-completa="'+esc(r.foto)+'" alt="'+esc(r.nombre||'Reloj')+'" loading="lazy" decoding="async" onerror="if(!fotoRespaldo(this))this.parentElement.innerHTML=\'<span class=sinfoto>Sin foto</span>\'" />' : '<span class="sinfoto">Sin foto</span>';
    var eti = etiquetaEstado(r.estado);
    var favBtn = '<button class="btn-favorito'+(_favoritos.has(r.id)?' activo':'')+'" data-fav-id="'+r.id+'" onclick="toggleFavorito(event,\''+r.id+'\')" aria-label="Favorito"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.7-4.35-9.33-8.2C1 10.28 1.5 6.8 4.36 5.1 6.6 3.77 9.3 4.5 11 6.3l1 1.05 1-1.05c1.7-1.8 4.4-2.53 6.64-1.2 2.86 1.7 3.36 5.18 1.69 7.7C18.7 16.65 12 21 12 21z"/></svg></button>';
    var spec = [r.movimiento, r.mm ? r.mm+' mm' : '', r.materialCaja].filter(Boolean).join(', ');
    if(!spec) spec = (r.sku?'Ref. '+r.sku:'')+(r.coleccion?(r.sku?' · ':'')+r.coleccion:'');
    // bajo pedido sin precio: no se muestra precio (la consulta se hace desde la ficha del reloj)
    var precioHtml = (pedido && !r.precio) ? '' : '<div class="ci-precio">$'+(r.precio||0).toLocaleString()+'</div>';
    // "Nuevo": relojes agregados en los ultimos 14 dias (fecha de alta = _ts)
    var nuevo = !agotado && r._ts && (Date.now() - r._ts) < 14 * 86400000;
    return '<div class="card'+(agotado?' card-agotado':'')+'" data-id="'+r.id+'" onclick="abrir(\''+r.id+'\')" role="link" tabindex="0" aria-label="'+esc(r.nombre||'Reloj')+'">'+
      '<div class="card-foto'+(agotado?' agotada':'')+'">'+foto+(nuevo?'<span class="card-nuevo">Nuevo</span>':'')+'</div>'+
      '<div class="card-info ci-tag">'+
        favBtn+
        '<div class="ci-txt">'+
          '<span class="ci-eti '+eti.cls+'">'+eti.txt+'</span>'+
          '<div class="ci-nombre">'+esc(r.nombre||'')+'</div>'+
          (spec?'<div class="ci-spec">'+esc(spec)+'</div>':'')+
          precioHtml+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
  var cards = grid.querySelectorAll('.card');
  cards.forEach(function(c){ if(_io){ _io.observe(c); } else { c.classList.add('visible'); } });
  actualizarFltUI();
}

// las tarjetas se abren tambien con el teclado (Tab hasta la tarjeta y Enter o espacio)
document.addEventListener('keydown', function(e){
  if(e.key !== 'Enter' && e.key !== ' ') return;
  var c = e.target && e.target.classList && e.target.classList.contains('card') ? e.target : null;
  if(!c || !c.dataset.id) return;
  e.preventDefault();
  window.abrir(c.dataset.id);
});

export { _nItems, _vistaCompacta, render, setVista };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { setVista });
