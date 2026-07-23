import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IconCheck } from '../components/icons';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(name, email, password);
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
            Démarrez en
            <br />
            quelques secondes.
          </h1>
          <p>Un compte gratuit suffit pour organiser toutes vos tâches au même endroit.</p>
          <ul className="auth-features">
            <li>Aucune configuration requise</li>
            <li>Interface rapide et moderne</li>
            <li>Mot de passe chiffré, session sécurisée</li>
          </ul>
        </div>
      </aside>

      <main className="auth-panel">
        <form className="auth-card" onSubmit={onSubmit}>
          <h2>Créer un compte</h2>
          <p className="auth-subtitle">Rejoignez TaskFlow gratuitement</p>

          {error && <div className="alert">{error}</div>}

          <label className="field">
            <span>Nom</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Votre nom"
              autoComplete="name"
              minLength={2}
              required
            />
          </label>

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
              placeholder="8 caractères minimum"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Création…' : 'Créer mon compte'}
          </button>

          <p className="auth-switch">
            Déjà inscrit ? <Link to="/login">Se connecter</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
