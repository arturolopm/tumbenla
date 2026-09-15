import { config } from 'dotenv'
import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import process from 'node:process'
import postgres from 'postgres'

import { allocationPolicy, commerceBeneficiary } from '../src/database/commerce-schema'
import {
  materialPurchase,
  materialPurchaseItem,
  materialPurchaseMedia,
  venue,
  venueProduct,
} from '../src/database/schema'
import { ID_PREFIX, createId } from '../src/lib/utils/id'

config()

/**
 * Development seed.
 *
 * EVERY VENUE HERE IS INVENTED. None of these are real businesses, and that is
 * deliberate: seeding with the name of an actual bar would publish a claim that
 * a real company pledged money it never pledged. The neighbourhoods and
 * coordinates are real so the map looks right; the businesses are not.
 *
 * Same for the purchases. The amounts are plausible for Colombian construction
 * materials but they are made up, and they are labelled as sample data.
 *
 * estimatedPerPersonNight es el APORTE por persona por noche, no el consumo:
 * es la cifra que /mi-historia multiplica por el numero de noches. Se deriva
 * del compromiso de cada sitio por un consumo tipico, y como todo lo demas
 * aca, es una estimacion de ejemplo.
 *
 * Run with: bun run scripts/seed-tumbenla.ts
 */

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed a production database.')
}

const client = postgres(connectionString, { max: 1 })
const db = drizzle(client)

