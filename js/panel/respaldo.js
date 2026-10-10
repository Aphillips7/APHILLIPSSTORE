// =================== RESPALDO (JSON) ===================
import { save, saveMeta, state } from './state.js';
import { refrescarVistaCompleta } from './sync/listeners.js';
import { asegurarIds } from './sync/sync.js';

function construirDatosRespaldo(){
  return {
    exportado:new Date().toISOString(),
    movimientos:state.movimientos,
    inventario:state.inventario,
    clientes:state.clientes,
    meta:state.meta,
    ideas:state.ideas,
    tasks:state.tasks,
    weekTasks:state.weekTasks
  };
}
function renderResumenRespaldo(){
  var el=document.getElementById('respaldo-info');
  if(el){
    var last=localStorage.getItem('lastExportISO');
    var texto, color='var(--muted)';
    if(last){
      var d=new Date(last);
      var dias=Math.floor((Date.now()-d.getTime())/86400000);
      texto='Ultimo respaldo exportado: '+d.toLocaleDateString('es-MX')+' '+d.toLocaleTimeString('es-MX');
      if(dias>=7){ color='var(--red)'; texto+=' — han pasado '+dias+' dias, se recomienda exportar uno nuevo.'; }
    } else {
      texto='Aun no has exportado ningun respaldo local.';
      color='var(--red)';
    }
    el.innerHTML='<span style="font-size:12px;color:'+color+';">'+texto+'</span>';
  }
  var conteo=document.getElementById('respaldo-conteo');
  if(conteo){
    conteo.textContent=state.inventario.length+' relojes · '+state.movimientos.length+' movimientos · '+state.clientes.length+' clientes';
  }
}
function exportarJSON(){
  var data=construirDatosRespaldo();
  var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='respaldo-tienda-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.json';
  a.click();
  localStorage.setItem('lastExportISO',new Date().toISOString());
  renderResumenRespaldo();
}
async function copiarRespaldoComoTexto(){
  var data=construirDatosRespaldo();
  var texto=JSON.stringify(data);
  try{
    await navigator.clipboard.writeText(texto);
    localStorage.setItem('lastExportISO',new Date().toISOString());
    renderResumenRespaldo();
    alert('Respaldo copiado al portapapeles. Pegalo en WhatsApp, Notas o donde prefieras guardarlo.');
  }catch(e){
    alert('No se pudo copiar automaticamente en este dispositivo. Usa el boton "Exportar respaldo" en su lugar.');
  }
}
function borrarYRecargarDesdeNube(){
  if(!confirm('Esto borra los datos guardados en ESTE dispositivo (no en la nube) y los vuelve a descargar desde Firebase. Usalo solo si ves algo raro o desactualizado en este dispositivo. Continuar?'))return;
  ['inventario','movimientos','clientes','tasks','meta','weekTasks','ideas','lastSync','syncHistory'].forEach(function(k){ localStorage.removeItem(k); });
  location.reload();
}
function importarJSON(e){
  var file=e.target.files[0];
  if(!file)return;
  var reader=new FileReader();
  reader.onload=async function(ev){
    var data;
    try{ data=JSON.parse(ev.target.result); }
    catch(err){ alert('El archivo no es un JSON valido.'); e.target.value=''; return; }

    var esValido = data && typeof data==='object' &&
      (data.movimientos===undefined||Array.isArray(data.movimientos)) &&
      (data.inventario===undefined||Array.isArray(data.inventario)) &&
      (data.clientes===undefined||Array.isArray(data.clientes)) &&
      (data.ideas===undefined||Array.isArray(data.ideas)) &&
      (data.tasks===undefined||Array.isArray(data.tasks));
    if(!esValido){ alert('El archivo no tiene el formato esperado de un respaldo de esta tienda.'); e.target.value=''; return; }

    var resumen='Vas a reemplazar TODOS los datos actuales con este respaldo';
    if(data.exportado){ resumen+=' (exportado el '+new Date(data.exportado).toLocaleString('es-MX')+')'; }
    resumen+='.\n\nEsta accion no se puede deshacer. Deseas continuar?';
    if(!confirm(resumen)){ e.target.value=''; return; }

    if(Array.isArray(data.movimientos)) state.movimientos=data.movimientos;
    if(Array.isArray(data.inventario)) state.inventario=data.inventario;
    if(Array.isArray(data.clientes)) state.clientes=data.clientes;
    if(typeof data.meta==='number') state.meta=data.meta;
    if(Array.isArray(data.ideas)) state.ideas=data.ideas;
    if(Array.isArray(data.tasks)) state.tasks=data.tasks;
    if(data.weekTasks && typeof data.weekTasks==='object') state.weekTasks=data.weekTasks;

    ['inventario','movimientos','clientes'].forEach(function(k){ asegurarIds(k); });
    ['movimientos','inventario','clientes','ideas','tasks','weekTasks'].forEach(function(k){ save(k); });
    saveMeta();

    refrescarVistaCompleta();
    e.target.value='';
    alert('Datos restaurados correctamente.');
  };
  reader.onerror=function(){ alert('No se pudo leer el archivo.'); e.target.value=''; };
  reader.readAsText(file);
}

export { borrarYRecargarDesdeNube, construirDatosRespaldo, copiarRespaldoComoTexto, exportarJSON, importarJSON, renderResumenRespaldo };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { borrarYRecargarDesdeNube, copiarRespaldoComoTexto, exportarJSON, importarJSON });
