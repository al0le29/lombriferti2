# Integración con el servidor

La página tiene dos modos, y se cambia en **`config.js`**:

| `apiUrl` en `config.js` | Modo | Qué pasa |
|---|---|---|
| `''` (vacío) | **Local** | La página funciona sola y guarda todo en el navegador. Es la versión de demostración. |
| `'https://…/api'` | **Servidor** | Registro, inicio de sesión, catálogo, compras, pedidos y verificación del QR van al servidor. |

Todas las llamadas están en **`api.js`**. Si el servidor usa otros nombres de campos, solo se cambian los *mapeos* de ese archivo; el resto de la página no se toca.

Para probar sin el servidor final hay un **servidor de ejemplo** en `servidor-ejemplo/` que responde exactamente lo que la página espera (ver su `LEEME.md`).

## Qué ya está conectado (fase 1)

| Parte | Modo servidor |
|---|---|
| Registro e inicio de sesión | El servidor valida la contraseña (bcrypt) y el código de administrador. La página ya no cifra contraseñas ni guarda cuentas. |
| Recuperar contraseña | El servidor manda el código por correo. La página no lo muestra. |
| Catálogo | Se carga de `GET /lotes` al abrir la página. |
| Lotes (administrador) | Crear, editar y eliminar con `POST`/`PUT`/`DELETE /lotes`. Incluye el **lote de origen** (recepción de residuos). |
| Compra | `POST /pedidos`. El servidor revisa existencias y precios, calcula el envío, descuenta el stock y regresa el pedido. |
| Mis compras y Pedidos | `GET /pedidos` (el cliente recibe los suyos; el administrador, todos). Cambios de estado con `PATCH`, cancelación con `POST …/cancelar`. |
| Código QR | Solo lleva el código del lote: `verificar.html?l=LF-2025-001`. |
| Verificación y trazabilidad | `GET /lotes/:codigo` regresa etapas, fechas y huella. Funciona desde cualquier celular. |
| Etapas del lote | Botón "Registrar etapa: …" en Trazabilidad del administrador → `POST /lotes/:codigo/etapa`. |

**Siguen en el navegador (fase 2):** residuos y gastos, cupones, reseñas, favoritos, avisos de existencia, notificaciones, direcciones, tarjetas guardadas y reportes (los reportes ya usan los pedidos del servidor). Mientras tanto, el descuento del cupón lo manda la página en `descuento` y el servidor de ejemplo lo acepta hasta el subtotal; **el servidor real debe calcularlo él mismo** cuando exista la tabla de cupones.

## Contrato de la API

Todas las rutas empiezan con la dirección de `config.js` (por ejemplo `https://api.lombriferti.mx/api`). Se envía y recibe JSON. Con sesión, la página manda `Authorization: Bearer <token>`. Los errores responden `{ "error": "mensaje para el usuario" }` con el código HTTP adecuado; la página muestra ese mensaje tal cual. Un `401` con sesión cierra la sesión en la página.

### Cuentas
| Método y ruta | Envía | Responde |
|---|---|---|
| `POST /auth/registro` | `{ nombre, email, telefono, password, codigoAdmin? }` | `201 { token, usuario }` |
| `POST /auth/login` | `{ usuario, password }` (`usuario` = e-mail o teléfono de 10 dígitos) | `{ token, usuario }` |
| `GET /auth/yo` | — | `{ usuario }` |
| `POST /auth/salir` | — | `204` |
| `POST /auth/recuperar` | `{ email }` | `204` siempre (no revela si existe la cuenta) |
| `POST /auth/restablecer` | `{ email, codigo, password }` | `204` |

Si el servidor todavía no tiene estas dos rutas, en `config.js` se pone `recuperarContrasena: false` y la página oculta "¿Olvidaste tu contraseña?". Si se deja en `true` y la ruta no existe (404), la página muestra un aviso amable en lugar de un error.

`usuario = { id, nombre, email, telefono, rol: "cliente" | "admin" }`

### Lotes
| Método y ruta | Quién | Envía / responde |
|---|---|---|
| `GET /lotes` | todos | `[lote]` |
| `GET /lotes/:codigo` | todos (página del QR) | `lote + { etapas, huella, verificado, blockchain }` |
| `POST /lotes` | admin | envía `lote`, responde `201 lote` |
| `PUT /lotes/:codigo` | admin | envía `lote`, responde `lote`. Si ya tiene ventas, no cambiar tipo, kg, fecha ni origen. |
| `DELETE /lotes/:codigo` | admin | `204`; `409` si tiene ventas |
| `POST /lotes/:codigo/etapa` | admin | envía `{ nota? }`; registra la **siguiente** etapa del lote (y en la blockchain) y responde igual que `GET /lotes/:codigo`. `409` si ya no hay más etapas. |

