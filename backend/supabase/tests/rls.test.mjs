import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
// Applies every migration to an in-memory Postgres (PGlite) with small auth/storage stubs,
// then checks tenant isolation and role rules.  Run: npm run test:db --prefix backend
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations')
const db = new PGlite()
const stubs = `
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
`
await db.exec(stubs)
for (const f of fs.readdirSync(dir).sort()) {
  try { await db.exec(fs.readFileSync(`${dir}/${f}`, 'utf8')); console.log('OK  ', f) }
  catch (e) { console.log('FAIL', f, e.message); process.exit(1) }
}
await db.exec(`GRANT USAGE ON SCHEMA auth, storage TO authenticated; GRANT ALL ON storage.objects TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, service_role; GRANT EXECUTE ON FUNCTION storage.foldername(text) TO authenticated;`)
const q = async (sql, params) => (await db.query(sql, params)).rows
const u1 = (await q(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('owner@a.com', '{"full_name":"Owner A"}') RETURNING id`))[0].id
const u2 = (await q(`INSERT INTO auth.users (email) VALUES ('owner@b.com') RETURNING id`))[0].id
const u3 = (await q(`INSERT INTO auth.users (email) VALUES ('viewer@a.com') RETURNING id`))[0].id
const orgA = (await q(`SELECT public.create_organization_with_owner('Acme Metallurgy Lab', $1) AS id`, [u1]))[0].id
const orgB = (await q(`SELECT public.create_organization_with_owner('Acme Metallurgy Lab', $1) AS id`, [u2]))[0].id
await q(`INSERT INTO public.memberships (organization_id, user_id, role) VALUES ($1, $2, 'viewer')`, [orgA, u3])
const u4 = (await q(`INSERT INTO auth.users (email) VALUES ('analyst@a.com') RETURNING id`))[0].id
await q(`INSERT INTO public.memberships (organization_id, user_id, role) VALUES ($1, $2, 'analyst')`, [orgA, u4])
console.log('slugs', (await q(`SELECT slug FROM public.organizations ORDER BY created_at`)).map(r => r.slug))
console.log('settings rows', (await q(`SELECT (SELECT count(*) FROM lab_settings) l, (SELECT count(*) FROM ai_settings) a, (SELECT count(*) FROM ring_test_settings) r`))[0])
const calB = (await q(`INSERT INTO calibrations (organization_id, name, objective, um_per_px_x, um_per_px_y) VALUES ($1,'10X','10X',0.65,0.65) RETURNING id`, [orgB]))[0].id
await q(`UPDATE ai_settings SET api_key = 'sk-secret-1234' WHERE organization_id = $1`, [orgA])

async function as(user, fn) {
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${user}', false);`)
  try { return await fn() } finally { await db.exec(`RESET ROLE;`) }
}
const check = (name, ok) => { console.log(ok ? 'PASS' : 'FAIL', name); if (!ok) process.exitCode = 1 }
const fails = async (fn) => { try { await fn(); return false } catch { return true } }

