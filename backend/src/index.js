import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import testsRoutes from './routes/tests.js';
import { authRequired } from './middleware/auth.js';
import { runPipeline } from './services/pipeline.js';
import { buildDocx } from './services/docx.js';

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  })
);
app.use(express.json({ limit: '2mb' }));

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Публичные
app.use('/api/auth', authRoutes);

// Защищённые
app.use('/api/catalog', catalogRoutes);
app.use('/api/tests', testsRoutes);

// Запуск пайплайна генерации (защищённый endpoint)
app.post('/api/generate', authRequired, async (req, res) => {
  const { faculty, course, department, subject, topics, language, skipReview } = req.body;

  if (!faculty || !course || !department || !subject || !Array.isArray(topics) || topics.length === 0) {
    return res.status(400).json({
      error: 'faculty, course, department, subject and topics[] required',
    });
  }

  for (const t of topics) {
    if (!t.topic || !t.type || !t.difficulty || !t.count) {
      return res.status(400).json({
        error: 'Each topic must have: topic, type, difficulty, count',
      });
    }
    if (!['knowledge', 'understanding'].includes(t.type)) {
      return res.status(400).json({ error: 'type must be knowledge or understanding' });
    }
    if (!['easy', 'medium', 'hard'].includes(t.difficulty)) {
      return res.status(400).json({ error: 'difficulty must be easy, medium or hard' });
    }
    if (t.count < 1 || t.count > 20) {
      return res.status(400).json({ error: 'count must be 1..20' });
    }
  }

  const lang = language && ['ru', 'tj', 'en'].includes(language) ? language : 'ru';

  try {
    const result = await runPipeline({
      faculty,
      course,
      department,
      subject,
      topics,
      language: lang,
      skipReview: Boolean(skipReview),
    });
    res.json(result);
  } catch (err) {
    console.error('Pipeline error:', err);
    res.status(500).json({ error: err.message || 'Pipeline failed' });
  }
});

/** Выгрузка .docx без сохранения теста. */
app.post('/api/export-docx', authRequired, async (req, res) => {
  try {
    const { title, questions, meta, format } = req.body;
    if (!title || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'title and questions[] required' });
    }
    const fmt = format === 'classic' ? 'classic' : 'symbol';
    const buffer = await buildDocx({
      title,
      test: { questions, meta: meta || {} },
      format: fmt,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="medtest_export.docx"'
    );
    res.send(buffer);
  } catch (err) {
    console.error('export-docx:', err);
    res.status(500).json({ error: err.message || 'Export failed' });
  }
});

// Статика фронтенда (после сборки: frontend/dist) — один URL на Railway
const distPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Server error' });
});

// Проверка критичных переменных окружения при старте
const skipAuth = process.env.SKIP_AUTH === 'true' || process.env.SKIP_AUTH === '1';
if (!skipAuth && !process.env.JWT_SECRET) {
  console.warn('⚠ JWT_SECRET не задан, а SKIP_AUTH выключен. Auth-эндпоинты не будут работать.');
}
if (!process.env.OPENAI_API_KEY?.trim() && !process.env.ANTHROPIC_API_KEY?.trim()) {
  console.warn('⚠ Ни OPENAI_API_KEY, ни ANTHROPIC_API_KEY не заданы. Генерация работать не будет.');
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✓ Backend running at http://localhost:${PORT}`);
});
