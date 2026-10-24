// =================== "YA LLEGO" (reloj en transito -> disponible) ===================
// Un toque: pide lo que se pago de importacion/envio (0 si nada) y con que se pago, suma ese monto al
// costo del reloj, recalcula el margen, registra la importacion como compra en Movimientos y lo pasa a
// "Disponible" (con la fecha de llegada). Si la compra del reloj no estaba registrada, primero la registra.
// POKA-YOKE: solo relojes en transito; el boton se activa con un monto valido (0 o mas) y, si hay monto,
// con el metodo de pago elegido; nada cambia hasta confirmar.
import { registrarCompraConMetodo } from '../finanzas/registrar-compra.js';
import { dinero, esc } from '../componentes.js';
import { renderInicio } from '../inicio.js';
import { idAleatorio, idxInv, invNoExiste, save, state } from '../state.js';

const METODOS = { efectivo: 'Efectivo', yappy: 'Yappy', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro' };

function pedirLlegada(p){
  return new Promise(function(resolver){
    var fondo = document.createElement('div');
    fondo.className = 'metodo-modal';
    fondo.innerHTML = '<div class="metodo-caja" role="dialog" aria-modal="true" aria-label="Llego el reloj">' +
      '<div class="metodo-titulo">¿Llego ' + esc(p.nombre) + '?</div>' +
      '<div class="metodo-detalle">Costo del reloj: ' + dinero(p.costo || p.costoTotal) + '. Escribe lo que pagaste de importacion o envio al recibirlo (0 si no pagaste nada).</div>' +
      '<div class="field" style="margin-bottom:10px;"><label for="lleg-monto">Importacion / envio ($)</label><div class="currency-wrap"><input type="number" id="lleg-monto" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></div></div>' +
      '<div class="field" id="lleg-metodo-wrap" style="margin-bottom:6px;"><label for="lleg-metodo">¿Con que lo pagaste?</label><select id="lleg-metodo"><option value="">Elige el metodo</option>' +
        Object.keys(METODOS).map(function(k){ return '<option value="' + k + '"' + (p.metodoCompra === k ? ' selected' : '') + '>' + METODOS[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="metodo-detalle" id="lleg-resumen" style="margin:8px 0 12px;"></div>' +
      '<button type="button" class="btn btn-gold" id="lleg-ok" style="width:100%;" disabled>Confirmar: ya esta disponible</button>' +
      '<button type="button" class="metodo-cancelar" id="lleg-no">Cancelar</button></div>';
    document.body.appendChild(fondo);
    var monto = fondo.querySelector('#lleg-monto'), metodo = fondo.querySelector('#lleg-metodo'), ok = fondo.querySelector('#lleg-ok'), res = fondo.querySelector('#lleg-resumen');
    var base = Number(p.costoTotal) || 0;
    function leer(){ var v = parseFloat(String(monto.value).replace(',', '.')); return monto.value === '' ? null : (isFinite(v) ? Math.round(v * 100) / 100 : NaN); }
    function validar(){
      var v = leer();
      fondo.querySelector('#lleg-metodo-wrap').style.display = v > 0 ? '' : 'none';
      var valido = v !== null && !isNaN(v) && v >= 0 && v < 100000 && (!(v > 0) || !!metodo.value);
      ok.disabled = !valido;
      if(v === null || isNaN(v)){ res.textContent = ''; return; }
      var total = base + v, mg = p.precio > 0 ? Math.round((p.precio - total) / p.precio * 100) : null;
      res.innerHTML = 'Costo total: <b>' + dinero(total) + '</b>' + (mg !== null ? ' · margen <b class="' + (mg < 15 ? 'neg' : mg >= 30 ? 'pos' : '') + '">' + mg + '%</b>' : '');
    }
    function cerrar(v){ fondo.remove(); resolver(v); }
    monto.addEventListener('input', validar); metodo.addEventListener('change', validar);
    monto.addEventListener('keydown', function(e){ if(e.key === 'Enter' && !ok.disabled) ok.click(); });
    ok.addEventListener('click', function(){ cerrar({ importacion: leer(), metodo: metodo.value }); });
    fondo.querySelector('#lleg-no').addEventListener('click', function(){ cerrar(null); });
    fondo.addEventListener('click', function(e){ if(e.target === fondo) cerrar(null); });
    validar();
    setTimeout(function(){ monto.focus(); }, 30);
  });
}

async function yaLlego(id){
  var i = idxInv(id);
  if(i === -1){ invNoExiste(); return; }
  var p = state.inventario[i];
  if(p.estado !== 'transito'){ alert('Este reloj no esta en transito.'); return; }
  var r = await pedirLlegada(p);
  if(!r) return;
  // 1) la compra del reloj (si no estaba) antes de sumar la importacion, para que todo cuadre
  await registrarCompraConMetodo(state.inventario[idxInv(id)] || p);
  i = idxInv(id); if(i === -1){ invNoExiste(); return; }
  p = state.inventario[i];
  var hoy = new Date().toLocaleDateString('es-MX');
  if(r.importacion > 0){
    p.importacion = Math.round(((Number(p.importacion) || 0) + r.importacion) * 100) / 100;
    p.costoTotal = Math.round(((Number(p.costo) || 0) + p.importacion) * 100) / 100;
    state.movimientos.unshift({ id: idAleatorio('mov'), _ts: Date.now(), tipo: 'compra', invId: p.id, desc: 'Importacion · ' + p.nombre + (p.sku ? ' · Ref. ' + p.sku : ''),
      monto: r.importacion, canal: 'compra', metodoPago: r.metodo, costo: 0, fecha: hoy, _auto: true });
    save('movimientos');
  }
  if(p.precio > 0 && p.costoTotal > 0) p.margen = Math.round((p.precio - p.costoTotal) / p.precio * 100);
  p.estado = 'disponible';
  p.fechaLlegada = hoy;
  p._ts = Date.now();
  save('inventario');
  if(window.toastPanel) window.toastPanel(p.nombre + ' ya esta disponible · costo ' + dinero(p.costoTotal) + (p.precio > 0 ? ' · margen ' + p.margen + '%' : ''));
  try{ if(window.renderInventario) window.renderInventario(); }catch(e){}
  try{ renderInicio(); }catch(e){}
  try{ if(window.cerrarModal && document.getElementById('inv-modal').style.display === 'block') window.cerrarModal(); }catch(e){}
}

export { yaLlego };
Object.assign(window, { yaLlego });
