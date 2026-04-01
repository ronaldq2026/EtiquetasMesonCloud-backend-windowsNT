// services/zebra.service.js
// Zebra ZD220t - GC420T  - 60x32 mm

const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const { detectZebraPrinter } = require('./zebra.detector');

let PRINTER = {
  type: 'UNKNOWN',
  name: null
};

(async () => {
  try {
    PRINTER = await detectZebraPrinter();
    console.log('🖨️ Zebra detectada:', PRINTER);
  } catch (err) {
    console.error('❌ Error detectando impresora Zebra', err);
  }
})();

// ------------------------------------------------
// Helpers
// ------------------------------------------------

function toNumber(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;

  let s = String(val).trim();

  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function formatDateCL(dateStr) {
  if (!dateStr) return '';

  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/');
    return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';

  return `${String(d.getDate()).padStart(2,'0')}/${
    String(d.getMonth()+1).padStart(2,'0')
  }/${d.getFullYear()}`;
}

function fmtCLP(val) {
  const n = toNumber(val);
  if (n === null) return '$0';
  return '$' + Math.round(n).toLocaleString('es-CL');
}

// ------------------------------------------------
// ZPL Builder
// ------------------------------------------------

function buildZplEtiqueta(data) {
  switch (PRINTER.type) {
    case 'GC420T':
      return buildZplGC420(data);

    case 'ZD220T':
    default:
      return buildZplZD220(data);
  }
}

// ------------------------------------------------
// Datos base comunes a ambas impresoras
// ------------------------------------------------
function buildEtiquetaBase(data) {

  const precioNormal = toNumber(data.precioNormal);
  const precioOferta = toNumber(data.precioOferta);
  const precioUnitario = toNumber(data.precioUnitario);

  return {
    producto: data.producto || '',
    sku: data.sku || '',
    ean13: data.ean13 || '',
    um: data.unidadMedida || '',

    precioNormal,
    precioOferta,
    precioUnitario,

    precioNormalFmt: fmtCLP(precioNormal),
    precioOfertaFmt: fmtCLP(precioOferta),
    precioPrincipal: fmtCLP(precioOferta ?? precioNormal),
    precioUnitarioFmt: fmtCLP(precioUnitario),

    validoHasta: formatDateCL(data.validoHasta || data.vigenciaFin),

    pr: data.pr || 2,
    md: data.md || 5
  };
}

function buildZplGC420(data) {

  const d = buildEtiquetaBase(data);

  let zpl = '';

  zpl += '^XA\n';
  zpl += '^CI28\n';
  zpl += '^LH32,0\n';   // ✅ Mueve todo a la derecha
  zpl += '^LT0\n';    // 🔥 SUBE todo, elimina espacio arriba
  zpl += '^PR3\n';
  zpl += '^MD5\n';

  // Producto
  zpl += '^FO10,8^A0N,22,22^FB400,2,0,C^FD' +
         d.producto + '^FS\n';

  // Precio normal (si existe)
  if (d.precioNormal && d.precioNormal > 0) {
    zpl += '^FO20,55^A0N,18,18^FB400,1,0,C^FDPRECIO NORMAL: ' +     //zpl += '^FO15,45^A0N,18,18^FB400,1,0,C^FDPRECIO NORMAL: ' +
           d.precioNormalFmt + '^FS\n';
  }

  // Precio OFERTA
  zpl += '^FO0,80^A0N,50,50^FB400,1,0,C^FD' +
         d.precioPrincipal + '^FS\n';

  // PRECIO UNITARIO
  zpl += '^FO10,120\n';
  zpl += '^A0N,24,24\n';
  zpl += '^FD' + d.precioUnitarioFmt + (d.um ? ' / ' + d.um : '') + '\n';
  zpl += '^FS\n';

  zpl += '^FO10,145\n';
  zpl += '^A0N,18,18\n';
  zpl += '^FDPrecio Unit.\n';
  zpl += '^FS\n';		 

  // Código de barras
  zpl += '^BY1,2,45\n';
  zpl += '^FO160,120^BCN,45,N,N,N^FD' +
         d.ean13 + '^FS\n';

  // Texto EAN
  zpl += '^FO160,170^A0N,18,18^FB200,1,0,C^FD' +
         d.ean13 + '^FS\n';

	// SKU + FECHA
  zpl += '^FO10,190\n';
  zpl += '^A0N,18,18\n';
  zpl += '^FDSKU:' + d.sku + '\n';
  zpl += '^FS\n';

  zpl += '^FO170,190\n';
  zpl += '^A0N,18,18\n';
  zpl += '^FDVALIDO HASTA: ' + d.validoHasta + '\n';
  zpl += '^FS\n';

  zpl += '^XZ\n';

  return zpl;
}

function buildZplZD220(data) {

  const d = buildEtiquetaBase(data);
  const barcodeHeight = 30;
  
  let zpl = '';

  zpl += '^XA\n';
  zpl += '^CI28\n';

  // 🔧 POSICIONAMIENTO CORRECTO
  zpl += '^LH0,0\n';
  zpl += '^LT0\n';   // 🔥 CORREGIDO (antes -8)
  zpl += '^LS0\n';

  // 🔧 VELOCIDAD / OSCURIDAD
  zpl += '^PR' + d.pr + '\n';
  zpl += '^MD' + d.md + '\n';

  // 🔧 TAMAÑO
  zpl += '^PW480\n';
  zpl += '^LL256\n';

  // -------------------------
  // DESCRIPCIÓN
  // -------------------------
  zpl += '^FO20,0\n';
  zpl += '^A0N,24,24\n';
  zpl += '^FB440,2,0,C\n';
  zpl += '^FD' + d.producto + '\n';
  zpl += '^FS\n';

  // -------------------------
  // PRECIO NORMAL
  // -------------------------
  if (d.precioNormal && d.precioNormal > 0) {
    zpl += '^FO20,55\n';
    zpl += '^A0N,18,18\n';
    zpl += '^FB440,1,0,C\n';
    zpl += '^FDPRECIO NORMAL: ' + d.precioNormalFmt + '\n';
    zpl += '^FS\n';
  }

  // -------------------------
  // PRECIO PRINCIPAL
  // -------------------------
  zpl += '^FO20,75\n';
  zpl += '^A0N,55,55\n';
  zpl += '^FB440,1,0,C\n';
  zpl += '^FD' + d.precioPrincipal + '\n';
  zpl += '^FS\n';

  // -------------------------
  // PRECIO UNITARIO
  // -------------------------
  zpl += '^FO5,120\n';
  zpl += '^A0N,24,24\n';
  zpl += '^FD' + d.precioUnitarioFmt + (d.um ? ' / ' + d.um : '') + '\n';
  zpl += '^FS\n';

  zpl += '^FO10,145\n';
  zpl += '^A0N,18,18\n';
  zpl += '^FDPrecio Unit.\n';
  zpl += '^FS\n';

  // -------------------------
  // CÓDIGO DE BARRAS
  // -------------------------
  zpl += '^BY1,2,' + barcodeHeight + '\n';
  zpl += '^FO180,135\n';
  zpl += '^BCN,' + barcodeHeight + ',N,N,N\n';
  zpl += '^FD' + d.ean13 + '\n';
  zpl += '^FS\n';

  // EAN TEXTO
  zpl += '^FO170,170\n';
  zpl += '^A0N,18,18\n';
  zpl += '^FB200,1,0,C\n';
  zpl += '^FD' + d.ean13 + '\n';
  zpl += '^FS\n';

  // SKU + FECHA
  zpl += '^FO20,200\n';
  zpl += '^A0N,18,18\n';
  zpl += '^FDSKU:' + d.sku + '\n';
  zpl += '^FS\n';

  zpl += '^FO200,200\n';
  zpl += '^A0N,18,18\n';
  zpl += '^FDVALIDO HASTA: ' + d.validoHasta + '\n';
  zpl += '^FS\n';

  zpl += '^XZ\n';

  return zpl;
}

// ------------------------------------------------
// TCP Print
// ------------------------------------------------

function sendTcp(raw) {
  const host = process.env.ZEBRA_HOST || '192.168.1.50';
  const port = parseInt(process.env.ZEBRA_PORT || '9100', 10);

  return new Promise((resolve, reject) => {
    const client = new net.Socket();

    client.connect(port, host, () => {
      const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw,'utf8');
      client.write(buf, () => client.end());
    });

    client.on('error', reject);
    client.on('close', resolve);
  });
}

