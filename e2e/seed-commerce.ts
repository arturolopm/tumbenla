import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required for browser fixtures')
if (process.env.NODE_ENV === 'production') {
  throw new Error('Browser fixtures cannot run against a production process')
}

const sql = postgres(databaseUrl, { max: 1 })

try {
  const verifiedFoundations = await sql<{ id: string }[]>`
    select id from commerce_beneficiary
    where kind = 'foundation' and status = 'verified'
    order by created_at
  `
  if (verifiedFoundations.length > 1) {
    throw new Error('The browser fixture requires exactly one verified foundation')
  }
  if (verifiedFoundations.length === 0) {
    await sql`
      insert into commerce_beneficiary
        (id, kind, legal_name, legal_identifier_hash, status, verified_at)
      values
        ('e2e-foundation', 'foundation', 'Fundación local de prueba',
         'e2e-foundation-identifier', 'verified', now())
    `
  }

  const activePolicies = await sql<{ id: string }[]>`
    select id from allocation_policy
    where effective_at <= now() and (retired_at is null or retired_at > now())
  `
  if (activePolicies.length === 0) {
    await sql`
      insert into allocation_policy (id, version, name, effective_at)
      values ('e2e-allocation-policy', 1000000, 'Política local de navegador', now())
      on conflict do nothing
    `
  }
} finally {
  await sql.end()
}
