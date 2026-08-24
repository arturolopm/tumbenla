# Tumbenla — producto

Directorio de bares y discotecas que ponen una parte de sus ventas en material
de construccion. La gente sale como sale siempre; el sitio pone su parte;
nosotros compramos el material y publicamos la factura.

**La plata no pasa por la app.** No cobramos, no procesamos pagos, no guardamos
tarjetas. Lo unico que tenemos es la confianza, y por eso casi todas las
decisiones de abajo se resuelven a favor de no afirmar mas de lo que sabemos.

Prueba de concepto: **Manizales**. Mas ciudades despues.

> Este archivo es el mapa vivo del producto. El plan de construccion original
> esta en `~/.claude/plans/partitioned-crunching-hartmanis.md` y ya quedo
> parcialmente desactualizado; cuando los dos se contradigan, manda este.

---

## Estado

| Area | Estado |
|---|---|
| Sitio publico (inicio, mapa, transparencia, causa) | Construido |
| Sistema de diseno Stitch "Calor de Barrio" | Construido |
| Mapa MapLibre con pines, tooltip y leyenda | Construido |
| Panel de admin: sitios, estados, selector de pin, geocoding | Construido |
| `/quiero-poner` con correo pre-redactado | Construido |
| Seccion "Le entro" con las dos entradas | Construido |
| `/mi-historia`: resumen, estimado, galeria | Construido (solo lectura) |
| Esquema de fiestas: `party_night`, `party_photo`, `photo_claim` | Construido |
| Reclamar fotos (galeria de la noche, subida por operador) | **Falta** |
| Gate de ciudad (Manizales si, resto no) | **A medias** |
| Autenticacion | Del boilerplate, sin revisar a fondo |

---

## Decisiones tomadas (no reabrir sin razon nueva)

Estan aca para no volver a discutirlas cada dos semanas.

1. **Solo directorio.** La plata no pasa por la app.
2. **Los recibos son publicos.** Iniciar sesion AGREGA una capa personal; nunca
   restringe. Cerrar `/transparencia` detras del login le quitaria el argumento
   justo a quien todavia no confia lo suficiente como para crear una cuenta.
3. **El verso de la cancion no va en el sitio.** El nombre si, el guino si, el
   verso no. Exposicion de licenciamiento real. El titular es
   "Tumbenla y volvamosla a parar", que es propio.
4. **Manda el esquema, Stitch es la piel.** Se adopta color, tipografia, radios,
   texturas y anatomia de componentes. No se adopta el producto que dibujan las
   pantallas (eventos, ollas comunitarias, fondos para artistas).
5. **Ninguna cifra inventada.** Todo numero en pantalla sale de la base o no se
   renderiza. Lo no verificado dice "por confirmar".
6. **Oscuro fijo, sin `next-themes`.** Para un producto dark-only es un provider,
   un script bloqueante y una clase entera de bugs de hidratacion a cambio de
   nada.
7. **Espanol, sin capa de i18n.** El copy va escrito directo en el componente.
8. **Geolocalizacion por IP, nunca `navigator.geolocation`.** La API del
   navegador dispara un permiso del sistema antes de haber mostrado nada.
9. **Una visita se registra reclamando una foto de esa noche.** Un boton
   "estuve aqui" se infla con clics y vuelve el estimado un adorno.
10. **El estimado por noche lo declara cada sitio.** No un promedio inventado
    por nosotros. Y se rotula "estimado" en todas partes.
11. **MapLibre sin `react-map-gl`**, con marcadores DOM y no capa GeoJSON: se
    estilan con Tailwind, reciben foco y son botones de verdad.
12. **La camara no se mueve si el pin ya se ve.** Recentrar en cada seleccion
    hacia que el pin se escapara del cursor justo despues de tocarlo. Solo se
    mueve cuando la seleccion viene de la lista y el pin esta fuera de cuadro.
13. **El origen del clic viaja en la URL.** Un pin lleva a
    `/sitios/[slug]?desde=mapa` y el enlace de volver devuelve al mapa; desde la
    lista vuelve a la lista. Va en la URL y no en estado porque la pagina del
    sitio es estatica y compartible.
14. **El pin es un `<a>` de verdad, pero en tactil no navega el pin: navega la
    tarjeta.** El pin mide 16px; que un toque salte de una es apostar a que la
    persona le acerto entre varios que se solapan. Toque corto abre la tarjeta,
    toque en la tarjeta va al sitio, toque en el mapa cierra, y mantener
    presionado es un vistazo que dura lo que dura la presion. En escritorio el
    hover muestra la tarjeta y el pin entero es el enlace.
