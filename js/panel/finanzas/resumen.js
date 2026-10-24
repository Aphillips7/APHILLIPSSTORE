// =================== FINANZAS > RESUMEN (rediseno fase 4) ===================
// Periodo elegible, KPIs contra el periodo anterior, estado de resultados, punto de equilibrio y
// proyeccion, flujo de caja de 12 meses, gastos por categoria, dinero por metodo y reparto 40/30/30.
import { PERIODOS, METODOS, estadoResultados, movimientosDe, nombreMes, periodo, resultadosMes, saldosPorMetodo, ultimosMeses, inventarioDinero, cierres, claveMes } from './calculos.js';
import { dinero, esc, estadoHTML, kpiHTML, vacioHTML } from '../componentes.js';
import { barrasH, barrasLinea, dona, compacto } from '../graficas.js';
import { exportarMovimientosCSV } from '../exportar.js';
import { finMesKey } from './fechas.js';
import { state } from '../state.js';

var _per = 'mes';
const GASTO_ALTO = 20;   // % de los ingresos que se considera gasto operativo alto

function chipsPeriodo(id, actual, fn){
  var el = document.getElementById(id); if(!el) return;
  el.innerHTML = PERIODOS.map(function(p){
    return '<button type="button" class="fin-mes-btn' + (p.id === actual ? ' active' : '') + '" onclick="' + fn + '(\'' + p.id + '\')">' + p.t + '</button>';
  }).join('');
}

function renderResumen(){
  chipsPeriodo('fin-periodos', _per, 'setPeriodoResumen');
  var per = periodo(_per);
  var r = estadoResultados(movimientosDe(per.meses));
  var c = per.comp ? estadoResultados(movimientosDe(per.comp)) : null;
  renderKpis(r, c, per);
  renderAlertas(r);
  renderEstado(r);
  renderEquilibrio(r);
  renderFlujo();
  renderGastos(movimientosDe(per.meses));
  renderMetodos();
  renderReparto(r);
}

function kpi(o, c, campo, per){
  if(c){ o.actual = o.actualV; o.anterior = c[campo]; o.vs = per.vs; }
  return kpiHTML(o);
}
function renderKpis(r, c, per){
  var el = document.getElementById('fin-kpis'); if(!el) return;
  var caja = estadoResultados(state.movimientos).flujo;
  el.innerHTML = [
    kpi({ label: 'Ingresos', valor: dinero(r.ingresos), actualV: r.ingresos, pie: r.nVentas + ' venta' + (r.nVentas !== 1 ? 's' : '') + (r.nAbonos ? ' · ' + r.nAbonos + ' abono' + (r.nAbonos !== 1 ? 's' : '') : '') }, c, 'ingresos', per),
    kpi({ label: 'Ganancia bruta', valor: dinero(r.bruta), tono: r.bruta < 0 ? 'neg' : '', actualV: r.bruta, pie: 'margen ' + r.margenBruto + '%' }, c, 'bruta', per),
    kpi({ label: 'Gastos', valor: dinero(r.gastos), inverso: true, actualV: r.gastos, pie: r.ingresos ? Math.round(r.gastos / r.ingresos * 100) + '% de los ingresos' : '' }, c, 'gastos', per),
    kpi({ label: 'Ganancia neta', valor: dinero(r.neta), tono: r.neta < 0 ? 'neg' : 'pos', actualV: r.neta, pie: 'margen neto ' + r.margenNeto + '%' }, c, 'neta', per),
    kpi({ label: 'Flujo de caja', valor: dinero(r.flujo), tono: r.flujo < 0 ? 'neg' : '', actualV: r.flujo, pie: 'entradas menos salidas' }, c, 'flujo', per),
    kpiHTML({ label: 'Dinero en caja', valor: dinero(caja), tono: caja < 0 ? 'neg' : '', pie: 'saldo de todos los metodos', onclick: "irSeccion('finanzas','registrar')" })
  ].join('');
}

