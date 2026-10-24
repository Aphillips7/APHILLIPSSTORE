// CHEQUEO A PRUEBA DE ERRORES (poka-yoke) ANTES DE PUBLICAR LA TIENDA
// ---------------------------------------------------------------------------
// Uso:  node scripts/verificar.mjs        -> solo revisa
//       node scripts/publicar.mjs         -> revisa y, si todo esta bien, publica
// Si algo falla, termina con codigo 1 y explica que arreglar. Revisa:
//   1. Que ningun archivo .js tenga errores de sintaxis (tienda, panel, sw y Workers).
//   2. Que todo archivo de /css y /js este en SHELL_FILES de sw.js, y que todo lo listado exista.
//   3. Que si cambio algun archivo de la tienda desde la ultima publicacion, CACHE_NAME haya subido
//      (si no, los clientes con la version guardada no ven los cambios).
//   4. Que ningun campo privado (costo, proveedor, margen, serie, tracking...) este en los campos
//      publicos del catalogo (js/products.js y el Worker de la API).
//   5. Que toda funcion usada en un onclick/oninput/onchange... este expuesta en window.
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const ESTADO = join(RAIZ, 'scripts', '.ultimo-publicado.json');
const PRIVADOS = /costo|proveedor|margen|ganancia|serie|tracking|rastreo|comprador|cliente|telefono|whatsappCliente|pagado|abono|privad|factura/i;
const errores = [], avisos = [];
const rel = p => relative(RAIZ, p).split('\\').join('/');
const leer = p => readFileSync(p, 'utf8');

function archivos(dir, exts, fuera = []){
  const out = [];
  const rec = d => {
    for(const n of readdirSync(d)){
      const p = join(d, n);
      if(fuera.some(f => rel(p).startsWith(f))) continue;
      if(statSync(p).isDirectory()) rec(p);
      else if(exts.includes(extname(n))) out.push(p);
    }
  };
  if(existsSync(dir)) rec(dir);
  return out;
}

// 1. sintaxis
const jsTienda = [...archivos(join(RAIZ, 'js'), ['.js']), join(RAIZ, 'sw.js')];
const jsWorkers = [join(RAIZ, 'cloudflare/tienda-worker/index.js'), ...archivos(join(RAIZ, 'cloudflare/fotos-worker/src'), ['.js'])];
// OJO: "node --check archivo.js" NO detecta errores en un modulo ES (con import/export) porque Node decide
// el tipo despues; por eso los modulos se copian a un .mjs temporal y se revisan ahi (asi si fallan).
const TMP_CHECK = join(tmpdir(), 'aphillips-verificar');
mkdirSync(TMP_CHECK, { recursive: true });
for(const f of [...jsTienda, ...jsWorkers]){
  if(!existsSync(f)) continue;
  let objetivo = f;
  if(/^\s*(import|export)\b/m.test(readFileSync(f, 'utf8'))){ objetivo = join(TMP_CHECK, 'm.mjs'); copyFileSync(f, objetivo); }
  try{ execFileSync(process.execPath, ['--check', objetivo], { stdio: 'pipe' }); }
  catch(e){ errores.push('Error de sintaxis en ' + rel(f) + ':\n    ' + String(e.stderr || e.message).trim().split('\n').slice(0, 4).join('\n    ')); }
}

