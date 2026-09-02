# Tumbenla — la organizacion

Tumbenla se opera como una empresa chiquita con tres departamentos, no como un
repositorio con skills sueltas. Cada departamento tiene **un documento de pie**
(el que lee antes de trabajar y actualiza despues), **un agente** y **cosas que
solo el decide**. Se hablan por un solo canal: la bitacora de experimentos.

```
                    PRODUCT.md  (la constitucion: decisiones y riesgos)
                          |
        +-----------------+------------------+
        |                 |                  |
    PRODUCTO         CRECIMIENTO           DATOS
    que se           quien llega           que paso de verdad
    construye        y quien vuelve        (solo cifras de la base)
        |                 |                  |
        +--------> org/crecimiento/EXPERIMENTOS.md <--------+
                   (el unico canal entre departamentos)
```

El **codigo** no es un departamento: es el taller donde los tres trabajan.
Lo gobierna `CLAUDE.md`.

---

## Donde vive cada cosa

El arbol de archivos es el organigrama. Si algo no cabe en una de estas cajas, es
que todavia no se decidio de quien es.

```
npi/
├── PRODUCT.md              la constitucion. La leen los tres, no es de nadie
├── CLAUDE.md               el taller: como se toca el codigo
└── org/
    ├── ORG.md              esta carta
    ├── crecimiento/
    │   ├── CRECIMIENTO.md  adquisicion de los dos lados
    │   ├── RETENCION.md    quien se apaga y como se nota
    │   ├── PUBLICOS.md     a quien le hablamos (casi todo sin validar)
    │   ├── VOZ.md          reglas de copy. Obligatorio antes de escribir
    │   ├── EXPERIMENTOS.md el unico canal entre departamentos
    │   └── piezas/         lo producido: videos, imagenes, copy de reparto
    │       └── video-lanzamiento/
    └── datos/
        └── METRICAS.md     definicion y consulta de cada cifra
```

**`PRODUCT.md` se queda en la raiz a proposito.** Es la constitucion, no el
cuaderno de un departamento: Producto la mantiene, pero Crecimiento y Datos la
obedecen igual. Meterla en `org/producto/` la haria ver como la opinion de un
departamento, y es lo contrario.

**Retencion vive dentro de Crecimiento**, no aparte. Adquirir a alguien que se va
a la semana no es adquirir; es el mismo departamento resolviendo las dos mitades
del mismo problema. Cuando toque escoger entre las dos, gana retencion del lado
sitio (la razon esta en `RETENCION.md`).

**`piezas/` es lo producido, no lo decidido.** Un video, una imagen, el texto de
reparto de un lanzamiento. Lo que se decidio va en un `.md` de departamento; lo
que se fabrico va aca, en su propia carpeta con nombre de pieza.

---

## Los tres departamentos

| | **Producto** | **Crecimiento** | **Datos** |
|---|---|---|---|
| Documento de pie | `PRODUCT.md` | `org/crecimiento/CRECIMIENTO.md` | `org/datos/METRICAS.md` (y detras, `src/database/schema.ts`) |
| Agente | `.claude/agents/producto.md` | `.claude/agents/crecimiento.md` | `.claude/agents/datos.md` |
| Decide solo | alcance, roadmap, si algo contradice una decision tomada | mensaje, canal, a quien le hablamos, que experimento se propone | si una cifra se puede afirmar |
| No decide | si un experimento vale la pena | si algo se construye | que se hace con el resultado |
| Puede vetar | cualquier experimento que rompa una decision o un riesgo | ningun experimento; solo propone | cualquier afirmacion sin respaldo en la base |

**Los tres vetos son reales y son distintos.** Producto veta por contradiccion,
Datos veta por falta de evidencia, y Crecimiento no veta: propone. Un
departamento que puede aprobar sus propias propuestas no es un departamento.

---

## El unico canal: la bitacora

Los departamentos **no se mandan recados sueltos**. Todo pasa por
`org/crecimiento/EXPERIMENTOS.md`, que es a la vez la cola de trabajo, el acta
de las tres firmas y la memoria de lo que ya se intento.

Un experimento recorre cinco estados y **no salta ninguno**:

