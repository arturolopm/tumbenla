# Harness de validación local

Este documento describe cómo se prueba Tumbenla durante la transformación del producto. No es una decisión de adquisición ni un experimento: es infraestructura del taller. Las decisiones de alcance siguen en `PRODUCT.md`; los experimentos de crecimiento siguen en `org/crecimiento/EXPERIMENTOS.md`.

## El camino que se valida

La experiencia que se está simplificando tiene cuatro actores y un solo circuito:

1. **Operación de plataforma** crea o aprueba el sitio antes de que exista públicamente.
2. **Dueño del sitio** hace dos cosas de preparación: invita al personal y arma un producto con nombre, tipo, precio y un reparto de mínimo 40% para reconstruir. Cuando está listo, lo publica directamente.
3. **Personal del sitio** solo abre el escáner y entrega el producto contra un QR. No administra el equipo ni el reparto.
4. **Rumbero** ve un producto publicado, lo pide como invitado o con cuenta, muestra el QR y ve la confirmación de entrega.

La simplificación se evalúa contra esa secuencia. Una pantalla, campo o permiso que no ayude a uno de esos cuatro actos necesita una razón explícita para seguir existiendo.

## Límites de cada actor

| Actor | Puede | No puede |
|---|---|---|
| Plataforma | aprobar sitios, ver cuentas, liquidar | publicar un sitio sin verificación registrada |
| Dueño | invitar o quitar personal, crear, editar y publicar productos de mínimo 40% | publicar un producto por debajo de 40% |
| Personal | escanear y entregar | ver equipo, cambiar productos o entrar a otro sitio |
| Rumbero | pedir un producto público y presentar QR | ver borradores, productos pausados o datos del panel |

El porcentaje es la única entrada del reparto. La parte que se queda el sitio se calcula como el complemento; nunca se captura como un segundo número.

## Universo local reproducible

Todo el ensayo ocurre contra Docker local. Nunca se usan credenciales ni datos de preview o producción.

```bash
bun run db:reset
bun scripts/seed-tumbenla.ts
bun run seed:cuentas
ADMIN_EMAILS=operador@prueba.local bun dev
```

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

1. **Dueño:** abre la carta de su bar desde el menú de cuenta, crea un producto, confirma el reparto en pesos y lo publica. Prueba que 39% se rechaza y 40% se publica.
2. **Operación:** abre Productos desde el panel de plataforma y comprueba que puede consultar la carta, sin botones para aprobar o devolver productos.
3. **Rumbero:** ve únicamente el producto publicado en `/sitios/bar-la-nona`, crea el pedido y recibe un QR.
4. **Personal:** abre Escanear desde el panel de su bar, escanea o escribe el código y confirma una sola entrega.
5. **Rumbero:** la página de orden cambia a entregado.
6. **Aislamiento:** el personal no puede administrar equipo o carta; Dueño B no puede leer ni mutar recursos de A; un invitado no puede abrir un borrador.
7. **Integridad:** se ejecuta `bun run prueba:libro`; el libro debe cuadrar y el reparto debe conservar `material + sitio = precio`.

Los pasos 1–5 prueban la experiencia; el paso 6 prueba sus límites. Ninguno sustituye al otro.

## Capas de automatización

La base ya contiene scripts de dominio (`prueba:libro`, `prueba:alta`) y cuentas locales. Falta convertir el recorrido de arriba en una suite reproducible.

| Capa | Objetivo | Herramienta propuesta |
|---|---|---|
| Dominio | reparto, asientos, caducidad, autorización de acciones | scripts Bun existentes y scripts de integración pequeños |
| Navegador | roles, redirecciones, publicación directa, pedido y escaneo | Playwright con contextos por rol |
| Exploración | fricción, copy, móvil, cámara y casos no previstos | Hermes Browser, con evidencias por hallazgo |
| Revisión independiente | implementación, permisos y regresiones de flujo | Codex CLI sobre un worktree limpio |

Cuando se agregue Playwright, el primer entregable debe ser `e2e/flujo-principal.spec.ts`, con los cinco contextos anteriores y una única orden. No se automatiza primero el mapa ni las fotos: se automatiza el circuito que mueve dinero y entrega.

## Reparto Hermes + Codex

- **Hermes** mantiene el contexto de producto, corre el servidor y Docker locales, orquesta contextos aislados, ejecuta las pruebas y conserva los hallazgos y decisiones en el archivo correcto.
- **Codex** toma tareas acotadas en un worktree, implementa o revisa cambios y devuelve comandos y resultados verificables. No decide producto ni actualiza documentación organizacional por su cuenta.
- Antes de editar código, ambos leen `PRODUCT.md`, la documentación de la organización relevante y el flujo afectado. Antes de cerrar un cambio, se ejecutan las pruebas de la capa que corresponda.

La sesión local actual no tiene el binario `codex` instalado. Para activar esa segunda arnés en esta máquina hace falta instalarlo y autenticarlo; hasta entonces Hermes puede mantener la estructura y las pruebas locales, pero no presentar una revisión de Codex como realizada.

## Qué no pertenece aquí

- Un cambio de alcance o una regla de producto va a `PRODUCT.md`.
- Un experimento de adquisición o retención va a `org/crecimiento/EXPERIMENTOS.md` y no empieza sin métrica en `org/datos/METRICAS.md`.
- Un hallazgo técnico persistente va a `PRODUCT.md`, con ruta y condición en que muerde.
- Este documento cambia cuando cambian las personas que prueban, el entorno local o el circuito de aceptación.
