# Arquitectura de APHILLIPS STORE

Web de reventa de relojes publicada en **GitHub Pages** (rama `main`), sin herramientas de
compilacion. **Cloudflare** (ver `cloudflare/README.md`) guarda los datos del panel (D1), las fotos
(R2), el catalogo publico y las metricas. **Firebase Auth** es solo el login del panel. **Firestore**
quedo como archivo historico de solo lectura (ya no se escribe). Dominio: `aphillipsstore.com`.

- `index.html` — **panel interno** (PWA instalable): inventario, finanzas, clientes, contenido.
- `catalogo.html` — **catalogo publico**: los clientes ven relojes y escriben por WhatsApp.
  No hay carrito ni pedidos en linea: **todas las ventas se cierran por WhatsApp**.

## Reglas tecnicas

- Todo el JS son **modulos ES** (`<script type="module">`), sin bundler. `index.html` carga primero
  el SDK **compat** de Firebase (app + auth) con `<script>` (global `window.firebase`) y despues su
  `main.js`. `catalogo.html` no usa Firebase.
- Los modulos **no funcionan abriendo el HTML con doble clic** (`file://`): hace falta un servidor
  (GitHub Pages, o uno local en `localhost`).
- Las funciones que se llaman desde atributos `onclick`/`oninput`/… del HTML (o de HTML generado
  en JS) se exponen al final de su modulo con `Object.assign(window, { ... })`. Si una funcion nueva
  se usa desde un atributo, hay que agregarla ahi.
- Un modulo **no puede reasignar** una variable importada de otro. Si hace falta, el modulo dueno
  exporta una funcion (p. ej. `limpiarFiltros()`, `detenerSync()`, `marcarSyncListo()`).
- Las claves de Firebase en `js/firebase.js` son publicas por diseno (el repo es publico).
  **La seguridad real esta en el Worker** (`cloudflare/fotos-worker`): verifica el ID token de
  Firebase y que sea el UID del dueno (`OWNER_UID`). `OWNER_EMAIL` y el codigo TOTP solo deciden
  que se muestra en pantalla.

## Archivos