15. **`/eventos` no se construye.** No hay tabla de eventos y no se va a inventar
    una para que calce con una maqueta.

---

## Roadmap

### Ahora

- [ ] **Gate de ciudad.** `src/config/ciudades.ts` y la cookie de `proxy.ts` ya
      existen; falta el componente que decide que mostrar en `/sitios`.
      Manizales o sin detectar → el explorador. Otra ciudad conocida → "aun no
      estamos en X" + ciudades en camino + CTA a la activa mas cercana.
      **Tiene que fallar hacia el lado bueno:** si la deteccion falla, se muestra
      el contenido, nunca un muro.
- [ ] **Override `?ciudad=`.** Es a la vez el cambio manual y la unica forma de
      probar las ramas en local: las cabeceras `x-vercel-ip-*` no existen fuera
      de Vercel.
- [ ] **"Arrancamos en Manizales"** cerca del CTA del inicio, para que el panel
      de "aun no estamos aqui" no sea una sorpresa despues del clic.

### Siguiente

- [ ] **Reclamar fotos, punta a punta.** Es lo que hace que `/mi-historia` deje
      de estar vacia:
      - Subida de noches y fotos en el admin (R2 ya esta en `src/lib/storage.ts`)
      - Galeria de la noche en la pagina del sitio
      - Boton "esa soy yo" → `claimPhotoAction`
- [ ] **`estimatedPerPersonNight` en el formulario del admin.** La columna existe
      y nada la escribe todavia, asi que hoy el estimado de todo el mundo da cero.
- [ ] **Compras en el admin.** `material_purchase` solo se llena por seed.

### Despues

- [ ] Estimado real por recibos de mesa, en vez de promedio por noche.
- [ ] Perfil publico opcional (las fotos con `showPublicly = true`).
- [ ] Segunda ciudad. Ver "el filtro de ciudad es de cliente" mas abajo: ese es
      el trabajo que se destapa al abrirla.

### Algun dia

- [ ] Verificacion automatica de cuanto entrego cada sitio. Hoy se verifica el
      compromiso, no cada peso, y el sitio lo dice explicitamente.
- [ ] Extracto `.pmtiles` de Colombia en R2 si los terminos de CARTO incomodan.

---

## Deuda y hallazgos

Cosas que note construyendo, con donde estan y cuando muerden.

### Se rompe al crecer

- **El filtro de ciudad es de cliente.** `SitiosExplorer` recibe TODOS los sitios
  publicados y filtra en memoria. Con una ciudad es lo correcto y ademas
  conserva el ISR. Con tres o cuatro, cada visitante se descarga los sitios de
  todas. El arreglo es mover el filtro a la consulta, y ahi se pierde el ISR de
  `/sitios` tal como esta hoy.
- **Marcadores DOM.** Correcto con decenas de sitios. Pasadas las centenas toca
  capa con clustering y consulta acotada por viewport contra `venue_lat_lng_idx`,
  no seguir apilando nodos.

### Sin verificar

- **`revalidatePath` nunca se probo contra un deploy real.** Es el primero del
  repo (`src/app/actions/venues.ts`). Si falla, el respaldo es el
  `revalidate = 300` que ya tienen las paginas. Verificar temprano.
- **El flujo de auth es del boilerplate.** Login, registro y verificacion nunca
  se revisaron con este producto en mente. `/mi-historia` ya depende de ellos.
- **`migrate.ts` ya no se traga los fallos.** Salia con codigo 0 aunque la
  migracion reventara, lo que con migraciones en el build habria dejado pasar un
  deploy con la base sin migrar. Verificado en ambos sentidos: falla -> 1,
  exito -> 0. Si alguien toca ese script, esa es la prueba que hay que repetir.
- **No hay framework de pruebas.** Todo lo que se ha verificado fue a mano o con
  Playwright contra `localhost`.

### Trampas que ya mordieron (para no repetirlas)

- **`??` no atrapa la cadena vacia; para variables de entorno se usa `||`.**
  `DIRECT_DATABASE_URL ?? DATABASE_URL` se rompia cuando la primera estaba
  DEFINIDA pero VACIA: `??` solo mira null y undefined, asi que devolvia `''` y
  el migrador moria diciendo que faltaban las dos, con `DATABASE_URL` puesta.
  No es rebuscado: es lo que deja `cp .env.example .env` y lo que deja un campo
  en blanco en el panel de Vercel. Estaba en `scripts/migrate.ts` y en
  `drizzle.config.ts`.

