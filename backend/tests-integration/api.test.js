// Tests d'INTÉGRATION : l'API Express est exercée contre une VRAIE base
// PostgreSQL (aucun mock). On valide ici ce que les tests unitaires ne peuvent
// pas voir : le vrai schéma SQL, les contraintes (UNIQUE, CHECK), la persistance
// réelle et l'isolation des données entre utilisateurs.
//
// Variables d'environnement attendues (fournies par docker/CI) : DB_HOST,
// DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET.
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

beforeAll(async () => {
  await db.initSchema();
});

afterAll(async () => {
  // Ferme le pool, sinon Jest ne rend pas la main
  await db.pool.end();
});

beforeEach(async () => {
  // Isolation : on repart d'une base vide avant chaque test
  await db.query('TRUNCATE tasks, users RESTART IDENTITY CASCADE');
});

async function registerAndGetToken(email = 'alice@example.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Alice', email, password: 'Password123' });
  return res.body.token;
}

describe('Intégration · authentification (vraie PostgreSQL)', () => {
  it('inscrit un utilisateur et le persiste réellement en base', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: 'Password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();

    const rows = await db.query('SELECT email FROM users WHERE email = $1', ['alice@example.com']);
    expect(rows.rows).toHaveLength(1);
  });

  it('connecte un utilisateur inscrit', async () => {
    await registerAndGetToken('bob@example.com');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@example.com', password: 'Password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejette un email déjà utilisé via la contrainte UNIQUE réelle (409)', async () => {
    await registerAndGetToken('dup@example.com');

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'dup@example.com', password: 'Password123' });

    expect(res.status).toBe(409);
  });
});

describe('Intégration · cycle de vie des tâches', () => {
  it('crée, liste, met à jour puis supprime une tâche', async () => {
    const token = await registerAndGetToken();
    const auth = (req) => req.set('Authorization', `Bearer ${token}`);

    const created = await auth(request(app).post('/api/tasks')).send({
      title: "Tâche d'intégration",
      priority: 'high'
    });
    expect(created.status).toBe(201);
    const id = created.body.task.id;

    const listed = await auth(request(app).get('/api/tasks'));
    expect(listed.body.tasks).toHaveLength(1);

    const updated = await auth(request(app).put(`/api/tasks/${id}`)).send({ status: 'done' });
    expect(updated.body.task.status).toBe('done');

    const deleted = await auth(request(app).delete(`/api/tasks/${id}`));
    expect(deleted.status).toBe(204);

    const after = await auth(request(app).get('/api/tasks'));
    expect(after.body.tasks).toHaveLength(0);
  });

  it('applique la contrainte CHECK sur le statut (400)', async () => {
    const token = await registerAndGetToken();
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Tâche', status: 'statut_invalide' });

    expect(res.status).toBe(400);
  });

  it('isole les tâches : un utilisateur ne voit pas celles des autres', async () => {
    const tokenA = await registerAndGetToken('a@example.com');
    const tokenB = await registerAndGetToken('b@example.com');

    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Tâche de A' });

    const listB = await request(app).get('/api/tasks').set('Authorization', `Bearer ${tokenB}`);
    expect(listB.status).toBe(200);
    expect(listB.body.tasks).toHaveLength(0);
  });
});
