// =================== FINANZAS > RENTABILIDAD (rediseno fase 4) ===================
// Donde se gana el dinero: ganancia por marca, ventas por canal, relojes mas rentables y el
// inventario visto como dinero (capital inmovilizado, dias para vender y relojes estancados).
import { CANALES, DIAS_ESTANCADO, costoDe, estadoResultados, inventarioDinero, movimientosDe, periodo } from './calculos.js';
import { chipsPeriodo } from './resumen.js';
import { dinero, esc, kpiHTML, tablaHTML, vacioHTML } from '../componentes.js';
import { barrasH, dona } from '../graficas.js';
import { state } from '../state.js';

var _per = 'anio';
const COLORES_CANAL = ['var(--g-actual)', 'var(--g-comp)', 'var(--g-meta)', 'var(--amber)', 'var(--green)', 'var(--blue)'];

function relojDe(m){
  if(m.invId){ var p = state.inventario.find(function(x){ return x.id === m.invId; }); if(p) return p; }
  return null;
}
function marcaDe(m){
  var p = relojDe(m);
  if(p && p.coleccion) return p.coleccion;
  return (String(m.desc || '').split(/\s+/)[0] || 'Otra').replace(/[^\wÀ-ÿ-]/g, '') || 'Otra';
}

function renderAnalisis(){
  chipsPeriodo('fin-periodos-an', _per, 'setPeriodoAnalisis');
  var per = periodo(_per);
  var movs = movimientosDe(per.meses);
  var ventas = movs.filter(function(m){ return m.tipo === 'venta' && !m._soloRegistro; });
  var r = estadoResultados(movs);
  var inv = inventarioDinero();

  var k = document.getElementById('fin-kpis-an');
  if(k) k.innerHTML = [
    kpiHTML({ label: 'Margen bruto', valor: r.margenBruto + '%', tono: !r.ingresos ? '' : r.margenBruto >= 30 ? 'pos' : r.margenBruto < 15 ? 'neg' : '', pie: 'sano: 30 % o mas' }),
    kpiHTML({ label: 'Ticket promedio', valor: dinero(r.ticket), pie: r.nVentas + ' venta' + (r.nVentas !== 1 ? 's' : '') }),
    kpiHTML({ label: 'Descuentos dados', valor: dinero(r.descuentos), tono: r.descuentos ? 'neg' : '', pie: 'contra el precio pedido' }),
    kpiHTML({ label: 'Dias para vender', valor: inv.diasVenta === null ? '—' : inv.diasVenta + ' d', pie: inv.nVendidos ? 'promedio de ' + inv.nVendidos + ' relojes' : 'sin datos aun' })
  ].join('');

  // ganancia por marca
  var marcas = {};
  ventas.forEach(function(m){ var k2 = marcaDe(m), x = marcas[k2] || (marcas[k2] = { v: 0, g: 0, n: 0 }); x.v += Number(m.monto) || 0; x.g += (Number(m.monto) || 0) - (Number(m.costo) || 0); x.n++; });
  var filas = Object.keys(marcas).map(function(k2){ var x = marcas[k2]; return { label: k2, valor: x.g, extra: (x.v ? Math.round(x.g / x.v * 100) : 0) + '% · ' + x.n }; }).sort(function(a, b){ return b.valor - a.valor; }).slice(0, 8);
  var em = document.getElementById('fin-marcas');
  if(em) em.innerHTML = filas.length ? barrasH(filas) + '<div class="tenue-peq" style="margin-top:8px;">Ganancia · margen · unidades</div>' : vacioHTML({ icono: 'grafica', titulo: 'Sin ventas en este periodo' });

  // ventas por canal
  var can = {};
  ventas.forEach(function(m){ var c = m.canal || 'otro'; can[c] = (can[c] || 0) + (Number(m.monto) || 0); });
  var segs = Object.keys(can).sort(function(a, b){ return can[b] - can[a]; }).map(function(c, i){ return { label: CANALES[c] || c, valor: can[c], color: COLORES_CANAL[i % COLORES_CANAL.length] }; });
  var ec = document.getElementById('fin-canales');
  if(ec){ if(segs.length) dona(ec, segs, { valor: String(ventas.length), texto: 'ventas' }); else ec.innerHTML = vacioHTML({ icono: 'grafica', titulo: 'Sin ventas en este periodo' }); }

  // relojes mas rentables
  var top = ventas.map(function(m){ var g = (Number(m.monto) || 0) - (Number(m.costo) || 0); return { m: m, g: g, mg: m.monto ? Math.round(g / m.monto * 100) : 0 }; })
    .sort(function(a, b){ return b.g - a.g; }).slice(0, 8);
  var et = document.getElementById('fin-top-relojes');
  if(et) et.innerHTML = tablaHTML([{ t: 'Reloj' }, { t: 'Fecha' }, { t: 'Vendido', der: true }, { t: 'Ganancia', der: true }, { t: 'Margen', der: true }],
    top.map(function(x){ return [esc(x.m.desc), esc(x.m.fecha), dinero(x.m.monto), '<span class="' + (x.g < 0 ? 'neg' : 'pos') + '">' + dinero(x.g) + '</span>', x.mg + '%']; }),
    { icono: 'grafica', titulo: 'Sin ventas en este periodo' });

  // inventario como dinero
  var ei = document.getElementById('fin-inv-dinero');
  if(ei){
    var h = '<div class="inv-dinero">' +
      '<div><span class="eyebrow">Capital en relojes</span><b>' + dinero(inv.capital) + '</b><small>' + inv.unidades + ' unidades a costo</small></div>' +
      '<div><span class="eyebrow">Valen a precio de venta</span><b>' + dinero(inv.aPrecio) + '</b><small>ganancia posible ' + dinero(inv.aPrecio - inv.capital) + '</small></div>' +
      '<div><span class="eyebrow">Estancado (+' + DIAS_ESTANCADO + ' dias)</span><b class="' + (inv.capitalEstancado ? 'neg' : '') + '">' + dinero(inv.capitalEstancado) + '</b><small>' + inv.estancados.length + ' reloj' + (inv.estancados.length !== 1 ? 'es' : '') + '</small></div></div>';
    h += inv.estancados.length ? tablaHTML([{ t: 'Reloj' }, { t: 'Dias', der: true }, { t: 'Costo', der: true }, { t: 'Precio', der: true }, { t: 'Precio sugerido', der: true }, { t: '' }],
      inv.estancados.slice(0, 12).map(function(x){
        var p = x.p, costo = costoDe(p), precio = Number(p.precio) || 0;
        // sugerencia: bajar 10 % cada 30 dias por encima de 60, sin bajar del costo + 10 %
        var baja = Math.min(0.3, Math.floor((x.dias - DIAS_ESTANCADO) / 30 + 1) * 0.1);
        var sug = precio ? Math.max(Math.round(costo * 1.1), Math.round(precio * (1 - baja) / 5) * 5) : 0;
        return [esc(p.nombre) + (p.sku ? ' <span class="tenue-peq">' + esc(p.sku) + '</span>' : ''), String(x.dias), dinero(costo), dinero(precio),
          sug && sug < precio ? dinero(sug) + ' <span class="tenue-peq">−' + Math.round((1 - sug / precio) * 100) + '%</span>' : '—',
          '<button type="button" class="btn btn-outline btn-sm" onclick="irSeccion(\'inventario\',\'relojes\');editarProducto(\'' + esc(p.id) + '\')">Editar</button>'];
      })) : '<p class="eq-texto">Ningun reloj disponible lleva mas de ' + DIAS_ESTANCADO + ' dias. Buen ritmo de rotacion.</p>';
    ei.innerHTML = h;
  }
}
function setPeriodoAnalisis(id){ _per = id; renderAnalisis(); }

export { renderAnalisis, setPeriodoAnalisis };
Object.assign(window, { setPeriodoAnalisis });
