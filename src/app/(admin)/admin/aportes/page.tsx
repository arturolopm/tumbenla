import { redirect } from 'next/navigation'

/** La liquidacion en Cuentas reemplazo la cola de auto-reportes. */
export default function AdminAportesPage() {
  redirect('/admin/cuentas')
}
