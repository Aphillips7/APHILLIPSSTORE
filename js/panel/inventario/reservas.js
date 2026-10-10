import { poblarSelectClientes } from '../clientes/clientes.js';
import { renderInicio } from '../inicio.js';
import { cerrarModal } from './detalle.js';
import { renderInventario } from './lista.js';
import { avisarError, cambiarEstadoSeguro } from './transacciones.js';
import { idAleatorio, idxInv, invNoExiste, save, state } from '../state.js';
import { saldoPendienteReserva, totalAbonadoReserva } from '../../products.js';

var _reservaModalIdx=null;
function abrirReservaModal(id){
  var i=idxInv(id);
  if(i===-1){ invNoExiste(); return; }
  _reservaModalIdx=id;var p=state.inventario[i];
  poblarSelectClientes('reserva-cliente');
  document.getElementById('reserva-modal-nombre').textContent=p.nombre+(p.sku?' · Ref. '+p.sku:'');
  document.getElementById('reserva-precio').value=p.precio||'';
  document.getElementById('reserva-abono').value='';
  document.getElementById('reserva-overlay').classList.add('open');
}
function cerrarReservaModal(){document.getElementById('reserva-overlay').classList.remove('open');_reservaModalIdx=null;renderInventario();}
async function confirmarReserva(){
  if(_reservaModalIdx===null)return;
  var id=_reservaModalIdx;
  var clienteId=document.getElementById('reserva-cliente').value;
  if(!clienteId){alert('Selecciona el cliente que reserva este reloj.');return;}
  var cliente=state.clientes.find(function(c){return c.id===clienteId;});
  var precioAcordado=parseFloat(document.getElementById('reserva-precio').value);
  if(!precioAcordado||precioAcordado<=0){alert('Ingresa el precio acordado.');return;}
  var abono=parseFloat(document.getElementById('reserva-abono').value)||0;
  if(abono<0||abono>precioAcordado){alert('El abono no puede ser mayor al precio acordado.');return;}
  var metodoPago=document.getElementById('reserva-metodo').value;
  var i=idxInv(id);
  if(i===-1){ invNoExiste(); cerrarReservaModal(); return; }
  var p=state.inventario[i];
  var hoy=new Date().toLocaleDateString('es-MX');
  var reserva={clienteId:clienteId,clienteNombre:cliente.nombre,precioAcordado:precioAcordado,fechaInicio:hoy,abonos: abono>0?[{monto:abono,fecha:hoy,metodoPago:metodoPago}]:[]};
  try{ await cambiarEstadoSeguro(id, p.estado, {estado:'reservado', reserva:reserva}); }
  catch(e){ avisarError(e); cerrarReservaModal(); return; }
  i=idxInv(id);
  if(i===-1){ invNoExiste(); cerrarReservaModal(); return; }
  p=state.inventario[i];
  p.estado='reservado';
  p.reserva=reserva;
  save('inventario');
  if(abono>0){
    state.movimientos.unshift({id:idAleatorio('mov'),_ts:Date.now(),tipo:'abono',desc:p.nombre+(p.sku?' · Ref. '+p.sku:'')+' · Abono de '+cliente.nombre,monto:abono,canal:'abono',metodoPago:metodoPago,costo:0,clienteId:clienteId,clienteNombre:cliente.nombre,fecha:hoy});
    save('movimientos');
  }
  cerrarReservaModal();renderInicio();
}

var _abonoModalIdx=null;
function abrirAbonoModal(id){
  var i=idxInv(id);
  if(i===-1){ invNoExiste(); return; }
  _abonoModalIdx=id;var p=state.inventario[i];
  document.getElementById('abono-modal-info').textContent=p.nombre+' · '+p.reserva.clienteNombre+' · Saldo pendiente: $'+saldoPendienteReserva(p).toLocaleString();
  document.getElementById('abono-monto').value='';
  document.getElementById('abono-overlay').classList.add('open');
}
function cerrarAbonoModal(){document.getElementById('abono-overlay').classList.remove('open');_abonoModalIdx=null;}
function confirmarAbono(){
  if(_abonoModalIdx===null)return;
  var i=idxInv(_abonoModalIdx);
  if(i===-1){ invNoExiste(); cerrarAbonoModal(); return; }
  var p=state.inventario[i];
  var monto=parseFloat(document.getElementById('abono-monto').value);
  var saldo=saldoPendienteReserva(p);
  if(!monto||monto<=0){alert('Ingresa el monto del abono.');return;}
  if(monto>saldo){alert('Ese monto es mayor al saldo pendiente ($'+saldo.toLocaleString()+'). Si quiere completar la venta, usa "Completar venta".');return;}
  var metodoPago=document.getElementById('abono-metodo').value;
  var hoy=new Date().toLocaleDateString('es-MX');
  p.reserva.abonos.push({monto:monto,fecha:hoy,metodoPago:metodoPago});
  save('inventario');
  state.movimientos.unshift({id:idAleatorio('mov'),_ts:Date.now(),tipo:'abono',desc:p.nombre+(p.sku?' · Ref. '+p.sku:'')+' · Abono de '+p.reserva.clienteNombre,monto:monto,canal:'abono',metodoPago:metodoPago,costo:0,clienteId:p.reserva.clienteId,clienteNombre:p.reserva.clienteNombre,fecha:hoy});
  save('movimientos');
  cerrarAbonoModal();
  cerrarModal();
  renderInventario();renderInicio();
}

