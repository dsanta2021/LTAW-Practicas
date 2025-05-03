//-- Cargar las dependencias necesarias
const socket = require('socket.io');
const http = require('http');
const express = require('express');
const path = require('path');
const colors = require('colors');
const fs = require('fs');

//-- Configuración del puerto
const PUERTO = 8082;
let connectedUsers = 0; // Contador de usuarios conectados

//-- Rutas para archivos y datos 
const RUTAS = {
  db: path.join(__dirname, 'json', 'users.json') // Ruta al archivo JSON de usuarios registrados
};

//-- Comprobar si el archivo JSON existe, si no, crearlo vacío
if (!fs.existsSync(RUTAS.db)) {
  fs.writeFileSync(RUTAS.db, JSON.stringify({}, null, 2));
}

//-- Cargar los usuarios registrados desde el archivo JSON
let registeredUsers = JSON.parse(fs.readFileSync(RUTAS.db, 'utf-8'));

//-- Crear una nueva aplicación web
const app = express();

//-- Middleware para manejar JSON en solicitudes POST
app.use(express.json());

//-- Crear un servidor HTTP asociado a la aplicación de Express
const server = http.Server(app);

//-- Crear el servidor de WebSockets asociado al servidor HTTP
const io = socket(server);

//-- Esto es necesario para que el servidor le envíe al cliente la
//-- biblioteca socket.io para el cliente
//-- El directorio publico contiene ficheros estáticos
app.use(express.static(path.join(__dirname)));

//-------- PUNTOS DE ENTRADA DE LA APLICACIÓN WEB --------

//-- Página principal de bienvenida
app.get('/', (req, res) => {
  let html = `<!DOCTYPE html>
<html lang="es">

<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenida - GalactiChat</title>
  <link rel="icon" href="img/favicon.ico" type="image/x-icon">
  <link rel="stylesheet" href="css/styles_main.css">
</head>

<body>
  <div id="welcomeContainer">
    <img id="chatLogo" src="img/chat.png" alt="Logo del Chat Galáctico">
    <h1>Bienvenido a GalactiChat</h1>
    <form id="welcomeForm">
      <input type="text" id="username" placeholder="Introduce tu nombre de usuario" required>
      <button type="submit">Entrar</button>
    </form>
  </div>

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
  registeredUsers[username] = true; // Registrar el usuario
  fs.writeFileSync(RUTAS.db, JSON.stringify(registeredUsers, null, 2)); // Guardar en el archivo JSON
  res.json({ success: true, redirectUrl: `/chat.html?username=${encodeURIComponent(username)}` });
});

//------------------- GESTIÓN DE SOCKET.IO -------------------\\

//-- Objetos para gestionar usuarios conectados
const users = {}; // Relación socket.id -> nombre de usuario
const userSockets = {}; // Relación nombre de usuario -> socket.id

//-- Manejar conexiones de WebSocket
io.on('connect', (socket) => {
  const username = socket.handshake.query.username; // Obtener el nombre de usuario al conectar

  if (username) {
    users[socket.id] = username; // Asociar el nombre de usuario al socket.id
    userSockets[username] = socket.id; // Asociar el nombre de usuario con socket.id
    connectedUsers++; // Incrementar el contador de usuarios conectados

    console.log(`** NUEVA CONEXIÓN: ${username} **`.yellow);

    //-- Unir al usuario a la sala general
    socket.join('general');

    //-- Enviar mensaje de bienvenida al usuario conectado
    socket.emit('serverMessage', { msg: `${username}, Bienvenido al chat general! Usa /help para ver los comandos disponibles.`, room: 'general' });

    //-- Notificar a los demás usuarios que alguien se ha conectado
    socket.broadcast.to('general').emit('serverMessage', { msg: `${username} se ha unido al chat.`, room: 'general' });

    //-- Actualizar la lista de usuarios conectados
    io.to('general').emit('updateUserList', Object.values(users));
  } else {
    console.log('** Conexión sin nombre de usuario **'.red);
  }

  //-- Manejar desconexiones
  socket.on('disconnect', () => {
    const username = users[socket.id]; // Obtener el nombre de usuario antes de eliminarlo

    if (username) {
      console.log(`** ${username} se ha desconectado **`.red);

      //-- Notificar a los demás usuarios que alguien se ha desconectado
      socket.broadcast.to('general').emit('serverMessage', { msg: `${username} ha salido del chat.`, room: 'general' });

      //-- Eliminar al usuario de las listas
      delete users[socket.id];
      delete userSockets[username];
      connectedUsers--; // Decrementar el contador de usuarios conectados

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
            //-- Emitir solo a los usuarios de la sala correspondiente
   socket.to(room).emit('userTyping', { username, isTyping, room });
    }
  });

  //-- Manejar mensajes enviados por los usuarios
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
});

//-- Lanzar el servidor HTTP
server.listen(PUERTO, () => {
  console.log(`🚀 Servidor en marcha en http://localhost:${PUERTO}`);
});