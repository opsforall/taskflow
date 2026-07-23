const request = require('supertest');
const bcrypt = require('bcryptjs');

// La base est mockée : ce sont des tests unitaires purs, aucun PostgreSQL requis
jest.mock('../src/db', () => ({
  query: jest.fn(),
  initSchema: jest.fn()
}));

const db = require('../src/db');
const app = require('../src/app');

const USER_ROW = {
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
  password_hash: bcrypt.hashSync('Password123', 10),
  created_at: '2026-01-01T00:00:00.000Z'
};

beforeEach(() => jest.resetAllMocks());

describe('POST /api/auth/register', () => {
  it('crée un compte et renvoie un token', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] }) // email pas encore utilisé
      .mockResolvedValueOnce({ rows: [USER_ROW] }); // insertion

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: 'Password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('alice@example.com');
  });

  it('ne renvoie jamais le hash du mot de passe', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [USER_ROW] });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: 'Password123' });

    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('rejette un email invalide', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'pas-un-email', password: 'Password123' });

    expect(res.status).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejette un mot de passe trop court', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: 'court' });

    expect(res.status).toBe(400);
  });

  it('rejette un email déjà utilisé (409)', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: 'Password123' });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('connecte un utilisateur avec les bons identifiants', async () => {
    db.query.mockResolvedValueOnce({ rows: [USER_ROW] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'Password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('rejette un mauvais mot de passe (401)', async () => {
    db.query.mockResolvedValueOnce({ rows: [USER_ROW] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'MauvaisMotDePasse' });

    expect(res.status).toBe(401);
  });

  it("renvoie le même message pour un email inconnu (pas d'énumération de comptes)", async () => {
    db.query.mockResolvedValueOnce({ rows: [USER_ROW] });
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'MauvaisMotDePasse' });

    db.query.mockResolvedValueOnce({ rows: [] });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inconnu@example.com', password: 'Password123' });

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.error).toBe(wrongPassword.body.error);
  });

  it('rejette une requête sans mot de passe (400)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@example.com' });

    expect(res.status).toBe(400);
  });
});
