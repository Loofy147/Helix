const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000;

const stateJsonFile = path.join(__dirname, 'state.json');
const helixStateFile = path.join(__dirname, 'STATE_OF_THE_HELIX.md');

app.use(cors());
app.use(express.json());

function generateMarkdown(state) {
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
    return markdown;
}

async function readState() {
    const data = await fs.readFile(stateJsonFile, 'utf8');
    return JSON.parse(data);
}

async function writeState(state) {
    await fs.writeFile(stateJsonFile, JSON.stringify(state, null, 2), 'utf8');
    const markdown = generateMarkdown(state);
    await fs.writeFile(helixStateFile, markdown, 'utf8');
}

app.get('/api/helix-state', async (req, res) => {
    try {
        const state = await readState();
        const markdown = generateMarkdown(state);
        res.send(markdown);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error reading the Helix state.');
    }
});

app.post('/api/helix-state', async (req, res) => {
    const { title } = req.body;
    if (!title) {
        return res.status(400).send('No title provided.');
    }
    try {
        const state = await readState();
        const newCycle = {
            title: title,
            number: state.cycles.length + 1,
            phases: {
                observe: { question: "What has changed, and what is the most important truth we need to learn right now?", answer: "" },
                build: { question: "What is the fastest, cheapest experiment we can run to answer our most important question?", answer: "" },
                criticize: { question: "Did the experiment's result validate or invalidate our hypothesis? What did we learn?", answer: "" },
                decide: { question: "Based on what we just learned, what is our next move?", answer: "" }
            }
        };
        state.cycles.push(newCycle);
        await writeState(state);
        res.status(200).send('New cycle added successfully.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error adding new cycle.');
    }
});

app.put('/api/helix-state', async (req, res) => {
    const { cycleNumber, phase, answer } = req.body;
    if (!cycleNumber || !phase || answer === undefined) {
        return res.status(400).send('Missing required fields.');
    }
    try {
        const state = await readState();
        const cycle = state.cycles.find(c => c.number === cycleNumber);
        if (!cycle) {
            return res.status(404).send('Cycle not found.');
        }
        if (!cycle.phases[phase]) {
            return res.status(404).send('Phase not found.');
        }
        cycle.phases[phase].answer = answer;
        await writeState(state);
        res.status(200).send('State updated successfully.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating state.');
    }
});

app.listen(port, () => {
    console.log(`Helix server listening at http://localhost:${port}`);
});
