import { renderHistorial } from './historial.js';
import { renderPickerCompra } from './registrar-compra.js';
import { renderPicker } from './registrar-venta.js';
import { state } from '../state.js';

function renderFinanzas() {
  renderHistorial();
  renderPicker();
  renderPickerCompra();

  // Calcular total de entradas (Ventas + Abonos)
  var totalIngresos = state.movimientos.filter(m => m.tipo === 'venta' || m.tipo === 'abono').reduce((a, b) => a + b.monto, 0);

  // Calcular total de salidas (Compras, Gastos, Retiros)
  var totalEgresos = state.movimientos.filter(m => m.tipo === 'compra' || m.tipo === 'gasto' || m.tipo === 'retiro').reduce((a, b) => a + b.monto, 0);

  // Balance real
  var saldoReal = totalIngresos - totalEgresos;

  var el = document.getElementById('fin-saldo');
  if (el) {
    el.value = saldoReal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    // Poner el texto en rojo si hay más gastos que ingresos
    el.style.color = saldoReal >= 0 ? 'var(--black)' : 'var(--red)';
  }

  renderSaldoPorMetodo();
}

function renderSaldoPorMetodo(){
  var cont=document.getElementById('fin-saldo-metodos');
  if(!cont)return;
  var metodos={efectivo:'Efectivo',yappy:'Yappy',transferencia:'Transferencia',tarjeta:'Tarjeta',otro:'Otro'};
  var saldos={};
  Object.keys(metodos).forEach(function(k){saldos[k]=0;});
  state.movimientos.forEach(function(m){
    if(m.tipo==='traspaso'){
      if(m.metodoOrigen&&(m.metodoOrigen in saldos))saldos[m.metodoOrigen]-=m.monto;
      if(m.metodoDestino&&(m.metodoDestino in saldos))saldos[m.metodoDestino]+=m.monto;
      return;
    }
    if(!m.metodoPago||!(m.metodoPago in saldos))return;
    if(m.tipo==='venta'||m.tipo==='abono')saldos[m.metodoPago]+=m.monto;
    else if(m.tipo==='compra'||m.tipo==='gasto'||m.tipo==='retiro')saldos[m.metodoPago]-=m.monto;
  });
  var conDatos=Object.entries(saldos).filter(([k,v])=>v!==0);
  if(!conDatos.length){cont.innerHTML='<div style="font-size:11px;color:var(--muted);">Aun no hay movimientos con metodo de pago asignado.</div>';return;}
  cont.innerHTML=conDatos.map(([k,v])=>'<div style="flex:1;min-width:90px;background:var(--bg2);border-radius:8px;padding:8px 10px;text-align:center;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.02em;color:var(--muted);margin-bottom:3px;">'+metodos[k]+'</div><div style="font-family:DM Mono,monospace;font-size:13px;color:'+(v>=0?'var(--black)':'var(--red)')+';">$'+v.toLocaleString()+'</div></div>').join('');
}

export { renderFinanzas, renderSaldoPorMetodo };
