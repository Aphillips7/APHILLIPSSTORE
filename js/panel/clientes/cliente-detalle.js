import { editarCliente, eliminarCliente, renderClientes, saldoPendienteCliente, totalCompradoCliente, whatsappLink } from './clientes.js';
import { cerrarModal } from '../inventario/detalle.js';
import { idxCliente, save, state } from '../state.js';
import { saldoPendienteReserva } from '../../products.js';

function marcarContactado(id){
  var i=idxCliente(id);
  if(i===-1)return;
  state.clientes[i].ultimoContacto=new Date().toLocaleDateString('es-MX');
  save('clientes');
  verDetalleCliente(id);
  renderClientes();
}
function diasDesdeContacto(fechaStr){
  if(!fechaStr)return null;
  var p=fechaStr.split('/');if(p.length!==3)return null;
  var d=new Date(parseInt(p[2]),parseInt(p[1])-1,parseInt(p[0]));
  return Math.floor((Date.now()-d.getTime())/86400000);
}

function historialComprasCliente(clienteId){
  if(!clienteId)return [];
  return state.movimientos.filter(m=>(m.tipo==='venta'||m.tipo==='abono'||m.tipo==='reserva_cancelada')&&m.clienteId===clienteId).sort((a,b)=>(b._ts||0)-(a._ts||0));
}
function verDetalleCliente(id){
  var i=idxCliente(id);
  if(i===-1){alert('Este cliente ya no existe (puede que se haya eliminado en otro dispositivo).');cerrarModal();renderClientes();return;}
  var c=state.clientes[i];
  var nombres={facebook:'Facebook',whatsapp:'WhatsApp',instagram:'Instagram',directo:'Directo'};
  var saldo=saldoPendienteCliente(c.id);
  var totalComprado=totalCompradoCliente(c.id);
  var historial=historialComprasCliente(c.id);
  var histHtml=historial.length?historial.map(function(m){
    var tipoLbl=m.tipo==='abono'?'Abono':m.tipo==='reserva_cancelada'?'Reserva cancelada':'Venta';
    var color=m.tipo==='reserva_cancelada'?'var(--muted)':'var(--black)';
    return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;"><span>'+m.fecha+' · '+tipoLbl+' · '+m.desc+'</span><span style="color:'+color+';font-family:DM Mono,monospace;">'+(m.tipo==='reserva_cancelada'?'--':'$'+m.monto.toLocaleString())+'</span></div>';
  }).join(''):'<div style="font-size:12px;color:var(--muted);padding:8px 0;">Sin compras registradas aun.</div>';
  var reservasActivas=state.inventario.filter(p=>p.estado==='reservado'&&p.reserva&&p.reserva.clienteId===c.id);
  var reservasHtml=reservasActivas.length?reservasActivas.map(function(p){
    return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;"><span>'+p.nombre+' · Reservado</span><span style="color:var(--red);font-family:DM Mono,monospace;">Debe $'+saldoPendienteReserva(p).toLocaleString()+'</span></div>';
  }).join(''):'';
  var wa=whatsappLink(c.tel);
  var dias=diasDesdeContacto(c.ultimoContacto);
  var contactoHtml='<div style="font-size:12px;color:var(--muted);margin-bottom:12px;">Ultimo contacto: '+(c.ultimoContacto?c.ultimoContacto+(dias!==null?' (hace '+dias+' dia'+(dias===1?'':'s')+')':''):'Sin registrar')+'</div>';
  document.getElementById('inv-modal-content').innerHTML=
    '<div style="padding:20px;">'+
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">'+
        '<div><div style="font-family:Cormorant Garamond,serif;font-size:20px;font-weight:300;color:var(--black);">'+c.nombre+'</div>'+
        '<div style="font-size:12px;color:var(--muted);margin-top:2px;">'+(c.tel?c.tel+' · ':'')+(nombres[c.canal]||c.canal||'')+' · Desde '+c.fecha+'</div></div>'+
        (totalComprado>0?'<span class="badge badge-green">Cliente</span>':'<span class="badge badge-blue">Prospecto</span>')+
      '</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0;">'+
        '<div style="flex:1;min-width:100px;background:var(--bg2);border-radius:8px;padding:10px;text-align:center;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.02em;color:var(--muted);margin-bottom:3px;">Total comprado</div><div style="font-family:DM Mono,monospace;font-size:14px;color:var(--green);">$'+totalComprado.toLocaleString()+'</div></div>'+
        '<div style="flex:1;min-width:100px;background:var(--bg2);border-radius:8px;padding:10px;text-align:center;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.02em;color:var(--muted);margin-bottom:3px;">Saldo pendiente</div><div style="font-family:DM Mono,monospace;font-size:14px;color:'+(saldo>0?'var(--red)':'var(--black)')+';">$'+saldo.toLocaleString()+'</div></div>'+
      '</div>'+
      contactoHtml+
      (c.producto?'<div style="font-size:12px;margin-bottom:10px;"><strong>Interesado en / compro:</strong> '+c.producto+'</div>':'')+
      (c.notas?'<div style="background:var(--bg2);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--muted);margin-bottom:16px;">'+c.notas+'</div>':'')+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">'+
        (wa?'<a href="'+wa+'" target="_blank" rel="noopener" class="btn btn-outline btn-sm" style="text-decoration:none;">Escribir por WhatsApp</a>':'')+
        '<button class="btn btn-outline btn-sm" onclick="marcarContactado(\''+c.id+'\')">Marcar contactado hoy</button>'+
        '<button class="btn btn-outline btn-sm" onclick="editarCliente(\''+c.id+'\')">Editar</button>'+
      '</div>'+
      (reservasHtml?'<div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:6px;">Reservas activas</div>'+reservasHtml:'')+
      '<div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin:16px 0 6px;">Historial</div>'+histHtml+
    '</div>'+
    '<div style="display:flex;gap:8px;padding:16px 20px;border-top:1px solid var(--border);">'+
      '<button class="btn btn-outline" style="flex:1;" onclick="cerrarModal()">Cerrar</button>'+
      '<button class="btn btn-danger" onclick="eliminarCliente(\''+c.id+'\');cerrarModal();">Eliminar cliente</button>'+
    '</div>';
  document.getElementById('inv-modal').style.display='block';
  document.body.style.overflow='hidden';
}

export { diasDesdeContacto, historialComprasCliente, marcarContactado, verDetalleCliente };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { marcarContactado, verDetalleCliente });
