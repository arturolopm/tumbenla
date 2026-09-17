# Tumbenla Value Proposition — Technical Implementation Spec

**Branch:** `value-proposition`
**Owner:** Producto (scope) → Datos (metrics/queries) → Ingeniería (implement)
**Status:** Propuesto — para discusión tripartita antes de código
**Created:** 2026-09-14

---

## Resumen de Cambios Requeridos

| Feature | Tablas Afectadas | Tipo | Complejidad |
|---------|-----------------|------|-------------|
| `user.birthdate` + `marketing_consent` | `user` | Migración + Zod + UI | Baja |
| `venue_application.source` (origen solicitud) | `venue_application` | Migración + Form | Baja |
| `party_night.experiment_tag` (para EXP-002) | `party_night` | Migración + Panel | Baja |
| Consultas agregadas anonimizadas (benchmarks) | `product_order`, `venue_product`, `venue` | Solo lectura (vistas/funciones) | Media |
| **Notificación impacto compartido** | `impact_notification` + worker | Migración + Worker + Canales | Media |
| Triggers automáticos (promo cumpleaños, reactivación) | `automation_rule`, `automation_execution` | Media-Alta |
| Webhooks futuros (CRM/POS) | `venue_webhook` | Media |

---

## 1. User Profile Extensions (MVP para EXP-005)

### 1.1 Migración: `user` table

```sql
-- Agregar a user table
ALTER TABLE "user" ADD COLUMN "birthdate" timestamp;
ALTER TABLE "user" ADD COLUMN "marketing_consent" boolean DEFAULT false NOT NULL;
ALTER TABLE "user" ADD COLUMN "marketing_consent_at" timestamp;

-- Índice para consultas de cumpleaños
CREATE INDEX "user_birthdate_idx" ON "user" ("birthdate");
CREATE INDEX "user_marketing_consent_idx" ON "user" ("marketing_consent") WHERE "marketing_consent" = true;
```

### 1.2 Schema TypeScript (`src/database/schema.ts`)

```typescript
// En export const user = pgTable('user', { ... })
birthdate: timestamp('birthdate'),
marketingConsent: boolean('marketing_consent').default(false).notNull(),
marketingConsentAt: timestamp('marketing_consent_at'),
```

### 1.3 Validación Zod (Edge)

```typescript
// src/lib/validators/user.ts
export const userProfileUpdate = z.object({
  birthdate: z.string().datetime().optional().nullable(),
  marketingConsent: z.boolean().optional(),
}).refine(
  (data) => !data.marketingConsent || data.birthdate,
  { message: 'Birthdate required if marketing consent given', path: ['birthdate'] }
);
```

### 1.4 UI Points

| Punto | Qué cambia |
|-------|------------|
| `/registrar` (registro) | Checkbox opcional: "Quiero recibir promos de mis bares favoritos (cumpleaños, etc.)" + date picker birthdate |
| `/entrar` / `/cuenta` | Editar preferencias + birthdate |
| `/orden/[token]` (checkout) | Si usuario logueado y `marketing_consent=true` → birthdate ya está; si invitado → ofrecer cuenta + consent al final |

---

## 2. Venue Application Source Tracking (Para EXP-001)

### 2.1 Migración

```sql
ALTER TABLE "venue_application" ADD COLUMN "source" text;
-- Valores esperados: 'calle' | 'vecino' | 'instagram' | 'referido' | 'prensa' | 'otro'
CREATE INDEX "venue_application_source_idx" ON "venue_application" ("source");
```

### 2.2 Schema

```typescript
// En venueApplication
source: text('source'), // nullable, opcional en formulario
```

### 2.3 Captura

- Parámetro URL: `/registrar-sitio?source=instagram` (desde bio IG del bar)
- Hidden field en formulario
- Operador puede editar en `/admin` tras conversación

---

## 3. Party Night Experiment Tag (Para EXP-002)

### 3.1 Migración

