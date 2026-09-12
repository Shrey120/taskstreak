-- The Stack is an ordered pile: "Later" sends a card to the back and the
-- order itself is the data. It was being read back by created_at, so every
-- reorder was lost on reload. sort_order makes the order durable.
--
-- Self-sufficient on purpose: recreates the table if the earlier sync
-- migration was never applied, so this can be run on its own.
CREATE TABLE IF NOT EXISTS public.stack_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  title TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stack_items
  ADD COLUMN IF NOT EXISTS sort_order DOUBLE PRECISION;

-- Backfill: keep the pile in the order it currently reads (newest on top).
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY created_at DESC) AS rn
  FROM public.stack_items
  WHERE sort_order IS NULL
)
UPDATE public.stack_items s
  SET sort_order = ranked.rn * 1000
  FROM ranked
  WHERE s.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_stack_items_device_order
  ON public.stack_items(device_id, sort_order);

ALTER TABLE public.stack_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stack_items'
      AND policyname = 'Public access for stack_items'
  ) THEN
    CREATE POLICY "Public access for stack_items" ON public.stack_items
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END
$$;
