// =================== INICIO ===================
import { finMesKey } from './finanzas/fechas.js';
import { save, saveMeta, state } from './state.js';
import { diasEnInventario, saldoPendienteReserva } from '../products.js';

function renderInicio() {
  var hoy = new Date();
  var mesActualKey = hoy.getFullYear() + '-' + String(hoy.getMonth()+1).padStart(2,'0');
  var mesAntDate = new Date(hoy.getFullYear(), hoy.getMonth()-1, 1);
  var mesAnteriorKey = mesAntDate.getFullYear() + '-' + String(mesAntDate.getMonth()+1).padStart(2,'0');

  const ventas = state.movimientos.filter(m => m.tipo === 'venta' && finMesKey(m.fecha) === mesActualKey);
  const ventasMesAnt = state.movimientos.filter(m => m.tipo === 'venta' && finMesKey(m.fecha) === mesAnteriorKey);
  const totalVentas = ventas.reduce((a, b) => a + b.monto, 0);
  const totalVentasAnt = ventasMesAnt.reduce((a, b) => a + b.monto, 0);
  const totalGanancia = ventas.reduce((a, b) => a + (b.monto - (b.costo || 0)), 0);
  const totalGananciaAnt = ventasMesAnt.reduce((a, b) => a + (b.monto - (b.costo || 0)), 0);
  const stock = state.inventario.filter(i => i.estado === 'disponible').length;

  document.getElementById('stat-ventas-mes').textContent = '$' + totalVentas.toLocaleString();
  document.getElementById('stat-ganancia').textContent = '$' + totalGanancia.toLocaleString();
  document.getElementById('stat-stock').textContent = stock;
  document.getElementById('stat-hint-ventas').textContent = ventas.length + ' venta' + (ventas.length !== 1 ? 's' : '');
  setTrendInicio('trend-ventas', totalVentas, totalVentasAnt);
  setTrendInicio('trend-ganancia', totalGanancia, totalGananciaAnt);

  var mesesNombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var mesLabelEl = document.getElementById('inicio-mes-label');
  if (mesLabelEl) mesLabelEl.textContent = 'Tu resumen de ' + mesesNombres[hoy.getMonth()] + ' ' + hoy.getFullYear();

  var diasRestEl = document.getElementById('meta-dias-restantes');
  if (state.meta > 0) {
    const pct = Math.min(Math.round((totalVentas / state.meta) * 100), 100);
    document.getElementById('meta-label').textContent = '$' + totalVentas.toLocaleString() + ' de $' + state.meta.toLocaleString() + ' meta';
    document.getElementById('meta-pct').textContent = pct + '%';
    document.getElementById('meta-fill').style.width = pct + '%';
    document.getElementById('meta-input').value = state.meta;
    if (diasRestEl) {
      var diasEnMes = new Date(hoy.getFullYear(), hoy.getMonth()+1, 0).getDate();
      var diasRestantes = diasEnMes - hoy.getDate();
      diasRestEl.textContent = diasRestantes > 0 ? diasRestantes + ' dia' + (diasRestantes !== 1 ? 's' : '') + ' restantes este mes' : 'Ultimo dia del mes';
    }
  } else {
    document.getElementById('meta-label').textContent = 'Sin meta definida';
    document.getElementById('meta-pct').textContent = '0%';
    document.getElementById('meta-fill').style.width = '0%';
    if (diasRestEl) diasRestEl.textContent = '';
  }

  renderChecklist();
  renderPendientesInicio();
  renderMiniChartInicio();
  renderRecientesInicio();
}
function setTrendInicio(id, actual, anterior) {
  var el = document.getElementById(id);
  if (!el) return;
  if (!anterior || anterior <= 0) { el.textContent = ''; return; }
  var diff = Math.round(((actual - anterior) / anterior) * 100);
  var arrow = diff >= 0 ? '\u25B2' : '\u25BC';
  var color = diff >= 0 ? 'var(--green)' : 'var(--red)';
  el.innerHTML = '<span style="color:'+color+';font-weight:500;">'+arrow+' '+Math.abs(diff)+'%</span> vs mes anterior';
}
function renderPendientesInicio() {
  var cont = document.getElementById('pendientes-container');
  if (!cont) return;
  var items = [];
  state.inventario.forEach(function(p) {
    if (p.estado === 'reservado' && p.reserva) {
      var saldo = saldoPendienteReserva(p);
      if (saldo > 0) {
        items.push({ orden: 1, html:
          '<div class="list-item" style="padding:10px 0;">'+
            '<div class="list-item-info"><div class="list-item-name">'+p.nombre+'</div>'+
            '<div class="list-item-sub">Reservado por '+(p.reserva.clienteNombre||'—')+' · Saldo pendiente</div></div>'+
            '<span class="badge badge-gold">$'+saldo.toLocaleString()+'</span></div>' });
      }
    } else if (p.estado === 'transito') {
      var dT = diasEnInventario(p.fecha);
      if (dT !== null && dT > 20) {
        var subTransito = 'En transito hace ' + dT + ' dias' + (p.paqueteria ? ' · ' + p.paqueteria : '') + (p.tracking ? ' · Guia: ' + p.tracking : '');
        items.push({ orden: 2, html:
          '<div class="list-item" style="padding:10px 0;">'+
            '<div class="list-item-info"><div class="list-item-name">'+p.nombre+'</div>'+
            '<div class="list-item-sub">'+subTransito+'</div></div>'+
            '<span class="badge badge-blue">Revisar envio</span></div>' });
      }
    } else if (p.estado === 'disponible') {
      var dD = diasEnInventario(p.fecha);
      if (dD !== null && dD > 45) {
        items.push({ orden: 3, html:
          '<div class="list-item" style="padding:10px 0;">'+
            '<div class="list-item-info"><div class="list-item-name">'+p.nombre+'</div>'+
            '<div class="list-item-sub">'+dD+' dias en inventario sin venderse</div></div>'+
            '<span class="badge badge-red">Rebajar</span></div>' });
      }
    }
  });
  items.sort(function(a,b){ return a.orden - b.orden; });
  cont.innerHTML = items.length ? items.map(function(x){ return x.html; }).join('') :
    '<div class="empty" style="padding:20px 0;"><span></span>Todo al dia, sin pendientes por ahora.</div>';
}

