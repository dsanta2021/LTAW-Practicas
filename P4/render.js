const { ipcRenderer } = require('electron');

ipcRenderer.on('info', (event, info) => {
  document.getElementById('node').textContent = info.node;
  document.getElementById('electron').textContent = info.electron;
  document.getElementById('chrome').textContent = info.chrome;
  document.getElementById('url').textContent = info.url;
});

ipcRenderer.on('server-data', (event, data) => {
  if (data.type === 'userCount') {
    document.getElementById('userCount').textContent = data.count;
  }
  if (data.type === 'message') {
    const messages = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = data.username === 'Servidor' ? 'msg-server' : 'msg-user';
    div.textContent = `${data.username}: ${data.message}`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }
});

ipcRenderer.on('qr', (event, dataUrl) => {
  const qrImg = document.getElementById('qr-img');
  const qrLabel = document.getElementById('qr-label');
  if (qrImg && dataUrl) {
    qrImg.src = dataUrl;
    qrImg.style.display = 'block';
    if (qrLabel) qrLabel.style.display = 'block';
  }
});

document.getElementById('testBtn').onclick = () => {
  ipcRenderer.send('send-test-message');
};

const showSysInfoBtn = document.getElementById('showSysInfoBtn');
const sysInfoModal = document.getElementById('sysInfoModal');
const sysInfoPopup = document.getElementById('sysInfoPopup');
const closeSysInfo = document.getElementById('closeSysInfo');

showSysInfoBtn.onclick = () => {
  ipcRenderer.send('get-sys-info');
};

closeSysInfo.onclick = () => {
  sysInfoModal.style.display = 'none';
};

window.onclick = (event) => {
  if (event.target === sysInfoModal) {
    sysInfoModal.style.display = 'none';
  }
};

ipcRenderer.on('sys-info', (event, info) => {
  sysInfoPopup.innerHTML = `
    <b>Usuario:</b> ${info.usuario}<br>
    <b>Plataforma:</b> ${info.plataforma}<br>
    <b>Arquitectura:</b> ${info.arquitectura}<br>
    <b>CPU:</b> ${info.cpu} (${info.núcleos} núcleos)<br>
    <b>Memoria RAM total:</b> ${info.memoria_total}<br>
    <b>Memoria RAM libre:</b> ${info.memoria_libre}<br>
    <b>Hostname:</b> ${info.hostname}<br>
    <b>Directorio Home:</b> ${info.directorio_home}<br>
    <b>Directorio Temporal:</b> ${info.directorio_temp}<br>
    <b>Directorio Actual:</b> ${info.directorio_actual}<br>
  `;
  sysInfoModal.style.display = 'flex';
});