- **Vercel arma la lista de variables del proyecto leyendo las claves NO
  comentadas de `.env.example`.** Por eso ese archivo no es solo documentacion:
  lo que este descomentado ahi es lo que aparece al importar el repo. Las
  variables inertes van comentadas (si no, alguien las llena y cree que hacen
  algo) y las que el despliegue necesita van declaradas aunque en local vayan
  vacias, como `DIRECT_DATABASE_URL`.

- **Las utilidades propias de CSS no deben declarar `position`.**
  `.texture-grain` declaraba `position: relative` y le gano al `fixed` de la
  barra: la barra se iba con el scroll y dejaba 80px muertos. Misma familia:
  `.halftone-overlay` aplicaba `opacity` sobre el elemento y desaparecia su
  propio contenido. Las dos viven en `@layer utilities` y ahora usan
  pseudo-elementos.
- **MapLibre le pone `position: relative` a su contenedor.** Cualquier
  `absolute inset-0` que se le ponga a ese nodo se cae y el div colapsa. El
  contenedor tiene que llevar altura explicita (`h-full`).
- **Dos utilidades que pisan la misma propiedad las decide el orden de la HOJA,
  no el orden en el atributo `class`.** Agregar `pointer-events-auto` a un
  elemento que ya tiene `pointer-events-none` no hace nada si la hoja emite
  `none` de ultimo. Medido en el CSS compilado: `auto` en la posicion 104327,
  `none` en la 104368. La tarjeta del pin quedaba transparente al toque y los
  taps se colaban al mapa. Para estados que se alternan desde JS, usar estilo en
  linea (`el.style.x = ...`), que le gana a cualquier clase; volver a `''`
  devuelve el control al CSS.
- **Nunca poner clases de `transform`/`scale` en el nodo que MapLibre posiciona.**
  MapLibre escribe `transform: translate(...)` en linea sobre el elemento del
  marcador. Las utilidades de escala de Tailwind usan la propiedad CSS `scale`,
  que el navegador aplica ANTES que `transform`, asi que multiplican ese
  translate: con `scale-150` un `translate(688px)` pasa a valer 1032px y el pin
  se va del mapa. Se veia como "los puntos se mueven solos al tocarlos". El
  patron correcto es el que quedo: el `<a>` solo posiciona, y el punto visible
  es un hijo que si puede escalar.
- **Los tiles `@2x` de CARTO son de 256 unidades, no de 512.** Declarar
  `tileSize: 512` corre el mapa un nivel de zoom entero.
- **`postgres()` sin opciones no suelta conexiones.** No trae `idle_timeout`.
  Con 7 workers de build mas el HMR de dev se llegaron a 82 conexiones ociosas
  contra un `max_connections` de 100, y el build se caia con
  `53300: sorry, too many clients already`. Arreglado en `src/database/index.ts`
  con `max`, `idle_timeout` y un singleton por `globalThis` en dev. **El mismo
  fallo agota la base en produccion serverless.**

### Restos del boilerplate

- **`src/app/(main)/dashboard/`** es del boilerplate y no es parte del producto.
  Ahora que existe `/mi-historia`, decidir si se borra o se reusa.
- **Tablas de pagos** (`customer`, `subscription`, `payment`) no las toca ninguna
  consulta de Tumbenla. Se quedan por si algun dia hay cobro, pero hoy son ruido
  en el esquema.
- **`showToast` en `src/lib/utils/toast.ts` es un stub que solo hace
  `console.log`.** Nadie debe usarlo: el real es `toastManager` de
  `src/components/ui/toast.tsx`. Borrar el stub antes de que alguien se lo crea.
- **Sentry esta muerto y las variables de entorno no lo reviven.** El DSN esta
  CODIFICADO A MANO como `'use_your_own_bro'` en los tres archivos de arranque
  (`sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation-client.ts`),
  y `NEXT_PUBLIC_SENTRY_DSN` no se lee en ninguna parte. Ponerla en Vercel no
  activa nada. `SENTRY_ORG` / `SENTRY_PROJECT` tambien estan vacias, asi que
  `withSentryConfig` ni intenta subir sourcemaps y `SENTRY_AUTH_TOKEN` sobra.
  Cuando se conecte de verdad, revisar antes dos ajustes heredados que hoy no
  hacen dano solo porque nada se envia: `sendDefaultPii: true` manda datos
  personales, y `tracesSampleRate: 1` muestrea el 100% del trafico.