const venues = [
  {
    slug: 'la-guarida-del-mono',
    name: 'La Guarida del Mono',
    type: 'bar',
    tagline: 'Cerveza fria y salsa hasta que cierre.',
    description:
      'Un bar de barrio en Palogrande que lleva ocho años con la misma rockola y la misma gente. Ponen mil pesos de cada cerveza.',
    addressLine: 'Carrera 23 # 64-18',
    neighborhood: 'Palogrande',
    city: 'Manizales',
    department: 'Caldas',
    latitude: '5.062000',
    longitude: '-75.493500',
    instagram: 'laguaridadelmono',
    openingHours: 'Mie a Sab, 5:00 p.m. a 2:00 a.m.',
    // Aporte estimado por persona por noche, NO lo que se gasta.
    // 1000 x cerveza, 4 cervezas por noche. Es lo que /mi-historia multiplica por las noches.
    estimatedPerPersonNight: '4000.00',
    status: 'published',
    featured: true,
    verifiedAt: new Date('2026-08-10'),
    verifiedNote: 'Confirmado por escrito con el dueño, con foto del aviso en la barra.',
    publishedAt: new Date('2026-08-11'),
  },
  {
    slug: 'discoteca-veneno',
    name: 'Veneno',
    type: 'discoteca',
    tagline: 'Reggaeton, perreo y el 10% de la noche del jueves.',
    description:
      'Discoteca grande en la zona del Cable. Los jueves completos van para material de construcción.',
    addressLine: 'Carrera 23 # 71-40',
    neighborhood: 'El Cable',
    city: 'Manizales',
    department: 'Caldas',
    latitude: '5.065500',
    longitude: '-75.490000',
    instagram: 'venenomanizales',
    openingHours: 'Jue a Sab, 9:00 p.m. a 4:00 a.m.',
    // Aporte estimado por persona por noche, NO lo que se gasta.
    // 10% de un consumo tipico de 90.000. Es lo que /mi-historia multiplica por las noches.
    estimatedPerPersonNight: '9000.00',
    status: 'published',
    featured: true,
    verifiedAt: new Date('2026-08-12'),
    verifiedNote: 'Acuerdo firmado. Reportan ventas del jueves cada semana.',
    publishedAt: new Date('2026-08-12'),
  },
  {
    slug: 'terraza-chipre',
    name: 'Terraza Chipre',
    type: 'terraza',
    tagline: 'Cócteles con el mejor atardecer de Colombia.',
    description: 'Terraza en Chipre, mirando al occidente. Dos mil pesos de cada cóctel.',
    addressLine: 'Calle 20 # 1-25, piso 3',
    neighborhood: 'Chipre',
    city: 'Manizales',
    department: 'Caldas',
    latitude: '5.074500',
    longitude: '-75.526500',
    instagram: 'terrazachipre',
    openingHours: 'Mar a Sab, 4:00 p.m. a 1:00 a.m.',
    // Aporte estimado por persona por noche, NO lo que se gasta.
    // 2000 x coctel, 3 cocteles por noche. Es lo que /mi-historia multiplica por las noches.
    estimatedPerPersonNight: '6000.00',
    status: 'published',
    verifiedAt: new Date('2026-08-14'),
    verifiedNote: 'Confirmado por telefono con la administradora.',
    publishedAt: new Date('2026-08-14'),
  },
  {
    slug: 'salon-milan',
    name: 'Salon Milan',
    type: 'club',
    tagline: 'El 5% de todo, todos los días.',
    description:
      'Club en Milan. No escogieron una noche: ponen el 5% de todas las ventas, siempre.',
    addressLine: 'Carrera 26 # 55-30',
    neighborhood: 'Milan',
    city: 'Manizales',
    department: 'Caldas',
    latitude: '5.056000',
    longitude: '-75.502000',
    instagram: 'salonmilanmzl',
    openingHours: 'Vie y Sab, 8:00 p.m. a 3:00 a.m.',
    // Aporte estimado por persona por noche, NO lo que se gasta.
    // 5% de un consumo tipico de 80.000. Es lo que /mi-historia multiplica por las noches.
    estimatedPerPersonNight: '4000.00',
    status: 'published',
    verifiedAt: new Date('2026-08-13'),
    verifiedNote: 'Confirmado en visita al sitio.',
    publishedAt: new Date('2026-08-13'),
  },
  {
    slug: 'bar-la-nona',
    name: 'Bar La Nona',
    type: 'restobar',
    tagline: 'Pizza, vino y tres mil pesos por botella.',
    description:
      'Restobar en el centro, al lado del Parque de Caldas. Tres mil pesos de cada botella de vino.',
    addressLine: 'Carrera 22 # 21-40',
    neighborhood: 'Centro',
    city: 'Manizales',
    department: 'Caldas',
    latitude: '5.068900',
    longitude: '-75.517400',
    instagram: 'barlanonamzl',
    openingHours: 'Mar a Dom, 12:00 m. a 11:00 p.m.',
    // Aporte estimado por persona por noche, NO lo que se gasta.
    // 3000 x botella, una botella entre varios. Es lo que /mi-historia multiplica por las noches.
    estimatedPerPersonNight: '3000.00',
    status: 'published',
    verifiedAt: new Date('2026-08-15'),
    verifiedNote: 'Confirmado con el administrador.',
    publishedAt: new Date('2026-08-15'),
  },
  {
    slug: 'billar-la-enea',
    name: 'Billar La Enea',
    type: 'billar',
    tagline: 'Mesas, pola y quinientos por cada una.',
    description:
      'Billar de toda la vida en La Enea. Todavía estamos confirmando el compromiso, por eso no aparece publicado.',
    addressLine: 'Calle 74 # 23-15',
    neighborhood: 'La Enea',
    city: 'Manizales',
    department: 'Caldas',
    latitude: '5.033000',
    longitude: '-75.473000',
    openingHours: 'Lun a Sab, 2:00 p.m. a 12:00 a.m.',
    // Aporte estimado por persona por noche, NO lo que se gasta.
    // 500 x cerveza, 5 cervezas por noche. Es lo que /mi-historia multiplica por las noches.
    estimatedPerPersonNight: '2500.00',
    status: 'draft',
  },
]

