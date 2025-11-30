// api-config.spec.js
// Validates API configuration files

// Database config
const DatabaseConfig = {
  required: [
    Field({ key: 'host', value: Str() }),
    Field({ key: 'port', value: Num({ min: 1, max: 65535 }) }),
    Field({ key: 'name', value: Str() }),
  ],
  optional: [
    Field({ key: 'user', value: Str() }),
    Field({ key: 'ssl', value: Bool() }),
  ]
};

// Cache config
const CacheConfig = {
  required: [
    Field({ key: 'driver', value: OneOf('redis', 'memcached', 'memory') }),
  ],
  optional: [
    Field({ key: 'ttl', value: Num({ min: 0 }) }),
    Field({ key: 'prefix', value: Str() }),
  ]
};

// Server config
const ServerConfig = {
  required: [
    Field({ key: 'port', value: Num({ min: 1024, max: 65535 }) }),
  ],
  optional: [
    Field({ key: 'host', value: Str() }),
    Field({ key: 'cors', value: Bool() }),
    Field({
      key: 'rateLimit',
      value: {
        optional: [
          Field({ key: 'windowMs', value: Num({ min: 0 }) }),
          Field({ key: 'max', value: Num({ min: 1 }) }),
        ]
      }
    }),
  ]
};

// Root config file
Directory({
  content: {
    required: [
      JsonFile({
        path: 'config.json',
        required: [
          Field({ key: 'server', value: ServerConfig }),
          Field({ key: 'database', value: DatabaseConfig }),
        ],
        optional: [
          Field({ key: 'cache', value: CacheConfig }),
          Field({ key: 'debug', value: Bool() }),
        ]
      })
    ]
  }
})
