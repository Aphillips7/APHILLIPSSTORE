// =================== CAJA DE RELOJES (debajo del carrusel) ===================
// Foto de la caja abierta con 3 relojes: aparece con una animacion en cuanto la seccion asoma en pantalla
// y se oculta al salir (bajando o subiendo), para repetirse cada vez que vuelve a verse.
(function(){
  var sec = document.getElementById('estuche'); if(!sec) return;
  if(!('IntersectionObserver' in window)) return;     // sin soporte: la foto se ve directo, sin animacion
  sec.classList.add('listo');
  var io = new IntersectionObserver(function(entradas){
    entradas.forEach(function(e){
      if(e.intersectionRatio >= 0.12) sec.classList.add('visible');
      else if(!e.isIntersecting) sec.classList.remove('visible');      // solo cuando ya salio del todo
    });
  }, { threshold: [0, 0.12] });
  io.observe(sec);
})();
