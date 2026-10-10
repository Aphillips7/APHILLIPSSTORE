window.addEventListener('resize', function(){
  var hd = document.getElementById('site-header');
  if(hd) document.documentElement.style.setProperty('--header-h', hd.offsetHeight + 'px');
});

  // === ENCABEZADO TRANSPARENTE SOBRE EL HERO ===
  (function(){
    var header = document.getElementById('site-header');
    var hero = document.getElementById('hero');
    var ticking = false;
    function actualizar(){
      ticking = false;
      if(!header || !hero) return;
      document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
      var heroVisible = hero.offsetHeight > 0; // en celular el hero esta oculto
      var limite = hero.offsetHeight - header.offsetHeight;
      header.classList.toggle('on-hero', heroVisible && window.scrollY < limite);
      // efecto Omega: cuanto se ha cubierto la portada (0 = nada, 1 = cubierta)
      if(heroVisible){
        var y = Math.min(hero.offsetHeight, Math.max(0, window.scrollY));
        hero.style.setProperty('--hero-p', (y / hero.offsetHeight).toFixed(3));
        hero.style.setProperty('--hero-y', Math.round(y) + 'px');
      }
    }
    function onScroll(){ if(!ticking){ ticking = true; requestAnimationFrame(actualizar); } }
    window.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('resize', onScroll);
    window.addEventListener('load', actualizar);
    actualizar();
  })();
