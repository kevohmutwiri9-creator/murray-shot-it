// Shared utility functions for SnapVerse app

// Dark mode initialization
export function initDarkMode() {
  const darkModeToggle = document.getElementById('darkModeToggle');
  const moonIcon = document.getElementById('moonIcon');
  const sunIcon = document.getElementById('sunIcon');
  
  if (!darkModeToggle) return;

  // Check for saved preference or system preference
  const isDark = localStorage.getItem('darkMode') === 'true' ||
    (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  if (isDark) {
    document.documentElement.classList.add('dark');
    if (moonIcon) moonIcon.classList.remove('hidden');
    if (sunIcon) sunIcon.classList.add('hidden');
  } else {
    document.documentElement.classList.remove('dark');
    if (moonIcon) moonIcon.classList.add('hidden');
    if (sunIcon) sunIcon.classList.remove('hidden');
  }

  // Toggle dark mode
  darkModeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    const isDarkNow = document.documentElement.classList.contains('dark');
    localStorage.setItem('darkMode', isDarkNow);
    
    if (moonIcon && sunIcon) {
      moonIcon.classList.toggle('hidden', !isDarkNow);
      sunIcon.classList.toggle('hidden', isDarkNow);
    }
  });
}

// Mobile menu initialization
export function initMobileMenu() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const closeMobileMenu = document.getElementById('closeMobileMenu');
  const mobileMenu = document.getElementById('mobileMenu');
  
  if (!mobileMenuBtn || !mobileMenu) return;

  mobileMenuBtn.addEventListener('click', () => {
    mobileMenu.classList.remove('hidden');
    mobileMenuBtn.setAttribute('aria-expanded', 'true');
  });

  const closeMenu = () => {
    mobileMenu.classList.add('hidden');
    if (mobileMenuBtn) mobileMenuBtn.setAttribute('aria-expanded', 'false');
  };

  if (closeMobileMenu) {
    closeMobileMenu.addEventListener('click', closeMenu);
  }

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !mobileMenu.classList.contains('hidden')) {
      closeMenu();
    }
  });

  // Close on backdrop click
  mobileMenu.addEventListener('click', (e) => {
    if (e.target === mobileMenu) {
      closeMenu();
    }
  });
}

// Toast notification
export function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 px-4 py-3 rounded-xl shadow-lg z-50 animate-slide-up ${
    type === 'error' ? 'bg-red-500 text-white' :
    type === 'success' ? 'bg-green-500 text-white' :
    'bg-gray-800 text-white'
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Format date relative to now
export function formatDate(date) {
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}

// Debounce function
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