// ------------------------------------------------
// Windows RAW Print
// ------------------------------------------------

function sendWindowsRaw(raw) {

  const sharePath =
    process.env.ZEBRA_SHARE_PATH ||
    (PRINTER.name ? `\\\\localhost\\${PRINTER.name}` : null);

  if (!sharePath || !sharePath.startsWith('\\\\')) {
    throw new Error('No se pudo determinar impresora Zebra');
  }

  const tmp = path.join(os.tmpdir(),'label_' + Date.now() + '.zpl');

  fs.writeFileSync(tmp, Buffer.isBuffer(raw) ? raw : Buffer.from(raw,'utf8'));

  return new Promise((resolve, reject) => {
    execFile(
      'cmd.exe',
      ['/d','/c','copy','/y','/b',tmp,sharePath],
      { windowsHide:true },
      (err,stdout) => {
        fs.unlink(tmp,()=>{});
        if (err) reject(err);
        else resolve(stdout || 'OK');
      }
    );
  });
}

// ------------------------------------------------
// ENVÍO GENERAL
// ------------------------------------------------

async function sendEtiqueta(raw) {
  const mode = (process.env.PRINT_MODE || 'windows-raw').toLowerCase();

  if (mode === 'tcp') return sendTcp(raw);
  if (mode === 'windows-raw') return sendWindowsRaw(raw);

  throw new Error('Modo no soportado: ' + mode);
}

