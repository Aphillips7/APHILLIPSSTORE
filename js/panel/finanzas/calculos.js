// =================== CALCULOS DE FINANZAS (rediseno fase 4) ===================
// Una sola forma de contar el dinero para todo el panel (Dashboard, Finanzas, cierres):
//   Ingresos        = ventas + abonos de apartados - devoluciones de abonos (gasto "Reembolso")
//   Costo vendido   = costo de los relojes vendidos (el abono no lleva costo: el costo completo va en la venta del saldo)
//   Ganancia bruta  = ingresos - costo vendido
//   Gastos          = gastos operativos (sin los reembolsos)
//   Ganancia neta   = ganancia bruta - gastos
//   Flujo de caja   = entradas (ventas + abonos + aportes) - salidas (compras + gastos + retiros)
// Las compras de inventario no son gasto (el costo se reconoce al vender). Los aportes (dinero que el dueno pone)
// y los retiros (dinero que saca) mueven la caja pero no son ingreso ni gasto.
// Relojes vendidos = movimientos de venta, tambien los apartados ya pagados con abonos (venta de $0 "_soloRegistro").
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
// +1 dinero que entra a la caja, -1 dinero que sale (traspaso y apartado cancelado no cambian el total)
const SIGNO = { venta: 1, abono: 1, aporte: 1, compra: -1, gasto: -1, retiro: -1 };
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
    compras: 0, retiros: 0, aportes: 0, entradas: 0, salidas: 0, flujo: 0, nVentas: 0, nAbonos: 0, descuentos: 0 };
  movs.forEach(function(m){
    var monto = num(m.monto);
    if(m.tipo === 'venta'){ r.ventas += monto; r.costoVendido += num(m.costo); r.nVentas++;
      if(m.precioObjetivo && num(m.precioObjetivo) > monto) r.descuentos += num(m.precioObjetivo) - monto; }
    else if(m.tipo === 'abono'){ r.abonos += monto; r.nAbonos++; }
    else if(m.tipo === 'compra') r.compras += monto;
    else if(m.tipo === 'retiro') r.retiros += monto;
    else if(m.tipo === 'aporte') r.aportes += monto;
    else if(m.tipo === 'gasto'){ if(esReembolso(m)) r.devoluciones += monto; else r.gastos += monto; }
  });
  r.ingresos = r.ventas + r.abonos - r.devoluciones;
  r.bruta = r.ingresos - r.costoVendido;
  r.neta = r.bruta - r.gastos;
  r.margenBruto = r.ingresos > 0 ? Math.round(r.bruta / r.ingresos * 100) : 0;
  r.margenNeto = r.ingresos > 0 ? Math.round(r.neta / r.ingresos * 100) : 0;
  r.vendido = r.ventas + r.abonos;          // lo cobrado por relojes (sin aportes)
  r.entradas = r.vendido + r.aportes;
  r.salidas = r.compras + r.gastos + r.devoluciones + r.retiros;
  r.flujo = r.entradas - r.salidas;
  // ticket: lo cobrado por reloj vendido (los abonos de apartados todavia abiertos no se cuentan)
  var abonosAbiertos = movs.filter(function(m){ return m.tipo === 'abono' && m.invId && state.inventario.some(function(p){ return p.id === m.invId && p.estado === 'reservado'; }); }).reduce(function(a, m){ return a + num(m.monto); }, 0);
  r.ticket = r.nVentas ? Math.round((r.ventas + r.abonos - abonosAbiertos) / r.nVentas) : 0;
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
    var signo = SIGNO[m.tipo] || 0;
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

// ---------- ventas por reloj ----------
// Cada venta con lo que realmente se cobro por ese reloj: en un apartado la venta solo trae el saldo final
// (o $0 si se pago todo con abonos) y los abonos van aparte; aqui se suman por invId para ver el reloj entero.
function cobradoDeVenta(m){
  var deApartado = m._deApartado || /Saldo final de|Venta completada con/.test(m.desc || '');
  if(!(m.invId && deApartado)) return num(m.monto);
  return num(m.monto) + state.movimientos.filter(function(x){ return x.tipo === 'abono' && x.invId === m.invId; }).reduce(function(a, x){ return a + num(x.monto); }, 0);
}
function ventasPorReloj(movs){
  return movs.filter(function(m){ return m.tipo === 'venta'; }).map(function(m){
    var cobrado = cobradoDeVenta(m);
    return { m: m, cobrado: cobrado, costo: num(m.costo), ganancia: cobrado - num(m.costo), margen: cobrado > 0 ? Math.round((cobrado - num(m.costo)) / cobrado * 100) : 0 };
  }).filter(function(x){ return x.cobrado > 0 || x.costo > 0; });
}

