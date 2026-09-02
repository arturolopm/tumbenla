# Pieza — video de lanzamiento

**Departamento:** Crecimiento · **Lado del embudo:** los dos, sobre todo rumbero
· **Estado:** renderizado, sin repartir

Video de lanzamiento de Tumbenla, generado con HyperFrames a partir del codigo
del proyecto (skill `/brag`). Antes se llamaba `brag-output/` y estaba en la
raiz; es una pieza de marketing, no una salida de herramienta, y por eso vive
aca.

## Que hay

| Archivo | Que es |
|---|---|
| `brag.mp4` | render horizontal (16:9) |
| `brag-vertical.mp4` | render vertical (9:16), para historias y Reels |
| `brag.jpg` / `brag-vertical.jpg` | miniatura de cada uno |
| `share-copy.txt` | el texto con el que se reparte |
| `brag-plan.md` | el plan del video: escenas y decisiones |
| `composition-brief.md` | el brief que alimento la composicion |
| `guion-para-pruebas.txt` | guion para probar voces (acento paisa, no locutor) |
| `composition/` | el proyecto HyperFrames. Aca se edita y se vuelve a renderizar |

Los nombres `brag*` se quedaron como los dejo la herramienta: renombrarlos
romperia referencias dentro de `composition/` sin ganar nada.

## Reglas que ya cumple, y que hay que conservar al editarla

- El copy de `share-copy.txt` pasa por `org/crecimiento/VOZ.md`. Hoy cumple: no
  dice "solidario" ni "dona", le habla al que se parcha, y cierra con la prueba
  ("Si no hay recibo, no paso") en vez de un argumento moral.
- **Ninguna cifra.** El video no afirma cuantos bares hay ni cuanta plata se ha
  puesto, y asi tiene que quedarse mientras esas cifras no salgan de la base
  (`PRODUCT.md`, Decision 5).
- **Nada sobre el sismo con numeros propios.** Ni magnitud ni damnificados
  (Riesgo 4).
- **El verso de la cancion no se usa**, ni cantado ni de fondo (Decision 3). El
  guion trabaja con "¿qué chimba, cierto?", que es propio.

## Lo que falta

Repartirla. No hay experimento abierto que la use; si se reparte, entra por
`org/crecimiento/EXPERIMENTOS.md` como cualquier otra cosa, con la metrica
decidida antes de publicar.

## Peso

30 MB, casi todo `.mp4` y los assets de `composition/`, versionados en git.
Renderizar otra version duplica ese peso en el historial para siempre. Vale la
pena decidir si los renders siguen en el repo o se suben a R2 antes de que haya
una segunda pieza.
