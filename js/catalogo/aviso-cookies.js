// =================== AVISO DE COOKIES ===================
// Aviso pequeno la primera vez: la tienda solo guarda lo necesario para funcionar (sesion, favoritos,
// copia del catalogo); no hay cookies de publicidad. Al tocar "Entendido" no vuelve a salir.
(function(){
  var CLAVE = 'aphillips_aviso_cookies';
  try{ if(localStorage.getItem(CLAVE) === '1') return; }catch(e){ return; }
  var aviso = document.createElement('div');
  aviso.className = 'aviso-cookies';
  aviso.setAttribute('role', 'region');
  aviso.setAttribute('aria-label', 'Aviso de cookies');
  aviso.innerHTML = '<p>Usamos solo lo necesario para que la tienda funcione, como tu sesión y tus favoritos. No usamos cookies de publicidad. <a href="legal.html#cookies">Más información</a></p>' +
    '<button type="button">Entendido</button>';
  aviso.querySelector('button').addEventListener('click', function(){
    try{ localStorage.setItem(CLAVE, '1'); }catch(e){}
    aviso.classList.remove('on');
    setTimeout(function(){ aviso.remove(); }, 250);
  });
  document.body.appendChild(aviso);
  setTimeout(function(){ aviso.classList.add('on'); }, 1200);
})();
