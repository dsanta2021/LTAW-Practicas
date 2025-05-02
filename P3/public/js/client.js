//-- Elementos del interfaz
const display = document.getElementById("chatDisplay"); // Zona de mensajes
const msg_entry = document.getElementById("msgEntry"); // Entrada de texto
const chatList = document.getElementById("chatList"); // Lista de chats en la barra lateral

let currentRoom = 'general'; // Sala actual
const messageHistory = {}; // Historial de mensajes por sala

//-- Crear un websocket. Se establece la conexión con el servidor
const socket = io({ query: { username: window.username } });

//-- Verificar si el nombre de usuario está disponible
if (!window.username) {
  console.error("No se proporcionó un nombre de usuario.");
}

//-- Función para crear y añadir mensajes al DOM
function añadirMensaje(msg, tipo) {
  const p = document.createElement("p");
  p.classList.add("message", tipo);
  p.textContent = msg;
  display.appendChild(p);

  // Hacer scroll automáticamente al último mensaje
  setTimeout(() => {
    display.scrollTop = display.scrollHeight; // Desplazar al final del contenedor
  }, 50); // Asegurar que el DOM se actualice antes de ajustar el scroll
}

//-- Mostrar mensajes de una sala
function mostrarMensajesDeSala(room) {
  display.innerHTML = ''; // Limpiar el área de mensajes
  if (messageHistory[room]) {
    messageHistory[room].forEach(({ msg, tipo }) => añadirMensaje(msg, tipo));
  }
}

//-- Resaltar el chat general por defecto
document.addEventListener('DOMContentLoaded', () => {
  const generalChat = document.querySelector('#chatList li[data-room="general"]');
  if (generalChat) {
    generalChat.classList.add('active');
  }
});

//-- Actualizar la lista de usuarios conectados
socket.on('updateUserList', (userList) => {
  chatList.innerHTML = '<li data-room="general">Chat General</li>'; // Reiniciar la lista con el chat general

  userList.forEach((user) => {
    if (user !== window.username) {
      const li = document.createElement('li');
      li.textContent = user;
      li.dataset.room = user; // Usar el nombre del usuario como identificador de la sala
      chatList.appendChild(li);
    }
  });

  //-- Resaltar el chat general si es la primera carga
  if (!document.querySelector('#chatList li.active')) {
    const generalChat = document.querySelector('#chatList li[data-room="general"]');
    if (generalChat) {
      generalChat.classList.add('active');
    }
  }
});

//-- Recibir mensajes
socket.on('message', ({ username, message, room }) => {
  const tipo = username === window.username ? 'own' : 'other';

  //-- Guardar el mensaje en el historial de la sala correspondiente
  if (!messageHistory[room]) {
    messageHistory[room] = [];
  }
  messageHistory[room].push({ msg: `${username}: ${message}`, tipo });

  //-- Mostrar el mensaje solo si está en la sala activa
  if (currentRoom === room) {
    añadirMensaje(`${username}: ${message}`, tipo);
  }
});

//-- Recibir mensajes del servidor
socket.on('serverMessage', ({ msg, room }) => {
  //-- Si no se especifica una sala, asume que es para la sala general
  const targetRoom = room || 'general';

  //-- Guardar el mensaje en el historial de la sala correspondiente
  if (!messageHistory[targetRoom]) {
    messageHistory[targetRoom] = [];
  }
  messageHistory[targetRoom].push({ msg, tipo: 'server' });

  //-- Mostrar el mensaje solo si está en la sala activa
  if (currentRoom === targetRoom) {
    añadirMensaje(msg, 'server');
  }
});

//-- Cambiar de sala al hacer clic en un chat de la barra lateral
chatList.addEventListener('click', (event) => {
  const room = event.target.dataset.room;
  if (room) {
    //-- Resaltar la sala activa
    document.querySelectorAll('#chatList li').forEach((li) => li.classList.remove('active'));
    event.target.classList.add('active');

    //-- Cambiar de sala
    currentRoom = room;
    mostrarMensajesDeSala(room); // Mostrar los mensajes de la sala seleccionada
    if (room !== 'general') {
      socket.emit('startPrivateChat', room); // Notificar al servidor para iniciar el chat privado
    }
  }
});

//-- Al apretar Enter en el campo de entrada, se envía un mensaje al servidor
msg_entry.addEventListener('keypress', (event) => {
  if (event.key === "Enter" && msg_entry.value.trim() !== "") {
    socket.emit('message', { room: currentRoom, message: msg_entry.value.trim() }); // Emitir mensaje al servidor
    msg_entry.value = ""; // Borrar el mensaje actual
  }
});

//-- Mostrar mensajes de una sala
function mostrarMensajesDeSala(room) {
  display.innerHTML = ''; // Limpiar el área de mensajes
  if (messageHistory[room]) {
    messageHistory[room].forEach(({ msg, tipo }) => añadirMensaje(msg, tipo));
  }
}