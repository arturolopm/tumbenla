# Metricas — documento de pie de Datos

La definicion canonica de cada cifra y la consulta que la saca. Si una metrica no
esta aca, no esta definida, y si no esta definida no se afirma.

Documento de pie de verdad: `src/database/schema.ts`. Si algo no esta ahi, no
existe. Este archivo es el indice: que se puede medir hoy, con que consulta, y
que falta.

Postgres local: `bun run db:psql`. Toda cifra se reporta **junto a su consulta**,
con tabla, filtro y ventana. Un numero sin su consulta al lado no sirve.

---

## La del lazo

**Fotos reclamadas por noche publicada.** La unica que mide el mercado de dos
lados completo en vez de un lado suelto. Si solo se mira una, es esta.

```sql
select n.id, n.happened_at, count(distinct c.id) as reclamos
from party_night n
left join party_photo p on p.night_id = n.id
left join photo_claim c on c.photo_id = p.id
group by n.id, n.happened_at
order by n.happened_at desc;
```

---

## La que atrapa el fraude

**Tasa de escaneo del pago-en-barra contra la del pago-en-app.**

El mecanismo del producto (Decision 26) es que el mesero no distingue cual orden
esta pagada hasta despues de escanear. Si eso se cumple, **las dos tasas tienen
que ser iguales**. No escanear una orden de barra le borra al sitio una deuda con
nosotros; no escanear una de app le hace perder su propia parte. Un sitio cuyas
ordenes de barra se escanean menos que las de app **encontro como distinguirlas**,
y eso es exactamente lo que hay que ver.

```sql
-- por sitio: que fraccion de cada metodo termino escaneada
select
  o.venue_id,
  o.pay_method,
  count(*)                                   as ordenes,
  count(*) filter (where r.redimidas > 0)    as con_escaneo,
  round(100.0 * count(*) filter (where r.redimidas > 0) / count(*), 1) as tasa
from product_order o
left join lateral (
  select count(*) filter (where status = 'redeemed') as redimidas
  from order_redemption where order_id = o.id
) r on true
where o.created_at > now() - interval '30 days'
group by o.venue_id, o.pay_method
order by o.venue_id, o.pay_method;
```

**Como se lee.** Una diferencia grande entre los dos `pay_method` de un mismo
sitio es la senal. No es prueba —un bar puede tener el celular dañado— pero es
por donde se empieza a preguntar. Con pocas ordenes no dice nada: por debajo de
unas 20 por metodo, "no concluyente".

---

## El libro tiene que cuadrar

No es una metrica de producto, es una **prueba de integridad** y se corre igual
que las demas:

```sql
select sum(amount) as debe_dar_cero from ledger_entry;
```

Si no da cero, hay un asiento que no se escribio y **ninguna cifra de plata de
este archivo sirve hasta que se arregle**. Es la ventaja de la partida doble
sobre un saldo con signo: el error se ve solo.

```sql
-- y por transaccion, para encontrar cual quedo coja
select transaction_id, sum(amount) from ledger_entry
group by transaction_id having sum(amount) <> 0;
```

---

## Cobro, neto y asignacion de impacto

Estas definiciones reemplazan cualquier lectura anterior que tratara el porcentaje
congelado como un valor final, o que enviara automaticamente una orden vencida a
material. El porcentaje se congela en la orden; el valor exacto en pesos queda
**pendiente** hasta reconciliar el bruto, cada deduccion itemizada y la retencion
aplicable.

