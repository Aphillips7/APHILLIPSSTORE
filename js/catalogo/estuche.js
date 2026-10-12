// =================== CAJA DE RELOJES (debajo del carrusel) ===================
// Foto de la caja abierta con 3 relojes: aparece con una animacion en cuanto la seccion asoma en pantalla.
(function(){
  var sec = document.getElementById('estuche'); if(!sec) return;
  if(!('IntersectionObserver' in window)) return;     // sin soporte: la foto se ve directo, sin animacion
  sec.classList.add('listo');
  var io = new IntersectionObserver(function(entradas){
    entradas.forEach(function(e){
      if(e.isIntersecting){ sec.classList.add('visible'); io.disconnect(); }
    });
  }, { threshold: 0.12 });
  io.observe(sec);
})();
