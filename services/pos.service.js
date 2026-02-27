// services/pos.service.js
const { DBFFile } = require("dbffile");
const path = require("path");

// ajusta si cambia la ruta
const rutaDBF = path.join("E:", "fasapos", "data", "posmapre.dbf");  //server_760
//const rutaDBF = path.join("E:", "fasapos9", "data", "posmapre.dbf");  //server_750
//const rutaDBF = path.join("P:", "data", "posmapre.dbf");   //laptop


// --- MAPPER: convierte campos DBF → formato frontend ---
function mapDBF(row) {
  if (!row) return null;

  return {
    nombre: row.MAPDESCC || row.MAPDESCL || "",
    descripcion: row.MAPDESCL || "",
    codigo: row.MAPCODIN || "",
    codigoBarras: row.MAPBARRA || "",
    precio: row.MAPPRECIO || 0,
    // puedes agregar más si los necesitas
  };
}

// --- Servicio ---
async function getFirstProducto() {
  const dbf = await DBFFile.open(rutaDBF);
  const rows = await dbf.readRecords(1);
  const raw = rows[0] || null;
  return mapDBF(raw);        // 👈 aquí transformamos el producto
}

module.exports = { getFirstProducto };
