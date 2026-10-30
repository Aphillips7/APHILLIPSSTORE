// =================== CAMBIOS PUNTUALES (Tienda > Editar en el panel) ===================
// El dueno toca "Seleccionar" en la vista previa, elige cualquier elemento (como "Inspeccionar" de Chrome) y le
// cambia color, fondo, letra, tamano, esquinas, relleno, texto, foto u ocultarlo. Cada cambio es una regla
// { pg, sel, p: {...}, t?, img? }:
//   pg  pagina donde vale (inicio, preguntas, legal, guia)
//   sel selector CSS armado por el panel (ids, etiquetas, clases y :nth-of-type; nada mas)
//   p   propiedades de una lista cerrada, con valores validados (sin CSS libre)
// Misma validacion en la API (cloudflare/fotos-worker, validarSitioEstilos): si cambias una, cambia la otra.

const MAX_REGLAS = 200;
const PAGINAS_ESTILO = ['inicio', 'preguntas', 'legal', 'guia'];
// solo letras, numeros, #, ., -, _, espacios, > y parentesis/":" de :nth-of-type: no se puede escapar del selector
const RE_SEL = /^[A-Za-z0-9_\-#.\s>:()]{1,300}$/;
const RE_COLOR = /^#[0-9a-f]{6}$/;
const RE_FOTO = /^https:\/\/fotos\.aphillipsstore\.com\/relojes\/sitio\/[A-Za-z0-9._-]+$/;
const FUENTES = { titulo: "var(--font-titulo,'Syne',sans-serif)", texto: "'Jost',system-ui,sans-serif", sistema: 'system-ui,-apple-system,sans-serif', serif: "Georgia,'Times New Roman',serif" };
const NOMBRES_FUENTE = { titulo: 'Títulos (Syne)', texto: 'Texto (Jost)', sistema: 'Sistema', serif: 'Clásica (serif)' };
const MAX_TEXTO = 300;

function numero(v, min, max, paso){ var n = Number(v); if(!isFinite(n)) return null; n = Math.round(n / paso) * paso; return n < min || n > max ? null : Math.round(n * 100) / 100; }
function validarProps(p){
  p = p && typeof p === 'object' ? p : {};
  var o = {}, c;
  if(typeof p.color === 'string' && RE_COLOR.test(c = p.color.toLowerCase())) o.color = c;
  if(typeof p.fondo === 'string' && RE_COLOR.test(c = p.fondo.toLowerCase())) o.fondo = c;
  if((c = numero(p.tam, 8, 120, 1)) !== null) o.tam = c;
  if((c = numero(p.peso, 300, 900, 100)) !== null) o.peso = c;
  if(FUENTES[p.fuente]) o.fuente = p.fuente;
  if(p.may === 'mayus' || p.may === 'normal') o.may = p.may;
  if(['left', 'center', 'right'].indexOf(p.alin) !== -1) o.alin = p.alin;
  if((c = numero(p.esp, -0.05, 0.4, 0.01)) !== null) o.esp = c;
  if((c = numero(p.radio, 0, 60, 1)) !== null) o.radio = c;
  if((c = numero(p.relleno, 0, 80, 1)) !== null) o.relleno = c;
  if(p.oculto === true) o.oculto = true;
  return o;
}
function textoLimpio(v){
  return String(v == null ? '' : v).replace(/\r/g, '').replace(/[\u0000-\u0009\u000b-\u001f<>]/g, ' ').split('\n')
    .map(function(l){ return l.replace(/\s+/g, ' ').trim(); }).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXTO);
}
function validarEstilos(lista){
  var out = [], vistos = {};
  (Array.isArray(lista) ? lista : []).forEach(function(r){
    if(!r || out.length >= MAX_REGLAS || PAGINAS_ESTILO.indexOf(r.pg) === -1 || typeof r.sel !== 'string') return;
    var sel = r.sel.replace(/\s+/g, ' ').trim();
    if(!RE_SEL.test(sel) || vistos[r.pg + '|' + sel]) return;
    var x = { pg: r.pg, sel: sel, p: validarProps(r.p) };
    var t = typeof r.t === 'string' ? textoLimpio(r.t) : '';
    if(t) x.t = t;
    if(typeof r.img === 'string' && RE_FOTO.test(r.img)) x.img = r.img;
    if(!Object.keys(x.p).length && !x.t && !x.img) return;
    vistos[r.pg + '|' + sel] = 1;
    out.push(x);
  });
  return out;
}

