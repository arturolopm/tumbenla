# Tumbenla — Value Proposition for Venues (Bares/Discotecas)

**Branch:** `value-proposition`
**Owner:** Producto (decide scope) + Crecimiento (articulate) + Datos (validate measurable)
**Status:** Propuesto — explora posibilidades, no compromisos
**Created:** 2026-09-14

---

## Premisa Central

> **El bar pone un trago con su reparto escrito. La gente lo pide, paga, escanea QR. Nosotros compramos material y publicamos la factura.**
>
> **Eso es lo que HACEMOS. Esto es lo que VALORIZA para el bar.**

El valor no es "ayudar a la causa". El valor es: **más gente en tu bar, que gasta más, y vuelve — y tú ves los datos para probarlo.**

---

## Pilares de Valor (Ordenados por Impacto Percibido)

### 1. Adquisición: Gente Nueva Que Llega Por El Trago

| Lo que entregamos | Cómo se mide | Por qué importa al bar |
|-------------------|--------------|------------------------|
| **Mapa público** (`/sitios`) con gate de ciudad → el bar aparece donde la gente busca dónde salir | Visitas al perfil del bar en `/sitios/[slug]` | Visibilidad orgánica sin pagar publicidad |
| **Trago con reparto visible** en la carta pública → diferencial vs. competencia | CTR: ver trago → iniciar pedido | "Este trago pone $X en material" = razón para elegirnos |
| **QR en mesa/barra** → pedido sin fricción, sin app obligatoria | Pedidos iniciados / QR mostrados | Elimina barrera: "bájate la app" = pérdida de ventas |
| **Efecto vecino** → bares de la misma cuadra se unen tras ver al primero | Solicitudes por vecindario tras primera publicación | Prueba social real, no testimonio inventado |

**Métrica norte:** *Pedidos pagados por semana por venue* (Datos ya tiene esquema: `product_order`)

---

### 2. Retención: Tus Clientes Vuelven (Y Tú Sabes Cuándo)

| Capacidad | Dato que genera | Acción del bar |
|-----------|-----------------|----------------|
| **Email capturado al pagar** (cuenta o invitado → verificación posterior) | `user.email` + `product_order.venue_id` + `product_order.product_id` + timestamp | Base de contactos propia, cero costo |
| **Patrón de consumo** (qué pide, cuándo, cuánto, con quién) | `product_order` + `order_redemption` (escaneo) + `party_night` + `photo_claim` | Segmentación real: "viernes whisky", "cumpleaños grupos", "after-office cerveza" |
| **Cumpleaños / fechas clave** (del perfil verificado) | `user.birthdate` (opcional, al crear cuenta) | Automatización: "Tu trago de cumpleaños nos cuenta la mitad" |
| **Frecuencia y recencia** | Días desde último `order_redemption` | Reactivación: "Hace 3 semanas no vienes, este trago va por la casa" |
| **Valor de vida (LTV) estimado** | Suma `product_order.amount` por `user_id` por venue | Identificar top 20% → trato VIP real |

**Métrica norte:** *Segunda noche por rumbero* (ya definida en `CRECIMIENTO.md`) + *Frecuencia de pedido por usuario/venue*

---

### 3. Reactivación: Traer De Vuelta A Los Que Se Fueron

| Palanca | Cómo funciona | Costo para el bar |
|---------|---------------|-------------------|
| **Campaña "Te extrañamos"** → push/email/WhatsApp a usuarios sin escaneo >21 días | Segmento automático en panel `/panel/[slug]` | Cero (plataforma lo ejecuta) |
| **Promo "Trae a 2 amigos"** → trago gratis si 3+ piden el mismo producto | Validación via `product_order` mismo `party_night` | Solo el costo del trago (margen real) |
| **Evento exclusivo top clientes** → lista automática top 50 por LTV | Consulta en panel: "Mejores clientes este mes" | Organización del evento |
| **Recompra de "su trago"** → recordatorio: "El [NombreTrago] que te gustó vuelve esta semana" | Trigger por `product_order.product_id` recurrente | Cero |

**Clave:** El bar **no hace marketing**. La plataforma detecta la señal y le sugiere la acción. Un clic en "Enviar promo" y listo.

---

### 4. Inteligencia: Decisiones De Negocio Con Datos Reales

