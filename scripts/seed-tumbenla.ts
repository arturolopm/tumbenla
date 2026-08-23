import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import process from 'node:process'
import postgres from 'postgres'

import {
  materialPurchase,
  materialPurchaseItem,
  materialPurchaseMedia,
  venue,
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
      'Un bar de barrio en Chapinero que lleva ocho anos con la misma rockola y la misma gente. Ponen mil pesos de cada cerveza.',
    addressLine: 'Calle 59 # 9-32',
    neighborhood: 'Chapinero',
    city: 'Bogota',
    department: 'Cundinamarca',
    latitude: '4.648600',
    longitude: '-74.062800',
    instagram: 'laguaridadelmono',
    openingHours: 'Mie a Sab, 5:00 p.m. a 2:00 a.m.',
    pledgeType: 'fixed_per_unit',
    pledgeAmount: '1000.00',
    pledgeUnit: 'cerveza',
    pledgeNote: 'Mil pesos por cerveza, todas las noches que abrimos.',
    status: 'published',
    featured: true,
    verifiedAt: new Date('2026-08-10'),
    verifiedNote: 'Confirmado por escrito con el dueno, con foto del aviso en la barra.',
    publishedAt: new Date('2026-08-11'),
  },
  {
    slug: 'discoteca-veneno',
    name: 'Veneno',
    type: 'discoteca',
    tagline: 'Reggaeton, perreo y el 10% de la noche del jueves.',
    description:
      'Discoteca grande en la Zona T. Los jueves completos van para material de construccion.',
    addressLine: 'Carrera 13 # 82-45',
    neighborhood: 'Zona T',
    city: 'Bogota',
    department: 'Cundinamarca',
    latitude: '4.666300',
    longitude: '-74.053400',
    instagram: 'venenobogota',
    openingHours: 'Jue a Sab, 9:00 p.m. a 4:00 a.m.',
    pledgeType: 'percentage',
    pledgePercentage: '10.00',
    pledgeBasis: 'ventas_totales',
    pledgeNote: 'El 10% de todo lo que se venda los jueves.',
    status: 'published',
    featured: true,
    verifiedAt: new Date('2026-08-12'),
    verifiedNote: 'Acuerdo firmado. Reportan ventas del jueves cada semana.',
    publishedAt: new Date('2026-08-12'),
  },
  {
    slug: 'el-tercer-piso',
    name: 'El Tercer Piso',
    type: 'terraza',
    tagline: 'Terraza, cocteles y vista a los cerros.',
    description: 'Terraza en Usaquen. Dos mil pesos de cada coctel.',
    addressLine: 'Calle 119 # 6-40, piso 3',
    neighborhood: 'Usaquen',
    city: 'Bogota',
    department: 'Cundinamarca',
    latitude: '4.695000',
    longitude: '-74.030000',
    instagram: 'eltercerpisobta',
    openingHours: 'Mar a Sab, 4:00 p.m. a 1:00 a.m.',
    pledgeType: 'fixed_per_unit',
    pledgeAmount: '2000.00',
    pledgeUnit: 'coctel',
    status: 'published',
    verifiedAt: new Date('2026-08-14'),
    verifiedNote: 'Confirmado por telefono con la administradora.',
    publishedAt: new Date('2026-08-14'),
  },
  {
    slug: 'salon-provenza',
    name: 'Salon Provenza',
    type: 'club',
    tagline: 'El 5% de todo, todos los dias.',
    description:
      'Club en Provenza. No escogieron una noche: ponen el 5% de todas las ventas, siempre.',
    addressLine: 'Carrera 35 # 8A-12',
    neighborhood: 'Provenza',
    city: 'Medellin',
    department: 'Antioquia',
    latitude: '6.209000',
    longitude: '-75.568000',
    instagram: 'salonprovenza',
    openingHours: 'Mie a Dom, 8:00 p.m. a 3:00 a.m.',
    pledgeType: 'percentage',
    pledgePercentage: '5.00',
    pledgeBasis: 'ventas_totales',
    pledgeNote: 'Cinco por ciento de todo. Sin dias especiales, sin letra menuda.',
    status: 'published',
    verifiedAt: new Date('2026-08-15'),
    verifiedNote: 'Acuerdo firmado con los dos socios.',
    publishedAt: new Date('2026-08-15'),
  },
  {
    slug: 'bar-la-nona',
    name: 'Bar La Nona',
    type: 'restobar',
    tagline: 'Comida, trago y tres mil pesos por botella.',
    description: 'Restobar en Laureles. Tres mil pesos por cada botella que sale.',
    addressLine: 'Circular 4 # 70-28',
    neighborhood: 'Laureles',
    city: 'Medellin',
    department: 'Antioquia',
    latitude: '6.245000',
    longitude: '-75.592000',
    instagram: 'barlanona',
    openingHours: 'Todos los dias, 12:00 p.m. a 12:00 a.m.',
    pledgeType: 'fixed_per_unit',
    pledgeAmount: '3000.00',
    pledgeUnit: 'botella',
    status: 'published',
    verifiedAt: new Date('2026-08-16'),
    verifiedNote: 'Confirmado en visita al sitio.',
    publishedAt: new Date('2026-08-16'),
  },
  {
    // Deliberately left in draft so the admin list has something unpublished and
    // /sitios can be checked for correctly hiding it.
    slug: 'club-manrique',
    name: 'Club Manrique',
    type: 'club',
    tagline: 'Todavia cuadrando el compromiso.',
    description: 'En conversacion. No aparece publico hasta que quede confirmado.',
    addressLine: 'Calle 67 # 45-10',
    neighborhood: 'Manrique',
    city: 'Medellin',
    department: 'Antioquia',
    latitude: '6.271000',
    longitude: '-75.555000',
    pledgeType: 'percentage',
    pledgePercentage: '7.00',
    pledgeBasis: 'ventas_licor',
    status: 'draft',
  },
]

