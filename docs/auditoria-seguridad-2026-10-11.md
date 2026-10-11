# Auditoría de seguridad — APHILLIPS STORE

**Fecha:** 2026-10-11
**Alcance:** revisión estática de código de todo el repositorio (tienda web + panel admin).
**Método:** OWASP API Security Top 10 y revisión de código seguro, apoyado en la librería
`anthropic-cybersecurity-skills` (skills `conducting-api-security-testing`,
`exploiting-sql-injection`, `detecting-broken-object-property-level-authorization`,
`exploiting-jwt-algorithm-confusion-attack`, `implementing-api-key-security-controls`).
No se lanzó ninguna herramienta contra producción ni se tocaron datos reales.

## Veredicto general

El backend está **bien construido**. La autenticación, la autorización y la capa de datos
siguen buenas prácticas. Los hallazgos son en su mayoría de **defensa en profundidad**, no
agujeros explotables por un visitante anónimo. Prioridad real: añadir CSP y escapar el
catálogo en `grid.js`.

| # | Severidad | Área | Hallazgo |
|---|-----------|------|----------|
| 1 | Media | Cabeceras | No hay `Content-Security-Policy` en ninguna página |
| 2 | Media–Baja | XSS | `grid.js` inserta campos del catálogo sin escapar (a diferencia de `modal.js`) |
| 3 | Baja | Validación | `publicarCatalogo` no valida el formato del `id` del reloj |
| 4 | Baja | Abuso | `POST /metricas` (público) no tiene límite de tasa |
| 5 | Info | Auth | TOTP del panel es solo cliente (correcto, pero conviene documentarlo) |
| 6 | Info | Config | `firestore.rules` con el marcador `PEGA_AQUI_TU_UID` (seguro por diseño "fail-closed") |

---

## Hallazgos

### 1. Falta Content-Security-Policy — Media

