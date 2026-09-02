/**
 * El reparto de un trago, en pesos.
 *
 * Se guarda UN porcentaje en `venue_product`, no dos. La parte del sitio es el
 * resto, asi que el estado invalido —dos numeros que no suman 100— no se puede
 * ni representar. Este archivo es el unico lugar donde ese porcentaje se
 * convierte en plata.
 *
 * EL REDONDEO ESTA DEFINIDO DE UNA VEZ Y NO SE DISCUTE OTRA VEZ: la parte de
 * material se redondea al peso, y la del sitio es la RESTA. Nunca se redondean
 * las dos por separado, porque asi es como aparecen los cien pesos que no
 * cuadran: 33% de $25.000 da 8.250 y 67% da 16.750, pero con un porcentaje que
 * no sea entero las dos mitades redondeadas dejan de sumar el precio. Restando,
 * suman exacto siempre, por construccion.
 *
 * El peso colombiano no usa centavos. Las columnas son decimal(12,2) porque el
 * resto del esquema lo es, pero los valores que produce este archivo son pesos
 * enteros.
 */

/** El reparto de UNA unidad. Las dos partes suman el precio, exacto. */
export type Reparto = {
  /** Lo que se va en material. */
  material: number
  /** Lo que se queda el sitio. */
  sitio: number
}

/**
 * Reparte el precio de una unidad segun el porcentaje que va a material.
 *
 * @param precioUnitario en pesos enteros
 * @param porcentajeMaterial 0 a 100
 */
export const repartir = (precioUnitario: number, porcentajeMaterial: number): Reparto => {
  if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
    throw new Error(`Precio invalido: ${precioUnitario}`)
  }
  if (!Number.isFinite(porcentajeMaterial) || porcentajeMaterial < 0 || porcentajeMaterial > 100) {
    throw new Error(`Porcentaje invalido: ${porcentajeMaterial}`)
  }

  const material = Math.round((precioUnitario * porcentajeMaterial) / 100)
  return { material, sitio: precioUnitario - material }
}

/**
 * Lo que se guarda en `product_order`, ya calculado.
 *
 * Los montos son POR UNIDAD porque cada unidad se escanea aparte y publica sus
 * propios asientos. Dividir un total entre la cantidad en el momento de
 * publicar volveria a meter el redondeo que esto existe para evitar.
 */
export type MontosDeOrden = {
  unitPrice: number
  unitDonationAmount: number
  unitVenueAmount: number
  totalAmount: number
}

export const montosDeOrden = (
  precioUnitario: number,
  porcentajeMaterial: number,
  cantidad: number
): MontosDeOrden => {
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new Error(`Cantidad invalida: ${cantidad}`)
  }

  const { material, sitio } = repartir(precioUnitario, porcentajeMaterial)

  return {
    unitPrice: precioUnitario,
    unitDonationAmount: material,
    unitVenueAmount: sitio,
    totalAmount: precioUnitario * cantidad,
  }
}

/**
 * Como se le dice el reparto a la gente.
 *
 * EN PESOS, NUNCA COMO "DONACION" (VOZ.md, y `PRODUCT.md` decisiones 16 y 30).
 * El porcentaje suelto es abstracto; los pesos se verifican despues contra la
 * factura publicada. Esta funcion existe para que no haya dos formas de
 * escribirlo regadas por los componentes.
 */
export const textoDelReparto = (precioUnitario: number, porcentajeMaterial: number): string => {
  const { material, sitio } = repartir(precioUnitario, porcentajeMaterial)
  const pesos = (n: number) => `$${n.toLocaleString('es-CO')}`

  if (sitio === 0) {
    return `De ${pesos(precioUnitario)}: los ${pesos(precioUnitario)} se van en material.`
  }

  return `De ${pesos(precioUnitario)}: ${pesos(material)} se van en material. ${pesos(sitio)} se quedan en el sitio.`
}
