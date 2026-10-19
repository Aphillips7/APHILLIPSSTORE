// =================== REGISTRO DE ERRORES (tienda y panel) ===================
// Si a un cliente (o en el panel) le falla algo de JavaScript, se manda un aviso anonimo y corto a la
// API (POST /errores): mensaje, archivo, linea, pagina y tipo de navegador. Sin datos personales.
// El dueno lo ve en el informe semanal y en GET /admin/errores. Maximo 5 por visita y sin repetidos.
// Se importa primero en js/catalogo/main.js y js/panel/main.js para atrapar errores de todo lo demas.
var API_ERRORES = 'https://api.aphillipsstore.com/errores';
var _enviados = 0, _vistos = {};

function navegador(){
  var ua = navigator.userAgent || '';
  var so = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Otro';
  var nav = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Otro';
  return nav + ' / ' + so;
}

function reportar(mensaje, fuente, linea){
  mensaje = String(mensaje || '').slice(0, 300);
  fuente = String(fuente || '').slice(0, 200);
  // ruido que no es de la tienda: extensiones del navegador, scripts de otros dominios, avisos del navegador
  if(!mensaje || /^Script error\.?$/i.test(mensaje) || /ResizeObserver loop/i.test(mensaje)) return;
  if(/^(chrome|moz|safari)-extension:/.test(fuente)) return;
  if(fuente && fuente.indexOf(location.origin) !== 0 && fuente.indexOf('aphillipsstore.com') === -1) return;
  var clave = mensaje + '|' + fuente + '|' + linea;
  if(_vistos[clave] || _enviados >= 5) return;
  _vistos[clave] = 1; _enviados++;
  var datos = JSON.stringify({ m: mensaje, f: fuente.replace(location.origin, ''), l: Number(linea) || 0, p: location.pathname + location.hash, n: navegador() });
  try{
    // texto plano: sin peticion previa (CORS) y se envia aunque la pagina se este cerrando
    if(navigator.sendBeacon) navigator.sendBeacon(API_ERRORES, new Blob([datos], { type: 'text/plain' }));
    else fetch(API_ERRORES, { method: 'POST', body: datos, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(function(){});
  }catch(e){}
}

window.addEventListener('error', function(e){
  // errores al cargar una imagen o un script llegan sin mensaje: no son errores de codigo
  if(!e || !e.message) return;
  reportar(e.message, e.filename, e.lineno);
});
window.addEventListener('unhandledrejection', function(e){
  var r = e && e.reason;
  var msg = r && r.message ? r.message : String(r || '');
  // fallos de red (sin internet) no son errores de la tienda
  if(/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return;
  reportar('Promesa: ' + msg, r && r.stack ? (String(r.stack).match(/https?:\/\/[^\s)]+/) || [''])[0].replace(/:\d+:\d+$/, '') : '', 0);
});

export { reportar };
