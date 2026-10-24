// =================== EXPORTAR A EXCEL (CSV) ===================
// Inventario y movimientos en CSV para abrir en Excel o Google Sheets (contabilidad, inventario fisico).
// Con BOM para que Excel lea bien los acentos; las celdas que empiezan con = + - @ se protegen con '
// para que Excel no las ejecute como formulas.
import { state } from './state.js';

function celda(v){
  if(v === null || v === undefined) v = '';
  if(typeof v === 'number') return String(Math.round(v * 100) / 100);
  v = String(v);
  if(/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  return '"' + v.replace(/"/g, '""') + '"';
}
function descargarCSV(nombre, filas){
  var csv = filas.map(function(f){ return f.map(celda).join(','); }).join('\r\n');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = nombre + '-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
}

var ESTADOS = { disponible: 'Disponible', transito: 'En tránsito', bajopedido: 'Bajo pedido', reservado: 'Apartado', vendido: 'Vendido' };
function exportarInventarioCSV(){
  var filas = [['Modelo', 'Referencia', 'Colección', 'Género', 'Estado', 'Diámetro (mm)', 'Movimiento', 'Costo', 'Importación', 'Costo total',
    'Precio de venta', 'Precio mínimo', 'Margen %', 'Proveedor', 'N.º de serie', 'Paquetería', 'Guía', 'Fecha de alta', 'Vendido el', 'Precio vendido',
    'Apartado por', 'Precio acordado', 'Abonado', 'Oculto en la tienda']];
  state.inventario.forEach(function(p){
    var r = p.reserva || null;
    var abonado = r ? (r.abonos || []).reduce(function(a, x){ return a + (Number(x.monto) || 0); }, 0) : '';
    filas.push([p.nombre, p.sku, p.coleccion, p.genero, ESTADOS[p.estado] || p.estado, p.mm, p.movimiento,
      Number(p.costo) || 0, Number(p.importacion) || 0, Number(p.costoTotal) || 0, Number(p.precio) || 0, Number(p.precioMin) || 0, Number(p.margen) || 0,
      p.proveedor, p.serie, p.paqueteria, p.tracking, p.fecha, p.fechaVenta, p.precioVenta !== undefined ? Number(p.precioVenta) || 0 : '',
      r ? r.clienteNombre : '', r ? Number(r.precioAcordado) || 0 : '', abonado, p.ocultoCatalogo ? 'Sí' : '']);
  });
  descargarCSV('inventario-aphillips', filas);
}

var TIPOS = { venta: 'Venta', compra: 'Compra', gasto: 'Gasto', retiro: 'Retiro', abono: 'Abono', traspaso: 'Traspaso', reserva_cancelada: 'Apartado cancelado' };
// filtro opcional (m => bool) y nombre de archivo: Finanzas exporta solo el periodo elegido
function exportarMovimientosCSV(filtro, nombre){
  var filas = [['Fecha', 'Tipo', 'Descripción', 'Monto', 'Costo del reloj', 'Ganancia', 'Forma de pago', 'Canal', 'Cliente', 'Categoría']];
  state.movimientos.filter(function(m){ return typeof filtro !== 'function' || filtro(m); }).sort(function(a, b){ return (a._ts || 0) - (b._ts || 0); }).forEach(function(m){
    var monto = Number(m.monto) || 0, costo = Number(m.costo) || 0;
    var ganancia = (m.tipo === 'venta' || m.tipo === 'abono') ? monto - costo : '';
    filas.push([m.fecha, TIPOS[m.tipo] || m.tipo, m.desc, monto, m.tipo === 'venta' ? costo : '', ganancia,
      m.metodoPago || (m.metodoOrigen ? m.metodoOrigen + ' → ' + m.metodoDestino : ''), m.canal, m.clienteNombre, m.categoria]);
  });
  descargarCSV(typeof nombre === 'string' ? nombre + '-aphillips' : 'movimientos-aphillips', filas);
}

export { descargarCSV, exportarInventarioCSV, exportarMovimientosCSV };
// Usadas desde atributos onclick del HTML
Object.assign(window, { exportarInventarioCSV, exportarMovimientosCSV });
