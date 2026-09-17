import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Execute the actual modules with isolated IO; no database, sessions or seed changes.
const require = createRequire(import.meta.url)
const read = (path) => readFileSync(path, 'utf8')
const load = (path, mocks, suffix = '') => {
  const { outputText } = ts.transpileModule(read(path) + suffix, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  })
  const exports = {}
  runInNewContext(
    outputText,
    {
      exports,
      require: (id) => {
        if (id in mocks) return mocks[id]
        if (!id.startsWith('@/') && !id.startsWith('next/')) return require(id)
        throw new Error(`Unmocked dependency: ${id}`)
      },
      FormData,
      Date,
      Set,
    },
    { filename: path }
  )
  return exports
}
let failures = 0
let checks = 0
const check = async (name, run) => {
  try {
    await run()
    checks++
    console.log(`PASS ${name}`)
  } catch (error) {
    failures++
    console.error(`FAIL ${name}: ${error.message.split('\n')[0]}`)
  }
}
let actor = 'staff'
let resourceVenue = 'venue-a'
let productStatus = 'published'
let productDonationPercentage = '80.00'
let writes = 0
let orderReads = 0
const table = (name) =>
  new Proxy({ name }, { get: (target, key) => target[key] ?? `${name}.${key}` })
const schema = Object.fromEntries(
  ['venue', 'venueProduct', 'productOrder', 'venueMember'].map((name) => [name, table(name)])
)
const db = {
  select: () => {
    let selected
    let filter
    const query = {
      from: (value) => {
        selected = value
        return query
      },
      innerJoin: () => query,
      where: (value) => {
        filter = value
        return query
      },
      limit: async () =>
        selected === schema.venueMember
          ? actor === 'outsider' ||
            filter?.some(
              (condition) =>
                condition.column === 'venueMember.venueId' && condition.value !== 'venue-a'
            )
            ? []
            : [{ role: actor === 'owner' ? 'owner' : 'staff' }]
          : [
              {
                id: resourceVenue,
                venueId: resourceVenue,
                slug: 'bar-a',
                status: productStatus,
                donationPercentage: productDonationPercentage,
              },
            ],
      then: (resolve) => {
        orderReads++
        return Promise.resolve([]).then(resolve)
      },
    }
    return query
  },
  update: () => {
    writes++
    return { set: () => ({ where: async () => {} }) }
  },
  insert: () => {
    writes++
    return { values: () => ({ returning: async () => [{ id: 'new-product' }] }) }
  },
}
const operators = {
  eq: (column, value) => ({ column, value }),
  and: (...conditions) => conditions,
  asc: (value) => value,
}
const denied = new Error('NOT_FOUND')
const access = load('src/lib/auth/venue-access.ts', {
  'server-only': {},
  'drizzle-orm': operators,
  '@/database': { db },
  '@/database/schema': schema,
  'next/headers': { headers: async () => ({}) },
  'next/navigation': {
    notFound: () => {
      throw denied
    },
    redirect: () => {
      throw denied
    },
  },
  './auth': {
    auth: {
      api: {
        getSession: async () =>
          actor === 'guest'
            ? null
            : { user: { id: 'user-a', email: actor, emailVerified: actor !== 'unverified' } },
      },
    },
  },
  './admin': { isAdminEmail: (email, verified) => email === 'operator' && verified },
})
const actions = load('src/app/actions/carta.ts', {
  '@/database': { db },
  '@/database/schema': schema,
  '@/config/env': { env: {} },
  '@/lib/auth/venue-access': access,
  '@/lib/comercio/types': {
    KINDS_DE_PRODUCTO: ['coctel'],
    PORCENTAJE_MINIMO_DE_RECONSTRUCCION: 40,
  },
  '@/lib/storage': { storage: {} },
  '@/lib/utils/id': { createId: () => 'image-id' },
  'next/cache': { revalidatePath: () => {} },
})
const form = (edit = false, donationPercentage = '80') => {
  const data = new FormData()
  for (const [key, value] of Object.entries({
    venueId: 'venue-a',
    name: 'Test cocktail',
    kind: 'coctel',
    price: '30000',
    donationPercentage,
  }))
    data.set(key, value)
  if (edit) data.set('id', 'product-a')
  return data
}
const mutations = [
  ['create', () => actions.guardarProductoAction({ status: 'idle' }, form())],
  ['edit', () => actions.guardarProductoAction({ status: 'idle' }, form(true))],
  [
    'publish',
    () => {
      productStatus = 'draft'
      return actions.mandarARevisionAction('product-a')
    },
  ],
  [
    'pause',
    () => {
      productStatus = 'published'
      return actions.pausarProductoAction('product-a', true)
    },
  ],
  [
    'resume',
    () => {
      productStatus = 'paused'
      return actions.pausarProductoAction('product-a', false)
    },
  ],
  ['archive', () => actions.archivarProductoAction('product-a')],
]
for (const role of ['staff', 'guest', 'unverified', 'outsider', 'owner', 'operator']) {
  for (const [name, run] of mutations)
    await check(`${role}: ${name}`, async () => {
      actor = role
      resourceVenue = 'venue-a'
      writes = 0
      const result = await run()
      const allowed = role === 'owner' || role === 'operator'
      assert.equal(result.status, allowed ? 'success' : 'error')
      assert.equal(writes, allowed ? 1 : 0)
    })
  await check(`${role}: order count`, async () => {
    actor = role
    orderReads = 0
    await actions.contarOrdenesDeProducto('product-a')
    assert.equal(orderReads, role === 'owner' || role === 'operator' ? 1 : 0)
  })
}
await check('owner: rejects a product below 40%', async () => {
  actor = 'owner'
  resourceVenue = 'venue-a'
  writes = 0
  const result = await actions.guardarProductoAction({ status: 'idle' }, form(false, '39'))
  assert.equal(result.status, 'error')
  assert.equal(writes, 0)
})
await check('owner: cannot publish a legacy product below 40%', async () => {
  actor = 'owner'
  resourceVenue = 'venue-a'
  productStatus = 'draft'
  productDonationPercentage = '39.00'
  writes = 0
  const result = await actions.mandarARevisionAction('product-a')
  assert.equal(result.status, 'error')
  assert.equal(writes, 0)
  productDonationPercentage = '80.00'
})
for (const [name, run] of mutations.filter(([name]) => name !== 'create'))
  await check(`forged venue on ${name}`, async () => {
    actor = 'owner'
    resourceVenue = 'venue-b'
    writes = 0
    assert.equal((await run()).status, 'error')
    assert.equal(writes, 0)
  })
