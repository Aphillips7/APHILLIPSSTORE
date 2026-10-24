/* ============================================================
   FOTOS DEL RELOJ (varias por unidad) — Cloudflare R2
   ============================================================
   - Se eligen una o varias fotos (camara o galeria). Cada una se
     reduce a 1600 px y se convierte a WebP (o JPEG si el navegador
     no puede) antes de subirla, para que pese poco.
   - Se suben al Worker https://api.aphillipsstore.com con la sesion
     de Firebase del admin; quedan en https://fotos.aphillipsstore.com.
   - La 1.a foto de la lista es la principal (la que se ve en el
     listado y en el catalogo). Se puede cambiar el orden y quitar.
   - Fotos antiguas guardadas como texto (base64) se siguen viendo
     hasta que se reemplacen.
   - Subir fotos requiere internet.
   - Con "Quitar fondo y centrar" (marcado por defecto) se borra el
     fondo liso y el reloj queda centrado y del mismo tamano en todas
     (ver fondo.js). "Arreglar fotos" hace lo mismo con las ya subidas.
   - De cada foto se sube tambien una copia JPEG (1200 px) para la
     vista previa al compartir el link por WhatsApp (WhatsApp no
     garantiza WebP). La de la foto principal queda en fotoCompartir.
   ============================================================ */
import { firebase } from '../../firebase.js';
import { save, state } from '../state.js';
import { prepararFoto } from './fondo.js';

const API_FOTOS = 'https://api.aphillipsstore.com/fotos';
const MAX_DIM = 1600;
let _fotos = [];          // lista de fotos del formulario (URLs https o una data: antigua)
let _jpg = {};            // URL de la foto -> URL de su copia JPEG para compartir
let _subiendo = 0;