function renderMiniChartInicio() {
  var cont = document.getElementById('mini-chart-container');
  if (!cont) return;
  var diasNombres = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
  var dias = [];
  for (var i = 6; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    dias.push(d);
  }
  var datos = dias.map(function(d) {
    var key = d.toLocaleDateString('es-MX');
    var total = state.movimientos.filter(function(m){ return m.tipo === 'venta' && m.fecha === key; })
      .reduce(function(a,b){ return a + b.monto; }, 0);
    return { label: diasNombres[d.getDay()], total: total };
  });
  var max = Math.max.apply(null, datos.map(function(x){ return x.total; }).concat([1]));
  cont.innerHTML = datos.map(function(x) {
    var pct = Math.round((x.total / max) * 100);
    return '<div class="fin-bar-row"><span class="fin-bar-label">'+x.label+'</span>'+
      '<div class="fin-bar-track"><div class="fin-bar-fill" style="width:'+pct+'%;background:var(--accent);"></div></div>'+
      '<span class="fin-bar-val money'+(x.total>0?' pos':'')+'">$'+x.total.toLocaleString()+'</span></div>';
  }).join('');
}
function renderRecientesInicio() {
  var cont = document.getElementById('recientes-container');
  if (!cont) return;
  var ventasRecientes = state.movimientos.filter(function(m){ return m.tipo === 'venta' && !m._soloRegistro; })
    .slice().sort(function(a,b){ return (b._ts||0) - (a._ts||0); }).slice(0,4);
  var htmlVentas = ventasRecientes.length ? ventasRecientes.map(function(v) {
    return '<div class="list-item" style="padding:8px 0;">'+
      '<div class="list-item-info"><div class="list-item-name">'+v.desc+'</div>'+
      '<div class="list-item-sub">'+(v.clienteNombre||'Sin cliente')+' · '+v.fecha+'</div></div>'+
      '<span class="money pos">$'+v.monto.toLocaleString()+'</span></div>';
  }).join('') : '<div class="empty" style="padding:16px 0;"><span></span>Aun no hay ventas registradas.</div>';

  var hoy = new Date();
  var mesActualKey = hoy.getFullYear() + '-' + String(hoy.getMonth()+1).padStart(2,'0');
  var porCliente = {};
  state.movimientos.filter(function(m){ return m.tipo === 'venta' && finMesKey(m.fecha) === mesActualKey; }).forEach(function(v) {
    if (!v.clienteNombre) return;
    porCliente[v.clienteNombre] = (porCliente[v.clienteNombre]||0) + v.monto;
  });
  var topArr = Object.entries(porCliente).sort(function(a,b){ return b[1]-a[1]; });
  var topCliente = topArr.length ? topArr[0][0] : '—';

  var reservasActivas = state.inventario.filter(function(p){ return p.estado === 'reservado' && p.reserva; });
  var saldoTotal = reservasActivas.reduce(function(a,p){ return a + saldoPendienteReserva(p); }, 0);

  var htmlExtra = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;">'+
    '<div class="fin-3030-box" style="background:var(--bg2);"><div class="fin-3030-label">Cliente top del mes</div><div class="fin-3030-val" style="font-size:14px;">'+topCliente+'</div></div>'+
    '<div class="fin-3030-box" style="background:var(--accent-light);"><div class="fin-3030-label">Reservas activas</div><div class="fin-3030-val" style="color:var(--accent);">'+reservasActivas.length+'</div></div>'+
    '<div class="fin-3030-box" style="background:var(--blue-bg);"><div class="fin-3030-label">Saldo por cobrar</div><div class="fin-3030-val" style="color:var(--blue);">$'+saldoTotal.toLocaleString()+'</div></div>'+
  '</div>';

  cont.innerHTML = htmlVentas + htmlExtra;
}

