# Tumbenla — producto

Bares y discotecas que ponen un trago en su carta con una parte del precio
destinada a material de construccion. La gente sale como sale siempre; nosotros
compramos el material y publicamos la factura. Se ven los dos eslabones: lo que
entro por cada sitio y en que lo gastamos.

El camino, y es uno solo, es **vender un trago**: el sitio arma un producto (un coctel
nuevo, o una cerveza, un combo o una botella que ya tenia en su carta) y dice en
la descripcion como se reparte cada peso. La persona lo pide, lo paga —en la app
o en la barra— y le sale un QR; el mesero lo escanea para entregarlo. Ese
escaneo es el hecho que mueve todo lo demas.

**Por la app pasa plata, y solo para eso.** Se cobra un producto concreto de un
sitio concreto, con su reparto declarado antes de pagar. No hay planes, no hay
suscripcion, y no guardamos tarjetas: eso lo hace la pasarela. Lo unico que
tenemos sigue siendo la confianza, y por eso casi todas las decisiones de abajo
se resuelven a favor de no afirmar mas de lo que sabemos.

El **compromiso por porcentaje de ventas** —el modelo viejo, en el que el sitio
prometia una parte de "sus ventas", reportaba lo que entrego y nos mandaba el
recibo— **se retiro** (decision 34). No quedo como camino alterno: un porcentaje
sobre una caja que no auditamos habia que creerlo, y un trago con su reparto
escrito deja rastro. Lo que un sitio puso es, desde ahora, lo que vendio su
carta.

Prueba de concepto: **Manizales**. Mas ciudades despues.

> Este archivo es el mapa vivo del producto. El plan de construccion original
> esta en `~/.claude/plans/partitioned-crunching-hartmanis.md` y ya quedo
> parcialmente desactualizado; cuando los dos se contradigan, manda este.
>
> Producto es uno de tres departamentos. La carta organizacional esta en
> `org/ORG.md`; crecimiento y retencion viven en `org/`. Este archivo guarda las
> conclusiones; los intentos viven en `org/crecimiento/EXPERIMENTOS.md`.

---

## Estado

| Area | Estado |
|---|---|
| Sitio publico (inicio, mapa, transparencia, causa) | Construido |
| Sistema de diseno Stitch "Calor de Barrio" | Construido |
| Mapa MapLibre con pines, tooltip y leyenda | Construido |
| Panel de admin: sitios, estados, selector de pin, geocoding | Construido |
| `/quiero-poner` con correo pre-redactado | **Retirado** (decision 36) |
| Seccion "Le entro" con las dos entradas | Construido |
| `/mi-historia`: resumen de pedidos pagados, galeria | Construido |
| Esquema de fiestas: `party_night`, `party_photo`, `photo_claim` | Construido |
| Reclamar fotos, punta a punta | Construido |
| Entrar y salir, y volver a donde estabas | Construido |
| Roles de sitio: `venue_member`, `venue_invitation`, panel `/panel` | Construido |
| Alta de sitio: solicitud corta verificada por DM | Construido |
| Menu de cuenta (cambiar de sombrero) en las tres barras | Construido |
| Liquidación del sitio y transparencia | Construida y probada localmente: deducciones revisadas, asignación exacta, transferencias manuales con evidencia y vistas V2. Falta ejecutar la operación real en preview/live. |
| Alta en 4 campos, aprobación sin cuenta y reclamo por correo verificado | Construido (decisión 35) |
| Compromiso general por porcentaje de ventas | **Retirado** (decision 34) |
| Subida real a R2 (cuenta, buckets, CORS) | **Falta la infra, el codigo esta** |
| Gate de ciudad (Manizales si, resto no) | Implementado y browser-validado localmente; build completo confirma ISR de 300 s. La geolocalización por IP en preview/producción sigue por validar. |
| **Vender el trago: carta, pedido, QR, escaneo, compensacion y caducidad** | Construido y probado en local. El adaptador ePayco Hosted Smart Checkout v2, la verificación autoritativa, la reconciliación y la recuperación están implementados; faltan aprobación comercial/legal, evidencia de cuenta y prueba en preview. |
| Compras de material y trazabilidad de la fundación | Administración, evidencia privada/pública, atribución limitada por monto y vistas V2 construidas y probadas localmente; falta validar R2 real. |
| Harness local por roles: plataforma, dueño, personal y rumbero | Automatizado con 91 pruebas Bun/PostgreSQL y Playwright sobre un build de producción aislado; ver `docs/validation-harness.md` |

---

### Gate de ciudad implementado (2026-09-05)

`src/components/sitios/city-gate.tsx` envuelve `/sitios`: Manizales o ciudad
sin reconocer muestran el contenido; una ciudad conocida en camino muestra el
aviso, las ciudades en camino y el enlace a la activa mas cercana. La prioridad
es `?ciudad=` → eleccion manual en localStorage → cookie de `proxy.ts`. Un override
vacio o desconocido abre el contenido y persiste como sin detectar; borrar
`tumbenla:ciudad` de localStorage permite volver a la deteccion por IP.
El almacenamiento bloqueado o la cookie malformada no impiden abrir el contenido.

La suscripcion cliente a la URL queda dentro de `Suspense`; la pagina conserva
`revalidate = 300` y no lee cabeceras ni searchParams en el servidor. El HTML
inicial/fallback muestra el contenido hasta resolver la ciudad en el cliente.
Pruebas sin dependencias: `bun scripts/test-city-gate.ts`; TypeScript y Biome
focalizado pasan. `bun run build` completo pasó con PostgreSQL local y confirma
`/sitios` como ruta estática/ISR a 300 s. Recorrido de navegador local verificado:
Pereira muestra el gate y CTA; Manizales muestra el explorador; el CTA conserva
`vista=mapa` y cambia a Manizales. Falta validar en preview la geolocalización
por IP y la cookie `tumbenla-geo` que `proxy.ts` escribe con las cabeceras de
Vercel.

