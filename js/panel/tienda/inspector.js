// =================== SELECCIONAR EN LA VISTA PREVIA (como "Inspeccionar" de Chrome) ===================
// Con "Seleccionar" activo, al pasar el cursor sobre la tienda (dentro del marco de la vista previa) se marca
// cada elemento con un recuadro y una etiqueta con sus datos (que es, medidas, color, letra, fondo y contraste).
// Al hacer clic queda elegido y el editor muestra solo lo que se le puede cambiar.
// El marco es del mismo sitio, asi que se trabaja directo sobre su documento. En modo seleccionar los clics no
// abren nada en la tienda (se frenan antes de llegar a sus botones).
//
// Selectores (los guarda el editor en sitio.estilos):
// - "Solo este": ruta desde el contenedor con id mas cercano, con :nth-of-type (no depende de clases que cambian).
// - "Todos los iguales": contenedor con id + clases estables (para tarjetas del catalogo y repetidos).
// - Dentro de tarjetas que arma la tienda con datos (tienen data-id) solo se permite "Todos los iguales": su orden
//   cambia y "solo este" no seria estable. Su texto y su foto vienen del inventario: no se editan aqui.

const CLASES_DE_ESTADO = /^(visible|active|activa|activo|sel|abierta|abierto|open|actual|on-hero|gen-reveal|revelado|hover|cargando|sitio-oculta|mostrar|show|hidden|oculto|oculta|confirmando|lleno|vacio|scrolled|fijo|is-.*|js-.*)$/;
const NOMBRES = { H1: 'Título', H2: 'Título', H3: 'Subtítulo', H4: 'Subtítulo', P: 'Texto', SPAN: 'Texto', B: 'Texto en negrita', STRONG: 'Texto en negrita', EM: 'Texto',
  A: 'Enlace o botón', BUTTON: 'Botón', IMG: 'Imagen', SECTION: 'Sección', HEADER: 'Encabezado', FOOTER: 'Pie de página', NAV: 'Menú', DIV: 'Bloque', FIGURE: 'Bloque con foto',
  FIGCAPTION: 'Texto de la foto', LI: 'Elemento de lista', UL: 'Lista', OL: 'Lista', LABEL: 'Texto', INPUT: 'Campo', SUMMARY: 'Pregunta', DETAILS: 'Pregunta y respuesta', SMALL: 'Texto pequeño', I: 'Ícono', SVG: 'Ícono' };

var _f = null, _doc = null, _activo = false, _hover = null, _elegido = null, _alElegir = null, _caja = null, _etq = null, _marca = null, _ligado = null;