function _esc(t){ return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function _estado(txt, color){
  var s=document.getElementById('inv-foto-status');
  if(s){ s.style.color=color||'var(--muted)'; s.textContent=txt; }
}

// ---------- lista del formulario ----------
function fotosFormulario(){ return _fotos.slice(); }
function setFotosFormulario(lista, mapaJpg){
  _fotos = (lista||[]).filter(Boolean);
  _jpg = Object.assign({}, mapaJpg||{});
  renderFotos();
}
// copias JPEG de las fotos que siguen en el formulario
function jpgsFormulario(){
  var m = {};
  _fotos.forEach(function(u){ if(_jpg[u]) m[u] = _jpg[u]; });
  return m;
}
// imagen para la vista previa del link: la copia JPEG de la principal, o la principal si ya es JPEG/PNG
function fotoCompartirFormulario(){
  var p = _fotos[0] || '';
  if(_jpg[p]) return _jpg[p];
  return /^https:\/\/.+\.(jpe?g|png)$/i.test(p) ? p : '';
}
function renderFotos(){
  var cont=document.getElementById('inv-fotos-lista');
  var hidden=document.getElementById('inv-foto');
  if(hidden) hidden.value=_fotos[0]||'';
  if(!cont) return;
  if(!_fotos.length){
    cont.innerHTML='<div class="inv-foto-vacia">Sin fotos</div>';
    return;
  }
  cont.innerHTML=_fotos.map(function(src,i){
    var antigua=src.indexOf('data:')===0;
    return '<div class="inv-foto-item'+(i===0?' principal':'')+'">'+
      '<img src="'+_esc(src)+'" alt="" onerror="this.style.opacity=.2" />'+
      (i===0?'<span class="inv-foto-tag">Principal</span>':'')+
      (antigua?'<span class="inv-foto-tag antigua">Antigua</span>':'')+
      '<div class="inv-foto-acciones">'+
        (i>0?'<button type="button" title="Mover a la izquierda" onclick="moverFoto('+i+',-1)">&#8592;</button>':'')+
        (i<_fotos.length-1?'<button type="button" title="Mover a la derecha" onclick="moverFoto('+i+',1)">&#8594;</button>':'')+
        '<button type="button" title="Quitar" onclick="quitarFoto('+i+')">&#10005;</button>'+
      '</div>'+
    '</div>';
  }).join('');
}
function moverFoto(i, dir){
  var j=i+dir; if(j<0||j>=_fotos.length) return;
  var t=_fotos[i]; _fotos[i]=_fotos[j]; _fotos[j]=t;
  renderFotos();
}
function quitarFoto(i){
  _fotos.splice(i,1);
  renderFotos();
}
// compatibilidad: algunas pantallas llaman previewFoto() despues de poner #inv-foto
function previewFoto(){
  var hidden=document.getElementById('inv-foto');
  var v=hidden?hidden.value.trim():'';
  if(v && _fotos.indexOf(v)===-1) _fotos.unshift(v);
  renderFotos();
}

// ---------- comprimir y subir ----------
// Se lee con createImageBitmap (no necesita URL blob:, que la CSP del panel no permitia); si el
// navegador no puede, se intenta con <img> y una URL blob: (permitida en img-src desde v53).
async function _leerImagen(file){
  if(window.createImageBitmap){
    try{ return await createImageBitmap(file); }catch(e){ console.warn('createImageBitmap fallo, se intenta con <img>:', e); }
  }
  return _leerImagenBlob(file);
}
function _leerImagenBlob(file){
  return new Promise(function(resolve, reject){
    var url=URL.createObjectURL(file);
    var img=new Image();
    img.onload=function(){ URL.revokeObjectURL(url); resolve(img); };
    img.onerror=function(){ URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src=url;
  });
}
function _aBlob(canvas, tipo, calidad){
  return new Promise(function(resolve){ canvas.toBlob(resolve, tipo, calidad); });
}
async function _comprimir(file){
  var img=await _leerImagen(file);
  return _comprimirImg(img);
}
async function _comprimirImg(img, transparente){
  var w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
  if(w>MAX_DIM||h>MAX_DIM){ if(w>h){ h=Math.round(h*MAX_DIM/w); w=MAX_DIM; } else { w=Math.round(w*MAX_DIM/h); h=MAX_DIM; } }
  var c=document.createElement('canvas'); c.width=w; c.height=h;
  var ctx=c.getContext('2d'); ctx.imageSmoothingQuality='high'; ctx.drawImage(img,0,0,w,h);
  var blob=await _aBlob(c,'image/webp',0.86);
  if(!blob || blob.type!=='image/webp') blob=await _aBlob(c, transparente?'image/png':'image/jpeg', 0.86);   // Safari antiguo (PNG si lleva transparencia)
  if(!blob) throw new Error('No se pudo convertir la imagen');
  return blob;
}
// copia JPEG chica (max 1200 px, fondo blanco por si la foto es PNG con transparencia)
async function _jpegCompartir(img){
  var lado=1200, w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
  if(w>lado||h>lado){ if(w>h){ h=Math.round(h*lado/w); w=lado; } else { w=Math.round(w*lado/h); h=lado; } }
  var c=document.createElement('canvas'); c.width=w; c.height=h;
  var ctx=c.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h);
  ctx.imageSmoothingQuality='high'; ctx.drawImage(img,0,0,w,h);
  var blob=await _aBlob(c,'image/jpeg',0.82);
  if(blob && blob.size>580*1024) blob=await _aBlob(c,'image/jpeg',0.68);   // WhatsApp pide menos de 600 KB
  return blob;
}
// Miniatura (480 px) para las tarjetas del catalogo: se guarda en miniaturas/<clave de la foto> y el
// catalogo la busca ahi (si no existe, usa la foto completa). Es un extra: si falla, la foto queda igual.
var FOTOS_BASE='https://fotos.aphillipsstore.com/';
async function _subirMiniatura(img, url){
  if(typeof url!=='string' || url.indexOf(FOTOS_BASE+'relojes/')!==0) return;
  var clave=url.slice(FOTOS_BASE.length), carpeta=clave.split('/')[1];
  var lado=480, w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
  if(w>lado||h>lado){ if(w>h){ h=Math.round(h*lado/w); w=lado; } else { w=Math.round(w*lado/h); h=lado; } }
  var c=document.createElement('canvas'); c.width=w; c.height=h;
  var ctx=c.getContext('2d'); ctx.imageSmoothingQuality='high'; ctx.drawImage(img,0,0,w,h);
  var blob=await _aBlob(c,'image/webp',0.8);
  if(!blob || blob.type!=='image/webp'){ ctx.globalCompositeOperation='destination-over'; ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h); blob=await _aBlob(c,'image/jpeg',0.82); }
  if(!blob) return;
  var usuario=firebase.auth().currentUser; if(!usuario) return;
  await fetch(API_FOTOS+'?reloj='+encodeURIComponent(carpeta)+'&mini='+encodeURIComponent(clave), {
    method:'POST', headers:{ 'Authorization':'Bearer '+await usuario.getIdToken(), 'Content-Type':blob.type }, body:blob
  });
}
function _carpeta(){
  // carpeta en R2: el id del reloj si se esta editando; si es nuevo, una carpeta temporal del formulario
  var edit=document.getElementById('inv-edit-index');
  if(edit && edit.value) return edit.value;
  var h=document.getElementById('inv-foto-carpeta');
  if(h && !h.value) h.value='nuevo-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  return h ? h.value : 'sin-id';
}
async function _subir(blob, carpeta){
  var usuario=firebase.auth().currentUser;
  if(!usuario) throw new Error('Inicia sesion de nuevo para subir fotos');
  var token=await usuario.getIdToken();
  var r=await fetch(API_FOTOS+'?reloj='+encodeURIComponent(carpeta||_carpeta()), {
    method:'POST', headers:{ 'Authorization':'Bearer '+token, 'Content-Type':blob.type }, body:blob
  });
  var data={}; try{ data=await r.json(); }catch(e){}
  if(!r.ok) throw new Error(data.error||('Error '+r.status));
  return data.url;
}

