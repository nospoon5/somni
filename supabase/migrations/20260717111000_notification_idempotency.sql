ALTER TABLE public.notification_logs ADD COLUMN idempotency_key text UNIQUE;

CREATE INDEX idx_notification_logs_idempotency_key ON public.notification_logs(idempotency_key);
