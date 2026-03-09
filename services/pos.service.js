// services/pos.service.js
const { DBFFile } = require("dbffile");
const path = require("path");
const { toNumericSku } = require("../utils/sku");

// =============================
// Rutas DBF
// =============================
const rutaMAPRE = path.join("E:", "fasapos", "data", "posmapre.dbf");
const rutaDPOFE = path.join("E:", "fasapos", "data", "posdpofe.dbf");
// const rutaMAPRE = path.join("P:", "data", "posmapre.dbf");
// const rutaDPOFE = path.join("P:", "data", "posdpofe.dbf");

// =============================
// Helpers
// =============================
function cleanStr(s) {
  return (s ?? "").toString().trim();
}
function cleanNum(n) {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v : 0;
}
function normalizeSku(value) {
  if (value == null) return null;
  // normalizamos quitando ceros a la izquierda y espacios
  return cleanStr(value).replace(/^0+/, "");
}

// =============================
// Mapear POSMAPRE (maestra)
// =============================
function mapMAPRE(row) {
  if (!row) return null;
  const sku = normalizeSku(row.MAPCODIN);
  if (!sku) return null;

  return {
    sku,
    // En tu versión original venían nombres parecidos:
    // MAPDESCL (descripción), MAPBARRA (EAN), MAPCONCENT (contenido/talla), MAPLAB (laboratorio/marca), MAPPRENT (precio lista)
    descripcion: cleanStr(row.MAPDESCL),
    marca: cleanStr(row.MAPLAB),
    contenido: cleanStr(row.MAPCONCENT),
    ean13: cleanStr(row.MAPBARRA),
    precioNormal: cleanNum(row.MAPPRENT),
    // Por ahora no hay vencimiento/imagen en MAPRE
  };
}

// =============================
// Mapear POSDPOFE (ofertas)
// =============================
function mapDPOFE(row) {
  if (!row) return null;
  const sku = normalizeSku(toNumericSku(row.DP_DATO));
  if (!sku) return null;

  return {
    sku,
    precioNormal: cleanNum(row.DP_VALORIG),
    precioOferta: cleanNum(row.DP_VALOFER),
  };
}

// =============================
// Leer POSMAPRE
// =============================
async function getAllMAPRE() {
  // encoding CP1252 para que no salgan caracteres raros (DBF clásico)
  const dbf = await DBFFile.open(rutaMAPRE, { encoding: "cp1252" });
  const rows = await dbf.readRecords();
  return rows.map(mapMAPRE).filter(p => p?.sku);
}

// =============================
// Leer POSDPOFE
// =============================
async function getAllDPOFE() {
  const dbf = await DBFFile.open(rutaDPOFE, { encoding: "cp1252" });
  const rows = await dbf.readRecords();
  return rows.map(mapDPOFE).filter(o => o?.sku);
}

// =============================
// Obtener 1 producto por SKU (contrato para la etiqueta)
// =============================
async function getProductoPorSku(skuRaw) {
  const sku = normalizeSku(skuRaw);
  if (!sku) {
    return { ok: false, foundInExcel: false, foundInDPOFE: false, producto: null };
  }

  // Leemos ambas tablas en paralelo
  const [productos, ofertas] = await Promise.all([getAllMAPRE(), getAllDPOFE()]);

  // Indexamos por sku ya normalizado
  const mapProductos = new Map(productos.map(p => [p.sku, p]));
  const mapOfertas   = new Map(ofertas.map(o => [o.sku, o]));

  const base = mapProductos.get(sku) || null;
  const ofe  = mapOfertas.get(sku) || null;

  const foundInExcel = !!base;
  const foundInDPOFE = !!ofe;

  if (!base && !ofe) {
    return { ok: true, foundInExcel, foundInDPOFE, producto: null };
  }

  // Reglas:
  // - Texto/identificación desde MAPRE (si existe).
  // - Precios: prioriza oferta si viene y es > 0; si no, usa normal (desde DPOFE o MAPRE).
  const descripcion   = base?.descripcion ?? "";
  const marca         = base?.marca ?? "";
  const contenido     = base?.contenido ?? "";
  const ean13         = base?.ean13 ?? "";
  const precioNormal  = cleanNum(ofe?.precioNormal ?? base?.precioNormal);
  const precioOferta  = (ofe && ofe.precioOferta != null) ? cleanNum(ofe.precioOferta) : null;
  const precioVigente = (precioOferta && precioOferta > 0) ? precioOferta : precioNormal;

  const producto = {
    sku,
    descripcion,
    marca,
    contenido,
    ean13,
    imagenUrl: null, // si después agregas imágenes, setéalo aquí
    precioNormal,
    precioOferta,
    precioVigente,
  };

  return { ok: true, foundInExcel, foundInDPOFE, producto };
}

// =============================
// Obtener varios productos por lista de SKUs (para lotes)
// =============================
async function getProductosPorSku(listaSku = []) {
  const [productos, ofertas] = await Promise.all([getAllMAPRE(), getAllDPOFE()]);

  const mapProductos = new Map(productos.map(p => [p.sku, p]));
  const mapOfertas   = new Map(ofertas.map(o => [o.sku, o]));

  return listaSku
    .map(normalizeSku)
    .filter(Boolean)
    .map(sku => {
      const base = mapProductos.get(sku) || null;
      const ofe  = mapOfertas.get(sku) || null;
      if (!base && !ofe) return null;

      const descripcion   = base?.descripcion ?? "";
      const marca         = base?.marca ?? "";
      const contenido     = base?.contenido ?? "";
      const ean13         = base?.ean13 ?? "";
      const precioNormal  = cleanNum(ofe?.precioNormal ?? base?.precioNormal);
      const precioOferta  = (ofe && ofe.precioOferta != null) ? cleanNum(ofe.precioOferta) : null;
      const precioVigente = (precioOferta && precioOferta > 0) ? precioOferta : precioNormal;

      return {
        sku,
        descripcion,
        marca,
        contenido,
        ean13,
        precioNormal,
        precioOferta,
        precioVigente,
        foundInExcel: !!base,
        foundInDPOFE: !!ofe,
      };
    })
    .filter(Boolean);
}

// =============================
// Exports
// =============================
module.exports = {
  getAllMAPRE,
  getAllDPOFE,
  getProductoPorSku,   // <- ahora existe antes de exportar
  getProductosPorSku,
};
