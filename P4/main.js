const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const qrcode = require('qrcode');
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

  // Extrae información del sistema y la envía al render
  ipcMain.on('get-sys-info', (event) => {
  const sysInfo = {
    plataforma: os.platform(),
    arquitectura: os.arch(),
    cpu: os.cpus()[0].model,
    núcleos: os.cpus().length,
    memoria_total: `${(os.totalmem() / (1024 ** 3)).toFixed(2)} GB`,
    memoria_libre: `${(os.freemem() / (1024 ** 3)).toFixed(2)} GB`,
    hostname: os.hostname(),
    directorio_home: os.homedir(),
    directorio_temp: os.tmpdir(),
    directorio_actual: process.cwd(),
    usuario: os.userInfo().username
  };
  event.sender.send('sys-info', sysInfo);
});

  // Envía info de versiones y URL al render
  win.webContents.on('did-finish-load', () => {
    const url = `http://${getLocalIP()}:8082/`;
    win.webContents.send('info', {
      node: process.versions.node,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      url
    });

    // Generar QR como data URL (para mostrarlo en HTML)
    qrcode.toDataURL(url, { margin: 2, width: 200 }, (err, dataUrl) => {
      if (!err) {
        win.webContents.send('qr', dataUrl);
      }
    });
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});