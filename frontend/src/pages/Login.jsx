import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IconCheck } from '../components/icons';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth">
      <aside className="auth-brand">
        <div className="auth-brand-inner">
          <div className="brand">
            <span className="brand-mark">
              <IconCheck />
            </span>
            <span className="brand-name">TaskFlow</span>
          </div>
          <h1>
            Organisez votre travail,
            <br />
            simplement.
          </h1>
          <p>
            Créez, priorisez et suivez vos tâches dans un tableau clair — du backlog à la mise en
            production.
          </p>
          <ul className="auth-features">
            <li>Tableau par statut : à faire, en cours, terminé</li>
            <li>Priorités et échéances sur chaque tâche</li>
            <li>Vos données protégées par authentification</li>
          </ul>
        </div>
      </aside>

      <main className="auth-panel">
        <form className="auth-card" onSubmit={onSubmit}>
          <h2>Bon retour 👋</h2>
          <p className="auth-subtitle">Connectez-vous pour retrouver vos tâches</p>

          {error && <div className="alert">{error}</div>}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="field">
            <span>Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>

          <p className="auth-switch">
            Pas encore de compte ? <Link to="/register">Créer un compte</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