| Metrica | Definicion canonica | Estado |
|---|---|---|
| Cobro bruto por app | suma de `product_order.total_amount` con `pay_method = 'app'` y cobro confirmado, agrupada por ventana | **NO existe aun** — el esquema actual no separa cobro confirmado de `status = 'paid'` simulado |
| Neto reconciliado | bruto confirmado menos cada deduccion itemizada y retencion aplicable, con evidencia del reporte del proveedor | **NO existe aun** — faltan intentos, deducciones y conciliacion |
| Asignacion exacta de impacto | porcentaje congelado aplicado al neto reconciliado, con redondeo y ajustes auditables | **NO existe aun** — `unit_donation_amount` es el snapshot previo a deducciones, no el valor final |
| Asignacion pendiente | orden cobrada cuyo neto o deducciones aun no estan reconciliados | **NO existe aun** |
| Recibo del receptor | transferencia bancaria confirmada al beneficiario verificado | **NO existe aun** |
| Compra verificada | compra de material con factura/evidencia revisada y publicada | `material_purchase`, pero no prueba que exista recibo del receptor |
| QR de app vencido | unidad no redimida al cumplir 45 días, conservando obligación de reembolso | **NO existe aun** — hoy falta distinguir expiración y reembolso por unidad |
| Reembolso bruto | precio bruto completo de la unidad elegible, no el neto después de deducciones | **NO existe aun** |
| Deuda de barra | obligación nacida de una unidad de barra redimida, con vencimiento a siete días | **NO existe aun** |
| Reserva de barra | capacidad reservada contra límite aprobado, con vencimiento a 15 minutos | **NO existe aun** |

Consulta diagnóstica de lo que el esquema actual sí permite ver, sin llamarlo neto
ni asignacion final:

```sql
select
  pay_method,
  status,
  count(*) as ordenes,
  sum(total_amount) as total_snapshot
from product_order
where created_at >= now() - interval '30 days'
group by pay_method, status
order by pay_method, status;
```

La consulta anterior describe snapshots de orden, incluidos fixtures y estados
simulados; no autoriza una cifra pública de cobro, neto o asignacion. Para el
reporte financiero futuro, Datos debe adjuntar la consulta de reconciliacion, el
reporte del proveedor, la ventana y la evidencia de transferencia.

La transferencia al receptor y la compra verificada no son la misma metrica ni se
suman entre sí: primero se confirma el recibo, después se puede verificar una o
varias compras contra evidencia y límites de atribución.

### Resumen público vigente

Las cuatro etapas contables internas se conservan para operación y auditoría. La pantalla pública
las resume en tres cifras comparables, siempre con `funding_classification = 'real'`:

| Métrica | Definición canónica |
|---|---|
| Total donado | Asignación final para reconstruir de unidades entregadas. En app exige cobro `approved`; en barra es el principal de la deuda nacida al entregar. Excluye disputas, sandbox y legado sin verificar. |
| Ya entregado | Parte del total anterior atribuida a una compra de material `verified`, publicada y con recibo público. La atribución está limitada por el giro bancario verificado y nunca puede exceder `Total donado`. |
| Pendiente por entregar | `Total donado - Ya entregado`. No es ingreso de Tumbenla; es la asignación que todavía no tiene una compra de material publicada contra ella. |

La consulta canónica vive en `getFoundationTransparencyStages` de
`src/lib/commerce/transparency-service.ts`. Su forma relacional es:

```sql
with donado_app as (
  select coalesce(sum(a.donation_minor), 0) as amount_minor
  from unit_allocation a
  join allocation_run r on r.id = a.allocation_run_id and r.status = 'final'
  join commerce_order_unit u on u.id = a.unit_id and u.lifecycle_status = 'redeemed'
  join commerce_order_snapshot s on s.id = u.order_snapshot_id
  join payment_charge c on c.id = r.charge_id and c.status = 'approved'
  where s.funding_classification = 'real'
), donado_barra as (
  select coalesce(sum(d.principal_minor), 0) as amount_minor
  from credit_debt d
  join commerce_order_unit u on u.id = d.unit_id
  join commerce_order_snapshot s on s.id = u.order_snapshot_id
  where s.funding_classification = 'real'
), compras_con_recibo as (
  select coalesce(sum(pfa.amount_minor), 0) as amount_minor
  from purchase_funding_allocation pfa
  join foundation_purchase fp on fp.id = pfa.foundation_purchase_id
  join material_purchase mp on mp.id = fp.material_purchase_id
  join finance_evidence e on e.id = fp.receipt_evidence_id
  join financial_operation_allocation foa on foa.id = pfa.payout_allocation_id
  join financial_operation fo on fo.id = foa.operation_id
  join beneficiary_bank_version bbv on bbv.id = fo.beneficiary_bank_version_id
  where fp.status = 'verified'
    and mp.status = 'published'
    and e.status = 'published'
    and e.kind = 'purchase_receipt'
    and fo.kind = 'foundation_payout'
    and fo.status = 'bank_verified'
    and fo.funding_classification = 'real'
    and foa.source_type = 'foundation_unit_allocation'
    and bbv.beneficiary_id = fp.beneficiary_id
)
select
  donado_app.amount_minor + donado_barra.amount_minor as total_donado_minor,
  least(
    compras_con_recibo.amount_minor,
    donado_app.amount_minor + donado_barra.amount_minor
  ) as ya_entregado_minor,
  greatest(
    donado_app.amount_minor + donado_barra.amount_minor - compras_con_recibo.amount_minor,
    0
  ) as pendiente_por_entregar_minor
from donado_app, donado_barra, compras_con_recibo;
```

