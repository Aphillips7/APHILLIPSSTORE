// =================== CLIENTES (rediseno fase 6) ===================
// KPIs de la cartera, segmentos automaticos (VIP, inactivos, prospectos por contactar...), lista con la
// accion sugerida para cada cliente, aviso y union de clientes repetidos, y el formulario de alta/edicion.
// POKA-YOKE: Guardar se activa solo con un nombre valido; el telefono se corrige solo al formato de Panama;
// un telefono que ya tiene otro cliente no se puede repetir (se ofrece abrir su ficha); unir clientes
// mueve ventas, abonos, apartados y la cuenta web antes de borrar el repetido, con confirmacion.
import { verDetalleCliente } from './cliente-detalle.js';
import { numerarClienteNuevo, numeroBuscado, numeroCodigo } from './numeros.js';
import { SEGMENTOS, digitos, duplicados, etiquetaPrincipal, mensajeSugerido, perfil, telDe, waDe } from './segmentos.js';
import { cerrarModal } from '../inventario/detalle.js';
import { dinero, esc, estadoHTML, kpiHTML, vacioHTML } from '../componentes.js';
import { claveMes } from '../finanzas/calculos.js';
import { finMesKey } from '../finanzas/fechas.js';
import { idAleatorio, idxCliente, save, state } from '../state.js';
import { saldoPendienteReserva } from '../../products.js';

const CANALES_CLI = { facebook: 'Facebook', whatsapp: 'WhatsApp', instagram: 'Instagram', directo: 'Directo', web: 'Tienda web' };
function el(id){ return document.getElementById(id); }

function whatsappLink(tel, texto){
  var d = digitos(tel); if(d.length === 7 || d.length === 8) d = '507' + d;
  if(d.length < 10) return '';
  return 'https://wa.me/' + d + (texto ? '?text=' + encodeURIComponent(texto) : '');
}
// Telefono de Panama: se escribe como sea y queda "+507 6123-4567". Si no tiene 7 u 8 digitos se deja como esta.
function telefonoPanama(t){
  var d = String(t || '').replace(/[^0-9]/g, '');
  if(!d) return '';
  if(d.length === 11 && d.indexOf('507') === 0) d = d.slice(3);
  if(d.length === 8) return '+507 ' + d.slice(0, 4) + '-' + d.slice(4);
  if(d.length === 7) return '+507 ' + d.slice(0, 3) + '-' + d.slice(3);
  return String(t).trim();
}
function clienteConTel(tel, salvoId){
  var d = digitos(tel); if(d.length < 7) return null;
  return state.clientes.find(function(c){ return c.id !== salvoId && digitos(telDe(c)) === d; }) || null;
}

