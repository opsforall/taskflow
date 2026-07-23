// Config Jest dédiée aux tests d'INTÉGRATION.
// Contrairement aux tests unitaires (dossier tests/, base mockée), ceux-ci
// tournent contre une VRAIE base PostgreSQL — voir tests-integration/.
// Lancés séparément (`npm run test:integration`) car ils exigent une base
// disponible ; en CI, un service PostgreSQL est démarré pour l'occasion.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests-integration/**/*.test.js']
};