```sql
ALTER TABLE "party_night" ADD COLUMN "experiment_tag" text;
-- Valores: 'bar_sign_promo' | 'control' | futuro...
CREATE INDEX "party_night_experiment_tag_idx" ON "party_night" ("experiment_tag");
```

### 3.2 Uso

- Panel `/panel/[slug]/noches` → checkbox "Esta noche lleva letrero promo"
- Solo visible si experimento activo (feature flag)

---

## 4. Vistas Agregadas Anonimizadas (Benchmarks para EXP-006)

### 4.1 Vista: Benchmark por Ciudad

```sql
CREATE OR REPLACE VIEW venue_benchmark_city AS
SELECT
  v.city,
  COUNT(DISTINCT v.id) as venue_count,
  ROUND(AVG(po.total_amount / po.quantity)::numeric, 2) as avg_ticket,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY po.total_amount / po.quantity)::numeric, 2) as median_ticket,
  ROUND(AVG(vp.donation_percentage)::numeric, 2) as avg_donation_pct,
  COUNT(DISTINCT po.user_id) as unique_buyers,
  COUNT(po.id) as total_orders,
  ROUND(COUNT(po.id)::numeric / NULLIF(COUNT(DISTINCT v.id), 0), 2) as orders_per_venue
FROM venue v
JOIN product_order po ON po.venue_id = v.id
JOIN venue_product vp ON vp.id = po.product_id
WHERE v.published_at IS NOT NULL
  AND po.status = 'paid'
  AND po.created_at > NOW() - INTERVAL '30 days'
GROUP BY v.city
HAVING COUNT(DISTINCT v.id) >= 3;  -- Umbral anonimización
```

### 4.2 Vista: Benchmark por Segmento (Tipo + Ciudad)

```sql
CREATE OR REPLACE VIEW venue_benchmark_segment AS
SELECT
  v.city,
  v.type,
  COUNT(DISTINCT v.id) as venue_count,
  ROUND(AVG(po.total_amount / po.quantity)::numeric, 2) as avg_ticket,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY po.total_amount / po.quantity)::numeric, 2) as median_ticket,
  ROUND(AVG(vp.donation_percentage)::numeric, 2) as avg_donation_pct
FROM venue v
JOIN product_order po ON po.venue_id = v.id
JOIN venue_product vp ON vp.id = po.product_id
WHERE v.published_at IS NOT NULL
  AND po.status = 'paid'
  AND po.created_at > NOW() - INTERVAL '30 days'
GROUP BY v.city, v.type
HAVING COUNT(DISTINCT v.id) >= 3;
```

### 4.3 Consulta para Panel (Un Venue vs. Benchmarks)

```sql
-- En panel del venue: obtener sus métricas + benchmark ciudad + segmento
WITH my_metrics AS (
  SELECT
    v.id as venue_id,
    v.city,
    v.type,
    ROUND(AVG(po.total_amount / po.quantity)::numeric, 2) as my_avg_ticket,
    ROUND(AVG(vp.donation_percentage)::numeric, 2) as my_avg_donation_pct,
    COUNT(DISTINCT po.user_id) as my_unique_buyers,
    COUNT(po.id) as my_total_orders
  FROM venue v
  JOIN product_order po ON po.venue_id = v.id
  JOIN venue_product vp ON vp.id = po.product_id
  WHERE v.id = $1
    AND po.status = 'paid'
    AND po.created_at > NOW() - INTERVAL '30 days'
  GROUP BY v.id, v.city, v.type
),
city_bench AS (
  SELECT avg_ticket as city_avg_ticket, avg_donation_pct as city_avg_donation_pct
  FROM venue_benchmark_city WHERE city = (SELECT city FROM my_metrics)
),
segment_bench AS (
  SELECT avg_ticket as seg_avg_ticket, avg_donation_pct as seg_avg_donation_pct
  FROM venue_benchmark_segment
  WHERE city = (SELECT city FROM my_metrics) AND type = (SELECT type FROM my_metrics)
)
SELECT m.*, c.city_avg_ticket, c.city_avg_donation_pct, s.seg_avg_ticket, s.seg_avg_donation_pct
FROM my_metrics m
CROSS JOIN city_bench c
CROSS JOIN segment_bench s;
```

