// =================== GASTO / RETIRO ===================
import { renderInicio } from '../inicio.js';
import { idAleatorio, save, state } from '../state.js';

function registrarOtro() {
  var tipo=document.getElementById('fin-tipo').value;
  var desc=document.getElementById('fin-desc-otro').value.trim();
  var monto=parseFloat(document.getElementById('fin-monto-otro').value);
  var metodoPago=document.getElementById('fin-metodo-otro')?document.getElementById('fin-metodo-otro').value:'';
  var categoria=(tipo==='gasto'&&document.getElementById('fin-categoria'))?document.getElementById('fin-categoria').value:'';
  if(!desc||!monto||monto<=0){alert('Completa descripcion y monto.');return;}
  state.movimientos.unshift({id:idAleatorio('mov'),_ts:Date.now(),tipo,desc,monto,canal:tipo,metodoPago:metodoPago,categoria:categoria,costo:0,fecha:new Date().toLocaleDateString('es-MX')});
  save('movimientos');
  document.getElementById('fin-desc-otro').value='';
  document.getElementById('fin-monto-otro').value='';
  renderInicio();
  var btn=document.getElementById('btn-registrar-otro');
  if(btn){var orig=btn.textContent;btn.textContent='Registrado';btn.style.background='var(--green)';setTimeout(()=>{btn.textContent=orig;btn.style.background='';},1800);}
}

function registrarTraspaso(){
  var origen=document.getElementById('traspaso-origen').value;
  var destino=document.getElementById('traspaso-destino').value;
  var monto=parseFloat(document.getElementById('traspaso-monto').value);
  if(!monto||monto<=0){alert('Ingresa el monto a traspasar.');return;}
  if(origen===destino){alert('El origen y el destino deben ser diferentes.');return;}
  var metodos={efectivo:'Efectivo',yappy:'Yappy',transferencia:'Transferencia',tarjeta:'Tarjeta',otro:'Otro'};
  state.movimientos.unshift({id:idAleatorio('mov'),_ts:Date.now(),tipo:'traspaso',desc:'Traspaso: '+metodos[origen]+' \u2192 '+metodos[destino],monto:monto,canal:'traspaso',metodoOrigen:origen,metodoDestino:destino,costo:0,fecha:new Date().toLocaleDateString('es-MX')});
  save('movimientos');
  document.getElementById('traspaso-monto').value='';
  renderInicio();
  var btn=document.getElementById('btn-registrar-traspaso');
  if(btn){var orig=btn.textContent;btn.textContent='Traspaso registrado';btn.style.background='var(--green)';setTimeout(()=>{btn.textContent=orig;btn.style.background='';},1800);}
}

export { registrarOtro, registrarTraspaso };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { registrarOtro, registrarTraspaso });