## Los tres actores

| Actor | Como se decide | Donde vive | Que puede |
|---|---|---|---|
| **Plataforma** (nosotros) | `ADMIN_EMAILS`, variable de entorno | `/admin` | verificar sitios, consultar la carta, liquidar saldos, moderar cualquier foto de la red, comprar material |
| **Sitio** (dueno + personal) | `venue_member`, fila en la base | `/panel/[slug]` | armar la carta y **escanear** cada entrega, noches y fotos, aprobar lo que sube la gente. Solo el dueno maneja el equipo y ve la cuenta |
| **Rumbero** | cualquier sesion | publico + `/mi-historia` | reclamar sus fotos, subir las suyas, reportar una en la que sale |

Nadie publica su propio sitio. Esa verificacion es de la plataforma y es lo que
respalda lo que el mapa afirma. Un sitio ya aprobado publica directamente sus
productos, siempre que cada uno destine al menos 40% para reconstruir.

---

## Decisiones tomadas (no reabrir sin razon nueva)

Estan aca para no volver a discutirlas cada dos semanas.

1. **Se vende un trago, y la plata pasa por la app.** *(Reemplaza a "Solo
   directorio. La plata no pasa por la app", que fue la decision fundacional del
   producto.)* Se cobra un producto concreto de un sitio concreto, con su
   reparto escrito antes de pagar, y se entrega contra un QR de un solo uso. Lo
   que se cobra no es un servicio nuestro: es el trago del bar, y por eso el
   reparto va en la descripcion y no en una letra chiquita.
   **Por que se reabrio:** el modelo viejo pedia que el sitio decidiera poner,
   calculara cuanto, y despues nos mandara el recibo — tres actos de voluntad
   despues de la venta, todos opcionales, todos manuales. Este pide uno solo y
   ocurre durante la venta. *(El viejo primero se corrio a un lado y despues se
   retiro del todo; ver decision 34.)*
   **Lo que NO cambia:** no hay planes ni suscripcion, no guardamos tarjetas, y
   ninguna cifra se afirma sin respaldo. Cobrar no nos da licencia para decir
   mas de lo que sabemos; nos da mas cosas que tenemos que poder probar.
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
19. **Nosotros verificamos, nosotros compramos.** *(Antes empezaba con "El sitio
    reporta". Ese primer acto se murio con la decision 34: el sitio ya no
    reporta nada, porque lo que puso sale del libro, no de un formulario que
    llena el.)* Un aporte que no hayamos verificado no existe para el publico.
    Publicar una cifra que nos dieron sin comprobarla seria afirmar bajo nuestro
    nombre algo que no comprobamos. Lo que se verifica hoy es **la compra del
    material** —la factura contra la que se publica en `/transparencia`—, no el
    reporte de un bar.
20. **Una solicitud de alta NO crea el sitio.** *(Reemplaza a la version
    anterior de esta decision, que daba la propiedad en el acto al registrar.)*
    El formulario no pide las coordenadas, y `latitude` y `longitude` son
    `NOT NULL`: no hay fila que insertar. El sitio nace cuando un operador
    aprueba y completa lo que falta. De paso tapa un hueco real: con propiedad
    inmediata, cualquiera apartaba el nombre de un bar ajeno y el buscador le
    decia al dueno de verdad "ya tiene dueno".
    *(El guardarrail eran tres columnas `NOT NULL`, no dos: `pledge_type` era la
    tercera y se fue con la decision 34. Lat/lng bastan, pero conviene saber que
    el margen se angosto.)* La aprobacion escribe sitio, solicitud y —solo si
    ya existe una cuenta confiable— su membresia de dueno en una transaccion.
    Una solicitud aprobada sin dueno es valida: no publica el sitio por si sola
    y espera el reclamo automatico por correo verificado.
20b. **El DM verifica el control de Instagram; el correo citado identifica a la
    persona.**
    Que el mensaje llegue desde el Instagram del bar prueba que quien escribe
    controla esa cuenta, no que sea quien lleno el formulario. Por eso el DM
    tiene que citar el `contactEmail` de la solicitud. Hacen falta las dos, o no
    se aprueba: sin la segunda, quien maneja las redes de un bar podria quedarse
    con el sitio de otro. **No hace falta una cuenta antes de aprobar:** esa
    comprobacion humana ya cubre la autorizacion operativa; la cuenta solo
    entrega el panel despues de que su correo exacto este verificado.
20c. **El formulario largo de un sitio no se le muestra a nadie de la calle.**
    Estuvo colgado en `/registrar-sitio/nuevo` y era la peor pantalla del
    producto. Vive solo en los dos paneles. Su buscador de direcciones llama a
    `/api/geocode`: entra el operador al crear un sitio y el dueno verificado
    solo al editar uno que ya le pertenece. El alta publica sigue teniendo
    cuatro campos y ninguna direccion.
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
    (`KIND_LABEL` en `src/lib/comercio/types.ts`). Asi un acento nunca llega a
    una URL, a una consulta ni a una migracion.
    *(El ejemplo canonico era `UNIT_LABEL` en `pledge-badge.tsx`, que se borro
    con la decision 34. `KIND_LABEL` es ademas mejor ejemplo: cubre sus seis
    valores, mientras que `UNIT_LABEL` tenia una sola entrada.)*
