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

//-- Recibir mensajes de un usuario
socket.on("message", (msg) => {
  añadirMensaje(msg, "other");
});

//-- Recibir mensajes del servidor
socket.on("serverMessage", (msg) => {
  añadirMensaje(msg, "server");
});

//-- Recibir mensajes propios
socket.on("ownMessage", (msg) => {
  añadirMensaje(msg, "own");
});

//-- Al apretar Enter en el campo de entrada, se envía un mensaje al servidor
msg_entry.addEventListener("keypress", (event) => {
  if (event.key === "Enter" && msg_entry.value.trim() !== "") {
    socket.emit("message", msg_entry.value.trim()); // Emitir mensaje al servidor
    msg_entry.value = ""; // Borrar el mensaje actual
  }
});