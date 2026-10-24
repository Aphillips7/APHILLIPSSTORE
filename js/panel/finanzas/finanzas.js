import { renderHistorial } from './historial.js';
import { renderPickerCompra } from './registrar-compra.js';
import { renderPicker } from './registrar-venta.js';
import { METODOS, estadoResultados, saldosPorMetodo } from './calculos.js';
import { validarOtro, validarTraspaso } from './registrar-otros.js';
import { dinero } from '../componentes.js';
import { state } from '../state.js';

function renderFinanzas() {
  renderHistorial();
  renderPicker();
  renderPickerCompra();
  // Saldo real: entradas (ventas + abonos) menos salidas (compras, gastos y retiros)
  var saldoReal = estadoResultados(state.movimientos).flujo;
  var el = document.getElementById('fin-saldo');
  if (el) {
    el.value = saldoReal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    el.style.color = saldoReal >= 0 ? 'var(--black)' : 'var(--red)';
  }
  renderSaldoPorMetodo();
  try{ validarOtro(); validarTraspaso(); }catch(e){}
}

function renderSaldoPorMetodo(){
  var cont = document.getElementById('fin-saldo-metodos');
  if(!cont) return;
  var s = saldosPorMetodo().porMetodo;
  var conDatos = Object.keys(METODOS).filter(function(k){ return s[k]; });
  if(!conDatos.length){ cont.innerHTML = '<div class="tenue-peq">Aun no hay movimientos con metodo de pago asignado.</div>'; return; }
  cont.innerHTML = conDatos.map(function(k){
    return '<div class="saldo-metodo"><span>' + METODOS[k] + '</span><b class="' + (s[k] < 0 ? 'neg' : '') + '">' + dinero(s[k]) + '</b></div>';
  }).join('');
}

export { renderFinanzas, renderSaldoPorMetodo };
