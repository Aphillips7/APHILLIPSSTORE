import { autoRegistrarCompraInv } from '../finanzas/registrar-compra.js';
import { renderInicio } from '../inicio.js';
import { cerrarModal } from './detalle.js';
import { previewFoto } from './fotos.js';
import { renderInventario } from './lista.js';
import { idAleatorio, idxInv, invNoExiste, save, state } from '../state.js';

function toggleFormulario(forceOpen){
  var wrapper=document.getElementById('inv-form-wrapper');
  var btn=document.getElementById('btn-registrar');
  if(!wrapper)return;
  var isHidden=wrapper.style.display==='none'||wrapper.style.display==='';
  var open=forceOpen!==undefined?forceOpen:isHidden;
  wrapper.style.display=open?'block':'none';
  if(btn)btn.textContent=open?'Cerrar formulario':'+ Registrar unidad';
  if(open)setTimeout(()=>wrapper.scrollIntoView({behavior:'smooth',block:'start'}),80);
}
function calcularMargenPreview(){
  var costo=parseFloat(document.getElementById('inv-costo').value)||0;
  var imp=parseFloat(document.getElementById('inv-importacion').value)||0;
  var precio=parseFloat(document.getElementById('inv-precio').value)||0;
  var precioMin=parseFloat(document.getElementById('inv-precio-min')?document.getElementById('inv-precio-min').value:0)||0;
  var total=costo+imp;
  document.getElementById('inv-preview-costo').textContent='$'+total.toFixed(2);
  if(total>0&&precio>0){
    var margen=Math.round(((precio-total)/precio)*100);
    var ganancia=precio-total;
    var elM=document.getElementById('inv-preview-margen');var elG=document.getElementById('inv-preview-ganancia');
    if(elM){elM.textContent=margen+'%';elM.style.color=margen>=30?'var(--green)':margen>=15?'var(--accent)':'var(--red)';}
    if(elG){elG.textContent='$'+ganancia.toFixed(2);elG.style.color=ganancia>0?'var(--green)':'var(--red)';}
  } else {
    ['inv-preview-margen','inv-preview-ganancia'].forEach(id=>{var el=document.getElementById(id);if(el){el.textContent='--';el.style.color='var(--muted)';}});
  }
  var minField=document.getElementById('inv-precio-min');
  if(minField){var pm=parseFloat(minField.value)||0;minField.style.borderColor=(pm>0&&total>0&&pm<total)?'var(--red)':'';}
}
function agregarProducto(){
  var editIdx=document.getElementById('inv-edit-index').value;
  var nombre=document.getElementById('inv-nombre').value.trim();
  if(!nombre){alert('Escribe el modelo del producto.');return;}
  var costo=parseFloat(document.getElementById('inv-costo').value)||0;
  var imp=parseFloat(document.getElementById('inv-importacion').value)||0;
  var costoTotal=costo+imp;
  var precio=parseFloat(document.getElementById('inv-precio').value)||0;
  var estado=document.getElementById('inv-estado').value;
  var margen=costoTotal>0&&precio>0?Math.round(((precio-costoTotal)/precio)*100):0;
  var item={
    nombre,
    sku:document.getElementById('inv-sku').value.trim(),
    coleccion:document.getElementById('inv-coleccion').value.trim(),
    genero:document.getElementById('inv-genero').value,
    mm:document.getElementById('inv-mm').value.trim(),
    materialCaja:document.getElementById('inv-material-caja').value.trim(),
    materialCorrea:document.getElementById('inv-material-correa').value.trim(),
    colorEsfera:document.getElementById('inv-color-esfera').value.trim(),
    movimiento:document.getElementById('inv-movimiento').value,
    agua:document.getElementById('inv-agua').value.trim(),
    cristal:document.getElementById('inv-cristal').value.trim(),
    color:document.getElementById('inv-color').value.trim(),
    notas:document.getElementById('inv-notas').value.trim(),
    ocultoCatalogo:document.getElementById('inv-oculto-catalogo').checked,
    serie:document.getElementById('inv-serie').value.trim(),
    proveedor:document.getElementById('inv-proveedor').value.trim(),
    paqueteria:document.getElementById('inv-paqueteria').value.trim(),
    tracking:document.getElementById('inv-tracking').value.trim(),
    eta:document.getElementById('inv-eta').value,
    costo, importacion:imp, costoTotal, precio,
    precioMin:parseFloat(document.getElementById('inv-precio-min').value)||0,
    margen, estado,
    foto:document.getElementById('inv-foto').value.trim(),
    fecha:new Date().toLocaleDateString('es-MX')
  };
  var esEdicion=editIdx!=='';
  var idxActual=esEdicion?idxInv(editIdx):-1;
  if(esEdicion&&idxActual===-1){ invNoExiste(); return; }
  var estadoAntes=esEdicion?state.inventario[idxActual].estado:null;
  if(esEdicion){
    var existente=state.inventario[idxActual];
    item.id=existente.id; item._ts=existente._ts;
    if(existente.fecha)item.fecha=existente.fecha;
    if(existente.reserva)item.reserva=existente.reserva;
    if(existente.precioVenta!==undefined)item.precioVenta=existente.precioVenta;
    if(existente.fechaVenta)item.fechaVenta=existente.fechaVenta;
    state.inventario[idxActual]=item;
  }else{
    item.id=idAleatorio('inv'); item._ts=Date.now();
    state.inventario.unshift(item);
  }
  save('inventario');
  if(!esEdicion&&estado==='disponible'){
    autoRegistrarCompraInv(item);
  }
  limpiarFormulario();
  renderInventario();
  renderInicio();
}
function limpiarFormulario(){
  resetCamposFormulario();
  toggleFormulario(false);
}
function resetCamposFormulario(){
  ['inv-nombre','inv-sku','inv-coleccion','inv-mm','inv-material-caja','inv-material-correa','inv-color-esfera','inv-agua','inv-cristal','inv-color','inv-notas','inv-serie','inv-proveedor','inv-paqueteria','inv-tracking','inv-eta','inv-costo','inv-importacion','inv-precio','inv-precio-min','inv-foto'].forEach(id=>{var el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('inv-oculto-catalogo').checked=false;
  document.getElementById('inv-genero').value='hombre';
  document.getElementById('inv-movimiento').value='';
  document.getElementById('inv-estado').value='disponible';
  document.getElementById('inv-edit-index').value='';
  var fp=document.getElementById('inv-foto-preview');if(fp)fp.textContent='';
  ['inv-preview-margen','inv-preview-ganancia'].forEach(id=>{var el=document.getElementById(id);if(el){el.textContent='--';el.style.color='var(--muted)';}});
  document.getElementById('inv-preview-costo').textContent='$0.00';
  document.getElementById('inv-form-title').textContent='Registrar unidad';
  document.getElementById('inv-submit-btn').textContent='Registrar unidad';
  var cb=document.getElementById('inv-cancel-btn');if(cb)cb.style.display='none';
}
function abrirFormularioNuevo(){
  var wrapper=document.getElementById('inv-form-wrapper');
  var yaAbierto=wrapper&&wrapper.style.display==='block';
  resetCamposFormulario();
  toggleFormulario(!yaAbierto);
}
function cancelarEdicion(){limpiarFormulario();}
function editarProducto(id){
  var i=idxInv(id);
  if(i===-1){ invNoExiste(); return; }
  var p=state.inventario[i];
  var fields={'inv-nombre':p.nombre,'inv-sku':p.sku,'inv-coleccion':p.coleccion,'inv-mm':p.mm,'inv-material-caja':p.materialCaja,'inv-material-correa':p.materialCorrea,'inv-color-esfera':p.colorEsfera,'inv-agua':p.agua,'inv-cristal':p.cristal,'inv-color':p.color,'inv-notas':p.notas,'inv-serie':p.serie,'inv-proveedor':p.proveedor,'inv-paqueteria':p.paqueteria,'inv-tracking':p.tracking,'inv-eta':p.eta,'inv-costo':p.costo,'inv-importacion':p.importacion,'inv-precio':p.precio,'inv-precio-min':p.precioMin||'','inv-foto':p.foto};
  Object.entries(fields).forEach(([id,v])=>{var el=document.getElementById(id);if(el)el.value=v||'';});
  document.getElementById('inv-oculto-catalogo').checked=!!p.ocultoCatalogo;
  document.getElementById('inv-genero').value=p.genero||'hombre';
  document.getElementById('inv-movimiento').value=p.movimiento||'';
  document.getElementById('inv-estado').value=p.estado||'disponible';
  document.getElementById('inv-edit-index').value=p.id;
  document.getElementById('inv-form-title').textContent='Editar unidad';
  document.getElementById('inv-submit-btn').textContent='Guardar cambios';
  var cb=document.getElementById('inv-cancel-btn');if(cb)cb.style.display='inline-flex';
  calcularMargenPreview();
  if(p.foto)previewFoto();
  toggleFormulario(true);
  cerrarModal();
}

function duplicarProducto(id){
  var i=idxInv(id);
  if(i===-1){ invNoExiste(); return; }
  var p=state.inventario[i];
  resetCamposFormulario();
  // Copiamos las especificaciones del modelo (lo que no cambia entre unidades)
  var copiar={'inv-nombre':p.nombre,'inv-sku':p.sku,'inv-coleccion':p.coleccion,'inv-mm':p.mm,
    'inv-material-caja':p.materialCaja,'inv-material-correa':p.materialCorrea,'inv-color-esfera':p.colorEsfera,
    'inv-agua':p.agua,'inv-cristal':p.cristal,'inv-color':p.color,'inv-notas':p.notas,
    'inv-proveedor':p.proveedor,'inv-precio':p.precio,'inv-precio-min':p.precioMin||'','inv-foto':p.foto};
  Object.entries(copiar).forEach(function(e){var el=document.getElementById(e[0]);if(el)el.value=e[1]||'';});
  document.getElementById('inv-genero').value=p.genero||'hombre';
  document.getElementById('inv-movimiento').value=p.movimiento||'';
  // Lo que SI es propio de cada unidad queda en blanco: costo, serie, tracking
  document.getElementById('inv-estado').value='transito';
  document.getElementById('inv-edit-index').value='';
  document.getElementById('inv-form-title').textContent='Nueva unidad de '+(p.nombre||'este modelo');
  document.getElementById('inv-submit-btn').textContent='Registrar unidad';
  var cb=document.getElementById('inv-cancel-btn');if(cb)cb.style.display='inline-flex';
  if(p.foto)previewFoto();
  calcularMargenPreview();
  cerrarModal();
  toggleFormulario(true);
  var cEl=document.getElementById('inv-costo');
  if(cEl){ cEl.focus(); }
  window.scrollTo({top:0,behavior:'smooth'});
}

export { abrirFormularioNuevo, agregarProducto, calcularMargenPreview, cancelarEdicion, duplicarProducto, editarProducto, limpiarFormulario, resetCamposFormulario, toggleFormulario };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { abrirFormularioNuevo, agregarProducto, calcularMargenPreview, cancelarEdicion, duplicarProducto, editarProducto });