resourceVenue = 'venue-a'
for (const route of [
  'carta',
  'cuenta',
  'equipo',
  'sitio',
  'noches',
  'noches/[nightId]',
  'fotos',
  'escanear',
]) {
  await check(`route ${route} authorizes before reading panel data`, async () => {
    const path = `src/app/(panel)/panel/[slug]/${route}/page.tsx`
    const source = ts.createSourceFile(
      path,
      read(path),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    )
    const allowed = new Error('AUTHORIZED')
    const unavailable = new Proxy(
      {},
      {
        get: (_, name) => () => {
          throw new Error(`Data accessed before authorization: ${String(name)}`)
        },
      }
    )
    const mocks = {}
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement)) mocks[statement.moduleSpecifier.text] = unavailable
    }
    mocks['react/jsx-runtime'] = require('react/jsx-runtime')
    mocks['next/navigation'] = {
      notFound: () => {
        throw denied
      },
    }
    mocks['@/lib/auth/venue-access'] = {
      getVenueForPanel: async () => ({ id: 'venue-a' }),
      requireVenueAccess: async (...args) => {
        await access.requireVenueAccess(...args)
        throw allowed
      },
    }
    const page = load(path, mocks).default
    for (const role of ['staff', 'owner', 'operator', 'outsider', 'guest']) {
      actor = role
      const canEnter =
        role === 'owner' || role === 'operator' || (role === 'staff' && route === 'escanear')
      await assert.rejects(
        () =>
          page({
            params: Promise.resolve({ slug: 'bar-a', nightId: 'night-a' }),
            searchParams: Promise.resolve({}),
          }),
        (error) => error === (canEnter ? allowed : denied)
      )
    }
  })
}
await check('legacy contribution routes redirect to the settlement flow', () => {
  const panelRoute = read('src/app/(panel)/panel/[slug]/aportes/page.tsx')
  const adminRoute = read('src/app/(admin)/admin/aportes/page.tsx')

  assert.match(panelRoute, /redirect\(`\/panel\/\$\{slug\}\/cuenta`\)/)
  assert.match(adminRoute, /redirect\('\/admin\/cuentas'\)/)
  assert.doesNotMatch(panelRoute, /AportesPanel|listContributionsForPanel|requireVenueAccess/)
  assert.doesNotMatch(adminRoute, /AportesCola|listContributionsForAdmin|listPurchasesForLinking/)
})
await check('manual contribution actions and interfaces are removed', () => {
  for (const path of [
    'src/app/actions/aportes.ts',
    'src/components/panel/aportes-panel.tsx',
    'src/components/admin/aportes-cola.tsx',
  ])
    assert.equal(existsSync(path), false)
})
await check('staff navigation contains only scanning', () => {
  const stub = new Proxy({}, { get: () => () => null })
  const shell = load(
    'src/components/panel/panel-shell.tsx',
    {
      'next/link': stub,
      'next/navigation': stub,
      '@/components/ui/sidebar': stub,
      '@/components/layout/account-menu': stub,
    },
    '\nexport { items as testItems }'
  )
  assert.equal(
    JSON.stringify(shell.testItems('bar-a', false).map((item) => item.href)),
    JSON.stringify(['/panel/bar-a/escanear'])
  )
  assert.ok(shell.testItems('bar-a', true).some((item) => item.href.endsWith('/carta')))
})
for (const file of ['carta', 'mi-sitio', 'noches', 'equipo'])
  await check(`${file}: every management access call requires owner`, () => {
    const text = read(`src/app/actions/${file}.ts`)
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
    const visit = (node) => {
      if (ts.isCallExpression(node) && node.expression.getText(source) === 'assertVenueAccess') {
        assert.equal(node.arguments[1]?.getText(source), "['owner']")
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  })
for (const path of [
  'src/components/layout/le-entro.tsx',
  'src/app/(publico)/page.tsx',
  'src/app/(publico)/como-funciona/page.tsx',
  'src/app/(publico)/registrar-sitio/page.tsx',
  'src/components/layout/site-footer.tsx',
  'src/app/(publico)/sitios/page.tsx',
  'src/app/(publico)/sitios/[slug]/page.tsx',
  'src/app/(publico)/transparencia/page.tsx',
  'src/app/(publico)/mi-historia/page.tsx',
  'src/components/commerce/customer-orders.tsx',
  'src/app/(publico)/terminos/page.tsx',
  'src/app/(publico)/privacidad/page.tsx',
  'src/app/layout.tsx',
  'src/app/manifest.ts',
  'src/lib/seo.ts',
  'src/app/_og/imagen.tsx',
])
  await check(`public copy: ${path}`, () => {
    const text = read(path).replace(/\s+/g, ' ')
    assert.doesNotMatch(
      text,
      /porcentaje de la noche|plata fija|parte de lo que te tomas|parte de sus ventas|plata no pasa|no procesamos pagos|verificamos el compromiso|cada trago es un ladrillo|clientes nuevos|promociones gratis/i
    )
    if (
      path === 'src/app/(publico)/page.tsx' ||
      path === 'src/app/(publico)/como-funciona/page.tsx' ||
      path === 'src/app/(publico)/sitios/[slug]/page.tsx' ||
      path === 'src/app/(publico)/terminos/page.tsx'
    ) {
      assert.match(text, /pesos/i)
      assert.match(text, /producto|trago|cóctel/i)
      assert.match(text, /material/i)
    }
  })
await check('canonical public message', () => {
  const home = read('src/app/(publico)/page.tsx')
  assert.match(home, /El ritmo nos levanta/)
  assert.match(home, /Tumbenla/)
  assert.match(home, /y volvamosla a parar/)
  assert.match(home, /href=['"]\/sitios['"]/, 'homepage map CTA')
  assert.match(read('src/components/layout/le-entro.tsx'), /href=['"]\/registrar-sitio['"]/)
})
await check('public copy does not fix a launch city', () => {
  for (const path of [
    'src/app/(publico)/page.tsx',
    'src/app/(publico)/como-funciona/page.tsx',
    'src/app/(publico)/registrar-sitio/page.tsx',
    'src/app/(publico)/sitios/page.tsx',
    'src/app/layout.tsx',
    'src/app/manifest.ts',
    'src/lib/seo.ts',
    'src/app/_og/imagen.tsx',
  ]) {
    assert.doesNotMatch(read(path), /Manizales|Arrancamos en/i, path)
  }
})
await check('public accounting labels are current', () => {
  const text = [
    read('src/app/(publico)/transparencia/page.tsx'),
    read('src/app/(publico)/mi-historia/page.tsx'),
    read('src/components/commerce/customer-orders.tsx'),
  ].join('\n')
  assert.match(text, /Para reconstruir/)
  assert.match(text, /Ya en material/)
  assert.match(text, /Pendiente de convertir en material/)
  assert.doesNotMatch(text, /Total donado|Ya entregado|Pendiente por entregar/)
})
await check('public map does not surface legacy venue contributions', () => {
  const queries = read('src/lib/venues/queries.ts')
  assert.doesNotMatch(queries, /venueContribution/)
  assert.match(queries, /materialDesde|baratoPrecio/)
})
console.log(`${checks} passed; ${failures} failed`)
if (failures) process.exitCode = 1