async function subirFotos(input){
  var archivos=Array.prototype.slice.call(input.files||[]);
  input.value='';
  if(!archivos.length) return;
  if(!navigator.onLine){ _estado('Necesitas internet para subir fotos.','var(--red)'); return; }
  var ok=0, fallos=0;
  _subiendo+=archivos.length;
  _bloquearGuardar(true);
  for(var k=0;k<archivos.length;k++){
    _estado('Subiendo foto '+(k+1)+' de '+archivos.length+'...');
    try{
      var img=await _leerImagen(archivos[k]);
      var prep=_quitarFondo()?prepararFoto(img):null;
      if(prep) img=prep.canvas;
      var blob=await _comprimirImg(img, prep&&prep.sinFondo);
      var url=await _subir(blob);
      _fotos.push(url); ok++;
      renderFotos();
      // la copia para compartir es un extra: si falla, la foto queda igual
      try{ var jpg=await _jpegCompartir(img); if(jpg) _jpg[url]=await _subir(jpg); }catch(e){ console.warn('Copia JPEG no subida:', e); }
      try{ await _subirMiniatura(img, url); }catch(e){ console.warn('Miniatura no subida:', e); }
    }catch(err){ fallos++; console.warn('Foto no subida:', err); _estado('No se pudo subir una foto: '+err.message,'var(--red)'); }
    _subiendo--;
  }
  _bloquearGuardar(false);
  if(!fallos) _estado(ok===1?'Foto subida.':ok+' fotos subidas.','var(--green)');
  else if(ok) _estado(ok+' subidas, '+fallos+' con error. Intenta de nuevo con las que faltan.','var(--amber)');
}
function _quitarFondo(){ var c=document.getElementById('inv-quitar-fondo'); return !c || c.checked; }

