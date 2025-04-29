const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');
const validator = require('validator');
const formidable = require('formidable');

//-- Rutas
const PUBLIC_DIR = path.join(__dirname, 'public');
const RUTAS = {
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
    let cookies = parseCookies(req);
    let url = req.url;

    // Verificar si el usuario es root
    let usuario;
    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        usuario = null;
    }

    if (usuario && usuario.nombre === 'root') {
        // Redirigir automáticamente a la página especial del root
        if (!url.startsWith('/admin') && !url.startsWith('/css') && !url.startsWith('/img') && url !== '/logout') {
            res.writeHead(302, { 'Location': '/admin' });
            res.end();
            return;
        }
    }

    switch (true) {
        //-- Página principal de la tienda
        case url === '/' || url === '/index.html':
            generarPaginaPrincipal(res, cookies);
            break;
        
        //-- Página de producto
        case url.startsWith('/producto/'):
            let idProducto = url.split('/').pop();
            generarPaginaProducto(res, idProducto, cookies);
            break;

        //-- Página de ofertas 
        case url === '/ofertas':
            generarPaginaFiltrada(res, 'Oferta', 'Si', cookies);
            break;

        //-- Página de novedades
        case url === '/novedades':
            generarPaginaFiltrada(res, 'Novedad', 'Si', cookies);
            break;

        //-- Página de Login
        case url === '/login':
            if (req.method === 'POST') handleLogin(req, res);
            else mostrarLogin(res);
            break;

        //-- Página de registro
        case url === '/register':
            if (req.method === 'POST') handleRegister(req, res);
            else mostrarRegistro(res);
            break;

        //-- Realizar Logout
        case url === '/logout':
            handleLogout(res, cookies);
            break;

        //-- Página de carrito 
        case url === '/carrito':
            generarPaginaCarrito(res, cookies);
            break;

        //-- Modificar carrito
        case url.startsWith('/modificar-carrito/') && req.method === 'POST':
            let [_, __, idProductoModificar, accion] = url.split('/');
            modificarCarrito(req, res, idProductoModificar, accion, cookies);
            break;

        //-- Agregar producto al carrito
        case url.startsWith('/agregar/') && req.method === 'POST':
            let idProductoAgregar = url.split('/').pop();
            agregarAlCarrito(req, res, idProductoAgregar, false, cookies);  //No redirigir a la página de carrito
            break;

        //-- Mostrar formulario de pedido o procesar pedido
        case url === '/finalizar-pedido' || url === '/finalizar-pedido?':
            if (req.method === 'POST') {
                procesarPedido(req, res, cookies);
            } else if (req.method === 'GET') {
                mostrarFormularioPedido(res, cookies, {});
            }
            break;
        
        //-- Resultados de búsqueda (lista autocompletada o página de resultados)
        case url.startsWith('/buscar-autocompletado'):
            const queryAuto = new URLSearchParams(url.split('?')[1]);
            const terminoAuto = queryAuto.get('termino');

            if (req.method === 'GET' && terminoAuto) {
                buscarProductos(res, terminoAuto); // Devuelve JSON para autocompletado
            } else {
                res.writeHead(400, { 'Content-Type': 'text/plain' }); res.end('Solicitud inválida');
            }
            break;

        //-- Página de resultados de búsqueda
        case url.startsWith('/buscar'):
            const queryBuscar = new URLSearchParams(url.split('?')[1]);
            const terminoBuscar = queryBuscar.get('termino');

            if (req.method === 'GET' && terminoBuscar) {
                generarPaginaResultados(res, terminoBuscar, cookies); // Genera la página de resultados
            } else {
                res.writeHead(400, { 'Content-Type': 'text/plain' }); res.end('Solicitud inválida');
            }
            break;

        //-- Página de administración
        case url === '/admin':
            if (!verificarRoot(cookies)) {
                error(res, 'Acceso denegado. Solo el administrador puede acceder a esta página.', cookies);
                break;
            }
            mostrarPaginaRoot(res);
            break;

        //-- Página de lista de pedidos
        case url === '/admin/pedidos':
            if (!verificarRoot(cookies)) {
                error(res, 'Acceso denegado. Solo el administrador puede acceder a esta página.', cookies);
                break;
            }
            mostrarPedidosPendientes(res);
            break;

        //-- Página del formulario para agregar un nuevo producto
        case url === '/admin/nuevo-producto' && req.method === 'GET':
            if (!verificarRoot(cookies)) {
                error(res, 'Acceso denegado. Solo el administrador puede acceder a esta página.', cookies);
                break;
            }
            mostrarFormularioNuevoProducto(res);
            break;

        //-- Procesar el formulario para agregar un nuevo producto
        case url === '/admin/nuevo-producto' && req.method === 'POST':
            if (!verificarRoot(cookies)) {
                error(res, 'Acceso denegado. Solo el administrador puede acceder a esta página.', cookies);
                break;
            }
            procesarNuevoProducto(req, res);
            break;

        //-- Página de modificación de productos
        case url === '/admin/modificar-productos':
            if (!verificarRoot(cookies)) {
                error(res, 'Acceso denegado. Solo el administrador puede acceder a esta página.', cookies);
                break;
            }
            mostrarPaginaModificarProductos(res);
            break;

        //-- Eliminar producto
        case url.startsWith('/admin/eliminar-producto/') && req.method === 'POST':
            if (!verificarRoot(cookies)) {
                error(res, 'Acceso denegado. Solo el administrador puede acceder a esta página.', cookies);
                break;
            }
            const idEliminar = url.split('/').pop();
            eliminarProducto(req, res, idEliminar);
            break;

        //-- Mostrar formulario de edición de producto
        case url.startsWith('/admin/editar-producto/') && req.method === 'GET':
            if (!verificarRoot(cookies)) {
                error(res, 'Acceso denegado. Solo el administrador puede acceder a esta página.', cookies);
                break;
            }
            const idEditar = url.split('/').pop();
            mostrarFormularioEditarProducto(res, idEditar);
            break;

        //-- Procesar formulario de edición de producto
        case url.startsWith('/admin/editar-producto/') && req.method === 'POST':
            if (!verificarRoot(cookies)) {
                error(res, 'Acceso denegado. Solo el administrador puede acceder a esta página.', cookies);
                break;
            }
            const idGuardar = url.split('/').pop();
            guardarCambiosProducto(req, res, idGuardar);
            break;

        default:
            servirArchivoEstatico(req, res, cookies);
    }
});

