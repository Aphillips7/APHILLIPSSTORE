# Plan de rediseno del panel admin (aprobado por el dueno el 2026-10-24)

Decisiones del dueno:
- En el panel NO va la mascota.
- Todo lo demas lo decide Claude "de manera profesional, como un ingeniero comercial capacitado que
  necesita llevar la empresa al siguiente nivel": mejorar todo lo necesario y quitar o fusionar
  secciones si conviene.
- Publicar en vivo requiere el "si" del dueno (memoria migracion-cloudflare). Se trabaja en ramas,
  se verifica local con capturas y se deja todo listo; se publica cuando el dueno diga "si".

## Reglas para todas las fases
- Una rama por fase (`panel-f1-colores`, `panel-f2-navegacion`...), merge `--no-ff` a main al terminar.
- Modulos ES puros, sin compilacion; graficas en SVG propio (sin librerias, funciona sin internet).
- Poka-yoke en todo: botones desactivados hasta que el dato sea valido, confirmacion en lo que no se
  deshace, formatos que se corrigen solos.
- Nada privado sale del panel (`camposPublicos()`); no tocar Firebase real.
- Archivos nuevos en `/css` o `/js` -> `SHELL_FILES` en `sw.js`; subir `CACHE_NAME` por fase.
- `node scripts/verificar.mjs` debe pasar en cada fase. Probar en PC (1366x800) y celular
  (390x844), claro y oscuro, con capturas (CDP headless o preview `tienda-estatica` puerto 8765).
- Las funciones de `onclick` siguen expuestas en `window`; `showPage('catalogo')` etc. siguen
  funcionando (alias a las secciones nuevas).

## Estructura nueva (6 secciones)
| Seccion | Contenido | Viene de |
|---|---|---|
| Dashboard | Resumen del negocio y "Hoy necesitas" | Inicio |
| Ventas | Pedidos web (tablero), ventas, reservas y abonos | Finanzas/registrar venta, Clientes/pedidos web, Inventario/reservas |
| Inventario | Relojes, fotos, fichas, visibilidad y metricas del catalogo | Inventario + Catalogo |
| Clientes | Clientes, cuentas web, segmentos, boletin | Clientes |
| Finanzas | Flujo de caja, gastos, margenes, por cobrar, cierres, reportes | Finanzas |
| Ajustes | Sync, respaldos, seguridad TOTP, salud de la tienda, Contenido, instalar app | Sync, Contenido, Salud |

PC: barra lateral fija (logo negro, iconos de linea, contador de pendientes, se contrae a iconos).
Celular: barra inferior (Dashboard, Ventas, Inventario, Clientes, Mas) + boton "+" central para
registrar venta / compra / gasto / reloj. Arriba: titulo, buscador global (relojes, clientes,
pedidos) y estado de sync.

## Paleta (misma de la tienda)
| Token | Claro | Oscuro |
|---|---|---|
| --accent (botones, serie principal) | #A7C4D6 con texto negro | #A7C4D6 |
| --accent-bg | glaciar 15 % | glaciar 12 % |
| --text | #18181b | #f4f4f5 |
| --muted | #71717a | #a1a1aa |
| --bg | #f4f4f5 | #0f1114 |
| --card | #ffffff | #17191d |
| --border | #e4e4e7 | #26292e |
Estados: verde pagado/ganancia, ambar pendiente, rojo vencido/perdida, gris cancelado (siempre con
texto). Margen: >=30 % verde, >=15 % ambar, menos rojo. Graficas: glaciar (actual), negro/blanco
(comparacion), gris punteado (meta). Numeros tabulares; etiquetas en mayusculas pequenas con espaciado.
Botones desactivados en gris.

## Fases
1. Colores y diseno base: tokens en `css/panel/base.css`, botones glaciar, componentes comunes en
   `componentes.css` (tarjeta KPI con variacion vs mes anterior, etiqueta de estado, tabla, estado
   vacio, contenedor de grafica), modo oscuro.
2. Navegacion nueva: barra lateral / barra inferior + "+", `nav.js` con alias de las pestanas viejas,
   recordar ultima seccion, avisar si hay un formulario a medias. CSS nuevo `css/panel/navegacion.css`.
3. Dashboard: KPIs (ventas del mes vs anterior, ganancia neta, margen promedio, valor de inventario a
   costo y a precio, pedidos web pendientes, por cobrar), grafica 12 meses ventas+ganancia con meta,
   "Hoy necesitas" con boton directo (pedidos por confirmar, abonos vencidos, transito >20 dias,
   disponible >45 dias "Rebajar", sin foto/medida, avisos web por enviar), meta del mes, top 5 mas
   vistos vs mas vendidos, actividad reciente. Nuevo `js/panel/graficas.js` (barras, lineas, dona SVG).