// "Arreglar fotos": quita el fondo y centra las fotos que ya estaban subidas (se suben como fotos nuevas
// y reemplazan a las anteriores en la lista; hay que tocar "Guardar cambios" para que quede)
function _leerUrl(url){
  return new Promise(function(resolve, reject){
    var img=new Image(); img.crossOrigin='anonymous';
    img.onload=function(){ resolve(img); };
    img.onerror=function(){ reject(new Error('No se pudo leer la foto')); };
    img.src=url+(url.indexOf('?')<0?'?':'&')+'cors=1';
  });
}
async function arreglarFotos(){
  var lista=_fotos.filter(function(u){ return /^https:\/\//.test(u); });
  if(!lista.length){ _estado('No hay fotos subidas para arreglar.','var(--muted)'); return; }
  if(!navigator.onLine){ _estado('Necesitas internet para arreglar las fotos.','var(--red)'); return; }
  var ok=0, sinCambio=0, fallos=0;
  _subiendo++; _bloquearGuardar(true);
  for(var k=0;k<lista.length;k++){
    var vieja=lista[k];
    _estado('Arreglando foto '+(k+1)+' de '+lista.length+'...');
    try{
      var prep=prepararFoto(await _leerUrl(vieja));
      if(!prep.sinFondo){ sinCambio++; continue; }        // fondo no liso: se deja como estaba
      var url=await _subir(await _comprimirImg(prep.canvas, true));
      var i=_fotos.indexOf(vieja); if(i>=0) _fotos[i]=url;
      delete _jpg[vieja];
      try{ var jpg=await _jpegCompartir(prep.canvas); if(jpg) _jpg[url]=await _subir(jpg); }catch(e){ console.warn('Copia JPEG no subida:', e); }
      try{ await _subirMiniatura(prep.canvas, url); }catch(e){ console.warn('Miniatura no subida:', e); }
      ok++; renderFotos();
    }catch(err){ fallos++; console.warn('Foto no arreglada:', err); }
  }
  _subiendo--; _bloquearGuardar(false);
  var msg=(ok?ok+(ok===1?' foto arreglada':' fotos arregladas'):'Ninguna foto cambio')+(sinCambio?', '+sinCambio+' sin fondo liso (se dejaron igual)':'')+(fallos?', '+fallos+' con error':'')+'.';
  _estado(msg+(ok?' Toca "Guardar cambios" para que quede.':''), fallos?'var(--amber)':ok?'var(--green)':'var(--muted)');
}
function _bloquearGuardar(si){
  var b=document.getElementById('inv-submit-btn');
  if(b){ b.disabled=si; b.style.opacity=si?.5:''; }
}
function fotosSubiendo(){ return _subiendo>0; }

// ---------- pasar fotos antiguas (base64) a la nube ----------
// Las fotos viejas estan guardadas como texto dentro del reloj: pesan en Firestore y en el
// catalogo publico. Se suben tal cual (sin volver a comprimir, para no perder calidad) a R2 y
// el reloj queda apuntando a la URL. Lo corre el dueno desde Configuracion.
function relojesConFotoAntigua(){
  return state.inventario.filter(function(p){ return typeof p.foto==='string' && p.foto.indexOf('data:')===0; });
}
function renderFotosAntiguas(){
  var info=document.getElementById('fotos-antiguas-info');
  var btn=document.getElementById('btn-fotos-antiguas');
  if(!info) return;
  var n=relojesConFotoAntigua().length;
  info.textContent = n ? n+(n===1?' reloj tiene':' relojes tienen')+' la foto guardada a la antigua (como texto).' : 'Todas las fotos ya estan en la nube.';
  if(btn) btn.style.display = n ? '' : 'none';
}
async function migrarFotosAntiguas(){
  var lista=relojesConFotoAntigua();
  var info=document.getElementById('fotos-antiguas-info');
  var btn=document.getElementById('btn-fotos-antiguas');
  if(!lista.length){ renderFotosAntiguas(); return; }
  if(!navigator.onLine){ if(info){ info.style.color='var(--red)'; info.textContent='Necesitas internet.'; } return; }
  if(btn) btn.disabled=true;
  var ok=0, fallos=0;
  for(var k=0;k<lista.length;k++){
    var p=lista[k];
    if(info){ info.style.color='var(--muted)'; info.textContent='Subiendo foto '+(k+1)+' de '+lista.length+'...'; }
    try{
      var blob=await (await fetch(p.foto)).blob();
      if(!/^image\/(webp|jpeg|png)$/.test(blob.type)) blob=await _comprimir(blob);   // otro formato: convertir
      var url=await _subir(blob, p.id);
      var actual=state.inventario.find(function(x){ return x.id===p.id; });
      if(actual && actual.foto===p.foto){
        actual.foto=url;
        actual.fotos=[url].concat((actual.fotos||[]).filter(function(u){ return u!==url; }));
        ok++;
      }
    }catch(err){ fallos++; console.warn('Foto antigua no subida:', p.id, err); }
  }
  if(ok) save('inventario');
  if(btn) btn.disabled=false;
  renderFotosAntiguas();
  if(info){
    info.style.color = fallos ? 'var(--red)' : 'var(--green)';
    info.textContent = fallos ? ok+' pasadas a la nube, '+fallos+' con error. Vuelve a intentarlo.' : ok+(ok===1?' foto pasada':' fotos pasadas')+' a la nube.';
  }
}

// Compatibilidad con el nombre anterior (onchange del HTML viejo)
function subirFotoLocal(input){ return subirFotos(input); }

export { arreglarFotos, fotoCompartirFormulario, fotosFormulario, fotosSubiendo, jpgsFormulario, migrarFotosAntiguas, moverFoto, previewFoto, quitarFoto, renderFotos, renderFotosAntiguas, setFotosFormulario, subirFotoLocal, subirFotos };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { arreglarFotos, migrarFotosAntiguas, moverFoto, quitarFoto, subirFotoLocal, subirFotos });