//-- Parsear Cookies: Convierte las cookies de la cabecera en un objeto clave-valor.
function parseCookies(req) {
    let list = {};
    let cookieHeader = req.headers.cookie;  // Obtener la cabecera de cookies de la solicitud.

    // Verificar si la cabecera de cookies existe.
    if (cookieHeader) {
        // Dividir las cookies en pares clave-valor separados por ';'.
        cookieHeader.split(';').forEach(cookie => {
            // Dividir cada cookie en nombre y valor.
            let [name, ...rest] = cookie.split('=');
            name = name.trim();     // Eliminar espacios en blanco del nombre.
            let value = rest.join('=').trim();  // Reconstruir y limpiar el valor.

            // Si el valor no está vacío, intentar decodificarlo y almacenarlo.
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

//-- Servir Archivos Estáticos
function servirArchivoEstatico(req, res, cookie = {}) {
    let filePath = path.join(PUBLIC_DIR, req.url);
    let ext = path.extname(filePath);   // Obtener la extensión del archivo solicitado.
    let contentType = mimeTypes[ext] || 'application/octet-stream';

    // Leer el archivo solicitado desde el sistema de archivos.
    fs.readFile(filePath, (err, data) => {
        if (err) {
            // Si ocurre un error (por ejemplo, el archivo no existe), mostrar un error 404.
            error(res, 'Error 404 - Página no encontrada', cookie);
        } else {
            // Si el archivo se encuentra, enviar una respuesta con el contenido del archivo.
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////// -- Funciones para Generar Páginas de Productos -- ////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//-- Generar Página Principal
function generarPaginaPrincipal(res, cookies = {}) {
    let usuario;

    // Intentar obtener y parsear la cookie del usuario.
    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        usuario = null;
    }

    // Obtener el nombre del usuario si está autenticado.
    let nombre = usuario ? usuario.nombre : null;

    // Leer la base de datos de productos desde el archivo JSON.
    let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

    // Generar el contenido HTML de la página principal.
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
            <input type="text" id="buscador" placeholder="Buscar productos...">
            <button onclick="realizarBusqueda()">🔍</button>
            <div id="sugerencias" class="sugerencias"></div>
        </div>
        <div class="acciones">
            <a href="#">Inicio</a>
            ${usuario
            ? `<span class="usuario">👤 ${nombre}</span> <a href="/logout">Log-Out</a>`
            : `<a href="/login">Log-In</a>`}
            <a href="/carrito">🛒 Carrito</a>
        </div>
    </header>
    
    <nav class="barra-navegacion">
        <a href="/ofertas">🔥 Ofertas</a>
        <a href="/novedades">🆕 Últimas novedades</a>
    </nav>
    
    <main>
        <section class="productos">`;

    // Iterar sobre los productos y generar el HTML para cada uno.
    tienda.productos.forEach(producto => {
        contenido += `
            <div class="producto">
                <a href="/producto/${producto.id}"><img src="img/${producto.imagen[0]}" alt="${producto.nombre}"></a>
                <h2>${producto.nombre}</h2>
                <p>${producto.miniDescripcion}</p>
                <a href="/producto/${producto.id}" class="btn-ver-mas">Ver más</a>
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

    // Intentar obtener y parsear la cookie del usuario.
    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        usuario = null;
    }

    // Obtener el nombre del usuario si está autenticado.
    let nombre = usuario ? usuario.nombre : null;

    // Leer la base de datos de productos desde el archivo JSON.
    let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

    // Buscar el producto por ID.
    let producto = tienda.productos.find(p => p.id == id);
    if (!producto) {
        productoNoEncontrado(res); // Si no se encuentra el producto, mostrar error.
        return;
    }

    // Construir el contenido HTML de la página del producto.
    let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${producto.nombre}</title>
    <link rel="stylesheet" href="/css/styles.css">
    <link rel="stylesheet" href="/css/styles_products.css">
    <link rel="icon" href="img/favicon.ico" type="image/x-icon">
    <script defer src="/js/script.js"></script>
</head>
<body>
    <header class="barra-superior">
        <div class="logo">
            <img src="/img/logo.png" alt="Logo de FrikiShop">
            <h1>FrikiShop</h1>
        </div>
        <div class="buscador">
            <input type="text" id="buscador" placeholder="Buscar productos...">
            <button>🔍</button>
            <div id="sugerencias" class="sugerencias"></div>
        </div>
        <div class="acciones">
            <a href="/">Inicio</a>
             ${usuario
            ? `<span class="usuario">👤 ${nombre}</span> <a href="/logout">Log-Out</a>`
            : `<a href="/login">Log-In</a>`}
            <a href="/carrito">🛒 Carrito</a>
        </div>
    </header>
    <nav class="barra-navegacion">
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
            ${producto.description[1] ? `<p><strong>Tamaño:</strong> ${producto.description[1]}</p>` : ''}
            <p><span>Stock disponible:</span> ${producto.stock}</p>
            <h3><span class="precio">${producto.precio} €</span></h3>
            ${producto.stock > 0
            ? `<button class="btn-comprar" onclick="añadirAlCarrito('${producto.id}')">Agregar al carrito</button>`
            : `<button class="btn-comprar sin-stock" disabled>Sin stock</button>`}
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

    // Intentar obtener y parsear la cookie del usuario.
    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        usuario = null;
    }

    // Obtener el nombre del usuario si está autenticado.
    let nombre = usuario ? usuario.nombre : null;

    // Leer la base de datos de productos desde el archivo JSON.
    let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

    // Filtrar los productos según el criterio y valor proporcionados.
    let productosFiltrados = tienda.productos.filter(p => p[criterio] === valor);

    // Construir el contenido HTML de la página.
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
            <input type="text" id="buscador" placeholder="Buscar productos...">
            <button>🔍</button>
            <div id="sugerencias" class="sugerencias"></div>
        </div>
        <div class="acciones">
            <a href="/">Inicio</a>
            ${usuario
            ? `<span class="usuario">👤 ${nombre}</span> <a href="/logout">Log-Out</a>`
            : `<a href="/login">Log-In</a>`}
            <a href="/carrito">🛒 Carrito</a>
        </div>
    </header>

    <nav class="barra-navegacion">
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
                    <a href="/producto/${producto.id}" class="btn-ver-mas">Ver más</a>
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

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////// -- Funciones para Generar Páginas de Error -- ////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//-- Generar Página de Error
function error(res, mensaje = 'Error 404 - Página no encontrada', cookies = {}) {
    let usuario;

    // Intentar obtener y parsear la cookie del usuario.
    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        usuario = null;
    }

    // Obtener el nombre del usuario si está autenticado.
    let nombre = usuario ? usuario.nombre : null;

    // Construir el contenido HTML de la página de error.
    let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tienda Friki</title>
    <link rel="stylesheet" href="/css/styles.css">
    <link rel="stylesheet" href="/css/styles_error.css">
    <link rel="icon" href="img/favicon.ico" type="image/x-icon">
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
            <input type="text" id="buscador" placeholder="Buscar productos...">
            <button>🔍</button>
            <div id="sugerencias" class="sugerencias"></div>
        </div>
        <div class="acciones">
            <a href="/">Inicio</a>
            ${usuario
            ? `<span class="usuario">👤 ${nombre}</span> <a href="/logout">Log-Out</a>`
            : `<a href="/login">Log-In</a>`}
            <a href="/carrito">🛒 Carrito</a>
        </div>
    </header>

    <!-- Segunda barra -->
    <nav class="barra-navegacion">
        <a href="/ofertas">🔥 Ofertas</a>
        <a href="/novedades">🆕 Últimas novedades</a>
    </nav>

    <main>
        <section class="error_404">
            <div class="error-content">
                <img src="img/error_404.png" alt="Error Image">
                <div class="error-text">
                    <h1>${mensaje}</h1>
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
    <link rel="stylesheet" href="/css/styles.css">
    <link rel="stylesheet" href="/css/styles_error.css">
    <link rel="icon" href="img/favicon.ico" type="image/x-icon">
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
            <input type="text" id="buscador" placeholder="Buscar productos...">
            <button>🔍</button>
            <div id="sugerencias" class="sugerencias"></div>
        </div>
        <div class="acciones">
            <a href="/">Inicio</a>
            <a href="/carrito">🛒 Carrito</a>
        </div>
    </header>

    <!-- Segunda barra -->
    <nav class="barra-navegacion">
        <a href="/ofertas">🔥 Ofertas</a>
        <a href="/novedades">🆕 Últimas novedades</a>
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

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////// -- Funciones para Generar Páginas de Login y registro -- ////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//-- Mostrar Formulario de Login
function mostrarLogin(res) {
    let contenido = `
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login - FrikiShop</title>
            <link rel="icon" href="/img/favicon.ico" type="image/x-icon">
            <link rel="stylesheet" href="/css/styles_login_register.css">
        </head>
        <body>
            <div class="container">
                <header>
                    <img src="/img/logo.png" alt="FrikiShop" class="logo">
                    <h1>FrikiShop</h1>
                </header>
                <nav>
                    <a href="index.html">Inicio</a>
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

//-- Manejar Login
function handleLogin(req, res) {
    let body = '';
    // Escuchar los datos enviados en el cuerpo de la solicitud.
    req.on('data', chunk => { body += chunk; });

    // Cuando se hayan recibido todos los datos.
    req.on('end', () => {
        let { nombre, password } = querystring.parse(body);
        let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

        // Buscar al usuario en la base de datos
        let usuario = tienda.usuarios.find(u => u.nombre === nombre && u.password === password);

        if (usuario) {
            // Si el usuario es root, redirigir al panel de administración
            if (usuario.nombre === 'root' && usuario.password === 'admin123') {
                res.setHeader('Set-Cookie', `usuario=${encodeURIComponent(JSON.stringify(usuario))}; Path=/; HttpOnly`);
                res.writeHead(302, { 'Location': '/admin' });
                res.end();
                return;
            }

            // Restaurar el carrito desde la base de datos si existe
            let carritoRestaurado = usuario.carrito || [];

            // Crear un objeto usuario con un carrito vacío
            let usuarioData = {
                nombre: usuario.nombre,
                carrito: carritoRestaurado
            };

            // Eliminar el carrito del usuario en la base de datos
            delete usuario.carrito;
            fs.writeFileSync(RUTAS.db, JSON.stringify(tienda, null, 2));

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
            <link rel="stylesheet" href="/css/styles_login_register.css">
        </head>
        <body>
            <div class="container">
                <header>
                    <img src="/img/logo.png" alt="FrikiShop" class="logo">
                    <h1>FrikiShop</h1>
                </header>
                <nav>
                    <a href="index.html">Inicio</a>
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

//-- Mostrar Formulario de Registro
function mostrarRegistro(res) {
    let contenido = `
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Registro - FrikiShop</title>
            <link rel="icon" href="/img/favicon.ico" type="image/x-icon">
            <link rel="stylesheet" href="/css/styles_login_register.css">
        </head>
        <body>
            <div class="container">
                <header>
                    <img src="/img/logo.png" alt="FrikiShop" class="logo">
                    <h1>FrikiShop</h1>
                </header>
                <nav>
                    <a href="index.html">Inicio</a>
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

//-- Manejar Registro
function handleRegister(req, res) {
    let body = '';

    // Escuchar los datos enviados en el cuerpo de la solicitud.
    req.on('data', chunk => { body += chunk; });

    // Cuando se hayan recibido todos los datos.
    req.on('end', () => {
        // Parsear los datos del formulario enviados en el cuerpo de la solicitud.
        let { nombre, nombreReal, correo, password } = querystring.parse(body);

        // Leer la base de datos de usuarios desde el archivo JSON.
        let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

        // Verificar si el nombre de usuario ya existe en la base de datos.
        if (tienda.usuarios.some(u => u.nombre === nombre)) {
            // Si el nombre de usuario ya existe, generar una página de error.
            let contenido = `
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Registro - FrikiShop</title>
            <link rel="icon" href="/img/favicon.ico" type="image/x-icon">
            <link rel="stylesheet" href="/css/styles_login_register.css">
        </head>
        <body>
            <div class="container">
                <header>
                    <img src="/img/logo.png" alt="FrikiShop" class="logo">
                    <h1>FrikiShop</h1>
                </header>
                <nav>
                    <a href="index.html">Inicio</a>
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

        // Si el nombre de usuario no existe, agregar el nuevo usuario a la base de datos.
        tienda.usuarios.push({ nombre, nombreReal, correo, password });
        fs.writeFileSync(RUTAS.db, JSON.stringify(tienda, null, 2)); // Guardar los cambios en el archivo JSON.

        // Redirigir al usuario a la página de inicio de sesión.
        res.writeHead(302, { 'Location': '/login' });
        res.end();
    });
}

//-- Manejar Logout
function handleLogout(res, cookies = {}) {
    let usuario;

    // Intentar obtener y parsear la cookie del usuario.
    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        usuario = null;
    }

    // Si el usuario está autenticado.
    if (usuario) {
        // Leer la base de datos desde el archivo JSON.
        let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

        // Buscar al usuario en la base de datos
        let usuarioDB = tienda.usuarios.find(u => u.nombre === usuario.nombre);
        if (usuarioDB) {
            // Crear el campo carrito si no existe y guardar el carrito actual
            usuarioDB.carrito = usuario.carrito || [];
            // Guardar los cambios en la base de datos.
            fs.writeFileSync(RUTAS.db, JSON.stringify(tienda, null, 2));
        }
    }

    // Eliminar la cookie del usuario
    res.setHeader('Set-Cookie', 'usuario=; Max-Age=0; Path=/; HttpOnly');

    // Redirigir al usuario a la página principal
    res.writeHead(302, { 'Location': '/' });
    res.end();
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////// -- Funciones para Generar Páginas de Carrito y Compra -- ////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//-- Generar Página del Carrito
function generarPaginaCarrito(res, cookies = {}) {
    let usuario;

    // Intentar obtener y parsear la cookie del usuario.
    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        // Eliminar la cookie inválida
        res.setHeader('Set-Cookie', 'usuario=; Max-Age=0; Path=/; HttpOnly');
        usuario = null;
    }

    // Si el usuario no está autenticado, generar página de carrito vacía con mensaje de error.
    if (!usuario) {
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
                    <input type="text" id="buscador" placeholder="Buscar productos...">
                    <button>🔍</button>
                    <div id="sugerencias" class="sugerencias"></div>
                </div>
                <div class="acciones">
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

    // Si el usuario está autenticado, continuar con la generación de la página del carrito.
    let carrito = usuario.carrito || [];
    let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

    let nombre = usuario.nombre;
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
                <input type="text" id="buscador" placeholder="Buscar productos...">
                <button>🔍</button>
                <div id="sugerencias" class="sugerencias"></div>
            </div>
            <div class="acciones">
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

    // Calcular el total del carrito
    let total = productosCarrito.reduce((acc, producto) => acc + producto.precio * producto.cantidad, 0);

    // Generar el contenido HTML de la página del carrito
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
            <input type="text" id="buscador" placeholder="Buscar productos...">
            <button>🔍</button>
            <div id="sugerencias" class="sugerencias"></div>
        </div>
        <div class="acciones">
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
                            <div class="acciones-producto">
                                <button onclick="modificarCantidad('${p.id}', 'aumentar')">➕</button>
                                <button onclick="modificarCantidad('${p.id}', 'disminuir')">➖</button>
                                <button onclick="modificarCantidad('${p.id}', 'eliminar')">❌</button>
                            </div>
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
        <script>
        async function modificarCantidad(idProducto, accion) {
            try {
                const response = await fetch('/modificar-carrito/' + idProducto + '/' + accion, { method: 'POST' });
                if (response.ok) {
                    location.reload(); // Recargar la página para reflejar los cambios
                } else {
                    alert('Error al modificar el carrito');
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
    </script>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(contenido);
}

//-- Manejar Agregaciones al Carrito
function agregarAlCarrito(req, res, idProducto, redirigir = true, cookies = {}) {
    // Inicializar el carrito como un array vacío si no existe
    let usuario;

    // Intentar obtener y parsear la cookie del usuario.
    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        // Eliminar la cookie inválida
        res.setHeader('Set-Cookie', 'usuario=; Max-Age=0; Path=/; HttpOnly');
        usuario = null;
    }

    // Si el usuario no está autenticado, mensaje de error
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

//-- Manejar Modificaciones del Carrito
function modificarCarrito(req, res, idProducto, accion, cookies = {}) {
    let usuario;

    // Intentar obtener y parsear la cookie del usuario.
    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        res.setHeader('Set-Cookie', 'usuario=; Max-Age=0; Path=/; HttpOnly');
        usuario = null;
    }

    // Si el usuario no está autenticado, mensaje de error
    if (!usuario) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Debes iniciar sesión para modificar el carrito.' }));
        return;
    }

    let carrito = usuario.carrito || [];
    let productoEnCarrito = carrito.find(p => p.id === idProducto);

    // Si el producto no está en el carrito, mensaje de error
    if (!productoEnCarrito) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Producto no encontrado en el carrito.' }));
        return;
    }

    // Modificar la cantidad del producto según la acción
    switch (accion) {
        case 'aumentar':
            productoEnCarrito.cantidad += 1;
            break;
        case 'disminuir':
            productoEnCarrito.cantidad -= 1;
            if (productoEnCarrito.cantidad <= 0) {
                carrito = carrito.filter(p => p.id !== idProducto); // Eliminar si la cantidad es 0
            }
            break;
        case 'eliminar':
            carrito = carrito.filter(p => p.id !== idProducto); // Eliminar el producto
            break;
        default:
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Acción no válida.' }));
            return;
    }

    // Actualizar el carrito del usuario
    usuario.carrito = carrito;
    res.setHeader('Set-Cookie', `usuario=${encodeURIComponent(JSON.stringify(usuario))}; Path=/; HttpOnly`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Carrito actualizado.' }));
}

//-- Mostrar Formulario de Pedido
function mostrarFormularioPedido(res, cookies = {}, errores = {}) {
    let usuario;

    // Intentar obtener y parsear la cookie del usuario.
    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        usuario = null;
    }

    // Si el usuario no está autenticado, mensaje de error
    if (!usuario) {
        error(res, 'Error 401 - Debes iniciar sesión para realizar tu pedido.', cookies);
        return;
    }

    // Si el usuario está autenticado, continuar con la generación del formulario de pedido
    // Verificar si el carrito está vacío
    let carrito = usuario.carrito || [];
    if (carrito.length === 0) {
        error(res, 'Tu carrito está vacío. ¡Añade productos para realizar tu pedido!', cookies);
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

    // Calcular el total del carrito
    let total = productosCarrito.reduce((acc, producto) => acc + producto.precio * producto.cantidad, 0);

    // Generar el contenido HTML del formulario de pedido
    let nombre = usuario.nombre;
    let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Finalizar Pedido - FrikiShop</title>
    <link rel="stylesheet" href="/css/styles.css">
    <link rel="stylesheet" href="/css/styles_finalizar_pedido.css">
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
            <input type="text" id="buscador" placeholder="Buscar productos...">
            <button>🔍</button>
            <div id="sugerencias" class="sugerencias"></div>
        </div>
        <div class="acciones">
            <a href="/">Inicio</a>
            ${usuario
            ? `<span class="usuario">👤 ${nombre}</span> <a href="/logout">Log-Out</a>`
            : `<a href="/login">Log-In</a>`}
            <a href="/carrito">🛒 Carrito</a>
        </div>
    </header>

    <main>
        <form action="/finalizar-pedido" method="POST" class="auth-form" onsubmit="return validarFormulario()">
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
            <input type="text" id="direccion" name="direccion" required 
                title="Introduce una dirección válida (mínimo 10 caracteres)."
                placeholder="Introduce tu dirección. Ejemplo: Calle Falsa 123, Ciudad, País">
                ${errores.direccion ? `<p class="error">${errores.direccion}</p>` : ''}
            
            <label for="tarjeta">Número de tarjeta:</label>
            <input type="text" id="tarjeta" name="tarjeta" required 
                pattern="^\\d{16}$" 
                title="Introduce un número de tarjeta válido de 16 dígitos."
                placeholder="Introduce el número de tarjeta (16 dígitos). Ejemplo: 1234567812345678"
                maxlength="16">
                ${errores.tarjeta ? `<p class="error">${errores.tarjeta}</p>` : ''}
            
            <label for="cvv">CVV:</label>
            <input type="text" id="cvv" name="cvv" required 
                pattern="^\\d{3}$" 
                title="Introduce un CVV válido de 3 dígitos."
                placeholder="Introduce el CVV de tu tarjeta. Ejemplo: 123"
                maxlength="3">
                ${errores.cvv ? `<p class="error">${errores.cvv}</p>` : ''}
            
            <label for="fecha-expiracion">Fecha de expiración:</label>
            <input type="month" id="fecha-expiracion" name="fechaExpiracion" required
                placeholder="MM/AAAA">
            ${errores.fechaExpiracion ? `<p class="error">${errores.fechaExpiracion}</p>` : ''}

            ${errores.global ? `<p class="error global">${errores.global}</p>` : ''}
    
        
            <button type="submit">Confirmar Pedido</button>
        </form>
    </main>
</body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(contenido);
}

//-- Manejar Pedido
function procesarPedido(req, res, cookies = {}) {
    let body = '';
    // Escuchar los datos enviados en el cuerpo de la solicitud.
    req.on('data', chunk => { body += chunk; });

    // Cuando se hayan recibido todos los datos.
    req.on('end', () => {
        let { direccion, tarjeta, cvv, fechaExpiracion } = querystring.parse(body);
        let usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;

        // Intentar obtener y parsear la cookie del usuario.
        if (!usuario) {
            error(res, 'Error 401 - Debes iniciar sesión para realizar tu pedido.', cookies);
            return;
        }

        let errores = {};

        // Validar dirección
        if (!direccion || direccion.length < 10 || direccion.length > 100) {
            errores.direccion = 'La dirección debe tener entre 10 y 100 caracteres.';
        }

        // Validar número de tarjeta
        if (!tarjeta || tarjeta.length < 16 || !validator.isNumeric(tarjeta)) {
            errores.tarjeta = 'El número de tarjeta debe tener exactamente 16 dígitos.';
        }

        // Validar CVV (3 dígitos)
        if (!cvv || cvv.length < 3 || !validator.isNumeric(cvv)) {
            errores.cvv = 'El CVV debe tener exactamente 3 dígitos.';
        }

        // Validar fecha de expiración
        if (!fechaExpiracion) {
            errores.fechaExpiracion = 'La fecha de expiración es obligatoria.';
        } else {
            const [anio, mes] = fechaExpiracion.split('-');
            const fechaIngresada = new Date(anio, mes - 1); // Meses en JavaScript van de 0 a 11
            const fechaActual = new Date();

            if (fechaIngresada < fechaActual) {
                errores.fechaExpiracion = 'La fecha de expiración debe ser posterior a la fecha actual.';
            }
        }

        // Si hay errores, renderizar el formulario con los mensajes de error
        if (Object.keys(errores).length > 0) {
            return mostrarFormularioPedido(res, cookies, errores);
        }

        // Validar que el carrito no esté vacío
        let carrito = usuario.carrito || [];
        if (carrito.length === 0) {
            error(res, 'Tu carrito está vacío. ¡Añade productos para realizar tu pedido!', cookies);
            return;
        }

        let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

        // Calcular el total del pedido y simplificar los datos de los productos
        let total = 0;
        let productosSimplificados = [];
        // Verificar el stock de cada producto
        for (let item of carrito) {
            let producto = tienda.productos.find(p => p.id == item.id);
            if (producto) {
                if (producto.stock < item.cantidad) {
                    error(res, `No hay suficiente stock para el producto: ${producto.nombre}`, cookies);
                    return; // Detener el flujo inmediatamente
                }
                let subtotal = producto.precio * item.cantidad;
                producto.stock -= item.cantidad; // Decrementar el stock
                total += subtotal;
                productosSimplificados.push({
                    id: producto.id,
                    nombre: producto.nombre,
                    cantidad: item.cantidad,
                    precio: producto.precio
                });
            }
        }

        // Si no hay productos simplificados, mostrar error
        if (productosSimplificados.length === 0) {
            error(res, 'No se pudo procesar el pedido debido a problemas con el stock.', cookies);
            return;
        }

        // Guardar los cambios en la base de datos
        fs.writeFileSync(RUTAS.db, JSON.stringify(tienda, null, 2));

        // Crear el objeto del pedido
        let pedido = {
            nombre: usuario.nombre,
            direccion,
            tarjeta: {
                numero: tarjeta.replace(/\d(?=\d{4})/g, '*'), // Enmascarar el número de tarjeta
                cvv: cvv, // Guardar el CVV
                fechaExpiracion: fechaExpiracion // Guardar la fecha de expiración
            },
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

        // Contenido de la página
        let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pedido Confirmado - FrikiShop</title>
    <link rel="stylesheet" href="/css/styles.css">
    <link rel="stylesheet" href="/css/styless_pedido_confirmado.css">
    <link rel="icon" href="/img/favicon.ico" type="image/x-icon">
</head>
<body>
    <header class="barra-superior">
        <div class="logo">
            <img src="/img/logo.png" alt="Logo de FrikiShop">
            <h1>FrikiShop</h1>
        </div>
        <div class="acciones">
            <a href="/">Inicio</a>
            ${usuario
            ? `<span class="usuario">👤 ${usuario.nombre}</span> <a href="/logout">Log-Out</a>`
            : `<a href="/login">Log-In</a>`}
            <a href="/carrito">🛒 Carrito</a>
        </div>
    </header>

    <main class="pedido-confirmado">
        <div class="pedido-contenido">
            <img src="/img/confirmacion_compra.png" alt="Pedido realizado con éxito" class="pedido-imagen">
            <h1>Pedido realizado con éxito</h1>
            <p>¡Gracias por tu compra!</p>
            <a href="/" class="btn-volver">Volver a la tienda</a>
        </div>
    </main>
</body>
</html>`;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(contenido);
    });
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// -- Funciones para la Lógica del Buscador -- /////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//-- Función para manejar la búsqueda de productos
function buscarProductos(res, termino) {
    let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

    // Filtrar los productos que coinciden con el término de búsqueda
    const productos = tienda.productos.filter(producto =>
        producto.nombre.toLowerCase().includes(termino.toLowerCase())
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(productos));
}

//-- Función para generar la página de resultados de búsqueda
function generarPaginaResultados(res, termino, cookies = {}) {
    let usuario;

    // Intentar obtener y parsear la cookie del usuario.
    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        usuario = null;
    }

    let nombre = usuario ? usuario.nombre : null;

    let tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));
    // Filtrar los productos que coinciden con el término de búsqueda
    const productosFiltrados = tienda.productos.filter(producto =>
        producto.nombre.toLowerCase().includes(termino.toLowerCase())
    );

    // Si no hay productos, redirigir a la página de error
    if (productosFiltrados.length === 0) {
        // Si no hay productos, redirigir a la página de error
        productoNoEncontrado(res);
        return;
    }

    // Generar el contenido HTML de la página de resultados
    let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resultados de búsqueda</title>
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
            <input type="text" id="buscador" placeholder="Buscar productos...">
            <button>🔍</button>
            <div id="sugerencias" class="sugerencias"></div>
        </div>
        <div class="acciones">
            <a href="/">Inicio</a>
            ${usuario
            ? `<span class="usuario">👤 ${nombre}</span> <a href="/logout">Log-Out</a>`
            : `<a href="/login">Log-In</a>`}
            <a href="/carrito">🛒 Carrito</a>
        </div>
    </header>

    <nav class="barra-navegacion">
        <a href="/ofertas">🔥 Ofertas</a>
        <a href="/novedades">🆕 Últimas novedades</a>
    </nav>

    <main>
        <section class="resultados-busqueda">
            <h1 class="titulo-pagina">Resultados para: <span class="termino-busqueda">"${termino}"</span></h1>
            <section class="productos">
                ${productosFiltrados.map(producto => `
                    <div class="producto">
                        <a href="/producto/${producto.id}"><img src="/img/${producto.imagen[0]}" alt="${producto.nombre}"></a>
                        <h2>${producto.nombre}</h2>
                        <p>${producto.miniDescripcion}</p>
                        <a href="/producto/${producto.id}" class="btn-ver-mas">Ver más</a>
                    </div>
                `).join('')}
            </section>
        </section>
    </main>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(contenido);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// -- Funciones para la parte Administrativa -- ////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//-- Función para verificar si el usuario es root
function verificarRoot(cookies) {
    let usuario;

    // Intentar obtener y parsear la cookie del usuario.
    try {
        usuario = cookies.usuario ? JSON.parse(cookies.usuario) : null;
    } catch (e) {
        console.error('Error al parsear la cookie usuario:', e);
        usuario = null;
    }
    return usuario && usuario.nombre === 'root';
}

//-- Función para mostrar la página especial del root
function mostrarPaginaRoot(res) {
    let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel de Administración - FrikiShop</title>
    <link rel="stylesheet" href="/css/styles.css">
    <link rel="stylesheet" href="/css/styles_root.css">
    <link rel="icon" href="img/favicon.ico" type="image/x-icon">
</head>
<body>
    <header>
        <h1>Panel de Administración</h1>
        <a href="/logout" class="btn-logout">Cerrar Sesión</a>
    </header>
    <main>
        <div class="admin-panel">
            <button onclick="location.href='/admin/pedidos'">Ver Pedidos Pendientes</button>
            <button onclick="location.href='/admin/nuevo-producto'">Añadir Nuevo Producto</button>
            <button onclick="location.href='/admin/modificar-productos'">Modificar Productos</button>
        </div>
    </main>
</body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(contenido);
}

//-- Función para mostrar los pedidos pendientes
function mostrarPedidosPendientes(res) {
    const tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));
    const pedidos = tienda.pedidos;

    let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pedidos Pendientes</title>
    <link rel="stylesheet" href="/css/styles.css">
    <link rel="stylesheet" href="/css/styles_lista_pedidos.css">
    <link rel="icon" href="img/favicon.ico" type="image/x-icon">
</head>
<body>
    <header>
        <a href="/admin" class="btn-volver">Home</a>
        <h1>Pedidos Pendientes</h1>
        <a href="/logout" class="btn-logout">Cerrar Sesión</a>
    </header>
    <main>
        <table>
            <thead>
                <tr>
                    <th>Nombre</th>
                    <th>Dirección</th>
                    <th>Productos</th>
                    <th>Total</th>
                    <th>Fecha</th>
                </tr>
            </thead>
            <tbody>
                ${pedidos.map(pedido => `
                    <tr>
                        <td>${pedido.nombre}</td>
                        <td>${pedido.direccion}</td>
                        <td>
                            <ul>
                                ${pedido.productos.map(producto => `
                                    <li>${producto.nombre} - Cantidad: ${producto.cantidad}</li>
                                `).join('')}
                            </ul>
                        </td>
                        <td>${pedido.total} €</td>
                        <td>${pedido.fecha}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </main>
</body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(contenido);
}

//-- Función para mostrar el formulario de nuevo producto
function mostrarFormularioNuevoProducto(res) {
    let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Añadir Nuevo Producto</title>
    <link rel="stylesheet" href="/css/styles.css">
    <link rel="stylesheet" href="/css/styles_new_product.css">
    <link rel="icon" href="img/favicon.ico" type="image/x-icon">
</head>
<body>
    <header>
        <a href="/admin" class="btn-volver">Home</a>
        <h1>Añadir Nuevo Producto</h1>
        <a href="/logout" class="btn-logout">Cerrar Sesión</a>
    </header>
    <main>
        <form action="/admin/nuevo-producto" method="POST" enctype="multipart/form-data">
            <label for="nombre">Nombre:</label>
            <input type="text" id="nombre" name="nombre" required>
            
            <label for="miniDescripcion">Mini Descripción:</label>
            <input type="text" id="miniDescripcion" name="miniDescripcion" required>
            
            <label for="oferta">Oferta (Si/No):</label>
            <input type="text" id="oferta" name="oferta" required>
            
            <label for="novedad">Novedad (Si/No):</label>
            <input type="text" id="novedad" name="novedad" required>
            
            <label for="description">Descripción:</label>
            <textarea id="description" name="description" required></textarea>

            <label for="size">Tamaño:</label>
            <input type="text" id="size" name="size" placeholder="Ejemplo: 10l. x 10an. x 15al. cm">

            <label for="precio">Precio:</label>
            <input type="number" id="precio" name="precio" step="0.01" required>
            
            <label for="stock">Stock:</label>
            <input type="number" id="stock" name="stock" required>
            
            <label for="imagen">Imágenes:</label>
            <input type="file" id="imagen" name="imagen" multiple required>
            
            <button type="submit">Añadir Producto</button>
        </form>
    </main>
</body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(contenido);
}

//-- Función para procesar el nuevo producto
function procesarNuevoProducto(req, res) {
    const form = new formidable.IncomingForm();
    form.multiples = true;
    form.uploadDir = path.join(PUBLIC_DIR, 'img'); // Carpeta donde se guardarán las imágenes
    form.keepExtensions = true; // Mantener las extensiones de los archivos

    // Parsear el formulario
    form.parse(req, (err, fields, files) => {
        if (err) {
            console.error('Error al procesar el formulario:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error al procesar el formulario');
            return;
        }

        const tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

        // Generar un nuevo ID
        const nuevoId = tienda.productos.length > 0 ? tienda.productos[tienda.productos.length - 1].id + 1 : 1;

        // Verificar y procesar los campos
        const nombre = Array.isArray(fields.nombre) ? fields.nombre[0] : fields.nombre;
        const miniDescripcion = Array.isArray(fields.miniDescripcion) ? fields.miniDescripcion[0] : fields.miniDescripcion;
        const oferta = Array.isArray(fields.oferta) ? fields.oferta[0] : fields.oferta;
        const novedad = Array.isArray(fields.novedad) ? fields.novedad[0] : fields.novedad;
        const size = Array.isArray(fields.size) ? fields.size[0] : fields.size;
        let description = Array.isArray(fields.description) ? fields.description[0] : fields.description;
        if (typeof description.trim() !== 'string') {
            description = ''; // Asignar un valor predeterminado si no es una cadena
        }

        // Combinar descripción y tamaño
        const descriptionArray = [description.trim()];
        if (size && typeof size === 'string' && size.trim() !== '') {
            descriptionArray.push(size.trim());
        }

        // Procesar las imágenes subidas
        const imagenes = [];
        if (Array.isArray(files.imagen)) {
            files.imagen.forEach(file => {
                const nuevoNombre = `${Date.now()}_${file.originalFilename}`;
                const nuevaRuta = path.join(form.uploadDir, nuevoNombre);
                fs.renameSync(file.filepath, nuevaRuta); // Mover el archivo a la carpeta final
                imagenes.push(nuevoNombre);
            });
        } else if (files.imagen) {
            const nuevoNombre = `${Date.now()}_${files.imagen.originalFilename}`;
            const nuevaRuta = path.join(form.uploadDir, nuevoNombre);
            fs.renameSync(files.imagen.filepath, nuevaRuta);
            imagenes.push(nuevoNombre);
        }

        // Crear el nuevo producto
        const producto = {
            id: nuevoId,
            nombre: nombre.trim(),
            miniDescripcion: miniDescripcion.trim(),
            Oferta: oferta.trim(),
            Novedad: novedad.trim(),
            description: descriptionArray,
            precio: parseFloat(fields.precio),
            stock: parseInt(fields.stock),
            imagen: imagenes
        };

        // Guardar el producto en la base de datos
        tienda.productos.push(producto);
        fs.writeFileSync(RUTAS.db, JSON.stringify(tienda, null, 2));

        res.writeHead(302, { Location: '/admin' });
        res.end();
    });
}

//-- Función para mostrar la página de modificación de productos
function mostrarPaginaModificarProductos(res) {
    const tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));
    const productos = tienda.productos;

    let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modificar Productos</title>
    <link rel="stylesheet" href="/css/styles.css">
    <link rel="stylesheet" href="/css/styles_modificar_productos.css">
    <link rel="icon" href="img/favicon.ico" type="image/x-icon">
</head>
<body>
    <header>
        <a href="/admin" class="btn-volver">Home</a>
        <h1>Modificar Productos</h1>
        <a href="/logout" class="btn-logout">Cerrar Sesión</a>
    </header>
    <main>
        <table>
            <thead>
                <tr>
                    <th>Imagen</th>
                    <th>Nombre</th>
                    <th>Mini Descripción</th>
                    <th>Stock</th>
                    <th>Precio</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${productos.map(producto => `
                    <tr>
                        <td><img src="/img/${producto.imagen[0]}" alt="${producto.nombre}" class="producto-imagen"></td>
                        <td>${producto.nombre}</td>
                        <td>${producto.miniDescripcion}</td>
                        <td>${producto.stock}</td>
                        <td>${producto.precio.toFixed(2)} €</td>
                        <td>
                            <button class="btn-eliminar" onclick="eliminarProducto(${producto.id})">❌</button>
                            <button class="btn-editar" onclick="location.href='/admin/editar-producto/${producto.id}'">✏️</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <button class="btn-agregar" onclick="location.href='/admin/nuevo-producto'">➕ Añadir Producto</button>
    </main>
    <script>
        function eliminarProducto(id) {
            if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
                fetch('/admin/eliminar-producto/' + id, { method: 'POST' })
                    .then(response => {
                        if (response.ok) {
                            alert('Producto eliminado correctamente');
                            location.reload();
                        } else {
                            alert('Error al eliminar el producto');
                        }
                    })
                    .catch(error => console.error('Error:', error));
            }
        }
    </script>
</body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(contenido);
}

//-- Función para eliminar un producto
function eliminarProducto(req, res, idProducto) {
    const tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

    // Index del producto a eliminar
    const index = tienda.productos.findIndex(producto => producto.id === parseInt(idProducto));

    // Si el producto existe, eliminarlo
    if (index !== -1) {
        tienda.productos.splice(index, 1); // Eliminar el producto
        fs.writeFileSync(RUTAS.db, JSON.stringify(tienda, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Producto eliminado correctamente' }));
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Producto no encontrado' }));
    }
}

//-- Función para mostrar el formulario de edición de producto
function mostrarFormularioEditarProducto(res, idProducto) {
    const tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));
    const producto = tienda.productos.find(p => p.id === parseInt(idProducto));

    // Si el producto no existe, mostrar error
    if (!producto) {
        error(res, 'Producto no encontrado');
        return;
    }

    // Generar el contenido HTML del formulario de edición
    let contenido = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Editar Producto</title>
    <link rel="stylesheet" href="/css/styles.css">
    <link rel="stylesheet" href="/css/styles_editar_producto.css">
    <link rel="icon" href="img/favicon.ico" type="image/x-icon">

    <script>
        function confirmarCambios() {
            return confirm('¿Estás seguro de que deseas guardar los cambios?');
        }

        function confirmarCancelar() {
            return confirm('¿Estás seguro de que deseas cancelar? Los cambios no guardados se perderán.');
        }
    </script>

</head>
<body>
    <header>
        <h1>Editar Producto</h1>
    </header>
    <main>
        <form action="/admin/editar-producto/${producto.id}" method="POST" enctype="multipart/form-data" onsubmit="return confirmarCambios()">
            <label for="nombre">Nombre:</label>
            <input type="text" id="nombre" name="nombre" value="${producto.nombre}" required>
            
            <label for="miniDescripcion">Mini Descripción:</label>
            <input type="text" id="miniDescripcion" name="miniDescripcion" value="${producto.miniDescripcion}" required>
            
            <label for="description">Descripción:</label>
            <textarea id="description" name="description" required>${producto.description[0]}</textarea>
            
            <label for="size">Tamaño:</label>
            <input type="text" id="size" name="size" value="${producto.description[1] || ''}">
            
            <label for="precio">Precio:</label>
            <input type="number" id="precio" name="precio" step="0.01" value="${producto.precio}" required>
            
            <label for="stock">Stock:</label>
            <input type="number" id="stock" name="stock" value="${producto.stock}" required>
            
            <label for="imagen">Imágenes:</label>
            <input type="file" id="imagen" name="imagen" multiple>
            
            <div class="form-buttons">
                <button type="submit">Guardar Cambios</button>
                <button type="button" class="btn-cancelar" onclick="if(confirmarCancelar()) location.href='/admin/modificar-productos';">Cancelar</button>
            </div>
        </form>
    </main>
</body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(contenido);
}

//-- Función para guardar los cambios del producto editado
function guardarCambiosProducto(req, res, idProducto) {
    const form = new formidable.IncomingForm();
    form.multiples = true;
    form.uploadDir = path.join(PUBLIC_DIR, 'img');
    form.keepExtensions = true;
    form.options.allowEmptyFiles = true; // Permitir archivos vacíos
    form.options.minFileSize = 0; // Permitir archivos de tamaño 0

    // Parsear el formulario
    form.parse(req, (err, fields, files) => {
        if (err) {
            console.error('Error al procesar el formulario:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error al procesar el formulario');
            return;
        }

        const tienda = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));
        const producto = tienda.productos.find(p => p.id === parseInt(idProducto));

        // Si el producto no existe, mostrar error
        if (!producto) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Producto no encontrado');
            return;
        }

        // Actualizar los campos del producto
        producto.nombre = Array.isArray(fields.nombre) ? fields.nombre[0].trim() : fields.nombre.trim();
        producto.miniDescripcion = Array.isArray(fields.miniDescripcion) ? fields.miniDescripcion[0].trim() : fields.miniDescripcion.trim();
        producto.description = [
            Array.isArray(fields.description) ? fields.description[0].trim() : fields.description.trim(),
            Array.isArray(fields.size) ? fields.size[0].trim() : fields.size.trim()
        ];
        producto.precio = parseFloat(fields.precio);
        producto.stock = parseInt(fields.stock);

        // Procesar imágenes si se subieron nuevas
        if (files.imagen) {
            const imagenes = [];
            if (Array.isArray(files.imagen)) {
                files.imagen.forEach(file => {
                    if (file.size > 0) { // Verificar si el archivo tiene contenido
                        const nuevoNombre = `${Date.now()}_${file.originalFilename}`;
                        const nuevaRuta = path.join(form.uploadDir, nuevoNombre);
                        fs.renameSync(file.filepath, nuevaRuta);
                        imagenes.push(nuevoNombre);
                    } else {
                        // Eliminar archivos vacíos
                        fs.unlinkSync(file.filepath);
                    }
                });
            } else if (files.imagen.size > 0) { // Verificar si el archivo tiene contenido
                const nuevoNombre = `${Date.now()}_${files.imagen.originalFilename}`;
                const nuevaRuta = path.join(form.uploadDir, nuevoNombre);
                fs.renameSync(files.imagen.filepath, nuevaRuta);
                imagenes.push(nuevoNombre);
            } else {
                // Eliminar archivo vacío
                fs.unlinkSync(files.imagen.filepath);
            }

            if (imagenes.length > 0) {
                producto.imagen = imagenes; // Actualizar las imágenes solo si se subieron nuevas
            }
        }
        // Guardar los cambios en la base de datos
        fs.writeFileSync(RUTAS.db, JSON.stringify(tienda, null, 2));

        res.writeHead(302, { Location: '/admin/modificar-productos' });
        res.end();
    });
}


server.listen(8001, () => {
    console.log('🚀 Servidor en marcha en http://localhost:8001');
});
