-- =====================================================================
-- MULTI-BUSINESS, PART 2 — LOCKDOWN  (run this LAST, by hand)
--
-- NOT in supabase/migrations on purpose: it must not run automatically.
-- Run it in the Supabase SQL editor only after:
--   1. supabase/migrations/20260920000000_multi_business.sql has been applied
--   2. `node scripts/bootstrap.mjs migrate-users`  and  `... super-admin`  have run
--   3. the new app build is deployed and you have signed in as the platform admin
--
-- What it does: removes every anonymous-access policy (today the public
-- anon key can read and edit everything, including staff passwords), strips
-- the hidden role markers from `notes`, drops the plain-text `password`
-- column and the temporary business_id defaults.
-- After this runs, the OLD version of the app stops working.
-- =====================================================================

-- Safety checks: refuse to lock the door if that would strand someone.
DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.platform_admins) THEN
    RAISE EXCEPTION 'No platform admin exists yet. Run: node scripts/bootstrap.mjs super-admin <email> <password>';
  END IF;

  SELECT count(*) INTO n FROM public.workers
   WHERE auth_user_id IS NULL AND phone IS NOT NULL AND phone <> '';
  IF n > 0 THEN
    RAISE EXCEPTION '% user(s) have no login account yet. Run: node scripts/bootstrap.mjs migrate-users (then re-run this file).', n;
  END IF;
END $$;

-- 1. Legacy anonymous policies
DROP POLICY IF EXISTS rentals_all_public ON public.rentals;
DROP POLICY IF EXISTS diary_notes_all_public ON public.diary_notes;
DROP POLICY IF EXISTS workers_legacy_admin ON public.workers;
DROP POLICY IF EXISTS worker_attendance_legacy_admin ON public.worker_attendance;
DROP POLICY IF EXISTS worker_payments_legacy_admin ON public.worker_payments;
DROP POLICY IF EXISTS worker_feedback_legacy_admin ON public.worker_feedback;
DROP POLICY IF EXISTS worker_locations_legacy_admin ON public.worker_locations;

-- 2. The public anon key gets no table access at all any more
REVOKE ALL ON public.rentals, public.diary_notes, public.workers, public.worker_attendance,
  public.worker_payments, public.worker_feedback, public.worker_locations,
  public.profiles, public.user_roles, public.businesses FROM anon;

-- 3. Temporary defaults from the migration
ALTER TABLE public.workers            ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE public.rentals            ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE public.diary_notes        ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE public.worker_attendance  ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE public.worker_payments    ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE public.worker_feedback    ALTER COLUMN business_id DROP DEFAULT;
ALTER TABLE public.worker_locations   ALTER COLUMN business_id DROP DEFAULT;

-- 4. Roles now live in workers.role — remove the hidden markers from notes
UPDATE public.workers
   SET notes = NULLIF(substr(notes, length(chr(8291) || 'role:superadmin' || chr(8291)) + 1), '')
 WHERE notes LIKE chr(8291) || 'role:superadmin' || chr(8291) || '%';
UPDATE public.workers
   SET notes = NULLIF(substr(notes, length(chr(8291) || 'role:admin' || chr(8291)) + 1), '')
 WHERE notes LIKE chr(8291) || 'role:admin' || chr(8291) || '%';

-- 5. Passwords live in Supabase Auth (hashed) — remove the plain-text copy
ALTER TABLE public.workers DROP COLUMN IF EXISTS password;

NOTIFY pgrst, 'reload schema';
