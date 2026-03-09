const express = require("express")
const router = express.Router()

const { getProductosPorSku } = require("../services/pos.service")

router.get("/api/pai/leer-centralizado", async (req, res) => {

  try {

    // MOCK Oracle
    const skusOracle = [
      "89997002",
      "89997001",
      "89996005",
      "89996004"
    ]

    const productos = await getProductosPorSku(skusOracle)

    res.json(productos)

  } catch (err) {

    console.error(err)

    res.status(500).json({
      error: "Error leyendo archivo centralizado"
    })

  }

})

module.exports = router