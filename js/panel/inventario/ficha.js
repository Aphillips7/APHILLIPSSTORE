// =================== FICHA TECNICA PEGADA ===================
// En vez de llenar las especificaciones una por una, se pega la tabla de la pagina de la marca
// (ej. "Caja y esfera / Tamaño de la caja: 48 mm / ..."). Aqui se ordena en grupos, se rellenan
// los campos de siempre (mm, material, cristal, agua...) y la ficha completa se guarda en p.ficha
// para que el catalogo la muestre agrupada.
//   ficha = [ { t:'Caja y esfera', f:[ ['Tamaño de la caja','48 mm'], ... ] }, ... ]

var MAX_GRUPOS = 12, MAX_FILAS = 40;

function sinAcentos(t){ return String(t||'').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function limpiar(t){ return String(t||'').replace(/^[\s•·\-*–—▪●○]+/, '').replace(/\s+/g, ' ').trim(); }

function parsearFicha(texto){
  var grupos = [], actual = null;
  function grupo(titulo){ actual = { t: titulo, f: [] }; grupos.push(actual); }
  function fila(k, v){
    if(!actual) grupo('Especificaciones');
    if(actual.f.length < MAX_FILAS) actual.f.push([k.slice(0, 60), v.slice(0, 160)]);
  }
  String(texto||'').split(/\r?\n/).forEach(function(linea){
    var partes = linea.split(/\t+/).map(limpiar).filter(Boolean);
    if(!partes.length) return;
    // tabla de dos columnas sin dos puntos: "Material	Acero inoxidable"
    if(partes.length === 2 && partes[0].indexOf(':') < 0 && partes[1].indexOf(':') < 0 && actual){
      fila(partes[0], partes[1]); return;
    }
    partes.forEach(function(p){
      var i = p.indexOf(':');
      var k = i > 0 ? p.slice(0, i).trim() : '', v = i > 0 ? p.slice(i + 1).trim() : '';
      if(k && v) fila(k, v);
      else if(p.length <= 40) grupo(i > 0 ? k : p);   // "Banda" o "Banda:" es un titulo de grupo
    });
  });
  return grupos.filter(function(g){ return g.f.length; }).slice(0, MAX_GRUPOS);
}

function fichaATexto(ficha){
  if(!Array.isArray(ficha)) return '';
  return ficha.map(function(g){
    return g.t + '\n' + g.f.map(function(r){ return r[0] + ': ' + r[1]; }).join('\n');
  }).join('\n\n');
}

// Movimiento: el select del panel solo tiene unas opciones fijas
function opcionMovimiento(v){
  var s = sinAcentos(v);
  if(/automat/.test(s)) return 'Automatico';
  if(/solar/.test(s)) return 'Solar';
  if(/crono|chrono/.test(s)) return 'Cronografo cuarzo';
  if(/cuarzo|quartz/.test(s)) return 'Cuarzo japones';
  return '';
}

// Rellena los campos de siempre con lo que se reconozca de la ficha (devuelve cuantos lleno)
function rellenarCampos(ficha){
  var n = 0;
  function poner(id, v){ var el = document.getElementById(id); if(el && v){ el.value = v; n++; } }
  ficha.forEach(function(g){
    var tg = sinAcentos(g.t), esBanda = /banda|correa|brazalete|pulsera|band|strap|bracelet/.test(tg);
    g.f.forEach(function(r){
      var k = sinAcentos(r[0]), v = r[1];
      if(/tamano de la caja|diametro|case size|case diameter/.test(k)){ var mm = parseFloat(String(v).replace(',', '.')); if(mm) poner('inv-mm', String(mm)); }
      else if(/material de la caja|case material/.test(k)) poner('inv-material-caja', v);
      else if(/color de la esfera|color de esfera|dial color/.test(k)) poner('inv-color-esfera', v);
      else if(/cristal|crystal/.test(k)) poner('inv-cristal', v);
      else if(/resistencia al agua|water resist/.test(k)) poner('inv-agua', v);
      else if(esBanda && /^material/.test(k)) poner('inv-material-correa', v);
      else if(/movimiento|movement/.test(k)) poner('inv-movimiento', opcionMovimiento(v));
    });
  });
  return n;
}

function escHtml(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }

function pintarVista(ficha, aviso){
  var vista = document.getElementById('inv-ficha-vista'); if(!vista) return;
  if(!ficha.length){ vista.innerHTML = aviso ? '<p class="ficha-aviso">' + escHtml(aviso) + '</p>' : ''; return; }
  vista.innerHTML = (aviso ? '<p class="ficha-aviso">' + escHtml(aviso) + '</p>' : '') + ficha.map(function(g){
    return '<div class="ficha-grupo"><b>' + escHtml(g.t) + '</b>' + g.f.map(function(r){
      return '<div><span>' + escHtml(r[0]) + '</span> ' + escHtml(r[1]) + '</div>';
    }).join('') + '</div>';
  }).join('');
}

// Boton "Ordenar y rellenar campos"
function ordenarFicha(){
  var ta = document.getElementById('inv-ficha'); if(!ta) return;
  var ficha = parsearFicha(ta.value);
  if(!ficha.length){ pintarVista([], 'No encontre datos. Pega lineas del tipo "Tamaño de la caja: 48 mm".'); return; }
  var n = rellenarCampos(ficha);
  ta.value = fichaATexto(ficha);
  pintarVista(ficha, 'Listo: ' + ficha.reduce(function(s, g){ return s + g.f.length; }, 0) + ' datos en ' + ficha.length + ' grupos' + (n ? ', ' + n + ' campos rellenados.' : '.'));
}

// Para el formulario: leer, cargar y limpiar
function fichaFormulario(){ var ta = document.getElementById('inv-ficha'); return ta ? parsearFicha(ta.value) : []; }
function cargarFicha(ficha){
  var ta = document.getElementById('inv-ficha'); if(ta) ta.value = fichaATexto(ficha);
  pintarVista(Array.isArray(ficha) ? ficha : [], '');
}

export { cargarFicha, fichaATexto, fichaFormulario, ordenarFicha, parsearFicha };
// Usada desde el onclick del boton en index.html
Object.assign(window, { ordenarFicha });
