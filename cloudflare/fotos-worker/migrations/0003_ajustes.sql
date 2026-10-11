-- Marcas de tareas que solo deben hacerse una vez (p. ej. importar las metricas antiguas de Firestore).
CREATE TABLE IF NOT EXISTS ajustes (
  nombre TEXT PRIMARY KEY,
  valor  TEXT NOT NULL
);
