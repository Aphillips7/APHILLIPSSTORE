-- Metricas del catalogo publico (antes en Firestore: metricas_catalogo).
-- Una fila por reloj; los visitantes solo pueden sumar 1 a vistas / aperturas / clics.
CREATE TABLE IF NOT EXISTS metricas (
  id        TEXT PRIMARY KEY,
  vistas    INTEGER NOT NULL DEFAULT 0,
  aperturas INTEGER NOT NULL DEFAULT 0,
  clics     INTEGER NOT NULL DEFAULT 0,
  ultima    INTEGER NOT NULL DEFAULT 0
);
