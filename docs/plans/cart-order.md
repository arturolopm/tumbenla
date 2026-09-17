# Pedido con varios productos del mismo bar

Plan durable para convertir el pedido de un solo producto en un pedido con líneas, sin agregar un
paso al camino de una sola bebida. Este archivo es la fuente de continuidad entre sesiones y
agentes. Las decisiones de producto siguen mandadas por `PRODUCT.md`.

## Resultado bloqueado

- Un carrito pertenece a un solo bar y admite máximo 20 unidades entre todas sus líneas.
- Cada bar conserva su propio carrito en el navegador entre recargas y reinicios.
- **Pedirlo** abre el checkout con ese producto agregado; no aparece un cajón ni una confirmación
  adicional.
- El mismo checkout permite ajustar cantidades, **Agregar algo más**, elegir un único medio de pago
  y completar los datos del comprador.
- El servidor vuelve a leer sitio, publicación, moneda, precios, porcentajes y beneficiario antes de
  crear cualquier registro financiero.
- Todo el carrito produce un pedido, un cobro o reserva, una URL pública, un QR visible y un escaneo
  atómico.
- Los pedidos viejos y sus URLs siguen funcionando.

## Contratos congelados

```ts
type CartLineInput = {
  productId: string
  quantity: number
}

type StartCustomerOrderInput = {
  venueId: string
  lines: CartLineInput[]
  buyerName: string
  buyerEmail: string
  payMethod: 'app' | 'bar'
  submissionKey: string
  quotedCartHash: string
  userId: string | null
}
```

`customer_order` es el padre que ve el comprador. `product_order` queda como línea y recibe
`customerOrderId` y `lineOrdinal`, únicos en conjunto. Los snapshots y unidades siguen por línea.
Un intento de pago y una corrida de asignación pertenecen al padre. Las deducciones de un cobro se
distribuyen por valor bruto en orden `(lineOrdinal, unitOrdinal)`; cada unidad usa el porcentaje
congelado de su línea.

El servidor rechaza IDs repetidos, productos de otro bar, borradores o pausados, monedas distintas
de COP, cantidades inválidas y más de 20 unidades. El hash cotizado representa únicamente la vista
canónica recargada del catálogo. No se acepta dinero calculado por el cliente.

## Estados

- `[ ]` NOT STARTED
- `[~]` IN PROGRESS
- `[x]` COMPLETE
- `[!]` BLOCKED

Solo un checkpoint puede estar en progreso. Completar uno exige fecha, rama/base, agente/modelo,
archivos, commit, comandos y resultados, bloqueos restantes y el comando siguiente exacto.

## Checkpoints

### [x] C0 — Descubrimiento y decisiones

- Fecha: 2026-09-16
- Rama/base: `preview` @ `d17199b`
- Agente/modelo: orquestador de alta capacidad
- Evidencia: flujo actual de esquema, ePayco, caja, asignación, crédito, QR, reembolso, historia y
  pruebas inspeccionado; persistencia por bar y tope agregado de 20 confirmados.
- GitNexus: índice reparado y actualizado. `CommerceUnitService.redeem` tiene riesgo **HIGH** por
  afectar acción, escáner y página de personal; queda en manos del orquestador.
- Archivos afectados: ninguno.
- Commit: N/A.
- Comandos principales: `node .gitnexus/run.cjs analyze --repair-fts --index-only` y
  `node .gitnexus/run.cjs analyze --force --index-only --default-branch preview`, ambos exitosos.
- Bloqueos: ninguno.
- Siguiente comando: `git status --short`

### [x] C1 — Persistir plan y doctrina de producto

El orquestador crea este plan, registra la decisión en `PRODUCT.md`, actualiza la revisión de
fricción y el harness, comprueba el worktree y registra impactos antes de editar código.

- Fecha: 2026-09-16
- Rama/base: `preview` @ `d17199b`
- Agente/modelo: orquestador de alta capacidad
- Archivos: `docs/plans/cart-order.md`, `PRODUCT.md`, `docs/ux-friction-review.md`,
  `docs/validation-harness.md`
- Commit: cambios locales sin commit
- Comandos: carga completa de contexto Impeccable, `git status --short`, `git branch
  --show-current`, `git rev-parse --short HEAD`, `git diff --check`; todos exitosos.
- Bloqueos: ninguno.
- Siguiente comando: `node .gitnexus/run.cjs impact productOrder --direction upstream`

### [x] C2 — Migración a pedido padre

Pruebas de migración primero. Crear `customer_order`; agregar relaciones e índices aditivos;
retroalimentar un padre por cada pedido legado; enlazar intentos, asignaciones y transacciones; y
probar que cada pedido anterior tiene exactamente un padre y que su bearer URL sigue resolviendo.
Las relaciones nuevas se mantienen tolerantes durante la transición.

