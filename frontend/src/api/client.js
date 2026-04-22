const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

export function setAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function currentUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearAuth();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    let msg = 'Request failed';
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch {}
    throw new Error(msg);
  }

  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return res.json();
  }
  return res;
}

export const api = {
  // catalog
  faculties: () => request('/catalog/faculties'),
  courses: () => request('/catalog/courses'),
  departments: (facultyId) =>
    request(`/catalog/departments?facultyId=${facultyId}`),
  subjects: (departmentId, courseId) =>
    request(`/catalog/subjects?departmentId=${departmentId}&courseId=${courseId}`),
  createDepartment: (facultyId, name) =>
    request('/catalog/departments', {
      method: 'POST',
      body: JSON.stringify({ facultyId, name }),
    }),
  createSubject: (departmentId, courseId, name) =>
    request('/catalog/subjects', {
      method: 'POST',
      body: JSON.stringify({ departmentId, courseId, name }),
    }),

  // generation
  generate: (payload) =>
    request('/generate', { method: 'POST', body: JSON.stringify(payload) }),

  // tests
  listTests: () => request('/tests'),
  getTest: (id) => request(`/tests/${id}`),
  saveTest: (payload) =>
    request('/tests', { method: 'POST', body: JSON.stringify(payload) }),
  updateTest: (id, payload) =>
    request(`/tests/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteTest: (id) => request(`/tests/${id}`, { method: 'DELETE' }),
  exportUrl: (id, opts = {}) => {
    const token = getToken();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const q = opts.format === 'classic' ? '?format=classic' : '';
    return fetch(`${BASE}/tests/${id}/export${q}`, { headers }).then(async (res) => {
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test_${id}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  },

  /** Выгрузка Word до сохранения теста (формат @ / # / #&). */
  exportDocxPreview: async ({
    title,
    questions,
    meta,
    format = 'symbol',
    filename = 'medtest_export.docx',
  }) => {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE}/export-docx`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, questions, meta, format }),
    });
    if (res.status === 401) {
      clearAuth();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      let msg = 'Export failed';
      try {
        const data = await res.json();
        msg = data.error || msg;
      } catch {}
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
