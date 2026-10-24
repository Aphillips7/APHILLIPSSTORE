// Componentes comunes del panel (fase 1 del rediseno): devuelven HTML listo para innerHTML.
// Los estilos estan en css/panel/componentes.css. Todo texto que viene de datos se escapa aqui.

export function esc(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }

// $1,234 (sin decimales; negativos con signo)
export function dinero(n){
  n = Math.round(Number(n) || 0);
  return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US');
}

// Variacion en % de actual contra anterior. null si no hay base para comparar.
export function variacion(actual, anterior){
  actual = Number(actual) || 0; anterior = Number(anterior) || 0;
  if(!anterior) return actual ? null : 0;
  return Math.round((actual - anterior) / Math.abs(anterior) * 100);
}

// Tarjeta KPI. o = { label, valor, previo?, actual?, anterior?, tono?: 'pos'|'neg', inverso?, pie?, onclick? }
// Si llegan actual y anterior se dibuja la variacion "vs mes anterior" (inverso: bajar es bueno).
export function kpiHTML(o){
  var pie = '';
  if(o.actual != null && o.anterior != null){
    var v = variacion(o.actual, o.anterior);
    if(v === null) pie += '<span class="kpi-var igual">nuevo</span>';
    else pie += '<span class="kpi-var ' + (v > 0 ? 'sube' : v < 0 ? 'baja' : 'igual') + (o.inverso ? ' inv' : '') + '">' + Math.abs(v) + '%</span>';
    pie += '<span>' + esc(o.vs || 'vs mes anterior') + '</span>';
  }
  if(o.pie) pie += '<span>' + esc(o.pie) + '</span>';
  var tag = o.onclick ? 'button type="button" onclick="' + esc(o.onclick) + '"' : 'div';
  return '<' + tag + ' class="kpi">' +
    '<div class="kpi-label">' + esc(o.label) + '</div>' +
    '<div class="kpi-valor' + (o.tono ? ' ' + o.tono : '') + '">' + esc(o.valor) + '</div>' +
    (pie ? '<div class="kpi-pie">' + pie + '</div>' : '') +
    '</' + (o.onclick ? 'button' : 'div') + '>';
}

// Etiqueta de estado. tipo: ok | pendiente | vencido | cancelado | info
export function estadoHTML(tipo, texto){
  return '<span class="estado estado-' + esc(tipo) + '">' + esc(texto) + '</span>';
}

var ICONOS = {
  caja: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>',
  grafica: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  persona: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  listo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'
};

// Estado vacio con accion. o = { icono?, titulo, texto?, boton?, onclick? }
export function vacioHTML(o){
  return '<div class="vacio">' +
    '<div class="vacio-icono">' + (ICONOS[o.icono] || ICONOS.caja) + '</div>' +
    '<div class="vacio-titulo">' + esc(o.titulo) + '</div>' +
    (o.texto ? '<div class="vacio-texto">' + esc(o.texto) + '</div>' : '') +
    (o.boton && o.onclick ? '<button type="button" class="btn btn-gold btn-sm" onclick="' + esc(o.onclick) + '">' + esc(o.boton) + '</button>' : '') +
    '</div>';
}

// Tabla. cols = [{ t:'Titulo', der?:true }], filas = [[celdaHTML, ...]] (las celdas ya vienen escapadas).
// En celular cada fila se ve como tarjeta: la primera celda es el titulo y las demas llevan su etiqueta (data-label).
export function tablaHTML(cols, filas, vacio){
  if(!filas.length) return vacioHTML(vacio || { icono: 'caja', titulo: 'Sin datos todavia' });
  return '<div class="tabla-wrap"><table class="tabla"><thead><tr>' +
    cols.map(function(c){ return '<th' + (c.der ? ' class="der"' : '') + '>' + esc(c.t) + '</th>'; }).join('') +
    '</tr></thead><tbody>' +
    filas.map(function(f){ return '<tr>' + f.map(function(celda, i){ return '<td' + (cols[i] && cols[i].der ? ' class="der"' : '') + ' data-label="' + esc(cols[i] ? cols[i].t : '') + '">' + celda + '</td>'; }).join('') + '</tr>'; }).join('') +
    '</tbody></table></div>';
}

// Contenedor de grafica. o = { titulo, sub?, leyenda?: [['actual','Este ano'],['comp','Ano pasado'],['meta','Meta']], svg }
export function graficaHTML(o){
  var ley = (o.leyenda || []).map(function(l){ return '<span><i class="ley-' + esc(l[0]) + '"></i>' + esc(l[1]) + '</span>'; }).join('');
  return '<div class="grafica"><div class="grafica-cab"><div>' +
    '<div class="grafica-titulo">' + esc(o.titulo) + '</div>' +
    (o.sub ? '<div class="grafica-sub">' + esc(o.sub) + '</div>' : '') +
    '</div>' + (ley ? '<div class="grafica-ley">' + ley + '</div>' : '') + '</div>' +
    '<div class="grafica-cuerpo">' + (o.svg || '') + '</div></div>';
}

// Aviso breve abajo (no bloquea): confirma lo que el panel hizo solo, por ejemplo registrar una compra
export function toastPanel(texto){
  var t = document.createElement('div');
  t.className = 'toast-panel'; t.setAttribute('role', 'status'); t.textContent = texto;
  document.body.appendChild(t);
  requestAnimationFrame(function(){ t.classList.add('visible'); });
  setTimeout(function(){ t.classList.remove('visible'); setTimeout(function(){ t.remove(); }, 300); }, 4200);
}
window.toastPanel = toastPanel;
