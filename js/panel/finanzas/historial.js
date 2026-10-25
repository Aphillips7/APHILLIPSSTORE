// =================== HISTORIAL ===================
import { finAllMeses, finMesKey, finMesLabel } from './fechas.js';
import { renderInicio } from '../inicio.js';
import { save, state } from '../state.js';
import { METODOS, SIGNO, cobradoDeVenta, fechaEnMesCerrado } from './calculos.js';
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
  // cada movimiento suma con su signo (un ajuste de costo a la baja es una compra negativa: devuelve dinero)
  var ent=0,sal=0;
  movs.forEach(function(m){ var v=(SIGNO[m.tipo]||0)*(Number(m.monto)||0); if(v>0) ent+=v; else sal-=v; });
  var bal=document.getElementById('fil-balance');
  if(bal) bal.innerHTML='Entradas <span style="color:var(--green)">$'+ent.toLocaleString()+'</span> &nbsp; Salidas <span style="color:var(--red)">$'+sal.toLocaleString()+'</span> &nbsp; Neto <span style="color:'+(ent-sal>=0?'var(--green)':'var(--red)')+'">$'+(ent-sal).toLocaleString()+'</span>';
  var lista=document.getElementById('fin-lista');
  if(movs.length===0){lista.innerHTML='<div class="empty"><span></span>Sin movimientos para este filtro.</div>';return;}
  var tipos={venta:['badge-green','Venta'],compra:['badge-blue','Compra'],gasto:['badge-red','Gasto'],retiro:['badge-gold','Retiro'],abono:['badge-blue','Abono'],traspaso:['badge-gold','Traspaso'],aporte:['badge-green','Aporte'],reserva_cancelada:['badge-slate','Apartado cancelado']};
  lista.innerHTML=movs.map(m=>{
    var ri=state.movimientos.indexOf(m);
    var t=tipos[m.tipo]||['badge-blue',m.tipo];
    // en un apartado la venta solo trae el saldo: la ganancia se calcula con todo lo cobrado (saldo + abonos)
    var ganV=m.tipo==='venta'?cobradoDeVenta(m)-(Number(m.costo)||0):0;
    var gan=m.tipo==='venta'?' · Gan: <span class="money '+(ganV<0?'neg':'pos')+'">$'+Math.round(ganV).toLocaleString()+'</span>'+(!(Number(m.costo)>0)?' <span style="color:var(--red)">(sin costo)</span>':''):'';
    // signo claro: + entra (ventas, abonos) · − sale (compras, gastos, retiros) · ⇄ solo cambia de metodo
    var signo=(SIGNO[m.tipo]||0)*((Number(m.monto)||0)<0?-1:1);
    var mc=signo>0?'pos':signo<0?'neg':'';
    var montoTxt=(m.tipo==='traspaso'?'⇄ ':signo>0?'+':signo<0?'−':'')+'$'+Math.abs(Number(m.monto)||0).toLocaleString();
    var descuento='';
    if(m.tipo==='venta'&&m.precioObjetivo&&m.precioObjetivo>m.monto){
      var difPct=Math.round(((m.precioObjetivo-m.monto)/m.precioObjetivo)*100);
      descuento=' · Pedido: $'+m.precioObjetivo.toLocaleString()+' <span style="color:var(--red)">(-'+difPct+'%)</span>';
    }
    var clienteTxt=m.clienteNombre?' · '+m.clienteNombre:'';
    var cerrado=fechaEnMesCerrado(m.fecha);
    // sin metodo de pago: se puede asignar aqui mismo (asi cuadra el dinero por metodo)
    var metodoTxt=m.metodoPago?' · '+(METODOS[m.metodoPago]||m.metodoPago):(SIGNO[m.tipo]&&!cerrado?' · <select class="mov-metodo" onchange="asignarMetodo('+ri+',this.value)" aria-label="Asignar metodo de pago"><option value="">Sin metodo · asignar</option>'+Object.keys(METODOS).map(function(k){ return '<option value="'+k+'">'+METODOS[k]+'</option>'; }).join('')+'</select>':'');
    return '<div class="list-item"><div class="list-item-info"><div class="list-item-name">'+esc(m.desc)+'</div><div class="list-item-sub">'+m.fecha+' · '+esc(m.canal||'')+metodoTxt+esc(clienteTxt)+gan+descuento+'</div></div><span class="badge '+t[0]+'">'+t[1]+'</span><span class="money '+mc+'" style="min-width:78px;text-align:right;" title="'+(signo>0?'Dinero que entra':signo<0?'Dinero que sale':'No cambia tu dinero')+'">'+montoTxt+'</span>'+(cerrado?'<span class="mov-candado" title="Mes cerrado">&#128274;</span>':'<button class="btn btn-danger" onclick="eliminarMov('+ri+')" aria-label="Eliminar movimiento">&#128465;</button>')+'</div>';
  }).join('');
}
// poka-yoke: un movimiento de un mes cerrado no se puede borrar (hay que reabrir el mes en Finanzas > Cierres)
function eliminarMov(i){var m=state.movimientos[i];if(!m)return;if(fechaEnMesCerrado(m.fecha)){alert('Ese movimiento es de un mes cerrado. Para corregirlo, reabre el mes en Finanzas > Cierres.');return;}if(!confirm('Eliminar este movimiento?\n\n'+m.desc+' · $'+(Number(m.monto)||0).toLocaleString()+' · '+m.fecha+'\n\nNo se puede deshacer.'))return;state.movimientos.splice(i,1);save('movimientos');renderHistorial();renderInicio();}

function filtrados(mesFil,tipoFil,q){
  return state.movimientos.filter(function(m){
    if(mesFil&&finMesKey(m.fecha)!==mesFil)return false;
    if(tipoFil==='sinmetodo'){ if(!(SIGNO[m.tipo]&&!(m.metodoPago in METODOS)))return false; }
    else if(tipoFil&&m.tipo!==tipoFil)return false;
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

function asignarMetodo(i,metodo){
  var m=state.movimientos[i]; if(!m||!metodo||!(metodo in METODOS))return;
  if(fechaEnMesCerrado(m.fecha)){alert('Ese movimiento es de un mes cerrado. Reabre el mes en Finanzas > Cierres para cambiarlo.');renderHistorial();return;}
  m.metodoPago=metodo; m._ts=m._ts||Date.now();
  save('movimientos'); renderHistorial();
}
// abre Movimientos con un filtro puesto (lo usan los avisos de "Revision de datos")
function filtrarMovimientos(tipo){
  var t=document.getElementById('fil-tipo'); if(t) t.value=tipo||'';
  var mes=document.getElementById('fil-mes'); if(mes) mes.value='';
  renderHistorial();
}

export { eliminarMov, renderHistorial };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { asignarMetodo, eliminarMov, exportarHistorialCSV, filtrarMovimientos, renderHistorial });
