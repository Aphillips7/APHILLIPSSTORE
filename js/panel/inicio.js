// =================== DASHBOARD (seccion de inicio, rediseno fase 3) ===================
// KPIs del mes contra el anterior, "Hoy necesitas" (cada aviso con su boton directo), meta con
// proyeccion, grafica de 12 meses, mas vistos vs mas vendidos y actividad reciente.
import { save, saveMeta, state } from './state.js';
import { diasEnInventario, esPublicable, saldoPendienteReserva } from '../products.js';
import { dinero, esc, estadoHTML, kpiHTML, vacioHTML } from './componentes.js';
import { barrasH, barrasLinea } from './graficas.js';
import { diasParaLimite, nombreMes, resultadosMes } from './finanzas/calculos.js';
import { mesesSinCerrar } from './finanzas/resumen.js';

const DIAS_TRANSITO = 20, DIAS_REBAJAR = 45;
const ABIERTOS = ['solicitado', 'confirmado', 'pagado', 'enviado'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_C = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function claveMes(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
// Mismos calculos que Finanzas (finanzas/calculos.js): ganancia neta = ganancia bruta - gastos operativos;
// el margen que se muestra es el bruto (lo que deja cada venta).
function resumenMes(clave){
  var r = resultadosMes(clave);
  return { ingresos: r.ingresos, ganancia: r.neta, bruta: r.bruta, gastos: r.gastos, margen: r.margenBruto, ventas: r.nVentas, abonos: r.nAbonos };
}
function costoDe(p){ return Number(p.costoTotal) || ((Number(p.costo) || 0) + (Number(p.importacion) || 0)); }
function pedidosAbiertos(){ return (window.__pedidosWeb || []).filter(function(p){ return ABIERTOS.indexOf(p.estado) !== -1; }); }
function numeroBadge(id){ var b = document.getElementById(id); return b && b.style.display !== 'none' ? (parseInt(b.textContent, 10) || 0) : 0; }

function renderInicio(){
  var hoy = new Date();
  var actual = resumenMes(claveMes(hoy));
  var anterior = resumenMes(claveMes(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)));

  var h = hoy.getHours();
  var sal = document.getElementById('dash-saludo');
  if(sal) sal.textContent = (h < 12 ? 'Buenos dias' : h < 19 ? 'Buenas tardes' : 'Buenas noches') + ', Alberto';
  var mesLabelEl = document.getElementById('inicio-mes-label');
  if(mesLabelEl) mesLabelEl.textContent = 'Tu negocio en ' + MESES[hoy.getMonth()] + ' ' + hoy.getFullYear();

  renderKpis(actual, anterior);
  renderMeta(actual, hoy);
  renderPendientesInicio();
  renderGrafica(hoy);
  renderTop();
  renderRecientesInicio();
  renderChecklist();
}

function renderKpis(actual, anterior){
  var cont = document.getElementById('dash-kpis'); if(!cont) return;
  var enStock = state.inventario.filter(function(p){ return ['disponible', 'transito', 'reservado'].indexOf(p.estado) !== -1; });
  var valorCosto = enStock.reduce(function(a, p){ return a + costoDe(p); }, 0);
  var valorPrecio = enStock.reduce(function(a, p){ return a + (Number(p.precio) || 0); }, 0);
  var pedidos = pedidosAbiertos();
  var porConfirmar = pedidos.filter(function(p){ return p.estado === 'solicitado'; }).length;
  var reservas = state.inventario.filter(function(p){ return p.estado === 'reservado' && p.reserva; });
  var porCobrar = reservas.reduce(function(a, p){ return a + saldoPendienteReserva(p); }, 0);
  cont.innerHTML = [
    kpiHTML({ label: 'Ventas del mes', valor: dinero(actual.ingresos), actual: actual.ingresos, anterior: anterior.ingresos, onclick: "irSeccion('finanzas','resumen')" }),
    kpiHTML({ label: 'Ganancia neta', valor: dinero(actual.ganancia), tono: actual.ganancia < 0 ? 'neg' : 'pos', actual: actual.ganancia, anterior: anterior.ganancia, pie: 'tras ' + dinero(actual.gastos) + ' de gastos', onclick: "irSeccion('finanzas','resumen')" }),
    kpiHTML({ label: 'Margen promedio', valor: actual.margen + '%', tono: !actual.ingresos ? '' : actual.margen >= 30 ? 'pos' : actual.margen < 15 ? 'neg' : '', actual: actual.margen, anterior: anterior.margen, pie: actual.ventas + ' venta' + (actual.ventas !== 1 ? 's' : '') }),
    kpiHTML({ label: 'Inventario', valor: dinero(valorCosto), pie: 'a costo · a precio ' + dinero(valorPrecio), onclick: "irSeccion('inventario','relojes')" }),
    kpiHTML({ label: 'Pedidos web', valor: String(pedidos.length), pie: porConfirmar ? porConfirmar + ' por confirmar' : 'al dia', onclick: "irSeccion('ventas','pedidos')" }),
    kpiHTML({ label: 'Por cobrar', valor: dinero(porCobrar), pie: reservas.length + ' reserva' + (reservas.length !== 1 ? 's' : '') + ' activa' + (reservas.length !== 1 ? 's' : '') })
  ].join('');
}

function renderMeta(actual, hoy){
  var label = document.getElementById('meta-label'), pctEl = document.getElementById('meta-pct'), fill = document.getElementById('meta-fill');
  var diasEl = document.getElementById('meta-dias-restantes'), proy = document.getElementById('meta-proyeccion');
  if(!label) return;
  var diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate(), dia = hoy.getDate(), quedan = diasMes - dia;
  var inp = document.getElementById('meta-input');
  if(inp && document.activeElement !== inp) inp.value = state.meta > 0 ? state.meta : '';
  validarMeta();
  if(!(state.meta > 0)){
    label.textContent = 'Sin meta definida'; pctEl.textContent = '0%'; fill.style.width = '0%';
    if(diasEl) diasEl.textContent = 'Pon una meta para ver si vas a tiempo.';
    if(proy) proy.innerHTML = '';
    return;
  }
  var pct = Math.round(actual.ingresos / state.meta * 100);
  label.textContent = dinero(actual.ingresos) + ' de ' + dinero(state.meta);
  pctEl.textContent = pct + '%';
  fill.style.width = Math.min(pct, 100) + '%';
  if(diasEl) diasEl.textContent = quedan > 0 ? quedan + ' dia' + (quedan !== 1 ? 's' : '') + ' restantes este mes' : 'Ultimo dia del mes';
  if(!proy) return;
  var ritmo = actual.ingresos / dia, cierre = Math.round(ritmo * diasMes), falta = Math.max(0, state.meta - actual.ingresos);
  var vaBien = cierre >= state.meta;
  proy.innerHTML = pct >= 100 ? estadoHTML('ok', 'Meta cumplida') + '<span>Vas ' + dinero(actual.ingresos - state.meta) + ' por encima.</span>' :
    estadoHTML(vaBien ? 'ok' : 'pendiente', vaBien ? 'A tiempo' : 'Por debajo del ritmo') +
    '<span>Al ritmo actual cierras en <b>' + dinero(cierre) + '</b>' + (quedan > 0 ? '; te faltan ' + dinero(falta) + ' (' + dinero(Math.ceil(falta / Math.max(1, quedan))) + ' por dia).' : '.') + '</span>';
}
// poka-yoke: Guardar solo se activa con una meta valida y distinta de la actual
function validarMeta(){
  var inp = document.getElementById('meta-input'), b = document.getElementById('meta-guardar');
  if(!inp || !b) return false;
  var v = Number(inp.value);
  var ok = inp.value !== '' && isFinite(v) && v > 0 && v < 10000000 && Math.round(v) !== Math.round(state.meta || 0);
  b.disabled = !ok;
  inp.setAttribute('aria-invalid', inp.value !== '' && !(v > 0) ? 'true' : 'false');
  return ok;
}
function guardarMeta(){
  if(!validarMeta()) return;
  state.meta = Math.round(Number(document.getElementById('meta-input').value));
  saveMeta(); renderInicio();
}

// ---------- Hoy necesitas ----------
function aviso(orden, tipo, etiqueta, titulo, sub, boton, accion){ return { orden: orden, tipo: tipo, etiqueta: etiqueta, titulo: titulo, sub: sub, boton: boton, accion: accion }; }
function editar(id){ return "irSeccion('inventario','relojes');editarProducto('" + id + "')"; }
function renderPendientesInicio(){
  var cont = document.getElementById('pendientes-container'); if(!cont) return;
  var items = [];
  var porConfirmar = pedidosAbiertos().filter(function(p){ return p.estado === 'solicitado'; });
  if(porConfirmar.length) items.push(aviso(0, 'vencido', 'Pedido web', porConfirmar.length + ' pedido' + (porConfirmar.length !== 1 ? 's' : '') + ' por confirmar',
    porConfirmar.slice(0, 3).map(function(p){ return p.numero + ' · ' + p.reloj; }).join(' / '), 'Confirmar', "irSeccion('ventas','pedidos')"));
  state.inventario.forEach(function(p){
    var id = esc(p.id), nombre = p.nombre || 'Sin nombre';
    if(p.estado === 'reservado' && p.reserva){
      var saldo = saldoPendienteReserva(p);
      if(saldo > 0){
        var quedan = diasParaLimite(p);
        if(quedan !== null && quedan < 0) items.push(aviso(1, 'vencido', 'Abono vencido', nombre, (p.reserva.clienteNombre || 'Cliente') + ' debe ' + dinero(saldo) + ' · vencio hace ' + (-quedan) + ' dias', 'Registrar abono', "abrirAbonoModal('" + id + "')"));
        else items.push(aviso(4, 'pendiente', 'Reserva', nombre, (p.reserva.clienteNombre || 'Cliente') + ' debe ' + dinero(saldo) + (quedan !== null ? ' · plazo en ' + quedan + ' dias' : ''), 'Abono', "abrirAbonoModal('" + id + "')"));
      }
    } else if(p.estado === 'transito'){
      var dT = diasEnInventario(p.fecha);
      if(dT !== null && dT > DIAS_TRANSITO) items.push(aviso(2, 'pendiente', 'Transito', nombre, 'En camino hace ' + dT + ' dias' + (p.paqueteria ? ' · ' + p.paqueteria : '') + (p.tracking ? ' · guia ' + p.tracking : ''), 'Revisar envio', "verDetalle('" + id + "')"));
    } else if(p.estado === 'disponible'){
      var dD = diasEnInventario(p.fecha);
      if(dD !== null && dD > DIAS_REBAJAR) items.push(aviso(3, 'pendiente', 'Sin rotar', nombre, dD + ' dias disponible sin venderse · ' + dinero(p.precio), 'Rebajar', editar(id)));
    }
    if(esPublicable(p) && p.estado !== 'vendido' && (!(p.fotos && p.fotos.length) && !p.foto || !p.mm)){
      var falta = [(!(p.fotos && p.fotos.length) && !p.foto) ? 'foto' : '', !p.mm ? 'medida (mm)' : ''].filter(Boolean).join(' y ');
      items.push(aviso(5, 'info', 'Catalogo', nombre, 'Se ve en la tienda sin ' + falta, 'Completar', editar(id)));
    }
  });
  var sinCerrar = mesesSinCerrar();
  if(sinCerrar.length && new Date().getDate() >= 3) items.push(aviso(6, 'info', 'Cierre', 'Cerrar ' + (sinCerrar.length === 1 ? nombreMes(sinCerrar[0]) : sinCerrar.length + ' meses'), 'Revisa los numeros y cierra el mes para que no cambien', 'Cerrar mes', "irSeccion('finanzas','cierres')"));
  var avisosWeb = numeroBadge('cuentas-web-badge');
  if(avisosWeb) items.push(aviso(1.5, 'pendiente', 'Avisos web', avisosWeb + ' aviso' + (avisosWeb !== 1 ? 's' : '') + ' por enviar', 'Clientes que pidieron que les avises de un reloj o una marca', 'Enviar', "irSeccion('clientes','cuentas')"));
  items.sort(function(a, b){ return a.orden - b.orden; });
  var c = document.getElementById('hoy-cont');
  if(c){ c.hidden = !items.length; c.textContent = items.length; }
  if(!items.length){ cont.innerHTML = vacioHTML({ icono: 'listo', titulo: 'Todo al dia', texto: 'No hay pedidos, cobros ni relojes que necesiten algo hoy.' }); return; }
  var MAX = 8;
  cont.innerHTML = '<div class="hoy-lista">' + items.slice(0, MAX).map(function(x){
    return '<div class="hoy-item">' + estadoHTML(x.tipo, x.etiqueta) +
      '<div class="hoy-texto"><div class="hoy-titulo">' + esc(x.titulo) + '</div><div class="hoy-sub">' + esc(x.sub) + '</div></div>' +
      '<button type="button" class="btn btn-sm ' + (x.tipo === 'vencido' ? 'btn-gold' : 'btn-outline') + '" onclick="' + x.accion + '">' + esc(x.boton) + '</button></div>';
  }).join('') + '</div>' + (items.length > MAX ? '<div class="hoy-mas">y ' + (items.length - MAX) + ' mas en Inventario y Ventas</div>' : '');
}

// ---------- grafica de 12 meses ----------
function renderGrafica(hoy){
  var el = document.getElementById('dash-grafica'); if(!el) return;
  var et = [], ventas = [], ganancia = [];
  for(var i = 11; i >= 0; i--){
    var d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1), r = resumenMes(claveMes(d));
    et.push(MESES_C[d.getMonth()]); ventas.push(r.ingresos); ganancia.push(r.ganancia);
  }
  var total = ventas.reduce(function(a, b){ return a + b; }, 0), gan = ganancia.reduce(function(a, b){ return a + b; }, 0);
  var sub = document.getElementById('dash-grafica-sub');
  if(sub) sub.textContent = 'Total ' + dinero(total) + ' en ventas · ' + dinero(gan) + ' de ganancia' + (total ? ' (' + Math.round(gan / total * 100) + '%)' : '');
  var ley = document.getElementById('dash-ley-meta'); if(ley) ley.hidden = !(state.meta > 0);
  if(!total){ el.innerHTML = vacioHTML({ icono: 'grafica', titulo: 'Aun no hay ventas', texto: 'Cuando registres ventas veras aqui como va cada mes.', boton: '+ Registrar venta', onclick: "irARegistrar('venta')" }); return; }
  barrasLinea(el, { etiquetas: et, barras: ventas, linea: ganancia, meta: state.meta > 0 ? state.meta : 0, nombreBarras: 'Ventas', nombreLinea: 'Ganancia', resaltar: 11 });
}