- Fecha: 2026-09-16
- Rama/base: `preview` @ `d17199b`
- Agente/modelo: orquestador de alta capacidad
- Archivos: `src/database/schema.ts`, `src/database/commerce-schema.ts`,
  `src/lib/utils/id.ts`, `migrations/0027_customer_order_parent.sql`,
  `migrations/meta/0027_snapshot.json`, `migrations/meta/_journal.json`,
  `tests/commerce/database.ts`, `tests/commerce/schema.test.ts`
- Commit: cambios locales sin commit
- Resultado: migración aditiva con backfill de padre y relaciones de pago/asignación/finanzas;
  token público legado copiado; relación línea/ordinal única; referencias viejas conservadas.
- Comandos: `bunx drizzle-kit generate --name customer_order_parent` (creada 0027),
  `bunx drizzle-kit generate --name schema_drift_check` (sin cambios), `bun run typecheck`
  (éxito), `bun test --conditions=react-server tests/commerce/schema.test.ts` (5 pass),
  `bun run test:commerce` (104 pass).
- Corrección local posterior, 2026-09-16: una base real con transacciones financieras ya publicadas
  reveló que el trigger de inmutabilidad bloqueaba el backfill del nuevo vínculo al padre. La
  migración ahora desactiva únicamente los dos triggers de fila de `finance_transaction` durante
  ese `UPDATE` y los restaura inmediatamente. La prueba de migración usa una transacción legado
  publicada, comprueba el vínculo y confirma que sigue inmutable. `bun run migrate` aplicó 0027 en
  `shipfree`; la consulta exacta de historia volvió a ejecutar; suite focalizada 5 pass y suite de
  comercio 112 pass.
- Bloqueos: ninguno.
- Siguiente comando: `node .gitnexus/run.cjs impact FormularioDePedido --direction upstream --repo tumbenla`

### [x] C3 — Estado del carrito y checkout

Candidato para delegación a un modelo económico después de congelar contratos. Alcance permitido:
store Zustand persistido por bar, consumo idempotente del seed, presentación del checkout, tope de
20 unidades y pruebas focalizadas. El orquestador revisa hidratación, accesibilidad, catálogo
obsoleto y copy.

- Fecha: 2026-09-16
- Rama/base: `preview` @ `d17199b`
- Agente/modelo: `gpt-5.6-luna` implementó el store acotado; orquestador de alta capacidad revisó e
  integró rutas y presentación.
- Archivos: `src/lib/cart/cart-store.ts`, `tests/cart/cart-store.test.ts`,
  `src/components/commerce/order-checkout.tsx`,
  `src/components/commerce/continue-order-link.tsx`,
  `src/components/comercio/carta-publica.tsx`,
  `src/app/(publico)/sitios/[slug]/pedir/page.tsx`,
  `src/app/(publico)/sitios/[slug]/pedir/[producto]/page.tsx`; se retiró
  `src/components/comercio/formulario-de-pedido.tsx`.
- Commit: cambios locales sin commit
- Resultado: store persistido y saneado por bar; seed sin duplicación; checkout único con líneas,
  cantidades, catálogo adicional, pago y comprador; control de continuidad en la página ISR; ruta
  antigua redirigida.
- Comandos: `bun test tests/cart/cart-store.test.ts` (11 pass, 43 assertions), Biome focalizado
  (éxito tras formato), `bun run typecheck` (éxito).
- Bloqueos: ninguno.
- Siguiente comando: `node .gitnexus/run.cjs impact startPayment --direction upstream --repo tumbenla`

### [x] C4 — Pago por app y asignación

Propiedad del orquestador. Crear padre, líneas, snapshots, unidades e intento de forma atómica;
abrir un checkout ePayco por el bruto agregado; conciliar un cobro autoritativo; emitir todas las
unidades solo tras aprobación; repartir deducciones entre porcentajes mixtos sin deriva.

- Fecha: 2026-09-16
- Rama/base: `preview` @ `d17199b`
- Agente/modelo: orquestador de alta capacidad
- Archivos: `src/app/actions/orders.ts`, `src/lib/cart/cart-quote.ts`,
  `src/lib/commerce/payment-service.ts`, `src/lib/commerce/allocation-service.ts`,
  `src/lib/commerce/allocation.ts`, `src/lib/commerce/finance-ledger.ts`,
  `src/components/comercio/payment-state-watcher.tsx`, pruebas de pago/asignación y el script de
  confirmación concurrente. Se retiró `src/app/actions/pedidos.ts`.
