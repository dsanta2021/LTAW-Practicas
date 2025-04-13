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
                try {
                    list[name] = decodeURIComponent(value); // Decodificar el valor de la cookie
                } catch (e) {
                    console.error(`Error al decodificar la cookie ${name}:`, e);
                }
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

        case url === '/carrito':
            generarPaginaCarrito(res, cookies);
            break;

        case url.startsWith('/agregar/') && req.method === 'POST':
            let idProductoAgregar = url.split('/').pop();
            agregarAlCarrito(req, res, idProductoAgregar, false, cookies);  //No redirigir a la página de carrito
            break;

        case url === '/finalizar-pedido' || url === '/finalizar-pedido?':
            if (req.method === 'POST') {
                procesarPedido(req, res, cookies);
            } else if (req.method === 'GET') {
                mostrarFormularioPedido(res, cookies);
            }
            break;

        default:
            servirArchivoEstatico(req, res);
    }
});

//-- Generar Página Principal
function generarPaginaPrincipal(res, cookies = {}) {
    let usuario;

    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        usuario = null;
    }

    let nombre = usuario ? usuario.nombre : null;

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
            ${usuario
            ? `<span class="usuario">👤 ${nombre}</span> <a href="/logout">Log-Out</a>`
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
    let usuario;

    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        usuario = null;
    }
    let nombre = usuario ? usuario.nombre : null;

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
             ${usuario
            ? `<span class="usuario">👤 ${nombre}</span> <a href="/logout">Log-Out</a>`
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
            <button class="btn-comprar" onclick="añadirAlCarrito('${producto.id}')">Agregar al carrito</button>
            <button class="btn-inicio"><a href="/">Home</a></button>
        </section>
    </main>
    <script>
    async function añadirAlCarrito(idProducto) {
        try {
            const response = await fetch('/agregar/' + idProducto, { method: 'POST' });
            if (response.ok) {
                mostrarNotificacion('Producto añadido al carrito');
            } else {
                mostrarNotificacion('Error al añadir el producto al carrito', true);
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarNotificacion('Error al añadir el producto al carrito', true);
        }
    }

    function mostrarNotificacion(mensaje, error = false) {
        // Crear el contenedor de la notificación
        const notificacion = document.createElement('div');
        notificacion.className = 'notificacion ' + (error ? 'error' : 'exito');
        notificacion.textContent = mensaje;

        // Añadir la notificación al cuerpo del documento
        document.body.appendChild(notificacion);

        // Eliminar la notificación después de 3 segundos
        setTimeout(() => {
            notificacion.style.opacity = '0'; // Desvanecer
            setTimeout(() => notificacion.remove(), 500); // Eliminar del DOM
        }, 3000);
    }
    </script>

    <style>
    /* Notificaciones */
    .notificacion {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #4caf50; /* Verde para éxito */
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
        font-size: 16px;
        z-index: 1000;
        opacity: 1;
        transition: opacity 0.5s ease, transform 0.5s ease;
        transform: translateY(0);
    }

    .notificacion.error {
        background-color: #f44336; /* Rojo para errores */
    }

    .notificacion.exito {
        background-color: #4caf50; /* Verde para éxito */
    }

    .notificacion.oculta {
        opacity: 0;
        transform: translateY(20px);
    }
    <style>

</body>
</html>`;


    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(contenido);
}

//-- Generar Página Filtrada (Ofertas / Novedades)
function generarPaginaFiltrada(res, criterio, valor, cookies = {}) {
    let usuario;

    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        usuario = null;
    }
    let nombre = usuario ? usuario.nombre : null;

    let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

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
            ? `<span class="usuario">👤 ${nombre}</span> <a href="/logout">Log-Out</a>`
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

//-- Generar Página de Error 404
function error404(res) {
    let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tienda Friki</title>
    <link rel="stylesheet" href="/css/styles_error.css">
    <script defer src="js/script.js"></script>
</head>
<body>
    <!-- Barra superior -->
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

    <!-- Segunda barra -->
    <nav class="barra-navegacion">
        <button class="menu">☰ Menú</button>
        <a href="#">🔥 Ofertas</a>
        <a href="#">🆕 Últimas novedades</a>
    </nav>

    <main>
        <section class="error_404">
            <div class="error-content">
                <img src="img/error_404.png" alt="Error Image">
                <div class="error-text">
                    <h1>Error 404 - Not Found</h1>
                    <p>¡Ups! Something is wrong</p>
                    <button onclick="window.location.href='index.html'">Back To Home</button>
                </div>
            </div>
        </section>
    </main>

</body>
</html>
`;
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(contenido);
}

//-- Generar Página de Producto No Encontrado
function productoNoEncontrado(res) {
    let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tienda Friki</title>
    <link rel="stylesheet" href="/css/styles_error.css">
    <script defer src="js/script.js"></script>
</head>
<body>
    <!-- Barra superior -->
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

    <!-- Segunda barra -->
    <nav class="barra-navegacion">
        <button class="menu">☰ Menú</button>
        <a href="#">🔥 Ofertas</a>
        <a href="#">🆕 Últimas novedades</a>
    </nav>

    <main>
        <section class="error_404">
            <div class="error-content">
                <img src="img/not_found.png" alt="Error Image">
                <div class="error-text">
                    <h1>Lo sentimos 😞</h1>
                    <p>No hemos encontrado productos que coincidan con tu búsqueda</p>
                    <button onclick="window.location.href='index.html'">Back To Home</button>
                </div>
            </div>
        </section>
    </main>

</body>
</html>`;
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(contenido);
}

//-- Servir Archivos Estáticos
function servirArchivoEstatico(req, res) {
    let filePath = path.join(PUBLIC_DIR, req.url);
    let ext = path.extname(filePath);
    let contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            error404(res); // Usar la función dinámica para el error 404
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
            // Crear un objeto usuario con un carrito vacío
            let usuarioData = {
                nombre: usuario.nombre,
                carrito: []
            };

            // Guardar la cookie como un JSON válido
            res.setHeader('Set-Cookie', `usuario=${encodeURIComponent(JSON.stringify(usuarioData))}; Path=/; HttpOnly`);
            res.writeHead(302, { 'Location': '/' });
            res.end();
        } else {
            res.writeHead(401, { 'Content-Type': 'text/html' });
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
                        
                        <p style="color: red; font-size: 14px;">Usuario o contraseña incorrectos</p>
                        
                        <button type="submit">Iniciar Sesión</button>
                    </form>
                </main>
            </div>
        </body>
        </html>
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
        let { nombre, nombreReal, correo, password } = querystring.parse(body);
        let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

        if (tienda.usuarios.some(u => u.nombre === nombre)) {
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

                        <p style="color: red; font-size: 14px;">El nombre de usuario ya existe. Por favor, elige otro.</p>
                        
                        <button type="submit">Registrarse</button>
                    </form>
                </main>
            </div>
        </body>
        </html>
    `;
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(contenido);
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
    // Eliminar las cookies 'usuario' y 'carrito'
    res.setHeader('Set-Cookie', 'usuario=; Max-Age=0; Path=/; HttpOnly');

    // Redirigir al usuario a la página principal
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

function generarPaginaCarrito(res, cookies = {}) {
    let usuario;

    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        // Eliminar la cookie inválida
        res.setHeader('Set-Cookie', 'usuario=; Max-Age=0; Path=/; HttpOnly');
        usuario = null;
    }

    if (!usuario) {
        let contenido = `<!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Carrito - FrikiShop</title>
            <link rel="stylesheet" href="/css/styles.css">
            <link rel="stylesheet" href="/css/styles_carrito.css">
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
                    <a href="/login">Log-In</a>
                    <a href="/carrito">🛒 Carrito</a>
                </div>
            </header>

            <main class="error-container">
                <div class="error-content">
                    <h1>Acceso denegado</h1>
                    <p>Debes iniciar sesión para ver tu carrito.</p>
                    <a href="/login" class="btn-login">Inicia sesión aquí</a>
                </div>
            </main>
        </body>
        </html>`;
        res.writeHead(401, { 'Content-Type': 'text/html' });
        res.end(contenido);
        return;
    }

    let carrito = usuario.carrito || [];
    let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

    let nombre =  usuario.nombre;
    // Si el carrito está vacío, mostrar el mensaje y el botón
    if (carrito.length === 0) {
        let contenido = `<!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Carrito - FrikiShop</title>
        <link rel="stylesheet" href="/css/styles.css">
        <link rel="stylesheet" href="/css/styles_carrito.css">
        <link rel="icon" href="img/favicon.ico" type="image/x-icon">
        <script defer src="js/script.js"></script>
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
                    ? `<span class="usuario">👤 ${nombre}</span> <a href="/logout">Log-Out</a>`
                    : `<a href="/login">Log-In</a>`}
                <a href="/carrito">🛒 Carrito</a>
            </div>
        </header>

        <main class="carrito-vacio">
            <div class="carrito-vacio-contenido">
                <h1>Tu carrito está vacío</h1>
                <p>No tienes productos en tu carrito. ¡Empieza a comprar ahora!</p>
                <a href="/" class="btn-ir-comprar">Ir a comprar</a>
            </div>
        </main>
    </body>
    </html>
    
    <style>
    body {
        background-color: #222;
        color: #fff;
    }

    .carrito-vacio {
        text-align: center;
        padding: 50px;
    }

    .carrito-vacio h1 {
        font-size: 28px;
        margin-bottom: 20px;
    }

    .carrito-vacio p {
        font-size: 18px;
        margin-bottom: 20px;
    }

    .btn-ir-comprar {
        display: inline-block;
        padding: 10px 20px;
        font-size: 16px;
        font-family: 'Press Start 2P', cursive;
        text-decoration: none;
        border: 2px solid;
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.3s;
        background: #00ccff;
        border-color: #00ccff;
        color: white;
    }

    .btn-ir-comprar:hover {
        background: #0099cc;
        box-shadow: 0px 0px 15px #00ccff;
    }
    </style>
    `;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(contenido);
        return;
    }

    // Filtrar los productos que están en el carrito
    let productosCarrito = carrito.map(item => {
        let producto = tienda.productos.find(p => p.id == item.id);
        if (producto) {
            return { ...producto, cantidad: item.cantidad }; // Añadir la cantidad al producto
        }
        return null;
    }).filter(p => p !== null); // Eliminar productos no encontrados

    let total = productosCarrito.reduce((acc, producto) => acc + producto.precio * producto.cantidad, 0);

    let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Carrito - FrikiShop</title>
    <link rel="stylesheet" href="/css/styles.css">
    <link rel="stylesheet" href="/css/styles_carrito.css">
    <link rel="icon" href="img/favicon.ico" type="image/x-icon">
    <script defer src="js/script.js"></script>
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
                ? `<span class="usuario">👤 ${nombre}</span> <a href="/logout">Log-Out</a>`
                : `<a href="/login">Log-In</a>`}
            <a href="/carrito">🛒 Carrito</a>
        </div>
    </header>

    <main class="carrito-container">
        <section class="productos-carrito">
            <h1>Tu Carrito</h1>
            <div class="productos-grid">
                ${productosCarrito.map(p => `
                    <div class="producto-carrito">
                        <div class="producto-imagen">
                            <img src="/img/${p.imagen[0]}" alt="${p.nombre}">
                        </div>
                        <div class="producto-detalles">
                            <h2>${p.nombre}</h2>
                            <p>Cantidad: ${p.cantidad}</p>
                            <p>Precio: ${p.precio.toFixed(2)} €</p>
                            <p>Subtotal: ${(p.precio * p.cantidad).toFixed(2)} €</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>

        <aside class="resumen-carrito">
            <div class="total">
                <h2>Total: ${total.toFixed(2)} €</h2>
                <form action="/finalizar-pedido" method="GET">
                    <button type="submit" class="btn-comprar">Realizar Pedido</button>
                </form>
            </div>
        </aside>
    </main>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(contenido);
}

function agregarAlCarrito(req, res, idProducto, redirigir = true, cookies = {}) {
    // Inicializar el carrito como un array vacío si no existe
    let usuario;

    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        // Eliminar la cookie inválida
        res.setHeader('Set-Cookie', 'usuario=; Max-Age=0; Path=/; HttpOnly');
        usuario = null;
    }

    if (!usuario) {
        res.writeHead(401, { 'Content-Type': 'text/html' });
        res.end(JSON.stringify({ success: false, message: 'Debes iniciar sesión para agregar productos al carrito.' }));
        return;
    }

    // Inicializar el carrito del usuario si no existe
    usuario.carrito = usuario.carrito || [];

    // Buscar si el producto ya está en el carrito
    let productoEnCarrito = usuario.carrito.find(p => p.id === idProducto);
    if (productoEnCarrito) {
        productoEnCarrito.cantidad += 1;
    } else {
        usuario.carrito.push({ id: idProducto, cantidad: 1 });
    }

    // Actualizar la cookie del carrito
    res.setHeader('Set-Cookie', `usuario=${encodeURIComponent(JSON.stringify(usuario))}; Path=/; HttpOnly`);

    // Redirigir o responder según el parámetro
    if (redirigir) {
        res.writeHead(302, { 'Location': '/carrito' });
        res.end();
    } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Producto añadido al carrito' }));
    }
}

function mostrarFormularioPedido(res, cookies = {}) {
    let usuario;

    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        usuario = null;
    }

    if (!usuario) {
        res.writeHead(401, { 'Content-Type': 'text/html' });
        res.end('<h2>Debes iniciar sesión para finalizar tu pedido. <a href="/login">Inicia sesión aquí</a></h2>');
        return;
    }

    let carrito = usuario.carrito || [];
    if (carrito.length === 0) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h2>Tu carrito está vacío. <a href="/">Volver a la tienda</a></h2>');
        return;
    }

    let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

    // Buscar los detalles de los productos en la base de datos
    let productosCarrito = carrito.map(item => {
        let producto = tienda.productos.find(p => p.id == item.id);
        if (producto) {
            return { ...producto, cantidad: item.cantidad };
        }
        return null;
    }).filter(p => p !== null);

    let total = productosCarrito.reduce((acc, producto) => acc + producto.precio * producto.cantidad, 0);

    let nombre =  usuario.nombre;
    let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Finalizar Pedido - FrikiShop</title>
    <link rel="stylesheet" href="/css/styles.css">
    <link rel="stylesheet" href="/css/finalizar_pedido.css">
    <link rel="icon" href="img/favicon.ico" type="image/x-icon">
    <script defer src="js/script.js"></script>
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
            ? `<span class="usuario">👤 ${nombre}</span> <a href="/logout">Log-Out</a>`
            : `<a href="/login">Log-In</a>`}
            <a href="/carrito">🛒 Carrito</a>
        </div>
    </header>

    <main>
        <form action="/finalizar-pedido" method="POST" class="auth-form">
            <h2>Finalizar Pedido</h2>
            <section class="productos-pedido">
                ${productosCarrito.map(producto => `
                    <div class="producto-pedido">
                        <div class="producto-izquierda">
                            <img src="/img/${producto.imagen[0]}" alt="${producto.nombre}">
                            <h3>${producto.nombre}</h3>
                        </div>
                        <div class="producto-derecha">
                            <p>Cantidad: ${producto.cantidad}</p>
                            <p>Precio: ${producto.precio} €</p>
                            <p>Subtotal: ${(producto.precio * producto.cantidad).toFixed(2)} €</p>
                        </div>
                    </div>
                `).join('')}
                <h3>Total: ${total.toFixed(2)} €</h3>
            </section>
            <label for="direccion">Dirección de envío:</label>
            <input type="text" id="direccion" name="direccion" required>
                
            <label for="tarjeta">Número de tarjeta:</label>
            <input type="text" id="tarjeta" name="tarjeta" required>
                
            <button type="submit">Confirmar Pedido</button>
        </form>
    </main>
</body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(contenido);
}

function procesarPedido(req, res, cookies = {}) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        let { direccion, tarjeta } = querystring.parse(body);
        let usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;

        if (!usuario) {
            res.writeHead(401, { 'Content-Type': 'text/html' });
            res.end('<h2>Debes iniciar sesión para finalizar tu pedido. <a href="/login">Inicia sesión aquí</a></h2>');
            return;
        }

        let carrito = usuario.carrito || [];
        if (carrito.length === 0) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h2>Tu carrito está vacío. <a href="/">Volver a la tienda</a></h2>');
            return;
        }

        let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

        // Calcular el total del pedido y simplificar los datos de los productos
        let total = 0;
        let productosSimplificados = carrito.map(item => {
            let producto = tienda.productos.find(p => p.id == item.id);
            if (producto) {
                let subtotal = producto.precio * item.cantidad;
                total += subtotal;
                return {
                    nombre: producto.nombre,
                    precio: producto.precio,
                    cantidad: item.cantidad
                };
            }
            return null;
        }).filter(p => p !== null);

        // Crear el objeto del pedido
        let pedido = {
            nombre: usuario.nombre,
            direccion,
            tarjeta: tarjeta.replace(/\d(?=\d{4})/g, '*'), // Enmascarar el número de tarjeta
            total,
            productos: productosSimplificados,
            fecha: new Date().toISOString()
        };

        // Guardar el pedido en la base de datos
        tienda.pedidos = tienda.pedidos || [];
        tienda.pedidos.push(pedido);
        fs.writeFileSync(RUTAS.db, JSON.stringify(tienda, null, 2));

        // Limpiar el carrito del usuario
        usuario.carrito = [];
        res.setHeader('Set-Cookie', `usuario=${encodeURIComponent(JSON.stringify(usuario))}; Path=/; HttpOnly`);
        console.log('Carrito del usuario eliminado.');

        // Confirmar el pedido al usuario
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h2>Pedido realizado con éxito. ¡Gracias por tu compra! <a href="/">Volver a la tienda</a></h2>`);
    });
}

server.listen(8001, () => {
    console.log('Servidor corriendo en http://localhost:8001');
});
