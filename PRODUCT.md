# Tumbenla — producto

Directorio de bares y discotecas que ponen una parte de sus ventas en material
de construccion. La gente sale como sale siempre; el sitio pone su parte y nos
manda el recibo; nosotros lo verificamos, compramos el material y publicamos la
factura. Son dos eslabones, no uno, y los dos se ven: lo que el sitio dice que
entrego (verificado por nosotros) y en que lo gastamos.

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
| `/mi-historia`: resumen, estimado, galeria | Construido |
| Esquema de fiestas: `party_night`, `party_photo`, `photo_claim` | Construido |
| Reclamar fotos, punta a punta | Construido |
| Entrar y salir, y volver a donde estabas | Construido |
| Roles de sitio: `venue_member`, `venue_invitation`, panel `/panel` | Construido |
| Alta de sitio: solicitud corta verificada por DM | Construido |
| Menu de cuenta (cambiar de sombrero) en las tres barras | Construido |
| Aportes del sitio: reporte, recibo y verificacion | Construido |
| Subida real a R2 (cuenta, buckets, CORS) | **Falta la infra, el codigo esta** |
| Gate de ciudad (Manizales si, resto no) | **A medias** |

---

## Los tres actores

| Actor | Como se decide | Donde vive | Que puede |
|---|---|---|---|
| **Plataforma** (nosotros) | `ADMIN_EMAILS`, variable de entorno | `/admin` | verificar sitios y aportes, moderar cualquier foto de la red, comprar material |
| **Sitio** (dueno + personal) | `venue_member`, fila en la base | `/panel/[slug]` | noches y fotos, aprobar lo que sube la gente, reportar lo que entrego. Solo el dueno maneja el equipo |
| **Rumbero** | cualquier sesion | publico + `/mi-historia` | reclamar sus fotos, subir las suyas, reportar una en la que sale |

Nadie publica su propio sitio y nadie verifica su propio aporte. Esas dos son de
la plataforma y son lo unico que respalda lo que el mapa afirma.

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
16. **La voz no reparte a la gente entre quien ayuda y quien es ayudado.** Nada
    de "solidario", "apoya la causa", "ayudamos" ni "damnificados" en el copy.
    El mapa es "Mapa del parche", no "Mapa Solidario"; el CTA de la portada es
    "Como me uno", no "Quiero poner" (ese verbo se queda donde de verdad
    aplica: hablandole al dueno del bar, que es quien pone). El sitio le habla
    a un combo que sale de rumba, no a un donante que socorre a una victima.
17. **El poder de plataforma vive en el ENTORNO; el de sitio, en la BASE.**
    `ADMIN_EMAILS` se queda igual para nosotros: es el rol mas privilegiado,
    falla cerrado, y nadie escala hasta el escribiendo una fila. El poder de
    sitio lo reparten otros usuarios en caliente y por sitio, asi que es un par
    (persona, sitio) y eso no cabe en una columna de `user`.
18. **Tablas propias, no el plugin `organization` de better-auth.** Un bar no
    tiene facturacion, ni sub-equipos, ni cambio de contexto. `auth.ts:200` ya
    explicaba por que se habia quitado; se queda quitado. El costo aceptado fue
    escribir nosotros el flujo de invitacion.
19. **El sitio reporta, nosotros verificamos, nosotros compramos.** Un aporte
    `submitted` no existe para el publico. Publicar una cifra que nos dieron sin
    comprobarla seria afirmar bajo nuestro nombre algo que no comprobamos.
20. **Una solicitud de alta NO crea el sitio.** *(Reemplaza a la version
    anterior de esta decision, que daba la propiedad en el acto al registrar.)*
    El formulario ya no pide ni el compromiso ni las coordenadas, y
    `venue.pledge_type`, `latitude` y `longitude` son `NOT NULL`: no hay fila
    que insertar. El sitio nace cuando un operador aprueba y completa lo que
    falta. De paso tapa un hueco real: con propiedad inmediata, cualquiera
    apartaba el nombre de un bar ajeno y el buscador le decia al dueno de
    verdad "ya tiene dueno".
20b. **El DM verifica la CUENTA; el correo citado verifica a la PERSONA.**
    Que el mensaje llegue desde el Instagram del bar prueba que quien escribe
    controla esa cuenta, no que sea quien lleno el formulario. Por eso el DM
    tiene que citar el `contactEmail` de la solicitud. Hacen falta las dos, o no
    se aprueba: sin la segunda, quien maneja las redes de un bar podria quedarse
    con el sitio de otro.
