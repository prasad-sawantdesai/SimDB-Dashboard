export { config }

// In development, point directly at the local Flask dev server.
// In production the full SimDB URL is used.
const _scenariosAPI = import.meta.env.DEV
  ? 'http://localhost:5000'
  : 'https://simdb.iter.org/scenarios/api'

// The /data endpoint is served by the same server.
const _dataAPI = import.meta.env.DEV
  ? 'http://localhost:5000'
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
  dataAPI: _dataAPI,
  rootURL: function (server: string) {
    return server + '/'
  },
  rootAPI: function (server: string) {
    return server + '/v' + config.api_version
  }
}
