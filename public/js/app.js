let currentView = 'dashboard';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Authenticate user session
  const user = await checkAuthentication();
  if (!user) return; // Redirect handled inside checkAuthentication

  // 2. Setup user profile info in sidebar
  setupUserProfile(user);

  // 3. Set current date in Navbar
  updateCurrentDate();

  // 4. Load saved language & theme preferences
  initPreferences();

  // 5. Navigate to default view
  await navigateTo(currentView);

  // 6. Listen for language changes to auto-localize strings
  document.addEventListener('languagechanged', () => {
    localizePage();
  });
});

async function checkAuthentication() {
  try {
    const res = await fetch('/api/auth/user');
    if (!res.ok) {
      localStorage.removeItem('student_os_user');
      window.location.href = '/login.html';
      return null;
    }
    const user = await res.json();
    localStorage.setItem('student_os_user', JSON.stringify(user));
    return user;
  } catch (err) {
    console.error('Auth verification error:', err);
    localStorage.removeItem('student_os_user');
    window.location.href = '/login.html';
    return null;
  }
}

function setupUserProfile(user) {
  const nameLabel = document.getElementById('userNameLabel');
  const roleLabel = document.getElementById('userRoleLabel');
  const avatarLetter = document.getElementById('avatarLetter');

  if (nameLabel) nameLabel.innerText = user.fullName || user.username;
  if (roleLabel) roleLabel.innerText = user.role || 'Student';
  if (avatarLetter && (user.fullName || user.username)) {
    const letter = (user.fullName || user.username).charAt(0).toUpperCase();
    avatarLetter.innerText = letter;
  }

  // Show/Hide Faculty Portal link
  const facultySidebar = document.getElementById('facultyPortalSidebarItem');
  if (facultySidebar) {
    if (user.role === 'faculty' || user.role === 'admin') {
      facultySidebar.style.display = 'block';
    } else {
      facultySidebar.style.display = 'none';
    }
  }
}

function updateCurrentDate() {
  const dateEl = document.getElementById('currentDateLabel');
  if (dateEl) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.innerText = new Date().toLocaleDateString(undefined, options);
  }
}

function initPreferences() {
  // Theme setup
  const savedTheme = localStorage.getItem('student_os_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeUI(savedTheme);

  // Language setup
  const currentLang = window.StudentOSLang.current;
  const langSelect = document.getElementById('langSelect');
  if (langSelect) {
    langSelect.value = currentLang;
  }
  localizePage();
}

// NAVIGATION ENGINE
async function navigateTo(viewName) {
  if (!window.StudentOSViews[viewName]) {
    console.error(`View ${viewName} does not exist.`);
    return;
  }

  currentView = viewName;
  const appView = document.getElementById('appView');
  
  // Show spinner or loading state
  appView.innerHTML = `
    <div style="display:flex; justify-content:center; align-items:center; flex:1; height:300px;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 2.5rem; color: var(--primary);"></i>
    </div>
  `;

  // Update Sidebar active state
  const links = document.querySelectorAll('.sidebar-link');
  links.forEach(l => {
    if (l.getAttribute('data-view') === viewName) {
      l.classList.add('active');
    } else {
      l.classList.remove('active');
    }
  });

  // Update navbar title
  const navTitle = document.getElementById('navbarTitle');
  if (navTitle) {
    navTitle.setAttribute('data-localize', viewName);
    navTitle.innerText = window.StudentOSLang.get(viewName);
  }

  // Render view
  await window.StudentOSViews[viewName](appView);
  
  // Localize content inside the newly loaded view
  localizePage();

  // Close sidebar on mobile after navigating
  const sidebar = document.getElementById('sidebar');
  if (sidebar.classList.contains('active')) {
    sidebar.classList.remove('active');
  }
}

// LOGOUT HANDLER
async function handleLogout(e) {
  e.preventDefault();
  if (confirm('Are you sure you want to log out from Student OS?')) {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('student_os_user');
      window.location.href = '/login.html';
    } catch (err) {
      console.error('Logout error:', err);
    }
  }
}

// SIDEBAR MOBILE TOGGLER
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('active');
}

// THEME TOGGLER
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('student_os_theme', newTheme);
  updateThemeUI(newTheme);
}

function updateThemeUI(theme) {
  const icon = document.getElementById('themeIcon');
  const text = document.getElementById('themeText');
  if (icon && text) {
    if (theme === 'light') {
      icon.className = 'fa-solid fa-sun';
      text.innerText = 'Light Mode';
    } else {
      icon.className = 'fa-solid fa-moon';
      text.innerText = 'Dark Mode';
    }
  }
}

// LANGUAGE SWITCHER
function changeLanguage(langCode) {
  window.StudentOSLang.set(langCode);
}

function localizePage() {
  const elements = document.querySelectorAll('[data-localize]');
  elements.forEach(el => {
    const key = el.getAttribute('data-localize');
    el.innerText = window.StudentOSLang.get(key);
  });
}
