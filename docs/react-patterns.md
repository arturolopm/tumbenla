# Patrones de React en este repo

Doctrina de taller, no documentación de producto. No está en `docs.json` a
propósito: no va al sitio de docs.

`CLAUDE.md` ya fija dos reglas ("No se escribe a mano lo que ya resuelve una
librería" y "Server Components por defecto"). Esto las aterriza con los casos
concretos que ya mordieron.

---

## 1. Contenedor y presentación

Un componente de cliente que hace las dos cosas —tiene el estado, llama las
acciones, Y pinta 60 líneas de JSX con handlers en línea— no se puede leer ni
probar por partes.

**El corte:** el contenedor tiene `useState`/`useActionState`/`useTransition`,
las llamadas al servidor y los `toast`. Le pasa a un hijo **de props puras** los
datos ya calculados y un par de callbacks. El hijo no importa acciones, no sabe
de la base, y se puede mirar solo.

```tsx
// contenedor
export function EquipoManager({ venueId, equipo }: Props) {
  const [pendiente, startTransition] = useTransition()
  const sacar = (id: string) => startTransition(() => sacarDelEquipoAction(id))
  return equipo.map((m) => <MiembroRow key={m.id} miembro={m} onSacar={sacar} disabled={pendiente} />)
}

// presentación — pura
function MiembroRow({ miembro, onSacar, disabled }: RowProps) { … }
```

Ejemplos que ya siguen la forma: `panel/escaner.tsx` (`Escaner` +
`Resultado`), `reset-password-form.tsx` (todo por props, el `fetch` vive en la
página).

## 2. Formularios

`react-hook-form` + `zod` por el resolver. El schema vive en un archivo aparte
(`src/lib/auth/schemas.ts` es el modelo) y lo comparten todos los formularios
que tocan el mismo dato.

**Prohibido:** un `useState` por campo, un arreglo de errores por campo, y una
bandera `showXError`. Eso ya dejó pasar un fallo real: el login leía el correo
del DOM (`FormData`) y la contraseña del estado de React, y con el autocompletado
del navegador la contraseña iba vacía mientras el campo mostraba puntos. Con
`{...register('password')}` el valor validado y el enviado son el mismo por
construcción.

**Errores que no son de un campo** (credenciales malas, cuenta bloqueada, la
petición no salió) van a `setError('root', …)`, no a un `useState` suelto.

**La excepción son las server actions.** `<form action={fn}>` con
`useActionState` NO es código escrito a mano: valida en el servidor, lee del
`FormData`, y es inmune al autocompletado. Esos se quedan así
(`formulario-solicitud.tsx`, `equipo-manager.tsx`).

## 3. Leer datos desde el cliente

`@tanstack/react-query`. Nunca `fetch` dentro de un `useEffect` con su propio
`useState` de carga, su propio error y su propio bucle de sondeo.

`src/hooks/use-my-access.ts` es el patrón: una `queryKey`, `enabled` para no
pedir nada cuando no hay sesión, `retry: false` cuando fallar solo significa una
barra sin atajos.

Una **mutación de un solo tiro** disparada por submit (pedir un cambio de
contraseña, por ejemplo) puede ir en un handler `async` normal o en
`useMutation`. Lo que no puede es tener la ruta escrita a mano: usar el método
del SDK (`client.requestPasswordReset`, no
`fetch('/api/auth/forget-password')`). Esa ruta la quitó Better-Auth 1.4 y el
`fetch` a pelo respondió 404 en silencio durante semanas.

## 4. Efectos

Un valor que es **función pura de la URL o de las props** se computa en el
render (`useMemo` si cuesta), no se copia a un `useState` con un `useEffect`.
El `callbackUrl` de los formularios de auth hacía esto: el efecto corría un
render tarde y quien llegaba por un enlace de invitación perdía el destino.

Un prefill de formulario va en `defaultValues` de `useForm`, no en un efecto que
llama `setValue`.

**Prohibido:** `window.addEventListener('keydown', …)` para que Enter envíe un
formulario. Eso lo hace `<form onSubmit>` solo, sin lista de dependencias que se
quede vieja.

**Prohibido:** un `useState` de `mounted` que nadie lee. Si de verdad hace falta
evitar un mismatch de hidratación, el patrón es otro (y casi nunca hace falta:
la página ya es `dynamic`).

Los efectos legítimos son los que integran algo imperativo: MapLibre, una
cámara (`BarcodeDetector`), un listener de `resize`. Ahí el `useEffect` con su
`return () => cleanup()` es correcto.

## 5. Contadores, timers, listeners globales

Si se repite, es un hook. `src/hooks/use-countdown.ts` para las esperas de
"pide otro en Ns". Un listener de ventana que varios componentes necesitan va en
un hook con recuento de referencias, no copiado en cada uno.

## 6. Lo que llega al navegador antes de hidratar

Todo lo que un componente cliente importa, directo o por un barril, se baja y
se ejecuta ANTES de que la página responda. Dos cosas ya mordieron:

- **Un barril que reexporta algo de servidor.** `cn` desde `@/lib/utils`
  arrastraba `urls.ts` → `@/config/env` → t3-env y Zod enteros a todas las
  páginas (~390 ms en un teléfono). El cliente nunca importa `@/config/env`;
  si un módulo alcanzable desde el navegador necesita una `NEXT_PUBLIC_*`, la
  lee como `process.env.NEXT_PUBLIC_X` literal.
- **Un SDK "de fondo" importado estáticamente.** Sentry en
  `instrumentation-client.ts` costaba ~700 ms. Lo que no hace falta para pintar
  se carga con `import()` después de `load` (`src/lib/monitoring/sentry-browser.ts`).

Y lo que la página necesita para el PRIMER pintado no se pide desde un efecto:
eso llega después de hidratar. La sesión de la barra sale de una cookie que lee
un script en el `<head>` (`src/lib/auth/session-hint.ts`, decisión 46 de
`PRODUCT.md`). `e2e/client-bundle.spec.ts` vigila los dos primeros.

---

## Deuda conocida

- El pase de contenedor/presentación en `panel/`, `admin/` y `fiestas/` está a
  medias: `aportes-panel` y `galeria-de-la-noche` siguen siendo una función con
  un `.map` largo y handlers en línea. No están rotos —usan el patrón de datos
  correcto— pero se leen mal.
