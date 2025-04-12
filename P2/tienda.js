const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

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

//-- Parsear Cookies
function parseCookies(req) {
    let list = {};
    let cookieHeader = req.headers.cookie;

    if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
            let [name, ...rest] = cookie.split('=');
            name = name.trim();
            let value = rest.join('=').trim();
            if (value) {
                list[name] = decodeURIComponent(value);
            }
        });
    }

    return list;
}

//-- Servidor HTTP
const server = http.createServer((req, res) => {
    let cookies = parseCookies(req);
    let url = req.url;

    switch (true) {
        case url === '/' || url === '/index.html':
            generarPaginaPrincipal(res, cookies);
            break;
        
        case url.startsWith('/producto/'):
            let idProducto = url.split('/').pop();
            generarPaginaProducto(res, idProducto, cookies);
            break;
        
        case url === '/ofertas':
            generarPaginaFiltrada(res, 'Oferta', 'Si', cookies);
            break;
        
        case url === '/novedades':
            generarPaginaFiltrada(res, 'Novedad', 'Si', cookies);
            break;

        case url === '/login':
            if (req.method === 'POST') handleLogin(req, res);
            else mostrarLogin(res);
            break;

        case url === '/register':
            if (req.method === 'POST') handleRegister(req, res);
            else mostrarRegistro(res);
            break;

        case url === '/logout':
            handleLogout(res);
            break;
        
        default:
            servirArchivoEstatico(req, res);
    }
});

//-- Generar Página Principal
function generarPaginaPrincipal(res, cookies = {}) {
    let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));
    let usuario = cookies.usuario || null;

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
            ${usuario 
                ? `<span class="usuario">👤 ${usuario}</span> <a href="/logout">Log-Out</a>` 
                : `<a href="/login">Log-In</a>`}
            <a href="/carrito">🛒 Carrito</a>
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
function generarPaginaProducto(res, id, cookies = {}) {
    let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));
    let producto = tienda.productos.find(p => p.id == id);
    let usuario = cookies.usuario || null;

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
             ${usuario 
                ? `<span class="usuario">👤 ${usuario}</span> <a href="/logout">Log-Out</a>` 
                : `<a href="/login">Log-In</a>`}
            <a href="/carrito">🛒 Carrito</a>
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
function generarPaginaFiltrada(res, criterio, valor, cookies = {}) {
    let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));
    let usuario = cookies.usuario || null;
    let productosFiltrados = tienda.productos.filter(p => p[criterio] === valor);

    let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FrikiShop - ${criterio}: ${valor}</title>
    <link rel="stylesheet" href="/css/styles.css">
    <link rel="icon" href="/img/favicon.ico" type="image/x-icon">
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
            ${usuario 
                ? `<span class="usuario">👤 ${usuario}</span> <a href="/logout">Log-Out</a>` 
                : `<a href="/login">Log-In</a>`}
            <a href="/carrito">🛒 Carrito</a>
        </div>
    </header>

    <nav class="barra-navegacion">
        <button class="menu">☰ Menú</button>
        <a href="/ofertas">🔥 Ofertas</a>
        <a href="/novedades">🆕 Últimas novedades</a>
    </nav>

    <main>
        <section class="productos">`;

    if (productosFiltrados.length > 0) {
        productosFiltrados.forEach(producto => {
            contenido += `
                <div class="producto">
                    <a href="/producto/${producto.id}"><img src="/img/${producto.imagen[0]}" alt="${producto.nombre}"></a>
                    <h2>${producto.nombre}</h2>
                    <p>${producto.miniDescripcion}</p>
                    <a href="/producto/${producto.id}">Ver más</a>
                </div>`;
        });
    } else {
        contenido += `<p class="mensaje-no-encontrado">No se encontraron productos para este criterio.</p>`;
    }

    contenido += `
        </section>
        <a href="/" class="btn-volver">Volver a la tienda</a>
    </main>
