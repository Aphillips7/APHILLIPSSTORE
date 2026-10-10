// Configuracion unica de Firebase para el panel y el catalogo.
// El SDK "compat" se carga con <script> en cada HTML antes de los modulos.
// Estas claves son publicas por diseno (el repo es publico): lo que protege
// los datos son las reglas de Firestore (firestore.rules), no este archivo.
const firebaseConfig = {
  apiKey: "AIzaSyCz8cHrafrPGYvp-x9iv1ccFQSobJrFmxo",
  authDomain: "aphillips-store-733df.firebaseapp.com",
  projectId: "aphillips-store-733df",
  storageBucket: "aphillips-store-733df.firebasestorage.app",
  messagingSenderId: "679941981880",
  appId: "1:679941981880:web:f7332e914647ee624dd64d"
};

export const firebase = window.firebase;
firebase.initializeApp(firebaseConfig);
export const db = firebase.firestore();
// Persistencia offline: si no esta disponible (modo privado, varias pestanas...) no rompe nada.
try { db.enablePersistence({ synchronizeTabs: true }).catch(function(){}); } catch(e){}
