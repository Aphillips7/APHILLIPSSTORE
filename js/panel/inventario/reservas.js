import { poblarSelectClientes } from '../clientes/clientes.js';
import { registrarCompraSiFalta } from '../finanzas/registrar-compra.js';
import { renderInicio } from '../inicio.js';
import { cerrarModal } from './detalle.js';
import { renderInventario } from './lista.js';
import { avisarError, cambiarEstadoSeguro } from './transacciones.js';
import { idAleatorio, idxInv, invNoExiste, save, state } from '../state.js';
import { saldoPendienteReserva, totalAbonadoReserva } from '../../products.js';

// Ventas > Apartados y Finanzas > Por cobrar se redibujan solas despues de abonar, completar o cancelar
function refrescarVentas(){ try{ if(window.refrescarVentas) window.refrescarVentas(); }catch(e){} }

var _reservaModalIdx=null;
function abrirReservaModal(id){
  var i=idxInv(id);
  if(i===-1){ invNoExiste(); return; }
  _reservaModalIdx=id;var p=state.inventario[i];
  poblarSelectClientes('reserva-cliente');
  document.getElementById('reserva-modal-nombre').textContent=p.nombre+(p.sku?' · Ref. '+p.sku:'');
  document.getElementById('reserva-precio').value=p.precio||'';
  document.getElementById('reserva-abono').value='';
  var pl=document.getElementById('reserva-plazo'); if(pl) pl.value='30';
  document.getElementById('reserva-overlay').classList.add('open');
}
function cerrarReservaModal(){document.getElementById('reserva-overlay').classList.remove('open');_reservaModalIdx=null;renderInventario();}
var _ocupado=false;   // evita registrar dos veces lo mismo con un doble toque
async function confirmarReserva(){
  if(_reservaModalIdx===null||_ocupado)return;
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
  // estadoAnterior: si se cancela el apartado, el reloj vuelve a ese estado (un reloj en transito no debe
  // volver como "disponible")
  if((p.costoTotal||0)>0&&precioAcordado<p.costoTotal&&!confirm('El precio acordado ($'+precioAcordado.toLocaleString()+') es MENOR que el costo ($'+p.costoTotal.toLocaleString()+'). ¿Apartarlo de todas formas?')) return;
  // plazo para completar el pago (fecha limite): se ve en Ventas > Apartados y en Finanzas > Por cobrar
  var plazo=parseInt((document.getElementById('reserva-plazo')||{}).value,10);
  if(!(plazo>=1&&plazo<=90)) plazo=30;
  var lim=new Date(); lim.setDate(lim.getDate()+plazo);
  var reserva={clienteId:clienteId,clienteNombre:cliente.nombre,precioAcordado:precioAcordado,fechaInicio:hoy,fechaLimite:lim.toLocaleDateString('es-MX'),estadoAnterior:p.estado,abonos: abono>0?[{monto:abono,fecha:hoy,metodoPago:metodoPago}]:[]};
  _ocupado=true;
  try{ await cambiarEstadoSeguro(id, p.estado, {estado:'reservado', reserva:reserva}); }
  catch(e){ _ocupado=false; avisarError(e); cerrarReservaModal(); return; }
  _ocupado=false;
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
  cerrarReservaModal();renderInicio();refrescarVentas();
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
  if(_abonoModalIdx===null||_ocupado)return;
  var i=idxInv(_abonoModalIdx);
  if(i===-1){ invNoExiste(); cerrarAbonoModal(); return; }
  var p=state.inventario[i];
  var monto=parseFloat(document.getElementById('abono-monto').value);
  var saldo=saldoPendienteReserva(p);
  if(!monto||monto<=0){alert('Ingresa el monto del abono.');return;}
  if(monto>saldo){alert('Ese monto es mayor al saldo pendiente ($'+saldo.toLocaleString()+'). Si quiere completar la venta, usa "Completar venta".');return;}
  var metodoPago=document.getElementById('abono-metodo').value;
  if(!confirm('Registrar abono de $'+monto.toLocaleString()+' ('+metodoPago+') de '+p.reserva.clienteNombre+'.\nSaldo despues del abono: $'+(saldo-monto).toLocaleString()+'.')) return;
  var hoy=new Date().toLocaleDateString('es-MX');
  p.reserva.abonos.push({monto:monto,fecha:hoy,metodoPago:metodoPago});
  save('inventario');
  state.movimientos.unshift({id:idAleatorio('mov'),_ts:Date.now(),tipo:'abono',desc:p.nombre+(p.sku?' · Ref. '+p.sku:'')+' · Abono de '+p.reserva.clienteNombre,monto:monto,canal:'abono',metodoPago:metodoPago,costo:0,clienteId:p.reserva.clienteId,clienteNombre:p.reserva.clienteNombre,fecha:hoy});
  save('movimientos');
  cerrarAbonoModal();
  cerrarModal();
  renderInventario();renderInicio();refrescarVentas();
}

