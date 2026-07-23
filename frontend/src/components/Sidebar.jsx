import { useAuth } from '../context/AuthContext';
import { getAppColor } from '../theme';
import { IconCheck, IconBoard, IconLogout } from './icons';

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const themeName = getAppColor();

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <IconCheck />
        </span>
        <span className="brand-name">TaskFlow</span>
      </div>

      <nav className="sidebar-nav">
        <a className="nav-item active" href="/">
          <IconBoard />
          <span>Tableau de bord</span>
        </a>
      </nav>

      <div className="sidebar-footer">
        {/* Rend visible la valeur d'APP_COLOR reçue de l'environnement — pratique
            pour la démo Docker/Kubernetes : la pastille suit la couleur active */}
        <div className="theme-chip" title="Variable d'environnement APP_COLOR">
          <span className="theme-dot" />
          <span>
            Thème : <strong>{themeName}</strong>
          </span>
        </div>

        <div className="user-row">
          <div className="avatar">{initials(user?.name)}</div>
          <div className="user-meta">
            <span className="user-name">{user?.name}</span>
            <span className="user-email">{user?.email}</span>
          </div>
          <button className="icon-btn" onClick={logout} title="Se déconnecter">
            <IconLogout />
          </button>
        </div>
      </div>
    </aside>
  );
}
