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

