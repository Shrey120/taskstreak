-- Create withdraw history table
CREATE TABLE public.withdraw_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.withdraw_history ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (matching existing pattern)
CREATE POLICY "Public access for withdraw_history" 
ON public.withdraw_history 
FOR ALL 
USING (true)
WITH CHECK (true);