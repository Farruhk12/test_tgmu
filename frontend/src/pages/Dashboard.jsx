import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import MethodologyPanel from '../components/MethodologyPanel.jsx';

export default function Dashboard() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const navigate = useNavigate();

  async function load() {
    try {
      setLoading(true);
      const data = await api.listTests();
      setTests(data);
      setErr('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id, title) {
    if (!confirm(`Удалить тест «${title}»?`)) return;
    try {
      setBusyId(id);
      await api.deleteTest(id);
      setTests((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleExport(id) {
    try {
      setBusyId(id);
      await api.exportUrl(id);
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  }

  const filtered = query.trim()
    ? tests.filter((t) => {
        const q = query.trim().toLowerCase();
        return (
          t.title?.toLowerCase().includes(q) ||
          t.subject?.toLowerCase().includes(q) ||
          t.department?.toLowerCase().includes(q)
        );
      })
    : tests;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Мои тесты</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading ? 'Загрузка…' : `Всего: ${tests.length}`}
          </p>
        </div>
        <button
          onClick={() => navigate('/create')}
          className="bg-brand-600 text-white px-5 py-2.5 rounded-lg hover:bg-brand-700 font-medium shadow-sm transition-colors"
        >
          + Создать тест
        </button>
      </div>

      <MethodologyPanel
        key={loading ? 'loading' : tests.length === 0 ? 'empty' : 'list'}
        defaultOpen={!loading && tests.length === 0}
      />

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">
          {err}
        </div>
      )}

      {tests.length > 0 && (
        <div className="mb-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию, предмету, кафедре…"
            className="w-full sm:max-w-md border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 outline-none"
          />
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500">
          Загрузка…
        </div>
      ) : tests.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-slate-700 font-medium mb-1">Пока нет сохранённых тестов</p>
          <p className="text-slate-500 text-sm mb-5">
            Создайте первый мультиязычный тест за несколько минут
          </p>
          <Link
            to="/create"
            className="inline-block bg-brand-600 text-white px-5 py-2.5 rounded-lg hover:bg-brand-700 font-medium"
          >
            Создать первый тест
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
          Ничего не найдено по запросу «{query}»
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 font-semibold">Название</th>
                <th className="px-4 py-3 font-semibold">Предмет</th>
                <th className="px-4 py-3 font-semibold">Вопросов</th>
                <th className="px-4 py-3 font-semibold">Создан</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      to={`/tests/${t.id}`}
                      className="text-brand-600 hover:underline font-medium"
                    >
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {t.subject || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                      {t.question_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {new Date(t.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleExport(t.id)}
                      disabled={busyId === t.id}
                      className="text-sm text-slate-600 hover:text-brand-700 mr-4 disabled:opacity-50"
                    >
                      Экспорт
                    </button>
                    <button
                      onClick={() => handleDelete(t.id, t.title)}
                      disabled={busyId === t.id}
                      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
