-- rentals.group_id bundles the materials that were added together into one card.
-- The app already relies on it, but no earlier migration created it (it was added
-- directly on the original database). Idempotent: does nothing where it exists.
-- On a brand-new project every existing row simply becomes its own group.
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS group_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE INDEX IF NOT EXISTS rentals_group_id_idx ON public.rentals (group_id);