---

---

## 5. Notificación de Impacto Compartido (Vínculo Emocional Bar + Cliente)

> **Trigger:** `material_purchase.status` cambia a `'published'` (compra verificada y publicada)
> **Actores:** Bar (venue_member owner/staff) + Cliente (user del product_order que originó el aporte)
> **Objetivo:** Notificar a ambos con evidencia visual del material entregado, creando el lazo "juntos hicimos esto".

### 5.1 Flujo de Datos

```mermaid
graph LR
    A[material_purchase.status = 'published'] --> B[Identificar venue_id]
    B --> C[Buscar venue_contribution vinculada]
    C --> D[Obtener product_order(s) que generaron el aporte]
    D --> E[Para cada order: user_id + venue_id]
    E --> F[Crear notificación para BAR + notificación para CLIENTE]
    F --> G[Enviar por canales configurados]
```

### 5.2 Nueva Tabla: `impact_notification`

```sql
CREATE TABLE impact_notification (
  id text PRIMARY KEY,
  material_purchase_id text NOT NULL REFERENCES material_purchase(id) ON DELETE CASCADE,
  venue_id text NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  user_id text REFERENCES "user"(id) ON DELETE SET NULL,  -- NULL = notificación solo para bar
  recipient_type text NOT NULL, -- 'venue' | 'user'
  channel text NOT NULL, -- 'push' | 'email' | 'whatsapp'
  status text NOT NULL, -- 'pending' | 'sent' | 'failed' | 'read'
  payload jsonb NOT NULL, -- { "title": "...", "body": "...", "image_url": "...", "cta_url": "/transparencia/..." }
  sent_at timestamp,
  read_at timestamp,
  error text,
  created_at timestamp DEFAULT NOW()
);

CREATE INDEX impact_notification_purchase_idx ON impact_notification (material_purchase_id);
CREATE INDEX impact_notification_venue_idx ON impact_notification (venue_id);
CREATE INDEX impact_notification_user_idx ON impact_notification (user_id);
CREATE INDEX impact_notification_status_idx ON impact_notification (status);
```

### 5.3 Payload Estándar (JSON)

```json
{
  "title": "Tu trago puso material en [Municipio]",
  "body": "El cóctel [NombreProducto] en [NombreBar] aportó $25.000. Se compraron 50 bultos de cemento para 3 familias en [Ubicación].",
  "image_url": "https://r2.tumbenla.co/material-purchase/xxx/photo-1.webp",
  "cta_url": "/transparencia/compra-xxx",
  "meta": {
    "product_name": "Cóctel Reconstrucción",
    "venue_name": "Patrimonio",
    "donation_amount": 25000,
    "material_summary": "50 bultos cemento, 3 familias",
    "municipality": "Villamaría",
    "verified_at": "2026-09-14T10:30:00-05:00"
  }
}
```

### 5.4 Worker: `impact-notification-worker.ts`

```typescript
// Disparado por webhook/db trigger cuando material_purchase.status = 'published'
// 1. Busca material_purchase recién publicado
// 2. Encuentra venue_contribution vinculada (purchase_id)
// 3. Rastrea product_order → venue_settlement → ledger → venue_contribution
//    (O path directo: venue_contribution.source = 'productos' + purchase_id)
// 4. Para cada user_id único en esos orders:
//    - Crea impact_notification (recipient_type='user') si user.marketing_consent=true
// 5. Para venue:
//    - Crea impact_notification (recipient_type='venue') para todos los venue_member role='owner'
// 6. Envía por canales:
//    - Push: expo/FCM token del user/app
//    - Email: template HTML con imagen + CTA
//    - WhatsApp: template aprobado (Meta Business) vía proveedor
// 7. Actualiza status + sent_at/read_at
```

