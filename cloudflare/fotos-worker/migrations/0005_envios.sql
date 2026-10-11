-- Registro de correos enviados (verificacion y contrasena), para limitar cuantos se mandan por
-- cuenta, por correo y por IP (que nadie use la tienda para enviar correos en masa).
-- clave: 'verif:<uid>' | 'clave:<correo>' | 'ip:<huella de la IP>'. Se borran a los 2 dias.
CREATE TABLE IF NOT EXISTS envios (
  clave TEXT    NOT NULL,
  ts    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS envios_clave_ts ON envios (clave, ts);
