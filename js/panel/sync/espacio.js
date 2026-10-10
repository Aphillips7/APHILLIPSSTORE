// =================== ESPACIO USADO (FIRESTORE 1GB GRATIS) ===================
import { state } from '../state.js';

var LIMITE_FIRESTORE_BYTES = 1024*1024*1024; // 1 GiB
function calcularEspacioUsado(){
  var totalBytes=0;
  var porColeccion={inventario:0,movimientos:0,clientes:0};
  ['inventario','movimientos','clientes'].forEach(function(key){
    (state[key]||[]).forEach(function(item){
      var bytes=new Blob([JSON.stringify(item)]).size;
      porColeccion[key]+=bytes;
      totalBytes+=bytes;
    });
  });
  return {totalBytes:totalBytes,porColeccion:porColeccion};
}
function formatoMB(bytes){
  var mb=bytes/(1024*1024);
  if(mb<1)return (bytes/1024).toFixed(0)+' KB';
  return mb.toFixed(mb<10?2:1)+' MB';
}
function renderEspacioUsado(){
  var txt=document.getElementById('espacio-texto');
  if(!txt)return;
  var r=calcularEspacioUsado();
  var pct=(r.totalBytes/LIMITE_FIRESTORE_BYTES)*100;
  var pctMostrar=pct<0.01?'<0.01':pct.toFixed(pct<1?2:1);
  txt.textContent='Usando '+formatoMB(r.totalBytes)+' de 1024 MB gratis';
  var pctEl=document.getElementById('espacio-pct');
  if(pctEl)pctEl.textContent=pctMostrar+'%';
  var barra=document.getElementById('espacio-barra');
  var color=pct<60?'var(--green)':pct<85?'var(--accent)':'var(--red)';
  if(barra){barra.style.width=Math.min(100,pct)+'%';barra.style.background=color;}
  var detalle=document.getElementById('espacio-detalle');
  if(detalle){
    detalle.textContent='Inventario: '+formatoMB(r.porColeccion.inventario)+' · Historial: '+formatoMB(r.porColeccion.movimientos)+' · Clientes: '+formatoMB(r.porColeccion.clientes);
  }
  var aviso=document.getElementById('espacio-aviso');
  if(aviso){
    if(pct>=85){
      aviso.style.display='block';
      aviso.style.background='var(--red-bg)';aviso.style.color='var(--red)';aviso.style.border='1px solid var(--red)';
      aviso.textContent='Te estas acercando al limite gratis de 1 GB. Cuando lo alcances, la sincronizacion dejara de guardar nueva informacion hasta que actives el plan de pago (Blaze) o liberes espacio (por ejemplo, comprimiendo o quitando fotos antiguas).';
    }else if(pct>=60){
      aviso.style.display='block';
      aviso.style.background='var(--bg2)';aviso.style.color='var(--muted)';aviso.style.border='1px solid var(--border2)';
      aviso.textContent='Vas usando mas de la mitad del espacio gratis. Todavia no es urgente, pero es buen momento para tenerlo en mente si sigues agregando muchas fotos.';
    }else{
      aviso.style.display='none';
    }
  }
}

export { calcularEspacioUsado, formatoMB, LIMITE_FIRESTORE_BYTES, renderEspacioUsado };
