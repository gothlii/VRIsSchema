
-- Create weeks table to store schedule data
CREATE TABLE public.weeks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  data JSONB NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;

-- Everyone can read weeks
CREATE POLICY "Anyone can view weeks" ON public.weeks FOR SELECT USING (true);

-- Anyone can insert weeks (admin check is client-side)
CREATE POLICY "Anyone can insert weeks" ON public.weeks FOR INSERT WITH CHECK (true);

-- Anyone can delete weeks
CREATE POLICY "Anyone can delete weeks" ON public.weeks FOR DELETE USING (true);

-- Anyone can update weeks
CREATE POLICY "Anyone can update weeks" ON public.weeks FOR UPDATE USING (true);
