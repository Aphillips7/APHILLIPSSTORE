// Estado de la sesion del cliente en el catalogo (lo llena cuenta.js). Sin dependencias, para que
// whatsapp.js, modal.js o vistas.js puedan leerlo sin cargar Firebase.
const sesion = {
  activa: false,      // hay un cliente con sesion iniciada
  perfil: null,       // { nombre, telefono, email }
  avisos: [],         // [{ tipo, valor }]
  esAdmin: false      // la cuenta es la del dueno (solo cambia lo que se muestra)
};

// "Hola!" o "Hola! Soy Ana." para empezar los mensajes de WhatsApp
function saludo(){
  var n = sesion.activa && sesion.perfil && sesion.perfil.nombre ? sesion.perfil.nombre.split(' ')[0] : '';
  return n ? 'Hola! Soy ' + n + '.' : 'Hola!';
}
function tieneAviso(tipo, valor){
  return sesion.avisos.some(function(a){ return a.tipo === tipo && a.valor === valor; });
}

export { saludo, sesion, tieneAviso };
