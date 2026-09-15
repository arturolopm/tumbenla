# Handoff para Hermes — aprobar sitios sin cuenta

## Decisión de producto

Una solicitud de sitio no necesita una cuenta para ser aprobada. La autorización
operativa sigue siendo exactamente la misma: el operador comprueba un DM desde
el Instagram declarado que cita el correo de contacto. La cuenta no repite esa
comprobación; solo entrega el panel cuando alguien prueba control de ese buzón
verificando el correo.

## Comportamiento entregado

- Aprobar guarda sitio, solicitud y, solo cuando corresponde, membresía `owner`
  en una transacción.
- Un `userId` histórico no es evidencia: debe pertenecer al mismo correo de
  contacto y estar verificado. Si no, se limpia y no recibe autoridad.
- Si no hay cuenta confiable, el sitio queda aprobado sin dueño. La primera
  cuenta con el correo exacto y verificado lo reclama al entrar; el proceso es
  idempotente y no crea invitación.
- El correo de aprobación lleva al panel cuando el dueño ya está listo. En el
  otro caso prellena el registro con retorno a `/entrar`, donde el reclamo y la
  redirección al panel ocurren solos después del código.
- La aprobación no publica un sitio: solo lo hace el estado que el operador
  selecciona en el formulario.

## Operación manual que no cambia

1. Revisar que el DM provenga de la cuenta de Instagram declarada.
2. Revisar que ese DM cite el correo de contacto de la solicitud.
3. Completar dirección, pin y estado en el formulario de aprobación.
4. Enviar: no pedir al bar crear cuenta antes de este momento.

## Puerta reusable

La decisión se registra como `PRODUCT.md`, decisión 40. Antes de añadir o
conservar fricción, aplicar `docs/ux-friction-review.md`; una comprobación que
ya cubre el riesgo invalida pasos duplicados.

## Integración y verificación

Este cambio vive en `fix/approve-unclaimed-venue`, creado desde el `HEAD`
confirmado `2c4b71b`. `origin/preview` no contiene aún el flujo de solicitudes
sin cuenta (`link-applications.ts` ni `prueba:alta`), por lo que no era una base
funcional para un cambio aislado. Al preparar el PR contra `preview`, conservar
los commits previos que introducen ese flujo o integrar este cambio después de
ellos.

Validado localmente el 2026-09-05:

- `bun run prueba:alta`: aprobación sin cuenta, correo distinto, correo sin
  verificar, reclamo correcto, idempotencia, `userId` histórico con correo
  distinto y dueño ya verificado al aprobar.
- `bun run typecheck` y `bun run build`: correctos.
- Las dos ramas del correo renderizan el destino correcto: panel directo para
  dueño listo y registro prellenado con retorno a `/entrar` para dueño pendiente.
- `/registrar-sitio` respondió 200 desde el servidor aislado de esta rama.

El lint global conserva un baseline ajeno: 34 errores en
`.agents/skills/ad-creative/assets/creative-review-template.html` y
`org/crecimiento/piezas/video-lanzamiento/composition/index.html`; el lint
focalizado de los archivos modificados está limpio.

Antes de promover, un operador debe recorrer visualmente en Mailpit: solicitud
sin sesión → DM comprobado → formulario admin en borrador → correo de
aprobación → registro con código → `/entrar` → panel. Confirmar además que
solo `published` vuelve visible el sitio público.
