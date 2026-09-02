# Bitacora de experimentos

El unico canal entre Producto, Crecimiento y Datos. Reglas completas en
`org/ORG.md`. En corto:

`Propuesto` (Crecimiento) → `Medible` (Datos) → `Aprobado` (Producto) →
`En curso` → `Cerrado`

**No se salta ningun estado.** Si la metrica no existe, el experimento no
arranca: se vuelve pendiente de instrumentacion y espera ahi. Una decision que se
sostiene al cerrar **sube a `PRODUCT.md`**; la bitacora guarda el intento, no la
conclusion.

---

## Plantilla

```
### EXP-000 — titulo corto
**Estado:** Propuesto | **Lado:** sitio / rumbero / lazo | **Abierto:** AAAA-MM-DD

**Hipotesis.** Si <cambio>, entonces <metrica> <sube/baja>, porque <razon>.
**Metrica.** <la unica que decide> — de <tabla o evento>.
**Tamano minimo que importa.** <por debajo de esto no se toca nada>
**Ventana.** <cuanto se mide, fijado ANTES de empezar>

- [ ] Datos — la metrica existe / hay que instrumentar <que>
- [ ] Producto — no choca con ninguna decision ni riesgo; alcance: <tamano>
- [ ] Crecimiento — pieza lista

**Resultado.** (lo escribe Datos, con cifra real o "no concluyente")
**Decision.** (lo escribe Producto o Crecimiento; si se sostiene, sube a PRODUCT.md)
```

---

## En cola

### EXP-001 — saber de donde llega cada solicitud de sitio
**Estado:** Propuesto | **Lado:** sitio | **Abierto:** 2026-09-01

**Hipotesis.** Sin origen en `venueApplication` no se puede comparar ningun canal
de captacion de sitios, y hoy se estan tomando decisiones de donde poner el
tiempo a puro pulso.
**Metrica.** Solicitudes por origen (calle / vecino / Instagram / otro).
**Tamano minimo que importa.** No aplica: es instrumentacion, no un experimento.
**Ventana.** Permanente una vez exista.

- [ ] Datos — **la metrica NO existe.** Falta una columna de origen en
      `venueApplication` y un campo (o parametro en la URL) en `/quiero-poner`.
- [ ] Producto — pendiente. Es una migracion chiquita, pero es migracion.
- [ ] Crecimiento — nada que preparar hasta que exista.

**Nota.** Este bloquea cualquier experimento de canal del lado sitio. Va primero.

---

### EXP-002 — pedir la foto en la barra, la noche misma
**Estado:** Propuesto | **Lado:** lazo | **Abierto:** 2026-09-01

**Hipotesis.** Si el sitio pone un letrero en la barra la noche de la fiesta
apuntando a sus fotos, sube **fotos reclamadas por noche publicada**, porque el
momento de maxima intencion es esa noche y hoy no existe nada ahi.
**Metrica.** `photoClaim` por `partyNight`, comparando noches con letrero contra
noches sin letrero del mismo sitio.
**Tamano minimo que importa.** Que la diferencia se vea a simple vista entre
noches del mismo bar. Con el volumen de hoy no va a haber significancia
estadistica y **no se va a fingir que la hay**.
**Ventana.** Cuatro fines de semana.

- [ ] Datos — la metrica existe (`photoClaim`, `partyNight`), pero no hay
      consulta hecha ni forma de marcar que noche llevo letrero. Hace falta lo
      segundo.
- [ ] Producto — no choca con nada. Riesgo 3 intacto: reclamar no publica nada.
- [ ] Crecimiento — falta la pieza fisica y el texto (pasa por `VOZ.md`).

---

### EXP-003 — verificar los aportes en menos de 72 horas
**Estado:** Medible | **Lado:** sitio | **Abierto:** 2026-09-01

**Hipotesis.** Si un aporte reportado pasa de `submitted` a `verified` en menos
de 72 horas, sube la proporcion de sitios que reportan un segundo mes, porque hoy
un sitio que hizo su parte y no ve nada es la forma mas rapida de perderlo.
**Metrica.** Sitios con dos o mas `venueContribution` verificados, contra tiempo
mediano de `submitted` → `verified`.
**Tamano minimo que importa.** Cualquier diferencia sostenida; el costo del
cambio es operativo, no de producto.
**Ventana.** Dos meses.

- [x] Datos — **medible hoy.** `venue_contribution.verified_at` ya existe; la
      consulta esta en `org/datos/METRICAS.md`. No falta instrumentar nada.
- [ ] Producto — pendiente de firma. No choca con nada: es un compromiso
      operativo, no un cambio de producto.
- [ ] Crecimiento — nada que preparar; esto es operacion, no campana.

**Nota.** Es el experimento de retencion mas importante que hay, el mas barato, y
**el unico de los tres que no esta bloqueado**. Deberia arrancar primero.
Ver `org/crecimiento/RETENCION.md`.

---

## Cerrados

*(Ninguno todavia. Cuando cierre el primero, el resultado va aca y la conclusion
sube a `PRODUCT.md`.)*
