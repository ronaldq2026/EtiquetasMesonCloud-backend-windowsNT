// services/zebra.service.js
// Zebra ZD220t - 203dpi

const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

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

  const producto = data.producto || '';
  const sku = data.sku || '';
  const ean13 = data.ean13 || '';
  const um = data.unidadMedida || '';

  const precioNormal = toNumber(data.precioNormal);
  const precioOferta = toNumber(data.precioOferta);
  const precioUnitario = toNumber(data.precioUnitario);

  const cantidad = data.cantidad || 1;
  const pr = data.pr || 2;
  const md = data.md || 5;

  const barcodeHeight = 30;

  const validoHasta = formatDateCL(data.validoHasta || data.vigenciaFin);

  const precioPrincipal = fmtCLP(precioOferta ?? precioNormal);
  const precioNormalFmt = fmtCLP(precioNormal);
  const precioUnitarioFmt = fmtCLP(precioUnitario);

  let zpl = '';

  zpl += '^XA\n';
  zpl += '^CI28\n';

  // 🔧 POSICIONAMIENTO CORRECTO
  zpl += '^LH0,0\n';
  zpl += '^LT0\n';   // 🔥 CORREGIDO (antes -8)
  zpl += '^LS0\n';

  // 🔧 VELOCIDAD / OSCURIDAD
  zpl += '^PR' + pr + '\n';
  zpl += '^MD' + md + '\n';

  // 🔧 TAMAÑO
  zpl += '^PW480\n';
  zpl += '^LL240\n';

  // -------------------------
  // DESCRIPCIÓN
  // -------------------------
  zpl += '^FO20,0\n';
  zpl += '^A0N,24,24\n';
  zpl += '^FB440,2,0,C\n';
  zpl += '^FD' + producto + '\n';
  zpl += '^FS\n';

  // -------------------------
  // PRECIO NORMAL
  // -------------------------
  if (precioNormal && precioNormal > 0) {
    zpl += '^FO20,55\n';
    zpl += '^A0N,18,18\n';
    zpl += '^FB440,1,0,C\n';
    zpl += '^FDPRECIO NORMAL: ' + precioNormalFmt + '\n';
    zpl += '^FS\n';
  }

  // -------------------------
  // PRECIO PRINCIPAL
  // -------------------------
  zpl += '^FO20,75\n';
  zpl += '^A0N,55,55\n';
  zpl += '^FB440,1,0,C\n';
  zpl += '^FD' + precioPrincipal + '\n';
  zpl += '^FS\n';

  // -------------------------
  // PRECIO UNITARIO
  // -------------------------
  zpl += '^FO5,120\n';
  zpl += '^A0N,24,24\n';
  zpl += '^FD' + precioUnitarioFmt + (um ? ' / ' + um : '') + '\n';
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
  zpl += '^FD' + ean13 + '\n';
  zpl += '^FS\n';

  // EAN TEXTO
  zpl += '^FO170,170\n';
  zpl += '^A0N,18,18\n';
  zpl += '^FB200,1,0,C\n';
  zpl += '^FD' + ean13 + '\n';
  zpl += '^FS\n';

  // SKU + FECHA
  zpl += '^FO20,200\n';
  zpl += '^A0N,18,18\n';
  zpl += '^FDSKU:' + sku + '\n';
  zpl += '^FS\n';

  zpl += '^FO200,200\n';
  zpl += '^A0N,18,18\n';
  zpl += '^FDVALIDO HASTA: ' + validoHasta + '\n';
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

  const sharePath = process.env.ZEBRA_SHARE_PATH;

  if (!sharePath || !sharePath.startsWith('\\\\')) {
    throw new Error('sharePath inválido: ' + sharePath);
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

// 🔥 MASIVO (LA SOLUCIÓN)
async function printEtiquetasBatch(productos) {

  let zpl = '';

  // ✅ CALIBRACIÓN REAL (UNA VEZ)
  zpl += '^XA';
  zpl += '^MNN';     // Modo Tear-Off
  zpl += '^PW480';
  zpl += '^LL240';   // AJUSTAR SI ES NECESARIO
  zpl += '^XZ\n';

  for (const p of productos) {
    const qty = Math.max(1, parseInt(p.cantidad, 10) || 1);

    for (let i = 0; i < qty; i++) {
      zpl += buildZplEtiqueta({
        ...p,
        cantidad: 1 // 🔥 IMPORTANTE
      });
    }
  }

  return sendEtiqueta(zpl);
}

// ------------------------------------------------

module.exports = {
  buildZplEtiqueta,
  printEtiquetaOferta,
  printEtiquetasBatch,
  sendEtiqueta,
  sendWindowsRaw,
  sendTcp
};