// pagina actual de la tienda (las reglas solo valen donde se hicieron)
function paginaActual(){
  var r = location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  return r === '/preguntas' ? 'preguntas' : r === '/legal' ? 'legal' : r === '/guia-de-tamanos' ? 'guia' : 'inicio';
}
function cssDeEstilos(lista, pg){
  return validarEstilos(lista).filter(function(r){ return r.pg === pg && Object.keys(r.p).length; }).map(function(r){
    var p = r.p, d = [];
    if(p.oculto) d.push('display:none');
    if(p.color) d.push('color:' + p.color);
    if(p.fondo) d.push('background-color:' + p.fondo);
    if(p.tam) d.push('font-size:' + p.tam + 'px');
    if(p.peso) d.push('font-weight:' + p.peso);
    if(p.fuente) d.push('font-family:' + FUENTES[p.fuente]);
    if(p.may) d.push('text-transform:' + (p.may === 'mayus' ? 'uppercase' : 'none'));
    if(p.alin) d.push('text-align:' + p.alin);
    if(p.esp !== undefined) d.push('letter-spacing:' + p.esp + 'em');
    if(p.radio !== undefined) d.push('border-radius:' + p.radio + 'px');
    if(p.relleno !== undefined) d.push('padding:' + p.relleno + 'px');
    var css = r.sel + '{' + d.map(function(x){ return x + ' !important'; }).join(';') + '}';
    // letras grandes: en celular se achican un poco para que quepan
    if(p.tam > 28) css += '@media (max-width:700px){' + r.sel + '{font-size:' + Math.round(p.tam * 0.78) + 'px !important}}';
    return css;
  }).join('\n');
}
// texto con **negritas** y saltos de linea -> HTML seguro
function aHtml(t){
  var e = String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return e.split('\n').map(function(l){ return l.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>'); }).join('<br>');
}
// textos y fotos (lo que no es CSS); se recuerda el original para poder volver atras en la vista previa
var _tocados = [];
function aplicarContenidoEstilos(lista, pg){
  _tocados.forEach(function(x){ if(x.html !== undefined) x.el.innerHTML = x.html; if(x.src !== undefined) x.el.setAttribute('src', x.src); });
  _tocados = [];
  validarEstilos(lista).filter(function(r){ return r.pg === pg && (r.t || r.img); }).forEach(function(r){
    var lista2; try{ lista2 = document.querySelectorAll(r.sel); }catch(e){ return; }
    Array.prototype.forEach.call(lista2, function(e){
      if(r.t){ _tocados.push({ el: e, html: e.innerHTML }); e.innerHTML = aHtml(r.t); }
      if(r.img && e.tagName === 'IMG'){ _tocados.push({ el: e, src: e.getAttribute('src') || '' }); e.setAttribute('src', r.img); e.removeAttribute('srcset'); }
    });
  });
}
function aplicarEstilos(lista){
  var pg = paginaActual(), css = cssDeEstilos(lista, pg);
  var s = document.getElementById('estilos-sitio');
  if(!s){ s = document.createElement('style'); s.id = 'estilos-sitio'; document.head.appendChild(s); }
  if(s.textContent !== css) s.textContent = css;
  try{ aplicarContenidoEstilos(lista, pg); }catch(e){}
  return css;
}

export { FUENTES, MAX_REGLAS, MAX_TEXTO, NOMBRES_FUENTE, PAGINAS_ESTILO, RE_FOTO, RE_SEL, aplicarEstilos, cssDeEstilos, paginaActual, validarEstilos, validarProps };
