// =================== FINANZAS > CIERRES DE MES (rediseno fase 4) ===================
// Cerrar un mes guarda su resumen y bloquea borrar movimientos de ese mes (poka-yoke: los numeros
// de un mes ya revisado no cambian por accidente). Solo se cierran meses terminados; reabrir pide
// confirmacion. Los cierres viven en config/main (state.cierres) y se sincronizan como la meta.
import { dinero, esc, estadoHTML, kpiHTML, tablaHTML } from '../componentes.js';
import { claveMes, cierres, estadoResultados, movimientosDelMes, nombreMes, resultadosMes } from './calculos.js';
import { finMesKey } from './fechas.js';
import { descargarCSV } from '../exportar.js';
import { save, state } from '../state.js';

function mesesConMovimientos(){
  var m = {}; state.movimientos.forEach(function(x){ var k = finMesKey(x.fecha); if(k) m[k] = true; });
  Object.keys(cierres()).forEach(function(k){ m[k] = true; });
  return Object.keys(m).sort().reverse();
}
function huella(r){ return [r.ingresos, r.costoVendido, r.gastos, r.compras, r.retiros].map(Math.round).join('|'); }

function renderCierres(){
  var hoy = claveMes(new Date()), cer = cierres();
  var meses = mesesConMovimientos();
  var pendientes = meses.filter(function(k){ return k < hoy && !cer[k]; });
  var k = document.getElementById('fin-kpis-cierres');
  var ultimo = Object.keys(cer).sort().pop();
  if(k) k.innerHTML = [
    kpiHTML({ label: 'Meses cerrados', valor: String(Object.keys(cer).length), pie: ultimo ? 'ultimo: ' + nombreMes(ultimo) : 'ninguno todavia' }),
    kpiHTML({ label: 'Por cerrar', valor: String(pendientes.length), tono: pendientes.length ? 'neg' : '', pie: pendientes.length ? 'el mas viejo: ' + nombreMes(pendientes[pendientes.length - 1]) : 'al dia' })
  ].join('');
  var t = document.getElementById('fin-tabla-cierres'); if(!t) return;
  t.innerHTML = tablaHTML([{ t: 'Mes' }, { t: 'Ingresos', der: true }, { t: 'Ganancia neta', der: true }, { t: 'Gastos', der: true }, { t: 'Flujo', der: true }, { t: 'Estado' }, { t: '' }],
    meses.map(function(m){
      var r = resultadosMes(m), c = cer[m];
      var est, accion = '';
      if(m === hoy){ est = estadoHTML('info', 'En curso'); }
      else if(c){
        est = estadoHTML('ok', 'Cerrado ' + (c.cerradoEl || ''));
        if(c.huella && c.huella !== huella(r)) est += ' ' + estadoHTML('pendiente', 'Cambio despues del cierre');
        accion = '<button type="button" class="btn btn-outline btn-sm" onclick="reabrirMes(\'' + m + '\')">Reabrir</button>';
      } else {
        est = estadoHTML('pendiente', 'Sin cerrar');
        accion = '<button type="button" class="btn btn-gold btn-sm" onclick="cerrarMes(\'' + m + '\')">Cerrar mes</button>';
      }
      return ['<b>' + esc(nombreMes(m)) + '</b>', dinero(r.ingresos), '<span class="' + (r.neta < 0 ? 'neg' : 'pos') + '">' + dinero(r.neta) + '</span>', dinero(r.gastos), dinero(r.flujo), est, accion];
    }), { icono: 'grafica', titulo: 'Todavia no hay meses con movimientos' });
}

function cerrarMes(m){
  var hoy = claveMes(new Date());
  if(!m || m >= hoy){ alert('Solo se puede cerrar un mes que ya termino.'); return; }
  if(cierres()[m]) return;
  var r = resultadosMes(m);
  if(!confirm('Cerrar ' + nombreMes(m) + '\n\nIngresos: ' + dinero(r.ingresos) + '\nGanancia neta: ' + dinero(r.neta) + '\nGastos: ' + dinero(r.gastos) +
    '\n\nDespues de cerrarlo no se podran borrar movimientos de ese mes (puedes reabrirlo si hace falta). ¿Los numeros estan bien?')) return;
  if(!state.cierres) state.cierres = {};
  state.cierres[m] = { cerradoEl: new Date().toLocaleDateString('es-MX'), ingresos: Math.round(r.ingresos), neta: Math.round(r.neta),
    gastos: Math.round(r.gastos), flujo: Math.round(r.flujo), movimientos: movimientosDelMes(m).length, huella: huella(r) };
  save('cierres');
  renderCierres();
}
function reabrirMes(m){
  if(!cierres()[m]) return;
  if(!confirm('Reabrir ' + nombreMes(m) + '?\n\nSe podran volver a borrar movimientos de ese mes. Cierralo de nuevo cuando termines de corregir.')) return;
  delete state.cierres[m];
  save('cierres');
  renderCierres();
}
// Estado de resultados mes por mes (para el contador o la declaracion)
function exportarCierresCSV(){
  var filas = [['Mes', 'Ventas', 'Abonos', 'Devoluciones', 'Ingresos', 'Costo vendido', 'Ganancia bruta', 'Margen bruto %', 'Gastos', 'Ganancia neta', 'Margen neto %', 'Compras', 'Retiros', 'Flujo de caja', 'Cerrado']];
  mesesConMovimientos().slice().reverse().forEach(function(m){
    var r = estadoResultados(movimientosDelMes(m)), c = cierres()[m];
    filas.push([nombreMes(m), r.ventas, r.abonos, r.devoluciones, r.ingresos, r.costoVendido, r.bruta, r.margenBruto, r.gastos, r.neta, r.margenNeto, r.compras, r.retiros, r.flujo, c ? c.cerradoEl : '']);
  });
  descargarCSV('estado-de-resultados-aphillips', filas);
}

export { cerrarMes, reabrirMes, renderCierres };
Object.assign(window, { cerrarMes, exportarCierresCSV, reabrirMes });
