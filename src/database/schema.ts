import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  decimal,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

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
    tiktok: text('tiktok'),
    /** El correo del SITIO, no el de quien lo administra. Sale de la solicitud
     *  de alta, donde es obligatorio. */
    email: text('email'),
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

    /**
     * What this venue reckons it puts in per person per night, in COP.
     *
     * THIS IS AN ESTIMATE AND THE UI MUST NEVER RENDER IT AS ANYTHING ELSE.
     * It exists because a percentage pledge cannot be turned into a per-person
     * figure without knowing what that person drank, and until receipts are
     * per-table there is no honest way to compute it. So the venue declares a
     * number it is willing to stand behind, and every screen that shows it says
     * "estimado".
     *
     * Nullable on purpose: a venue that has not given one shows nights and
     * places without a peso figure, which is better than showing a number we
     * invented for it.
     */
    estimatedPerPersonNight: decimal('estimated_per_person_night', {
      precision: 12,
      scale: 2,
    }),

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

/**
 * A night at a venue that somebody photographed.
 *
 * This is the unit a person's history is counted in. Not "a visit" as a free
 * standing thing: a visit only exists here because somebody claimed a photo
 * taken that night, which is what keeps the count from being inflatable by
 * clicking a button.
 */
export const partyNight = pgTable(
  'party_night',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId(ID_PREFIX.partyNight)),
    venueId: text('venue_id')
      .notNull()
      .references(() => venue.id, { onDelete: 'cascade' }),
    /** The calendar night, not the upload time. A party that ends at 4am
     *  belongs to the night it started. */
    happenedAt: timestamp('happened_at').notNull(),
    title: text('title'),
    // 'draft' | 'published'
    status: text('status').default('draft').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('party_night_venueId_idx').on(table.venueId),
    index('party_night_happenedAt_idx').on(table.happenedAt),
  ]
)

/**
 * A photo from that night.
 *
 * PRIVACY, WHICH IS THE WHOLE DESIGN HERE. These are pictures of identifiable
 * people in a bar. Nothing is world-visible by default and there is no column
 * that can accidentally make it so: `status` starts at 'pending' and only an
 * operator moves it to 'available', which means "claimable by the people in
 * it", NOT "published". Whether a photo is ever shown publicly is decided per
 * person, per photo, in photo_claim.showPublicly. Two separate gates, both of
 * which have to be open.
 */
export const partyPhoto = pgTable(
  'party_photo',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId(ID_PREFIX.partyPhoto)),
    nightId: text('night_id')
      .notNull()
      .references(() => partyNight.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    /** R2 object key, kept so the file can actually be deleted later. A person
     *  asking for their photo to be removed has to result in the bytes going
     *  away, not just a flag flipping. */
    storageKey: text('storage_key'),
    caption: text('caption'),
    // 'pending' | 'available' | 'hidden'
    status: text('status').default('pending').notNull(),

    /** Who uploaded it. Nullable because the account can be deleted and the
     *  photo may still be claimed by other people in it. */
    uploadedByUserId: text('uploaded_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    /**
     * 'venue' | 'guest' | 'platform'. WHO uploaded it, which is not the same as
     * who may enable it.
     *
     * A 'guest' photo is forced to 'pending' no matter what the client sends,
     * and only the venue moves it to 'available'. That is what stops somebody
     * uploading photos of a bar they never set foot in and claiming them to pad
     * their nights: the venue is the gate. Default 'venue' so the rows that
     * existed before this column keep their meaning.
     */
    source: text('source').default('venue').notNull(),
    /** Who enabled or hid it, and when. The moderation trail for a photo of
     *  identifiable people is not optional. */
    reviewedByUserId: text('reviewed_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('party_photo_nightId_idx').on(table.nightId),
    index('party_photo_nightId_status_idx').on(table.nightId, table.status),
  ]
)

/**
 * "That one is me."
 *
 * Claiming a photo is what creates a person's night. The unique index on
 * (photo_id, user_id) is the thing that stops one person claiming the same
 * photo repeatedly to pad their history; nights are then counted as DISTINCT
 * night_id across a user's claims, so ten photos of one night is still one
 * night.
 *
 * showPublicly defaults to false. Claiming a photo puts it in your own private
 * history; putting it on a public profile is a second, separate decision.
 */
export const photoClaim = pgTable(
  'photo_claim',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId(ID_PREFIX.photoClaim)),
    photoId: text('photo_id')
      .notNull()
      .references(() => partyPhoto.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    showPublicly: boolean('show_publicly').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('photo_claim_photoId_userId_key').on(table.photoId, table.userId),
    index('photo_claim_userId_idx').on(table.userId),
  ]
)

