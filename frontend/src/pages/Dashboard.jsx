import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import { IconPlus, IconSearch } from '../components/icons';

const COLUMNS = [
  { key: 'todo', label: 'À faire' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'done', label: 'Terminées' }
];

export default function Dashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  // null = fermée, { task: null } = création, { task } = édition
  const [modal, setModal] = useState(null);

  const load = () => {
    setError(null);
    api
      .getTasks()
      .then((data) => setTasks(data.tasks))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      if (q && !`${task.title} ${task.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, query, priorityFilter]);

  const stats = useMemo(
    () => ({
      total: tasks.length,
      todo: tasks.filter((t) => t.status === 'todo').length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      done: tasks.filter((t) => t.status === 'done').length
    }),
    [tasks]
  );

  const saveTask = async (form) => {
    if (modal?.task) {
      const data = await api.updateTask(modal.task.id, form);
      setTasks((prev) => prev.map((t) => (t.id === data.task.id ? data.task : t)));
    } else {
      const data = await api.createTask(form);
      setTasks((prev) => [data.task, ...prev]);
    }
    setModal(null);
  };

  const deleteTask = async (task) => {
    if (!window.confirm(`Supprimer la tâche « ${task.title} » ?`)) return;
    await api.deleteTask(task.id);
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
  };

  const changeStatus = async (task, status) => {
    const data = await api.updateTask(task.id, { status });
    setTasks((prev) => prev.map((t) => (t.id === data.task.id ? data.task : t)));
  };

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  return (
    <div className="app">
      <Sidebar />

      <main className="main">
        <header className="topbar">
          <div>
            <h2>Bonjour, {user?.name?.split(' ')[0]} 👋</h2>
            <p className="topbar-date">{today}</p>
          </div>

          <div className="topbar-tools">
            <div className="search">
              <IconSearch />
              <input
                type="search"
                placeholder="Rechercher une tâche…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              className="filter-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              title="Filtrer par priorité"
            >
              <option value="all">Toutes priorités</option>
              <option value="high">Haute</option>
              <option value="medium">Moyenne</option>
              <option value="low">Basse</option>
            </select>
            <button className="btn btn-primary" onClick={() => setModal({ task: null })}>
              <IconPlus />
              Nouvelle tâche
            </button>
          </div>
        </header>

        <section className="stats">
          <div className="stat-card">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.todo}</span>
            <span className="stat-label">À faire</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.inProgress}</span>
            <span className="stat-label">En cours</span>
          </div>
          <div className="stat-card accent">
            <span className="stat-value">{stats.done}</span>
            <span className="stat-label">Terminées</span>
          </div>
        </section>

        {error && <div className="alert">{error}</div>}

        {loading ? (
          <div className="page-loader">
            <div className="spinner" />
          </div>
        ) : (
          <section className="board">
            {COLUMNS.map((column) => {
              const columnTasks = visible.filter((t) => t.status === column.key);
              return (
                <div className="column" key={column.key}>
                  <header className="column-head">
                    <span className={`column-dot dot-${column.key}`} />
                    <h3>{column.label}</h3>
                    <span className="column-count">{columnTasks.length}</span>
                  </header>

                  <div className="column-body">
                    {columnTasks.length === 0 ? (
                      <p className="column-empty">Aucune tâche</p>
                    ) : (
                      columnTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onEdit={(t) => setModal({ task: t })}
                          onDelete={deleteTask}
                          onStatusChange={changeStatus}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>

      {modal && <TaskModal initial={modal.task} onSave={saveTask} onClose={() => setModal(null)} />}
    </div>
  );
}
