// =================== CLIENTE CON LUPA (Ventas > Registrar venta) ===================
// Buscar el cliente escribiendo su numero (12, AP-12, AP-00012), nombre o telefono, igual que en la ventana
// "Registrar venta" del inventario. El <select id="fin-cliente"> sigue siendo el dato que se guarda (queda
// oculto); aqui solo se elige su valor.
// POKA-YOKE: solo se puede elegir un cliente que existe; el elegido se muestra con "Quitar" para cambiarlo.
import { numeroBuscado, numeroCodigo } from '../clientes/numeros.js';
import { esc } from '../componentes.js';
import { state } from '../state.js';

function el(id){ return document.getElementById(id); }
function digitos(t){ var d = String(t || '').replace(/\D/g, ''); if(d.length === 11 && d.indexOf('507') === 0) d = d.slice(3); return d; }
function sinAcentos(t){ return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

function buscarClienteFin(v){
  var res = el('fin-cli-resultados'), q = sinAcentos(v).trim(), qd = digitos(v);
  if(!res) return;
  if(!q){ res.hidden = true; res.innerHTML = ''; return; }
  // numero de cliente exacto primero, despues nombre o telefono
  var nq = numeroBuscado(v);
  var lista = state.clientes.filter(function(c){
    return (nq && numeroCodigo(c.codigo) === nq) || sinAcentos(c.nombre).indexOf(q) !== -1 || (qd.length >= 3 && digitos(c.tel || c.telefono).indexOf(qd) !== -1);
  }).sort(function(a, b){ return (nq && numeroCodigo(b.codigo) === nq ? 1 : 0) - (nq && numeroCodigo(a.codigo) === nq ? 1 : 0); }).slice(0, 6);
  res.innerHTML = lista.length ? lista.map(function(c){
    return '<button type="button" class="vm-res" onclick="elegirClienteFin(\'' + esc(c.id) + '\')"><b>' + esc(c.nombre) + '</b><span>' + esc([c.codigo, c.tel || c.telefono].filter(Boolean).join(' · ')) + '</span></button>';
  }).join('') : '<div class="vm-res" style="cursor:default;">Nadie con ese dato. Si es nuevo, agrégalo en Clientes o vende desde la ventana "Vender" del inventario.</div>';
  res.hidden = false;
}
function elegirClienteFin(id){
  var s = el('fin-cliente'); if(!s) return;
  s.value = id || '';
  var b = el('fin-buscar-cliente'); if(b) b.value = '';
  sincronizarClienteFin();
}
function quitarClienteFin(){ elegirClienteFin(''); setTimeout(function(){ var b = el('fin-buscar-cliente'); if(b) b.focus(); }, 30); }
// muestra el elegido o el buscador segun el valor del select (tambien despues de registrar una venta)
function sincronizarClienteFin(){
  var s = el('fin-cliente'), sel = el('fin-cli-sel'), bus = el('fin-cli-buscador'), res = el('fin-cli-resultados');
  if(!s || !sel || !bus) return;
  var c = s.value && state.clientes.find(function(x){ return x.id === s.value; });
  if(c){
    sel.innerHTML = '<span>' + (c.codigo ? '<em class="vm-opcional">' + esc(c.codigo) + '</em> ' : '') + '<b>' + esc(c.nombre) + '</b>' + ((c.tel || c.telefono) ? ' · ' + esc(c.tel || c.telefono) : '') + '</span><button type="button" onclick="quitarClienteFin()">Quitar</button>';
    sel.hidden = false; bus.hidden = true;
  } else { sel.hidden = true; bus.hidden = false; }
  if(res) res.hidden = true;
}

export { sincronizarClienteFin };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { buscarClienteFin, elegirClienteFin, quitarClienteFin });