- Commit: cambios locales sin commit
- Resultado: creación transaccional de padre, líneas y unidades; una sesión por el bruto agregado;
  hash e idempotencia sobre líneas normalizadas; aprobación autoritativa; deducciones mixtas y
  residuo determinista; el carrito solo se limpia si conserva el fingerprint aprobado.
- Comandos: pruebas focalizadas de pago/asignación y `bun run test:commerce`; exitosos, incluidos
  casos 40/50/100 %, concurrencia, callbacks duplicados y aprobación tardía.
- Bloqueos: ninguno.
- Siguiente comando: `node .gitnexus/run.cjs impact CommerceUnitService.redeem --direction upstream --repo tumbenla`

### [x] C5 — Barra, redención, caducidad, reembolso y disputa

Propiedad del orquestador. Reservar exposición agregada por unidad; redimir todas las líneas con un
solo escaneo y bloqueo estable; informar monto completo y lista; mantener atomicidad e idempotencia;
adaptar vencimiento, reembolsos parciales/totales, disputas y recuperación al padre.

- Fecha: 2026-09-16
- Rama/base: `preview` @ `d17199b`
- Agente/modelo: orquestador de alta capacidad; redención retenida por el orquestador por riesgo
  GitNexus **HIGH**.
- Archivos: `src/lib/commerce/cash-credit-service.ts`,
  `src/lib/commerce/unit-lifecycle-service.ts`, `src/lib/commerce/refund-service.ts`,
  `src/lib/commerce/charge-dispute-service.ts`, `src/app/actions/escanear.ts`,
  `src/components/panel/order-scanner.tsx` y pruebas financieras/de caja/ciclo de vida.
- Commit: cambios locales sin commit
- Resultado: exposición agregada reservada por unidad; bloqueo padre→línea→unidad estable; un
  escaneo atómico entrega todas las líneas e informa un monto; reembolsos parciales y totales,
  vencimiento, disputa y ledger conservan el vínculo al padre sin duplicar dinero.
- Comandos: suites focalizadas de ciclo de vida, caja y finanzas (42 pass) y
  `bun run test:commerce` (112 pass); exitosos.
- Bloqueos: ninguno.
- Siguiente comando: `bun test --conditions=react-server tests/commerce/customer-order-view.test.ts tests/commerce/customer-history.test.ts`

### [x] C6 — Vistas de comprador, personal, correo e historia

Las presentaciones y read models aislados se pueden delegar después de estabilizar C5. Mostrar
líneas en QR, correo, resultado/historial de escáner, `/mi-historia` y operación sin duplicar totales.
La integración final es del orquestador.

- Fecha: 2026-09-16
- Rama/base: `preview` @ `d17199b`
- Agente/modelo: `gpt-5.6-luna` implementó la agregación aislada de historia; orquestador de alta
  capacidad revisó e integró comprador, personal, correo y compatibilidad de bearer tokens.
- Archivos: `src/lib/commerce/customer-order-view.ts`,
  `src/lib/commerce/customer-history.ts`, `src/lib/commerce/order-notifications.ts`,
  `src/lib/commerce/redemption-history.ts`, `src/components/commerce/customer-order-screen.tsx`,
  `src/components/commerce/customer-orders.tsx`, `src/components/emails/commerce/`, rutas de
  `/orden/[token]` y sus pruebas. Se retiraron las pantallas y emails españoles reemplazados.
- Commit: cambios locales sin commit
- Resultado: una tarjeta, URL, pantalla, confirmación, QR y correo por padre con todas las líneas;
  token de línea legado compatible; historial de comprador/personal y operación agregan una sola vez.
- Comandos: pruebas focalizadas de vistas/historia/transparencia (6 pass), `bun run typecheck`,
  `bun run build` y `bun run test:commerce` (112 pass); exitosos.
- Bloqueos: ninguno.
- Siguiente comando: `bun run test:e2e`

### [x] C7 — Aceptación automatizada

Cubrir migración, compatibilidad, persistencia, manipulación, carreras, pagos, asignación mixta,
crédito, escaneo, reembolsos, transparencia e historia. Ejecutar cinco recorridos repetidos de
compra/redención mixta y todos los gates. Ejecutar GitNexus `detect-changes` contra `preview` antes
de cualquier commit.

- Fecha: 2026-09-16
- Rama/base: `preview` @ `d17199b`
- Agente/modelo: orquestador de alta capacidad
- Archivos de aceptación: `e2e/flujo-principal.spec.ts`, `tests/cart/cart-store.test.ts`,
  `tests/commerce/schema.test.ts`, `tests/commerce/payment-service.test.ts`,
  `tests/commerce/allocation-service.test.ts`, `tests/commerce/cash-credit-service.test.ts`,
  `tests/commerce/financial-operations.test.ts`, `tests/commerce/customer-order-view.test.ts` y
  `tests/commerce/customer-history.test.ts`.
