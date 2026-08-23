/**
 * Datos del sismo.
 *
 * PENDIENTE DE VERIFICACION. Nada de esto se publica hasta confirmarlo con una
 * fuente oficial: Servicio Geologico Colombiano (sgc.gov.co) o UNGRD
 * (portal.gestiondelriesgo.gov.co).
 *
 * Por que existe este archivo en vez de escribir las cifras en el JSX: este
 * sitio le pide plata a la gente, o casi. Publicar una magnitud inventada o un
 * numero de damnificados inflado destruiria justamente lo unico que sostiene el
 * producto. Con `verificado: false` los componentes muestran un estado de "dato
 * por confirmar" en vez de una cifra, y nunca hay un numero suelto incrustado
 * en un componente donde nadie lo pueda auditar.
 *
 * Para activarlo: llenar los campos, poner `fuenteUrl`, y cambiar `verificado`
 * a true. Un solo archivo, un solo cambio.
 */
export type ContextoSismo = {
  verificado: boolean
  fecha: string | null
  magnitud: number | null
  epicentro: string | null
  municipiosAfectados: string[]
  viviendasAfectadas: number | null
  fuenteNombre: string | null
  fuenteUrl: string | null
}

export const CONTEXTO_SISMO: ContextoSismo = {
  verificado: false,
  fecha: null,
  magnitud: null,
  epicentro: null,
  municipiosAfectados: [],
  viviendasAfectadas: null,
  fuenteNombre: null,
  fuenteUrl: null,
}

/**
 * Usar esto en vez de leer los campos directo. Devuelve null cuando el dato no
 * esta verificado, para que sea imposible renderizar una cifra sin fuente por
 * descuido.
 */
export const datoVerificado = <K extends keyof ContextoSismo>(
  campo: K
): ContextoSismo[K] | null => {
  if (!CONTEXTO_SISMO.verificado) return null
  return CONTEXTO_SISMO[campo]
}
