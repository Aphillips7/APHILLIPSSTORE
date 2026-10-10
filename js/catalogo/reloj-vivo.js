// =================== RELOJ EN VIVO (Invicta Pro Diver) ===================
// Se dibuja en SVG y marca la hora real de Panama (UTC-5, sin horario de verano).
// El segundero avanza 6 veces por segundo, como un automatico (21.600 alternancias/hora).
// Solo se anima mientras la seccion esta en pantalla.

var C = 200;                       // centro del reloj en el SVG
var ACERO = '#d4d4d7', LUME = '#eef2de';
function pol(r, grados){ var a = grados * Math.PI / 180; return [C + r * Math.sin(a), C - r * Math.cos(a)]; }
function n(v){ return Math.round(v * 100) / 100; }

function dibujarReloj(){
  var s = '<svg viewBox="-6 -6 424 412" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
  s += '<defs>'+
    '<radialGradient id="rv-acero" cx="35%" cy="28%" r="85%"><stop offset="0" stop-color="#f7f7f8"/><stop offset=".45" stop-color="#c6c6c9"/><stop offset=".8" stop-color="#8e8e92"/><stop offset="1" stop-color="#5d5d61"/></radialGradient>'+
    '<linearGradient id="rv-corona" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9c9ca0"/><stop offset=".5" stop-color="#ededee"/><stop offset="1" stop-color="#8a8a8e"/></linearGradient>'+
    '<radialGradient id="rv-bisel" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#2a2a2c"/><stop offset=".7" stop-color="#121213"/><stop offset="1" stop-color="#050505"/></radialGradient>'+
    '<radialGradient id="rv-esfera" cx="42%" cy="34%" r="75%"><stop offset="0" stop-color="#262628"/><stop offset=".55" stop-color="#101011"/><stop offset="1" stop-color="#040404"/></radialGradient>'+
    '<linearGradient id="rv-brillo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>'+
  '</defs>';

  // corona con estrias (detras de la caja)
  s += '<rect x="384" y="178" width="22" height="44" rx="4" fill="url(#rv-corona)" stroke="#6f6f73" stroke-width="1"/>';
  for(var g = 0; g < 7; g++){ s += '<line x1="'+(388+g*2.6)+'" y1="180" x2="'+(388+g*2.6)+'" y2="220" stroke="#7d7d81" stroke-width=".7"/>'; }
  s += '<rect x="378" y="186" width="10" height="28" fill="url(#rv-corona)"/>';

  // caja de acero con borde estriado (agarre del bisel)
  s += '<circle cx="'+C+'" cy="'+C+'" r="198" fill="url(#rv-acero)"/>';
  s += '<circle cx="'+C+'" cy="'+C+'" r="194" fill="none" stroke="#7e7e82" stroke-width="5" stroke-dasharray="2.4 2.6" opacity=".85"/>';
  s += '<circle cx="'+C+'" cy="'+C+'" r="190.5" fill="none" stroke="#e9e9ea" stroke-width="1.2"/>';

  // bisel negro giratorio
  s += '<circle cx="'+C+'" cy="'+C+'" r="189" fill="url(#rv-bisel)"/>';
  for(var m = 1; m < 60; m++){
    var ang = m * 6;
    if(m <= 14){                                   // primeros 15 minutos: marcas finas
      var a1 = pol(165, ang), a2 = pol(183, ang);
      s += '<line x1="'+n(a1[0])+'" y1="'+n(a1[1])+'" x2="'+n(a2[0])+'" y2="'+n(a2[1])+'" stroke="#f2f2f2" stroke-width="2.4"/>';
    } else if(m % 10 === 0){                       // 20, 30, 40, 50
      s += '<text x="'+C+'" y="'+(C-160)+'" transform="rotate('+ang+' '+C+' '+C+')" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="27" font-weight="700" fill="#f2f2f2">'+m+'</text>';
    } else if(m % 5 === 0){                        // 15, 25, 35, 45, 55: barras
      var b1 = pol(162, ang), b2 = pol(184, ang);
      s += '<line x1="'+n(b1[0])+'" y1="'+n(b1[1])+'" x2="'+n(b2[0])+'" y2="'+n(b2[1])+'" stroke="#f2f2f2" stroke-width="4.5"/>';
    } else {                                       // resto: puntos
      var p = pol(173, ang);
      s += '<circle cx="'+n(p[0])+'" cy="'+n(p[1])+'" r="2.8" fill="#f2f2f2"/>';
    }
  }
  // triangulo luminoso del cero
  s += '<path d="M'+(C-13)+' 16 L'+(C+13)+' 16 L'+C+' 40 Z" fill="#f2f2f2"/><circle cx="'+C+'" cy="24" r="4.2" fill="'+LUME+'" stroke="#9a9a9e" stroke-width="1"/>';

  // aro interior de acero y esfera negra
  s += '<circle cx="'+C+'" cy="'+C+'" r="152" fill="#a9a9ad"/><circle cx="'+C+'" cy="'+C+'" r="149" fill="#1c1c1d"/>';
  s += '<circle cx="'+C+'" cy="'+C+'" r="145" fill="url(#rv-esfera)"/>';
  // minutero de la esfera
  for(var t = 0; t < 60; t++){
    if(t % 5 === 0) continue;
    var t1 = pol(137, t*6), t2 = pol(142, t*6);
    s += '<line x1="'+n(t1[0])+'" y1="'+n(t1[1])+'" x2="'+n(t2[0])+'" y2="'+n(t2[1])+'" stroke="#bdbdc0" stroke-width="1.1"/>';
  }
  // indices: puntos luminosos, barras en 6 y 9, triangulo en 12, fecha en 3
  [1,2,4,5,7,8,10,11].forEach(function(h){
    var q = pol(118, h*30);
    s += '<circle cx="'+n(q[0])+'" cy="'+n(q[1])+'" r="9.5" fill="'+LUME+'" stroke="'+ACERO+'" stroke-width="2.2"/>';
  });
  s += '<rect x="'+(C-5.5)+'" y="'+(C+90)+'" width="11" height="32" rx="1.5" fill="'+LUME+'" stroke="'+ACERO+'" stroke-width="2.2"/>';
  s += '<rect x="'+(C-122)+'" y="'+(C-5.5)+'" width="32" height="11" rx="1.5" fill="'+LUME+'" stroke="'+ACERO+'" stroke-width="2.2"/>';
  s += '<path d="M'+(C-12)+' '+(C-134)+' L'+(C+12)+' '+(C-134)+' L'+C+' '+(C-98)+' Z" fill="'+LUME+'" stroke="'+ACERO+'" stroke-width="2.2" stroke-linejoin="round"/>';
  s += '<rect x="'+(C+96)+'" y="'+(C-12)+'" width="32" height="24" fill="#f7f7f5" stroke="#8d8d91" stroke-width="2.5"/>';
  s += '<text id="rv-fecha" x="'+(C+112)+'" y="'+(C+7)+'" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="700" fill="#111">1</text>';
  // textos de la esfera
  s += '<image href="img/marca-logo-invicta.png" x="'+(C-31)+'" y="'+(C-92)+'" width="62" height="24"/>';
  var txt = function(y, t, tam, esp){ return '<text x="'+C+'" y="'+y+'" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="'+tam+'" letter-spacing="'+esp+'" fill="#ececec">'+t+'</text>'; };
  s += txt(C+38, 'AUTOMATIC', 8, .6) + txt(C+49, 'PROFESSIONAL', 8, .6) + txt(C+60, '660ft-200M', 8, .4) + txt(C+71, 'WATER RESISTANT', 8, .6);
  s += '<text x="'+(C-40)+'" y="'+(C+118)+'" font-family="Arial,Helvetica,sans-serif" font-size="5.5" letter-spacing=".4" fill="#bdbdc0" transform="rotate(14 '+(C-40)+' '+(C+118)+')">JAPAN</text>';
  s += '<text x="'+(C+24)+'" y="'+(C+121)+'" font-family="Arial,Helvetica,sans-serif" font-size="5.5" letter-spacing=".4" fill="#bdbdc0" transform="rotate(-14 '+(C+24)+' '+(C+121)+')">MOVT</text>';

  // agujas (dibujadas apuntando a las 12; se giran desde JS)
  s += '<g id="rv-h">'+
    '<path d="M'+(C-4)+' '+(C+20)+' L'+(C-4)+' '+(C-47)+' L'+(C+4)+' '+(C-47)+' L'+(C+4)+' '+(C+20)+' Z" fill="'+ACERO+'"/>'+
    '<circle cx="'+C+'" cy="'+(C-60)+'" r="13.5" fill="'+LUME+'" stroke="'+ACERO+'" stroke-width="3.2"/>'+
    '<path d="M'+C+' '+(C-60)+' V'+(C-73.5)+' M'+C+' '+(C-60)+' L'+n(C-11.7)+' '+n(C-53.2)+' M'+C+' '+(C-60)+' L'+n(C+11.7)+' '+n(C-53.2)+'" stroke="'+ACERO+'" stroke-width="2.6"/>'+
    '<path d="M'+(C-4.5)+' '+(C-72)+' L'+C+' '+(C-86)+' L'+(C+4.5)+' '+(C-72)+' Z" fill="'+ACERO+'"/>'+
  '</g>';
  s += '<g id="rv-m">'+
    '<path d="M'+(C-5)+' '+(C+26)+' L'+(C-5)+' '+(C-8)+' L'+(C-7)+' '+(C-118)+' L'+C+' '+(C-134)+' L'+(C+7)+' '+(C-118)+' L'+(C+5)+' '+(C-8)+' L'+(C+5)+' '+(C+26)+' Z" fill="'+ACERO+'"/>'+
    '<path d="M'+(C-3.2)+' '+(C-14)+' L'+(C-4.6)+' '+(C-116)+' L'+C+' '+(C-127)+' L'+(C+4.6)+' '+(C-116)+' L'+(C+3.2)+' '+(C-14)+' Z" fill="'+LUME+'"/>'+
  '</g>';
  s += '<g id="rv-s">'+
    '<rect x="'+(C-1.2)+'" y="'+(C-130)+'" width="2.4" height="166" fill="'+ACERO+'"/>'+
    '<circle cx="'+C+'" cy="'+(C-100)+'" r="5.5" fill="'+LUME+'" stroke="'+ACERO+'" stroke-width="2"/>'+
    '<circle cx="'+C+'" cy="'+(C+30)+'" r="4" fill="'+ACERO+'"/>'+
  '</g>';
  s += '<circle cx="'+C+'" cy="'+C+'" r="6.5" fill="'+ACERO+'"/><circle cx="'+C+'" cy="'+C+'" r="2.4" fill="#4a4a4d"/>';

  // reflejo del cristal
  s += '<path d="M'+(C-142)+' '+(C-10)+' A145 145 0 0 1 '+(C+30)+' '+(C-142)+' L'+(C+22)+' '+(C-122)+' A124 124 0 0 0 '+(C-122)+' '+(C-14)+' Z" fill="url(#rv-brillo)"/>';
  s += '</svg>';
  return s;
}