```
index.html            estructura del panel (sin CSS ni JS en linea)
catalogo.html         estructura del catalogo
manifest.json         PWA del panel
sw.js                 service worker (cache del "cascaron")
firestore.rules       reglas del archivo historico de Firestore: solo lectura del admin (se publican a mano)
docs/PUBLICAR-REGLAS.md   pasos para publicar reglas y crear el admin
scripts/auditar-catalogo-publico.js   (historico) auditoria de catalogo_publico en Firestore
cloudflare/fotos-worker/   Worker que sube/borra fotos en R2 (api.aphillipsstore.com); fotos en fotos.aphillipsstore.com
img/                  logos, hero, generos y carrusel (antes iban en base64 dentro del HTML)
css/panel/            base, componentes, finanzas, auth, modales, movil (en ese orden)
css/catalogo/         base, tarjetas, paneles, generos, vistas, modal, buscador, hero,
                      destacados, listado, filtros, marcas, pie, hora (en ese orden)
js/firebase.js        configuracion de Firebase (solo Auth); exporta firebase
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
| `respaldo.js` | Exportar/importar respaldo JSON; respaldos automaticos de Cloudflare (listar, descargar, hacer uno ahora) |
| `pwa.js` | Boton "instalar app" y registro del service worker |
| `finanzas/fechas.js` | Helpers de fechas `d/m/aaaa` y meses |
| `finanzas/registrar-venta.js` | Selector de tipo y registrar venta desde el inventario |
| `finanzas/registrar-compra.js` | Registrar compra; `autoRegistrarCompraInv`, `existeCompraDe` |
| `finanzas/registrar-otros.js` | Gasto, retiro y traspaso entre metodos de pago |
| `finanzas/historial.js` · `resumen.js` · `analisis.js` · `finanzas.js` | Sub-pantallas de Finanzas y saldo por metodo |
| `inventario/lista.js` | Lista/vista por modelo, filtros, cambiar estado, eliminar |
| `inventario/formulario.js` | Registrar/editar/duplicar unidad, vista previa de margen |
| `inventario/fotos.js` | Varias fotos por unidad: se reducen a 1600 px (WebP/JPEG) y se suben a R2 por el Worker con el ID token de Firebase; orden y foto principal. De cada una sube ademas una copia JPEG (1200 px, < 600 KB) para la vista previa en WhatsApp (`fotosJpg`, y la de la principal en `fotoCompartir`) |
| `inventario/detalle.js` | Modal de detalle de una unidad |
| `inventario/venta-modal.js` | Modal "vender" desde el inventario |
| `inventario/reservas.js` | Reservar, abonos, completar y cancelar reserva |
| `inventario/transacciones.js` | `cambiarEstadoSeguro()`: transaccion anti venta doble |
| `clientes/clientes.js` | Alta/edicion/lista de clientes, `poblarSelectClientes` |
| `clientes/cliente-detalle.js` | Ficha del cliente, historial, "contactado hoy" |
| `clientes/cuentas-web.js` | Cuentas de clientes del catalogo: avisos pendientes (un toque abre WhatsApp con el mensaje y lo marca enviado) y vincular cada cuenta con un cliente del panel |
| `sync/nube.js` | Datos del panel en Cloudflare: carga, cambios cada 10 s, envio de diferencias, cola sin internet (IndexedDB), `cambiarEstadoNube` |
| `sync/sync.js` | `save()` -> `syncColeccion`/`syncConfig`: envia a Cloudflare |
| `sync/listeners.js` | Arranque de los datos al iniciar sesion, metricas (y su importacion unica desde Firestore); refresca pantallas |
| `sync/catalogo-publico.js` | Publica en Cloudflare (`PUT /catalogo`) la lista de relojes publicables, solo `camposPublicos` |
| `sync/estado-sync.js` | Indicador de sincronizacion e historial |
| `sync/espacio.js` | Espacio usado estimado (D1, 500 MB gratis) |
| `auth/totp.js` | Codigo de 6 digitos (TOTP) y codigos de respaldo |
| `auth/auth-overlay.js` | Pantallas del TOTP que protegen la pestana Sync |

### Catalogo — `js/catalogo/`

| Archivo | Responsabilidad |
|---|---|
| `main.js` | Punto de entrada (importa los modulos en orden) |
| `datos.js` | `relojes`: lee `GET /catalogo` de Cloudflare cada minuto (304 si no cambio); guarda la ultima lista en el navegador por si falla; enlace directo `?id=` |
| `grid.js` | Dibuja la grilla de relojes (`render`), vista 1 o 2 columnas |
| `vistas.js` | Inicio vs. catalogo, genero (`#hombre`, `#mujer`, `#todos`), marca (`#marca-invicta`, `#marca-bulova`, `#marca-technomarine`: el reloj es de la marca si su nombre o coleccion la mencionan), descripcion |
| `filtros.js` | Panel de filtros (coleccion, movimiento, tamano, esfera, correa, caja), orden y `coincideBusqueda()` (busca cada palabra en todos los datos publicos, sin acentos) |
| `modal.js` | Pagina de un reloj (estilo TAG Heuer): barras desplegables con icono, garantias y boton de WhatsApp. Usa `descripcion` si existe; si no, `notas` o una descripcion armada con los datos |
| `favoritos.js` | Favoritos (en el navegador) y consulta multiple por WhatsApp |
| `whatsapp.js` | Numero, boton flotante, confirmaciones, cotizar |
| `metricas.js` | Junta vistas/aperturas/clics y los envia a Cloudflare (`POST /metricas`) cada 20 s y al salir |
| `destacados.js` | Carrusel de destacados (modelos fijos en `DEST_LOCAL`, imagenes en `img/`) |
| `buscador.js` | Panel de busqueda: resultados en vivo, "Ver todos"/Enter los pasa a la grilla, sugerencias |
| `cuenta.js` | "Mi cuenta": login con Google o con correo y contrasena (con verificacion de correo obligatoria; Firebase Auth, el SDK se descarga solo al abrir el panel o si ya habia sesion), perfil y WhatsApp, avisos ("Avisame" en un reloj o una marca), compras y apartados, favoritos en la nube. Con la cuenta del dueno: ir al panel, metricas y opciones de desarrollador (estado del sistema, no contar mis visitas, forzar actualizacion, respaldo) |
| `sesion.js` | Estado de la sesion del cliente (`sesion`, `saludo()` para los mensajes de WhatsApp, `tieneAviso`) sin dependencias |
| `header.js` | Encabezado transparente sobre el hero y efecto de la portada al bajar |
| `menu.js` | Menu del celular (boton hamburguesa) |
| `reloj-vivo.js` | Reloj Invicta Pro Diver dibujado en SVG que marca la hora de Panama (UTC-5) en la seccion `#hora`; solo se anima cuando esta en pantalla |
| `ui.js` | `toast`, `vibrar`, escape de HTML |

## Datos (Cloudflare D1, tabla `docs`; ver `cloudflare/README.md`)

| Coleccion (`col`) | Contenido | Quien lee / escribe |
|---|---|---|
| `inventario/{id}` | Una unidad (reloj). **Privado** | Solo admin |
| `movimientos/{id}` | Ventas, compras, gastos, retiros, abonos, traspasos | Solo admin |
| `clientes/{id}` | Nombre, telefono, canal, producto de interes, notas | Solo admin |
| `config/main` | `meta`, `tasks`, `weekTasks`, `ideas` | Solo admin |
| `authSettings/{uid}` | Secreto TOTP y hashes de codigos de respaldo | Solo admin |

