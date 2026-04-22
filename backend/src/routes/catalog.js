import { Router } from 'express';
import { store } from '../db/store.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.use(authRequired);

router.get('/faculties', (req, res) => {
  res.json(store.faculties.list());
});

router.get('/courses', (req, res) => {
  res.json(store.courses.list());
});

router.get('/departments', (req, res) => {
  const { facultyId } = req.query;
  if (!facultyId) return res.status(400).json({ error: 'facultyId required' });
  res.json(store.departments.listByFaculty(facultyId));
});

router.get('/subjects', (req, res) => {
  const { departmentId, courseId } = req.query;
  if (!departmentId || !courseId) {
    return res.status(400).json({ error: 'departmentId and courseId required' });
  }
  res.json(store.subjects.listByDepartmentAndCourse(departmentId, courseId));
});

router.post('/departments', (req, res) => {
  const { facultyId, name } = req.body;
  if (!facultyId || !name) return res.status(400).json({ error: 'facultyId and name required' });
  try {
    const d = store.departments.create(facultyId, name.trim());
    res.json({ id: d.id, name: d.name });
  } catch (err) {
    if (err.code === 'DUPLICATE') return res.status(409).json({ error: 'Already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.post('/subjects', (req, res) => {
  const { departmentId, courseId, name } = req.body;
  if (!departmentId || !courseId || !name) {
    return res.status(400).json({ error: 'departmentId, courseId, name required' });
  }
  try {
    const s = store.subjects.create(departmentId, courseId, name.trim());
    res.json({ id: s.id, name: s.name });
  } catch (err) {
    if (err.code === 'DUPLICATE') return res.status(409).json({ error: 'Already exists' });
    res.status(500).json({ error: err.message });
  }
});

export default router;
