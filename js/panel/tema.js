// Tema del panel: automatico (sigue al sistema), claro u oscuro. Se guarda en localStorage
// (aphillips_tema) y se aplica como data-theme en <html>. index.html lo aplica antes de pintar
// con un script corto en <head> para que no parpadee; este modulo maneja el boton.

var CLAVE = 'aphillips_tema';
var ORDEN = ['auto', 'light', 'dark'];
var NOMBRES = { auto: 'Tema automatico', light: 'Tema claro', dark: 'Tema oscuro' };
var ICONOS = {
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
  light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'
};

function leer(){
  try{ var t = localStorage.getItem(CLAVE); return ORDEN.indexOf(t) >= 0 ? t : 'auto'; }catch(e){ return 'auto'; }
}

function aplicar(t){
  if(t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  var b = document.getElementById('tema-btn');
  if(b){ b.innerHTML = ICONOS[t]; b.title = NOMBRES[t] + ' (toca para cambiar)'; b.setAttribute('aria-label', NOMBRES[t]); }
}

export function cambiarTema(){
  var t = ORDEN[(ORDEN.indexOf(leer()) + 1) % ORDEN.length];
  try{ localStorage.setItem(CLAVE, t); }catch(e){}
  aplicar(t);
}

aplicar(leer());

Object.assign(window, { cambiarTema });
