// =================== HISTORIAL ===================
import { finAllMeses, finMesKey, finMesLabel } from './fechas.js';
import { renderInicio } from '../inicio.js';
import { save, state } from '../state.js';
import { fechaEnMesCerrado } from './calculos.js';
import { esc } from '../componentes.js';
import { exportarMovimientosCSV } from '../exportar.js';

function renderHistorial() {
  var filMes=document.getElementById('fil-mes');
  if(filMes){
    var cur=filMes.value;
    filMes.innerHTML='<option value="">Todos los meses</option>'+finAllMeses().slice().reverse().map(k=>'<option value="'+k+'"'+(k===cur?' selected':'')+'>'+finMesLabel(k)+'</option>').join('');
    filMes.value=cur;
  }
  var mesFil=filMes?filMes.value:'';
  var tipoFil=document.getElementById('fil-tipo')?document.getElementById('fil-tipo').value:'';
  var q=((document.getElementById('fil-buscar')||{}).value||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
  var movs=filtrados(mesFil,tipoFil,q);
  // entradas: ventas y abonos · salidas: compras, gastos y retiros (antes las compras se sumaban como entrada)
  var ent=movs.filter(m=>m.tipo==='venta'||m.tipo==='abono').reduce((a,b)=>a+(Number(b.monto)||0),0);
  var sal=movs.filter(m=>m.tipo==='compra'||m.tipo==='gasto'||m.tipo==='retiro').reduce((a,b)=>a+(Number(b.monto)||0),0);
  var bal=document.getElementById('fil-balance');
  if(bal) bal.innerHTML='Entradas <span style="color:var(--green)">$'+ent.toLocaleString()+'</span> &nbsp; Salidas <span style="color:var(--red)">$'+sal.toLocaleString()+'</span> &nbsp; Neto <span style="color:'+(ent-sal>=0?'var(--green)':'var(--red)')+'">$'+(ent-sal).toLocaleString()+'</span>';
  var lista=document.getElementById('fin-lista');
  if(movs.length===0){lista.innerHTML='<div class="empty"><span></span>Sin movimientos para este filtro.</div>';return;}
  var tipos={venta:['badge-green','Venta'],compra:['badge-blue','Compra'],gasto:['badge-red','Gasto'],retiro:['badge-gold','Retiro'],abono:['badge-blue','Abono'],traspaso:['badge-gold','Traspaso']};
  lista.innerHTML=movs.map(m=>{
    var ri=state.movimientos.indexOf(m);
    var t=tipos[m.tipo]||['badge-blue',m.tipo];
    var gan=m.tipo==='venta'?' · Gan: <span class="money pos">$'+(m.monto-(m.costo||0)).toLocaleString()+'</span>':'';
    var mc=(m.tipo==='venta'||m.tipo==='abono')?'pos':(m.tipo==='gasto'||m.tipo==='retiro')?'neg':'';
    var descuento='';
    if(m.tipo==='venta'&&m.precioObjetivo&&m.precioObjetivo>m.monto){
      var difPct=Math.round(((m.precioObjetivo-m.monto)/m.precioObjetivo)*100);
      descuento=' · Pedido: $'+m.precioObjetivo.toLocaleString()+' <span style="color:var(--red)">(-'+difPct+'%)</span>';
    }
    var clienteTxt=m.clienteNombre?' · '+m.clienteNombre:'';
    var metodoTxt=m.metodoPago?' · '+({efectivo:'Efectivo',yappy:'Yappy',transferencia:'Transferencia',tarjeta:'Tarjeta',otro:'Otro'}[m.metodoPago]||m.metodoPago):'';
    return '<div class="list-item"><div class="list-item-info"><div class="list-item-name">'+esc(m.desc)+'</div><div class="list-item-sub">'+m.fecha+' · '+esc(m.canal||'')+metodoTxt+esc(clienteTxt)+gan+descuento+'</div></div><span class="badge '+t[0]+'">'+t[1]+'</span><span class="money '+mc+'" style="min-width:70px;text-align:right;">$'+m.monto.toLocaleString()+'</span>'+(fechaEnMesCerrado(m.fecha)?'<span class="mov-candado" title="Mes cerrado">&#128274;</span>':'<button class="btn btn-danger" onclick="eliminarMov('+ri+')" aria-label="Eliminar movimiento">&#128465;</button>')+'</div>';
  }).join('');
}
// poka-yoke: un movimiento de un mes cerrado no se puede borrar (hay que reabrir el mes en Finanzas > Cierres)
function eliminarMov(i){var m=state.movimientos[i];if(!m)return;if(fechaEnMesCerrado(m.fecha)){alert('Ese movimiento es de un mes cerrado. Para corregirlo, reabre el mes en Finanzas > Cierres.');return;}if(!confirm('Eliminar este movimiento?\n\n'+m.desc+' · $'+(Number(m.monto)||0).toLocaleString()+' · '+m.fecha+'\n\nNo se puede deshacer.'))return;state.movimientos.splice(i,1);save('movimientos');renderHistorial();renderInicio();}

function filtrados(mesFil,tipoFil,q){
  return state.movimientos.filter(function(m){
    if(mesFil&&finMesKey(m.fecha)!==mesFil)return false;
    if(tipoFil&&m.tipo!==tipoFil)return false;
    if(q&&[m.desc,m.clienteNombre,m.categoria,m.canal,m.fecha,String(m.monto)].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').indexOf(q)===-1)return false;
    return true;
  });
}
// Exporta a Excel exactamente lo que se ve con los filtros
function exportarHistorialCSV(){
  var mesFil=(document.getElementById('fil-mes')||{}).value||'',tipoFil=(document.getElementById('fil-tipo')||{}).value||'';
  var q=((document.getElementById('fil-buscar')||{}).value||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
  var ids=new Set(filtrados(mesFil,tipoFil,q));
  exportarMovimientosCSV(function(m){return ids.has(m);},'movimientos'+(mesFil?'-'+mesFil:''));
}

export { eliminarMov, renderHistorial };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { eliminarMov, exportarHistorialCSV, renderHistorial });
