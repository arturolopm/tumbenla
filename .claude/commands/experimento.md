---
description: Corre una idea de crecimiento por el ciclo de los tres departamentos y la deja escrita en la bitacora
argument-hint: [la idea, o el numero de un EXP- para avanzarlo o cerrarlo]
---

Idea o experimento: **$ARGUMENTS**

Corre el ciclo completo de `org/ORG.md`. No saltes estados y no hagas de dos
departamentos a la vez sin decirlo.

## Si $ARGUMENTS es una idea nueva

**1. Crecimiento propone.**
Lanza el subagente `crecimiento` para que escriba la entrada en
`org/crecimiento/EXPERIMENTOS.md` con la plantilla completa: hipotesis en forma
"si X entonces Y porque Z", lado del embudo (sitio / rumbero / lazo), la unica
metrica que decide, el tamano minimo que importa, y la ventana **fijada ahora,
no despues**.

**2. Datos dictamina si es medible.**
Lanza el subagente `datos`. Revisa primero `org/datos/METRICAS.md`: casi todo ya
es medible y el error caro es declarar bloqueado algo que solo le falta una
consulta. Tiene que responder una de dos:
- la metrica existe → escribe la consulta y marca la casilla;
- la metrica NO existe → escribe exactamente que falta instrumentar, y el
  experimento **se queda ahi**. No pasa a Aprobado. Se vuelve pendiente de
  Producto.

**3. Producto aprueba o veta.**
Lanza el subagente `producto`. Recorre "Decisiones tomadas" y "Riesgos abiertos"
de `PRODUCT.md` y responde **citando el numero** que toca, si toca alguno. Un
veto sin numero no es un veto; un visto bueno sin haber recorrido la lista
tampoco sirve.

**4. Reporta.**
Al usuario le dices, en pocas lineas: en que estado quedo, quien lo freno si algo
lo freno, y cual es el siguiente paso concreto. Si quedo bloqueado por falta de
instrumentacion, dilo primero — es el resultado mas frecuente y el mas util.

## Si $ARGUMENTS es un `EXP-` que ya existe

Lee la entrada y avanzala al estado que siga. Si esta `En curso` y la ventana ya
cerro, lanza `datos` para que escriba el resultado con la cifra real (o "no
concluyente" si el volumen no da), y despues `producto` o `crecimiento` para la
decision. **Una decision que se sostiene sube a `PRODUCT.md`**, a "Decisiones
tomadas", con el porque en una linea; la bitacora se queda con el intento.

## Sin argumento

Muestra la cola de `org/crecimiento/EXPERIMENTOS.md` agrupada por estado y di
cual es el que desbloquea mas cosas.

## Reglas que no se rompen

- Ninguna cifra que no salga de la base. Ni en la hipotesis.
- Con el volumen de hoy, "no concluyente" es una respuesta valida y frecuente.
  No se fabrica significancia.
- El copy pasa por `org/crecimiento/VOZ.md` antes de existir.
