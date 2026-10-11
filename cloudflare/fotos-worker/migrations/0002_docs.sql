-- Datos del panel (etapa 3): una fila por documento, igual que las colecciones de Firestore.
-- col: inventario | movimientos | clientes | config | authSettings
-- datos: el documento en JSON (texto exacto que envio el panel); hash: SHA-256 de ese texto.
-- version: numero que sube en cada escritura (para pedir solo "lo que cambio desde X").
-- borrado = 1: el documento se elimino (se conserva la fila para que los demas dispositivos se enteren).
CREATE TABLE IF NOT EXISTS docs (
  col     TEXT    NOT NULL,
  id      TEXT    NOT NULL,
  datos   TEXT    NOT NULL,
  hash    TEXT    NOT NULL,
  version INTEGER NOT NULL,
  borrado INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (col, id)
);
CREATE INDEX IF NOT EXISTS docs_version ON docs (version);

CREATE TABLE IF NOT EXISTS contador (
  nombre TEXT PRIMARY KEY,
  valor  INTEGER NOT NULL
);
INSERT OR IGNORE INTO contador (nombre, valor) VALUES ('docs', 0);
