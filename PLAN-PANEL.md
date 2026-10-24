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

### Fase 1 — Colores y diseno base: TERMINADA (2026-10-24, rama `panel-f1-colores`, CACHE_NAME aphillips-v123)
- `css/panel/base.css`: tokens nuevos con la paleta del plan (glaciar #A7C4D6, fondos #f4f4f5 / #0f1114,
  tarjetas, bordes), ambar para "pendiente", tokens de graficas (--g-actual, --g-comp, --g-meta, --g-rejilla),
  modo oscuro automatico (prefers-color-scheme) y forzado (data-theme). --black/--white se invierten en
  oscuro, asi todo lo existente cambia solo.
- Botones principales (.btn-gold / .btn-primario) en glaciar con texto negro; desactivados en gris y sin
  animacion (.btn:disabled); campos con aria-invalid en rojo; etiquetas KPI en mayusculas pequenas.
- Textos que usaban el dorado pasan a --accent-strong (legible); margen 15-29 %, sync en curso, espacio y
  reservas pasan a ambar. badge-gold = ambar; nuevo badge-glaciar.
- `css/panel/componentes.css`: tarjeta KPI con variacion vs mes anterior (sube/baja, invertible para gastos),
  etiqueta de estado (punto + texto: ok, pendiente, vencido, cancelado, info), tabla, estado vacio con accion,
  contenedor de grafica con leyenda. Celdas de grid con min-width:0 (nada desborda en celular).
- Nuevo `js/panel/componentes.js` (constructores de HTML con escape) y `js/panel/tema.js` (boton
  automatico/claro/oscuro en la barra, junto a Salir). Ambos en SHELL_FILES.
- Arreglado de paso: los KPI con clase money salian a 15 px (el .money los pisaba); ahora 30 px.
- Verificacion: `node scripts/verificar.mjs` OK; capturas CDP headless sin errores de consola ni desborde:
  reporte-noche/capturas-panel/f1-pc-claro.png, f1-pc-oscuro.png, f1-cel-claro.png, f1-cel-oscuro.png
  (pagina de componentes con datos de ejemplo) y f1-inicio-pc-oscuro.png, f1-inicio-cel-claro.png,
  f1-inventario-pc-claro.png, f1-finanzas-cel-oscuro.png (estructura real de index.html sin sesion).
- Falta / para despues: los textos de las graficas SVG deben escalar en celular (se resuelve en
  `graficas.js`, fase 3); la barra de arriba se reemplaza en la fase 2.

### Fase 2 — Navegacion nueva: TERMINADA (2026-10-24, rama `panel-f2-navegacion`, CACHE_NAME aphillips-v124)
- `js/panel/nav.js` reescrito: 6 secciones con sub-pestanas. Ventas = Pedidos web + Registrar venta;
  Inventario = Relojes + Catalogo; Finanzas = Resumen, Analisis, Movimientos, Registrar; Ajustes = General,
  Contenido, Sync y respaldo (sigue pidiendo el codigo de 6 digitos).
- PC: barra lateral negra con iconos de linea, indicador glaciar, contadores (pedidos web nuevos, avisos de
  cuentas, salud) y boton para contraerla a iconos (se recuerda). Pie: estado de sync, correo, tema y Salir.
- Celular: barra inferior Dashboard / Ventas / "+" / Inventario / Clientes; "+" abre Registrar venta,
  compra, gasto o reloj nuevo; arriba titulo, lupa y "Mas" (Finanzas, Ajustes, tema, Salir) con contador.
- Barra superior con titulo, buscador global (relojes, clientes y pedidos web, sin acentos, atajo "/",
  Enter abre el primero, Esc cierra) y punto de estado de sync.
- Poka-yoke: si una seccion tiene un formulario escrito a medias aparece un punto ambar en su icono y el
  navegador avisa antes de cerrar o recargar (solo cuenta lo que la persona escribio, no lo que llena el codigo).
- Se recuerda la ultima seccion (localStorage aphillips_vista; nunca la de Sync, que pide codigo).
- Alias: showPage('catalogo'|'contenido'|'config'|...), showInner('fin',...) e irARegistrar(tipo) siguen
  funcionando; auth-overlay usa mostrarVista. Pedidos web pasan a page-ventas y Salud de la tienda a
  page-ajustes (los modulos dibujan por id, no cambio su codigo). Nuevo css/panel/navegacion.css; se quito
  el CSS de la barra vieja (base.css y movil.css).