| Pregunta del bar | Respuesta en panel Tumbenla | Sin Tumbenla |
|------------------|----------------------------|--------------|
| ¿Qué trago vende más entre semana vs. finde? | Tabla: producto × día × cantidad × ticket medio | Conjetura / caja manual |
| ¿Qué hora pico real de pedidos app vs. barra? | Heatmap hora × canal (app/barra) | Sensación |
| ¿Cuánto gasta mi top 10% vs. el resto? | Percentiles de gasto por `user_id` | No lo sabe |
| ¿Qué % de mis clientes son recurrentes (2+ visitas/mes)? | Cohort analysis automático | Excel a mano |
| ¿Cuánto material compró mi aporte este mes? | `/transparencia` público + vista privada detalle | "Confía en mí" |

**Valor oculto:** El bar deja de operar a ciegas. Cada decisión de carta, horario, personal, stock tiene dato.

---

### 5. Deducción Fiscal / Beneficios Tributarios (Exploración)

> **Estado:** Hipótesis — requiere validación legal/contable colombiana. No prometer hasta confirmar.

| Posibilidad | Qué se necesita validar | Riesgo |
|-------------|-------------------------|--------|
| **Donación deducible de renta** (Art. 125-126 ET) | Que el aporte vaya a entidad sin ánimo de lucro calificada (Música para la Paz o similar) y cumpla requisitos: destino específico, certificación, no contraprestación directa | El trago **sí tiene contraprestación** (el cliente recibe bebida). ¿Rompe la deducibilidad? |
| **Descuento en ICA / industria y comercio** | Algunos municipios dan beneficios a empresas con responsabilidad social | Varía por ciudad; Manizales/Medellín/Bogotá tienen normas distintas |
| **Certificación B / Sello verde / Marca país** | Tumbenla como evidencia de impacto medible | Valor de marca, no ahorro directo |
| **Beneficios bancarios / tasas preferenciales** | Bancos evalúan "sostenibilidad" para crédito | Indirecto, largo plazo |

**Acción:** Producto debe consultar con contador/abogado tributario **antes** de incluir en pitch. Si no está verificado → **no se usa en venta**.

---

### 6. Efecto Red / Ecosistema (Valor Compuesto)

| Dinámica | Cómo se activa | Valor para el bar |
|----------|----------------|-------------------|
| **Rumbero reclama foto → ve otros bares en mapa → va al vecino** | `photo_claim` → `/sitios` → nuevo `product_order` en venue distinto | Cruce de clientela orgánico |
| **Transparencia pública** → bar vecino ve factura verificada → se une | `/transparencia` es el mejor material de ventas B2B | Cero costo de adquisición sitio |
| **Eventos multi-venue** (ruta de tragos) | Plataforma detecta usuarios que visitan 3+ venues/semana | Co-marketing automático |
| **Data pooling anonimizado** → benchmarks sectoriales | "Tu ticket medio: $45K. Promedio ciudad: $38K. Promedio tu segmento: $52K" | Contexto competitivo real |

---

### 7. Vínculo Emocional: Impacto Compartido Bar + Cliente (NUEVO)

> **El momento de verdad:** cuando el material se entrega a la familia/comunidad, **Tanto el bar como el cliente reciben la evidencia** (foto/video del recibo, la entrega, la persona beneficiada). Se crea un lazo: "Juntos hicimos esto posible."

| Qué se entrega | Cuándo | A quién | Canal |
|----------------|--------|---------|-------|
| **Notificación push/email/WhatsApp** con miniatura + link a evidencia completa | En el momento de **verificación de compra** (`material_purchase.status = 'published'`) | **Bar** (owner/staff vía `venue_member`) + **Cliente** (user del `product_order`) | Push (app) + Email + WhatsApp (si consent) |
| **Evidencia**: foto del material + factura proveedor + ubicación entrega + testimonio breve (si hay consentimiento beneficiario) | Same | Same | Galería en `/transparencia/[slug]` + notificación directa |
| **Mensaje sugerido para redes del bar** (copy listo, VOZ.md) | Same | Bar (opcional, un clic) | Instagram Stories / WhatsApp Business |

**Por qué es poderosísimo:**
- **Bar**: "Mira, *tu* trago puso este cemento en *esta* casa." → Orgullo de equipo, contenido real para redes, diferenciador vs. competencia
- **Cliente**: "Tu cóctel de anoche compró 25.000 en tejas para esta familia." → Validación personal, historia para compartir, razón para volver
- **Plataforma**: El lazo bar-cliente se refuerza *fuera* de la transacción comercial. No es "te vendí un trago", es "hicimos algo juntos".