| Estado | Quien lo mueve | Que tiene que pasar |
|---|---|---|
| `Propuesto` | Crecimiento | hipotesis, lado del embudo, metrica, tamano esperado |
| `Medible` | Datos | la metrica ya existe en la base **o** queda escrito que hay que instrumentarla |
| `Aprobado` | Producto | no contradice ninguna decision ni riesgo, y el alcance cabe |
| `En curso` | quien construya | ventana de medicion fijada de antemano, no despues |
| `Cerrado` | Datos escribe el resultado, Producto o Crecimiento la decision | resultado con cifra real, o "no concluyente" |

**Si la metrica no existe, el experimento no arranca.** Se convierte en un
pendiente de instrumentacion en el roadmap de Producto y espera ahi. Esta regla
es la que evita la version cara del error: construir la variante, lanzarla y
descubrir despues que no habia con que medirla.

Una decision que se sostiene despues de cerrado un experimento **sube a
`PRODUCT.md`**, a "Decisiones tomadas", con el porque en una linea. La bitacora
guarda el intento; `PRODUCT.md` guarda la conclusion. Esa es la diferencia entre
las dos y por eso son dos archivos.

---

## Adquisicion y retencion: el embudo de dos lados

Detalle completo en `org/crecimiento/CRECIMIENTO.md` (adquisicion) y
`org/crecimiento/RETENCION.md` (retencion). El resumen:

**Lado sitio:** lo ve → solicita alta (`venueApplication`) → lo verificamos →
publicado (`venue`) → primera noche con fotos (`partyNight`) → primer aporte
reportado (`venueContribution`) → **primer aporte verificado** ← activacion →
sigue reportando mes a mes ← retencion

**Lado rumbero:** lo ve → sale a un sitio → **reclama una foto** (`photoClaim`)
← activacion → cuenta y `/mi-historia` → vuelve y reclama otra noche ← retencion

**El lazo que los une:** un sitio sube fotos → los rumberos de esa noche las
reclaman → el sitio ve que su noche movio gente → reporta el aporte → el aporte
verificado sale en `/transparencia` → eso es lo que convence al siguiente sitio.

La metrica que compone es **fotos reclamadas por noche publicada**. Es la unica
que mide el lazo entero y no un lado suelto.

---

## Las skills importadas

Estan instaladas las 50 de `coreyhaines31/marketingskills`. Son de un SaaS B2B
gringo con precio, plan y embudo de un solo lado. Aca no hay nada de eso, asi que
**se usan filtradas**, nunca al pie de la letra.

Todas leen `.agents/product-marketing.md` antes de trabajar. Ese archivo lleva
las ocho prohibiciones que mandan sobre cualquier recomendacion que salga de
ellas.

| Se usan tal cual | Se usan adaptadas | No se usan (no hay modelo de negocio para eso) |
|---|---|---|
| `cro`, `copy-editing`, `analytics`, `ab-testing`, `seo-audit`, `schema`, `site-architecture`, `customer-research`, `marketing-psychology`, `image` | `copywriting` y `social` (pasan por `VOZ.md` primero), `onboarding` y `signup` (dos embudos, no uno), `referrals` (sin plata: el incentivo es la foto y el mapa), `launch` (sin Product Hunt: el lanzamiento es local), `community-marketing` (el parche, no un Discord), `public-relations` (prensa local, y nunca sobre el sismo), `emails` (avisos de panel, no nurture), `content-strategy` y `programmatic-seo` (una sola ciudad hoy) | `pricing`, `paywalls`, `offers`, `revops`, `sales-enablement`, `prospecting`, `cold-email`, `aso`, `sms`, `ads`, `ad-creative`, `attribution`, `churn-prevention` (la parte de cobros) |

Las tres columnas se revisan cuando cambie el modelo, no cada semana.

---

## Como se mantiene esto

- Una decision de producto va a `PRODUCT.md`. Nunca aca.
- Un experimento va a `EXPERIMENTOS.md`. Nunca a `PRODUCT.md` hasta que cierre.
- Un aprendizaje sobre a quien le hablamos va a `PUBLICOS.md`.
- Una regla de copy va a `VOZ.md`.
- Este archivo solo cambia si cambia **quien decide que**.