export const partyNightRelations = relations(partyNight, ({ one, many }) => ({
  venue: one(venue, {
    fields: [partyNight.venueId],
    references: [venue.id],
  }),
  photos: many(partyPhoto),
}))

export const partyPhotoRelations = relations(partyPhoto, ({ one, many }) => ({
  night: one(partyNight, {
    fields: [partyPhoto.nightId],
    references: [partyNight.id],
  }),
  claims: many(photoClaim),
}))

export const photoClaimRelations = relations(photoClaim, ({ one }) => ({
  photo: one(partyPhoto, {
    fields: [photoClaim.photoId],
    references: [partyPhoto.id],
  }),
  user: one(user, {
    fields: [photoClaim.userId],
    references: [user.id],
  }),
}))

/**
 * Who works at a venue.
 *
 * WHY A TABLE AND NOT A ROLE COLUMN ON user: authorization here is not a
 * property of a person, it is a property of a pair. The same person can be the
 * owner of one bar and a waiter at another, and a column cannot say that.
 *
 * WHY NOT ADMIN_EMAILS: that env allowlist stays, and it stays exactly as it is,
 * for OUR operators. It is the most privileged role in the product, it fails
 * closed, and nobody escalates into it by writing a row. Venue-scoped power is
 * the opposite case — it is granted by other users, at runtime, per venue — so
 * it belongs in the database.
 */
export const venueMember = pgTable(
  'venue_member',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId(ID_PREFIX.venueMember)),
    venueId: text('venue_id')
      .notNull()
      .references(() => venue.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // 'owner' | 'staff'. Only an owner manages the team; both do the day to day.
    role: text('role').default('staff').notNull(),
    /** Who let them in. Kept for the audit trail, not for permissions. Nullable
     *  because the first owner is let in by an operator, not by a member. */
    invitedByUserId: text('invited_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // One row per pair: a person has one role at a venue, not a pile of them.
    uniqueIndex('venue_member_venueId_userId_key').on(table.venueId, table.userId),
    // "Which venues are mine" runs on every load of the panel.
    index('venue_member_userId_idx').on(table.userId),
    index('venue_member_venueId_idx').on(table.venueId),
  ]
)

/**
 * An invitation to join a venue's team.
 *
 * ONLY THE HASH OF THE TOKEN IS STORED. The clear token exists in the email and
 * nowhere else. A read-only leak of this table — a backup, a log, a support
 * query — must not hand over the ability to join somebody's venue, and storing
 * the token itself would do exactly that.
 *
 * The email is not decoration either: accepting checks that the session's email
 * matches this one. Without that check, an invite link forwarded to a group
 * chat lets whoever opens it first into the panel.
 */
export const venueInvitation = pgTable(
  'venue_invitation',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId(ID_PREFIX.venueInvitation)),
    venueId: text('venue_id')
      .notNull()
      .references(() => venue.id, { onDelete: 'cascade' }),
    /** Always stored lowercased, because it is compared against the session
     *  email and 'Ana@bar.co' and 'ana@bar.co' are the same person. */
    email: text('email').notNull(),
    // 'owner' | 'staff'
    role: text('role').default('staff').notNull(),
    /** SHA-256 of the token. See the note above. */
    tokenHash: text('token_hash').notNull(),
    invitedByUserId: text('invited_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at').notNull(),
    acceptedAt: timestamp('accepted_at'),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // The lookup on accept is by hash, and it has to be a single indexed read.
    uniqueIndex('venue_invitation_tokenHash_key').on(table.tokenHash),
    index('venue_invitation_venueId_idx').on(table.venueId),
    index('venue_invitation_email_idx').on(table.email),
  ]
)

export const venueMemberRelations = relations(venueMember, ({ one }) => ({
  venue: one(venue, {
    fields: [venueMember.venueId],
    references: [venue.id],
  }),
  user: one(user, {
    fields: [venueMember.userId],
    references: [user.id],
  }),
}))

