import { relations } from 'drizzle-orm'
import { pgTable, text, timestamp, boolean, index, decimal } from 'drizzle-orm/pg-core'

import { ID_PREFIX, createId } from '@/lib/utils/id'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
})

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_userId_idx').on(table.userId)]
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)]
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
)

// Payment system tables
export const customer = pgTable(
  'customer',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'stripe', 'polar', 'dodo', 'creem', 'autumn'
    providerCustomerId: text('provider_customer_id').notNull(), // Customer ID from payment provider
    email: text('email'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('customer_userId_idx').on(table.userId),
    index('customer_provider_customerId_idx').on(table.providerCustomerId),
  ]
)

export const subscription = pgTable(
  'subscription',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').references(() => customer.id, { onDelete: 'set null' }),
    provider: text('provider').notNull(), // 'stripe', 'polar', 'dodo', 'creem', 'autumn'
    providerSubscriptionId: text('provider_subscription_id').notNull(), // Subscription ID from payment provider
    status: text('status').notNull(), // 'active', 'canceled', 'past_due', 'trialing', 'incomplete'
    plan: text('plan').notNull(), // 'free', 'starter', 'pro', 'enterprise', etc.
    interval: text('interval'), // 'month', 'year', null for one-time
    amount: decimal('amount', { precision: 10, scale: 2 }), // Price amount
    currency: text('currency'), // 'usd', 'eur', etc.
    currentPeriodStart: timestamp('current_period_start'),
    currentPeriodEnd: timestamp('current_period_end'),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
    canceledAt: timestamp('canceled_at'),
    trialStart: timestamp('trial_start'),
    trialEnd: timestamp('trial_end'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('subscription_userId_idx').on(table.userId),
    index('subscription_customerId_idx').on(table.customerId),
    index('subscription_provider_subscriptionId_idx').on(table.providerSubscriptionId),
    index('subscription_status_idx').on(table.status),
  ]
)

export const payment = pgTable(
  'payment',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').references(() => customer.id, { onDelete: 'set null' }),
    subscriptionId: text('subscription_id').references(() => subscription.id, {
      onDelete: 'set null',
    }),
    provider: text('provider').notNull(), // 'stripe', 'polar', 'dodo', 'creem', 'autumn'
    providerPaymentId: text('provider_payment_id').notNull(), // Payment ID from provider
    type: text('type').notNull(), // 'subscription', 'one_time', 'refund'
    status: text('status').notNull(), // 'succeeded', 'pending', 'failed', 'canceled'
    amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
    currency: text('currency').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('payment_userId_idx').on(table.userId),
    index('payment_customerId_idx').on(table.customerId),
    index('payment_subscriptionId_idx').on(table.subscriptionId),
    index('payment_provider_paymentId_idx').on(table.providerPaymentId),
  ]
)

// ---------------------------------------------------------------------------
// Tumbenla
//
// Table and column names stay English to match `user`, `session` and `payment`
// above; every user-facing string and every URL is Spanish.
//
// No new column types are introduced. Quantities use decimal rather than
// integer so the schema keeps to text/timestamp/boolean/decimal throughout, and
// enum-ish columns are plain text with the allowed values in a comment,
// validated by Zod at the edge, exactly like subscription.status.
//
// IMPORTANT: postgres-js returns every decimal as a STRING, coordinates and
// money alike. Handing '4.710000' straight to MapLibre yields a blank map with
// no error. src/lib/venues/mappers.ts is the single place that converts.
// ---------------------------------------------------------------------------

/**
 * A bar or nightclub that has publicly committed to putting part of its sales
 * into construction materials.
 */
export const venue = pgTable(
  'venue',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId(ID_PREFIX.venue)),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    // 'bar' | 'discoteca' | 'club' | 'terraza' | 'restobar' | 'billar'
    type: text('type').notNull(),

    tagline: text('tagline'),
    description: text('description'),

    addressLine: text('address_line').notNull(),
    neighborhood: text('neighborhood'),
    city: text('city').notNull(),
    department: text('department').notNull(),
    country: text('country').default('CO').notNull(),
    // decimal(9,6) is roughly 10 cm of precision, far more than a venue needs.
    latitude: decimal('latitude', { precision: 9, scale: 6 }).notNull(),
    longitude: decimal('longitude', { precision: 9, scale: 6 }).notNull(),

    phone: text('phone'),
    whatsapp: text('whatsapp'),
    instagram: text('instagram'),
    website: text('website'),
    // Free text for now: 'Jue a Sab, 8:00 p.m. a 3:00 a.m.'
    openingHours: text('opening_hours'),

    coverImageUrl: text('cover_image_url'),
    logoUrl: text('logo_url'),

    // The pledge lives inline rather than in its own table because a venue has
    // exactly one live commitment in this phase. That keeps /sitios a single
    // table scan with no join and the admin screen a single form. If pledge
    // HISTORY is ever needed, add venue_pledge with these same columns plus
    // venueId and supersededAt, backfill from here, and leave these as a cache
    // of the active pledge. No rewrite either way.
    //
    // 'percentage' | 'fixed_per_unit'
    pledgeType: text('pledge_type').notNull(),
    // Set when pledgeType is 'percentage'.
    pledgePercentage: decimal('pledge_percentage', { precision: 5, scale: 2 }),
    // Set when pledgeType is 'fixed_per_unit'.
    pledgeAmount: decimal('pledge_amount', { precision: 10, scale: 2 }),
    // 'botella' | 'trago' | 'cerveza' | 'coctel' | 'entrada'
    pledgeUnit: text('pledge_unit'),
    pledgeCurrency: text('pledge_currency').default('COP').notNull(),
    // 'ventas_totales' | 'ventas_licor' | 'cover'   (percentage only)
    pledgeBasis: text('pledge_basis'),
    // The nuance, in the venue's own words.
    pledgeNote: text('pledge_note'),
    pledgeStartsAt: timestamp('pledge_starts_at'),
    pledgeEndsAt: timestamp('pledge_ends_at'),

    // 'draft' | 'published' | 'paused' | 'archived'
    status: text('status').default('draft').notNull(),
    featured: boolean('featured').default(false).notNull(),
    // When and how the operator confirmed the commitment. The product vouches
    // for these claims publicly, so how each was checked has to be recorded.
    verifiedAt: timestamp('verified_at'),
    verifiedNote: text('verified_note'),
    publishedAt: timestamp('published_at'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('venue_status_idx').on(table.status),
    index('venue_city_idx').on(table.city),
    index('venue_status_city_idx').on(table.status, table.city),
    index('venue_pledgeType_idx').on(table.pledgeType),
    // Unused while every pin is fetched at once, but it costs nothing and turns
    // the eventual viewport-bounded query into an index scan.
    index('venue_lat_lng_idx').on(table.latitude, table.longitude),
  ]
)

