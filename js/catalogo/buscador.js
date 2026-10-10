// === PANEL DE BUSQUEDA ===
// Mientras se escribe, los resultados salen en vivo dentro del panel.
// "Ver todos" (o Enter) cierra el panel y muestra todos los resultados en el catalogo.
import { cerrarCuenta } from './cuenta.js';
import { relojes } from './datos.js';
import { cerrarFavoritos } from './favoritos.js';
import { coincideBusqueda } from './filtros.js';
import { render } from './grid.js';
import { abrir, etiquetaEstado } from './modal.js';
import { _destEsc as esc, normalizar } from './ui.js';
import { irAGenero, irAMarca, mostrarCatalogo } from './vistas.js';
import { ordenPeso } from '../products.js';

let buscadorAbierto = false;
const MAX_EN_PANEL = 6;

function toggleBuscador(btnElement) {
  const panel = document.getElementById('search-panel');
  const svgLupa = '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>';
  const svgCruz = '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>';

  buscadorAbierto = !buscadorAbierto;
  document.getElementById('site-header').classList.toggle('search-open', buscadorAbierto);
  if(buscadorAbierto){ cerrarFavoritos(); cerrarCuenta(); }

  // Cambiar icono de lupa a "X" (en los dos botones: PC y celular)
  document.querySelectorAll('.icon-btn[aria-label="Buscar"] svg.lupa-icon').forEach(function(ic){ ic.innerHTML = buscadorAbierto ? svgCruz : svgLupa; });
  if(buscadorAbierto) {
    panel.classList.add('open');
    document.body.style.overflow = 'hidden'; // bloquea el scroll del fondo
    setTimeout(() => document.getElementById('buscador').focus(), 100);
    mostrarResultadosPanel();
  } else {
    panel.classList.remove('open');
    document.body.style.overflow = '';
  }
}
function cerrarBuscador(){
  if(!buscadorAbierto) return;
  var btn = Array.prototype.find.call(document.querySelectorAll('.icon-btn[aria-label="Buscar"]'), function(x){ return x.offsetParent !== null; });
  toggleBuscador(btn || document.querySelector('.icon-btn[aria-label="Buscar"]'));
}

function _ordenar(lista){
  return lista.slice().sort(function(a,b){ return ordenPeso(a.estado) - ordenPeso(b.estado); });
}
function _tarjeta(r){
  var precio = r.estado === 'bajopedido' ? 'Precio bajo cotización' : '$' + (r.precio || 0).toLocaleString();
  var eti = etiquetaEstado(r.estado);
  var sub = [r.movimiento, r.mm ? r.mm+' mm' : '', r.materialCaja].filter(Boolean).join(', ') || r.coleccion || '';
  return '<div class="bs-card" role="button" tabindex="0" onclick="verDesdeBuscador(\''+r.id+'\')">'+
      (r.foto ? '<img src="'+r.foto+'" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'" />' : '<div class="bs-sinfoto"></div>')+
      '<div class="bs-info">'+
        '<span class="bs-eti '+eti.cls+'">'+eti.txt+'</span>'+
        '<span class="bs-name">'+esc(r.nombre || 'Reloj')+'</span>'+
        (sub ? '<span class="bs-desc">'+esc(sub)+'</span>' : '')+
        '<span class="bs-price">'+precio+'</span>'+
        '<span class="bs-link">Ver reloj</span>'+
      '</div>'+
    '</div>';
}
// Pinta en el panel: resultados de lo escrito, o "Disponibles ahora" si no hay texto
function mostrarResultadosPanel(){
  var cont = document.getElementById('bestsellers-container');
  var titulo = document.getElementById('bs-titulo');
  var verTodos = document.getElementById('bs-ver-todos');
  if(!cont) return;
  var q = (document.getElementById('buscador').value || '').trim();
  if(!q){
    var disp = relojes.filter(function(r){ return r.estado === 'disponible'; }).slice(0, 4);
    titulo.textContent = 'Disponibles ahora';
    verTodos.style.display = 'none';
    cont.innerHTML = disp.length ? disp.map(_tarjeta).join('') : '<p class="bs-vacio">Pronto tendremos relojes disponibles.</p>';
    return;
  }
  var res = _ordenar(relojes.filter(function(r){ return coincideBusqueda(r, q); }));
  titulo.textContent = res.length ? res.length+' resultado'+(res.length===1?'':'s')+' para “'+q+'”' : 'Sin resultados';
  verTodos.style.display = res.length > MAX_EN_PANEL ? '' : 'none';
  verTodos.textContent = 'Ver los '+res.length;
  cont.innerHTML = res.length
    ? res.slice(0, MAX_EN_PANEL).map(_tarjeta).join('')
    : '<p class="bs-vacio">No encontramos relojes para “'+esc(q)+'”. Prueba con otra marca, modelo, color o material, o escríbenos por WhatsApp y te ayudamos a conseguirlo.</p>';
}
function buscarEscribiendo(){
  mostrarResultadosPanel();
  if(document.body.classList.contains('vista-catalogo')) render();
}
// Enter / "Ver todos": lleva todos los resultados a la grilla del catalogo
function verTodosResultados(){
  var bus = document.getElementById('buscador');
  var q = (bus.value || '').trim();
  if(!q) return;
  cerrarBuscador();
  mostrarCatalogo('', true);   // (limpia el buscador)
  bus.value = q;
  var t = document.getElementById('cat-titulo'); if(t) t.textContent = 'Resultados para “'+q+'”';
  var p = document.getElementById('cat-desc-txt'); if(p) p.textContent = 'Relojes que coinciden con tu búsqueda. Toca cualquiera para ver sus detalles.';
  render();
}
function verDesdeBuscador(id){
  cerrarBuscador();
  abrir(id);
}

function buscarSugerencia(texto) {
  var marca = normalizar(texto).replace(/\s+/g, '');
  if(marca === 'invicta' || marca === 'bulova' || marca === 'technomarine'){ cerrarBuscador(); irAMarca(marca); return; }
  if(texto === 'Hombre' || texto === 'Mujer'){ cerrarBuscador(); irAGenero(texto.toLowerCase()); return; }
  document.getElementById('buscador').value = texto;
  buscarEscribiendo();
}

export { buscadorAbierto, buscarEscribiendo, buscarSugerencia, cerrarBuscador, mostrarResultadosPanel, toggleBuscador, verTodosResultados };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { buscarEscribiendo, buscarSugerencia, toggleBuscador, verDesdeBuscador, verTodosResultados });