// forma de pago escrita a mano: se acepta el numero o la palabra, y si no se entiende se vuelve a preguntar
// (antes cualquier error de dedo quedaba como "otro" y descuadraba "Saldo por metodo")
function pedirMetodoPago(texto){
  var LISTA=['efectivo','yappy','transferencia','tarjeta','otro'];
  var aviso='';
  for(;;){
    var r=prompt(aviso+texto+'\n\n1 efectivo · 2 yappy · 3 transferencia · 4 tarjeta · 5 otro\n(escribe el numero o la palabra)','2');
    if(r===null) return null;
    r=String(r).trim().toLowerCase();
    if(/^[1-5]$/.test(r)) return LISTA[+r-1];
    var m=LISTA.filter(function(x){ return x.indexOf(r)===0&&r.length>=2; });
    if(m.length===1) return m[0];
    aviso='No entendi "'+r+'". ';
  }
}
async function completarVentaReserva(id){
  if(_ocupado) return;
  var i=idxInv(id);
  if(i===-1){ invNoExiste(); cerrarModal(); return; }
  var p=state.inventario[i];
  if(!p.reserva)return;
  var saldo=saldoPendienteReserva(p);
  if(!confirm('Completar la venta de '+p.nombre+' a '+p.reserva.clienteNombre+' por el precio acordado de $'+p.reserva.precioAcordado.toLocaleString()+(saldo>0?(' (falta cobrar $'+saldo.toLocaleString()+')'):' (ya esta pagado por completo')+'?')) return;
  var hoy=new Date().toLocaleDateString('es-MX');
  // forma de pago del saldo, para que cuente en "Saldo por metodo" de Finanzas
  var metodoSaldo='';
  if(saldo>0){
    metodoSaldo=pedirMetodoPago('¿Cómo pagó el saldo de $'+saldo.toLocaleString()+'?');
    if(metodoSaldo===null) return;
  }
  _ocupado=true;
  try{ await cambiarEstadoSeguro(id, p.estado, {estado:'vendido', precioVenta:p.reserva.precioAcordado, fechaVenta:hoy}, ['reserva']); }
  catch(e){ _ocupado=false; avisarError(e); cerrarModal(); renderInventario(); return; }
  _ocupado=false;
  // "p" conserva los datos de la reserva leidos antes de confirmar con la nube
  if(saldo>0){
    state.movimientos.unshift({id:idAleatorio('mov'),_ts:Date.now(),tipo:'venta',desc:p.nombre+(p.sku?' · Ref. '+p.sku:'')+' · Saldo final de '+p.reserva.clienteNombre,monto:saldo,canal:'directo',metodoPago:metodoSaldo,costo:p.costoTotal||0,precioObjetivo:p.precio||0,clienteId:p.reserva.clienteId,clienteNombre:p.reserva.clienteNombre,fecha:hoy});
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
    registrarCompraSiFalta(item);
  }
  cerrarModal();renderInventario();renderInicio();refrescarVentas();
}

