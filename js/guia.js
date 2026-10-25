// =================== GUIA DE TAMANOS (guia-de-tamanos.html) ===================
// Dibuja en SVG: las medidas del reloj, la comparacion de tamanos a escala, los pasos para medir la muñeca
// y los grosores; maneja el probador (muñeca + tamaño del reloj, a escala) y lista los relojes de la tienda
// por tamaño. Script normal (no modulo): la pagina no depende del resto del catalogo.
(function(){
  var API = 'https://api.aphillipsstore.com/catalogo';
  var ORO = '#18181b';        // color de las lineas de medida (negro de la tienda)
  var $ = function(id){ return document.getElementById(id); };
  function esc(t){ return String(t == null ? '' : t).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
  function n(v){ return Math.round(v * 10) / 10; }
  $('lg-anio').textContent = new Date().getFullYear();

  // ---------- un reloj visto de frente (esfera negra, bisel, indices, agujas a las 10:10) ----------
  // d = diametro en px; l2l = de asa a asa en px; correa = ancho entre asas en px; corona a la derecha
  // Cronografo de acero: bisel taquimetrico, corona con estrias y dos pulsadores, esfera clara con
  // XII, indices de barra, riel de minutos, 3 subesferas, ventana de fecha, agujas de espada y
  // correa de cuero con costuras. Con poco tamano (comparacion) se omiten los textos finos.
  var _idReloj = 0;
  function pol(cx, cy, rad, ang){ return [cx + Math.sin(ang) * rad, cy - Math.cos(ang) * rad]; }
  function reloj(cx, cy, d, opc){
    opc = opc || {};
    var r = d / 2, l2l = opc.l2l || d * 1.2, correa = opc.correa || d * 0.5, h = l2l / 2;
    var det = d >= 120 ? 2 : d >= 60 ? 1 : 0;        // nivel de detalle
    var sw = function(f){ return n(Math.max(.4, d * f)); };
    var id = 'gr' + (++_idReloj), s = '', i, a, p, q;

    // ---- correa de cuero (arriba y abajo), se desvanece en las puntas ----
    // (empieza debajo de la caja, entre las asas, y sigue opc.correaLargo mas alla de ellas)
    if(opc.correaLargo !== undefined){
      [-1, 1].forEach(function(lado){
        var ancho = correa * 0.94, x = cx - ancho / 2, m = correa * 0.11, ext = 0;
        function tramo(y, alto){
          var t = '<rect x="'+n(x)+'" y="'+n(y)+'" width="'+n(ancho)+'" height="'+n(alto)+'" rx="'+n(correa*0.06)+'" fill="url(#gu-cuero)"/>';
          if(det) [x + m, x + ancho - m].forEach(function(xs){
            t += '<line x1="'+n(xs)+'" y1="'+n(y)+'" x2="'+n(xs)+'" y2="'+n(y+alto)+'" stroke="#a1a1aa" stroke-width="'+sw(.006)+'" stroke-dasharray="'+n(d*.018)+' '+n(d*.012)+'" opacity=".8"/>';
          });
          return t;
        }
        // tramo entre las asas (sale de debajo de la caja), solido
        s += tramo(lado < 0 ? cy - h : cy + r * 0.8, h - r * 0.8 + 1);
        if(!opc.correaLargo) return;
        // tramo que sigue mas alla de las asas, se desvanece
        var y = lado < 0 ? cy - h - opc.correaLargo : cy + h - 1, alto = opc.correaLargo + 1;
        s += '<g mask="url(#gu-desv-' + (lado < 0 ? 'arr' : 'aba') + ')">' + tramo(y, alto);
        if(det){
          if(lado > 0 && opc.correaLargo > d * 0.5){
            // pasador y agujeros en la parte de abajo
            s += '<rect x="'+n(x-correa*0.03)+'" y="'+n(y+ext+d*0.12)+'" width="'+n(ancho+correa*0.06)+'" height="'+n(d*0.05)+'" rx="'+n(d*0.012)+'" fill="#27272a" stroke="#0b0b0c" stroke-width="'+sw(.004)+'"/>';
            for(i = 0; i < 4; i++){ var yy = y + ext + d*0.3 + i * d*0.085; if(yy < y + alto - d*0.05) s += '<ellipse cx="'+n(cx)+'" cy="'+n(yy)+'" rx="'+n(d*0.016)+'" ry="'+n(d*0.022)+'" fill="#0b0b0c"/>'; }
          }
        }
        s += '</g>';
      });
    }

    // ---- asas (4), con forma: anchas en la caja y redondeadas en la punta ----
    var asa = Math.max(3, d * 0.1);
    [-1, 1].forEach(function(lado){ [-1, 1].forEach(function(arr){
      var xi = lado < 0 ? cx - correa/2 - asa : cx + correa/2, xe = xi + asa;
      var y0 = cy + arr * r * 0.62, y1 = cy + arr * h;
      var ext = lado < 0 ? xi : xe;                      // borde exterior (se abre hacia la caja)
      var abre = lado < 0 ? -d*0.035 : d*0.035;
      s += '<path d="M'+n(xi)+' '+n(y1)+' Q'+n((xi+xe)/2)+' '+n(y1+arr*asa*0.25)+' '+n(xe)+' '+n(y1)+' L'+n(lado<0?xe:xe+abre)+' '+n(y0)+' L'+n(lado<0?xi+abre:xi)+' '+n(y0)+' Z" fill="url(#gu-acero)" stroke="#8e8e95" stroke-width="'+sw(.006)+'"/>';
      if(det) s += '<line x1="'+n((xi+xe)/2)+'" y1="'+n(y1 - arr*asa*0.2)+'" x2="'+n((xi+xe)/2 + (lado<0?abre*0.5:abre*0.5))+'" y2="'+n(y0)+'" stroke="#fff" stroke-width="'+sw(.005)+'" opacity=".7"/>';
      void ext;
    }); });

    // ---- pulsadores (a las 2 y a las 4) y corona con estrias (a las 3) ----
    [-1, 1].forEach(function(k){
      var ang = Math.PI/2 + k * 0.62;
      p = pol(cx, cy, r * 0.98, ang);
      s += '<g transform="translate('+n(p[0])+' '+n(p[1])+') rotate('+n(ang*180/Math.PI - 90)+')">' +
        '<rect x="0" y="'+n(-d*0.035)+'" width="'+n(d*0.07)+'" height="'+n(d*0.07)+'" rx="'+n(d*0.008)+'" fill="url(#gu-acero)" stroke="#8e8e95" stroke-width="'+sw(.005)+'"/>' +
        '<rect x="'+n(d*0.07)+'" y="'+n(-d*0.045)+'" width="'+n(d*0.035)+'" height="'+n(d*0.09)+'" rx="'+n(d*0.01)+'" fill="url(#gu-acero)" stroke="#8e8e95" stroke-width="'+sw(.005)+'"/></g>';
    });
    s += '<rect x="'+n(cx + r*0.95)+'" y="'+n(cy - d*0.075)+'" width="'+n(d*0.09)+'" height="'+n(d*0.15)+'" rx="'+n(d*0.018)+'" fill="url(#gu-acero)" stroke="#8e8e95" stroke-width="'+sw(.005)+'"/>';
    if(det) for(i = 1; i < 7; i++){ var yc = cy - d*0.075 + i * d*0.15/7; s += '<line x1="'+n(cx + r*0.95 + d*0.01)+'" y1="'+n(yc)+'" x2="'+n(cx + r*0.95 + d*0.085)+'" y2="'+n(yc)+'" stroke="#8e8e95" stroke-width="'+sw(.004)+'"/>'; }

    // ---- caja y bisel taquimetrico ----
    s += '<circle cx="'+cx+'" cy="'+cy+'" r="'+n(r)+'" fill="url(#gu-acero-r)" stroke="#8e8e95" stroke-width="'+sw(.008)+'"/>';
    s += '<circle cx="'+cx+'" cy="'+cy+'" r="'+n(r*0.93)+'" fill="#f4f4f5" stroke="#a1a1aa" stroke-width="'+sw(.004)+'"/>';
    if(det){
      for(i = 0; i < 60; i++){ a = i * Math.PI / 30; p = pol(cx, cy, r*0.93, a); q = pol(cx, cy, r*(i % 5 ? 0.9 : 0.885), a);
        s += '<line x1="'+n(p[0])+'" y1="'+n(p[1])+'" x2="'+n(q[0])+'" y2="'+n(q[1])+'" stroke="#27272a" stroke-width="'+sw(i % 5 ? .003 : .005)+'"/>'; }
    }
    if(det === 2){
      [60,65,70,75,80,85,90,95,100,110,120,130,150,180,200,250,300,400].forEach(function(v){
        a = (3600 / v) / 60 * 2 * Math.PI; p = pol(cx, cy, r*0.835, a);
        s += '<text x="'+n(p[0])+'" y="'+n(p[1])+'" font-size="'+n(d*0.034)+'" font-weight="600" fill="#27272a" text-anchor="middle" dominant-baseline="central" transform="rotate('+n(a*180/Math.PI + (a > Math.PI/2 && a < Math.PI*1.5 ? 180 : 0))+' '+n(p[0])+' '+n(p[1])+')">'+v+'</text>';
      });
      s += '<path id="'+id+'-arco" d="M'+n(cx + Math.sin(0.1)*r*0.835)+' '+n(cy - Math.cos(0.1)*r*0.835)+' A'+n(r*0.835)+' '+n(r*0.835)+' 0 0 1 '+n(cx + Math.sin(0.86)*r*0.835)+' '+n(cy - Math.cos(0.86)*r*0.835)+'" fill="none"/>';
      s += '<text font-size="'+n(d*0.03)+'" font-weight="700" letter-spacing="'+n(d*0.004)+'" fill="#27272a" dominant-baseline="central"><textPath href="#'+id+'-arco" startOffset="50%" text-anchor="middle">TACHYMETER</textPath></text>';
    }
    // aro interior del bisel y esfera clara
    s += '<circle cx="'+cx+'" cy="'+cy+'" r="'+n(r*0.78)+'" fill="#d4d4d8" stroke="#8e8e95" stroke-width="'+sw(.005)+'"/>';
    s += '<circle cx="'+cx+'" cy="'+cy+'" r="'+n(r*0.75)+'" fill="url(#gu-esfera)"/>';
    // riel de minutos
    if(det) for(i = 0; i < 60; i++){ a = i * Math.PI / 30; p = pol(cx, cy, r*0.745, a); q = pol(cx, cy, r*(i % 5 ? 0.715 : 0.7), a);
      s += '<line x1="'+n(p[0])+'" y1="'+n(p[1])+'" x2="'+n(q[0])+'" y2="'+n(q[1])+'" stroke="#3f3f46" stroke-width="'+sw(i % 5 ? .003 : .005)+'"/>'; }
    // indices de barra (dobles, como facetados); XII a las 12; a las 3, 6 y 9 hay subesferas; fecha entre 4 y 5
    for(i = 1; i < 12; i++){
      if(i === 3 || i === 6 || i === 9) continue;
      a = i * Math.PI / 6; p = pol(cx, cy, r*0.68, a); q = pol(cx, cy, r*0.53, a);
      s += '<line x1="'+n(p[0])+'" y1="'+n(p[1])+'" x2="'+n(q[0])+'" y2="'+n(q[1])+'" stroke="#27272a" stroke-width="'+sw(.03)+'" stroke-linecap="square"/>';
      s += '<line x1="'+n(p[0])+'" y1="'+n(p[1])+'" x2="'+n(q[0])+'" y2="'+n(q[1])+'" stroke="#fafafa" stroke-width="'+sw(.01)+'"/>';
    }
    if(det){
      s += '<text x="'+cx+'" y="'+n(cy - r*0.56)+'" font-family="Georgia, \'Times New Roman\', serif" font-size="'+n(d*0.11)+'" font-weight="700" fill="#27272a" text-anchor="middle" dominant-baseline="central">XII</text>';
    } else {
      p = pol(cx, cy, r*0.68, 0); q = pol(cx, cy, r*0.5, 0);
      s += '<line x1="'+n(p[0])+'" y1="'+n(p[1])+'" x2="'+n(q[0])+'" y2="'+n(q[1])+'" stroke="#27272a" stroke-width="'+sw(.04)+'"/>';
    }
    if(det === 2) s += '<text x="'+cx+'" y="'+n(cy - r*0.33)+'" font-size="'+n(d*0.032)+'" letter-spacing="'+n(d*0.006)+'" fill="#52525b" text-anchor="middle" dominant-baseline="central">AUTOMATIC</text>';
    // ventana de fecha (entre las 4 y las 5)
    p = pol(cx, cy, r*0.5, 2.45);
    s += '<circle cx="'+n(p[0])+'" cy="'+n(p[1])+'" r="'+n(r*0.085)+'" fill="#fff" stroke="#3f3f46" stroke-width="'+sw(.006)+'"/>';
    if(det) s += '<text x="'+n(p[0])+'" y="'+n(p[1])+'" font-size="'+n(d*0.06)+'" font-weight="600" fill="#27272a" text-anchor="middle" dominant-baseline="central">6</text>';

    // ---- subesferas: 30 min (a las 9), segundos (a las 3) y 12 horas (a las 6) ----
    [[-0.36, 0, ['30', '10', '20']], [0.36, 0, null], [0, 0.36, ['3', '6', '9']]].forEach(function(sd, k){
      var sx = cx + sd[0]*r, sy = cy + sd[1]*r, sr = r*0.2;
      s += '<circle cx="'+n(sx)+'" cy="'+n(sy)+'" r="'+n(sr)+'" fill="#e4e4e7" stroke="#52525b" stroke-width="'+sw(.006)+'"/>';
      if(det) for(i = 0; i < 12; i++){ a = i * Math.PI / 6; p = pol(sx, sy, sr*0.95, a); q = pol(sx, sy, sr*(i % 3 ? 0.84 : 0.76), a);
        s += '<line x1="'+n(p[0])+'" y1="'+n(p[1])+'" x2="'+n(q[0])+'" y2="'+n(q[1])+'" stroke="#3f3f46" stroke-width="'+sw(.004)+'"/>'; }
      if(det === 2 && sd[2]){
        // numeros: en la de las 9 -> 30 arriba, 10 a la derecha, 20 a la izquierda; en la de las 6 -> 3, 6, 9
        var pos = k === 0 ? [[0, -0.55], [0.55, 0.05], [-0.55, 0.05]] : [[0.55, 0.02], [0, 0.55], [-0.55, 0.02]];
        pos.forEach(function(pp, j){ s += '<text x="'+n(sx + pp[0]*sr)+'" y="'+n(sy + pp[1]*sr)+'" font-size="'+n(d*0.042)+'" font-weight="700" fill="#27272a" text-anchor="middle" dominant-baseline="central">'+sd[2][j]+'</text>'; });
      }
      var ah = [-1.9, 1.05, -0.5][k]; p = pol(sx, sy, sr*0.8, ah); q = pol(sx, sy, sr*0.2, ah + Math.PI);
      s += '<line x1="'+n(q[0])+'" y1="'+n(q[1])+'" x2="'+n(p[0])+'" y2="'+n(p[1])+'" stroke="#18181b" stroke-width="'+sw(.012)+'" stroke-linecap="round"/>';
      s += '<circle cx="'+n(sx)+'" cy="'+n(sy)+'" r="'+n(sr*0.12)+'" fill="#18181b"/>';
    });

    // ---- agujas de espada (10:08) y segundero central largo ----
    function espada(ang, largo, ancho){
      var pt = pol(cx, cy, largo, ang), b1 = pol(cx, cy, largo*0.18, ang - Math.PI/2*0.0), l = pol(cx, cy, ancho, ang - Math.PI/2), rr = pol(cx, cy, ancho, ang + Math.PI/2);
      var c1 = pol(l[0], l[1], largo*0.8, ang), c2 = pol(rr[0], rr[1], largo*0.8, ang), cola = pol(cx, cy, largo*0.12, ang + Math.PI);
      void b1;
      return '<path d="M'+n(cola[0])+' '+n(cola[1])+' L'+n(l[0])+' '+n(l[1])+' L'+n(c1[0])+' '+n(c1[1])+' L'+n(pt[0])+' '+n(pt[1])+' L'+n(c2[0])+' '+n(c2[1])+' L'+n(rr[0])+' '+n(rr[1])+' Z" fill="#fafafa" stroke="#27272a" stroke-width="'+sw(.007)+'" stroke-linejoin="round"/>';
    }
    s += espada(-1.05, r*0.45, d*0.024) + espada(0.98, r*0.66, d*0.019);
    p = pol(cx, cy, r*0.72, 0); q = pol(cx, cy, r*0.2, Math.PI);
    s += '<line x1="'+n(q[0])+'" y1="'+n(q[1])+'" x2="'+n(p[0])+'" y2="'+n(p[1])+'" stroke="#18181b" stroke-width="'+sw(.008)+'"/>';
    s += '<circle cx="'+n(q[0])+'" cy="'+n(q[1])+'" r="'+n(d*0.016)+'" fill="#18181b"/>';
    s += '<circle cx="'+cx+'" cy="'+cy+'" r="'+n(d*0.022)+'" fill="#18181b"/><circle cx="'+cx+'" cy="'+cy+'" r="'+n(d*0.009)+'" fill="#d4d4d8"/>';
    // reflejo del cristal
    if(det) s += '<path d="M'+n(cx - r*0.62)+' '+n(cy - r*0.28)+' A'+n(r*0.74)+' '+n(r*0.74)+' 0 0 1 '+n(cx + r*0.2)+' '+n(cy - r*0.7)+'" fill="none" stroke="#fff" stroke-width="'+sw(.02)+'" stroke-linecap="round" opacity=".35"/>';
    return s;
  }
  var DEFS = '<defs>' +
    '<linearGradient id="gu-caja" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C9DCE8"/><stop offset=".45" stop-color="#A7C4D6"/><stop offset="1" stop-color="#86A6BA"/></linearGradient>' +
    '<radialGradient id="gu-caja-r" cx=".38" cy=".32" r=".85"><stop offset="0" stop-color="#D6E5EE"/><stop offset=".55" stop-color="#A7C4D6"/><stop offset="1" stop-color="#86A6BA"/></radialGradient>' +
    '<linearGradient id="gu-piel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F1C7A6"/><stop offset=".55" stop-color="#E5B08C"/><stop offset="1" stop-color="#D29772"/></linearGradient>' +
    '<linearGradient id="gu-acero" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8b8be"/><stop offset=".45" stop-color="#f4f4f5"/><stop offset="1" stop-color="#a1a1aa"/></linearGradient>' +
    '<radialGradient id="gu-acero-r" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#fafafa"/><stop offset=".6" stop-color="#d4d4d8"/><stop offset="1" stop-color="#9a9aa1"/></radialGradient>' +
    '<radialGradient id="gu-esfera" cx=".45" cy=".4" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9e9ec"/></radialGradient>' +
    '<linearGradient id="gu-cuero" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#09090b"/><stop offset=".18" stop-color="#27272a"/><stop offset=".5" stop-color="#3f3f46"/><stop offset=".82" stop-color="#27272a"/><stop offset="1" stop-color="#09090b"/></linearGradient>' +
    '<linearGradient id="gu-desv-g-arr" x1="0" y1="1" x2="0" y2="0"><stop offset=".35" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>' +
    '<linearGradient id="gu-desv-g-aba" x1="0" y1="0" x2="0" y2="1"><stop offset=".35" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>' +
    '<mask id="gu-desv-arr" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#gu-desv-g-arr)"/></mask>' +
    '<mask id="gu-desv-aba" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#gu-desv-g-aba)"/></mask>' +
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
    var piel = '#ececee', borde = '#b4b4ba';
    var brazo = '<path d="M10 70 C60 62 120 60 170 66 L178 72 C200 60 224 62 232 80 C238 96 224 112 200 108 L178 104 C120 112 60 112 10 104 Z" fill="'+piel+'" stroke="'+borde+'" stroke-width="1.5"/>';
    var p1 = brazo + '<rect x="128" y="58" width="16" height="58" rx="3" fill="#fff" stroke="#71717a" stroke-width="1.5"/><path d="M144 66 L176 40" stroke="#71717a" stroke-width="10" stroke-linecap="round" opacity=".25"/><path d="M144 66 L176 40" stroke="#fff" stroke-width="8" stroke-linecap="round"/>' + texto(120, 140, 'Tira alrededor de la muñeca', { tam: 12, color: '#52525b' });
    var p2 = brazo + '<rect x="128" y="58" width="16" height="58" rx="3" fill="#fff" stroke="#71717a" stroke-width="1.5"/><line x1="128" y1="86" x2="144" y2="86" stroke="'+ORO+'" stroke-width="2.5"/><path d="M150 84 L196 38 L204 46 L158 92 Z" fill="#d4d4d8" stroke="#a1a1aa"/><path d="M150 84 L146 96 L158 92" fill="#3f3f46"/>' + texto(120, 140, 'Marca donde se junta', { tam: 12, color: '#52525b' });
    var regla = '<rect x="14" y="70" width="212" height="34" rx="3" fill="#f4f4f5" stroke="#a1a1aa"/>';
    for(var i = 0; i <= 20; i++){ var xx = 22 + i * 10; regla += '<line x1="'+xx+'" y1="70" x2="'+xx+'" y2="'+(i % 5 === 0 ? 84 : 78)+'" stroke="#52525b"/>' + (i % 5 === 0 ? texto(xx, 98, String(i), { tam: 9, color: '#52525b' }) : ''); }
    var p3 = regla + '<rect x="22" y="52" width="170" height="12" rx="2" fill="#fff" stroke="#71717a"/><line x1="192" y1="46" x2="192" y2="104" stroke="'+ORO+'" stroke-width="2.5"/>' + cota(22, 40, 192, 40) + texto(107, 32, '17 cm', { tam: 13, peso: 700, color: ORO }) + texto(120, 140, 'Mide hasta la marca', { tam: 12, color: '#52525b' });
    $('gu-paso1').innerHTML = svg('0 0 240 150', p1);
    $('gu-paso2').innerHTML = svg('0 0 240 150', p2);
    $('gu-paso3').innerHTML = svg('0 0 240 150', p3);
  })();

  // ---------- probador: muneca + reloj a escala ----------
  var _catalogo = [], _base = null;   // _base: el reloj de la tienda desde el que se llego (?id=)
  function recomendado(cm){ return cm < 15 ? [34, 38] : cm < 16.5 ? [36, 40] : cm < 18 ? [39, 42] : cm < 19.5 ? [41, 44] : [43, 46]; }
  function fmt(v){ return String(Math.round(v * 10) / 10).replace('.', ','); }
  function pintarProbador(){
    var cm = parseFloat($('gu-muneca').value), mm = parseFloat($('gu-reloj').value);
    $('gu-v-muneca').textContent = String(cm).replace('.', ',') + ' cm';
    $('gu-v-reloj').textContent = mm + ' mm';
    // medida real de asa a asa si el control esta en el tamano del reloj desde el que se llego
    var base = _base && Math.round(parseFloat(_base.mm)) === mm ? _base : null;
    var l2lReal = base ? parseFloat(String(base.l2l || '').replace(',', '.')) : 0;
    var l2lMm = l2lReal > 0 ? l2lReal : mm * 1.2;
    var S = 4.2, ancho = cm * 10 * 0.3 * S, l2l = l2lMm * S, d = mm * S, cy = 175, cx = 300, c = '';
    var piel = '#ececee', borde = '#b4b4ba', yTop = cy - ancho/2, yBot = cy + ancho/2;
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
    c += cota(xr, cy - l2l/2, xr, cy + l2l/2) + texto(xr + 8, cy + 4, 'Reloj ' + fmt(l2lMm) + ' mm' + (l2lReal > 0 ? '' : ' aprox.'), { ancla: 'start', tam: 12, peso: 600, color: ORO });
    $('gu-sim').innerHTML = svg('0 0 660 350', c);

    var razon = l2lMm / (cm * 3), rec = recomendado(cm), v;
    if(razon < 0.82) v = ['discreto', 'Discreto', 'Se ve pequeño y elegante en tu muñeca. Ideal si buscas algo clásico o de vestir.'];
    else if(razon <= 1) v = ['ideal', 'Ideal', 'Las asas quedan dentro de tu muñeca: es un tamaño proporcionado para ti.'];
    else if(razon <= 1.1) v = ['grande', 'Grande', 'Se va a notar. Queda bien si te gustan los relojes con presencia, pero las asas llegan al borde de tu muñeca.'];
    else v = ['muy-grande', 'Muy grande', 'Las asas sobresalen de tu muñeca (línea roja). Te recomendamos un tamaño menor.'];
    $('gu-veredicto').innerHTML = '<span class="gu-pill '+v[0]+'">'+v[1]+'</span><p>'+v[2]+'</p><p class="gu-rec">Para tu muñeca de '+String(cm).replace('.', ',')+' cm te recomendamos relojes de <b>'+rec[0]+' a '+rec[1]+' mm</b>.</p>' +
      (base && l2lReal > 0 ? '<p class="gu-nota">Con las medidas reales del <b>'+esc(base.nombre)+'</b>: de asa a asa '+fmt(l2lReal)+' mm'+(parseFloat(base.grosor) ? ', grosor '+fmt(parseFloat(String(base.grosor).replace(',', '.')))+' mm' : '')+'.</p>'
       : base ? '<p class="gu-nota">Del <b>'+esc(base.nombre)+'</b> aún no tenemos la medida de asa a asa: usamos el promedio de la industria (1,2 veces el diámetro).</p>'
       : '<p class="gu-nota">De asa a asa aproximado (1,2 veces el diámetro, promedio de la industria).</p>');
    pintarSugeridos();
    try{ localStorage.setItem('aphillips_muneca', String(cm)); }catch(e){}
  }
  // miniatura de la foto (480 px, en fotos.aphillipsstore.com/miniaturas/...); si no existe, la foto completa
  var BASE_FOTOS = 'https://fotos.aphillipsstore.com/';
  function miniatura(u){ return u.indexOf(BASE_FOTOS + 'relojes/') === 0 ? BASE_FOTOS + 'miniaturas/' + u.slice(BASE_FOTOS.length) : u; }
  window.guFotoRespaldo = function(img){ var c = img.getAttribute('data-completa'); if(c && img.src !== c){ img.removeAttribute('data-completa'); img.src = c; } };
  function tarjeta(r){
    var foto = typeof r.foto === 'string' && r.foto ? '<img src="'+esc(miniatura(r.foto))+'" data-completa="'+esc(r.foto)+'" alt="" loading="lazy" decoding="async" onerror="guFotoRespaldo(this)">' : '';
    var precio = r.estado === 'bajopedido' ? 'Bajo cotización' : r.precio ? '$' + Number(r.precio).toLocaleString() : '';
    return '<a class="gu-reloj" href="/?id='+encodeURIComponent(r.id)+'"><span class="gu-reloj-foto">'+foto+'<span class="gu-mm">'+esc(parseFloat(r.mm))+' mm</span></span><span class="gu-reloj-nombre">'+esc(r.nombre)+'</span>'+(precio ? '<span class="gu-reloj-precio">'+esc(precio)+'</span>' : '')+'</a>';
  }
  // una fila de relojes: se ven solo los que caben (4 en PC, 2 en celular) y un boton para ver el resto
  // "Ver todos" abre el catalogo con el filtro de esa medida ya puesto (/relojes?mm=42 o ?mm=39-42)
  function fila(lista, titulo, mm){
    var pocosPc = lista.length <= 4 ? ' pocos-pc' : '';
    return '<div class="gu-grupo">' + titulo + '<div class="gu-fila">' + lista.map(tarjeta).join('') + '</div>' +
      (lista.length > 2 && mm ? '<a class="gu-ver-todos' + pocosPc + '" href="/relojes?mm=' + encodeURIComponent(mm) + '">Ver todos (' + lista.length + ')</a>' : '') + '</div>';
  }
  // relojes de la tienda del tamano elegido en el control; si no hay de esa medida exacta,
  // los mas cercanos (hasta 2 mm de diferencia)
  function pintarSugeridos(){
    var cont = $('gu-sugeridos'); if(!_catalogo.length){ cont.innerHTML = ''; return; }
    var mmSel = parseFloat($('gu-reloj').value);
    var activos = _catalogo.filter(function(r){ return r.estado !== 'vendido'; });
    var lista = activos.filter(function(r){ return Math.round(parseFloat(r.mm)) === mmSel; }), titulo = 'Relojes de la tienda de ' + mmSel + ' mm';
    if(!lista.length){
      lista = activos.filter(function(r){ return Math.abs(parseFloat(r.mm) - mmSel) <= 2; })
        .sort(function(a, b){ return Math.abs(parseFloat(a.mm) - mmSel) - Math.abs(parseFloat(b.mm) - mmSel); });
      titulo = 'Relojes de la tienda cerca de ' + mmSel + ' mm';
    }
    var exacta = lista.every(function(r){ return Math.round(parseFloat(r.mm)) === mmSel; });
    cont.innerHTML = lista.length ? fila(lista, '<h3>' + titulo + '</h3>', exacta ? String(mmSel) : (mmSel - 2) + '-' + (mmSel + 2))
      : '<h3>Relojes de la tienda de ' + mmSel + ' mm</h3><p class="gu-tip">Ahora no tenemos relojes de esta medida. Escríbenos y te ayudamos a conseguirlo.</p>';
  }
  function pintarTienda(){
    var grupos = [['Hasta 38 mm', 0, 38.9], ['39 a 42 mm', 39, 42.9], ['43 a 45 mm', 43, 45.9], ['46 mm o más', 46, 99]];
    var h = grupos.map(function(g){
      var l = _catalogo.filter(function(r){ var mm = parseFloat(r.mm); return mm >= g[1] && mm <= g[2]; });
      return l.length ? fila(l, '<h3>'+g[0]+' <span>('+l.length+')</span></h3>', g[1] + '-' + Math.floor(g[2])) : '';
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
    var idBase = q.get('id');
    _base = idBase ? _catalogo.filter(function(r){ return r.id === idBase; })[0] || null : null;
    pintarTienda(); pintarProbador();
  }).catch(function(){ $('gu-tienda').innerHTML = '<p class="gu-tip">No se pudieron cargar los relojes. <a href="/">Ver la tienda</a></p>'; });

  // mensaje listo para WhatsApp con la medida elegida
  $('gu-wa').addEventListener('click', function(){
    var cm = $('gu-muneca').value, mm = $('gu-reloj').value;
    var sobre = _base ? ' Estoy viendo el ' + _base.nombre + (_base.sku ? ' (Ref. ' + _base.sku + ')' : '') + ' de ' + parseFloat(_base.mm) + ' mm. ¿Me quedaría bien?' : ' Estoy viendo relojes de ' + mm + ' mm. ¿Qué tamaño me recomiendan?';
    this.href = 'https://wa.me/50762615442?text=' + encodeURIComponent('¡Hola! Mi muñeca mide ' + String(cm).replace('.', ',') + ' cm.' + sobre);
  });
})();
