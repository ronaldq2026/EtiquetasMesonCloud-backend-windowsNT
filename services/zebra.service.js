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

  // Si ya es número, devolver directo
  if (typeof val === 'number') return val;

  let s = String(val).trim();

  // Caso 1: formato chileno "1.234,56"
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  // Caso 2: formato con coma decimal "1149,5"
  else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  // Caso 3: formato normal "1149.5" → NO tocar

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function formatDateCL(dateStr) {
  if (!dateStr) return '';

  if (typeof dateStr === 'string' && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2,'0');
      const month = parts[1].padStart(2,'0');
      const year = parts[2];
      return day + '/' + month + '/' + year;
    }
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2,'0');
  const month = String(d.getMonth()+1).padStart(2,'0');
  const year = d.getFullYear();

  return day + '/' + month + '/' + year;
}

function fmtCLP(val) {
  if (val === null || val === undefined) return '$0';

  const n = typeof val === 'number' ? val : toNumber(val);
  if (n === null) return '$0';

  return '$' + Math.round(n).toLocaleString('es-CL');
}

// ------------------------------------------------
// ZPL Builder
// ------------------------------------------------

function buildZplEtiqueta(data) {

  console.log('🧪 DATA RECIBIDA EN ZEBRA:\n', JSON.stringify(data, null, 2));

  const producto = data.producto;
  const sku = data.sku;
  const ean13 = data.ean13;
  
  const precioNormal = toNumber(data.precioNormal);
  const precioOferta = toNumber(data.precioOferta);
  const precioUnitario = toNumber(data.precioUnitario);

  console.log('💰 PRECIOS RAW:', {
    precioNormal,
    precioOferta,
    precioUnitario
  });

  const cantidad = data.cantidad || 1;
  const pr = data.pr || 2;
  const md = data.md || 5;

  const barcodeHeight = 45;

  let validoHasta = formatDateCL(data.validoHasta || data.vigenciaFin);

  const precioPrincipal = fmtCLP(precioOferta ?? precioNormal);
  const precioNormalFmt = fmtCLP(precioNormal);
  const precioUnitarioFmt = fmtCLP(precioUnitario);

  console.log('💵 PRECIOS FORMATEADOS:', {
    precioPrincipal,
    precioNormalFmt,
    precioUnitarioFmt
  });

  const barcode = ean13 || '';

  let zpl = '';

  zpl += '^XA\n';
  zpl += '^CI28\n';
  zpl += '^LH0,0\n';
  zpl += '^PR' + pr + '\n';
  zpl += '^MD' + md + '\n';

  zpl += '^PW400\n';
  zpl += '^LL280\n';

  // -------------------------
  // DESCRIPCIÓN
  // -------------------------
  zpl += '^FO20,0\n';
  zpl += '^A0N,24,24\n';
  zpl += '^FB360,2,0,C\n';
  zpl += '^FD' + (producto || '') + '\n';
  zpl += '^FS\n';

  // -------------------------
  // PRECIO NORMAL (solo si existe)
  // -------------------------
  if (precioNormal && precioNormal > 0) {
    zpl += '^FO20,55\n';
    zpl += '^A0N,18,18\n';
    zpl += '^FB360,1,0,C\n';
    zpl += '^FDPRECIO NORMAL: ' + precioNormalFmt + '\n';
    zpl += '^FS\n';
  }

  // -------------------------
  // PRECIO GRANDE
  // -------------------------
  zpl += '^FO20,75\n';
  zpl += '^A0N,55,55\n';
  zpl += '^FB360,1,0,C\n';
  zpl += '^FD' + precioPrincipal + '\n';
  zpl += '^FS\n';

  // -------------------------
  // PRECIO UNITARIO
  // -------------------------
  zpl += '^FO5,135\n';
  zpl += '^A0N,18,18\n';
  zpl += '^FD' + precioUnitarioFmt + '\n';
  zpl += '^FS\n';

  zpl += '^FO5,155\n';
  zpl += '^A0N,18,18\n';
  zpl += '^FDPrecio Unit.\n';
  zpl += '^FS\n';

  // -------------------------
  // CÓDIGO DE BARRAS
  // -------------------------
  zpl += '^BY2,2,' + barcodeHeight + '\n';
  zpl += '^FO90,140\n';
  zpl += '^BCN,' + barcodeHeight + ',N,N,N\n';
  zpl += '^FD' + barcode + '\n';
  zpl += '^FS\n';

  // -------------------------
  // EAN
  // -------------------------
  zpl += '^FO120,190\n';
  zpl += '^A0N,20,20\n';
  zpl += '^FD' + barcode + '\n';
  zpl += '^FS\n';

  // -------------------------
  // SKU + FECHA
  // -------------------------
  zpl += '^FO20,215\n';
  zpl += '^A0N,18,18\n';
  zpl += '^FDSKU:' + (sku || '') + '\n';
  zpl += '^FS\n';

  zpl += '^FO160,215\n';
  zpl += '^A0N,18,18\n';
  zpl += '^FDVALIDO HASTA: ' + (validoHasta || '') + '\n';
  zpl += '^FS\n';

  zpl += '^PQ' + Math.max(1, parseInt(cantidad,10) || 1) + '\n';
  zpl += '^XZ\n';


  return zpl;
}

// ------------------------------------------------
// TCP Print
// ------------------------------------------------

function sendTcp(raw) {
  const host = process.env.ZEBRA_HOST || '192.168.1.50';
  const port = parseInt(process.env.ZEBRA_PORT || '9100', 10);

  return new Promise(function(resolve,reject){
    const client = new net.Socket();

    client.connect(port, host, function(){
      const buf = Buffer.isBuffer(raw)
        ? raw
        : Buffer.from(raw,'utf8');

      client.write(buf,function(){ client.end(); });
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

  fs.writeFileSync(
    tmp,
    Buffer.isBuffer(raw) ? raw : Buffer.from(raw,'utf8')
  );

  const execCopy = function(target){
    return new Promise(function(resolve,reject){
      execFile(
        'cmd.exe',
        ['/d','/c','copy','/y','/b',tmp,target],
        { windowsHide:true },
        function(err,stdout){
          if (err) reject(err);
          else resolve(stdout || 'OK');
        }
      );
    });
  };

  return execCopy(sharePath)
    .finally(function(){
      fs.unlink(tmp,function(){});
    });
}

// ------------------------------------------------
// Envío general
// ------------------------------------------------

async function sendEtiqueta(raw) {

  const mode = (process.env.PRINT_MODE || 'windows-raw').toLowerCase();

  if (mode === 'tcp') return sendTcp(raw);
  if (mode === 'windows-raw') return sendWindowsRaw(raw);

  if (mode === 'mock') {

    const outDir = path.join(__dirname,'..','mock-prints');
    fs.mkdirSync(outDir,{recursive:true});

    const filePath = path.join(outDir,'mock_' + Date.now() + '.zpl');

    fs.writeFileSync(filePath,raw,'utf8');

    return {filePath};
  }

  throw new Error('Modo de impresión no soportado: ' + mode);
}

// ------------------------------------------------
// Método principal
// ------------------------------------------------

async function printEtiquetaOferta(payload) {
  const zpl = buildZplEtiqueta(payload);
  return sendEtiqueta(zpl);
}

// ------------------------------------------------

module.exports = {
  buildZplEtiqueta,
  printEtiquetaOferta,
  sendEtiqueta,
  sendWindowsRaw,
  sendTcp
};