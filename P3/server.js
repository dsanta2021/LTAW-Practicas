//-- Cargar las dependencias
const socket = require('socket.io');
const http = require('http');
const express = require('express');
const colors = require('colors');

const PUERTO = 8082;
let connectedUsers = 0;

//-- Crear una nueva aplciacion web
const app = express();

//-- Crear un servidor, asosiaco a la App de express
const server = http.Server(app);

//-- Crear el servidor de websockets, asociado al servidor http
const io = socket(server);

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
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const username = document.getElementById('username').value.trim();
            if (username) {
                // Guardar el nombre de usuario

                // Redirigir al chat
                window.location.href = 'index.html';
            }
        });
    </script>
</body>

</html>`;
  res.send(html);
});

//-- Esto es necesario para que el servidor le envíe al cliente la
//-- biblioteca socket.io para el cliente
app.use('/', express.static(__dirname +'/'));

//-- El directorio publico contiene ficheros estáticos
app.use(express.static('public'));

//------------------- GESTION SOCKETS IO -------------------\\
//-- Evento: Nueva conexión recibida
io.on('connect', (socket) => {
  connectedUsers++; //-- Incrementar el contador de usuarios conectados
  console.log('** NUEVA CONEXIÓN **'.yellow);

  //-- Enviar mensaje de bienvenida al cliente que se conecta
  socket.emit('serverMessage', 'Bienvenido al chat! Usa /help para ver los comandos disponibles.');

  //-- Notificar a todos los demás usuarios que alguien se ha conectado
  socket.broadcast.emit('serverMessage', 'Un nuevo usuario se ha unido al chat.');

  //-- Evento de desconexión
  socket.on('disconnect', () => {
    connectedUsers--; //-- Decrementar el contador de usuarios conectados
    console.log('** CONEXIÓN TERMINADA **'.red);
    socket.broadcast.emit('serverMessage', 'Un usuario ha salido del chat.');
  });

  //-- Mensaje recibido: Procesar comandos o reenviar mensajes
  socket.on('message', (msg) => {
    console.log("Mensaje Recibido: " + msg.blue);

    if (msg.startsWith('/')) {
      //-- Procesar comandos
      if (msg === '/help') {
        socket.emit('serverMessage', 'Comandos disponibles:\n/help - Lista de comandos\n/list - Número de usuarios conectados\n/hello - Saludo del servidor\n/date - Fecha actual');
      } else if (msg === '/list') {
        socket.emit('serverMessage', `Usuarios conectados: ${connectedUsers}`);
      } else if (msg === '/hello') {
        socket.emit('serverMessage', '¡Hola! ¿Cómo estás?');
      } else if (msg === '/date') {
        socket.emit('serverMessage', `Fecha actual: ${new Date().toLocaleString()}`);
      } else {
        socket.emit('serverMessage', 'Comando no reconocido. Usa /help para ver los comandos disponibles.');
      }
    } else {
      //-- Enviar mensaje propio al cliente que lo envió
      socket.emit('ownMessage', msg);

      //-- Enviar mensaje a todos los demás clientes conectados
      socket.broadcast.emit('message', msg);
    }
  });
});

//-- Lanzar el servidor HTTP
//-- ¡Que empiecen los juegos de los WebSockets!
server.listen(PUERTO);
console.log("Escuchando en puerto: " + PUERTO);