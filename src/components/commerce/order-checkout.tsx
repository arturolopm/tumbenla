'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useMemo, useState } from 'react'

import { createOrderAction, type OrderState } from '@/app/actions/orders'
import { BackToVenueLink } from '@/components/comercio/back-to-venue-link'
import { Spinner } from '@/components/ui/spinner'
import { toastManager } from '@/components/ui/toast'
import { barCartStore, MAX_CART_UNITS, useBarCartStore } from '@/lib/cart/cart-store'
import { cartQuoteHash } from '@/lib/cart/cart-quote'
import { KIND_LABEL, type KindDeProducto as ProductKind } from '@/lib/comercio/types'
import { cn } from '@/lib/utils/css'
import { formatCOP } from '@/lib/utils/format'

type CatalogProduct = {
  id: string
  slug: string
  name: string
  kind: ProductKind
  description: string | null
  unitPrice: number
  unitGrossMinor: number
  donationPercentage: number
  donationBasisPoints: number
  donationAmount: number
  venueAmount: number
  imageUrl: string | null
}

type SelectedLine = CatalogProduct & {
  quantity: number
  lineTotal: number
}

type OrderCheckoutProps = {
  venueId: string
  venueSlug: string
  venueName: string
  seedProductSlug: string | null
  catalog: CatalogProduct[]
  accountEmail: string
  accountName: string
  isGuest: boolean
}

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-body-md text-street-white focus:border-primary focus:outline-none'

