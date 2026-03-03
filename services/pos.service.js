// services/pos.service.js
const { toNumericSku } = require('../utils/sku'); 
const { DBFFile } = require("dbffile");
const path = require("path");

// ajusta si cambia la ruta
const rutaDBF = path.join("E:", "fasapos", "data", "posmapre.dbf");  //server_760
//const rutaDBF = path.join("E:", "fasapos9", "data", "posmapre.dbf");  //server_750
//const rutaDBF = path.join("P:", "data", "posmapre.dbf");   //laptop

// ===== POSDPOFE =====
const rutaDPOFE = path.join("E:","fasapos", "data", "posdpofe.dbf"); // <<--- AQUI LO AGREGAMOS

// === Mapeo POSMAPRE ===
function mapMAPRE(row) {
  if (!row) return null;
  return {
    nombre: row.MAPDESCC || row.MAPDESCL || "",
    descripcion: row.MAPDESCL || "",
    codigo: String(row.MAPCODIN || ""),
    codigoBarras: String(row.MAPBARRA || ""),
    precio: row.MAPPRENT || 0,
  };
}

// === Mapeo POSDPOFE ===
function mapDPOFE(row) {
  if (!row) return null;
  const skuNum = toNumericSku(row.DP_DATO);
  return {
    sku: skuNum, // 👈 "0000094397" -> "94397"
    descripcionPromo: row.DP_DESCRIP ?? "",
    precioNormal: Number(row.DP_VALORIG ?? 0),
    precioOferta: Number(row.DP_VALOFER ?? 0),
    precioUnitario: Number(row.DP_P_UNIT ?? 0),
    vigenciaInicio: row.DP_FINICIO ? row.DP_FINICIO.toISOString().slice(0, 10) : null,
    vigenciaFin: row.DP_FFIN ? row.DP_FFIN.toISOString().slice(0, 10) : null,
    descuentoPct: Number(row.DP_DSCTO ?? 0),
  };
}

// Leer solo POSMAPRE (tu código actual)
async function getFirstProducto() {
  const dbf = await DBFFile.open(rutaMAPRE);
  const rows = await dbf.readRecords(1);
  return mapMAPRE(rows[0]);
}

// Leer TODO POSDPOFE
async function getAllDPOFE() {
  const dbf = await DBFFile.open(rutaDPOFE);
  const rows = await dbf.readRecords();
  return rows.map(mapDPOFE).filter(x => x.sku); // solo filas válidas
}

module.exports = {
  getFirstProducto,
  getAllDPOFE
};