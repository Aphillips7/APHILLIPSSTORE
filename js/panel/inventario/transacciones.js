// Cambios de estado que no se pueden pisar entre dispositivos (vender, reservar,
// completar o cancelar una reserva). El servidor de Cloudflare (POST /datos/estado) lee el
// estado REAL del reloj y solo escribe si sigue siendo el que el usuario veia en pantalla.
// Asi dos celulares no pueden vender el mismo reloj. El catalogo publico se actualiza despues
// con el sync normal (save('inventario')).
import { cambiarEstadoNube } from '../sync/nube.js';

// cambios: campos a escribir en el reloj; "quitar": lista de campos a borrar.
async function cambiarEstadoSeguro(id, estadoEsperado, cambios, quitar){
  return cambiarEstadoNube(id, estadoEsperado, cambios, quitar);
}

// Muestra el error al usuario. Devuelve false para que la funcion que llamo se detenga.
function avisarError(e){
  alert(e && e.conflicto ? e.message : 'No se pudo confirmar con la nube. Revisa tu conexion e intenta de nuevo.');
  return false;
}

export { cambiarEstadoSeguro, avisarError };
