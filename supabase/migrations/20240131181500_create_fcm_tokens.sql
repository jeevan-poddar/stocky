-- Create fcm_tokens table
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users NOT NULL,
    token text NOT NULL UNIQUE,
    device_type text, -- Optional: 'android', 'ios', 'web'
    created_at timestamptz DEFAULT now(),
    last_updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own tokens" 
ON public.fcm_tokens FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own tokens" 
ON public.fcm_tokens FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens" 
ON public.fcm_tokens FOR UPDATE 
USING (auth.uid() = user_id);

-- Optional: Index on user_id for faster lookups when sending notifications
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON public.fcm_tokens(user_id);
