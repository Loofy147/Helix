const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000;

const helixStateFile = path.join(__dirname, 'STATE_OF_THE_HELIX.md');

// Use CORS middleware to allow requests from the frontend
app.use(cors());
// Use express.json() middleware to parse JSON bodies
app.use(express.json());

// Endpoint to get the current state of the Helix
app.get('/api/helix-state', async (req, res) => {
    try {
        const data = await fs.readFile(helixStateFile, 'utf8');
        res.send(data);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error reading the Helix state file.');
    }
});

// Endpoint to append a new cycle to the Helix state
app.post('/api/helix-state', async (req, res) => {
    const { newCycle } = req.body;

    if (!newCycle) {
        return res.status(400).send('No new cycle content provided.');
    }

    try {
        await fs.appendFile(helixStateFile, newCycle, 'utf8');
        res.status(200).send('New cycle added successfully.');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error appending to the Helix state file.');
    }
});

app.listen(port, () => {
    console.log(`Helix server listening at http://localhost:${port}`);
});