export const venueInvitationRelations = relations(venueInvitation, ({ one }) => ({
  venue: one(venue, {
    fields: [venueInvitation.venueId],
    references: [venue.id],
  }),
}))

/**
 * "Este sitio es mio, y aqui esta como comprobarlo."
 *
 * WHY AN APPLICATION AND NOT A VENUE ROW. Registering used to create the venue
 * on the spot and hand ownership over immediately. It cannot any more, and that
 * is the point: the form no longer asks for the pledge or for coordinates —
 * those get agreed in conversation — and venue.pledge_type, latitude and
 * longitude are all NOT NULL. There is nothing to insert yet. The venue is born
 * when an operator approves.
 *
 * It also closed a real hole: instant ownership let anybody register a bar they
 * do not own, and from then on the search told the actual owner "ya tiene
 * dueño".
 *
 * WHY venueId IS NULLABLE. It merges the two paths that used to be separate
 * screens. Claiming a venue we already loaded and proposing one we do not have
 * are the SAME application, with or without a venueId. One queue.
 *
 * HOW IT IS VERIFIED, which is why these two columns are the NOT NULL ones: we
 * ask for a DM from the venue's official Instagram. That DM proves whoever sent
 * it controls the account — it does NOT prove they are the person who filled
 * the form. So the DM has to quote contactEmail and the operator checks it
 * matches. Two different things, both required.
 */
export const venueApplication = pgTable(
  'venue_application',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId(ID_PREFIX.venueApplication)),
    /** Quien aplica, y quien queda de dueno si se aprueba. Sale de la sesion,
     *  nunca de un campo del formulario. */
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Solo cuando reclama un sitio que ya existe. Null = propone uno nuevo. */
    venueId: text('venue_id').references(() => venue.id, { onDelete: 'cascade' }),

    // La propuesta. Lo obligatorio es el minimo para poder verificar.
    name: text('name').notNull(),
    type: text('type').notNull(),
    city: text('city').notNull(),
    addressLine: text('address_line').notNull(),
    /** El instrumento de verificacion: sin cuenta oficial no hay DM que
     *  comprobar, y sin eso este MVP no sabe quien es quien. */
    instagram: text('instagram').notNull(),
    /** El correo del SITIO, y lo que el DM tiene que citar. */
    contactEmail: text('contact_email').notNull(),

    tiktok: text('tiktok'),
    whatsapp: text('whatsapp'),
    phone: text('phone'),
    neighborhood: text('neighborhood'),
    website: text('website'),
    openingHours: text('opening_hours'),
    description: text('description'),
    /** "Que tienes en mente para poner". TEXTO LIBRE, y no toca ninguna columna
     *  pledge_*: es una idea para llegar a la conversacion con contexto, no un
     *  compromiso. El compromiso lo escribe un operador cuando ya lo confirmo. */
    pledgeIdea: text('pledge_idea'),

    // 'pending' | 'verifying' | 'approved' | 'rejected'
    // 'verifying' separa "no la he mirado" de "esta esperando su DM", que para
    // quien atiende la cola son dos cosas distintas.
    status: text('status').default('pending').notNull(),
    reviewedByUserId: text('reviewed_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at'),
    reviewNote: text('review_note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    /**
     * Una sola solicitud VIVA por cuenta de Instagram.
     *
     * Parcial a proposito. Un unique a secas impediria volver a aplicar despues
     * de un rechazo, que es justo lo que si queremos permitir; y sin ningun
     * unique, dos personas podrian tener a la vez una solicitud abierta por el
     * mismo bar. El handle es el ancla porque es unico en el mundo, a
     * diferencia del nombre de un bar.
     */
    uniqueIndex('venue_application_instagram_vivas_key')
      .on(sql`lower(${table.instagram})`)
      .where(sql`${table.status} in ('pending', 'verifying')`),
    index('venue_application_status_idx').on(table.status),
    index('venue_application_userId_idx').on(table.userId),
    index('venue_application_venueId_idx').on(table.venueId),
  ]
)

export const venueApplicationRelations = relations(venueApplication, ({ one }) => ({
  venue: one(venue, {
    fields: [venueApplication.venueId],
    references: [venue.id],
  }),
  user: one(user, {
    fields: [venueApplication.userId],
    references: [user.id],
  }),
}))

