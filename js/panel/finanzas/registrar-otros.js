// =================== GASTO / RETIRO / TRASPASO ===================
// Poka-yoke: el boton se activa solo con datos validos (descripcion, monto > 0, categoria del gasto);
// el monto se redondea a centavos; un traspaso no puede dejar el metodo de origen en negativo; un
// retiro mayor que el saldo del metodo pide confirmacion; y si ya se registro lo mismo hoy, pregunta.
import { renderInicio } from '../inicio.js';
import { idAleatorio, save, state } from '../state.js';
import { METODOS, saldosPorMetodo } from './calculos.js';
import { dinero } from '../componentes.js';

const MONTO_MAX = 1000000;
function el(id){ return document.getElementById(id); }
function leerMonto(id){
  var v = parseFloat(String((el(id) || {}).value || '').replace(',', '.'));
  return isFinite(v) ? Math.round(v * 100) / 100 : 0;
}
function hoyTxt(){ return new Date().toLocaleDateString('es-MX'); }
function ayuda(id, txt, error){
  var a = el(id); if(!a) return;
  a.textContent = txt || '';
  a.classList.toggle('error', !!error);
  a.hidden = !txt;
}
function exito(btn, texto){
  if(!btn) return;
  var orig = btn.textContent; btn.textContent = texto; btn.classList.add('btn-exito');
  setTimeout(function(){ btn.textContent = orig; btn.classList.remove('btn-exito'); validarOtro(); validarTraspaso(); }, 1800);
}

// ---------- gasto / retiro ----------
function validarOtro(){
  var btn = el('btn-registrar-otro'); if(!btn) return false;
  var tipo = (el('fin-tipo') || {}).value;
  var desc = ((el('fin-desc-otro') || {}).value || '').trim();
  var monto = leerMonto('fin-monto-otro');
  var crudo = (el('fin-monto-otro') || {}).value || '';
  var ok = desc.length >= 3 && monto > 0 && monto < MONTO_MAX;
  btn.disabled = !ok;
  if(crudo !== '' && !(monto > 0)) ayuda('otro-ayuda', 'El monto debe ser mayor que 0.', true);
  else if(monto >= MONTO_MAX) ayuda('otro-ayuda', 'Ese monto es demasiado alto. Revisa los ceros.', true);
  else if(desc && desc.length < 3) ayuda('otro-ayuda', 'Escribe una descripcion un poco mas clara.', true);
  else if(tipo === 'retiro' && monto > 0){
    var m = (el('fin-metodo-otro') || {}).value, s = saldosPorMetodo().porMetodo[m] || 0;
    ayuda('otro-ayuda', 'Saldo en ' + (METODOS[m] || m) + ': ' + dinero(s) + (monto > s ? ' · el retiro es mayor que el saldo' : ''), monto > s);
  }
  else ayuda('otro-ayuda', '');
  return ok;
}
function registrarOtro() {
  if(!validarOtro()) return;
  var tipo = el('fin-tipo').value;
  var desc = el('fin-desc-otro').value.trim();
  var monto = leerMonto('fin-monto-otro');
  var metodoPago = el('fin-metodo-otro') ? el('fin-metodo-otro').value : '';
  var categoria = (tipo === 'gasto' && el('fin-categoria')) ? el('fin-categoria').value : '';
  if(tipo === 'gasto' && !categoria){ alert('Elige la categoria del gasto.'); return; }
  var nombres = { gasto: 'Gasto', retiro: 'Retiro', aporte: 'Aporte de capital' };
  var hoy = hoyTxt();
  var repetido = state.movimientos.find(function(m){ return m.tipo === tipo && m.fecha === hoy && Math.round((Number(m.monto) || 0) * 100) === Math.round(monto * 100) && (m.categoria || '') === (categoria || ''); });
  if(repetido && !confirm('Hoy ya registraste un ' + (nombres[tipo] || tipo).toLowerCase() + ' de ' + dinero(monto) + ' ("' + repetido.desc + '").\n\n¿Es otro distinto y quieres registrarlo de nuevo?')) return;
  if(tipo === 'retiro'){
    var s = saldosPorMetodo().porMetodo[metodoPago] || 0;
    if(monto > s && !confirm('El retiro (' + dinero(monto) + ') es mayor que el saldo registrado en ' + (METODOS[metodoPago] || metodoPago) + ' (' + dinero(s) + ').\n\n¿Seguro que el metodo es correcto?')) return;
  }
  if(!confirm('Registrar ' + (nombres[tipo] || tipo).toLowerCase() + ' de ' + dinero(monto) + (metodoPago ? ' (' + (METODOS[metodoPago] || metodoPago) + ')' : '') + (categoria ? ' · ' + categoria : '') + ':\n"' + desc + '"\n\n¿Es correcto?')) return;
  state.movimientos.unshift({ id: idAleatorio('mov'), _ts: Date.now(), tipo: tipo, desc: desc, monto: monto, canal: tipo, metodoPago: metodoPago, categoria: categoria, costo: 0, fecha: hoy });
  save('movimientos');
  el('fin-desc-otro').value = '';
  el('fin-monto-otro').value = '';
  [el('fin-desc-otro'), el('fin-monto-otro')].forEach(function(x){ if(x) delete x.dataset.tocado; });
  renderInicio();
  validarOtro();
  exito(el('btn-registrar-otro'), 'Registrado');
}

// ---------- traspaso ----------
function validarTraspaso(){
  var btn = el('btn-registrar-traspaso'); if(!btn) return false;
  var origen = (el('traspaso-origen') || {}).value, destino = (el('traspaso-destino') || {}).value;
  var monto = leerMonto('traspaso-monto'), crudo = (el('traspaso-monto') || {}).value || '';
  var saldo = saldosPorMetodo().porMetodo[origen] || 0;
  var ok = false;
  if(origen === destino) ayuda('traspaso-ayuda', 'El origen y el destino deben ser distintos.', true);
  else if(crudo !== '' && !(monto > 0)) ayuda('traspaso-ayuda', 'El monto debe ser mayor que 0.', true);
  else if(monto > saldo + 0.001) ayuda('traspaso-ayuda', 'En ' + (METODOS[origen] || origen) + ' solo hay ' + dinero(saldo) + ': el saldo no puede quedar negativo.', true);
  else { ayuda('traspaso-ayuda', 'Disponible en ' + (METODOS[origen] || origen) + ': ' + dinero(saldo)); ok = monto > 0; }
  btn.disabled = !ok;
  return ok;
}
function registrarTraspaso(){
  if(!validarTraspaso()) return;
  var origen = el('traspaso-origen').value, destino = el('traspaso-destino').value;
  var monto = leerMonto('traspaso-monto');
  if(!confirm('Traspasar ' + dinero(monto) + ' de ' + METODOS[origen] + ' a ' + METODOS[destino] + '?')) return;
  state.movimientos.unshift({ id: idAleatorio('mov'), _ts: Date.now(), tipo: 'traspaso', desc: 'Traspaso: ' + METODOS[origen] + ' → ' + METODOS[destino], monto: monto, canal: 'traspaso', metodoOrigen: origen, metodoDestino: destino, costo: 0, fecha: hoyTxt() });
  save('movimientos');
  el('traspaso-monto').value = '';
  delete el('traspaso-monto').dataset.tocado;
  renderInicio();
  validarTraspaso();
  exito(el('btn-registrar-traspaso'), 'Traspaso registrado');
}

export { registrarOtro, registrarTraspaso, validarOtro, validarTraspaso };
// Usadas desde atributos onclick/oninput del HTML
Object.assign(window, { registrarOtro, registrarTraspaso, validarOtro, validarTraspaso });
