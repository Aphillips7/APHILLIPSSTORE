// =================== NUMERO DE CLIENTE (AP-00012) ===================
// Cada cliente tiene un solo numero, lo registre el dueno en el panel o se registre el en la tienda: los dos
// salen del mismo contador del servidor, asi que nunca se repiten. El WhatsApp es la llave de cada persona:
// - Cliente creado en el panel cuyo WhatsApp ya tiene una cuenta de la tienda -> toma el numero de esa
//   cuenta y queda vinculado (el cliente ve sus compras y apartados en "Mi cuenta").
// - Cuenta de la tienda con el WhatsApp de un cliente del panel -> se vinculan solas (el servidor lo hace al
//   guardar el perfil y este modulo lo revisa cada vez que se cargan las cuentas).
// - Cuenta de la tienda sin ficha en el panel -> se crea su ficha con el mismo numero.
// - Si los dos ya tenian numero, se queda el MAS ANTIGUO (el menor) y el otro se retira.
// POKA-YOKE: nada de esto pide datos al dueno; si no hay internet, el numero se asigna en la siguiente carga.
import { firebase } from '../../firebase.js';
import { esperarDatosNube } from '../sync/nube.js';
import { save, state } from '../state.js';
import { telDe } from './segmentos.js';

const API = 'https://api.aphillipsstore.com';
const RE_CODIGO = /^AP-(\d{5,9})$/;

