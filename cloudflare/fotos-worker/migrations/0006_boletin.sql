-- Suscriptores del boletin (formulario "Suscribete al boletin" del pie de la tienda).
-- token: codigo para darse de baja desde el enlace del correo. activo = 0 cuando se dio de baja.
CREATE TABLE IF NOT EXISTS boletin (
  email   TEXT    PRIMARY KEY,
  nombre  TEXT,
  activo  INTEGER NOT NULL DEFAULT 1,
  token   TEXT    NOT NULL,
  creado  INTEGER NOT NULL,
  baja    INTEGER
);
CREATE INDEX IF NOT EXISTS boletin_token ON boletin (token);