26. **Toda orden lleva un solo QR visible, y el mesero no sabe cual esta pagada hasta despues de
    escanear.** Es el mecanismo entero, no un detalle de implementacion. Un
    mesero que cobra en la barra y nos dice que nunca entrego se queda con todo;
    la defensa no es pedirle al cliente que verifique nada, es que no escanear
    una orden de barra le borra una deuda pero no escanear una de app le hace
    perder su propia parte, y como no distingue cual tiene enfrente, la unica
    politica segura es escanear todas. **La incertidumbre hace el trabajo que
    haria una auditoria.** De aqui salen las dos siguientes, que no se pueden
    quitar sin tumbar esta.
27. **Se escanea UNA VEZ por orden, ANTES de cobrar, y sin escaneo no hay credito.** La pantalla
    del escaneo confirma todas las unidades de esa orden y le dice al mesero si cobra el total
    ("YA PAGADO, entrega" o "COBRAR $60.000"); si cobrara primero ya sabria cual es y la decision
    26 se cae. Y la parte del sitio en una orden pagada en la app se le abona **al redimir**, no al
    pagar: es lo que vuelve caro no escanear.
28. **Al comprador solo se le pide mostrar un QR por orden.** Nada de confirmar, calificar
    ni marcar recibido. La confirmacion en vivo —la pantalla pasa a "Listo" en el
    momento del escaneo— lo vuelve un sensor sin pedirle trabajo: si no cambio,
    dice "no me salio" ahi mismo. Todo lo demas lo hacemos nosotros, lo hace el
    sitio, o se resuelve por disputa.
29. **Se compra sin cuenta, pero la cuenta se OFRECE con su razon.** Nombre y
    correo. Es la decision 2 aplicada al pago: iniciar sesion AGREGA, nunca
    restringe, y un registro con verificacion por correo entre la persona y el
    trago —parada en una barra, con mala senal— es donde se pierde la venta.
    En el pedido se muestra la eleccion de frente, "con cuenta" o "como
    invitado", y **con cuenta viene marcado**: la cuenta es lo que junta las
    fotos de la noche, los tragos pedidos y a donde fue la plata en un solo
    lugar. Pero **no bloquea**: la orden se crea igual y la cuenta se termina en
    la pantalla del QR, mientras la persona espera el trago.
29b. **Un pedido de invitado se amarra despues, por el correo VERIFICADO.**
    *(Sin esto, "seguir como invitado" seria un callejon sin salida y la
    decision 29 estaria prometiendo una historia que nace incompleta: nadie va a
    volver a pedir el trago de hace tres semanas.)* Al entrar, todo pedido con
    ese correo y sin dueno queda amarrado a la cuenta. **Exige `emailVerified`, y
    eso es lo que lo hace seguro:** el correo de un pedido lo escribe cualquiera
    en un formulario publico, asi que sin esa condicion alguien se registra con
    el correo ajeno y se queda con el historial de otro —que dice donde estuvo,
    cuando y con quien—. Vive en `src/lib/comercio/vincular.ts` y corre en
    `/entrar`, que es por donde pasa todo el que inicia sesion.
30. **El precio y el porcentaje de reparto se congelan en la orden.** Los
    campos comerciales que la persona vio se copian al comprar. Si el sitio
    cambia el precio o el porcentaje manana, la orden vieja conserva esa promesa.
    El porcentaje se conoce desde la compra; el valor exacto en pesos queda
    pendiente hasta reconciliar las deducciones itemizadas y retenciones del
    proveedor. Un reparto que se puede reescribir despues del hecho no es una
    promesa, es un adorno.
31. **La plataforma aprueba el sitio, no cada producto.** El dueno guarda sus
    productos en borrador y los publica directamente cuando estan listos. La
    regla que no se negocia es **minimo 40% para reconstruir**: la valida el
    servidor y la base antes de que un producto pueda quedar publicado. Desde
    50%, el producto aparece primero y destacado en la carta publica; si el
    sitio puede, dejar 100% para reconstruir recibe la mayor visibilidad. Esto
    conserva la verificacion que importa —quien es el bar— sin volver la carta
    una cola de operacion.
32. **Sin reclamar, el QR caduca a los 45 dias y no se asigna automaticamente.**
    La orden conserva una obligacion de devolver el precio bruto completo a quien
    lo pida; el sitio no cobra lo que no entrego. La asignacion exacta de impacto
    permanece pendiente hasta reconciliar el bruto, las deducciones itemizadas y
    las retenciones aplicables. El apartado de devolucion existe y esta a la
    vista, y los costos no recuperables salen inicialmente de fondos operativos.
33. **Quien trabaja en un sitio entra por el sitio, no por el sitio publico.**
    La sesion tiene dos sombreros sobre la MISMA cuenta —salir de rumba cuelga
    de `photo_claim`, trabajar cuelga de `venue_member`— y el que manda por
    defecto es el de trabajo. En concreto: la barra publica pinta "Mi bar" con
    enlace directo a `/panel/{slug}`, el control de cuenta muestra el NOMBRE
    DEL SITIO en vez del de la persona, y ver el producto como rumbero pasa a
    ser el acto secundario ("Verlo como rumbero"), no el primario.
    **Y un mesero no ve el resumen del panel: `/panel/{slug}` lo redirige a
    `/escanear`.** El resumen habla del perfil del sitio, su estado en el mapa
    y su equipo —trabajo de dueno, sentado y de dia—; a quien atiende la barra
    le aterrizaba en "Nombre, direccion, contacto" sin una sola mencion de
    escanear, con la unica pantalla que necesita escondida detras de una barra
    lateral colapsada en el telefono. Al dueno se le conserva el resumen, pero
    encabezado por la tarjeta de escanear, porque tambien cubre la barra en una
    noche movida.
    **Por que importa:** escanear es la unica pantalla del producto que se abre
    de pie, de noche y con alguien esperando. Cualquier paso entre la sesion y
    esa pantalla se paga en la barra, y la decision 26 depende de que escanear
    sea lo comodo: si no escanear es mas facil que escanear, el mecanismo del QR
    indistinguible se cae solo.
