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

## Lado sitio

| Metrica | Definicion | Estado |
|---|---|---|
| Sitios publicados | `venue` con `published_at` no nulo | medible |
| Solicitudes por semana | `venue_application` por `created_at` | medible |
| Solicitud → revisada | `venue_application.reviewed_at - created_at` | medible |
| Solicitud → publicada | `venue_application.created_at` → `venue.published_at` | medible |
| **Verificacion de aporte** | `venue_contribution.verified_at - created_at` | **medible** |
| Aportes por estado | `venue_contribution` agrupado por `status` | medible |
| Sitios activos | con `party_night` en las ultimas 3 semanas | medible |
| Sitios en silencio | publicados, sin `party_night` en 3 semanas | medible |
| **Origen de la solicitud** | de donde llego el bar | **NO existe** — ver abajo |

**Activacion de un sitio:** su primer `venue_contribution` con
`status = 'verified'`. No la publicacion, no la primera noche.

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
| Cuanta gente ve el mapa | — | **NO existe** — ver abajo |

**Activacion de un rumbero:** su primer `photo_claim`. No la cuenta, no la
visita. (Decision 9: no hay boton de "estuve aqui" porque se infla con clics.)

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