Ademas: catalogo publico en R2 (`publico/catalogo.json`, todos leen, admin publica) y metricas en
D1 (tabla `metricas`: visitantes suman, admin lee). Firestore guarda la copia antigua de todo esto
(`catalogo_publico`, `metricas_catalogo`...) solo como archivo.

No hay coleccion de pedidos.

### `inventario/{id}`
`nombre, sku, coleccion, genero (hombre|mujer|unisex), mm, materialCaja, materialCorrea,
colorEsfera, movimiento, agua, cristal, color, descripcion, notas, fotos (URLs en R2, en orden), foto
(principal = fotos[0]), fotoCompartir (JPEG de la principal para la vista previa del link),
fotosJpg (privado: {urlFoto: urlJpeg}), eta (aaaa-mm-dd),
ocultoCatalogo` y **privados**: `costo, importacion (aduana/envio), costoTotal, precio (venta
objetivo), precioMin, margen (%), proveedor, serie, paqueteria, tracking, fecha (alta, d/m/aaaa),
precioVenta, fechaVenta, reserva {clienteId, clienteNombre, precioAcordado, fechaInicio,
abonos:[{monto, fecha, metodoPago}]}, estado, _ts`.

### Catalogo publico (`GET /catalogo`)
Solo lo que devuelve `camposPublicos()` en `js/products.js`:
`nombre, sku, coleccion, genero, mm, materialCaja, materialCorrea, colorEsfera, movimiento, agua,
cristal, color, notas, descripcion, eta, precio, foto, fotos, fotoCompartir, estado, _ts`. **Ojo: `notas` y `descripcion` son publicos.**

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
- **Sincronizacion del catalogo**: despues de cada envio del inventario, el panel publica la lista
  completa de relojes publicables (`PUT /catalogo`); solo con el inventario ya cargado de la nube.
- **Venta doble imposible**: vender, reservar, completar y cancelar reserva pasan por
  `cambiarEstadoSeguro(id, estadoEsperado, cambios, quitar)` -> `POST /datos/estado`: el Worker solo
  escribe si el estado en la nube sigue siendo el que se veia en pantalla (y condicionado a la
  huella leida); 409 si cambio en otro dispositivo. **Requiere internet**; sin conexion avisa y no registra nada.
- **Resto de cambios** (editar, gastos, clientes, tareas): se guardan en memoria y `save()` los
  envia a Cloudflare 1,2 s despues, comparando con lo ultimo que confirmo la nube. Funcionan sin
  conexion: quedan en IndexedDB y se envian al volver. Si otro dispositivo cambio el mismo documento,
  gana el cambio que todavia no se habia enviado (se envia despues).
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
- **Metricas**: una vista por reloj por visita, apertura del detalle y clic a WhatsApp. No cuentan si
  `localStorage.aphillips_no_contar = '1'` (se activa solo con la cuenta del dueno).
- **Cuentas de clientes**: login con Google; cada cliente solo ve y cambia lo suyo (el Worker lo
  filtra por el UID del token). Avisos: el panel calcula cuales ya se pueden enviar (reloj publicable
  y `disponible` que antes no lo estaba o bajo de precio; o relojes nuevos de la marca desde el ultimo
  aviso) y el dueno los manda por WhatsApp. Compras y apartados solo si el dueno vinculo la cuenta a
  un cliente del panel; nunca se muestran costos ni datos privados. El catalogo recupera la sesion
  del panel (mismo dominio) para mostrar las opciones de administrador.

## Almacenamiento local (navegador)

Panel: `tasks`, `meta`, `weekTasks`, `ideas` (copia de `config/main`), `lastSync`, `syncHistory`,
`lastExportISO`, `authTotpPendiente`; IndexedDB `aphillips-panel` (datos + cambios sin enviar).
Catalogo: `aphillips_favoritos`, `aphillips_catalogo` (ultima lista de relojes), `aphillips_sesion`
(hay sesion: cargar Firebase Auth al abrir), `aphillips_no_contar`.

## Service worker (`sw.js`)

- Red primero (con `cache: 'no-cache'`); sin internet responde desde el cache.
- Precarga la lista `SHELL_FILES` (HTML, CSS, JS, logos). Las fotos grandes se guardan al verse.
- No toca Firebase, fuentes ni CDNs.
- **Al publicar cambios: sube `CACHE_NAME`** (`aphillips-v2` → `aphillips-v3`…) y, si agregas o
  renombras archivos en `/css` o `/js`, actualiza `SHELL_FILES`.

## Seguridad

El Worker de la API (`cloudflare/fotos-worker`) protege todo: las rutas de admin exigen el ID token
de Firebase del UID del dueno (`OWNER_UID`). Visitantes: solo `GET /catalogo` y `POST /metricas`
(solo ids del catalogo). El catalogo publico pasa por `CAMPOS_PUBLICOS` en el Worker.
`firestore.rules` (publicar a mano): Firestore es solo lectura para el admin y nadie escribe.
