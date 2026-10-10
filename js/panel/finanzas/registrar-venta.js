// =================== FINANZAS TIPO CHIPS ===================
import { poblarSelectClientes } from '../clientes/clientes.js';
import { renderPickerCompra } from './registrar-compra.js';
import { renderInicio } from '../inicio.js';
import { idAleatorio, idxInv, invNoExiste, save, state } from '../state.js';

function selTipo(tipo, btn) {
  document.getElementById('fin-tipo').value = tipo;
  var map = { venta:'sel-venta', compra:'sel-compra', gasto:'sel-gasto', retiro:'sel-retiro', traspaso:'sel-retiro' };
  document.querySelectorAll('.fin-tipo-chip').forEach(b => {
    b.className = 'fin-tipo-chip' + (b === btn ? ' ' + (map[tipo]||'') : '');
  });
  var bv = document.getElementById('bloque-venta');
  var bc = document.getElementById('bloque-compra');
  var bo = document.getElementById('bloque-otro');
  var bp = document.getElementById('bloque-traspaso');
  var bt = document.getElementById('bloque-otro-title');
  if (tipo === 'venta') {
    if (bv) bv.style.display = '';
    if (bc) bc.style.display = 'none';
    if (bo) bo.style.display = 'none';
    if (bp) bp.style.display = 'none';
    renderPicker();
  } else if (tipo === 'compra') {
    if (bv) bv.style.display = 'none';
    if (bc) bc.style.display = '';
    if (bo) bo.style.display = 'none';
    if (bp) bp.style.display = 'none';
    renderPickerCompra();
  } else if (tipo === 'traspaso') {
    if (bv) bv.style.display = 'none';
    if (bc) bc.style.display = 'none';
    if (bo) bo.style.display = 'none';
    if (bp) bp.style.display = '';
  } else {
    if (bv) bv.style.display = 'none';
    if (bc) bc.style.display = 'none';
    if (bo) bo.style.display = '';
    if (bp) bp.style.display = 'none';
    if (bt) bt.textContent = tipo === 'retiro' ? 'Retiro personal' : 'Gasto operativo';
    var catWrap = document.getElementById('fin-categoria-wrap');
    if (catWrap) catWrap.style.display = tipo === 'retiro' ? 'none' : '';
  }
}

