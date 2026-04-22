import { Router } from 'express';
import { store } from '../db/store.js';
import { authRequired } from '../middleware/auth.js';
import { buildDocx } from '../services/docx.js';

const router = Router();
router.use(authRequired);

router.get('/', (req, res) => {
  res.json(store.tests.listByUser(req.user.id));
});

router.get('/:id', (req, res) => {
  const test = store.tests.findByIdForUser(req.params.id, req.user.id);
  if (!test) return res.status(404).json({ error: 'Not found' });
  res.json(test);
});

router.post('/', (req, res) => {
  const {
    title,
    facultyId,
    courseId,
    departmentId,
    subjectId,
    config,
    questions,
    pipelineLog,
  } = req.body;

  if (!title || !Array.isArray(questions)) {
    return res.status(400).json({ error: 'title and questions required' });
  }

  const t = store.tests.create({
    userId: req.user.id,
    title,
    facultyId,
    courseId,
    departmentId,
    subjectId,
    config: config || {},
    questions,
    pipelineLog: pipelineLog || [],
  });
  res.json({ id: t.id });
});

router.put('/:id', (req, res) => {
  const { title, questions } = req.body;
  const ok = store.tests.update(req.params.id, req.user.id, { title, questions });
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const ok = store.tests.delete(req.params.id, req.user.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.get('/:id/export', async (req, res) => {
  const test = store.tests.findByIdForUser(req.params.id, req.user.id);
  if (!test) return res.status(404).json({ error: 'Not found' });

  const format = req.query.format === 'classic' ? 'classic' : 'symbol';

  const buffer = await buildDocx({
    title: test.title,
    test: {
      questions: test.questions,
      meta: {
        faculty: test.faculty_name,
        course: test.course_name,
        department: test.department_name,
        subject: test.subject_name,
      },
    },
    format,
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="test_${test.id}.docx"`
  );
  res.send(buffer);
});

export default router;
