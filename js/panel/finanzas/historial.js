// =================== HISTORIAL ===================
import { finAllMeses, finMesKey, finMesLabel } from './fechas.js';
import { renderInicio } from '../inicio.js';
import { save, state } from '../state.js';

function renderHistorial() {
  var filMes=document.getElementById('fil-mes');
  if(filMes){
    var cur=filMes.value;
    filMes.innerHTML='<option value="">Todos los meses</option>'+finAllMeses().slice().reverse().map(k=>'<option value="'+k+'"'+(k===cur?' selected':'')+'>'+finMesLabel(k)+'</option>').join('');
    filMes.value=cur;
  }
  var mesFil=filMes?filMes.value:'';
  var tipoFil=document.getElementById('fil-tipo')?document.getElementById('fil-tipo').value:'';
  var movs=state.movimientos.filter(m=>(!mesFil||finMesKey(m.fecha)===mesFil)&&(!tipoFil||m.tipo===tipoFil));
  var ent=movs.filter(m=>m.tipo==='venta'||m.tipo==='compra'||m.tipo==='abono').reduce((a,b)=>a+b.monto,0);
  var sal=movs.filter(m=>m.tipo==='gasto'||m.tipo==='retiro').reduce((a,b)=>a+b.monto,0);
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
    return '<div class="list-item"><div class="list-item-info"><div class="list-item-name">'+m.desc+'</div><div class="list-item-sub">'+m.fecha+' · '+(m.canal||'')+metodoTxt+clienteTxt+gan+descuento+'</div></div><span class="badge '+t[0]+'">'+t[1]+'</span><span class="money '+mc+'" style="min-width:70px;text-align:right;">$'+m.monto.toLocaleString()+'</span><button class="btn btn-danger" onclick="eliminarMov('+ri+')">&#128465;</button></div>';
  }).join('');
}
function eliminarMov(i){if(!confirm('Eliminar este movimiento?'))return;state.movimientos.splice(i,1);save('movimientos');renderHistorial();renderInicio();}

export { eliminarMov, renderHistorial };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { eliminarMov, renderHistorial });
