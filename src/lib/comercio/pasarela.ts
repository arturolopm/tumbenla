import 'server-only'

/**
 * Cobrar un trago.
 *
 * ESTA INTERFAZ ES PROPIA Y NO REUSA `src/lib/payments/`. Ese es el boilerplate
 * de ShipFree y esta hecho para suscripciones: `CheckoutOptions` exige un plan
 * de 'free' | 'starter' | 'pro' | 'enterprise' y un `userId` con sesion, o sea
 * que no tiene camino para una compra suelta de alguien que no tiene cuenta
 * —que aca es el caso normal (decision 29)—. Ademas arrastra defectos reales:
 * el `validateWebhook` de Polar devuelve `true` sin verificar nada, no hay
 * idempotencia, y falta el indice unico sobre `payment.provider_payment_id`.
 * Enchufarse a eso seria heredar los tres.
 *
 * LA PASARELA REAL ESTA SIN DECIDIR A PROPOSITO. Lo que se sabe es el requisito
 * —tiene que cubrir Nequi y PSE, que es como paga este publico— y no la marca.
 * Todo lo demas del producto (el QR, el escaneo, la compensacion, la caducidad)
 * se puede construir y probar entero contra el proveedor de mentira, y la real
 * entra despues implementando esta interfaz, sin tocar el esquema ni una sola
 * pantalla.
 */

export type IntentoDePago =
  | {
      ok: true
      /** A donde mandar a la persona para que pague. */
      url: string
      /** Con que lo identifica el proveedor. Unico: es la idempotencia del
       *  webhook, que es lo que le falta al webhook heredado. */
      referencia: string
      /** El de mentira cobra en el acto y no manda a ninguna parte. */
      pagadoDeInmediato: boolean
    }
  | { ok: false; error: string }

export type OrdenAPagar = {
  orderId: string
  publicToken: string
  total: number
  currency: string
  descripcion: string
  correo: string
  nombre: string
}

export interface Pasarela {
  readonly nombre: string
  crearIntento(orden: OrdenAPagar): Promise<IntentoDePago>
}

/**
 * El proveedor de mentira.
 *
 * Da el pago por bueno en el acto y devuelve a la persona a su QR. No pide
 * llaves, no sale a internet y funciona en local y en preview, que es
 * justamente lo que permite probar el flujo completo antes de haber firmado con
 * nadie.
 *
 * NO PUEDE QUEDAR ACTIVO EN PRODUCCION: entregaria tragos sin cobrar. Por eso
 * `obtenerPasarela()` revienta al arrancar si NODE_ENV es production y no hay
 * una pasarela de verdad configurada, en vez de degradarse en silencio, que es
 * como se despliega algo que se ve sano y regala el inventario.
 */
class PasarelaDeMentira implements Pasarela {
  readonly nombre = 'mentira'

  async crearIntento(orden: OrdenAPagar): Promise<IntentoDePago> {
    return {
      ok: true,
      url: `/orden/${orden.publicToken}`,
      referencia: `mentira_${orden.orderId}`,
      pagadoDeInmediato: true,
    }
  }
}

export const obtenerPasarela = (): Pasarela => {
  const configurada = process.env.PASARELA

  if (!configurada || configurada === 'mentira') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'PASARELA no esta configurada. En produccion no se puede usar la de mentira: ' +
          'daria los pagos por buenos sin cobrar.'
      )
    }
    return new PasarelaDeMentira()
  }

  // Aca entra la de verdad cuando se decida. Reventar y no caer de vuelta a la
  // de mentira: un nombre mal escrito tiene que romper el despliegue, no
  // volverlo gratis.
  throw new Error(`No conozco la pasarela "${configurada}".`)
}
