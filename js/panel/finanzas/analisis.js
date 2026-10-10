// =================== ANALISIS ===================
import { finAllMeses, finMesKey, finMesLabel, finSetEl } from './fechas.js';
import { state } from '../state.js';

var _anMesKey='';
function renderAnalisis(){
  var allMeses=finAllMeses();
  var btns=document.getElementById('an-meses-btns');
  if(btns){btns.innerHTML='<button class="fin-mes-btn'+(!_anMesKey?' active':'')+'" data-key="">Todo</button>'+allMeses.slice().reverse().map(k=>'<button class="fin-mes-btn'+(k===_anMesKey?' active':'')+'" data-key="'+k+'">'+finMesLabel(k)+'</button>').join('');btns.querySelectorAll('.fin-mes-btn').forEach(b=>b.addEventListener('click',function(){setAnMes(this.dataset.key,this);}));}
  var chart=document.getElementById('fin-chart-barras');
  if(chart&&allMeses.length){var maxV=0;var md=allMeses.map(k=>{var v=state.movimientos.filter(m=>m.tipo==='venta'&&finMesKey(m.fecha)===k).reduce((a,b)=>a+b.monto,0);if(v>maxV)maxV=v;return{k,v};});chart.innerHTML=md.map(d=>{var h=maxV>0?Math.max(4,Math.round((d.v/maxV)*100)):4;var active=!_anMesKey||d.k===_anMesKey;return'<div class="fin-bar-col" data-key="'+d.k+'" style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:32px;cursor:pointer;"><span style="font-size:10px;color:var(--muted);font-family:DM Mono,monospace;">$'+(d.v>=1000?Math.round(d.v/1000)+'k':d.v)+'</span><div style="width:100%;max-width:36px;height:'+h+'px;background:'+(active?'var(--accent)':'var(--border)')+';border-radius:8px 2px 0 0;transition:all 0.3s;"></div><span style="font-size:9px;color:var(--muted);">'+finMesLabel(d.k).substring(0,3)+'</span></div>';}).join('');chart.querySelectorAll('.fin-bar-col').forEach(b=>b.addEventListener('click',function(){setAnMes(this.dataset.key,this);}));}
  var movs=_anMesKey?state.movimientos.filter(m=>finMesKey(m.fecha)===_anMesKey):state.movimientos;
  var ventas=movs.filter(m=>m.tipo==='venta');
  var sumV=ventas.reduce((a,b)=>a+b.monto,0),sumC=movs.filter(m=>m.tipo==='compra').reduce((a,b)=>a+b.monto,0),sumG=movs.filter(m=>m.tipo==='gasto').reduce((a,b)=>a+b.monto,0),sumR=movs.filter(m=>m.tipo==='retiro').reduce((a,b)=>a+b.monto,0),sumA=movs.filter(m=>m.tipo==='abono').reduce((a,b)=>a+b.monto,0);
  var maxIS=Math.max(sumV,sumC,sumG,sumR,sumA,1);
  var isCont=document.getElementById('fin-ing-sal');
  if(isCont)isCont.innerHTML=[{label:'Ventas',val:sumV,color:'var(--green)'},{label:'Abonos',val:sumA,color:'var(--accent)'},{label:'Compras inv.',val:sumC,color:'var(--blue)'},{label:'Gastos op.',val:sumG,color:'var(--red)'},{label:'Retiros',val:sumR,color:'var(--muted)'}].map(r=>{var p2=Math.round((r.val/maxIS)*100);return'<div class="fin-bar-row"><span class="fin-bar-label">'+r.label+'</span><div class="fin-bar-track"><div class="fin-bar-fill" style="width:'+p2+'%;background:'+r.color+';"></div></div><span class="fin-bar-val" style="color:'+r.color+';">$'+r.val.toLocaleString()+'</span></div>';}).join('');
  var catGastos={};movs.filter(m=>m.tipo==='gasto').forEach(function(m){var c=m.categoria||'Sin categoria';catGastos[c]=(catGastos[c]||0)+m.monto;});
  var catCont=document.getElementById('fin-gastos-categoria');
  if(catCont){
    var entradas=Object.entries(catGastos).sort((a,b)=>b[1]-a[1]);
    if(!entradas.length){catCont.innerHTML='<div class="empty"><span></span>Sin gastos registrados aun</div>';}
    else{var maxCat=Math.max(...entradas.map(e=>e[1]));catCont.innerHTML=entradas.map(([k,v])=>{var p3=Math.round((v/maxCat)*100);return'<div class="fin-bar-row"><span class="fin-bar-label">'+k+'</span><div class="fin-bar-track"><div class="fin-bar-fill" style="width:'+p3+'%;background:var(--red);"></div></div><span class="fin-bar-val" style="color:var(--red);">$'+v.toLocaleString()+'</span></div>';}).join('');}
  }
  var tG=ventas.reduce((a,b)=>a+(b.monto-(b.costo||0)),0);
  finSetEl('an-margen-prom',(sumV>0?Math.round((tG/sumV)*100):0)+'%');
  finSetEl('an-ticket','$'+(ventas.length?Math.round(sumV/ventas.length):0).toLocaleString());
}
function setAnMes(key,btn){_anMesKey=key;document.querySelectorAll('#an-meses-btns .fin-mes-btn').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');renderAnalisis();}

export { _anMesKey, renderAnalisis, setAnMes };
