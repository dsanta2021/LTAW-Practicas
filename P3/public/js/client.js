//-- Elementos del interfaz
const display = document.getElementById("chatDisplay"); // Zona de mensajes
const msg_entry = document.getElementById("msgEntry"); // Entrada de texto
const chatList = document.getElementById("chatList"); // Lista de chats en la barra lateral

let currentRoom = 'general'; // Sala actual
const messageHistory = {}; // Historial de mensajes por sala
let unreadMessages = {}; // Objeto para llevar el control de mensajes no leídos

//-- Audios de notificación
//-- Sonido de nuevo mensaje recibido
const notificationSound = new Audio('/sounds/new_message.mp3');
notificationSound.preload = 'auto';

//-- Sonido de nuevo mensaje enviado
const sendMessageSound = new Audio('/sounds/send_message.mp3');
sendMessageSound.preload = 'auto';

//-- Elemento para mostrar el estado de escritura
const typingIndicator = document.createElement('div');  // Elemento para mostrar "X está escribiendo..."
typingIndicator.id = 'typingIndicator';
typingIndicator.style.display = 'none';
typingIndicator.textContent = '';
document.getElementById('chatArea').appendChild(typingIndicator);

//-- Estado para rastrear usuarios que están escribiendo
const typingUsers = new Set(); // Conjunto de usuarios que están escribiendo

//-- Crear un websocket. Se establece la conexión con el servidor
const socket = io({ query: { username: window.username } });

//-- Verificar si el nombre de usuario está disponible
if (!window.username) {
  console.error("No se proporcionó un nombre de usuario.");
}

//-- Función para crear y añadir mensajes al DOM
function añadirMensaje(msg, tipo) {
  const p = document.createElement("p");
  p.classList.add("message", tipo); // Añadir clase según el tipo de mensaje (propio, de otro usuario, del servidor)
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
    if (user !== window.username) { // No incluir al usuario actual en la lista
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

  const msgContent = tipo === 'own' ? message : `${username}: ${message}`;
  messageHistory[room].push({ msg: msgContent, tipo });

  //-- Incrementar el contador de mensajes no leídos si no está en la sala activa
  if (currentRoom !== room) {
    unreadMessages[room] = (unreadMessages[room] || 0) + 1;
    actualizarContadorMensajes(room);
  }

  //-- Mostrar el mensaje solo si está en la sala activa
  if (currentRoom === room) {
    añadirMensaje(msgContent, tipo);
  }

  //-- Reproducir el sonido de notificación solo si el mensaje no es propio
  if (tipo === 'other') {
    notificationSound.play().catch(err => {
      console.warn('Error al reproducir sonido:', err);
    });
  }
});