20c. **El formulario largo de un sitio no se le muestra a nadie de la calle.**
    Estuvo colgado en `/registrar-sitio/nuevo` y era la peor pantalla del
    producto. Ademas su buscador de direcciones llama a `/api/geocode`, que
    exige ser operador y le respondia 404. Vive solo en los dos paneles.
21. **Una foto que sube un rumbero solo es reclamable cuando el sitio la
    aprueba.** Es lo que impide subir fotos de un bar donde uno nunca estuvo y
    reclamarlas para inflarse las noches. El portero es el sitio.
22. **El estimado se queda simple: una sola accion, "Esa soy yo".** No hay un
    "me gusta" que tambien sume. Un guardar-porque-me-gusta que contara como
    visita volveria el aporte estimado inflable a punta de clics. Aplazado junto
    con la verificacion por recibos de mesa, que ya esta en "Despues".
23. **La sesion se lee en el CLIENTE en la barra, nunca en
    `(publico)/layout.tsx`.** Ese layout cubre la portada, `/sitios` y
    `/transparencia`; leer la sesion alli en el servidor las vuelve dinamicas y
    se lleva por delante el ISR del que depende que la base duerma. El precio es
    un parpadeo, y se paga con `isPending` y un hueco del ancho del control.
24. **Subida firmada DIRECTA a R2, no por la app.** Una noche son decenas de
    fotos: pasarlas por una funcion las serializa, cobra computo por cada byte y
    roza el limite de duracion. Exige una politica de CORS en el bucket.
25. **La copia va con tildes; el codigo, sin ellas.** Todo texto que un usuario
    lee lleva su acento y su enye. Los comentarios, los nombres de variable y
    los valores de enum guardados en la base (`coctel`, `terminos`) se quedan en
    ASCII, y cuando un enum se muestra se traduce con un mapa de etiquetas
    (`UNIT_LABEL` en `src/components/sitios/pledge-badge.tsx`). Asi un acento
    nunca llega a una URL, a una consulta ni a una migracion.

---

## Que se pide para dar de alta un sitio

**Obligatorio.** Es el minimo para poder verificar y despues publicar.

| Campo | Por que es el minimo |
|---|---|
| Nombre del sitio | Es lo que buscamos en Instagram para confirmar que existe |
| Tipo | Un toque, y sin el no se puede pintar la tarjeta del mapa |
| Ciudad | Solo estamos en Manizales; es la primera pregunta que hay que resolver |
| Direccion (texto) | Distingue un bar real de un nombre, y de ahi sale el pin despues |
| **Instagram del sitio** | **Es el instrumento de verificacion.** Sin cuenta oficial no hay DM que comprobar |
| **Correo de contacto** | Por donde le respondemos, y lo que el DM tiene que citar. Se rellena con el correo de la cuenta |

Quien queda de dueno sale de la SESION, no del correo escrito: hay que entrar
antes de aplicar. El correo de contacto es el del SITIO y tiene su propia razon
de ser obligatorio (ver decision 20b), que no es la de identificar al dueno.

**Opcional:** TikTok, WhatsApp, telefono, barrio, sitio web, horario,
descripcion, y "que tienes en mente para poner" —texto libre, rotulado como
idea y que no toca ninguna columna `pledge_*`.

**No se pide, lo llena un operador al aprobar:** coordenadas, el compromiso,
`estimatedPerPersonNight`, `verifiedNote`, portada y logo.

### Casos de borde

| Caso | Que hace el MVP |
|---|---|
| No tiene Instagram del bar | No puede mandar la solicitud. La pantalla lo dice y deja el correo para escribirnos: sin cuenta oficial no hay verificacion posible |
| Solo tiene TikTok | TikTok es opcional y no reemplaza a Instagram en el formulario, pero el operador **si** puede aprobar contra un DM de TikTok y dejarlo en `reviewNote` |
| El DM lo manda alguien distinto de quien aplico | Por eso el DM cita el correo de la solicitud. Si no coincide, no se aprueba |
| Dos personas piden el mismo bar | Indice unico PARCIAL sobre `lower(instagram)` con `status in ('pending','verifying')`: una sola solicitud viva a la vez, y aun asi se puede volver a aplicar tras un rechazo |
| El bar ya esta en el directorio | El buscador lo encuentra y la solicitud llega con `venueId`; aprobar solo asigna dueno |
| El sitio ya tiene dueno | El buscador lo marca y no ofrece pedirlo |
| El DM nunca llega | Se queda en `verifying`. Sin caducidad: la cola es corta y una solicitud vieja es alguien esperando |
| Se equivoco en los datos | Vuelve a mandar el formulario y se actualiza mientras siga viva |
| La ciudad no es Manizales | Se acepta y se guarda; es la lista de espera para abrir ciudad |
| Lo aprobamos y nunca vuelve | El sitio queda con dueno ausente. La plataforma **si** puede quitar al ultimo dueno para reasignarlo; un dueno no |

