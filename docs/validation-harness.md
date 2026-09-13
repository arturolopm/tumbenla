# Harness de validación local

Este documento describe cómo se prueba Tumbenla durante la transformación del producto. No es una decisión de adquisición ni un experimento: es infraestructura del taller. Las decisiones de alcance siguen en `PRODUCT.md`; los experimentos de crecimiento siguen en `org/crecimiento/EXPERIMENTOS.md`.

## El camino que se valida

La experiencia que se está simplificando tiene cuatro actores y un solo circuito:

1. **Operación de plataforma** crea o aprueba el sitio antes de que exista públicamente.
2. **Dueño del sitio** hace dos cosas de preparación: invita al personal y arma un producto con nombre, tipo, precio y un reparto de mínimo 40%. Cuando está listo, lo publica directamente.
3. **Personal del sitio** solo abre el escáner y entrega el producto contra un QR. No administra el equipo ni el reparto.
4. **Rumbero** ve un producto publicado, lo paga mediante el checkout alojado de ePayco (o el método de barra), muestra el QR y ve la confirmación de entrega.

La simplificación se evalúa contra esa secuencia. Una pantalla, campo o permiso que no ayude a uno de esos cuatro actos necesita una razón explícita para seguir existiendo.

## Límites de cada actor

| Actor | Puede | No puede |
|---|---|---|
| Plataforma | aprobar sitios, ver cuentas, reconciliar cobros y revisar transferencias | publicar un sitio sin verificación registrada o transferir sin evidencia |
| Dueño | invitar o quitar personal, crear, editar y publicar productos de mínimo 40% | publicar un producto por debajo de 40% o transferir fondos |
| Personal | escanear y entregar | ver equipo, cambiar productos o entrar a otro sitio |
| Rumbero | pedir un producto público y presentar QR | ver borradores, productos pausados o datos del panel; usar un QR pagado pendiente |

El porcentaje es la única entrada del reparto. La parte que se queda el sitio se calcula como el complemento; nunca se captura como un segundo número. El valor exacto en pesos queda pendiente hasta reconciliar el bruto, las deducciones itemizadas y las retenciones aplicables.

## Universo local reproducible

Todo el ensayo ocurre contra Docker local. Nunca se usan credenciales ni datos de preview o producción.

```bash
bun run test:commerce
bun run test:e2e
```

`test:commerce` crea bases PostgreSQL aisladas para las pruebas transaccionales.
`test:e2e` crea una base `tumbenla_e2e_*`, aplica migraciones y seeds, construye la aplicación una
sola vez, la sirve con `next start` y destruye la base en `finally`, incluso si la prueba falla o se
interrumpe. Docker debe estar arriba; no hace falta resetear la base de desarrollo ni arrancar
`bun dev`.

Las cuentas de prueba son intencionalmente locales y verificadas:

| Rol | Cuenta | Sitio |
|---|---|---|
| Operación | `operador@prueba.local` | ninguno; el acceso sale de `ADMIN_EMAILS` |
| Dueño A | `duenoa@prueba.local` | `bar-la-nona` |
| Personal A | `mesero@prueba.local` | `bar-la-nona` |
| Dueño B | `duenob@prueba.local` | `billar-la-enea` |
| Rumbero | sesión anónima por defecto; una cuenta específica se agrega cuando se pruebe historial o vinculación |

La contraseña compartida de las cuentas locales está definida en `scripts/seed-cuentas-de-prueba.ts`; no se usa fuera de la base local.

## Cuatro contextos aislados

Las pruebas de interfaz deben abrir cuatro perfiles o contextos de navegador independientes, nunca una sola sesión que cambia de usuario:

- `operator`: plataforma
- `owner-a`: dueño de `bar-la-nona`
- `staff-a`: mesero de `bar-la-nona`
- `guest`: rumbero sin sesión

`owner-b` es un contexto adicional solo para aislamiento multi-sitio. Su prueba mínima es que `/panel/bar-la-nona/*` no revela nada ni permite mutación.

## Matriz de aceptación por cambio

Cada cambio que toque el circuito principal se valida en este orden:

