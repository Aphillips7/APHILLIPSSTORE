# Cloudflare

Servicios de Aphillips Store que viven en Cloudflare (cuenta aphillipsstore@gmail.com).

| Recurso | Donde | Para que |
|---|---|---|
| Dominio | `aphillipsstore.com` | Dominio de la tienda |
| R2 `aphillips-photos` | `https://fotos.aphillipsstore.com/<clave>` | Fotos de los relojes (publicas) |
| Worker `aphillips-fotos` | `https://api.aphillipsstore.com` | Subir / borrar fotos desde el panel (solo el admin) |

## Worker de fotos (`fotos-worker/`)

- `POST /fotos?reloj=<id>` con la imagen en el cuerpo (WebP/JPEG/PNG, max 4 MB) y
  `Authorization: Bearer <ID token de Firebase>` → `{ url, clave }`.
- `DELETE /fotos?clave=relojes/<id>/<archivo>` → borra la foto.
- `GET /salud` → `{ ok: true }`.
- Solo acepta el token de Firebase del proyecto `aphillips-store-733df` cuyo usuario sea `OWNER_UID`.
- Solo responde CORS a los origenes de `ORIGENES_PERMITIDOS` (wrangler.jsonc).

Publicar (desde `cloudflare/fotos-worker/`, requiere Node.js):

```
npx wrangler@4 login          # una sola vez, abre el navegador
npx wrangler@4 deploy
npx wrangler@4 secret put OWNER_UID   # pega tu UID de Firebase (Authentication > Users)
```

Las fotos se guardan como `relojes/<id del reloj>/<fecha>-<aleatorio>.<ext>` con cache de un ano.

## API (mismo Worker: `api.aphillipsstore.com`)

| Ruta | Quien | Para que |
|---|---|---|
| `GET /catalogo` | publico | Copia del catalogo (R2 `publico/catalogo.json`, cache 30 s). La lee `js/catalogo/datos.js`; si falla, el catalogo muestra la ultima lista guardada en el navegador. Responde 304 con ETag si no cambio. |
| `PUT /catalogo` | admin | La publica el panel despues de cada sincronizacion. El Worker solo deja pasar campos publicos. |
| `POST /metricas` | publico | Lote de `[id, "vistas"|"aperturas"|"clics"]` (texto JSON). Solo ids del catalogo; max 1 de cada tipo por reloj y envio. |
| `GET /metricas` | admin | Metricas guardadas en D1 (`aphillips-db`, tabla `metricas`). Incluye `importado` (si ya se sumaron las antiguas de Firestore). |
| `POST /metricas/importar` | admin | Suma una sola vez las metricas antiguas de Firestore (marca en tabla `ajustes`). |
| `GET /datos?desde=n` | admin | Datos del panel (tabla `docs`) cambiados despues de la version `n`. `completo:false` = pedir de nuevo. |
| `GET /datos/resumen` | admin | Huellas SHA-256 de cada documento (lo usa la copia de `espejo-cloudflare.js`). |
| `POST /datos/lote` | admin | `{ops:[{col,id,json}|{col,id,borrar:true}]}`, max 200, todo o nada. Borrar conserva el contenido (`borrado=1`). |
| `POST /datos/estado` | admin | Vender/reservar sin venta doble: comprueba `estadoEsperado` y escribe condicionado a la huella; 409 si cambio. |

| `GET /respaldos` | admin | Lista de respaldos automaticos (bucket privado `aphillips-respaldos`). |
| `GET /respaldos/archivo?nombre=` | admin | Descarga un respaldo (formato de "Exportar respaldo" + authSettings, metricas y borrados). |
| `POST /mantenimiento` | admin | Hace ahora el respaldo y la limpieza (lo mismo que el cron). |

**Tarea diaria** (cron `0 8 * * *` = 3:00 a. m. Panama): respaldo en `aphillips-respaldos/respaldos/AAAA-MM-DD.json`
(se borran los de mas de 120 dias) y borrado de fotos de `relojes/` que ningun reloj usa desde hace mas de 30 dias
(si no hay relojes, no borra nada). El bucket de respaldos NO tiene dominio publico: tiene datos privados.

**Vista previa de links** (`?id=<reloj>`): el Worker de la tienda lee el catalogo por el service binding `API`
y cambia `og:title`, `og:description` y `og:image` (usa `fotoCompartir`, JPEG) con HTMLRewriter.

Colecciones en `docs`: `inventario`, `movimientos`, `clientes`, `config` (doc `main`), `authSettings`.
Para recuperar algo borrado o volver atras: D1 Time Travel (`npx wrangler@4 d1 time-travel restore aphillips-db --timestamp=...`)
o tus respaldos JSON del panel (Firestore ya no recibe copias; queda como archivo hasta el 10/10/2026).

Base de datos D1 `aphillips-db`: migraciones en `fotos-worker/migrations/`
(`npx wrangler@4 d1 migrations apply aphillips-db --remote`).

## Tienda (`aphillipsstore.com`)

Worker `aphillipsstore` (configuracion en `/wrangler.jsonc`, codigo en `tienda-worker/`), conectado a
GitHub: cada push a `main` se publica solo. `/` = catalogo, `/admin` = panel.
