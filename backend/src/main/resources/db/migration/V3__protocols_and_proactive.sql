-- Protocolos definidos por el usuario ("NOVA, protocolo inicio de turno").
CREATE TABLE protocols (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(80)  NOT NULL,
    steps       TEXT         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_protocols_user ON protocols(user_id);

-- Aviso previo ("en 10 minutos tienes…") ya enviado para el evento.
ALTER TABLE calendar_events ADD COLUMN heads_up_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- CVEs del catálogo CISA KEV ya notificados (evita avisos duplicados).
CREATE TABLE kev_alerts (
    cve_id      VARCHAR(32)  PRIMARY KEY,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