34. **Un bar no promete un porcentaje de sus ventas: pone un trago con su
    reparto escrito.** *(Retira el compromiso general, que era el modelo
    fundacional. Enmienda las decisiones 1, 19 y 20.)* Se van las columnas
    `venue.pledge_*` y todo lo que las pintaba.
    **Por que:** un porcentaje sobre "las ventas" no lo puede verificar nadie.
    No auditamos la caja de ningun bar —`/terminos` ya lo admitia por escrito— y
    el numero que salia en la tarjeta habia que creerlo. Un trago no: tiene
    precio, tiene reparto declarado antes de pagar, tiene una orden y tiene un
    escaneo. Se cambio una promesa que se cree por una que deja rastro, y eso es
    lo unico coherente con la decision 5.
    **Consecuencia que no es obvia:** lo que un sitio "ha puesto" deja de ser
    algo que el sitio nos dice y pasa a ser algo que el libro calcula. Por eso
    tambien se borra el auto-reporte de aportes: no habia como reportar sin
    contradecir esto.
35. **El formulario de alta solo pregunta lo que prueba que quien escribe es el
    dueno, y la cuenta llega despues de aprobar.** Cuatro campos: nombre,
    Instagram, correo y WhatsApp. Ni tipo, ni ciudad, ni direccion, ni los ocho
    opcionales. Todo eso lo pone operacion al aprobar, o el bar despues en su
    panel, cuando ya tiene algo que ganar llenandolo.
    **Y no se pide cuenta para verlo.** Antes habia que registrarse Y verificar
    el correo antes de ver el formulario: el paso mas caro iba de primero. Es la
    decision 29 aplicada al otro lado del mercado —iniciar sesion AGREGA, nunca
    restringe— y se amarra igual, por correo verificado, con el mismo mecanismo
    de la decision 29b. Cuando operacion aprueba tras comprobar el DM y el
    correo, crea el sitio aunque todavia no haya cuenta. Si ya hay una con ese
    correo exacto y verificado, recibe `owner` en la aprobacion; si no, la
    primera que lo verifique lo reclama al entrar. No hay invitacion que aceptar.
    **El DM no desaparece, se corre de lugar.** La decision 20b sigue mandando:
    sin el DM no se aprueba. Pero se cuenta DESPUES de enviar, no como una lista
    de pasos futuros encima de un formulario vacio.
36. **Una sola puerta para el dueno de un bar.** `/quiero-poner` se retira. Era
    la puerta principal desde la portada y era un `mailto:` que no escribia nada
    en la base, mientras el formulario de verdad no aparecia ni en la portada ni
    en la barra de navegacion. O sea que el camino principal para registrar un
    bar era redactar un correo a mano y esperar. Ahora la puerta es
    `/registrar-sitio` y esta en la barra.
37. **ePayco Hosted Smart Checkout v2 es el proveedor de cobro elegido para el
    MVP colombiano; la salida de fondos será una transferencia bancaria manual
    revisada.** El plan de implementación está autorizado. El checkout alojado
    cobra la orden y deja las credenciales de tarjeta en ePayco. Tumbenla
    reconcilia el bruto, cada deduccion itemizada y la retencion aplicable antes
    de calcular el neto y cualquier asignacion. No hay split automatico en
    checkout: la investigacion de Pagos Divididos se conserva como historial,
    pero queda supersedida para este release. Musica para la Paz es solo una
    candidata pendiente de verificacion como receptor de impacto; su recibo y la
    compra de material verificada son hechos distintos. Abrir la cuenta comercial,
    contratar, ejecutar transferencias reales y desplegar siguen bloqueados por
    compuertas externas. El detalle vive en `docs/payment-provider-decision-brief.md`.
    **Tumbenla no impone un tope monetario al pedido.** Un limite que ePayco aplique
    por estado o configuracion de la cuenta es una compuerta del proveedor, no una
    regla de la carta: se muestra como tal y se resuelve con ePayco, no rechazando
    botellas de COP 700.000 en nuestro dominio. Si ePayco rechaza antes de crear la
    sesion, el siguiente intento usa una idempotencia nueva. Si la sesion ya existe,
    se vuelve a abrir esa misma sesion en vez de crear dos cobros que sigan pagables.
38. **Cada sitio publicado arranca con COP 500.000 de cupo para cobrar en la
    barra; Operación lo puede bajar hasta cero.** El cupo cubre la obligación
    congelada del aporte, no el bruto completo de la venta. La primera orden de
    barra materializa una política v1 auditada si el sitio nunca tuvo una; una
    política manual existente —incluido un límite de cero o una suspensión—
    siempre gana y el sistema no la reemplaza. La deuda vencida sigue bloqueando
    pedidos nuevos y no deshabilita el pago por ePayco.
