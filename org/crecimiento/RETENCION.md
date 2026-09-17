# Retencion — documento de pie

Aca no hay suscripcion, entonces no hay churn en el sentido del manual: nadie
cancela nada. Lo que hay es **silencio**. Un sitio deja de reportar. Un rumbero
no vuelve a reclamar. Nada se rompe visiblemente y por eso hay que ir a buscarlo.

Las skills de retencion importadas (`churn-prevention`, `emails`) traen dunning,
save offers y recuperacion de pagos fallidos. **Nada de eso aplica.** Lo que si
sirve de ahi es la parte de senales tempranas y de flujos de reenganche.

---

## Sitio: cuando se apaga

| Senal | Que la delata en la base | Que tan grave |
|---|---|---|
| No publica noches | ultima `partyNight` hace mas de 3 semanas | temprana |
| Tiene noches pero no entrega productos | `partyNight` sin `order_redemption` en el periodo | media |
| Tiene productos publicados sin entregas | `venueProduct` publicado sin `order_redemption` | temprana |
| No entra al panel | sin sesion de ningun `venueMember` | debil, no accionar sola |

La entrega registrada es la señal operativa vigente. Las filas de
`venueContribution` que aparecen en datos son legado de liquidaciones y no
definen la activación ni una promesa de comunicación.

**Que sostiene a un sitio:**
1. Que lo verifiquemos rapido. Todo lo demas es secundario.
2. Que vea gente reclamando fotos de sus noches — la prueba de que sirvio.
3. Que sus compras verificadas salgan en `/transparencia` con su nombre.

**El hueco que ya esta identificado en el roadmap:** hoy nada le avisa a un dueno
que tiene fotos por revisar o un reporte abierto. Hay que entrar al panel a
mirar. Mientras eso siga asi, la retencion del lado sitio depende de que el dueno
se acuerde solo, y esa es una apuesta que se pierde.

---

## Rumbero: cuando no vuelve

| Senal | Que la delata | Que tan grave |
|---|---|---|
| Pidió un producto y nunca vuelve | una sola entrega registrada | la principal |
| Entro a `/mi-historia` y no volvió | sin pedido o reclamo posterior | media |
| Guardó una noche sin pedir | `photoClaim` de un solo `partyNight` | temprana |

**La segunda noche es todo.** Alguien que pide y recibe productos en dos noches
distintas ya entendió para qué sirve esto; una foto guardada puede acompañar la
historia, pero no reemplaza la entrega como señal principal. La métrica de
retención de este lado es cuántos llegan a la segunda noche, no sesiones ni
visitas.

**Que hace que alguien vuelva:**
1. Que haya otra noche y productos publicados. Depende del sitio, no de nosotros
   — otra razón por la que la retención del sitio manda sobre la del rumbero.
2. Que `/mi-historia` haya crecido desde la última vez.
3. Que alguien del combo le avise que hay una noche nueva o una foto aprobada.

**Lo que no se hace para traerlo de vuelta:** correos de reenganche genericos,
notificaciones sin nada nuevo detras, y absolutamente nada que exponga fotos
suyas para generar el aviso.

---

## El orden correcto

La retencion del sitio va **antes** que la del rumbero, y no es una preferencia:
si el sitio deja de subir noches, el rumbero no tiene a que volver. Cualquier
semana en que haya que escoger, se escoge el sitio.

---

## Lo que se puede medir hoy y nadie esta mirando

Las tres definiciones y sus consultas estan en `org/datos/METRICAS.md`. **Ninguna
de las tres necesita que se construya nada**: el esquema ya las soporta y nadie
las ha consultado.

- **Tragos entregados por sitio.** `order_redemption` permite revisar si la carta
  publicada realmente se está usando.
- **Segunda noche por rumbero.** `photo_claim` + `party_photo.night_id`.
- **Sitios en silencio.** `venue` publicados sin `party_night` en tres semanas.

Lo que si falta instrumentar (origen de la solicitud, vista del mapa) esta en
`org/datos/METRICAS.md`, en "Lo que hoy NO se puede medir".