const purchases = [
  {
    slug: 'cemento-y-bloques-agosto',
    title: 'Cemento y bloques, primera entrega',
    summary: 'Material para levantar dos muros de carga.',
    story:
      'Primera compra con lo que juntaron los sitios en las dos primeras semanas. Se entrego directo en obra.',
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
      { name: 'Cemento gris 50 kg', quantity: '40.00', unit: 'bulto', unitCost: '32000.00', subtotal: '1280000.00' },
      { name: 'Bloque estructural n.4', quantity: '600.00', unit: 'unidad', unitCost: '1900.00', subtotal: '1140000.00' },
      { name: 'Arena de pega', quantity: '3.00', unit: 'm3', unitCost: '140000.00', subtotal: '420000.00' },
    ],
  },
  {
    slug: 'tejas-y-madera-agosto',
    title: 'Tejas y madera para el techo',
    summary: 'Cubierta completa para una casa de dos cuartos.',
    story: 'Segunda entrega. El techo se cayo entero, asi que fue tejas, correas y puntillas.',
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
      { name: 'Teja de fibrocemento 2.44 m', quantity: '28.00', unit: 'lamina', unitCost: '48000.00', subtotal: '1344000.00' },
      { name: 'Correa de madera 3 m', quantity: '22.00', unit: 'unidad', unitCost: '26000.00', subtotal: '572000.00' },
      { name: 'Puntilla con arandela', quantity: '4.00', unit: 'unidad', unitCost: '11000.00', subtotal: '44000.00' },
    ],
  },
]

async function main() {
  console.log('Seeding Tumbenla sample data...')

  const existing = await db.select({ id: venue.id }).from(venue)
  if (existing.length > 0) {
    console.log(`Found ${existing.length} venues already. Nothing to do.`)
    console.log('To reseed from scratch: bun run db:reset && bun run scripts/seed-tumbenla.ts')
    return
  }

  await db.insert(venue).values(
    venues.map((v) => ({ id: createId(ID_PREFIX.venue), ...v }))
  )
  console.log(`  ${venues.length} venues`)

  for (const { items, receiptConsent, ...purchase } of purchases) {
    const purchaseId = createId(ID_PREFIX.materialPurchase)

    await db.insert(materialPurchase).values({ id: purchaseId, ...purchase })

    await db.insert(materialPurchaseItem).values(
      items.map((item, index) => ({
        id: createId(ID_PREFIX.materialPurchaseItem),
        purchaseId,
        position: (index * 10).toString(),
        ...item,
      }))
    )

    // The consent gate covers ALL media, not only photos of people. A receipt
    // can carry a delivery address, so it goes through the same check.
    await db.insert(materialPurchaseMedia).values({
      id: createId(ID_PREFIX.materialPurchaseMedia),
      purchaseId,
      kind: 'receipt',
      url: '/image.png',
      caption: 'Recibo de ejemplo. Reemplazar con el real.',
      consentGiven: receiptConsent,
      position: '0',
    })
  }
  console.log(`  ${purchases.length} purchases with items and one receipt each`)

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