### Lo que se sacrifica por simplicidad

| Hoy | Cuando duele | Hacia donde va |
|---|---|---|
| Verificacion manual por DM | Pasadas ~10 solicitudes por semana, o al abrir la segunda ciudad | Login de Instagram/Meta Business, o un codigo pegado en la bio |
| La identidad se amarra con el correo citado en el DM | Cuando un sitio tenga varias personas manejando redes | Verificacion de dominio del correo, o registro mercantil (NIT) |
| Un solo dueno al aprobar | Cuando haya dos socios de igual a igual | Ya resuelto: el dueno puede nombrar mas duenos en su panel |
| El operador escribe pin y compromiso a mano | Con muchos sitios por semana | Que el sitio proponga y el operador solo apruebe |
| Sin caducidad de solicitudes | Cuando la cola no quepa en una pantalla | Caducar `verifying` a los 30 dias con aviso |
| Sin auditoria mas alla de `reviewedBy` | Con mas operadores | Bitacora aparte |

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

- [ ] **Conectar R2 de verdad.** El codigo esta y las claves ya salen sin
      comentar en `.env.example`; falta la cuenta de Cloudflare, los buckets, las
      llaves, y la **politica de CORS del bucket publico** que permita `PUT`
      desde produccion, preview y `http://localhost:3000`. Sin CORS la subida
      falla en el navegador con un error que no menciona CORS por ninguna parte.
      Hasta entonces, firmar una subida responde "El almacenamiento de fotos no
      esta configurado" y el resto del sitio sigue funcionando.
- [ ] **Compras en el admin.** `material_purchase` solo se llena por seed, y
      ahora ademas es el destino al que un operador amarra un aporte verificado.
- [ ] **Avisarle al sitio cuando algo lo espera.** Hoy nada le avisa a un dueno
      que tiene fotos por revisar o un reporte de privacidad abierto: hay que
      entrar al panel a mirar.
- [ ] **Avisarle al operador cuando llega una solicitud.** Hoy el conteo sale en
      la barra de `/admin`, pero hay que entrar a verlo: no llega ningun correo.

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
- **El flujo de auth ya se reviso**, se paso a espanol y al sistema de diseno, y
  se le arreglaron el redirector abierto, los enlaces a `/terms` y `/privacy`
  (que no existen aca), el `pages.error: '/error'` inexistente y la politica de
  contrasena, que era mas estricta al recuperarla que al registrarse. Lo que
  sigue **sin verificar contra un despliegue real** es el correo: en local sale
  por Mailpit, y en produccion Resend solo entrega a la direccion de la cuenta
  hasta que haya un dominio verificado. **La invitacion al equipo depende de que
  ese correo llegue**, asi que es lo primero que hay que probar en preview.
- **`migrate.ts` ya no se traga los fallos.** Salia con codigo 0 aunque la
  migracion reventara, lo que con migraciones en el build habria dejado pasar un
  deploy con la base sin migrar. Verificado en ambos sentidos: falla -> 1,
  exito -> 0. Si alguien toca ese script, esa es la prueba que hay que repetir.
- **No hay framework de pruebas.** Todo lo que se ha verificado fue a mano o con
  Playwright contra `localhost`. Los cinco PRs de la multi-tenencia se probaron
  con tres cuentas y curl contra el servidor local, apuntando sobre todo a lo que
  NO debe poder hacerse; nada de eso quedo automatizado, asi que **una regresion
  de permisos hoy no la detecta nada**. Es el mejor candidato para las primeras
  pruebas que se escriban.

- **El viaje real a R2 nunca se ejecuto.** Firmar, subir, registrar y borrar
  estan escritos y todo lo que los rodea esta probado, pero sin cuenta ni buckets
  el ultimo paso responde "El almacenamiento de fotos no esta configurado". La
  primera subida de verdad es tambien la primera prueba de la politica de CORS.

