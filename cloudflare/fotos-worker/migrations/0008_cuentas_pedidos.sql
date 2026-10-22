-- Cuentas mas completas, codigo de cliente unico y pedidos hechos por WhatsApp.
--
-- codigo: "AP-00012", se asigna una sola vez a partir del rowid (nunca se repite). Sirve al dueno para
--   identificar al cliente rapido (va en los mensajes de WhatsApp y en el panel).
-- tel_norm: el WhatsApp solo con digitos y con el 507 de Panama; es UNICO para que no haya dos cuentas
--   con el mismo numero (los vacios no cuentan).
-- terminos / mayor_edad: fecha en que el cliente acepto los terminos y confirmo ser mayor de 18 (0 = no).
-- novedades: acepto recibir novedades (1) o no (0). direccion: JSON con la direccion de envio.
ALTER TABLE cuentas ADD COLUMN apellido   TEXT NOT NULL DEFAULT '';
ALTER TABLE cuentas ADD COLUMN codigo     TEXT;
ALTER TABLE cuentas ADD COLUMN tel_norm   TEXT NOT NULL DEFAULT '';
ALTER TABLE cuentas ADD COLUMN terminos   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cuentas ADD COLUMN mayor_edad INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cuentas ADD COLUMN novedades  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cuentas ADD COLUMN cedula     TEXT NOT NULL DEFAULT '';
ALTER TABLE cuentas ADD COLUMN nacimiento TEXT NOT NULL DEFAULT '';
ALTER TABLE cuentas ADD COLUMN muneca     TEXT NOT NULL DEFAULT '';
ALTER TABLE cuentas ADD COLUMN contacto   TEXT NOT NULL DEFAULT 'whatsapp';
ALTER TABLE cuentas ADD COLUMN direccion  TEXT NOT NULL DEFAULT '{}';

-- codigos para las cuentas que ya existian
UPDATE cuentas SET codigo = 'AP-' || printf('%05d', rowid) WHERE codigo IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cuentas_codigo ON cuentas(codigo);
-- numero normalizado de las cuentas que ya tenian WhatsApp (8 digitos -> 507 + digitos)
UPDATE cuentas SET tel_norm = CASE
    WHEN length(replace(replace(replace(replace(telefono,'+',''),' ',''),'-',''),'(','')) IN (7, 8)
      THEN '507' || replace(replace(replace(replace(telefono,'+',''),' ',''),'-',''),'(','')
    ELSE replace(replace(replace(replace(telefono,'+',''),' ',''),'-',''),'(','') END
  WHERE telefono <> '';
-- si dos cuentas viejas tenian el mismo numero, solo la mas antigua lo conserva como unico
UPDATE cuentas SET tel_norm = '' WHERE tel_norm <> '' AND rowid NOT IN (SELECT min(rowid) FROM cuentas WHERE tel_norm <> '' GROUP BY tel_norm);
CREATE UNIQUE INDEX IF NOT EXISTS cuentas_tel ON cuentas(tel_norm) WHERE tel_norm <> '';

-- Pedidos: se crean cuando un cliente con sesion toca "Comprar por WhatsApp". El precio y los datos
-- del reloj se toman del catalogo publico en el servidor (no del navegador). El dueno los avanza desde
-- el panel: solicitado -> confirmado -> pagado -> enviado -> entregado (o cancelado).
-- historial: JSON [{ estado, fecha, nota }] para que el cliente vea cuando cambio cada paso.
CREATE TABLE IF NOT EXISTS pedidos (
  numero      TEXT PRIMARY KEY,           -- "P-4K7QX"
  uid         TEXT NOT NULL,
  reloj_id    TEXT NOT NULL,
  reloj       TEXT NOT NULL DEFAULT '',
  sku         TEXT NOT NULL DEFAULT '',
  foto        TEXT NOT NULL DEFAULT '',
  precio      REAL NOT NULL DEFAULT 0,
  estado      TEXT NOT NULL DEFAULT 'solicitado',
  entrega     TEXT NOT NULL DEFAULT '',   -- 'envio' | 'retiro' (lo pone el dueno al confirmar)
  direccion   TEXT NOT NULL DEFAULT '{}', -- copia de la direccion del cliente al pedir
  tracking    TEXT NOT NULL DEFAULT '',
  nota        TEXT NOT NULL DEFAULT '',   -- nota del dueno visible para el cliente
  historial   TEXT NOT NULL DEFAULT '[]',
  creado      INTEGER NOT NULL,
  actualizado INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS pedidos_uid ON pedidos(uid, creado);
CREATE INDEX IF NOT EXISTS pedidos_estado ON pedidos(estado, actualizado);
