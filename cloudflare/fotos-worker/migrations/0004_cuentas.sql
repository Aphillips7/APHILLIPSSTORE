-- Cuentas de clientes del catalogo (login con Google). Cada cliente solo ve y cambia lo suyo.
-- cliente_id: lo pone el admin desde el panel para vincular la cuenta con un cliente del panel
-- (asi el cliente ve sus compras y apartados).
CREATE TABLE IF NOT EXISTS cuentas (
  uid         TEXT PRIMARY KEY,
  email       TEXT NOT NULL DEFAULT '',
  nombre      TEXT NOT NULL DEFAULT '',
  telefono    TEXT NOT NULL DEFAULT '',
  cliente_id  TEXT,
  creado      INTEGER NOT NULL,
  actualizado INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS favoritos (
  uid      TEXT NOT NULL,
  reloj_id TEXT NOT NULL,
  creado   INTEGER NOT NULL,
  PRIMARY KEY (uid, reloj_id)
);
-- tipo 'reloj' (valor = id del reloj) o 'marca' (valor = invicta | bulova | technomarine).
-- estado_base / precio_base: como estaba el reloj al pedir el aviso (o al ultimo aviso enviado),
-- para saber si ya llego o bajo de precio. avisado: fecha del ultimo WhatsApp enviado (0 = nunca).
CREATE TABLE IF NOT EXISTS avisos (
  uid         TEXT NOT NULL,
  tipo        TEXT NOT NULL,
  valor       TEXT NOT NULL,
  estado_base TEXT NOT NULL DEFAULT '',
  precio_base REAL NOT NULL DEFAULT 0,
  creado      INTEGER NOT NULL,
  avisado     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (uid, tipo, valor)
);
