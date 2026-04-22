import bcrypt from 'bcryptjs';

const DEV_PASSWORD_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

function makeCounter(start = 1) {
  let n = start;
  return () => n++;
}

const nextUserId = makeCounter();
const nextFacultyId = makeCounter();
const nextCourseId = makeCounter();
const nextDepartmentId = makeCounter();
const nextSubjectId = makeCounter();
const nextTestId = makeCounter();

export const users = new Map();
export const faculties = new Map();
export const courses = new Map();
export const departments = new Map();
export const subjects = new Map();
export const tests = new Map();

export const store = {
  users: {
    create({ email, passwordHash, fullName = null, role = 'teacher' }) {
      const normalized = email.toLowerCase().trim();
      for (const u of users.values()) {
        if (u.email === normalized) {
          const err = new Error('Email already registered');
          err.code = 'DUPLICATE_EMAIL';
          throw err;
        }
      }
      const user = {
        id: nextUserId(),
        email: normalized,
        password_hash: passwordHash,
        full_name: fullName,
        role,
        created_at: new Date(),
      };
      users.set(user.id, user);
      return user;
    },
    findByEmail(email) {
      const normalized = email.toLowerCase().trim();
      for (const u of users.values()) {
        if (u.email === normalized) return u;
      }
      return null;
    },
    findById(id) {
      return users.get(Number(id)) || null;
    },
    ensureDevUser() {
      let user = this.findByEmail('dev@local');
      if (user) return user;
      user = {
        id: nextUserId(),
        email: 'dev@local',
        password_hash: DEV_PASSWORD_HASH,
        full_name: 'Локальная сессия',
        role: 'teacher',
        created_at: new Date(),
      };
      users.set(user.id, user);
      return user;
    },
  },

  faculties: {
    list() {
      return [...faculties.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    },
    findByName(name) {
      for (const f of faculties.values()) {
        if (f.name === name) return f;
      }
      return null;
    },
    create(name) {
      const existing = this.findByName(name);
      if (existing) return existing;
      const f = { id: nextFacultyId(), name };
      faculties.set(f.id, f);
      return f;
    },
  },

  courses: {
    list() {
      return [...courses.values()].sort((a, b) => a.number - b.number);
    },
    findByNumber(number) {
      for (const c of courses.values()) {
        if (c.number === number) return c;
      }
      return null;
    },
    create(number, name) {
      const existing = this.findByNumber(number);
      if (existing) return existing;
      const c = { id: nextCourseId(), number, name };
      courses.set(c.id, c);
      return c;
    },
  },

  departments: {
    listByFaculty(facultyId) {
      const fid = Number(facultyId);
      return [...departments.values()]
        .filter((d) => d.faculty_id === fid)
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    },
    findById(id) {
      return departments.get(Number(id)) || null;
    },
    create(facultyId, name) {
      const fid = Number(facultyId);
      for (const d of departments.values()) {
        if (d.faculty_id === fid && d.name === name) {
          const err = new Error('Department already exists');
          err.code = 'DUPLICATE';
          throw err;
        }
      }
      const d = { id: nextDepartmentId(), faculty_id: fid, name };
      departments.set(d.id, d);
      return d;
    },
  },

  subjects: {
    listByDepartmentAndCourse(departmentId, courseId) {
      const did = Number(departmentId);
      const cid = Number(courseId);
      return [...subjects.values()]
        .filter((s) => s.department_id === did && s.course_id === cid)
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    },
    findById(id) {
      return subjects.get(Number(id)) || null;
    },
    create(departmentId, courseId, name) {
      const did = Number(departmentId);
      const cid = Number(courseId);
      for (const s of subjects.values()) {
        if (s.department_id === did && s.course_id === cid && s.name === name) {
          const err = new Error('Subject already exists');
          err.code = 'DUPLICATE';
          throw err;
        }
      }
      const s = {
        id: nextSubjectId(),
        department_id: did,
        course_id: cid,
        name,
      };
      subjects.set(s.id, s);
      return s;
    },
  },

  tests: {
    listByUser(userId) {
      const uid = Number(userId);
      return [...tests.values()]
        .filter((t) => t.user_id === uid)
        .sort((a, b) => b.created_at - a.created_at)
        .map((t) => enrichTest(t, { summary: true }));
    },
    findByIdForUser(id, userId) {
      const t = tests.get(Number(id));
      if (!t || t.user_id !== Number(userId)) return null;
      return enrichTest(t, { full: true });
    },
    create({ userId, title, facultyId, courseId, departmentId, subjectId, config, questions, pipelineLog }) {
      const now = new Date();
      const t = {
        id: nextTestId(),
        user_id: Number(userId),
        title,
        faculty_id: facultyId ? Number(facultyId) : null,
        course_id: courseId ? Number(courseId) : null,
        department_id: departmentId ? Number(departmentId) : null,
        subject_id: subjectId ? Number(subjectId) : null,
        config: config || {},
        questions: questions || [],
        pipeline_log: pipelineLog || [],
        created_at: now,
        updated_at: now,
      };
      tests.set(t.id, t);
      return t;
    },
    update(id, userId, { title, questions }) {
      const t = tests.get(Number(id));
      if (!t || t.user_id !== Number(userId)) return false;
      if (title != null) t.title = title;
      if (questions != null) t.questions = questions;
      t.updated_at = new Date();
      return true;
    },
    delete(id, userId) {
      const t = tests.get(Number(id));
      if (!t || t.user_id !== Number(userId)) return false;
      tests.delete(Number(id));
      return true;
    },
  },
};

function enrichTest(t, { summary = false, full = false } = {}) {
  const faculty = t.faculty_id ? faculties.get(t.faculty_id) : null;
  const course = t.course_id ? courses.get(t.course_id) : null;
  const department = t.department_id ? departments.get(t.department_id) : null;
  const subject = t.subject_id ? subjects.get(t.subject_id) : null;

  if (summary) {
    return {
      id: t.id,
      title: t.title,
      created_at: t.created_at,
      updated_at: t.updated_at,
      faculty: faculty?.name || null,
      course: course?.name || null,
      department: department?.name || null,
      subject: subject?.name || null,
      question_count: Array.isArray(t.questions) ? t.questions.length : 0,
    };
  }

  if (full) {
    return {
      ...t,
      faculty_name: faculty?.name || null,
      course_name: course?.name || null,
      department_name: department?.name || null,
      subject_name: subject?.name || null,
    };
  }

  return t;
}

export function seedCatalog() {
  const courseDefs = [
    [1, '1 курс'], [2, '2 курс'], [3, '3 курс'],
    [4, '4 курс'], [5, '5 курс'], [6, '6 курс'],
  ];
  for (const [number, name] of courseDefs) store.courses.create(number, name);

  const facultyNames = [
    'Лечебный факультет',
    'Педиатрический факультет',
    'Стоматологический факультет',
    'Медико-профилактический факультет',
    'Фармацевтический факультет',
  ];
  for (const name of facultyNames) store.faculties.create(name);

  const pediatric = store.faculties.findByName('Педиатрический факультет');
  const therapeutic = store.faculties.findByName('Лечебный факультет');

  const pediatricDepts = [
    'Кафедра пропедевтики детских болезней',
    'Кафедра педиатрии',
    'Кафедра детских инфекционных болезней',
    'Кафедра детской хирургии',
    'Кафедра неонатологии',
  ];
  for (const name of pediatricDepts) {
    try { store.departments.create(pediatric.id, name); } catch {}
  }

  const therapeuticDepts = [
    'Кафедра внутренних болезней',
    'Кафедра хирургии',
    'Кафедра акушерства и гинекологии',
    'Кафедра инфекционных болезней',
    'Кафедра фармакологии',
  ];
  for (const name of therapeuticDepts) {
    try { store.departments.create(therapeutic.id, name); } catch {}
  }

  const propedeuticsDept = [...departments.values()].find(
    (d) => d.faculty_id === pediatric.id && d.name === 'Кафедра пропедевтики детских болезней'
  );
  const pediatricsDept = [...departments.values()].find(
    (d) => d.faculty_id === pediatric.id && d.name === 'Кафедра педиатрии'
  );

  const course3 = store.courses.findByNumber(3);
  const course4 = store.courses.findByNumber(4);
  const course5 = store.courses.findByNumber(5);

  if (propedeuticsDept && course3) {
    for (const name of ['Пропедевтика детских болезней', 'Семиотика поражений органов и систем у детей']) {
      try { store.subjects.create(propedeuticsDept.id, course3.id, name); } catch {}
    }
  }

  if (pediatricsDept) {
    for (const c of [course4, course5]) {
      if (!c) continue;
      for (const name of ['Факультетская педиатрия', 'Госпитальная педиатрия']) {
        try { store.subjects.create(pediatricsDept.id, c.id, name); } catch {}
      }
    }
  }

  store.users.ensureDevUser();
}

seedCatalog();

export { DEV_PASSWORD_HASH };
