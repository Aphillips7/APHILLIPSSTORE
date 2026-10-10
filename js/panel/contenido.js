// =================== CONTENIDO ===================
import { save, state } from './state.js';

const weekPlan=[
  {day:'LUN',tasks:[{text:'Grabar 2-3 reels en batch',color:'dot-gold'}]},
  {day:'MAR',tasks:[{text:'Editar y programar reels',color:'dot-blue'}]},
  {day:'MIE',tasks:[{text:'Foto de producto + caption',color:'dot-purple'}]},
  {day:'JUE',tasks:[{text:'Stories: inventario y encuesta',color:'dot-green'}]},
  {day:'VIE',tasks:[{text:'Stories: precio y disponibilidad',color:'dot-green'}]},
  {day:'SAB',tasks:[{text:'Reel elaborado o unboxing',color:'dot-gold'}]},
  {day:'DOM',tasks:[{text:'Planear contenido semana siguiente',color:'dot-blue'}]},
];
const ideasBase=[
  {text:'"El reloj mas vendido de mi tienda"',nivel:'Facil',done:false},{text:'"Este reloj por $X — caro o barato?"',nivel:'Facil',done:false},
  {text:'Unboxing express',nivel:'Facil',done:false},{text:'"3 cosas que no sabias del Invicta"',nivel:'Facil',done:false},
  {text:'Reloj en la muneca, outfit del dia',nivel:'Facil',done:false},{text:'"Me llego esto hoy"',nivel:'Facil',done:false},
  {text:'Comparativa: 2 modelos cual te llevas?',nivel:'Facil',done:false},{text:'"El Invicta que parece de $500"',nivel:'Medio',done:false},
  {text:'"Vale la pena comprar Invicta?"',nivel:'Medio',done:false},{text:'Antes y despues — limpieza de reloj',nivel:'Medio',done:false},
  {text:'"El reloj ideal segun tu presupuesto"',nivel:'Medio',done:false},{text:'POV: eligiendo tu primer Invicta',nivel:'Medio',done:false},
  {text:'Top 3 Invicta para regalo',nivel:'Medio',done:false},{text:'"Lo que nadie te dice del Invicta"',nivel:'Medio',done:false},
  {text:'Mini historia: como empece la tienda',nivel:'Elaborado',done:false},{text:'"Un dia en mi tienda"',nivel:'Elaborado',done:false},
  {text:'Testimonio de cliente feliz',nivel:'Elaborado',done:false},{text:'Reel cinematografico sin hablar',nivel:'Elaborado',done:false},
  {text:'"Arme mi coleccion con $X"',nivel:'Elaborado',done:false},{text:'Respondo las preguntas mas frecuentes',nivel:'Elaborado',done:false},
];
function getWeekKey(d){
  d = d || new Date();
  var date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  var weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
  return date.getUTCFullYear() + '-W' + String(weekNo).padStart(2,'0');
}
function renderContenido(){
  var weekKey = getWeekKey();
  var diasCodigo = ['DOM','LUN','MAR','MIE','JUE','VIE','SAB'];
  var hoyCodigo = diasCodigo[new Date().getDay()];
  const cal=document.getElementById('week-calendar');
  var totalTareas = 0, hechasTareas = 0;
  cal.innerHTML = weekPlan.map(function(d){
    var esHoy = d.day === hoyCodigo;
    var tareasHtml = d.tasks.map(function(t){
      var key = 'week-' + weekKey + '-' + d.day + '-' + t.text;
      var done = !!state.weekTasks[key];
      totalTareas++; if (done) hechasTareas++;
      return '<div class="day-task '+(done?'done':'')+'" onclick="toggleWeekTask(\''+key+'\', this)"><div class="task-dot '+t.color+'"></div>'+t.text+'</div>';
    }).join('');
    var storiesKey = 'stories-' + weekKey + '-' + d.day;
    var storiesDone = !!state.weekTasks[storiesKey];
    totalTareas++; if (storiesDone) hechasTareas++;
    var storiesHtml = '<div class="day-task '+(storiesDone?'done':'')+'" style="font-size:10px;" onclick="toggleWeekTask(\''+storiesKey+'\', this)"><div class="task-dot dot-green"></div>Stories diarias</div>';
    return '<div class="day-col'+(esHoy?' today':'')+'"><div class="day-header">'+d.day+(esHoy?' · Hoy':'')+'</div>'+tareasHtml+storiesHtml+'</div>';
  }).join('');

  var pct = totalTareas > 0 ? Math.round((hechasTareas/totalTareas)*100) : 0;
  var progLabel = document.getElementById('week-progress-label');
  var progFill = document.getElementById('week-progress-fill');
  if (progLabel) progLabel.textContent = hechasTareas + '/' + totalTareas;
  if (progFill) progFill.style.width = pct + '%';

  if (state.ideas.length === 0) { state.ideas.push(...ideasBase); save('ideas'); }
  renderIdeas();
}
function toggleWeekTask(key, el) {
  state.weekTasks[key] = !state.weekTasks[key];
  localStorage.setItem('weekTasks', JSON.stringify(state.weekTasks));
  renderContenido();
}
var _filtroNivelIdea = '';
function nivelBadgeClass(nivel) {
  if (nivel === 'Facil') return 'badge-green';
  if (nivel === 'Medio') return 'badge-gold';
  if (nivel === 'Elaborado') return 'badge-blue';
  return '';
}
function ideaRowHtml(idea, i) {
  var badge = idea.nivel ? '<span class="badge '+nivelBadgeClass(idea.nivel)+'" style="margin-right:8px;flex-shrink:0;">'+idea.nivel+'</span>' : '';
  return '<div class="check-item '+(idea.done?'done':'')+'"><input type="checkbox" '+(idea.done?'checked':'')+' onchange="toggleIdea('+i+')" />'+badge+'<label onclick="toggleIdea('+i+')" style="flex:1;">'+idea.text+'</label><button class="btn btn-danger" onclick="removeIdea('+i+')">x</button></div>';
}
function renderIdeas(){
  const lista=document.getElementById('ideas-lista');
  var todas = state.ideas.map(function(idea,i){ return {idea:idea, i:i}; });
  var filtradas = _filtroNivelIdea ? todas.filter(function(x){ return x.idea.nivel === _filtroNivelIdea; }) : todas;
  var pendientes = filtradas.filter(function(x){ return !x.idea.done; });
  var hechas = filtradas.filter(function(x){ return x.idea.done; });

  var htmlPend = pendientes.length ? pendientes.map(function(x){ return ideaRowHtml(x.idea, x.i); }).join('') :
    '<div class="empty" style="padding:14px 0;"><span></span>Sin ideas pendientes'+(_filtroNivelIdea?' de nivel '+_filtroNivelIdea:'')+'.</div>';
  var htmlHechas = hechas.length ?
    '<div class="sep" style="margin:16px 0 10px;"></div><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);margin-bottom:6px;">Ya grabadas ('+hechas.length+')</div>' +
    hechas.map(function(x){ return ideaRowHtml(x.idea, x.i); }).join('') : '';

  lista.innerHTML = htmlPend + htmlHechas;
  renderIdeaFiltros();
}
function renderIdeaFiltros(){
  var cont = document.getElementById('idea-filtros');
  if (!cont) return;
  var niveles = ['', 'Facil', 'Medio', 'Elaborado'];
  cont.innerHTML = niveles.map(function(n){
    var count = n ? state.ideas.filter(function(x){ return x.nivel === n && !x.done; }).length : state.ideas.filter(function(x){ return !x.done; }).length;
    return '<button class="fin-mes-btn'+(n===_filtroNivelIdea?' active':'')+'" data-nivel="'+n+'">'+(n||'Todas')+' ('+count+')</button>';
  }).join('');
  cont.querySelectorAll('.fin-mes-btn').forEach(function(b){
    b.addEventListener('click', function(){ setFiltroNivelIdea(this.dataset.nivel); });
  });
}
function setFiltroNivelIdea(nivel){ _filtroNivelIdea = nivel; renderIdeas(); }
function toggleIdea(i){state.ideas[i].done=!state.ideas[i].done;save('ideas');renderIdeas();}
function removeIdea(i){state.ideas.splice(i,1);save('ideas');renderIdeas();}
function addIdea(){
  var input=document.getElementById('new-idea');
  if(!input.value.trim())return;
  var nivelSel = document.getElementById('new-idea-nivel');
  state.ideas.push({text:input.value.trim(), nivel: nivelSel?nivelSel.value:'', done:false});
  input.value='';
  save('ideas');
  renderIdeas();
}
function reponerIdeas(){
  var textosExistentes = state.ideas.map(function(x){ return x.text; });
  var faltantes = ideasBase.filter(function(b){ return textosExistentes.indexOf(b.text) === -1; });
  if (!faltantes.length) { alert('Ya tienes todas las ideas base en tu banco.'); return; }
  faltantes.forEach(function(f){ state.ideas.push({text:f.text, nivel:f.nivel, done:false}); });
  save('ideas');
  renderIdeas();
}

export { _filtroNivelIdea, addIdea, getWeekKey, ideaRowHtml, ideasBase, nivelBadgeClass, removeIdea, renderContenido, renderIdeaFiltros, renderIdeas, reponerIdeas, setFiltroNivelIdea, toggleIdea, toggleWeekTask, weekPlan };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { addIdea, removeIdea, reponerIdeas, toggleIdea, toggleWeekTask });
