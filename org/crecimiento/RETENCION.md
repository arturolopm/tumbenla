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
| Publica noches pero no reporta aporte | `partyNight` sin `venueContribution` en el periodo | media |
| Reporto y se quedo en `submitted` | `venueContribution.status = 'submitted'` viejo | **nuestra, no de el** |
| No entra al panel | sin sesion de ningun `venueMember` | debil, no accionar sola |

**La tercera fila es la importante y es culpa nuestra.** Un aporte reportado que
se queda sin verificar es un sitio que hizo su parte y no vio nada. Esa es la
forma mas rapida de perder un bar y no aparece en ningun tablero de marketing.
El tiempo de `submitted` a `verified` es una metrica de retencion, no de
operacion.

**Que sostiene a un sitio:**
1. Que lo verifiquemos rapido. Todo lo demas es secundario.
2. Que vea gente reclamando fotos de sus noches — la prueba de que sirvio.
3. Que su aporte verificado salga en `/transparencia` con su nombre.

**El hueco que ya esta identificado en el roadmap:** hoy nada le avisa a un dueno
que tiene fotos por revisar o un reporte abierto. Hay que entrar al panel a
mirar. Mientras eso siga asi, la retencion del lado sitio depende de que el dueno
se acuerde solo, y esa es una apuesta que se pierde.

---

## Rumbero: cuando no vuelve

| Senal | Que la delata | Que tan grave |
|---|---|---|
| Reclamo una foto y nunca otra | un solo `photoClaim`, cuenta vieja | la principal |
| Entro a `/mi-historia` y no volvio | sin sesion posterior | media |
| Reclamo fotos de una noche sola | `photoClaim` de un solo `partyNight` | temprana |

**La segunda noche es todo.** Alguien que reclamo fotos de dos noches distintas
ya entendio para que sirve esto; alguien con una sola vino por una foto. La
metrica de retencion de este lado es **cuantos llegan a la segunda noche**, no
sesiones ni visitas.

**Que hace que alguien vuelva:**
1. Que haya fotos nuevas suyas. Depende del sitio, no de nosotros — otra razon
   por la que la retencion del sitio manda sobre la del rumbero.
2. Que `/mi-historia` haya crecido desde la ultima vez.
3. Que alguien del combo le avise que salio en una foto.

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

- **Tiempo de `submitted` a `verified`.** `venue_contribution.verified_at` ya
  existe. Es la metrica de retencion mas importante del proyecto y esta a una
  consulta de distancia.
- **Segunda noche por rumbero.** `photo_claim` + `party_photo.night_id`.
- **Sitios en silencio.** `venue` publicados sin `party_night` en tres semanas.

Lo que si falta instrumentar (origen de la solicitud, vista del mapa) esta en
`org/datos/METRICAS.md`, en "Lo que hoy NO se puede medir".