await as(u1, async () => {
  check('owner sees only own lab', (await q(`SELECT id FROM organizations`)).length === 1)
  check('cannot see other lab calibration', (await q(`SELECT id FROM calibrations`)).length === 0)
  const s = (await q(`INSERT INTO samples (organization_id, sample_code, created_by) VALUES ($1,'HT-1',$2) RETURNING id`, [orgA, u1]))[0].id
  check('job with other lab calibration rejected', await fails(() => q(`INSERT INTO analysis_jobs (organization_id, sample_id, calibration_id, analysis_type, created_by) VALUES ($1,$2,$3,'grain_size',$4)`, [orgA, s, calB, u1])))
  const job = (await q(`INSERT INTO analysis_jobs (organization_id, sample_id, analysis_type, created_by) VALUES ($1,$2,'grain_size',$3) RETURNING id`, [orgA, s, u1]))[0].id
  check('insert completed job rejected', await fails(() => q(`INSERT INTO analysis_jobs (organization_id, sample_id, analysis_type, status, created_by) VALUES ($1,$2,'micro','completed',$3)`, [orgA, s, u1])))
  check('analyst cannot set status directly', await fails(() => q(`UPDATE analysis_jobs SET status='reviewed' WHERE id=$1`, [job])))
  check('api_key not readable', await fails(() => q(`SELECT api_key FROM ai_settings`)))
  const ai = (await q(`SELECT has_api_key, api_key_hint FROM ai_settings`))[0]
  check('has_api_key + hint visible', ai.has_api_key === true && ai.api_key_hint === '••••1234')
  await q(`SELECT review_analysis_job($1, true, 'ok')`, [job])
  check('review rpc sets reviewed', (await q(`SELECT status FROM analysis_jobs WHERE id=$1`, [job]))[0].status === 'reviewed')
  const stats = (await q(`SELECT org_dashboard_stats($1) s`, [orgA]))[0].s
  check('dashboard stats', stats.samples == 1 && stats.jobs == 1 && stats.completed == 1 && stats.by_type.grain_size == 1)
  await q(`UPDATE lab_settings SET company_name='Acme Labs Pvt Ltd' WHERE organization_id=$1`, [orgA])
  check('lab name syncs org name', (await q(`SELECT name FROM organizations WHERE id=$1`, [orgA]))[0].name === 'Acme Labs Pvt Ltd')
  check('cannot write memberships directly', await fails(() => q(`INSERT INTO memberships (organization_id, user_id, role) VALUES ($1,$2,'owner')`, [orgA, u2])))
  check('storage insert own lab', !(await fails(() => q(`INSERT INTO storage.objects (bucket_id, name) VALUES ('job-images', $1)`, [`${orgA}/x.png`]))))
  check('storage insert other lab rejected', await fails(() => q(`INSERT INTO storage.objects (bucket_id, name) VALUES ('job-images', $1)`, [`${orgB}/x.png`])))
  check('storage bad prefix rejected', await fails(() => q(`INSERT INTO storage.objects (bucket_id, name) VALUES ('job-images', 'nope/x.png')`)))
  check('overlay bucket insert rejected', await fails(() => q(`INSERT INTO storage.objects (bucket_id, name) VALUES ('job-overlays', $1)`, [`${orgA}/y.png`])))
  const org3 = (await q(`SELECT create_my_organization('Second Lab') id`))[0].id
  check('create_my_organization makes owner', (await q(`SELECT role FROM memberships WHERE organization_id=$1`, [org3]))[0].role === 'owner')
})
await as(u3, async () => {
  check('viewer reads lab', (await q(`SELECT id FROM samples`)).length === 1)
  check('viewer cannot insert sample', await fails(() => q(`INSERT INTO samples (organization_id, sample_code, created_by) VALUES ($1,'X',$2)`, [orgA, u3])))
  check('viewer cannot review', await fails(async () => { const j = (await q(`SELECT id FROM analysis_jobs`))[0].id; await q(`SELECT review_analysis_job($1,false,'')`, [j]) }))
  check('viewer sees team profiles (owner, viewer, analyst)', (await q(`SELECT id FROM user_profiles`)).length === 3)
  check('viewer cannot update lab settings (0 rows)', (await db.query(`UPDATE lab_settings SET city='X' WHERE organization_id=$1`, [orgA])).affectedRows === 0)
})
await as(u4, async () => {
  const reviewed = (await q(`SELECT id FROM analysis_jobs WHERE status = 'reviewed'`))[0].id
  await q(`DELETE FROM analysis_jobs WHERE id = $1`, [reviewed])
  check('analyst cannot delete a reviewed job', (await q(`SELECT id FROM analysis_jobs WHERE id = $1`, [reviewed])).length === 1)
  const s = (await q(`SELECT id FROM samples LIMIT 1`))[0].id
  const pending = (await q(`INSERT INTO analysis_jobs (organization_id, sample_id, analysis_type, created_by) VALUES ($1,$2,'micro',$3) RETURNING id`, [orgA, s, u4]))[0].id
  await q(`DELETE FROM analysis_jobs WHERE id = $1`, [pending])
  check('analyst can delete a pending job', (await q(`SELECT id FROM analysis_jobs WHERE id = $1`, [pending])).length === 0)
  check('analyst sees one lab via app_my_org_ids', Number((await q(`SELECT count(*) n FROM app_my_org_ids('viewer')`))[0].n) === 1)
  check('analyst cannot read audit log', (await q(`SELECT id FROM audit_log`)).length === 0)
})
await as(u2, async () => {
  check('other owner cannot see lab A samples', (await q(`SELECT id FROM samples`)).length === 0)
  check('other owner cannot read lab A profiles', (await q(`SELECT id FROM user_profiles`)).length === 1)
})
// Security hardening (migration 20261026000000)
await as(u1, async () => {
  check('admin cannot edit audit log', await fails(() => q(`UPDATE audit_log SET action = 'X'`)))
  check('admin cannot delete audit log', await fails(() => q(`DELETE FROM audit_log`)))
  check('lab model id with spaces rejected', await fails(() => q(`UPDATE ai_settings SET model = 'bad model' WHERE organization_id = $1`, [orgA])))
})
await db.exec(`SET ROLE service_role`)
try {
  check('service role cannot delete audit log', await fails(() => q(`DELETE FROM audit_log`)))
  check('service role cannot truncate audit log', await fails(() => q(`TRUNCATE audit_log`)))
} finally { await db.exec(`RESET ROLE`) }
check('owner role refused by append-only trigger', await fails(() => q(`DELETE FROM audit_log`)))
await db.exec(`SET ROLE anon`)
try {
  check('anon cannot call role helpers', await fails(() => q(`SELECT public.app_has_org_role($1, 'viewer')`, [orgA])))
  check('anon cannot create a lab', await fails(() => q(`SELECT public.create_my_organization('x')`)))
} finally { await db.exec(`RESET ROLE`) }
const unpinned = await q(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
    AND NOT coalesce(p.proconfig, '{}') @> ARRAY['search_path=public, pg_temp']`)
check(`SECURITY DEFINER functions pin search_path (${unpinned.map((r) => r.proname).join(', ') || 'all'})`, unpinned.length === 0)
console.log('audit rows', (await q(`SELECT count(*) c FROM audit_log`))[0].c)