// 2. SHELL_FILES
const sw = leer(join(RAIZ, 'sw.js'));
const bloque = (sw.match(/const SHELL_FILES = \[([\s\S]*?)\];/) || [])[1] || '';
const listados = [...bloque.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
for(const l of listados) if(!existsSync(join(RAIZ, l))) errores.push('sw.js lista "' + l + '" pero ese archivo no existe.');
const enDisco = [...archivos(join(RAIZ, 'css'), ['.css']), ...archivos(join(RAIZ, 'js'), ['.js'])].map(rel);
for(const f of enDisco) if(!listados.includes(f)) errores.push('Falta "./' + f + '" en SHELL_FILES de sw.js (sin eso no funciona sin conexion).');

// 3. CACHE_NAME
const cache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1];
if(!cache) errores.push('No encontre CACHE_NAME en sw.js.');
const publicables = [...enDisco, ...readdirSync(RAIZ).filter(n => /\.(html|json)$/.test(n) && n !== 'package.json')];
const h = createHash('sha256');
for(const f of publicables.sort()) h.update(f + '\0' + leer(join(RAIZ, f)).replace(/const CACHE_NAME = '[^']*'/, ''));
const huella = h.digest('hex');
let ultimo = null;
try{ ultimo = JSON.parse(leer(ESTADO)); }catch(e){}
if(!process.env.SOLO_API && ultimo && ultimo.huella !== huella && ultimo.cache === cache)
  errores.push('Cambiaste archivos de la tienda pero CACHE_NAME sigue en "' + cache + '". Subelo (ej. ' + cache.replace(/\d+$/, n => +n + 1) + ').');
if(!ultimo) avisos.push('Primera verificacion: desde ahora se recuerda que se publico para vigilar CACHE_NAME.');

// 4. campos privados fuera del catalogo publico
const prod = leer(join(RAIZ, 'js/products.js'));
const cp = (prod.match(/function camposPublicos\(p\)\{[\s\S]*?return \{([\s\S]*?)\};/) || [])[1] || '';
const clavesCp = [...cp.matchAll(/(\w+)\s*:/g)].map(m => m[1]);
if(!clavesCp.length) errores.push('No pude leer camposPublicos() en js/products.js.');
for(const k of clavesCp) if(PRIVADOS.test(k)) errores.push('camposPublicos() incluye "' + k + '", que parece un dato privado.');
const api = leer(join(RAIZ, 'cloudflare/fotos-worker/src/index.js'));
const cpApi = ((api.match(/const CAMPOS_PUBLICOS = \[([\s\S]*?)\];/) || [])[1] || '').match(/'([^']+)'/g) || [];
for(const k of cpApi.map(s => s.slice(1, -1))) if(PRIVADOS.test(k)) errores.push('CAMPOS_PUBLICOS del Worker incluye "' + k + '", que parece un dato privado.');

// 5. funciones de onclick expuestas en window
const NO_CUENTA = new Set(['if','for','while','return','function','typeof','new','event','this','window','document','confirm','alert','prompt','setTimeout','clearTimeout','history','location','encodeURIComponent','decodeURIComponent','parseFloat','parseInt','Number','String','Math','JSON','Array','Object','Date','Boolean','fetch','navigator','console','void','catch','switch']);
const expuestas = new Set();
const fuentes = jsTienda.map(leer).join('\n');
for(const m of fuentes.matchAll(/Object\.assign\(\s*window\s*,\s*\{([^}]*)\}/g)) for(const n of m[1].split(',')) { const k = n.trim().split(':')[0].trim(); if(k) expuestas.add(k); }
for(const m of fuentes.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) expuestas.add(m[1]);
const usadas = new Map();
const anotar = (codigo, donde) => {
  // lo que se pega con + dentro de un texto JS ('...' + esc(x) + '...') no es parte del onclick
  codigo = codigo.replace(/\\?['"]\s*\+[\s\S]*?\+\s*\\?['"]/g, '');
  for(const m of codigo.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)){
    const n = m[2]; if(NO_CUENTA.has(n)) continue;
    if(/\+\s*$/.test(codigo.slice(Math.max(0, m.index - 4), m.index + m[1].length))) continue;   // '...' + esc(x)
    if(!usadas.has(n)) usadas.set(n, donde);
  }
};
const htmls = readdirSync(RAIZ).filter(n => n.endsWith('.html')).map(n => join(RAIZ, n));
for(const f of [...htmls, ...jsTienda]){
  const txt = leer(f);
  for(const m of txt.matchAll(/\bon(?:click|input|change|submit|keydown|keyup|error|load|blur|focus)\s*=\s*\\?(["'])([\s\S]*?)\\?\1/g)) anotar(m[2], rel(f));
}
for(const [n, donde] of usadas) if(!expuestas.has(n) && !new RegExp('function\\s+' + n + '\\b').test(htmls.map(leer).join('\n')))
  errores.push('"' + n + '()" se usa en un onclick/oninput (' + donde + ') pero no esta en Object.assign(window, {...}).');

// resultado
for(const a of avisos) console.log('  aviso: ' + a);
if(errores.length){
  console.log('\nNO SE PUEDE PUBLICAR. Arregla esto primero:\n');
  errores.forEach((e, i) => console.log('  ' + (i + 1) + '. ' + e));
  process.exit(1);
}
console.log('Todo en orden: sintaxis, SHELL_FILES, CACHE_NAME (' + cache + '), campos publicos y funciones de onclick.');
export { huella, cache, ESTADO };
