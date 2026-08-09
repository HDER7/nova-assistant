-- Marca si un recordatorio ya disparo su notificacion.
ALTER TABLE reminders ADD COLUMN notified BOOLEAN NOT NULL DEFAULT FALSE;
