// =================== FICHA DEL CLIENTE (rediseno fase 6) ===================
// Resumen (comprado, compras, ticket, ultima compra, saldo), mensaje de WhatsApp sugerido segun su momento,
// y linea de tiempo con todo lo que paso con el: alta, compras, abonos, apartados, pedidos web y contactos.
import { editarCliente, eliminarCliente, renderClientes, whatsappLink } from './clientes.js';
import { etiquetaPrincipal, mensajeSugerido, perfil, telDe } from './segmentos.js';
import { cerrarModal } from '../inventario/detalle.js';
import { dinero, esc, estadoHTML } from '../componentes.js';
import { finParseFecha } from '../finanzas/fechas.js';
import { fechaLimiteReserva } from '../finanzas/calculos.js';
import { idxCliente, save, state } from '../state.js';
import { saldoPendienteReserva } from '../../products.js';

const CANALES_CLI = { facebook: 'Facebook', whatsapp: 'WhatsApp', instagram: 'Instagram', directo: 'Directo', web: 'Tienda web' };

function marcarContactado(id){
  var i = idxCliente(id);
  if(i === -1) return;
  state.clientes[i].ultimoContacto = new Date().toLocaleDateString('es-MX');
  state.clientes[i]._ts = Date.now();
  save('clientes');
  verDetalleCliente(id);
  renderClientes();
}
function diasDesdeContacto(fechaStr){
  var d = finParseFecha(fechaStr);
  return d ? Math.floor((Date.now() - d.getTime()) / 86400000) : null;
}

function historialComprasCliente(clienteId){
  if(!clienteId) return [];
  return state.movimientos.filter(function(m){ return (m.tipo === 'venta' || m.tipo === 'abono' || m.tipo === 'reserva_cancelada') && m.clienteId === clienteId; }).sort(function(a, b){ return (b._ts || 0) - (a._ts || 0); });
}
// eventos de la linea de tiempo, del mas nuevo al mas viejo
function lineaDeTiempo(c){
  var ev = [];
  historialComprasCliente(c.id).forEach(function(m){
    var t = m.tipo === 'abono' ? ['info', 'Abono'] : m.tipo === 'reserva_cancelada' ? ['cancelado', 'Apartado cancelado'] : m._soloRegistro ? ['ok', 'Entregado'] : ['ok', 'Compra'];
    ev.push({ ts: m._ts || (finParseFecha(m.fecha) || 0).valueOf(), fecha: m.fecha, tipo: t[0], etiqueta: t[1], texto: m.desc, monto: m.tipo === 'reserva_cancelada' || m._soloRegistro ? null : m.monto });
  });
  state.inventario.filter(function(p){ return p.estado === 'reservado' && p.reserva && p.reserva.clienteId === c.id; }).forEach(function(p){
    var lim = fechaLimiteReserva(p);
    ev.push({ ts: (finParseFecha(p.reserva.fechaInicio) || 0).valueOf() + 1, fecha: p.reserva.fechaInicio, tipo: 'pendiente', etiqueta: 'Apartado', texto: p.nombre + ' · debe ' + dinero(saldoPendienteReserva(p)) + (lim ? ' · limite ' + lim.toLocaleDateString('es-MX') : '') });
  });
  (window.__pedidosWeb || []).filter(function(p){ return p.cuenta && p.cuenta.clienteId === c.id; }).forEach(function(p){
    ev.push({ ts: p.creado, fecha: new Date(p.creado).toLocaleDateString('es-MX'), tipo: p.estado === 'cancelado' ? 'cancelado' : p.estado === 'entregado' ? 'ok' : 'info', etiqueta: 'Pedido web', texto: p.numero + ' · ' + p.reloj + ' · ' + p.estado, monto: null });
  });
  if(c.ultimoContacto) ev.push({ ts: (finParseFecha(c.ultimoContacto) || 0).valueOf() + 2, fecha: c.ultimoContacto, tipo: 'info', etiqueta: 'Contacto', texto: 'Le escribiste' });
  if(c.fecha) ev.push({ ts: (finParseFecha(c.fecha) || 0).valueOf(), fecha: c.fecha, tipo: 'cancelado', etiqueta: 'Alta', texto: 'Registrado' + (c.canal ? ' desde ' + (CANALES_CLI[c.canal] || c.canal) : '') });
  return ev.sort(function(a, b){ return b.ts - a.ts; });
}