// ------------------------------------------------
// MÉTODOS PRINCIPALES
// ------------------------------------------------

// 🧾 Individual
async function printEtiquetaOferta(payload) {
  const zpl = buildZplEtiqueta(payload);
  return sendEtiqueta(zpl);
}

// 🔥 MASIVO (ZPL separado por modelo)
async function printEtiquetasBatch(productos) {

  let zpl = '';

  switch (PRINTER.type) {

    // ==========================
    // ✅ GC420T (tiene GAP real)
    // ==========================
    case 'GC420T':
      zpl += '^XA\n';
      zpl += '^MNN\n';    // Tear-Off
      zpl += '^MTT\n';    // ✅ Media Tracking (GAP) SOLO GC420T
      zpl += '^PW480\n';  // Ancho GC420T
      zpl += '^LL256\n';  // Alto GC420T
	  zpl += '^JUS\n';   // Reset media sensing
      zpl += '^XZ\n';
      break;

    // ==========================
    // ✅ ZD220T (NO TOCAR)
    // ==========================
    case 'ZD220T':
    default:
      zpl += '^XA\n';
      zpl += '^MNN\n';    // Tear-Off
      //zpl += '^PW480\n';  // Ancho ZD220T
      //zpl += '^LL256\n';  // Alto ZD220T
	  //zpl += '^JUS\n';   // Reset media sensing
      zpl += '^XZ\n';
      break;
  }

  // --------------------------
  // Etiquetas individuales
  // --------------------------
  for (const p of productos) {
    const qty = Math.max(1, parseInt(p.cantidad, 10) || 1);

    for (let i = 0; i < qty; i++) {
      zpl += buildZplEtiqueta({
        ...p,
        cantidad: 1   // 🔥 importante
      });
    }
  }

  return sendEtiqueta(zpl);
}

module.exports = {
  buildZplEtiqueta,
  printEtiquetaOferta,
  printEtiquetasBatch,
  sendEtiqueta,
  sendWindowsRaw,
  sendTcp
};