39. **La transparencia pública resume el ciclo en tres cifras que sí se pueden comparar.**
    `Total donado` suma exclusivamente la asignación final para reconstruir de unidades reales
    entregadas y con cobro aprobado; nunca suma el ingreso completo, pruebas, legado sin verificar
    ni cobros en disputa. `Ya entregado` es la parte de ese total atribuida, sin excederla, a compras
    de material verificadas con recibo público. `Pendiente por entregar` es exactamente la
    diferencia entre las dos. En `/mi-historia`, `Total gastado` muestra las unidades reales pagadas
    y no devueltas de esa persona, mientras `Total donado` usa la misma asignación final. Los pedidos
    `sandbox` y `legacy_unverified` siguen visibles para soporte y pruebas, pero rotulados y separados
    de cualquier total real.
    **Por qué:** las cuatro etapas contables siguen siendo necesarias internamente, pero juntas en la
    pantalla hacían parecer que eran bolsas distintas o cifras para sumar. Las tres públicas contestan
    cuánto entró para reconstruir, cuánto ya tiene factura y cuánto sigue esperando esa factura, sin
    ocultar el intervalo operativo ni confundirlo con ingreso de Tumbenla.
40. **Cada paso tiene que ganarse su friccion.** Antes de exigir un clic, un
    campo, una pantalla o una espera, se escribe que riesgo irreductible evita y
    por que una comprobacion anterior no lo cubre. Si una verificacion humana o
    tecnica ya cubre ese riesgo, el paso se quita o se mueve al momento en que
    si entrega valor. La revision vive en `docs/ux-friction-review.md`: es una
    puerta de implementacion y validacion, no una sugerencia de copy.

---

## Que se pide para dar de alta un sitio

**Obligatorio.** Es el minimo para poder verificar y despues publicar.

Son **cuatro**, y la prueba de que son el minimo es que cada uno hace falta para
verificar o para responder (decision 35). No hay campos opcionales: un campo
opcional en esta pantalla es una pregunta que alguien lee y sopesa antes de
poder seguir.

| Campo | Por que es el minimo |
|---|---|
| Nombre del sitio | Es lo que buscamos en Instagram para confirmar que existe |
| **Instagram del sitio** | **Es el instrumento de verificacion.** Sin cuenta oficial no hay DM que comprobar |
| **Correo de contacto** | Por donde le respondemos, y lo que el DM tiene que citar |
| WhatsApp | Como se persigue una solicitud que se quedo quieta. Es el canal por el que de verdad contesta un bar en Manizales |

**Quien queda de dueno sale del CORREO VERIFICADO, no de la sesion.** Ya no hay
que entrar antes de aplicar (decision 35): operacion puede aprobar la solicitud
sin dueno tras validar DM+correo. Una cuenta solo recibe `owner` si su correo es
exactamente ese y ya esta verificado; si no existia, la primera que lo verifique
lo reclama al entrar, sin invitacion ni aceptacion adicional.

**Ya no se piden** —y esta es la lista de lo que se quito, no de lo que falta—:
tipo, ciudad, direccion, TikTok, telefono, barrio, sitio web, horario,
descripcion, y "que tienes en mente para poner", que era el compromiso general
disfrazado de idea y murio con la decision 34.

**Lo llena un operador al aprobar, o el bar despues en su panel:** tipo,
direccion, coordenadas, `estimatedPerPersonNight`, `verifiedNote`, portada y
logo.

### Casos de borde

| Caso | Que hace el MVP |
|---|---|
| No tiene Instagram del bar | No puede mandar la solicitud. La pantalla lo dice y deja el correo para escribirnos: sin cuenta oficial no hay verificacion posible |
| Solo tiene TikTok | TikTok es opcional y no reemplaza a Instagram en el formulario, pero el operador **si** puede aprobar contra un DM de TikTok y dejarlo en `reviewNote` |
| El DM lo manda alguien distinto de quien aplico | Por eso el DM cita el correo de la solicitud. Si no coincide, no se aprueba |
| Dos personas piden el mismo bar | Indice unico PARCIAL sobre `lower(instagram)` con `status in ('pending','verifying')`: una sola solicitud viva a la vez, y aun asi se puede volver a aplicar tras un rechazo |
| El bar ya esta en el directorio | Lo cruza OPERACION al revisar, no un buscador antes del formulario: el buscador "¿Ya lo tenemos cargado?" se quito porque cobraba una decision antes de la primera letra |
| El sitio ya tiene dueno | Lo ve el operador en la cola y rechaza con nota |
| Aplica y nunca crea la cuenta | Operacion puede aprobar tras validar DM+correo. El sitio queda aprobado sin dueno y no se publica salvo que el operador elija `published`; cuando alguien verifique ese correo, recibe `owner` automaticamente |
| El DM nunca llega | Se queda en `verifying`. Sin caducidad: la cola es corta y una solicitud vieja es alguien esperando |
| Se equivoco en los datos | Vuelve a mandar el formulario y se actualiza mientras siga viva |
| La ciudad no es Manizales | Se acepta y se guarda; es la lista de espera para abrir ciudad |
| Lo aprobamos y nunca vuelve | El sitio queda con dueno ausente. La plataforma **si** puede quitar al ultimo dueno para reasignarlo; un dueno no |

### Lo que se sacrifica por simplicidad

