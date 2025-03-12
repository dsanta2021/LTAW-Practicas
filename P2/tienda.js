const http = require('http');
const fs = require('fs');
const path = require('path');

//-- Rutas
const PUBLIC_DIR = path.join(__dirname, 'public');
const RUTAS = {
    error: path.join(PUBLIC_DIR, 'error.html'),
    sin_producto: path.join(PUBLIC_DIR, 'producto_no_encontrado.html'),
    db: path.join(PUBLIC_DIR, 'json', 'tienda.json')
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

//-- Servidor HTTP
const server = http.createServer((req, res) => {
    let url = req.url;

    switch (true) {
        case url === '/' || url === '/index.html':
            generarPaginaPrincipal(res);
            break;
        
        case url.startsWith('/producto/'):
            let idProducto = url.split('/').pop();
            generarPaginaProducto(res, idProducto);
            break;
        
        case url === '/ofertas':
            generarPaginaFiltrada(res, 'Oferta', 'Si');
            break;
        
        case url === '/novedades':
            generarPaginaFiltrada(res, 'Novedad', 'Si');
            break;
        
        default:
            servirArchivoEstatico(req, res);
    }
});

//-- Generar Página Principal
function generarPaginaPrincipal(res) {
    let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

    let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FrikiShop</title>
    <link rel="stylesheet" href="css/styles.css">
    <link rel="icon" href="img/favicon.ico" type="image/x-icon">
    <script defer src="js/script.js"></script>
</head>
<body>
    <header class="barra-superior">
        <div class="logo">
            <img src="img/logo.png" alt="Logo de FrikiShop">
            <h1>FrikiShop</h1>
        </div>
        <div class="buscador">
            <input type="text" placeholder="Buscar productos...">
            <button>🔍</button>
        </div>
        <div class="acciones">
            <select>
                <option>🇪🇸 ES</option>
                <option>🇬🇧 EN</option>
            </select>
            <a href="#">Inicio</a>
            <a href="#">Contacto</a>
            <a href="#">🛒 Carrito</a>
        </div>
    </header>
    
    <nav class="barra-navegacion">
        <button class="menu">☰ Menú</button>
        <a href="/ofertas">🔥 Ofertas</a>
        <a href="/novedades">🆕 Últimas novedades</a>
    </nav>
    
    <main>
        <section class="productos">`;

    tienda.productos.forEach(producto => {
        contenido += `
            <div class="producto">
                <a href="/producto/${producto.id}"><img src="img/${producto.imagen[0]}" alt="${producto.nombre}"></a>
                <h2>${producto.nombre}</h2>
                <p>${producto.miniDescripcion}</p>
                <a href="/producto/${producto.id}">Ver más</a>
            </div>`;
    });

    contenido += `
        </section>
    </main>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(contenido);
}

//-- Generar Página de Producto
function generarPaginaProducto(res, id) {
    let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));
    let producto = tienda.productos.find(p => p.id == id);

    if (!producto) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(RUTAS.sin_producto));
        return;
    }

    let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${producto.nombre}</title>
    <link rel="stylesheet" href="/css/styles.css">
    <link rel="stylesheet" href="/css/styles_products.css">
    <script defer src="/js/script.js"></script>
</head>
<body>
    <header class="barra-superior">
        <div class="logo">
            <img src="/img/logo.png" alt="Logo de FrikiShop">
            <h1>FrikiShop</h1>
        </div>
        <div class="buscador">
            <input type="text" placeholder="Buscar productos...">
            <button>🔍</button>
        </div>
        <div class="acciones">
            <select>
                <option>🇪🇸 ES</option>
                <option>🇬🇧 EN</option>
            </select>
            <a href="/">Inicio</a>
            <a href="#">Contacto</a>
            <a href="#">🛒 Carrito</a>
        </div>
    </header>
    <nav class="barra-navegacion">
        <button class="menu">☰ Menú</button>
        <a href="/ofertas">🔥 Ofertas</a>
        <a href="/novedades">🆕 Últimas novedades</a>
    </nav>
    <h2 class="nombre-producto">${producto.nombre}</h2>
    <section class="galeria">
        ${producto.imagen.map(img => `<img src="/img/${img}" alt="${producto.nombre}">`).join('')}
    </section>
    <main class="producto-container">
        <section class="detalles-producto">
            <h3><span>${producto.description[0]}</span></h3>
            <p><span>Tamaño:</span> ${producto.description[1]}</p>
            <h3><span class="precio">${producto.precio} €</span></h3>
            <button class="btn-comprar">Agregar al carrito</button>
            <button class="btn-inicio"><a href="/">Home</a></button>
        </section>
    </main>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(contenido);
}


//-- Generar Página Filtrada (Ofertas / Novedades)
function generarPaginaFiltrada(res, criterio, valor) {
    let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));
    let productosFiltrados = tienda.productos.filter(p => p[criterio] === valor);

    let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${criterio}</title>
    <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
    <h1>${criterio}</h1>
    <ul>`;

    productosFiltrados.forEach(producto => {
        contenido += `<li><a href='/producto/${producto.id}'>${producto.nombre} - ${producto.precio}€</a></li>`;
    });

    contenido += '</ul><a href="/">Volver</a></body></html>';

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(contenido);
}

//-- Servir Archivos Estáticos
function servirArchivoEstatico(req, res) {
    let filePath = path.join(PUBLIC_DIR, req.url);
    let ext = path.extname(filePath);
    let contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(fs.readFileSync(RUTAS.error));
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
}

server.listen(8001, () => {
    console.log('Servidor corriendo en http://localhost:8001');
});
