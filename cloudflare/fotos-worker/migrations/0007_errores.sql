-- Errores de JavaScript de la tienda y del panel (js/errores.js -> POST /errores). Anonimos: mensaje,
-- archivo, linea, pagina y tipo de navegador. Se borran a los 30 dias (mantenimiento diario).
CREATE TABLE IF NOT EXISTS errores (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,
  mensaje   TEXT    NOT NULL,
  fuente    TEXT,
  linea     INTEGER,
  pagina    TEXT,
  navegador TEXT
);
CREATE INDEX IF NOT EXISTS errores_ts ON errores (ts);
