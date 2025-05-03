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

            if (!username) {
              alert('Por favor, introduce un nombre de usuario.');
              return;
            }
              
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
const userSockets = {}; // Objeto para asociar nombres de usuario con socket.id

io.on('connect', (socket) => {
  const username = socket.handshake.query.username; // Obtener el nombre de usuario al conectar

  if (username) {
    users[socket.id] = username; // Asociar el nombre de usuario al socket.id
    userSockets[username] = socket.id; // Asociar el nombre de usuario con socket.id
    connectedUsers++; //-- Incrementar el contador de usuarios conectados

    console.log(`** NUEVA CONEXIÓN: ${username} **`.yellow);

    //-- Unir al usuario a la sala general
    socket.join('general');

    //-- Enviar mensaje de bienvenida al cliente que se conecta
    socket.emit('serverMessage', { msg: `${username}, Bienvenido al chat general! Usa /help para ver los comandos disponibles.`, room: 'general' });

    //-- Notificar a todos los demás usuarios que alguien se ha conectado
    socket.broadcast.to('general').emit('serverMessage', { msg: `${username} se ha unido al chat.`, room: 'general' });

    //-- Actualizar la lista de usuarios conectados
    io.to('general').emit('updateUserList', Object.values(users));
  } else {
    console.log('** Conexión sin nombre de usuario **'.red);
  }

  //-- Evento de desconexión
  socket.on('disconnect', () => {
    const username = users[socket.id]; // Obtener el nombre de usuario antes de eliminarlo

    if (username) {
      console.log(`** ${username} se ha desconectado **`.red);

      // Notificar a todos los demás usuarios que alguien se ha desconectado
      socket.broadcast.to('general').emit('serverMessage', { msg: `${username} ha salido del chat.`, room: 'general' });

      // Eliminar al usuario de la lista de usuarios conectados
      delete users[socket.id];
      delete userSockets[username];
      connectedUsers--; //-- Decrementar el contador de usuarios conectados

      //-- Liberar el nombre de usuario
      delete registeredUsers[username];
      fs.writeFileSync(RUTAS.db, JSON.stringify(registeredUsers, null, 2));

      //-- Actualizar la lista de usuarios conectados
      io.to('general').emit('updateUserList', Object.values(users));
    } else {
      console.log('** Un usuario desconocido se ha desconectado **'.red);
    }
  });

  //-- Evento para iniciar un chat privado
  socket.on('startPrivateChat', (targetUsername) => {
    const targetSocketId = userSockets[targetUsername];
    const currentUsername = users[socket.id];

    if (targetSocketId) {
      const privateRoom = [socket.id, targetSocketId].sort().join('-'); // Crear un ID único para la sala privada

      //-- Unir a ambos usuarios a la sala privada
      socket.join(privateRoom);
      io.to(targetSocketId).socketsJoin(privateRoom);

      //-- Notificar al usuario que inicia el chat privado
      socket.emit('serverMessage', { msg: `Acabas de entrar al chat privado con ${targetUsername}.`, room: privateRoom });

      //-- Notificar al cliente el ID de la sala privada
      socket.emit('privateRoomCreated', { room: privateRoom });
    } else {
      socket.emit('serverMessage', { msg: `El usuario ${targetUsername} no está disponible.`, room: 'general' });
    }
  });

  //-- Evento: Usuario está escribiendo
  socket.on('typing', ({ room, isTyping }) => {
    const username = users[socket.id];
    if (username && socket.rooms.has(room)) { // Verificar que el usuario está en la sala
      // Emitir solo a los usuarios de la sala correspondiente
      socket.to(room).emit('userTyping', { username, isTyping, room });
    }
  });

  //-- Mensaje recibido: Procesar comandos o reenviar mensajes
  socket.on('message', ({ room, message }) => {
    const username = users[socket.id]; // Obtener el nombre de usuario del remitente

    if (!username) {
      console.log('** Mensaje de un usuario desconocido **'.red);
      return;
    }

    console.log(`Mensaje de ${username} en sala ${room}: ${message}`.blue);

    if (message.startsWith('/')) {
      //-- Procesar comandos
      if (message === '/help') {
        socket.emit('serverMessage', { msg: 'Comandos disponibles:\n/help - Lista de comandos\n/list - Número de usuarios conectados\n/hello - Saludo del servidor\n/date - Fecha actual', room });
      } else if (message === '/list') {
        socket.emit('serverMessage', { msg: `Usuarios conectados: ${connectedUsers}`, room });
      } else if (message === '/hello') {
        socket.emit('serverMessage', { msg: `¡Hola ${username}! ¡Aquí el Server! ¿Cómo estás?`, room });
      } else if (message === '/date') {
        socket.emit('serverMessage', { msg: `Fecha actual: ${new Date().toLocaleString()}`, room });
      } else {
        socket.emit('serverMessage', { msg: 'Comando no reconocido. Usa /help para ver los comandos disponibles.', room });
      }
    } else {
      //-- Reenviar el mensaje a la sala correspondiente
      io.to(room).emit('message', { username, message, room });
    }
  });

  //-- Evento para cerrar sesión
  socket.on('logout', ({ username }) => {
    if (registeredUsers[username]) {
      // Eliminar al usuario de la base de datos
      delete registeredUsers[username];
      fs.writeFileSync(RUTAS.db, JSON.stringify(registeredUsers, null, 2));

      console.log(`** ${username} ha cerrado sesión **`.yellow);

      // Eliminar al usuario de la lista de usuarios conectados
      delete users[socket.id];
      delete userSockets[username];
      connectedUsers--;

      // Notificar a los demás usuarios en la sala general
      socket.broadcast.to('general').emit('serverMessage', { msg: `${username} ha salido del chat.`, room: 'general' });

      // Actualizar la lista de usuarios conectados
      io.to('general').emit('updateUserList', Object.values(users));
    }
  });
});

//-- Lanzar el servidor HTTP
//-- ¡Que empiecen los juegos de los WebSockets!
server.listen(PUERTO);
console.log("Escuchando en puerto: " + PUERTO);