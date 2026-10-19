// =================== FICHA TECNICA PEGADA ===================
// En vez de llenar las especificaciones una por una, se pega la tabla de la pagina de la marca
// (ej. "Caja y esfera / Tamaño de la caja: 48 mm / ..."). Aqui se ordena en grupos, se rellenan
// los campos de siempre (mm, material, cristal, agua...) y la ficha completa se guarda en p.ficha
// para que el catalogo la muestre agrupada.
//   ficha = [ { t:'Caja y esfera', f:[ ['Tamaño de la caja','48 mm'], ... ] }, ... ]

var MAX_GRUPOS = 12, MAX_FILAS = 40;

function sinAcentos(t){ return String(t||'').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function limpiar(t){ return String(t||'').replace(/^[\s•·\-*–—▪●○]+/, '').replace(/\s+/g, ' ').trim(); }

// Tipos de cristal: se dejan con el nombre que usa la marca (ej. Invicta: "Flame Fusion")
var CRISTALES = [[/fusion de llamas?|flame fusion/, 'Flame Fusion'], [/zafiro|sapphire/, 'Zafiro'], [/mineral/, 'Mineral'], [/acrilico|acrylic/, 'Acrílico']];
function nombreCristal(v){
  var s = sinAcentos(v);
  for(var i = 0; i < CRISTALES.length; i++) if(CRISTALES[i][0].test(s)) return CRISTALES[i][1];
  return v;
}

// ---------- Paginas en ingles (ej. invictawatch.com): se traduce al espanol para la tienda ----------
var GRUPOS_ES = {
  'case and dial':'Caja y esfera', 'case & dial':'Caja y esfera', 'case':'Caja', 'dial':'Esfera', 'movement':'Movimiento',
  'band':'Banda', 'strap':'Correa', 'bracelet':'Brazalete', 'water resistance':'Resistencia al agua', 'features':'Características',
  'additional features':'Otras características', 'general':'General', 'bezel':'Bisel', 'crystal':'Cristal'
};
var ETIQUETAS_ES = {
  'case size':'Tamaño de la caja', 'case diameter':'Tamaño de la caja', 'case thickness':'Grosor de la caja', 'case shape':'Forma de la caja',
  'crown type':'Tipo de corona', 'crown':'Corona', 'crystal type':'Tipo de cristal', 'crystal':'Tipo de cristal',
  'bezel material':'Material del bisel', 'bezel color':'Color del bisel', 'bezel function':'Función del bisel',
  'case material':'Material de la caja', 'case color':'Color de la caja', 'case finish':'Acabado de la caja',
  'dial color':'Color de la esfera', 'dial material':'Material de la esfera', 'dial type':'Tipo de esfera', 'hands':'Agujas', 'luminous':'Luminiscencia',
  'caliber':'Calibre', 'calibre':'Calibre', 'movement':'Movimiento', 'movement type':'Tipo de movimiento', 'jewels':'Rubíes', 'power reserve':'Reserva de marcha',
  'size':'Tamaño', 'width':'Ancho', 'band width':'Ancho', 'length':'Longitud', 'band length':'Longitud', 'material':'Material', 'band material':'Material',
  'tone':'Tono', 'color':'Color', 'band color':'Color', 'clasp':'Cierre', 'clasp type':'Tipo de cierre',
  'water resistance':'Resistencia al agua', 'weight':'Peso', 'functions':'Funciones', 'display':'Pantalla', 'gender':'Género'
};
var VALORES_ES = {
  'stainless steel':'Acero inoxidable', 'steel':'Acero', 'gold':'Dorado', 'yellow gold':'Dorado', 'rose gold':'Oro rosa', 'silver':'Plateado',
  'black':'Negro', 'blue':'Azul', 'white':'Blanco', 'green':'Verde', 'red':'Rojo', 'grey':'Gris', 'gray':'Gris', 'brown':'Marrón',
  'orange':'Naranja', 'yellow':'Amarillo', 'purple':'Morado', 'pink':'Rosa', 'gunmetal':'Gris oscuro', 'two tone':'Dos tonos', 'two-tone':'Dos tonos',
  'push':'Pulsador', 'push pull':'Pulsador', 'screw down':'De rosca', 'screw-down':'De rosca', 'metal':'Metal', 'silicone':'Silicona', 'leather':'Cuero',
  'rubber':'Caucho', 'polyurethane':'Poliuretano', 'titanium':'Titanio', 'ceramic':'Cerámica', 'carbon fiber':'Fibra de carbono',
  'mother of pearl':'Nácar', 'quartz':'Cuarzo', 'automatic':'Automático', 'mechanical':'Mecánico', 'solar':'Solar', 'chronograph':'Cronógrafo',
  'unidirectional':'Unidireccional', 'bidirectional':'Bidireccional', 'fixed':'Fijo', 'fold over clasp':'Cierre desplegable', 'buckle':'Hebilla'
};
function traducir(dic, t){ var s = String(t||'').toLowerCase().replace(/\s+/g, ' ').trim(); return dic[s] || t; }
function traducirValor(v){
  // "48mm" -> "48 mm", "200m" -> "200 m"; cada parte de "Black, Gold" por separado
  v = String(v).replace(/(\d)(mm|m)\b/gi, '$1 $2');
  return v.split(/\s*([,\/&])\s*/).map(function(p){ return /^[,\/&]$/.test(p) ? (p === ',' ? ', ' : ' ' + p + ' ') : traducir(VALORES_ES, p); }).join('');
}
// lineas que no son datos: las pestanas de la pagina ("Features  Specs")
var RE_RUIDO = /^(features|specs|specifications|caracteristicas|especificaciones|details|detalles)$/;

// Encabezado de la pagina de la marca: "Pro Diver SCUBA Men" / "Model 0072 Men's Watch"
var COLECCIONES = ['Pro Diver', 'Speedway', 'Bolt', 'Specialty', 'Subaqua', 'Reserve', 'Venom', 'Lupah', 'Aviator', 'Russian Diver', 'Excursion',
  'Angel', 'Wildflower', 'Objet D Art', 'Coalition Forces', 'Sea Base', 'Akula', 'I-Force', 'S1 Rally', 'Corduba', 'Hydromax', 'Marvel', 'Disney',
  'Star Wars', 'NFL', 'Character Collection', 'Sea Hunter', 'Sea Wizard', 'Grand Diver', 'Pro Diver Scuba', 'Manta Ray', 'Ocean Reef', 'Cruise', 'Sea Rock'];
function datosCabecera(texto){
  var r = {}, lineas = String(texto||'').split(/\r?\n/).map(limpiar).filter(Boolean);
  for(var i = 0; i < Math.min(lineas.length, 6); i++){
    var l = lineas[i], s = sinAcentos(l);
    if(l.indexOf(':') >= 0 || RE_RUIDO.test(s)) continue;
    var m = s.match(/^(?:model|modelo|ref(?:erence|erencia)?\.?)\s*#?\s*([a-z0-9-]+)/);
    if(m){ r.sku = m[1].toUpperCase(); }
    if(/\b(women|woman|ladies|mujer|dama)/.test(s)) r.genero = 'mujer';
    else if(/\b(men|man|hombre|caballero)/.test(s) && !r.genero) r.genero = 'hombre';
    else if(/\bunisex\b/.test(s)) r.genero = 'unisex';
    if(!m && !r.nombre && i === 0){
      r.nombre = l.replace(/\s+(men'?s?|women'?s?|ladies|unisex|watch)\b.*$/i, '').trim();
      var col = COLECCIONES.filter(function(c){ return sinAcentos(r.nombre).indexOf(sinAcentos(c)) === 0; })
        .sort(function(a, b){ return b.length - a.length; })[0];
      if(col) r.coleccion = col === 'Pro Diver Scuba' ? 'Pro Diver' : col;
    }
  }
  // marca: por su nombre en el texto o por el calibre (Invicta usa "IM-...")
  var todo = String(texto||'');
  var marca = /invicta|\bIM-[A-Z0-9]/i.test(todo) ? 'Invicta' : /technomarine|\bTM-\d/i.test(todo) ? 'TechnoMarine' : /bulova/i.test(todo) ? 'Bulova' : '';
  if(r.nombre && marca && sinAcentos(r.nombre).indexOf(sinAcentos(marca)) < 0) r.nombre = marca + ' ' + r.nombre;
  return r;
}

function parsearFicha(texto){
  var grupos = [], actual = null;
  function grupo(titulo){ actual = { t: traducir(GRUPOS_ES, titulo), f: [] }; grupos.push(actual); }
  function fila(k, v){
    if(!actual) grupo('Especificaciones');
    k = traducir(ETIQUETAS_ES, k); v = traducirValor(v);
    if(/cristal|crystal/.test(sinAcentos(k))) v = nombreCristal(v);
    if(actual.f.length < MAX_FILAS) actual.f.push([k.slice(0, 60), v.slice(0, 160)]);
  }
  String(texto||'').split(/\r?\n/).forEach(function(linea){
    var partes = linea.split(/\t+/).map(limpiar).filter(function(p){ return p && !RE_RUIDO.test(sinAcentos(p)); });
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
  if(/cuarzo|quartz/.test(s)) return 'Cuarzo';
  return '';
}

// Rellena los campos de siempre con lo que se reconozca de la ficha (devuelve cuantos lleno)
function rellenarCampos(ficha){
  var n = 0, tonoBanda = '', colorEsfera = '';
  function poner(id, v){ var el = document.getElementById(id); if(el && v){ el.value = v; n++; } }
  ficha.forEach(function(g){
    var tg = sinAcentos(g.t), esBanda = /banda|correa|brazalete|pulsera|band|strap|bracelet/.test(tg);
    g.f.forEach(function(r){
      var k = sinAcentos(r[0]), v = r[1];
      if(/tamano de la caja|diametro|case size|case diameter/.test(k)){ var mm = parseFloat(String(v).replace(',', '.')); if(mm) poner('inv-mm', String(mm)); }
      else if(/calibre|caliber/.test(k)) poner('inv-calibre', v);
      else if(/corona|crown/.test(k)) poner('inv-corona', v);
      else if(/material del bisel|bezel material/.test(k)) poner('inv-material-bisel', v);
      else if(/color del bisel|bezel color/.test(k)) poner('inv-color-bisel', v);
      else if(/material de la esfera|dial material/.test(k)) poner('inv-material-esfera', v);
      else if(esBanda && /^(tamano|ancho|width)/.test(k)) poner('inv-ancho-correa', v);
      else if(esBanda && /^(longitud|largo|length)/.test(k)) poner('inv-largo-correa', v);
      else if(esBanda && /^(tono|color)/.test(k)){ poner('inv-color-correa', v); tonoBanda = v; }
      else if(/material de la caja|case material/.test(k)) poner('inv-material-caja', v);
      else if(/color de la esfera|color de esfera|dial color/.test(k)) { poner('inv-color-esfera', v); colorEsfera = v; }
      else if(/cristal|crystal/.test(k)) poner('inv-cristal', v);
      else if(/resistencia al agua|water resist/.test(k)) poner('inv-agua', v);
      else if(esBanda && /^material/.test(k)) poner('inv-material-correa', v);
      else if(/movimiento|movement/.test(k)) poner('inv-movimiento', opcionMovimiento(v));
    });
  });
  // Color / variante: si esta vacio se arma con el tono de la correa y el color de la esfera (ej. "Dorado / Negro")
  var col = document.getElementById('inv-color');
  if(col && !col.value.trim() && (tonoBanda || colorEsfera)) poner('inv-color', [tonoBanda, colorEsfera].filter(Boolean).join(' / '));
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
  // encabezado (nombre, modelo, coleccion, genero): solo llena lo que este vacio
  var cab = datosCabecera(ta.value);
  [['inv-nombre', cab.nombre], ['inv-sku', cab.sku], ['inv-coleccion', cab.coleccion]].forEach(function(x){
    var el = document.getElementById(x[0]); if(el && x[1] && !el.value.trim()){ el.value = x[1]; n++; }
  });
  if(cab.genero){ var g = document.getElementById('inv-genero'); if(g){ g.value = cab.genero; n++; } }
  ta.value = fichaATexto(ficha);
  pintarVista(ficha, 'Listo: ' + ficha.reduce(function(s, g){ return s + g.f.length; }, 0) + ' datos en ' + ficha.length + ' grupos' + (n ? ', ' + n + ' campos rellenados.' : '.'));
}

// Para el formulario: leer, cargar y limpiar
function fichaFormulario(){ var ta = document.getElementById('inv-ficha'); return ta ? parsearFicha(ta.value) : []; }
function cargarFicha(ficha){
  var ta = document.getElementById('inv-ficha'); if(ta) ta.value = fichaATexto(ficha);
  pintarVista(Array.isArray(ficha) ? ficha : [], '');
}

export { cargarFicha, datosCabecera, fichaATexto, fichaFormulario, ordenarFicha, parsearFicha };
// Usada desde el onclick del boton en index.html
Object.assign(window, { ordenarFicha });
