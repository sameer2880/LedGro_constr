-- =====================================================================
-- Platform admin console
--
-- The platform admin ("default admin") now only manages businesses and their
-- users. They no longer open a business or see its rentals, diary, labour or
-- reports. They sign in like everyone else: mobile number, email or username.
-- =====================================================================

-- 1. Profile fields, so the platform admin can sign in with any of the three
ALTER TABLE public.platform_admins
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS username text;

UPDATE public.platform_admins pa
   SET email = u.email,
       name = COALESCE(pa.name, u.raw_user_meta_data ->> 'name', 'Platform admin')
  FROM auth.users u
 WHERE u.id = pa.user_id AND pa.email IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS platform_admins_phone_unique
  ON public.platform_admins (phone) WHERE phone IS NOT NULL AND phone <> '';
CREATE UNIQUE INDEX IF NOT EXISTS platform_admins_username_unique
  ON public.platform_admins (lower(username)) WHERE username IS NOT NULL AND username <> '';

-- 2. A platform admin no longer "works inside" a business. From now on a caller's
--    business comes only from their own worker/manager/admin account, so the
--    platform admin has no access to any business's data (rentals, diary, ...).
CREATE OR REPLACE FUNCTION public.my_business_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.business_id
    FROM public.workers w
    JOIN public.businesses b ON b.id = w.business_id AND b.active
   WHERE w.auth_user_id = auth.uid() AND w.active
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.role
    FROM public.workers w
    JOIN public.businesses b ON b.id = w.business_id AND b.active
   WHERE w.auth_user_id = auth.uid() AND w.active
   LIMIT 1;
$$;

DROP FUNCTION IF EXISTS public.set_active_business(uuid);
ALTER TABLE public.platform_admins DROP COLUMN IF EXISTS active_business_id;

-- 3. The platform admin may LIST users of every business (to manage them);
--    creating/editing/deleting still goes through the server functions.
DROP POLICY IF EXISTS workers_select_platform ON public.workers;
CREATE POLICY workers_select_platform ON public.workers FOR SELECT TO authenticated
  USING ((SELECT public.is_super_admin()));

NOTIFY pgrst, 'reload schema';
