# Arquitectura de APHILLIPS STORE

Web de reventa de relojes publicada en **GitHub Pages** (rama `main`), sin herramientas de
compilacion. Usa **Firebase Firestore + Firebase Auth** (plan Spark, sin Storage) y **Cloudflare**
para las fotos (R2 + Worker, ver `cloudflare/README.md`). Dominio: `aphillipsstore.com`.

- `index.html` — **panel interno** (PWA instalable): inventario, finanzas, clientes, contenido.
- `catalogo.html` — **catalogo publico**: los clientes ven relojes y escriben por WhatsApp.
  No hay carrito ni pedidos en linea: **todas las ventas se cierran por WhatsApp**.

## Reglas tecnicas

- Todo el JS son **modulos ES** (`<script type="module">`), sin bundler. Cada HTML carga primero
  el SDK **compat** de Firebase con `<script>` (global `window.firebase`) y despues su `main.js`.
- Los modulos **no funcionan abriendo el HTML con doble clic** (`file://`): hace falta un servidor
  (GitHub Pages, o uno local en `localhost`).
- Las funciones que se llaman desde atributos `onclick`/`oninput`/… del HTML (o de HTML generado
  en JS) se exponen al final de su modulo con `Object.assign(window, { ... })`. Si una funcion nueva
  se usa desde un atributo, hay que agregarla ahi.
- Un modulo **no puede reasignar** una variable importada de otro. Si hace falta, el modulo dueno
  exporta una funcion (p. ej. `limpiarFiltros()`, `detenerSync()`, `marcarSyncListo()`).
- Las claves de Firebase en `js/firebase.js` son publicas por diseno (el repo es publico).
  **La seguridad real esta en `firestore.rules`.** `OWNER_EMAIL` y el codigo TOTP solo deciden
  que se muestra en pantalla.

## Archivos

```
index.html            estructura del panel (sin CSS ni JS en linea)
catalogo.html         estructura del catalogo
manifest.json         PWA del panel
sw.js                 service worker (cache del "cascaron")
firestore.rules       reglas de seguridad (se publican a mano en la consola)
docs/PUBLICAR-REGLAS.md   pasos para publicar reglas y crear el admin
scripts/auditar-catalogo-publico.js   auditoria/limpieza manual de catalogo_publico (consola)
cloudflare/fotos-worker/   Worker que sube/borra fotos en R2 (api.aphillipsstore.com); fotos en fotos.aphillipsstore.com
img/                  logos, hero, generos y carrusel (antes iban en base64 dentro del HTML)
css/panel/            base, componentes, finanzas, auth, modales, movil (en ese orden)
css/catalogo/         base, tarjetas, paneles, generos, vistas, modal, buscador, hero,
                      destacados, listado, filtros, marcas, pie, hora (en ese orden)
js/firebase.js        configuracion unica de Firebase; exporta firebase y db
js/products.js        reglas de producto compartidas (ver "Reglas de negocio")
```

### Panel — `js/panel/`

| Archivo | Responsabilidad |
|---|---|
| `main.js` | Punto de entrada: importa todo, listeners de conexion y modales, arranque |
| `state.js` | Estado en memoria (`state`), `save()`, `saveMeta()`, `idAleatorio()`, `esPropietario()` |
| `nav.js` | Cambio de pestanas (`showPage`, `showInner`, `irARegistrar`) |
| `inicio.js` | Pantalla Inicio: resumen del mes, meta, pendientes, mini grafica, checklist |
| `catalogo-admin.js` | Pestana Catalogo: visibilidad, metricas, links al catalogo |
| `contenido.js` | Pestana Contenido: plan semanal e ideas |
| `sesion.js` | Login con correo/contrasena, recuperar contrasena, cerrar sesion |
| `respaldo.js` | Exportar/importar respaldo JSON |
| `pwa.js` | Boton "instalar app" y registro del service worker |
| `finanzas/fechas.js` | Helpers de fechas `d/m/aaaa` y meses |
| `finanzas/registrar-venta.js` | Selector de tipo y registrar venta desde el inventario |
| `finanzas/registrar-compra.js` | Registrar compra; `autoRegistrarCompraInv`, `existeCompraDe` |
| `finanzas/registrar-otros.js` | Gasto, retiro y traspaso entre metodos de pago |
| `finanzas/historial.js` · `resumen.js` · `analisis.js` · `finanzas.js` | Sub-pantallas de Finanzas y saldo por metodo |
| `inventario/lista.js` | Lista/vista por modelo, filtros, cambiar estado, eliminar |
| `inventario/formulario.js` | Registrar/editar/duplicar unidad, vista previa de margen |
| `inventario/fotos.js` | Varias fotos por unidad: se reducen a 1600 px (WebP/JPEG) y se suben a R2 por el Worker con el ID token de Firebase; orden y foto principal |
| `inventario/detalle.js` | Modal de detalle de una unidad |
| `inventario/venta-modal.js` | Modal "vender" desde el inventario |
| `inventario/reservas.js` | Reservar, abonos, completar y cancelar reserva |
| `inventario/transacciones.js` | `cambiarEstadoSeguro()`: transaccion anti venta doble |
| `clientes/clientes.js` | Alta/edicion/lista de clientes, `poblarSelectClientes` |
| `clientes/cliente-detalle.js` | Ficha del cliente, historial, "contactado hoy" |
| `sync/sync.js` | Envio de cambios a Firestore (`syncColeccion`, `syncConfig`, `forzarSyncTodo`) |
| `sync/listeners.js` | Escucha Firestore (`onSnapshot`) y refresca pantallas |
| `sync/catalogo-publico.js` | Mantiene `catalogo_publico` igual a lo publicable del inventario |
| `sync/estado-sync.js` | Indicador de sincronizacion e historial |
| `sync/espacio.js` | Espacio usado de Firestore (1 GB gratis) |
| `auth/totp.js` | Codigo de 6 digitos (TOTP) y codigos de respaldo |
| `auth/auth-overlay.js` | Pantallas del TOTP que protegen la pestana Sync |

