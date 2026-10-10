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

export { _destEsc, normalizar, toast, vibrar };