function marco(){ return document.getElementById('ed-vista'); }
function hex(c){
  var m = String(c || '').match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?/);
  if(!m) return null;
  if(m[4] !== undefined && Number(m[4]) < 0.05) return null;   // transparente
  return '#' + [m[1], m[2], m[3]].map(function(x){ return ('0' + Number(x).toString(16)).slice(-2); }).join('');
}
function lum(h){ var c = [1, 3, 5].map(function(i){ var v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function contraste(a, b){ var x = lum(a), y = lum(b); return Math.round((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) * 10) / 10; }
// fondo que se ve detras del elemento (sube hasta encontrar un color; con foto de fondo no se puede saber)
function fondoEfectivo(e){
  var w = e.ownerDocument.defaultView;
  for(var x = e; x && x.nodeType === 1; x = x.parentElement){
    var cs = w.getComputedStyle(x);
    if(cs.backgroundImage && cs.backgroundImage !== 'none' && !/gradient/.test(cs.backgroundImage)) return null;
    var h = hex(cs.backgroundColor); if(h) return h;
  }
  return '#ffffff';
}
function tieneTexto(e){ return Array.prototype.some.call(e.childNodes, function(n){ return n.nodeType === 3 && n.textContent.trim(); }); }
// texto que se puede cambiar: solo texto, saltos y negritas adentro, y no viene de los datos del catalogo
function textoEditable(e){
  if(!e || dinamico(e) || ['IMG', 'INPUT', 'SVG', 'SELECT', 'TEXTAREA'].indexOf(e.tagName) !== -1) return false;
  if(!tieneTexto(e)) return false;
  var ok = Array.prototype.every.call(e.childNodes, function(n){ return n.nodeType === 3 || (n.nodeType === 1 && ['BR', 'B', 'STRONG'].indexOf(n.tagName) !== -1 && !n.children.length); });
  return ok && e.textContent.trim().length <= 300;
}
function dinamico(e){ return !!(e && e.closest && e.closest('[data-id]')); }
function claseEstable(e){
  return Array.prototype.find.call(e.classList || [], function(c){ return /^[A-Za-z][\w-]*$/.test(c) && !CLASES_DE_ESTADO.test(c); }) || '';
}
function idValido(e){ return e.id && /^[A-Za-z][\w-]*$/.test(e.id) && e.ownerDocument.querySelectorAll('#' + e.id).length === 1; }
function rutaUnica(e){
  var partes = [], d = e.ownerDocument;
  for(var x = e; x && x.nodeType === 1 && x !== d.body; x = x.parentElement){
    if(idValido(x)){ partes.unshift('#' + x.id); return partes.join(' > '); }
    var tag = x.tagName.toLowerCase(), n = 1;
    for(var y = x.previousElementSibling; y; y = y.previousElementSibling) if(y.tagName === x.tagName) n++;
    partes.unshift(tag + ':nth-of-type(' + n + ')');
  }
  return 'body > ' + partes.join(' > ');
}
function rutaIguales(e){
  // contenedor con id + la cadena de clases estables desde la tarjeta (o desde el elemento) hacia adentro
  var raiz = e.closest('[data-id]') || e, cadena = [];
  for(var x = e; x; x = x.parentElement){
    var c = claseEstable(x); cadena.unshift(c ? x.tagName.toLowerCase() + '.' + c : x.tagName.toLowerCase());
    if(x === raiz) break;
  }
  var ancla = raiz.parentElement; while(ancla && !idValido(ancla) && ancla !== e.ownerDocument.body) ancla = ancla.parentElement;
  if(!claseEstable(raiz) && raiz === e) return '';
  return (ancla && ancla !== e.ownerDocument.body ? '#' + ancla.id + ' ' : '') + cadena.join(' ');
}
function nombreDe(e){
  if(e.closest && e.closest('[data-id]')) return (NOMBRES[e.tagName.toUpperCase()] || 'Elemento') + ' de las tarjetas';
  return NOMBRES[e.tagName.toUpperCase()] || 'Elemento';
}
function etiquetaCodigo(e){ var c = claseEstable(e); return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (c ? '.' + c : ''); }

// datos del elemento (para la etiqueta del cursor y para el editor)
function datos(e){
  var w = e.ownerDocument.defaultView, cs = w.getComputedStyle(e), r = e.getBoundingClientRect();
  var color = hex(cs.color) || '#000000', fondo = fondoEfectivo(e), propio = hex(cs.backgroundColor);
  var fuente = (cs.fontFamily || '').split(',')[0].replace(/["']/g, '').trim();
  var ratio = fondo ? contraste(color, fondo) : null, tam = parseFloat(cs.fontSize) || 16, peso = Number(cs.fontWeight) || 400;
  var grande = tam >= 24 || (tam >= 18.6 && peso >= 700);
  var unica = rutaUnica(e), iguales = rutaIguales(e), cuantos = 0;
  try{ cuantos = iguales ? e.ownerDocument.querySelectorAll(iguales).length : 0; }catch(x){ iguales = ''; }
  return {
    nombre: nombreDe(e), codigo: etiquetaCodigo(e), ancho: Math.round(r.width), alto: Math.round(r.height),
    color: color, fondo: fondo, fondoPropio: propio, tam: Math.round(tam), peso: peso, fuente: fuente,
    may: cs.textTransform === 'uppercase', alin: cs.textAlign, esp: parseFloat(cs.letterSpacing) / tam || 0,
    radio: parseFloat(cs.borderTopLeftRadius) || 0, relleno: parseFloat(cs.paddingTop) || 0,
    ratio: ratio, minimo: grande ? 3 : 4.5, conTexto: !!e.textContent.trim() && e.tagName !== 'IMG',
    esImagen: e.tagName === 'IMG', imagen: e.tagName === 'IMG' ? e.currentSrc || e.src : '',
    texto: textoEditable(e) ? e.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<(b|strong)>([\s\S]*?)<\/(b|strong)>/gi, '**$2**').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/[ \t]+/g, ' ').replace(/\n /g, '\n').trim() : null,
    dinamico: dinamico(e), selUnico: dinamico(e) ? '' : unica, selIguales: cuantos > 1 ? iguales : (dinamico(e) ? iguales : ''), cuantos: cuantos,
    tienePadre: !!(e.parentElement && e.parentElement !== e.ownerDocument.body)
  };
}

// ---------- dibujo dentro del marco ----------
function preparar(){
  var f = marco(); if(!f) return false;
  var d; try{ d = f.contentDocument; }catch(e){ return false; }
  if(!d || !d.body) return false;
  if(d !== _doc){
    _doc = d; _hover = null; _caja = _etq = _marca = null;
    var st = d.createElement('style'); st.id = 'aph-inspector';
    st.textContent = '.aph-ins-caja,.aph-ins-marca{position:fixed;z-index:2147483646;pointer-events:none;box-sizing:border-box;}' +
      '.aph-ins-caja{background:rgba(66,133,244,.18);outline:2px solid #4285f4;}' +
      '.aph-ins-marca{outline:2px dashed #e8710a;background:rgba(232,113,10,.06);}' +
      '.aph-ins-etq{position:fixed;z-index:2147483647;pointer-events:none;background:#202124;color:#e8eaed;font:12px/1.45 system-ui,-apple-system,sans-serif;padding:8px 10px;border-radius:6px;box-shadow:0 4px 18px rgba(0,0,0,.35);max-width:300px;}' +
      '.aph-ins-etq b{color:#c58af9;font-weight:600;} .aph-ins-etq i{color:#9aa0a6;font-style:normal;float:right;margin-left:14px;}' +
      '.aph-ins-etq table{border-collapse:collapse;margin-top:6px;width:100%;} .aph-ins-etq td{padding:1px 0;vertical-align:middle;} .aph-ins-etq td:first-child{color:#9aa0a6;padding-right:12px;white-space:nowrap;}' +
      '.aph-ins-etq s{display:inline-block;width:11px;height:11px;border:1px solid rgba(255,255,255,.4);vertical-align:-1px;margin-right:5px;text-decoration:none;}' +
      '.aph-ins-etq .ok{color:#81c995;} .aph-ins-etq .mal{color:#f28b82;}' +
      'html.aph-ins-modo,html.aph-ins-modo *{cursor:crosshair !important;}';
    d.head.appendChild(st);
    var w = d.defaultView;
    w.addEventListener('scroll', recolocar, true);
    w.addEventListener('resize', recolocar);
    ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'submit', 'dblclick', 'contextmenu'].forEach(function(t){ w.addEventListener(t, frenar, true); });
    w.addEventListener('mousemove', moverCursor, true);
    w.addEventListener('mouseleave', function(){ ocultarCursor(); }, true);
    w.addEventListener('keydown', function(e){ if(e.key === 'Escape') desactivar(); }, true);
    // si el elemento elegido se rehizo (por ejemplo el catalogo se volvio a pintar), se busca de nuevo
  }
  return true;
}
function nuevo(cls){ var x = _doc.createElement('div'); x.className = cls; _doc.body.appendChild(x); return x; }
function poner(caja, e){
  var r = e.getBoundingClientRect();
  caja.style.left = r.left + 'px'; caja.style.top = r.top + 'px'; caja.style.width = r.width + 'px'; caja.style.height = r.height + 'px'; caja.hidden = false;
}
function frenar(e){
  if(!_activo) return;
  e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
  if(e.type === 'click'){ var t = objetivo(e.target); if(t) elegir(t, true); }
}
function objetivo(t){
  if(!t || t.nodeType !== 1) t = t && t.parentElement;
  if(!t || (t.classList && Array.prototype.some.call(t.classList, function(c){ return c.indexOf('aph-ins-') === 0; }))) return null;
  // dentro de un ícono SVG se toma el SVG entero
  var svg = t.closest && t.closest('svg'); if(svg) t = svg;
  if(t === _doc.body || t === _doc.documentElement) return null;
  return t;
}
function moverCursor(e){
  if(!_activo) return;
  var t = objetivo(e.target); if(!t) return;
  _hover = t;
  if(!_caja || !_caja.isConnected) _caja = nuevo('aph-ins-caja');
  if(!_etq || !_etq.isConnected) _etq = nuevo('aph-ins-etq');
  poner(_caja, t);
  var x = datos(t);
  _etq.innerHTML = '<b>' + escHtml(x.codigo) + '</b><i>' + x.ancho + ' × ' + x.alto + '</i><div>' + escHtml(x.nombre) + '</div><table>' +
    (x.conTexto ? '<tr><td>Color</td><td><s style="background:' + x.color + '"></s>' + x.color + '</td></tr><tr><td>Letra</td><td>' + x.tam + 'px ' + escHtml(x.fuente) + ' ' + x.peso + '</td></tr>' : '') +
    '<tr><td>Fondo</td><td>' + (x.fondo ? '<s style="background:' + x.fondo + '"></s>' + x.fondo : 'foto') + '</td></tr>' +
    (x.conTexto && x.ratio ? '<tr><td>Contraste</td><td class="' + (x.ratio >= x.minimo ? 'ok' : 'mal') + '">Aa ' + x.ratio + (x.ratio >= x.minimo ? ' ✓' : ' ✗ poco legible') + '</td></tr>' : '') + '</table>';
  var k = Number((marco() || {}).dataset && marco().dataset.escala) || 1;
  _etq.style.zoom = k < 1 ? String(Math.min(2.2, 1 / k)) : '';
  var z = Number(_etq.style.zoom) || 1;
  var r = t.getBoundingClientRect(), w = _doc.defaultView, ew = _etq.offsetWidth * z, eh = _etq.offsetHeight * z;
  var top = r.bottom + 6; if(top + eh > w.innerHeight) top = Math.max(4, r.top - eh - 6);
  _etq.style.left = Math.max(4, Math.min(r.left, w.innerWidth - ew - 4)) / z + 'px'; _etq.style.top = top / z + 'px'; _etq.hidden = false;
}
function ocultarCursor(){ if(_caja) _caja.hidden = true; if(_etq) _etq.hidden = true; }
function escHtml(t){ return String(t == null ? '' : t).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function recolocar(){
  if(_elegido && _marca){ if(_elegido.isConnected) poner(_marca, _elegido); else _marca.hidden = true; }
  if(_hover && _caja && !_caja.hidden && _hover.isConnected) poner(_caja, _hover);
}

// ---------- API para el editor ----------
function activar(alElegir){
  _alElegir = alElegir || _alElegir;
  if(!preparar()) return false;
  _activo = true; _doc.documentElement.classList.add('aph-ins-modo');
  return true;
}
function desactivar(){
  _activo = false; ocultarCursor();
  if(_doc) _doc.documentElement.classList.remove('aph-ins-modo');
  if(_ligado) _ligado();
}
function activo(){ return _activo; }
function elegir(e, avisar){
  if(!preparar()) return;
  _elegido = e;
  if(!_marca || !_marca.isConnected) _marca = nuevo('aph-ins-marca');
  poner(_marca, e);
  if(_activo) desactivar();   // como en Chrome: al elegir, se sale del modo seleccionar
  if(avisar && _alElegir) _alElegir(datos(e));
}
function elegirPorSelector(sel, avisar){
  if(!preparar()) return false;
  var e = null; try{ e = _doc.querySelector(sel); }catch(x){}
  if(!e) return false;
  try{ e.scrollIntoView({ block: 'center' }); }catch(x){}
  elegir(e, avisar); return true;
}
function elegido(){ return _elegido && _elegido.isConnected ? datos(_elegido) : null; }
function elegirPadre(){ if(_elegido && _elegido.parentElement && _elegido.parentElement !== _elegido.ownerDocument.body) elegir(_elegido.parentElement, true); }
function soltar(){ _elegido = null; if(_marca) _marca.hidden = true; }
// el marco se recargo (otra pagina o "Recargar"): se vuelve a preparar y, si estaba activo, sigue activo
function marcoListo(){ _doc = null; _elegido = null; if(_activo) activar(); }
// el editor avisa cuando termina de aplicar un cambio (el tamano del elemento pudo cambiar)
function refrescar(){ setTimeout(recolocar, 60); }
// al cambiar el modo (boton Seleccionar) el editor repinta su boton
function alCambiarModo(fn){ _ligado = fn; }
// el elemento que coincide con un selector, en la pagina que muestra el marco (para revisar contraste)
function datosDe(sel){ if(!preparar()) return null; var e = null; try{ e = _doc.querySelector(sel); }catch(x){} return e ? datos(e) : null; }
// ¿este elemento es el de un texto o foto que ya tiene su campo propio (portada / fotos)?
function coincide(selector){ if(!_elegido || !preparar()) return false; try{ return _doc.querySelector(selector) === _elegido; }catch(x){ return false; } }

export { activar, activo, alCambiarModo, coincide, contraste, datosDe, desactivar, elegido, elegir, elegirPadre, elegirPorSelector, marcoListo, refrescar, soltar };
