// =================== INVENTORY PICKER (COMPRAS) ===================
import { renderInicio } from '../inicio.js';
import { idAleatorio, idxInv, invNoExiste, save, state } from '../state.js';
import { fechaEnMesCerrado } from './calculos.js';
import { elegirMetodoPago } from '../componentes.js';

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
  if(!metodoPago){alert('Elige con que pagaste (Yappy, efectivo...): asi cuadra el dinero por metodo.');return;}
  // el reloj queda con ese costo: costo + importacion = total pagado, y su margen se recalcula
  var it=state.inventario[i], imp=Number(it.importacion)||0;
  if(imp>monto) imp=0;
  it.costo=Math.round((monto-imp)*100)/100; it.importacion=imp; it.costoTotal=monto;
  if(it.precio>0) it.margen=Math.round((it.precio-monto)/it.precio*100);
  save('inventario');
  state.movimientos.unshift({id:idAleatorio('mov'),_ts:Date.now(),tipo:'compra',invId:p.id||null,desc:p.nombre+(p.sku?' · Ref. '+p.sku:''),monto:monto,canal:'compra',metodoPago:metodoPago,costo:0,fecha:new Date().toLocaleDateString('es-MX')});
  save('movimientos');
  limpiarSeleccionCompra(); renderInicio();
  var fmc=document.getElementById('fin-metodo-compra'); if(fmc) fmc.value='';
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
function autoRegistrarCompraInv(producto, aunqueNoEsteDisponible) {
  if (!producto || (producto.estado !== 'disponible' && !aunqueNoEsteDisponible)) return;
  var costo = producto.costoTotal || 0;
  if (!costo || costo <= 0) return;
  if (existeCompraDe(producto)) return;
  var desc = producto.nombre + (producto.sku ? ' · Ref. ' + producto.sku : '');
  state.movimientos.unshift({id:idAleatorio('mov'),_ts:Date.now(),tipo:'compra',invId:producto.id||null,desc:desc,monto:costo,canal:'compra',metodoPago:producto.metodoCompra||'',costo:0,fecha:new Date().toLocaleDateString('es-MX'),_auto:true});
  save('movimientos');
}

// =================== COMPRA AUTOMATICA AL GUARDAR UN RELOJ ===================
// Un reloj "En transito", "Disponible" o "Apartado" con costo ya se pago: su compra se registra sola en
// Movimientos (con el metodo de pago elegido en el formulario) y la caja lo descuenta de inmediato.
// "Bajo pedido" todavia no se paga, asi que no se registra. Si despues cambia el costo (por ejemplo, llega
// la importacion), la compra se actualiza; si su mes ya esta cerrado, se registra un ajuste por la diferencia.
const PAGADOS = ['transito', 'disponible', 'reservado'];
function comprasDe(p){ return state.movimientos.filter(function(m){ return m.tipo === 'compra' && m.invId === p.id; }); }
function hoy(){ return new Date().toLocaleDateString('es-MX'); }
function sincronizarCompraInv(p){
  if(!p || PAGADOS.indexOf(p.estado) === -1) return '';
  var costo = Math.round((Number(p.costoTotal) || 0) * 100) / 100;
  if(!(costo > 0)) return '';
  var desc = p.nombre + (p.sku ? ' · Ref. ' + p.sku : '');
  var compras = comprasDe(p);
  if(!compras.length && existeCompraDe(p)) return '';      // compra vieja sin invId: no se duplica
  if(!compras.length){
    state.movimientos.unshift({ id: idAleatorio('mov'), _ts: Date.now(), tipo: 'compra', invId: p.id, desc: desc, monto: costo, canal: 'compra', metodoPago: p.metodoCompra || '', costo: 0, fecha: hoy(), _auto: true });
    save('movimientos');
    return 'Se registro la compra de $' + costo.toLocaleString('en-US') + ' en Movimientos.';
  }
  var pagado = compras.reduce(function(a, m){ return a + (Number(m.monto) || 0); }, 0);
  var dif = Math.round((costo - pagado) * 100) / 100;
  var unica = compras.length === 1 ? compras[0] : null;
  if(unica && !unica.metodoPago && p.metodoCompra && !fechaEnMesCerrado(unica.fecha)){ unica.metodoPago = p.metodoCompra; }
  if(Math.abs(dif) < 0.01){ if(unica && unica.metodoPago === p.metodoCompra) save('movimientos'); return ''; }
  if(unica && !fechaEnMesCerrado(unica.fecha)){
    unica.monto = costo; unica.desc = desc;
    save('movimientos');
    return 'La compra en Movimientos se actualizo a $' + costo.toLocaleString('en-US') + '.';
  }
  // costo mas alto: compra por la diferencia; costo mas bajo: compra NEGATIVA (vuelve dinero a la caja)
  state.movimientos.unshift({ id: idAleatorio('mov'), _ts: Date.now(), tipo: 'compra', invId: p.id, desc: (dif > 0 ? 'Ajuste de costo · ' : 'Ajuste de costo (baja) · ') + desc,
    monto: dif, canal: 'compra', metodoPago: p.metodoCompra || '', costo: 0, fecha: hoy(), _auto: true });
  save('movimientos');
  return 'Se registro un ajuste de costo de $' + Math.abs(dif).toLocaleString('en-US') + ' (el mes de la compra original esta cerrado).';
}

// Antes de registrar una compra automatica se pregunta con que se pago si el reloj no lo tiene guardado.
// "Ahora no" no registra la compra (queda en Finanzas > Resumen > Revision de datos para hacerlo despues).
async function registrarCompraConMetodo(p){
  if(!p || PAGADOS.indexOf(p.estado) === -1 || !((Number(p.costoTotal) || 0) > 0)) return '';
  if(!comprasDe(p).length && existeCompraDe(p)) return '';
  if(!p.metodoCompra){
    var m = await elegirMetodoPago('¿Con que pagaste este reloj?', p.nombre + ' · $' + Number(p.costoTotal).toLocaleString('en-US') + '. La compra se registra en Movimientos y se descuenta de ese metodo.');
    if(!m) return 'La compra no se registro. Registrala cuando quieras desde Finanzas > Registrar > Compra.';
    var i = idxInv(p.id); if(i !== -1){ state.inventario[i].metodoCompra = m; save('inventario'); }
    p.metodoCompra = m;
  }
  return sincronizarCompraInv(p);
}

// Al vender un reloj que nunca paso por "disponible" (se vendio en transito o bajo pedido), su compra
// no se habia registrado y el balance quedaba inflado: se registra al vender si falta.
function registrarCompraSiFalta(producto){
  if(!producto || existeCompraDe(producto) || !((Number(producto.costoTotal) || 0) > 0)) return;
  var copia = Object.assign({}, producto, { estado: 'disponible' });   // ya se vendio: igual hubo que pagarlo
  registrarCompraConMetodo(copia).then(function(msg){ if(msg && window.toastPanel) window.toastPanel(msg); renderInicio(); });
}

export { _compraPicIdx, autoRegistrarCompraInv, registrarCompraConMetodo, sincronizarCompraInv, registrarCompraSiFalta, existeCompraDe, filtrarPickerCompra, limpiarSeleccionCompra, registrarCompra, renderPickerCompra, seleccionarCompra };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { filtrarPickerCompra, limpiarSeleccionCompra, registrarCompra, seleccionarCompra });