// ---------- formulario ----------
function validarCliente(){
  var b = el('cli-submit-btn'); if(!b) return false;
  var nombre = (el('cli-nombre').value || '').replace(/\s+/g, ' ').trim();
  var tel = el('cli-tel').value, dup = clienteConTel(tel, el('cli-edit-id').value);
  var ayuda = el('cli-ayuda'), msg = '';
  if(dup) msg = 'Ese telefono ya es de ' + dup.nombre + '. <button type="button" class="enlace" onclick="verDetalleCliente(\'' + esc(dup.id) + '\')">Abrir su ficha</button>';
  else if(nombre && nombre.length < 3) msg = 'Escribe el nombre completo.';
  if(ayuda){ ayuda.innerHTML = msg; ayuda.hidden = !msg; ayuda.classList.toggle('error', !!msg); }
  var ok = nombre.length >= 3 && !dup;
  b.disabled = !ok;
  return ok;
}
function abrirFormCliente(){
  var f = el('cli-form'); if(!f) return;
  f.hidden = false;
  validarCliente();
  setTimeout(function(){ el('cli-nombre').focus(); f.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
}
(function(){
  var t = el('cli-tel');
  if(t) t.addEventListener('blur', function(){ t.value = telefonoPanama(t.value); validarCliente(); });
})();
function registrarCliente(){
  var t = el('cli-tel'); t.value = telefonoPanama(t.value);
  if(!validarCliente()) return;
  var nombre = el('cli-nombre').value.replace(/\s+/g, ' ').trim();
  var tel = t.value, dig = tel.replace(/[^0-9]/g, '');
  if(dig && !/^507\d{7,8}$/.test(dig) && !confirm('El telefono "' + tel + '" no parece de Panama (7 u 8 digitos). Si es de otro pais, escribelo con su codigo (ej. +1...). ¿Guardarlo asi?')) return;
  var datos = { nombre: nombre, tel: tel, canal: el('cli-canal').value, producto: el('cli-producto').value.trim(), notas: el('cli-notas').value.trim() };
  var editId = el('cli-edit-id').value;
  if(editId){
    var i = idxCliente(editId);
    if(i === -1){ alert('Este cliente ya no existe (puede que se haya eliminado en otro dispositivo).'); cancelarEdicionCliente(); return; }
    Object.assign(state.clientes[i], datos, { _ts: Date.now() });
  } else {
    var nuevoId = idAleatorio('cli');
    state.clientes.unshift(Object.assign({ id: nuevoId, _ts: Date.now(), fecha: new Date().toLocaleDateString('es-MX') }, datos));
  }
  save('clientes');
  if(nuevoId) numerarClienteNuevo(nuevoId);   // numero de cliente (o el de su cuenta de la tienda si ya tenia)
  cancelarEdicionCliente();
  renderClientes();
}
function editarCliente(id){
  var i = idxCliente(id);
  if(i === -1){ alert('Este cliente ya no existe.'); renderClientes(); return; }
  var c = state.clientes[i];
  el('cli-nombre').value = c.nombre || '';
  el('cli-tel').value = telDe(c);
  el('cli-canal').value = c.canal || 'whatsapp';
  el('cli-producto').value = c.producto || '';
  el('cli-notas').value = c.notas || '';
  el('cli-edit-id').value = c.id;
  el('cli-form-title').textContent = 'Editar cliente';
  el('cli-submit-btn').textContent = 'Guardar cambios';
  cerrarModal();
  try{ window.irSeccion('clientes', 'clientes'); }catch(e){}
  abrirFormCliente();
}
function cancelarEdicionCliente(){
  el('cli-edit-id').value = '';
  ['cli-nombre', 'cli-tel', 'cli-producto', 'cli-notas'].forEach(function(id){ var x = el(id); x.value = ''; delete x.dataset.tocado; });
  el('cli-canal').value = 'whatsapp';
  el('cli-form-title').textContent = 'Nuevo cliente';
  el('cli-submit-btn').textContent = 'Guardar cliente';
  var f = el('cli-form'); if(f) f.hidden = true;
  validarCliente();
}

// ---------- lista ----------
var _seg = 'todos';
function setFiltroCliente(btn, f){ _seg = f || 'todos'; renderClientes(); }
function renderClientes(){
  var perfiles = state.clientes.map(perfil);
  renderStatsClientes(perfiles);
  renderSegmentos(perfiles);
  renderDuplicados();
  var lista = el('cli-lista'); if(!lista) return;
  if(!state.clientes.length){ lista.innerHTML = vacioHTML({ icono: 'persona', titulo: 'Todavia no tienes clientes', texto: 'Registra a quien te escribe o te compra para saber a quien volver a contactar.', boton: 'Nuevo cliente', onclick: 'abrirFormCliente()' }); return; }
  var q = digitosOTexto((el('cli-search') || {}).value || '');
  var orden = (el('cli-orden') || {}).value || 'reciente';
  var items = perfiles.filter(function(pf){
    if(_seg !== 'todos' && !pf.seg[_seg]) return false;
    if(!q) return true;
    var c = pf.c, nq = numeroBuscado(q);
    if(nq && numeroCodigo(c.codigo) === nq) return true;   // por numero de cliente: 12, AP-12, AP-00012
    return digitosOTexto([c.codigo, c.nombre, telDe(c), c.producto, c.notas].join(' ')).indexOf(q) !== -1 || (/^\d+$/.test(q) && digitos(telDe(c)).indexOf(q) !== -1);
  });
  if(orden === 'alfabetico') items.sort(function(a, b){ return (a.c.nombre || '').localeCompare(b.c.nombre || ''); });
  else if(orden === 'gasto') items.sort(function(a, b){ return b.total - a.total; });
  else if(orden === 'ultima') items.sort(function(a, b){ return (b.ultima || 0) - (a.ultima || 0); });
  else items.sort(function(a, b){ return (b.c._ts || 0) - (a.c._ts || 0); });
  var res = el('cli-resultado');
  if(res) res.textContent = items.length + ' cliente' + (items.length !== 1 ? 's' : '') + (_seg !== 'todos' ? ' en ' + (SEGMENTOS.find(function(s){ return s.id === _seg; }) || {}).t : '');
  if(!items.length){ lista.innerHTML = vacioHTML({ icono: 'persona', titulo: 'Nadie en este filtro' }); return; }
  lista.innerHTML = items.slice(0, 300).map(function(pf){
    var c = pf.c, et = etiquetaPrincipal(pf), id = esc(c.id);
    var wa = whatsappLink(telDe(c), mensajeSugerido(pf));
    var sub = [c.codigo, telDe(c), CANALES_CLI[c.canal] || c.canal, pf.compras ? pf.compras + ' compra' + (pf.compras !== 1 ? 's' : '') : (c.producto ? 'busca: ' + c.producto : 'sin compras'),
      pf.diasCompra !== null ? 'ultima hace ' + pf.diasCompra + ' d' : (pf.diasContacto !== null ? 'contactado hace ' + pf.diasContacto + ' d' : '')].filter(Boolean).join(' · ');
    return '<div class="cli-fila" onclick="verDetalleCliente(\'' + id + '\')">' +
      '<div class="cli-avatar">' + esc((c.nombre || '?').trim().charAt(0).toUpperCase()) + '</div>' +
      '<div class="cli-info"><div class="cli-nombre">' + esc(c.nombre) + '</div><div class="cli-sub">' + esc(sub) + '</div></div>' +
      '<div class="cli-der">' + estadoHTML(et[0], et[1]) + (pf.total ? '<span class="cli-total">' + dinero(pf.total) + '</span>' : '') + '</div>' +
      (wa ? '<a class="btn btn-outline btn-sm cli-wa" href="' + wa + '" target="_blank" rel="noopener" onclick="event.stopPropagation();marcarContactadoSilencioso(\'' + id + '\')" title="WhatsApp con mensaje sugerido">WhatsApp</a>' : '') +
    '</div>';
  }).join('') + (items.length > 300 ? '<div class="tenue-peq">Mostrando 300 de ' + items.length + '. Usa el buscador.</div>' : '');
}
function digitosOTexto(t){ return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }

function renderStatsClientes(perfiles){
  var cont = el('cli-stats'); if(!cont) return;
  perfiles = perfiles || state.clientes.map(perfil);
  var compradores = perfiles.filter(function(p){ return p.seg.compradores; });
  var recurrentes = compradores.filter(function(p){ return p.compras >= 2; });
  var mes = claveMes(new Date());
  var nuevosMes = state.clientes.filter(function(c){ return finMesKey(c.fecha) === mes; }).length;
  var valor = compradores.length ? compradores.reduce(function(a, p){ return a + p.total; }, 0) / compradores.length : 0;
  var inactivos = perfiles.filter(function(p){ return p.seg.inactivos; }).length;
  var saldo = perfiles.reduce(function(a, p){ return a + p.saldo; }, 0);
  cont.innerHTML = [
    kpiHTML({ label: 'Clientes', valor: String(state.clientes.length), pie: nuevosMes + ' nuevo' + (nuevosMes !== 1 ? 's' : '') + ' este mes' }),
    kpiHTML({ label: 'Compradores', valor: String(compradores.length), pie: state.clientes.length ? Math.round(compradores.length / state.clientes.length * 100) + '% de la cartera' : '' }),
    kpiHTML({ label: 'Vuelven a comprar', valor: compradores.length ? Math.round(recurrentes.length / compradores.length * 100) + '%' : '—', tono: compradores.length && recurrentes.length / compradores.length >= 0.25 ? 'pos' : '', pie: recurrentes.length + ' con 2 compras o mas' }),
    kpiHTML({ label: 'Valor por cliente', valor: dinero(valor), pie: 'lo que compra en promedio' }),
    kpiHTML({ label: 'Inactivos', valor: String(inactivos), tono: inactivos ? 'neg' : '', pie: '+90 dias sin comprar', onclick: "setFiltroCliente(null,'inactivos')" }),
    kpiHTML({ label: 'Por cobrar', valor: dinero(saldo), pie: 'en apartados', onclick: "irSeccion('ventas','apartados')" })
  ].join('');
}
function renderSegmentos(perfiles){
  var cont = el('cli-segmentos'); if(!cont) return;
  cont.innerHTML = SEGMENTOS.map(function(s){
    var n = s.id === 'todos' ? perfiles.length : perfiles.filter(function(p){ return p.seg[s.id]; }).length;
    return '<button type="button" class="fin-mes-btn' + (s.id === _seg ? ' active' : '') + '" title="' + esc(s.ayuda || '') + '" onclick="setFiltroCliente(null,\'' + s.id + '\')">' + s.t + ' <span class="seg-n">' + n + '</span></button>';
  }).join('');
  var ay = el('cli-seg-ayuda'), s = SEGMENTOS.find(function(x){ return x.id === _seg; });
  if(ay){ ay.textContent = s && s.ayuda ? s.t + ': ' + s.ayuda + '. El boton WhatsApp abre un mensaje pensado para ellos.' : ''; ay.hidden = !(s && s.ayuda); }
}

// ---------- duplicados ----------
function renderDuplicados(){
  var cont = el('cli-duplicados'); if(!cont) return;
  var g = duplicados();
  if(!g.length){ cont.innerHTML = ''; cont.hidden = true; return; }
  cont.hidden = false;
  cont.innerHTML = '<div class="fin-aviso">' + estadoHTML('pendiente', 'Revisar') + '<span>' + g.length + ' posible' + (g.length !== 1 ? 's' : '') + ' cliente' + (g.length !== 1 ? 's' : '') + ' repetido' + (g.length !== 1 ? 's' : '') + '. Unirlos junta sus compras en una sola ficha.</span></div>' +
    g.slice(0, 5).map(function(x){
      var a = x.clientes[0], b = x.clientes[1];
      return '<div class="dup-fila"><span><b>' + esc(a.nombre) + '</b> y <b>' + esc(b.nombre) + '</b> · ' + x.motivo + '</span>' +
        '<button type="button" class="btn btn-outline btn-sm" onclick="unirClientes(\'' + esc(a.id) + '\',\'' + esc(b.id) + '\')">Unir</button></div>';
    }).join('');
}
// Se queda el cliente mas antiguo; el otro pasa sus ventas, abonos, apartados, notas y cuenta web y se borra.
function unirClientes(idA, idB){
  var a = state.clientes.find(function(c){ return c.id === idA; }), b = state.clientes.find(function(c){ return c.id === idB; });
  if(!a || !b){ renderClientes(); return; }
  var queda = (a._ts || 0) <= (b._ts || 0) ? a : b, sale = queda === a ? b : a;
  var cuentas = (window.__cuentasWeb || []).filter(function(cu){ return cu.cliente_id === sale.id || cu.clienteId === sale.id; });
  if(!window.__cuentasWeb && !confirm('No se pudieron revisar las cuentas de la tienda (¿sin internet?). Si "' + sale.nombre + '" estaba vinculado a una cuenta, habra que volver a vincularla a mano.\n\n¿Continuar?')) return;
  var nMov = state.movimientos.filter(function(m){ return m.clienteId === sale.id; }).length;
  var nRes = state.inventario.filter(function(p){ return p.reserva && p.reserva.clienteId === sale.id; }).length;
  if(!confirm('Unir clientes\n\nSe queda: ' + queda.nombre + ' (' + (telDe(queda) || 'sin telefono') + ')\nSe borra: ' + sale.nombre + ' (' + (telDe(sale) || 'sin telefono') + ')\n\nPasan a ' + queda.nombre + ': ' + nMov + ' movimiento' + (nMov !== 1 ? 's' : '') + ', ' + nRes + ' apartado' + (nRes !== 1 ? 's' : '') + (cuentas.length ? ' y su cuenta de la tienda' : '') + '.\n\n¿Es la misma persona?')) return;
  state.movimientos.forEach(function(m){ if(m.clienteId === sale.id){ m.clienteId = queda.id; m._ts = m._ts || Date.now(); } });
  var cambioInv = false;
  state.inventario.forEach(function(p){ if(p.reserva && p.reserva.clienteId === sale.id){ p.reserva.clienteId = queda.id; p.reserva.clienteNombre = queda.nombre; cambioInv = true; } });
  if(!telDe(queda) && telDe(sale)) queda.tel = telDe(sale);
  if(sale.notas) queda.notas = [queda.notas, sale.notas].filter(Boolean).join(' · ');
  if(!queda.producto && sale.producto) queda.producto = sale.producto;
  // un solo numero de cliente: se queda el mas antiguo de los dos
  var na = numeroCodigo(queda.codigo), nb = numeroCodigo(sale.codigo);
  if(nb && (!na || nb < na)) queda.codigo = sale.codigo;
  queda._ts = Date.now();
  var i = idxCliente(sale.id); if(i !== -1) state.clientes.splice(i, 1);
  save('movimientos'); if(cambioInv) save('inventario'); save('clientes');
  cuentas.forEach(function(cu){ if(window.vincularCuentaWeb) window.vincularCuentaWeb(cu.uid, queda.id); });
  renderClientes();
}

// ---------- helpers que usan otras pantallas ----------
function saldoPendienteCliente(clienteId){
  if(!clienteId) return 0;
  return state.inventario.filter(function(p){ return p.estado === 'reservado' && p.reserva && p.reserva.clienteId === clienteId; }).reduce(function(a, p){ return a + saldoPendienteReserva(p); }, 0);
}
function totalCompradoCliente(clienteId){
  if(!clienteId) return 0;
  return state.movimientos.filter(function(m){ return (m.tipo === 'venta' || m.tipo === 'abono') && m.clienteId === clienteId; }).reduce(function(a, m){ return a + (Number(m.monto) || 0); }, 0);
}
// al tocar WhatsApp desde la lista queda registrado el contacto de hoy (sin abrir la ficha)
function marcarContactadoSilencioso(id){
  var i = idxCliente(id); if(i === -1) return;
  var hoy = new Date().toLocaleDateString('es-MX');
  if(state.clientes[i].ultimoContacto === hoy) return;
  state.clientes[i].ultimoContacto = hoy; state.clientes[i]._ts = Date.now();
  save('clientes');
  setTimeout(renderClientes, 300);
}

function eliminarCliente(id){
  var i = idxCliente(id);
  if(i === -1){ renderClientes(); return; }
  var c = state.clientes[i];
  // poka-yoke: un cliente con un reloj apartado tiene dinero pendiente; primero se cancela o completa el apartado
  var apartados = state.inventario.filter(function(p){ return p.estado === 'reservado' && p.reserva && p.reserva.clienteId === id; });
  if(apartados.length){ alert(c.nombre + ' tiene ' + apartados.length + ' reloj' + (apartados.length === 1 ? '' : 'es') + ' apartado' + (apartados.length === 1 ? '' : 's') + ' (' + apartados.map(function(p){ return p.nombre; }).join(', ') + '). Completa o cancela el apartado antes de eliminarlo.'); return; }
  var compras = totalCompradoCliente(id);
  if(!confirm('¿Eliminar a ' + c.nombre + '?' + (compras > 0 ? '\n\nHa comprado ' + dinero(compras) + ': sus ventas se quedan en Finanzas pero ya no apareceran en su ficha.' : '') + '\n\nNo se puede deshacer.')) return;
  i = idxCliente(id);
  if(i === -1){ renderClientes(); return; }
  state.clientes.splice(i, 1); save('clientes'); renderClientes();
}

function poblarSelectClientes(selectId, valorActual){
  var sel = el(selectId);
  if(!sel) return;
  var actual = valorActual !== undefined ? valorActual : sel.value;
  sel.innerHTML = '<option value="">Sin cliente registrado</option>' + state.clientes.slice().sort(function(a, b){ return (a.nombre || '').localeCompare(b.nombre || ''); }).map(function(c){
    return '<option value="' + esc(c.id) + '">' + (c.codigo ? esc(c.codigo) + ' · ' : '') + esc(c.nombre) + (telDe(c) ? ' · ' + esc(telDe(c)) : '') + '</option>';
  }).join('');
  if(actual) sel.value = actual;
}

export { abrirFormCliente, cancelarEdicionCliente, editarCliente, eliminarCliente, poblarSelectClientes, registrarCliente, renderClientes, renderStatsClientes, saldoPendienteCliente, setFiltroCliente, telefonoPanama, totalCompradoCliente, whatsappLink };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { abrirFormCliente, cancelarEdicionCliente, editarCliente, eliminarCliente, marcarContactadoSilencioso, registrarCliente, renderClientes, setFiltroCliente, unirClientes, validarCliente });
