// De donde lee y donde guarda el panel sus datos.
//   'cloudflare': Cloudflare (D1) es la fuente principal y Firebase recibe una copia de respaldo.
//   'firebase'  : como antes de la etapa 3b (Firestore en tiempo real). Sirve para volver atras.
const FUENTE_DATOS = 'cloudflare';

export { FUENTE_DATOS };
