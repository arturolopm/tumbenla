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
      `venueApplication` y un campo (o parametro en la URL) en `/registrar-sitio`.
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

### EXP-003 — verificar los aportes en menos de 72 horas (legado)
**Estado:** Propuesto — bloqueado por retiro del modelo | **Lado:** sitio | **Abierto:** 2026-09-01

**Hipotesis.** Si un aporte reportado pasa de `submitted` a `verified` en menos
de 72 horas, sube la proporcion de sitios que reportan un segundo mes, porque hoy
un sitio que hizo su parte y no ve nada es la forma mas rapida de perderlo.
**Metrica.** Sitios con dos o mas `venueContribution` verificados, contra tiempo
mediano de `submitted` → `verified`.
**Tamano minimo que importa.** Cualquier diferencia sostenida; el costo del
cambio es operativo, no de producto.
**Ventana.** Dos meses.

- [ ] Datos — histórico: `venue_contribution.verified_at` existe, pero no mide el
      camino vigente de pedidos y entregas.
- [ ] Producto — bloqueado: el modelo general por porcentaje de ventas fue retirado.
- [ ] Crecimiento — no preparar una pieza; sustituir por seguimiento de entregas.

**Nota.** Se conserva como registro histórico para no perder contexto; no debe
arrancar ni presentarse como métrica de retención actual.

---

### EXP-004 — Value prop "Datos te devuelven clientes" vs "Causa social"
**Estado:** Propuesto — bloqueado | **Lado:** sitio | **Abierto:** 2026-09-14

**Nota de archivo.** El título y la hipótesis conservan el planteamiento
original para poder auditarlo. La dirección de valor se considera futura, no una
promesa ni una pieza aprobada, hasta instrumentar consentimiento y medición.

**Hipotesis.** Si el pitch B2B enfatiza "recuperas clientes con data" vs "apoyas
reconstruccion", entonces la tasa reunion→alta sube, porque el dueño decide por
interes propio, no moral.
**Metrica.** Tasa reunion→alta (alta_iniciada / reuniones_agendadas).
**Tamano minimo que importa.** 10 reuniones por variante.
**Ventana.** 4 semanas.

- [ ] Datos — **no existe la medición declarada**: no hay eventos de reuniones ni
      de alta iniciada por variante.
- [ ] Producto — bloqueado: no se promete que Tumbenla devuelva clientes; la
      comunicación futura debe hablar de campañas consentidas y datos agregados.
- [ ] Crecimiento — no preparar variantes hasta instrumentar una métrica válida.

---

### EXP-005 — Promo automática "cumpleaños" genera 2da visita
**Estado:** Propuesto — bloqueado | **Lado:** lazo | **Abierto:** 2026-09-14

**Nota de archivo.** La idea se conserva solo como hipótesis bloqueada. Las
campañas futuras requieren consentimiento, preferencias y límites antes de
ofrecer cualquier promoción o recompensa.

**Hipotesis.** Si al cumplir años el usuario recibe "Tu trago en [Bar Frecuente]
nos cuenta la mitad", entonces sube % usuarios con 2da noche en mes de
cumpleaños vs mes anterior.
**Metrica.** Usuarios con ≥2 `photoClaim` en mes de cumpleaños / total usuarios
con cumpleaños registrado.
**Tamano minimo que importa.** 50 usuarios con birthdate verificado.
**Ventana.** 3 meses.

- [ ] Datos — falta `user.birthdate` + consentimiento + trigger automático
- [ ] Producto — bloqueado: no existe cumpleaños, promociones ni consentimiento
      de marketing en el producto actual; no se anuncia como disponible.
- [ ] Crecimiento — no preparar email/WhatsApp ni prometer recompensas.

---

### EXP-006 — Benchmark anonimizado en panel mueve decisiones de carta
**Estado:** Propuesto — bloqueado | **Lado:** sitio | **Abierto:** 2026-09-14

**Nota de archivo.** La idea se conserva solo como hipótesis bloqueada. Los
insights futuros serán agregados y no compartirán datos individuales entre sitios.

**Hipotesis.** Si el panel muestra "Tu ticket medio: $X vs. promedio ciudad: $Y
vs. promedio tu segmento: $Z", entonces el dueño cambia precio/producto en 30
días.
**Metrica.** % venues que editan `venue_product.price` o `reparto_pct` tras ver
benchmark.
**Tamano minimo que importa.** 20 venues con ≥30 días datos.
**Ventana.** 60 días tras lanzamiento benchmark.

- [ ] Datos — consulta agregada anonimizada por ciudad/segmento
- [ ] Producto — bloqueado: no hay benchmark ni agrupación consentida; nunca se
      prometerá que el sitio gane más.
- [ ] Crecimiento — no preparar la comunicación.

---

### EXP-007 — Notificación impacto compartido aumenta 2da visita y orgullo bar
**Estado:** Propuesto — bloqueado | **Lado:** lazo | **Abierto:** 2026-09-14

**Nota de archivo.** La idea se conserva solo como hipótesis bloqueada. Una
notificación futura usaría evidencia agregada y nunca atribuiría una compra de
material a un trago o cliente individual.

**Hipotesis.** Si al verificarse una compra de material (`material_purchase.status = 'published'`) tanto el bar como el cliente reciben notificación con evidencia visual (foto material, factura, ubicación, testimonio), entonces sube: (a) % usuarios que ven evidencia y hacen 2da visita en 30 días, y (b) % bars que comparten evidencia en redes propias, porque el lazo emocional "juntos hicimos esto" refuerza ambos lados.
**Metrica.** (a) Usuarios con `impact_notification.read_at` no nulo → 2do `order_redemption` en 30 días / total usuarios notificados. (b) Bars con `impact_notification.read_at` no nulo → `venue_member` action: compartir en redes / 30 días.
**Tamano minimo que importa.** 20 notificaciones entregadas (10 bars + 10 usuarios) para ver señal direccional.
**Ventana.** 6 semanas (ciclo completo: pedido → verificación → compra → entrega → notificación).

- [ ] Datos — falta tabla `impact_notification` + worker + consulta atribución
- [ ] Producto — bloqueado: no existe tabla, worker ni atribución individual de
      compras a tragos; el producto mantiene cuentas colectivas.
- [ ] Crecimiento — no preparar notificaciones ni textos de impacto individual.

---

## Cerrados

*(Ninguno todavia. Cuando cierre el primero, el resultado va aca y la conclusion
sube a `PRODUCT.md`.)*
