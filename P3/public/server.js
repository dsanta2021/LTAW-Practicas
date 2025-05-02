//-- Cargar las dependencias
const socket = require('socket.io');
const http = require('http');
const express = require('express');
const path = require('path');
const colors = require('colors');
const fs = require('fs'); 

const PUERTO = 8082;
let connectedUsers = 0;

//-- Rutas 
const RUTAS = {
    db: path.join(__dirname, 'json', 'users.json')
};

//-- Comprobar si el archivo JSON existe, si no, crearlo vacío
if (!fs.existsSync(RUTAS.db)) {
  fs.writeFileSync(RUTAS.db, JSON.stringify({}, null, 2));
}

let registeredUsers = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

//-- Crear una nueva aplciacion web
const app = express();

// Middleware para manejar JSON en solicitudes POST
app.use(express.json());

//-- Crear un servidor, asosiaco a la App de express
const server = http.Server(app);

//-- Crear el servidor de websockets, asociado al servidor http
const io = socket(server);

//-- Esto es necesario para que el servidor le envíe al cliente la
//-- biblioteca socket.io para el cliente
//-- El directorio publico contiene ficheros estáticos
app.use(express.static(path.join(__dirname)));

//-------- PUNTOS DE ENTRADA DE LA APLICACION WEB
//-- Definir el punto de entrada principal de mi aplicación web
app.get('/', (req, res) => {
  let html = `<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenida</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #f4f4f9;
        }

        h1 {
            margin-bottom: 20px;
        }

        form {
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        input[type="text"] {
            padding: 10px;
            font-size: 16px;
            margin-bottom: 10px;
            border: 1px solid #ccc;
            border-radius: 5px;
            width: 300px;
        }

        button {
            padding: 10px 20px;
            font-size: 16px;
            background-color: #4caf50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        }

        button:hover {
            background-color: #45a049;
        }
    </style>
</head>

<body>
    <h1>Bienvenido al Chat</h1>
    <form id="welcomeForm">
        <input type="text" id="username" placeholder="Introduce tu nombre de usuario" required>
        <button type="submit">Entrar</button>
    </form>

    <script>
        const form = document.getElementById('welcomeForm');
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const username = document.getElementById('username').value.trim();
            if (username) {
                try {
                    // Comprobar si el nombre de usuario ya está registrado
                    const response = await fetch('/check-username', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username }),
                    });
                    const result = await response.json();

                    if (result.success) {
                        // Guardar el nombre de usuario en el servidor
                        const registerResponse = await fetch('/register-username', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ username }),
                        });
                        const registerResult = await registerResponse.json();

                        // Redirigir al chat
                        window.location.href = registerResult.redirectUrl;
                    } else {
                        alert(result.message); // Mostrar mensaje de error
                    }
                } catch (error) {
                    console.error('Error al verificar el nombre de usuario:', error);
                }
            }
        });
    </script>
</body>

</html>`;
  res.send(html);
});

//-- Verificar si el nombre de usuario ya está registrado
app.post('/check-username', (req, res) => {
  const { username } = req.body;
  if (registeredUsers[username]) {
    res.json({ success: false, message: 'El nombre de usuario ya está en uso.' });
  } else {
    res.json({ success: true });
  }
});

//-- Registrar el nombre de usuario
app.post('/register-username', (req, res) => {
  const { username } = req.body;
  registeredUsers[username] = true;
  fs.writeFileSync(RUTAS.db, JSON.stringify(registeredUsers, null, 2));
  res.json({ success: true, redirectUrl: `/chat.html?username=${encodeURIComponent(username)}` });
});

//------------------- GESTION SOCKETS IO -------------------\\
const users = {}; // Objeto para asociar socket.id con nombres de usuario

io.on('connect', (socket) => {
  const username = socket.handshake.query.username; // Obtener el nombre de usuario al conectar

  if (username) {
    users[socket.id] = username; // Asociar el nombre de usuario al socket.id
    connectedUsers++; //-- Incrementar el contador de usuarios conectados
    console.log(`** NUEVA CONEXIÓN: ${username} **`.yellow);

    //-- Enviar mensaje de bienvenida al cliente que se conecta
    socket.emit('serverMessage', `${username}, Bienvenido al chat! Usa /help para ver los comandos disponibles.`);

    //-- Notificar a todos los demás usuarios que alguien se ha conectado
    socket.broadcast.emit('serverMessage', `${username} se ha unido al chat.`);
  } else {
    console.log('** Conexión sin nombre de usuario **'.red);
  }

  //-- Evento de desconexión
  socket.on('disconnect', () => {
    const username = users[socket.id]; // Obtener el nombre de usuario antes de eliminarlo

    if (username) {
      console.log(`** ${username} se ha desconectado **`.red);

      // Notificar a todos los demás usuarios que alguien se ha desconectado
      socket.broadcast.emit('serverMessage', `${username} ha salido del chat.`);

      // Eliminar al usuario de la lista de usuarios registrados
      delete registeredUsers[username];
      fs.writeFileSync(RUTAS.db, JSON.stringify(registeredUsers, null, 2));

      // Eliminar al usuario de la lista de usuarios conectados
      delete users[socket.id];
      connectedUsers--; //-- Decrementar el contador de usuarios conectados
    } else {
      console.log('** Un usuario desconocido se ha desconectado **'.red);
    }
  });

  //-- Mensaje recibido: Procesar comandos o reenviar mensajes
  socket.on('message', (msg) => {
    const username = users[socket.id];
    console.log(`Mensaje de ${username}: ${msg}`.blue);

    if (msg.startsWith('/')) {
      //-- Procesar comandos
      if (msg === '/help') {
        socket.emit('serverMessage', 'Comandos disponibles:\n/help - Lista de comandos\n/list - Número de usuarios conectados\n/hello - Saludo del servidor\n/date - Fecha actual');
      } else if (msg === '/list') {
        socket.emit('serverMessage', `Usuarios conectados: ${connectedUsers}`);
      } else if (msg === '/hello') {
        socket.emit('serverMessage', `¡Hola ${username}! ¡Aquí el Server! ¿Cómo estás?`);
      } else if (msg === '/date') {
        socket.emit('serverMessage', `Fecha actual: ${new Date().toLocaleString()}`);
      } else {
        socket.emit('serverMessage', 'Comando no reconocido. Usa /help para ver los comandos disponibles.');
      }
    } else {
      //-- Enviar mensaje propio al cliente que lo envió
      socket.emit('ownMessage', `${msg}`);

      //-- Enviar mensaje a todos los demás clientes conectados
      socket.broadcast.emit('message', `${username}: ${msg}`);
    }
  });
});

//-- Lanzar el servidor HTTP
//-- ¡Que empiecen los juegos de los WebSockets!
server.listen(PUERTO);
console.log("Escuchando en puerto: " + PUERTO);