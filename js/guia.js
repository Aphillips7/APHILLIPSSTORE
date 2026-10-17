// =================== GUIA DE TAMANOS (guia-de-tamanos.html) ===================
// Dibuja en SVG: las medidas del reloj, la comparacion de tamanos a escala, los pasos para medir la muñeca
// y los grosores; maneja el probador (muñeca + tamaño del reloj, a escala) y lista los relojes de la tienda
// por tamaño. Script normal (no modulo): la pagina no depende del resto del catalogo.
(function(){
  var API = 'https://api.aphillipsstore.com/catalogo';
  var ORO = '#9a7b4f';        // color de las lineas de medida
  var $ = function(id){ return document.getElementById(id); };
  function esc(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function n(v){ return Math.round(v * 10) / 10; }
  $('lg-anio').textContent = new Date().getFullYear();

  // ---------- un reloj visto de frente (esfera negra, bisel, indices, agujas a las 10:10) ----------
  // d = diametro en px; l2l = de asa a asa en px; correa = ancho entre asas en px; corona a la derecha
  function reloj(cx, cy, d, opc){
    opc = opc || {};
    var r = d / 2, l2l = opc.l2l || d * 1.2, correa = opc.correa || d * 0.5, h = l2l / 2;
    var asaAncho = Math.max(3, d * 0.11), s = '';
    // correa / brazalete que sigue mas alla de las asas
    if(opc.correaLargo){
      s += '<rect x="'+n(cx-correa/2)+'" y="'+n(cy-h-opc.correaLargo)+'" width="'+n(correa)+'" height="'+n(opc.correaLargo+2)+'" fill="url(#gu-correa)"/>';
      s += '<rect x="'+n(cx-correa/2)+'" y="'+n(cy+h-2)+'" width="'+n(correa)+'" height="'+n(opc.correaLargo+2)+'" fill="url(#gu-correa2)"/>';
    }
    // asas (4)
    [-1, 1].forEach(function(lado){ [-1, 1].forEach(function(arr){
      var x = lado < 0 ? cx - correa/2 - asaAncho : cx + correa/2;
      var y = arr < 0 ? cy - h : cy + r * 0.55;
      s += '<rect x="'+n(x)+'" y="'+n(y)+'" width="'+n(asaAncho)+'" height="'+n(h - r*0.55)+'" rx="'+n(asaAncho*0.35)+'" fill="#d4d4d8" stroke="#a1a1aa" stroke-width="'+n(Math.max(.6, d*.006))+'"/>';
    }); });
    // corona
    s += '<rect x="'+n(cx + r - 1)+'" y="'+n(cy - d*0.055)+'" width="'+n(d*0.08)+'" height="'+n(d*0.11)+'" rx="'+n(d*0.015)+'" fill="#c4c4c8" stroke="#a1a1aa" stroke-width=".8"/>';
    // caja, bisel y esfera
    s += '<circle cx="'+cx+'" cy="'+cy+'" r="'+n(r)+'" fill="#e4e4e7" stroke="#a1a1aa" stroke-width="'+n(Math.max(.8, d*.008))+'"/>';
    s += '<circle cx="'+cx+'" cy="'+cy+'" r="'+n(r*0.9)+'" fill="#18181b"/>';
    s += '<circle cx="'+cx+'" cy="'+cy+'" r="'+n(r*0.72)+'" fill="#0b0b0c" stroke="#3f3f46" stroke-width="'+n(Math.max(.4, d*.004))+'"/>';
    // indices
    for(var i = 0; i < 12; i++){
      var a = i * Math.PI / 6, largo = i % 3 === 0 ? r*0.16 : r*0.1, ancho = i % 3 === 0 ? d*0.022 : d*0.014;
      var x1 = cx + Math.sin(a) * r*0.66, y1 = cy - Math.cos(a) * r*0.66, x2 = cx + Math.sin(a) * (r*0.66 - largo), y2 = cy - Math.cos(a) * (r*0.66 - largo);
      s += '<line x1="'+n(x1)+'" y1="'+n(y1)+'" x2="'+n(x2)+'" y2="'+n(y2)+'" stroke="#f4f4f5" stroke-width="'+n(ancho)+'" stroke-linecap="round"/>';
    }
    // bisel graduado (marcas cortas)
    for(var j = 0; j < 60; j += 5){
      var b = j * Math.PI / 30;
      s += '<line x1="'+n(cx+Math.sin(b)*r*0.88)+'" y1="'+n(cy-Math.cos(b)*r*0.88)+'" x2="'+n(cx+Math.sin(b)*r*0.8)+'" y2="'+n(cy-Math.cos(b)*r*0.8)+'" stroke="#a1a1aa" stroke-width="'+n(Math.max(.5, d*.008))+'"/>';
    }
    // agujas 10:10
    var hora = -60 * Math.PI / 180, min = 60 * Math.PI / 180;
    s += '<line x1="'+cx+'" y1="'+cy+'" x2="'+n(cx+Math.sin(hora)*r*0.4)+'" y2="'+n(cy-Math.cos(hora)*r*0.4)+'" stroke="#f4f4f5" stroke-width="'+n(d*0.035)+'" stroke-linecap="round"/>';
    s += '<line x1="'+cx+'" y1="'+cy+'" x2="'+n(cx+Math.sin(min)*r*0.58)+'" y2="'+n(cy-Math.cos(min)*r*0.58)+'" stroke="#f4f4f5" stroke-width="'+n(d*0.025)+'" stroke-linecap="round"/>';
    s += '<line x1="'+n(cx-Math.sin(.6)*r*0.15)+'" y1="'+n(cy+Math.cos(.6)*r*0.15)+'" x2="'+n(cx+Math.sin(.6)*r*0.62)+'" y2="'+n(cy-Math.cos(.6)*r*0.62)+'" stroke="'+ORO+'" stroke-width="'+n(Math.max(.5, d*0.01))+'"/>';
    s += '<circle cx="'+cx+'" cy="'+cy+'" r="'+n(d*0.025)+'" fill="#f4f4f5"/>';
    return s;
  }
  var DEFS = '<defs>' +
    '<linearGradient id="gu-correa" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#3f3f46"/><stop offset="1" stop-color="#3f3f46" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="gu-correa2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f3f46"/><stop offset="1" stop-color="#3f3f46" stop-opacity="0"/></linearGradient>' +
    '<marker id="gu-flecha" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L9 5L0 9" fill="none" stroke="'+ORO+'" stroke-width="1.6"/></marker>' +
    '</defs>';
  function cota(x1, y1, x2, y2){ return '<line x1="'+n(x1)+'" y1="'+n(y1)+'" x2="'+n(x2)+'" y2="'+n(y2)+'" stroke="'+ORO+'" stroke-width="1.4" marker-start="url(#gu-flecha)" marker-end="url(#gu-flecha)"/>'; }
  function guia(x1, y1, x2, y2){ return '<line x1="'+n(x1)+'" y1="'+n(y1)+'" x2="'+n(x2)+'" y2="'+n(y2)+'" stroke="'+ORO+'" stroke-width="1" stroke-dasharray="3 3" opacity=".7"/>'; }
  function letra(x, y, t){ return '<circle cx="'+x+'" cy="'+y+'" r="11" fill="'+ORO+'"/><text x="'+x+'" y="'+(y+4)+'" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">'+t+'</text>'; }
  function texto(x, y, t, opc){ opc = opc || {}; return '<text x="'+n(x)+'" y="'+n(y)+'" text-anchor="'+(opc.ancla||'middle')+'" font-size="'+(opc.tam||13)+'" font-weight="'+(opc.peso||500)+'" fill="'+(opc.color||'#18181b')+'">'+t+'</text>'; }
  function svg(vb, cuerpo){ return '<svg viewBox="'+vb+'" xmlns="http://www.w3.org/2000/svg" font-family="Jost, Arial, sans-serif">'+DEFS+cuerpo+'</svg>'; }

  // ---------- A, B, C: las medidas (reloj de 42 mm a 4 px por mm) ----------
  (function(){
    var S = 4, d = 42*S, l2l = 50*S, correa = 22*S, cx = 230, cy = 200, r = d/2, h = l2l/2, c = '';
    c += reloj(cx, cy, d, { l2l: l2l, correa: correa, correaLargo: 34 });
    // A diametro (abajo)
    c += guia(cx-r, cy, cx-r, cy+h+48) + guia(cx+r, cy, cx+r, cy+h+48);
    c += cota(cx-r, cy+h+42, cx+r, cy+h+42) + letra(cx-r-22, cy+h+42, 'A') + texto(cx, cy+h+64, 'Diámetro: 42 mm', { peso: 600 });
    // B de asa a asa (derecha)
    var xb = cx + r + 64;
    c += guia(cx+correa/2+10, cy-h, xb+6, cy-h) + guia(cx+correa/2+10, cy+h, xb+6, cy+h);
    c += cota(xb, cy-h, xb, cy+h) + letra(xb, cy-h-20, 'B') + texto(xb+16, cy-6, 'De asa', { ancla: 'start', peso: 600 }) + texto(xb+16, cy+12, 'a asa: 50 mm', { ancla: 'start', peso: 600 });
    // C ancho de correa (arriba)
    var yc = cy - h - 46;
    c += guia(cx-correa/2, cy-h+8, cx-correa/2, yc-6) + guia(cx+correa/2, cy-h+8, cx+correa/2, yc-6);
    c += cota(cx-correa/2, yc, cx+correa/2, yc) + letra(cx-correa/2-24, yc, 'C') + texto(cx, yc-12, 'Correa: 22 mm', { peso: 600 });
    $('gu-anatomia').innerHTML = svg('0 0 560 430', c);
  })();

  // ---------- D: grosor (vista de lado, 12 mm a 5 px por mm) ----------
  function perfil(x, base, ancho, alto, conCota){
    var c = '', cristal = Math.max(2, alto*0.12);
    c += '<path d="M'+n(x-ancho*0.12)+' '+n(base-alto*0.55)+' L'+n(x)+' '+n(base-alto*0.62)+' M'+n(x+ancho)+' '+n(base-alto*0.62)+' L'+n(x+ancho*1.12)+' '+n(base-alto*0.55)+'" stroke="#a1a1aa" stroke-width="'+n(Math.max(2, alto*0.12))+'" stroke-linecap="round" fill="none"/>';
    c += '<rect x="'+n(x)+'" y="'+n(base-alto+cristal)+'" width="'+n(ancho)+'" height="'+n(alto-cristal-alto*0.12)+'" rx="'+n(alto*0.12)+'" fill="#e4e4e7" stroke="#a1a1aa"/>';
    c += '<rect x="'+n(x+ancho*0.08)+'" y="'+n(base-alto*0.14)+'" width="'+n(ancho*0.84)+'" height="'+n(alto*0.14)+'" rx="'+n(alto*0.05)+'" fill="#d4d4d8" stroke="#a1a1aa"/>';
    c += '<path d="M'+n(x+ancho*0.06)+' '+n(base-alto+cristal)+' Q'+n(x+ancho/2)+' '+n(base-alto-cristal*0.4)+' '+n(x+ancho*0.94)+' '+n(base-alto+cristal)+' Z" fill="#cfe3f0" stroke="#94b8cc"/>';
    c += '<rect x="'+n(x+ancho)+'" y="'+n(base-alto*0.62)+'" width="'+n(Math.max(3, ancho*0.05))+'" height="'+n(alto*0.32)+'" rx="1.5" fill="#c4c4c8" stroke="#a1a1aa"/>';
    if(conCota){ var xr = x + ancho + 40; c += guia(x+ancho*0.5, base-alto, xr+6, base-alto) + guia(x+ancho, base, xr+6, base) + cota(xr, base-alto, xr, base) + letra(xr+28, base-alto/2-14, 'D') + texto(xr+16, base-alto/2+16, 'Grosor: 12 mm', { ancla: 'start', peso: 600 }); }
    return c;
  }
  $('gu-perfil').innerHTML = svg('0 0 420 150', perfil(40, 110, 42*5, 12*5, true) + texto(145, 140, 'Vista de lado', { tam: 12, color: '#71717a' }));

  // ---------- comparar tamanos a escala (2,4 px por mm) con moneda de 25 centavos ----------
  (function(){
    var S = 2.4, medidas = [34, 36, 38, 40, 42, 44, 46, 48], x = 20, c = '', base = 160;
    var mon = 24.26 * S;
    c += '<circle cx="'+n(x+mon/2)+'" cy="'+base+'" r="'+n(mon/2)+'" fill="#d4d4d8" stroke="#a1a1aa"/><circle cx="'+n(x+mon/2)+'" cy="'+base+'" r="'+n(mon/2-4)+'" fill="none" stroke="#a1a1aa" stroke-dasharray="1.5 2"/>';
    c += texto(x+mon/2, base+4, '25¢', { tam: 12, peso: 600, color: '#52525b' }) + texto(x+mon/2, 250, 'Moneda', { tam: 12, color: '#71717a' }) + texto(x+mon/2, 266, '24 mm', { tam: 12, color: '#71717a' });
    x += mon + 26;
    medidas.forEach(function(mm){
      var d = mm * S; c += reloj(x + d/2, base, d, { correaLargo: 14 });
      c += texto(x + d/2, 250, mm + ' mm', { peso: 600 });
      c += texto(x + d/2, 266, mm <= 38 ? 'pequeño' : mm <= 42 ? 'mediano' : 'grande', { tam: 12, color: '#71717a' });
      x += d + 22;
    });
    $('gu-comparar').innerHTML = svg('0 0 '+Math.ceil(x)+' 280', c);
  })();

  // ---------- grosores (de lado, 5 px por mm) ----------
  (function(){
    var c = '', x = 20;
    [[8, 'Delgado'], [11, 'Normal'], [14, 'Deportivo'], [17, 'Grueso']].forEach(function(g){
      c += perfil(x, 120, 40*4, g[0]*5, false) + texto(x + 80, 150, g[0] + ' mm', { peso: 600 }) + texto(x + 80, 167, g[1], { tam: 12, color: '#71717a' });
      x += 210;
    });
    $('gu-grosores').innerHTML = svg('0 0 '+x+' 180', c);
  })();

  // ---------- pasos para medir la muneca ----------
  (function(){
    var piel = '#e9c9b0', borde = '#c9a083';
    var brazo = '<path d="M10 70 C60 62 120 60 170 66 L178 72 C200 60 224 62 232 80 C238 96 224 112 200 108 L178 104 C120 112 60 112 10 104 Z" fill="'+piel+'" stroke="'+borde+'" stroke-width="1.5"/>';
    var p1 = brazo + '<rect x="128" y="58" width="16" height="58" rx="3" fill="#fff" stroke="#71717a" stroke-width="1.5"/><path d="M144 66 L176 40" stroke="#71717a" stroke-width="10" stroke-linecap="round" opacity=".25"/><path d="M144 66 L176 40" stroke="#fff" stroke-width="8" stroke-linecap="round"/>' + texto(120, 140, 'Tira alrededor de la muñeca', { tam: 12, color: '#52525b' });
    var p2 = brazo + '<rect x="128" y="58" width="16" height="58" rx="3" fill="#fff" stroke="#71717a" stroke-width="1.5"/><line x1="128" y1="86" x2="144" y2="86" stroke="'+ORO+'" stroke-width="2.5"/><path d="M150 84 L196 38 L204 46 L158 92 Z" fill="#f2c94c" stroke="#a1a1aa"/><path d="M150 84 L146 96 L158 92" fill="#3f3f46"/>' + texto(120, 140, 'Marca donde se junta', { tam: 12, color: '#52525b' });
    var regla = '<rect x="14" y="70" width="212" height="34" rx="3" fill="#f4f4f5" stroke="#a1a1aa"/>';
    for(var i = 0; i <= 20; i++){ var xx = 22 + i * 10; regla += '<line x1="'+xx+'" y1="70" x2="'+xx+'" y2="'+(i % 5 === 0 ? 84 : 78)+'" stroke="#52525b"/>' + (i % 5 === 0 ? texto(xx, 98, String(i), { tam: 9, color: '#52525b' }) : ''); }
    var p3 = regla + '<rect x="22" y="52" width="170" height="12" rx="2" fill="#fff" stroke="#71717a"/><line x1="192" y1="46" x2="192" y2="104" stroke="'+ORO+'" stroke-width="2.5"/>' + cota(22, 40, 192, 40) + texto(107, 32, '17 cm', { tam: 13, peso: 700, color: ORO }) + texto(120, 140, 'Mide hasta la marca', { tam: 12, color: '#52525b' });
    $('gu-paso1').innerHTML = svg('0 0 240 150', p1);
    $('gu-paso2').innerHTML = svg('0 0 240 150', p2);
    $('gu-paso3').innerHTML = svg('0 0 240 150', p3);
  })();

  // ---------- probador: muneca + reloj a escala ----------
  var _catalogo = [];
  function recomendado(cm){ return cm < 15 ? [34, 38] : cm < 16.5 ? [36, 40] : cm < 18 ? [39, 42] : cm < 19.5 ? [41, 44] : [43, 46]; }
  function pintarProbador(){
    var cm = parseFloat($('gu-muneca').value), mm = parseFloat($('gu-reloj').value);
    $('gu-v-muneca').textContent = String(cm).replace('.', ',') + ' cm';
    $('gu-v-reloj').textContent = mm + ' mm';
    var S = 4.2, ancho = cm * 10 * 0.3 * S, l2l = mm * 1.2 * S, d = mm * S, cy = 175, cx = 300, c = '';
    var piel = '#e9c9b0', borde = '#c9a083', yTop = cy - ancho/2, yBot = cy + ancho/2;
    // antebrazo (mas ancho hacia la izquierda), muneca y mano
    c += '<path d="M-10 '+n(cy-ancho*0.68)+' C150 '+n(cy-ancho*0.62)+' 300 '+n(yTop)+' 470 '+n(yTop+2)+' C520 '+n(yTop-6)+' 560 '+n(cy-ancho*0.7)+' 610 '+n(cy-ancho*0.66)+' C650 '+n(cy-ancho*0.62)+' 660 '+n(cy+ancho*0.62)+' 610 '+n(cy+ancho*0.68)+' C560 '+n(cy+ancho*0.72)+' 520 '+n(yBot+6)+' 470 '+n(yBot-2)+' C300 '+n(yBot)+' 150 '+n(cy+ancho*0.62)+' -10 '+n(cy+ancho*0.68)+' Z" fill="'+piel+'" stroke="'+borde+'" stroke-width="1.5"/>';
    // borde de la muneca donde va el reloj (lineas punteadas)
    c += '<line x1="'+(cx-70)+'" y1="'+n(yTop)+'" x2="'+(cx+70)+'" y2="'+n(yTop)+'" stroke="'+borde+'" stroke-dasharray="4 4"/><line x1="'+(cx-70)+'" y1="'+n(yBot)+'" x2="'+(cx+70)+'" y2="'+n(yBot)+'" stroke="'+borde+'" stroke-dasharray="4 4"/>';
    var sobra = l2l > ancho;
    c += reloj(cx, cy, d, { l2l: l2l, correa: d * 0.5, correaLargo: Math.max(0, (ancho - l2l) / 2) });
    if(sobra){
      c += '<line x1="'+(cx-d*0.6)+'" y1="'+n(yTop)+'" x2="'+(cx+d*0.6)+'" y2="'+n(yTop)+'" stroke="#d92d20" stroke-width="2"/><line x1="'+(cx-d*0.6)+'" y1="'+n(yBot)+'" x2="'+(cx+d*0.6)+'" y2="'+n(yBot)+'" stroke="#d92d20" stroke-width="2"/>';
    }
    // cotas
    var xa = 120;
    c += cota(xa, yTop, xa, yBot) + texto(xa - 10, cy + 4, 'Muñeca ' + Math.round(cm * 3) + ' mm', { ancla: 'end', tam: 12, peso: 600, color: ORO });
    var xr = cx + d/2 + 40;
    c += cota(xr, cy - l2l/2, xr, cy + l2l/2) + texto(xr + 8, cy + 4, 'Reloj ' + Math.round(mm * 1.2) + ' mm', { ancla: 'start', tam: 12, peso: 600, color: ORO });
    $('gu-sim').innerHTML = svg('0 0 660 350', c);

    var razon = (mm * 1.2) / (cm * 3), rec = recomendado(cm), v;
    if(razon < 0.82) v = ['discreto', 'Discreto', 'Se ve pequeño y elegante en tu muñeca. Ideal si buscas algo clásico o de vestir.'];
    else if(razon <= 1) v = ['ideal', 'Ideal', 'Las asas quedan dentro de tu muñeca: es un tamaño proporcionado para ti.'];
    else if(razon <= 1.1) v = ['grande', 'Grande', 'Se va a notar. Queda bien si te gustan los relojes con presencia, pero las asas llegan al borde de tu muñeca.'];
    else v = ['muy-grande', 'Muy grande', 'Las asas sobresalen de tu muñeca (línea roja). Te recomendamos un tamaño menor.'];
    $('gu-veredicto').innerHTML = '<span class="gu-pill '+v[0]+'">'+v[1]+'</span><p>'+v[2]+'</p><p class="gu-rec">Para tu muñeca de '+String(cm).replace('.', ',')+' cm te recomendamos relojes de <b>'+rec[0]+' a '+rec[1]+' mm</b>.</p>';
    pintarSugeridos(rec);
    try{ localStorage.setItem('aphillips_muneca', String(cm)); }catch(e){}
  }
  function tarjeta(r){
    var foto = typeof r.foto === 'string' && r.foto ? '<img src="'+esc(r.foto)+'" alt="" loading="lazy" decoding="async">' : '';
    var precio = r.estado === 'bajopedido' ? 'Bajo cotización' : r.precio ? '$' + Number(r.precio).toLocaleString() : '';
    return '<a class="gu-reloj" href="/?id='+encodeURIComponent(r.id)+'"><span class="gu-reloj-foto">'+foto+'<span class="gu-mm">'+esc(parseFloat(r.mm))+' mm</span></span><span class="gu-reloj-nombre">'+esc(r.nombre)+'</span>'+(precio ? '<span class="gu-reloj-precio">'+esc(precio)+'</span>' : '')+'</a>';
  }
  function pintarSugeridos(rec){
    var cont = $('gu-sugeridos'); if(!_catalogo.length){ cont.innerHTML = ''; return; }
    var lista = _catalogo.filter(function(r){ var mm = parseFloat(r.mm); return mm >= rec[0] && mm <= rec[1] && r.estado !== 'vendido'; });
    cont.innerHTML = lista.length ? '<h3>Relojes de la tienda en tu tamaño</h3><div class="gu-fila">' + lista.slice(0, 8).map(tarjeta).join('') + '</div>' : '';
  }
  function pintarTienda(){
    var grupos = [['Hasta 38 mm', 0, 38.9], ['39 a 42 mm', 39, 42.9], ['43 a 45 mm', 43, 45.9], ['46 mm o más', 46, 99]];
    var h = grupos.map(function(g){
      var l = _catalogo.filter(function(r){ var mm = parseFloat(r.mm); return mm >= g[1] && mm <= g[2]; });
      return l.length ? '<h3>'+g[0]+' <span>('+l.length+')</span></h3><div class="gu-fila">' + l.map(tarjeta).join('') + '</div>' : '';
    }).join('');
    $('gu-tienda').innerHTML = h || '<p class="gu-tip">Pronto agregaremos más relojes.</p>';
  }

  // valores iniciales: ?mm= (desde la ficha de un reloj) y la muneca guardada
  var q = new URLSearchParams(location.search), mmIni = parseFloat(q.get('mm'));
  if(mmIni >= 28 && mmIni <= 50) $('gu-reloj').value = Math.round(mmIni);
  try{ var m = parseFloat(localStorage.getItem('aphillips_muneca')); if(m >= 13 && m <= 22) $('gu-muneca').value = m; }catch(e){}
  $('gu-muneca').addEventListener('input', pintarProbador);
  $('gu-reloj').addEventListener('input', pintarProbador);
  pintarProbador();

  fetch(API).then(function(r){ return r.json(); }).then(function(d){
    _catalogo = (d.relojes || []).filter(function(r){ return parseFloat(r.mm) > 0; }).sort(function(a, b){ return parseFloat(a.mm) - parseFloat(b.mm); });
    pintarTienda(); pintarProbador();
  }).catch(function(){ $('gu-tienda').innerHTML = '<p class="gu-tip">No se pudieron cargar los relojes. <a href="/">Ver la tienda</a></p>'; });

  // mensaje listo para WhatsApp con la medida elegida
  $('gu-wa').addEventListener('click', function(){
    var cm = $('gu-muneca').value;
    this.href = 'https://wa.me/50762615442?text=' + encodeURIComponent('¡Hola! Mi muñeca mide ' + String(cm).replace('.', ',') + ' cm. ¿Qué tamaño de reloj me recomiendan?');
  });
})();
