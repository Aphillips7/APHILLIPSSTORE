// =================== INVENTARIO ===================
import { autoRegistrarCompraInv, existeCompraDe } from '../finanzas/registrar-compra.js';
import { verDetalle } from './detalle.js';
import { editarProducto } from './formulario.js';
import { abrirReservaModal } from './reservas.js';
import { abrirVentaModal } from './venta-modal.js';
import { idxInv, invNoExiste, save, state } from '../state.js';
import { diasEnInventario, saldoPendienteReserva } from '../../products.js';

var _filtroEstado='';
var _vistaActual='lista';

function setFiltroEstado(btn,estado){_filtroEstado=estado;document.querySelectorAll('.filtro-estado').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');renderInventario();}
function toggleVista(v){
  _vistaActual=v;
  ['lista','modelo'].forEach(id=>{var el=document.getElementById('vista-'+id);if(el){el.style.borderColor=v===id?'var(--accent)':'var(--border2)';el.style.color=v===id?'var(--accent)':'var(--muted)';}});
  renderInventario();
}

function eliminarProducto(id){
  if(!confirm('Eliminar esta unidad?'))return;
  var i=idxInv(id);
  if(i===-1){ renderInventario(); return; }
  state.inventario.splice(i,1);save('inventario');renderInventario();
}
function cambiarEstado(id,val){
  var i=idxInv(id);
  if(i===-1){ invNoExiste(); return; }
  if(val==='vendido'&&state.inventario[i].estado!=='vendido'){
    abrirVentaModal(id); return;
  }
  if(val==='reservado'&&state.inventario[i].estado!=='reservado'){
    abrirReservaModal(id); return;
  }
  var antes=state.inventario[i].estado;
  if(antes==='reservado'&&val!=='reservado'){
    if(!confirm('Este reloj tiene una reserva activa con '+(state.inventario[i].reserva?state.inventario[i].reserva.clienteNombre:'un cliente')+'. ¿Deseas quitar la reserva? Usa "Cancelar reserva" desde el detalle si quieres decidir que pasa con el abono.')) { renderInventario(); return; }
    delete state.inventario[i].reserva;
  }
  state.inventario[i].estado=val;
  save('inventario');
  if(antes==='transito'&&val==='disponible'&&!existeCompraDe(state.inventario[i])){autoRegistrarCompraInv(state.inventario[i]);}
  renderInventario();
}

function diasBadge(dias){
  if(dias===null)return'';
  if(dias<=14)return'<span class="dias-alerta dias-ok">'+dias+'d</span>';
  if(dias<=45)return'<span class="dias-alerta dias-warn">'+dias+'d</span>';
  return'<span class="dias-alerta dias-danger">'+dias+'d · Rebajar</span>';
}
function makeFotoHtml(url,size){
  var s=size||52;
  var st='width:'+s+'px;height:'+s+'px;object-fit:cover;border-radius:8px;border:1px solid var(--border);flex-shrink:0;';
  if(url)return'<img src="'+url+'" style="'+st+'" onerror="this.remove()" />';
  return'<div style="width:'+s+'px;height:'+s+'px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);display:flex;align-items:center;justify-content:center;font-size:'+Math.round(s*0.3)+'px;flex-shrink:0;color:var(--muted);">R</div>';
}
function renderInventario(){
  var disponibles=state.inventario.filter(p=>p.estado==='disponible').length;
  var transito=state.inventario.filter(p=>p.estado==='transito').length;
  var bajoPedido=state.inventario.filter(p=>p.estado==='bajopedido').length;
  var valorStock=state.inventario.filter(p=>p.estado==='disponible').reduce((a,p)=>a+(p.precio||0),0);
  var elD=document.getElementById('inv-stat-disponibles');var elT=document.getElementById('inv-stat-transito');var elBP=document.getElementById('inv-stat-bajopedido');var elV=document.getElementById('inv-stat-valor');
  if(elD)elD.textContent=disponibles;if(elT)elT.textContent=transito;if(elBP)elBP.textContent=bajoPedido;if(elV)elV.textContent='$'+valorStock.toLocaleString();
  var statStock=document.getElementById('stat-stock');if(statStock)statStock.textContent=disponibles;
  var lista=document.getElementById('inv-lista');
  var query=document.getElementById('inv-search')?document.getElementById('inv-search').value.toLowerCase():'';
  var estadosBadge={disponible:'badge-green',transito:'badge-blue',bajopedido:'badge-slate',reservado:'badge-gold',vendido:'badge-red'};
  var etiquetas={disponible:'Disponible',transito:'En transito',bajopedido:'Bajo pedido',reservado:'Reservado',vendido:'Vendido'};
  var items=state.inventario.map((p,i)=>({p,i})).filter(x=>{
    var mQ=(x.p.nombre||'').toLowerCase().includes(query)||(x.p.sku||'').toLowerCase().includes(query)||(x.p.coleccion||'').toLowerCase().includes(query)||(x.p.tracking||'').toLowerCase().includes(query);
    var mE=!_filtroEstado||x.p.estado===_filtroEstado;
    return mQ&&mE;
  });
  if(items.length===0){lista.innerHTML='<div class="empty"><span></span>'+(query?'Sin resultados para "'+query+'"':'Sin unidades registradas aun.')+'</div>';return;}
  if(_vistaActual==='modelo'){
    var grupos={};
    items.forEach(x=>{var key=x.p.nombre;if(!grupos[key])grupos[key]=[];grupos[key].push(x);});
    lista.innerHTML=Object.entries(grupos).map(([modelo,units])=>{
      var disp=units.filter(x=>x.p.estado==='disponible').length;
      var tran=units.filter(x=>x.p.estado==='transito').length;
      var conCosto=units.filter(x=>x.p.costoTotal>0);
      var promedio=conCosto.length?conCosto.reduce((a,x)=>a+x.p.costoTotal,0)/conCosto.length:0;
      var fotoSrc='';units.forEach(x=>{if(!fotoSrc&&x.p.foto)fotoSrc=x.p.foto;});
      var unitsHtml=units.map(x=>{
        var imp=x.p.estado==='transito'&&!x.p.importacion;
        var mc=x.p.margen>=30?'var(--green)':x.p.margen>=15?'var(--accent)':'var(--red)';
        return'<div style="display:flex;align-items:center;gap:8px;padding:8px 0 8px 66px;border-top:1px solid var(--border);">'+
          '<div style="flex:1;"><div style="font-size:12px;color:var(--black);">'+(imp?'<span style="color:var(--blue)">Importacion pendiente</span>':'Costo: $'+x.p.costoTotal.toFixed(2))+((!imp&&x.p.precio)?' · Margen: <span style="color:'+mc+'">'+x.p.margen+'%</span>':'')+'</div>'+
          '<div style="font-size:11px;color:var(--muted);">Venta: $'+(x.p.precio||0).toLocaleString()+' · '+x.p.fecha+'</div></div>'+
          '<span class="badge '+(estadosBadge[x.p.estado]||'badge-blue')+'">'+(etiquetas[x.p.estado]||x.p.estado)+'</span>'+
          '<button class="btn btn-outline btn-sm" onclick="verDetalle(\''+x.p.id+'\')" title="Ver">&#128065;</button>'+
          '<button class="btn btn-outline btn-sm" onclick="editarProducto(\''+x.p.id+'\')" title="Editar">&#9998;</button>'+
          '<button class="btn btn-danger" onclick="eliminarProducto(\''+x.p.id+'\')" title="Eliminar">&#128465;</button>'+
        '</div>';
      }).join('');
      return'<div style="margin-bottom:4px;">'+
        '<div class="list-item" style="gap:14px;padding-bottom:8px;cursor:pointer;" onclick="verDetalle(\''+units[0].p.id+'\')">'+
          makeFotoHtml(fotoSrc,52)+
          '<div class="list-item-info"><div class="list-item-name">'+modelo+(units[0].p.sku?' <span style="color:var(--muted);font-size:12px;">· '+units[0].p.sku+'</span>':'')+' </div>'+
          '<div class="list-item-sub">'+units.length+' ud. · '+disp+' disponible · '+tran+' en transito'+(promedio?' · Costo prom. $'+promedio.toFixed(2):'')+' </div></div>'+
        '</div>'+unitsHtml+'</div>';
    }).join('<div style="height:6px;"></div>');
  } else {
    lista.innerHTML=items.map(({p,i})=>{
      var imp=p.estado==='transito'&&!p.importacion;
      var mc=p.margen>=30?'var(--green)':p.margen>=15?'var(--accent)':'var(--red)';
      var dias=p.estado!=='vendido'?diasEnInventario(p.fecha):null;
      var opts=['disponible','transito','bajopedido','reservado','vendido'].map(e=>'<option value="'+e+'"'+(p.estado===e?' selected':'')+'>'+({disponible:'Disponible',transito:'En transito',bajopedido:'Bajo pedido',reservado:'Reservado',vendido:'Vendido'}[e]||e)+'</option>').join('');
      var subLinea=imp?'<span style="color:var(--blue)">Importacion pendiente</span>':'Costo: $'+(p.costoTotal||0).toFixed(2);
      if(p.estado==='reservado'&&p.reserva){
        subLinea='Reservado por <strong>'+p.reserva.clienteNombre+'</strong> · Saldo: $'+saldoPendienteReserva(p).toLocaleString();
      } else {
        subLinea+=((!imp&&p.precio)?' · Margen: <span style="color:'+mc+'">'+p.margen+'%</span>':'')+' · Venta: $'+(p.precio||0).toLocaleString();
      }
      return'<div class="list-item" style="gap:12px;cursor:pointer;" onclick="verDetalle(\''+p.id+'\')">'+
        makeFotoHtml(p.foto,52)+
        '<div class="list-item-info">'+
          '<div class="list-item-name" style="display:flex;align-items:center;gap:8px;">'+p.nombre+(p.sku?' <span style="color:var(--muted);font-size:12px;">· '+p.sku+'</span>':'')+(dias!==null&&p.estado==='disponible'?diasBadge(dias):'')+' </div>'+
          '<div class="list-item-sub">'+subLinea+'</div>'+
        '</div>'+
        '<select class="cambio-estado-select" onclick="event.stopPropagation()" onchange="cambiarEstado(\''+p.id+'\',this.value)">'+opts+'</select>'+
        '<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();editarProducto(\''+p.id+'\')" title="Editar">&#9998;</button>'+
        '<button class="btn btn-danger" onclick="event.stopPropagation();eliminarProducto(\''+p.id+'\')" title="Eliminar">&#128465;</button>'+
      '</div>';
    }).join('');
  }
}

export { _filtroEstado, _vistaActual, cambiarEstado, diasBadge, eliminarProducto, makeFotoHtml, renderInventario, setFiltroEstado, toggleVista };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { cambiarEstado, eliminarProducto, renderInventario, setFiltroEstado, toggleVista });