1. **Dueño — menú y permisos:** en `owner-a`, pulsa el menú de cuenta → **Mi bar** → **Carta**. Crea un producto, confirma el porcentaje, prueba que 39% se rechaza y 40% se publica. En `staff-a`, la misma ruta no muestra crear/editar/publicar y `/panel/bar-la-nona` lleva directamente a **Escanear**.
2. **Dueño — equipo y correo:** desde el menú de cuenta → **Equipo**, invita a `mesero@prueba.local`. Solo esa sesión con correo coincidente puede aceptar el enlace; una cuenta con otro correo y una sesión no verificada quedan fuera.
3. **Operación — carta y cuentas:** en `operator`, abre **Productos** desde el panel y comprueba que solo consulta la carta. Luego abre **Cuentas** → **Reconciliar**; puede revisar deducciones, fondos disponibles y conciliados y preparar una transferencia, pero no puede afirmar un neto sin evidencia.
4. **Rumbero — cobro alojado:** en `guest`, abre el menú **Mapa** → **bar-la-nona** → producto publicado → **Pedir** → checkout alojado ePayco. Repite tarjeta crédito, débito y PSE por separado cuando los métodos estén habilitados. Usa el botón de retorno del checkout para volver a la orden; una respuesta pendiente no entrega un QR pagado.
5. **Personal — entrega:** en `staff-a`, abre el menú de cuenta → **Escanear**, escanea o escribe el código y confirma una sola entrega. El reintento devuelve "ya confirmado" y no crea otra entrega.
6. **Rumbero — estado:** la página de orden confirma la **preparación** solo después del escaneo, y los estados por unidad no dependen del orden de escaneo.
7. **Barra — límite y vencimiento:** con límite aprobado cero no se emite reserva de barra. Con límite positivo, la reserva vence a los 15 minutos; una entrega redimida crea deuda con vencimiento a siete días. El límite de barra no bloquea un pago por app.
8. **Caducidad y devolución:** una unidad de app no reclamada a los 45 días conserva obligación de reembolso; no se asigna automáticamente al impacto. La aceptación de reembolso exige el precio bruto completo, no el neto después de deducciones.
9. **Transferencia y evidencia:** desde **Cuentas** → **Reconciliar**, el operador registra por separado el recibo de Música para la Paz (solo si está verificada) y una compra de material con factura. La segunda no prueba la primera; ningún total público suma ambas etapas.
10. **Aislamiento e integridad:** Dueño B no puede leer ni mutar recursos de A; un invitado no puede abrir un borrador; el personal no puede administrar equipo o carta. Se ejecuta `bun run prueba:libro`; el libro debe cuadrar y conservar `donación + sitio = neto`, y `neto + deducciones = bruto` después de la reconciliación.

Los pasos 1–6 prueban la experiencia; 7–9 prueban límites financieros y evidencia; 10 prueba aislamiento e integridad. Ninguno sustituye al otro.

## Capas de automatización

El circuito local ya tiene una suite reproducible. Los fixtures HTTP de ePayco, las transacciones
PostgreSQL y el recorrido crítico por navegador no usan credenciales reales. La aceptación con
cuenta ePayco real, R2 remoto y dinero real sigue bloqueada por las compuertas externas descritas
abajo.

| Capa | Objetivo | Herramienta actual |
|---|---|---|
| Dominio | reparto, asientos, caducidad, autorización, concurrencia y estados pendientes | `bun run test:commerce`: Bun + PostgreSQL efímero |
| Navegador | roles, aislamiento, checkout, pedido, escaneo y confirmación del rumbero | `bun run test:e2e`: Playwright sobre `next build` + `next start` |
| Exploración | fricción, copy, móvil, cámara y casos no previstos | Hermes Browser, con evidencias por hallazgo |
| Revisión independiente | implementación, permisos y regresiones de flujo | Codex CLI sobre un worktree limpio |

`e2e/flujo-principal.spec.ts` usa sesiones persistidas de operador, dueños y personal dentro de
contextos nuevos, más un contexto anónimo para el rumbero. No usa `sleep`, calentamiento ni el
compilador de desarrollo. Cada acción/expectativa vence a los 10 segundos, cada navegación a los
15, cada prueba a los 60 y el primer fallo conserva su trace. La orden de navegador se valida por
fronteras: pago e unidad emitida, redención visible en la API, respuesta de polling observada por el
navegador y, finalmente, `Confirmado` en pantalla.

## Reparto Hermes + Codex

- **Hermes** mantiene el contexto de producto, corre el servidor y Docker locales, orquesta contextos aislados, ejecuta las pruebas y conserva los hallazgos y decisiones en el archivo correcto.
- **Codex** toma tareas acotadas en un worktree, implementa o revisa cambios y devuelve comandos y resultados verificables. No decide producto ni actualiza documentación organizacional por su cuenta.
- Antes de editar código, ambos leen `PRODUCT.md`, la documentación de la organización relevante y el flujo afectado. Antes de cerrar un cambio, se ejecutan las pruebas de la capa que corresponda.

La sesión local actual no tiene el binario `codex` instalado. Para activar esa segunda arnés en esta máquina hace falta instalarlo y autenticarlo; hasta entonces Hermes puede mantener la estructura y las pruebas locales, pero no presentar una revisión de Codex como realizada.

## Compuertas externas antes de marcar aceptación completa

- Cuenta ePayco aprobada para Tumbenla, con tarjeta crédito, débito y PSE habilitados y
  límites confirmados.
- Fixtures de sandbox para cobro aprobado, pendiente, fallido, reintento y consulta
  servidor-a-servidor; ningún retorno del navegador cuenta como confirmación.
- Reporte real de deducciones y retenciones, procedimiento de reembolso y responsable de
  fondos operativos para costos no recuperables.
- Verificación escrita de Música para la Paz como beneficiario, incluyendo cuenta bancaria,
  facultades y acuerdo de trazabilidad. Hasta entonces solo es candidata.
- Credenciales separadas para sandbox/producción y R2 configurado para conservar evidencia.

Estos pendientes son gates de cuenta, legales u operativos; no se presentan como pruebas
locales realizadas.

## Qué no pertenece aquí

- Un cambio de alcance o una regla de producto va a `PRODUCT.md`.
- Un experimento de adquisición o retención va a `org/crecimiento/EXPERIMENTOS.md` y no empieza sin métrica en `org/datos/METRICAS.md`.
- Un hallazgo técnico persistente va a `PRODUCT.md`, con ruta y condición en que muerde.
- Este documento cambia cuando cambian las personas que prueban, el entorno local o el circuito de aceptación.
