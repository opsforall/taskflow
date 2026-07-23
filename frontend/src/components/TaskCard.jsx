import { IconCalendar, IconEdit, IconTrash, IconFlag } from './icons';

const PRIORITY_LABELS = { low: 'Basse', medium: 'Moyenne', high: 'Haute' };
const STATUS_LABELS = { todo: 'À faire', in_progress: 'En cours', done: 'Terminée' };

export default function TaskCard({ task, onEdit, onDelete, onStatusChange }) {
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const overdue = dueDate && task.status !== 'done' && dueDate < new Date();

  return (
    <article className={`task-card ${task.status === 'done' ? 'is-done' : ''}`}>
      <header className="task-card-head">
        <span className={`badge priority-${task.priority}`}>
          <IconFlag width={12} height={12} />
          {PRIORITY_LABELS[task.priority] || task.priority}
        </span>
        <div className="task-actions">
          <button className="icon-btn" onClick={() => onEdit(task)} title="Modifier">
            <IconEdit width={15} height={15} />
          </button>
          <button className="icon-btn danger" onClick={() => onDelete(task)} title="Supprimer">
            <IconTrash width={15} height={15} />
          </button>
        </div>
      </header>

      <h4 className="task-title">{task.title}</h4>
      {task.description && <p className="task-desc">{task.description}</p>}

      <footer className="task-card-foot">
        {dueDate && (
          <span className={`due ${overdue ? 'overdue' : ''}`}>
            <IconCalendar width={13} height={13} />
            {dueDate.toLocaleDateString('fr-FR')}
          </span>
        )}
        <select
          className="status-select"
          value={task.status}
          onChange={(e) => onStatusChange(task, e.target.value)}
          title="Changer le statut"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </footer>
    </article>
  );
}
