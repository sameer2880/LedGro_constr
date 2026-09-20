-- =====================================================================
-- MULTI-BUSINESS, PART 1 (additive — safe to run while the current app is live)
--
-- Adds the tenant model (businesses), real per-user accounts tied to
-- Supabase Auth, business-scoped row-level security, and moves every
-- existing row into a first business ("M.B.S CENTRING WORKS").
--
-- The legacy anonymous policies are deliberately LEFT IN PLACE here so the
-- currently deployed app keeps working until you deploy the new build.
-- They are removed by supabase/manual/lockdown.sql (run that LAST).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Businesses
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short_name text,
  location text,
  owner_line text,
  phone text,
  whatsapp text,
  logo_url text,
  stamp_url text,
  signature_url text,
  website_url text,
  instagram_url text,
  youtube_url text,
  maps_url text,
  reels_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Existing data belongs to this first business (fixed id so it can be used as
-- the temporary column default below).
INSERT INTO public.businesses
  (id, name, short_name, location, owner_line, phone, whatsapp, logo_url, stamp_url, signature_url,
   website_url, instagram_url, youtube_url, maps_url, reels_url)
VALUES (
  '00000000-0000-4000-a000-000000000001',
  'M.B.S CENTRING WORKS', 'MBS', 'Nereducherla',
  'Pro: Sk.M.Sharif Ph.no: 8688285959', '8688285959', '918688285959',
  '/logo.png', '/brand/mbs/stamp.png', '/brand/mbs/signature-mbs.png',
  'https://mbsndcl.vercel.app',
  'https://www.instagram.com/mbs_centrings_nereducherla/',
  'https://www.youtube.com/@mbs_centring_works_ndcl/?themeRefresh=1',
  'https://maps.app.goo.gl/PWjFYqqZrZRqSC2E6',
  'https://mbsndcl.vercel.app/reelmanagent'
)
ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER businesses_updated_at BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- 2. Platform ("default") admins — real Supabase Auth users who can create
--    businesses and enter any of them. active_business_id is the business
--    they are currently working inside (enforced by the database, so a
--    platform admin only ever sees one business's rows at a time).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admins FROM anon, authenticated;
GRANT ALL ON public.platform_admins TO service_role;

-- ---------------------------------------------------------------------
-- 3. workers = the per-business user table (worker / manager / admin)
-- ---------------------------------------------------------------------
ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'worker',
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signature_url text;

ALTER TABLE public.workers DROP CONSTRAINT IF EXISTS workers_role_check;
ALTER TABLE public.workers
  ADD CONSTRAINT workers_role_check CHECK (role IN ('worker', 'manager', 'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS workers_auth_user_id_unique
  ON public.workers (auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Roles used to be hidden in `notes` behind invisible markers. Read them into
-- the real column (the markers themselves are stripped later, in lockdown.sql,
-- so the currently deployed app keeps recognising its admins until then).
UPDATE public.workers SET role = 'admin'
  WHERE role = 'worker' AND notes LIKE chr(8291) || 'role:superadmin' || chr(8291) || '%';
UPDATE public.workers SET role = 'manager'
  WHERE role = 'worker' AND notes LIKE chr(8291) || 'role:admin' || chr(8291) || '%';

-- Mobile numbers become the login id, so they must be unique across the app.
-- Only enforced automatically if today's data has no duplicates.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.workers WHERE phone IS NOT NULL AND phone <> ''
    GROUP BY phone HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'Duplicate mobile numbers exist in workers — fix them, then create workers_phone_unique manually.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS workers_phone_unique
      ON public.workers (phone) WHERE phone IS NOT NULL AND phone <> '';
  END IF;
END $$;

-- Optional: keep MBS's existing per-person receipt signatures.
UPDATE public.workers SET signature_url = '/brand/mbs/signature-salman.png' WHERE signature_url IS NULL AND lower(name) LIKE '%salman%';
UPDATE public.workers SET signature_url = '/brand/mbs/signature-hafiza.png' WHERE signature_url IS NULL AND lower(name) LIKE '%hafiza%';
UPDATE public.workers SET signature_url = '/brand/mbs/signature-sameer.png' WHERE signature_url IS NULL AND lower(name) LIKE '%sameer%';

-- ---------------------------------------------------------------------
-- 4. business_id on every data table.
--    Every existing row belongs to the first business, so the column is added
--    NOT NULL with that business as its DEFAULT — existing rows pick it up
--    without being rewritten (no updated_at churn). The DEFAULT is TEMPORARY:
--    it lets the currently deployed app's inserts keep working until
--    lockdown.sql removes it.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'workers', 'rentals', 'diary_notes',
    'worker_attendance', 'worker_payments', 'worker_feedback', 'worker_locations'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS business_id uuid NOT NULL DEFAULT %L REFERENCES public.businesses(id) ON DELETE RESTRICT',
      t, '00000000-0000-4000-a000-000000000001'
    );
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (business_id)', t || '_business_id_idx', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 5. Helper functions used by the policies (SECURITY DEFINER so they can
--    read workers/platform_admins regardless of the caller's own RLS)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid());
$$;

-- The business the caller is currently working inside. Platform admins: the
-- one they switched to. Everyone else: the business their account belongs to.
-- NULL when the account or the business is inactive.
CREATE OR REPLACE FUNCTION public.my_business_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT pa.active_business_id
       FROM public.platform_admins pa
       JOIN public.businesses b ON b.id = pa.active_business_id AND b.active
      WHERE pa.user_id = auth.uid()),
    (SELECT w.business_id
       FROM public.workers w
       JOIN public.businesses b ON b.id = w.business_id AND b.active
      WHERE w.auth_user_id = auth.uid() AND w.active
      LIMIT 1)
  );
$$;

-- 'admin' | 'manager' | 'worker' | NULL. A platform admin counts as 'admin'
-- inside whichever business they are working in.
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.is_super_admin() THEN 'admin'
    ELSE (SELECT w.role
            FROM public.workers w
            JOIN public.businesses b ON b.id = w.business_id AND b.active
           WHERE w.auth_user_id = auth.uid() AND w.active
           LIMIT 1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.my_business_id() IS NOT NULL AND COALESCE(public.my_role() IN ('admin', 'manager'), false);
$$;

CREATE OR REPLACE FUNCTION public.is_business_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.my_business_id() IS NOT NULL AND COALESCE(public.my_role() = 'admin', false);
$$;

-- ---------------------------------------------------------------------
-- 6. RPCs the app calls
-- ---------------------------------------------------------------------
-- One device per account: store the token of the device that signed in last.
CREATE OR REPLACE FUNCTION public.claim_device(p_token text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.workers SET session_token = p_token WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.clear_must_set_password()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.workers SET must_set_password = false WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.set_active_business(p_business_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform admin can switch business';
  END IF;
  IF p_business_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = p_business_id) THEN
    RAISE EXCEPTION 'Business not found';
  END IF;
  UPDATE public.platform_admins SET active_business_id = p_business_id WHERE user_id = auth.uid();
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'is_super_admin()', 'my_business_id()', 'my_role()', 'is_staff()', 'is_business_admin()',
    'claim_device(text)', 'clear_must_set_password()', 'set_active_business(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 7. Triggers: rows can never be written into (or moved to) another business
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_business_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid;
BEGIN
  b := public.my_business_id();
  IF b IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.business_id := b;
    ELSE
      NEW.business_id := OLD.business_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_business_from_worker()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT w.business_id INTO NEW.business_id FROM public.workers w WHERE w.id = NEW.worker_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rentals_business_id BEFORE INSERT OR UPDATE ON public.rentals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_business_id();
CREATE TRIGGER diary_notes_business_id BEFORE INSERT OR UPDATE ON public.diary_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_business_id();
CREATE TRIGGER worker_attendance_business_id BEFORE INSERT OR UPDATE OF worker_id ON public.worker_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_business_from_worker();
CREATE TRIGGER worker_payments_business_id BEFORE INSERT OR UPDATE OF worker_id ON public.worker_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_business_from_worker();
CREATE TRIGGER worker_feedback_business_id BEFORE INSERT OR UPDATE OF worker_id ON public.worker_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_business_from_worker();
CREATE TRIGGER worker_locations_business_id BEFORE INSERT OR UPDATE OF worker_id ON public.worker_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_business_from_worker();

-- A business admin may edit their own business profile, but only the platform
-- admin may activate/deactivate it.
CREATE OR REPLACE FUNCTION public.guard_business_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    NEW.active := OLD.active;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER businesses_guard BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.guard_business_update();

-- ---------------------------------------------------------------------
-- 8. Row-level security for real (Supabase Auth) sessions
-- ---------------------------------------------------------------------
-- Drop the previous "authenticated" policies (they trusted the old has_role
-- table / a user_metadata claim). The legacy *anon* policies stay until
-- lockdown.sql.
DROP POLICY IF EXISTS workers_worker_read_own ON public.workers;
DROP POLICY IF EXISTS workers_staff_manage ON public.workers;
DROP POLICY IF EXISTS worker_attendance_worker_read_own ON public.worker_attendance;
DROP POLICY IF EXISTS worker_attendance_staff_manage ON public.worker_attendance;
DROP POLICY IF EXISTS worker_payments_worker_read_own ON public.worker_payments;
DROP POLICY IF EXISTS worker_payments_staff_manage ON public.worker_payments;
DROP POLICY IF EXISTS worker_feedback_worker_read_own ON public.worker_feedback;
DROP POLICY IF EXISTS worker_feedback_worker_write_own ON public.worker_feedback;
DROP POLICY IF EXISTS worker_feedback_worker_update_own ON public.worker_feedback;
DROP POLICY IF EXISTS worker_feedback_staff_manage ON public.worker_feedback;
DROP POLICY IF EXISTS worker_locations_worker_read_own ON public.worker_locations;
DROP POLICY IF EXISTS worker_locations_worker_write_own ON public.worker_locations;
DROP POLICY IF EXISTS worker_locations_worker_update_own ON public.worker_locations;
DROP POLICY IF EXISTS worker_locations_staff_manage ON public.worker_locations;
DROP POLICY IF EXISTS rentals_all_authenticated ON public.rentals;
DROP POLICY IF EXISTS user_roles_select_own_or_admin ON public.user_roles;
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;

-- rentals / diary_notes had a policy for BOTH anon and authenticated. Narrow it
-- to anon (the legacy app) so signed-in users are governed only by the
-- business-scoped policies below.
ALTER POLICY rentals_all_public ON public.rentals TO anon;
ALTER POLICY diary_notes_all_public ON public.diary_notes TO anon;

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;

CREATE POLICY businesses_select ON public.businesses FOR SELECT TO authenticated
  USING ((SELECT public.is_super_admin()) OR id = (SELECT public.my_business_id()));
CREATE POLICY businesses_update ON public.businesses FOR UPDATE TO authenticated
  USING ((SELECT public.is_super_admin()) OR (id = (SELECT public.my_business_id()) AND (SELECT public.is_business_admin())))
  WITH CHECK ((SELECT public.is_super_admin()) OR (id = (SELECT public.my_business_id()) AND (SELECT public.is_business_admin())));

-- workers: staff see everyone in their business, everyone else sees only their
-- own row. There are deliberately NO client write policies — users are created,
-- edited and removed through the server functions (service role) so the Auth
-- account and the row can never drift apart.
REVOKE INSERT, UPDATE, DELETE ON public.workers FROM authenticated;
CREATE POLICY workers_select ON public.workers FOR SELECT TO authenticated
  USING (
    business_id = (SELECT public.my_business_id())
    AND ((SELECT public.is_staff()) OR auth_user_id = (SELECT auth.uid()))
  );

-- rentals + diary: business staff only
CREATE POLICY rentals_staff ON public.rentals FOR ALL TO authenticated
  USING (business_id = (SELECT public.my_business_id()) AND (SELECT public.is_staff()))
  WITH CHECK (business_id = (SELECT public.my_business_id()) AND (SELECT public.is_staff()));
CREATE POLICY diary_notes_staff ON public.diary_notes FOR ALL TO authenticated
  USING (business_id = (SELECT public.my_business_id()) AND (SELECT public.is_staff()))
  WITH CHECK (business_id = (SELECT public.my_business_id()) AND (SELECT public.is_staff()));

-- attendance + payments: staff manage, a worker reads their own
CREATE POLICY worker_attendance_staff ON public.worker_attendance FOR ALL TO authenticated
  USING (business_id = (SELECT public.my_business_id()) AND (SELECT public.is_staff()))
  WITH CHECK (business_id = (SELECT public.my_business_id()) AND (SELECT public.is_staff()));
CREATE POLICY worker_attendance_own ON public.worker_attendance FOR SELECT TO authenticated
  USING (worker_id IN (SELECT id FROM public.workers WHERE auth_user_id = (SELECT auth.uid())));

CREATE POLICY worker_payments_staff ON public.worker_payments FOR ALL TO authenticated
  USING (business_id = (SELECT public.my_business_id()) AND (SELECT public.is_staff()))
  WITH CHECK (business_id = (SELECT public.my_business_id()) AND (SELECT public.is_staff()));
CREATE POLICY worker_payments_own ON public.worker_payments FOR SELECT TO authenticated
  USING (worker_id IN (SELECT id FROM public.workers WHERE auth_user_id = (SELECT auth.uid())));

-- feedback + locations: staff manage, a worker reads/writes their own
CREATE POLICY worker_feedback_staff ON public.worker_feedback FOR ALL TO authenticated
  USING (business_id = (SELECT public.my_business_id()) AND (SELECT public.is_staff()))
  WITH CHECK (business_id = (SELECT public.my_business_id()) AND (SELECT public.is_staff()));
CREATE POLICY worker_feedback_own ON public.worker_feedback FOR ALL TO authenticated
  USING (worker_id IN (SELECT id FROM public.workers WHERE auth_user_id = (SELECT auth.uid())))
  WITH CHECK (worker_id IN (SELECT id FROM public.workers WHERE auth_user_id = (SELECT auth.uid())));

CREATE POLICY worker_locations_staff ON public.worker_locations FOR ALL TO authenticated
  USING (business_id = (SELECT public.my_business_id()) AND (SELECT public.is_staff()))
  WITH CHECK (business_id = (SELECT public.my_business_id()) AND (SELECT public.is_staff()));
CREATE POLICY worker_locations_own ON public.worker_locations FOR ALL TO authenticated
  USING (worker_id IN (SELECT id FROM public.workers WHERE auth_user_id = (SELECT auth.uid())))
  WITH CHECK (worker_id IN (SELECT id FROM public.workers WHERE auth_user_id = (SELECT auth.uid())));

-- Legacy tables: the auth-signup trigger used to hand every new Auth user a
-- profile and a role. Accounts are now provisioned by the server functions.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));
CREATE POLICY user_roles_select_own ON public.user_roles FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------
-- 9. Storage for each business's logo / stamp / signature
--    (public-read so receipts render; only that business's admin can write,
--     and only inside a folder named after its id)
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-assets', 'business-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY business_assets_read ON storage.objects FOR SELECT
  USING (bucket_id = 'business-assets');
CREATE POLICY business_assets_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business-assets'
    AND (storage.foldername(name))[1] = (SELECT public.my_business_id())::text
    AND (SELECT public.is_business_admin())
  );
CREATE POLICY business_assets_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'business-assets'
    AND (storage.foldername(name))[1] = (SELECT public.my_business_id())::text
    AND (SELECT public.is_business_admin())
  );
CREATE POLICY business_assets_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'business-assets'
    AND (storage.foldername(name))[1] = (SELECT public.my_business_id())::text
    AND (SELECT public.is_business_admin())
  );

NOTIFY pgrst, 'reload schema';
