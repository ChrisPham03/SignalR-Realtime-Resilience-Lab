export const environment = {
  production: true,
  // In production, these will be the same domain
  apiUrl: '/api',
  signalRUrl: '/hubs/appointments',
  
  signalR: {
    reconnectDelays: [0, 2000, 5000, 10000, 15000, 30000, 60000],
    keepAliveIntervalMs: 15000,
    serverTimeoutMs: 60000
  },
  
  sync: {
    debounceMs: 500,
    maxRetries: 3
  }
};
