// =================== CLIENTES: PERFIL, SEGMENTOS Y DUPLICADOS (rediseno fase 6) ===================
// Perfil de cada cliente a partir de sus ventas, abonos y apartados; segmentos automaticos para saber a
// quien escribir; mensaje de WhatsApp sugerido segun el segmento; y deteccion de clientes repetidos.
import { finParseFecha } from '../finanzas/fechas.js';
import { saldoPendienteReserva } from '../../products.js';
import { state } from '../state.js';

const DIAS_NUEVO = 30, DIAS_INACTIVO = 90, DIAS_SIN_CONTACTO = 30;
const SEGMENTOS = [
  { id: 'todos', t: 'Todos' },
  { id: 'vip', t: 'VIP', ayuda: '2 compras o mas' },
  { id: 'compradores', t: 'Compradores' },
  { id: 'nuevos', t: 'Nuevos', ayuda: 'registrados hace menos de 30 dias' },
  { id: 'inactivos', t: 'Inactivos', ayuda: 'compraron y llevan mas de 90 dias sin comprar' },
  { id: 'prospectos', t: 'Prospectos', ayuda: 'todavia no compran' },
  { id: 'seguimiento', t: 'Por contactar', ayuda: 'prospectos sin contacto hace mas de 30 dias' },
  { id: 'saldo', t: 'Con saldo' }
];

function telDe(c){ return String((c && (c.tel || c.telefono)) || ''); }
function digitos(t){ var d = String(t || '').replace(/\D/g, ''); if(d.length === 11 && d.indexOf('507') === 0) d = d.slice(3); return d; }
function waDe(c){ var d = digitos(telDe(c)); if(d.length === 7 || d.length === 8) d = '507' + d; return d.length >= 10 ? d : ''; }
function dias(fecha){ var d = finParseFecha(fecha); return d ? Math.floor((Date.now() - d.getTime()) / 86400000) : null; }
function primerNombre(c){ return String((c && c.nombre) || '').trim().split(/\s+/)[0] || ''; }

// Perfil calculado (no se guarda): compras, total, ultima compra, saldo, segmentos
function perfil(c){
  var ventas = state.movimientos.filter(function(m){ return m.clienteId === c.id && m.tipo === 'venta' && !m._soloRegistro; });
  var abonos = state.movimientos.filter(function(m){ return m.clienteId === c.id && m.tipo === 'abono'; });
  var total = ventas.reduce(function(a, m){ return a + (Number(m.monto) || 0); }, 0) + abonos.reduce(function(a, m){ return a + (Number(m.monto) || 0); }, 0);
  var ultima = null;
  ventas.concat(abonos).forEach(function(m){ var d = finParseFecha(m.fecha); if(d && (!ultima || d > ultima)) ultima = d; });
  var apartados = state.inventario.filter(function(p){ return p.estado === 'reservado' && p.reserva && p.reserva.clienteId === c.id; });
  var saldo = apartados.reduce(function(a, p){ return a + saldoPendienteReserva(p); }, 0);
  var compras = ventas.length;
  var diasCompra = ultima ? Math.floor((Date.now() - ultima.getTime()) / 86400000) : null;
  var diasAlta = dias(c.fecha), diasContacto = dias(c.ultimoContacto);
  var comprador = compras > 0 || abonos.length > 0;
  var seg = {
    vip: compras >= 2,
    compradores: comprador,
    nuevos: diasAlta !== null && diasAlta <= DIAS_NUEVO,
    inactivos: comprador && diasCompra !== null && diasCompra > DIAS_INACTIVO,
    prospectos: !comprador,
    seguimiento: !comprador && (diasContacto === null ? (diasAlta === null || diasAlta > DIAS_SIN_CONTACTO) : diasContacto > DIAS_SIN_CONTACTO),
    saldo: saldo > 0
  };
  return { c: c, compras: compras, abonos: abonos.length, total: total, ticket: compras ? Math.round(total / compras) : 0, ultima: ultima, diasCompra: diasCompra,
    diasAlta: diasAlta, diasContacto: diasContacto, saldo: saldo, apartados: apartados, seg: seg };
}
function etiquetaPrincipal(pf){
  if(pf.seg.saldo) return ['pendiente', 'Debe ' + '$' + Math.round(pf.saldo).toLocaleString('en-US')];
  if(pf.seg.vip) return ['ok', 'VIP'];
  if(pf.seg.inactivos) return ['vencido', 'Inactivo'];
  if(pf.seg.compradores) return ['ok', 'Comprador'];
  if(pf.seg.nuevos) return ['info', 'Nuevo'];
  return ['cancelado', 'Prospecto'];
}

// Mensaje de WhatsApp segun el momento del cliente (el dueno lo revisa y lo envia)
function mensajeSugerido(pf){
  var n = primerNombre(pf.c), hola = 'Hola' + (n ? ' ' + n : '') + ', te escribe APHILLIPS STORE. ';
  if(pf.seg.saldo) return hola + 'Te recuerdo que tu apartado tiene un saldo de $' + Math.round(pf.saldo).toLocaleString('en-US') + '. ¿Cuando te queda bien completarlo?';
  if(pf.seg.inactivos) return hola + '¿Como te ha ido con tu reloj? Nos llegaron modelos nuevos y me acorde de ti. ¿Te mando fotos de lo que tenemos disponible?';
  if(pf.seg.vip) return hola + 'Gracias por seguir confiando en nosotros. Antes de publicarlos, quiero mostrarte primero los relojes que acaban de llegar. ¿Te paso las fotos?';
  if(pf.seg.compradores && pf.diasCompra !== null && pf.diasCompra <= 21) return hola + '¿Que tal tu reloj nuevo? Si te gusto, nos ayudaria mucho una resena o que nos etiquetes en Instagram. ¡Gracias por tu compra!';
  if(pf.seg.compradores) return hola + 'Tenemos novedades que van con tu estilo. ¿Te muestro lo que esta disponible esta semana?';
  return hola + (pf.c.producto ? '¿Sigues interesado en el ' + pf.c.producto + '? ' : '') + 'Te puedo enviar fotos, precio y opciones de pago. ¿Te interesa?';
}

// Grupos de posibles duplicados: mismo telefono o mismo nombre (sin acentos ni espacios)
function normNombre(t){ return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
function duplicados(){
  var porClave = {};
  state.clientes.forEach(function(c){
    var claves = [];
    var d = digitos(telDe(c)); if(d.length >= 7) claves.push('t' + d);
    var nn = normNombre(c.nombre); if(nn.length >= 6) claves.push('n' + nn);
    claves.forEach(function(k){ (porClave[k] = porClave[k] || []).push(c); });
  });
  var vistos = {}, grupos = [];
  Object.keys(porClave).forEach(function(k){
    var g = porClave[k]; if(g.length < 2) return;
    var id = g.map(function(c){ return c.id; }).sort().join('|');
    if(vistos[id]) return; vistos[id] = true;
    grupos.push({ motivo: k[0] === 't' ? 'mismo telefono' : 'mismo nombre', clientes: g });
  });
  return grupos;
}

export { DIAS_INACTIVO, SEGMENTOS, digitos, duplicados, etiquetaPrincipal, mensajeSugerido, perfil, primerNombre, telDe, waDe };