| Hoy | Cuando duele | Hacia donde va |
|---|---|---|
| Verificacion manual por DM | Pasadas ~10 solicitudes por semana, o al abrir la segunda ciudad | Login de Instagram/Meta Business, o un codigo pegado en la bio |
| La identidad se amarra con el correo citado en el DM | Cuando un sitio tenga varias personas manejando redes | Verificacion de dominio del correo, o registro mercantil (NIT) |
| Un solo dueno por correo verificado | Cuando haya dos socios de igual a igual | Ya resuelto: el dueno puede nombrar mas duenos en su panel |
| El operador escribe pin y compromiso a mano | Con muchos sitios por semana | Que el sitio proponga y el operador solo apruebe |
| Sin caducidad de solicitudes | Cuando la cola no quepa en una pantalla | Caducar `verifying` a los 30 dias con aviso |
| Sin auditoria mas alla de `reviewedBy` | Con mas operadores | Bitacora aparte |
| Una orden contiene un producto, aunque puede llevar varias unidades | Cuando alguien quiera combinar, por ejemplo, un mojito y una cerveza en un solo pago | Carrito con lineas de pedido, un cobro y un QR para todo el carrito |

---

## Roadmap

### Vender el trago

Es el camino principal nuevo (decision 1). Va en siete pasos y en ese orden; el
detalle de cada uno vive en el plan, `~/.claude/plans/check-our-product-guidelines-synthetic-pillow.md`.

- [x] **Doctrina.** Reescribir la decision 1, agregar las 26-32 y los riesgos
      7-9. Va primero para que no haya codigo que contradiga el archivo.
- [x] **Esquema.** `venue_product`, `product_order`, `order_redemption`,
      `ledger_account`, `ledger_transaction`, `ledger_entry`, `venue_settlement`,
      y `venue_contribution.source`. Partida doble: los asientos de una
      transaccion suman cero y `select sum(amount) from ledger_entry` da cero
      siempre. Trigger que rechaza `UPDATE`/`DELETE` sobre `ledger_entry`.
- [x] **Carta y revision.** `/panel/[slug]/carta` y la cola en
      `/admin/productos`. Nada se vende sin pasar por ahi (decision 31).
- [x] **Pedido y pago.** La carta publica en `/sitios/[slug]`, el checkout, un
      adaptador agnostico con ePayco Hosted Smart Checkout v2 y un proveedor falso
      restringido al arnes local, y `/orden/[token]` con el QR y su confirmacion en vivo.
      **En ESE paso, y no antes, hay que reescribir
      `src/app/(publico)/como-funciona/page.tsx:160`**, que hoy dice "La plata
      no pasa por esta pagina. No cobramos, no procesamos pagos". Hoy es
      verdad y tiene que seguir estando hasta que el cobro exista de verdad:
      cambiarlo antes seria la misma mentira al reves.
- [x] **Escaneo y redencion.** `/panel/[slug]/escanear`, el `UPDATE` atomico y
      los asientos.
- [x] **Saldo y liquidacion.** `/panel/[slug]/cuenta` y `/admin/cuentas` derivan
      saldos V2; la reconciliación exige deducciones/retenciones con evidencia y las
      transferencias manuales pasan por reserva, resultado incierto y confirmación bancaria.
- [x] **Caducidad y devolucion.** La unidad no reclamada vence a 45 días sin
      asignarse; conserva el pasivo bruto y el reembolso comparte bloqueo con la redención,
      exige evidencia y protege la cobertura de costos no recuperables.

**La pasarela ya fue decidida: ePayco Hosted Smart Checkout v2 (decision 37).**
El adaptador se mantiene contra una interfaz propia hasta que ePayco confirme por
escrito la cuenta, PSE, recibos, reportes de deducciones, devoluciones y
responsabilidades. Los pagos elegibles se liquidan mediante transferencias
bancarias manuales revisadas, no mediante split automatico.

### Ahora

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
- [ ] **Avisarle al sitio cuando algo lo espera.** Hoy nada le avisa a un dueno
      que tiene fotos por revisar o un reporte de privacidad abierto: hay que
      entrar al panel a mirar.
- [ ] **Avisarle al operador cuando llega una solicitud.** Hoy el conteo sale en
      la barra de `/admin`, pero hay que entrar a verlo: no llega ningun correo.

### Despues

- [ ] Perfil publico opcional (las fotos con `showPublicly = true`).
- [ ] Segunda ciudad. Ver "el filtro de ciudad es de cliente" mas abajo: ese es
      el trabajo que se destapa al abrirla.

### Algun dia

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

### Lo que queda abierto de "vender el trago"

- **El personal puede administrar la carta.** Probado localmente con
  `mesero@prueba.local`: `/panel/bar-la-nona/carta` muestra agregar, pausar,
  editar y archivar. `CartaPage` y las acciones de `src/app/actions/carta.ts`
  llaman `requireVenueAccess` / `assertVenueAccess` sin restringir a `owner`.
  Contradice el rol que necesita la experiencia simple: el personal solo entrega
  en `/escanear`; precio y reparto son decisión del dueño. Muerde durante una
  barra llena, cuando quien debe escanear ve y puede cambiar la oferta.
- **La portada todavía cuenta el modelo retirado.** `src/components/layout/le-entro.tsx:59`
  y `src/app/(publico)/como-funciona/page.tsx:182` ofrecen porcentaje de la noche
  o plata fija por trago; `src/app/(publico)/page.tsx:34` sigue diciendo "parte de
  lo que te tomas". Contradicen las decisiones 1, 34, 35 y 36: el único camino
  es un producto con reparto declarado y la puerta de alta es
  `/registrar-sitio`. Muerde en la primera visita de un dueño o rumbero: promete
  un producto que ya no existe antes de que puedan llegar al flujo correcto.
- **La integración ePayco no tiene evidencia de cuenta.** El adaptador Hosted Smart Checkout v2,
  la firma, la consulta autoritativa y los estados pendientes están implementados con fixtures,
  pero tarjeta crédito, débito, PSE, factura duplicada, reportes de deducciones y reembolsos aún
  deben probarse con la cuenta aprobada en sandbox y preview antes de producción.