async function completarVentaReserva(id){
  var i=idxInv(id);
  if(i===-1){ invNoExiste(); cerrarModal(); return; }
  var p=state.inventario[i];
  if(!p.reserva)return;
  var saldo=saldoPendienteReserva(p);
  if(!confirm('Completar la venta de '+p.nombre+' a '+p.reserva.clienteNombre+' por el precio acordado de $'+p.reserva.precioAcordado.toLocaleString()+(saldo>0?(' (falta cobrar $'+saldo.toLocaleString()+')'):' (ya esta pagado por completo')+'?')) return;
  var hoy=new Date().toLocaleDateString('es-MX');
  try{ await cambiarEstadoSeguro(id, p.estado, {estado:'vendido', precioVenta:p.reserva.precioAcordado, fechaVenta:hoy}, ['reserva']); }
  catch(e){ avisarError(e); cerrarModal(); renderInventario(); return; }
  // "p" conserva los datos de la reserva leidos antes de confirmar con la nube
  if(saldo>0){
    state.movimientos.unshift({id:idAleatorio('mov'),_ts:Date.now(),tipo:'venta',desc:p.nombre+(p.sku?' · Ref. '+p.sku:'')+' · Saldo final de '+p.reserva.clienteNombre,monto:saldo,canal:'directo',metodoPago:'',costo:p.costoTotal||0,precioObjetivo:p.precio||0,clienteId:p.reserva.clienteId,clienteNombre:p.reserva.clienteNombre,fecha:hoy});
  } else {
    state.movimientos.unshift({id:idAleatorio('mov'),_ts:Date.now(),tipo:'venta',desc:p.nombre+(p.sku?' · Ref. '+p.sku:'')+' · Venta completada con '+p.reserva.clienteNombre,monto:0,canal:'directo',metodoPago:'',costo:p.costoTotal||0,precioObjetivo:p.precio||0,clienteId:p.reserva.clienteId,clienteNombre:p.reserva.clienteNombre,fecha:hoy,_soloRegistro:true});
  }
  save('movimientos');
  i=idxInv(id);
  if(i!==-1){
    var item=state.inventario[i];
    item.estado='vendido';item.precioVenta=p.reserva.precioAcordado;item.fechaVenta=hoy;
    delete item.reserva;
    save('inventario');
  }
  cerrarModal();renderInventario();renderInicio();
}

async function cancelarReserva(id){
  var i=idxInv(id);
  if(i===-1){ invNoExiste(); cerrarModal(); return; }
  var p=state.inventario[i];
  if(!p.reserva)return;
  if(!confirm('¿Cancelar la reserva de este reloj? El reloj volvera a estar disponible.'))return;
  var totalAbonado=totalAbonadoReserva(p);
  var clienteIdRes=p.reserva.clienteId,clienteNombreRes=p.reserva.clienteNombre;
  var seDevolvio=false;
  var devolver=totalAbonado>0 && confirm('Se recibieron $'+totalAbonado.toLocaleString()+' en abono de '+p.reserva.clienteNombre+'.\n\nPulsa Aceptar para DEVOLVER ese dinero al cliente (se registra como gasto).\nPulsa Cancelar para QUEDARTE con el abono (no se devuelve, el dinero ya registrado se queda).');
  try{ await cambiarEstadoSeguro(id, p.estado, {estado:'disponible'}, ['reserva']); }
  catch(e){ avisarError(e); cerrarModal(); renderInventario(); return; }
  // "p" conserva los datos de la reserva leidos antes de confirmar con la nube
  if(totalAbonado>0){
    if(devolver){
      seDevolvio=true;
      state.movimientos.unshift({id:idAleatorio('mov'),_ts:Date.now(),tipo:'gasto',desc:'Devolucion de abono · '+p.reserva.clienteNombre+' · '+p.nombre,monto:totalAbonado,canal:'reembolso',categoria:'Reembolso',metodoPago:'',costo:0,clienteId:p.reserva.clienteId,clienteNombre:p.reserva.clienteNombre,fecha:new Date().toLocaleDateString('es-MX')});
      save('movimientos');
    }
  }
  if(clienteIdRes){
    state.movimientos.unshift({id:idAleatorio('mov'),_ts:Date.now(),tipo:'reserva_cancelada',desc:p.nombre+(p.sku?' · Ref. '+p.sku:'')+(totalAbonado>0?(seDevolvio?' · Abono devuelto':' · Abono retenido'):''),monto:0,canal:'reserva_cancelada',clienteId:clienteIdRes,clienteNombre:clienteNombreRes,fecha:new Date().toLocaleDateString('es-MX')});
    save('movimientos');
  }
  i=idxInv(id);
  if(i!==-1){
    state.inventario[i].estado='disponible';
    delete state.inventario[i].reserva;
    save('inventario');
  }
  cerrarModal();renderInventario();renderInicio();
}

export { _abonoModalIdx, _reservaModalIdx, abrirAbonoModal, abrirReservaModal, cancelarReserva, cerrarAbonoModal, cerrarReservaModal, completarVentaReserva, confirmarAbono, confirmarReserva };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { abrirAbonoModal, cancelarReserva, cerrarAbonoModal, cerrarReservaModal, completarVentaReserva, confirmarAbono, confirmarReserva });
