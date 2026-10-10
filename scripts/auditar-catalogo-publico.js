// AUDITORIA Y LIMPIEZA DE catalogo_publico  (no se ejecuta solo; lo corres tu)
// ---------------------------------------------------------------------------
// No hace falta mover datos: "inventario" (privado) y "catalogo_publico" (publico)
// ya existen. Este script revisa que la copia publica este limpia:
//   1. documentos publicos con campos que NO deberian estar (costo, proveedor...)
//   2. documentos publicos cuyo reloj ya no existe en inventario
//   3. documentos publicos de relojes que ya no son publicables (vendidos hace
//      mas de 21 dias, reservados, ocultos...)
//   4. relojes publicables que faltan o estan desactualizados en el catalogo
//
// COMO USARLO
//   1. Abre el panel publicado (index.html) e inicia sesion.
//   2. Abre la consola del navegador (F12 > Consola).
//   3. Pega TODO este archivo y presiona Enter.
//   4. Lee el informe. Por defecto NO cambia nada (APLICAR = false).
//   5. Si estas de acuerdo, cambia APLICAR a true, pega de nuevo y Enter.
// Nota: el panel nuevo hace esta misma limpieza solo cada vez que entras;
// el script sirve para revisarlo a mano o forzarlo una vez.
(async function auditarCatalogoPublico(){
  const APLICAR = false;

  const { camposPublicos, esPublicable } = await import(new URL('js/products.js', location.href).href);
  const db = firebase.firestore();
  const [invSnap, pubSnap] = await Promise.all([
    db.collection('inventario').get({ source: 'server' }),
    db.collection('catalogo_publico').get({ source: 'server' })
  ]);
  const inventario = {}; invSnap.forEach(d => { inventario[d.id] = Object.assign({ id: d.id }, d.data()); });
  const publico = {}; pubSnap.forEach(d => { publico[d.id] = d.data(); });
  const permitidos = Object.keys(camposPublicos({}));

  const informe = []; const sets = []; const deletes = [];
  Object.keys(publico).forEach(id => {
    const extras = Object.keys(publico[id]).filter(k => !permitidos.includes(k));
    const p = inventario[id];
    if (!p) { informe.push({ id, problema: 'el reloj ya no existe en inventario', accion: 'borrar del catalogo' }); deletes.push(id); return; }
    if (!esPublicable(p)) { informe.push({ id, nombre: p.nombre, problema: 'ya no es publicable (estado: ' + p.estado + (p.ocultoCatalogo ? ', oculto' : '') + ')', accion: 'borrar del catalogo' }); deletes.push(id); return; }
    if (extras.length) informe.push({ id, nombre: p.nombre, problema: 'campos que no deberian ser publicos: ' + extras.join(', '), accion: 'reescribir solo campos publicos' });
  });
  Object.keys(inventario).forEach(id => {
    const p = inventario[id];
    if (!esPublicable(p)) return;
    const limpio = camposPublicos(p);
    const actual = publico[id];
    if (!actual) { informe.push({ id, nombre: p.nombre, problema: 'falta en el catalogo', accion: 'publicar' }); sets.push([id, limpio]); return; }
    const distinto = JSON.stringify(camposPublicos(actual)) !== JSON.stringify(limpio) || Object.keys(actual).some(k => !permitidos.includes(k));
    if (distinto) { if (!informe.some(x => x.id === id)) informe.push({ id, nombre: p.nombre, problema: 'desactualizado', accion: 'reescribir' }); sets.push([id, limpio]); }
  });

  console.log('Inventario: ' + invSnap.size + ' relojes · Catalogo publico: ' + pubSnap.size + ' documentos');
  if (!informe.length) { console.log('%cTodo en orden: el catalogo publico coincide con el inventario.', 'color:green'); return; }
  console.table(informe);
  // Aviso aparte: "notas" es publico por diseno; revisa que no tenga informacion interna.
  const conNotas = Object.keys(inventario).filter(id => esPublicable(inventario[id]) && inventario[id].notas).map(id => ({ id, nombre: inventario[id].nombre, notas: inventario[id].notas }));
  if (conNotas.length) { console.log('Recuerda: estas "notas" se ven en el catalogo publico:'); console.table(conNotas); }

  if (!APLICAR) { console.log('%cModo revision: no se cambio nada. Para aplicar, pon APLICAR = true y vuelve a pegar el script.', 'color:#b45309'); return; }
  const ops = sets.map(([id, data]) => ({ id, data })).concat(deletes.map(id => ({ id, borrar: true })));
  for (let i = 0; i < ops.length; i += 450) {
    const batch = db.batch();
    ops.slice(i, i + 450).forEach(op => {
      const ref = db.collection('catalogo_publico').doc(op.id);
      if (op.borrar) batch.delete(ref); else batch.set(ref, op.data);
    });
    await batch.commit();
  }
  console.log('%cListo: ' + sets.length + ' publicados/reescritos, ' + deletes.length + ' borrados.', 'color:green');
})().catch(e => console.error('La auditoria fallo:', e));