// ---------- mas vistos vs mas vendidos (ultimos 90 dias de ventas) ----------
function renderTop(){
  var el = document.getElementById('dash-top'); if(!el) return;
  var porId = {}; state.inventario.forEach(function(p){ porId[p.id] = p; });
  var vistos = Object.keys(state.metricas || {}).map(function(id){ var m = state.metricas[id] || {}; return { id: id, vistas: m.vistas || 0, clics: m.clics || 0 }; })
    .filter(function(x){ return porId[x.id] && x.vistas > 0; }).sort(function(a, b){ return b.vistas - a.vistas; }).slice(0, 5);
  var vendidos = {};
  state.movimientos.forEach(function(m){
    if(m.tipo !== 'venta' || m._soloRegistro) return;
    var d = diasEnInventario(m.fecha); if(d === null || d > 90) return;
    var nombre = (porId[m.invId] && porId[m.invId].nombre) || m.desc || 'Venta';
    vendidos[nombre] = vendidos[nombre] || { n: 0, monto: 0 };
    vendidos[nombre].n++; vendidos[nombre].monto += m.monto || 0;
  });
  var topV = Object.keys(vendidos).map(function(k){ return { label: k, valor: vendidos[k].n, extra: dinero(vendidos[k].monto) }; }).sort(function(a, b){ return b.valor - a.valor || 0; }).slice(0, 5);
  var nombresVendidos = topV.map(function(x){ return x.label; });
  el.innerHTML = '<div class="top-cols">' +
    '<div><div class="eyebrow">Mas vistos en la tienda</div>' + (vistos.length ? barrasH(vistos.map(function(x){
      var n = porId[x.id].nombre || 'Sin nombre';
      return { label: n, valor: x.vistas, extra: (x.clics ? x.clics + ' WhatsApp' : '') + (nombresVendidos.indexOf(n) === -1 && porId[x.id].estado === 'disponible' ? ' · sin venta' : '') };
    }), function(v){ return v + ' vistas'; }) : '<div class="tenue-peq">Aun no hay vistas registradas.</div>') + '</div>' +
    '<div><div class="eyebrow">Mas vendidos (90 dias)</div>' + (topV.length ? barrasH(topV, function(v){ return v + ' vendido' + (v !== 1 ? 's' : ''); }) : '<div class="tenue-peq">Sin ventas en los ultimos 90 dias.</div>') + '</div>' +
    '</div>' + (vistos.some(function(x){ return nombresVendidos.indexOf(porId[x.id].nombre) === -1 && porId[x.id].estado === 'disponible'; }) ?
      '<div class="top-nota">Los que se ven mucho y no se venden: revisa precio, fotos o publicalos en historias.</div>' : '');
}