### Catalogo — `js/catalogo/`

| Archivo | Responsabilidad |
|---|---|
| `main.js` | Punto de entrada (importa los modulos en orden) |
| `datos.js` | `relojes`: escucha `catalogo_publico` con `onSnapshot`; enlace directo `?id=` |
| `grid.js` | Dibuja la grilla de relojes (`render`), vista 1 o 2 columnas |
| `vistas.js` | Inicio vs. catalogo, genero (`#hombre`, `#mujer`, `#todos`), marca (`#marca-invicta`, `#marca-bulova`, `#marca-technomarine`: el reloj es de la marca si su nombre o coleccion la mencionan), descripcion |
| `filtros.js` | Panel de filtros (coleccion, movimiento, tamano, esfera, correa, caja), orden y `coincideBusqueda()` (busca cada palabra en todos los datos publicos, sin acentos) |
| `modal.js` | Pagina de un reloj (estilo TAG Heuer): barras desplegables con icono, garantias y boton de WhatsApp. Usa `descripcion` si existe; si no, `notas` o una descripcion armada con los datos |
| `favoritos.js` | Favoritos (en el navegador) y consulta multiple por WhatsApp |
| `whatsapp.js` | Numero, boton flotante, confirmaciones, cotizar |
| `metricas.js` | Suma vistas/aperturas/clics en `metricas_catalogo` |
| `destacados.js` | Carrusel de destacados (modelos fijos en `DEST_LOCAL`, imagenes en `img/`) |
| `buscador.js` | Panel de busqueda: resultados en vivo, "Ver todos"/Enter los pasa a la grilla, sugerencias |
| `cuenta.js` | Panel "Mi cuenta" (solo diseno, login de clientes pendiente) |
| `header.js` | Encabezado transparente sobre el hero y efecto de la portada al bajar |
| `menu.js` | Menu del celular (boton hamburguesa) |
| `reloj-vivo.js` | Reloj Invicta Pro Diver dibujado en SVG que marca la hora de Panama (UTC-5) en la seccion `#hora`; solo se anima cuando esta en pantalla |
| `ui.js` | `toast`, `vibrar`, escape de HTML |

## Colecciones de Firestore

| Coleccion | Contenido | Quien lee / escribe |
|---|---|---|
| `inventario/{id}` | Una unidad (reloj). **Privado** | Solo admin |
| `catalogo_publico/{id}` | Copia publica de las unidades publicables (mismo id que inventario) | Todos leen · admin escribe |
| `metricas_catalogo/{id}` | `vistas`, `aperturas`, `clics`, `_ultima` | Visitantes solo suman +1 · admin todo |
| `movimientos/{id}` | Ventas, compras, gastos, retiros, abonos, traspasos | Solo admin |
| `clientes/{id}` | Nombre, telefono, canal, producto de interes, notas | Solo admin |
| `config/main` | `meta`, `tasks`, `weekTasks`, `ideas` | Solo admin |
| `authSettings/{uid}` | Secreto TOTP y hashes de codigos de respaldo | Solo admin |

No hay coleccion de pedidos.

### `inventario/{id}`
`nombre, sku, coleccion, genero (hombre|mujer|unisex), mm, materialCaja, materialCorrea,
colorEsfera, movimiento, agua, cristal, color, descripcion, notas, fotos (URLs en R2, en orden), foto
(principal = fotos[0]; en unidades antiguas puede ser JPEG base64), eta (aaaa-mm-dd),
ocultoCatalogo` y **privados**: `costo, importacion (aduana/envio), costoTotal, precio (venta
objetivo), precioMin, margen (%), proveedor, serie, paqueteria, tracking, fecha (alta, d/m/aaaa),
precioVenta, fechaVenta, reserva {clienteId, clienteNombre, precioAcordado, fechaInicio,
abonos:[{monto, fecha, metodoPago}]}, estado, _ts`.

