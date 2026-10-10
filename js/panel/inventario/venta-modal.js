// =================== VENTA MODAL ===================
import { poblarSelectClientes } from '../clientes/clientes.js';
import { renderInicio } from '../inicio.js';
import { renderInventario } from './lista.js';
import { avisarError, cambiarEstadoSeguro } from './transacciones.js';
import { idAleatorio, idxInv, invNoExiste, save, state } from '../state.js';

var _ventaModalIdx=null;
function abrirVentaModal(id){
  var i=idxInv(id);
  if(i===-1){ invNoExiste(); return; }
  _ventaModalIdx=id;var p=state.inventario[i];
  poblarSelectClientes('venta-modal-cliente');
  document.getElementById('venta-modal-nombre').textContent=p.nombre+(p.sku?' · Ref. '+p.sku:'');
  document.getElementById('venta-modal-costo').textContent='$'+(p.costoTotal||0).toLocaleString();
  var precioEl=document.getElementById('venta-modal-precio');
  precioEl.value=p.precio||'';
  document.getElementById('venta-modal-preview').style.display='none';
  document.getElementById('venta-overlay').classList.add('open');
  setTimeout(()=>precioEl.focus(),100);
  precioEl.oninput=()=>actualizarVentaModalPreview(p.costoTotal||0);
  if(p.precio)actualizarVentaModalPreview(p.costoTotal||0);
}
function actualizarVentaModalPreview(costo){
  var precio=parseFloat(document.getElementById('venta-modal-precio').value)||0;
  var ganancia=precio-costo;var prev=document.getElementById('venta-modal-preview');
  if(precio>0){
    prev.style.display='block';
    function sf(id,v){var el=document.getElementById(id);if(el)el.textContent='$'+Math.round(Math.max(0,v)).toLocaleString();}
    sf('vm-reinv',ganancia*0.4);sf('vm-personal',ganancia*0.3);sf('vm-fondo',ganancia*0.3);sf('vm-ganancia',ganancia);
    document.getElementById('vm-ganancia').style.color=ganancia>=0?'var(--green)':'var(--red)';
  } else {prev.style.display='none';}
}
function cerrarVentaModal(){document.getElementById('venta-overlay').classList.remove('open');_ventaModalIdx=null;renderInventario();}
async function confirmarVentaModal(){
  if(_ventaModalIdx===null)return;
  var id=_ventaModalIdx;
  var precio=parseFloat(document.getElementById('venta-modal-precio').value);
  if(!precio||precio<=0){document.getElementById('venta-modal-precio').style.borderColor='var(--red)';document.getElementById('venta-modal-precio').focus();return;}
  var canal=document.getElementById('venta-modal-canal').value;
  var metodoPago=document.getElementById('venta-modal-metodo')?document.getElementById('venta-modal-metodo').value:'';
  var clienteId=document.getElementById('venta-modal-cliente')?document.getElementById('venta-modal-cliente').value:'';
  var cliente=clienteId?state.clientes.find(c=>c.id===clienteId):null;
  var i=idxInv(id);
  if(i===-1){ invNoExiste(); cerrarVentaModal(); return; }
  var p=state.inventario[i];
  var fechaVenta=new Date().toLocaleDateString('es-MX');
  try{ await cambiarEstadoSeguro(id, p.estado, {estado:'vendido', precioVenta:precio, fechaVenta:fechaVenta}); }
  catch(e){ avisarError(e); cerrarVentaModal(); return; }
  i=idxInv(id);
  if(i===-1){ invNoExiste(); cerrarVentaModal(); return; }
  state.inventario[i].estado='vendido';state.inventario[i].precioVenta=precio;state.inventario[i].fechaVenta=fechaVenta;
  save('inventario');
  state.movimientos.unshift({id:idAleatorio('mov'),_ts:Date.now(),tipo:'venta',desc:p.nombre+(p.sku?' · Ref. '+p.sku:''),monto:precio,canal,metodoPago:metodoPago,costo:p.costoTotal||0,precioObjetivo:p.precio||0,clienteId:clienteId||null,clienteNombre:cliente?cliente.nombre:'',fecha:new Date().toLocaleDateString('es-MX')});
  save('movimientos');
  cerrarVentaModal();renderInicio();
}

export { _ventaModalIdx, abrirVentaModal, actualizarVentaModalPreview, cerrarVentaModal, confirmarVentaModal };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { cerrarVentaModal, confirmarVentaModal });
