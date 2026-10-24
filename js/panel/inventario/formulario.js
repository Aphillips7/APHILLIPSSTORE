import { autoRegistrarCompraInv } from '../finanzas/registrar-compra.js';
import { renderInicio } from '../inicio.js';
import { cerrarModal } from './detalle.js';
import { fotoCompartirFormulario, fotosFormulario, fotosSubiendo, jpgsFormulario, setFotosFormulario } from './fotos.js';
import { cargarFicha, fichaFormulario } from './ficha.js';
import { renderInventario } from './lista.js';
import { idAleatorio, idxInv, invNoExiste, save, state } from '../state.js';

// Cada seccion del formulario muestra cuantos de sus datos estan llenos (ej. "3/7")
function contarSecciones(){
  document.querySelectorAll('#inv-form-wrapper .inv-sec').forEach(function(sec){
    var campos = Array.prototype.filter.call(sec.querySelectorAll('input,select,textarea'), function(el){
      return el.type !== 'hidden' && el.type !== 'file' && el.type !== 'checkbox';
    });
    var llenos = campos.filter(function(el){ return String(el.value || '').trim() !== ''; }).length;
    var n = sec.querySelector('.inv-sec-n'); if(!n) return;
    n.textContent = !campos.length ? '' : campos.length === 1 ? (llenos ? 'Listo' : '') : llenos + '/' + campos.length;
    n.classList.toggle('completa', campos.length > 0 && llenos === campos.length);
  });
}
(function(){
  var w = document.getElementById('inv-form-wrapper');
  if(w){ w.addEventListener('input', contarSecciones); w.addEventListener('change', contarSecciones); }
})();
function toggleFormulario(forceOpen){
  var wrapper=document.getElementById('inv-form-wrapper');
  var btn=document.getElementById('btn-registrar');
  if(!wrapper)return;
  var isHidden=wrapper.style.display==='none'||wrapper.style.display==='';
  var open=forceOpen!==undefined?forceOpen:isHidden;
  wrapper.style.display=open?'block':'none';
  if(btn)btn.textContent=open?'Cerrar formulario':'+ Registrar unidad';
  if(open){ contarSecciones(); setTimeout(()=>wrapper.scrollIntoView({behavior:'smooth',block:'start'}),80); }
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
    if(elM){elM.textContent=margen+'%';elM.style.color=margen>=30?'var(--green)':margen>=15?'var(--amber)':'var(--red)';}
    if(elG){elG.textContent='$'+ganancia.toFixed(2);elG.style.color=ganancia>0?'var(--green)':'var(--red)';}
  } else {
    ['inv-preview-margen','inv-preview-ganancia'].forEach(id=>{var el=document.getElementById(id);if(el){el.textContent='--';el.style.color='var(--muted)';}});
  }
  var minField=document.getElementById('inv-precio-min');
  if(minField){var pm=parseFloat(minField.value)||0;minField.style.borderColor=(pm>0&&total>0&&pm<total)?'var(--red)':'';}
}
// ---------- poka-yoke: lo que no se puede guardar y lo que pide confirmacion ----------
// Marca el campo en rojo, lo abre y lo enfoca, para que se vea exactamente que corregir.
function marcarCampo(id, msg){
  var el=document.getElementById(id);
  if(el){
    var sec=el.closest('details'); if(sec) sec.open=true;
    el.style.borderColor='var(--red)';
    el.addEventListener('input', function q(){ el.style.borderColor=''; el.removeEventListener('input', q); });
    setTimeout(function(){ el.focus(); el.scrollIntoView({behavior:'smooth',block:'center'}); }, 30);
  }
  alert(msg);
  return false;
}
var PUBLICOS=['disponible','transito','bajopedido'];
function validarUnidad(item, esEdicion, estadoAntes){
  // 1) errores: no se guarda
  if(!item.nombre) return marcarCampo('inv-nombre','Escribe el modelo del reloj.');
  var nums=[['inv-costo',item.costo,'El costo'],['inv-importacion',item.importacion,'La importacion'],['inv-precio',item.precio,'El precio'],['inv-precio-min',item.precioMin,'El precio minimo']];
  for(var i=0;i<nums.length;i++) if(nums[i][1]<0) return marcarCampo(nums[i][0], nums[i][2]+' no puede ser negativo.');
  if((item.estado==='disponible'||item.estado==='transito')&&!(item.precio>0))
    return marcarCampo('inv-precio','Pon el precio de venta: un reloj "'+(item.estado==='disponible'?'Disponible':'En transito')+'" sin precio saldria a $0 en la tienda.');
  if(item.precioMin>0&&item.precio>0&&item.precioMin>item.precio)
    return marcarCampo('inv-precio-min','El precio minimo ($'+item.precioMin+') no puede ser mayor que el precio ($'+item.precio+').');
  if((item.estado==='vendido'||item.estado==='reservado')&&estadoAntes!==item.estado)
    return marcarCampo('inv-estado','Para marcarlo como "'+(item.estado==='vendido'?'Vendido':'Reservado')+'" usa el boton '+(item.estado==='vendido'?'"Vender"':'"Apartar"')+' en la ficha del reloj: asi se registra el dinero en Finanzas.');
  // 2) avisos: se guarda solo si confirmas
  var avisos=[];
  var publico=PUBLICOS.indexOf(item.estado)!==-1&&!item.ocultoCatalogo;
  if(item.precio>0&&item.costoTotal>0&&item.precio<item.costoTotal) avisos.push('El precio ($'+item.precio+') es MENOR que el costo total ($'+item.costoTotal.toFixed(2)+'): perderias dinero.');
  if(item.precioMin>0&&item.costoTotal>0&&item.precioMin<item.costoTotal) avisos.push('El precio minimo ($'+item.precioMin+') es menor que el costo total ($'+item.costoTotal.toFixed(2)+').');
  if(publico&&!item.mm) avisos.push('No tiene el tamaño de la caja (mm): no saldra en la guia de tamaños ni en los filtros por tamaño.');
  if(item.estado==='transito'&&item.eta&&new Date(item.eta+'T23:59:59')<new Date()) avisos.push('La fecha estimada de llegada ('+item.eta+') ya paso.');
  if(item.sku){
    var mismo=state.inventario.filter(function(p){ return p.id!==item.id&&p.estado!=='vendido'&&String(p.sku||'').trim().toLowerCase()===item.sku.toLowerCase(); });
    if(mismo.length) avisos.push('Ya tienes '+mismo.length+' unidad'+(mismo.length===1?'':'es')+' sin vender con la referencia '+item.sku+'. Si es otra unidad del mismo modelo esta bien; si no, seria un duplicado.');
  }
  if(avisos.length&&!confirm('Revisa antes de guardar:\n\n- '+avisos.join('\n- ')+'\n\n¿Guardar de todas formas?')) return false;
  // sin fotos no deberia verse en la tienda: se ofrece guardarlo oculto hasta que tenga fotos
  if(publico&&!item.foto&&confirm('Este reloj no tiene fotos.\n\n¿Lo guardo OCULTO en la tienda hasta que le pongas fotos? (recomendado)\n\nAceptar = guardarlo oculto · Cancelar = publicarlo sin foto')){
    item.ocultoCatalogo=true;
    var chk=document.getElementById('inv-oculto-catalogo'); if(chk) chk.checked=true;
  }
  return true;
}
// Vendido y Reservado solo se eligen desde "Vender" / "Apartar" (registran el dinero); en el formulario
// se pueden ver si el reloj ya esta asi, pero no elegir.
function bloquearEstadosConDinero(estadoActual){
  var sel=document.getElementById('inv-estado'); if(!sel) return;
  Array.prototype.forEach.call(sel.options, function(o){
    if(o.value==='vendido'||o.value==='reservado') o.disabled=(o.value!==estadoActual);
  });
}
// formatos que se corrigen solos al salir del campo
(function(){
  var limpiar=function(id, fn){ var el=document.getElementById(id); if(el) el.addEventListener('blur', function(){ var v=fn(el.value); if(v!==el.value){ el.value=v; contarSecciones(); } }); };
  var espacios=function(v){ return v.replace(/\s+/g,' ').trim(); };
  limpiar('inv-nombre', espacios);
  limpiar('inv-sku', function(v){ return espacios(v).toUpperCase(); });
  limpiar('inv-coleccion', espacios);
  ['inv-ancho-correa','inv-largo-correa'].forEach(function(id){ limpiar(id, function(v){ var n=String(v).replace(',', '.').match(/\d+(\.\d+)?/); return v.trim()===''?'':(n?n[0]+' mm':espacios(v)); }); });
  limpiar('inv-agua', function(v){ var t=espacios(v).toUpperCase().replace(/\s*(M|ATM|BAR)$/,'$1'); return t; });
  bloquearEstadosConDinero('disponible');
})();

