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
// ficha tecnica pegada: solo texto, con tope de tamano
function fichaPublica(f){
  if(!Array.isArray(f)) return [];
  return f.slice(0,12).map(function(g){ return { t:String(g&&g.t||'').slice(0,60), f:(Array.isArray(g&&g.f)?g.f:[]).slice(0,40).map(function(r){ return [String(r&&r[0]||'').slice(0,60), String(r&&r[1]||'').slice(0,160)]; }) }; }).filter(function(g){ return g.f.length; });
}
function camposPublicos(p){
  return {
    nombre:p.nombre||'', sku:p.sku||'', coleccion:p.coleccion||'', genero:p.genero||'',
    mm:p.mm||'', materialCaja:p.materialCaja||'', materialCorrea:p.materialCorrea||'',
    colorEsfera:p.colorEsfera||'', movimiento:String(p.movimiento||'').replace(/^cuarzo japon[eé]s$/i,'Cuarzo'), agua:p.agua||'',
    cristal:p.cristal||'', color:p.color||'', ficha:fichaPublica(p.ficha),
    calibre:p.calibre||'', l2l:p.l2l||'', grosor:p.grosor||'', corona:p.corona||'', materialBisel:p.materialBisel||'', colorBisel:p.colorBisel||'', materialEsfera:p.materialEsfera||'', anchoCorrea:p.anchoCorrea||'', largoCorrea:p.largoCorrea||'', colorCorrea:p.colorCorrea||'', notas:p.notas||'', descripcion:p.descripcion||'', eta:p.eta||'',
    precio:p.precio||0, foto:p.foto||'', fotos:Array.isArray(p.fotos)?p.fotos.slice(0,12):[], fotoCompartir:p.fotoCompartir||'',
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

// Direccion propia de cada reloj para Google y para compartir: /reloj-technomarine-manta-ray-cstuzqs
// (el nombre sin acentos y al final la clave: la ultima parte del id, que es la que identifica el reloj).
// La usan la tienda y el panel. La misma funcion esta en cloudflare/tienda-worker/index.js: si cambias una, cambia la otra.
function claveReloj(id){
  var c = String(id || '').split('_').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
  return c || String(id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function rutaReloj(r){
  var slug = String((r && r.nombre) || 'reloj').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '') || 'reloj';
  return '/reloj-' + slug + '-' + claveReloj(r && r.id);
}

export { camposPublicos, claveReloj, DIAS_AGOTADO_VISIBLE, diasEnInventario, esPublicable, ordenPeso, rutaReloj, saldoPendienteReserva, textoETA, totalAbonadoReserva };