- **No hay hosts remotos en `next.config.ts`**, por eso todas las imagenes usan
  `<img>` plano en vez de `next/image`. Cuando R2 sirva imagenes de verdad, hay
  que configurarlo y migrar.

### Dos sistemas de diseno en Stitch

El proyecto de Stitch tiene un `designTheme` (tricolor colombiano, oro sobre
navy, Montserrat/Inter) y las pantallas "Calor de Barrio" (naranja/ambar/lima,
Anybody/Montserrat). **No coinciden.** El codigo sigue las pantallas. Si algo se
regenera en Stitch desde el `designTheme`, va a salir con la paleta equivocada.

### Regla de contraste

Medido contra el fondo `#0d1321`. **Texto blanco sobre el naranja `#f56218` da
3.00:1 y no pasa AA.** El boton primario va con texto oscuro. Lo mismo con
`#ff544f`. Para texto naranja existe `--primary-text` `#ffb598` (10.9:1), que no
es el mismo naranja del relleno.

---

## Despliegue

**Local es Docker. Preview y produccion son Neon.** El cliente de
`src/database/index.ts` se adapta solo: detecta `-pooler` en el host y ahi cambia
`max` y `prepare`. En local eso da false y nada cambia.

### Las dos URLs de Neon no son intercambiables

| Variable | Host | Para que |
|---|---|---|
| `DATABASE_URL` | **con** `-pooler` | La app |
| `DIRECT_DATABASE_URL` | **sin** `-pooler` | Migraciones y drizzle-kit |

El pooler es PgBouncer en modo transaccion. La app tiene que ir por ahi o agota
las conexiones con varias lambdas; las migraciones NO pueden, porque son DDL en
transaccion. `DIRECT_DATABASE_URL` cae de vuelta a `DATABASE_URL` si no esta, asi
que en local no hay que definirla.

**La URL directa no esta en `src/config/env.ts` a proposito.** Ese archivo valida
el entorno de la app al importarse, y la app nunca la necesita; ponerla ahi haria
que produccion fallara al arrancar por una variable que solo existe en el build.

### Migraciones

Corren en el build de Vercel: `vercel.json` trae
`buildCommand: "bun run migrate && bun run build"`.

**Toda migracion tiene que ser aditiva.** El esquema nuevo esta vivo unos
segundos antes que el codigo nuevo, asi que renombrar o borrar una columna rompe
la version que todavia esta sirviendo. Columnas nullable al agregar; quitar, en
un deploy aparte.

### El presupuesto manda: 100 CU-horas

Plan Free: 0.5 GB por proyecto, **100 CU-horas por proyecto al mes**, 10 ramas,
y el computo **escala a cero a los 5 minutos** de inactividad (no se puede
desactivar). 100 CU-horas a 0.25 CU son ~400 horas, y un mes tiene 730: **el
computo tiene que dormir casi la mitad del tiempo**. No es una optimizacion, es
el presupuesto.

De ahi que casi todo el sitio sea estatico o ISR: sin trafico no hay consultas,
sin consultas la base se duerme. Las rutas que si pegan a la base en cada
peticion son `/admin/*`, `/mi-historia` y `/api/geocode`, todas de bajo volumen
por diseno.

**Pendiente con orden obligatorio:** `revalidate = 300` son exactamente los 5
minutos del autosuspend, asi que una visita cada cinco minutos mantiene la base
despierta para siempre. Subirlo a 30 minutos divide los despertares por seis.
Pero primero hay que **verificar `revalidatePath` contra un deploy real**: si no
funciona, subir el revalidate cambia una ventana de datos viejos de 5 minutos por
una de 30.

Previews: **una sola rama "preview" compartida**, no una por deployment. El tope
de 10 ramas del plan Free se llena rapido y todas comparten las mismas
CU-horas.

### Que variable va en cada ambiente

La URL publica NO se configura: `getBaseUrl()` la deduce de las variables de
sistema de Vercel. En produccion usa `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL`,
que Vercel define como el dominio propio mas corto o el de vercel.app si no hay
ninguno, asi que **agregar el dominio propio no pide tocar codigo ni variables**:
basta redesplegar. En preview usa la URL de la RAMA, que sobrevive al siguiente
push. `NEXT_PUBLIC_APP_URL` sigue existiendo como anulacion explicita y gana.

