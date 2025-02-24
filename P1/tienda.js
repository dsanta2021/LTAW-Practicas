//-- Imports
const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

//-- Configuración (Especificación)
const PUERTO = 8001;    

//-- Rutas
const PUBLIC_DIR = path.join(__dirname, 'public');
const RUTAS = {
    index: path.join(PUBLIC_DIR, 'index.html'),
    error: path.join(PUBLIC_DIR, 'error.html'),
    img: path.join(PUBLIC_DIR, 'img'),
    css: path.join(PUBLIC_DIR, 'css'),
    js: path.join(PUBLIC_DIR, 'js')
};

//-- Mapeo de extensiones a tipos MIME
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon'
};

// Función para servir archivos estáticos
function servirArchivo(res, rutaArchivo) {
    const ext = path.extname(rutaArchivo).toLowerCase();
    const contentType = mimeTypes[ext];

    fs.readFile(rutaArchivo, (err, data) => {
        if (err) {
            console.error(`Error al leer el archivo: ${rutaArchivo}`);
            fs.readFile(RUTAS.error, (err, data) => {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('<h1>Error 404 - Not Found</h1>');
                } else {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end(data);
                }
            });
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
}

//-- Crear el servidor
const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const extension = path.extname(url.pathname);
    let filePath = path.join(PUBLIC_DIR, url.pathname);

    switch (url.pathname) {
        case '/':
            console.log("Petición: Página principal");
            filePath = RUTAS.index
            break;

        case '/error.html':
            console.log("Petición: Página de error");
            filePath = RUTAS.error
            break;
    }

    switch (extension) {
        case '.html':
            path.join(PUBLIC_DIR, path.basename(url.pathname));
            break;

        case '.css':
            filePath = path.join(RUTAS.css, path.basename(url.pathname));
            break;

        case '.js':
            filePath = path.join(RUTAS.js, path.basename(url.pathname));
            break;

        case '.jpg':
        case '.jpeg':
        case '.png':
        case '.gif':
        case '.ico':
            filePath = path.join(RUTAS.img, path.basename(url.pathname));
            break;

        default:
            console.log("Petición: Página de error");
            carpeta = RUTAS.error;
            break;
    }

    console.log('Sirviendo: ' + filePath);
    servirArchivo(res, filePath);

});

//-- Iniciar el servidor
server.listen(PUERTO, () => {
    console.log(`🚀 Servidor en marcha en http://localhost:${PUERTO}`);
});
