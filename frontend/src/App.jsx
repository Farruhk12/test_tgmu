import { Routes, Route, Link, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CreateTest from './pages/CreateTest';
import ViewTest from './pages/ViewTest';

function Header() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 backdrop-blur bg-white/85">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 text-brand-600 font-bold text-lg">
          <span className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center text-sm shadow-sm">
            M
          </span>
          MedTest
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`
            }
          >
            Мои тесты
          </NavLink>
          <NavLink
            to="/create"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`
            }
          >
            Создать
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/create" element={<CreateTest />} />
        <Route path="/tests/:id" element={<ViewTest />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

function NotFound() {
  return (
    <div className="max-w-4xl mx-auto p-10 text-center">
      <div className="text-5xl mb-4">🔍</div>
      <h1 className="text-xl font-semibold text-slate-900 mb-2">Страница не найдена</h1>
      <Link to="/" className="text-brand-600 hover:underline">
        ← На главную
      </Link>
    </div>
  );
}
