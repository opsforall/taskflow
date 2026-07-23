const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const STATUSES = ['todo', 'in_progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];

// Toutes les routes tâches exigent un token valide
router.use(authenticate);

// Valide les champs fournis ; renvoie un message d'erreur ou null.
// `partial: true` (mise à jour) n'exige pas la présence du titre.
function validateTask(body, { partial = false } = {}) {
  if (!partial || 'title' in body) {
    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      return 'Le titre est requis';
    }
    if (body.title.length > 200) return 'Titre trop long (200 caractères max)';
  }
  if ('description' in body && body.description != null) {
    if (typeof body.description !== 'string' || body.description.length > 2000) {
      return 'Description invalide (2000 caractères max)';
    }
  }
  if ('status' in body && !STATUSES.includes(body.status)) {
    return `Statut invalide (attendu : ${STATUSES.join(', ')})`;
  }
  if ('priority' in body && !PRIORITIES.includes(body.priority)) {
    return `Priorité invalide (attendu : ${PRIORITIES.join(', ')})`;
  }
  if ('due_date' in body && body.due_date != null && body.due_date !== '') {
    if (Number.isNaN(Date.parse(body.due_date))) return 'Date d\'échéance invalide';
  }
  return null;
}

function parseId(raw) {
  const id = parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/tasks — uniquement les tâches de l'utilisateur connecté
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    return res.json({ tasks: result.rows });
  } catch (err) {
    return next(err);
  }
});

// POST /api/tasks
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const error = validateTask(body);
    if (error) return res.status(400).json({ error });

    const result = await db.query(
      `INSERT INTO tasks (user_id, title, description, status, priority, due_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.user.id,
        body.title.trim(),
        body.description || '',
        body.status || 'todo',
        body.priority || 'medium',
        body.due_date || null
      ]
    );
    return res.status(201).json({ task: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/tasks/:id — mise à jour partielle, uniquement ses propres tâches
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Identifiant invalide' });

    const body = req.body || {};
    const error = validateTask(body, { partial: true });
    if (error) return res.status(400).json({ error });

    // SET construit dynamiquement à partir d'une liste blanche de colonnes :
    // les noms de colonnes sont codés en dur, les valeurs toujours paramétrées ($n)
    const updates = [];
    const values = [];
    let i = 1;
    for (const key of ['title', 'description', 'status', 'priority', 'due_date']) {
      if (key in body) {
        updates.push(`${key} = $${i++}`);
        values.push(key === 'due_date' && body[key] === '' ? null : body[key]);
      }
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }
    updates.push('updated_at = now()');
    values.push(id, req.user.id);

    const result = await db.query(
      `UPDATE tasks SET ${updates.join(', ')}
       WHERE id = $${i++} AND user_id = $${i}
       RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tâche introuvable' });
    }
    return res.json({ task: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Identifiant invalide' });

    const result = await db.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tâche introuvable' });
    }
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