</body>
</html>`;

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

//-- Manejar Login
function handleLogin(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        let { nombre, password } = querystring.parse(body);
        let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

        // Buscar al usuario en la base de datos
        let usuario = tienda.usuarios.find(u => u.nombre === nombre && u.password === password);

        if (usuario) {
            res.setHeader('Set-Cookie', `usuario=${nombre}; HttpOnly`);
            res.writeHead(302, { 'Location': '/' });
            res.end();
        } else {
            res.writeHead(401, { 'Content-Type': 'text/html' });
            let contenido = `
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
            <a href="/login">Log-In</a>
            <a href="/carrito">🛒 Carrito</a>
        </div>
    </header>
    
    <nav class="barra-navegacion">
        <button class="menu">☰ Menú</button>
        <a href="/ofertas">🔥 Ofertas</a>
        <a href="/novedades">🆕 Últimas novedades</a>
    </nav>
        <h2>Iniciar Sesión</h2>
        <form method="POST">
            <label>Usuario: <input type="text" name="username" required></label>
            <button type="submit">Entrar</button>
        </form>
        <h3>Usuario no registrado. <a href="/register">Regístrate aquí</a></h3>
    `;
            res.end(contenido);
        }
    });
}

//-- Manejar Registro
function handleRegister(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        let { nombre, nombreReal, correo, password} = querystring.parse(body);
        let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));
        
        if (tienda.usuarios.some(u => u.nombre === nombre)) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h2>Ese usuario ya existe. <a href="/login">Inicia sesión aquí</a></h2>');
            return;
        }
        
        tienda.usuarios.push({ nombre, nombreReal, correo, password });
        fs.writeFileSync(RUTAS.db, JSON.stringify(tienda, null, 2));
        res.writeHead(302, { 'Location': '/login' });
        res.end();
    });
}

//-- Manejar Logout
function handleLogout(res) {
    res.setHeader('Set-Cookie', 'usuario=; Max-Age=0');
    res.writeHead(302, { 'Location': '/' });
    res.end();
}

//-- Mostrar Formulario de Login
function mostrarLogin(res) {
    let contenido = `
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login - FrikiShop</title>
            <link rel="icon" href="/img/favicon.ico" type="image/x-icon">
            <link rel="stylesheet" href="/css/login_register.css">
        </head>
        <body>
            <div class="container">
                <header>
                    <img src="/img/logo.png" alt="FrikiShop" class="logo">
                    <h1>FrikiShop</h1>
                </header>
                <nav>
                    <a href="index.html">Inicio</a>
                    <a href="#" id="change-language">Idioma</a>
                    <a href="register">Registrarse</a>
                </nav>
                <main>
                    <form action="/login" method="post" class="auth-form">
                        <h2>Iniciar Sesión</h2>
                        <label for="nombre">Nombre de usuario</label>
                        <input type="text" id="nombre" name="nombre" required>
                        
                        <label for="password">Contraseña</label>
                        <input type="password" id="password" name="password" required>
                        
                        <button type="submit">Iniciar Sesión</button>
                    </form>
                </main>
            </div>
        </body>
        </html>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(contenido);
}

//-- Mostrar Formulario de Registro
function mostrarRegistro(res) {
    let contenido = `
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Registro - FrikiShop</title>
            <link rel="icon" href="/img/favicon.ico" type="image/x-icon">
            <link rel="stylesheet" href="/css/login_register.css">
        </head>
        <body>
            <div class="container">
                <header>
                    <img src="/img/logo.png" alt="FrikiShop" class="logo">
                    <h1>FrikiShop</h1>
                </header>
                <nav>
                    <a href="index.html">Inicio</a>
                    <a href="#" id="change-language">Idioma</a>
                    <a href="login">Log-In</a>
                </nav>
                <main>
                    <form action="/register" method="post" class="auth-form">
                        <h2>Registrarse</h2>
                        <label for="nombreReal">Nombre real</label>
                        <input type="text" id="nombreReal" name="nombreReal" required>
                        
                        <label for="nombre">Nombre de usuario</label>
                        <input type="text" id="nombre" name="nombre" required>
                        
                        <label for="correo">Correo electrónico</label>
                        <input type="correo" id="correo" name="correo" required>
                        
                        <label for="password">Contraseña</label>
                        <input type="password" id="password" name="password" required>
                        
                        <button type="submit">Registrarse</button>
                    </form>
                </main>
            </div>
        </body>
        </html>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(contenido);
}

server.listen(8001, () => {
    console.log('Servidor corriendo en http://localhost:8001');
});
