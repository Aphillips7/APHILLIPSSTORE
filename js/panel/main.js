// Punto de entrada del panel: carga todas las pantallas y arranca la app.
import { cerrarReglasModal, renderInicio } from './inicio.js';
import { cerrarModal } from './inventario/detalle.js';
import { cerrarAbonoModal, cerrarReservaModal } from './inventario/reservas.js';
import { cerrarVentaModal } from './inventario/venta-modal.js';
import { vigilarSesion } from './sesion.js';
import { renderSyncHistory, setSyncStatus } from './sync/estado-sync.js';
import { forzarSyncTodo } from './sync/sync.js';

import './state.js';
import './nav.js';
import './inicio.js';
import './catalogo-admin.js';
import './finanzas/fechas.js';
import './finanzas/registrar-venta.js';
import './finanzas/registrar-compra.js';
import './finanzas/registrar-otros.js';
import './finanzas/historial.js';
import './finanzas/resumen.js';
import './finanzas/analisis.js';
import './finanzas/finanzas.js';
import './inventario/lista.js';
import './inventario/formulario.js';
import './inventario/fotos.js';
import './inventario/venta-modal.js';
import './inventario/reservas.js';
import './inventario/detalle.js';
import './contenido.js';
import './clientes/clientes.js';
import './clientes/cliente-detalle.js';
import './sync/espacio.js';
import './sync/estado-sync.js';
import './sync/sync.js';
import './sync/catalogo-publico.js';
import './sync/listeners.js';
import './sesion.js';
import './respaldo.js';
import './auth/totp.js';
import './auth/auth-overlay.js';
import './pwa.js';

// Estado de la conexion del dispositivo
window.addEventListener('offline', function(){
  setSyncStatus('Sin internet en este dispositivo','var(--red)','error');
});
window.addEventListener('online', function(){
  setSyncStatus('Conexion recuperada, sincronizando...','var(--accent)','warn');
  forzarSyncTodo();
});

// Cerrar modales al tocar el fondo
var invModal=document.getElementById('inv-modal');
if(invModal)invModal.addEventListener('click',function(e){if(e.target===this)cerrarModal();});
var ventaOverlay=document.getElementById('venta-overlay');
if(ventaOverlay)ventaOverlay.addEventListener('click',function(e){if(e.target===this)cerrarVentaModal();});
var reservaOverlay=document.getElementById('reserva-overlay');
if(reservaOverlay)reservaOverlay.addEventListener('click',function(e){if(e.target===this)cerrarReservaModal();});
var abonoOverlay=document.getElementById('abono-overlay');
if(abonoOverlay)abonoOverlay.addEventListener('click',function(e){if(e.target===this)cerrarAbonoModal();});
var reglasOverlay=document.getElementById('reglas-overlay');
if(reglasOverlay)reglasOverlay.addEventListener('click',function(e){if(e.target===this)cerrarReglasModal();});

var lastSync=localStorage.getItem('lastSync');if(lastSync)setSyncStatus('Ultima sync: '+lastSync,'var(--muted)','info');
renderSyncHistory();
vigilarSesion();
renderInicio();
