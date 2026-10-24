// =================== VENTA RAPIDA (boton "Vendido") ===================
// Se abre desde la lista, las fotos, la ficha del reloj o un pedido web. Todo en una pantalla:
// precio (con ganancia y margen al instante), canal y metodo de pago en botones, y cliente opcional con
// buscador (lupa) o creado ahi mismo. Finanzas > Registrar sigue existiendo como segunda opcion.
// POKA-YOKE: Confirmar se activa solo con precio > 0, canal y metodo; vender bajo el costo o bajo el precio
// minimo pide confirmacion; no se vende dos veces (transaccion en la nube); un apartado se completa desde su
// ficha; un cliente nuevo no puede repetir el telefono de otro.
import { telefonoPanama } from '../clientes/clientes.js';
import { registrarCompraSiFalta } from '../finanzas/registrar-compra.js';
import { renderInicio } from '../inicio.js';
import { renderInventario } from './lista.js';
import { avisarError, cambiarEstadoSeguro } from './transacciones.js';
import { idAleatorio, idxInv, invNoExiste, save, state } from '../state.js';
import { dinero, esc } from '../componentes.js';

const CANALES = [['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['directo', 'En persona'], ['facebook', 'Facebook'], ['web', 'Tienda web'], ['otro', 'Otro']];
const METODOS = [['yappy', 'Yappy'], ['efectivo', 'Efectivo'], ['transferencia', 'Transferencia'], ['tarjeta', 'Tarjeta'], ['otro', 'Otro']];
const CLAVE_CANAL = 'aphillips_ultimo_canal';
var _ventaModalIdx = null;
var _alVender = null;     // opcional: se llama despues de registrar la venta (p. ej. marcar un pedido web como pagado)
var _clienteNuevo = null; // { nombre, tel } si se crea al confirmar

function el(id){ return document.getElementById(id); }
function leer(k){ try{ return localStorage.getItem(k) || ''; }catch(e){ return ''; } }
function guardar(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
function digitos(t){ var d = String(t || '').replace(/\D/g, ''); if(d.length === 11 && d.indexOf('507') === 0) d = d.slice(3); return d; }
function sinAcentos(t){ return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

function dibujarChips(cont, opciones, actual){
  var c = el(cont); if(!c) return;
  c.innerHTML = opciones.map(function(o){ return '<button type="button" class="vm-chip' + (o[0] === actual ? ' sel' : '') + '" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('');
}
document.addEventListener('click', function(e){
  var b = e.target.closest && e.target.closest('.vm-chip'); if(!b) return;
  var cont = b.parentNode, campo = el(cont.getAttribute('data-campo')); if(!campo) return;
  campo.value = b.getAttribute('data-v');
  cont.querySelectorAll('.vm-chip').forEach(function(x){ x.classList.toggle('sel', x === b); });
  validarVenta();
});

// opc (opcional): { clienteId, precio, alVender } para vender desde un pedido web con todo ya elegido
function abrirVentaModal(id, opc){
  opc = opc || {};
  var i = idxInv(id);
  if(i === -1){ invNoExiste(); return; }
  var p = state.inventario[i];
  // poka-yoke: no se vende dos veces, y un apartado se completa desde su ficha (respeta los abonos)
  if(p.estado === 'vendido'){ alert('Este reloj ya esta vendido.'); renderInventario(); return; }
  if(p.estado === 'reservado'){ alert('Este reloj esta apartado por ' + (p.reserva ? p.reserva.clienteNombre : 'un cliente') + '. Usa "Completar venta" en su ficha para que cuenten los abonos.'); renderInventario(); return; }
  _ventaModalIdx = id; _clienteNuevo = null;
  _alVender = typeof opc.alVender === 'function' ? opc.alVender : null;
  var foto = p.foto && /^https?:|^data:|^img\//.test(p.foto) ? '<img src="' + esc(p.foto) + '" alt="" onerror="this.remove()">' : '<i>Sin foto</i>';
  el('venta-modal-foto').innerHTML = foto;
  el('venta-modal-nombre').textContent = p.nombre + (p.sku ? ' · Ref. ' + p.sku : '');
  el('venta-modal-costo').textContent = (p.costoTotal || 0) > 0 ? dinero(p.costoTotal) : 'sin costo registrado';
  var precioEl = el('venta-modal-precio');
  precioEl.value = opc.precio || p.precio || '';
  el('venta-modal-canal').value = opc.clienteId ? 'web' : leer(CLAVE_CANAL);
  el('venta-modal-metodo').value = '';            // el metodo siempre se elige (poka-yoke: cuadra la caja)
  dibujarChips('vm-canales', CANALES, el('venta-modal-canal').value);
  dibujarChips('vm-metodos', METODOS, '');
  elegirCliente(opc.clienteId || '');
  el('vm-buscar-cliente').value = '';
  el('vm-resultados').hidden = true;
  el('venta-overlay').classList.add('open');
  precioEl.oninput = function(){ actualizarVentaModalPreview(); validarVenta(); };
  actualizarVentaModalPreview(); validarVenta();
  setTimeout(function(){ if(!precioEl.value) precioEl.focus(); }, 120);
}

function actualizarVentaModalPreview(){
  var p = _ventaModalIdx && state.inventario[idxInv(_ventaModalIdx)];
  var costo = p ? (p.costoTotal || 0) : 0;
  var precio = parseFloat(el('venta-modal-precio').value) || 0;
  var prev = el('venta-modal-preview');
  if(!(precio > 0)){ prev.hidden = true; return; }
  prev.hidden = false;
  var g = precio - costo, mg = Math.round(g / precio * 100);
  var gEl = el('vm-ganancia'), mEl = el('vm-margen');
  gEl.textContent = dinero(g); gEl.className = g < 0 ? 'neg' : 'pos';
  mEl.textContent = costo > 0 ? mg + '%' : '—'; mEl.className = !(costo > 0) ? '' : mg >= 30 ? 'pos' : mg < 15 ? 'neg' : '';
  el('vm-reinv').textContent = dinero(Math.max(0, g) * 0.4);
  el('vm-personal').textContent = dinero(Math.max(0, g) * 0.3);
}
function validarVenta(){
  var btn = el('vm-confirmar'); if(!btn) return false;
  var precio = parseFloat(el('venta-modal-precio').value) || 0;
  var falta = [];
  if(!(precio > 0)) falta.push('el precio');
  if(!el('venta-modal-canal').value) falta.push('por donde se vendio');
  if(!el('venta-modal-metodo').value) falta.push('como pago');
  btn.disabled = falta.length > 0;
  btn.textContent = falta.length ? 'Falta ' + falta.join(', ') : 'Confirmar venta de ' + dinero(precio);
  return !falta.length;
}

// ---------- cliente: buscar con la lupa, elegir, quitar o crear ----------
function elegirCliente(id){
  _clienteNuevo = null;
  el('venta-modal-cliente').value = id || '';
  var c = id && state.clientes.find(function(x){ return x.id === id; });
  var sel = el('vm-cliente-sel');
  if(c){
    sel.innerHTML = '<span><b>' + esc(c.nombre) + '</b>' + ((c.tel || c.telefono) ? ' · ' + esc(c.tel || c.telefono) : '') + '</span><button type="button" onclick="quitarClienteVenta()">Quitar</button>';
    sel.hidden = false; el('vm-buscador').hidden = true;
  } else { sel.hidden = true; el('vm-buscador').hidden = false; }
  el('vm-resultados').hidden = true;
  ayudaCliente('');
}
function quitarClienteVenta(){ elegirCliente(''); setTimeout(function(){ el('vm-buscar-cliente').focus(); }, 30); }
function ayudaCliente(t, error){ var a = el('vm-ayuda'); a.textContent = t; a.hidden = !t; a.classList.toggle('error', !!error); }
function buscarClienteVenta(v){
  var res = el('vm-resultados'), q = sinAcentos(v).trim(), qd = digitos(v);
  if(!q){ res.hidden = true; res.innerHTML = ''; return; }
  var lista = state.clientes.filter(function(c){
    return sinAcentos(c.nombre).indexOf(q) !== -1 || (qd.length >= 3 && digitos(c.tel || c.telefono).indexOf(qd) !== -1);
  }).slice(0, 6);
  var h = lista.map(function(c){ return '<button type="button" class="vm-res" onclick="elegirCliente(\'' + esc(c.id) + '\')"><b>' + esc(c.nombre) + '</b><span>' + esc(c.tel || c.telefono || '') + '</span></button>'; }).join('');
  // crear cliente nuevo con lo escrito (nombre, o telefono si escribio numeros)
  if(!/^\+?[\d\s-]+$/.test(v.trim()) && v.trim().length >= 3) h += '<button type="button" class="vm-res nuevo" onclick="nuevoClienteVenta()">+ Crear cliente "' + esc(v.trim()) + '"</button>';
  res.innerHTML = h || '<div class="vm-res" style="cursor:default;">Nadie con ese dato. Escribe el nombre para crearlo.</div>';
  res.hidden = false;
}
function nuevoClienteVenta(){
  var nombre = el('vm-buscar-cliente').value.replace(/\s+/g, ' ').trim();
  if(nombre.length < 3) return;
  var tel = prompt('Telefono / WhatsApp de ' + nombre + ' (opcional, deja vacio si no lo tienes):', '');
  if(tel === null) return;
  tel = telefonoPanama(tel);
  var d = digitos(tel);
  if(d.length >= 7){
    var dup = state.clientes.find(function(c){ return digitos(c.tel || c.telefono) === d; });
    if(dup){ elegirCliente(dup.id); ayudaCliente('Ese telefono ya era de ' + dup.nombre + ': se eligio ese cliente.'); return; }
  }
  _clienteNuevo = { nombre: nombre, tel: tel };
  el('venta-modal-cliente').value = '';
  var sel = el('vm-cliente-sel');
  sel.innerHTML = '<span><b>' + esc(nombre) + '</b>' + (tel ? ' · ' + esc(tel) : '') + ' <em class="vm-opcional">(nuevo)</em></span><button type="button" onclick="quitarClienteVenta()">Quitar</button>';
  sel.hidden = false; el('vm-buscador').hidden = true; el('vm-resultados').hidden = true;
}

function cerrarVentaModal(){ el('venta-overlay').classList.remove('open'); _ventaModalIdx = null; _alVender = null; _clienteNuevo = null; renderInventario(); }
var _vendiendo = false;   // evita registrar la misma venta dos veces con un doble toque
async function confirmarVentaModal(){
  if(_ventaModalIdx === null || _vendiendo || !validarVenta()) return;
  var id = _ventaModalIdx;
  var precio = Math.round((parseFloat(el('venta-modal-precio').value) || 0) * 100) / 100;
  var canal = el('venta-modal-canal').value, metodoPago = el('venta-modal-metodo').value;
  var i = idxInv(id);
  if(i === -1){ invNoExiste(); cerrarVentaModal(); return; }
  var p = state.inventario[i];
  var costo = p.costoTotal || 0;
  var nombreCanal = (CANALES.find(function(x){ return x[0] === canal; }) || [])[1] || canal;
  var nombreMetodo = (METODOS.find(function(x){ return x[0] === metodoPago; }) || [])[1] || metodoPago;
  var clienteId = el('venta-modal-cliente').value;
  var cliente = clienteId ? state.clientes.find(function(c){ return c.id === clienteId; }) : null;
  var resumen = 'Confirmar venta:\n\n' + p.nombre + (p.sku ? ' · Ref. ' + p.sku : '') + '\nPrecio: ' + dinero(precio) + '\n' + nombreCanal + ' · ' + nombreMetodo +
    (cliente ? '\nCliente: ' + cliente.nombre : _clienteNuevo ? '\nCliente nuevo: ' + _clienteNuevo.nombre : '');
  if(costo > 0 && precio < costo) resumen += '\n\nOJO: vendes por DEBAJO del costo (' + dinero(costo) + '): pierdes ' + dinero(costo - precio) + '.';
  else if(p.precioMin > 0 && precio < p.precioMin) resumen += '\n\nOJO: es menos que tu precio minimo (' + dinero(p.precioMin) + ').';
  if(!confirm(resumen)) return;
  var hoy = new Date().toLocaleDateString('es-MX');
  _vendiendo = true;
  try{ await cambiarEstadoSeguro(id, p.estado, { estado: 'vendido', precioVenta: precio, fechaVenta: hoy }); }
  catch(e){ _vendiendo = false; avisarError(e); cerrarVentaModal(); return; }
  _vendiendo = false;
  i = idxInv(id);
  if(i === -1){ invNoExiste(); cerrarVentaModal(); return; }
  // cliente nuevo: se crea ahora (ya con la venta confirmada)
  if(!cliente && _clienteNuevo){
    cliente = { id: idAleatorio('cli'), _ts: Date.now(), nombre: _clienteNuevo.nombre, tel: _clienteNuevo.tel, canal: canal === 'web' ? 'web' : canal === 'directo' ? 'directo' : canal, producto: p.nombre, notas: '', fecha: hoy };
    state.clientes.unshift(cliente); save('clientes');
  }
  state.inventario[i].estado = 'vendido'; state.inventario[i].precioVenta = precio; state.inventario[i].fechaVenta = hoy;
  save('inventario');
  state.movimientos.unshift({ id: idAleatorio('mov'), _ts: Date.now(), tipo: 'venta', invId: p.id, desc: p.nombre + (p.sku ? ' · Ref. ' + p.sku : ''), monto: precio, canal: canal, metodoPago: metodoPago,
    costo: p.costoTotal || 0, precioObjetivo: p.precio || 0, clienteId: cliente ? cliente.id : null, clienteNombre: cliente ? cliente.nombre : '', fecha: hoy });
  save('movimientos');
  guardar(CLAVE_CANAL, canal);
  var despues = _alVender;
  var g = precio - costo;
  cerrarVentaModal(); renderInicio();
  if(window.toastPanel) window.toastPanel('Venta registrada: ' + p.nombre + ' · ' + dinero(precio) + (costo > 0 ? ' · ganancia ' + dinero(g) : ''));
  registrarCompraSiFalta(state.inventario[idxInv(id)] || p);   // si nunca se registro su compra, pregunta el metodo y la registra
  if(despues) despues();
}

export { _ventaModalIdx, abrirVentaModal, actualizarVentaModalPreview, cerrarVentaModal, confirmarVentaModal };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { abrirVentaModal, buscarClienteVenta, cerrarVentaModal, confirmarVentaModal, elegirCliente, nuevoClienteVenta, quitarClienteVenta });
// la lupa busca mientras se escribe
document.addEventListener('input', function(e){ if(e.target && e.target.id === 'vm-buscar-cliente') buscarClienteVenta(e.target.value); });
