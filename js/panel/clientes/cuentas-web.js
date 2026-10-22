// =================== CUENTAS DE LA TIENDA (clientes con sesion en el catalogo) ===================
// - Avisos pendientes: clientes que pidieron "Avisame" y cuyo reloj ya llego / bajo de precio, o
//   marcas con modelos nuevos desde su ultimo aviso. Un toque abre WhatsApp con el mensaje listo y
//   el aviso queda marcado como enviado.
// - Cuentas registradas: se pueden vincular con un cliente del panel para que vean sus compras y
//   apartados en "Mi cuenta".
import { firebase } from '../../firebase.js';
import { esPublicable } from '../../products.js';
import { state } from '../state.js';

const API = 'https://api.aphillipsstore.com';
const TIENDA = 'https://aphillipsstore.com/';
const MARCAS = { invicta: 'Invicta', bulova: 'Bulova', technomarine: 'TechnoMarine' };
let _cuentas = null, _error = '', _buscar = '';
function buscarCuentaWeb(v){ _buscar = String(v || '').toLowerCase().trim(); renderCuentasWeb(); var b = document.getElementById('cw-buscar'); if(b){ b.focus(); b.setSelectionRange(b.value.length, b.value.length); } }

function esc(t){ return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function normalizar(t){ return String(t==null?'':t).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,''); }
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

async function cargarCuentasWeb(){
  try{ _cuentas = (await pedir('/admin/cuentas')).cuentas || []; _error = ''; }
  catch(e){ _error = e.message; }
  renderCuentasWeb();
}

// numero para wa.me: solo digitos; los de 8 digitos (Panama) llevan el 507 delante
function numeroWa(tel){
  var d = String(tel||'').replace(/[^0-9]/g, '');
  if(d.length === 7 || d.length === 8) d = '507' + d;
  return d;
}
function primerNombre(c){ return (c.nombre || '').split(' ')[0] || ''; }

// Lista de avisos que ya se pueden enviar, con el mensaje armado
function avisosPendientes(){
  var lista = [];
  (_cuentas || []).forEach(function(c){
    if(!c.telefono) return;
    (c.avisos || []).forEach(function(a){
      var hola = '¡Hola' + (primerNombre(c) ? ' ' + primerNombre(c) : '') + '! Te escribo de Aphillips Store. ';
      if(a.tipo === 'reloj'){
        var p = state.inventario.find(function(x){ return x.id === a.valor; });
        if(!p || !esPublicable(p) || p.estado !== 'disponible') return;
        var llego = a.estado_base !== 'disponible';
        var bajo = !llego && p.precio > 0 && a.precio_base > 0 && p.precio < a.precio_base;
        if(!llego && !bajo) return;
        var motivo = llego ? 'ya está disponible' : 'bajó de $' + a.precio_base + ' a $' + p.precio;
        lista.push({ c: c, a: a, titulo: (p.nombre || 'Reloj') + ' · ' + (llego ? 'llegó' : 'bajó de precio'), estado: p.estado, precio: p.precio || 0,
          msg: hola + 'El ' + (p.nombre || 'reloj') + ' que pediste ' + motivo + (p.precio > 0 && llego ? ' ($' + p.precio + ')' : '') + '. Míralo aquí: ' + TIENDA + '?id=' + encodeURIComponent(p.id) });
      }else if(a.tipo === 'marca'){
        var desde = Math.max(a.creado || 0, a.avisado || 0);
        var marca = a.valor;
        var nuevos = state.inventario.filter(function(p){
          return esPublicable(p) && (p.estado === 'disponible' || p.estado === 'transito') && (p._ts || 0) > desde &&
            normalizar((p.nombre||'') + ' ' + (p.coleccion||'')).indexOf(marca) !== -1;
        });
        if(!nuevos.length) return;
        var nombres = nuevos.slice(0, 3).map(function(p){ return p.nombre; }).join(', ') + (nuevos.length > 3 ? ' y ' + (nuevos.length - 3) + ' más' : '');
        lista.push({ c: c, a: a, titulo: 'Nuevos ' + (MARCAS[marca] || marca) + ' (' + nuevos.length + ')', estado: '', precio: 0,
          msg: hola + 'Llegaron relojes ' + (MARCAS[marca] || marca) + ' nuevos: ' + nombres + '. Míralos aquí: ' + TIENDA + '#marca-' + marca });
      }
    });
  });
  return lista;
}

