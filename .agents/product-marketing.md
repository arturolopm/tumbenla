# Contexto de producto — Tumbenla

> Este archivo lo leen TODAS las skills de marketing antes de trabajar.
> Es el filtro entre una libreria generica de SaaS y este producto.
> La fuente de verdad del producto sigue siendo `PRODUCT.md`; la del
> departamento, `org/ORG.md`.

## Que es

Directorio de bares y discotecas de **Manizales, Colombia** que ponen una parte
de sus ventas en material de construccion despues del sismo. El sitio reporta lo
que entrego, nosotros lo verificamos, compramos el material y publicamos la
factura.

**La plata no pasa por la app.** No cobramos, no procesamos pagos, no hay planes,
no hay suscripcion, no hay MRR, no hay trial. Lo unico que tenemos es la
confianza.

## Los dos publicos (mercado de dos lados)

| | **Sitio** (oferta) | **Rumbero** (demanda) |
|---|---|---|
| Quien | dueno o administrador de un bar o discoteca en Manizales | alguien que sale de rumba en Manizales |
| Que gana | aparecer en el mapa, prueba publica de que cumplio, mas gente en la puerta | ver que su noche conto, sus fotos, su estimado en `/mi-historia` |
| Que le pedimos | reportar el aporte con recibo | reclamar sus fotos |
| Donde esta | la calle, WhatsApp, el gremio, Instagram del bar | Instagram, TikTok, el grupo de la parcha, el bar mismo |
| Acto de activacion | primer aporte **verificado** | primera foto reclamada |

Ninguno de los dos lados vale solo. Las fotos de los sitios traen rumberos; los
rumberos reclamando fotos le dan al sitio la razon para seguir reportando.

## Voz

Le hablamos a **un combo que sale de rumba**, no a un donante que socorre a una
victima. Ver `org/crecimiento/VOZ.md` — es obligatorio antes de escribir copy.

## Prohibiciones que no se negocian

Vienen de `PRODUCT.md` (Decisiones y Riesgos) y **mandan sobre cualquier
recomendacion de una skill importada**:

1. **Ninguna cifra inventada.** Todo numero en pantalla sale de la base o no se
   renderiza. Nada de "mas de 1.000 rumberos", "10 bares ya se unieron" ni
   ninguna prueba social estimada, redondeada o proyectada. Lo no verificado
   dice "por confirmar". *(Decision 5)*
2. **La voz no reparte a la gente entre quien ayuda y quien es ayudado.** Nada de
   "solidario", "apoya la causa", "ayudamos", "damnificados", "dona". *(Decision 16)*
3. **No se publica magnitud del sismo, numero de damnificados ni cifra de dano**
   sin fuente oficial (SGC o UNGRD). Prohibido el newsjacking sobre el desastre.
   *(Riesgo 4)*
4. **Las fotos de fiesta son de gente identificable.** Ninguna tactica de
   crecimiento puede depender de hacerlas publicas. No existe ni va a existir un
   boton de "hacer publicas todas". *(Riesgo 3)*
5. **Nada detras del login.** Iniciar sesion AGREGA una capa personal; nunca
   restringe. Ni `/transparencia`, ni el mapa, ni los recibos. *(Decision 2)*
6. **El verso de la cancion no se usa.** El nombre si, el guino si, el verso no.
   Exposicion de licenciamiento real. *(Decision 3)*
7. **Solo Manizales.** Nada de campanas ni pSEO por ciudad hasta que la segunda
   ciudad exista de verdad en el producto. *(Roadmap)*
8. **El estimado es un estimado.** Cualquier pieza que muestre el aporte de una
   persona conserva el rotulo. Es la diferencia entre un estimado y una mentira.
   *(Riesgo 6)*

## Skills importadas que NO aplican aca

No hay ingresos en la app, no hay ventas B2B y no hay producto de pago. Estas
estan instaladas pero no se usan salvo que el modelo de negocio cambie:

`pricing`, `paywalls`, `offers`, `revops`, `sales-enablement`, `prospecting`,
`cold-email`, `aso`, `sms`, `ads`, `ad-creative`, `attribution` (multi-touch),
`churn-prevention` (la parte de dunning y pagos fallidos).

Las que si aplican y como, en `org/ORG.md`.

## Donde dejar lo que produzcas

Un archivo (video, imagen, texto de reparto) va en
`org/crecimiento/piezas/<nombre-de-la-pieza>/`, con un `PIEZA.md` al lado que
diga que es, que reglas cumple y si ya se repartio. Una decision va al `.md` del
departamento que la tomo. Una cifra va a `org/datos/METRICAS.md` con su consulta.
Nada nuevo en la raiz del repo.
