# CLAUDE.md

1. Lee **ARCHITECTURE.md** primero: ahi esta que hace cada archivo, las colecciones, los estados
   y las reglas de negocio.
2. Abre solo los archivos que necesites para la tarea (cada modulo de `js/` tiene una sola
   responsabilidad). No leas `img/`.
3. Sin herramientas de compilacion: modulos ES puros que deben seguir funcionando en GitHub Pages.
4. Si una funcion se llama desde un `onclick`/`oninput`, exponla con `Object.assign(window, {...})`.
5. Si agregas o renombras archivos en `/css` o `/js`, actualiza `SHELL_FILES` en `sw.js`; al
   publicar cambios, sube `CACHE_NAME`.
6. Nunca pongas datos privados (costos, proveedor, margen, serie, tracking) en `catalogo_publico`:
   usa `camposPublicos()` de `js/products.js`.
7. No ejecutes nada contra el Firebase real ni modifiques datos; las migraciones se entregan como
   script para que el dueno las corra. Las reglas (`firestore.rules`) se publican a mano.
8. Trabaja en ramas y en espanol (codigo, commits y mensajes al usuario).
9. Poka-yoke (a prueba de errores) en todo: al cambiar la tienda o el panel, bloquea el error en vez de
   solo avisarlo (validar al escribir, botones desactivados hasta que el dato sea valido, confirmacion en
   lo que no se deshace, formatos que se corrigen solos).
10. Publica la tienda SOLO con `node scripts/publicar.mjs`: corre `scripts/verificar.mjs` (sintaxis,
    SHELL_FILES, CACHE_NAME, campos privados, funciones de onclick en window) y no publica si algo falla.