const purchases = [
  {
    slug: 'cemento-y-bloques-agosto',
    title: 'Cemento y bloques, primera entrega',
    summary: 'Material para levantar dos muros de carga.',
    story:
      'Primera compra con lo que juntaron los sitios en las dos primeras semanas. Se entregó directo en obra.',
    municipality: 'Municipio por confirmar',
    department: 'Departamento por confirmar',
    beneficiaryLabel: 'Una familia del sector',
    householdsHelped: '1',
    totalAmount: '2840000.00',
    purchasedAt: new Date('2026-08-18'),
    supplierName: 'Deposito de materiales (nombre de ejemplo)',
    receiptNumber: 'EJEMPLO-0001',
    status: 'published',
    publishedAt: new Date('2026-08-19'),
    // Placeholder image with nothing personal on it, so it can be shown.
    receiptConsent: true,
    items: [
      {
        name: 'Cemento gris 50 kg',
        quantity: '40.00',
        unit: 'bulto',
        unitCost: '32000.00',
        subtotal: '1280000.00',
      },
      {
        name: 'Bloque estructural n.4',
        quantity: '600.00',
        unit: 'unidad',
        unitCost: '1900.00',
        subtotal: '1140000.00',
      },
      {
        name: 'Arena de pega',
        quantity: '3.00',
        unit: 'm3',
        unitCost: '140000.00',
        subtotal: '420000.00',
      },
    ],
  },
  {
    slug: 'tejas-y-madera-agosto',
    title: 'Tejas y madera para el techo',
    summary: 'Cubierta completa para una casa de dos cuartos.',
    story: 'Segunda entrega. El techo se cayó entero, así que fue tejas, correas y puntillas.',
    municipality: 'Municipio por confirmar',
    department: 'Departamento por confirmar',
    beneficiaryLabel: 'Una familia del sector',
    householdsHelped: '1',
    totalAmount: '1960000.00',
    purchasedAt: new Date('2026-08-21'),
    supplierName: 'Deposito de materiales (nombre de ejemplo)',
    receiptNumber: 'EJEMPLO-0002',
    status: 'published',
    publishedAt: new Date('2026-08-22'),
    // Left unconsented on purpose: this is what an evidence record looks like
    // before someone has actually made the consent decision, and the public
    // page must withhold it.
    receiptConsent: false,
    items: [
      {
        name: 'Teja de fibrocemento 2.44 m',
        quantity: '28.00',
        unit: 'lamina',
        unitCost: '48000.00',
        subtotal: '1344000.00',
      },
      {
        name: 'Correa de madera 3 m',
        quantity: '22.00',
        unit: 'unidad',
        unitCost: '26000.00',
        subtotal: '572000.00',
      },
      {
        name: 'Puntilla con arandela',
        quantity: '4.00',
        unit: 'unidad',
        unitCost: '11000.00',
        subtotal: '44000.00',
      },
    ],
  },
]

/**
 * La carta de cada sitio.
 *
 * NO ES ADORNO DEL SEED. Desde la decision 34 la tarjeta y el pin de un sitio
 * salen de lo que entrego y de lo que pone su trago mas barato, asi que un
 * sitio sin productos sale sin etiqueta y con el pin apagado. Sin estas filas
 * el mapa local se ve roto y no hay como revisar nada de lo que se construyo.
 *
 * Las cifras son las del compromiso viejo de cada sitio, traducidas a un
 * producto, para que quien conozca el seed reconozca los numeros. Todo esto
 * sigue siendo inventado, igual que los sitios.
 */
const PRODUCTOS: Record<string, { name: string; kind: string; price: string; pct: string }[]> = {
  'la-guarida-del-mono': [
    { name: 'Cerveza de la casa', kind: 'cerveza', price: '8000.00', pct: '40.00' },
    { name: 'Michelada Palogrande', kind: 'coctel', price: '14000.00', pct: '40.00' },
  ],
  'discoteca-veneno': [
    { name: 'Coctel Veneno', kind: 'coctel', price: '28000.00', pct: '50.00' },
    { name: 'Botella entera', kind: 'botella', price: '180000.00', pct: '40.00' },
  ],
  'terraza-chipre': [
    { name: 'Coctel del mirador', kind: 'coctel', price: '26000.00', pct: '60.00' },
  ],
  'bar-la-nona': [
    { name: 'Mojito Reconstrucción', kind: 'coctel', price: '30000.00', pct: '80.00' },
    { name: 'Cerveza de la casa', kind: 'cerveza', price: '8000.00', pct: '50.00' },
  ],
  // salon-milan se deja SIN CARTA a proposito, y esta publicado: hace falta un
  // sitio asi para ver en local como se ve uno del que todavia no se puede
  // pedir nada —pin apagado, sin anillo, sin etiqueta—, que es como nace todo
  // sitio nuevo. bar-la-nona si lleva carta porque es el sitio con el que se
  // prueba el flujo de pedido y escaneo punta a punta.
}

const seedProductos = async (venueIds: Record<string, string>) => {
  const filas = Object.entries(PRODUCTOS).flatMap(([slug, productos]) =>
    productos.map((producto) => ({
      id: createId(ID_PREFIX.venueProduct),
      venueId: venueIds[slug],
      slug: producto.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      name: producto.name,
      kind: producto.kind,
      price: producto.price,
      donationPercentage: producto.pct,
      status: 'published',
      publishedAt: new Date('2026-08-20'),
    }))
  )

  await db.insert(venueProduct).values(filas).onConflictDoNothing()
  console.log(`  ${filas.length} products across ${Object.keys(PRODUCTOS).length} venues`)
}

