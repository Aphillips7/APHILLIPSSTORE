// =================== INVENTARIO POR COLECCION ===================
// Agrupa los relojes por marca + coleccion base: "Pro Diver Scuba" y "Pro Diver Automatico" entran en
// "Invicta Pro Diver"; "Spedway Racing" (con error de dedo) entra en "Invicta Speedway". La coleccion sale del
// campo "coleccion" (y si esta vacio, del nombre) comparada con las colecciones conocidas de cada marca;
// si no coincide con ninguna, se usa lo que este escrito.
// Cada coleccion muestra su emblema (iniciales), sus cifras y una mini ficha simetrica por reloj.
import { dinero, esc } from '../componentes.js';
import { diasEnInventario } from '../../products.js';

const MARCAS = ['Invicta', 'Bulova', 'TechnoMarine'];
const COLECCIONES = {
  Invicta: ['Pro Diver', 'Speedway', 'Bolt', 'Venom', 'Reserve', 'Subaqua', 'Specialty', 'Angel', 'Lupah', 'I-Force', 'Aviator',
    'Russian Diver', 'Excursion', 'Corduba', 'S1 Rally', 'Coalition Forces', 'Sea Base', 'Akula', 'DNA', 'Objet D Art', 'Sea Hunter',
    'Grand Diver', 'Hydromax', 'Sea Spider', 'Sea Wizard', 'Gladiator', 'Wildflower', 'Jason Taylor', 'Star Wars', 'Marvel', 'DC Comics',
    'Disney', 'NFL', 'Character Collection', 'Ocean Voyage', 'Vintage'],
  Bulova: ['Lunar Pilot', 'Precisionist', 'Marine Star', 'Classic', 'Sutton', 'Surveyor', 'Curv', 'Maquina', 'Frank Lloyd Wright',
    'Computron', 'Archive', 'Oceanographer', 'Hack', 'Millennia', 'Rubaiyat', 'Regatta', 'Crystal', 'Modern', 'Aerojet', 'Joseph Bulova', 'Accutron'],
  TechnoMarine: ['Manta Ray', 'Cruise', 'Reef', 'Black Reef', 'Blue Reef', 'UF6', 'Sea', 'Technocell', 'MoonSun', 'Sea Manta']
};
const ORDEN_ESTADO = { disponible: 0, transito: 1, reservado: 2, bajopedido: 3, vendido: 4 };
const ETIQUETA = { disponible: 'Disponible', transito: 'En transito', bajopedido: 'Bajo pedido', reservado: 'Apartado', vendido: 'Vendido' };