// ---------- revision de datos (auditoria) ----------
// Datos que hacen que los numeros no cuadren, cada uno con como arreglarlo.
function revisionDatos(){
  var out = [];
  var sinMetodo = state.movimientos.filter(function(m){ return SIGNO[m.tipo] && !(m.metodoPago in METODOS) && num(m.monto) > 0; });
  if(sinMetodo.length) out.push({ id: 'sinMetodo', tipo: 'pendiente', n: sinMetodo.length, monto: sinMetodo.reduce(function(a, m){ return a + SIGNO[m.tipo] * num(m.monto); }, 0),
    texto: sinMetodo.length + ' movimiento' + (sinMetodo.length !== 1 ? 's' : '') + ' sin metodo de pago: el dinero por metodo (Yappy, efectivo...) no cuadra.', boton: 'Asignar metodo', accion: "irSeccion('finanzas','movimientos');filtrarMovimientos('sinmetodo')" });
  var vendSinCosto = state.movimientos.filter(function(m){ return m.tipo === 'venta' && !num(m.costo) && (num(m.monto) > 0); });
  if(vendSinCosto.length) out.push({ id: 'ventaSinCosto', tipo: 'vencido', n: vendSinCosto.length,
    texto: vendSinCosto.length + ' venta' + (vendSinCosto.length !== 1 ? 's' : '') + ' sin costo del reloj: la ganancia sale inflada (cuenta como si el reloj fuera gratis).', boton: 'Ver', accion: "irSeccion('finanzas','movimientos');filtrarMovimientos('venta')" });
  var sinCompra = state.inventario.filter(function(p){
    if(['disponible', 'reservado', 'vendido'].indexOf(p.estado) === -1 || !(costoDe(p) > 0)) return false;
    return !state.movimientos.some(function(m){ return m.tipo === 'compra' && (m.invId ? m.invId === p.id : m.desc === p.nombre + (p.sku ? ' · Ref. ' + p.sku : '')); });
  });
  if(sinCompra.length) out.push({ id: 'sinCompra', tipo: 'pendiente', n: sinCompra.length, monto: -sinCompra.reduce(function(a, p){ return a + costoDe(p); }, 0),
    texto: sinCompra.length + ' reloj' + (sinCompra.length !== 1 ? 'es' : '') + ' con costo pero sin su compra registrada: la caja muestra mas dinero del real.', boton: 'Registrar compra', accion: "irARegistrar('compra')" });
  var difCompra = state.movimientos.filter(function(m){
    if(m.tipo !== 'compra' || !m.invId) return false;
    var p = state.inventario.find(function(x){ return x.id === m.invId; });
    return p && costoDe(p) > 0 && Math.abs(costoDe(p) - num(m.monto)) >= 1 && state.movimientos.filter(function(x){ return x.tipo === 'compra' && x.invId === m.invId; }).length === 1;
  });
  if(difCompra.length) out.push({ id: 'difCompra', tipo: 'info', n: difCompra.length,
    texto: difCompra.length + ' compra' + (difCompra.length !== 1 ? 's' : '') + ' con un monto distinto al costo del reloj (¿cambiaste el costo despues?).', boton: 'Ver', accion: "irSeccion('finanzas','movimientos');filtrarMovimientos('compra')" });
  var caja = estadoResultados(state.movimientos).flujo;
  if(caja < 0) out.push({ id: 'cajaNegativa', tipo: 'info', monto: caja,
    texto: 'La caja da ' + Math.round(caja).toLocaleString('en-US') + ': falta registrar el dinero que pusiste en el negocio (aporte de capital) o alguna venta.', boton: 'Registrar aporte', accion: "irARegistrar('aporte')" });
  return out;
}

// ---------- cierres de mes ----------
function cierres(){ return state.cierres || {}; }
function mesCerrado(clave){ return !!(clave && cierres()[clave]); }
function fechaEnMesCerrado(fecha){ return mesCerrado(finMesKey(fecha)); }

export { CANALES, DIAS_ESTANCADO, DIAS_PLAZO_ABONO, METODOS, MESES_C, MESES_L, PERIODOS, SIGNO, claveMes, costoDe, diasParaLimite, cobradoDeVenta, revisionDatos, ventasPorReloj,
  estadoResultados, fechaEnMesCerrado, fechaLimiteReserva, inventarioDinero, mesCerrado, movimientosDe, movimientosDelMes,
  nombreMes, periodo, reservasPorCobrar, resultadosMes, saldoTotal, saldosPorMetodo, totalAbonado, ultimosMeses, cierres };
