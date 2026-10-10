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
   ============================================================ */
import { firebase } from '../../firebase.js';

const API_FOTOS = 'https://api.aphillipsstore.com/fotos';
const MAX_DIM = 1600;
let _fotos = [];          // lista de fotos del formulario (URLs https o una data: antigua)
let _subiendo = 0;

function _esc(t){ return String(t==null?'':t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function _estado(txt, color){
  var s=document.getElementById('inv-foto-status');
  if(s){ s.style.color=color||'var(--muted)'; s.textContent=txt; }
}

// ---------- lista del formulario ----------
function fotosFormulario(){ return _fotos.slice(); }
function setFotosFormulario(lista){
  _fotos = (lista||[]).filter(Boolean);
  renderFotos();
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
function _leerImagen(file){
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
  var w=img.naturalWidth, h=img.naturalHeight;
  if(w>MAX_DIM||h>MAX_DIM){ if(w>h){ h=Math.round(h*MAX_DIM/w); w=MAX_DIM; } else { w=Math.round(w*MAX_DIM/h); h=MAX_DIM; } }
  var c=document.createElement('canvas'); c.width=w; c.height=h;
  var ctx=c.getContext('2d'); ctx.imageSmoothingQuality='high'; ctx.drawImage(img,0,0,w,h);
  var blob=await _aBlob(c,'image/webp',0.86);
  if(!blob || blob.type!=='image/webp') blob=await _aBlob(c,'image/jpeg',0.86);   // Safari antiguo
  if(!blob) throw new Error('No se pudo convertir la imagen');
  return blob;
}
function _carpeta(){
  // carpeta en R2: el id del reloj si se esta editando; si es nuevo, una carpeta temporal del formulario
  var edit=document.getElementById('inv-edit-index');
  if(edit && edit.value) return edit.value;
  var h=document.getElementById('inv-foto-carpeta');
  if(h && !h.value) h.value='nuevo-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  return h ? h.value : 'sin-id';
}
async function _subir(blob){
  var usuario=firebase.auth().currentUser;
  if(!usuario) throw new Error('Inicia sesion de nuevo para subir fotos');
  var token=await usuario.getIdToken();
  var r=await fetch(API_FOTOS+'?reloj='+encodeURIComponent(_carpeta()), {
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
      var blob=await _comprimir(archivos[k]);
      var url=await _subir(blob);
      _fotos.push(url); ok++;
      renderFotos();
    }catch(err){ fallos++; console.warn('Foto no subida:', err); _estado('No se pudo subir una foto: '+err.message,'var(--red)'); }
    _subiendo--;
  }
  _bloquearGuardar(false);
  if(!fallos) _estado(ok===1?'Foto subida.':ok+' fotos subidas.','var(--green)');
  else if(ok) _estado(ok+' subidas, '+fallos+' con error. Intenta de nuevo con las que faltan.','var(--accent)');
}
function _bloquearGuardar(si){
  var b=document.getElementById('inv-submit-btn');
  if(b){ b.disabled=si; b.style.opacity=si?.5:''; }
}
function fotosSubiendo(){ return _subiendo>0; }

// Compatibilidad con el nombre anterior (onchange del HTML viejo)
function subirFotoLocal(input){ return subirFotos(input); }

export { fotosFormulario, fotosSubiendo, moverFoto, previewFoto, quitarFoto, renderFotos, setFotosFormulario, subirFotoLocal, subirFotos };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { moverFoto, quitarFoto, subirFotoLocal, subirFotos });