### 5.5 Canales y Consentimiento

| Canal | Bar (venue_member) | Cliente (user) |
|-------|-------------------|----------------|
| **Push (app)** | Sí (si app instalada + notifs on) | Sí (si app instalada + notifs on) |
| **Email** | Sí (email del venue en `venue.email`) | Sí (si `user.emailVerified` + `marketing_consent`) |
| **WhatsApp** | Sí (WhatsApp Business del venue) | Solo si `user.phone` verificado + consent explícito WhatsApp |

### 5.6 Template Copy (VOZ.md Compliant)

**Push/Email Subject:**
> "Tu trago en [Bar] puso material en [Municipio]"

**Body:**
> El [NombreProducto] que pediste en [Bar] aportó **$[Monto]**. Con eso compramos **[resumen material]** para **[familias/personas]** en **[Municipio]**.
>
> Ver factura y fotos → [Link a /transparencia/...]
>
> **¿Qué chimba cierto?**

**WhatsApp Template (Meta approved):**
> Hola {{name}}, tu trago en {{venue}} puso ${{amount}} en material para {{municipality}}. Ver: {{link}}

---

## 6. Automatizaciones (Motor para Promos/Reactivación)

### 6.1 Tablas Nuevas

```sql
-- Reglas de automatización configurables por venue
CREATE TABLE automation_rule (
  id text PRIMARY KEY,
  venue_id text NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  trigger_type text NOT NULL, -- 'birthday' | 'inactive_21d' | 'inactive_60d' | 'frequency_drop'
  trigger_config jsonb NOT NULL, -- { "days_before": 3, "template": "birthday_v1" }
  channel text NOT NULL, -- 'email' | 'whatsapp' | 'push'
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

-- Ejecuciones para idempotencia y métricas
CREATE TABLE automation_execution (
  id text PRIMARY KEY,
  rule_id text NOT NULL REFERENCES automation_rule(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  venue_id text NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
  channel text NOT NULL,
  template text NOT NULL,
  status text NOT NULL, -- 'sent' | 'failed' | 'skipped'
  error text,
  metadata jsonb, -- { "order_id": "...", "discount_code": "..." }
  executed_at timestamp DEFAULT NOW()
);

CREATE INDEX automation_execution_rule_id_idx ON automation_execution (rule_id);
CREATE INDEX automation_execution_user_venue_idx ON automation_execution (user_id, venue_id);
CREATE UNIQUE INDEX automation_execution_idempotency_idx
  ON automation_execution (rule_id, user_id, venue_id, DATE(executed_at));
```

### 6.2 Reglas Por Defecto (Seed)

```typescript
// scripts/seed-automation-rules.ts
const defaultRules = [
  {
    trigger_type: 'birthday',
    trigger_config: { days_before: 0, template: 'birthday_v1' },
    channel: 'email',
  },
  {
    trigger_type: 'inactive_21d',
    trigger_config: { days_inactive: 21, template: 'we_miss_you_v1' },
    channel: 'whatsapp',
  },
  {
    trigger_type: 'inactive_60d',
    trigger_config: { days_inactive: 60, template: 'last_chance_v1' },
    channel: 'email',
  },
];
```

### 6.3 Worker (Cron Diario)

```typescript
// scripts/automation-worker.ts
// Corre cada día 06:00 COT
// 1. Busca reglas activas
// 2. Para cada regla, encuentra usuarios elegibles (SQL por trigger_type)
// 3. Para cada usuario: verifica idempotencia (automation_execution)
// 4. Envía por canal (email/WhatsApp/push)
// 5. Registra ejecución
```

### 6.4 Trigger: Cumpleaños (Ejemplo)

