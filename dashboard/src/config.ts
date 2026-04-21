export { config }

// In development, use a relative URL so the Vite proxy forwards requests
// to simdb.iter.org (avoids CORS). In production the full URL is used directly.
const _scenariosAPI = import.meta.env.DEV
  ? '/scenarios/api'
  : 'https://simdb.iter.org/scenarios/api'

const config: Readonly<{ [key: string]: any }> = {
  api_version: '1.2',
  servers: [
    _scenariosAPI,
    //'https://simdb.iter.org/itpa/api',    
  ],
  serverConfig: {
        [_scenariosAPI]: { 'requiresAuth': false },
    //'https://simdb.iter.org/itpa/api': { 'requiresAuth': false },
  },
  defaultServer: _scenariosAPI,
  searchFields: ['alias', 'code.name', 'global_quantities.ip.value', 'global_quantities.b0.value', 'heating_current_drive.power_additional.value', 'description'],
  searchOutputFields: [
    'code.name',
    'status',
    'uploaded_by'
  ],
  displayHeaders: [
    { label: 'Server', value: 'server' },
    { label: 'Simulation', value: 'uuid' },
    { label: 'Alias', value: 'alias' },
    { label: 'Upload Info', value: 'upload_info' },
  ],
  // displayFields: 'all',
  displayFields: [    
    'code.name',
    'ids',
    'description',
    'status',
    'ids_properties.creation_date'
  ],
  prefix: 'dashboard',
  searchOutputColumns: ['alias/UUID', 'status', 'Upload Date'],
  rootURL: function (server: string) {
    return server + '/'
  },
  rootAPI: function (server: string) {
    return server + '/v' + config.api_version
  }
}
