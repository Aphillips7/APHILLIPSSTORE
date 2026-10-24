// =================== PEDIDOS WEB (hechos por WhatsApp desde la tienda) ===================
// Cuando un cliente con cuenta toca "Comprar por WhatsApp", se crea un pedido (P-XXXXX) que llega aqui.
// El dueno lo avanza paso a paso; el cliente ve cada cambio en "Mis pedidos" de la tienda.
//   solicitado -> confirmado (envio o retiro) -> pagado -> enviado -> entregado   (o cancelado)
// POKA-YOKE:
// - Solo aparecen los botones del siguiente paso permitido (el servidor tambien lo bloquea).
// - Cancelar exige un motivo (lo ve el cliente) y "enviado" exige la guia.
// - "Registrar venta" abre la venta del reloj con el cliente ya elegido (y si no existe en el panel, se
//   crea con los datos de su cuenta y se vincula, sin duplicar: se busca primero por su WhatsApp). Al
//   confirmar la venta, el pedido pasa solo a "pagado": dinero y pedido no se desincronizan.
// - Marcar "pagado" sin registrar la venta pide confirmacion explicita.
import { firebase } from '../../firebase.js';
import { abrirVentaModal } from '../inventario/venta-modal.js';
import { idAleatorio, save, state } from '../state.js';
import { renderClientes } from '../clientes/clientes.js';

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

