const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { openDb } = require('./database');

const app = express();
const port = 3000;

const helixStateFile = path.join(__dirname, 'STATE_OF_THE_HELIX.md');

// Simple request logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Serve static files from the project root
app.use(express.static(__dirname));
app.use(express.json());

async function getFullState() {
    const db = await openDb();
    const vector = await db.get('SELECT vector FROM vectors ORDER BY id DESC LIMIT 1');
    const cycles = await db.all('SELECT * FROM cycles ORDER BY number');

    for (const cycle of cycles) {
        cycle.phases = {};
        const phases = await db.all('SELECT * FROM phases WHERE cycle_id = ?', cycle.id);
        for (const phase of phases) {
            cycle.phases[phase.phase_name] = {
                question: phase.question,
                answer: phase.answer
            };
        }
    }

    return {
        vector: vector.vector,
        cycles: cycles
    };
}

async function writeMarkdown(state) {
    let markdown = `# State of the Helix\n\n## Current Vector\n${state.vector}\n`;
    state.cycles.forEach(cycle => {
        markdown += `
---

## Cycle ${cycle.number}: ${cycle.title}

### Phase 1: Observe
* **${cycle.phases.observe.question}**
  > ${cycle.phases.observe.answer}

### Phase 2: Build
* **${cycle.phases.build.question}**
  > ${cycle.phases.build.answer}

### Phase 3: Criticize
* **${cycle.phases.criticize.question}**
  > ${cycle.phases.criticize.answer}

### Phase 4: Decide
* **${cycle.phases.decide.question}**
  > ${cycle.phases.decide.answer}
`;
    });
    await fs.writeFile(helixStateFile, markdown, 'utf8');
}

app.get('/api/helix-state', async (req, res) => {
    try {
        console.log('Reading and generating Helix state markdown from database...');
        const state = await getFullState();
        await writeMarkdown(state); // For backwards compatibility with any system reading the file
        res.json(state); // Send structured JSON to the frontend
    } catch (err) {
        console.error('Error reading Helix state:', err);
        res.status(500).send('Error reading the Helix state.');
    }
});

app.post('/api/helix-state', async (req, res) => {
    const { title } = req.body;
    if (!title) {
        console.warn('Attempted to add a cycle with no title.');
        return res.status(400).send('No title provided.');
    }
    try {
        console.log(`Adding new cycle with title: "${title}"`);
        const db = await openDb();
        const highestNumber = await db.get('SELECT MAX(number) as max FROM cycles');
        const newCycleNumber = (highestNumber.max || 0) + 1;

        const result = await db.run('INSERT INTO cycles (title, number) VALUES (?, ?)', title, newCycleNumber);
        const cycleId = result.lastID;

        const phases = [
            { name: 'observe', question: "What has changed, and what is the most important truth we need to learn right now?" },
            { name: 'build', question: "What is the fastest, cheapest experiment we can run to answer our most important question?" },
            { name: 'criticize', question: "Did the experiment's result validate or invalidate our hypothesis? What did we learn?" },
            { name: 'decide', question: "Based on what we just learned, what is our next move?" }
        ];

        for (const phase of phases) {
            await db.run(
                'INSERT INTO phases (cycle_id, phase_name, question, answer) VALUES (?, ?, ?, ?)',
                cycleId, phase.name, phase.question, ""
            );
        }

        console.log(`Successfully added cycle ${newCycleNumber}.`);
        res.status(200).send('New cycle added successfully.');
    } catch (err) {
        console.error('Error adding new cycle:', err);
        res.status(500).send('Error adding new cycle.');
    }
});

app.put('/api/helix-state', async (req, res) => {
    const { cycleNumber, phase, answer } = req.body;
    if (!cycleNumber || !phase || answer === undefined) {
        console.warn('Update request missing required fields:', { cycleNumber, phase, answer: answer !== undefined });
        return res.status(400).send('Missing required fields.');
    }
    try {
        console.log(`Updating Cycle ${cycleNumber}, Phase "${phase}"...`);
        const db = await openDb();
        const cycle = await db.get('SELECT * FROM cycles WHERE number = ?', cycleNumber);

        if (!cycle) {
            console.warn(`Attempted to update a non-existent cycle: ${cycleNumber}`);
            return res.status(404).send('Cycle not found.');
        }

        await db.run(
            'UPDATE phases SET answer = ? WHERE cycle_id = ? AND phase_name = ?',
            answer, cycle.id, phase
        );

        console.log(`Successfully updated Cycle ${cycleNumber}.`);
        res.status(200).send('State updated successfully.');
    } catch (err) {
        console.error(`Error updating state for Cycle ${cycleNumber}:`, err);
        res.status(500).send('Error updating state.');
    }
});

// Start the server only if this file is run directly
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Helix server listening at http://localhost:${port}`);
    });
}

module.exports = app;
