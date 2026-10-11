// Firebase solo se usa para el LOGIN del panel (Firebase Auth). Los datos estan en Cloudflare.
// El SDK "compat" (app + auth) se carga con <script> en index.html antes de los modulos.
// Estas claves son publicas por diseno (el repo es publico): lo que protege los datos es que el
// Worker de Cloudflare verifica la sesion (ID token) y que sea la cuenta del dueno.
const firebaseConfig = {
  apiKey: "AIzaSyCz8cHrafrPGYvp-x9iv1ccFQSobJrFmxo",
  // El login de Google pasa por nuestro dominio (el Worker de la tienda reenvia /__/auth/ a Firebase),
  // asi Google muestra "aphillipsstore.com" en la ventana y en su correo, no el nombre de Firebase.
  authDomain: "aphillipsstore.com",
  projectId: "aphillips-store-733df",
  storageBucket: "aphillips-store-733df.firebasestorage.app",
  messagingSenderId: "679941981880",
  appId: "1:679941981880:web:f7332e914647ee624dd64d"
};

export const firebase = window.firebase;
firebase.initializeApp(firebaseConfig);
export { firebaseConfig };
