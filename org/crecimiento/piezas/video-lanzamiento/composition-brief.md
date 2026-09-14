# Guía de producción — serie de pedidos Tumbenla

**Actualizada:** 2026-09-13 · **Formato:** 1080 × 1920, 30 fps · **Duración:** 12 s por pieza

Esta guía reemplaza el brief del video `brag.mp4`. El video viejo queda como archivo histórico y
**no se reparte**: cuenta el modelo retirado de porcentaje de ventas, usa cifras de interfaz que no
salieron de producción y no enseña el pedido, el QR ni el escaneo que hoy sostienen el producto.

## La historia correcta

Tumbenla vende un producto concreto de un sitio concreto. Antes de pedir, la persona ve el precio y
el reparto. Puede pagar en la app o en la barra. En los dos casos recibe un QR por cada unidad. El
personal lo escanea **antes de cobrar**: la pantalla dice `YA PAGADO · ENTRÉGALO` o indica que debe
cobrar y entregar. El comprador solo muestra el QR; su pantalla cambia a `CONFIRMADO` cuando lo
escanean. Después, Tumbenla compra material y publica la factura.

No hay un camino alterno por “porcentaje de ventas”. No se promete una compra concreta para cada
trago y no se muestra un reparto final de un pago en app antes de reconciliar las deducciones.

## Decisiones que mandan

- `PRODUCT.md` 1, 26–30, 32, 34 y 37: producto concreto, dos formas de pago, QR para todos,
  escaneo antes de cobrar, confirmación automática y precio/reparto congelados.
- `PRODUCT.md` 2, 5, 16 y riesgos 4 y 6: nada se esconde tras una cuenta; no hay cifras inventadas,
  lenguaje de caridad ni números propios sobre el sismo.
- `.agents/product-marketing.md`: no anunciar productos no publicados y expresar el reparto en
  pesos solo cuando exista un producto real aprobado. Estas piezas no inventan uno: dicen que el
  reparto se ve en pesos, sin fabricar montos.
- `org/crecimiento/VOZ.md`: frases cortas, de barra, con palabras de la casa. Nunca “dona”,
  “solidario”, “ayuda” ni variantes.

## Sistema visual común

- Fondo azul-negro `oklch(0.188 0.03 265.9)`; tarjetas `oklch(0.241 0.03 267.3)`.
- Naranja `oklch(0.676 0.196 41.9)` para acción y rellenos; texto naranja usa
  `oklch(0.836 0.095 42.3)` para conservar contraste.
- Lima `oklch(0.917 0.226 129)` solo para el estado resuelto o seleccionado, una vez por cuadro.
- Anybody 900 para titulares; Montserrat para cuerpo y metadatos.
- Grano, trama de puntos, bloom localizado y reglas gruesas: afiche de calle de noche, no dashboard
  SaaS ni diapositiva centrada.
- Interfaz reconstruida a escala de video a partir del copy real. No se usan fotos de rumba,
  productos de prueba, recibos ficticios ni cifras de fixtures.

## Lenguaje de movimiento

Ritmo compartido: **golpe → demostración → confirmación → cierre quieto**. Entradas rápidas con
`expo.out`/`power4.out`, salidas más cortas con `power3.in`, una respiración ambiental por escena y
un corte limpio cuando cambia la idea. Nada depende del tiempo real, del puntero ni del azar.

La música usa `assets/music/perreo-melodico.mp3` como cama baja. Cada pieza tiene máximo tres efectos
puntuales de los assets existentes. La cama entra en 0,25 s y sale por completo durante el último
segundo; no hay locución ni subtítulos porque el texto en pantalla es el mensaje.

## Pieza 1 — Pide el trago

**Público:** rumbero · **Objetivo:** que entienda el pedido sin cuenta obligatoria.

| Tiempo | Pantalla | Copy exacto | Acción |
|---|---|---|---|
| 0,0–2,6 | Titular + tarjeta de producto abstracta | `PIDE EL TRAGO` · `Antes ves el precio y el reparto en pesos.` | El titular golpea; la tarjeta se arma desde dos placas. |
| 2,6–6,2 | Selector de pago | `CÓMO PAGAS` · `AQUÍ` · `EN LA BARRA` | El foco pasa de una opción a la otra; la lima marca una sola selección. |
| 6,2–9,6 | Teléfono con QR | `EN LOS DOS CASOS TE SALE UN QR.` | El QR se construye por módulos y queda grande, sin código real escaneable. |
| 9,6–12,0 | Cierre | `MUÉSTRALO EN LA BARRA.` · `tumbenla.com` | Todo sale a izquierda; el cierre sube y queda quieto. |

## Pieza 2 — Escanea primero

**Público:** personal del sitio y rumbero · **Objetivo:** explicar la regla que hace confiable la
entrega sin convertir el video en capacitación.

| Tiempo | Pantalla | Copy exacto | Acción |
|---|---|---|---|
| 0,0–2,8 | Escáner a pantalla completa | `ESCANEA ANTES DE COBRAR.` | Una línea de lectura baja sobre un marco QR. |
| 2,8–6,8 | Resultado A | `YA PAGADO` · `ENTRÉGALO.` | La tarjeta encaja en lima con un golpe corto. |
| 6,8–9,8 | Resultado B | `PAGO EN BARRA` · `COBRA Y ENTRÉGALO.` | La misma tarjeta cambia a ámbar; no aparece un monto inventado. |
| 9,8–12,0 | Cierre | `TODOS LOS QR SE ESCANEAN.` · `Ahí te dice qué hacer.` | Dos estados colapsan en una sola regla. |

## Pieza 3 — Del trago al recibo

**Público:** los dos lados · **Objetivo:** mostrar el rastro completo y cerrar con la prueba pública.

| Tiempo | Pantalla | Copy exacto | Acción |
|---|---|---|---|
| 0,0–2,4 | Titular | `DEL TRAGO AL RECIBO.` | Las dos palabras clave entran desde lados opuestos y se alinean. |
| 2,4–8,8 | Cadena de cinco pasos | `PEDIDO` → `QR` → `ESCANEO` → `MATERIAL` → `FACTURA` | Cinco fichas avanzan por un riel; cada unión se enciende después del paso anterior. |
| 8,8–12,0 | Cierre | `SI NO HAY RECIBO, NO PASÓ.` · `Ver transparencia · tumbenla.com` | La cadena se comprime en una tarjeta de factura; después queda inmóvil. |

## Archivos y control de calidad

Cada pieza vive como proyecto HyperFrames independiente bajo `composition/promos/`, con los mismos
assets y el mismo pin `hyperframes@0.8.22` del proyecto original. Salidas esperadas:

- `promo-01-pide.mp4` y `promo-01-pide.jpg`
- `promo-02-escanea.mp4` y `promo-02-escanea.jpg`
- `promo-03-recibo.mp4` y `promo-03-recibo.jpg`

Antes de entregar cada una: `npm run check`, contacto visual en 1,0 / 3,8 / 7,5 / 10,7 s, render de
alta calidad, `ffprobe` para duración/dimensiones/audio y revisión del MP4 final. Si alguna cifra,
producto o bar real entra después, se vuelve a validar contra producción antes de renderizar.
