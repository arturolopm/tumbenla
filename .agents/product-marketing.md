# Contexto de producto — Tumbenla

> Este archivo lo leen TODAS las skills de marketing antes de trabajar.
> Es el filtro entre una libreria generica de SaaS y este producto.
> La fuente de verdad del producto sigue siendo `PRODUCT.md`; la del
> departamento, `org/ORG.md`.

## Que es

Bares y discotecas de **Manizales, Colombia** que ponen un trago en la carta con
una parte de su precio destinada a material de construccion, despues del sismo.
Nosotros compramos el material y publicamos la factura.

El camino principal es **vender un trago**: el sitio arma un producto (un coctel
nuevo, o una cerveza, un combo o una botella de su carta) y dice en la
descripcion como se reparte cada peso. La persona lo pide, lo paga —en la app o
en la barra— y le sale un QR que el mesero escanea para entregarlo.

**Por la app pasa plata, y solo para eso: un trago de un sitio.** No hay planes,
no hay suscripcion, no hay MRR, no hay trial, no hay prueba gratis y no hay nada
que "empiece desde $X al mes". Ninguna skill de SaaS aplica en esa parte. Lo
unico que tenemos sigue siendo la confianza.

El compromiso por porcentaje de ventas —"este bar pone el 10% de sus ventas"—
**se retiro** (`PRODUCT.md`, decision 34). No es un camino opcional ni un
titular de respaldo: **no existe.** Un porcentaje sobre una caja que no
auditamos habia que creerlo; un trago con su reparto escrito deja rastro.

En una pieza eso quiere decir: nunca "este bar pone una parte de sus ventas",
siempre **"de este trago de $30.000, $24.000 se van en material"**. En pesos y
sobre un producto concreto, que es lo unico que despues se puede cruzar contra
una factura publicada.

## Los dos publicos (mercado de dos lados)

| | **Sitio** (oferta) | **Rumbero** (demanda) |
|---|---|---|
| Quien | dueno o administrador de un bar o discoteca en Manizales | alguien que sale de rumba en Manizales |
| Que gana | aparecer en el mapa, vender un trago que la gente busca, prueba publica de que cumplio | pedir un trago que ya viene con su parte adentro, sus fotos, su historia en `/mi-historia` |
| Que le pedimos | armar un producto y **escanear el QR de cada orden** | pedir el trago y mostrar el QR |
| Donde esta | la calle, WhatsApp, el gremio, Instagram del bar | Instagram, TikTok, el grupo de la parcha, el bar mismo |
| Acto de activacion | **primer trago entregado** (escaneado) | **primer trago pedido** |

Ninguno de los dos lados vale solo. Un sitio sin gente pidiendo no tiene por que
armar la carta; gente pidiendo en un sitio que no escanea se va y no vuelve.

El aporte por porcentaje de ventas **ya no es un camino**: pedirle a un bar que
calcule y reporte eran tres actos de voluntad despues de la venta, todos
opcionales y ninguno verificable. Armar un producto es uno solo, ocurre durante
la venta, y deja una orden y un escaneo detras.

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
9. **El reparto se dice EN PESOS, y sin la palabra "dona".** La prohibicion 2 no
   se relaja porque ahora se cobre; al contrario, es donde mas facil se cuela.
   *(Decisiones 16 y 30)*

   | No | Si |
   |---|---|
   | "80% se dona a las victimas" | "De $30.000: **$24.000 se van en material**. $6.000 se quedan en el bar" |
   | "100% donado" | "De $30.000: **los $30.000 se van en material**" |
   | "Aporta con tu coctel" | "Pide el coctel. La cuenta queda publicada" |

   El porcentaje suelto es abstracto; los pesos se verifican despues contra la
   factura. Y no se promete a donde va mas alla de "material": el destino
   concreto solo se afirma cuando la compra existe y esta publicada.
10. **No se anuncia un producto que no este aprobado y publicado.** Ninguna
    pieza sale antes de que el operador lo apruebe (decision 31), porque hasta
    ese momento el reparto todavia puede cambiar.

## Skills importadas que NO aplican aca

Ahora se cobra, pero **no somos un SaaS**: no hay plan, no hay suscripcion, no
hay MRR y el precio del trago lo pone el bar, no nosotros. Casi todas estas
siguen sin aplicar:

`paywalls` (nada se esconde detras de pagar — decision 2), `revops`,
`sales-enablement`, `prospecting`, `cold-email`, `aso`, `sms`, `ads`,
`ad-creative`, `attribution` (multi-touch), `churn-prevention` (la parte de
dunning y pagos fallidos, que aca no existe: no hay cobro recurrente que falle).

Dos cambiaron de estado con la decision 1 y **se usan filtradas**:

- `pricing` — solo para ayudarle a un sitio a pensar el precio y el reparto de
  SU trago. Nada de escalones, ni de anclaje, ni de "el plan recomendado".
- `offers` — solo para como se presenta un producto en la carta. Nada de
  descuentos, urgencia falsa, ni escasez inventada; el argumento es a donde va
  la plata, y ese ya es suficiente.

Las que si aplican y como, en `org/ORG.md`.

## Donde dejar lo que produzcas

Un archivo (video, imagen, texto de reparto) va en
`org/crecimiento/piezas/<nombre-de-la-pieza>/`, con un `PIEZA.md` al lado que
diga que es, que reglas cumple y si ya se repartio. Una decision va al `.md` del
departamento que la tomo. Una cifra va a `org/datos/METRICAS.md` con su consulta.
Nada nuevo en la raiz del repo.
