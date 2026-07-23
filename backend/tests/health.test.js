const request = require('supertest');

jest.mock('../src/db', () => ({
  query: jest.fn(),
  initSchema: jest.fn()
}));

const db = require('../src/db');
const app = require('../src/app');

beforeEach(() => jest.resetAllMocks());

describe('Probes de santé (Kubernetes)', () => {
  it('GET /api/health répond ok (liveness)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/health/ready répond ready quand la base répond (readiness)', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  it('GET /api/health/ready répond 503 quand la base est injoignable', async () => {
    db.query.mockRejectedValueOnce(new Error('connexion refusée'));
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(503);
  });

  it('renvoie 404 en JSON pour une route inconnue', async () => {
    const res = await request(app).get('/api/inexistant');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
