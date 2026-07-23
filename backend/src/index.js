const app = require('./app');
const db = require('./db');
const config = require('./config');

// Fail-fast : refuse de démarrer en production avec le secret JWT par défaut
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error(
    "FATAL : JWT_SECRET doit être défini en production (Secret Kubernetes / variable d'environnement)"
  );
  process.exit(1);
}

// La base peut mettre quelques secondes à être prête (compose, k8s) : retry avec délai
async function waitForDatabase(attempts = 15, delayMs = 3000) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await db.initSchema();
      console.log('Base de données prête, schéma initialisé');
      return;
    } catch (err) {
      if (attempt === attempts) throw err;
      console.log(
        `Base indisponible (tentative ${attempt}/${attempts}) : ${err.message} — nouvel essai dans ${delayMs / 1000}s`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

waitForDatabase()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`TaskFlow API à l'écoute sur le port ${config.port}`);
    });
  })
  .catch((err) => {
    console.error('Impossible de se connecter à la base de données :', err);
    process.exit(1);
  });