En `/mi-historia`, `Total gastado` suma `commerce_order_unit.gross_minor` para la persona y la
clasificación real, incluyendo unidades `issued`, `redeemed` o `refund_reserved`, y unidades app
`expired` que todavía conservan el pasivo de devolución. Excluye `pending_payment`, `void` y
`refunded`. `Total donado` aplica los mismos filtros de asignación final del resumen público, además
del `product_order.user_id`. Los pedidos no reales pueden mostrarse como historial, pero nunca
alimentan estas dos cifras.

---

## Lado sitio

| Metrica | Definicion | Estado |
|---|---|---|
| Sitios publicados | `venue` con `published_at` no nulo | medible |
| Solicitudes por semana | `venue_application` por `created_at` | medible |
| Solicitud → revisada | `venue_application.reviewed_at - created_at` | medible |
| Solicitud → publicada | `venue_application.created_at` → `venue.published_at` | medible |
| Verificacion de aporte legado | `venue_contribution.verified_at - created_at`, solo para historial compatible | **medible, no es activacion vigente** |
| Aportes por estado legado | `venue_contribution` agrupado por `status` | **medible, no es asignacion de checkout** |
| Sitios con carta | sitios con al menos un `venue_product` publicado | medible |
| Producto: creado → aprobado | `venue_product.reviewed_at - created_at` | medible |
| Tragos entregados por sitio | `order_redemption` en `redeemed` | medible |
| Saldo por sitio | `sum(amount)` de su cuenta `venue_current`, separando simulación/legado | medible con clasificación |
| Ordenes sin escanear | `product_order` pagada, sin redención, viva | medible como diagnóstico; no prueba cobro real |
| Sitios activos | con `party_night` en las ultimas 3 semanas | medible |
| Sitios en silencio | publicados, sin `party_night` en 3 semanas | medible |
| **Notificación impacto vista (bar)** | `impact_notification` donde `recipient_type='venue'` y `read_at` no nulo | **NO existe aun** — falta tabla + worker |
| **Origen de la solicitud** | de donde llego el bar | **NO existe** — ver abajo |

**Activacion de un sitio:** su **primer trago entregado** — la primera
`order_redemption` en `redeemed` de un producto suyo. No la publicacion, no la
primera noche, y **ya no el primer aporte verificado**: eso definia la
activacion cuando reportar era el camino principal, y desde la Decision 1 el
camino principal es vender. Un sitio que armo la carta pero nunca escaneo nada
no esta activo, esta decorado.

`venue_contribution` conserva filas del modelo anterior y puede medirse para
reconciliacion histórica. No representa una segunda vía vigente ni convierte un
porcentaje de ventas no auditado en una asignacion actual.

```sql
-- historial: tiempo de verificado, no una metrica de checkout actual
select
  percentile_cont(0.5) within group (order by verified_at - created_at) as mediana,
  count(*) filter (where verified_at is null and status = 'submitted') as pendientes
from venue_contribution;
```

