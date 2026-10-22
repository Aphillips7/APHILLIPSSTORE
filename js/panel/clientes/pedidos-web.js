// =================== PEDIDOS WEB (hechos por WhatsApp desde la tienda) ===================
// Cuando un cliente con cuenta toca "Comprar por WhatsApp", se crea un pedido (P-XXXXX) que llega aqui.
// El dueno lo avanza paso a paso; el cliente ve cada cambio en "Mis pedidos" de la tienda.
//   solicitado -> confirmado (envio o retiro) -> pagado -> enviado -> entregado   (o cancelado)
// POKA-YOKE:
// - Solo aparecen los botones del siguiente paso permitido (el servidor tambien lo bloquea).
// - "Registrar venta" abre la venta del reloj con el cliente ya elegido (y si no existe en el panel, se
//   crea con los datos de su cuenta y se vincula, sin duplicar: se busca primero por su WhatsApp). Al
//   confirmar la venta, el pedido pasa solo a "pagado": dinero y pedido no se desincronizan.
// - Marcar "pagado" sin registrar la venta pide confirmacion explicita.
import { firebase } from '../../firebase.js';
import { abrirVentaModal } from '../inventario/venta-modal.js';
import { idAleatorio, save, state } from '../state.js';
import { renderClientes } from './clientes.js';