function plano(t){ return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function junto(t){ return plano(t).replace(/ /g, ''); }
// distancia de edicion corta (para errores de dedo como "spedway")
function distancia(a, b){
  if(Math.abs(a.length - b.length) > 1) return 2;
  var d = [], i, j;
  for(i = 0; i <= a.length; i++){ d[i] = [i]; }
  for(j = 1; j <= b.length; j++) d[0][j] = j;
  for(i = 1; i <= a.length; i++) for(j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function marcaDe(p){
  var t = junto((p.nombre || '') + ' ' + (p.coleccion || ''));
  return MARCAS.find(function(m){ return t.indexOf(junto(m)) !== -1; }) || '';
}
// coleccion conocida que aparece en el texto (la mas larga gana: "Russian Diver" antes que "Diver")
function coleccionConocida(marca, texto){
  var palabras = plano(texto).split(' ').filter(Boolean), mejor = '', largo = 0;
  (COLECCIONES[marca] || []).forEach(function(c){
    var k = junto(c), n = plano(c).split(' ').length;
    for(var i = 0; i + n <= palabras.length; i++){
      var trozo = palabras.slice(i, i + n).join('');
      var igual = trozo === k || (k.length >= 6 && distancia(trozo, k) <= 1);
      if(igual && k.length > largo){ mejor = c; largo = k.length; }
    }
  });
  return mejor;
}
function coleccionDe(p){
  var marca = marcaDe(p);
  var col = coleccionConocida(marca, p.coleccion) || coleccionConocida(marca, p.nombre);
  if(!col){
    // sin coincidencia: lo escrito en "coleccion", o el nombre sin la marca
    var t = String(p.coleccion || '').trim() || String(p.nombre || '').replace(new RegExp(marca, 'i'), '').trim();
    col = t ? t.replace(/\s+/g, ' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); }) : 'Sin coleccion';
  }
  return { marca: marca, coleccion: col, clave: (marca || 'otra') + '|' + junto(col) };
}
function iniciales(col){
  var p = plano(col).split(' ').filter(Boolean);
  return (p.length > 1 ? p[0][0] + p[1][0] : (p[0] || '?').slice(0, 2)).toUpperCase();
}
function costoDe(p){ return Number(p.costoTotal) || ((Number(p.costo) || 0) + (Number(p.importacion) || 0)); }

// HTML de la vista "Por coleccion" para la lista de unidades ya filtrada (items = [{p, i}])
function htmlPorColeccion(items){
  var grupos = {};
  items.forEach(function(x){
    var c = coleccionDe(x.p);
    (grupos[c.clave] || (grupos[c.clave] = { marca: c.marca, coleccion: c.coleccion, units: [] })).units.push(x.p);
  });
  var lista = Object.keys(grupos).map(function(k){ return grupos[k]; })
    .sort(function(a, b){ return (a.marca || 'zz').localeCompare(b.marca || 'zz') || a.coleccion.localeCompare(b.coleccion); });
  return lista.map(function(g){
    var u = g.units.sort(function(a, b){ return (ORDEN_ESTADO[a.estado] || 0) - (ORDEN_ESTADO[b.estado] || 0) || String(a.nombre).localeCompare(String(b.nombre)); });
    var cuenta = function(e){ return u.filter(function(p){ return p.estado === e; }).length; };
    var conCosto = u.filter(function(p){ return costoDe(p) > 0; });
    var prom = conCosto.length ? conCosto.reduce(function(a, p){ return a + costoDe(p); }, 0) / conCosto.length : 0;
    var valor = u.filter(function(p){ return p.estado === 'disponible'; }).reduce(function(a, p){ return a + (Number(p.precio) || 0); }, 0);
    var modelos = {}; u.forEach(function(p){ modelos[junto(p.nombre) + '|' + (p.sku || '')] = 1; });
    var nModelos = Object.keys(modelos).length;
    var cifras = [['Disponibles', cuenta('disponible')], ['En transito', cuenta('transito')], ['Apartados', cuenta('reservado')], ['Bajo pedido', cuenta('bajopedido')], ['Vendidos', cuenta('vendido')]]
      .map(function(c){ return '<div class="col-cifra' + (c[1] ? '' : ' cero') + '"><b>' + c[1] + '</b><span>' + c[0] + '</span></div>'; }).join('');
    var dineros = 
      '<div class="col-cifra"><b>' + (prom ? dinero(prom) : '—') + '</b><span>Costo prom.</span></div>' +
      '<div class="col-cifra"><b>' + (valor ? dinero(valor) : '—') + '</b><span>Valor a la venta</span></div>';
    cifras = '<div class="col-estados">' + cifras + '</div><div class="col-dinero">' + dineros + '</div>';
    return '<section class="col-grupo">' +
      '<header class="col-cab">' +
        '<div class="col-emblema" aria-hidden="true"><span>' + esc(iniciales(g.coleccion)) + '</span></div>' +
        '<div class="col-titulo">' + (g.marca ? '<span class="col-marca">' + esc(g.marca) + '</span>' : '') + '<h3>' + esc(g.coleccion) + '</h3>' +
          '<span class="col-sub">' + u.length + ' reloj' + (u.length !== 1 ? 'es' : '') + ' · ' + nModelos + ' modelo' + (nModelos !== 1 ? 's' : '') + '</span></div>' +
        '<div class="col-cifras">' + cifras + '</div>' +
      '</header>' +
      '<div class="col-fichas">' + u.map(fichaHTML).join('') + '</div>' +
    '</section>';
  }).join('');
}

function fichaHTML(p){
  var id = esc(p.id), c = costoDe(p), mg = p.precio > 0 && c > 0 ? Math.round((p.precio - c) / p.precio * 100) : null;
  var dias = p.estado === 'disponible' ? diasEnInventario(p.fecha) : null;
  var foto = p.foto && /^https?:|^data:|^img\//.test(p.foto) ? '<img src="' + esc(p.foto) + '" alt="" loading="lazy" onerror="this.remove()">' : '<span class="inv-grid-sinfoto">Sin foto</span>';
  var imp = p.estado === 'transito' && !p.importacion;
  var linea2 = [p.sku ? 'Ref. ' + p.sku : '', p.mm ? p.mm + ' mm' : '', p.movimiento || ''].filter(Boolean).join(' · ');
  // la nota va siempre (vacia si no hay apartado) para que todas las fichas midan lo mismo
  var reserva = '<div class="col-ficha-nota">' + (p.estado === 'reservado' && p.reserva ? 'Apartado por ' + esc(p.reserva.clienteNombre || 'un cliente') : '') + '</div>';
  var acciones = (p.estado === 'transito' ? '<button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation();yaLlego(\'' + id + '\')">Ya llego</button>' : '') +
    (['disponible', 'transito', 'bajopedido'].indexOf(p.estado) !== -1 ? '<button type="button" class="btn btn-gold btn-sm" onclick="event.stopPropagation();abrirVentaModal(\'' + id + '\')">Vendido</button>' : '');
  return '<article class="inv-grid-card col-ficha" onclick="verDetalle(\'' + id + '\')">' +
    '<div class="inv-grid-foto">' + foto + '<span class="inv-grid-est est-' + esc(p.estado) + '">' + (ETIQUETA[p.estado] || esc(p.estado)) + '</span>' +
      (p.ocultoCatalogo ? '<span class="inv-grid-oculto" title="Oculto en la tienda">Oculto</span>' : '') + '</div>' +
    '<div class="inv-grid-info">' +
      '<b>' + esc(p.nombre || 'Sin nombre') + '</b><span>' + esc(linea2 || '—') + '</span>' +
      '<dl class="col-datos">' +
        '<div><dt>Costo</dt><dd>' + (imp ? '<span class="col-pend">Import. pendiente</span>' : c > 0 ? dinero(c) : '—') + '</dd></div>' +
        '<div><dt>Venta</dt><dd>' + (p.precio > 0 ? dinero(p.precio) : '—') + '</dd></div>' +
        '<div><dt>Margen</dt><dd class="' + (mg === null ? '' : mg >= 30 ? 'pos' : mg < 15 ? 'neg' : '') + '">' + (mg !== null ? mg + '%' : '—') + '</dd></div>' +
        '<div><dt>' + (dias !== null ? 'En stock' : 'Alta') + '</dt><dd>' + (dias !== null ? dias + ' d' : esc(p.fecha || '—')) + '</dd></div>' +
      '</dl>' + reserva +
      '<div class="col-acc">' + acciones +
        '<button type="button" class="btn btn-outline btn-sm col-ico" onclick="event.stopPropagation();editarProducto(\'' + id + '\')" title="Editar" aria-label="Editar">&#9998;</button>' +
        '<button type="button" class="btn btn-danger btn-sm col-ico" onclick="event.stopPropagation();eliminarProducto(\'' + id + '\')" title="Eliminar" aria-label="Eliminar">&#128465;</button>' +
      '</div>' +
    '</div></article>';
}

export { coleccionDe, htmlPorColeccion };