// =================== INVENTORY PICKER (VENTAS) ===================
var _pickerIdx = null;
function renderPicker() {
  poblarSelectClientes('fin-cliente');
  var grid = document.getElementById('inv-picker-grid');
  if (!grid) return;
  var q = (document.getElementById('picker-search') ? document.getElementById('picker-search').value.toLowerCase() : '');
  var disponibles = state.inventario.map((p,i) => ({p,i})).filter(x =>
    x.p.estado === 'disponible' &&
    ((x.p.nombre||'').toLowerCase().includes(q) || (x.p.sku||'').toLowerCase().includes(q) || (x.p.coleccion||'').toLowerCase().includes(q))
  );
  if (!disponibles.length) {
    grid.innerHTML = '<div class="inv-picker-empty">' + (q ? 'Sin resultados para "'+q+'"' : 'No hay relojes disponibles en inventario') + '</div>';
    return;
  }
  grid.innerHTML = disponibles.map(({p,i}) => {
    var sel = _pickerIdx === p.id ? ' selected' : '';
    var foto = p.foto ? '<img src="'+p.foto+'" style="width:100%;height:56px;object-fit:cover;border-radius:6px;margin-bottom:6px;" onerror="this.remove()" />' : '';
    return '<div class="inv-picker-card'+sel+'" onclick="seleccionarReloj(\''+p.id+'\')">' + foto +
      '<div class="inv-picker-nombre">' + (p.nombre||'Sin nombre') + '</div>' +
      (p.sku ? '<div class="inv-picker-sub">Ref. '+p.sku+'</div>' : '') +
      '<div class="inv-picker-precio">Costo: $'+(p.costoTotal||0).toLocaleString()+'</div>' +
    '</div>';
  }).join('');
}
function filtrarPicker() { renderPicker(); }
function seleccionarReloj(id) {
  var i = idxInv(id);
  if (i === -1) { invNoExiste(); renderPicker(); return; }
  _pickerIdx = id;
  var p = state.inventario[i];
  document.getElementById('fin-costo').value = p.costoTotal || 0;
  document.getElementById('fin-inv-index').value = id;
  var selDiv = document.getElementById('picker-selected');
  var grid = document.getElementById('inv-picker-grid');
  var search = document.getElementById('picker-search');
  if (selDiv) {
    document.getElementById('picker-sel-nombre').textContent = p.nombre + (p.sku ? ' · Ref. '+p.sku : '');
    document.getElementById('picker-sel-sub').textContent = 'Costo total: $'+(p.costoTotal||0).toLocaleString() + (p.coleccion ? ' · '+p.coleccion : '');
    selDiv.style.display = 'block';
  }
  if (grid) grid.style.display = 'none';
  if (search) search.style.display = 'none';
  var pr = document.getElementById('fin-reg-preview');
  if (pr) pr.style.display = 'block';
  actualizarPreview();
  var montoEl = document.getElementById('fin-monto');
  if (montoEl) { montoEl.value = p.precio || ''; montoEl.focus(); }
}
function limpiarSeleccion() {
  _pickerIdx = null;
  document.getElementById('fin-costo').value = '0';
  document.getElementById('fin-inv-index').value = '';
  document.getElementById('fin-monto').value = '';
  var selDiv = document.getElementById('picker-selected');
  var grid = document.getElementById('inv-picker-grid');
  var search = document.getElementById('picker-search');
  if (selDiv) selDiv.style.display = 'none';
  if (grid) grid.style.display = '';
  if (search) { search.style.display = ''; search.value = ''; }
  var pr = document.getElementById('fin-reg-preview');
  if (pr) pr.style.display = 'none';
  actualizarPreview(); renderPicker();
}
function actualizarPreview() {
  var m = parseFloat(document.getElementById('fin-monto').value) || 0;
  var c = parseFloat(document.getElementById('fin-costo').value) || 0;
  var g = m - c;
  function sp(id, val) { var el=document.getElementById(id); if(el) el.textContent='$'+Math.round(Math.max(0,val)).toLocaleString(); }
  sp('prev-reinv',g*0.4); sp('prev-personal',g*0.3); sp('prev-fondo',g*0.3); sp('prev-ganancia',g);
}

// =================== REGISTRAR VENTA ===================
function registrarMovimiento() {
  var invIdx = document.getElementById('fin-inv-index').value;
  if (invIdx === '') { alert('Selecciona un reloj del inventario primero.'); return; }
  var i = idxInv(invIdx);
  if (i === -1) { invNoExiste(); limpiarSeleccion(); return; }
  var p = state.inventario[i];
  var monto = parseFloat(document.getElementById('fin-monto').value);
  var canal = document.getElementById('fin-canal').value;
  var metodoPago = document.getElementById('fin-metodo') ? document.getElementById('fin-metodo').value : '';
  var clienteId = document.getElementById('fin-cliente') ? document.getElementById('fin-cliente').value : '';
  var cliente = clienteId ? state.clientes.find(c=>c.id===clienteId) : null;
  if (!monto || monto <= 0) { alert('Ingresa el precio de venta.'); return; }
  state.movimientos.unshift({ id:idAleatorio('mov'), _ts:Date.now(), tipo:'venta', desc: p.nombre + (p.sku ? ' · Ref. '+p.sku : ''), monto: monto, canal: canal, metodoPago: metodoPago, costo: p.costoTotal || 0, precioObjetivo: p.precio||0, clienteId: clienteId||null, clienteNombre: cliente?cliente.nombre:'', fecha: new Date().toLocaleDateString('es-MX') });
  save('movimientos');
  state.inventario[i].estado = 'vendido';
  state.inventario[i].precioVenta = monto;
  state.inventario[i].fechaVenta = new Date().toLocaleDateString('es-MX');
  save('inventario');
  limpiarSeleccion();
  renderInicio();
  var btn = document.getElementById('btn-registrar-mov');
  if (btn) { var orig=btn.textContent; btn.textContent='Venta registrada'; btn.style.background='var(--green)'; setTimeout(()=>{ btn.textContent=orig; btn.style.background=''; },2000); }
}

export { _pickerIdx, actualizarPreview, filtrarPicker, limpiarSeleccion, registrarMovimiento, renderPicker, seleccionarReloj, selTipo };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { actualizarPreview, filtrarPicker, limpiarSeleccion, registrarMovimiento, seleccionarReloj, selTipo });
