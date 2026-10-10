// =================== DETALLE MODAL ===================
import { duplicarProducto, editarProducto } from './formulario.js';
import { eliminarProducto } from './lista.js';
import { abrirAbonoModal, cancelarReserva, completarVentaReserva } from './reservas.js';
import { idxInv, invNoExiste, state } from '../state.js';
import { saldoPendienteReserva, totalAbonadoReserva } from '../../products.js';

function verDetalle(id){
  var i=idxInv(id);
  if(i===-1){ invNoExiste(); cerrarModal(); return; }
  var p=state.inventario[i];
  var estados={disponible:'badge-green',transito:'badge-blue',bajopedido:'badge-slate',reservado:'badge-gold',vendido:'badge-red'};
  var etiquetas={disponible:'Disponible',transito:'En transito',bajopedido:'Bajo pedido',reservado:'Reservado',vendido:'Vendido'};
  var generos={hombre:'Hombre',mujer:'Mujer',unisex:'Unisex'};
  var mc=p.margen>=30?'var(--green)':p.margen>=15?'var(--accent)':'var(--red)';
  var imp=p.estado==='transito'&&!p.importacion;
  function spec(label,value){if(!value)return'';return'<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);"><span style="font-size:12px;color:var(--muted);">'+label+'</span><span style="font-size:13px;color:var(--black);text-align:right;max-width:60%;">'+value+'</span></div>';}
  var costoSection='<div style="display:flex;gap:8px;flex-wrap:wrap;padding:14px 0;">'+
    '<div style="flex:1;min-width:90px;background:var(--bg2);border-radius:8px;padding:10px;text-align:center;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.02em;color:var(--muted);margin-bottom:3px;">Costo</div><div style="font-family:DM Mono,monospace;font-size:14px;">$'+(p.costo||0).toFixed(2)+'</div></div>'+
    '<div style="flex:1;min-width:90px;background:var(--bg2);border-radius:8px;padding:10px;text-align:center;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.02em;color:var(--muted);margin-bottom:3px;">Importacion</div><div style="font-family:DM Mono,monospace;font-size:14px;color:'+(imp?'var(--blue)':'var(--black)')+';">'+(imp?'Pendiente':'$'+(p.importacion||0).toFixed(2))+'</div></div>'+
    '<div style="flex:1;min-width:90px;background:var(--bg2);border-radius:8px;padding:10px;text-align:center;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.02em;color:var(--muted);margin-bottom:3px;">Costo total</div><div style="font-family:DM Mono,monospace;font-size:14px;">'+(imp?'--':'$'+(p.costoTotal||0).toFixed(2))+'</div></div>'+
    '<div style="flex:1;min-width:90px;background:var(--bg2);border-radius:8px;padding:10px;text-align:center;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.02em;color:var(--muted);margin-bottom:3px;">Precio objetivo</div><div style="font-family:DM Mono,monospace;font-size:14px;color:var(--accent);">$'+(p.precio||0).toLocaleString()+'</div></div>'+
    (p.precioMin?'<div style="flex:1;min-width:90px;background:var(--bg2);border-radius:8px;padding:10px;text-align:center;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.02em;color:var(--muted);margin-bottom:3px;">Precio minimo</div><div style="font-family:DM Mono,monospace;font-size:14px;color:var(--red);">$'+p.precioMin.toLocaleString()+'</div></div>':'')+
    '<div style="flex:1;min-width:90px;background:var(--bg2);border-radius:8px;padding:10px;text-align:center;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.02em;color:var(--muted);margin-bottom:3px;">Margen</div><div style="font-family:DM Mono,monospace;font-size:14px;color:'+(imp?'var(--muted)':mc)+'">'+(imp?'--':p.margen+'%')+'</div></div>'+
  '</div>';
  var specsHtml=(p.mm||p.materialCaja||p.materialCorrea||p.colorEsfera||p.movimiento||p.agua||p.cristal||p.color||p.serie)?
    '<div style="padding:0 20px 4px;"><div style="font-size:10px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:var(--muted);margin:12px 0 4px;">Especificaciones</div>'+
      spec('Diametro',p.mm?p.mm+' mm':'')+spec('Material caja',p.materialCaja)+spec('Correa / brazalete',p.materialCorrea)+
      spec('Color esfera',p.colorEsfera)+spec('Movimiento',p.movimiento)+spec('Resistencia agua',p.agua)+
      spec('Cristal',p.cristal)+spec('Color / variante',p.color)+spec('Numero de serie',p.serie)+
    '</div>':'';
  var notasHtml=p.notas?'<div style="margin:0 20px 16px;background:var(--bg2);border-radius:8px;padding:12px;font-size:13px;color:var(--muted);line-height:1.6;">'+p.notas+'</div>':'';
  var infoInternaPartes=[];
  if(p.proveedor) infoInternaPartes.push('Proveedor: '+p.proveedor);
  if(p.paqueteria) infoInternaPartes.push('Paqueteria: '+p.paqueteria);
  if(p.tracking) infoInternaPartes.push('Guia: '+p.tracking);
  if(p.eta){ var etaD=new Date(p.eta+'T00:00:00'); infoInternaPartes.push('Llegada estimada: '+etaD.toLocaleDateString('es-MX')); }
  var internoHtml=infoInternaPartes.length?'<div style="margin:0 20px 16px;border:1px dashed var(--border2);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--muted);"><strong style="color:var(--black);">Interno — no visible al cliente:</strong> '+infoInternaPartes.join(' · ')+'</div>':'';
  var reservaHtml='';
  if(p.estado==='reservado'&&p.reserva){
    var abonado=totalAbonadoReserva(p);var saldo=saldoPendienteReserva(p);
    var abonosLista=(p.reserva.abonos||[]).map(function(a){return'<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);padding:4px 0;"><span>'+a.fecha+' · '+(a.metodoPago||'')+'</span><span style="color:var(--black);">$'+a.monto.toLocaleString()+'</span></div>';}).join('');
    reservaHtml='<div style="margin:0 20px 16px;background:var(--blue-bg);border:1px solid var(--blue);border-radius:8px;padding:14px;">'+
      '<div style="font-size:11px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:var(--blue);margin-bottom:8px;">Reserva activa</div>'+
      '<div style="font-size:13px;color:var(--black);margin-bottom:6px;">Cliente: <strong>'+p.reserva.clienteNombre+'</strong></div>'+
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;">'+
        '<div style="font-size:12px;color:var(--muted);">Precio acordado: <strong style="color:var(--black);">$'+p.reserva.precioAcordado.toLocaleString()+'</strong></div>'+
        '<div style="font-size:12px;color:var(--muted);">Abonado: <strong style="color:var(--green);">$'+abonado.toLocaleString()+'</strong></div>'+
        '<div style="font-size:12px;color:var(--muted);">Saldo: <strong style="color:'+(saldo>0?'var(--red)':'var(--green)')+';">$'+saldo.toLocaleString()+'</strong></div>'+
      '</div>'+
      (abonosLista?'<div style="border-top:1px solid var(--blue);padding-top:6px;margin-bottom:10px;">'+abonosLista+'</div>':'')+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">'+
        '<button class="btn btn-outline btn-sm" onclick="abrirAbonoModal(\''+p.id+'\')">Agregar abono</button>'+
        '<button class="btn btn-gold btn-sm" onclick="completarVentaReserva(\''+p.id+'\')">Completar venta</button>'+
        '<button class="btn btn-danger btn-sm" onclick="cancelarReserva(\''+p.id+'\')">Cancelar reserva</button>'+
      '</div>'+
    '</div>';
  }
  document.getElementById('inv-modal-content').innerHTML=
    (p.foto?'<div style="width:100%;height:300px;background:var(--bg2);display:flex;align-items:center;justify-content:center;overflow:hidden;"><img src="'+p.foto+'" style="width:100%;height:100%;object-fit:contain;" onerror="this.parentElement.remove()" /></div>':'')+
    '<div style="padding:20px 20px 0;">'+
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">'+
        '<div><div style="font-family:Cormorant Garamond,serif;font-size:20px;font-weight:300;color:var(--black);">'+p.nombre+'</div>'+
          '<div style="font-size:12px;color:var(--muted);margin-top:2px;">'+(p.coleccion?'Coleccion '+p.coleccion+' · ':'')+(p.sku?p.sku+' · ':'')+(generos[p.genero]||p.genero||'')+'</div></div>'+
        '<span class="badge '+(estados[p.estado]||'badge-blue')+'" style="flex-shrink:0;">'+(etiquetas[p.estado]||p.estado)+'</span>'+
      '</div>'+costoSection+
    '</div>'+specsHtml+notasHtml+internoHtml+reservaHtml+
    '<div style="display:flex;gap:8px;padding:16px 20px;border-top:1px solid var(--border);">'+
      '<button class="btn btn-gold" style="flex:1;" onclick="editarProducto(\''+p.id+'\')">Editar</button>'+
      '<button class="btn btn-outline" onclick="duplicarProducto(\''+p.id+'\')" title="Registrar otra unidad de este mismo modelo">Otra unidad</button>'+
      '<button class="btn btn-outline" onclick="cerrarModal()">Cerrar</button>'+
      '<button class="btn btn-danger" onclick="eliminarProducto(\''+p.id+'\')">Eliminar</button>'+
    '</div>';
  document.getElementById('inv-modal').style.display='block';
  document.body.style.overflow='hidden';
}
function cerrarModal(){document.getElementById('inv-modal').style.display='none';document.body.style.overflow='';}

export { cerrarModal, verDetalle };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { cerrarModal, verDetalle });
