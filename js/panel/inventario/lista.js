// =================== INVENTARIO ===================
import { coleccionDe, htmlPorColeccion } from './colecciones.js';
import { registrarCompraConMetodo } from '../finanzas/registrar-compra.js';
import { verDetalle } from './detalle.js';
import './llegada.js';   // boton "Ya llego" (yaLlego en window)
import { editarProducto } from './formulario.js';
import { abrirReservaModal } from './reservas.js';
import { abrirVentaModal } from './venta-modal.js';
import { idxInv, invNoExiste, save, state } from '../state.js';
import { diasEnInventario, saldoPendienteReserva } from '../../products.js';
import { claveMes, costoDe } from '../finanzas/calculos.js';
import { finMesKey } from '../finanzas/fechas.js';
import { dinero, esc, kpiHTML } from '../componentes.js';

var _filtroEstado='';
var _filtroCalidad='';
var _vistaActual=(function(){ try{ return localStorage.getItem('aphillips_vista_inv')||'lista'; }catch(e){ return 'lista'; } })();
const PUBLICABLES=['disponible','transito','bajopedido'];

// Alertas de calidad (rediseno fase 7): cada una filtra la lista al tocarla
const CALIDAD=[
  { id:'sinFoto', t:'Sin foto', f:function(p){ return PUBLICABLES.indexOf(p.estado)!==-1&&!p.foto&&!(p.fotos&&p.fotos.length); } },
  { id:'sinMedida', t:'Sin medida (mm)', f:function(p){ return PUBLICABLES.indexOf(p.estado)!==-1&&!p.mm; } },
  { id:'sinPrecio', t:'Sin precio', f:function(p){ return (p.estado==='disponible'||p.estado==='transito')&&!(p.precio>0); } },
  { id:'sinCosto', t:'Sin costo', f:function(p){ return ['disponible','transito','reservado','vendido'].indexOf(p.estado)!==-1&&!(costoDe(p)>0); } },
  { id:'margenBajo', t:'Margen bajo (<15 %)', f:function(p){ return p.estado==='disponible'&&p.precio>0&&costoDe(p)>0&&(p.precio-costoDe(p))/p.precio<0.15; } },
  { id:'estancado', t:'+60 dias sin venderse', f:function(p){ var d=p.estado==='disponible'?diasEnInventario(p.fecha):null; return d!==null&&d>60; } },
  { id:'transitoLargo', t:'Transito +20 dias', f:function(p){ var d=p.estado==='transito'?diasEnInventario(p.fecha):null; return d!==null&&d>20; } },
  { id:'oculto', t:'Oculto en la tienda', f:function(p){ return p.ocultoCatalogo&&PUBLICABLES.indexOf(p.estado)!==-1; } }
];
function setFiltroCalidad(id){ _filtroCalidad=_filtroCalidad===id?'':id; renderInventario(); }

