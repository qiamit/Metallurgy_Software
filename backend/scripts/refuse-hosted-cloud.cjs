'use strict'

console.error(
  [
    'This Railway project is disconnected from hosted Supabase Cloud and Vercel.',
    'Apply SQL against Railway Postgres. Do not use supabase link, db push, or Vercel deploy from this repo.',
  ].join('\n'),
)
process.exit(1)
