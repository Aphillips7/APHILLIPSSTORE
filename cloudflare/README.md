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
| `GET /catalogo` | publico | Copia del catalogo (R2 `publico/catalogo.json`, cache 30 s). La lee `js/catalogo/datos.js`; si falla, el catalogo usa Firestore. |
| `PUT /catalogo` | admin | La publica el panel despues de cada sincronizacion. El Worker solo deja pasar campos publicos. |
| `POST /metricas` | publico | Lote de `[id, "vistas"|"aperturas"|"clics"]` (texto JSON). Solo ids del catalogo; max 1 de cada tipo por reloj y envio. |
| `GET /metricas` | admin | Metricas guardadas en D1 (`aphillips-db`, tabla `metricas`). El panel las suma a las antiguas de Firestore. |

Base de datos D1 `aphillips-db`: migraciones en `fotos-worker/migrations/`
(`npx wrangler@4 d1 migrations apply aphillips-db --remote`).

## Tienda (`aphillipsstore.com`)

Worker `aphillipsstore` (configuracion en `/wrangler.jsonc`, codigo en `tienda-worker/`), conectado a
GitHub: cada push a `main` se publica solo. `/` = catalogo, `/admin` = panel.
