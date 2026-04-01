const axios = require("axios");

/**
 * URLs de WebServices
 */
const WS_ACCESOS_URL = process.env.WS_ACCESOS_URL;      // wsAccesos.asmx
const WS_PRIVILEGIOS_URL = process.env.WS_PRIVILEGIOS_URL; // wsPrivilegios.asmx

/**
 * Credenciales técnicas (constantes)
 * OJO: ideal mover esto a .env
 */
const WS_LOGIN = "FASA96809";
const WS_PWD = "530-7";

/**
 * Código de aplicación (constante)
 */
const COD_APLICACION = "101";

/* =====================================================
   Helpers XML
   ===================================================== */

function decodeHtmlEntities(text = "") {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function getXmlTagValue(xml, tag) {
  if (!xml) return null;
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/* =====================================================
   Paso 1: Login_Usuario (wsAccesos)
   ===================================================== */

async function loginUsuario(username, password) {
  const soapLogin = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Login_Usuario xmlns="http://www.fasa.cl/">
      <LOGINacceso>${WS_LOGIN}</LOGINacceso>
      <PWDacceso>${WS_PWD}</PWDacceso>
      <pLogin>${username}</pLogin>
      <pPWD>${password}</pPWD>
    </Login_Usuario>
  </soap:Body>
</soap:Envelope>`;

  let responseXml;

  try {
    const resp = await axios.post(
      WS_ACCESOS_URL,
      soapLogin,
      {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: "http://www.fasa.cl/Login_Usuario"
        }
      }
    );
    responseXml = resp.data;
	  console.log("responseXml",responseXml);
  } catch (err) {
    console.error("[ACCESOS] Error HTTP Login_Usuario");
    console.error(err.response?.data || err.message);
    throw new Error("Error técnico en Login_Usuario");
  }

  // XML externo → XML interno
  let innerXml = getXmlTagValue(responseXml, "Login_UsuarioResult");
  innerXml = decodeHtmlEntities(innerXml);

  const codigo = getXmlTagValue(innerXml, "Codigo");
  const mensaje = getXmlTagValue(innerXml, "Mensaje");
  const idLogin = getXmlTagValue(innerXml, "IdUsuario");

  if (codigo !== "0") {
    console.warn("[ACCESOS] Login_Usuario FALLÓ");
    console.warn(`[ACCESOS] Motivo: ${mensaje}`);
    throw new Error(mensaje || "Acceso no autorizado");
  }

  console.log("[ACCESOS] Login_Usuario OK");
  console.log(`[ACCESOS] pIdLogin generado: ${idLogin}`);

  return idLogin;
}

/* =====================================================
   Paso 2: Menu_XML (wsPrivilegios)
   ===================================================== */

async function obtenerMenu(pIdLogin) {
  const soapMenu = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Menu_XML xmlns="http://www.fasa.cl/">
      <pIdLogin>${pIdLogin}</pIdLogin>
      <pCodAplicacion>${COD_APLICACION}</pCodAplicacion>
    </Menu_XML>
  </soap:Body>
</soap:Envelope>`;

  const resp = await axios.post(
    WS_PRIVILEGIOS_URL,
    soapMenu,
    {
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://www.fasa.cl/Menu_XML"
      }
    }
  );

  const decodedMenu = decodeHtmlEntities(resp.data);

  if (!decodedMenu.includes("<Nodo")) {
    console.warn("[ACCESOS] Usuario SIN menú para la aplicación");
    throw new Error("Usuario sin acceso a la aplicación");
  }

  console.log("[ACCESOS] Menu_XML OK – acceso concedido");
  return decodedMenu;
}

/* =====================================================
   Login completo (usuario + aplicación)
   ===================================================== */

async function loginConAplicacion(username, password) {
  // 1️⃣ Login técnico + usuario
  const pIdLogin = await loginUsuario(username, password);

  // 2️⃣ Validar acceso a aplicación vía menú
  const menuXml = await obtenerMenu(pIdLogin);

  return {
    ok: true,
    mensaje: "Acceso concedido",
    pIdLogin,
    codAplicacion: COD_APLICACION,
    menuXml
  };
}

module.exports = {
  loginConAplicacion
};
``