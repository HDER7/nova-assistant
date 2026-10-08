-- Modo NotebookLM: cuadernos con fuentes propias, preguntas citadas y resumen en audio.
CREATE TABLE notebooks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(160) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_notebooks_user ON notebooks(user_id);

CREATE TABLE notebook_sources (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notebook_id  UUID         NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
    title        VARCHAR(200) NOT NULL,
    kind         VARCHAR(20)  NOT NULL,
    content      TEXT         NOT NULL,
    chars        INTEGER      NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_notebook_sources_nb ON notebook_sources(notebook_id);

-- Último resumen en audio (WAV) por cuaderno.
CREATE TABLE notebook_audio (
    notebook_id  UUID PRIMARY KEY REFERENCES notebooks(id) ON DELETE CASCADE,
    title        VARCHAR(200),
    wav          BYTEA        NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
