function diasEnInventario(fecha){
  if(!fecha)return null;var p=fecha.split('/');if(p.length!==3)return null;
  var d=new Date(parseInt(p[2]),parseInt(p[1])-1,parseInt(p[0]));
  var diff=Math.floor((Date.now()-d.getTime())/86400000);
  return isNaN(diff)?null:diff;
}

// =================== RESERVAS Y ABONOS ===================
function totalAbonadoReserva(p){
  if(!p||!p.reserva||!p.reserva.abonos)return 0;
  return p.reserva.abonos.reduce(function(a,b){return a+(b.monto||0);},0);
}
function saldoPendienteReserva(p){
  if(!p||!p.reserva)return 0;
  return Math.max(0,(p.reserva.precioAcordado||0)-totalAbonadoReserva(p));
}

// =================== CATALOGO PUBLICO ===================
// Solo estos campos salen a la luz publica. Nunca costo, margen, precio minimo,
// proveedor, numero de serie ni tracking.
function camposPublicos(p){
  return {
    nombre:p.nombre||'', sku:p.sku||'', coleccion:p.coleccion||'', genero:p.genero||'',
    mm:p.mm||'', materialCaja:p.materialCaja||'', materialCorrea:p.materialCorrea||'',
    colorEsfera:p.colorEsfera||'', movimiento:p.movimiento||'', agua:p.agua||'',
    cristal:p.cristal||'', color:p.color||'', notas:p.notas||'', descripcion:p.descripcion||'', eta:p.eta||'',
    precio:p.precio||0, foto:p.foto||'', fotos:Array.isArray(p.fotos)?p.fotos.slice(0,12):[],
    estado:p.estado||'', _ts:p._ts||0
  };
}
function esPublicable(p){
  if(p.ocultoCatalogo) return false;
  if(p.estado==='disponible' || p.estado==='transito' || p.estado==='bajopedido') return true;
  if(p.estado==='vendido'){
    var dias = diasEnInventario(p.fechaVenta);
    return dias===null || dias<=DIAS_AGOTADO_VISIBLE;
  }
  return false;
}
var DIAS_AGOTADO_VISIBLE = 21; // dias que un reloj vendido se muestra como "Agotado" en el catalogo publico antes de desaparecer

function textoETA(eta){
  if(!eta) return 'Importacion pendiente';
  var hoy = new Date(); hoy.setHours(0,0,0,0);
  var fecha = new Date(eta+'T00:00:00');
  if(isNaN(fecha.getTime())) return 'Importacion pendiente';
  var dias = Math.round((fecha-hoy)/86400000);
  if(dias<=0) return 'Llegando';
  if(dias===1) return 'Llega mañana';
  return 'Llega en '+dias+' dias';
}

function ordenPeso(estado){
  if(estado==='vendido') return 3;
  if(estado==='bajopedido') return 2;
  if(estado==='transito') return 1;
  return 0;
}

export { camposPublicos, DIAS_AGOTADO_VISIBLE, diasEnInventario, esPublicable, ordenPeso, saldoPendienteReserva, textoETA, totalAbonadoReserva };
