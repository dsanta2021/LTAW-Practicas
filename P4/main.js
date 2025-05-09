const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { fork } = require('child_process');

let win = null;
let serverProcess = null;

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  // Lanza el servidor como proceso hijo
  serverProcess = fork(path.join(__dirname, 'public', 'server.js'));

  createWindow();

  // Recibe mensajes del servidor y los reenvía al render
  serverProcess.on('message', (data) => {
    if (win) win.webContents.send('server-data', data);
  });

  // Recibe petición para enviar mensaje de prueba
  ipcMain.on('send-test-message', () => {
    if (serverProcess) serverProcess.send({ type: 'test-message' });
  });

  // Envía info de versiones y URL al render
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('info', {
      node: process.versions.node,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      url: `http://${getLocalIP()}:8082/`
    });
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});