```sql
-- sitios en silencio: publicados y sin noche hace mas de 3 semanas
select v.slug, max(n.happened_at) as ultima_noche
from venue v
left join party_night n on n.venue_id = v.id
where v.published_at is not null
group by v.slug
having max(n.happened_at) < now() - interval '21 days' or max(n.happened_at) is null;
```

---

## Lado rumbero

| Metrica | Definicion | Estado |
|---|---|---|
| Rumberos con al menos una foto | `photo_claim` distinct `user_id` | medible |
| **Segunda noche** | rumberos con reclamos en 2+ `party_night` distintas | medible |
| Reclamos por rumbero | `photo_claim` agrupado por `user_id` | medible |
| Fotos disponibles sin reclamar | `party_photo` sin `photo_claim` | medible |
| Tragos pedidos | `product_order` por `created_at`, separando app/bar y estado | medible como pedidos, no como cobros |
| **Pedido → escaneado** | `order_redemption.redeemed_at - product_order.created_at` | **NO existe aun** |
| Cuanta gente ve el mapa | — | **NO existe** — ver abajo |
| **Patrón de consumo por venue** | `product_order` × `venue_id` × `product_id` × `user_id` × hora/día/semana | **medible** — esquema completo, falta consulta + UI |
| **Frecuencia por usuario/venue** | días entre `order_redemption` consecutivos por `user_id` + `venue_id` | **medible** — requiere ventana móvil |
| **LTV estimado por usuario/venue** | suma `product_order.total_amount` por `user_id` + `venue_id` | **medible** — consulta simple, falta UI |
| **Cumpleaños registrados** | `user.birthdate` no nulo + `marketing_consent = true` | **NO existe aun** — falta columna + consentimiento |
| **Notificación impacto vista** | `impact_notification` donde `recipient_type='user'` y `read_at` no nulo | **NO existe aun** — falta tabla + worker |

**Activacion de un rumbero:** su primer `photo_claim` **o su primer trago
pedido**, lo que pase primero. La foto sigue contando: es el camino por el que
llego la gente que ya esta. (Decision 9: no hay boton de "estuve aqui" porque se
infla con clics; un trago pedido no se infla porque cuesta plata.)

**Retencion de un rumbero:** llegar a la segunda noche. Alguien con reclamos en
dos noches distintas entendio para que sirve esto; alguien con una vino por una
foto.

```sql
-- segunda noche
select count(*) from (
  select c.user_id
  from photo_claim c
  join party_photo p on p.id = c.photo_id
  group by c.user_id
  having count(distinct p.night_id) >= 2
) as vuelven;
```

---

## Lo que hoy NO se puede medir

Cada uno bloquea experimentos concretos. Van al roadmap de Producto, no a una
lista de deseos.

1. **De donde llego una solicitud de sitio.** `venue_application` no guarda
   origen (calle, vecino, Instagram). Sin eso, **ningun experimento de canal del
   lado sitio es concluyente**. Es una columna y un campo en `/quiero-poner`.
   Bloquea: EXP-001.
2. **Cuanta gente ve el mapa y no reclama nada.** No hay analitica instalada ni
   evento de vista. Hoy solo existe el numerador: se puede contar quien reclamo,
   nunca quien miro y se fue. Cualquier "tasa de conversion" del lado rumbero es
   hoy inventada.
3. **Que noche llevo letrero en la barra.** No hay como marcar una `party_night`
   como parte de un experimento. Bloquea: EXP-002.

---

## Reglas al reportar

- **Una cifra sale de la base o no se afirma.** Sin estimar, sin redondear hacia
  arriba, sin proyectar, sin "aproximadamente". (`PRODUCT.md`, Decision 5.)
- **Cuando falta el denominador se dice en la misma frase que el numero.** "23
  reclamos" sin saber cuantos vieron el mapa es un dato, no una tasa.
- **"No concluyente" es una respuesta valida y, con el volumen de hoy, la
  frecuente.** No se fabrica significancia estadistica.
- **Los `decimal` vuelven de postgres-js como strings.** `amount` incluido.
  `Number()` en el borde o los totales salen en NaN.
