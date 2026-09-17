# Crecimiento — documento de pie

Adquisicion de los dos lados. La retencion tiene su propio archivo:
`org/crecimiento/RETENCION.md`. Las prohibiciones estan en
`.agents/product-marketing.md` y mandan sobre todo lo de aca.

## Estado

Ninguna cifra en este archivo esta puesta a mano. Las casillas dicen "por medir"
hasta que Datos las llene desde la base. Un tablero con numeros inventados es
peor que un tablero vacio: el vacio se nota.

Las definiciones y las consultas viven en `org/datos/METRICAS.md`, no aca. Este
archivo dice **cual importa**; ese dice **como se saca**. Dos copias de la misma
definicion se separan en un mes.

| Metrica | Hoy |
|---|---|
| **Fotos reclamadas por noche** — la del lazo | por medir |
| Sitios publicados | por medir |
| Solicitudes por semana | por medir |
| Solicitud → publicado (tasa y dias) | por medir |
| Noches publicadas por semana | por medir |
| Rumberos con al menos una foto | por medir |
| Tragos entregados por sitio | por medir |

Todas son medibles hoy: el esquema las soporta y nadie las ha consultado. La de
negrita es la del lazo; si solo se mira una, es esa.

---

## Lado sitio: como llega un bar

```
lo oye  ->  /registrar-sitio  ->  venueApplication  ->  DM de verificacion
        ->  venue published ->  producto publicado -> primer trago entregado
        ->  aca esta activo, no antes
```

**El cuello de botella es humano y esta a proposito.** Una solicitud no crea el
sitio (Decision 20): alguien tiene que hablar con el bar. Eso pone un techo real
a cuantos sitios entran por semana, y ese techo es una decision, no un bug. Toda
tactica de adquisicion de sitios se disena contra ese techo: no sirve traer
cuarenta solicitudes si se verifican tres por semana.

**Que mueve a un dueno de bar:** que lo vean, que se sepa que cumplio, y que el
bar de al lado ya este en el mapa. En ese orden. No lo mueve un argumento moral
y no lo mueve un formulario mas bonito.

**Canales que tienen sentido, por costo real:**

1. **De bar en bar, a pie.** El unico que funciona al principio y el unico que
   ademas devuelve investigacion. Es caro en tiempo y no escala; por eso va
   primero, mientras el techo de verificacion es bajo de todos modos.
2. **El gremio y el vecino.** Un bar publicado y verificado es el mejor
   argumento frente al de la misma cuadra. `/transparencia` es el material de
   ventas y ya existe.
3. **Instagram del bar, no el nuestro.** El bar publicado tiene motivo propio
   para contarlo. Ese alcance es prestado y es el mas barato que hay.
4. **Prensa local.** Sirve, con la regla intacta: la nota es sobre los bares y
   los recibos, **nunca sobre el sismo con cifras propias** (Riesgo 4).

**Lo que NO se hace:** ads pagos (no hay con que medir la conversion de un lado
que se cierra por DM), cold email a bares (mata la relacion antes de empezar),
pSEO por ciudad mientras no haya cobertura y evidencia suficiente en cada ciudad.

---

## Lado rumbero: como llega alguien que sale de rumba

```
lo ve  ->  mapa / sitio  ->  sale esa noche  ->  pide un producto
       ->  recibe el trago  <- aca esta activo
       ->  cuenta + /mi-historia  ->  vuelve cuando haya otra noche
```

**El acto de activacion es pedir y recibir un producto.** Las fotos siguen siendo
un recorrido válido para guardar una noche, pero no se presentan como la razón
principal del producto ni como una métrica de impacto financiero.

**Lo que hay que entender:** el rumbero no viene por el mapa. Viene porque salio,
porque alguien le dijo "estan tus fotos" y porque quiere verse. El mapa es lo que
encuentra despues. Cualquier campana que le pida a alguien "entrar a conocer el
mapa" esta empujando por el lado equivocado del embudo.

**Canales que tienen sentido:**

1. **El sitio mismo, la noche de la fiesta.** Un codigo o un letrero en la barra
   el dia siguiente. Es el momento de maxima intencion y hoy no existe nada ahi.
2. **La cuenta del bar publicando la galeria.** El bar tiene la audiencia exacta
   que salio esa noche. Nosotros no.
3. **El reclamo mismo, boca a boca.** Alguien que se encuentra en una foto le
   avisa a los otros cinco que salen en la misma. Es el unico lazo viral honesto
   que tiene el producto, y no depende de hacer nada publico (Riesgo 3).
4. **`/transparencia` como pieza compartible.** Un recibo verificado es contenido
   por si solo y no necesita adorno.

**Lo que NO se hace:** nada que dependa de que las fotos sean publicas por
defecto. `photoClaim.showPublicly` arranca en `false` y ahi se queda. Un
crecimiento construido sobre exponer a gente identificable no es crecimiento, es
una demanda esperando.

---

## Los dos huecos de medicion

Solo dos cosas hay que construir para medir; el resto ya esta en el esquema. La
lista completa y el detalle estan en `org/datos/METRICAS.md`.

- **De donde llego una solicitud de sitio.** `venue_application` no guarda
  origen. Sin eso, ningun experimento de canal del lado sitio es concluyente.
- **Cuanta gente ve el mapa y no reclama nada.** No hay analitica ni evento de
  vista. Hoy solo existe el numerador, asi que cualquier "tasa de conversion"
  del lado rumbero seria inventada.

Los dos son baratos y bloquean casi todo lo demas del lado de adquisicion. Van
primero. Lo que **no** esta bloqueado es la retencion: ver
`org/crecimiento/RETENCION.md`.
