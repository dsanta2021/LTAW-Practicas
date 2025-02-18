const fs = require('fs');
const http = require('http');
const path = require('path');

//-- Configuración
const PUERTO = 8001;
const BASE_DIR = path.join(__dirname, 'public');

//-- Mapeo de extensiones a tipos MIME
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon'
};

//-- Crear el servidor
const server = http.createServer((req, res) => {
    console.log(`Petición recibida: ${req.url}`);

    //-- Si la URL es "/", servir "index.html"
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(BASE_DIR, filePath);

    //-- Obtener la extensión del archivo
    const ext = path.extname(filePath);
    
    //-- Comprobar si la extensión es válida
    if (!mimeTypes[ext]) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Error 400 - Solicitud no válida</h1>');
        return;
    }

    //-- Leer y servir el archivo solicitado
    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.error(`Error al leer el archivo: ${filePath}`);
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>Error 404 - Archivo no encontrado</h1>');
        } else {
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] });
            res.end(data);
        }
    });
});

//-- Iniciar el servidor
server.listen(PUERTO, () => {
    console.log(`🚀 Servidor en marcha en http://localhost:${PUERTO}`);
});