### La trampa que va a morder (multi-tenencia)

**Toda server action tiene que sacar el `venueId` de la FILA que va a mutar,
leyendola de la base, y comprobar la membresia contra ESE id. Nunca contra un id
que venga del formulario.**

Una accion que recibe `venueId` en el `FormData` y lo comprueba tal cual esta
dejando que quien manda el formulario elija contra que se lo comparan: el
personal del sitio A edita el sitio B cambiando un input oculto en las
herramientas del navegador. Para tocar una noche, una foto o un aporte hay que
leer primero esa fila, sacarle su `venueId`, y comprobar ese.

**Cuando muerde:** al escribir la proxima accion del panel, no antes. No lo
atrapa ningun tipo de TypeScript, no lo atrapa `bun lint`, y la accion funciona
perfectamente con la sesion correcta. Solo se nota probandola con la sesion
equivocada, que es exactamente lo que nadie hace por costumbre.

Los helpers estan en `src/lib/auth/venue-access.ts` y siguen la forma de
`admin.ts`: `requireVenueAccess` para paginas (no vuelve sin permiso; da 404, no
403, para que el panel ajeno no anuncie que existe) y `assertVenueAccess` para
acciones (nunca lanza). El operador de la plataforma pasa por encima de las dos.

De la misma familia: **una invitacion solo la acepta la persona cuyo correo de
sesion coincide con el correo invitado**. Sin eso el enlace es un pase al
portador y entra quien lo abra en el grupo de WhatsApp del bar.

Y una tercera: **el estado de una foto no se recibe, se decide en el servidor
segun quien la suba.** Si el cliente pudiera mandar `status`, cualquiera subiria
fotos ya habilitadas a un bar donde nunca estuvo y se las reclamaria.

### El correo sale de un SUBDOMINIO, y responde a otro sitio

`send.tumbenla.com` esta verificado en Resend (DKIM + SPF + MX de retorno) y es
de donde salen los correos. **Ese subdominio no recibe nada.** El buzon vive en
`hola@tumbenla.com`, detras de un reenviador, y llega ahi por el `Reply-To` que
`getReplyToAddress()` pone a TODO correo desde `processEmailData`.

Por que en subdominio y no en el apex: si algun dia un envio quema la
reputacion, no se lleva por delante la del dominio principal, y deja el apex
libre de conflictos de SPF para los MX del buzon que recibe.

**Si se cambia `DEFAULT_FROM_EMAIL` a una direccion de otro dominio, deja de
salir.** Resend solo firma dominios verificados. Y si se borra
`DEFAULT_REPLY_TO`, cada respuesta se pierde en silencio: hay copy que la pide
("respondenos a este correo" en el correo de rechazo de una solicitud).

Los registros DNS viven en Vercel, que es el nameserver de `tumbenla.com`:
`vercel dns ls tumbenla.com`.

### `/api/geocode` esta cerrado A PROPOSITO

Exige `assertAdmin()` y responde 404 a cualquier otro. No es un descuido y no
hay que "arreglarlo": Nominatim tiene terminos de uso de bajo volumen (riesgo 5)
y abrirlo lo expondria a trafico anonimo.

**Por eso el alta de un sitio pide la direccion en TEXTO** y el pin lo pone un
operador. Si algun dia una pantalla publica necesita autocompletar direcciones,
la respuesta no es quitarle el gate a esa ruta: es un proxy propio con su
limite, o los tiles/geocoder que ya se contemplan mover a R2.

### Trampas que ya mordieron (para no repetirlas)

- **Tailwind v4 escanea TODO el proyecto, y una clase citada en cualquier
  archivo es una clase que va a generar.** Habia un `-w` sin rastrear en la
  raiz: el volcado HTML de una pagina ya renderizada, seguramente de un
  `curl -w` mal escrito. Adentro estaba la clase de fondo de `layout.tsx`, la
  del grano, pero con las comillas convertidas en entidades HTML (`&#x27;`),
  porque asi salio del navegador. Tailwind la leyo como una clase mas, genero
  la regla con la entidad adentro, y Turbopack murio buscando un archivo
  llamado `&#x27;/grain.jpg&` y senalando `globals.css`, que no tiene nada que
  ver. Dos vueltas de tuerca: primero, el error solo aparecia despues de tocar
  cualquier archivo de `src/`, asi que parecia culpa del cambio y no del
  archivo suelto; segundo, documentar la trampa aca la volvio a disparar,
  porque este archivo tambien se escanea y la clase de ejemplo era una clase
  de verdad. Por eso arriba esta contada en palabras y no copiada tal cual.
  Si el build se cae en una linea de CSS que nadie escribio, mirar
  `git status --porcelain` antes que el CSS.

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

