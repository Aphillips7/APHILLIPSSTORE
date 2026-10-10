// =================== INVENTORY PICKER (COMPRAS) ===================
import { renderInicio } from '../inicio.js';
import { idAleatorio, idxInv, invNoExiste, save, state } from '../state.js';

var _compraPicIdx = null;
function renderPickerCompra() {
  var grid = document.getElementById('compra-picker-grid');
  if (!grid) return;
  var q = (document.getElementById('compra-search') ? document.getElementById('compra-search').value.toLowerCase() : '');
  var items = state.inventario.map((p,i) => ({p,i})).filter(x =>
    (x.p.estado === 'transito' || x.p.estado === 'disponible') &&
    ((x.p.nombre||'').toLowerCase().includes(q) || (x.p.sku||'').toLowerCase().includes(q))
  );
  if (!items.length) { grid.innerHTML = '<div class="inv-picker-empty">'+(q?'Sin resultados':'No hay relojes en inventario')+'</div>'; return; }
  grid.innerHTML = items.map(({p,i}) => {
    var sel = _compraPicIdx===p.id?' selected':'';
    var badge = p.estado==='transito' ? '<span style="font-size:9px;background:var(--blue-bg);color:var(--blue);padding:1px 5px;border-radius:6px;font-weight:700;">EN TRANSITO</span>' : '';
    var foto = p.foto ? '<img src="'+p.foto+'" style="width:100%;height:52px;object-fit:cover;border-radius:6px;margin-bottom:5px;" onerror="this.remove()" />' : '';
    return '<div class="inv-picker-card'+sel+'" onclick="seleccionarCompra(\''+p.id+'\')">' + foto + badge +
      '<div class="inv-picker-nombre" style="margin-top:3px;">'+p.nombre+'</div>' +
      (p.sku?'<div class="inv-picker-sub">Ref. '+p.sku+'</div>':'')+
      '<div class="inv-picker-precio">Costo reg: $'+(p.costoTotal||0).toLocaleString()+'</div>'+
    '</div>';
  }).join('');
}
function filtrarPickerCompra() { renderPickerCompra(); }
function seleccionarCompra(id) {
  var i = idxInv(id);
  if (i === -1) { invNoExiste(); renderPickerCompra(); return; }
  _compraPicIdx = id;
  var p = state.inventario[i];
  document.getElementById('compra-sel-nombre').textContent = p.nombre+(p.sku?' · Ref. '+p.sku:'');
  document.getElementById('compra-sel-sub').textContent = 'Estado: '+({disponible:'Disponible',transito:'En transito'}[p.estado]||p.estado);
  document.getElementById('fin-compra-index').value = id;
  var mc=document.getElementById('fin-monto-compra'); if(mc){ mc.value=p.costoTotal||''; mc.focus(); }
  var sel=document.getElementById('compra-selected'); if(sel) sel.style.display='block';
  var grid=document.getElementById('compra-picker-grid'); if(grid) grid.style.display='none';
  var search=document.getElementById('compra-search'); if(search) search.style.display='none';
}
function limpiarSeleccionCompra() {
  _compraPicIdx = null;
  document.getElementById('fin-compra-index').value='';
  document.getElementById('fin-monto-compra').value='';
  var sel=document.getElementById('compra-selected'); if(sel) sel.style.display='none';
  var grid=document.getElementById('compra-picker-grid'); if(grid) grid.style.display='';
  var search=document.getElementById('compra-search'); if(search){ search.style.display=''; search.value=''; }
  renderPickerCompra();
}
function registrarCompra() {
  var idx=document.getElementById('fin-compra-index').value;
  if(idx===''){alert('Selecciona un reloj primero.');return;}
  var i=idxInv(idx);
  if(i===-1){ invNoExiste(); limpiarSeleccionCompra(); return; }
  var p=state.inventario[i];
  if(existeCompraDe(p)&&!confirm('Ya hay una compra registrada para "'+p.nombre+'". ¿Registrar otra de todos modos?')) return;
  var monto=parseFloat(document.getElementById('fin-monto-compra').value);
  var metodoPago=document.getElementById('fin-metodo-compra')?document.getElementById('fin-metodo-compra').value:'';
  if(!monto||monto<=0){alert('Ingresa el costo pagado.');return;}
  state.inventario[i].costoTotal=monto;
  save('inventario');
  state.movimientos.unshift({id:idAleatorio('mov'),_ts:Date.now(),tipo:'compra',invId:p.id||null,desc:p.nombre+(p.sku?' · Ref. '+p.sku:''),monto:monto,canal:'compra',metodoPago:metodoPago,costo:0,fecha:new Date().toLocaleDateString('es-MX')});
  save('movimientos');
  limpiarSeleccionCompra(); renderInicio();
  var btn=document.getElementById('btn-registrar-compra');
  if(btn){var orig=btn.textContent;btn.textContent='Compra registrada';btn.style.background='var(--green)';setTimeout(()=>{btn.textContent=orig;btn.style.background='';},1800);}
}

function existeCompraDe(producto){
  if(!producto) return false;
  var desc = producto.nombre + (producto.sku ? ' · Ref. ' + producto.sku : '');
  return state.movimientos.some(function(m){
    if(m.tipo!=='compra') return false;
    if(m.invId && producto.id) return m.invId===producto.id;
    return m.desc===desc;
  });
}
function autoRegistrarCompraInv(producto) {
  if (!producto || producto.estado !== 'disponible') return;
  var costo = producto.costoTotal || 0;
  if (!costo || costo <= 0) return;
  if (existeCompraDe(producto)) return;
  var desc = producto.nombre + (producto.sku ? ' · Ref. ' + producto.sku : '');
  state.movimientos.unshift({id:idAleatorio('mov'),_ts:Date.now(),tipo:'compra',invId:producto.id||null,desc:desc,monto:costo,canal:'compra',costo:0,fecha:new Date().toLocaleDateString('es-MX')});
  save('movimientos');
}

export { _compraPicIdx, autoRegistrarCompraInv, existeCompraDe, filtrarPickerCompra, limpiarSeleccionCompra, registrarCompra, renderPickerCompra, seleccionarCompra };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { filtrarPickerCompra, limpiarSeleccionCompra, registrarCompra, seleccionarCompra });
