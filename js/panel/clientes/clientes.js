// =================== CLIENTES ===================
import { verDetalleCliente } from './cliente-detalle.js';
import { cerrarModal } from '../inventario/detalle.js';
import { idAleatorio, idxCliente, save, state } from '../state.js';
import { saldoPendienteReserva } from '../../products.js';

function whatsappLink(tel){
  if(!tel)return'';
  var limpio=tel.replace(/[^0-9]/g,'');
  if(!limpio)return'';
  return'https://wa.me/'+limpio;
}
function registrarCliente(){
  var nombre=document.getElementById('cli-nombre').value.trim();
  if(!nombre){alert('Escribe el nombre del cliente.');return;}
  var tel=document.getElementById('cli-tel').value.trim();
  var editId=document.getElementById('cli-edit-id').value;
  if(editId){
    var i=idxCliente(editId);
    if(i===-1){alert('Este cliente ya no existe (puede que se haya eliminado en otro dispositivo).');cancelarEdicionCliente();return;}
    var c=state.clientes[i];
    c.nombre=nombre;c.tel=tel;c.canal=document.getElementById('cli-canal').value;
    c.producto=document.getElementById('cli-producto').value.trim();
    c.notas=document.getElementById('cli-notas').value.trim();
    save('clientes');
    cancelarEdicionCliente();
    renderClientes();
    return;
  }
  if(tel){
    var dup=state.clientes.find(function(c){return c.tel&&c.tel.replace(/[^0-9]/g,'')===tel.replace(/[^0-9]/g,'')&&tel.replace(/[^0-9]/g,'')!=='';});
    if(dup&&!confirm('Ya existe un cliente con este telefono: "'+dup.nombre+'". ¿Registrar de todos modos?'))return;
  }
  state.clientes.unshift({id:idAleatorio('cli'),_ts:Date.now(),nombre,tel,canal:document.getElementById('cli-canal').value,producto:document.getElementById('cli-producto').value.trim(),notas:document.getElementById('cli-notas').value.trim(),fecha:new Date().toLocaleDateString('es-MX')});
  save('clientes');
  ['cli-nombre','cli-tel','cli-producto','cli-notas'].forEach(id=>document.getElementById(id).value='');
  renderClientes();
}
function editarCliente(id){
  var i=idxCliente(id);
  if(i===-1){alert('Este cliente ya no existe.');renderClientes();return;}
  var c=state.clientes[i];
  document.getElementById('cli-nombre').value=c.nombre||'';
  document.getElementById('cli-tel').value=c.tel||'';
  document.getElementById('cli-canal').value=c.canal||'facebook';
  document.getElementById('cli-producto').value=c.producto||'';
  document.getElementById('cli-notas').value=c.notas||'';
  document.getElementById('cli-edit-id').value=c.id;
  document.getElementById('cli-form-title').textContent='Editar cliente';
  document.getElementById('cli-submit-btn').textContent='Guardar cambios';
  document.getElementById('cli-cancel-btn').style.display='inline-flex';
  cerrarModal();
  window.scrollTo({top:0,behavior:'smooth'});
}
function cancelarEdicionCliente(){
  document.getElementById('cli-edit-id').value='';
  ['cli-nombre','cli-tel','cli-producto','cli-notas'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('cli-canal').value='facebook';
  document.getElementById('cli-form-title').textContent='Registrar cliente';
  document.getElementById('cli-submit-btn').textContent='Guardar cliente';
  document.getElementById('cli-cancel-btn').style.display='none';
}

var _filtroCliente='todos';
function setFiltroCliente(btn,f){_filtroCliente=f;document.querySelectorAll('.filtro-cliente').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');renderClientes();}
function renderClientes(){
  var lista=document.getElementById('cli-lista');
  var nombres={facebook:'Facebook',whatsapp:'WhatsApp',instagram:'Instagram',directo:'Directo'};
  renderStatsClientes();
  if(state.clientes.length===0){lista.innerHTML='<div class="empty"><span></span>Sin clientes aun.</div>';return;}
  var q=(document.getElementById('cli-search')?document.getElementById('cli-search').value.toLowerCase():'');
  var orden=document.getElementById('cli-orden')?document.getElementById('cli-orden').value:'reciente';
  var items=state.clientes.filter(function(c){
    var mQ=!q||(c.nombre||'').toLowerCase().includes(q)||(c.tel||'').toLowerCase().includes(q);
    if(!mQ)return false;
    var saldo=saldoPendienteCliente(c.id);
    var comprado=totalCompradoCliente(c.id);
    if(_filtroCliente==='saldo')return saldo>0;
    if(_filtroCliente==='prospecto')return comprado<=0;
    if(_filtroCliente==='cliente')return comprado>0;
    return true;
  });
  if(orden==='alfabetico')items=items.slice().sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
  else if(orden==='gasto')items=items.slice().sort((a,b)=>totalCompradoCliente(b.id)-totalCompradoCliente(a.id));
  else items=items.slice().sort((a,b)=>(b._ts||0)-(a._ts||0));
  if(items.length===0){lista.innerHTML='<div class="empty"><span></span>Sin resultados para este filtro.</div>';return;}
  lista.innerHTML=items.map((c)=>{
    var saldo=saldoPendienteCliente(c.id);
    var totalComprado=totalCompradoCliente(c.id);
    var subInfo=(c.producto?'Interesado en: '+c.producto:'Sin producto de interes')+' · '+c.fecha+(totalComprado>0?' · Comprado: $'+totalComprado.toLocaleString():'');
    var badgeSaldo=saldo>0?'<span class="badge badge-red" style="margin-right:4px;" title="Saldo pendiente por abono">Debe $'+saldo.toLocaleString()+'</span>':'';
    var badgeTipo=totalComprado>0?'<span class="badge badge-green" style="margin-right:4px;">Cliente</span>':'<span class="badge badge-blue" style="margin-right:4px;">Prospecto</span>';
    var wa=whatsappLink(c.tel);
    var waBtn=wa?'<a href="'+wa+'" target="_blank" rel="noopener" onclick="event.stopPropagation();" class="btn btn-outline btn-sm" title="Escribir por WhatsApp" style="text-decoration:none;">&#128172;</a>':'';
    return '<div class="list-item" style="cursor:pointer;" onclick="verDetalleCliente(\''+c.id+'\')"><div class="list-item-info"><div class="list-item-name">'+c.nombre+(c.tel?' <span style="color:var(--muted);font-size:12px;">· '+c.tel+'</span>':'')+' </div><div class="list-item-sub">'+subInfo+' </div></div>'+badgeTipo+badgeSaldo+'<span class="badge badge-blue">'+(nombres[c.canal]||c.canal)+'</span>'+waBtn+'<button class="btn btn-danger" onclick="event.stopPropagation();eliminarCliente(\''+c.id+'\')">x</button></div>';
  }).join('');
}
function renderStatsClientes(){
  var cont=document.getElementById('cli-stats');
  if(!cont)return;
  if(!state.clientes.length){cont.innerHTML='<div style="font-size:11px;color:var(--muted);">Aun no tienes clientes registrados.</div>';return;}
  var totalClientes=state.clientes.length;
  var conSaldo=state.clientes.filter(c=>saldoPendienteCliente(c.id)>0).length;
  var mejor=state.clientes.map(c=>({c,t:totalCompradoCliente(c.id)})).sort((a,b)=>b.t-a.t)[0];
  function box(label,val,color){return'<div style="flex:1;min-width:100px;background:var(--bg2);border-radius:8px;padding:10px;text-align:center;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.02em;color:var(--muted);margin-bottom:3px;">'+label+'</div><div style="font-family:DM Mono,monospace;font-size:14px;color:'+(color||'var(--black)')+';">'+val+'</div></div>';}
  cont.innerHTML=box('Total clientes',totalClientes)+box('Con saldo pendiente',conSaldo,conSaldo>0?'var(--red)':'var(--black)')+(mejor&&mejor.t>0?box('Mejor cliente',mejor.c.nombre+' ($'+mejor.t.toLocaleString()+')','var(--green)'):box('Mejor cliente','--'));
}
function saldoPendienteCliente(clienteId){
  if(!clienteId)return 0;
  return state.inventario.filter(p=>p.estado==='reservado'&&p.reserva&&p.reserva.clienteId===clienteId).reduce((a,p)=>a+saldoPendienteReserva(p),0);
}
function totalCompradoCliente(clienteId){
  if(!clienteId)return 0;
  return state.movimientos.filter(m=>m.tipo==='venta'&&m.clienteId===clienteId).reduce((a,m)=>a+m.monto,0);
}

function eliminarCliente(id){
  if(!confirm('Eliminar este cliente?'))return;
  var i=idxCliente(id);
  if(i===-1){renderClientes();return;}
  state.clientes.splice(i,1);save('clientes');renderClientes();
}

function poblarSelectClientes(selectId, valorActual) {
  var sel = document.getElementById(selectId);
  if (!sel) return;
  var actual = valorActual !== undefined ? valorActual : sel.value;
  sel.innerHTML = '<option value="">Sin cliente registrado</option>' + state.clientes.map(function(c){
    return '<option value="'+c.id+'">'+c.nombre+'</option>';
  }).join('');
  if (actual) sel.value = actual;
}

export { _filtroCliente, cancelarEdicionCliente, editarCliente, eliminarCliente, poblarSelectClientes, registrarCliente, renderClientes, renderStatsClientes, saldoPendienteCliente, setFiltroCliente, totalCompradoCliente, whatsappLink };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { cancelarEdicionCliente, editarCliente, eliminarCliente, registrarCliente, renderClientes, setFiltroCliente });