- Verificacion: `node scripts/verificar.mjs` OK; index.html real en Chrome headless (login oculto solo por
  DOM, sin datos ni cuentas), sin errores de consola ni desborde. Capturas en reporte-noche/capturas-panel/:
  f2-pc-claro-dashboard, f2-pc-oscuro-finanzas, f2-pc-claro-mini-inventario, f2-pc-claro-buscador,
  f2-cel-claro-ventas, f2-cel-oscuro-mas, f2-cel-claro-nuevo, f2-cel-oscuro-ajustes, f2-cel-oscuro-buscador.
- Falta / para despues: la seccion Ventas solo tiene pedidos web y registrar (tablero, KPIs y reservas en la
  fase 5); Clientes y Ajustes > General se completan en las fases 6 y 8.

### Fase 3 — Dashboard: TERMINADA (2026-10-24, rama `panel-f3-dashboard`, CACHE_NAME aphillips-v125)
- `js/panel/inicio.js` reescrito y `page-inicio` rehecho. Saludo segun la hora y botones Registrar venta / Compra / Reglas.
- 6 KPIs (tocables): ventas del mes, ganancia neta y margen promedio con variacion vs mes anterior; inventario a
  costo y a precio (disponible + transito + reservado); pedidos web abiertos (y cuantos por confirmar); por cobrar.
- "Hoy necesitas" ordenado por urgencia, cada aviso con su boton: Confirmar pedido web, Registrar abono (reserva
  vencida a los 30 dias de apartada; constante DIAS_PLAZO_ABONO), Enviar avisos web, Revisar envio (>20 dias en
  transito), Rebajar (>45 dias disponible), Completar (publicado sin foto o sin medida).
- Meta del mes: progreso, proyeccion de cierre al ritmo actual, cuanto falta por dia, etiqueta "A tiempo" /
  "Por debajo del ritmo". Poka-yoke: Guardar desactivado hasta que la meta sea un numero > 0 y distinto; Enter guarda.
- Grafica de 12 meses (ventas en glaciar, ganancia en linea, meta punteada) con `js/panel/graficas.js` nuevo
  (barras+linea, dona, barras horizontales; SVG al ancho real, textos de 11 px en celular y PC; tooltip nativo).
- Mas vistos (metricas del catalogo) vs mas vendidos (90 dias) con aviso de los que se ven y no se venden.
- Actividad reciente con etiqueta por tipo y monto con signo; checklist del dia se mantiene (textos escapados).
- Se quito la mini grafica de 7 dias (la reemplaza la de 12 meses). Nuevo css/panel/dashboard.css.
- Verificacion: `node scripts/verificar.mjs` OK; capturas con datos de EJEMPLO solo en memoria
  (.claude/prueba/datos-prueba.js, no se guarda ni se envia), sin errores ni desborde:
  reporte-noche/capturas-panel/f3-pc-claro.png, f3-pc-oscuro.png, f3-cel-claro.png, f3-cel-oscuro.png, f3-pc-vacio.png.
- Falta / para despues: el plazo de 30 dias para abonos debe pasar a la reserva (fecha limite) en la fase 5.

### Fase 4 — Finanzas: TERMINADA (2026-10-24, rama `panel-f4-finanzas`, CACHE_NAME aphillips-v126)
- Nuevo `finanzas/calculos.js`: una sola forma de contar el dinero para todo el panel. Ingresos = ventas + abonos
  - devoluciones de abonos; ganancia bruta = ingresos - costo vendido; ganancia neta = bruta - gastos operativos;
  flujo = entradas - (compras + gastos + retiros). El Dashboard usa lo mismo (su "Ganancia neta" ahora resta gastos).
- Finanzas con 6 pestanas: Resumen, Rentabilidad, Por cobrar, Movimientos, Registrar, Cierres.
- Resumen: periodo (este mes, mes anterior, 3 meses, ano, todo) con comparacion contra el periodo anterior del mismo
  largo; 6 KPIs; avisos (gasto > 20 %, perdida, flujo negativo, capital estancado > 30 %, meses sin cerrar); estado de
  resultados; punto de equilibrio (gastos promedio / margen bruto) y proyeccion del mes; flujo de caja 12 meses;
  gastos por categoria; dinero por metodo; reparto 40/30/30 de la ganancia neta (dona); exportar el periodo a Excel.
