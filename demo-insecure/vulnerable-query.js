// ============================================================================
// EXEMPLE VOLONTAIREMENT VULNERABLE - NE PAS UTILISER, NE PAS IMPORTER
// ============================================================================
// Ce fichier illustre deux failles classiques que le SAST (Semgrep) detecte.
// Comparer avec le vrai code du backend (backend/src/routes/tasks.js), qui
// utilise systematiquement des requetes PARAMETREES ($1, $2, ...).
// ----------------------------------------------------------------------------
const express = require('express');
const app = express();

// Fausse reference a une base, juste pour que l'exemple "ressemble" a du vrai code.
const db = { query: async () => [] };

// FAILLE 1 : Injection SQL par concatenation de chaine.
// L'entree utilisateur (req.query.name) est collee directement dans la requete.
// Un attaquant peut envoyer  name=' OR '1'='1  pour tout extraire.
// Correctif : requete parametree  db.query('SELECT ... WHERE name = $1', [name])
app.get('/users', async (req, res) => {
  const name = req.query.name;
  const query = "SELECT * FROM users WHERE name = '" + name + "'"; // vulnerable
  const rows = await db.query(query);
  res.json(rows);
});

// FAILLE 2 : eval() sur une entree utilisateur = execution de code arbitraire.
// Correctif : ne jamais utiliser eval sur une entree ; utiliser un parseur dedie.
app.get('/calc', (req, res) => {
  const result = eval(req.query.expr); // vulnerable
  res.json({ result });
});

module.exports = app;