**Métrica norte:** *% usuarios que reclaman foto de su noche Y ven evidencia de su aporte* → correlación con 2da visita.

**Guardarraíl (VOZ.md):**
- Nunca: "Ayudamos a víctimas", "Tu donación salvó vidas"
- Sí: "Este bar y este cliente pusieron $25K en tejas. La factura y la entrega están acá."
- El protagonista es **el bar + el cliente**, no la plataforma ni la fundación.

---

## Propuesta de Valor Encapada Por Audiencia (Para Pitch)

### Para el DUEÑO (Decide Sí/No)
> "Tus bares llenos entre semana. Clientes que vuelven y tú sabes quiénes son. Cero costo fijo. Solo pones un trago en la carta."

### Para el GERENTE DE OPERACIONES (Ejecutar)
> "El mesero escanea un QR y listo. El panel te dice qué se vende, quién viene, cuándo. Sin papers, sin reportes manuales."

### Para el ENCARGADO DE MARKETING/REDES (Amplifica)
> "Subes la galería de la noche. La gente se etiqueta sola. Tu Instagram crece con contenido real. La promo de cumpleaños se envía sola."

### Para el CONTADOR/ADMIN (Valida)
> "Cada aporte tiene factura pública. Trazabilidad completa. Si hay beneficio fiscal, ya tienes la evidencia."

---

## Lo Que NO Prometemos (Guardarraíles VOZ.md)

| No decimos | Por qué |
|------------|---------|
| "Aumentamos tus ventas X%" | No controlamos demanda; damos herramienta, no magia |
| "Te traemos 100 clientes nuevos" | Métrica vanidosa; prometemos *visibilidad + datos* |
| "Es deducible de impuestos" | Hasta que legal lo valide, es riesgo legal |
| "Automatizamos tu marketing" | Damas sugerencias; el bar decide y dispara |
| "Tu data es solo tuya" | La data del rumbero es del rumbero (Decision 2, 29b) |

---

## Roadmap de Entrega de Valor (Fases)

| Fase | Qué se activa | Valor incremental | Bloqueador |
|------|---------------|-------------------|------------|
| **MVP (Hoy)** | Trago + QR + escaneo + panel básico + transparencia | Adquisición base + visibilidad | ePayco onboarding (T-002) |
| **Fase 1** | Cuenta rumbera + email verificado + historial (`/mi-historia`) | Captura email + patrón consumo | `venue_member` panel completo |
| **Fase 2** | Segmentación automática + sugerencias promo en panel | Reactivación + retención | Instrumentación `product_order` × `user` |
| **Fase 3** | Cumpleaños / fechas / LTV + cohortes en panel | Inteligencia de negocio | Datos: consultas + UI |
| **Fase 4** | Benchmarks anonimizados + rutas multi-venue | Efecto red + contexto | Volumen crítico (≥50 venues) |
| **Fase 5** | API para CRM/pos del bar (webhook pedidos + clientes) | Integración operativa completa | Demanda real de bars grandes |

---

## Experimentos Propuestos (Para EXPERIMENTOS.md)

```
### EXP-004 — Value prop "Datos te devuelven clientes" vs "Causa social"
**Estado:** Propuesto | **Lado:** sitio | **Abierto:** 2026-09-14
**Hipótesis.** Si el pitch B2B enfatiza "recuperas clientes con data" vs "apoyas reconstrucción", entonces la tasa reunión→alta sube, porque el dueño decide por interés propio, no moral.
**Métrica.** Tasa reunión→alta (alta_iniciada / reuniones_agendadas).
**Tamaño mínimo.** 10 reuniones por variante.
**Ventana.** 4 semanas.
- [ ] Datos — métrica existe (venueApplication → venue publicado)
- [ ] Producto — no choca; es mensaje, no código
- [ ] Crecimiento — dos guiones de pitch listos (pasar por VOZ.md)
```