- **`code_hash` en `order_redemption` esta muerta.** Quedo del diseno hasheado,
  ya es nullable y nadie la escribe. Borrarla en un deploy aparte.
- **El cron necesita aceptación en Vercel.** La ruta diaria autenticada, los leases, cursores,
  backlog y controles manuales están implementados y probados localmente; falta observar una
  invocación real y su recuperación en preview.
- **El pie de los correos esta en INGLES.** "Questions?", "Privacy Policy",
  "Terms of Service", "Unsubscribe" en `EmailLayout`. Es anterior a esto —le
  pasa igual a la invitacion de equipo, que ya se despacho— pero es texto que le
  llega a un usuario en un producto que es solo en espanol (decision 7).
- **El crédito de barra abre exposición antes de observar comportamiento.** Cada sitio publicado
  arranca con COP 500.000 sobre la obligación del aporte; la política queda auditada al primer uso
  y Operación puede reducirla o llevarla a cero. Sigue pendiente observar deuda, cortes manuales y
  compensación contra ingresos electrónicos conciliados antes de ampliar ese cupo.
- **La asignacion exacta queda pendiente hasta reconciliar.** El porcentaje se
  congela en la orden, pero el valor en pesos se calcula sobre el neto real
  despues de deducciones itemizadas y retenciones; no se muestra una cifra
  inventada antes de esa conciliacion. El recibo del receptor de impacto no es
  una compra de material verificada: `/transparencia` debe mostrar ambos hechos
  por separado y no sumar sus etapas como si fueran dos asignaciones.

### El codigo esta a medias en español

`CLAUDE.md` fija la regla: **identificadores y comentarios en ingles, español
solo para lo que el usuario lee.** El repo todavia no cumple.

**Cuanto:** 51 archivos con comentarios en español y **78 exports con nombre en
español** (iban en 57 y 81). Se pagaron al tocarlos por la decision 33: los seis
archivos de la barra publica, el menu de cuenta, el panel y `/api/mi-acceso`, y
los tres exports `MenuCuenta` → `AccountMenu`, `PanelSitioLayout` →
`PanelVenueLayout` y `PanelResumenPage` → `PanelSummaryPage`. Los mas cargados:

| Archivo | Exports |
|---|---|
| `src/lib/comercio/queries.ts` | 13 |
| `src/lib/comercio/types.ts` | 9 |
| `src/lib/comercio/libro.ts` | 8 |
| `src/app/actions/carta.ts` | 7 |
| `src/lib/comercio/dinero.ts` | 5 |
| `src/lib/venues/invitations.ts` | 4 |

Casi todo `src/lib/comercio/` y las acciones de "vender el trago" nacieron asi
en esta tanda; `venues/invitations.ts`, `venues/claims.ts` y `config/ciudades.ts`
son anteriores.

**Como se paga: EN EL CAMINO.** El archivo que se toque para otra cosa se pasa a
ingles en ese mismo PR. **No se abre un PR de puro renombrar** —81 exports
cruzan medio arbol de importaciones y un diff asi no lo revisa nadie—, salvo que
se dedique una sesion entera a eso a proposito.

**Cuando muerde:** cuando entre alguien nuevo al repo, o cuando un `venueId`
quede al lado de un `saldoDeSitio` en la misma funcion y haya que traducir
mentalmente en cada linea. Hoy no rompe nada; solo cuesta leerlo.

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
- **La cobertura automatizada aún es deliberadamente acotada.** El arnés ya ejecuta 91 pruebas
  Bun/PostgreSQL y un recorrido Playwright con operador, dos dueños, personal y rumbero sobre un
  build de producción. Cubre aislamiento mínimo y el circuito pago → QR → redención → confirmación,
  pero no reemplaza la matriz manual de cámara, móvil, correo real ni aceptación en preview.

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

### Redimir un QR reclama la orden y cambia cada unidad condicionalmente

```sql
UPDATE order_redemption
   SET status = 'redeemed', redeemed_at = now(), redeemed_by_user_id = $1
 WHERE id = $2 AND status = 'issued'
RETURNING *;
```

Primero se bloquea la orden; luego cada unidad aun emitida cambia con el
`AND status = 'issued'` dentro de la misma transaccion. Cero filas significa que
otra operacion gano y se revierte todo. Asi un pedido de tres tragos necesita un
solo escaneo, pero conserva tres unidades contables, tres repartos y tres
posibles decisiones de reembolso. Dos codigos viejos de la misma orden tampoco
pueden competir ni bloquearse entre si: el bloqueo de orden los serializa.

Va acompanada de dos cosas que **no** son la misma y hacen falta igual:

- **Una fila interna de redencion por unidad comprada, pero un solo codigo visible por orden.**
  Cantidad 3 conserva 3 unidades y 3 transiciones contables; la pantalla y el correo exponen solo
  el codigo canonico y su escaneo reclama las 3. Asi el limite no es una validacion que alguien
  pueda olvidar: no existe una cuarta unidad que redimir.
- **Idempotencia, que es otro problema.** El `UPDATE` resuelve *dos escaneos a
  la vez*. No resuelve *el mismo escaneo reintentado* —el mesero toca dos veces,
  la red repite el POST—, que con solo el `UPDATE` le responde "ya se entrego" a
  quien acaba de escanear bien. Eso lo resuelve la clave de idempotencia unica
  de `ledger_transaction`.

Y la redencion y sus asientos van en la MISMA transaccion: no puede existir un
trago entregado sin su movimiento en el libro.

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

### `/api/geocode` esta cerrado al publico A PROPOSITO