// Tablero: una columna por paso abierto (en celular se apilan). "Ver entregados y cancelados" muestra la lista cerrada.
function coincideFiltro(p){
  if(!_filtro) return true;
  var c = p.cuenta || {};
  return [p.numero, p.reloj, p.sku, c.codigo, c.nombre, c.apellido, c.telefono, c.email].join(' ').toLowerCase().indexOf(_filtro) !== -1;
}
function renderPedidosWeb(){
  var cont = document.getElementById('pedidos-web');
  if(!cont) return;
  if(_error && !_pedidos){ cont.innerHTML = '<div class="campo-ayuda error">No se pudieron cargar los pedidos: ' + esc(_error) + '</div>'; return; }
  if(!_pedidos){ cont.innerHTML = '<div class="campo-ayuda">Cargando pedidos...</div>'; return; }
  window.__pedidosWeb = _pedidos;
  var badge = document.getElementById('pedidos-web-badge');
  var nuevos = _pedidos.filter(function(p){ return p.estado === 'solicitado'; }).length;
  if(badge){ badge.textContent = nuevos; badge.style.display = nuevos ? '' : 'none'; }
  var h = '<div class="pw-barra">' +
    '<input type="search" placeholder="Buscar: P-…, AP-…, nombre, WhatsApp, reloj" value="' + esc(_filtro) + '" oninput="filtrarPedidosWeb(this.value)">' +
    '<label class="pw-check"><input type="checkbox" ' + (_verCerrados ? 'checked' : '') + ' onchange="verCerradosPedidosWeb(this.checked)"> Ver entregados y cancelados</label></div>';
  if(_verCerrados){
    var cerrados = _pedidos.filter(function(p){ return ABIERTOS.indexOf(p.estado) === -1 && coincideFiltro(p); });
    h += cerrados.length ? '<div class="pw-lista">' + cerrados.map(htmlPedido).join('') + '</div>' : '<div class="campo-ayuda">' + (_filtro ? 'Ningun pedido cerrado coincide.' : 'Todavia no hay pedidos entregados ni cancelados.') + '</div>';
  } else {
    var abiertos = _pedidos.filter(function(p){ return ABIERTOS.indexOf(p.estado) !== -1 && coincideFiltro(p); });
    if(!abiertos.length) h += '<div class="vacio"><div class="vacio-titulo">' + (_filtro ? 'Ningun pedido coincide' : 'No hay pedidos abiertos') + '</div><div class="vacio-texto">Aqui llegan los pedidos de los clientes con cuenta que tocan "Comprar por WhatsApp" en la tienda.</div></div>';
    else h += '<div class="tablero">' + ABIERTOS.map(function(est){
      var col = abiertos.filter(function(p){ return p.estado === est; });
      return '<div class="tablero-col' + (col.length ? '' : ' vacia') + '"><div class="tablero-cab"><span class="pw-punto pw-' + est + '"></span>' + ESTADOS[est] + '<b>' + col.length + '</b></div>' +
        (col.length ? col.map(htmlPedido).join('') : '<div class="tablero-nada">Nada aqui</div>') + '</div>';
    }).join('') + '</div>';
  }
  cont.innerHTML = h;
  try{ document.dispatchEvent(new Event('pedidos-web')); }catch(e){}
}
function htmlPedido(p){
  var c = p.cuenta || {};
  var inv = state.inventario.find(function(x){ return x.id === p.relojId; });
  var d = p.direccion || {};
  var dir = [d.linea, d.ciudad, d.provincia].filter(Boolean).join(', ') + (d.referencia ? ' (' + d.referencia + ')' : '');
  var b = function(txt, fn, cls){ return '<button type="button" class="btn btn-sm ' + (cls || 'btn-outline') + '" onclick="' + fn + '">' + txt + '</button>'; };
  var n = esc(p.numero);
  var acciones = '';
  if(p.estado === 'solicitado') acciones = b('Confirmar · envío', "avanzarPedidoWeb('" + n + "','confirmado','envio')", 'btn-gold') + b('Confirmar · retiro', "avanzarPedidoWeb('" + n + "','confirmado','retiro')") + b('Cancelar', "avanzarPedidoWeb('" + n + "','cancelado')", 'btn-danger');
  else if(p.estado === 'confirmado') acciones = b('Registrar venta', "venderPedidoWeb('" + n + "')", 'btn-gold') + b('Ya está pagado', "avanzarPedidoWeb('" + n + "','pagado')") + b('Cancelar', "avanzarPedidoWeb('" + n + "','cancelado')", 'btn-danger');
  else if(p.estado === 'pagado') acciones = p.entrega === 'retiro' ? b('Marcar retirado', "avanzarPedidoWeb('" + n + "','entregado')", 'btn-gold') : b('Marcar enviado', "avanzarPedidoWeb('" + n + "','enviado')", 'btn-gold') + b('Entregado en mano', "avanzarPedidoWeb('" + n + "','entregado')");
  else if(p.estado === 'enviado') acciones = b('Marcar entregado', "avanzarPedidoWeb('" + n + "','entregado')", 'btn-gold');
  var msg = '¡Hola' + (c.nombre ? ' ' + c.nombre : '') + '! Te escribo de Aphillips Store por tu pedido ' + p.numero + ' (' + p.reloj + ').';
  var horas = (Date.now() - (p.actualizado || p.creado || Date.now())) / 3600000;
  var espera = ['solicitado', 'confirmado', 'pagado'].indexOf(p.estado) !== -1 && horas >= 24 ? '<span class="pw-espera' + (horas >= 48 ? ' tarde' : '') + '">' + (horas >= 48 ? Math.floor(horas / 24) + ' d' : Math.floor(horas) + ' h') + ' sin avanzar</span>' : '';
  return '<div class="pw-card">' +
    '<div class="pw-cab"><b>' + n + '</b>' + (ABIERTOS.indexOf(p.estado) === -1 ? '<span class="pw-est pw-' + p.estado + '">' + ESTADOS[p.estado] + '</span>' : '') + (p.entrega ? '<span class="pw-ent">' + (p.entrega === 'retiro' ? 'Retiro' : 'Envío') + '</span>' : '') + espera + '</div>' +
    '<div class="pw-reloj">' + esc(p.reloj) + (p.sku ? ' <span>Ref. ' + esc(p.sku) + '</span>' : '') + '</div>' +
    '<div class="pw-dato">' + dinero(p.precio) + ' · ' + fecha(p.creado) + (inv ? '' : ' · <span class="neg">ya no esta en el inventario</span>') + '</div>' +
    '<div class="pw-dato">' + (p.cuenta ? '<b>' + esc(c.codigo) + '</b> · ' + esc(((c.nombre || '') + ' ' + (c.apellido || '')).trim()) + ' · ' + esc(c.telefono || 'sin WhatsApp') + (c.clienteId ? ' · <span class="pos">vinculado</span>' : '') : '(la cuenta se eliminó)') + '</div>' +
    (dir ? '<div class="pw-dato">Dirección: ' + esc(dir) + '</div>' : '') +
    (p.tracking ? '<div class="pw-dato">Guía: ' + esc(p.tracking) + '</div>' : '') +
    (p.nota ? '<div class="pw-dato">Nota: ' + esc(p.nota) + '</div>' : '') +
    '<div class="pw-acc">' + acciones +
      (c.telefono ? '<a class="btn btn-sm btn-outline" href="https://wa.me/' + numeroWa(c.telefono) + '?text=' + encodeURIComponent(msg) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + '</div>' +
  '</div>';
}
function dinero(n){ return '$' + Math.round(Number(n) || 0).toLocaleString('en-US'); }

async function avanzarPedidoWeb(numero, estado, entrega){
  var p = (_pedidos || []).find(function(x){ return x.numero === numero; }); if(!p) return;
  var cuerpo = { numero: numero, estado: estado };
  if(entrega) cuerpo.entrega = entrega;
  if(estado === 'cancelado'){
    // poka-yoke: el motivo es obligatorio (lo ve el cliente en "Mis pedidos")
    var motivo = '';
    while(motivo.trim().length < 5){
      motivo = prompt('¿Cancelar el pedido ' + numero + ' (' + p.reloj + ')?\n\nEscribe el motivo (lo verá el cliente, mínimo 5 letras):', motivo);
      if(motivo === null) return;
    }
    cuerpo.nota = motivo.trim();
  }else if(estado === 'pagado'){
    var inv = state.inventario.find(function(x){ return x.id === p.relojId; });
    if(!(inv && inv.estado === 'vendido') && !confirm('El reloj de este pedido NO figura como vendido en el inventario.\n\nLo recomendado es tocar "Registrar venta" (registra el dinero y marca el pedido como pagado).\n\n¿Marcarlo como pagado de todas formas?')) return;
  }else if(estado === 'enviado'){
    // poka-yoke: sin guia no se marca "enviado" (si se entrego en mano, usar "Entregado en mano")
    var guia = p.tracking || '';
    do{
      guia = prompt('Número de guía o de seguimiento (lo verá el cliente).\nSi lo entregaste en mano, cancela y usa "Entregado en mano".', guia);
      if(guia === null) return;
    } while(guia.trim().length < 4);
    cuerpo.tracking = guia.trim();
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