```
### EXP-005 — Promo automática "cumpleaños" genera 2da visita
**Estado:** Propuesto | **Lado:** lazo | **Abierto:** 2026-09-14
**Hipótesis.** Si al cumplir años el usuario recibe "Tu trago en [Bar Frecuente] nos cuenta la mitad", entonces sube % usuarios con 2da noche en mes de cumpleaños vs mes anterior.
**Métrica.** Usuarios con ≥2 `photoClaim` en mes de cumpleaños / total usuarios con cumpleaños registrado.
**Tamaño mínimo.** 50 usuarios con birthdate verificado.
**Ventana.** 3 meses.
- [ ] Datos — falta `user.birthdate` + consentimiento + trigger automático
- [ ] Producto — requiere decisión: ¿birthdate obligatorio u opcional?
- [ ] Crecimiento — pieza: email/WhatsApp template (VOZ.md)
```

```
### EXP-006 — Benchmark anonimizado en panel mueve decisiones de carta
**Estado:** Propuesto | **Lado:** sitio | **Abierto:** 2026-09-14
**Hipótesis.** Si el panel muestra "Tu ticket medio: $X vs. promedio ciudad: $Y vs. promedio tu segmento: $Z", entonces el dueño cambia precio/producto en 30 días.
**Métrica.** % venues que editan `venue_product.price` o `reparto_pct` tras ver benchmark.
**Tamaño mínimo.** 20 venues con ≥30 días datos.
**Ventana.** 60 días tras lanzamiento benchmark.
- [ ] Datos — consulta agregada anonimizada por ciudad/segmento
- [ ] Producto — UI en `/panel/[slug]/carta` + consentimiento data pooling
- [ ] Crecimiento — comunicación: "Esto te ayuda a ganar más"
```

---

## Checklist De Validación Antes De Prometer

| Promesa | Validación requerida | Quién | Evidencia |
|---------|---------------------|-------|-----------|
| Captura email al pagar | Flujo invitado → verificación funciona E2E | Producto | Test Playwright |
| Patrón consumo accionable | Panel muestra: producto × hora × usuario recurrente | Datos | Query + UI mock |
| Promo cumpleaños automática | Trigger + envío + redención medible | Crecimiento | EXP-005 |
| Deducción fiscal | Dictamen escrito contador/abogado tributario | Producto | Documento firmado |
| Benchmark ciudad/segmento | ≥50 venues con datos limpios + anonimización | Datos | Query + legal review |
| Reactivación "te extrañamos" | Segmento >21 días sin escaneo + CTR promo | Crecimiento | EXP-006 |

---

## Próximos Pasos Inmediatos

1. **[Producto]** Validar factibilidad técnica: `user.birthdate` opcional en registro, consentimiento data pooling, webhooks futuros
2. **[Crecimiento]** Redactar 2 guiones pitch (data-driven vs. causa) para EXP-004
3. **[Datos]** Definir consultas exactas para: patrón consumo, LTV, cohortes, benchmarks
4. **[Legal/Contable]** Consultar deducibilidad donación con contraprestación (trago) → documento para EXP-007
5. **[All]** Revisar este doc en sesión tripartita → mover a `org/crecimiento/EXPERIMENTOS.md` como EXP-004, 005, 006

---

## Nota Para Ingeniería (VP Eng Lens)

La arquitectura **ya soporta** la mayoría de esto:
- `product_order` + `order_redemption` + `venue_member` + `user` = grafo completo
- `party_night` + `photo_claim` = lazo social + frecuencia
- `venue_contribution` + `verified_at` = transparencia + retención sitio
- **Faltan:** `user.birthdate`, `user.marketing_consent`, triggers automáticos, agregaciones anonimizadas, panel UI para sugerencias

**No hay que reesquematizar.** Hay que instrumentar, consultar y exponer en `/panel/[slug]`.

---

## Nota Para Marketing (VP Mktg Lens)

El pitch B2B **no es** "únete a la causa". Es:

> **"¿Sabes quién volvió la semana pasada? ¿Qué pidieron? ¿Cuándo es su cumpleaños? Tumbenla te lo dice y te ayuda a traerlos de nuevo. Y de paso, tu trago pone material y la factura se ve pública."**

Ese es el *hook*. La causa es el *closer* (y el diferenciador vs. cualquier SaaS de fidelización).

---

**Este documento vive en `org/crecimiento/VP_VENUE.md` (por crear) y alimenta `EXPERIMENTOS.md`.**
**No sube a `PRODUCT.md` hasta que experimentos cierren con evidencia.**