export function OrderCheckout({
  venueId,
  venueSlug,
  venueName,
  seedProductSlug,
  catalog,
  accountEmail,
  accountName,
  isGuest,
}: OrderCheckoutProps) {
  const router = useRouter()
  const [state, submitAction, isSubmitting] = useActionState<OrderState, FormData>(
    createOrderAction,
    { status: 'idle' }
  )
  const cart = useBarCartStore((store) => store.carts[venueId])
  const hasHydrated = useBarCartStore((store) => store.hasHydrated)
  const hydrationError = useBarCartStore((store) => store.hydrationError)
  const ensureSeededProduct = useBarCartStore((store) => store.ensureSeededProduct)
  const addUnit = useBarCartStore((store) => store.addUnit)
  const setQuantity = useBarCartStore((store) => store.setQuantity)
  const removeProduct = useBarCartStore((store) => store.removeProduct)
  const rotateSubmissionKey = useBarCartStore((store) => store.rotateSubmissionKey)
  const clearVenueCart = useBarCartStore((store) => store.clearVenueCart)
  const [paymentMethod, setPaymentMethod] = useState<'app' | 'bar'>('app')
  const [wantsAccount, setWantsAccount] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [quotedCartHash, setQuotedCartHash] = useState('')

  const catalogById = useMemo(
    () => new Map(catalog.map((product) => [product.id, product])),
    [catalog]
  )
  const productBySlug = useMemo(
    () => new Map(catalog.map((product) => [product.slug, product])),
    [catalog]
  )
  const selectedLines = useMemo<SelectedLine[]>(
    () =>
      (cart?.lines ?? []).flatMap((line) => {
        const product = catalogById.get(line.productId)
        return product
          ? [{ ...product, quantity: line.quantity, lineTotal: product.unitPrice * line.quantity }]
          : []
      }),
    [cart?.lines, catalogById]
  )
  const selectedIds = useMemo(() => new Set(selectedLines.map((line) => line.id)), [selectedLines])
  const otherProducts = catalog.filter((product) => !selectedIds.has(product.id))
  const totalUnits = selectedLines.reduce((total, line) => total + line.quantity, 0)
  const totalAmount = selectedLines.reduce((total, line) => total + line.lineTotal, 0)
  const totalDonation = selectedLines.reduce(
    (total, line) => total + line.donationAmount * line.quantity,
    0
  )
  const atLimit = totalUnits >= MAX_CART_UNITS
  const isPreparing = isSubmitting || state.status === 'success'

  useEffect(() => {
    void barCartStore.persist.rehydrate()
  }, [])

  useEffect(() => {
    if (!hasHydrated || !cart) return
    const unavailable = cart.lines.filter((line) => !catalogById.has(line.productId))
    if (unavailable.length === 0) return
    for (const line of unavailable) removeProduct(venueId, line.productId)
    setNotice(
      unavailable.length === 1
        ? 'Quitamos un producto que ya no está disponible.'
        : `Quitamos ${unavailable.length} productos que ya no están disponibles.`
    )
  }, [cart, catalogById, hasHydrated, removeProduct, venueId])

  useEffect(() => {
    if (!hasHydrated || !seedProductSlug) return
    const product = productBySlug.get(seedProductSlug)
    if (product) {
      const result = ensureSeededProduct(venueId, product.id)
      if (!result.ok && result.reason === 'cart-limit-exceeded') {
        setNotice(`Tu pedido ya tiene el máximo de ${MAX_CART_UNITS} unidades.`)
      }
    } else {
      setNotice('Ese producto ya no está disponible. Puedes elegir otro de la carta.')
    }
    router.replace(`/sitios/${encodeURIComponent(venueSlug)}/pedir`, { scroll: false })
  }, [ensureSeededProduct, hasHydrated, productBySlug, router, seedProductSlug, venueId, venueSlug])

  useEffect(() => {
    let current = true
    if (selectedLines.length === 0) {
      setQuotedCartHash('')
      return () => {
        current = false
      }
    }
    void cartQuoteHash(
      selectedLines.map((line) => ({
        venueId,
        productId: line.id,
        quantity: line.quantity,
        unitGrossMinor: line.unitGrossMinor,
        donationBasisPoints: line.donationBasisPoints,
        currency: 'COP',
      }))
    ).then((hash) => {
      if (current) setQuotedCartHash(hash)
    })
    return () => {
      current = false
    }
  }, [selectedLines, venueId])

  useEffect(() => {
    if (state.status === 'success') {
      const fingerprint = cart?.fingerprint
      const attempt = /^\/pago\/(?:iniciar|estado)\/([^?]+)/.exec(state.url)?.[1]
      if (attempt && fingerprint) {
        sessionStorage.setItem(
          `tumbenla:payment-attempt:${attempt}`,
          JSON.stringify({
            venueId,
            cartFingerprint: fingerprint,
            wantsAccount: wantsAccount && isGuest,
          })
        )
      } else if (fingerprint) {
        clearVenueCart(venueId, fingerprint)
      }
      router.push(state.url)
    }
    if (state.status === 'error') {
      if (state.reason === 'rotate-submission') rotateSubmissionKey(venueId)
      if (state.reason === 'cart-changed') {
        setNotice('Actualizamos la carta. Revisa los precios antes de continuar.')
        router.refresh()
      }
      toastManager.add({ title: 'No se pudo', description: state.error, type: 'error' })
    }
  }, [
    cart?.fingerprint,
    clearVenueCart,
    isGuest,
    rotateSubmissionKey,
    router,
    state,
    venueId,
    wantsAccount,
  ])

  const fieldError = (field: string) =>
    state.status === 'error' ? state.fieldErrors?.[field]?.[0] : undefined

  const addProduct = (productId: string) => {
    const result = addUnit(venueId, productId)
    setNotice(
      !result.ok && result.reason === 'cart-limit-exceeded'
        ? `Máximo ${MAX_CART_UNITS} unidades por pedido.`
        : null
    )
  }

  const changeQuantity = (line: SelectedLine, nextQuantity: number) => {
    const result =
      nextQuantity < 1
        ? removeProduct(venueId, line.id)
        : setQuantity(venueId, line.id, nextQuantity)
    setNotice(
      !result.ok && result.reason === 'cart-limit-exceeded'
        ? `Máximo ${MAX_CART_UNITS} unidades por pedido.`
        : null
    )
  }

  if (!hasHydrated) {
    return (
      <div className='flex flex-col gap-6' aria-busy='true'>
        <BackToVenueLink venueName={venueName} venueSlug={venueSlug} />
        <div className='h-10 w-3/4 animate-pulse rounded-lg bg-elevated' />
        <div className='h-36 animate-pulse rounded-xl border border-border bg-card' />
        <p className='sr-only' role='status'>
          Abriendo tu pedido
        </p>
      </div>
    )
  }

  return (
    <form action={submitAction} className='flex flex-col gap-7' aria-busy={isPreparing}>
      {isPreparing ? (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-background/90 px-margin-mobile backdrop-blur-sm'
          role='status'
          aria-live='assertive'
        >
          <div className='w-full max-w-sm rounded-2xl border border-primary/40 bg-elevated p-7 text-center shadow-2xl'>
            <Spinner aria-hidden='true' className='mx-auto size-10 text-primary' />
            <p className='mt-5 font-display font-black text-2xl uppercase leading-tight'>
              {paymentMethod === 'app' ? 'Preparando el pago seguro' : 'Preparando tu código'}
            </p>
            <p className='mt-3 text-body-md text-muted-foreground'>
              {paymentMethod === 'app'
                ? 'Estamos creando un solo pedido y conectando con la pasarela.'
                : 'Estamos reservando todo el pedido para mostrar un solo código en la barra.'}
            </p>
          </div>
        </div>
      ) : null}

      <input type='hidden' name='venueId' value={venueId} />
      <input type='hidden' name='venueSlug' value={venueSlug} />
      <input
        type='hidden'
        name='lines'
        value={JSON.stringify(
          selectedLines.map((line) => ({ productId: line.id, quantity: line.quantity }))
        )}
      />
      <input type='hidden' name='payMethod' value={paymentMethod} />
      <input type='hidden' name='submissionKey' value={cart?.submissionKey ?? ''} />
      <input type='hidden' name='quotedCartHash' value={quotedCartHash} />
      <input type='hidden' name='quiereCuenta' value={wantsAccount ? '1' : '0'} />

      <header>
        <BackToVenueLink venueName={venueName} venueSlug={venueSlug} />
        <p className='mt-4 font-display text-label-sm text-muted-foreground uppercase'>
          Pedido en {venueName}
        </p>
        <h1 className='mt-1 font-display font-black text-4xl uppercase leading-none tracking-tighter'>
          Todo en un solo QR
        </h1>
      </header>

      {hydrationError ? (
        <p role='alert' className='rounded-xl border border-border bg-card p-4 text-body-md'>
          El navegador no pudo recuperar tu pedido anterior. Puedes armarlo de nuevo aquí.
        </p>
      ) : null}
      {notice ? (
        <p role='status' aria-live='polite' className='rounded-lg bg-elevated px-3 py-2 text-sm'>
          {notice}
        </p>
      ) : null}

      <section aria-labelledby='selected-products-heading'>
        <div className='flex items-baseline justify-between gap-4'>
          <h2 id='selected-products-heading' className='font-display text-label-lg uppercase'>
            Tu pedido
          </h2>
          <span className='text-muted-foreground text-sm tabular-nums'>
            {totalUnits}/{MAX_CART_UNITS}
          </span>
        </div>

        {selectedLines.length > 0 ? (
          <ul className='mt-3 divide-y divide-border rounded-xl border border-border bg-card px-4'>
            {selectedLines.map((line) => (
              <li key={line.id} className='py-4'>
                <div className='flex items-start justify-between gap-4'>
                  <div className='min-w-0'>
                    <h3 className='font-display font-bold text-lg'>{line.name}</h3>
                    <p className='text-label-sm text-muted-foreground uppercase'>
                      {KIND_LABEL[line.kind]} · {formatCOP(line.unitPrice)} c/u
                    </p>
                    <p className='mt-1 text-lime text-sm'>
                      {line.donationPercentage}% del valor neto para reconstruir
                    </p>
                  </div>
                  <p className='shrink-0 font-display font-black text-lg tabular-nums'>
                    {formatCOP(line.lineTotal)}
                  </p>
                </div>
                <div className='mt-3 flex items-center gap-3'>
                  <button
                    type='button'
                    onClick={() => changeQuantity(line, line.quantity - 1)}
                    className='size-11 rounded-lg border border-border font-display text-xl transition-colors hover:border-party disabled:opacity-40'
                    aria-label={
                      line.quantity === 1
                        ? `Quitar ${line.name}`
                        : `Quitar una unidad de ${line.name}`
                    }
                  >
                    −
                  </button>
                  <output
                    className='w-10 text-center font-display font-black text-xl tabular-nums'
                    aria-label={`${line.quantity} unidades de ${line.name}`}
                  >
                    {line.quantity}
                  </output>
                  <button
                    type='button'
                    onClick={() => changeQuantity(line, line.quantity + 1)}
                    disabled={atLimit}
                    className='size-11 rounded-lg border border-border font-display text-xl transition-colors hover:border-party disabled:opacity-40'
                    aria-label={`Agregar una unidad de ${line.name}`}
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className='mt-3 rounded-xl border border-border bg-card p-4 text-body-md text-muted-foreground'>
            Elige algo de la carta para empezar.
          </p>
        )}
      </section>

      <section aria-labelledby='add-more-heading'>
        <h2 id='add-more-heading' className='font-display text-label-lg uppercase'>
          Agregar algo más
        </h2>
        {otherProducts.length > 0 ? (
          <ul className='mt-3 divide-y divide-border border-border border-y'>
            {otherProducts.map((product) => (
              <li key={product.id} className='flex items-center justify-between gap-4 py-3'>
                <div className='min-w-0'>
                  <p className='truncate font-display font-bold'>{product.name}</p>
                  <p className='text-muted-foreground text-sm'>
                    {formatCOP(product.unitPrice)} · {product.donationPercentage}% para reconstruir
                  </p>
                </div>
                <button
                  type='button'
                  onClick={() => addProduct(product.id)}
                  disabled={atLimit}
                  className='min-h-11 shrink-0 rounded-lg border border-primary px-4 font-display text-label-sm text-primary-text uppercase transition-colors hover:bg-primary/10 disabled:border-border disabled:text-muted-foreground'
                  aria-label={`Agregar ${product.name}`}
                >
                  Agregar
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className='mt-2 text-muted-foreground text-sm'>
            Ya agregaste toda la carta disponible.
          </p>
        )}
        {atLimit ? (
          <p className='mt-2 text-primary-text text-sm' role='status'>
            Llegaste al máximo de {MAX_CART_UNITS} unidades.
          </p>
        ) : null}
      </section>

      {selectedLines.length > 0 ? (
        <>
          <div className='rounded-xl border border-lime bg-lime/5 p-4'>
            <div className='flex items-baseline justify-between gap-4'>
              <span className='font-display text-label-lg uppercase'>Total</span>
              <strong className='font-display text-2xl tabular-nums'>
                {formatCOP(totalAmount)}
              </strong>
            </div>
            <p className='mt-2 text-body-md text-muted-foreground'>
              {paymentMethod === 'app'
                ? 'Cada producto conserva su reparto. El valor exacto se confirma después de las deducciones verificadas de la pasarela.'
                : `${formatCOP(totalDonation)} van en material. El sitio cobra el total después de escanear.`}
            </p>
          </div>

          <fieldset className='flex flex-col gap-1'>
            <legend className='font-display text-label-lg uppercase'>Cómo pagas</legend>
            <div className='mt-1 grid gap-3 sm:grid-cols-2'>
              <PaymentOption
                active={paymentMethod === 'app'}
                onClick={() => setPaymentMethod('app')}
                title='Aquí'
                detail='Pagas todo ahora y solo lo recoges.'
              />
              <PaymentOption
                active={paymentMethod === 'bar'}
                onClick={() => setPaymentMethod('bar')}
                title='En la barra'
                detail='Un solo cobro después de escanear.'
              />
            </div>
          </fieldset>

          <Field id='buyerName' label='Tu nombre' error={fieldError('buyerName')} required>
            <input
              id='buyerName'
              name='buyerName'
              required
              defaultValue={accountName}
              autoComplete='name'
              className={inputClass}
            />
          </Field>

          <Field
            id='buyerEmail'
            label='Tu correo'
            error={fieldError('buyerEmail')}
            help='Para mandarte el código, por si cierras la pestaña.'
            required
          >
            <input
              id='buyerEmail'
              name='buyerEmail'
              type='email'
              required
              defaultValue={accountEmail}
              autoComplete='email'
              inputMode='email'
              className={inputClass}
            />
          </Field>

          {isGuest ? (
            <fieldset className='flex flex-col gap-1'>
              <legend className='font-display text-label-lg uppercase'>Tu historia</legend>
              <div className='mt-1 grid gap-3 sm:grid-cols-2'>
                <PaymentOption
                  active={wantsAccount}
                  onClick={() => setWantsAccount(true)}
                  title='Con cuenta'
                  detail='Guarda tus fotos, pedidos y a dónde fue la plata.'
                />
                <PaymentOption
                  active={!wantsAccount}
                  onClick={() => setWantsAccount(false)}
                  title='Como invitado'
                  detail='Solo el código. Puedes crear la cuenta después.'
                />
              </div>
              <p className='mt-2 text-muted-foreground text-sm'>
                {wantsAccount
                  ? 'Primero te sale el código. La cuenta la terminas mientras esperas.'
                  : 'Si luego usas este correo en una cuenta verificada, el pedido aparece ahí.'}
              </p>
            </fieldset>
          ) : null}

          <button
            type='submit'
            disabled={isPreparing || !cart || quotedCartHash.length === 0}
            className='rounded-xl bg-primary px-6 py-4 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90 disabled:opacity-50'
          >
            {isPreparing
              ? paymentMethod === 'app'
                ? 'Preparando pago…'
                : 'Preparando código…'
              : paymentMethod === 'app'
                ? `Pagar ${formatCOP(totalAmount)}`
                : `Pedir todo · ${formatCOP(totalAmount)} en la barra`}
          </button>

          <p className='text-body-md text-muted-foreground'>
            {isGuest
              ? 'No tienes que crear cuenta. Todo el pedido sale en un solo código.'
              : 'Todo este pedido queda guardado en tu historia.'}
          </p>
        </>
      ) : null}
    </form>
  )
}

function PaymentOption({
  active,
  onClick,
  title,
  detail,
}: {
  active: boolean
  onClick: () => void
  title: string
  detail: string
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-xl border-2 p-4 text-left transition-colors',
        active ? 'border-lime bg-lime/5' : 'border-border hover:border-party'
      )}
    >
      <span className='block font-display font-bold text-lg'>{title}</span>
      <span className='mt-0.5 block text-body-md text-muted-foreground'>{detail}</span>
    </button>
  )
}

function Field({
  id,
  label,
  help,
  error,
  required,
  children,
}: {
  id: string
  label: string
  help?: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-col gap-1'>
      <label htmlFor={id} className='font-display text-label-lg uppercase'>
        {label}
        {required ? <span className='text-primary-text'> *</span> : null}
      </label>
      {help ? <span className='text-muted-foreground text-sm'>{help}</span> : null}
      {children}
      {error ? (
        <span role='alert' className='text-body-sm text-destructive-foreground'>
          {error}
        </span>
      ) : null}
    </div>
  )
}
