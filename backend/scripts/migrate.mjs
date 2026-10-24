// Apply pending SQL migrations to Railway Postgres, in filename order, one transaction each.
// Tracks applied files (with a checksum) in public.schema_migrations.
//
//   DATABASE_URL=postgres://... npm run db:migrate --prefix backend            # apply pending
//   DATABASE_URL=postgres://... npm run db:migrate --prefix backend -- --dry-run
//   DATABASE_URL=postgres://... npm run db:migrate --prefix backend -- --baseline  # mark all as applied
//
// Order on a fresh database: bootstrap_roles first, then start GoTrue + storage-api (they create the
// auth / storage schemas), then run this again for the rest.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations')
const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const baseline = args.has('--baseline')
const url = process.env.DATABASE_URL

if (!url) {
  console.error('DATABASE_URL is required (Railway Postgres).')
  process.exit(1)
}
if (/supabase\.co/i.test(url)) {
  console.error('Refusing to run against hosted Supabase Cloud. This project runs only on Railway.')
  process.exit(1)
}

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex')
const files = fs.readdirSync(dir).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort()

const client = new pg.Client({
  connectionString: url,
  ssl: /sslmode=disable/.test(url) || /\.railway\.internal/.test(url) ? false : { rejectUnauthorized: false },
})
await client.connect()
try {
  await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
    filename text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`)
  await client.query('REVOKE ALL ON public.schema_migrations FROM PUBLIC')
  const { rows } = await client.query('SELECT filename, checksum FROM public.schema_migrations')
  const applied = new Map(rows.map((r) => [r.filename, r.checksum]))

  let failed = false
  let pending = 0
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    const sum = sha(sql)
    if (applied.has(file)) {
      if (applied.get(file) !== sum) {
        console.error(`CHANGED  ${file} — already applied with a different checksum. Add a new migration instead.`)
        failed = true
      }
      continue
    }
    if (dryRun) {
      pending += 1
      console.log(`PENDING  ${file}`)
      continue
    }
    if (baseline) {
      await client.query('INSERT INTO public.schema_migrations (filename, checksum) VALUES ($1, $2)', [file, sum])
      console.log(`BASELINE ${file}`)
      continue
    }
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO public.schema_migrations (filename, checksum) VALUES ($1, $2)', [file, sum])
      await client.query('COMMIT')
      console.log(`APPLIED  ${file}`)
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`FAILED   ${file}: ${err instanceof Error ? err.message : err}`)
      failed = true
      break
    }
  }
  if (failed) process.exitCode = 1
  else if (dryRun) console.log(pending ? `${pending} migration(s) pending.` : 'Database is up to date.')
  else console.log('Database is up to date.')
} finally {
  await client.end()
}
