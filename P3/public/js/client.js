//-- Elementos del interfaz
const display = document.getElementById("chatDisplay"); // Zona de mensajes
const msg_entry = document.getElementById("msgEntry"); // Entrada de texto

//-- Crear un websocket. Se establece la conexión con el servidor
const socket = io();

//-- Usar el nombre de usuario desde window.username
if (window.username) {
  socket.emit("setUsername", window.username); // Enviar el nombre de usuario al servidor
} else {
  console.error("No se proporcionó un nombre de usuario.");
}

//-- Función para hacer scroll al último mensaje
function scrollToBottom() {
  display.scrollTop = display.scrollHeight;
}

//-- Recibir mensajes del servidor
socket.on("message", (msg) => {
  display.innerHTML += `<p class="message other">${msg}</p>`;
  scrollToBottom(); // Desplazar hacia el último mensaje
});

socket.on("serverMessage", (msg) => {
  display.innerHTML += `<p class="message server">${msg}</p>`;
  scrollToBottom(); // Desplazar hacia el último mensaje
});

socket.on("ownMessage", (msg) => {
  display.innerHTML += `<p class="message own">${msg}</p>`;
  scrollToBottom(); // Desplazar hacia el último mensaje
});

//-- Al apretar Enter en el campo de entrada, se envía un mensaje al servidor
msg_entry.addEventListener("keypress", (event) => {
  if (event.key === "Enter" && msg_entry.value.trim() !== "") {
    socket.emit("message", msg_entry.value.trim()); // Emitir mensaje al servidor
    msg_entry.value = ""; // Borrar el mensaje actual
  }
});