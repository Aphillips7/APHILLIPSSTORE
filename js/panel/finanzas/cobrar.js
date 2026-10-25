// =================== FINANZAS > POR COBRAR (rediseno fase 4) ===================
// Apartados con saldo: cuanto falta, fecha limite y un boton para registrar el abono o recordarle
// al cliente por WhatsApp (el mensaje lo envia el dueno; aqui solo se arma el enlace).
import { dinero, esc, estadoHTML, kpiHTML, tablaHTML } from '../componentes.js';
import { fechaLimiteReserva, reservasPorCobrar } from './calculos.js';
import { state } from '../state.js';

function telefonoDe(clienteId){
  var c = clienteId && state.clientes.find(function(x){ return x.id === clienteId; });
  var t = c ? String(c.tel || c.telefono || '').replace(/\D/g, '') : '';
  if(t.length === 8) t = '507' + t;      // numeros de Panama sin codigo de pais
  return t.length >= 10 ? t : '';
}
function fechaTxt(d){ return d ? d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() : '—'; }

function renderCobrar(){
  var lista = reservasPorCobrar();
  var conSaldo = lista.filter(function(x){ return x.saldo > 0; });
  var total = conSaldo.reduce(function(a, x){ return a + x.saldo; }, 0);
  var vencidas = conSaldo.filter(function(x){ return x.dias !== null && x.dias < 0; });
  var pronto = conSaldo.filter(function(x){ return x.dias !== null && x.dias >= 0 && x.dias <= 7; });
  var k = document.getElementById('fin-kpis-cobrar');
  if(k) k.innerHTML = [
    kpiHTML({ label: 'Por cobrar', valor: dinero(total), pie: conSaldo.length + ' apartado' + (conSaldo.length !== 1 ? 's' : '') + ' con saldo' }),
    kpiHTML({ label: 'Vencido', valor: dinero(vencidas.reduce(function(a, x){ return a + x.saldo; }, 0)), tono: vencidas.length ? 'neg' : '', pie: vencidas.length + ' fuera de plazo' }),
    kpiHTML({ label: 'Vence esta semana', valor: String(pronto.length), pie: dinero(pronto.reduce(function(a, x){ return a + x.saldo; }, 0)) }),
    kpiHTML({ label: 'Ya abonado', valor: dinero(lista.reduce(function(a, x){ return a + x.abonado; }, 0)), pie: 'en ' + lista.length + ' apartado' + (lista.length !== 1 ? 's' : '') })
  ].join('');
  var t = document.getElementById('fin-tabla-cobrar'); if(!t) return;
  t.innerHTML = tablaHTML([{ t: 'Cliente' }, { t: 'Reloj' }, { t: 'Acordado', der: true }, { t: 'Abonado', der: true }, { t: 'Saldo', der: true }, { t: 'Fecha limite' }, { t: '' }],
    lista.map(function(x){
      var p = x.p, r = p.reserva, tel = telefonoDe(r.clienteId);
      var est = x.saldo <= 0 ? estadoHTML('ok', 'Pagado, falta entregar') : x.dias === null ? estadoHTML('info', 'Sin fecha') :
        x.dias < 0 ? estadoHTML('vencido', 'Vencido hace ' + (-x.dias) + ' d') : x.dias <= 7 ? estadoHTML('pendiente', 'Vence en ' + x.dias + ' d') : estadoHTML('ok', 'Al dia');
      var msg = 'Hola ' + (r.clienteNombre || '').split(' ')[0] + ', te escribo de APHILLIPS STORE por tu ' + p.nombre + '. Tu saldo pendiente es de ' + dinero(x.saldo) + '. ¿Cuando te queda bien completar el pago?';
      var acciones = (x.saldo > 0 ? '<button type="button" class="btn btn-gold btn-sm" onclick="abrirAbonoModal(\'' + esc(p.id) + '\')">Registrar abono</button>' :
        '<button type="button" class="btn btn-gold btn-sm" onclick="completarVentaReserva(\'' + esc(p.id) + '\')">Entregar</button>') +
        (tel && x.saldo > 0 ? ' <a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="https://wa.me/' + tel + '?text=' + encodeURIComponent(msg) + '">Recordar</a>' : '');
      return [esc(r.clienteNombre || 'Sin cliente'), esc(p.nombre), dinero(x.acordado), dinero(x.abonado), '<b>' + dinero(x.saldo) + '</b>',
        est + '<div class="tenue-peq">' + fechaTxt(fechaLimiteReserva(p)) + '</div>', '<div class="acciones-fila">' + acciones + '</div>'];
    }), { icono: 'listo', titulo: 'No hay apartados por cobrar', texto: 'Cuando apartes un reloj con abono, aqui veras el saldo y su fecha limite.' });
}

export { renderCobrar };
Object.assign(window, { renderCobrar });
