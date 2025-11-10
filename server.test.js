// 1. Mock the database module at the top
jest.mock('./database');

const request = require('supertest');
const { openDb } = require('./database'); // This is now the mocked openDb function
const app = require('./server'); // app will use the mocked version of the database
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

describe('Helix API', () => {
    let db; // This will be our in-memory database instance

    beforeAll(async () => {
        // 2. Create a real in-memory SQLite database connection
        db = await open({
            filename: ':memory:',
            driver: sqlite3.Database
        });

        // 3. Configure the mocked openDb function to return our in-memory db
        openDb.mockResolvedValue(db);

        // 4. Set up the schema for our in-memory database
        await db.exec(`
            CREATE TABLE vectors (id INTEGER PRIMARY KEY, vector TEXT);
            CREATE TABLE cycles (id INTEGER PRIMARY KEY, title TEXT, number INTEGER UNIQUE);
            CREATE TABLE phases (id INTEGER PRIMARY KEY, cycle_id INTEGER, phase_name TEXT, question TEXT, answer TEXT);
        `);
    });

    beforeEach(async () => {
        // 5. Clean and seed the database before each test
        await db.exec('DELETE FROM phases; DELETE FROM cycles; DELETE FROM vectors;');
        await db.run("INSERT INTO vectors (vector) VALUES ('Initial Test Vector')");
        await db.run("INSERT INTO cycles (id, title, number) VALUES (1, 'Cycle 1', 1)");
        await db.run("INSERT INTO phases (cycle_id, phase_name, question, answer) VALUES (1, 'observe', 'Q1', 'A1')");
        await db.run("INSERT INTO phases (cycle_id, phase_name, question, answer) VALUES (1, 'build', 'Q2', 'A2')");
        await db.run("INSERT INTO phases (cycle_id, phase_name, question, answer) VALUES (1, 'criticize', 'Q3', 'A3')");
        await db.run("INSERT INTO phases (cycle_id, phase_name, question, answer) VALUES (1, 'decide', 'Q4', 'A4')");
    });

    afterAll(async () => {
        // 6. Close the database connection
        await db.close();
    });

    it('should fetch the full state on GET /api/helix-state', async () => {
        const res = await request(app).get('/api/helix-state');
        expect(res.statusCode).toEqual(200);
        expect(res.body.vector).toBe('Initial Test Vector');
        expect(res.body.cycles.length).toBe(1);
        expect(res.body.cycles[0].phases.observe.answer).toBe('A1');
    });

    it('should add a new cycle on POST /api/helix-state', async () => {
        const res = await request(app)
            .post('/api/helix-state')
            .send({ title: 'New Test Cycle' });
        expect(res.statusCode).toEqual(200);

        // Verify directly against the database
        const cycle = await db.get("SELECT * FROM cycles WHERE number = 2");
        expect(cycle).toBeDefined();
        expect(cycle.title).toBe('New Test Cycle');
        const phases = await db.all("SELECT * FROM phases WHERE cycle_id = ?", cycle.id);
        expect(phases.length).toBe(4); // Ensure all 4 phases were created
    });

    it('should update a phase on PUT /api/helix-state', async () => {
        const res = await request(app)
            .put('/api/helix-state')
            .send({ cycleNumber: 1, phase: 'observe', answer: 'Updated Answer' });
        expect(res.statusCode).toEqual(200);

        // Verify directly against the database
        const phase = await db.get("SELECT * FROM phases WHERE cycle_id = 1 AND phase_name = 'observe'");
        expect(phase.answer).toBe('Updated Answer');
    });
});