```sql
-- Usuarios con cumpleaños hoy/próximos 3 días + consent + venue frecuente
SELECT DISTINCT ON (u.id, v.id)
  u.id as user_id,
  v.id as venue_id,
  u.email,
  u.name,
  v.name as venue_name,
  vp.name as favorite_product
FROM "user" u
JOIN product_order po ON po.user_id = u.id AND po.status = 'paid'
JOIN venue v ON v.id = po.venue_id
JOIN venue_product vp ON vp.id = po.product_id
WHERE u.birthdate IS NOT NULL
  AND u.marketing_consent = true
  AND EXTRACT(DOY FROM u.birthdate) BETWEEN EXTRACT(DOY FROM NOW()) AND EXTRACT(DOY FROM NOW() + INTERVAL '3 days')
  AND v.published_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM automation_execution ae
    WHERE ae.rule_id = $birthday_rule_id
      AND ae.user_id = u.id
      AND ae.venue_id = v.id
      AND DATE(ae.executed_at) = CURRENT_DATE
  )
GROUP BY u.id, v.id, u.email, u.name, v.name, vp.name
HAVING COUNT(po.id) >= 2  -- Al menos 2 pedidos en ese venue = "frecuente"
ORDER BY u.id, v.id, COUNT(po.id) DESC;
```

---

## 6. Consultas de Valor para Panel (Read Models)

### 6.1 Patrón de Consumo por Venue

```sql
-- Top productos por hora/día
SELECT
  vp.name,
  EXTRACT(HOUR FROM po.created_at) as hour,
  EXTRACT(DOW FROM po.created_at) as dow,
  COUNT(*) as orders,
  SUM(po.quantity) as units
FROM product_order po
JOIN venue_product vp ON vp.id = po.product_id
WHERE po.venue_id = $1
  AND po.status = 'paid'
  AND po.created_at > NOW() - INTERVAL '30 days'
GROUP BY vp.name, hour, dow
ORDER BY hour, dow, orders DESC;
```

### 6.2 Frecuencia y Recencia por Usuario

```sql
-- Último pedido y frecuencia por usuario en este venue
SELECT
  po.user_id,
  u.name,
  u.email,
  MAX(po.created_at) as last_order,
  COUNT(DISTINCT DATE(po.created_at)) as active_days,
  ROUND(AVG(po.total_amount)::numeric, 2) as avg_ticket,
  SUM(po.total_amount) as ltv_estimate
FROM product_order po
JOIN "user" u ON u.id = po.user_id
WHERE po.venue_id = $1
  AND po.status = 'paid'
  AND po.created_at > NOW() - INTERVAL '90 days'
GROUP BY po.user_id, u.name, u.email
ORDER BY last_order DESC;
```

### 6.3 Segmento "En Riesgo" (>21 días sin pedido)

```sql
SELECT
  po.user_id,
  u.name,
  u.email,
  MAX(po.created_at) as last_order,
  NOW() - MAX(po.created_at) as days_inactive,
  COUNT(DISTINCT DATE(po.created_at)) as active_days_90d,
  SUM(po.total_amount) as ltv_estimate
FROM product_order po
JOIN "user" u ON u.id = po.user_id
WHERE po.venue_id = $1
  AND po.status = 'paid'
  AND po.created_at > NOW() - INTERVAL '90 days'
GROUP BY po.user_id, u.name, u.email
HAVING NOW() - MAX(po.created_at) > INTERVAL '21 days'
ORDER BY days_inactive DESC;
```

---

## 7. Panel UI — Qué Se Muestra Dónde

### 7.1 `/panel/[slug]/carta` (Existente + Nuevo)

| Sección Actual | Nueva Sección (Value Prop) |
|----------------|----------------------------|
| Lista productos | **Benchmark** (tarjeta lateral): "Tu ticket: $X | Ciudad: $Y | Tu tipo: $Z" |
| Crear/editar producto | **Insight**: "Este producto vende 40% más los viernes 8-10pm" |
| | **Sugerencia promo**: "Tus top 10 clientes no vienen hace 3 semanas → [Enviar promo]" |

### 7.2 Nueva Pestaña: `/panel/[slug]/clientes`