function renderAlertas(r){
  var el = document.getElementById('fin-alertas'); if(!el) return;
  var a = [];
  if(r.ingresos > 0 && r.gastos / r.ingresos * 100 > GASTO_ALTO) a.push(['pendiente', 'Los gastos operativos son el ' + Math.round(r.gastos / r.ingresos * 100) + '% de los ingresos (sano: menos del ' + GASTO_ALTO + '%).']);
  if(r.neta < 0 && r.ingresos > 0) a.push(['vencido', 'En este periodo los gastos superan la ganancia bruta: hay perdida de ' + dinero(-r.neta) + '.']);
  if(r.flujo < 0) a.push(['info', 'Salio mas dinero del que entro (' + dinero(r.flujo) + '). Normal si compraste inventario; revisa que no sea por gastos.']);
  var inv = inventarioDinero();
  if(inv.capital > 0 && inv.capitalEstancado / inv.capital > 0.3) a.push(['pendiente', 'El ' + Math.round(inv.capitalEstancado / inv.capital * 100) + '% de tu capital en relojes lleva mas de 60 dias sin venderse.', "irSeccion('finanzas','analisis')", 'Ver relojes']);
  var sinCerrar = mesesSinCerrar();
  if(sinCerrar.length) a.push(['info', sinCerrar.length === 1 ? nombreMes(sinCerrar[0]) + ' ya termino y no esta cerrado.' : sinCerrar.length + ' meses terminados sin cerrar.', "irSeccion('finanzas','cierres')", 'Cerrar']);
  el.innerHTML = a.map(function(x){
    return '<div class="fin-aviso">' + estadoHTML(x[0], x[0] === 'vencido' ? 'Atencion' : x[0] === 'pendiente' ? 'Revisar' : 'Dato') + '<span>' + esc(x[1]) + '</span>' +
      (x[2] ? '<button type="button" class="btn btn-outline btn-sm" onclick="' + x[2] + '">' + esc(x[3]) + '</button>' : '') + '</div>';
  }).join('');
}
// meses terminados con movimientos que no se han cerrado
function mesesSinCerrar(){
  var hoy = claveMes(new Date()), cer = cierres();
  var meses = {}; state.movimientos.forEach(function(m){ var k = finMesKey(m.fecha); if(k && k < hoy) meses[k] = true; });
  return Object.keys(meses).filter(function(k){ return !cer[k]; }).sort();
}

function fila(t, v, o){
  o = o || {};
  return '<tr class="' + (o.clase || '') + '"><td>' + t + (o.nota ? ' <span class="er-nota">' + esc(o.nota) + '</span>' : '') + '</td><td class="der">' + (o.signo || '') + dinero(v) + '</td></tr>';
}
function renderEstado(r){
  var el = document.getElementById('fin-er'); if(!el) return;
  if(!r.entradas && !r.salidas){ el.innerHTML = vacioHTML({ icono: 'grafica', titulo: 'Sin movimientos en este periodo', texto: 'Registra ventas, compras o gastos para ver el estado de resultados.', boton: 'Registrar', onclick: "irSeccion('finanzas','registrar')" }); return; }
  el.innerHTML = '<table class="er-tabla">' +
    fila('Ventas', r.ventas) + fila('Abonos de apartados', r.abonos) +
    (r.devoluciones ? fila('Devoluciones de abonos', r.devoluciones, { signo: '− ' }) : '') +
    fila('Ingresos', r.ingresos, { clase: 'er-sub' }) +
    fila('Costo de los relojes vendidos', r.costoVendido, { signo: '− ' }) +
    fila('Ganancia bruta', r.bruta, { clase: 'er-sub', nota: r.margenBruto + '%' }) +
    fila('Gastos operativos', r.gastos, { signo: '− ' }) +
    fila('Ganancia neta', r.neta, { clase: 'er-total' + (r.neta < 0 ? ' neg' : ''), nota: r.margenNeto + '%' }) +
    '<tr class="er-sep"><td colspan="2">Movimientos de caja que no son resultado</td></tr>' +
    fila('Compras de inventario', r.compras) + fila('Retiros del dueno', r.retiros) +
    fila('Flujo de caja del periodo', r.flujo, { clase: 'er-sub' + (r.flujo < 0 ? ' neg' : '') }) +
    '</table>';
}

