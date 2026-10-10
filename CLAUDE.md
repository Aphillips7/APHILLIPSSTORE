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