```
┌─────────────────────────────────────────────────────────────┐
│  RESUMEN                        │  ACCIONES RÁPIDAS          │
├─────────────────────────────────┼────────────────────────────┤
│  Clientes únicos (30d): 247     │  [Cumpleaños esta semana]  │
│  Recurrentes (2+ visitas): 89   │  [En riesgo (>21d)]: 34   │
│  LTV medio: $180K               │  [Top 20%]: 49 clientes   │
│  Ticket medio: $45K             │                            │
├─────────────────────────────────┼────────────────────────────┤
│  LISTA FILTRABLE                │  DETALLE CLIENTE (click)   │
│  ☐ Solo con consentimiento      │  • Historial pedidos       │
│  ☐ Solo recurrentes             │  • Productos favoritos     │
│  ☐ En riesgo                    │  • Cumpleaños              │
│  ☐ Cumpleaños ±7d               │  • Gasto total             │
│  [Buscar nombre/email...]       │  [Enviar promo personal]   │
└─────────────────────────────────┴────────────────────────────┘
```

### 7.3 `/panel/[slug]/insights` (Nuevo)

- Gráfico: Pedidos por hora × día (heatmap)
- Gráfico: Ticket medio por producto
- Tabla: Benchmarks vs. mi venue
- Alertas: "Tu donación % promedio (42%) está bajo vs. ciudad (48%)"

---

## 8. Migraciones — Orden y Ventanas

| # | Migración | Archivo | Ventana Deploy | Rollback |
|---|-----------|---------|----------------|----------|
| 1 | `user.birthdate`, `marketing_consent` | `migrations/00XX_user_marketing.ts` | Con código registro/perfil | `DROP COLUMN` |
| 2 | `venue_application.source` | `migrations/00XX_venue_app_source.ts` | Con formulario alta | `DROP COLUMN` |
| 3 | `party_night.experiment_tag` | `migrations/00XX_party_night_experiment.ts` | Con panel noches | `DROP COLUMN` |
| 4 | Vistas benchmark | `migrations/00XX_benchmark_views.sql` | Independiente (solo lectura) | `DROP VIEW` |
| 5 | `impact_notification` | `migrations/00XX_impact_notification.ts` | Con worker notificaciones | `DROP TABLE` |
| 6 | `automation_rule`, `automation_execution` | `migrations/00XX_automation_tables.ts` | Con worker + UI | `DROP TABLE` |
| 7 | `venue_webhook` (futuro) | `migrations/00XX_venue_webhook.ts` | Cuando haya demanda | `DROP TABLE` |

**Regla PRODUCT.md:** Cada migración en deploy separado. Schema live antes que código.

---

## 9. Tests Requeridos (TDD)

```typescript
// tests/value-prop/birthdate-consent.test.ts
- User puede agregar birthdate + consent → perfil actualizado
- User sin consent → no recibe promo cumpleaños
- User con consent pero sin birthdate → no recibe promo (validación)

// tests/value-prop/benchmark-views.test.ts
- venue_benchmark_city solo incluye ciudades con ≥3 venues
- venue_benchmark_segment agrupa por city+type correctamente
- Consulta panel venue devuelve mis métricas + benchmarks correctos

// tests/value-prop/impact-notification.test.ts
- Worker detecta material_purchase.status = 'published'
- Rastrea correctamente: purchase → contribution → orders → users
- Crea notificación para bar (venue_member owners)
- Crea notificación para cliente (si marketing_consent=true)
- Payload incluye: product_name, venue_name, donation_amount, material_summary, municipality
- Canales: push/email/whatsapp según consentimiento
- Idempotencia: mismo purchase = una notificación por recipient

// tests/value-prop/automation.test.ts
- Worker encuentra usuarios cumpleaños hoy + consent
- Idempotencia: misma regla + usuario + venue + día = una ejecución
- Canal email/WhatsApp envía template correcto
- Métrica: execution registrada con status 'sent'

// tests/value-prop/venue-app-source.test.ts
- Source se captura desde URL param
- Source editable en admin
- EXP-001 métrica: solicitudes por source contables
```

