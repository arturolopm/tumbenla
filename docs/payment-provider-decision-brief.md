# Decisión de pasarela de pago — ePayco

Fecha de decisión: 2026-09-11
Estado: decisión de producto tomada; la implementación del plan está autorizada. La
apertura de la cuenta comercial, contratos, transferencias reales, despliegue y demás
compuertas externas siguen pendientes.

## Decisión vigente

Tumbenla valida **ePayco Hosted Smart Checkout v2** como el primer proveedor de cobro
para el MVP colombiano. El comprador paga en la experiencia alojada por ePayco (tarjeta
crédito, débito y PSE cuando estén habilitados para la cuenta); Tumbenla conserva el
pedido, la entrega, el libro y el estado de reconciliación.

El dinero no se reparte automáticamente en checkout. Después de reconciliar cada cobro,
sus deducciones y retenciones aplicables, la operación prepara y revisa **transferencias
bancarias manuales** al bar y al receptor de impacto verificado. La implementación del
plan está autorizada; abrir la cuenta comercial, contratar, configurar credenciales,
ejecutar transferencias reales y desplegar siguen sujetos a las compuertas externas.

## Modelo de dinero vigente

1. El comprador paga un producto concreto en el checkout alojado de ePayco.
2. ePayco confirma el cobro; una respuesta del navegador nunca basta para marcarlo pagado.
3. El establecimiento prepara y entrega el producto contra el QR de la orden.
4. Tumbenla reconcilia el bruto, cada deducción itemizada y la retención aplicable. La
   asignación de impacto se calcula sobre el neto real reconciliado, no sobre el bruto ni
   sobre una comisión estimada.
5. El porcentaje queda fijo y visible desde la compra; el peso exacto de la asignación
   permanece **pendiente** hasta esa reconciliación. No se muestra una cifra inventada.
6. La operación revisa y ejecuta transferencias bancarias por instrucciones fijas, con
   beneficiario verificado, referencia y evidencia. El recibo del receptor de impacto y
   la compra de material verificada son hechos distintos.

Música para la Paz es el candidato inicial para el receptor de impacto, **pendiente de
verificar** identidad, facultades, cuenta bancaria, acuerdo y capacidad de administrar el
destino acordado. No es todavía un beneficiario habilitado.

Las órdenes de app no reclamadas vencen a los 45 días y conservan una obligación de
reembolso: no se asignan automáticamente al impacto. Un reembolso elegible devuelve el
precio bruto completo; Tumbenla cubre desde fondos operativos los costos no recuperables.

El pago en la barra usa el límite aprobado por operador, que por defecto es cero. Una
reserva dura 15 minutos; una entrega redimida genera deuda con vencimiento a siete días.

## Investigación conservada y decisión supersedida

La investigación anterior sobre **ePayco Pagos Divididos** y sus modelos uno-a-uno y
uno-a-muchos se conserva como descubrimiento histórico. Esa ruta de split automático queda
**supersedida** para este release: no es una dependencia del checkout ni una promesa de
dispersión. La documentación de split sigue siendo una alternativa futura, sujeta a
elegibilidad y contrato, no el modelo aprobado hoy.

## Por qué ePayco

- El checkout alojado mantiene las credenciales de tarjeta fuera de Tumbenla y documenta
  card/debit/PSE; la disponibilidad efectiva debe confirmarse para la cuenta aprobada.
- La plataforma puede separar la confirmación del cobro, la reconciliación de deducciones
  y la transferencia manual revisada, que son hechos contables diferentes.
- El diseño no depende de activar Pagos Divididos ni de que ePayco permita registrar una
  ESAL como receptor automático.

## Preguntas externas antes de onboarding o integración

ePayco debe confirmar por escrito:

1. Elegibilidad de Tumbenla para cobrar los productos del bar y qué comercio, razón social
   y NIT aparecerán en el comprobante.
2. Habilitación real de tarjeta crédito, débito y PSE, límites por cuenta, estados
   pendientes y protección contra facturas duplicadas.
3. Consulta servidor-a-servidor de transacciones, campos confiables para monto, moneda,
   ambiente y referencia, y comportamiento de reintentos.
4. Reportes de deducciones y retenciones con desglose suficiente para reconciliar el neto.
5. Procedimiento documentado para reembolsos, contracargos, reversos, reservas y saldos no
   recuperables. No se asume una API universal de reembolso.
6. Requisitos de facturación, información al consumidor, KYC y responsabilidades de
   Tumbenla y cada bar.

Música para la Paz debe confirmar por escrito:

1. Identidad legal, facultades, régimen aplicable, cuenta bancaria y capacidad para recibir
   y administrar el destino acordado.
2. Aceptación del modelo de transferencia manual revisada, la trazabilidad, los reportes y
   el tratamiento de reembolsos o disputas.
3. Que el recibo de fondos se registrará separado de cada compra de material verificada.
4. Que no se comunicará deducibilidad tributaria al comprador sin concepto legal y contable
   aplicable.

## Límites y estado de verificación

La selección de ePayco no prueba elegibilidad, contrato, configuración de recibos,
tratamiento tributario, habilitación de medios, reglas de deducción o aprobación de la
cuenta. La candidatura de Música para la Paz tampoco prueba que pueda recibir fondos.
No se han realizado onboarding, sandbox, transacción, reembolso, transferencia ni prueba
de almacenamiento R2 como consecuencia de esta decisión.

## Fuentes oficiales consultadas

- ePayco, [implementación de Checkout](https://docs.epayco.com/docs/checkout-implementacion), consultado el 2026-09-11.
- ePayco, [respuesta y confirmación](https://docs.epayco.com/docs/checkout-respuesta-y-confirmacion), consultado el 2026-09-11.
- ePayco, [tablas de medios y estados](https://docs.epayco.com/docs/checkout-tablas-de-datos), consultado el 2026-09-11.
- ePayco, [Pagos Divididos](https://epayco.com/pagos-divididos/), consultado el 2026-09-11; conservado como investigación supersedida.
- ePayco, [Pagos divididos Agregador](https://docs.epayco.com/docs/split-descripcion), consultado el 2026-09-11; conservado como investigación supersedida.

## Próximo resultado concreto

Obtener las confirmaciones escritas de ePayco y Música para la Paz, capturar fixtures
sanitizados de sandbox y verificar R2. Si una respuesta bloquea el modelo, registrar el
bloqueo y revisar la arquitectura sin presentar el split automático como disponible.
