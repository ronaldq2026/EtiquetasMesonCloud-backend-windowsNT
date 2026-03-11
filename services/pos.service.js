const { DBFFile } = require("dbffile");
const path = require("path");

// =============================
// Rutas DBF
// =============================
const rutaMAPRE = path.join("E:", "fasapos", "data", "posmapre.dbf");
const rutaDPOFE = path.join("E:", "fasapos", "data", "posdpofe.dbf");

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

// NORMALIZACIÓN ÚNICA DE SKU
function normalizeSku(value) {
  if (value == null) return null;

  let s = String(value).trim();

  // eliminar todo lo que no sea número
  s = s.replace(/\D+/g, "");

  // quitar ceros a la izquierda
  s = s.replace(/^0+/, "");

  return s || null;
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
    descripcion: cleanStr(row.MAPDESCL),
    marca: cleanStr(row.MAPLAB),
    contenido: cleanStr(row.MAPCONCENT),
    ean13: cleanStr(row.MAPBARRA),
    precioUnitario: cleanNum(row.MAPPREVT),
  };
}

// =============================
// Mapear POSDPOFE (ofertas)
// =============================
function mapDPOFE(row) {
  if (!row) return null;

  const sku = normalizeSku(row.DP_DATO);
  if (!sku) return null;

  return {
    sku,
    precioOferta: cleanNum(row.DP_VALOFER),
    vigenciaInicio: cleanStr(row.DP_FINICIO),
    vigenciaFin: cleanStr(row.DP_FFIN),
  };
}

// =============================
// Leer POSMAPRE
// =============================
async function getAllMAPRE() {
  const dbf = await DBFFile.open(rutaMAPRE, { encoding: "cp1252" });
  const rows = await dbf.readRecords();

  return rows
    .map(mapMAPRE)
    .filter(p => p?.sku);
}

// =============================
// Leer POSDPOFE
// =============================
async function getAllDPOFE() {
  const dbf = await DBFFile.open(rutaDPOFE, { encoding: "cp1252" });
  const rows = await dbf.readRecords();

  return rows
    .map(mapDPOFE)
    .filter(o => o?.sku);
}

// =============================
// Obtener 1 producto por SKU
// =============================
async function getProductoPorSku(skuRaw) {

  const sku = normalizeSku(skuRaw);
  console.log('[POS-SERVICE] getProductoPorSku - SKU normalizado:', sku);

  if (!sku) {
    console.log('[POS-SERVICE] SKU inválido');
    return {
      ok: false,
      foundInExcel: false,
      foundInDPOFE: false,
      producto: null
    };
  }

  const [productos, ofertas] = await Promise.all([
    getAllMAPRE(),
    getAllDPOFE()
  ]);

  console.log('[POS-SERVICE] Cargados MAPRE:', productos.length, 'registros');
  console.log('[POS-SERVICE] Cargadas DPOFE:', ofertas.length, 'registros');

  const mapProductos = new Map(productos.map(p => [p.sku, p]));
  const mapOfertas = new Map(ofertas.map(o => [o.sku, o]));

  const base = mapProductos.get(sku) || null;
  const ofe = mapOfertas.get(sku) || null;

  console.log('[POS-SERVICE] Encontrado en MAPRE:', !!base);
  console.log('[POS-SERVICE] Encontrado en DPOFE:', !!ofe);
  if (base) console.log('[POS-SERVICE] Producto MAPRE:', base);
  if (ofe) console.log('[POS-SERVICE] Oferta DPOFE:', ofe);

  const foundInExcel = !!base;
  const foundInDPOFE = !!ofe;

  if (!base && !ofe) {
    console.log('[POS-SERVICE] No encontrado en ninguna fuente');
    return { ok: true, foundInExcel, foundInDPOFE, producto: null };
  }

  const producto = {
    sku,
    descripcion: base?.descripcion ?? "",
    marca: base?.marca ?? "",
    contenido: base?.contenido ?? "",
    ean13: base?.ean13 ?? "",
    imagenUrl: null,

    precioUnitario: cleanNum(base?.precioUnitario),
    precioOferta: ofe ? cleanNum(ofe.precioOferta) : null,

    vigenciaInicio: ofe?.vigenciaInicio ?? null,
    vigenciaFin: ofe?.vigenciaFin ?? null,
  };

  console.log('[POS-SERVICE] Producto final:', producto);

  return {
    ok: true,
    foundInExcel,
    foundInDPOFE,
    producto
  };
}

// =============================
// Obtener varios productos
// =============================
async function getProductosPorSku(listaSku = []) {

  const [productos, ofertas] = await Promise.all([
    getAllMAPRE(),
    getAllDPOFE()
  ]);

  const mapProductos = new Map(productos.map(p => [p.sku, p]));
  const mapOfertas = new Map(ofertas.map(o => [o.sku, o]));

  return listaSku
    .map(normalizeSku)
    .filter(Boolean)
    .map(sku => {

      const base = mapProductos.get(sku);
      const ofe = mapOfertas.get(sku);

      if (!base && !ofe) return null;

      return {
        sku,
        descripcion: base?.descripcion ?? "",
        marca: base?.marca ?? "",
        contenido: base?.contenido ?? "",
        ean13: base?.ean13 ?? "",

        precioUnitario: cleanNum(base?.precioUnitario),
        precioOferta: ofe ? cleanNum(ofe.precioOferta) : null,

        vigenciaInicio: ofe?.vigenciaInicio ?? null,
        vigenciaFin: ofe?.vigenciaFin ?? null,

        foundInExcel: !!base,
        foundInDPOFE: !!ofe
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
  getProductoPorSku,
  getProductosPorSku,
};
