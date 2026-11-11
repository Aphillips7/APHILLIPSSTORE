// =================== TEMPORADAS (Panama) ===================
// Una sola fuente de fechas para todo lo que cambia solo por temporada: la pose y el saludo de la mascota
// (mascota.js). Devuelve '' fuera de temporada.
//   madre:       1 al 8 de diciembre (Dia de la Madre: 8 de diciembre)
//   navidad:     9 al 31 de diciembre
//   sanvalentin: 7 al 14 de febrero
//   padre:       los 10 dias antes del tercer domingo de junio, y ese domingo
export function temporada(f){
  f = f || new Date();
  var m = f.getMonth() + 1, d = f.getDate();
  if(m === 12 && d <= 8) return 'madre';
  if(m === 12) return 'navidad';
  if(m === 2 && d >= 7 && d <= 14) return 'sanvalentin';
  if(m === 6){
    var dom = 1 + (7 - new Date(f.getFullYear(), 5, 1).getDay()) % 7 + 14;   // tercer domingo de junio
    if(d >= dom - 10 && d <= dom) return 'padre';
  }
  return '';
}
