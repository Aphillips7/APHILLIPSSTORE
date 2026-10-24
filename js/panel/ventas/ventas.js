// =================== VENTAS (rediseno fase 5) ===================
// Resumen comercial (KPIs del periodo, embudo de pedidos web, canales, mejores dias y mejores clientes),
// Apartados (saldo, barra de pago, fecha limite y acciones) e Historial de ventas con filtros.
// Los pedidos web viven en ventas/pedidos-web.js.
import { CANALES, METODOS, claveMes, estadoResultados, fechaLimiteReserva, movimientosDe, periodo, reservasPorCobrar, ultimosMeses } from '../finanzas/calculos.js';
import { finParseFecha } from '../finanzas/fechas.js';
import { chipsPeriodo } from '../finanzas/resumen.js';
import { dinero, esc, estadoHTML, kpiHTML, tablaHTML, vacioHTML } from '../componentes.js';
import { barrasH } from '../graficas.js';
import { exportarMovimientosCSV } from '../exportar.js';
import { save, state } from '../state.js';

const PASOS = ['solicitado', 'confirmado', 'pagado', 'enviado', 'entregado'];
const NOMBRE_PASO = { solicitado: 'Solicitados', confirmado: 'Confirmados', pagado: 'Pagados', enviado: 'Enviados', entregado: 'Entregados', cancelado: 'Cancelados' };
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
const PLAZO_MAX = 90;   // un apartado no puede extenderse mas alla de 90 dias desde que se aparto
var _per = 'mes', _perHist = 'mes', _vista = 'resumen';

function pedidos(){ return window.__pedidosWeb || []; }
function hecho(p, estado){ return (p.historial || []).find(function(h){ return h.estado === estado; }); }
function ventasDe(meses){ return movimientosDe(meses).filter(function(m){ return m.tipo === 'venta' && !m._soloRegistro; }); }

// ---------- vista activa ----------
function mostrarVistaVentas(v){
  _vista = v || 'resumen';
  document.querySelectorAll('#page-ventas [data-vista]').forEach(function(el){ el.hidden = el.getAttribute('data-vista') !== _vista; });
  refrescarVentas();
}
function refrescarVentas(){
  var pag = document.getElementById('page-ventas');
  if(pag && pag.classList.contains('active')){
    if(_vista === 'resumen') renderResumenVentas();
    if(_vista === 'apartados') renderApartados();
    if(_vista === 'historial') renderHistorialVentas();
  }
  var fc = document.getElementById('fin-cobrar');
  if(fc && fc.classList.contains('active') && window.renderCobrar) window.renderCobrar();
}
document.addEventListener('pedidos-web', function(){ if(_vista === 'resumen') refrescarVentas(); });

