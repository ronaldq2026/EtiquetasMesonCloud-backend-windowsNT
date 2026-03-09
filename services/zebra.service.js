// services/zebra.service.js — ZPL para ZD220t (203 dpi)
const net = require('net');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const printerConfig = require('../config/printer'); // usa mode/sharePath/host/port

// --- helpers ---
function toNumber(val) {
  if (val == null) return null;
  const s = String(val).replace(/[^\d,.\-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function fmtCLP(val) {
  if (val == null) return '';
  const n = typeof val === 'number' ? val : toNumber(val);
  if (n == null) return String(val);
  return `$${n.toLocaleString('es-CL')}`;
}

/**
 * Builder ZPL 50x38 mm (203 dpi)
 * Requiere: precioAntes, precioAhora, producto, subtitulo, sku, codigoBarras, cantidad
 * Opcionales: precioNormal, precioOferta, descuentoPct, showResumenOferta (boolean)
 * Knobs: pr (velocidad), md (oscuridad), barcodeHeight
 */
function buildZplEtiqueta({
  precioAntes,
  precioAhora,
  producto,
  subtitulo,
  sku,
  codigoBarras,
  cantidad,

  // opcionales (resumen oferta)
  precioNormal,
  precioOferta,
  descuentoPct,
  showResumenOferta = false,

  // knobs
  pr = 2,
  md = 5,
  barcodeHeight = 70,
}) {
  const nAntes = toNumber(precioAntes);
  const nAhora = toNumber(precioAhora);
  let pct = descuentoPct != null ? Number(descuentoPct) : null;
  if (pct == null && nAntes && nAhora && nAntes > 0) {
    pct = Math.round((1 - nAhora / nAntes) * 100);
  }

  const resumenLines = [];
  if (showResumenOferta) {
    const pn = precioNormal != null ? precioNormal : precioAntes;
    const po = precioOferta != null ? precioOferta : precioAhora;
    resumenLines.push(`Precio normal: ${fmtCLP(pn)}`);
    resumenLines.push(`Precio oferta: ${fmtCLP(po)}`);
    if (pct != null && Number.isFinite(pct)) resumenLines.push(`Descuento: ${pct}%`);
  }
  const yResumenBase = 245; // debajo del barcode, dentro de 300 dots de alto

  const zpl = `
^XA
^CI28
^PR${pr}
^MD${md}

^PW400
^LL300

^FO10,10^A0N,22,22^FDANTES:^FS
^FO10,40^A0N,22,22^FDAHORA:^FS

^FO120,10^A0N,28,28^FD${precioAntes}^FS
^FO120,40^A0N,40,40^FD${precioAhora}^FS

^FO115,24^GB120,0,2^FS

^FO10,85^A0N,26,26^FD${producto}^FS
^FO10,115^A0N,26,26^FD${subtitulo}^FS

^FO10,145^A0N,22,22^FDSKU: ${sku}^FS

^BY2,3,${barcodeHeight}
^FO10,170^BCN,${barcodeHeight},Y,N,N
^FD${codigoBarras}^FS
${showResumenOferta && resumenLines[0] ? `^FO10,${yResumenBase}^A0N,18,18^FD${resumenLines[0]}^FS` : ''}
${showResumenOferta && resumenLines[1] ? `^FO10,${yResumenBase+20}^A0N,18,18^FD${resumenLines[1]}^FS` : ''}
${showResumenOferta && resumenLines[2] ? `^FO10,${yResumenBase+40}^A0N,18,18^FD${resumenLines[2]}^FS` : ''}

^PQ${Math.max(1, parseInt(cantidad, 10) || 1)}
^XZ
  `.trim() + '\n';

  return zpl;
}

// --- envío raw por TCP (9100)
function sendTcp(raw) {
  const zebraHost = process.env.ZEBRA_HOST || '192.168.1.50';
  const zebraPort = parseInt(process.env.ZEBRA_PORT || '9100', 10);
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.connect(zebraPort, zebraHost, () => {
      const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'utf8');
      client.write(buf, () => client.end());
    });
    client.on('error', reject);
    client.on('close', resolve);
  });
}

// --- envío RAW a cola Windows (\\host\cola)
function sendWindowsRaw(raw) {
  const sharePath = process.env.ZEBRA_SHARE_PATH; // p.ej. \\localhost\flejes
  if (!sharePath || !sharePath.startsWith('\\\\')) {
    throw new Error(`sharePath inválido para impresión RAW: "${sharePath}"`);
  }
  const tmp = path.join(os.tmpdir(), `label_${Date.now()}.zpl`);
  fs.writeFileSync(tmp, Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'utf8'));

  const execCopy = (target) =>
    new Promise((resolve, reject) => {
      execFile('cmd.exe', ['/d', '/c', 'copy', '/y', '/b', tmp, target], { windowsHide: true },
        (err, stdout, stderr) => err ? reject(Object.assign(err, { stdout, stderr })) : resolve(stdout || 'OK'));
    });

  const execPrint = (target) =>
    new Promise((resolve, reject) => {
      execFile('cmd.exe', ['/d', '/c', 'print', `/D:${target}`, tmp], { windowsHide: true },
        (err, stdout, stderr) => err ? reject(Object.assign(err, { stdout, stderr })) : resolve(stdout || 'OK'));
    });

  const dst = sharePath.trim();
  const dstIp = /^\\\\localhost\\/i.test(dst) ? dst.replace(/^\\\\localhost\\/i, '\\\\127.0.0.1\\') : null;

  return (async () => {
    try { return `copy: ${await execCopy(dst)}`; }
    catch {
      try { if (dstIp) return `copy(ip): ${await execCopy(dstIp)}`; } catch {}
      return `print: ${await execPrint(dst)}`;
    }
  })().finally(() => fs.unlink(tmp, () => {}));
}

async function sendEtiqueta(raw) {
  const mode = (process.env.PRINT_MODE || 'windows-raw').toLowerCase();
  if (mode === 'tcp') return sendTcp(raw);
  if (mode === 'windows-raw') return sendWindowsRaw(raw);
  if (mode === 'mock-zpl' || mode === 'mock-epl') {
    const outDir = path.join(__dirname, '..', 'mock-prints');
    fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, `mock_${Date.now()}.zpl`);
    fs.writeFileSync(filePath, raw, 'utf8');
    return { filePath };
  }
  throw new Error(`Modo de impresión no soportado: ${mode}`);
}

/** Entrada principal desde rutas */
async function printEtiquetaOferta(payload) {
  const zpl = buildZplEtiqueta(payload);
  return sendEtiqueta(zpl);
}

module.exports = {
  buildZplEtiqueta,
  printEtiquetaOferta,
  sendEtiqueta,
  sendWindowsRaw,
  sendTcp,
};
