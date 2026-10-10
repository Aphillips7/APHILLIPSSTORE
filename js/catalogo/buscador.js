// === LÓGICA DEL MEGAMENÚ DE BÚSQUEDA ===
import { cerrarCuenta } from './cuenta.js';
import { relojes } from './datos.js';
import { cerrarFavoritos } from './favoritos.js';
import { render } from './grid.js';
import { abrir } from './modal.js';
import { irAGenero, mostrarCatalogo } from './vistas.js';

let buscadorAbierto = false;

function toggleBuscador(btnElement) {
  const panel = document.getElementById('search-panel');
  const svgLupa = '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>';
  const svgCruz = '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>';
  
  buscadorAbierto = !buscadorAbierto;
  document.getElementById('site-header').classList.toggle('search-open', buscadorAbierto);
  if(buscadorAbierto){ cerrarFavoritos(); cerrarCuenta(); }
  
  // Cambiar ícono de Lupa a "X"
  const icono = btnElement.querySelector('svg');
  if(buscadorAbierto) {
    panel.classList.add('open');
    icono.innerHTML = svgCruz;
    
    // BLOQUEA EL SCROLL DEL FONDO
    document.body.style.overflow = 'hidden'; 
    
    setTimeout(() => document.getElementById('buscador').focus(), 100);
    cargarBestsellers(); // Cargar productos de muestra
  } else {
    panel.classList.remove('open');
    icono.innerHTML = svgLupa;
    
    // REACTIVA EL SCROLL DEL FONDO AL CERRAR
    document.body.style.overflow = ''; 
  }
}

function buscarSugerencia(texto) {
  if(texto === 'Hombre'){
    toggleBuscador(document.querySelector('.icon-btn[aria-label="Buscar"]'));
    irAGenero('hombre');
    return;
  }
  if(!document.body.classList.contains('vista-catalogo')){ mostrarCatalogo('', true); }
  document.getElementById('buscador').value = texto;
  render(); // Filtra la grilla principal
  toggleBuscador(document.querySelector('.icon-btn[aria-label="Buscar"]')); // Cierra el panel
}

function cargarBestsellers() {
  const contenedor = document.getElementById('bestsellers-container');
  if(contenedor.children.length > 0) return; // Verifica si hay relojes reales, ignorando comentarios
  
  // Tomamos hasta 4 relojes al azar (o los primeros) para simular Bestsellers
  const muestras = relojes.slice(0, 4); 
  
  contenedor.innerHTML = muestras.map(r => {
    const precioHtml = r.estado === 'bajopedido' ? 'Consultar' : '$' + (r.precio || 0).toLocaleString();
    const badge = r.estado === 'transito' ? 'EN TRÁNSITO' : (r.estado === 'bajopedido' ? 'BAJO PEDIDO' : 'DISPONIBLE');
    return `
      <div class="bs-card" onclick="abrir('${r.id}')">
        <img src="${r.foto || ''}" onerror="this.style.display='none'" />
        <div class="bs-info">
          <span class="bs-badge">${badge}</span>
          <span class="bs-name">${r.nombre || 'Reloj'}</span>
          <span class="bs-desc">${r.coleccion || 'Exclusivo'}</span>
          <span class="bs-price">${precioHtml}</span>
          <span class="bs-link">Shop now</span>
        </div>
      </div>
    `;
  }).join('');
}

export { buscadorAbierto, buscarSugerencia, cargarBestsellers, toggleBuscador };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { buscarSugerencia, toggleBuscador });
