// services/zebra.service.js

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

// ------------------------------------------------
// CONFIG
// ------------------------------------------------
const TEMPLATE_PATH =
  path.join(__dirname, '/zpl/etiqueta_60x32_base.zpl');

const PRINTER_SHARE =
  process.env.ZEBRA_SHARE_PATH || '\\\\localhost\\Zebra';

// ------------------------------------------------
// HELPERS
// ------------------------------------------------
function toNumber(val) {
  if (val === null || val === undefined) return null;
  return typeof val === 'number' ? val : Number(val);
}

function fmtCLP(val) {
  const n = toNumber(val);
  if (n === null) return '$0';
  return '$' + Math.round(n).toLocaleString('es-CL');
}

function formatDateCL(date) {
  if (!date) return '';

  // ✅ Si ya viene en formato DD/MM/YYYY, devolver tal cual
  if (typeof date === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
    return date;
  }

  // ✅ Limpiar textos como "(Argentina Standard Time)"
  if (typeof date === 'string') {
    date = date.replace(/\s*\(.*\)$/, '');
  }

  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  return `${String(d.getDate()).padStart(2,'0')}/${
    String(d.getMonth() + 1).padStart(2,'0')
  }/${d.getFullYear()}`;
}
``

// ------------------------------------------------
// BUILD ZPL
// ------------------------------------------------
function buildEtiqueta(data) {

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  // -------------------------
  // Precios
  // -------------------------
  const precioNormalFmt = fmtCLP(data.precioNormal);
  const precioOfertaFmt = fmtCLP(data.precioOferta);

  const precioFinal = data.precioOferta
    ? precioOfertaFmt
    : precioNormalFmt;

  const mostrarPrecioNormal =
    data.precioOferta &&
    data.precioNormal &&
    data.precioNormal !== data.precioOferta;

  const precioNormalPrint = mostrarPrecioNormal
    ? precioNormalFmt
    : '';

  const precioUnit = fmtCLP(data.precioUnitario);

  // -------------------------
  // Fecha (YA CORRECTA)
  // -------------------------
  const validoHasta = formatDateCL(
    data.validoHasta || data.vigenciaFin
  );

  // -------------------------
  // EAN (compatibilidad)
  // -------------------------
  const ean = data.ean13 || data.codigoBarras || '';

  return template
    .replace('{PRODUCTO}', data.producto || '')
    .replace('{PRECIO_NORMAL}', precioNormalPrint)
    .replace('{PRECIO}', precioFinal || '')
    .replace('{PRECIO_UNIT}', precioUnit || '')
    .replace('{UM}', data.unidadMedida || '')
    .replace(/{EAN13}/g, ean)
    .replace('{SKU}', data.sku || '')
    .replace('{FECHA}', validoHasta || '');
}

// ------------------------------------------------
// PRINT RAW WINDOWS
// ------------------------------------------------
function sendWindowsRaw(zpl) {

  const tmp = path.join(os.tmpdir(), `label_${Date.now()}.zpl`);
  fs.writeFileSync(tmp, zpl, 'utf8');

  return new Promise((resolve, reject) => {
    execFile(
      'cmd.exe',
      ['/d','/c','copy','/y','/b', tmp, PRINTER_SHARE],
      { windowsHide: true },
      (err) => {
        fs.unlink(tmp, ()=>{});
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

// ------------------------------------------------
// API
// ------------------------------------------------
async function printEtiquetaOferta(payload) {
  const zpl = buildEtiqueta(payload);
  return sendWindowsRaw(zpl);
}

async function printEtiquetasBatch(productos) {

  console.log('productos:', productos);

  for (const p of productos) {
    const qty = Math.max(1, Number(p.cantidad) || 1);

    for (let i = 0; i < qty; i++) {
      const zpl = buildEtiqueta(p);
      await sendWindowsRaw(zpl);   // ✅ enviar una etiqueta a la vez	  
	  
      // ⏳ DELAY CRÍTICO PARA GC420t
      await new Promise(resolve => setTimeout(resolve, 120));
    }
  }
}

async function printEtiquetas(payload) {

  if (Array.isArray(payload)) {
    return printEtiquetasBatch(payload);  //varios
  }

  const qty = Math.max(1, Number(payload.cantidad) || 1);

  for (let i = 0; i < qty; i++) {
    const zpl = buildEtiqueta(payload);
    await sendWindowsRaw(zpl);
	
	await new Promise(resolve => setTimeout(resolve, 120));  //GC420t
  }
}

module.exports = {
	buildEtiqueta,
  printEtiquetaOferta,
  printEtiquetasBatch,
  printEtiquetas  
};