const API = 'https://api.aphillipsstore.com';
const ESTADOS = { solicitado: 'Solicitado', confirmado: 'Confirmado', pagado: 'Pagado', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado' };
const ABIERTOS = ['solicitado', 'confirmado', 'pagado', 'enviado'];
let _pedidos = null, _error = '', _verCerrados = false, _filtro = '';

function esc(t){ return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
async function pedir(ruta, opciones){
  var u = firebase.auth().currentUser;
  if(!u) throw new Error('sin sesion');
  opciones = opciones || {};
  opciones.headers = Object.assign({ 'Authorization': 'Bearer ' + await u.getIdToken() }, opciones.headers || {});
  if(opciones.body && typeof opciones.body !== 'string'){ opciones.body = JSON.stringify(opciones.body); opciones.headers['Content-Type'] = 'application/json'; }
  var r = await fetch(API + ruta, opciones);
  var d = {}; try{ d = await r.json(); }catch(e){}
  if(!r.ok) throw new Error(d.error || ('Error ' + r.status));
  return d;
}
function numeroWa(tel){ var d = String(tel||'').replace(/[^0-9]/g, ''); if(d.length === 7 || d.length === 8) d = '507' + d; return d; }
function fecha(ms){ return ms ? new Date(ms).toLocaleString('es-PA', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''; }

async function cargarPedidosWeb(){
  try{ _pedidos = (await pedir('/admin/pedidos')).pedidos || []; _error = ''; }
  catch(e){ _error = e.message; }
  renderPedidosWeb();
}
function filtrarPedidosWeb(v){ _filtro = String(v || '').toLowerCase().trim(); renderPedidosWeb(); }
function verCerradosPedidosWeb(si){ _verCerrados = !!si; renderPedidosWeb(); }

function renderPedidosWeb(){
  var cont = document.getElementById('pedidos-web');
  if(!cont) return;
  if(_error && !_pedidos){ cont.innerHTML = '<div style="font-size:12px;color:var(--red);">No se pudieron cargar los pedidos: ' + esc(_error) + '</div>'; return; }
  if(!_pedidos){ cont.innerHTML = '<div style="font-size:12px;color:var(--muted);">Cargando...</div>'; return; }
  var abiertos = _pedidos.filter(function(p){ return ABIERTOS.indexOf(p.estado) !== -1; });
  var badge = document.getElementById('pedidos-web-badge');
  var nuevos = _pedidos.filter(function(p){ return p.estado === 'solicitado'; }).length;
  if(badge){ badge.textContent = nuevos; badge.style.display = nuevos ? '' : 'none'; }
  var lista = (_verCerrados ? _pedidos : abiertos).filter(function(p){
    if(!_filtro) return true;
    var c = p.cuenta || {};
    return [p.numero, p.reloj, p.sku, c.codigo, c.nombre, c.apellido, c.telefono, c.email].join(' ').toLowerCase().indexOf(_filtro) !== -1;
  });
  var h = '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">' +
    '<input type="search" placeholder="Buscar: P-…, AP-…, nombre, WhatsApp, reloj" value="' + esc(_filtro) + '" oninput="filtrarPedidosWeb(this.value)" style="flex:1;min-width:200px;width:auto;">' +
    '<label style="font-size:12px;color:var(--muted);white-space:nowrap;"><input type="checkbox" ' + (_verCerrados ? 'checked' : '') + ' onchange="verCerradosPedidosWeb(this.checked)"> Ver entregados y cancelados</label></div>';
  if(!lista.length) h += '<div style="font-size:12px;color:var(--muted);">' + (_filtro ? 'Ningún pedido coincide.' : 'No hay pedidos abiertos. Aquí llegan los pedidos de los clientes con cuenta que tocan "Comprar por WhatsApp".') + '</div>';
  else h += lista.map(htmlPedido).join('');
  cont.innerHTML = h;
  window.__pedidosWeb = _pedidos;
}
function htmlPedido(p){
  var c = p.cuenta || {};
  var inv = state.inventario.find(function(x){ return x.id === p.relojId; });
  var color = { solicitado: 'var(--red)', confirmado: 'var(--accent, #b98900)', pagado: 'var(--green)', enviado: 'var(--green)', entregado: 'var(--muted)', cancelado: 'var(--muted)' }[p.estado];
  var d = p.direccion || {};
  var dir = [d.linea, d.ciudad, d.provincia].filter(Boolean).join(', ') + (d.referencia ? ' (' + d.referencia + ')' : '');
  var b = function(txt, fn, cls){ return '<button class="btn btn-sm ' + (cls || 'btn-outline') + '" onclick="' + fn + '">' + txt + '</button>'; };
  var n = esc(p.numero);
  var acciones = '';
  if(p.estado === 'solicitado') acciones = b('Confirmar · envío', "avanzarPedidoWeb('" + n + "','confirmado','envio')", 'btn-gold') + b('Confirmar · retiro', "avanzarPedidoWeb('" + n + "','confirmado','retiro')") + b('Cancelar', "avanzarPedidoWeb('" + n + "','cancelado')", 'btn-danger');
  else if(p.estado === 'confirmado') acciones = b('Registrar venta', "venderPedidoWeb('" + n + "')", 'btn-gold') + b('Ya está pagado', "avanzarPedidoWeb('" + n + "','pagado')") + b('Cancelar', "avanzarPedidoWeb('" + n + "','cancelado')", 'btn-danger');
  else if(p.estado === 'pagado') acciones = p.entrega === 'retiro' ? b('Marcar retirado', "avanzarPedidoWeb('" + n + "','entregado')", 'btn-gold') : b('Marcar enviado', "avanzarPedidoWeb('" + n + "','enviado')", 'btn-gold') + b('Entregado en mano', "avanzarPedidoWeb('" + n + "','entregado')");
  else if(p.estado === 'enviado') acciones = b('Marcar entregado', "avanzarPedidoWeb('" + n + "','entregado')", 'btn-gold');
  var msg = '¡Hola' + (c.nombre ? ' ' + c.nombre : '') + '! Te escribo de Aphillips Store por tu pedido ' + p.numero + ' (' + p.reloj + ').';
  return '<div style="padding:12px 0;border-bottom:1px solid var(--border);font-size:13px;">' +
    '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline;">' +
      '<b>' + n + ' · ' + esc(p.reloj) + (p.sku ? ' <span style="color:var(--muted);font-weight:400;">Ref. ' + esc(p.sku) + '</span>' : '') + '</b>' +
      '<span style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:' + color + ';">' + ESTADOS[p.estado] + (p.entrega ? ' · ' + (p.entrega === 'retiro' ? 'retiro' : 'envío') : '') + '</span></div>' +
    '<div style="font-size:12px;color:var(--muted);margin:3px 0;">$' + Number(p.precio || 0).toLocaleString() + ' · ' + fecha(p.creado) +
      (inv ? ' · En inventario: ' + esc(inv.estado) : ' · <span style="color:var(--red);">reloj ya no está en el inventario</span>') + '</div>' +
    '<div style="font-size:12px;margin:3px 0;">' + (p.cuenta ? '<b>' + esc(c.codigo) + '</b> · ' + esc((c.nombre || '') + ' ' + (c.apellido || '')) + ' · ' + esc(c.telefono || 'sin WhatsApp') + (c.clienteId ? ' · <span style="color:var(--green);">vinculado</span>' : '') : '<span style="color:var(--muted);">(la cuenta se eliminó)</span>') + '</div>' +
    (dir ? '<div style="font-size:12px;color:var(--muted);margin:3px 0;">Dirección: ' + esc(dir) + '</div>' : '') +
    (p.tracking ? '<div style="font-size:12px;color:var(--muted);margin:3px 0;">Guía: ' + esc(p.tracking) + '</div>' : '') +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">' + acciones +
      (c.telefono ? '<a class="btn btn-sm btn-outline" href="https://wa.me/' + numeroWa(c.telefono) + '?text=' + encodeURIComponent(msg) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + '</div>' +
  '</div>';
}

async function avanzarPedidoWeb(numero, estado, entrega){
  var p = (_pedidos || []).find(function(x){ return x.numero === numero; }); if(!p) return;
  var cuerpo = { numero: numero, estado: estado };
  if(entrega) cuerpo.entrega = entrega;
  if(estado === 'cancelado'){
    var motivo = prompt('¿Cancelar el pedido ' + numero + ' (' + p.reloj + ')?\n\nEscribe el motivo (lo verá el cliente) o deja vacío:', '');
    if(motivo === null) return;
    cuerpo.nota = motivo;
  }else if(estado === 'pagado'){
    var inv = state.inventario.find(function(x){ return x.id === p.relojId; });
    if(!(inv && inv.estado === 'vendido') && !confirm('El reloj de este pedido NO figura como vendido en el inventario.\n\nLo recomendado es tocar "Registrar venta" (registra el dinero y marca el pedido como pagado).\n\n¿Marcarlo como pagado de todas formas?')) return;
  }else if(estado === 'enviado'){
    var guia = prompt('Número de guía o de seguimiento (opcional, lo verá el cliente):', p.tracking || '');
    if(guia === null) return;
    cuerpo.tracking = guia;
  }else if(!confirm('¿Pasar el pedido ' + numero + ' a "' + ESTADOS[estado] + (entrega ? ' · ' + (entrega === 'retiro' ? 'retiro en tienda' : 'envío') : '') + '"?')) return;
  try{ await pedir('/admin/pedidos/estado', { method: 'POST', body: cuerpo }); }
  catch(e){ alert('No se pudo cambiar: ' + e.message); }
  cargarPedidosWeb();
}

// Busca el cliente del panel de esta cuenta (vinculado, o con el mismo WhatsApp); si no existe lo crea
// con los datos de la cuenta y lo vincula. Devuelve su id.
async function clienteDePedido(p){
  var c = p.cuenta; if(!c) return '';
  if(c.clienteId && state.clientes.some(function(x){ return x.id === c.clienteId; })) return c.clienteId;
  var tel = numeroWa(c.telefono);
  var cli = tel && state.clientes.find(function(x){ return numeroWa(x.tel) === tel; });
  if(!cli){
    cli = { id: idAleatorio('cli'), _ts: Date.now(), nombre: ((c.nombre || '') + ' ' + (c.apellido || '')).trim() || c.email, tel: c.telefono || '', canal: 'web',
      producto: p.reloj, notas: 'Cuenta de la tienda ' + c.codigo + ' · ' + (c.email || ''), fecha: new Date().toLocaleDateString('es-MX') };
    state.clientes.unshift(cli); save('clientes');
    try{ renderClientes(); }catch(e){}
  }
  try{ await pedir('/admin/cuentas/vincular', { method: 'POST', body: { uid: p.uid, clienteId: cli.id } }); c.clienteId = cli.id; }catch(e){}
  return cli.id;
}
async function venderPedidoWeb(numero){
  var p = (_pedidos || []).find(function(x){ return x.numero === numero; }); if(!p) return;
  var inv = state.inventario.find(function(x){ return x.id === p.relojId; });
  if(!inv){ alert('Este reloj ya no está en el inventario. Si ya se vendió de otra forma, usa "Ya está pagado".'); return; }
  var cid = await clienteDePedido(p);
  abrirVentaModal(p.relojId, { clienteId: cid, precio: p.precio, alVender: async function(){
    try{ await pedir('/admin/pedidos/estado', { method: 'POST', body: { numero: numero, estado: 'pagado' } }); }
    catch(e){ alert('La venta se registró, pero no se pudo marcar el pedido como pagado: ' + e.message); }
    cargarPedidosWeb();
  } });
}

export { cargarPedidosWeb, renderPedidosWeb };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { avanzarPedidoWeb, filtrarPedidosWeb, venderPedidoWeb, verCerradosPedidosWeb });
