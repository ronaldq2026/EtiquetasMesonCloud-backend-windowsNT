^XA
^CI28
^MMT

^PW480
^LL248
^LH0,0

^PR2
~SD25

^FX ============================
^FX PRODUCTO
^FX ============================
^FT40,40
^A0N,20,20
^FB440,2,0,C
^FD{PRODUCTO}^FS

^FX ============================
^FX PRECIO NORMAL
^FX ============================
^FT60,54
^A0N,20,20
^FB400,1,0,C
^FDPRECIO NORMAL: {PRECIO_NORMAL}^FS

^FX ============================
^FX PRECIO OFERTA (MAS GRANDE)
^FX ============================
^FT60,135
^A0N,90,65
^FB400,1,0,C
^FD{PRECIO}^FS

^FX ============================
^FX PRECIO UNITARIO
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
^FT145,180
^BCN,32,N,N,N
^FD{EAN13}^FS

^FT120,198
^A0N,16,16
^FB240,1,0,C
^FD{EAN13}^FS

^FX ============================
^FX SKU
^FX ============================
^FT20,210
^A0N,16,16
^FDSKU:{SKU}^FS

^FX ============================
^FX FECHA
^FX ============================
^FT280,216
^A0N,16,16
^FB220,1,0,L
^FDVALIDO HASTA: {FECHA}^FS

^XZ