// Punto de equilibrio: gastos fijos promedio (ultimos 3 meses cerrados del calendario) / margen bruto promedio
function renderEquilibrio(r){
  var el = document.getElementById('fin-equilibrio'); if(!el) return;
  var hoy = new Date();
  var previos = ultimosMeses(4, hoy).slice(0, 3).map(resultadosMes);
  var conDatos = previos.filter(function(x){ return x.ingresos || x.gastos; });
  var base = conDatos.length ? conDatos : [resultadosMes(claveMes(hoy))];
  var gastosProm = base.reduce(function(a, x){ return a + x.gastos; }, 0) / base.length;
  var ing = base.reduce(function(a, x){ return a + x.ingresos; }, 0), bru = base.reduce(function(a, x){ return a + x.bruta; }, 0);
  var margen = ing > 0 ? bru / ing : 0;
  var actual = resultadosMes(claveMes(hoy));
  var diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate(), dia = hoy.getDate();
  var proyIng = Math.round(actual.ingresos / dia * diasMes), proyNeta = Math.round(actual.bruta / dia * diasMes - Math.max(actual.gastos, gastosProm));
  var h = '';
  if(margen > 0 && gastosProm > 0){
    var eq = Math.round(gastosProm / margen);
    var ok = proyIng >= eq;
    h += '<div class="eq-cifra"><span class="eyebrow">Ventas minimas al mes</span><b>' + dinero(eq) + '</b></div>' +
      '<p class="eq-texto">Con gastos de ' + dinero(gastosProm) + ' al mes y un margen bruto del ' + Math.round(margen * 100) + '%, necesitas vender al menos ' + dinero(eq) + ' para no perder dinero.</p>' +
      '<div class="progress-bar"><div class="progress-fill" style="width:' + Math.min(100, eq ? Math.round(actual.ingresos / eq * 100) : 0) + '%"></div></div>' +
      '<div class="eq-pie">' + estadoHTML(actual.ingresos >= eq ? 'ok' : ok ? 'pendiente' : 'vencido', actual.ingresos >= eq ? 'Equilibrio superado' : ok ? 'Lo alcanzas al ritmo actual' : 'Por debajo del equilibrio') +
      '<span>Llevas ' + dinero(actual.ingresos) + ' este mes</span></div>';
  } else {
    h += '<p class="eq-texto">Cuando haya ventas con costo y gastos registrados aqui veras cuanto necesitas vender al mes para no perder dinero.</p>';
  }
  h += '<div class="eq-proy"><div><span class="eyebrow">Proyeccion de cierre</span><b>' + dinero(proyIng) + '</b><small>en ventas</small></div>' +
    '<div><span class="eyebrow">Ganancia neta estimada</span><b class="' + (proyNeta < 0 ? 'neg' : 'pos') + '">' + dinero(proyNeta) + '</b><small>al ritmo de ' + dia + ' dia' + (dia !== 1 ? 's' : '') + '</small></div></div>';
  el.innerHTML = h;
}

function renderFlujo(){
  var el = document.getElementById('fin-flujo-graf'); if(!el) return;
  var meses = ultimosMeses(12);
  var rs = meses.map(resultadosMes);
  var sub = document.getElementById('fin-flujo-sub');
  var tot = rs.reduce(function(a, x){ return a + x.flujo; }, 0), neta = rs.reduce(function(a, x){ return a + x.neta; }, 0);
  if(sub) sub.textContent = 'Flujo de 12 meses ' + dinero(tot) + ' · ganancia neta ' + dinero(neta);
  barrasLinea(el, { etiquetas: meses.map(function(k){ return nombreMes(k, true).slice(0, 3); }), barras: rs.map(function(x){ return x.entradas; }),
    linea: rs.map(function(x){ return x.salidas; }), nombreBarras: 'Entradas', nombreLinea: 'Salidas', resaltar: 11 });
}

