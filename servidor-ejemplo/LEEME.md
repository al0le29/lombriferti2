# Servidor de ejemplo

Un servidor pequeño para **probar que la página se conecta**. No es el servidor final: guarda los datos en `datos.json`, usa `scrypt` en lugar de bcrypt y no tiene blockchain. Sirve a tu equipo como guía de qué debe responder cada ruta (ver `../INTEGRACION.md`).

## Cómo probarlo
1. Instala Node.js 18 o más nuevo.
2. En esta carpeta: `node servidor.js`. Queda en `http://localhost:3000/api`.
3. En `../config.js` pon `apiUrl: 'http://localhost:3000/api'`.
4. Abre la página con Live Server (o cualquier servidor local) y crea una cuenta.

- Código de administrador: `LOMBRI-2026` (se cambia con la variable de entorno `ADMIN_CODE`).
- Los códigos para recuperar contraseña se imprimen en la consola del servidor (simula el correo).
- Para empezar de cero, borra `datos.json`.
- Si la página está publicada en GitHub Pages (HTTPS), el navegador no deja llamar a `http://localhost`; para probar desde el celular el servidor también tiene que estar publicado con HTTPS.
