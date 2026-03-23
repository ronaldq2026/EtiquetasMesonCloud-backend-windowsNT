// services/meson-excel.service.js
const { toNumericSku } = require('../utils/sku'); 
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const STATE_FILE = path.join(__dirname, '../data/meson-allowlist.json');
const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'meson-excel-uploads.log');

// ===== Estado en memoria =====
let allowSet = new Set();      // TODOS los SKUs del Excel cargado
let excelItems = [];           // [{ sku, descripcion }]
let lastUpdated = null;
let lastSource = null;

// ===== Utilidades de persistencia =====
function ensureDirs() {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function saveState() {
  ensureDirs();
  const payload = {
    skus: Array.from(allowSet),
    items: excelItems,
    lastUpdated,
    source: lastSource,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), 'utf8');
}

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const { skus, items, lastUpdated: ts, source } = JSON.parse(raw);
    allowSet = new Set(skus || []);
    excelItems = Array.isArray(items) ? items : [];
    lastUpdated = ts || null;
    lastSource = source || null;
  } catch {
    allowSet = new Set();
    excelItems = [];
    lastUpdated = null;
    lastSource = null;
  }
}
loadState();

// ===== Detección de columnas =====
function detectHeader(headers, preferList = [], fallbackContains = '') {
  // exact match
  for (const key of headers) {
    if (preferList.some(p => p.toLowerCase() === String(key).toLowerCase().trim())) return key;
  }
  // contains
  if (fallbackContains) {
    const found = headers.find(h => String(h).toLowerCase().includes(fallbackContains.toLowerCase()));
    if (found) return found;
  }
  // fallback
  return headers[0] || null;
}

// ===== Parse del Excel =====
function extractFromWorkbook(workbook) {
  const sheetName = workbook.SheetNames[0] || null; // p.ej. "PAI"
  if (!sheetName) {
    return { items: [], sheetName: null, skuCol: null, descCol: null, excelRows: 0 };
  }
  const ws = workbook.Sheets[sheetName];
  if (!ws) {
    return { items: [], sheetName, skuCol: null, descCol: null, excelRows: 0 };
  }

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  if (!Array.isArray(rows) || rows.length === 0) {
    return { items: [], sheetName, skuCol: null, descCol: null, excelRows: 0 };
  }

  const headers = Object.keys(rows[0]);
  if (headers.length === 0) {
    return { items: [], sheetName, skuCol: null, descCol: null, excelRows: rows.length };
  }

  // Tu archivo trae “SKU” y “DESCRIPCION”; si cambian, cae al 'contains'
  const skuCol  = detectHeader(headers, ['SKU'], 'sku');
  const descCol = detectHeader(headers, ['DESCRIPCION', 'Descripción'], 'desc');

	const items = rows
	  .map(r => {
		const rawSku = r[skuCol];
		const sku = toNumericSku(rawSku);         // 👈 SKU numérico sin ceros
		if (!sku) return null;
		const rawDesc = descCol ? r[descCol] : '';
		const descripcion = rawDesc == null ? '' : String(rawDesc).trim();
		return { sku, descripcion };              // 👈 Guardamos el SKU como "94397"
	  })
	  .filter(Boolean);

  return { items, sheetName, skuCol, descCol, excelRows: rows.length };
}

function writeUploadLog({ user, fileName, excelRows, sheet, skuCol, descCol }) {
  ensureDirs();
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    user,
    fileName,
    sheet,
    skuCol,
    descCol,
    excelRows,
  });
  fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
}

// ===== API del servicio =====
async function parseAndBuildAllowlist(fileBuffer, originalName, uploadedBy = 'unknown') {
  const wb = XLSX.read(fileBuffer, { type: 'buffer' });
  const { items, sheetName, skuCol, descCol, excelRows } = extractFromWorkbook(wb);

  // Guardamos TODO lo del Excel (búsqueda solo sobre Excel)
	excelItems = items;
	allowSet = new Set(items.map(i => i.sku));    // Set de strings numéricas ("94397", ...)
  lastUpdated = new Date().toISOString();
  lastSource = {
    fileName: originalName,
    sheet: sheetName,
    skuCol,
    descCol,
    excelRows,
  };
  saveState();

  writeUploadLog({
    user: uploadedBy,
    fileName: originalName,
    excelRows,
    sheet: sheetName,
    skuCol,
    descCol,
  });

  return getSummary();
}

function isAllowed(sku) {
  if (!sku) return false;
  return allowSet.has(String(sku).trim());
}

// búsqueda solo Excel
function searchExcelItems(term) {
  const t = String(term || '').trim().toLowerCase();
  if (!t || !excelItems || excelItems.length === 0) return [];

  const tDigits = t.replace(/\D+/g, '').replace(/^0+/, ''); // "0000094397" -> "94397"
  return excelItems.filter((it) => {
    const byDesc = String(it.descripcion || '').toLowerCase().includes(t);
    const bySku  = tDigits ? it.sku.includes(tDigits) : it.sku.includes(t); // permite teclear con o sin ceros
    return byDesc || bySku;
  });
}

// obtener por sku (normaliza por si viene padded)
function getExcelItemBySku(sku) {
  const s = toNumericSku(sku);
  if (!s || !excelItems || excelItems.length === 0) return null;
  return excelItems.find(it => it.sku === s) || null;
}

function getAllExcelItems() {
  return excelItems || [];
}

function getSummary() {
  return {
    count: allowSet.size,
    lastUpdated,
    sample: Array.from(allowSet).slice(0, 5),
    source: lastSource,
  };
}

module.exports = {
  parseAndBuildAllowlist,
  isAllowed,
  getSummary,
  searchExcelItems,     // 👈 IMPORTANTE
  getExcelItemBySku,    // 👈 IMPORTANTE
  getAllExcelItems,
};