// ---------- actividad reciente ----------
const TIPOS = { venta: ['ok', 'Venta', 1], abono: ['ok', 'Abono', 1], compra: ['info', 'Compra', -1], gasto: ['vencido', 'Gasto', -1], retiro: ['pendiente', 'Retiro', -1], traspaso: ['cancelado', 'Traspaso', 0], reserva_cancelada: ['cancelado', 'Reserva cancelada', 0] };
function renderRecientesInicio(){
  var cont = document.getElementById('recientes-container'); if(!cont) return;
  var movs = state.movimientos.filter(function(m){ return !m._soloRegistro && TIPOS[m.tipo]; }).slice().sort(function(a, b){ return (b._ts || 0) - (a._ts || 0); }).slice(0, 6);
  if(!movs.length){ cont.innerHTML = vacioHTML({ icono: 'caja', titulo: 'Sin movimientos todavia', texto: 'Aqui veras las ultimas ventas, compras y gastos.' }); return; }
  cont.innerHTML = movs.map(function(m){
    var t = TIPOS[m.tipo], monto = m.monto || 0;
    return '<div class="list-item" style="padding:10px 0;">' + estadoHTML(t[0], t[1]) +
      '<div class="list-item-info"><div class="list-item-name">' + esc(m.desc || t[1]) + '</div><div class="list-item-sub">' + esc([m.clienteNombre, m.fecha].filter(Boolean).join(' · ')) + '</div></div>' +
      '<span class="money ' + (t[2] > 0 ? 'pos' : t[2] < 0 ? 'neg' : '') + '">' + (t[2] < 0 ? '-' : t[2] > 0 ? '+' : '') + dinero(Math.abs(monto)) + '</span></div>';
  }).join('');
}