function renderGastos(movs){
  var el = document.getElementById('fin-gastos-cat'); if(!el) return;
  var cat = {};
  movs.filter(function(m){ return m.tipo === 'gasto' && m.categoria !== 'Reembolso'; }).forEach(function(m){ var k = m.categoria || 'Sin categoria'; cat[k] = (cat[k] || 0) + (Number(m.monto) || 0); });
  var filas = Object.keys(cat).map(function(k){ return { label: k, valor: cat[k] }; }).sort(function(a, b){ return b.valor - a.valor; });
  var total = filas.reduce(function(a, f){ return a + f.valor; }, 0);
  el.innerHTML = filas.length ? barrasH(filas.map(function(f){ f.extra = Math.round(f.valor / total * 100) + '%'; return f; })) :
    vacioHTML({ icono: 'listo', titulo: 'Sin gastos en este periodo', boton: 'Registrar gasto', onclick: "irARegistrar('gasto')" });
}

function renderMetodos(){
  var el = document.getElementById('fin-metodos'); if(!el) return;
  var s = saldosPorMetodo();
  var filas = Object.keys(METODOS).filter(function(k){ return s.porMetodo[k]; }).map(function(k){
    return '<div class="metodo-fila"><span>' + METODOS[k] + '</span><b class="' + (s.porMetodo[k] < 0 ? 'neg' : '') + '">' + dinero(s.porMetodo[k]) + '</b></div>';
  });
  if(s.sinMetodo) filas.push('<div class="metodo-fila tenue"><span>Sin metodo (registros viejos)</span><b>' + dinero(s.sinMetodo) + '</b></div>');
  el.innerHTML = filas.length ? filas.join('') + '<button type="button" class="btn btn-outline btn-sm" style="margin-top:12px;" onclick="irARegistrar(\'traspaso\')">Mover dinero entre metodos</button>' :
    vacioHTML({ icono: 'caja', titulo: 'Sin dinero registrado por metodo' });
}

function renderReparto(r){
  var el = document.getElementById('fin-reparto'); if(!el) return;
  var g = Math.max(0, r.neta);
  if(!g){ el.innerHTML = '<p class="eq-texto">Cuando el periodo tenga ganancia neta veras como repartirla: 40 % reinversion, 30 % para ti y 30 % fondo operativo.</p>'; return; }
  dona(el, [
    { label: 'Reinversion (40 %)', valor: Math.round(g * 0.4), color: 'var(--g-actual)' },
    { label: 'Tu dinero (30 %)', valor: Math.round(g * 0.3), color: 'var(--g-comp)' },
    { label: 'Fondo operativo (30 %)', valor: Math.round(g * 0.3), color: 'var(--g-meta)' }
  ], { valor: compacto(g), texto: 'ganancia neta' });
}

function setPeriodoResumen(id){ _per = id; renderResumen(); }
// Exporta a Excel los movimientos del periodo elegido en Resumen
function exportarPeriodoCSV(){
  var per = periodo(_per);
  var etiqueta = (PERIODOS.find(function(p){ return p.id === _per; }) || {}).t || 'todo';
  exportarMovimientosCSV(per.meses ? function(m){ return per.meses.indexOf(finMesKey(m.fecha)) !== -1; } : null, 'movimientos-' + etiqueta.toLowerCase().replace(/\s+/g, '-'));
}

export { chipsPeriodo, mesesSinCerrar, renderResumen, setPeriodoResumen };
// Usadas desde atributos onclick del HTML
Object.assign(window, { exportarPeriodoCSV, setPeriodoResumen });
