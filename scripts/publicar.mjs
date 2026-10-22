// PUBLICAR LA TIENDA A PRUEBA DE ERRORES (poka-yoke)
// ---------------------------------------------------------------------------
// Uso:  node scripts/publicar.mjs
// 1. Corre scripts/verificar.mjs: si algo esta mal, NO publica.
// 2. Publica con wrangler (Worker "aphillipsstore" + archivos de la tienda).
// 3. Comprueba en vivo que aphillipsstore.com ya sirve el CACHE_NAME nuevo.
// 4. Recuerda que se publico, para que la proxima verificacion exija subir CACHE_NAME si hay cambios.
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { huella, cache, ESTADO } from './verificar.mjs';   // si la verificacion falla, el proceso termina aqui

console.log('\nPublicando ' + cache + '...');
execSync('npx --yes wrangler@4 deploy', { stdio: 'inherit', cwd: new URL('..', import.meta.url) });

let enVivo = '';
for(let i = 0; i < 6 && enVivo !== cache; i++){
  try{
    const txt = await (await fetch('https://aphillipsstore.com/sw.js?v=' + Date.now(), { cache: 'no-store' })).text();
    enVivo = (txt.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  }catch(e){}
  if(enVivo !== cache) await new Promise(r => setTimeout(r, 2500));
}
if(enVivo !== cache){
  console.log('\nOJO: se publico, pero aphillipsstore.com todavia responde "' + (enVivo || 'sin respuesta') + '" en vez de "' + cache + '". Revisa en un minuto.');
  process.exit(1);
}
writeFileSync(ESTADO, JSON.stringify({ cache, huella, fecha: new Date().toISOString() }, null, 2));
console.log('\nListo: aphillipsstore.com ya sirve ' + cache + '.');