Dos cosas que hay que tener presentes:

- **`NEXT_PUBLIC_*` se incrusta en el bundle durante el BUILD.** Cambiar
  cualquiera de estas en el panel no surte efecto hasta el siguiente despliegue.
  Vale tambien para el dominio propio.
- Depende de **"Enable access to System Environment Variables"**, activo por
  defecto. Si se apaga, el build falla diciendolo, que es lo que se quiere: la
  version vieja tenia un `.default()` de localhost y devolvia
  `http://localhost:3000` en silencio, dejando el despliegue verde con todos los
  enlaces de correo y los callbacks de sesion rotos.

`.env.vercel.example` (versionado, sin secretos) es la lista con el ambito de
cada una. **El `.env` local no se pega en Vercel**: apunta al Postgres de Docker
y al Mailpit local, y trae variables que alli no hacen nada.

Lo que muerde:

- **`BETTER_AUTH_SECRET` distinto por ambito, nunca el del repositorio.** Los
  valores de ejemplo pasan todas las comprobaciones de Better-Auth (miden mas de
  32 caracteres, asi que no son *su* secreto por defecto y no lanza), pero estan
  publicados aca: con uno de ellos cualquiera puede firmar una sesion, y una
  sesion falsificada con un correo de `ADMIN_EMAILS` abre `/admin`. Por eso
  `src/config/env.ts` los rechaza lanzando en produccion, no avisando.
- **`ADMIN_EMAILS` falla cerrado.** Sin ella nadie entra al panel, tu tampoco.
- **`EMAIL_VERIFICATION_ENABLED=true` es obligatoria donde haya `ADMIN_EMAILS`.**
  El admin se decide por el correo de la sesion.
- **Sin `RESEND_API_KEY` el mailer cae al proveedor `log`**: los correos se
  escriben en los logs y no se envian. El despliegue se ve sano y nadie recibe
  su verificacion.
- **Nada de `SMTP_*` ni `EMAIL_PROVIDER`**: apuntan al Mailpit local.

---

### Nada de base de datos en el borde

`proxy.ts` corre en el Edge runtime y postgres-js no funciona ahi. Hoy solo lee
cabeceras y escribe una cookie. No caer en la tentacion de buscar la ciudad en la
base desde ahi.

---

## Riesgos abiertos

1. **Legal: afirmar "este bar pone X".** El sitio publica un compromiso de un
   tercero. Hoy se verifica hablando con el sitio y se deja escrito como se
   confirmo, pero no hay contrato de por medio ni verificacion de cada peso, y el
   sitio lo dice de frente en "Nuestra Causa".
2. **Privacidad de los beneficiarios.** La evidencia de compras naturalmente
   incluye fotos de gente que acaba de perder su casa. `consentGiven` tiene que
   estar en `true` antes de publicar, ubicacion a nivel de municipio, nunca la
   direccion.
3. **Privacidad de los rumberos.** Las fotos de fiesta son de gente
   identificable. Dos puertas independientes: el operador habilita
   (`status = 'available'`, que solo significa "reclamable"), y cada persona
   decide foto por foto si sale del ambito de su cuenta
   (`photoClaim.showPublicly`, que arranca en `false`). **No debe existir nunca
   un boton de "hacer publicas todas".**
4. **Los datos del sismo no estan verificados.** `src/config/contexto-sismo.ts`
   tiene `verificado: false` y `datoVerificado()` devuelve `null` a proposito.
   No publicar magnitud ni damnificados sin fuente oficial (SGC o UNGRD).
5. **Terminos del proveedor de tiles.** Los basemaps gratuitos de CARTO apuntan a
   uso de bajo volumen. La salida esta descrita arriba.
6. **El estimado de aporte puede leerse como un recibo.** Hoy el copy lo aclara y
   avisa cuando esta incompleto. Cualquier rediseno de `/mi-historia` tiene que
   conservar eso; es la diferencia entre un estimado y una mentira.

---

## Como mantener este archivo

- Una decision que ya se tomo va a "Decisiones tomadas", con el porque en una
  linea. Ese porque es lo que evita rediscutirla.
- Un hallazgo va a "Deuda y hallazgos" con la ruta del archivo y **cuando**
  muerde, no solo que existe.
- Cuando algo del roadmap se construya, se mueve a "Estado" y se borra de la
  lista. Un roadmap que solo crece deja de leerse.
