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
