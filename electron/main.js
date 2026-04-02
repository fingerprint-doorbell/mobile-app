const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

let Bonjour;
try {
  Bonjour = require('bonjour-service').Bonjour;
  console.log('bonjour-service loaded successfully');
} catch (err) {
  console.error('Failed to load bonjour-service:', err.message);
}

let mainWindow;
let bonjour;
let browser;
const discoveredDevices = new Map();

// Get icon path - handles both dev and packaged app
function getIconPath() {
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
   if (app.isPackaged) {
    // In packaged app, use the unpacked path relative to resourcesPath
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'icons', iconFile);
  }
  // In dev, relative to this file
  return path.join(__dirname, 'icons', iconFile);
}

function createWindow() {
  const iconPath = getIconPath();
  console.log('Using icon path:', iconPath);

  mainWindow = new BrowserWindow({
    width: 420,
    height: 800,
    minWidth: 360,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    title: 'Fingerprint Doorbell',
  });

  // Hide the menu bar
  //Menu.setApplicationMenu(null);

  // Load the Expo web build or dev server
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:8081');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startMdnsDiscovery() {
  if (!Bonjour) {
    console.error('Cannot start mDNS discovery: bonjour-service not loaded');
    return;
  }
  
  console.log('Starting mDNS discovery...');
  bonjour = new Bonjour();
  
  // ESPHome devices advertise as _esphomelib._tcp
  browser = bonjour.find({ type: 'esphomelib' }, (service) => {
    console.log('Found ESPHome device:', service.name, service.addresses);
    const device = {
      name: service.name,
      host: service.host,
      ip: service.addresses?.find(addr => addr.includes('.')) || service.addresses?.[0],
      port: service.port,
      txt: service.txt || {},
    };
    
    discoveredDevices.set(service.name, device);
    
    // Notify renderer of new device
    if (mainWindow) {
      mainWindow.webContents.send('mdns:device-found', device);
    }
  });

  browser.on('down', (service) => {
    discoveredDevices.delete(service.name);
    if (mainWindow) {
      mainWindow.webContents.send('mdns:device-lost', { name: service.name });
    }
  });
}

function stopMdnsDiscovery() {
  if (browser) {
    browser.stop();
  }
  if (bonjour) {
    bonjour.destroy();
  }
}

// IPC handlers
ipcMain.handle('mdns:get-devices', () => {
  return Array.from(discoveredDevices.values());
});

ipcMain.handle('mdns:start-discovery', () => {
  discoveredDevices.clear();
  stopMdnsDiscovery();
  startMdnsDiscovery();
  return true;
});

ipcMain.handle('mdns:stop-discovery', () => {
  stopMdnsDiscovery();
  return true;
});

app.whenReady().then(() => {
  createWindow();
  startMdnsDiscovery();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopMdnsDiscovery();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopMdnsDiscovery();
});