//-- Recibir mensajes del servidor
socket.on('serverMessage', ({ msg, room }) => {
  const targetRoom = room || 'general'; // Si no se especifica una sala, asume que es para la sala general

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

//-- Recibir mensajes de error
socket.on('errorMessage', ({ msg }) => {
  alert(msg); // Mostrar el mensaje de error al usuario
  window.location.href = '/'; // Redirigir a la página de inicio
});

//-- Cambiar de sala al hacer clic en un chat de la barra lateral
chatList.addEventListener('click', (event) => {
  const room = event.target.dataset.room;
  if (room) {
    currentRoom = room; // Actualizar la sala actual
    mostrarMensajesDeSala(room); // Mostrar mensajes de la sala seleccionada

    //-- Reiniciar el contador de mensajes no leídos para la sala activa
    unreadMessages[room] = 0;
    actualizarContadorMensajes(room);

    //-- Limpiar el estado de usuarios escribiendo
    typingUsers.clear();
    typingIndicator.style.display = 'none';

    //-- Resaltar el chat activo
    document.querySelectorAll('#chatList li').forEach((li) => li.classList.remove('active'));
    event.target.classList.add('active');

    //-- Emitir evento para iniciar chat privado si no es el general
    if (room !== 'general') {
      socket.emit('startPrivateChat', room);
    }
  }
});

//-- Recibir notificación de creación de sala privada
socket.on('privateRoomCreated', ({ room }) => {
  currentRoom = room;
  mostrarMensajesDeSala(room);

  unreadMessages[room] = 0; // Reiniciar el contador de mensajes no leídos para la sala activa
  actualizarContadorMensajes(room);
});

//-- Función para enviar el mensaje
function enviarMensaje() {
  if (msg_entry.value.trim() !== "") {
    //-- Emitir mensaje al servidor
    socket.emit('message', { room: currentRoom, message: msg_entry.value.trim() });

    //-- Emitir que el usuario dejó de escribir
    socket.emit('typing', { room: currentRoom, isTyping: false });

    //-- Reproducir el sonido de envío de mensaje
    sendMessageSound.play().catch(err => {
      console.warn('Error al reproducir sonido de envío:', err);
    });

    msg_entry.value = ""; // Borrar el mensaje actual
  }
}

//-- Al apretar Enter en el campo de entrada, se envía un mensaje al servidor
msg_entry.addEventListener('keypress', (event) => {
  if (event.key === "Enter") {
    enviarMensaje();
  }
});

//-- Obtener el botón de enviar
const sendButton = document.getElementById('sendButton');

//-- Evento para enviar el mensaje al hacer clic en el botón "Enviar"
sendButton.addEventListener('click', enviarMensaje);

//-- Emitir evento "typing" al escribir en el campo de entrada
let typingTimeout;
msg_entry.addEventListener('input', () => {
  const isTyping = msg_entry.value.trim().length > 0;
  socket.emit('typing', { room: currentRoom, isTyping });
});

//-- Escuchar el evento "userTyping" para mostrar el indicador
socket.on('userTyping', ({ username, isTyping, room }) => {
  if (room === currentRoom) { // Mostrar solo si el evento corresponde a la sala activa
    if (isTyping) {
      typingUsers.add(username); // Añadir el usuario al conjunto
    } else {
      typingUsers.delete(username); // Eliminar el usuario del conjunto
    }

    //-- Actualizar el mensaje del indicador
    if (typingUsers.size > 0) { // Si hay usuarios escribiendo
      const usersArray = Array.from(typingUsers); // Convertir el conjunto a un array
      if (usersArray.length === 1) { // Mostrar el mensaje para un solo usuario
        typingIndicator.textContent = `${usersArray[0]} está escribiendo...`;
      } else { // Mostrar el mensaje para múltiples usuarios
        typingIndicator.textContent = `${usersArray.join(', ')} están escribiendo...`;
      }
      typingIndicator.style.display = 'block';
    } else {
      typingIndicator.style.display = 'none';
    }
  }
});

//-- Función para actualizar el contador de mensajes no leídos en la interfaz
function actualizarContadorMensajes(room) {
  //-- Buscar el elemento de la lista de chats que corresponde a la sala especificada
  const chatItem = document.querySelector(`#chatList li[data-room="${room}"]`);

  if (chatItem) {
    //-- Obtener el número de mensajes no leídos para la sala, o 0 si no hay ninguno
    const unreadCount = unreadMessages[room] || 0;

    // Buscar el indicador de mensajes no leídos dentro del elemento del chat
    let badge = chatItem.querySelector('.unread-badge');

    if (unreadCount > 0) { // Si hay mensajes no leídos
      if (!badge) { // Si el badge no existe, crearlo
        badge = document.createElement('span');
        badge.classList.add('unread-badge');
        chatItem.appendChild(badge);
      }
      badge.textContent = unreadCount; // Actualizar el texto con el número de mensajes no leídos
    } else if (badge) { // Si no hay mensajes no leídos pero el badge existe
      badge.remove(); // Eliminar el badge del DOM
    }
  }
}

//-- Botón de cierre de sesión
const logoutButton = document.getElementById('logoutButton');

logoutButton.addEventListener('click', () => {
  //-- Emitir un evento al servidor para eliminar al usuario
  socket.emit('logout', { username: window.username });

  window.location.href = '/'; // Redirigir al usuario a la página inicial
});