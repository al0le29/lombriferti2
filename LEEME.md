# Lombriferti · Página web

Tienda web de fertilizante orgánico hecho con residuos de mercado. Es un sitio estático (HTML, CSS y JavaScript, sin frameworks): no necesita instalación y guarda los datos en el navegador (localStorage).

## Modo local y modo servidor
- En `config.js`, `apiUrl: ''` = **modo local** (demostración, datos en el navegador). Con la dirección del servidor = **modo servidor**.
- `api.js` concentra todas las llamadas al servidor. Rutas, campos y lo que falta conectar: `INTEGRACION.md`.
- `servidor-ejemplo/` tiene un servidor de prueba (Node.js, sin instalar nada) para comprobar la conexión.
- En modo servidor: "Guardar y registrar lote" registra el lote (`POST /lotes`), Trazabilidad tiene "Registrar etapa: …" (`POST /lotes/:codigo/etapa`), las fotos de productos se escriben como dirección (por ejemplo `productos/lombriferti-50kg.jpg`) y `recuperarContrasena: false` en `config.js` oculta la recuperación de contraseña si el servidor aún no la tiene.

## Cómo abrirla
- **En tu computadora:** abre la carpeta con un servidor local (por ejemplo, la extensión Live Server de VS Code) y entra a `index.html`.
- **Publicada:** arrastra la carpeta completa a Netlify Drop (app.netlify.com/drop) o súbela a GitHub Pages. Así el QR abre desde cualquier celular.
- Los datos son por dirección: al cambiar de dirección se empieza vacío. Para llevarte los datos, descarga un respaldo en Configuración del administrador y restáuralo en la nueva dirección.

## Cuentas
- El teléfono se registra con la clave de su país (México, Estados Unidos, Centro y Sudamérica, España). El país se detecta solo con la zona horaria y el idioma del dispositivo, y se puede cambiar.
- Sin sesión se puede ver el catálogo, las páginas de producto, el asistente, los favoritos y las páginas de información. Para comprar se pide cuenta.
- Toda cuenta nueva es de **cliente**. Para crear un **administrador**, se escribe el código de administrador al registrarse. El código inicial es `LOMBRI-2026` y se cambia en Configuración del administrador.
- "¿Olvidaste tu contraseña?" usa un código de 6 dígitos. Como no hay servidor de correo, el código se muestra en pantalla (demostración).

## Funciones del cliente
- Catálogo de un solo producto, Lombriferti (fertilizante), en presentaciones de 5 kg ($75, $15 por kilo), 25 kg ($300, $12 por kilo) y 50 kg ($550, $11 por kilo) (`TIPOS`, `PRESENTACIONES` y `PRECIO_KG` en `app.js`). Cada tarjeta muestra el precio por kilo y, al registrar un lote, el precio se llena solo según la presentación, con buscador, filtro por presentación, orden y favoritos. Los lotes iguales (tipo, peso y precio) se muestran como un solo producto y se surten del más antiguo.
- Página de producto: foto, existencias, cómo usarlo, opiniones de clientes y productos relacionados.
- "Avísame cuando haya" en productos agotados.
- Carrito con cupones de descuento. El envío es gratis en todos los pedidos (`shipCost` en `app.js`).
- Cupones: el administrador elige si aplican a todas las presentaciones o solo a una (5, 25 o 50 kg). El porcentaje se descuenta de todas las unidades de los productos que aplican; el monto fijo, una vez por compra. El cliente los recibe por notificación, los ve en Perfil → Mis cupones y en el banner del catálogo.
- Al confirmar la compra, una animación (círculo verde, palomita que se dibuja y vuela al recibo) de ~1.6 s; el verde cambia con el tema. Un toque la salta y no se reproduce si el dispositivo pide reducir movimiento.
- Varias direcciones de entrega y pago simulado con tarjeta o en efectivo. De la tarjeta solo se guardan la marca y los últimos 4 dígitos.
- Mis compras por pedido: seguimiento con fechas reales, entrega estimada (compra + 5 días), detalle, comprobante imprimible, comprar de nuevo y cancelación (mientras esté pendiente o preparando).
- Asistente experto por reglas (`PLANTAS` en `app.js`), opiniones, notificaciones y perfil.
- En celular, el menú del administrador muestra Inicio, Productos, Pedidos y Reportes; las demás secciones están en "Más".
- Pie de página (solo para clientes e invitados) con Quiénes somos, Preguntas frecuentes, Contacto, Aviso de privacidad y Términos. Privacidad y términos son plantillas: revísalos antes de vender de verdad.

## Funciones del administrador
- **Inicio:** resumen, primeros pasos, aviso de espacio del navegador y panel de stock bajo.
- **Productos:** registrar, editar y eliminar lotes, con foto y QR. Si un lote ya tiene ventas, no se elimina y su tipo, peso, fecha y origen quedan bloqueados.
- **Trazabilidad**, **Ventas** (venta directa), **Pedidos** (estados con fecha de cada cambio), **Clientes**, **Cupones** (enviar a clientes y mostrar en el catálogo), **Residuos y costos**, **Reportes** (con exportación CSV) y **Configuración** (código de administrador y respaldo).

## Código QR y verificación
- Cada QR abre `verificar.html?l=<código del lote>` sin pedir cuenta. Solo lleva el código del lote.
- **Modo servidor:** la página pide el lote a `GET /lotes/:codigo` y muestra las etapas, fechas y huella que responde el servidor. Funciona desde cualquier celular.
- **Modo local:** solo se puede verificar en el navegador donde se registró el lote, con una huella calculada ahí mismo (demostración).
- Genera los QR después de publicar el sitio, no en `localhost`.

## Datos de demostración
`demo-datos.html` (no está enlazada en la tienda) carga y quita lotes `DEMO-…`, pedidos, residuos y gastos de ejemplo para que los reportes tengan datos al presentar.

## Archivos
| Archivo | Contenido |
|---|---|
| `index.html`, `login.html`, `verificar.html` | Páginas |
| `app.js` | Vistas principales, carrito, pago y navegación |
| `tienda.js` | Producto, Mis compras, cupones, clientes, avisos y páginas de información |
| `admin.js` | Pedidos, residuos y costos, reportes |
| `extras.js` | Comprobante, respaldo, espacio del navegador y primeros pasos |
| `sha.js`, `select.js`, `theme.js`, `intro.js` | Huella y sesiones, listas desplegables, tema y animación de entrada (la lombriz forma el logo y luego aparece el nombre; siempre se ve completa) |
| `styles.css` | Diseño, modo oscuro, celular e impresión |
| `icons/` | Logo (`logo.png`), ícono de la pestaña y de iPhone |
| `chat.js` | Chat del asistente: la caja para escribir queda fija abajo y cada mensaje nuevo se muestra encima (no cambia `app.js`) |
| `config.js`, `api.js` | Dirección del servidor y todas las llamadas a la API |
| `servidor-ejemplo/` | Servidor de prueba que responde lo que la página espera |
| `INTEGRACION.md` | Contrato de la API, qué falta conectar, blockchain y base de datos |

## Límites de esta versión
- Los datos viven en el navegador (unos 5 MB por sitio; las fotos son lo que más ocupa). Configuración muestra el espacio usado.
- El pago, la recuperación de contraseña y el código de administrador son de demostración; con servidor se validan allá.
- Los estados del pedido los cambia el administrador a mano.
- La librería del QR se carga de internet (cdnjs).