// mismo criterio que el servidor: 7 u 8 digitos = Panama (se le pone 507); otros paises con su codigo
function telNorm(t){
  var d = String(t || '').replace(/[^0-9]/g, '');
  if(d.length === 7 || d.length === 8) d = '507' + d;
  return d.length >= 10 && d.length <= 15 ? d : '';
}
function numeroCodigo(c){ var m = RE_CODIGO.exec(String(c || '')); return m ? Number(m[1]) : 0; }
// lo que se escribe en un buscador: "AP-12", "ap12", "#12" o "12" -> 12 (0 si no parece un numero de cliente)
function numeroBuscado(q){
  var t = String(q || '').trim().toLowerCase().replace(/\s+/g, '');
  var m = /^(?:ap-?|#)?0*(\d{1,9})$/.exec(t);
  return m ? Number(m[1]) : 0;
}
// el cliente con ese numero exacto (para los buscadores)
function clientePorNumero(q){
  var n = numeroBuscado(q); if(!n) return null;
  return state.clientes.find(function(c){ return numeroCodigo(c.codigo) === n; }) || null;
}

async function pedir(ruta, cuerpo){
  var u = firebase.auth().currentUser;
  if(!u) throw new Error('sin sesion');
  var r = await fetch(API + ruta, { method: 'POST', headers: { 'Authorization': 'Bearer ' + await u.getIdToken(), 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
  var d = {}; try{ d = await r.json(); }catch(e){}
  if(!r.ok) throw new Error(d.error || ('Error ' + r.status));
  return d;
}
async function nuevosCodigos(n){ return n > 0 ? ((await pedir('/admin/clientes/codigos', { n: n })).codigos || []) : []; }
function cuentaDe(c){ return (window.__cuentasWeb || []).find(function(cu){ return cu.cliente_id === c.id; }) || null; }
function cuentaConTel(tel){
  var t = telNorm(tel); if(!t) return null;
  return (window.__cuentasWeb || []).find(function(cu){ return telNorm(cu.telefono) === t; }) || null;
}

// Cliente recien creado en el panel: si su WhatsApp ya tiene cuenta en la tienda, toma ese numero y se
// vinculan; si no, recibe un numero nuevo. No bloquea: si falla, la proxima revision lo completa.
async function numerarClienteNuevo(id){
  var c = state.clientes.find(function(x){ return x.id === id; });
  if(!c || c.codigo) return;
  try{
    var cu = cuentaConTel(telDe(c));
    if(cu && !cu.cliente_id){
      await pedir('/admin/cuentas/vincular', { uid: cu.uid, clienteId: c.id });
      cu.cliente_id = c.id;
      if(numeroCodigo(cu.codigo)) c.codigo = cu.codigo;
      if(window.toastPanel) window.toastPanel(c.nombre + ' ya tenia cuenta en la tienda: quedo unido con el numero ' + c.codigo + '.');
    }
    if(!c.codigo) c.codigo = (await nuevosCodigos(1))[0] || '';
    if(c.codigo){ c._ts = c._ts || Date.now(); save('clientes'); refrescar(); }
  }catch(e){ /* sin internet: se asigna en la siguiente revision */ }
}

// Revision completa (cada vez que se cargan las cuentas de la tienda): une por WhatsApp, crea la ficha de
// las cuentas que no tienen, deja un solo numero (el mas antiguo) y numera a quien no tenga.
var _revisando = false;
async function revisarNumerosClientes(){
  if(_revisando || !window.__cuentasWeb) return;
  _revisando = true;
  try{
    await esperarDatosNube();
    var cuentas = window.__cuentasWeb, cambio = false, unidos = [], creados = 0;
    var existe = function(id){ return state.clientes.some(function(c){ return c.id === id; }); };
    for(var i = 0; i < cuentas.length; i++){
      var cu = cuentas[i];
      if(cu.cliente_id && !existe(cu.cliente_id)) cu.cliente_id = null;   // su ficha se borro
      var t = telNorm(cu.telefono);
      if(!cu.cliente_id && t){
        // 1) misma persona por WhatsApp: el cliente mas antiguo con ese numero
        var mismos = state.clientes.filter(function(c){ return telNorm(telDe(c)) === t; }).sort(function(a, b){ return (a._ts || 0) - (b._ts || 0); });
        var cl = mismos[0];
        // 2) sin ficha en el panel: se crea con los datos de la cuenta (id fijo: dos dispositivos no la duplican)
        if(!cl){
          cl = { id: 'cliw_' + cu.uid, _ts: cu.creado || Date.now(), nombre: [cu.nombre, cu.apellido].filter(Boolean).join(' ').trim() || cu.email || 'Cliente web',
            tel: cu.telefono, canal: 'web', producto: '', notas: '', fecha: new Date(cu.creado || Date.now()).toLocaleDateString('es-MX'), codigo: '' };
          if(!existe(cl.id)){ state.clientes.unshift(cl); creados++; cambio = true; }
          else cl = state.clientes.find(function(c){ return c.id === cl.id; });
        } else unidos.push(cl.nombre);
        await pedir('/admin/cuentas/vincular', { uid: cu.uid, clienteId: cl.id });
        cu.cliente_id = cl.id;
      }
      // 3) un solo numero por persona: el mas antiguo
      if(cu.cliente_id){
        var c = state.clientes.find(function(x){ return x.id === cu.cliente_id; });
        var nc = numeroCodigo(c.codigo), ncu = numeroCodigo(cu.codigo);
        var gana = nc && ncu ? Math.min(nc, ncu) : (nc || ncu);
        if(gana){
          var texto = gana === nc ? c.codigo : cu.codigo;
          if(c.codigo !== texto){ c.codigo = texto; c._ts = Date.now(); cambio = true; }
          if(cu.codigo !== texto){ await pedir('/admin/cuentas/codigo', { uid: cu.uid, codigo: texto }); cu.codigo = texto; }
        }
      }
    }
    // 4) los clientes que todavia no tienen numero (los mas antiguos reciben los numeros mas bajos)
    var sin = state.clientes.filter(function(c){ return !numeroCodigo(c.codigo); }).sort(function(a, b){ return (a._ts || 0) - (b._ts || 0); });
    if(sin.length){
      var cods = await nuevosCodigos(sin.length);
      sin.forEach(function(c, k){ if(cods[k]){ c.codigo = cods[k]; cambio = true; } });
    }
    if(cambio){ save('clientes'); refrescar(); }
    var aviso = [];
    if(unidos.length) aviso.push(unidos.length + ' cliente' + (unidos.length !== 1 ? 's' : '') + ' unido' + (unidos.length !== 1 ? 's' : '') + ' con su cuenta de la tienda (' + unidos.slice(0, 3).join(', ') + (unidos.length > 3 ? '...' : '') + ')');
    if(creados) aviso.push(creados + ' cuenta' + (creados !== 1 ? 's' : '') + ' de la tienda agregada' + (creados !== 1 ? 's' : '') + ' a Clientes');
    if(sin.length) aviso.push(sin.length + ' numero' + (sin.length !== 1 ? 's' : '') + ' de cliente asignado' + (sin.length !== 1 ? 's' : ''));
    if(aviso.length && window.toastPanel) window.toastPanel(aviso.join(' · ') + '.');
  }catch(e){ /* sin internet o sin sesion: se reintenta en la siguiente carga de cuentas */ }
  finally{ _revisando = false; }
}
function refrescar(){ try{ if(window.renderClientes) window.renderClientes(); }catch(e){} try{ if(window.renderCuentasWeb) window.renderCuentasWeb(); }catch(e){} }

export { clientePorNumero, cuentaDe, numerarClienteNuevo, numeroBuscado, numeroCodigo, revisarNumerosClientes, telNorm };
