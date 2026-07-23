// Toute la configuration vient des variables d'environnement (12-factor app).
// Les valeurs par défaut ne servent qu'au développement local ; en production
// (NODE_ENV=production), l'absence de JWT_SECRET fait échouer le démarrage (voir index.js).
module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'taskflow',
    password: process.env.DB_PASSWORD || 'taskflow',
    database: process.env.DB_NAME || 'taskflow'
  }
};