4. Finanzas: filtro de periodo; KPIs (ingresos, costo de lo vendido, gastos, ganancia neta, margen,
   saldo por metodo); flujo de caja mensual, gastos por categoria, ganancia por marca, ventas por canal;
   cuentas por cobrar; inventario como dinero (capital inmovilizado, dias promedio de venta, >60 dias);
   reparto 40/30/30; punto de equilibrio mensual (gastos fijos / margen promedio); proyeccion del mes;
   cierre de mes que bloquea edicion (en `config/main`, reabrir con confirmacion); exportar CSV.
   Poka-yoke: gasto con categoria y monto > 0, traspaso sin saldo negativo, sin fecha futura ni mes
   cerrado, aviso de posible duplicado. Nuevo `finanzas/cierre.js`.
5. Ventas: tablero de pedidos web por estado (pestanas con contador en celular), KPIs (ticket promedio,
   tiempo pedido->entrega, tasa de cancelacion, ventas por canal), reservas con barra de abono y fecha
   limite, historial con filtros. Solo el boton del siguiente paso valido; enviado exige guia; cancelar
   exige motivo. Carpeta `js/panel/ventas/`.
6. Clientes: KPIs (nuevos del mes, % recurrentes, valor de vida, cuentas sin vincular, suscriptores),
   segmentos automaticos (VIP >=2 compras, nuevos <30 dias, inactivos >90 dias, favoritos sin compra),
   ficha con linea de tiempo y WhatsApp con mensaje sugerido por segmento, deteccion de duplicados.
   Nuevo `clientes/segmentos.js`.
7. Inventario: KPIs por estado y valor, vista en cuadricula con fotos, alertas de calidad, clasificacion
   ABC por ganancia, rotacion y precio sugerido para relojes viejos, sub-vista Catalogo con metricas
   (vistas, aperturas, clics a WhatsApp, conversion vistas->ventas). No publicar sin foto/precio/medida;
   precio bajo costo exige confirmacion.
8. Ajustes y cierre: Sync, respaldos, TOTP, salud, Contenido, instalar app; actualizar
   `ARCHITECTURE.md` y `SHELL_FILES`; revision final PC y celular.

## Progreso
(Claude anota aqui lo terminado en cada fase, la rama y lo que falta.)

### Fase 1 — Colores y diseno base: TERMINADA (2026-10-24, rama , CACHE_NAME aphillips-v123)
- : tokens nuevos con la paleta del plan (glaciar #A7C4D6, fondos #f4f4f5 / #0f1114,
  tarjetas, bordes), ambar para "pendiente", tokens de graficas (--g-actual, --g-comp, --g-meta, --g-rejilla),
  modo oscuro automatico (prefers-color-scheme) y forzado (data-theme). --black/--white se invierten en
  oscuro, asi todo lo existente cambia solo.
- Botones principales (.btn-gold / .btn-primario) en glaciar con texto negro; desactivados en gris y sin
  animacion (.btn:disabled); campos con aria-invalid en rojo; etiquetas KPI en mayusculas pequenas.
- Textos que usaban el dorado pasan a --accent-strong (legible); margen 15-29 %, sync en curso, espacio y
  reservas pasan a ambar. badge-gold = ambar; nuevo badge-glaciar.
- : tarjeta KPI con variacion vs mes anterior (sube/baja, invertible para gastos),
  etiqueta de estado (punto + texto: ok, pendiente, vencido, cancelado, info), tabla, estado vacio con accion,
  contenedor de grafica con leyenda. Celdas de grid con min-width:0 (nada desborda en celular).
- Nuevo  (constructores de HTML con escape) y  (boton
  automatico/claro/oscuro en la barra, junto a Salir). Ambos en SHELL_FILES.
- Arreglado de paso: los KPI con clase money salian a 15 px (el .money los pisaba); ahora 30 px.
- Verificacion: Todo en orden: sintaxis, SHELL_FILES, CACHE_NAME (aphillips-v123), campos publicos y funciones de onclick. OK; capturas CDP headless sin errores de consola ni desborde:
  reporte-noche/capturas-panel/f1-pc-claro.png, f1-pc-oscuro.png, f1-cel-claro.png, f1-cel-oscuro.png
  (pagina de componentes con datos de ejemplo) y f1-inicio-pc-oscuro.png, f1-inicio-cel-claro.png,
  f1-inventario-pc-claro.png, f1-finanzas-cel-oscuro.png (estructura real de index.html sin sesion).
- Falta / para despues: los textos de las graficas SVG deben escalar en celular (se resuelve en
  , fase 3); la barra de arriba se reemplaza en la fase 2.