- Commit: cambios locales sin commit
- Resultado: `git diff --check`, `bun run lint`, `bun run typecheck`, `bun run test:commerce`
  (112 pass), `bun run build` y `bun run test:e2e` (12 pass), todos con salida 0. Lint conserva tres
  advertencias preexistentes y ajenas en Lemon Squeezy/alta de sitio. Cinco repeticiones de cada
  recorrido mixto dieron 10 pass adicionales. GitNexus se reindexó con 4.618 nodos/10.142 aristas;
  `detect-changes` salió 0 y clasifica el conjunto como **CRITICAL** por 165 símbolos y 34 flujos,
  coherente con el alcance financiero y de redención. No hubo commit ni push.
- Bloqueos: ninguno en aceptación local.
- Siguiente comando: `git status --short`

### [~] C8 — Aceptación ePayco en Preview y entrega

Ejecutar sandbox real en Preview, guardar evidencia saneada y validar escaneo móvil. Repetir crédito,
débito y PSE si están habilitados, además de aprobado, pendiente, fallido, callback duplicado,
cierre/reapertura y un monto sobre el límite de la cuenta. No hacer push, desplegar ni activar pagos
reales sin autorización explícita de la solicitud activa.

- Fecha: 2026-09-16
- Rama/base: `preview` @ `d17199b`
- Agente/modelo: orquestador de alta capacidad
- Autorización: la solicitud activa autoriza explícitamente el push a `preview` y terminar este
  plan si no hacen falta variables de entorno nuevas. La revisión del diff y de los archivos nuevos
  confirmó que no se agregó ninguna; `COMMERCE_FUNDING_CLASSIFICATION` ya existía en la acción
  reemplazada y en los ejemplos de Preview.
- Commit: pendiente de crear y publicar
- Evidencia disponible: el adaptador ePayco, rechazo por límite del proveedor, PSE pendiente,
  callbacks duplicados, reapertura y aprobación tardía están cubiertos localmente con dobles
  deterministas; ningún QR aparece antes de aprobación autoritativa.
- Bloqueos: ninguno antes del push; la evidencia real dependerá del despliegue y las capacidades
  habilitadas en la cuenta ePayco de Preview.
- Siguiente comando exacto: `git diff --check`

## Dependencias y delegación

`C1 → C2`; con contratos de C2 estables, C3 puede avanzar junto a C4 solo en archivos disjuntos;
`C4 → C5 → C6 → C7 → C8`.

El orquestador es el único que modifica este archivo, `PRODUCT.md`, esquemas, migraciones, pagos,
asignación, crédito, redención, reembolsos o estados de checkpoint. Una tarea delegada recibe guías,
contrato congelado, archivos permitidos, pruebas requeridas y prohibición de commits, pushes y
cambios ajenos. El orquestador inspecciona cada diff y repite las pruebas pertinentes.

Al reanudar: leer este archivo, ejecutar `git status --short`, revisar el diff, confirmar rama e
índice GitNexus y reclamar el primer checkpoint sin bloquear.

## Aceptación obligatoria

- Migración/backfill, restricciones padre/línea, tokens legados y compatibilidad de rollback.
- Persistencia por bar, reload/restart, seed idempotente, carritos separados, cantidades y límite 20.
- IDs repetidos, otro bar, catálogo obsoleto, producto pausado, payload malformado y dinero cliente.
- Idempotencia concurrente, claves conflictivas, compras nuevas, rechazo, PSE pendiente, aprobación
  tardía, callback duplicado, sobrepago y checkout cerrado.
- Un cobro por el bruto agregado y exactamente las líneas/unidades esperadas.
- Líneas 40%, 50% y 100%, deducciones fraccionarias y residuo determinista.
- Límites de barra sobre obligación agregada, vencimiento, deuda y monto único por cobrar.
- Un escaneo para todas las líneas; concurrencia, sitio equivocado, personal revocado, unidades no
  redimibles y reintento tras respuesta perdida.
- Reembolso por línea y total, disputas, correcciones, transparencia e historia sin duplicación.
- Compatibilidad de un producto en app, barra, correo, QR, historia y reembolso.
- Playwright mixto para app y barra: una URL, un QR, un escaneo, resumen y total correctos.

Comandos finales:

```bash
git diff --check
bun run lint
bun run typecheck
bun run test:commerce
bun run build
bun run test:e2e
node .gitnexus/run.cjs detect-changes --scope compare --base-ref preview --repo tumbenla
```