// Clasificacion ABC por modelo segun la ganancia que dejaron sus ventas de los ultimos 12 meses:
// A = el 80 % de la ganancia, B = el siguiente 15 %, C = el resto. Sin ventas = sin clase.
function claveModelo(t){ return String(t||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
function clasesABC(){
  var hoy=new Date(), desde=claveMes(new Date(hoy.getFullYear(),hoy.getMonth()-11,1));
  var gan={};
  state.movimientos.forEach(function(m){
    if(m.tipo!=='venta'||m._soloRegistro||finMesKey(m.fecha)<desde) return;
    var inv=m.invId&&state.inventario.find(function(x){ return x.id===m.invId; });
    var k=claveModelo(inv?inv.nombre:String(m.desc||'').split(' · ')[0]);
    if(k) gan[k]=(gan[k]||0)+(Number(m.monto)||0)-(Number(m.costo)||0);
  });
  var orden=Object.keys(gan).filter(function(k){ return gan[k]>0; }).sort(function(a,b){ return gan[b]-gan[a]; });
  var total=orden.reduce(function(a,k){ return a+gan[k]; },0), acum=0, out={};
  orden.forEach(function(k){ var antes=acum/total; acum+=gan[k]; out[k]=antes<0.8?'A':antes<0.95?'B':'C'; });
  return out;
}
function chipABC(clase){ return clase?'<span class="abc abc-'+clase+'" title="Clase '+clase+': '+(clase==='A'?'de los modelos que mas ganancia dejan':clase==='B'?'ganancia media':'deja poca ganancia')+'">'+clase+'</span>':''; }

function renderKpisInv(){
  var cont=document.getElementById('inv-kpis'); if(!cont) return;
  var por=function(e){ return state.inventario.filter(function(p){ return p.estado===e; }); };
  var disp=por('disponible'), tran=por('transito'), res=por('reservado');
  var mes=claveMes(new Date());
  var vendMes=state.inventario.filter(function(p){ return p.estado==='vendido'&&finMesKey(p.fechaVenta)===mes; }).length;
  var stock=disp.concat(tran,res);
  var capital=stock.reduce(function(a,p){ return a+costoDe(p); },0), aPrecio=stock.reduce(function(a,p){ return a+(Number(p.precio)||0); },0);
  var conAmbos=disp.filter(function(p){ return p.precio>0&&costoDe(p)>0; });
  var margen=conAmbos.length?Math.round(conAmbos.reduce(function(a,p){ return a+(p.precio-costoDe(p))/p.precio; },0)/conAmbos.length*100):0;
  cont.innerHTML=[
    kpiHTML({ label:'Disponibles', valor:String(disp.length), pie:dinero(disp.reduce(function(a,p){ return a+(Number(p.precio)||0); },0))+' a precio', onclick:"setFiltroEstado(null,'disponible')" }),
    kpiHTML({ label:'En transito', valor:String(tran.length), pie:dinero(tran.reduce(function(a,p){ return a+costoDe(p); },0))+' pagados', onclick:"setFiltroEstado(null,'transito')" }),
    kpiHTML({ label:'Apartados', valor:String(res.length), pie:dinero(res.reduce(function(a,p){ return a+saldoPendienteReserva(p); },0))+' por cobrar', onclick:"setFiltroEstado(null,'reservado')" }),
    kpiHTML({ label:'Vendidos este mes', valor:String(vendMes), onclick:"irSeccion('ventas','historial')" }),
    kpiHTML({ label:'Capital en relojes', valor:dinero(capital), pie:'valen '+dinero(aPrecio)+' a precio' }),
    kpiHTML({ label:'Margen del stock', valor:margen+'%', tono:!conAmbos.length?'':margen>=30?'pos':margen<15?'neg':'', pie:'promedio de lo disponible' })
  ].join('');
}
function renderCalidad(){
  var cont=document.getElementById('inv-calidad'); if(!cont) return;
  var chips=CALIDAD.map(function(c){ return { c:c, n:state.inventario.filter(c.f).length }; }).filter(function(x){ return x.n>0||x.c.id===_filtroCalidad; });
  if(!chips.length){ cont.innerHTML='<span class="calidad-ok">Todo el inventario esta completo</span>'; return; }
  cont.innerHTML='<span class="calidad-t">Para revisar</span>'+chips.map(function(x){
    return '<button type="button" class="calidad-chip'+(x.c.id===_filtroCalidad?' active':'')+'" onclick="setFiltroCalidad(\''+x.c.id+'\')">'+x.c.t+' <b>'+x.n+'</b></button>';
  }).join('');
}

function setFiltroEstado(btn,estado){_filtroEstado=estado;document.querySelectorAll('.filtro-estado').forEach(function(b){ b.classList.toggle('active',(b.getAttribute('onclick')||'').indexOf("'"+estado+"')")!==-1); });renderInventario();}
function toggleVista(v){
  _vistaActual=v;
  try{ localStorage.setItem('aphillips_vista_inv',v); }catch(e){}
  ['lista','cuadricula','modelo'].forEach(function(id){ var el=document.getElementById('vista-'+id); if(el) el.classList.toggle('active',v===id); });
  renderInventario();
}

function eliminarProducto(id){
  var i=idxInv(id);
  if(i===-1){ renderInventario(); return; }
  var p=state.inventario[i];
  // poka-yoke: un reloj apartado tiene dinero de un cliente; primero se decide que pasa con el abono
  if(p.estado==='reservado'){ alert('Este reloj esta apartado por '+(p.reserva?p.reserva.clienteNombre:'un cliente')+'. Primero usa "Cancelar reserva" en su ficha para decidir que pasa con el abono.'); return; }
  if(!confirm('¿Eliminar "'+(p.nombre||'esta unidad')+(p.sku?' · Ref. '+p.sku:'')+'" del inventario?'+(p.estado==='vendido'?'\n\nLa venta ya registrada en Finanzas NO se borra.':'')+'\n\nNo se puede deshacer.'))return;
  i=idxInv(id);
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
  // poka-yoke: quitar un apartado desde aqui borraria la reserva sin decidir que pasa con el abono
  if(antes==='reservado'&&val!=='reservado'){
    alert('Este reloj esta apartado por '+(state.inventario[i].reserva?state.inventario[i].reserva.clienteNombre:'un cliente')+'. Para quitar el apartado usa "Cancelar reserva" en su ficha (ahi decides si se devuelve el abono).');
    renderInventario(); return;
  }
  // un reloj vendido que vuelve a la venta: la venta ya registrada sigue sumando en Finanzas
  if(antes==='vendido'&&val!=='vendido'){
    if(!confirm('Este reloj figura como VENDIDO y su venta esta registrada en Finanzas.\n\nSi lo cambias a "'+val+'", la venta NO se borra de Finanzas (tendrias que borrarla tu en Historial).\n\n¿Cambiarlo de todas formas?')){ renderInventario(); return; }
    delete state.inventario[i].precioVenta; delete state.inventario[i].fechaVenta;
  }
  state.inventario[i].estado=val;
  save('inventario');
  // al pasar a un estado pagado (por ejemplo de bajo pedido a transito) la compra se registra sola
  registrarCompraConMetodo(state.inventario[i]).then(function(avisoC){ if(avisoC&&window.toastPanel) window.toastPanel(avisoC); });
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
  renderKpisInv();
  renderCalidad();
  ['lista','cuadricula','modelo'].forEach(function(id){ var el=document.getElementById('vista-'+id); if(el) el.classList.toggle('active',_vistaActual===id); });
  var abc=clasesABC();
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
    var mQ=!query||(x.p.nombre||'').toLowerCase().includes(query)||(x.p.sku||'').toLowerCase().includes(query)||(x.p.coleccion||'').toLowerCase().includes(query)||(x.p.tracking||'').toLowerCase().includes(query)||coleccionDe(x.p).coleccion.toLowerCase().includes(query);
    var mE=!_filtroEstado||x.p.estado===_filtroEstado;
    var cal=_filtroCalidad&&CALIDAD.find(function(c){ return c.id===_filtroCalidad; });
    return mQ&&mE&&(!cal||cal.f(x.p));
  });
  var resEl=document.getElementById('inv-resultado');
  if(resEl) resEl.textContent=items.length+' unidad'+(items.length!==1?'es':'')+(_filtroCalidad?' · '+(CALIDAD.find(function(c){ return c.id===_filtroCalidad; })||{}).t:'');
  if(items.length===0){lista.innerHTML='<div class="empty"><span></span>'+(query?'Sin resultados para "'+esc(query)+'"':'Sin unidades para este filtro.')+'</div>';return;}
  if(_vistaActual==='cuadricula'){
    var etiq={disponible:'Disponible',transito:'En transito',bajopedido:'Bajo pedido',reservado:'Apartado',vendido:'Vendido'};
    lista.innerHTML='<div class="inv-grid">'+items.map(function(x){
      var q=x.p, dias=q.estado==='disponible'?diasEnInventario(q.fecha):null, c=costoDe(q), mg=q.precio>0&&c>0?Math.round((q.precio-c)/q.precio*100):null;
      var foto=q.foto&&/^https?:|^data:|^img\//.test(q.foto)?'<img src="'+esc(q.foto)+'" alt="" loading="lazy" onerror="this.remove()">':'<span class="inv-grid-sinfoto">Sin foto</span>';
      return '<div class="inv-grid-card" onclick="verDetalle(\''+esc(q.id)+'\')">'+
        '<div class="inv-grid-foto">'+foto+'<span class="inv-grid-est est-'+q.estado+'">'+(etiq[q.estado]||q.estado)+'</span>'+chipABC(abc[claveModelo(q.nombre)])+(q.ocultoCatalogo?'<span class="inv-grid-oculto" title="Oculto en la tienda">Oculto</span>':'')+'</div>'+
        '<div class="inv-grid-info"><b>'+esc(q.nombre)+'</b><span>'+esc([q.sku,q.mm?q.mm+' mm':''].filter(Boolean).join(' · '))+'</span>'+
        '<div class="inv-grid-precio"><b>'+(q.precio>0?dinero(q.precio):'<span class="tenue-peq">Sin precio</span>')+'</b>'+(mg!==null?'<span class="'+(mg>=30?'pos':mg<15?'neg':'')+'">'+mg+'%</span>':'')+(dias!==null?diasBadge(dias):'')+'</div>'+
        '<div class="inv-grid-acc">'+(q.estado==='transito'?'<button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation();yaLlego(\''+esc(q.id)+'\')">Ya llego</button>':'')+
        (['disponible','transito','bajopedido'].indexOf(q.estado)!==-1?'<button type="button" class="btn btn-gold btn-sm" onclick="event.stopPropagation();abrirVentaModal(\''+esc(q.id)+'\')">Vendido</button>':'')+'</div></div></div>';
    }).join('')+'</div>';
    return;
  }
  if(_vistaActual==='modelo'){
    // por coleccion: marca + coleccion base (Pro Diver Scuba y Pro Diver Automatico van juntos), ver colecciones.js
    lista.innerHTML=htmlPorColeccion(items, !!query);   // con busqueda, las colecciones encontradas se abren solas
  } else {
    lista.innerHTML=items.map(({p,i})=>{
      var imp=p.estado==='transito'&&!p.importacion;
      var mc=p.margen>=30?'var(--green)':p.margen>=15?'var(--amber)':'var(--red)';
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
          '<div class="list-item-name" style="display:flex;align-items:center;gap:8px;">'+esc(p.nombre)+(p.sku?' <span style="color:var(--muted);font-size:12px;">· '+esc(p.sku)+'</span>':'')+chipABC(abc[claveModelo(p.nombre)])+(dias!==null&&p.estado==='disponible'?diasBadge(dias):'')+' </div>'+
          '<div class="list-item-sub">'+subLinea+'</div>'+
        '</div>'+
        '<select class="cambio-estado-select" onclick="event.stopPropagation()" onchange="cambiarEstado(\''+p.id+'\',this.value)">'+opts+'</select>'+
        (p.estado==='transito'?'<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();yaLlego(\''+p.id+'\')" title="Marcar que llego: pide la importacion y lo pasa a Disponible">Ya llego</button>':'')+
        (['disponible','transito','bajopedido'].indexOf(p.estado)!==-1?'<button class="btn btn-gold btn-sm" onclick="event.stopPropagation();abrirVentaModal(\''+p.id+'\')" title="Registrar la venta de este reloj">Vendido</button>':'')+
        '<button class="btn btn-outline btn-sm" onclick="event.stopPropagation();editarProducto(\''+p.id+'\')" title="Editar">&#9998;</button>'+
        '<button class="btn btn-danger" onclick="event.stopPropagation();eliminarProducto(\''+p.id+'\')" title="Eliminar">&#128465;</button>'+
      '</div>';
    }).join('');
  }
}

export { _filtroEstado, _vistaActual, cambiarEstado, clasesABC, diasBadge, eliminarProducto, makeFotoHtml, renderInventario, setFiltroEstado, toggleVista };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { cambiarEstado, eliminarProducto, renderInventario, setFiltroCalidad, setFiltroEstado, toggleVista });
