^XA
^CI28
^MMT

^PW480
^LL248
^LH0,0
^LT0
^LS0

^PR4,4
~SD15

^FX ============================
^FX PRODUCTO (2 líneas)
^FX ============================
^FT140,44
^A0N,24,24
^FB300,2,0,C
^FD{PRODUCTO}^FS

^FX ============================
^FX PRECIO NORMAL
^FX ============================
^FT140,66
^A0N,14,14
^FB300,1,0,C
^FDPRECIO NORMAL: {PRECIO_NORMAL}^FS

^FX ============================
^FX PRECIO PRINCIPAL
^FX ============================
^FT140,128
^A0N,70,50
^FB300,1,0,C
^FD{PRECIO}^FS

^FX ============================
^FX PRECIO UNITARIO (SIN CAMBIO)
^FX ============================
^FT20,138
^A0N,18,18
^FD{PRECIO_UNIT} / {UM}^FS

^FT20,156
^A0N,16,16
^FDPrecio Unit.^FS

^FX ============================
^FX CODIGO DE BARRAS
^FX ============================
^BY1,2,42
^FT215,172
^BCN,32,N,N,N
^FD{EAN13}^FS

^FT215,188
^A0N,16,16
^FB200,1,0,C
^FD{EAN13}^FS

^FX ============================
^FX SKU
^FX ============================
^FT20,210
^A0N,16,16
^FDSKU:{SKU}^FS

^FX ============================
^FX FECHA (visible y bien alineada)
^FX ============================
^FT260,210
^A0N,16,16
^FB300,1,0,L
^FDVALIDO HASTA: {FECHA}^FS

^XZ