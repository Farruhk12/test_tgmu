import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { questionToSymbolLines } from '../lib/questionFormat.js';

const MAX_TOPICS = 15;
const QUICK_FILL_VALUES = [1, 5, 10, 20];

const DIFF_LABEL_RU = {
  easy: 'лёгкие',
  medium: 'средние',
  hard: 'сложные',
};

const TYPE_OPTIONS = [
  { value: 'knowledge', title: 'На знание', hint: 'Факты, определения, классификации' },
  { value: 'understanding', title: 'На понимание', hint: 'Клинические задачи, анализ' },
];

const LANG_OPTIONS = [
  { value: 'ru', title: 'Русский', hint: 'Формулировки на русском' },
  { value: 'tj', title: 'Таджикский', hint: 'Кириллица' },
  { value: 'en', title: 'English', hint: 'Same structure, English wording' },
];

const LANG_LABEL = { ru: 'Русский', tj: 'Таджикский', en: 'English' };
const LANG_ORDER = ['ru', 'tj', 'en'];

function sortLangCodes(codes) {
  return LANG_ORDER.filter((c) => codes.includes(c));
}

function pluralLangRu(n) {
  const k = Math.abs(n) % 100;
  const d = k % 10;
  if (k > 10 && k < 20) return 'языков';
  if (d > 1 && d < 5) return 'языка';
  if (d === 1) return 'язык';
  return 'языков';
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clampCount(n) {
  const x = Number(n);
  if (Number.isNaN(x) || x < 0) return 0;
  return Math.min(20, Math.floor(x));
}

function SectionCard({ children, className = '', ...rest }) {
  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl shadow-sm p-6 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function SectionBadge({ n, title, hint }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <span className="w-9 h-9 rounded-lg bg-brand-500 text-white text-sm font-bold flex items-center justify-center shrink-0 shadow-sm">
        {n}
      </span>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 leading-tight">{title}</h2>
        {hint && <p className="text-sm text-slate-500 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

function Stepper({ step }) {
  const steps = [
    { n: 1, label: 'Контекст' },
    { n: 2, label: 'Темы и генерация' },
    { n: 3, label: 'Результат' },
  ];
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => {
        const active = step === s.n;
        const done = step > s.n;
        return (
          <div key={s.n} className="flex items-center gap-2 flex-1 last:flex-initial">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                active
                  ? 'bg-brand-600 text-white shadow'
                  : done
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {done ? '✓' : s.n}
            </div>
            <span
              className={`text-sm whitespace-nowrap ${
                active ? 'text-slate-900 font-semibold' : 'text-slate-500'
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${done ? 'bg-green-500' : 'bg-slate-200'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CreateTest() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [faculties, setFaculties] = useState([]);
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [facultyId, setFacultyId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [testType, setTestType] = useState('knowledge');
  const [selectedLangs, setSelectedLangs] = useState(['ru']);
  const [skipReview, setSkipReview] = useState(false);

  const [topicRows, setTopicRows] = useState([]);
  const [topicDraft, setTopicDraft] = useState('');
  const [bulkDraft, setBulkDraft] = useState('');

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [result, setResult] = useState(null);
  const [liveQuestions, setLiveQuestions] = useState([]);
  const [err, setErr] = useState('');

  const [addingDept, setAddingDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [addingSubj, setAddingSubj] = useState(false);
  const [newSubjName, setNewSubjName] = useState('');

  const [saveTitle, setSaveTitle] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.faculties().then(setFaculties).catch((e) => setErr(e.message));
    api.courses().then(setCourses).catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (!facultyId) {
      setDepartments([]);
      return;
    }
    api.departments(facultyId).then(setDepartments).catch((e) => setErr(e.message));
    setDepartmentId('');
    setSubjects([]);
    setSubjectId('');
  }, [facultyId]);

  useEffect(() => {
    if (!departmentId || !courseId) {
      setSubjects([]);
      return;
    }
    api.subjects(departmentId, courseId).then(setSubjects).catch((e) => setErr(e.message));
    setSubjectId('');
  }, [departmentId, courseId]);

  const faculty = faculties.find((f) => String(f.id) === String(facultyId));
  const course = courses.find((c) => String(c.id) === String(courseId));
  const department = departments.find((d) => String(d.id) === String(departmentId));
  const subject = subjects.find((s) => String(s.id) === String(subjectId));

  const canProceedStep1 = Boolean(faculty && course && department && subject);

  const grandTotal = useMemo(
    () => topicRows.reduce((s, r) => s + r.easy + r.medium + r.hard, 0),
    [topicRows]
  );

  const apiTopics = useMemo(() => {
    const out = [];
    for (const row of topicRows) {
      for (const diff of ['easy', 'medium', 'hard']) {
        if (row[diff] > 0) {
          out.push({
            topic: row.name,
            type: testType,
            difficulty: diff,
            count: row[diff],
          });
        }
      }
    }
    return out;
  }, [topicRows, testType]);

  const canGenerate =
    topicRows.length > 0 &&
    topicRows.length <= MAX_TOPICS &&
    grandTotal > 0 &&
    canProceedStep1 &&
    selectedLangs.length > 0;

  const totalCalls = apiTopics.length * selectedLangs.length;

  function addTopicByName(raw) {
    const name = raw.trim();
    if (!name) return;
    if (topicRows.length >= MAX_TOPICS) {
      setErr(`Не больше ${MAX_TOPICS} тем за сессию.`);
      return;
    }
    setErr('');
    setTopicRows((rows) => {
      if (rows.some((r) => r.name.toLowerCase() === name.toLowerCase())) return rows;
      return [...rows, { id: uid(), name, easy: 0, medium: 0, hard: 0 }];
    });
  }

  function addBulkTopics() {
    const lines = bulkDraft
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    let next = [...topicRows];
    for (const line of lines) {
      if (next.length >= MAX_TOPICS) break;
      if (next.some((r) => r.name.toLowerCase() === line.toLowerCase())) continue;
      next = [...next, { id: uid(), name: line, easy: 0, medium: 0, hard: 0 }];
    }
    setTopicRows(next);
    setBulkDraft('');
    setErr('');
  }

  function removeTopicRow(id) {
    setTopicRows((rows) => rows.filter((r) => r.id !== id));
  }

  function updateCell(id, field, value) {
    const v = clampCount(value);
    setTopicRows((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: v } : r)));
  }

  function quickFillAll(n) {
    const v = clampCount(n);
    setTopicRows((rows) => rows.map((r) => ({ ...r, easy: v, medium: v, hard: v })));
  }

  async function handleAddDepartment() {
    const name = newDeptName.trim();
    if (!name) return;
    try {
      const dept = await api.createDepartment(facultyId, name);
      const fresh = await api.departments(facultyId);
      setDepartments(fresh);
      setDepartmentId(String(dept.id));
      setNewDeptName('');
      setAddingDept(false);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function handleAddSubject() {
    const name = newSubjName.trim();
    if (!name) return;
    try {
      const subj = await api.createSubject(departmentId, courseId, name);
      const fresh = await api.subjects(departmentId, courseId);
      setSubjects(fresh);
      setSubjectId(String(subj.id));
      setNewSubjName('');
      setAddingSubj(false);
    } catch (e) {
      setErr(e.message);
    }
  }

  function buildExportMeta() {
    return {
      faculty: faculty?.name,
      course: course?.name,
      department: department?.name,
      subject: subject?.name,
    };
  }

  function defaultExportTitle() {
    return `${subject?.name || 'Тест'} — ${new Date().toLocaleDateString('ru-RU')}`;
  }

  async function handleExportWord(questions) {
    if (!questions?.length) return;
    try {
      await api.exportDocxPreview({
        title: defaultExportTitle(),
        questions,
        meta: buildExportMeta(),
        format: 'symbol',
        filename: `medtest_${new Date().toISOString().slice(0, 10)}.docx`,
      });
    } catch (e) {
      alert(e.message);
    }
  }

  function toggleLang(code) {
    setSelectedLangs((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      if (next.length === 0) return prev;
      return sortLangCodes(next);
    });
  }

  async function runGeneration() {
    if (apiTopics.length === 0) {
      setErr('Укажите количество вопросов хотя бы для одной темы.');
      return;
    }
    if (selectedLangs.length === 0) {
      setErr('Выберите хотя бы один язык.');
      return;
    }
    setGenerating(true);
    setErr('');
    setLiveQuestions([]);
    setResult(null);

    const basePayload = {
      faculty: faculty.name,
      course: course.name,
      department: department.name,
      subject: subject.name,
      skipReview,
    };

    const allQuestions = [];
    const allLog = [];
    const total = apiTopics.length;
    const langList = selectedLangs.map((l) => LANG_LABEL[l]).join(', ');

    try {
      for (let i = 0; i < apiTopics.length; i++) {
        const item = apiTopics[i];
        const diffLabel = DIFF_LABEL_RU[item.difficulty] || item.difficulty;
        setProgress({
          current: i + 1,
          total,
          label: `«${item.topic}», ${diffLabel} (${item.count}) — ${langList}`,
        });

        const results = await Promise.all(
          selectedLangs.map((language) =>
            api
              .generate({ ...basePayload, language, topics: [item] })
              .then((res) => ({ language, res }))
              .catch((err) => ({ language, error: err.message }))
          )
        );

        for (const r of results) {
          if (r.error) {
            allLog.push({
              topic: item.topic,
              type: item.type,
              difficulty: item.difficulty,
              steps: [{ step: 'generate', status: 'error', error: r.error }],
            });
            continue;
          }
          const { language, res } = r;
          const batch = (Array.isArray(res.questions) ? res.questions : []).map((q) => ({
            ...q,
            _outputLang: language,
          }));
          allQuestions.push(...batch);
          setLiveQuestions((prev) => [...prev, ...batch]);
          if (Array.isArray(res.log)) allLog.push(...res.log);
        }
      }
      setResult({ questions: allQuestions, log: allLog });
      setStep(3);
    } catch (e) {
      setErr(
        e.message ||
          'Ошибка генерации. Часть вопросов могла появиться ниже — при необходимости выгрузите Word или запустите снова.'
      );
    } finally {
      setGenerating(false);
      setProgress({ current: 0, total: 0, label: '' });
    }
  }

  function openSaveDialog() {
    setSaveTitle(defaultExportTitle());
    setSaveOpen(true);
  }

  async function confirmSave() {
    const title = saveTitle.trim();
    if (!title) return;
    try {
      setSaving(true);
      const { id } = await api.saveTest({
        title,
        facultyId: Number(facultyId),
        courseId: Number(courseId),
        departmentId: Number(departmentId),
        subjectId: Number(subjectId),
        config: {
          topicRows,
          topics: apiTopics,
          testType,
          contentLangs: selectedLangs,
          skipReview,
        },
        questions: result.questions,
        pipelineLog: result.log,
      });
      navigate(`/tests/${id}`);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 pb-16">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Создание теста</h1>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← К списку тестов
        </button>
      </div>

      <Stepper step={step} />

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-start justify-between gap-3">
          <span>{err}</span>
          <button
            onClick={() => setErr('')}
            className="text-red-500 hover:text-red-700 shrink-0"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
      )}

      {step === 1 && (
        <SectionCard>
          <SectionBadge n={1} title="Контекст теста" hint="Тип, языки и иерархия предмета" />

          <div className="space-y-8">
            {/* Тип */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Тип теста</label>
              <div className="grid sm:grid-cols-2 gap-3">
                {TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      testType === opt.value
                        ? 'border-brand-500 bg-brand-50/80 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="testType"
                      value={opt.value}
                      checked={testType === opt.value}
                      onChange={() => setTestType(opt.value)}
                      className="mt-1 text-brand-600 focus:ring-brand-500"
                    />
                    <div>
                      <div className="font-medium text-slate-900">{opt.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{opt.hint}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Языки */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Языки теста <span className="text-slate-400 font-normal">— можно несколько</span>
              </label>
              <div className="grid sm:grid-cols-3 gap-3">
                {LANG_OPTIONS.map((opt) => {
                  const checked = selectedLangs.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className={`flex gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        checked
                          ? 'border-brand-500 bg-brand-50/80 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLang(opt.value)}
                        className="mt-1 rounded text-brand-600 focus:ring-brand-500"
                      />
                      <div>
                        <div className="font-medium text-slate-900">{opt.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{opt.hint}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {selectedLangs.length > 1 && (
                <p className="text-xs text-slate-500 mt-2">
                  Вопросы на каждом языке генерируются параллельно: {selectedLangs.length}×
                  запросов на каждый блок.
                </p>
              )}
            </div>

            {/* Иерархия */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <Dropdown
                label="Факультет"
                value={facultyId}
                onChange={setFacultyId}
                options={faculties.map((f) => ({ value: f.id, label: f.name }))}
              />
              <Dropdown
                label="Курс"
                value={courseId}
                onChange={setCourseId}
                options={courses.map((c) => ({ value: c.id, label: c.name }))}
              />

              <InlineAdd
                label="Кафедра"
                value={departmentId}
                onChange={setDepartmentId}
                disabled={!facultyId}
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
                adding={addingDept}
                onStartAdd={() => setAddingDept(true)}
                onCancelAdd={() => {
                  setAddingDept(false);
                  setNewDeptName('');
                }}
                newName={newDeptName}
                setNewName={setNewDeptName}
                onConfirmAdd={handleAddDepartment}
                placeholder="Название новой кафедры"
              />

              <InlineAdd
                label="Предмет"
                value={subjectId}
                onChange={setSubjectId}
                disabled={!departmentId || !courseId}
                options={subjects.map((s) => ({ value: s.id, label: s.name }))}
                adding={addingSubj}
                onStartAdd={() => setAddingSubj(true)}
                onCancelAdd={() => {
                  setAddingSubj(false);
                  setNewSubjName('');
                }}
                newName={newSubjName}
                setNewName={setNewSubjName}
                onConfirmAdd={handleAddSubject}
                placeholder="Название нового предмета"
              />
            </div>
          </div>

          <div className="pt-6 flex justify-end border-t border-slate-100 mt-8">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="bg-brand-600 text-white px-8 py-2.5 rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm transition-colors"
            >
              Далее →
            </button>
          </div>
        </SectionCard>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <SectionCard className="!py-4 !px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                  Выбранный контекст
                </div>
                <div className="text-slate-900 font-medium">
                  {faculty?.name} · {course?.name} · {department?.name} · {subject?.name}
                </div>
                <div className="text-sm text-slate-600 mt-2">
                  Тип:{' '}
                  <span className="font-medium text-slate-800">
                    {testType === 'knowledge' ? 'на знание' : 'на понимание'}
                  </span>
                  {' · '}
                  Языки:{' '}
                  <span className="font-medium text-slate-800">
                    {selectedLangs.map((c) => LANG_LABEL[c]).join(', ')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium whitespace-nowrap"
              >
                Изменить
              </button>
            </div>
          </SectionCard>

          <SectionCard>
            <SectionBadge
              n={2}
              title="Темы"
              hint={`Минимум 1, максимум ${MAX_TOPICS}. Поддерживается вставка списком.`}
            />
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="text"
                value={topicDraft}
                onChange={(e) => setTopicDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTopicByName(topicDraft);
                    setTopicDraft('');
                  }
                }}
                placeholder="Введите тему и нажмите Enter"
                className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  addTopicByName(topicDraft);
                  setTopicDraft('');
                }}
                disabled={!topicDraft.trim()}
                className="shrink-0 bg-brand-600 text-white px-5 py-3 rounded-xl hover:bg-brand-700 disabled:opacity-50 font-medium text-sm shadow-sm whitespace-nowrap"
              >
                + Добавить
              </button>
            </div>

            <details className="group">
              <summary className="cursor-pointer text-sm text-slate-600 hover:text-slate-900 list-none inline-flex items-center gap-1">
                <span className="group-open:rotate-90 transition-transform">▸</span>
                Добавить списком
              </summary>
              <div className="flex flex-col sm:flex-row gap-3 items-stretch mt-3">
                <textarea
                  value={bulkDraft}
                  onChange={(e) => setBulkDraft(e.target.value)}
                  placeholder="Одна тема на строку"
                  rows={4}
                  className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 outline-none resize-y"
                />
                <button
                  type="button"
                  onClick={addBulkTopics}
                  disabled={!bulkDraft.trim()}
                  className="sm:self-stretch shrink-0 border-2 border-slate-200 text-slate-800 px-5 py-3 rounded-xl hover:border-brand-500 hover:bg-brand-50 disabled:opacity-50 font-medium text-sm whitespace-nowrap"
                >
                  Добавить списком
                </button>
              </div>
            </details>

            {topicRows.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-5">
                {topicRows.map((row) => (
                  <span
                    key={row.id}
                    className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1.5 rounded-full bg-brand-50 text-brand-900 text-sm border border-brand-100"
                  >
                    {row.name}
                    <button
                      type="button"
                      onClick={() => removeTopicRow(row.id)}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-brand-600 hover:bg-brand-200/60 transition-colors text-lg leading-none"
                      aria-label={`Удалить тему ${row.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard>
            <SectionBadge
              n={3}
              title="Количество вопросов"
              hint="До 20 в каждой ячейке. Пустые ячейки пропускаются."
            />
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="text-sm text-slate-600">Быстро заполнить все ячейки:</span>
              <div className="flex flex-wrap gap-2">
                {QUICK_FILL_VALUES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => quickFillAll(n)}
                    disabled={topicRows.length === 0}
                    className="w-10 h-10 rounded-full border-2 border-slate-200 text-sm font-semibold text-slate-700 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => quickFillAll(0)}
                  disabled={topicRows.length === 0}
                  className="h-10 px-3 rounded-full border-2 border-slate-200 text-sm font-medium text-slate-600 hover:border-red-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  Сбросить
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left font-semibold text-slate-600 uppercase text-xs tracking-wide px-4 py-3">
                      Тема
                    </th>
                    <th className="text-center font-semibold text-slate-600 uppercase text-xs tracking-wide px-2 py-3 w-24">
                      Лёгкие
                    </th>
                    <th className="text-center font-semibold text-slate-600 uppercase text-xs tracking-wide px-2 py-3 w-24">
                      Средние
                    </th>
                    <th className="text-center font-semibold text-slate-600 uppercase text-xs tracking-wide px-2 py-3 w-24">
                      Сложные
                    </th>
                    <th className="text-center font-semibold text-slate-600 uppercase text-xs tracking-wide px-2 py-3 w-20">
                      Итого
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topicRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                        Добавьте темы, чтобы настроить количество вопросов.
                      </td>
                    </tr>
                  ) : (
                    topicRows.map((row) => {
                      const rowSum = row.easy + row.medium + row.hard;
                      return (
                        <tr key={row.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-4 py-3 text-slate-900 font-medium align-middle">
                            {row.name}
                          </td>
                          {['easy', 'medium', 'hard'].map((field) => (
                            <td key={field} className="px-2 py-2 align-middle">
                              <input
                                type="number"
                                min={0}
                                max={20}
                                value={row[field]}
                                onChange={(e) => updateCell(row.id, field, e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-center text-sm focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 outline-none"
                              />
                            </td>
                          ))}
                          <td className="px-2 py-3 text-center font-semibold text-slate-800 align-middle">
                            {rowSum}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-slate-700">
                Итого: {grandTotal} вопросов
              </span>
              <span className="text-xs text-slate-500">
                Блоков: {apiTopics.length}
                {selectedLangs.length > 1
                  ? ` × ${selectedLangs.length} ${pluralLangRu(selectedLangs.length)} = ${totalCalls} запросов к ИИ`
                  : ` (${totalCalls} запрос${totalCalls === 1 ? '' : 'ов'})`}
              </span>
            </div>
          </SectionCard>

          <SectionCard>
            <SectionBadge n={4} title="Генерация" hint="Запросы к ИИ идут параллельно по языкам." />

            <label className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 mb-4 cursor-pointer hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={skipReview}
                onChange={(e) => setSkipReview(e.target.checked)}
                className="mt-0.5 rounded text-brand-600 focus:ring-brand-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-800">
                  Быстрый режим (без ревью)
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Пропустить второй этап проверки/правки. В ~2 раза быстрее и дешевле, но качество может
                  быть ниже. Рекомендуется для черновых тестов.
                </div>
              </div>
            </label>

            <button
              type="button"
              onClick={runGeneration}
              disabled={!canGenerate || generating}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-brand-600 text-white font-semibold text-base hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {generating ? (
                <>
                  <Spinner className="w-5 h-5" />
                  Генерация…
                </>
              ) : (
                <>
                  <PlayIcon className="w-5 h-5" />
                  Сгенерировать {grandTotal || ''} вопрос{grandTotal === 1 ? '' : 'ов'}
                </>
              )}
            </button>

            {generating && progress.total > 0 && (
              <div className="mt-5">
                <div className="flex justify-between text-xs text-slate-600 mb-1.5">
                  <span>
                    Блок {progress.current} из {progress.total}
                  </span>
                  <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                {progress.label && (
                  <p className="text-xs text-slate-600 mt-2 text-center">{progress.label}</p>
                )}
              </div>
            )}
          </SectionCard>

          {(liveQuestions.length > 0 || generating) && (
            <SectionCard>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Вопросы по мере готовности ({liveQuestions.length})
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Формат: <code className="text-xs bg-slate-100 px-1 rounded">@</code> вопрос,{' '}
                    <code className="text-xs bg-slate-100 px-1 rounded">#</code> неверный,{' '}
                    <code className="text-xs bg-slate-100 px-1 rounded">#&amp;</code> верный
                  </p>
                </div>
                <button
                  type="button"
                  disabled={liveQuestions.length === 0}
                  onClick={() => handleExportWord(liveQuestions)}
                  className="shrink-0 border-2 border-brand-500 text-brand-700 px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Скачать Word
                </button>
              </div>
              <div className="space-y-4">
                {liveQuestions.map((q, i) => (
                  <QuestionSymbolPreview
                    key={`${i}-${q.question?.slice(0, 20)}`}
                    q={q}
                    index={i}
                  />
                ))}
                {generating && liveQuestions.length === 0 && (
                  <div className="text-sm text-slate-500 text-center py-8 flex items-center justify-center gap-2">
                    <Spinner className="w-4 h-4" />
                    Ожидаем первый блок…
                  </div>
                )}
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 font-bold">
              ✓
            </div>
            <div className="flex-1">
              <div className="font-semibold text-emerald-900">
                Сгенерировано {result.questions.length} вопрос
                {result.questions.length === 1 ? '' : 'ов'}
              </div>
              <div className="text-sm text-emerald-800 mt-0.5">
                Проверьте результаты и сохраните тест в личный кабинет.
              </div>
            </div>
          </div>

          <PipelineLog log={result.log} />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleExportWord(result.questions)}
              className="border-2 border-brand-500 text-brand-700 px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-brand-50"
            >
              Скачать Word (.docx)
            </button>
          </div>

          <div className="space-y-3">
            {result.questions.map((q, i) => (
              <QuestionSymbolPreview key={i} q={q} index={i} />
            ))}
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 sticky bottom-0 bg-slate-50/95 backdrop-blur py-4 border-t border-slate-200 -mx-6 px-6">
            <button
              type="button"
              onClick={() => {
                setLiveQuestions([]);
                setStep(2);
              }}
              className="text-slate-600 hover:text-slate-900 font-medium"
            >
              ← Назад к темам
            </button>
            <button
              type="button"
              onClick={openSaveDialog}
              className="bg-brand-600 text-white px-6 py-2.5 rounded-xl hover:bg-brand-700 font-medium shadow-sm"
            >
              Сохранить тест
            </button>
          </div>
        </div>
      )}

      {saveOpen && (
        <Modal onClose={() => !saving && setSaveOpen(false)}>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Сохранить тест</h3>
          <label className="block text-sm text-slate-600 mb-2">Название теста</label>
          <input
            type="text"
            value={saveTitle}
            onChange={(e) => setSaveTitle(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && saveTitle.trim() && !saving) confirmSave();
              if (e.key === 'Escape' && !saving) setSaveOpen(false);
            }}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 outline-none mb-4"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSaveOpen(false)}
              disabled={saving}
              className="text-slate-600 hover:text-slate-900 px-4 py-2 disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={confirmSave}
              disabled={!saveTitle.trim() || saving}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function PlayIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function Spinner({ className = 'w-5 h-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Dropdown({ label, value, onChange, options, disabled }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white disabled:bg-slate-50 disabled:text-slate-400 text-sm focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 outline-none"
      >
        <option value="">Выберите…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function InlineAdd({
  label,
  value,
  onChange,
  options,
  disabled,
  adding,
  onStartAdd,
  onCancelAdd,
  newName,
  setNewName,
  onConfirmAdd,
  placeholder,
}) {
  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Dropdown
            label={label}
            value={value}
            onChange={onChange}
            options={options}
            disabled={disabled}
          />
        </div>
        {!disabled && !adding && (
          <button
            type="button"
            onClick={onStartAdd}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium whitespace-nowrap pb-2"
          >
            + Добавить
          </button>
        )}
      </div>
      {adding && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirmAdd();
              if (e.key === 'Escape') onCancelAdd();
            }}
            placeholder={placeholder}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 outline-none"
          />
          <button
            type="button"
            onClick={onConfirmAdd}
            disabled={!newName.trim()}
            className="bg-brand-600 text-white px-3 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium"
          >
            Добавить
          </button>
          <button
            type="button"
            onClick={onCancelAdd}
            className="text-slate-600 hover:text-slate-900 text-sm px-2"
          >
            Отмена
          </button>
        </div>
      )}
    </div>
  );
}

function PipelineLog({ log }) {
  if (!log || log.length === 0) return null;
  return (
    <details className="bg-white border border-slate-200 rounded-xl p-4">
      <summary className="cursor-pointer text-sm font-medium text-slate-700">
        Лог пайплайна ({log.length} блок{log.length === 1 ? '' : 'ов'})
      </summary>
      <div className="mt-3 space-y-2 text-xs">
        {log.map((entry, i) => (
          <div key={i} className="bg-slate-50 rounded-lg p-3">
            <div className="font-semibold text-slate-800">
              {entry.topic} <span className="text-slate-500 font-normal">· {entry.difficulty}</span>
            </div>
            <div className="text-slate-600 mt-1">
              {entry.steps.map((s, j) => (
                <span key={j} className="mr-3 inline-block">
                  <span className={`font-medium ${stepColor(s.status)}`}>
                    {s.step}: {s.status}
                  </span>
                  {s.pass !== undefined &&
                    ` (pass:${s.pass}, fix:${s.fix ?? 0}, reject:${s.reject ?? 0})`}
                  {s.produced !== undefined && ` (${s.produced})`}
                  {s.error && ` — ${s.error}`}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function stepColor(status) {
  if (status === 'done') return 'text-emerald-700';
  if (status === 'error') return 'text-red-600';
  return 'text-slate-600';
}

function lineClass(line) {
  if (line.startsWith('@')) return 'text-slate-900 font-medium';
  if (line.startsWith('#&')) return 'text-emerald-800 font-medium bg-emerald-50/80';
  if (line.startsWith('#')) return 'text-slate-700';
  return 'text-slate-800';
}

function QuestionSymbolPreview({ q, index }) {
  const lines = questionToSymbolLines(q);
  const qcBadge = {
    pass: { text: 'OK', color: 'bg-emerald-100 text-emerald-700' },
    revised: { text: 'Исправлен', color: 'bg-amber-100 text-amber-700' },
    fallback: { text: 'Без ревью', color: 'bg-orange-100 text-orange-700' },
  }[q._qc] || null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-500">№ {index + 1}</span>
          {q._outputLang && (
            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
              {LANG_LABEL[q._outputLang] || q._outputLang}
            </span>
          )}
        </div>
        {qcBadge && (
          <span className={`text-xs px-2 py-1 rounded-lg font-medium ${qcBadge.color}`}>
            {qcBadge.text}
          </span>
        )}
      </div>
      <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed bg-slate-50 rounded-lg p-4 border border-slate-100 overflow-x-auto">
        {lines.map((line, i) => (
          <span key={i} className={`block ${lineClass(line)}`}>
            {line}
          </span>
        ))}
      </pre>
      {q.explanation && (
        <div className="text-xs text-slate-500 italic border-t border-slate-100 mt-3 pt-2">
          {q.explanation}
        </div>
      )}
      <div className="mt-2 text-xs text-slate-400">
        {q.topic} · {q.type === 'knowledge' ? 'знание' : 'понимание'} · {q.difficulty}
      </div>
    </div>
  );
}