function dato(label, valor, clase){ return '<div class="ficha-dato"><span>' + label + '</span><b class="' + (clase || '') + '">' + valor + '</b></div>'; }
function verDetalleCliente(id){
  var i = idxCliente(id);
  if(i === -1){ alert('Este cliente ya no existe (puede que se haya eliminado en otro dispositivo).'); cerrarModal(); renderClientes(); return; }
  var c = state.clientes[i], pf = perfil(c), et = etiquetaPrincipal(pf), cid = esc(c.id);
  var msg = mensajeSugerido(pf), wa = whatsappLink(telDe(c), msg);
  var ev = lineaDeTiempo(c);
  document.getElementById('inv-modal-content').innerHTML =
    '<div class="ficha-cli">' +
      '<div class="ficha-cab"><div class="cli-avatar grande">' + esc((c.nombre || '?').trim().charAt(0).toUpperCase()) + '</div>' +
        '<div class="ficha-nombre"><h3>' + esc(c.nombre) + '</h3><span>' + esc([telDe(c), CANALES_CLI[c.canal] || c.canal, c.fecha ? 'desde ' + c.fecha : ''].filter(Boolean).join(' · ')) + '</span></div>' + estadoHTML(et[0], et[1]) + '</div>' +
      '<div class="ficha-datos">' +
        dato('Comprado', dinero(pf.total), pf.total ? 'pos' : '') + dato('Compras', String(pf.compras)) + dato('Ticket', pf.ticket ? dinero(pf.ticket) : '—') +
        dato('Ultima compra', pf.diasCompra === null ? '—' : 'hace ' + pf.diasCompra + ' d') + dato('Debe', dinero(pf.saldo), pf.saldo ? 'neg' : '') +
        dato('Contacto', pf.diasContacto === null ? 'sin registrar' : 'hace ' + pf.diasContacto + ' d') +
      '</div>' +
      (c.producto ? '<div class="ficha-nota"><b>Le interesa:</b> ' + esc(c.producto) + '</div>' : '') +
      (c.notas ? '<div class="ficha-nota">' + esc(c.notas) + '</div>' : '') +
      (wa ? '<div class="ficha-msg"><span class="eyebrow">Mensaje sugerido</span><p>' + esc(msg) + '</p>' +
        '<div class="acciones-fila"><a class="btn btn-gold btn-sm" href="' + wa + '" target="_blank" rel="noopener" onclick="marcarContactado(\'' + cid + '\')">Enviar por WhatsApp</a></div></div>' :
        '<div class="ficha-nota">Agrega su telefono para escribirle por WhatsApp con un mensaje sugerido.</div>') +
      '<div class="acciones-fila ficha-acc">' +
        '<button type="button" class="btn btn-outline btn-sm" onclick="marcarContactado(\'' + cid + '\')">Marcar contactado hoy</button>' +
        '<button type="button" class="btn btn-outline btn-sm" onclick="editarCliente(\'' + cid + '\')">Editar</button>' +
      '</div>' +
      '<div class="eyebrow" style="margin:18px 0 8px;">Linea de tiempo</div>' +
      (ev.length ? '<div class="timeline">' + ev.slice(0, 30).map(function(e){
        return '<div class="tl-item"><span class="tl-punto tl-' + e.tipo + '"></span><div class="tl-cuerpo"><div class="tl-cab">' + estadoHTML(e.tipo, e.etiqueta) + '<span class="tl-fecha">' + esc(e.fecha || '') + '</span>' + (e.monto != null ? '<b class="tl-monto">' + dinero(e.monto) + '</b>' : '') + '</div><div class="tl-texto">' + esc(e.texto) + '</div></div></div>';
      }).join('') + '</div>' + (ev.length > 30 ? '<div class="tenue-peq">y ' + (ev.length - 30) + ' movimientos mas antiguos (ver en Finanzas > Movimientos)</div>' : '') : '<div class="tenue-peq">Sin actividad todavia.</div>') +
    '</div>' +
    '<div class="ficha-pie">' +
      '<button type="button" class="btn btn-outline" style="flex:1;" onclick="cerrarModal()">Cerrar</button>' +
      '<button type="button" class="btn btn-danger" onclick="eliminarCliente(\'' + cid + '\');cerrarModal();">Eliminar cliente</button>' +
    '</div>';
  document.getElementById('inv-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

export { diasDesdeContacto, historialComprasCliente, marcarContactado, verDetalleCliente };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { marcarContactado, verDetalleCliente });