/**
 * "En esa foto salgo yo y no quiero."
 *
 * WHY A TABLE AND NOT AN EMAIL. Once guests can upload, a photo can contain
 * somebody who never uploaded it, never claimed it, and never agreed to it.
 * That person needs a way out, and a privacy request cannot depend on whether
 * anyone happens to read an inbox. A row can be listed, counted and chased; an
 * email can be missed.
 *
 * Deliberately thin: who, which photo, why, and whether it was dealt with.
 */
export const photoReport = pgTable(
  'photo_report',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId(ID_PREFIX.photoReport)),
    photoId: text('photo_id')
      .notNull()
      .references(() => partyPhoto.id, { onDelete: 'cascade' }),
    /** Nullable: the account may go away, the request still has to be honoured. */
    reportedByUserId: text('reported_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    reason: text('reason'),
    // 'open' | 'resolved'
    status: text('status').default('open').notNull(),
    resolvedByUserId: text('resolved_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('photo_report_photoId_idx').on(table.photoId),
    index('photo_report_status_idx').on(table.status),
  ]
)

export const photoReportRelations = relations(photoReport, ({ one }) => ({
  photo: one(partyPhoto, {
    fields: [photoReport.photoId],
    references: [partyPhoto.id],
  }),
}))

/**
 * "En agosto entregué X."
 *
 * THE LINK THAT WAS MISSING. Until now the chain on screen jumped straight from
 * "this bar pledges 10%" to "we bought cement", with nothing in between saying
 * the bar actually handed anything over. This is that step, and it is reported
 * by the venue itself.
 *
 * WHICH IS EXACTLY WHY IT IS NOT PUBLIC UNTIL WE VERIFY IT. A self-reported
 * figure published under Tumbenla's name would be the product asserting
 * something it did not check — and the only thing this product has is that
 * somebody checked. 'submitted' does not exist for the public; only 'verified'
 * is ever rendered, and always attributed.
 */
export const venueContribution = pgTable(
  'venue_contribution',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId(ID_PREFIX.venueContribution)),
    venueId: text('venue_id')
      .notNull()
      .references(() => venue.id, { onDelete: 'cascade' }),
    /** The period the money covers, not when it was handed over. A venue
     *  reports "August" in September. */
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').default('COP').notNull(),
    note: text('note'),
    submittedByUserId: text('submitted_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    // 'submitted' | 'verified' | 'rejected'
    status: text('status').default('submitted').notNull(),
    verifiedByUserId: text('verified_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    verifiedAt: timestamp('verified_at'),
    verifiedNote: text('verified_note'),
    /**
     * Which purchase this money paid for. Nullable on purpose: a contribution
     * can be verified and not yet spent, and pretending otherwise would force
     * us to invent a purchase to satisfy a foreign key.
     */
    purchaseId: text('purchase_id').references(() => materialPurchase.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('venue_contribution_venueId_idx').on(table.venueId),
    index('venue_contribution_status_idx').on(table.status),
    index('venue_contribution_purchaseId_idx').on(table.purchaseId),
  ]
)

/** The receipt behind a contribution: a transfer screenshot, an invoice, a
 *  photo of the handover. A child table rather than a CSV in a column, same as
 *  material_purchase_media. */
export const venueContributionMedia = pgTable(
  'venue_contribution_media',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId(ID_PREFIX.venueContributionMedia)),
    contributionId: text('contribution_id')
      .notNull()
      .references(() => venueContribution.id, { onDelete: 'cascade' }),
    // 'receipt' | 'transfer' | 'photo'
    kind: text('kind').default('receipt').notNull(),
    url: text('url').notNull(),
    storageKey: text('storage_key'),
    caption: text('caption'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('venue_contribution_media_contributionId_idx').on(table.contributionId)]
)

export const venueContributionRelations = relations(venueContribution, ({ one, many }) => ({
  venue: one(venue, {
    fields: [venueContribution.venueId],
    references: [venue.id],
  }),
  purchase: one(materialPurchase, {
    fields: [venueContribution.purchaseId],
    references: [materialPurchase.id],
  }),
  media: many(venueContributionMedia),
}))

export const venueContributionMediaRelations = relations(venueContributionMedia, ({ one }) => ({
  contribution: one(venueContribution, {
    fields: [venueContributionMedia.contributionId],
    references: [venueContribution.id],
  }),
}))
