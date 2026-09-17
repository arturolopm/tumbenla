# Plan de comunicación de Tumbenla — ejecución

**Decisión:** adopción parcial de la evaluación externa, contrastada con
`PRODUCT.md`, `org/crecimiento/VOZ.md` y el producto construido.  
**Fecha:** 2026-09-17  
**Alcance:** comunicación, documentación y presentación. No cambia esquema,
API, autenticación ni URLs públicas.

## Completado

- [x] Fijar Why → How → What y conservar “El ritmo nos levanta” y “Tumbenla y volvamosla a parar”.
- [x] Hacer la portada rumbero-first, mantener la disponibilidad por ciudad neutral y llevar su CTA a `/sitios`.
- [x] Separar el acceso de dueños en un bloque final y dirigirlo a `/registrar-sitio`.
- [x] Abrir `/registrar-sitio` con “Que te vean. Que se sepa que cumpliste.” solo para visitantes nuevos; conservar estados y formulario de cuatro datos.
- [x] Reordenar `/como-funciona` alrededor del propósito y dejar reparto, QR, conciliación y factura como mecanismo.
- [x] Retirar del primer mensaje porcentaje de ventas, barras con máximo artificial, equivalencias y afirmaciones de revisión de cada producto.
- [x] Actualizar navegación, footer, mapa, detalle de sitio, términos, privacidad, metadata, manifest y tarjeta social.
- [x] Renombrar las etapas públicas a “Para reconstruir”, “Ya en material” y “Pendiente de convertir en material”, conservando sus definiciones contables.
- [x] Alinear `PRODUCT.md`, `VOZ.md`, `.agents/product-marketing.md`, `ORG.md`, Crecimiento, Retención, Datos, perfiles y `VP_VENUE.md`.
- [x] Marcar EXP-004 a EXP-007 como hipótesis bloqueadas sin promesas de fidelización, datos, cumpleaños, benchmarks o atribución individual.
- [x] Incorporar en `/registrar-sitio` la propuesta futura para sitios: campañas consentidas, promoción de eventos e insights agregados, siempre marcada como desarrollo.
- [x] Ampliar `scripts/test-simplification.mjs` con barrido de copy público y mensajes canónicos.

## Pendiente de validación externa

- [ ] Verificar visualmente hero y CTA en móvil, tableta y escritorio.
- [ ] Probar portada con datos y sin datos; confirmar estados vacíos honestos.
- [ ] Confirmar de extremo a extremo el alta anónima, cuatro campos y estados de `/registrar-sitio`.
- [ ] Entrevistar cinco rumberos y cinco dueños. Criterio: al menos cuatro de cada grupo explican sin ayuda qué hace Tumbenla, qué ganan y cuál es el siguiente paso.
- [x] Ejecutar `bun run prueba:simplificacion` (84 verificaciones), `bun run typecheck` y `bun run build`.
- [x] Ejecutar `bun run lint`; no hay errores en los cambios, pero permanecen dos advertencias preexistentes.
- [x] Ejecutar `bun run e2e:alta`: 1 prueba pasó al permitir la ejecución fuera del sandbox para que Chromium pudiera usar el servicio de procesos de macOS.
- [x] Ejecutar `detect-changes` sobre los cambios sin stage en `preview`; el diff contiene únicamente documentación, copy, metadata, presentación y pruebas estáticas. GitNexus reporta riesgo crítico por el volumen de símbolos/documentos, no por esquema, API o autenticación.
- [x] Revisar manualmente que los cambios locales preexistentes en `AGENTS.md` y `CLAUDE.md` sigan intactos.

## Capacidades futuras, no activas todavía

Promociones, eventos, campañas por sitio, insights agregados y comunicaciones de
retorno forman parte de la dirección de producto, pero no se anuncian como
disponibles hoy. Antes de activarlas necesitan decisión de Producto, esquema,
consentimiento granular, límites de frecuencia, medición y revisión legal. No se
entrega una lista automática de correos o teléfonos ni se atribuye una compra de
material a un trago o cliente individual.