- **Tablas de pagos** (`customer`, `subscription`, `payment`) no las toca ninguna
  consulta de Tumbenla. Se quedan por si algun dia hay cobro, pero hoy son ruido
  en el esquema.
- **El redirector abierto del login, ya cerrado.** El validador heredado daba
  por bueno cualquier destino que empezara por `/`, y `//evil.com` empieza por
  `/` pero el navegador lo resuelve como otro dominio: un enlace que se ve como
  `tumbenla.co/login?...` terminaba en otro sitio con la sesion recien creada.
  Vive ahora en `src/lib/auth/redirect.ts`, que rechaza `//` y `/\\`. Cualquier
  destino nuevo que se lea de una URL tiene que pasar por `esDestinoValido`.

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

## Flujo de trabajo

```
local (Docker)  ->  PR  ->  preview  ->  PR  ->  main (produccion)
```

1. **Local, con Docker.** `bun run db:up && bun dev`. Nada de apuntar el entorno
   local a Neon: para eso estan las ramas de preview.
2. **PR contra `preview`.** El CI compila contra un Postgres efimero antes de
   que nada toque una base compartida.
3. **Se valida en preview.** Las migraciones las aplica el propio build
   (`vercel.json` corre `bun run migrate && bun run build`), no hay paso manual.
   Aca es donde entran las personas que prueban.
4. **PR de `preview` a `main`.** Solo eso llega a produccion.

`.github/workflows/ci.yml` lo hace cumplir. El job `origen` existe porque
**GitHub no sabe restringir la rama de ORIGEN de un PR**: sus reglas de
proteccion solo miran el destino. Sin ese job, cualquiera abre un PR de una
rama suelta directo a `main` y se salta la validacion.

### Lo que hay que saber de este flujo

- **La rama `preview` de Neon es COMPARTIDA.** El preview deployment de
  cualquier PR corre `bun run migrate` contra ella. O sea que una migracion de
  un PR sin revisar se aplica a la base que estan usando quienes prueban y los
  demas PRs. Es el precio de no hacer una rama por PR, que chocaria con el tope
  de 10 ramas del plan Free.
- **Por eso las migraciones son aditivas, siempre.** Ver el riesgo 1 mas abajo.
  Aca la regla pesa el doble: no es solo el hueco entre esquema y codigo en el
  despliegue, es que otras personas estan usando esa base en ese momento.
- **`preview` se queda vieja con el tiempo.** Se separo de `production` una vez
  y desde entonces divergen. Cuando estorbe, se borra la rama de Neon y se
  vuelve a sacar de `production`, y se corre
  `scripts/vercel-env-push.sh .env.vercel.preview preview` con las cadenas
  nuevas.
- **Promover es un PR, no un `git merge` local.** El job `origen` solo corre
  sobre pull requests; un push directo a `main` se lo salta. Si se quiere
  cerrar de verdad, hay que proteger `main` en GitHub para que no acepte
  pushes directos.

### Comandos

```bash
# empezar algo
git checkout preview && git pull && git checkout -b feat/lo-que-sea

# a preview
gh pr create --base preview

# a produccion, ya validado
git checkout preview && git pull
gh pr create --base main --head preview --title "Promover a produccion"

# desplegar a mano, si hace falta
vercel deploy          # preview
vercel deploy --prod   # produccion
```

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
peticion son `/admin/*`, `/panel/*`, `/mi-historia`, `/entrar`,
`/registrar-sitio`, `/invitacion/[token]`, `/sitios/[slug]/noches/[nightId]`,
`/api/geocode` y `/api/mi-acceso`, todas de bajo volumen por diseno.

`/sitios/[slug]` sigue siendo ISR aunque ahora liste las noches: esa consulta no
depende de la sesion. El estado "¿ya reclame esta foto?" si depende de quien
mira, y por eso vive en la ruta aparte de la noche, que solo abre quien salio
esa noche. **Si alguna vez se mete ese estado en la pagina del sitio, se pierde
el ISR de una de las paginas mas visitadas.**

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
