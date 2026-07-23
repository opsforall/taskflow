const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/db', () => ({
  query: jest.fn(),
  initSchema: jest.fn()
}));

const db = require('../src/db');
const app = require('../src/app');
const config = require('../src/config');

const TOKEN = jwt.sign({ id: 1, email: 'alice@example.com', name: 'Alice' }, config.jwtSecret, {
  expiresIn: '1h'
});

const TASK_ROW = {
  id: 42,
  user_id: 1,
  title: 'Déployer sur Kubernetes',
  description: 'ConfigMap + Secret',
  status: 'todo',
  priority: 'high',
  due_date: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z'
};

const auth = (req) => req.set('Authorization', `Bearer ${TOKEN}`);

beforeEach(() => jest.resetAllMocks());

describe('Protection JWT', () => {
  it('rejette une requête sans token (401)', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  it('rejette un token invalide (401)', async () => {
    const res = await request(app).get('/api/tasks').set('Authorization', 'Bearer token-bidon');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/tasks', () => {
  it("renvoie les tâches de l'utilisateur connecté", async () => {
    db.query.mockResolvedValueOnce({ rows: [TASK_ROW] });

    const res = await auth(request(app).get('/api/tasks'));

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    // La requête SQL filtre bien sur l'id de l'utilisateur du token
    expect(db.query.mock.calls[0][1]).toEqual([1]);
  });
});

describe('POST /api/tasks', () => {
  it('crée une tâche (201)', async () => {
    db.query.mockResolvedValueOnce({ rows: [TASK_ROW] });

    const res = await auth(request(app).post('/api/tasks')).send({
      title: 'Déployer sur Kubernetes',
      priority: 'high'
    });

    expect(res.status).toBe(201);
    expect(res.body.task.title).toBe('Déployer sur Kubernetes');
  });

  it('rejette une tâche sans titre (400)', async () => {
    const res = await auth(request(app).post('/api/tasks')).send({ description: 'sans titre' });
    expect(res.status).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejette un statut hors liste blanche (400)', async () => {
    const res = await auth(request(app).post('/api/tasks')).send({
      title: 'Test',
      status: 'hacked'
    });
    expect(res.status).toBe(400);
  });

  it('rejette une priorité hors liste blanche (400)', async () => {
    const res = await auth(request(app).post('/api/tasks')).send({
      title: 'Test',
      priority: 'urgente'
    });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/tasks/:id', () => {
  it('met à jour une tâche (200)', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ ...TASK_ROW, status: 'done' }] });

    const res = await auth(request(app).put('/api/tasks/42')).send({ status: 'done' });

    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('done');
  });

  it("renvoie 404 pour une tâche qui n'appartient pas à l'utilisateur", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await auth(request(app).put('/api/tasks/999')).send({ status: 'done' });
    expect(res.status).toBe(404);
  });

  it('rejette un identifiant non numérique (400)', async () => {
    const res = await auth(request(app).put('/api/tasks/abc')).send({ status: 'done' });
    expect(res.status).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejette une mise à jour sans aucun champ (400)', async () => {
    const res = await auth(request(app).put('/api/tasks/42')).send({});
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/tasks/:id', () => {
  it('supprime une tâche (204)', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 42 }] });

    const res = await auth(request(app).delete('/api/tasks/42'));
    expect(res.status).toBe(204);
  });

  it("renvoie 404 si la tâche n'existe pas", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await auth(request(app).delete('/api/tasks/999'));
    expect(res.status).toBe(404);
  });
});
