// =================== COPIA DE LOS DATOS EN CLOUDFLARE (etapa 3a) ===================
// Firebase sigue siendo la fuente principal. Cada vez que el panel recibe datos confirmados por
// el servidor de Firestore, este modulo deja una copia identica en Cloudflare (D1), enviando solo
// lo que cambio (compara huellas SHA-256 con las que ya tiene Cloudflare). La primera vez que se
// abre el panel se copia todo; despues, solo las diferencias. No gasta lecturas extra de Firebase.
import { db, firebase } from '../../firebase.js';

const API_DATOS = 'https://api.aphillipsstore.com/datos';
const LOTE = 150;
// colecciones que el panel recibe completas: lo que no venga en la foto de Firestore se borra
const COMPLETAS = ['inventario', 'movimientos', 'clientes'];

var _hashesCF = null;          // { col: { id: hash } } que tiene Cloudflare
var _cargandoHashes = null;
var _pendiente = {};           // col -> { docs: {id: datos}, completa: bool }
var _timer = null, _enviando = false;
var _estado = { ok: null, docs: 0, ultimo: null, error: '' };

// JSON con las claves ordenadas: el mismo documento siempre da el mismo texto (y la misma huella)
function canonico(v){
  if(Array.isArray(v)) return '['+v.map(canonico).join(',')+']';
  if(v && typeof v==='object'){
    return '{'+Object.keys(v).sort().filter(function(k){ return v[k]!==undefined; })
      .map(function(k){ return JSON.stringify(k)+':'+canonico(v[k]); }).join(',')+'}';
  }
  return JSON.stringify(v===undefined?null:v);
}
async function sha256(texto){
  var buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.prototype.map.call(new Uint8Array(buf), function(b){ return b.toString(16).padStart(2,'0'); }).join('');
}
async function pedir(ruta, opciones){
  var usuario=firebase.auth().currentUser;
  if(!usuario) throw new Error('sin sesion');
  var token=await usuario.getIdToken();
  opciones=opciones||{};
  opciones.headers=Object.assign({ 'Authorization':'Bearer '+token }, opciones.headers||{});
  var r=await fetch(API_DATOS+ruta, opciones);
  var d={}; try{ d=await r.json(); }catch(e){}
  if(!r.ok) throw new Error(d.error||('Error '+r.status));
  return d;
}
function cargarHashes(){
  if(_hashesCF) return Promise.resolve(_hashesCF);
  if(!_cargandoHashes){
    _cargandoHashes=pedir('/resumen').then(function(d){ _hashesCF=d.hashes||{}; return _hashesCF; })
      .finally(function(){ _cargandoHashes=null; });
  }
  return _cargandoHashes;
}

// docs: { id: datos }. completa = la lista trae TODOS los documentos de la coleccion.
function espejar(col, docs, completa){
  _pendiente[col]={ docs: docs, completa: !!completa };
  clearTimeout(_timer);
  _timer=setTimeout(enviar, 2500);
}
function espejarColeccionSnap(col, snap){
  if(snap.metadata && snap.metadata.fromCache) return;   // solo datos confirmados por el servidor
  var docs={};
  snap.forEach(function(doc){ docs[doc.id]=doc.data(); });
  espejar(col, docs, COMPLETAS.indexOf(col)!==-1);
}
function espejarDoc(col, id, datos){
  var p=_pendiente[col]||(_pendiente[col]={ docs:{}, completa:false });
  p.docs[id]=datos;
  clearTimeout(_timer);
  _timer=setTimeout(enviar, 2500);
}

async function enviar(){
  if(_enviando){ clearTimeout(_timer); _timer=setTimeout(enviar, 2500); return; }
  if(!navigator.onLine || !firebase.auth().currentUser) return;
  var tareas=_pendiente; _pendiente={};
  if(!Object.keys(tareas).length) return;
  _enviando=true;
  try{
    var hashes=await cargarHashes();
    var ops=[];
    for(var col in tareas){
      var t=tareas[col], remotos=hashes[col]||(hashes[col]={});
      for(var id in t.docs){
        var texto=canonico(t.docs[id]);
        if(remotos[id]!==await sha256(texto)) ops.push({ col: col, id: id, json: texto });
      }
      if(t.completa){
        Object.keys(remotos).forEach(function(id){ if(!(id in t.docs)) ops.push({ col: col, id: id, borrar: true }); });
      }
    }
    for(var i=0;i<ops.length;i+=LOTE){
      var parte=ops.slice(i,i+LOTE);
      var r=await pedir('/lote', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ ops: parte }) });
      parte.forEach(function(op){
        var m=hashes[op.col]||(hashes[op.col]={});
        if(op.borrar) delete m[op.id];
        else m[op.id]=(r.hashes&&r.hashes[op.col]&&r.hashes[op.col][op.id])||'';
      });
    }
    _estado={ ok:true, docs: contarDocs(hashes), ultimo: new Date(), error:'' };
  }catch(e){
    // se reintenta con la proxima actualizacion; lo que no se envio vuelve a la cola
    Object.keys(tareas).forEach(function(col){ if(!_pendiente[col]) _pendiente[col]=tareas[col]; });
    _hashesCF=null;
    _estado.ok=false; _estado.error=e.message||String(e);
    clearTimeout(_timer); _timer=setTimeout(enviar, 60000);
  }
  _enviando=false;
  renderEspejo();
}
function contarDocs(h){
  var n=0; Object.keys(h).forEach(function(c){ n+=Object.keys(h[c]).length; }); return n;
}

function renderEspejo(){
  var el=document.getElementById('espejo-cf-texto');
  if(!el) return;
  if(_estado.ok===null){ el.style.color='var(--muted)'; el.textContent='Preparando la copia...'; return; }
  if(_estado.ok){
    el.style.color='var(--green)';
    el.textContent='Al dia · '+_estado.docs+' documentos · '+_estado.ultimo.toLocaleTimeString('es-MX');
  }else{
    el.style.color='var(--red)';
    el.textContent='No se pudo copiar ('+_estado.error+'). Se reintenta solo.';
  }
}

// Escuchas propias con includeMetadataChanges: con la persistencia offline, si lo guardado en el
// dispositivo ya es igual a la nube, Firestore no vuelve a avisar a las escuchas normales cuando
// el servidor lo confirma (solo cambia metadata.fromCache). Estas si reciben ese aviso. Firestore
// comparte la misma conexion con las escuchas del panel, asi que no cuesta lecturas extra.
var _iniciado=false;
function iniciarEspejo(){
  if(_iniciado) return;
  _iniciado=true;
  COMPLETAS.forEach(function(col){
    db.collection(col).onSnapshot({ includeMetadataChanges: true }, function(snap){ espejarColeccionSnap(col, snap); }, function(){ _iniciado=false; });
  });
  db.collection('config').doc('main').onSnapshot({ includeMetadataChanges: true }, function(doc){
    if(doc.exists && !(doc.metadata && doc.metadata.fromCache)) espejarDoc('config', 'main', doc.data());
  }, function(){ _iniciado=false; });
  renderEspejo();
}

export { espejarColeccionSnap, espejarDoc, iniciarEspejo, renderEspejo };
