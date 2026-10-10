// =================== NAV ===================
import { showAuth } from './auth/auth-overlay.js';
import { renderCatalogoAdmin } from './catalogo-admin.js';
import { renderClientes } from './clientes/clientes.js';
import { renderContenido } from './contenido.js';
import { renderAnalisis } from './finanzas/analisis.js';
import { renderFinanzas } from './finanzas/finanzas.js';
import { renderHistorial } from './finanzas/historial.js';
import { selTipo } from './finanzas/registrar-venta.js';
import { renderResumen } from './finanzas/resumen.js';
import { renderInicio } from './inicio.js';
import { renderInventario } from './inventario/lista.js';

function showPage(ev, name) {
  if (name === 'config') { showAuth(); return; }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  if (ev && ev.target) ev.target.classList.add('active');
  if (name === 'inicio') renderInicio();
  if (name === 'finanzas') renderFinanzas();
  if (name === 'inventario') renderInventario();
  if (name === 'catalogo') renderCatalogoAdmin();
  if (name === 'contenido') renderContenido();
  if (name === 'clientes') renderClientes();
}
function showInner(prefix, name) {
  document.querySelectorAll('[id^="' + prefix + '-"]').forEach(function(el) {
    if (el.classList.contains('inner-page')) el.classList.remove('active');
  });
  document.querySelectorAll('.inner-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(prefix + '-' + name).classList.add('active');
  event.target.classList.add('active');
  if (name === 'resumen') renderResumen();
  if (name === 'historial') renderHistorial();
  if (name === 'analisis') renderAnalisis();
}

function irARegistrar(tipo) {
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.nav-tab').forEach(function(t){ t.classList.remove('active'); });
  var pageFin = document.getElementById('page-finanzas');
  if (pageFin) pageFin.classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(function(t) {
    if ((t.getAttribute('onclick')||'').indexOf("'finanzas'") !== -1) t.classList.add('active');
  });
  renderFinanzas();
  document.querySelectorAll('.inner-page').forEach(function(el){ el.classList.remove('active'); });
  var regPage = document.getElementById('fin-registrar');
  if (regPage) regPage.classList.add('active');
  document.querySelectorAll('#page-finanzas .inner-tab').forEach(function(t, idx){ t.classList.remove('active'); if (idx===0) t.classList.add('active'); });
  var chipBtn = null;
  document.querySelectorAll('.fin-tipo-chip').forEach(function(b) {
    if ((b.getAttribute('onclick')||'').indexOf("selTipo('"+tipo+"'") !== -1) chipBtn = b;
  });
  selTipo(tipo, chipBtn);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export { irARegistrar, showInner, showPage };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { irARegistrar, showInner, showPage });
