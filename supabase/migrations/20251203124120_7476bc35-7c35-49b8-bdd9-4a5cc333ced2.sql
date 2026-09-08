-- Create users table with unique username
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  username text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Public access policy for device-based access
CREATE POLICY "Public access for users"
ON public.users
FOR ALL
USING (true)
WITH CHECK (true);