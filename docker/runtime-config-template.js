window.__SIMDB_RUNTIME_CONFIG__ = {
  // Modify runtime settings for the Dockerized dashboard.
  // nginx injects TOKENs at response time.
  // Keep this as a full endpoint string (for example "/scenarios/api" or
  // "https://simdb.example/api") instead of reconstructing scheme/host/port
  // in JavaScript; that is safer behind reverse proxies and HTTPS terminators.
  servers: [
    'SIMDB_SERVER_URL',
  ],
  defaultServer: 'SIMDB_SERVER_URL',
  serverConfig: {
    'SIMDB_SERVER_URL': { requiresAuth: false }
  }
}
