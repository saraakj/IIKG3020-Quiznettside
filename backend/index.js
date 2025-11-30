const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const pdf = require('pdf-parse');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.get('/api/ping', (req, res) => {
  res.json({ ok: true, message: 'pong' });
});

// Placeholder endpoint for quizzes
const fs = require('fs');

const QUIZ_DIR = path.join(__dirname, 'quizes');

// Return list of quizzes by reading JSON files in `quizes` folder.
app.get('/api/quizzes', async (req, res) => {
  try {
    const items = []
    if (fs.existsSync(QUIZ_DIR)) {
      const files = fs.readdirSync(QUIZ_DIR)
      for (const f of files) {
        if (!f.toLowerCase().endsWith('.json')) continue
        try {
          const raw = fs.readFileSync(path.join(QUIZ_DIR, f), 'utf8')
          const parsed = JSON.parse(raw)
          // ensure minimal shape
          if (parsed && parsed.id) items.push(parsed)
        } catch (err) {
          console.warn('failed to load quiz', f, err.message)
        }
      }
    }
    // Sort quizzes so newest (by year in id or title) come first
    const getYear = (q) => {
      const src = `${q.id || ''} ${q.title || ''}`;
      const m = src.match(/\b(19|20)\d{2}\b/);
      return m ? parseInt(m[0], 10) : null;
    };

    items.sort((a, b) => {
      const ya = getYear(a) || 0;
      const yb = getYear(b) || 0;
      if (ya !== yb) return yb - ya; // newest first
      return (a.title || '').localeCompare(b.title || '');
    });

    // If no quizzes found, return a small default set so frontend still works
    if (items.length === 0) {
      items.push({
        id: 'sample-1',
        title: 'Sample Quiz: Biology Basics',
        questions: [
          { question: 'Which organelle is known as the powerhouse of the cell?', choices: ['Mitochondria', 'Nucleus', 'Ribosome', 'Golgi apparatus'], answerIndex: 0 },
        ],
      })
    }

    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get a single quiz by id. First tries `quizes/<id>.json`, then searches files for a matching `id` field.
app.get('/api/quizzes/:id', (req, res) => {
  const id = req.params.id
  try {
    if (fs.existsSync(QUIZ_DIR)) {
      const direct = path.join(QUIZ_DIR, `${id}.json`)
      if (fs.existsSync(direct)) {
        const raw = fs.readFileSync(direct, 'utf8')
        return res.json(JSON.parse(raw))
      }

      const files = fs.readdirSync(QUIZ_DIR)
      for (const f of files) {
        if (!f.toLowerCase().endsWith('.json')) continue
        try {
          const raw = fs.readFileSync(path.join(QUIZ_DIR, f), 'utf8')
          const parsed = JSON.parse(raw)
          if (parsed && parsed.id === id) return res.json(parsed)
        } catch (err) {
          // ignore
        }
      }
    }

    // not found
    res.status(404).json({ error: 'quiz not found' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Upload PDF and extract selectable text
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required (field name: file)' });
  try {
    const data = await pdf(req.file.buffer);
    // `data.text` contains the extracted selectable text
    res.json({ text: data.text });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'extraction failed' });
  }
});
// (Generation endpoint removed by user request)

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Quiz backend listening on ${PORT}`));