function abrirReglasModal() { document.getElementById('reglas-overlay').classList.add('open'); }
function cerrarReglasModal() { document.getElementById('reglas-overlay').classList.remove('open'); }

const defaultTasks = ['Revisar mensajes de clientes','Publicar story con inventario disponible','Apuntar ventas del dia','Responder comentarios en marketplace'];
function renderChecklist() {
  const container = document.getElementById('checklist-container');
  if (!container) return;
  if (state.tasks.length === 0) {
    defaultTasks.forEach(t => state.tasks.push({ text: t, done: false, id: Date.now() + Math.random() }));
    save('tasks');
  }
  container.innerHTML = state.tasks.map((t, i) => `
    <div class="check-item ${t.done ? 'done' : ''}" onclick="toggleTask(${i})">
      <input type="checkbox" ${t.done ? 'checked' : ''} onclick="event.stopPropagation();toggleTask(${i})" />
      <label>${esc(t.text)}</label>
      <button class="btn btn-danger" style="padding:3px 8px;font-size:11px;" onclick="event.stopPropagation();removeTask(${i})" aria-label="Quitar tarea">x</button>
    </div>`).join('');
}
function toggleTask(i) { state.tasks[i].done = !state.tasks[i].done; save('tasks'); renderChecklist(); }
function removeTask(i) { state.tasks.splice(i, 1); save('tasks'); renderChecklist(); }
function addTask() {
  const input = document.getElementById('new-task');
  if (!input.value.trim()) return;
  state.tasks.push({ text: input.value.trim(), done: false, id: Date.now() });
  input.value = ''; save('tasks'); renderChecklist();
}

// los pedidos web y los avisos llegan aparte: si cambian sus contadores, se actualiza el dashboard visible
var _tObs = null;
function vigilarExternos(){
  var obs = new MutationObserver(function(){
    clearTimeout(_tObs);
    _tObs = setTimeout(function(){ var p = document.getElementById('page-inicio'); if(p && p.classList.contains('active')) renderInicio(); }, 300);
  });
  ['pedidos-web-badge', 'cuentas-web-badge'].forEach(function(id){ var b = document.getElementById(id); if(b) obs.observe(b, { attributes: true, childList: true, characterData: true, subtree: true }); });
}
vigilarExternos();

export { abrirReglasModal, addTask, cerrarReglasModal, defaultTasks, guardarMeta, removeTask, renderChecklist, renderInicio, renderPendientesInicio, renderRecientesInicio, toggleTask };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { abrirReglasModal, addTask, cerrarReglasModal, guardarMeta, removeTask, toggleTask, validarMeta });
