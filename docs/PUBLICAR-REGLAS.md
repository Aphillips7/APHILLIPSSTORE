# Publicar las reglas de Firestore y crear el usuario admin

Proyecto: **aphillips-store-733df** · Consola: https://console.firebase.google.com/project/aphillips-store-733df

Las reglas nuevas son compatibles con la version actual de la web **y** con la nueva,
asi que puedes publicarlas ya, sin esperar a pasar la rama a `main`.

---

## 1. Cerrar el registro de cuentas y el acceso anonimo

1. **Authentication → Sign-in method**
   - Deja activo solo **Correo electronico/contrasena**.
   - Si **Anonimo** (o cualquier otro proveedor) esta activo: abrelo y desactivalo.
2. **Authentication → Settings → User actions**
   - Desmarca **Enable create (sign-up)** — nadie mas podra crearse una cuenta con tu config publica.
   - Desmarca **Enable delete**.
   - Deja marcada **Email enumeration protection**.
   - Guarda.

## 2. Crear (o ubicar) tu usuario admin y copiar su UID

1. **Authentication → Users**.
2. Si ya existe `aphillipsstore@gmail.com` (es con el que entras hoy al panel), no hagas nada mas que copiar su UID.
   Si no existe: **Add user** → correo `aphillipsstore@gmail.com` + una contrasena larga y unica → **Add user**.
3. Copia el valor de la columna **User UID** de esa fila (algo como `x8Kq...F2`).
4. Si en la lista hay otros usuarios que no reconoces (por ejemplo anonimos), eliminalos (menu ⋮ → Delete account).

## 3. Poner tu UID en las reglas

Abre `firestore.rules` y reemplaza `PEGA_AQUI_TU_UID` por el UID copiado:

```
return request.auth != null && request.auth.uid == 'x8Kq...F2';
```

(Se usa el UID y no el correo porque el UID no se puede falsificar ni reutilizar.)

## 4. Probar ANTES de publicar (Rules Playground)

1. **Firestore Database → Reglas**.
2. Borra todo el contenido del editor y pega el `firestore.rules` completo (ya con tu UID). **Todavia no publiques.**
3. Pulsa **Rules Playground** (o "Zona de pruebas de reglas") y prueba estos casos:

| # | Tipo | Ruta | Autenticado | Resultado esperado |
|---|------|------|-------------|--------------------|
| 1 | get | `catalogo_publico/cualquiera` | No | ✅ Permitido |
| 2 | get | `inventario/cualquiera` | No | ❌ Denegado |
| 3 | get | `clientes/cualquiera` | No | ❌ Denegado |
| 4 | get | `authSettings/cualquiera` | No | ❌ Denegado |
| 5 | get | `inventario/cualquiera` | Si, con **tu UID** | ✅ Permitido |
| 6 | get | `inventario/cualquiera` | Si, con otro UID (ej. `abc123`) | ❌ Denegado |
| 7 | create | `catalogo_publico/x` | No | ❌ Denegado |
| 8 | get | `metricas_catalogo/x` | No | ❌ Denegado |

Para el caso 5/6: activa "Authenticated", proveedor "password" y escribe el UID en "Firebase UID".
Si algun resultado no coincide, **no publiques** y avisame.

## 5. Publicar

Pulsa **Publicar**. Tarda hasta un minuto en aplicarse.

## 6. Comprobar que todo sigue funcionando

1. Abre el **panel**, inicia sesion: debe cargar inventario, finanzas y clientes como siempre
   (arriba debe decir "Sincronizado" o "Conectado").
2. Abre el **catalogo** en una ventana de incognito: deben verse los relojes.
3. Abre el catalogo, toca un reloj y vuelve al panel → pestana Catalogo: las vistas/aperturas deben subir.

Si el panel muestra **"Sin permiso: esta cuenta no es la del administrador"**, el UID en las reglas
no coincide con tu usuario: revisa el paso 3 y vuelve a publicar.

**Si algo sale mal**: en Firestore → Reglas hay un historial; puedes volver a la version anterior en un clic.

---

## Opcional (recomendado): limitar la clave de API a tu dominio

No reemplaza a las reglas, pero evita que otros usen tu clave desde sus sitios.

1. https://console.cloud.google.com/apis/credentials?project=aphillips-store-733df
2. Abre la clave "Browser key (auto created by Firebase)".
3. **Application restrictions → Websites** y agrega:
   - `https://aphillips7.github.io/*`
   - `https://aphillips-store-733df.firebaseapp.com/*` (lo usa el login de Firebase)
   - tu dominio propio, si la web se abre con uno (ej. `https://tudominio.com/*`)
   - `http://localhost/*` (solo si pruebas en tu computadora)
4. Guarda. Comprueba que el panel y el catalogo siguen cargando.

## Que protegen las reglas

| Coleccion | Visitante (sin sesion) | Tu (admin) |
|-----------|------------------------|------------|
| `catalogo_publico` | Leer | Leer y escribir |
| `metricas_catalogo` | Solo sumar +1 a vistas/aperturas/clics de un reloj publicado | Todo |
| `inventario`, `movimientos`, `clientes`, `config`, `authSettings` | Nada | Todo |
| Cualquier otra | Nada | Nada |

No existen pedidos en la web (todo se vende por WhatsApp), asi que no hay coleccion de pedidos
que los visitantes puedan crear. Si en el futuro se agrega, hay que sumar su regla aqui.