async function cancelarReserva(id){
  if(_ocupado) return;
  var i=idxInv(id);
  if(i===-1){ invNoExiste(); cerrarModal(); return; }
  var p=state.inventario[i];
  if(!p.reserva)return;
  var volverA=['disponible','transito','bajopedido'].indexOf(p.reserva.estadoAnterior)>=0?p.reserva.estadoAnterior:'disponible';
  var nombresEstado={disponible:'disponible',transito:'en tránsito',bajopedido:'bajo pedido'};
  if(!confirm('¿Cancelar la reserva de este reloj? El reloj volverá a estar '+nombresEstado[volverA]+'.'))return;
  var totalAbonado=totalAbonadoReserva(p);
  var clienteIdRes=p.reserva.clienteId,clienteNombreRes=p.reserva.clienteNombre;
  var seDevolvio=false;
  var devolver=totalAbonado>0 && confirm('Se recibieron $'+totalAbonado.toLocaleString()+' en abono de '+p.reserva.clienteNombre+'.\n\n¿Le DEVUELVES ese dinero?\nAceptar = SI, se lo devuelvo (se registra como gasto)\nCancelar = NO, me quedo con el abono');
  // poka-yoke: el boton Cancelar aqui significa "me quedo con el dinero", asi que se confirma el resumen final
  if(totalAbonado>0&&!confirm('Resumen:\n- El reloj vuelve a estar '+nombresEstado[volverA]+'.\n- Abono de $'+totalAbonado.toLocaleString()+': '+(devolver?'SE DEVUELVE al cliente (gasto).':'TE LO QUEDAS (no se devuelve).')+'\n\n¿Es correcto?')) return;
  _ocupado=true;
  try{ await cambiarEstadoSeguro(id, p.estado, {estado:volverA}, ['reserva']); }
  catch(e){ _ocupado=false; avisarError(e); cerrarModal(); renderInventario(); return; }
  _ocupado=false;
  // "p" conserva los datos de la reserva leidos antes de confirmar con la nube
  if(totalAbonado>0){
    if(devolver){
      seDevolvio=true;
      state.movimientos.unshift({id:idAleatorio('mov'),_ts:Date.now(),tipo:'gasto',desc:'Devolucion de abono · '+p.reserva.clienteNombre+' · '+p.nombre,monto:totalAbonado,canal:'reembolso',categoria:'Reembolso',metodoPago:((p.reserva.abonos||[])[0]||{}).metodoPago||'',costo:0,clienteId:p.reserva.clienteId,clienteNombre:p.reserva.clienteNombre,fecha:new Date().toLocaleDateString('es-MX')});
      save('movimientos');
    }
  }
  if(clienteIdRes){
    state.movimientos.unshift({id:idAleatorio('mov'),_ts:Date.now(),tipo:'reserva_cancelada',desc:p.nombre+(p.sku?' · Ref. '+p.sku:'')+(totalAbonado>0?(seDevolvio?' · Abono devuelto':' · Abono retenido'):''),monto:0,canal:'reserva_cancelada',clienteId:clienteIdRes,clienteNombre:clienteNombreRes,fecha:new Date().toLocaleDateString('es-MX')});
    save('movimientos');
  }
  i=idxInv(id);
  if(i!==-1){
    state.inventario[i].estado=volverA;
    delete state.inventario[i].reserva;
    save('inventario');
  }
  cerrarModal();renderInventario();renderInicio();refrescarVentas();
}

export { _abonoModalIdx, _reservaModalIdx, abrirAbonoModal, abrirReservaModal, cancelarReserva, cerrarAbonoModal, cerrarReservaModal, completarVentaReserva, confirmarAbono, confirmarReserva };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { abrirAbonoModal, cancelarReserva, cerrarAbonoModal, cerrarReservaModal, completarVentaReserva, confirmarAbono, confirmarReserva });
