//-- Elementos del interfaz
const display = document.getElementById("display");
const msg_entry = document.getElementById("msg_entry");

//-- Crear un websocket. Se establece la conexión con el servidor
const socket = io();

//-- Recibir mensajes del servidor
socket.on("message", (msg) => {
  display.innerHTML += `<p class="message other">${msg}</p>`;
  display.scrollTop = display.scrollHeight; // Desplazar hacia abajo automáticamente
});

//-- Recibir mensajes del servidor
socket.on("serverMessage", (msg) => {
  display.innerHTML += `<p class="message server">${msg}</p>`;
  display.scrollTop = display.scrollHeight; // Desplazar hacia abajo automáticamente
});

//-- Recibir mensajes propios
socket.on("ownMessage", (msg) => {
  display.innerHTML += `<p class="message own">${msg}</p>`;
  display.scrollTop = display.scrollHeight; // Desplazar hacia abajo automáticamente
});

//-- Al apretar Enter en el campo de entrada, se envía un mensaje al servidor
msg_entry.addEventListener("keypress", (event) => {
  if (event.key === "Enter" && msg_entry.value.trim() !== "") {
    socket.emit("message", msg_entry.value.trim()); // Emitir mensaje al servidor
    msg_entry.value = ""; // Borrar el mensaje actual
  }
});