// ---------- resumen ----------
function renderResumenVentas(){
  chipsPeriodo('ven-periodos', _per, 'setPeriodoVentas');
  var per = periodo(_per);
  var r = estadoResultados(movimientosDe(per.meses)), c = per.comp ? estadoResultados(movimientosDe(per.comp)) : null;
  var enPer = function(ms){ return !per.meses || per.meses.indexOf(claveMes(new Date(ms))) !== -1; };
  var ped = pedidos().filter(function(p){ return enPer(p.creado); });
  var ganados = ped.filter(function(p){ return ['pagado', 'enviado', 'entregado'].indexOf(p.estado) !== -1; });
  var cancel = ped.filter(function(p){ return p.estado === 'cancelado'; });
  var tiempos = pedidos().map(function(p){ var e = hecho(p, 'entregado'); return e && enPer(e.fecha) ? (e.fecha - p.creado) / 86400000 : null; }).filter(function(x){ return x !== null; });
  var k = document.getElementById('ven-kpis');
  var vs = function(o, campo){ if(c){ o.actual = r[campo]; o.anterior = c[campo]; o.vs = per.vs; } return kpiHTML(o); };
  if(k) k.innerHTML = [
    vs({ label: 'Vendido', valor: dinero(r.ventas + r.abonos), pie: 'ventas y abonos' }, 'entradas'),
    vs({ label: 'Relojes vendidos', valor: String(r.nVentas) }, 'nVentas'),
    vs({ label: 'Ticket promedio', valor: dinero(r.ticket) }, 'ticket'),
    kpiHTML({ label: 'Conversion web', valor: ped.length ? Math.round(ganados.length / ped.length * 100) + '%' : '—', pie: ganados.length + ' de ' + ped.length + ' pedidos pagados' }),
    kpiHTML({ label: 'Pedido a entrega', valor: tiempos.length ? (Math.round(tiempos.reduce(function(a, b){ return a + b; }, 0) / tiempos.length * 10) / 10) + ' d' : '—', pie: tiempos.length ? 'promedio de ' + tiempos.length + ' entregas' : 'sin entregas web' }),
    kpiHTML({ label: 'Cancelados', valor: ped.length ? Math.round(cancel.length / ped.length * 100) + '%' : '—', tono: ped.length && cancel.length / ped.length > 0.25 ? 'neg' : '', pie: cancel.length + ' pedido' + (cancel.length !== 1 ? 's' : '') + ' web' })
  ].join('');

  // embudo de pedidos web del periodo: cuantos llegaron a cada paso
  var em = document.getElementById('ven-embudo');
  if(em){
    if(!ped.length) em.innerHTML = vacioHTML({ icono: 'grafica', titulo: 'Sin pedidos web en este periodo', texto: 'Llegan cuando un cliente con cuenta toca "Comprar por WhatsApp" en la tienda.' });
    else {
      var llego = function(p, paso){ return PASOS.indexOf(p.estado) >= PASOS.indexOf(paso) || !!hecho(p, paso); };
      em.innerHTML = '<div class="embudo">' + PASOS.map(function(paso){
        var n = ped.filter(function(p){ return llego(p, paso); }).length;
        return '<div class="embudo-paso"><span>' + NOMBRE_PASO[paso] + '</span><div class="embudo-barra"><i style="width:' + Math.max(4, Math.round(n / ped.length * 100)) + '%"></i></div><b>' + n + '</b></div>';
      }).join('') + (cancel.length ? '<div class="embudo-paso cancel"><span>Cancelados</span><div class="embudo-barra"><i style="width:' + Math.max(4, Math.round(cancel.length / ped.length * 100)) + '%"></i></div><b>' + cancel.length + '</b></div>' : '') + '</div>';
    }
  }

  var ventas = ventasDe(per.meses);
  // canales
  var can = {}; ventas.forEach(function(m){ var x = m.canal || 'otro'; can[x] = (can[x] || 0) + (Number(m.monto) || 0); });
  var total = ventas.reduce(function(a, m){ return a + (Number(m.monto) || 0); }, 0);
  var ec = document.getElementById('ven-canales');
  if(ec) ec.innerHTML = ventas.length ? barrasH(Object.keys(can).sort(function(a, b){ return can[b] - can[a]; }).map(function(x){ return { label: CANALES[x] || x, valor: can[x], extra: Math.round(can[x] / total * 100) + '%' }; })) :
    vacioHTML({ icono: 'grafica', titulo: 'Sin ventas en este periodo', boton: 'Registrar venta', onclick: "irARegistrar('venta')" });

  // mejores dias (ultimos 12 meses, para que haya suficientes datos)
  var dias = [0, 0, 0, 0, 0, 0, 0], cuenta = [0, 0, 0, 0, 0, 0, 0];
  ventasDe(ultimosMeses(12)).forEach(function(m){ var d = finParseFecha(m.fecha); if(d){ dias[d.getDay()] += Number(m.monto) || 0; cuenta[d.getDay()]++; } });
  var ed = document.getElementById('ven-dias');
  if(ed){
    var orden = [1, 2, 3, 4, 5, 6, 0];
    var mejores = orden.slice().sort(function(a, b){ return dias[b] - dias[a]; }).filter(function(i){ return dias[i] > 0; }).slice(0, 2);
    ed.innerHTML = dias.some(Boolean) ? barrasH(orden.map(function(i){ return { label: DIAS[i], valor: dias[i], extra: cuenta[i] + ' venta' + (cuenta[i] !== 1 ? 's' : '') }; })) +
      '<div class="top-nota">Tus mejores dias: <b>' + mejores.map(function(i){ return DIAS[i]; }).join(' y ') + '</b>. Publica y haz historias el dia anterior.</div>' :
      vacioHTML({ icono: 'grafica', titulo: 'Aun no hay ventas suficientes' });
  }

  // mejores clientes del periodo
  var cli = {};
  ventas.forEach(function(m){ var n = m.clienteNombre; if(!n) return; var x = cli[n] || (cli[n] = { v: 0, n: 0 }); x.v += Number(m.monto) || 0; x.n++; });
  var top = Object.keys(cli).sort(function(a, b){ return cli[b].v - cli[a].v; }).slice(0, 6);
  var et = document.getElementById('ven-clientes-top');
  if(et) et.innerHTML = top.length ? barrasH(top.map(function(n){ return { label: n, valor: cli[n].v, extra: cli[n].n + ' compra' + (cli[n].n !== 1 ? 's' : '') }; })) +
    '<div class="tenue-peq">' + Math.round(ventas.filter(function(m){ return !m.clienteNombre; }).length / Math.max(1, ventas.length) * 100) + '% de las ventas no tiene cliente asignado: asignalo al registrar para conocer a quien te compra.</div>' :
    vacioHTML({ icono: 'persona', titulo: 'Ventas sin cliente asignado', texto: 'Elige el cliente al registrar la venta para ver aqui a tus mejores compradores.' });
}
function setPeriodoVentas(id){ _per = id; renderResumenVentas(); }

