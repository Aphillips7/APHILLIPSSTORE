function vibrar(ms){ if(navigator.vibrate){ try{ navigator.vibrate(ms||10); }catch(e){} } }

function toast(msg){
  var t = document.getElementById('toast');
  if(!t){ t = document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 1800);
}

function _destEsc(t){ return String(t==null?'':t).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

// minusculas y sin acentos, para comparar textos ("Automático" = "automatico")
function normalizar(t){ return String(t==null?'':t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

// Miniatura (480 px) de una foto de R2 para las tarjetas: fotos.aphillipsstore.com/miniaturas/relojes/...
// Si la foto no es de R2, se usa tal cual. La <img> lleva data-completa con la foto original, y
// fotoRespaldo() la pone si la miniatura no existe (fotos subidas antes de que hubiera miniaturas).
var BASE_FOTOS = 'https://fotos.aphillipsstore.com/';
function miniatura(url){
  return typeof url === 'string' && url.indexOf(BASE_FOTOS + 'relojes/') === 0 ? BASE_FOTOS + 'miniaturas/' + url.slice(BASE_FOTOS.length) : url;
}
// devuelve true si cambio a la foto completa; false si ya era la completa (no hay mas respaldo)
function fotoRespaldo(img){
  var completa = img && img.getAttribute('data-completa');
  if(!completa || img.src === completa) return false;
  img.removeAttribute('data-completa');
  img.src = completa;
  return true;
}

// poka-yoke: errores de dedo comunes en el dominio ("gmial.com", "hotmail.con") se ofrecen corregidos
var DOMINIOS = { gmail: 'gmail.com', hotmail: 'hotmail.com', outlook: 'outlook.com', yahoo: 'yahoo.com', icloud: 'icloud.com', live: 'live.com' };
var TYPOS = { gmial: 'gmail', gmal: 'gmail', gamil: 'gmail', gnail: 'gmail', gmali: 'gmail', gmaill: 'gmail', hotmial: 'hotmail', hotmal: 'hotmail', homail: 'hotmail', hotmil: 'hotmail', outlok: 'outlook', outloo: 'outlook', yaho: 'yahoo', yahooo: 'yahoo', iclod: 'icloud', icloud: 'icloud' };
function sugerirCorreo(email){
  var m = email.toLowerCase().match(/^([^@\s]+)@([a-z0-9-]+)\.([a-z.]+)$/);
  if(!m) return '';
  var base = TYPOS[m[2]] || m[2];
  if(DOMINIOS[base]){
    var bien = DOMINIOS[base];
    if((m[2] + '.' + m[3]) !== bien && /^(com?|con|cm|om|comm|cpm|vom|xom)$/.test(m[3])) return m[1] + '@' + bien;
  } else if(/^(con|cpm|vom|xom|comm|cm|om)$/.test(m[3])) return m[1] + '@' + m[2] + '.com';
  return '';
}

export { _destEsc, fotoRespaldo, miniatura, normalizar, sugerirCorreo, toast, vibrar };
// usada desde el onerror de las <img> de las tarjetas
window.fotoRespaldo = fotoRespaldo;