function abrirReglasModal() { document.getElementById('reglas-overlay').classList.add('open'); }
function cerrarReglasModal() { document.getElementById('reglas-overlay').classList.remove('open'); }
function guardarMeta() {
  const val = parseFloat(document.getElementById('meta-input').value);
  if (!val || val <= 0) return;
  state.meta = val; saveMeta(); renderInicio();
}

const defaultTasks = ['Revisar mensajes de clientes','Publicar story con inventario disponible','Apuntar ventas del dia','Responder comentarios en marketplace'];
function renderChecklist() {
  const container = document.getElementById('checklist-container');
  if (state.tasks.length === 0) {
    defaultTasks.forEach(t => state.tasks.push({ text: t, done: false, id: Date.now() + Math.random() }));
    save('tasks');
  }
  container.innerHTML = state.tasks.map((t, i) => `
    <div class="check-item ${t.done ? 'done' : ''}" onclick="toggleTask(${i})">
      <input type="checkbox" ${t.done ? 'checked' : ''} onclick="event.stopPropagation();toggleTask(${i})" />
      <label>${t.text}</label>
      <button class="btn btn-danger" style="padding:3px 8px;font-size:11px;" onclick="event.stopPropagation();removeTask(${i})">x</button>
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

export { abrirReglasModal, addTask, cerrarReglasModal, defaultTasks, guardarMeta, removeTask, renderChecklist, renderInicio, renderMiniChartInicio, renderPendientesInicio, renderRecientesInicio, setTrendInicio, toggleTask };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { abrirReglasModal, addTask, cerrarReglasModal, guardarMeta, removeTask, toggleTask });