---

## 10. Feature Flags (Lanzamiento Gradual)

```typescript
// src/lib/features/flags.ts
export const VALUE_PROP_FLAGS = {
  USER_BIRTHDATE: 'value-prop-user-birthdate',           // Registro/perfil
  VENUE_APP_SOURCE: 'value-prop-venue-app-source',       // Formulario alta
  PARTY_NIGHT_EXPERIMENT: 'value-prop-party-night-exp',  // Panel noches
  BENCHMARK_PANEL: 'value-prop-benchmark-panel',         // Panel insights
  IMPACT_NOTIFICATION: 'value-prop-impact-notification', // Notificación impacto compartido
  AUTOMATION_ENGINE: 'value-prop-automation-engine',     // Worker + UI
  AUTOMATION_BIRTHDAY: 'value-prop-automation-birthday', // Promo cumpleaños
  AUTOMATION_REACTIVATION: 'value-prop-automation-react', // Reengagement
} as const;
```

---

## 11. Checklist de Aprobación (Antes de Merge a Main)

| Área | Criterio | Validación |
|------|----------|------------|
| **Producto** | Scope acordado en tripartita | ✅ Reunión minada |
| **Datos** | Consultas en `METRICAS.md` + vistas creadas | 📋 Queries revisadas |
| **Ingeniería** | Migraciones separadas, tests pasan, feature flags | 🧪 CI verde |
| **Crecimiento** | Templates promo en `VOZ.md` + piezas en `piezas/` | 📝 Copy aprobado |
| **Legal** | Consentimiento birthdate/marketing GDPR/Ley 1581 | ⚖️ Revisión |
| **Operaciones** | Operator puede ver/editar consent en admin | 👁️ Panel admin |

---

## 12. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Birthdate = dato sensible (Ley 1581) | Alta | Legal | Consentimiento explícito, granular, revocable; no obligatorio |
| Benchmarks con <3 venues = re-identificación | Media | Privacidad | HAVING COUNT(DISTINCT venue) >= 3 en vistas; suprimir si baja |
| **Notificación impacto: foto beneficiario sin consentimiento** | Media | Legal/Ético | Requiere `consent_given=true` en `material_purchase_media`; fallback: solo factura/material sin rostros |
| Automatizaciones spam → usuarios marcan spam | Media | Reputación | Frequency cap (1/semana/venue), unsubscribe fácil, solo consentidos |
| Worker falla silenciosamente | Baja | Ops | Alertas en execution status='failed' >5%/día; log estructurado |
| Feature flags se acumulan | Media | Tech debt | Limpieza trimestral; documentar en `PRODUCT.md` |

---

## 13. Próximos Pasos Inmediatos

1. **[Tripartita]** Reunión 30 min: Producto + Crecimiento + Datos → aprobar scope MVP (birthdate + consent + source tracking + benchmarks vistas)
2. **[Datos]** Validar queries benchmark con datos locales (seed de prueba)
3. **[Ingeniería]** Crear migración #1 (user) + tests → feature flag `USER_BIRTHDATE`
4. **[Crecimiento]** Redactar templates: birthday_v1, we_miss_you_v1, last_chance_v1 (pasar VOZ.md)
5. **[Producto]** Decidir: ¿birthdate obligatorio u opcional en registro? (Recomendación: opcional, consent por defecto false)

---

## 14. Referencias Cruzadas

- **Value Prop Doc:** `org/crecimiento/VP_VENUE.md`
- **Experimentos:** `org/crecimiento/EXPERIMENTOS.md` (EXP-004, 005, 006)
- **Métricas:** `org/datos/METRICAS.md` (sección "Lado rumbero" actualizada)
- **VOZ:** `org/crecimiento/VOZ.md` (templates promo)
- **Launch Spec:** `docs/tumbenla-launch-growthhacking-spec.md` (Fase 1-2 supply)

---

**Este spec es input para decisión de Producto. No se codea hasta tripartita firmada.**
