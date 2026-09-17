# Revisión de fricción

Esta es una puerta obligatoria antes de construir, conservar o validar un paso
en un flujo de usuario u operación. Implementar una pantalla no demuestra que
deba existir.

## Las cuatro preguntas

Para cada clic, campo, pantalla, espera o confirmación adicional, dejar una
respuesta comprobable:

1. ¿Qué riesgo irreductible evita?
2. ¿Qué evidencia demuestra que ese riesgo sigue abierto en este punto?
3. ¿Una comprobación humana o técnica previa ya lo cubre?
4. Si hace falta, ¿cuál es la versión con menos trabajo y en qué momento devuelve valor?

Si no hay respuesta a la primera y segunda pregunta, el paso se elimina. Si la
respuesta a la tercera es sí, se elimina o se mueve después del momento de
valor. La fricción no se conserva por costumbre ni para compensar incertidumbre
del equipo.

## Ejemplo: alta de un sitio

El DM desde el Instagram declarado y la cita del correo de contacto son la
autorización humana para que operación apruebe. Pedir crear una cuenta antes de
aprobar no reduce un riesgo que esas comprobaciones dejen abierto: solo demora
la operación. La verificación del correo sí es necesaria antes de entregar
`owner`, porque prueba control del buzón que recibirá el panel. Por eso ocurre
después de la aprobación y se completa sin invitación ni aceptación adicional.

## Pedido con varios productos del mismo bar

El riesgo irreductible antes de cobrar es que todos los productos sigan publicados en el mismo bar
y con el precio, porcentaje, moneda y beneficiario que el servidor reconoce. Una pantalla de carrito
separada no reduce ese riesgo: la validación autoritativa al enviar sí. Por eso **Pedirlo** abre el
checkout con una unidad ya agregada y el checkout ofrece **Agregar algo más**, cantidades, medio de
pago y datos en la misma superficie.

Para una bebida se conserva el camino actual: elegir y pagar. Para dos distintas se agrega solo la
elección de la segunda. El carrito persistido evita repetir trabajo por una recarga, pero no puede
autorizar dinero: si el catálogo cambió, el checkout muestra la versión fresca y exige una nueva
acción de pago. Un carrito no cruza bares porque entrega, crédito, deuda y liquidación pertenecen a
un sitio concreto. El tope de 20 unidades es agregado y se aplica en controles y servidor.

## Al validar

- Probar el camino mínimo completo, no solo cada pantalla aislada.
- Probar el caso que no debe pasar: un correo distinto o no verificado no debe
  obtener acceso ni autoridad.
- Confirmar que el estado público se decide por su control real (`published`),
  no por haber terminado un paso anterior.
- Si la regla cambia un comportamiento reusable, registrarla en `PRODUCT.md` y
  preparar un handoff en `docs/plans/` para Hermes.
- Medir el camino mínimo: una bebida no suma pasos; dos bebidas distintas requieren una sola acción
  adicional antes de pagar. Reload, volver atrás y reabrir el navegador no pueden duplicar el seed.
