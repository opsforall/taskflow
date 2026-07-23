// Thème de couleur piloté par la variable d'environnement APP_COLOR.
//
// Ordre de résolution :
//   1. window.__ENV__.APP_COLOR — injecté AU RUNTIME par le conteneur
//      (docker run -e APP_COLOR=red, ConfigMap Kubernetes…)
//   2. VITE_APP_COLOR — figé AU BUILD par Vite (optionnel)
//   3. 'blue' — valeur par défaut

export const THEMES = {
  blue: { primary: '#2563eb', primaryDark: '#1e40af', primarySoft: '#dbeafe', ring: 'rgba(37, 99, 235, 0.3)' },
  red: { primary: '#dc2626', primaryDark: '#991b1b', primarySoft: '#fee2e2', ring: 'rgba(220, 38, 38, 0.3)' },
  yellow: { primary: '#d97706', primaryDark: '#92400e', primarySoft: '#fef3c7', ring: 'rgba(217, 119, 6, 0.3)' },
  green: { primary: '#16a34a', primaryDark: '#166534', primarySoft: '#dcfce7', ring: 'rgba(22, 163, 74, 0.3)' },
  purple: { primary: '#7c3aed', primaryDark: '#5b21b6', primarySoft: '#ede9fe', ring: 'rgba(124, 58, 237, 0.3)' },
  teal: { primary: '#0d9488', primaryDark: '#115e59', primarySoft: '#ccfbf1', ring: 'rgba(13, 148, 136, 0.3)' }
};

export const DEFAULT_THEME = 'blue';

// Normalise une valeur brute ('RED ', 'Blue'…) vers un nom de thème connu,
// avec repli sur le thème par défaut si la couleur n'existe pas.
export function resolveTheme(raw) {
  const name = String(raw || '').trim().toLowerCase();
  return Object.hasOwn(THEMES, name) ? name : DEFAULT_THEME;
}

export function getAppColor() {
  const runtime = typeof window !== 'undefined' && window.__ENV__ && window.__ENV__.APP_COLOR;
  const buildTime = import.meta.env.VITE_APP_COLOR;
  return resolveTheme(runtime || buildTime);
}

// Applique le thème en définissant les variables CSS globales
export function applyTheme(name) {
  const themeName = resolveTheme(name);
  const theme = THEMES[themeName];
  const root = document.documentElement;
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--primary-dark', theme.primaryDark);
  root.style.setProperty('--primary-soft', theme.primarySoft);
  root.style.setProperty('--ring', theme.ring);
  root.setAttribute('data-theme', themeName);
  return themeName;
}