`lote = { codigo, tipo, kgPorUnidad, fechaProduccion, precio, stock, descripcion, fotoUrl, loteOrigen }`

Solo se vende **Lombriferti (fertilizante)** en presentaciones de **5, 25 y 50 kg**: `tipo` siempre es `"Lombriferti (fertilizante)"` y `kgPorUnidad` es 5, 25 o 50. El servidor debe rechazar otros pesos con `400` (el servidor de ejemplo ya lo hace). Precios oficiales: 5 kg = $75, 25 kg = $300, 50 kg = $550.

**Registrar un lote en la blockchain** = `POST /lotes`: el botón **"Guardar y registrar lote"** de Productos (modo servidor) lo llama. El servidor guarda el lote, lo registra y lo deja en su primera etapa.

**Imágenes (`fotoUrl`)**: se guardan como **dirección (URL)**, no como archivo dentro del JSON. Puede ser un archivo de la carpeta `productos/` de la página (`"productos/lombriferti-50kg.jpg"`) o una dirección completa (`"https://…"`). En modo servidor, el formulario de Productos pide esa dirección. Si después se quiere subir la foto desde el panel, hace falta una ruta de subida en el servidor que regrese la URL.

`etapas = [{ nombre, fecha, detalle? }]`, en orden. `siguienteEtapa` = nombre de la etapa que sigue (texto) o `null` si ya terminó; la página muestra el botón **"Registrar etapa: …"** en Trazabilidad del administrador solo cuando no es `null`. La página pone el ícono según el nombre (residuos, producción, transporte, distribución, venta, entrega), así que **las etapas oficiales se definen en el servidor** y la página las muestra sin cambios.

`blockchain = { red, transaccion }` o `null` mientras no esté conectada.

### Pedidos
| Método y ruta | Quién | Envía / responde |
|---|---|---|
| `GET /pedidos` | cliente: los suyos · admin: todos | `[pedido]` |
| `POST /pedidos` | cliente (o admin con `ventaDirecta: true`) | `{ items:[{ lote, cantidad }], direccion, pago:{ metodo, marca?, last4? }, cupon?, descuento?, ventaDirecta? }` → `201 pedido` |
| `PATCH /pedidos/:id` | admin | `{ estado }` (solo hacia adelante: pendiente → preparando → enviado → entregado) |
| `POST /pedidos/:id/cancelar` | dueño o admin | solo si está pendiente o preparando; regresa el stock |

`pedido = { id, numero, fecha, cliente:{ id, nombre, email } | null, items:[{ lote, cantidad, precio, tipo, kgPorUnidad }], subtotal, descuento, cupon, envio, total, pago, direccion, estado, historial:{ estado: fecha } }`

## Blockchain
- La **huella** de cada lote la calcula el servidor: SHA-256 de `codigo|tipo|kgPorUnidad|fechaProduccion|loteOrigen` (ver `servidor-ejemplo/servidor.js`). Si la blockchain usa otra fórmula, solo cambia en el servidor.
- Qué registrar: el lote al crearse (con su lote de origen), la recepción de residuos, cada venta y, si se quiere, los cambios de estado del pedido.
- `GET /lotes/:codigo` debe consultar la blockchain y responder `verificado` y `blockchain`; la página muestra el resultado.

## Base de datos (tablas sugeridas)
Fase 1: `usuarios`, `lotes`, `pedidos`, `pedido_items`, `historial_pedido`, `recuperaciones` (códigos para restablecer contraseña).
Fase 2: `recepciones_residuos`, `gastos`, `cupones`, `cupones_clientes`, `resenas`, `favoritos`, `avisos_stock`, `notificaciones`, `direcciones`, `tarjetas` (solo marca y últimos 4 dígitos).

## Seguridad en el servidor real
- HTTPS en la página y en la API.
- Contraseñas con bcrypt; nunca se guardan ni se registran en texto plano.
- El código de administrador vive en el servidor (variable de entorno), no en el código de la página.
- CORS solo para el dominio de la página.
- Límite de intentos de inicio de sesión y de recuperación.
- El servidor recalcula precios, envío, descuentos y existencias; nunca confía en los montos que manda la página.