function agregarProducto(){
  var editIdx=document.getElementById('inv-edit-index').value;
  var nombre=document.getElementById('inv-nombre').value.replace(/\s+/g,' ').trim();
  if(!nombre){ marcarCampo('inv-nombre','Escribe el modelo del reloj.'); return; }
  if(fotosSubiendo()){alert('Espera a que terminen de subir las fotos.');return;}
  var listaFotos=fotosFormulario();
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
    calibre:document.getElementById('inv-calibre').value.trim(),
    l2l:document.getElementById('inv-l2l').value.trim(),             // de asa a asa (mm), medida real
    grosor:document.getElementById('inv-grosor').value.trim(),       // grosor de la caja (mm)
    corona:document.getElementById('inv-corona').value.trim(),
    materialBisel:document.getElementById('inv-material-bisel').value.trim(),
    colorBisel:document.getElementById('inv-color-bisel').value.trim(),
    materialEsfera:document.getElementById('inv-material-esfera').value.trim(),
    anchoCorrea:document.getElementById('inv-ancho-correa').value.trim(),
    largoCorrea:document.getElementById('inv-largo-correa').value.trim(),
    colorCorrea:document.getElementById('inv-color-correa').value.trim(),
    ficha:fichaFormulario(),                                             // especificaciones pegadas, en grupos
    descripcion:document.getElementById('inv-descripcion').value.trim(),
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
    foto:listaFotos[0]||'',                                              // principal (URL, o una foto antigua en base64)
    fotos:listaFotos.filter(function(u){ return /^https:\/\//.test(u); }), // todas las fotos en la nube, en orden
    fotosJpg:jpgsFormulario(),                                           // copias JPEG para compartir (privado)
    fotoCompartir:fotoCompartirFormulario(),                             // imagen de la vista previa en WhatsApp
    fecha:new Date().toLocaleDateString('es-MX')
  };
  var esEdicion=editIdx!=='';
  var idxActual=esEdicion?idxInv(editIdx):-1;
  if(esEdicion&&idxActual===-1){ invNoExiste(); return; }
  var estadoAntes=esEdicion?state.inventario[idxActual].estado:null;
  if(esEdicion) item.id=state.inventario[idxActual].id;
  if(!validarUnidad(item, esEdicion, estadoAntes)) return;
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
  ['inv-nombre','inv-sku','inv-coleccion','inv-mm','inv-material-caja','inv-material-correa','inv-color-esfera','inv-agua','inv-cristal','inv-color','inv-calibre','inv-l2l','inv-grosor','inv-corona','inv-material-bisel','inv-color-bisel','inv-material-esfera','inv-ancho-correa','inv-largo-correa','inv-color-correa','inv-notas','inv-serie','inv-proveedor','inv-paqueteria','inv-tracking','inv-eta','inv-costo','inv-importacion','inv-precio','inv-precio-min','inv-foto','inv-foto-carpeta','inv-descripcion'].forEach(id=>{var el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('inv-oculto-catalogo').checked=false;
  cargarFicha([]);
  document.getElementById('inv-genero').value='hombre';
  document.getElementById('inv-movimiento').value='';
  document.getElementById('inv-estado').value='disponible';
  bloquearEstadosConDinero('disponible');
  document.getElementById('inv-edit-index').value='';
  setFotosFormulario([]);
  ['inv-preview-margen','inv-preview-ganancia'].forEach(id=>{var el=document.getElementById(id);if(el){el.textContent='--';el.style.color='var(--muted)';}});
  document.getElementById('inv-preview-costo').textContent='$0.00';
  document.getElementById('inv-form-title').textContent='Registrar unidad';
  document.getElementById('inv-submit-btn').textContent='Registrar unidad';
  var cb=document.getElementById('inv-cancel-btn');if(cb)cb.style.display='none';
  contarSecciones();
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
  var fields={'inv-nombre':p.nombre,'inv-sku':p.sku,'inv-coleccion':p.coleccion,'inv-mm':p.mm,'inv-material-caja':p.materialCaja,'inv-material-correa':p.materialCorrea,'inv-color-esfera':p.colorEsfera,'inv-agua':p.agua,'inv-cristal':p.cristal,'inv-color':p.color,'inv-calibre':p.calibre,'inv-l2l':p.l2l,'inv-grosor':p.grosor,'inv-corona':p.corona,'inv-material-bisel':p.materialBisel,'inv-color-bisel':p.colorBisel,'inv-material-esfera':p.materialEsfera,'inv-ancho-correa':p.anchoCorrea,'inv-largo-correa':p.largoCorrea,'inv-color-correa':p.colorCorrea,'inv-notas':p.notas,'inv-serie':p.serie,'inv-proveedor':p.proveedor,'inv-paqueteria':p.paqueteria,'inv-tracking':p.tracking,'inv-eta':p.eta,'inv-costo':p.costo,'inv-importacion':p.importacion,'inv-precio':p.precio,'inv-precio-min':p.precioMin||'','inv-descripcion':p.descripcion};
  Object.entries(fields).forEach(([id,v])=>{var el=document.getElementById(id);if(el)el.value=v||'';});
  document.getElementById('inv-oculto-catalogo').checked=!!p.ocultoCatalogo;
  cargarFicha(p.ficha);
  document.getElementById('inv-genero').value=p.genero||'hombre';
  document.getElementById('inv-movimiento').value=String(p.movimiento||'').replace(/^cuarzo japon[eé]s$/i,'Cuarzo');
  document.getElementById('inv-estado').value=p.estado||'disponible';
  bloquearEstadosConDinero(p.estado||'disponible');
  document.getElementById('inv-edit-index').value=p.id;
  document.getElementById('inv-form-title').textContent='Editar unidad';
  document.getElementById('inv-submit-btn').textContent='Guardar cambios';
  var cb=document.getElementById('inv-cancel-btn');if(cb)cb.style.display='inline-flex';
  calcularMargenPreview();
  setFotosFormulario(fotosDe(p), p.fotosJpg);
  toggleFormulario(true);
  cerrarModal();
}

// fotos de una unidad para el formulario: las de la nube; si no tiene, la foto antigua (base64)
function fotosDe(p){
  if(p.fotos&&p.fotos.length) return p.fotos.slice();
  return p.foto?[p.foto]:[];
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
    'inv-calibre':p.calibre,'inv-l2l':p.l2l,'inv-grosor':p.grosor,'inv-corona':p.corona,'inv-material-bisel':p.materialBisel,'inv-color-bisel':p.colorBisel,'inv-material-esfera':p.materialEsfera,'inv-ancho-correa':p.anchoCorrea,'inv-largo-correa':p.largoCorrea,'inv-color-correa':p.colorCorrea,
    'inv-proveedor':p.proveedor,'inv-precio':p.precio,'inv-precio-min':p.precioMin||'','inv-descripcion':p.descripcion};
  Object.entries(copiar).forEach(function(e){var el=document.getElementById(e[0]);if(el)el.value=e[1]||'';});
  document.getElementById('inv-genero').value=p.genero||'hombre';
  document.getElementById('inv-movimiento').value=String(p.movimiento||'').replace(/^cuarzo japon[eé]s$/i,'Cuarzo');
  cargarFicha(p.ficha);
  // Lo que SI es propio de cada unidad queda en blanco: costo, serie, tracking
  document.getElementById('inv-estado').value='transito';
  bloquearEstadosConDinero('transito');
  document.getElementById('inv-edit-index').value='';
  document.getElementById('inv-form-title').textContent='Nueva unidad de '+(p.nombre||'este modelo');
  document.getElementById('inv-submit-btn').textContent='Registrar unidad';
  var cb=document.getElementById('inv-cancel-btn');if(cb)cb.style.display='inline-flex';
  setFotosFormulario(fotosDe(p), p.fotosJpg);
  calcularMargenPreview();
  cerrarModal();
  toggleFormulario(true);
  var cEl=document.getElementById('inv-costo');
  if(cEl){ cEl.focus(); }
  window.scrollTo({top:0,behavior:'smooth'});
}

export { abrirFormularioNuevo, contarSecciones, agregarProducto, calcularMargenPreview, cancelarEdicion, duplicarProducto, editarProducto, limpiarFormulario, resetCamposFormulario, toggleFormulario };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { abrirFormularioNuevo, agregarProducto, calcularMargenPreview, cancelarEdicion, duplicarProducto, editarProducto });