`cloudflare/tienda-worker/index.js` → `conCabeceras()` añade `X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options` y `X-Robots-Tag`, pero **ninguna página tiene CSP**.
Una CSP es la principal red de seguridad contra XSS (mitiga el hallazgo #2) y contra la
inyección de scripts de terceros.

**Complicación:** el catálogo y el panel usan muchos `onclick=` en línea y cargan el SDK de
Firebase desde CDN, así que una CSP estricta con `script-src 'self'` rompería la página. Opciones:
- Mínimo viable hoy: restringir lo que no depende de scripts en línea —
  `default-src 'self'; img-src 'self' https://api.aphillipsstore.com data:; connect-src 'self' https://api.aphillipsstore.com https://*.googleapis.com https://securetoken.googleapis.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'`.
- Para cubrir también el JS: migrar los `onclick` en línea a `addEventListener` y luego poner
  `script-src 'self' https://www.gstatic.com` (CDN de Firebase). Es el paso que de verdad cierra el XSS.

**Dónde:** añadir `h.set('Content-Security-Policy', ...)` en `conCabeceras()`.

### 2. XSS en el catálogo público (`js/catalogo/grid.js`) — Media–Baja

`modal.js` escapa todos los campos con `esc()` (de `ui.js`). **`grid.js` no escapa ninguno**:
concatena `r.foto`, `r.nombre`, `r.id`, `r.sku`, `r.coleccion`, `r.movimiento`, `r.materialCaja`
y `r.precio` directamente dentro de `innerHTML` (líneas ~43–66).

```js
var foto = r.foto ? '<img src="'+r.foto+'" ... />' : ...;      // r.foto sin escapar en un atributo
'<div class="ci-nombre">'+(r.nombre||'')+'</div>'              // r.nombre sin escapar
'onclick="abrir(\''+r.id+'\')"'                                // r.id dentro de un string JS
```

Los datos del catálogo los controla el admin (el Worker filtra **qué** campos salen con
`CAMPOS_PUBLICOS`, pero no **sanea su contenido**). Impacto:
- **Integridad:** un nombre con comilla `"` ya rompe el HTML (bug visible sin malicia).
- **Seguridad:** un valor como `" onerror="alert(1)` en `foto`, o `<img>`/handler en un campo de
  texto, ejecuta script en el navegador de **todos los visitantes** (XSS almacenado).

**Arreglo:** usar el mismo `esc()` que ya usa `modal.js` para cada campo, y para `r.id` en
contextos `onclick` escapar comillas igual que hace `modal.js` con el SKU. Ejemplo:

```js
import { _destEsc as esc } from './ui.js';
// ...
var foto = r.foto ? '<img src="'+esc(r.foto)+'" alt="" loading="lazy" ... />' : '<span class="sinfoto">Sin foto</span>';
'<div class="ci-nombre">'+esc(r.nombre||'')+'</div>'
```
Aplica igual a `buscador.js` (línea 73) y `favoritos.js` (línea 56), que construyen tarjetas igual que `grid.js`.
*(OWASP A03 Injection / API8:2023 Security Misconfiguration.)*

### 3. `publicarCatalogo` no valida el formato del `id` — Baja

En `fotos-worker/src/index.js` → `publicarCatalogo()` solo se exige
`typeof r.id === 'string' && r.id`. El resto del código usa `RE_ID = /^[A-Za-z0-9_-]{1,120}$/`
para los ids. Como ese `id` termina insertado en contextos `onclick`/atributos (hallazgo #2),
conviene validarlo también al publicar:

```js
.filter((r) => r && typeof r.id === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(r.id))
```

### 4. `POST /metricas` sin límite de tasa — Baja

La ruta pública de métricas valida ids contra el catálogo y topa a 300 eventos por petición,
pero no limita cuántas peticiones por IP. Alguien podría inflar los contadores de vistas/clics.
Impacto solo en la calidad de las métricas (no hay dato sensible). Si molesta, reutilizar
`dentroDelLimite()` con la IP (ya existe para los correos).

### 5. TOTP del panel es solo del lado del cliente — Informativo (no es fallo)

`js/panel/auth/totp.js` lo dice: es "una capa extra de interfaz, no de seguridad". **Correcto**,
porque la frontera real la impone el Worker verificando el ID token y `OWNER_UID` en cada ruta
de admin. Notas menores: la ventana de validación es ±2 pasos (±60 s); se podría bajar a ±1
(±30 s). No cuenta como control de seguridad porque un atacante nunca llega al Worker sin la
sesión del dueño.

### 6. `firestore.rules` con marcador `PEGA_AQUI_TU_UID` — Informativo

Tal cual, `esAdmin()` compara contra un UID que nadie tiene → lectura denegada a todos y
escritura cerrada (`allow write: if false`). Es **seguro por "fail-closed"**. Recordatorio:
cuando pongas tu UID real, no relajes la lectura a algo más amplio. Confirma que la versión
publicada en Firebase Console sea esta (se publica a mano).

---

## Lo que está bien hecho (controles verificados)

- **Verificación de JWT correcta** (`verificarSesionFirebase`): exige `alg === 'RS256'` (rechaza
  `alg:none` y la confusión RS256→HS256), valida `kid`, `aud`, `iss`, `exp`, `iat` y la firma
  contra las llaves públicas de Google (JWKS con caché). Resistente a los ataques típicos de JWT.
- **Sin inyección SQL:** todas las consultas D1 usan parámetros (`bind`), incluido `json_extract`.
- **Autorización por objeto (anti-BOLA):** cada cliente solo ve/edita lo suyo, tomando el `uid`
  del token verificado, nunca de un parámetro del cliente. Las rutas de admin exigen `OWNER_UID`.
- **Anti mass-assignment:** doble lista blanca `CAMPOS_PUBLICOS` (cliente y servidor) evita que
  salgan costo, proveedor, margen, serie o tracking al catálogo público.
- **Saneo de entrada:** `limpiarTexto()` quita `<`, `>` y caracteres de control → neutraliza el
  XSS almacenado contra el panel desde los datos de cuenta.
- **Recuperación de contraseña:** protección contra enumeración de correos (responde `ok` exista
  o no la cuenta) y límite de tasa por IP y por correo.
- **Concurrencia:** cambios de estado con huella (`hash`) para evitar venta doble entre dispositivos.
- **Subida de fotos:** valida tipo MIME, tamaño (4 MB real, no solo `Content-Length`) y el nombre
  de la clave R2. Respaldos en bucket privado.
- **Secretos:** no hay claves privadas ni `.dev.vars` en git; la `apiKey` de Firebase es pública
  por diseño (bien documentado). `.gitignore` cubre `.dev.vars`, `node_modules` y `.wrangler`.
- **Cabeceras:** `nosniff`, `Referrer-Policy`, y en el panel `X-Frame-Options: DENY` + `noindex`.

---

## Plan sugerido (orden de impacto)

1. Escapar los campos en `grid.js`, `buscador.js`, `favoritos.js` con `esc()` *(hallazgo #2 — rápido)*.
2. Validar el `id` en `publicarCatalogo` *(#3 — una línea)*.
3. Añadir CSP en `conCabeceras()`, empezando por la versión mínima *(#1)*.
4. (Opcional) límite de tasa en `/metricas` *(#4)* y ventana TOTP a ±1 *(#5)*.
5. Confirmar la versión publicada de `firestore.rules` con tu UID real *(#6)*.
