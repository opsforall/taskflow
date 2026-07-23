import { useEffect, useState } from 'react';

const EMPTY = { title: '', description: '', status: 'todo', priority: 'medium', due_date: '' };

// Modale de création / édition. `initial` = tâche à éditer, ou null pour créer.
export default function TaskModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title || '',
        description: initial.description || '',
        status: initial.status || 'todo',
        priority: initial.priority || 'medium',
        due_date: initial.due_date ? initial.due_date.slice(0, 10) : ''
      });
    } else {
      setForm(EMPTY);
    }
  }, [initial]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({ ...form, due_date: form.due_date || null });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={onSubmit}>
        <h3>{initial ? 'Modifier la tâche' : 'Nouvelle tâche'}</h3>

        {error && <div className="alert">{error}</div>}

        <label className="field">
          <span>Titre *</span>
          <input
            type="text"
            value={form.title}
            onChange={set('title')}
            placeholder="Ex. : Écrire le Dockerfile du backend"
            maxLength={200}
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span>Description</span>
          <textarea
            value={form.description}
            onChange={set('description')}
            placeholder="Détails, contexte, liens…"
            rows={3}
            maxLength={2000}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Statut</span>
            <select value={form.status} onChange={set('status')}>
              <option value="todo">À faire</option>
              <option value="in_progress">En cours</option>
              <option value="done">Terminée</option>
            </select>
          </label>

          <label className="field">
            <span>Priorité</span>
            <select value={form.priority} onChange={set('priority')}>
              <option value="low">Basse</option>
              <option value="medium">Moyenne</option>
              <option value="high">Haute</option>
            </select>
          </label>

          <label className="field">
            <span>Échéance</span>
            <input type="date" value={form.due_date} onChange={set('due_date')} />
          </label>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Créer la tâche'}
          </button>
        </div>
      </form>
    </div>
  );
}
