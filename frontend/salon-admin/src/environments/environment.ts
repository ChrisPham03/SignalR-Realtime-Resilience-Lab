export const environment = {
  production: false,
  apiUrl: 'http://localhost:5050/api',
  signalRUrl: 'http://localhost:5050/hubs/appointments',
  
  // SignalR reconnection settings
  signalR: {
    reconnectDelays: [0, 2000, 5000, 10000, 15000, 30000],
    keepAliveIntervalMs: 15000,
    serverTimeoutMs: 60000
  },
  
  // Sync settings
  sync: {
    debounceMs: 500,
    maxRetries: 3
  }
};