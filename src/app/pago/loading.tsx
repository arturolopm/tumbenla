import { Spinner } from '@/components/ui/spinner'

export default function PaymentLoading() {
  return (
    <main
      className='mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-5 px-margin-mobile py-10 text-center'
      role='status'
      aria-live='assertive'
      aria-busy='true'
    >
      <Spinner aria-hidden='true' className='size-10 text-primary' />
      <h1 className='font-display font-black text-3xl uppercase leading-tight tracking-tighter'>
        Preparando tu pago
      </h1>
      <p className='text-body-lg text-muted-foreground'>
        Estamos conectando con la pasarela de forma segura. No cierres esta ventana ni vuelvas a
        pagar.
      </p>
    </main>
  )
}
