import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  uiDifficultyScore,
  difficultyScoreBadgeClass,
  difficultyScoreBandLabelRu,
  difficultyBucketLabelRu,
} from '../lib/questionFormat.js';

export default function ViewTest() {
  const { id } = useParams();
  const [test, setTest] = useState(null);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getTest(id)
      .then((t) => {
        if (cancelled) return;
        setTest(t);
        setQuestions(Array.isArray(t.questions) ? t.questions : []);
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function saveEdits() {
    try {
      setSaving(true);
      await api.updateTest(id, { questions });
      const fresh = await api.getTest(id);
      setTest(fresh);
      setQuestions(Array.isArray(fresh.questions) ? fresh.questions : []);
      setEditing(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  function cancelEdits() {
    setQuestions(Array.isArray(test?.questions) ? test.questions : []);
    setEditing(false);
  }

  function updateQuestion(i, field, value) {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === i ? { ...q, [field]: value } : q))
    );
  }

  function updateOption(i, letter, value) {
    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === i
          ? { ...q, options: { ...(q.options || {}), [letter]: value } }
          : q
      )
    );
  }

  function removeQuestion(i) {
    if (!confirm(`Удалить вопрос №${i + 1}?`)) return;
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  }

  if (err) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Link to="/" className="text-brand-600 hover:underline text-sm">
          ← К списку тестов
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mt-4">
          {err}
        </div>
      </div>
    );
  }
  if (!test) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-slate-500">Загрузка…</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link to="/" className="text-brand-600 hover:underline text-sm">
        ← К списку тестов
      </Link>

      <div className="bg-white border border-slate-200 rounded-xl p-6 my-4 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{test.title}</h1>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
          {test.faculty_name && <span>{test.faculty_name}</span>}
          {test.course_name && <><span>·</span><span>{test.course_name}</span></>}
          {test.department_name && <><span>·</span><span>{test.department_name}</span></>}
          {test.subject_name && <><span>·</span><span>{test.subject_name}</span></>}
        </div>
        <div className="text-sm text-slate-500 mt-2">
          Вопросов: <span className="font-medium text-slate-700">{questions.length}</span>
          {' · '}
          Создан: {new Date(test.created_at).toLocaleDateString('ru-RU')}
        </div>

        <div className="flex flex-wrap gap-3 mt-5">
          <button
            onClick={() => api.exportUrl(test.id)}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 font-medium"
          >
            Экспорт в .docx
          </button>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 font-medium"
            >
              Редактировать
            </button>
          ) : (
            <>
              <button
                onClick={saveEdits}
                disabled={saving}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
              <button
                onClick={cancelEdits}
                disabled={saving}
                className="text-slate-600 hover:text-slate-900 px-4 py-2 disabled:opacity-50"
              >
                Отмена
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {questions.map((q, i) => {
          const aiScore = uiDifficultyScore(q);
          return (
          <div
            key={i}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
          >
            {editing ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500">№ {i + 1}</span>
                    {aiScore != null && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md font-semibold border ${difficultyScoreBadgeClass(aiScore)}`}
                      >
                        ИИ: {aiScore}/100 · {difficultyScoreBandLabelRu(aiScore)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeQuestion(i)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Удалить вопрос
                  </button>
                </div>
                {q.difficulty_note && aiScore != null && (
                  <p className="text-xs text-slate-500 italic">{q.difficulty_note}</p>
                )}
                <textarea
                  value={q.question || ''}
                  onChange={(e) => updateQuestion(i, 'question', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-medium focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 outline-none"
                  rows={2}
                />
                {['A', 'B', 'C', 'D'].map((letter) => (
                  <div key={letter} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${i}`}
                      checked={q.correct === letter}
                      onChange={() => updateQuestion(i, 'correct', letter)}
                      className="text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-semibold w-6 text-slate-600">{letter})</span>
                    <input
                      type="text"
                      value={q.options?.[letter] || ''}
                      onChange={(e) => updateOption(i, letter, e.target.value)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 outline-none"
                    />
                  </div>
                ))}
                <textarea
                  value={q.explanation || ''}
                  onChange={(e) =>
                    updateQuestion(i, 'explanation', e.target.value)
                  }
                  placeholder="Обоснование ответа"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 outline-none"
                  rows={2}
                />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <div className="font-semibold text-slate-900">
                    {i + 1}. {q.question}
                  </div>
                  {aiScore != null && (
                    <span
                      className={`text-xs px-2 py-1 rounded-lg font-semibold border shrink-0 ${difficultyScoreBadgeClass(aiScore)}`}
                      title={q.difficulty_note || ''}
                    >
                      ИИ: {aiScore}/100 · {difficultyScoreBandLabelRu(aiScore)}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 mb-3">
                  {['A', 'B', 'C', 'D'].map((letter) => {
                    const isCorrect = q.correct === letter;
                    const text = q.options?.[letter];
                    if (!text) return null;
                    return (
                      <div
                        key={letter}
                        className={`px-3 py-2 rounded-lg text-sm flex items-start gap-2 ${
                          isCorrect
                            ? 'bg-green-50 text-green-900 border border-green-200'
                            : 'text-slate-700 bg-slate-50/50'
                        }`}
                      >
                        <span className={`font-semibold ${isCorrect ? 'text-green-700' : 'text-slate-500'}`}>
                          {letter})
                        </span>
                        <span className="flex-1">{text}</span>
                        {isCorrect && <span className="text-green-600">✓</span>}
                      </div>
                    );
                  })}
                </div>
                {q.explanation && (
                  <div className="text-xs text-slate-600 italic border-t border-slate-100 pt-3 leading-relaxed">
                    {q.explanation}
                  </div>
                )}
                {q.difficulty_note && aiScore != null && (
                  <div className="text-xs text-slate-500 italic mt-2 leading-relaxed">
                    Оценка сложности: {q.difficulty_note}
                  </div>
                )}
              </>
            )}
            <div className="mt-3 text-xs text-slate-400">
              {q.topic} · {q.type === 'knowledge' ? 'знание' : 'понимание'} · корзина:{' '}
              {difficultyBucketLabelRu(q.difficulty)}
            </div>
          </div>
        );
        })}
      </div>
    </div>
  );
}