/**
 * One purchase of construction materials, with its receipts and photos.
 *
 * Trust in this product comes from published evidence rather than from an
 * institution's name, so this is a first-class table and a first-class route,
 * not an afterthought.
 */
export const materialPurchase = pgTable(
  'material_purchase',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId(ID_PREFIX.materialPurchase)),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    summary: text('summary'),
    story: text('story'),

    // Municipality, never a street address. See beneficiaryLabel.
    municipality: text('municipality').notNull(),
    department: text('department').notNull(),

    // Nullable on purpose, and generic by default. Naming the people who just
    // lost their homes is the most likely way this product hurts someone.
    beneficiaryLabel: text('beneficiary_label'),
    householdsHelped: decimal('households_helped', { precision: 6, scale: 0 }),

    // decimal(12,2) rather than (10,2): ten digits overflow fast in COP once
    // several purchases are summed.
    totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').default('COP').notNull(),
    purchasedAt: timestamp('purchased_at').notNull(),
    supplierName: text('supplier_name'),
    receiptNumber: text('receipt_number'),

    coverImageUrl: text('cover_image_url'),

    // 'draft' | 'published'
    status: text('status').default('draft').notNull(),
    publishedAt: timestamp('published_at'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('material_purchase_status_idx').on(table.status),
    index('material_purchase_purchasedAt_idx').on(table.purchasedAt),
    index('material_purchase_municipality_idx').on(table.municipality),
  ]
)

/** A line on the receipt: 'Cemento gris 50 kg', 12 bultos. */
export const materialPurchaseItem = pgTable(
  'material_purchase_item',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId(ID_PREFIX.materialPurchaseItem)),
    purchaseId: text('purchase_id')
      .notNull()
      .references(() => materialPurchase.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Decimal because you really do buy 2.5 m3 of sand.
    quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull(),
    // 'bulto' | 'unidad' | 'm3' | 'lamina' | 'metro' | 'galon'
    unit: text('unit').notNull(),
    unitCost: decimal('unit_cost', { precision: 12, scale: 2 }),
    subtotal: decimal('subtotal', { precision: 12, scale: 2 }),
    position: decimal('position', { precision: 10, scale: 2 }).default('0').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('material_purchase_item_purchaseId_idx').on(table.purchaseId)]
)

/**
 * Receipts, delivery notes and photos backing a purchase.
 *
 * A child table rather than an array of URLs on the purchase, because this
 * schema uses no jsonb anywhere and a CSV in a text column is worse than a
 * table.
 */
export const materialPurchaseMedia = pgTable(
  'material_purchase_media',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId(ID_PREFIX.materialPurchaseMedia)),
    purchaseId: text('purchase_id')
      .notNull()
      .references(() => materialPurchase.id, { onDelete: 'cascade' }),
    // 'receipt' | 'photo' | 'delivery_note'
    kind: text('kind').notNull(),
    url: text('url').notNull(),
    // R2 object key, kept so the file can actually be deleted later.
    storageKey: text('storage_key'),
    caption: text('caption'),
    // Must be true before a photo is published. Evidence naturally contains
    // images of people who just lost their homes.
    consentGiven: boolean('consent_given').default(false).notNull(),
    position: decimal('position', { precision: 10, scale: 2 }).default('0').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('material_purchase_media_purchaseId_idx').on(table.purchaseId),
    index('material_purchase_media_purchaseId_kind_idx').on(table.purchaseId, table.kind),
  ]
)

export const materialPurchaseRelations = relations(materialPurchase, ({ many }) => ({
  items: many(materialPurchaseItem),
  media: many(materialPurchaseMedia),
}))

export const materialPurchaseItemRelations = relations(materialPurchaseItem, ({ one }) => ({
  purchase: one(materialPurchase, {
    fields: [materialPurchaseItem.purchaseId],
    references: [materialPurchase.id],
  }),
}))

export const materialPurchaseMediaRelations = relations(materialPurchaseMedia, ({ one }) => ({
  purchase: one(materialPurchase, {
    fields: [materialPurchaseMedia.purchaseId],
    references: [materialPurchase.id],
  }),
}))
