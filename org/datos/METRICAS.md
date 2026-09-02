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

## Lado sitio

| Metrica | Definicion | Estado |
|---|---|---|
| Sitios publicados | `venue` con `published_at` no nulo | medible |
| Solicitudes por semana | `venue_application` por `created_at` | medible |
| Solicitud → revisada | `venue_application.reviewed_at - created_at` | medible |
| Solicitud → publicada | `venue_application.created_at` → `venue.published_at` | medible |
| **Verificacion de aporte** | `venue_contribution.verified_at - created_at` | **medible** |
| Aportes por estado | `venue_contribution` agrupado por `status` | medible |
| Sitios con carta | sitios con al menos un `venue_product` publicado | **NO existe aun** |
| Producto: creado → aprobado | `venue_product.reviewed_at - created_at` | **NO existe aun** |
| Tragos entregados por sitio | `order_redemption` en `redeemed` | **NO existe aun** |
| Saldo por sitio | `sum(amount)` de su cuenta `venue_current` | **NO existe aun** |
| Ordenes sin escanear | `product_order` pagada, sin redencion, viva | **NO existe aun** |
| Sitios activos | con `party_night` en las ultimas 3 semanas | medible |
| Sitios en silencio | publicados, sin `party_night` en 3 semanas | medible |
| **Origen de la solicitud** | de donde llego el bar | **NO existe** — ver abajo |

**Activacion de un sitio:** su **primer trago entregado** — la primera
`order_redemption` en `redeemed` de un producto suyo. No la publicacion, no la
primera noche, y **ya no el primer aporte verificado**: eso definia la
activacion cuando reportar era el camino principal, y desde la Decision 1 el
camino principal es vender. Un sitio que armo la carta pero nunca escaneo nada
no esta activo, esta decorado.

Para los sitios que van por el camino viejo (aporte por porcentaje, opcional),
la activacion sigue siendo su primer `venue_contribution` verificado. Son dos
definiciones porque son dos caminos, y al reportar hay que decir cual se uso.

```sql
-- tiempo de reportado a verificado, la metrica de retencion mas importante
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
| Tragos pedidos | `product_order` por `created_at` | **NO existe aun** |
| **Pedido → escaneado** | `order_redemption.redeemed_at - product_order.created_at` | **NO existe aun** |
| Cuanta gente ve el mapa | — | **NO existe** — ver abajo |

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