// ---------- apartados ----------
function fechaTxt(d){ return d ? d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() : '—'; }
function renderApartados(){
  var lista = reservasPorCobrar();
  var k = document.getElementById('ven-kpis-apartados');
  var saldo = lista.reduce(function(a, x){ return a + x.saldo; }, 0), venc = lista.filter(function(x){ return x.saldo > 0 && x.dias !== null && x.dias < 0; });
  if(k) k.innerHTML = [
    kpiHTML({ label: 'Apartados', valor: String(lista.length), pie: dinero(lista.reduce(function(a, x){ return a + x.acordado; }, 0)) + ' en total' }),
    kpiHTML({ label: 'Falta cobrar', valor: dinero(saldo) }),
    kpiHTML({ label: 'Vencidos', valor: String(venc.length), tono: venc.length ? 'neg' : '', pie: venc.length ? dinero(venc.reduce(function(a, x){ return a + x.saldo; }, 0)) : 'ninguno' })
  ].join('');
  var el = document.getElementById('ven-apartados'); if(!el) return;
  if(!lista.length){ el.innerHTML = vacioHTML({ icono: 'listo', titulo: 'No hay relojes apartados', texto: 'Aparta un reloj desde Inventario con el boton "Reservar".', boton: 'Ir a Inventario', onclick: "irSeccion('inventario','relojes')" }); return; }
  el.innerHTML = '<div class="apartados">' + lista.map(function(x){
    var p = x.p, r = p.reserva, id = esc(p.id), pct = x.acordado ? Math.min(100, Math.round(x.abonado / x.acordado * 100)) : 0;
    var est = x.saldo <= 0 ? estadoHTML('ok', 'Pagado: falta entregar') : x.dias === null ? estadoHTML('info', 'Sin fecha') :
      x.dias < 0 ? estadoHTML('vencido', 'Vencido hace ' + (-x.dias) + ' d') : x.dias <= 7 ? estadoHTML('pendiente', 'Vence en ' + x.dias + ' d') : estadoHTML('ok', 'Quedan ' + x.dias + ' d');
    var ini = finParseFecha(r.fechaInicio), lim = fechaLimiteReserva(p);
    var puedeExt = ini && lim && (lim - ini) / 86400000 + 7 <= PLAZO_MAX && x.saldo > 0;
    return '<div class="apartado">' +
      '<div class="apartado-cab"><div><b>' + esc(p.nombre) + '</b><span>' + esc(r.clienteNombre || 'Sin cliente') + ' · apartado el ' + esc(r.fechaInicio || '') + '</span></div>' + est + '</div>' +
      '<div class="apartado-pago"><div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="apartado-cifras"><span>Abonado <b>' + dinero(x.abonado) + '</b> de ' + dinero(x.acordado) + ' (' + pct + '%)</span><span>Falta <b>' + dinero(x.saldo) + '</b> · limite ' + fechaTxt(lim) + '</span></div></div>' +
      '<div class="acciones-fila apartado-acc">' +
        (x.saldo > 0 ? '<button type="button" class="btn btn-gold btn-sm" onclick="abrirAbonoModal(\'' + id + '\')">Registrar abono</button>' : '') +
        '<button type="button" class="btn ' + (x.saldo > 0 ? 'btn-outline' : 'btn-gold') + ' btn-sm" onclick="completarVentaReserva(\'' + id + '\')">' + (x.saldo > 0 ? 'Cobrar saldo y entregar' : 'Entregar') + '</button>' +
        (puedeExt ? '<button type="button" class="btn btn-outline btn-sm" onclick="extenderPlazo(\'' + id + '\',7)">+7 dias</button>' : '') +
        '<button type="button" class="btn btn-danger btn-sm" onclick="cancelarReserva(\'' + id + '\')">Cancelar apartado</button>' +
      '</div></div>';
  }).join('') + '</div>';
}
// poka-yoke: solo extiende apartados con saldo, de 7 en 7 dias y sin pasar de 90 dias desde que se aparto
function extenderPlazo(id, dias){
  var p = state.inventario.find(function(x){ return x.id === id; });
  if(!p || !p.reserva) return;
  var ini = finParseFecha(p.reserva.fechaInicio), lim = fechaLimiteReserva(p);
  if(!ini || !lim) return;
  var base = lim < new Date() ? new Date() : lim;
  var nueva = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
  if((nueva - ini) / 86400000 > PLAZO_MAX){ alert('Un apartado no puede durar mas de ' + PLAZO_MAX + ' dias. Habla con el cliente o cancela el apartado.'); return; }
  if(!confirm('Extender el plazo de ' + (p.reserva.clienteNombre || 'el cliente') + ' para ' + p.nombre + ' hasta el ' + fechaTxt(nueva) + '?')) return;
  p.reserva.fechaLimite = nueva.toLocaleDateString('es-MX');
  p._ts = Date.now();
  save('inventario');
  renderApartados();
}

