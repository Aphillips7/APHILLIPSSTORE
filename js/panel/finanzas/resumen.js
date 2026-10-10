// =================== RESUMEN ===================
import { finAllMeses, finMesKey, finMesLabel, finSetEl } from './fechas.js';
import { renderInicio } from '../inicio.js';
import { saveMeta, state } from '../state.js';

var _resMesKey='';
function renderResumen(){
  var allMeses=finAllMeses();
  if(!_resMesKey&&allMeses.length){var hoy=new Date();var mk=hoy.getFullYear()+'-'+String(hoy.getMonth()+1).padStart(2,'0');_resMesKey=allMeses.includes(mk)?mk:allMeses[allMeses.length-1];}
  var btns=document.getElementById('res-meses-btns');
  if(btns){btns.innerHTML='<button class="fin-mes-btn'+(!_resMesKey?' active':'')+'" data-key="">Todo</button>'+allMeses.slice().reverse().map(k=>'<button class="fin-mes-btn'+(k===_resMesKey?' active':'')+'" data-key="'+k+'">'+finMesLabel(k)+'</button>').join('');btns.querySelectorAll('.fin-mes-btn').forEach(b=>b.addEventListener('click',function(){setResMes(this.dataset.key,this);}));}
  var movs=_resMesKey?state.movimientos.filter(m=>finMesKey(m.fecha)===_resMesKey):state.movimientos;
  var ventas=movs.filter(m=>m.tipo==='venta'),gastos=movs.filter(m=>m.tipo==='gasto');
  var totalV=ventas.reduce((a,b)=>a+b.monto,0),totalG=ventas.reduce((a,b)=>a+(b.monto-(b.costo||0)),0);
  var totalGastos=gastos.reduce((a,b)=>a+b.monto,0);
  var ent=movs.filter(m=>m.tipo==='venta'||m.tipo==='compra').reduce((a,b)=>a+b.monto,0);
  var sal=movs.filter(m=>m.tipo==='gasto'||m.tipo==='retiro').reduce((a,b)=>a+b.monto,0);
  var mp=totalV>0?Math.round((totalG/totalV)*100):0;
  finSetEl('res-ventas','$'+totalV.toLocaleString());finSetEl('res-ganancia','$'+totalG.toLocaleString());finSetEl('res-balance','$'+(ent-sal).toLocaleString());
  finSetEl('res-num-ventas',ventas.length+' venta'+(ventas.length!==1?'s':''));finSetEl('res-margen-prom','Margen: '+mp+'%');
  finSetEl('res-reinversion','$'+Math.round(totalG*0.4).toLocaleString());finSetEl('res-personal','$'+Math.round(totalG*0.3).toLocaleString());finSetEl('res-fondo','$'+Math.round(totalG*0.3).toLocaleString());
  var meta=state.meta||0,pct=meta>0?Math.min(Math.round((totalV/meta)*100),100):0;
  finSetEl('gauge-pct',pct+'%');finSetEl('gauge-texto',meta>0?'$'+totalV.toLocaleString()+' de $'+meta.toLocaleString():'Sin meta definida');
  finSetEl('gauge-sub',meta>0?(pct>=100?'Meta alcanzada':'Faltan $'+(meta-totalV).toLocaleString()):'');
  var arc=document.getElementById('gauge-arc');if(arc){var d=Math.round((pct/100)*188);arc.setAttribute('stroke-dasharray',d+' '+(188-d));arc.setAttribute('stroke',pct>=100?'var(--green)':pct>=60?'var(--accent)':'var(--red)');}
  var mi2=document.getElementById('meta-input2');if(mi2&&meta)mi2.value=meta;
  var bc=document.getElementById('fin-bar-403030');
  if(bc)bc.innerHTML=[{label:'Reinversion',val:Math.round(totalG*0.4),color:'var(--blue)',pct:totalG>0?40:0},{label:'Tu dinero',val:Math.round(totalG*0.3),color:'var(--green)',pct:totalG>0?30:0},{label:'Fondo op.',val:Math.round(totalG*0.3),color:'var(--accent)',pct:totalG>0?30:0}].map(b=>'<div class="fin-bar-row"><span class="fin-bar-label">'+b.label+'</span><div class="fin-bar-track"><div class="fin-bar-fill" style="width:'+b.pct+'%;background:'+b.color+';"></div></div><span class="fin-bar-val" style="color:'+b.color+';">$'+b.val.toLocaleString()+'</span></div>').join('');
  var ag=document.getElementById('fin-alerta-gasto');if(ag)ag.style.display=(totalV>0&&totalGastos/totalV>0.2)?'block':'none';
  var canales={};ventas.forEach(v=>{canales[v.canal]=(canales[v.canal]||0)+v.monto;});
  var nombres={facebook:'Facebook',whatsapp:'WhatsApp',instagram:'Instagram',directo:'Directo',otro:'Otro'};
  var rc=document.getElementById('res-canales');
  if(rc){if(!Object.keys(canales).length){rc.innerHTML='<div class="empty"><span></span>Sin datos aun</div>';}else{var maxC=Math.max(...Object.values(canales));rc.innerHTML=Object.entries(canales).sort((a,b)=>b[1]-a[1]).map(([k,v])=>{var p2=Math.round((v/maxC)*100);return'<div class="fin-bar-row"><span class="fin-bar-label">'+(nombres[k]||k)+'</span><div class="fin-bar-track"><div class="fin-bar-fill" style="width:'+p2+'%;background:var(--accent);"></div></div><span class="fin-bar-val money pos">$'+v.toLocaleString()+'</span></div>';}).join('');}}
}
function setResMes(key,btn){_resMesKey=key;document.querySelectorAll('#res-meses-btns .fin-mes-btn').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');renderResumen();}
function guardarMetaResumen(){var val=parseFloat(document.getElementById('meta-input2').value);if(!val||val<=0)return;state.meta=val;saveMeta();renderResumen();renderInicio();}

export { _resMesKey, guardarMetaResumen, renderResumen, setResMes };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { guardarMetaResumen });