var cont = document.getElementById('reloj-vivo');
if(cont){
  cont.innerHTML = dibujarReloj();
  var gH = document.getElementById('rv-h'), gM = document.getElementById('rv-m'), gS = document.getElementById('rv-s');
  var fechaEl = document.getElementById('rv-fecha'), digital = document.getElementById('hora-digital');
  var reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var visible = false, raf = 0, ultimoTexto = '', ultimaFecha = -1;

  var actualizar = function(){
    var t = new Date(Date.now() - 5 * 3600000);   // Panama = UTC-5 todo el ano
    var h = t.getUTCHours(), m = t.getUTCMinutes(), sg = t.getUTCSeconds() + t.getUTCMilliseconds() / 1000;
    sg = reducido ? Math.floor(sg) : Math.floor(sg * 6) / 6;   // barrido de automatico (6 pasos por segundo)
    gH.setAttribute('transform', 'rotate('+n(((h % 12) + m / 60 + sg / 3600) * 30)+' '+C+' '+C+')');
    gM.setAttribute('transform', 'rotate('+n((m + sg / 60) * 6)+' '+C+' '+C+')');
    gS.setAttribute('transform', 'rotate('+n(sg * 6)+' '+C+' '+C+')');
    var dia = t.getUTCDate();
    if(dia !== ultimaFecha){ ultimaFecha = dia; fechaEl.textContent = dia; }
    var h12 = h % 12 || 12, texto = h12 + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' a. m.' : ' p. m.');
    if(texto !== ultimoTexto){ ultimoTexto = texto; if(digital) digital.textContent = texto; }
  };
  var ciclo = function(){ actualizar(); if(visible) raf = reducido ? setTimeout(ciclo, 1000) : requestAnimationFrame(ciclo); };
  var arrancar = function(){ if(visible) return; visible = true; ciclo(); };
  var parar = function(){ visible = false; if(reducido) clearTimeout(raf); else cancelAnimationFrame(raf); };

  actualizar();
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(en){ if(en[0].isIntersecting && !document.hidden) arrancar(); else parar(); }, {rootMargin:'100px'}).observe(cont);
    document.addEventListener('visibilitychange', function(){ if(document.hidden) parar(); else { var r = cont.getBoundingClientRect(); if(r.bottom > 0 && r.top < innerHeight) arrancar(); } });
  } else { arrancar(); }
}
