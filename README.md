# ⚡ ShipFree V2 - Revamping

Hi there! 👋

ShipFree is a free alternative to ShipFast, designed to simplify and optimize your shipping process. It’s built using modern web technologies like Next.js, Bun, Stripe, Drizzle ORM, Postgres and Tailwindcss.

## Features

- SEO Optimization
- User authentication with Better-Auth
- Stripe, Polar, Autumn Billing, Dodo Payments, Commet and Creem integration
- Email messaging via Resend, Postmark, Plunk, and Nodemailer
- Modern UI built with Next.js, TailwindCSS, and BaseUI
- Bun as runtime and package manager
- Drizzle ORM and Postgres for database operations

## Docs

For full documentation, visit: [ShipFree Docs](https://shipfree.revoks.dev/docs)

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## Contributing

For people who want to contribute, please refer to [CONTRIBUTING.md](CONTRIBUTING.md).

## Removing Premium Purchase Feature

This template includes a premium purchase feature that allows users to buy the Premium version of ShipFree. This feature is **completely isolated** from the template's payment system and can be easily removed if you don't need it.

### What is the Premium Purchase Feature?

The premium purchase feature is used to sell the Premium template itself ($90 one-time payment). It includes:
- Stripe Checkout integration for one-time payments
- Success page that collects GitHub email and Twitter handle
- Discord invite link display after purchase
- Client-side purchase tracking via localStorage

**Important:** This is separate from the template's built-in payment system (Stripe, Polar, Lemon Squeezy) which is used by your application to accept payments from your customers.

### How to Remove

To completely remove the premium purchase feature:

1. **Delete the following folders:**
   - `app/api/premium-purchase/`
   - `app/api/webhooks/premium-purchase/` (if created)
   - `app/[lang]/(site)/premium-purchase/`

2. **Delete the following files:**
   - `lib/premium-purchase.ts`
   - `lib/premium-purchase/hooks.ts`
   - `app/[lang]/(site)/pricing/premium-button.tsx`

3. **Update `app/[lang]/(site)/pricing.tsx`:**
   - Remove the import: `import { PremiumButton } from './pricing/premium-button'`
   - Replace `<PremiumButton />` with a regular button or remove the button handler
   - Look for the comment: `// Premium template purchase - can be removed if not needed`

4. **Remove environment variables from `config/env.ts`:**
   - Remove all variables with `PREMIUM_PURCHASE_` prefix:
     - `PREMIUM_PURCHASE_STRIPE_SECRET_KEY` (server)
     - `PREMIUM_PURCHASE_STRIPE_PRICE_ID` (server)
     - `PREMIUM_PURCHASE_STRIPE_WEBHOOK_SECRET` (server, optional)
     - `NEXT_PUBLIC_PREMIUM_PURCHASE_STRIPE_PUBLISHABLE_KEY` (client)
     - `NEXT_PUBLIC_PREMIUM_PURCHASE_DISCORD_INVITE_LINK` (client)

5. **Remove from `.env` file:**
   - Remove all `PREMIUM_PURCHASE_*` environment variables

6. **Remove webhook endpoint (if configured):**
   - Remove the webhook endpoint from your Stripe Dashboard pointing to `/api/webhooks/premium-purchase`

After removal, the template's payment functionality (for your customers) will continue to work normally. The premium purchase feature is completely decoupled and does not affect any other features.

---

Cooked for you with ❤️ by [Revoks](https://revoks.dev)