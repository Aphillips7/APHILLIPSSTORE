import { makeFotoHtml, renderInventario } from './inventario/lista.js';
import { idxInv, invNoExiste, save, state } from './state.js';
import { esPublicable } from '../products.js';

function renderCatalogoAdmin(){
  var items = state.inventario.filter(function(p){ return p.estado!=='vendido' || esPublicable(p); });
  var visibles = items.filter(function(p){ return esPublicable(p); });
  var ocultos = state.inventario.filter(function(p){ return !esPublicable(p) && !p.ocultoCatalogo && (p.estado==='disponible'||p.estado==='transito'||p.estado==='bajopedido'); });
  var ocultosManual = state.inventario.filter(function(p){ return p.ocultoCatalogo; });
  var elVis=document.getElementById('cat-stat-visibles'); if(elVis) elVis.textContent = visibles.length;
  var elOc=document.getElementById('cat-stat-ocultos'); if(elOc) elOc.textContent = ocultosManual.length;
  var totalClics = 0;
  Object.keys(state.metricas).forEach(function(id){ totalClics += (state.metricas[id].clics||0); });
  var elCl=document.getElementById('cat-stat-clics'); if(elCl) elCl.textContent = totalClics;

  renderMetricasCatalogo();

  var lista = document.getElementById('catalogo-lista');
  if(!lista) return;
  var elegibles = state.inventario.filter(function(p){ return p.estado==='disponible'||p.estado==='transito'||p.estado==='bajopedido'||p.estado==='vendido'; });
  if(!elegibles.length){
    lista.innerHTML = '<div class="empty" style="padding:20px 0;"><span></span>Aun no tienes relojes para mostrar en el catalogo.</div>';
    return;
  }
  var estadosBadge={disponible:'badge-green',transito:'badge-blue',bajopedido:'badge-slate',vendido:'badge-red'};
  var etiquetas={disponible:'Disponible',transito:'En transito',bajopedido:'Bajo pedido',vendido:'Vendido'};
  elegibles.sort(function(a,b){
    var ma=state.metricas[a.id]||{}, mb=state.metricas[b.id]||{};
    return (mb.clics||0)-(ma.clics||0);
  });
  lista.innerHTML = elegibles.map(function(p){
    var m = state.metricas[p.id] || {};
    var vis = p.ocultoCatalogo;
    var pub = esPublicable(p);
    var visBtn='<button class="btn btn-outline btn-sm" onclick="toggleOcultoCatalogo(\''+p.id+'\')" title="'+(vis?'Oculto del catalogo publico — clic para mostrar':'Visible en el catalogo publico — clic para ocultar')+'" style="'+(vis?'color:var(--muted);':'color:var(--green);')+'">'+(vis?'&#128683; Oculto':'&#128065; Visible')+'</button>';
    var linkBtn=pub?'<button class="btn btn-outline btn-sm" onclick="copiarLinkReloj(\''+p.id+'\')" title="Copiar link directo de este reloj">&#128279; Link</button>':'';
    return '<div class="list-item" style="gap:12px;">'+
      makeFotoHtml(p.foto,48)+
      '<div class="list-item-info">'+
        '<div class="list-item-name" style="display:flex;align-items:center;gap:8px;">'+p.nombre+(p.sku?' <span style="color:var(--muted);font-size:12px;">· '+p.sku+'</span>':'')+' <span class="badge '+(estadosBadge[p.estado]||'')+'">'+(etiquetas[p.estado]||p.estado)+'</span></div>'+
        '<div class="list-item-sub">'+(m.vistas||0)+' vistas · '+(m.aperturas||0)+' aperturas · '+(m.clics||0)+' clics'+(pub?'':' · no publicado en este momento')+'</div>'+
      '</div>'+
      visBtn+linkBtn+
    '</div>';
  }).join('');
}
function renderMetricasCatalogo(){
  var cont = document.getElementById('metricas-catalogo-container');
  if(!cont) return;
  var filas = state.inventario
    .filter(function(p){ return esPublicable(p); })
    .map(function(p){
      var m = state.metricas[p.id] || {};
      return { p:p, vistas:m.vistas||0, aperturas:m.aperturas||0, clics:m.clics||0 };
    })
    .filter(function(x){ return x.vistas>0 || x.aperturas>0 || x.clics>0; });
  if(!filas.length){
    cont.innerHTML = '<div class="empty" style="padding:16px 0;"><span></span>Aun no hay datos de vistas o clics.</div>';
    return;
  }
  var topInteres = filas.slice().sort(function(a,b){ return b.clics-a.clics; }).filter(function(x){ return x.clics>0; }).slice(0,3);
  var friccion = filas.filter(function(x){ return x.clics===0 && (x.aperturas>=5 || x.vistas>=15); })
    .sort(function(a,b){ return (b.vistas+b.aperturas*2)-(a.vistas+a.aperturas*2); }).slice(0,3);
  var html = '';
  if(topInteres.length){
    html += '<div style="font-size:11px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:var(--muted);margin-bottom:6px;">Top interes — mas clics a WhatsApp</div>';
    html += topInteres.map(function(x){
      return '<div class="list-item" style="padding:8px 0;">'+
        '<div class="list-item-info"><div class="list-item-name">'+x.p.nombre+'</div>'+
        '<div class="list-item-sub">'+x.vistas+' vistas · '+x.aperturas+' aperturas</div></div>'+
        '<span class="badge badge-green">'+x.clics+' clic'+(x.clics!==1?'s':'')+'</span></div>';
    }).join('');
  }
  if(friccion.length){
    html += '<div style="font-size:11px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:var(--muted);margin:'+(topInteres.length?'16px':'0')+' 0 6px;">Alerta de friccion — mucho interes, cero clics</div>';
    html += friccion.map(function(x){
      return '<div class="list-item" style="padding:8px 0;">'+
        '<div class="list-item-info"><div class="list-item-name">'+x.p.nombre+'</div>'+
        '<div class="list-item-sub">'+x.vistas+' vistas · '+x.aperturas+' aperturas · 0 clics</div></div>'+
        '<span class="badge badge-red">Revisar precio/foto</span></div>';
    }).join('');
  }
  cont.innerHTML = html || '<div class="empty" style="padding:16px 0;"><span></span>Aun no hay suficientes datos para mostrar tendencias.</div>';
}

function copiarLinkCatalogo(){
  var url = new URL('catalogo.html', window.location.href).href;
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(function(){ alert('Link copiado:\n'+url); }).catch(function(){ prompt('Copia este link:', url); });
  } else {
    prompt('Copia este link:', url);
  }
}
function copiarLinkReloj(id){
  var url = new URL('catalogo.html?id='+encodeURIComponent(id), window.location.href).href;
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(function(){ alert('Link copiado:\n'+url); }).catch(function(){ prompt('Copia este link:', url); });
  } else {
    prompt('Copia este link:', url);
  }
}
function toggleOcultoCatalogo(id){
  var i=idxInv(id);
  if(i===-1){ invNoExiste(); return; }
  state.inventario[i].ocultoCatalogo = !state.inventario[i].ocultoCatalogo;
  save('inventario');
  renderInventario();
}

export { copiarLinkCatalogo, copiarLinkReloj, renderCatalogoAdmin, renderMetricasCatalogo, toggleOcultoCatalogo };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { copiarLinkCatalogo, copiarLinkReloj, toggleOcultoCatalogo });
