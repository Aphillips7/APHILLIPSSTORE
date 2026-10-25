// =================== INVENTARIO > CATALOGO (rediseno) ===================
// Tablero de la tienda publica: que se ve, como se comporta cada reloj (vistas -> lo abren -> escriben
// por WhatsApp -> se vende), que relojes necesitan algo (mucho interes y nadie escribe, nadie los ve,
// publicados incompletos) y la vitrina completa con visibilidad y link por reloj.
// Las metricas (state.metricas) son acumuladas por reloj: { vistas, aperturas, clics }.
import { coleccionDe } from './inventario/colecciones.js';
import { renderInventario } from './inventario/lista.js';
import { idxInv, invNoExiste, save, state } from './state.js';
import { esPublicable, rutaReloj } from '../products.js';
import { dinero, esc, estadoHTML, kpiHTML, tablaHTML, vacioHTML } from './componentes.js';

const URL_TIENDA = 'https://aphillipsstore.com/';
const ESTADOS = { disponible: ['ok', 'Disponible'], transito: ['info', 'En transito'], bajopedido: ['cancelado', 'Bajo pedido'], vendido: ['vencido', 'Vendido'], reservado: ['pendiente', 'Apartado'] };
const MIN_VISTAS = 15;      // con menos vistas no se calculan tasas (serian ruido)
var _filtro = 'visibles', _orden = 'clics', _buscar = '', _todos = [];
// texto sin acentos ni simbolos, para buscar "pro diver", "prodiver" o la referencia
function plano(t){ return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

function met(p){ var m = state.metricas[p.id] || {}; return { vistas: m.vistas || 0, aperturas: m.aperturas || 0, clics: m.clics || 0 }; }
function pct(a, b){ return b > 0 ? Math.round(a / b * 1000) / 10 : 0; }
function incompleto(p){ var f = []; if(!p.foto && !(p.fotos && p.fotos.length)) f.push('foto'); if(!p.mm) f.push('medida'); if(!(p.precio > 0) && p.estado !== 'bajopedido') f.push('precio'); return f; }
function elegibles(){ return state.inventario.filter(function(p){ return ['disponible', 'transito', 'bajopedido', 'vendido'].indexOf(p.estado) !== -1; }); }
function miniFoto(p){
  var url = p.foto && /^https?:|^data:|^img\//.test(p.foto) ? p.foto : '';
  return '<span class="cat-foto">' + (url ? '<img src="' + esc(url) + '" alt="" loading="lazy" onerror="this.remove()">' : '<i>Sin foto</i>') + '</span>';
}

function renderCatalogoAdmin(){
  var todos = elegibles();
  var visibles = todos.filter(esPublicable);
  var ocultos = state.inventario.filter(function(p){ return p.ocultoCatalogo && ['disponible', 'transito', 'bajopedido'].indexOf(p.estado) !== -1; });
  var incompletos = visibles.filter(function(p){ return p.estado !== 'vendido' && incompleto(p).length; });
  var tot = { vistas: 0, aperturas: 0, clics: 0 };
  Object.keys(state.metricas || {}).forEach(function(id){ var m = state.metricas[id] || {}; tot.vistas += m.vistas || 0; tot.aperturas += m.aperturas || 0; tot.clics += m.clics || 0; });
  var vendidosConInteres = state.inventario.filter(function(p){ return p.estado === 'vendido' && met(p).clics > 0; }).length;

  var k = document.getElementById('cat-kpis');
  if(k) k.innerHTML = [
    kpiHTML({ label: 'En la tienda', valor: String(visibles.length), pie: ocultos.length + ' oculto' + (ocultos.length !== 1 ? 's' : '') + (incompletos.length ? ' · ' + incompletos.length + ' incompleto' + (incompletos.length !== 1 ? 's' : '') : ''), onclick: "setFiltroCatalogo('visibles')" }),
    kpiHTML({ label: 'Vistas', valor: tot.vistas.toLocaleString('en-US'), pie: 'veces que aparecio un reloj' }),
    kpiHTML({ label: 'Lo abrieron', valor: tot.aperturas.toLocaleString('en-US'), pie: pct(tot.aperturas, tot.vistas) + '% de las vistas' }),
    kpiHTML({ label: 'Escribieron', valor: tot.clics.toLocaleString('en-US'), tono: tot.clics ? 'pos' : '', pie: pct(tot.clics, tot.aperturas) + '% de los que lo abrieron' }),
    kpiHTML({ label: 'Tasa de contacto', valor: pct(tot.clics, tot.vistas) + '%', pie: 'de cada 100 vistas, ' + Math.round(pct(tot.clics, tot.vistas)) + ' escriben' }),
    kpiHTML({ label: 'Vendidos', valor: String(vendidosConInteres), pie: 'que antes alguien pidio por WhatsApp' })
  ].join('');

  // embudo de la tienda
  var e = document.getElementById('cat-embudo');
  if(e){
    if(!tot.vistas) e.innerHTML = vacioHTML({ icono: 'grafica', titulo: 'Aun no hay visitas registradas', texto: 'Cuando la gente vea relojes en la tienda, aqui veras cuantos los abren y escriben.' });
    else {
      var pasos = [['Vieron un reloj', tot.vistas], ['Lo abrieron', tot.aperturas], ['Escribieron por WhatsApp', tot.clics], ['Se vendio', vendidosConInteres]];
      e.innerHTML = '<div class="embudo cat-embudo">' + pasos.map(function(x, i){
        return '<div class="embudo-paso"><span>' + x[0] + '</span><div class="embudo-barra"><i style="width:' + Math.max(3, Math.round(x[1] / tot.vistas * 100)) + '%"></i></div><b>' + x[1].toLocaleString('en-US') + '</b>' +
          (i ? '<em>' + pct(x[1], pasos[i - 1][1]) + '%</em>' : '<em></em>') + '</div>';
      }).join('') + '</div><div class="tenue-peq">El % de cada paso es sobre el paso anterior. Cada visita cuenta una sola vez por reloj.</div>';
    }
  }

  renderOportunidades(visibles);
  renderVitrina(todos);
}

// tres listas de accion: lo que mas interesa, mucho interes y nadie escribe, nadie lo ve
function filaOp(p, detalle, accion){
  return '<div class="cat-op-fila">' + miniFoto(p) + '<div class="cat-op-info"><b>' + esc(p.nombre) + '</b><span>' + detalle + '</span></div>' + (accion || '') + '</div>';
}
function renderOportunidades(visibles){
  var conM = visibles.filter(function(p){ return p.estado !== 'vendido'; }).map(function(p){ return { p: p, m: met(p) }; });
  var top = conM.filter(function(x){ return x.m.clics > 0; }).sort(function(a, b){ return b.m.clics - a.m.clics; }).slice(0, 5);
  var friccion = conM.filter(function(x){ return x.m.clics === 0 && (x.m.aperturas >= 5 || x.m.vistas >= 30); }).sort(function(a, b){ return (b.m.aperturas * 2 + b.m.vistas) - (a.m.aperturas * 2 + a.m.vistas); }).slice(0, 5);
  var invisibles = conM.filter(function(x){ return x.m.vistas < 5 && x.p.estado === 'disponible'; }).slice(0, 5);
  var editar = function(p){ return '<button type="button" class="btn btn-outline btn-sm" onclick="irSeccion(\'inventario\',\'relojes\');editarProducto(\'' + esc(p.id) + '\')">Editar</button>'; };
  var link = function(p){ return '<button type="button" class="btn btn-outline btn-sm" onclick="copiarLinkReloj(\'' + esc(p.id) + '\')">Link</button>'; };
  var t = document.getElementById('cat-top');
  if(t) t.innerHTML = top.length ? top.map(function(x){ return filaOp(x.p, x.m.clics + ' escribieron · ' + x.m.vistas + ' vistas · ' + dinero(x.p.precio), '<span class="cat-badge pos">' + pct(x.m.clics, x.m.vistas) + '%</span>'); }).join('') +
    '<div class="top-nota">Estos venden solos: destacalos en historias y ten reposicion.</div>' : vacioHTML({ icono: 'grafica', titulo: 'Todavia nadie escribio por WhatsApp' });
  var f = document.getElementById('cat-friccion');
  if(f) f.innerHTML = friccion.length ? friccion.map(function(x){ return filaOp(x.p, x.m.aperturas + ' lo abrieron · 0 escribieron · ' + dinero(x.p.precio), editar(x.p)); }).join('') +
    '<div class="top-nota">Los miran pero no escriben: revisa precio, fotos y descripcion.</div>' : vacioHTML({ icono: 'listo', titulo: 'Ningun reloj con interes sin contacto' });
  var n = document.getElementById('cat-invisibles');
  if(n) n.innerHTML = invisibles.length ? invisibles.map(function(x){ return filaOp(x.p, x.m.vistas + ' vista' + (x.m.vistas !== 1 ? 's' : '') + ' · ' + dinero(x.p.precio), link(x.p)); }).join('') +
    '<div class="top-nota">Casi nadie los ve: compartelos con su link en historias o en WhatsApp.</div>' : vacioHTML({ icono: 'listo', titulo: 'Todos los disponibles tienen visitas' });
}

// vitrina completa con filtro, orden, metricas y visibilidad
function renderVitrina(todos){
  _todos = todos;
  var chips = document.getElementById('cat-filtros');
  var cuenta = { visibles: todos.filter(esPublicable).length, ocultos: todos.filter(function(p){ return p.ocultoCatalogo; }).length,
    incompletos: todos.filter(function(p){ return esPublicable(p) && p.estado !== 'vendido' && incompleto(p).length; }).length, todos: todos.length };
  if(chips) chips.innerHTML = [['visibles', 'En la tienda'], ['ocultos', 'Ocultos'], ['incompletos', 'Incompletos'], ['todos', 'Todos']].map(function(x){
    return '<button type="button" class="fin-mes-btn' + (_filtro === x[0] ? ' active' : '') + '" onclick="setFiltroCatalogo(\'' + x[0] + '\')">' + x[1] + ' <span class="seg-n">' + cuenta[x[0]] + '</span></button>';
  }).join('');
  var lista = todos.filter(function(p){
    if(_filtro === 'visibles') return esPublicable(p);
    if(_filtro === 'ocultos') return p.ocultoCatalogo;
    if(_filtro === 'incompletos') return esPublicable(p) && p.estado !== 'vendido' && incompleto(p).length;
    return true;
  }).filter(function(p){
    if(!_buscar) return true;
    var t = plano([p.nombre, p.sku, p.coleccion, coleccionDe(p).coleccion, p.genero].join(' '));
    return t.indexOf(_buscar) !== -1 || t.replace(/ /g, '').indexOf(_buscar.replace(/ /g, '')) !== -1;
  }).map(function(p){ var m = met(p); return { p: p, m: m, tasa: m.vistas >= MIN_VISTAS ? pct(m.clics, m.vistas) : null }; });
  lista.sort(function(a, b){
    if(_orden === 'vistas') return b.m.vistas - a.m.vistas;
    if(_orden === 'tasa') return (b.tasa === null ? -1 : b.tasa) - (a.tasa === null ? -1 : a.tasa);
    if(_orden === 'precio') return (b.p.precio || 0) - (a.p.precio || 0);
    return b.m.clics - a.m.clics || b.m.vistas - a.m.vistas;
  });
  var el = document.getElementById('catalogo-lista'); if(!el) return;
  el.innerHTML = tablaHTML([{ t: 'Reloj' }, { t: 'Estado' }, { t: 'Precio', der: true }, { t: 'Vistas', der: true }, { t: 'Abrieron', der: true }, { t: 'Escribieron', der: true }, { t: 'Contacto', der: true }, { t: '' }],
    lista.map(function(x){
      var p = x.p, est = ESTADOS[p.estado] || ['info', p.estado], falta = p.estado !== 'vendido' ? incompleto(p) : [], pub = esPublicable(p), id = esc(p.id);
      return ['<div class="cat-reloj">' + miniFoto(p) + '<div><b>' + esc(p.nombre) + '</b>' + (p.sku ? '<span>' + esc(p.sku) + '</span>' : '') + (falta.length ? '<span class="neg">Falta ' + falta.join(', ') + '</span>' : '') + '</div></div>',
        estadoHTML(est[0], est[1]) + (p.ocultoCatalogo ? ' ' + estadoHTML('cancelado', 'Oculto') : ''),
        p.precio > 0 ? dinero(p.precio) : '—', x.m.vistas.toLocaleString('en-US'), x.m.aperturas.toLocaleString('en-US'), '<b>' + x.m.clics + '</b>',
        x.tasa === null ? '<span class="tenue-peq" title="Menos de ' + MIN_VISTAS + ' vistas">—</span>' : '<span class="' + (x.tasa >= 5 ? 'pos' : x.tasa < 1 ? 'neg' : '') + '">' + x.tasa + '%</span>',
        '<div class="acciones-fila">' +
          (p.estado !== 'vendido' ? '<label class="cat-switch" title="' + (p.ocultoCatalogo ? 'Oculto: toca para mostrarlo' : 'Visible: toca para ocultarlo') + '"><input type="checkbox"' + (p.ocultoCatalogo ? '' : ' checked') + ' onchange="toggleOcultoCatalogo(\'' + id + '\')"><span></span>' + (p.ocultoCatalogo ? 'Oculto' : 'Visible') + '</label>' : '') +
          (pub ? '<button type="button" class="btn btn-outline btn-sm" onclick="copiarLinkReloj(\'' + id + '\')">Link</button>' : '') +
        '</div>'];
    }), { icono: 'caja', titulo: _buscar ? 'Ningun reloj coincide con la busqueda' : 'Ningun reloj en este filtro' });
}
// el buscador solo redibuja la tabla (rapido y sin perder lo escrito)
function buscarVitrina(v){ _buscar = plano(v); renderVitrina(_todos); }
function setFiltroCatalogo(f){ _filtro = f; renderCatalogoAdmin(); }
function setOrdenCatalogo(o){ _orden = o; renderCatalogoAdmin(); }

// links que se comparten con clientes: siempre el dominio de la tienda
function copiar(url, msg){
  var ok = function(){ if(window.toastPanel) window.toastPanel(msg); };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok).catch(function(){ prompt('Copia este link:', url); });
  else prompt('Copia este link:', url);
}
function copiarLinkCatalogo(){ copiar(URL_TIENDA, 'Link de la tienda copiado'); }
function copiarLinkReloj(id){
  var p = state.inventario.find(function(x){ return x.id === id; });
  // la direccion propia del reloj (la que Google indexa); la vieja ?id= tambien sirve: el servidor la redirige
  copiar(p ? URL_TIENDA + rutaReloj(p).slice(1) : URL_TIENDA + '?id=' + encodeURIComponent(id), 'Link copiado' + (p ? ': ' + p.nombre : ''));
}
function toggleOcultoCatalogo(id){
  var i = idxInv(id);
  if(i === -1){ invNoExiste(); return; }
  var p = state.inventario[i];
  // poka-yoke: mostrar en la tienda un reloj incompleto pide confirmacion
  if(p.ocultoCatalogo){ var f = incompleto(p); if(f.length && !confirm(p.nombre + ' no tiene ' + f.join(', ') + '.\n\n¿Mostrarlo en la tienda de todas formas?')){ renderCatalogoAdmin(); return; } }
  p.ocultoCatalogo = !p.ocultoCatalogo;
  save('inventario');
  if(window.toastPanel) window.toastPanel(p.nombre + (p.ocultoCatalogo ? ' ya no se ve en la tienda' : ' ya se ve en la tienda'));
  renderInventario();
  renderCatalogoAdmin();
}
function renderMetricasCatalogo(){ renderCatalogoAdmin(); }

export { copiarLinkCatalogo, copiarLinkReloj, renderCatalogoAdmin, renderMetricasCatalogo, toggleOcultoCatalogo };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { buscarVitrina, copiarLinkCatalogo, copiarLinkReloj, setFiltroCatalogo, setOrdenCatalogo, toggleOcultoCatalogo });
