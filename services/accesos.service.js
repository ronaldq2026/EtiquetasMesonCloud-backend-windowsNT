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

  if (codigo === "5" || codigo === "6") {
    console.warn(`[ACCESOS] Login_Usuario Código ${codigo} – ${mensaje}`);
    return { idLogin, passwordChangeRequired: true, codigo, mensaje };
  }

  if (codigo !== "0") {
    console.warn("[ACCESOS] Login_Usuario FALLÓ");
    console.warn(`[ACCESOS] Motivo: ${mensaje}`);
    throw new Error(mensaje || "Acceso no autorizado");
  }

  console.log("[ACCESOS] Login_Usuario OK");
  console.log(`[ACCESOS] pIdLogin generado: ${idLogin}`);

  return { idLogin, passwordChangeRequired: false };
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
   Helpers: detección de rol
   ===================================================== */

function getUserRole(menuXml) {
  if (!menuXml) return "Desconocido";

  if (/tit\s*=\s*["']Admin["']/i.test(menuXml)) {
    return "Admin";
  }

  if (/tit\s*=\s*["']Farmacia["']/i.test(menuXml)) {
    return "Farmacia";
  }

  return "Desconocido";
}


/* =====================================================
   Paso 3: CambioPWD_Usuario (wsAccesos)
   ===================================================== */

async function cambioPassword(pIdLogin, passwordActual, passwordNueva) {
  const maskValue = (value = "") => {
    const text = String(value ?? "");
    return text.length <= 2 ? "*".repeat(text.length) : `${text[0]}***${text[text.length - 1]}`;
  };
  console.log(`[ACCESOS] cambioPassword pIdLogin recibido: ${pIdLogin}`);
  console.log(`[ACCESOS] cambioPassword password actual length: ${String(passwordActual ?? "").length}`);
  console.log(`[ACCESOS] cambioPassword password nueva length: ${String(passwordNueva ?? "").length}`);
  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CambioPWD_Usuario xmlns="http://www.fasa.cl/">
      <LOGINacceso>${WS_LOGIN}</LOGINacceso>
      <PWDacceso>${WS_PWD}</PWDacceso>
      <pIdLogin>${pIdLogin}</pIdLogin>
      <pPWDactual>${passwordActual}</pPWDactual>
      <pPWDnueva>${passwordNueva}</pPWDnueva>
    </CambioPWD_Usuario>
  </soap:Body>
</soap:Envelope>`;
  console.log("[ACCESOS] CambioPWD_Usuario XML incluye LOGINacceso:", soap.includes("<LOGINacceso>"));
  console.log("[ACCESOS] CambioPWD_Usuario XML incluye PWDacceso:", soap.includes("<PWDacceso>"));
  const soapLogged = soap
    .replace(`<pPWDactual>${passwordActual}</pPWDactual>`, `<pPWDactual>${maskValue(passwordActual)}</pPWDactual>`)
    .replace(`<pPWDnueva>${passwordNueva}</pPWDnueva>`, `<pPWDnueva>${maskValue(passwordNueva)}</pPWDnueva>`);

  console.log("[ACCESOS] Cambiando contraseña...");
  console.log("[ACCESOS] SOAP CambioPWD_Usuario generado:", soapLogged);

  const resp = await axios.post(WS_ACCESOS_URL, soap, {
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "http://www.fasa.cl/CambioPWD_Usuario"
    }
  });

  const responseXml = decodeHtmlEntities(resp.data);
  console.log("[ACCESOS] Respuesta SOAP completa CambioPWD_Usuario:", responseXml);
  const innerXml = getXmlTagValue(responseXml, "CambioPWD_UsuarioResult");
  const codigo = getXmlTagValue(innerXml, "Codigo");
  const mensaje = getXmlTagValue(innerXml, "Mensaje");

  if (codigo !== "0") {
    console.error("[ACCESOS] CambioPWD_Usuario FALLÓ:", mensaje);
    throw new Error(mensaje || "Error al cambiar contraseña");
  }

  console.log("[ACCESOS] Contraseña cambiada exitosamente");
  return true;
}

/* =====================================================
   Login completo (usuario + aplicación)
   ===================================================== */

async function loginConAplicacion(username, password, codAplicacion, newPassword) {
  // 1️⃣ Login técnico + usuario
  const loginResult = await loginUsuario(username, password);
  const { idLogin, passwordChangeRequired, codigo, mensaje: pwMensaje } = loginResult;

  // 2️⃣ Si requiere cambio y recibimos nueva clave → cambiar y reintentar
  if (passwordChangeRequired && newPassword) {
    await cambioPassword(idLogin, password, newPassword);
    const retryResult = await loginUsuario(username, newPassword);
    const newIdLogin = retryResult.idLogin;
    const menuXml = await obtenerMenu(newIdLogin);
	
	const rol = getUserRole(menuXml);
	const canUploadPAI = rol === "Admin";
	console.log("[ACCESOS] Rol detectado:", rol);
	console.log("[ACCESOS] canUploadPAI =", canUploadPAI);
	return {
		ok: true,
		mensaje: "Acceso concedido",
		pIdLogin: idLogin,
		codAplicacion: COD_APLICACION,
		menuXml,
		rol,
		canUploadPAI
	};
  }

  // 3️⃣ Si requiere cambio y NO hay nueva clave → informar al frontend
  if (passwordChangeRequired) {
    return {
      ok: true,
      passwordChangeRequired: true,
      codigo,
      pIdLogin: idLogin,
      codAplicacion: COD_APLICACION,
      mensajeCambioClave: pwMensaje
    };
  }

// 4️⃣ Flujo normal
  const menuXml = await obtenerMenu(idLogin);
  
  const rol = getUserRole(menuXml);
  const canUploadPAI = rol === "Admin";
  console.log("[ACCESOS] Rol detectado:", rol);
  console.log("[ACCESOS] canUploadPAI =", canUploadPAI);
  return {
	ok: true,
	mensaje: "Acceso concedido",
	pIdLogin: idLogin,
	codAplicacion: COD_APLICACION,
	menuXml,
	rol,
	canUploadPAI
	};

}

module.exports = {
  loginConAplicacion,
  cambioPassword
};
``
