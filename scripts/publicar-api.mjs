// PUBLICAR EL SERVIDOR DE DATOS (Worker "aphillips-fotos", api.aphillipsstore.com) A PRUEBA DE ERRORES
// ---------------------------------------------------------------------------
// Uso:  node scripts/publicar-api.mjs
// 1. Corre scripts/verificar.mjs (sintaxis de los Workers y campos privados fuera del catalogo publico;
//    no exige subir CACHE_NAME, que es solo de la tienda). Si algo falla, NO publica.
// 2. Publica desde cloudflare/fotos-worker.
// 3. Comprueba en vivo que la API responde el catalogo publico.
import { execSync } from 'node:child_process';

process.env.SOLO_API = '1';
await import('./verificar.mjs');   // si la verificacion falla, el proceso termina aqui

console.log('\nPublicando la API...');
execSync('npx --yes wrangler@4 deploy', { stdio: 'inherit', cwd: new URL('../cloudflare/fotos-worker/', import.meta.url) });

let ok = false;
for(let i = 0; i < 5 && !ok; i++){
  try{
    const r = await fetch('https://api.aphillipsstore.com/catalogo?v=' + Date.now(), { cache: 'no-store' });
    ok = r.ok && Array.isArray((await r.json()).relojes);
  }catch(e){}
  if(!ok) await new Promise(r => setTimeout(r, 2500));
}
if(!ok){ console.log('\nOJO: se publico, pero api.aphillipsstore.com/catalogo no responde bien. Revisalo ya.'); process.exit(1); }
console.log('\nListo: la API responde el catalogo publico.');
