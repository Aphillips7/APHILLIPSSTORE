// =================== CALCULOS DE FINANZAS (rediseno fase 4) ===================
// Una sola forma de contar el dinero para todo el panel (Dashboard, Finanzas, cierres):
//   Ingresos        = ventas + abonos de apartados - devoluciones de abonos (gasto "Reembolso")
//   Costo vendido   = costo de los relojes vendidos (el abono no lleva costo: el costo completo va en la venta del saldo)
//   Ganancia bruta  = ingresos - costo vendido
//   Gastos          = gastos operativos (sin los reembolsos)
//   Ganancia neta   = ganancia bruta - gastos
//   Flujo de caja   = entradas (ventas + abonos) - salidas (compras + gastos + retiros)
// Las compras de inventario no son gasto (el costo se reconoce al vender) y los retiros son dinero del dueno.
import { finMesKey, finParseFecha } from './fechas.js';
import { diasEnInventario } from '../../products.js';
import { state } from '../state.js';

const METODOS = { efectivo: 'Efectivo', yappy: 'Yappy', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro' };
const CANALES = { instagram: 'Instagram', directo: 'Venta directa', facebook: 'Facebook', whatsapp: 'WhatsApp', web: 'Tienda web', otro: 'Otro' };
const MESES_C = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_L = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_PLAZO_ABONO = 30;    // sin fecha limite propia, una reserva vence a los 30 dias de apartada
const DIAS_ESTANCADO = 60;      // un reloj disponible mas de 60 dias es capital estancado

function num(v){ return Number(v) || 0; }
function esReembolso(m){ return m.tipo === 'gasto' && m.categoria === 'Reembolso'; }
function claveMes(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function nombreMes(clave, corto){
  if(!clave) return '';
  var p = clave.split('-');
  return (corto ? MESES_C : MESES_L)[parseInt(p[1], 10) - 1] + ' ' + p[0];
}

// Estado de resultados y flujo de una lista de movimientos
function estadoResultados(movs){
  var r = { ventas: 0, abonos: 0, devoluciones: 0, ingresos: 0, costoVendido: 0, bruta: 0, gastos: 0, neta: 0,
    compras: 0, retiros: 0, entradas: 0, salidas: 0, flujo: 0, nVentas: 0, nAbonos: 0, descuentos: 0 };
  movs.forEach(function(m){
    var monto = num(m.monto);
    if(m.tipo === 'venta'){ r.ventas += monto; r.costoVendido += num(m.costo); if(!m._soloRegistro) r.nVentas++;
      if(m.precioObjetivo && num(m.precioObjetivo) > monto) r.descuentos += num(m.precioObjetivo) - monto; }
    else if(m.tipo === 'abono'){ r.abonos += monto; r.nAbonos++; }
    else if(m.tipo === 'compra') r.compras += monto;
    else if(m.tipo === 'retiro') r.retiros += monto;
    else if(m.tipo === 'gasto'){ if(esReembolso(m)) r.devoluciones += monto; else r.gastos += monto; }
  });
  r.ingresos = r.ventas + r.abonos - r.devoluciones;
  r.bruta = r.ingresos - r.costoVendido;
  r.neta = r.bruta - r.gastos;
  r.margenBruto = r.ingresos > 0 ? Math.round(r.bruta / r.ingresos * 100) : 0;
  r.margenNeto = r.ingresos > 0 ? Math.round(r.neta / r.ingresos * 100) : 0;
  r.entradas = r.ventas + r.abonos;
  r.salidas = r.compras + r.gastos + r.devoluciones + r.retiros;
  r.flujo = r.entradas - r.salidas;
  r.ticket = r.nVentas ? Math.round((r.ventas + r.abonos) / r.nVentas) : 0;
  return r;
}
function movimientosDelMes(clave){ return state.movimientos.filter(function(m){ return finMesKey(m.fecha) === clave; }); }
function resultadosMes(clave){ return estadoResultados(movimientosDelMes(clave)); }

// ---------- periodos ----------
// mes | anterior | 3m | anio | todo. Cada uno sabe con que compararse (el periodo anterior del mismo largo).
const PERIODOS = [
  { id: 'mes', t: 'Este mes' }, { id: 'anterior', t: 'Mes anterior' }, { id: '3m', t: 'Ultimos 3 meses' },
  { id: 'anio', t: 'Este ano' }, { id: 'todo', t: 'Todo' }
];
function rangoMeses(desde, n){
  var out = [];
  for(var i = 0; i < n; i++) out.push(claveMes(new Date(desde.getFullYear(), desde.getMonth() + i, 1)));
  return out;
}
function periodo(id, hoy){
  hoy = hoy || new Date();
  var y = hoy.getFullYear(), m = hoy.getMonth();
  if(id === 'anterior') return { meses: rangoMeses(new Date(y, m - 1, 1), 1), comp: rangoMeses(new Date(y, m - 2, 1), 1), vs: 'vs el mes previo' };
  if(id === '3m') return { meses: rangoMeses(new Date(y, m - 2, 1), 3), comp: rangoMeses(new Date(y, m - 5, 1), 3), vs: 'vs los 3 meses previos' };
  if(id === 'anio') return { meses: rangoMeses(new Date(y, 0, 1), m + 1), comp: rangoMeses(new Date(y - 1, 0, 1), m + 1), vs: 'vs mismo periodo ' + (y - 1) };
  if(id === 'todo') return { meses: null, comp: null, vs: '' };
  return { meses: rangoMeses(new Date(y, m, 1), 1), comp: rangoMeses(new Date(y, m - 1, 1), 1), vs: 'vs mes anterior' };
}
function movimientosDe(meses){
  if(!meses) return state.movimientos.slice();
  return state.movimientos.filter(function(m){ return meses.indexOf(finMesKey(m.fecha)) !== -1; });
}

// Ultimos n meses (para graficas), del mas viejo al actual
function ultimosMeses(n, hoy){
  hoy = hoy || new Date();
  return rangoMeses(new Date(hoy.getFullYear(), hoy.getMonth() - n + 1, 1), n);
}

// ---------- caja ----------
function saldosPorMetodo(){
  var s = {}; Object.keys(METODOS).forEach(function(k){ s[k] = 0; });
  var sinMetodo = 0;
  state.movimientos.forEach(function(m){
    var monto = num(m.monto);
    if(m.tipo === 'traspaso'){
      if(m.metodoOrigen in s) s[m.metodoOrigen] -= monto;
      if(m.metodoDestino in s) s[m.metodoDestino] += monto;
      return;
    }
    var signo = (m.tipo === 'venta' || m.tipo === 'abono') ? 1 : (m.tipo === 'compra' || m.tipo === 'gasto' || m.tipo === 'retiro') ? -1 : 0;
    if(!signo) return;
    if(m.metodoPago in s) s[m.metodoPago] += signo * monto; else sinMetodo += signo * monto;
  });
  return { porMetodo: s, sinMetodo: sinMetodo };
}
function saldoTotal(){ var r = estadoResultados(state.movimientos); return r.flujo; }

// ---------- inventario como dinero ----------
function costoDe(p){ return num(p.costoTotal) || (num(p.costo) + num(p.importacion)); }
function inventarioDinero(){
  var enStock = state.inventario.filter(function(p){ return ['disponible', 'transito', 'reservado'].indexOf(p.estado) !== -1; });
  var disponibles = state.inventario.filter(function(p){ return p.estado === 'disponible'; });
  var estancados = disponibles.map(function(p){ return { p: p, dias: diasEnInventario(p.fecha) }; })
    .filter(function(x){ return x.dias !== null && x.dias > DIAS_ESTANCADO; })
    .sort(function(a, b){ return b.dias - a.dias; });
  // dias promedio para vender: alta -> venta de los vendidos con ambas fechas
  var tiempos = state.inventario.filter(function(p){ return p.estado === 'vendido' && p.fecha && p.fechaVenta; }).map(function(p){
    var a = finParseFecha(p.fecha), b = finParseFecha(p.fechaVenta);
    return a && b ? Math.max(0, Math.round((b - a) / 86400000)) : null;
  }).filter(function(d){ return d !== null; });
  return {
    capital: enStock.reduce(function(a, p){ return a + costoDe(p); }, 0),
    aPrecio: enStock.reduce(function(a, p){ return a + num(p.precio); }, 0),
    unidades: enStock.length,
    estancados: estancados,
    capitalEstancado: estancados.reduce(function(a, x){ return a + costoDe(x.p); }, 0),
    diasVenta: tiempos.length ? Math.round(tiempos.reduce(function(a, b){ return a + b; }, 0) / tiempos.length) : null,
    nVendidos: tiempos.length
  };
}

// ---------- reservas ----------
function totalAbonado(p){ return ((p.reserva && p.reserva.abonos) || []).reduce(function(a, x){ return a + num(x.monto); }, 0); }
function fechaLimiteReserva(p){
  if(!p.reserva) return null;
  if(p.reserva.fechaLimite){ var f = finParseFecha(p.reserva.fechaLimite); if(f) return f; }
  var ini = finParseFecha(p.reserva.fechaInicio); if(!ini) return null;
  return new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + DIAS_PLAZO_ABONO);
}
// dias que faltan para la fecha limite (negativo = vencida)
function diasParaLimite(p, hoy){
  var f = fechaLimiteReserva(p); if(!f) return null;
  hoy = hoy || new Date();
  var h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((f - h) / 86400000);
}
function reservasPorCobrar(){
  return state.inventario.filter(function(p){ return p.estado === 'reservado' && p.reserva; }).map(function(p){
    var abonado = totalAbonado(p), acordado = num(p.reserva.precioAcordado);
    return { p: p, acordado: acordado, abonado: abonado, saldo: Math.max(0, acordado - abonado), dias: diasParaLimite(p) };
  }).sort(function(a, b){ return (a.dias === null ? 9999 : a.dias) - (b.dias === null ? 9999 : b.dias); });
}

// ---------- cierres de mes ----------
function cierres(){ return state.cierres || {}; }
function mesCerrado(clave){ return !!(clave && cierres()[clave]); }
function fechaEnMesCerrado(fecha){ return mesCerrado(finMesKey(fecha)); }

export { CANALES, DIAS_ESTANCADO, DIAS_PLAZO_ABONO, METODOS, MESES_C, MESES_L, PERIODOS, claveMes, costoDe, diasParaLimite,
  estadoResultados, fechaEnMesCerrado, fechaLimiteReserva, inventarioDinero, mesCerrado, movimientosDe, movimientosDelMes,
  nombreMes, periodo, reservasPorCobrar, resultadosMes, saldoTotal, saldosPorMetodo, totalAbonado, ultimosMeses, cierres };