async function main() {
  console.log('Seeding Tumbenla sample data...')

  const verifiedFoundations = await db
    .select({ id: commerceBeneficiary.id })
    .from(commerceBeneficiary)
    .where(
      and(eq(commerceBeneficiary.kind, 'foundation'), eq(commerceBeneficiary.status, 'verified'))
    )

  if (verifiedFoundations.length > 1) {
    throw new Error('Payment testing requires exactly one verified foundation.')
  }
  if (verifiedFoundations.length === 0) {
    await db
      .insert(commerceBeneficiary)
      .values({
        id: createId('cbn'),
        kind: 'foundation',
        legalName: 'Fundación local de prueba',
        legalIdentifierHash: 'local-sample-foundation-identifier',
        status: 'verified',
        verifiedAt: new Date(),
      })
      .onConflictDoNothing()
  }

  const now = new Date()
  const activePolicies = await db
    .select({ id: allocationPolicy.id })
    .from(allocationPolicy)
    .where(
      and(
        lte(allocationPolicy.effectiveAt, now),
        or(isNull(allocationPolicy.retiredAt), gt(allocationPolicy.retiredAt, now))
      )
    )

  if (activePolicies.length === 0) {
    const [latestPolicy] = await db
      .select({ version: allocationPolicy.version })
      .from(allocationPolicy)
      .orderBy(desc(allocationPolicy.version))
      .limit(1)

    await db.insert(allocationPolicy).values({
      id: createId('alp'),
      version: (latestPolicy?.version ?? 0) + 1,
      name: 'Política local de prueba',
      effectiveAt: now,
    })
  }

  const readyFoundations = await db
    .select({ id: commerceBeneficiary.id })
    .from(commerceBeneficiary)
    .where(
      and(eq(commerceBeneficiary.kind, 'foundation'), eq(commerceBeneficiary.status, 'verified'))
    )
  const readyPolicies = await db
    .select({ id: allocationPolicy.id })
    .from(allocationPolicy)
    .where(
      and(
        lte(allocationPolicy.effectiveAt, now),
        or(isNull(allocationPolicy.retiredAt), gt(allocationPolicy.retiredAt, now))
      )
    )

  if (readyFoundations.length !== 1 || readyPolicies.length < 1) {
    throw new Error('Could not create the local payment testing prerequisites.')
  }
  console.log('  payment prerequisites ready')

  const insertedVenues = await db
    .insert(venue)
    .values(venues.map((v) => ({ id: createId(ID_PREFIX.venue), ...v })))
    .onConflictDoNothing()
    .returning({ slug: venue.slug })
  console.log(
    `  ${insertedVenues.length} venues added, ${venues.length - insertedVenues.length} already present`
  )

  let insertedPurchaseCount = 0
  for (const { items, receiptConsent, ...purchase } of purchases) {
    const [insertedPurchase] = await db
      .insert(materialPurchase)
      .values({ id: createId(ID_PREFIX.materialPurchase), ...purchase })
      .onConflictDoNothing()
      .returning({ id: materialPurchase.id })

    if (!insertedPurchase) continue
    insertedPurchaseCount += 1

    await db.insert(materialPurchaseItem).values(
      items.map((item, index) => ({
        id: createId(ID_PREFIX.materialPurchaseItem),
        purchaseId: insertedPurchase.id,
        position: (index * 10).toString(),
        ...item,
      }))
    )

    // The consent gate covers ALL media, not only photos of people. A receipt
    // can carry a delivery address, so it goes through the same check.
    await db.insert(materialPurchaseMedia).values({
      id: createId(ID_PREFIX.materialPurchaseMedia),
      purchaseId: insertedPurchase.id,
      kind: 'receipt',
      url: '/image.png',
      caption: 'Recibo de ejemplo. Reemplazar con el real.',
      consentGiven: receiptConsent,
      position: '0',
    })
  }
  console.log(
    `  ${insertedPurchaseCount} purchases added, ${purchases.length - insertedPurchaseCount} already present`
  )

  const filas = await db.select({ id: venue.id, slug: venue.slug }).from(venue)
  await seedProductos(Object.fromEntries(filas.map((f) => [f.slug, f.id])))

  console.log('Done.')
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await client.end()
  })