function renderCuentasWeb(){
  var cont = document.getElementById('cuentas-web');
  if(!cont) return;
  if(_error && !_cuentas){ cont.innerHTML = '<div style="font-size:12px;color:var(--red);">No se pudieron cargar las cuentas: ' + esc(_error) + '</div>'; return; }
  if(!_cuentas){ cont.innerHTML = '<div style="font-size:12px;color:var(--muted);">Cargando...</div>'; return; }
  var pend = avisosPendientes();
  window.__avisosPendientes = pend;
  var badge = document.getElementById('cuentas-web-badge');
  if(badge){ badge.textContent = pend.length; badge.style.display = pend.length ? '' : 'none'; }
  var h = '<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin:4px 0 8px;">Avisos para enviar (' + pend.length + ')</div>';
  if(!pend.length) h += '<div style="font-size:12px;color:var(--muted);margin-bottom:14px;">Nada pendiente. Aquí aparecen los clientes a los que les llegó o bajó de precio el reloj que pidieron.</div>';
  else h += pend.map(function(x, i){
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">' +
      '<div style="flex:1;min-width:0;font-size:13px;"><b>' + esc(x.c.nombre || x.c.email) + '</b><div style="font-size:12px;color:var(--muted);">' + esc(x.titulo) + '</div></div>' +
      '<button class="btn btn-gold btn-sm" onclick="enviarAvisoWeb(' + i + ')">WhatsApp</button></div>';
  }).join('') + '<div style="height:14px;"></div>';
  var opcionesCli = '<option value="">— Sin vincular —</option>' + state.clientes.map(function(cl){ return '<option value="' + esc(cl.id) + '">' + esc(cl.nombre || cl.id) + '</option>'; }).join('');
  h += '<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin:4px 0 8px;">Cuentas registradas (' + _cuentas.length + ')</div>';
  h += '<input type="search" id="cw-buscar" placeholder="Buscar por código AP-…, nombre, WhatsApp o correo" value="' + esc(_buscar) + '" oninput="buscarCuentaWeb(this.value)" style="width:100%;margin-bottom:6px;">';
  var cuentas = _cuentas.filter(function(c){ return !_buscar || [c.codigo, c.nombre, c.apellido, c.telefono, String(c.telefono||'').replace(/[^0-9]/g,''), c.email].join(' ').toLowerCase().indexOf(_buscar) !== -1; });
  if(!_cuentas.length) h += '<div style="font-size:12px;color:var(--muted);">Todavía nadie creó su cuenta en el catálogo.</div>';
  else if(!cuentas.length) h += '<div style="font-size:12px;color:var(--muted);">Ninguna cuenta coincide.</div>';
  else h += cuentas.map(function(c){
    var sel = opcionesCli.replace('value="' + esc(c.cliente_id || '') + '"', 'value="' + esc(c.cliente_id || '') + '" selected');
    var avisos = (c.avisos || []).map(function(a){
      if(a.tipo === 'marca') return 'Marca ' + (MARCAS[a.valor] || a.valor);
      var p = state.inventario.find(function(x){ return x.id === a.valor; });
      return p ? p.nombre : 'reloj borrado';
    }).join(', ');
    return '<div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:13px;">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;"><b>' + (c.codigo ? '<span style="color:var(--accent,#3C6E8F);">' + esc(c.codigo) + '</span> · ' : '') + esc(((c.nombre || '') + ' ' + (c.apellido || '')).trim() || '(sin nombre)') + '</b><span style="font-size:12px;color:var(--muted);">' + esc(c.email) + '</span></div>' +
      '<div style="font-size:12px;color:var(--muted);margin:3px 0 6px;">' + (c.telefono ? 'WhatsApp ' + esc(c.telefono) : 'Sin WhatsApp') + ' · ' + c.favoritos + ' favoritos' + (avisos ? ' · Avisos: ' + esc(avisos) : '') + '</div>' +
      '<label style="font-size:12px;color:var(--muted);">Cliente del panel (para que vea sus compras): <select style="width:auto;display:inline-block;padding:4px 6px;font-size:12px;" onchange="vincularCuentaWeb(\'' + esc(c.uid) + '\', this.value)">' + sel + '</select></label>' +
    '</div>';
  }).join('');
  cont.innerHTML = h;
}

async function enviarAvisoWeb(i){
  var x = (window.__avisosPendientes || [])[i];
  if(!x) return;
  window.open('https://wa.me/' + numeroWa(x.c.telefono) + '?text=' + encodeURIComponent(x.msg), '_blank');
  try{
    await pedir('/admin/avisos/avisado', { method: 'POST', body: { uid: x.c.uid, tipo: x.a.tipo, valor: x.a.valor, estado: x.estado, precio: x.precio } });
    x.a.avisado = Date.now(); if(x.estado) x.a.estado_base = x.estado; if(x.precio) x.a.precio_base = x.precio;
  }catch(e){ alert('Se abrió WhatsApp, pero no se pudo marcar como enviado: ' + e.message); }
  renderCuentasWeb();
}
async function vincularCuentaWeb(uid, clienteId){
  try{
    await pedir('/admin/cuentas/vincular', { method: 'POST', body: { uid: uid, clienteId: clienteId || null } });
    var c = (_cuentas || []).find(function(x){ return x.uid === uid; }); if(c) c.cliente_id = clienteId || null;
  }catch(e){ alert('No se pudo vincular: ' + e.message); cargarCuentasWeb(); }
}

export { avisosPendientes, cargarCuentasWeb, renderCuentasWeb };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { buscarCuentaWeb, enviarAvisoWeb, vincularCuentaWeb });