- Rentabilidad: margen bruto, ticket, descuentos dados, dias promedio para vender; ganancia por marca; ventas por
  canal; relojes mas rentables; inventario como dinero (capital, valor a precio, estancado +60 dias con precio sugerido).
- Por cobrar: apartados con saldo, fecha limite (reserva.fechaLimite o 30 dias), estado, Registrar abono / Entregar y
  "Recordar" por WhatsApp (enlace con mensaje; lo envia el dueno).
- Cierres: cerrar solo meses terminados (guarda resumen y huella en config/main -> state.cierres, sincronizado y en
  el respaldo); con el mes cerrado no se pueden borrar sus movimientos (candado); reabrir con confirmacion; aviso si
  cambio despues del cierre; estado de resultados mes por mes a Excel. Dashboard avisa "Cerrar mes" desde el dia 3.
- Movimientos: buscador, exportar lo filtrado, textos escapados; arreglado el balance (las compras se sumaban como entrada).
- Poka-yoke en Registrar: gasto/retiro con boton activo solo con descripcion y monto validos, monto a centavos, mas
  categorias, aviso de duplicado del mismo dia, retiro mayor que el saldo del metodo pide confirmacion; traspaso
  bloqueado si el origen quedaria negativo o es igual al destino (con el saldo disponible a la vista).
- Tablas del panel en celular: cada fila se ve como tarjeta con etiquetas (componentes.css), sirve para todas las fases.
- Verificacion: verificar.mjs OK; capturas con datos de ejemplo sin errores ni desborde; prueba funcional: cerrar mes
  pasado OK, borrar movimiento de mes cerrado bloqueado, mes actual no se puede cerrar, reabrir OK. Capturas:
  f4-pc-oscuro-resumen, f4-cel-claro-rentabilidad, f4-cel-claro-por-cobrar, f4-cel-claro-cierres, f4-cel-claro-traspaso-bloqueado.

### Fase 5 — Ventas: TERMINADA (2026-10-24, rama `panel-f5-ventas`, CACHE_NAME aphillips-v127)
- Ventas con 5 pestanas: Resumen, Pedidos web, Apartados, Historial, Registrar venta (nav.js soporta `vista` dentro de page-ventas).
- Resumen (nuevo `ventas/ventas.js`): periodo con comparacion; KPIs vendido, relojes vendidos, ticket, conversion web
  (pedidos pagados / recibidos), tiempo pedido -> entrega (del historial del pedido) y % cancelados; embudo de pedidos
  web; ventas por canal; mejores dias para vender (12 meses) con recomendacion; clientes que mas compran y % de ventas
  sin cliente asignado.
- Pedidos web (movido a `ventas/pedidos-web.js`): tablero por estado (4 columnas en PC, 2 en tablet, apiladas en
  celular), aviso "X h/d sin avanzar" (>24 h ambar, >48 h rojo) en solicitado/confirmado/pagado, lista de cerrados.
  Poka-yoke: cancelar exige motivo (min. 5 letras, lo ve el cliente) y "enviado" exige guia (min. 4); sin guia ->
  "Entregado en mano".
- Apartados: tarjetas con barra de pago, saldo, fecha limite y estado; Registrar abono, Cobrar saldo y entregar,
  +7 dias (poka-yoke: solo con saldo y sin pasar de 90 dias desde que se aparto) y Cancelar apartado.
  Al reservar se elige el plazo (7/15/30/45/60 dias) -> reserva.fechaLimite. Dashboard y Por cobrar la usan.
- Historial de ventas: periodo, buscador, canal, totales con ganancia y descuento, exportar lo filtrado.
- Verificacion: verificar.mjs OK; datos y pedidos de EJEMPLO en memoria (.claude/prueba/pedidos-prueba.js intercepta
  fetch: solo responde /admin/pedidos, todo lo demas 401); sin errores ni desborde. Prueba: +7 dias se detiene en 90.
  Capturas f5-pc-claro-resumen, f5-pc-claro-tablero-pedidos, f5-cel-oscuro-apartados/historial/pedidos.