// ---------- historial ----------
function sinAcentos(t){ return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function ventasHistorial(){
  var per = periodo(_perHist);
  var canal = (document.getElementById('ven-f-canal') || {}).value || '';
  var q = sinAcentos((document.getElementById('ven-f-buscar') || {}).value || '').trim();
  return ventasDe(per.meses).filter(function(m){
    if(canal && (m.canal || 'otro') !== canal) return false;
    if(q && sinAcentos([m.desc, m.clienteNombre, m.fecha, m.monto].join(' ')).indexOf(q) === -1) return false;
    return true;
  });
}
function renderHistorialVentas(){
  chipsPeriodo('ven-periodos-hist', _perHist, 'setPeriodoHistVentas');
  var sel = document.getElementById('ven-f-canal');
  if(sel && sel.options.length <= 1) sel.innerHTML = '<option value="">Todos los canales</option>' + Object.keys(CANALES).map(function(k){ return '<option value="' + k + '">' + CANALES[k] + '</option>'; }).join('');
  var v = ventasHistorial();
  var tot = v.reduce(function(a, m){ return a + (Number(m.monto) || 0); }, 0), gan = v.reduce(function(a, m){ return a + (Number(m.monto) || 0) - (Number(m.costo) || 0); }, 0);
  var res = document.getElementById('ven-hist-res');
  if(res) res.textContent = v.length + ' venta' + (v.length !== 1 ? 's' : '') + ' · ' + dinero(tot) + ' · ganancia ' + dinero(gan) + (tot ? ' (' + Math.round(gan / tot * 100) + '%)' : '');
  var el = document.getElementById('ven-historial'); if(!el) return;
  el.innerHTML = tablaHTML([{ t: 'Reloj' }, { t: 'Fecha' }, { t: 'Cliente' }, { t: 'Canal' }, { t: 'Pago' }, { t: 'Precio', der: true }, { t: 'Ganancia', der: true }],
    v.slice(0, 200).map(function(m){
      var g = (Number(m.monto) || 0) - (Number(m.costo) || 0);
      var desc = m.precioObjetivo && m.precioObjetivo > m.monto ? ' <span class="tenue-peq">−' + Math.round((1 - m.monto / m.precioObjetivo) * 100) + '%</span>' : '';
      return [esc(m.desc), esc(m.fecha), esc(m.clienteNombre || '—'), esc(CANALES[m.canal] || m.canal || '—'), esc(METODOS[m.metodoPago] || '—'), dinero(m.monto) + desc, '<span class="' + (g < 0 ? 'neg' : 'pos') + '">' + dinero(g) + '</span>'];
    }), { icono: 'grafica', titulo: 'No hay ventas con estos filtros' });
}
function setPeriodoHistVentas(id){ _perHist = id; renderHistorialVentas(); }
function exportarVentasCSV(){ var ids = new Set(ventasHistorial()); exportarMovimientosCSV(function(m){ return ids.has(m); }, 'ventas'); }

export { mostrarVistaVentas, refrescarVentas };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { exportarVentasCSV, extenderPlazo, refrescarVentas, renderHistorialVentas, setPeriodoHistVentas, setPeriodoVentas });
