// Tema del panel: SIEMPRE claro (decision del dueno, 2026-10-24). Se fija data-theme="light" en <html>, que
// tambien anula el modo oscuro automatico del telefono o la computadora (los estilos oscuros de base.css solo
// aplican sin data-theme="light"). index.html lo pone antes de pintar con un script corto en <head>.
document.documentElement.setAttribute('data-theme', 'light');
try{ localStorage.removeItem('aphillips_tema'); }catch(e){}
