ALTER TABLE public.baby_shares
ADD COLUMN invite_token_hash TEXT,
ADD COLUMN invite_expires_at TIMESTAMP WITH TIME ZONE;

-- Invalidate existing pending invites since they lack tokens
UPDATE public.baby_shares
SET invite_expires_at = timezone('utc'::text, now()) - interval '1 day'
WHERE status = 'pending';
