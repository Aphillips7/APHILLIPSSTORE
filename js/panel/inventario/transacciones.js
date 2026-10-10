// Cambios de estado que no se pueden pisar entre dispositivos (vender, reservar,
// completar o cancelar una reserva). Usan una transaccion de Firestore: leen el
// estado REAL del reloj en la nube y solo escriben si sigue siendo el que el
// usuario veia en pantalla. Asi dos celulares no pueden vender el mismo reloj.
// En la misma transaccion se actualiza catalogo_publico, para que el catalogo
// vea el cambio (disponible / reservado / vendido) en tiempo real.
import { db, firebase } from '../../firebase.js';
import { camposPublicos, esPublicable } from '../../products.js';

const NOMBRES = { disponible:'disponible', transito:'en transito', bajopedido:'bajo pedido', reservado:'reservado', vendido:'vendido' };

function conflicto(msg){ var e = new Error(msg); e.conflicto = true; return e; }

// cambios: campos a escribir en inventario/{id}. Un valor null en "quitar" borra ese campo.
async function cambiarEstadoSeguro(id, estadoEsperado, cambios, quitar){
  if(!navigator.onLine) throw conflicto('Sin conexion a internet. Para evitar vender o reservar dos veces el mismo reloj, esta operacion necesita confirmar con la nube. Intentalo cuando tengas internet.');
  var ref = db.collection('inventario').doc(id);
  var pubRef = db.collection('catalogo_publico').doc(id);
  await db.runTransaction(async function(tx){
    var snap = await tx.get(ref);
    if(!snap.exists) throw conflicto('Este reloj ya no existe en la nube (pudo eliminarse en otro dispositivo).');
    var actual = snap.data();
    if(actual.estado !== estadoEsperado || (cambios.estado === 'vendido' && actual.estado === 'vendido')){
      var quien = actual.reserva && actual.reserva.clienteNombre ? ' (reserva de '+actual.reserva.clienteNombre+')' : '';
      throw conflicto('Este reloj cambio a "'+(NOMBRES[actual.estado]||actual.estado)+'"'+quien+' desde otro dispositivo. No se registro nada; refresca y revisa antes de continuar.');
    }
    var escribir = Object.assign({}, cambios);
    var final = Object.assign({}, actual, cambios);
    (quitar||[]).forEach(function(campo){ escribir[campo] = firebase.firestore.FieldValue.delete(); delete final[campo]; });
    tx.update(ref, escribir);
    if(esPublicable(final)) tx.set(pubRef, camposPublicos(final)); else tx.delete(pubRef);
  });
}

// Muestra el error al usuario. Devuelve false para que la funcion que llamo se detenga.
function avisarError(e){
  alert(e && e.conflicto ? e.message : 'No se pudo confirmar con la nube. Revisa tu conexion e intenta de nuevo.');
  return false;
}

export { cambiarEstadoSeguro, avisarError };
