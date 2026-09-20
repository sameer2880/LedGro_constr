-- Optional username for signing in (alongside mobile number and email).
-- Case-insensitive and unique across the whole app.
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS workers_username_unique
  ON public.workers (lower(username))
  WHERE username IS NOT NULL AND username <> '';

NOTIFY pgrst, 'reload schema';