Responde 404 al trafico anonimo. Entra el operador, o un dueno verificado cuando
manda el `venueId` de un sitio que ya le pertenece. No es un autocompletado:
solo consulta cuando la persona pulsa el boton, toma la primera coincidencia y
deja las demas para corregir. Nominatim tiene terminos de uso de bajo volumen
(riesgo 5), asi que abrirlo a la calle lo expondria a trafico incompatible con
el proveedor.

**Por eso el alta publica de un sitio no geocodifica nada:** pide solo los
cuatro datos de la solicitud. La direccion y el pin los pone un operador al
aprobar; despues, el dueno puede corregirlos desde su panel. Si una pantalla
publica necesita buscar direcciones, la respuesta no es quitarle el gate a esta
ruta: es otro proveedor o un proxy propio con limite.

### Trampas que ya mordieron (para no repetirlas)

- **Un despliegue de Vercel se sirve por VARIAS direcciones a la vez, y la
  sesion tiene que salir hacia la que el navegador esta usando.** El cliente de
  Better-Auth apuntaba a `getBaseUrl()`, la URL canonica, incrustada en el
  bundle durante el build. Abrir la app por la URL del despliegue suelto
  (`tumbenla-7590aq1ux-...`, la que da el panel de Vercel) mandaba el fetch de
  la sesion hacia la URL de la rama: peticion entre origenes, preflight sin
  `Access-Control-Allow-Origin`, cortada por el navegador antes de salir. Lo
  unico que quedaba era `TypeError: Failed to fetch`, que no dice nada. Y
  detras habia un segundo muro: `trustedOrigins` tenia solo la canonica, asi
  que el chequeo de origen habria devuelto 403 a la peticion que la propia app
  se hace a si misma. Regla: **el navegador llama a `window.location.origin`;
  la canonica es para los enlaces de los correos, que se abren desde afuera.**
  Y `trustedOrigins` lleva las direcciones de este despliegue leidas en tiempo
  de ejecucion (`VERCEL_URL`, `VERCEL_BRANCH_URL`), nunca un comodin
  `*.vercel.app` — eso confiaria en cualquier sitio alojado en Vercel, que es
  justo lo que el chequeo existe para impedir.

- **Un `catch` que solo hace `console.error` es un boton roto.** Entrar fallaba
  sin pintar nada: el `finally` devolvia el boton a su estado normal y no
  aparecia ningun mensaje. Los manejadores de error de Better-Auth solo corren
  cuando **hubo respuesta**; si la peticion nunca sale, la excepcion cae en el
  `catch` del formulario, y ahi es donde hay que mostrarla. Peor estaban los
  cuatro botones sociales: armaban un `errorMessage` completo y lo dejaban
  morir sin usarlo. `src/app/(auth)/fallo-de-red.ts` reconoce el caso —el texto
  cambia segun el navegador— y da un mensaje que no promete cual fue el motivo,
  porque el navegador lo oculta a proposito, pero que **se ve**.

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
- **El basemap raster publico de CARTO que usa el mapa no lleva API key.** No
  agregar `NEXT_PUBLIC_CARTO_BASEMAP_KEY` a los ejemplos de entorno: el runtime
  no la lee y pedirla en local o preview inventa una dependencia que no existe.
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
6. **El aporte exacto no es una factura individual.** `/mi-historia` separa el gasto bruto real de
   la asignación final para reconstruir; no presenta el reparto previo a deducciones como una cifra
   final. Aun así no podemos atribuir una compra concreta de reconstrucción a un trago: las
   liquidaciones se gastan en bloque. La transparencia conserva esa distinción mostrando la compra
   verificada a nivel agregado, no inventando una factura por pedido.
7. **Intermediacion de pagos.** Al cobrar en la app recaudamos plata que en
   parte es del sitio, y al cobrar en la barra el sitio recauda plata que en
   parte es nuestra. Son dos figuras distintas: en la primera somos custodios de
   plata ajena, en la segunda somos acreedores. La compensacion entre las dos
   es un acuerdo entre partes y **tiene que estar escrito con cada sitio antes
   de venderle el primer trago a nadie**, no despues de la primera discusion.
   Este riesgo hace crecer al 1, no lo reemplaza.
8. **Un sitio que acumula saldo en contra y cierra.** Con el pago en barra, un
   sitio nos va debiendo hasta que se liquida. El limite aprobado por operador es
   cero por defecto; cada reserva dura 15 minutos y una entrega redimida vence a
   siete dias. El limite, la deuda vencida y las reservas activas bloquean nuevas
   reservas de barra sin desactivar los pagos por app.
9. **Pasivo de devoluciones.** Una orden que caduca a los 45 dias no se asigna
   automaticamente: conserva una obligacion de devolver el precio bruto completo.
   Si hay costos no recuperables, salen inicialmente de fondos operativos. La
   conciliacion debe conservar la asignacion exacta pendiente hasta reconciliar
   deducciones y retenciones; el recibo del receptor y la compra verificada son
   hechos distintos.

---

## Como mantener este archivo

- Una decision que ya se tomo va a "Decisiones tomadas", con el porque en una
  linea. Ese porque es lo que evita rediscutirla.
- Una conclusion que salga de un experimento cerrado en
  `org/crecimiento/EXPERIMENTOS.md` sube aca. La bitacora guarda el intento;
  este archivo guarda lo que quedo.
- Un hallazgo va a "Deuda y hallazgos" con la ruta del archivo y **cuando**
  muerde, no solo que existe.
- Cuando algo del roadmap se construya, se mueve a "Estado" y se borra de la
  lista. Un roadmap que solo crece deja de leerse.