### `catalogo_publico/{id}`
Solo lo que devuelve `camposPublicos()` en `js/products.js`:
`nombre, sku, coleccion, genero, mm, materialCaja, materialCorrea, colorEsfera, movimiento, agua,
cristal, color, notas, descripcion, eta, precio, foto, fotos, estado, _ts`. **Ojo: `notas` y `descripcion` son publicos.**

### `movimientos/{id}`
`tipo` = `venta | compra | gasto | retiro | abono | traspaso | reserva_cancelada`, `desc, monto,
canal, metodoPago (efectivo|yappy|transferencia|tarjeta|otro), costo, precioObjetivo, categoria,
clienteId, clienteNombre, invId, metodoOrigen, metodoDestino, fecha (d/m/aaaa), _soloRegistro, _ts`.

## Estados de una unidad

| Estado | Significado | En el catalogo |
|---|---|---|
| `disponible` | En mano, a la venta | "Disponible" (verde), con precio, boton "Comprar" |
| `transito` | Comprado, en camino | "En tránsito" (amarillo); la pagina del reloj dice "Llega en N dias" (`eta`), boton "Apartar" |
| `bajopedido` | Se consigue al pedirlo | "Bajo pedido" (rojo), sin precio, boton "Cotizar" |
| `reservado` | Apartado por un cliente con abono | **No aparece** |
| `vendido` | Vendido | "Agotado" durante 21 dias, luego desaparece |

Orden en el catalogo: disponible → transito → bajo pedido → vendido (`ordenPeso`).

## Reglas de negocio

- **Que es publico**: `esPublicable(p)` — no oculto (`ocultoCatalogo`) y estado disponible,
  transito o bajo pedido; o vendido hace `DIAS_AGOTADO_VISIBLE` (21) dias o menos.
- **Sincronizacion del catalogo**: el panel escucha `catalogo_publico` y lo iguala a lo publicable
  del inventario (publica, actualiza y borra). Solo borra con datos confirmados por el servidor.
- **Venta doble imposible**: vender, reservar, completar y cancelar reserva pasan por
  `cambiarEstadoSeguro(id, estadoEsperado, cambios, quitar)` — una transaccion que solo escribe si
  el estado en la nube sigue siendo el que se veia en pantalla, y en la misma transaccion actualiza
  `catalogo_publico`. **Requiere internet**; sin conexion avisa y no registra nada.
- **Resto de cambios** (editar, gastos, clientes, tareas): se guardan en memoria y `save()` los
  envia a Firestore 1,2 s despues, comparando con lo ultimo sincronizado. Funcionan sin conexion
  (persistencia offline de Firestore).
- **Costo y margen**: `costoTotal = costo + importacion`; `margen = round((precio - costoTotal) / precio * 100)`.
  Colores: ≥30 % verde, ≥15 % ambar, menos rojo.
- **Compra automatica**: al registrar una unidad `disponible` con costo (o pasar de transito a
  disponible) se crea un movimiento `compra` si no existe ya uno para esa unidad.
- **Reparto de ganancia**: 40 % reinversion, 30 % personal, 30 % fondo operativo.
- **Reservas**: saldo = precio acordado − abonos. Completar crea una `venta` por el saldo (o un
  registro de monto 0 si ya estaba pagado). Cancelar permite devolver el abono (gasto "Reembolso")
  o retenerlo; siempre deja un movimiento `reserva_cancelada`.
- **Alertas en Inicio**: reserva con saldo pendiente; en transito hace mas de 20 dias; disponible
  hace mas de 45 dias ("Rebajar").
- **Genero**: los relojes `unisex` aparecen en hombre y en mujer.
- **WhatsApp**: numero en `js/catalogo/whatsapp.js` (`WHATSAPP_NUM`).
- **Metricas**: una vista por reloj por visita, apertura del detalle y clic a WhatsApp.

## Almacenamiento local (navegador)

Panel: `tasks`, `meta`, `weekTasks`, `ideas` (copia de `config/main`), `lastSync`, `syncHistory`,
`lastExportISO`, `authTotpPendiente`. Catalogo: `aphillips_favoritos`.

## Service worker (`sw.js`)

- Red primero (con `cache: 'no-cache'`); sin internet responde desde el cache.
- Precarga la lista `SHELL_FILES` (HTML, CSS, JS, logos). Las fotos grandes se guardan al verse.
- No toca Firebase, fuentes ni CDNs.
- **Al publicar cambios: sube `CACHE_NAME`** (`aphillips-v2` → `aphillips-v3`…) y, si agregas o
  renombras archivos en `/css` o `/js`, actualiza `SHELL_FILES`.

## Seguridad

`firestore.rules` (publicar a mano, ver `docs/PUBLICAR-REGLAS.md`): el admin se identifica por
**UID**. Visitantes: leer `catalogo_publico` y sumar +1 a metricas de relojes publicados. Todo lo
demas, solo admin. Si se agrega una coleccion nueva, hay que darle su regla (sin regla = denegado).
