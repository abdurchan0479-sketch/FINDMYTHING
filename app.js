/**
 * FINDMYTHING - Main Application Engine
 * Vanilla JavaScript (ES6+ Modular) implementation for Campus Lost & Found
 * Integrated with Firebase Authentication, Cloud Firestore, and Cloud Storage
 */

import {
  isFirebaseConfigured,
  auth,
  db
} from './firebase-config.js';

import {
  registerStudent,
  loginUser,
  logoutUser,
  resendVerificationEmail,
  sendPasswordReset,
  onAuthChanged,
  getCurrentUser,
  getCurrentUserProfile,
  isAdmin,
  validateImageFile,
  createLostItem,
  createFoundItem,
  reportFoundSighting,
  subscribeLostItems,
  subscribeFoundItems,
  updateItemStatus,
  deleteItem,
  submitClaim,
  subscribeClaims,
  reviewClaim,
  subscribeNotifications,
  markNotificationRead
} from './firebase-service.js';


(function () {
  'use strict';

  // --- Safe Local Storage Key for offline fallback ---
  const STORAGE_KEY = 'findmything_items_v1';

  // --- App State ---
  const state = {
    items: [],
    claims: [],
    notifications: [],
    currentUser: null,
    currentUserProfile: null,
    currentView: 'dashboard',
    activeDirectoryType: 'lost', // 'lost' | 'found'
    viewMode: 'grid', // 'grid' | 'list'
    activeCategory: 'all',
    activeLocation: 'all',
    activeUrgency: 'all',
    activeStatus: 'active',
    searchQuery: '',
    sortBy: 'date-desc',
    activeDetailItem: null,
    reportImagePreview: null,
    reportImageFile: null,
    reportPresetType: null,
    activeClaimFilter: 'all',
    isSubmitting: false,
    firestoreUnsubscribes: []
  };

  // Preset image URLs for rapid user testing
  const PRESET_IMAGES = {
    airpods: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=600&q=80",
    hydroflask: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80",
    calculator: "https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=600&q=80",
    backpack: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80",
    keys: "https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=600&q=80",
    wallet: "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=600&q=80"
  };

  // --- SVG Icons Map for clean, zero-dependency rendering ---
  const ICONS = {
    laptop: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="2" y1="20" x2="22" y2="20"></line></svg>`,
    'id-card': `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><line x1="15" y1="8" x2="17" y2="8"></line><line x1="15" y1="12" x2="17" y2="12"></line><line x1="7" y1="16" x2="17" y2="16"></line></svg>`,
    key: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7.5" cy="15.5" r="5.5"></circle><path d="m21 2-9.6 9.6"></path><path d="m15.5 7.5 3 3L22 7l-3-3"></path></svg>`,
    shirt: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"></path></svg>`,
    coffee: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="6" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>`,
    bag: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`,
    book: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
    glasses: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="15" r="4"></circle><circle cx="18" cy="15" r="4"></circle><path d="M14 15a2 2 0 0 0-4 0"></path><path d="M2.5 13 5 7c.7-1.3 1.9-2 3.5-2"></path><path d="M21.5 13 19 7c-.7-1.3-1.9-2-3.5-2"></path></svg>`,
    box: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
    mapPin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    clock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    shield: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    bell: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`
  };

  // --- Initialize App ---
  function init() {
    initFirebaseStatusBanner();
    loadFallbackItems();
    populateSelectOptions();
    bindEvents();
    setupAuthListeners();
    setupRealtimeFirestore();
    handleRouting();
    renderDashboard();
    updateNavigationBadges();
    updateNotificationBadge();
  }

  // --- 0. Firebase Status & Banner ---
  function initFirebaseStatusBanner() {
    const banner = document.getElementById('firebase-unconfigured-banner');
    if (!banner) return;
    if (!isFirebaseConfigured()) {
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }

  // --- 1. Load Fallback Items (From LocalStorage or INITIAL_ITEMS) ---
  function loadFallbackItems() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        state.items = JSON.parse(stored);
      } else if (typeof INITIAL_ITEMS !== 'undefined' && Array.isArray(INITIAL_ITEMS)) {
        state.items = [...INITIAL_ITEMS];
        saveFallbackItems();
      }
    } catch (e) {
      console.warn("LocalStorage access failed, using in-memory dataset.", e);
      if (typeof INITIAL_ITEMS !== 'undefined' && Array.isArray(INITIAL_ITEMS)) {
        state.items = [...INITIAL_ITEMS];
      }
    }
  }

  function saveFallbackItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch (e) {
      console.warn("Unable to save to localStorage", e);
    }
  }

  // --- 2. Real-Time Firestore Synchronization ---
  let firestoreLost = [];
  let firestoreFound = [];

  function setupRealtimeFirestore() {
    if (!isFirebaseConfigured()) return;

    // Unsubscribe existing listeners if any
    state.firestoreUnsubscribes.forEach(unsub => unsub());
    state.firestoreUnsubscribes = [];

    // Subscribe to lost_items
    const unsubLost = subscribeLostItems((items) => {
      firestoreLost = items;
      syncFirestoreItems();
    }, (err) => {
      console.warn('[FINDMYTHING] Lost items listener error:', err);
    });

    // Subscribe to found_items
    const unsubFound = subscribeFoundItems((items) => {
      firestoreFound = items;
      syncFirestoreItems();
    }, (err) => {
      console.warn('[FINDMYTHING] Found items listener error:', err);
    });

    state.firestoreUnsubscribes.push(unsubLost, unsubFound);
  }

  function syncFirestoreItems() {
    const combined = [...firestoreLost, ...firestoreFound];
    if (combined.length > 0) {
      state.items = combined;
    } else if (typeof INITIAL_ITEMS !== 'undefined' && Array.isArray(INITIAL_ITEMS)) {
      // If Firestore is empty initially, retain sample data
      state.items = [...INITIAL_ITEMS];
    }
    renderDashboard();
    renderItemsDirectory();
    updateNavigationBadges();
  }

  // --- 3. Authentication State & UI Updates ---
  let notificationsUnsubscribe = null;

  function setupAuthListeners() {
    onAuthChanged((user, profile) => {
      state.currentUser = user;
      state.currentUserProfile = profile;
      updateAuthUI(user, profile);

      // Subscribe to real-time claims
      if (user && isFirebaseConfigured()) {
        const userIsAdmin = profile && profile.role === 'admin';
        subscribeClaims((claims) => {
          state.claims = claims;
          updateAdminPendingBadge();
          if (document.getElementById('admin-claims-modal')?.classList.contains('open')) {
            renderAdminClaims();
          }
          if (document.getElementById('my-claims-modal')?.classList.contains('open')) {
            renderMyClaims();
          }
        });

        // Subscribe to notifications (reusing subscription, preventing duplicates)
        if (notificationsUnsubscribe) {
          notificationsUnsubscribe();
          notificationsUnsubscribe = null;
        }
        notificationsUnsubscribe = subscribeNotifications((notifications) => {
          state.notifications = notifications;
          updateNotificationBadge();

          if (isNotificationsDropdownOpen()) {
            renderNotificationsList();
          }
        }, (err) => {
          console.warn('[FINDMYTHING] Notification listener error:', err);
        }, userIsAdmin);

      } else {
        if (notificationsUnsubscribe) {
          notificationsUnsubscribe();
          notificationsUnsubscribe = null;
        }

        state.claims = [];
        state.notifications = [];

        updateAdminPendingBadge();
        updateNotificationBadge();

        if (isNotificationsDropdownOpen()) {
          renderNotificationsList();
        }
      }
      // Re-render views to reflect permission states
      if (state.activeDetailItem) {
        openItemDetail(state.activeDetailItem.id);
      }
      renderItemsDirectory();
    });
  }

  function updateAuthUI(user, profile) {
    const container = document.getElementById('auth-header-container');
    const adminBtn = document.getElementById('btn-header-admin');
    const mAdminLink = document.getElementById('m-admin-link');
    const mMyClaimsLink = document.getElementById('m-my-claims-link');
    const mAuthSlot = document.getElementById('m-auth-slot');
    const verifBanner = document.getElementById('email-verification-banner');

    const userIsAdmin = profile && profile.role === 'admin';

    // Admin Access Controls
    if (adminBtn) adminBtn.style.display = userIsAdmin ? 'inline-flex' : 'none';
    if (mAdminLink) mAdminLink.style.display = userIsAdmin ? 'block' : 'none';
    if (mMyClaimsLink) mMyClaimsLink.style.display = user ? 'block' : 'none';

    // Email verification banner
    if (verifBanner) {
      if (user && !user.emailVerified) {
        verifBanner.style.display = 'block';
        const txt = document.getElementById('email-verification-text');
        if (txt) txt.textContent = `A verification email was sent to ${user.email}. Please verify your student email.`;
      } else {
        verifBanner.style.display = 'none';
      }
    }

    if (!user) {
      // Signed Out State
      if (container) {
        container.innerHTML = `
          <button type="button" class="auth-header-btn" id="btn-header-login" onclick="FMT.openAuthModal('login')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
            Sign In
          </button>
        `;
      }
      if (mAuthSlot) {
        mAuthSlot.innerHTML = `
          <button type="button" class="btn btn-primary btn-sm" style="width: 100%;" onclick="FMT.openAuthModal('login')">
            Sign In / Register
          </button>
        `;
      }
    } else {
      // Signed In State
      const name = profile?.displayName || user.displayName || user.email.split('@')[0];
      const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'ST';
      const role = profile?.role || 'student';
      const roleBadgeHtml = role === 'admin'
        ? `<span class="role-badge role-badge-admin">ADMIN</span>`
        : `<span class="role-badge role-badge-student">STUDENT</span>`;

      if (container) {
        container.innerHTML = `
          <div class="user-profile-pill" onclick="FMT.openMyClaimsModal()" title="Logged in as ${escapeHtml(name)} (${role})">
            <div class="user-avatar">${initials}</div>
            <span class="user-name">${escapeHtml(name)}</span>
            ${roleBadgeHtml}
            <button type="button" onclick="event.stopPropagation(); FMT.handleLogout();" title="Sign Out" style="margin-left: 0.25rem; color: var(--slate-400); display: flex; align-items: center;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>
        `;
      }

      if (mAuthSlot) {
        mAuthSlot.innerHTML = `
          <div style="display: flex; gap: 0.5rem; width: 100%;">
            <button type="button" class="btn btn-outline btn-sm" style="flex: 1;" onclick="FMT.openMyClaimsModal()">
              My Claims
            </button>
            <button type="button" class="btn btn-secondary btn-sm" style="flex: 1;" onclick="FMT.handleLogout()">
              Sign Out
            </button>
          </div>
        `;
      }
    }
  }

  function updateAdminPendingBadge() {
    const pendingCount = state.claims.filter(c => c.status === 'pending').length;
    const badge = document.getElementById('admin-pending-badge');
    if (badge) badge.textContent = pendingCount;
  } markNotificationRead

  // --- 4. Populate Dynamic Form Selects & Filter Options ---
  function populateSelectOptions() {
    const catSelectFilter = document.getElementById('filter-category');
    const catSelectForm = document.getElementById('form-category');

    if (typeof ITEM_CATEGORIES !== 'undefined') {
      ITEM_CATEGORIES.forEach(cat => {
        if (catSelectFilter) {
          const opt = document.createElement('option');
          opt.value = cat.id;
          opt.textContent = cat.label;
          catSelectFilter.appendChild(opt);
        }
        if (catSelectForm) {
          const opt2 = document.createElement('option');
          opt2.value = cat.id;
          opt2.textContent = cat.label;
          catSelectForm.appendChild(opt2);
        }
      });
    }

    const locSelectFilter = document.getElementById('filter-location');
    const locSelectForm = document.getElementById('form-location');

    if (typeof CAMPUS_LOCATIONS !== 'undefined') {
      CAMPUS_LOCATIONS.forEach(loc => {
        if (locSelectFilter) {
          const opt = document.createElement('option');
          opt.value = loc;
          opt.textContent = loc;
          locSelectFilter.appendChild(opt);
        }
        if (locSelectForm) {
          const opt2 = document.createElement('option');
          opt2.value = loc;
          opt2.textContent = loc;
          locSelectForm.appendChild(opt2);
        }
      });
    }

    const dateInput = document.getElementById('form-date');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
      dateInput.max = today;
    }
  }

  // --- 5. Update Navbar Badge Counters ---
  function updateNavigationBadges() {
    const activeLost = state.items.filter(i => i.type === 'lost' && i.status === 'active').length;
    const activeFound = state.items.filter(i => i.type === 'found' && i.status === 'active').length;

    const navLost = document.getElementById('nav-count-lost');
    const navFound = document.getElementById('nav-count-found');
    const mLost = document.getElementById('m-count-lost');
    const mFound = document.getElementById('m-count-found');

    if (navLost) navLost.textContent = activeLost;
    if (navFound) navFound.textContent = activeFound;
    if (mLost) mLost.textContent = activeLost;
    if (mFound) mFound.textContent = activeFound;
  }

  // --- 6. View Routing & Navigation ---
  function navigateTo(viewName, params = {}) {
    window.location.hash = viewName;
    applyView(viewName, params);
  }

  function handleRouting() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';

    if (hash.startsWith('item=')) {
      const itemId = hash.replace('item=', '');
      openItemDetail(itemId);
      return;
    }

    if (hash === 'depots') {
      openDepotsModal();
      return;
    }

    if (hash === 'admin-claims') {
      openAdminClaimsModal();
      return;
    }

    applyView(hash);
  }

  function applyView(viewName, params = {}) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));

    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.dataset.view === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    const drawer = document.getElementById('mobile-nav-drawer');
    if (drawer) drawer.classList.remove('open');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewName === 'dashboard') {
      state.currentView = 'dashboard';
      const el = document.getElementById('view-dashboard');
      if (el) el.classList.add('active');
      renderDashboard();
    } else if (viewName === 'lost') {
      state.currentView = 'lost';
      state.activeDirectoryType = 'lost';
      const el = document.getElementById('view-items');
      if (el) el.classList.add('active');
      setupItemsDirectory('lost', params);
    } else if (viewName === 'found') {
      state.currentView = 'found';
      state.activeDirectoryType = 'found';
      const el = document.getElementById('view-items');
      if (el) el.classList.add('active');
      setupItemsDirectory('found', params);
    } else if (viewName === 'report') {
      // Student-only protected view check
      if (!state.currentUser && isFirebaseConfigured()) {
        showToast('Please sign in with your campus account to submit a report.', 'info');
        openAuthModal('login');
      }
      state.currentView = 'report';
      const el = document.getElementById('view-report');
      if (el) el.classList.add('active');
      setupReportView(params.type || 'lost');
    }
  }

  // --- 7. Render Dashboard ---
  function renderDashboard() {
    const activeLost = state.items.filter(i => i.type === 'lost' && i.status === 'active').length;
    const activeFound = state.items.filter(i => i.type === 'found' && i.status === 'active').length;
    const resolvedCount = state.items.filter(i => i.status === 'resolved').length;
    const urgentCount = state.items.filter(i => i.urgency === 'high' && i.status === 'active').length;

    const statsGrid = document.getElementById('stats-overview-grid');
    if (statsGrid) {
      statsGrid.innerHTML = `
        <div class="stat-card" role="button" tabindex="0" onclick="FMT.navigateTo('lost')">
          <div class="stat-icon-wrap stat-amber">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <div class="stat-content">
            <span class="stat-value">${activeLost}</span>
            <span class="stat-label">Active Lost Items</span>
            <span class="stat-subtext">Reported across campus</span>
          </div>
        </div>

        <div class="stat-card" role="button" tabindex="0" onclick="FMT.navigateTo('found')">
          <div class="stat-icon-wrap stat-emerald">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <div class="stat-content">
            <span class="stat-value">${activeFound}</span>
            <span class="stat-label">Turned-In Belongings</span>
            <span class="stat-subtext">Stored in campus depots</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon-wrap stat-blue">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>
          <div class="stat-content">
            <span class="stat-value">${resolvedCount}</span>
            <span class="stat-label">Reunited Items</span>
            <span class="stat-subtext">Verified returns this term</span>
          </div>
        </div>

        <div class="stat-card" role="button" tabindex="0" onclick="FMT.filterUrgent()">
          <div class="stat-icon-wrap stat-rose">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <div class="stat-content">
            <span class="stat-value">${urgentCount}</span>
            <span class="stat-label">Urgent High-Priority</span>
            <span class="stat-subtext">Keys, IDs &amp; medical</span>
          </div>
        </div>
      `;
    }

    const catContainer = document.getElementById('category-pills-container');
    if (catContainer && typeof ITEM_CATEGORIES !== 'undefined') {
      let pillsHtml = `
        <button type="button" class="category-pill-btn active" data-category="all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          All Categories (${state.items.length})
        </button>
      `;

      ITEM_CATEGORIES.forEach(cat => {
        const count = state.items.filter(i => i.category === cat.id).length;
        const iconSvg = ICONS[cat.icon] || ICONS.box;
        pillsHtml += `
          <button type="button" class="category-pill-btn" data-category="${cat.id}">
            ${iconSvg}
            ${cat.label} (${count})
          </button>
        `;
      });
      catContainer.innerHTML = pillsHtml;
    }

    const recentLost = state.items.filter(i => i.type === 'lost').slice(0, 4);
    const lostListEl = document.getElementById('dashboard-recent-lost-list');
    if (lostListEl) {
      if (recentLost.length === 0) {
        lostListEl.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--slate-400);">No lost items reported yet.</div>`;
      } else {
        lostListEl.innerHTML = recentLost.map(item => createMiniItemCard(item)).join('');
      }
    }

    const recentFound = state.items.filter(i => i.type === 'found').slice(0, 4);
    const foundListEl = document.getElementById('dashboard-recent-found-list');
    if (foundListEl) {
      if (recentFound.length === 0) {
        foundListEl.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--slate-400);">No found items logged yet.</div>`;
      } else {
        foundListEl.innerHTML = recentFound.map(item => createMiniItemCard(item)).join('');
      }
    }
  }

  function createMiniItemCard(item) {
    const isLost = item.type === 'lost';
    const badgeHtml = item.status === 'resolved'
      ? `<span class="badge badge-resolved">${ICONS.check} Resolved</span>`
      : isLost
        ? `<span class="badge badge-lost">LOST</span>`
        : `<span class="badge badge-found">FOUND</span>`;

    const urgencyHtml = item.urgency === 'high'
      ? `<span class="badge badge-urgent" style="font-size: 0.6875rem;">Urgent</span>`
      : '';

    const rewardHtml = item.reward
      ? `<span class="reward-pill" style="font-size: 0.6875rem;">${item.reward}</span>`
      : '';

    return `
      <div class="item-mini-card" role="button" tabindex="0" onclick="FMT.openItemDetail('${item.id}')">
        <img src="${item.image}" alt="${escapeHtml(item.title)}" class="item-mini-thumb" onerror="this.src='https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=300&q=80'">
        <div class="item-mini-info">
          <div class="item-mini-top">
            <h4 class="item-mini-title">${escapeHtml(item.title)}</h4>
            <div style="display: flex; gap: 0.25rem;">
              ${rewardHtml}
              ${urgencyHtml}
              ${badgeHtml}
            </div>
          </div>
          <div class="item-mini-loc">
            ${ICONS.mapPin}
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.location)}</span>
          </div>
          <div class="item-mini-meta">
            <span>${item.date}</span>
            <span style="color: var(--primary-600); font-weight: 600;">View &rarr;</span>
          </div>
        </div>
      </div>
    `;
  }

  // --- 8. Items Directory View (Lost & Found) ---
  function setupItemsDirectory(type, params = {}) {
    state.activeDirectoryType = type;

    const titleEl = document.getElementById('items-view-title');
    const subTitleEl = document.getElementById('items-view-subtitle');
    const ctaLabel = document.getElementById('btn-directory-report-label');

    if (type === 'lost') {
      if (titleEl) titleEl.textContent = 'Lost Belongings Directory';
      if (subTitleEl) subTitleEl.textContent = 'Help fellow campus members locate and return their misplaced items';
      if (ctaLabel) ctaLabel.textContent = 'Report a Lost Item';
    } else {
      if (titleEl) titleEl.textContent = 'Recovered & Turned-In Items';
      if (subTitleEl) subTitleEl.textContent = 'Items safely turned in to campus security, libraries, and student desks';
      if (ctaLabel) ctaLabel.textContent = 'Report a Found Item';
    }

    if (params.category) {
      state.activeCategory = params.category;
      const catSelect = document.getElementById('filter-category');
      if (catSelect) catSelect.value = params.category;
    }

    if (params.urgency) {
      state.activeUrgency = params.urgency;
      const urgSelect = document.getElementById('filter-urgency');
      if (urgSelect) urgSelect.value = params.urgency;
    }

    if (params.search) {
      state.searchQuery = params.search;
      const sInput = document.getElementById('filter-search');
      if (sInput) sInput.value = params.search;
    }

    renderItemsDirectory();
  }

  function renderItemsDirectory() {
    const container = document.getElementById('items-catalog-container');
    const emptyState = document.getElementById('items-empty-state');
    const countText = document.getElementById('results-count-text');
    const tagsContainer = document.getElementById('active-tags-container');

    if (!container) return;

    let filtered = state.items.filter(item => {
      if (item.type !== state.activeDirectoryType) return false;
      if (state.activeCategory !== 'all' && item.category !== state.activeCategory) return false;
      if (state.activeLocation !== 'all' && item.location !== state.activeLocation) return false;
      if (state.activeUrgency !== 'all' && item.urgency !== state.activeUrgency) return false;
      if (state.activeStatus === 'active' && item.status !== 'active') return false;
      if (state.activeStatus === 'resolved' && item.status !== 'resolved') return false;

      if (state.searchQuery.trim() !== '') {
        const q = state.searchQuery.toLowerCase();
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const descMatch = (item.description || '').toLowerCase().includes(q);
        const locMatch = (item.location || '').toLowerCase().includes(q);
        const idMatch = (item.id || '').toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !locMatch && !idMatch) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      if (state.sortBy === 'date-desc') {
        return new Date(b.date || 0) - new Date(a.date || 0);
      } else if (state.sortBy === 'date-asc') {
        return new Date(a.date || 0) - new Date(b.date || 0);
      } else if (state.sortBy === 'reward-desc') {
        const getRewardNum = str => parseInt((str || '$0').replace(/[^0-9]/g, '')) || 0;
        return getRewardNum(b.reward) - getRewardNum(a.reward);
      } else if (state.sortBy === 'urgency-desc') {
        const rank = { high: 3, medium: 2, low: 1 };
        return (rank[b.urgency] || 0) - (rank[a.urgency] || 0);
      }
      return 0;
    });

    if (tagsContainer) {
      let tagsHtml = '';
      if (state.searchQuery) {
        tagsHtml += `<span class="active-tag">Search: "${escapeHtml(state.searchQuery)}" <button type="button" onclick="FMT.clearSearchTag()">&times;</button></span>`;
      }
      if (state.activeCategory !== 'all') {
        const catObj = (typeof ITEM_CATEGORIES !== 'undefined') ? ITEM_CATEGORIES.find(c => c.id === state.activeCategory) : null;
        tagsHtml += `<span class="active-tag">Category: ${catObj ? catObj.label : state.activeCategory} <button type="button" onclick="FMT.clearCategoryTag()">&times;</button></span>`;
      }
      if (state.activeLocation !== 'all') {
        tagsHtml += `<span class="active-tag">Location: ${escapeHtml(state.activeLocation)} <button type="button" onclick="FMT.clearLocationTag()">&times;</button></span>`;
      }
      if (state.activeUrgency !== 'all') {
        tagsHtml += `<span class="active-tag">Urgency: ${state.activeUrgency.toUpperCase()} <button type="button" onclick="FMT.clearUrgencyTag()">&times;</button></span>`;
      }
      tagsContainer.innerHTML = tagsHtml;
    }

    if (countText) {
      countText.innerHTML = `Showing <strong>${filtered.length}</strong> ${state.activeDirectoryType} item${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    if (state.viewMode === 'list') {
      container.className = 'items-grid items-list-layout';
    } else {
      container.className = 'items-grid';
    }

    container.innerHTML = filtered.map(item => renderItemCard(item)).join('');
  }

  // Full Item Card Component with Confidentiality Protection
  function renderItemCard(item) {
    const isLost = item.type === 'lost';
    const isFoundOrResolved = item.status === 'resolved' || item.status === 'found';
    const statusBadge = item.status === 'resolved'
      ? `<span class="badge badge-resolved">${ICONS.check} RESOLVED</span>`
      : item.status === 'found'
        ? `<span class="badge badge-found">${ICONS.check} FOUND</span>`
        : isLost
          ? `<span class="badge badge-lost">LOST</span>`
          : `<span class="badge badge-found">FOUND</span>`;

    const urgencyBadge = item.urgency === 'high'
      ? `<span class="badge badge-urgent">High Urgency</span>`
      : '';

    const rewardPill = item.reward
      ? `<span class="reward-pill" title="Finder's Reward">${item.reward} Reward</span>`
      : '';

    const catObj = (typeof ITEM_CATEGORIES !== 'undefined') ? ITEM_CATEGORIES.find(c => c.id === item.category) : null;
    const catLabel = catObj ? catObj.label : item.category;

    const actionBtnLabel = isFoundOrResolved
      ? 'View Details'
      : isLost
        ? 'I Found This!'
        : 'Claim Item';

    // Confidentiality Protection: Never display confidential verification traits in public item listings
    const canViewPrivateTraits = isAdmin() || (state.currentUser && item.reporterUid === state.currentUser.uid);
    let distinctiveHtml = '';
    if (item.distinctiveMarks) {
      if (canViewPrivateTraits) {
        distinctiveHtml = `
          <div class="card-distinctive-hint">
            <strong>Distinctive:</strong> ${escapeHtml(item.distinctiveMarks)}
          </div>
        `;
      } else {
        distinctiveHtml = `
          <div class="card-distinctive-hint" style="color: var(--slate-500);">
            🔒 <em>Distinctive traits logged for staff verification</em>
          </div>
        `;
      }
    }

    return `
      <article class="item-card" data-item-id="${item.id}" onclick="FMT.openItemDetail('${item.id}')">
        <div class="card-media">
          <img src="${item.image}" alt="${escapeHtml(item.title)}" class="card-img" onerror="this.src='https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=500&q=80'">
          <div class="card-top-badges">
            <span class="card-id-pill">${item.id}</span>
            <div style="display: flex; gap: 0.35rem; align-items: center;">
              ${rewardPill}
              ${urgencyBadge}
              ${statusBadge}
            </div>
          </div>
        </div>

        <div class="card-body">
          <div class="card-category-row">
            <span class="badge badge-category">${catLabel}</span>
            ${item.originalLostItemId ? `<span class="badge badge-found" style="font-size: 0.6875rem;" title="Linked to Lost Report #${item.originalLostItemId}">Matched Lost #${item.originalLostItemId}</span>` : ''}
            <span class="card-time-ago">${ICONS.clock} ${item.date}</span>
          </div>

          <h3 class="card-title">${escapeHtml(item.title)}</h3>

          <div class="card-location">
            ${ICONS.mapPin}
            <span><strong>${escapeHtml(item.location)}</strong> ${item.specificLocation ? `&bull; ${escapeHtml(item.specificLocation)}` : ''}</span>
          </div>

          <p class="card-description">${escapeHtml(item.description)}</p>

          ${distinctiveHtml}

          <div class="card-footer" onclick="event.stopPropagation()">
            <button type="button" class="btn btn-outline btn-sm" onclick="FMT.openItemDetail('${item.id}')">
              View Details
            </button>
            <button type="button" class="btn ${isLost ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="FMT.handleCardAction('${item.id}')">
              ${actionBtnLabel}
            </button>
          </div>
        </div>
      </article>
    `;
  }

  // --- 9. Report Form Setup & Submission ---
  function setupReportView(initialType = 'lost') {
    setReportType(initialType);
    resetReportForm();

    // Auto-fill student profile info if authenticated
    if (state.currentUserProfile) {
      const nameField = document.getElementById('form-contact-name');
      const emailField = document.getElementById('form-contact-email');
      const phoneField = document.getElementById('form-contact-phone');

      if (nameField && state.currentUserProfile.displayName) nameField.value = state.currentUserProfile.displayName;
      if (emailField && state.currentUserProfile.email) emailField.value = state.currentUserProfile.email;
      if (phoneField && state.currentUserProfile.phone) phoneField.value = state.currentUserProfile.phone;
    }
  }

  function setReportType(type) {
    const hiddenField = document.getElementById('report-type-field');
    const optLost = document.getElementById('type-opt-lost');
    const optFound = document.getElementById('type-opt-found');
    const fieldsLost = document.getElementById('fields-lost-only');
    const fieldsFound = document.getElementById('fields-found-only');
    const submitBtn = document.getElementById('btn-submit-report');

    if (hiddenField) hiddenField.value = type;

    if (type === 'lost') {
      if (optLost) optLost.className = 'type-toggle-card selected-lost';
      if (optFound) optFound.className = 'type-toggle-card';
      if (fieldsLost) fieldsLost.style.display = 'block';
      if (fieldsFound) fieldsFound.style.display = 'none';
      if (submitBtn) submitBtn.textContent = 'Submit Lost Item Notice';
    } else {
      if (optLost) optLost.className = 'type-toggle-card';
      if (optFound) optFound.className = 'type-toggle-card selected-found';
      if (fieldsLost) fieldsLost.style.display = 'none';
      if (fieldsFound) fieldsFound.style.display = 'block';
      if (submitBtn) submitBtn.textContent = 'Submit Found Item Record';
    }
  }

  function resetReportForm() {
    const form = document.getElementById('report-item-form');
    if (form) form.reset();

    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('form-date');
    if (dateInput) dateInput.value = today;

    if (state.reportImagePreview && state.reportImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(state.reportImagePreview);
    }
    state.reportImagePreview = null;
    state.reportImageFile = null;
    state.reportPresetType = null;
    const previewWrapper = document.getElementById('image-preview-wrapper');
    const uploadZone = document.getElementById('upload-zone');
    if (previewWrapper) previewWrapper.style.display = 'none';
    if (uploadZone) uploadZone.style.display = 'block';
  }

  async function handleReportFormSubmit(e) {
    e.preventDefault();

    if (state.isSubmitting) return;

    // Protection: User must be signed in to submit reports
    if (!state.currentUser && isFirebaseConfigured()) {
      showToast('Authentication required: Please sign in to submit a report.', 'warning');
      openAuthModal('login');
      return;
    }

    const type = document.getElementById('report-type-field').value;
    const title = document.getElementById('form-title').value.trim();
    const category = document.getElementById('form-category').value;
    const location = document.getElementById('form-location').value;
    const date = document.getElementById('form-date').value;
    const description = document.getElementById('form-description').value.trim();
    const contactName = document.getElementById('form-contact-name').value.trim();
    const contactEmail = document.getElementById('form-contact-email').value.trim();
    const honorChecked = document.getElementById('form-honor-code').checked;

    if (!title || !category || !location || !date || !description || !contactName || !contactEmail) {
      showToast('Please fill out all required fields marked with *', 'warning');
      return;
    }

    if (!honorChecked) {
      showToast('Please agree to the Campus Honor Code before submitting.', 'warning');
      return;
    }

    // Validate selected file if present
    if (state.reportImageFile) {
      const v = validateImageFile(state.reportImageFile);
      if (!v.valid) {
        showToast(v.error, 'warning');
        return;
      }
    }

    state.isSubmitting = true;
    const submitBtn = document.getElementById('btn-submit-report');
    const originalBtnText = submitBtn ? submitBtn.textContent : 'Submit';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Saving report to Firestore database...`;
    }

    try {
      const newId = `FMT-${Math.floor(1000 + Math.random() * 9000)}`;

      let itemImage = state.reportImagePreview;
      if (!itemImage && state.reportPresetType) {
        itemImage = PRESET_IMAGES[state.reportPresetType];
      }
      if (!itemImage) {
        itemImage = "https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=600&q=80";
      }

      const newItem = {
        id: newId,
        title: title,
        type: type,
        category: category,
        location: location,
        specificLocation: document.getElementById('form-specific-location').value.trim(),
        date: date,
        time: document.getElementById('form-time').value || '12:00',
        status: 'active',
        urgency: document.getElementById('form-urgency') ? document.getElementById('form-urgency').value : 'medium',
        reward: type === 'lost' ? (document.getElementById('form-reward').value.trim() || null) : null,
        description: description,
        distinctiveMarks: document.getElementById('form-distinctive-marks').value.trim(),
        contactName: contactName,
        contactRole: document.getElementById('form-contact-role').value.trim() || 'Campus Student',
        contactEmail: contactEmail,
        contactPhone: document.getElementById('form-contact-phone').value.trim() || '+1 (555) 911-2000',
        handoverStation: type === 'found'
          ? document.getElementById('form-handover').value
          : 'Campus Safety Dispatch',
        image: itemImage,
        reporterUid: state.currentUser ? state.currentUser.uid : 'anon',
        matchesCount: 0
      };

      if (isFirebaseConfigured() && state.currentUser) {
        // Direct Firestore creation without Firebase Storage dependency
        if (type === 'lost') {
          await createLostItem(newItem);
        } else {
          await createFoundItem(newItem);
        }
        showToast(`Success! Report #${newId} recorded in Cloud Firestore database.`, 'success');
      } else {
        // Local fallback
        state.items.unshift(newItem);
        saveFallbackItems();
        updateNavigationBadges();
        showToast(`Report #${newId} recorded in session.`, 'success');
      }

      resetReportForm();
      navigateTo(type);
      setTimeout(() => {
        openItemDetail(newId);
      }, 350);

    } catch (err) {
      console.error('[FINDMYTHING] Submission error:', err);
      showToast(err.message || 'Error saving report. Please try again.', 'warning');
    } finally {
      state.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }
  }

  // --- 10. Item Detail Modal View & Access Control ---
  function openItemDetail(itemId) {
    const item = state.items.find(i => i.id === itemId);
    if (!item) {
      showToast('Item not found.', 'warning');
      return;
    }

    state.activeDetailItem = item;

    const modal = document.getElementById('item-detail-modal');
    const imgEl = document.getElementById('detail-img');
    const idEl = document.getElementById('detail-id-text');
    const titleEl = document.getElementById('modal-detail-title');
    const typeBadge = document.getElementById('detail-type-badge');
    const catBadge = document.getElementById('detail-category-badge');
    const urgBadge = document.getElementById('detail-urgency-badge');
    const rewardPill = document.getElementById('detail-reward-pill');
    const locVal = document.getElementById('detail-location-val');
    const specVal = document.getElementById('detail-specific-val');
    const dateVal = document.getElementById('detail-date-val');
    const handoverVal = document.getElementById('detail-handover-val');
    const descText = document.getElementById('detail-description-text');
    const distinctiveBlock = document.getElementById('detail-distinctive-block');
    const distinctiveText = document.getElementById('detail-distinctive-text');
    const distinctiveMasked = document.getElementById('detail-distinctive-masked');
    const contactTitle = document.getElementById('detail-contact-title');
    const contactBody = document.getElementById('detail-contact-body');
    const primaryBtn = document.getElementById('btn-detail-primary-action');
    const resolveBtn = document.getElementById('btn-detail-resolve');
    const deleteBtn = document.getElementById('btn-detail-delete');

    if (imgEl) imgEl.src = item.image;
    if (idEl) {
      if (item.originalLostItemId) {
        idEl.textContent = `ITEM REF: ${item.id} (MATCHED FROM LOST #${item.originalLostItemId})`;
      } else if (item.linkedFoundItemId) {
        idEl.textContent = `ITEM REF: ${item.id} (FOUND AS #${item.linkedFoundItemId})`;
      } else {
        idEl.textContent = `ITEM REF: ${item.id}`;
      }
    }
    if (titleEl) titleEl.textContent = item.title;

    const isLost = item.type === 'lost';
    if (typeBadge) {
      if (item.status === 'resolved') {
        typeBadge.textContent = 'RESOLVED ITEM';
        typeBadge.className = 'badge badge-resolved';
      } else if (item.status === 'found') {
        typeBadge.textContent = isLost ? 'FOUND (WAS LOST)' : 'FOUND ITEM';
        typeBadge.className = 'badge badge-found';
      } else {
        typeBadge.textContent = isLost ? 'LOST ITEM' : 'FOUND ITEM';
        typeBadge.className = isLost ? 'badge badge-lost' : 'badge badge-found';
      }
    }

    const catObj = (typeof ITEM_CATEGORIES !== 'undefined') ? ITEM_CATEGORIES.find(c => c.id === item.category) : null;
    if (catBadge) catBadge.textContent = catObj ? catObj.label : item.category;

    if (urgBadge) {
      urgBadge.textContent = `${(item.urgency || 'MEDIUM').toUpperCase()} URGENCY`;
      urgBadge.className = item.urgency === 'high' ? 'badge badge-urgent' : 'badge badge-category';
    }

    if (rewardPill) {
      if (item.reward) {
        rewardPill.style.display = 'inline-flex';
        rewardPill.textContent = `Reward: ${item.reward}`;
      } else {
        rewardPill.style.display = 'none';
      }
    }

    if (locVal) locVal.textContent = item.location;
    if (specVal) specVal.textContent = item.specificLocation || 'General Facility Area';
    if (dateVal) dateVal.textContent = `${item.date} at ${item.time || 'approx. midday'}`;
    if (handoverVal) handoverVal.textContent = item.handoverStation || 'Campus Safety HQ';
    if (descText) descText.textContent = item.description;

    // Confidentiality Rule: Only authorized admins or the reporter can see secret traits
    const canSeeSecret = isAdmin() || (state.currentUser && item.reporterUid === state.currentUser.uid);
    if (distinctiveBlock) {
      if (item.distinctiveMarks) {
        distinctiveBlock.style.display = 'block';
        if (canSeeSecret) {
          if (distinctiveText) {
            distinctiveText.style.display = 'block';
            distinctiveText.textContent = item.distinctiveMarks;
          }
          if (distinctiveMasked) distinctiveMasked.style.display = 'none';
        } else {
          if (distinctiveText) distinctiveText.style.display = 'none';
          if (distinctiveMasked) distinctiveMasked.style.display = 'block';
        }
      } else {
        distinctiveBlock.style.display = 'none';
      }
    }

    // Reporter Contact Details
    if (contactTitle && contactBody) {
      if (isLost) {
        contactTitle.textContent = `Owner Contact: ${escapeHtml(item.contactName)} (${escapeHtml(item.contactRole || 'Student')})`;
        contactBody.innerHTML = `Email: <strong>${escapeHtml(item.contactEmail)}</strong> &bull; Phone: <strong>${escapeHtml(item.contactPhone)}</strong><br><span style="font-size: 0.75rem;">Verified Campus Community Member</span>`;
      } else {
        contactTitle.textContent = `Holding Facility / Finder: ${escapeHtml(item.contactName)}`;
        contactBody.innerHTML = `Location: <strong>${escapeHtml(item.handoverStation || 'Campus Desk')}</strong><br>Direct Email: <strong>${escapeHtml(item.contactEmail)}</strong> &bull; Desk: <strong>${escapeHtml(item.contactPhone)}</strong>`;
      }
    }

    // Primary action button
    if (primaryBtn) {
      if (item.status === 'resolved') {
        primaryBtn.textContent = 'Item Already Returned';
        primaryBtn.className = 'btn btn-secondary';
        primaryBtn.disabled = true;
      } else if (item.status === 'found') {
        primaryBtn.textContent = 'Item Marked as Found';
        primaryBtn.className = 'btn btn-secondary';
        primaryBtn.disabled = true;
      } else if (isLost) {
        primaryBtn.textContent = 'I Found This Item!';
        primaryBtn.className = 'btn btn-success';
        primaryBtn.disabled = false;
        primaryBtn.onclick = () => FMT.handleFoundSighting(item.id);
      } else {
        primaryBtn.textContent = 'Claim This Item';
        primaryBtn.className = 'btn btn-primary';
        primaryBtn.disabled = false;
        primaryBtn.onclick = () => FMT.openClaimModal(item.id);
      }
    }

    // Reporter & Admin Management Actions (Edit/Resolve/Delete)
    const canManageReport = isAdmin() || (state.currentUser && item.reporterUid === state.currentUser.uid);
    if (resolveBtn) {
      if (canManageReport && item.status !== 'resolved') {
        resolveBtn.style.display = 'inline-flex';
        resolveBtn.textContent = 'Mark as Resolved';
      } else {
        resolveBtn.style.display = 'none';
      }
    }
    if (deleteBtn) {
      deleteBtn.style.display = canManageReport ? 'inline-flex' : 'none';
    }

    // Tracker steps
    const trackerStep2 = document.getElementById('tracker-step-2');
    const trackerStep2Label = document.getElementById('tracker-step-2-label');
    const trackerStep3 = document.getElementById('tracker-step-3');

    if (item.status === 'resolved') {
      if (trackerStep2) trackerStep2.className = 'tracker-step completed';
      if (trackerStep3) trackerStep3.className = 'tracker-step completed';
      if (trackerStep2Label) trackerStep2Label.textContent = '2. Verified';
    } else {
      if (trackerStep2) trackerStep2.className = 'tracker-step active';
      if (trackerStep3) trackerStep3.className = 'tracker-step';
      if (trackerStep2Label) trackerStep2Label.textContent = isLost ? '2. Broadcast' : '2. Stored in Depot';
    }

    if (modal) modal.classList.add('open');
  }

  function closeItemDetailModal() {
    const modal = document.getElementById('item-detail-modal');
    if (modal) modal.classList.remove('open');
  }

  // --- 11. Claim Verification Modal Flow ---
  function openClaimModal(itemId) {
    // Protection: User must be signed in to submit a claim
    if (!state.currentUser && isFirebaseConfigured()) {
      showToast('Please sign in to submit an ownership claim.', 'info');
      openAuthModal('login');
      return;
    }

    closeItemDetailModal();

    const item = state.items.find(i => i.id === itemId);
    if (!item) return;

    const modal = document.getElementById('claim-modal');
    const idField = document.getElementById('claim-item-id-field');
    const titleEl = document.getElementById('claim-modal-title');
    const form = document.getElementById('claim-verification-form');
    const studentIdInput = document.getElementById('claim-student-id');

    if (idField) idField.value = item.id;
    if (titleEl) titleEl.textContent = `Claiming: ${item.title}`;
    if (form) form.reset();

    // Auto-fill student ID if cached
    if (studentIdInput && state.currentUserProfile?.studentId) {
      studentIdInput.value = state.currentUserProfile.studentId;
    }

    if (modal) modal.classList.add('open');
  }

  function closeClaimModal() {
    const modal = document.getElementById('claim-modal');
    if (modal) modal.classList.remove('open');
  }

  async function handleClaimSubmit(e) {
    e.preventDefault();

    if (state.isSubmitting) return;

    const itemId = document.getElementById('claim-item-id-field').value;
    const proof = document.getElementById('claim-proof').value.trim();
    const studentId = document.getElementById('claim-student-id').value.trim();
    const pickupTime = document.getElementById('claim-pickup-time').value;
    const agree = document.getElementById('claim-agree').checked;

    if (!proof || !studentId) {
      showToast('Please enter proof of ownership and your Student ID.', 'warning');
      return;
    }

    if (!agree) {
      showToast('You must acknowledge the Honor Code statement.', 'warning');
      return;
    }

    const item = state.items.find(i => i.id === itemId);
    if (!item) return;

    state.isSubmitting = true;
    const submitBtn = document.getElementById('btn-confirm-claim');
    const origBtnText = submitBtn ? submitBtn.textContent : 'Submit';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Encrypting &amp; submitting claim...`;
    }

    try {
      if (isFirebaseConfigured() && state.currentUser) {
        const result = await submitClaim({
          itemId: item.id,
          itemTitle: item.title,
          itemType: item.type,
          itemCollection: item.collection,
          proof: proof,
          studentId: studentId,
          pickupTime: pickupTime
        });

        closeClaimModal();
        showToast(`Claim Ticket #${result.ticketNumber} submitted! Campus Safety staff will review your confidential verification answers.`, 'success', 6000);
      } else {
        // Fallback for local preview
        const ticketNumber = `CLM-${Math.floor(100000 + Math.random() * 900000)}`;
        item.status = 'resolved';
        saveFallbackItems();
        updateNavigationBadges();
        renderItemsDirectory();
        renderDashboard();
        closeClaimModal();
        showToast(`Claim Ticket #${ticketNumber} created! Present ID at ${item.handoverStation || 'Campus Desk'}.`, 'success', 6000);
      }
    } catch (err) {
      console.error('[FINDMYTHING] Claim submission error:', err);
      showToast(err.message || 'Error submitting claim. Please try again.', 'warning');
    } finally {
      state.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = origBtnText;
      }
    }
  }

  // --- 12. Admin Claims Review Modal ---
  function openAdminClaimsModal() {
    if (!isAdmin()) {
      showToast('Access restricted: Only authorized Campus Safety Administrators can review claims.', 'warning');
      return;
    }
    const modal = document.getElementById('admin-claims-modal');
    if (modal) {
      modal.classList.add('open');
      renderAdminClaims();
    }
  }

  function closeAdminClaimsModal() {
    const modal = document.getElementById('admin-claims-modal');
    if (modal) modal.classList.remove('open');
  }

  function filterAdminClaims(filterStatus) {
    state.activeClaimFilter = filterStatus;
    document.querySelectorAll('.admin-filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.claimFilter === filterStatus);
    });
    renderAdminClaims();
  }

  function renderAdminClaims() {
    const container = document.getElementById('admin-claims-container');
    if (!container) return;

    // Update counts
    const allCount = state.claims.length;
    const pendingCount = state.claims.filter(c => c.status === 'pending').length;
    const approvedCount = state.claims.filter(c => c.status === 'approved').length;
    const rejectedCount = state.claims.filter(c => c.status === 'rejected').length;

    const elAll = document.getElementById('count-claim-all');
    const elPending = document.getElementById('count-claim-pending');
    const elApproved = document.getElementById('count-claim-approved');
    const elRejected = document.getElementById('count-claim-rejected');

    if (elAll) elAll.textContent = allCount;
    if (elPending) elPending.textContent = pendingCount;
    if (elApproved) elApproved.textContent = approvedCount;
    if (elRejected) elRejected.textContent = rejectedCount;

    let filtered = state.claims;
    if (state.activeClaimFilter !== 'all') {
      filtered = state.claims.filter(c => c.status === state.activeClaimFilter);
    }

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 2.5rem 1rem; color: var(--slate-400);">No ${state.activeClaimFilter === 'all' ? '' : state.activeClaimFilter} claims found.</div>`;
      return;
    }

    container.innerHTML = filtered.map(claim => {
      const matchingItem = state.items.find(i => i.id === claim.itemId);
      const isPending = claim.status === 'pending';

      const statusBadge = claim.status === 'approved'
        ? `<span class="badge badge-status-approved">${ICONS.check} Approved</span>`
        : claim.status === 'rejected'
          ? `<span class="badge badge-status-rejected">Rejected</span>`
          : `<span class="badge badge-status-pending">Pending Review</span>`;

      return `
        <div class="claim-review-card" data-claim-id="${claim.id}">
          <div class="claim-card-header">
            <div>
              <span class="card-id-pill" style="font-size: 0.6875rem;">${claim.id}</span>
              <h4 style="font-size: 1.05rem; font-weight: 700; margin-top: 0.25rem;">${escapeHtml(claim.itemTitle)}</h4>
              <div style="font-size: 0.8125rem; color: var(--slate-500); margin-top: 0.25rem;">
                Claimant: <strong>${escapeHtml(claim.claimantName)}</strong> (ID: ${escapeHtml(claim.claimantStudentId)}) &bull; ${escapeHtml(claim.claimantEmail)}
              </div>
            </div>
            <div>
              ${statusBadge}
            </div>
          </div>

          <!-- Cross-verification comparison -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.75rem;">
            <div class="claim-proof-box">
              <strong style="color: var(--primary-800); display: block; margin-bottom: 0.25rem;">
                Student's Submitted Ownership Proof:
              </strong>
              <span>${escapeHtml(claim.proof)}</span>
            </div>
            <div class="confidential-box protected" style="margin: 0;">
              <strong style="display: block; margin-bottom: 0.25rem;">
                Item's Logged Distinctive Marks:
              </strong>
              <span>${matchingItem?.distinctiveMarks ? escapeHtml(matchingItem.distinctiveMarks) : '<em>No secret marks logged at intake</em>'}</span>
            </div>
          </div>

          ${isPending ? `
            <div style="margin-top: 0.75rem;">
              <label for="admin-notes-${claim.id}" class="form-label" style="font-size: 0.75rem;">Admin Verification Notes (Optional):</label>
              <input type="text" id="admin-notes-${claim.id}" class="form-control" style="font-size: 0.8125rem; padding: 0.4rem 0.65rem;" placeholder="e.g. Serial numbers matched, student verified in registrar system...">
            </div>
            <div class="claim-actions-row">
              <button type="button" class="btn btn-danger btn-sm" onclick="FMT.handleAdminClaimDecision('${claim.id}', 'rejected')">
                Reject Claim
              </button>
              <button type="button" class="btn btn-success btn-sm" onclick="FMT.handleAdminClaimDecision('${claim.id}', 'approved')">
                Approve Ownership &amp; Return
              </button>
            </div>
          ` : `
            <div style="margin-top: 0.75rem; font-size: 0.8125rem; color: var(--slate-500); border-top: 1px solid var(--border-subtle); padding-top: 0.5rem;">
              Decision: <strong>${claim.status.toUpperCase()}</strong> by ${escapeHtml(claim.reviewedBy || 'Staff')} ${claim.adminNotes ? `&bull; Notes: "${escapeHtml(claim.adminNotes)}"` : ''}
            </div>
          `}
        </div>
      `;
    }).join('');
  }

  async function handleAdminClaimDecision(claimId, decision) {
    if (!isAdmin()) {
      showToast('Unauthorized: Only administrators can approve or reject claims.', 'warning');
      return;
    }

    const claim = state.claims.find(c => c.id === claimId);
    if (!claim) return;

    const notesInput = document.getElementById(`admin-notes-${claimId}`);
    const notes = notesInput ? notesInput.value.trim() : '';

    try {
      if (isFirebaseConfigured()) {
        await reviewClaim(claimId, decision, notes, claim);
        showToast(`Claim #${claimId} marked as ${decision}.`, 'success');
      } else {
        claim.status = decision;
        claim.adminNotes = notes;
        claim.reviewedBy = state.currentUserProfile?.displayName || 'Campus Safety Admin';
        if (decision === 'approved') {
          const it = state.items.find(i => i.id === claim.itemId);
          if (it) it.status = 'resolved';
          saveFallbackItems();
        }
        renderAdminClaims();
        renderDashboard();
        renderItemsDirectory();
        showToast(`Claim #${claimId} marked as ${decision}.`, 'success');
      }
    } catch (err) {
      console.error('[FINDMYTHING] Claim review error:', err);
      showToast(err.message || 'Error updating claim.', 'warning');
    }
  }

  // --- 13. Student "My Claims" Modal ---
  function openMyClaimsModal() {
    if (!state.currentUser && isFirebaseConfigured()) {
      showToast('Please sign in to view your claims.', 'info');
      openAuthModal('login');
      return;
    }
    const modal = document.getElementById('my-claims-modal');
    if (modal) {
      modal.classList.add('open');
      renderMyClaims();
    }
  }

  function closeMyClaimsModal() {
    const modal = document.getElementById('my-claims-modal');
    if (modal) modal.classList.remove('open');
  }

  function renderMyClaims() {
    const container = document.getElementById('my-claims-container');
    if (!container) return;

    const userClaims = state.claims.filter(c => c.claimantUid === (state.currentUser?.uid || 'anon'));

    if (userClaims.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 2.5rem 1rem; color: var(--slate-400);">You haven't submitted any ownership claims yet.</div>`;
      return;
    }

    container.innerHTML = userClaims.map(c => {
      const statusBadge = c.status === 'approved'
        ? `<span class="badge badge-status-approved">${ICONS.check} Claim Approved</span>`
        : c.status === 'rejected'
          ? `<span class="badge badge-status-rejected">Claim Rejected</span>`
          : `<span class="badge badge-status-pending">Under Safety Review</span>`;

      return `
        <div class="claim-review-card">
          <div class="claim-card-header">
            <div>
              <span class="card-id-pill" style="font-size: 0.6875rem;">${c.id}</span>
              <h4 style="font-size: 1rem; font-weight: 700; margin-top: 0.25rem;">${escapeHtml(c.itemTitle)}</h4>
              <div style="font-size: 0.8125rem; color: var(--slate-500);">Submitted with Student ID: ${escapeHtml(c.claimantStudentId)}</div>
            </div>
            <div>
              ${statusBadge}
            </div>
          </div>
          <div class="claim-proof-box" style="font-size: 0.8125rem;">
            <strong>Your Submitted Proof:</strong> ${escapeHtml(c.proof)}
          </div>
          ${c.status === 'approved' ? `
            <div class="confidential-box protected" style="font-size: 0.8125rem;">
              🎉 <strong>Ready for Pickup:</strong> Your claim has been approved! Present your physical student ID at the designated desk to retrieve your property.
            </div>
          ` : c.status === 'rejected' ? `
            <div style="font-size: 0.8125rem; color: var(--accent-rose-dark); margin-top: 0.5rem;">
              Notice from Campus Safety: ${escapeHtml(c.adminNotes || 'Verification traits did not match logged item specifications.')}
            </div>
          ` : `
            <div style="font-size: 0.75rem; color: var(--slate-400); margin-top: 0.5rem;">
              Safety staff at central dispatch are reviewing your submission against intake logs.
            </div>
          `}
        </div>
      `;
    }).join('');
  }

  // --- 13b. Notifications Dropdown & Management ---
  function getUnreadNotificationsCount() {
    return (state.notifications || []).filter(n => !n.read).length;
  }

  function updateNotificationBadge() {
    const badge = document.getElementById('notification-badge');
    const mCount = document.getElementById('m-count-notifications');
    const unreadText = document.getElementById('notifications-unread-text');
    const markAllBtn = document.getElementById('btn-mark-all-read');
    const count = getUnreadNotificationsCount();

    if (badge) {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-flex';
      } else {
        badge.textContent = '0';
        badge.style.display = 'none';
      }
    }
    if (mCount) {
      mCount.textContent = count;
    }
    if (unreadText) {
      unreadText.textContent = count === 1 ? '1 unread' : `${count} unread`;
    }
    if (markAllBtn) {
      markAllBtn.style.display = count > 0 ? 'inline-block' : 'none';
    }
  }

  function formatNotificationDate(raw) {
    if (!raw) return 'Just now';
    let d;
    if (typeof raw.toDate === 'function') {
      d = raw.toDate();
    } else if (raw.seconds) {
      d = new Date(raw.seconds * 1000);
    } else if (raw instanceof Date) {
      d = raw;
    } else {
      d = new Date(raw);
    }

    if (isNaN(d.getTime())) return 'Recently';

    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'Just now';
    const min = Math.floor(diff / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function isNotificationsDropdownOpen() {
    const panel = document.getElementById('notifications-panel');
    return panel && panel.style.display !== 'none';
  }

  function toggleNotificationsDropdown(e) {
    if (e) e.stopPropagation();
    if (isNotificationsDropdownOpen()) {
      closeNotificationsDropdown();
    } else {
      openNotificationsDropdown();
    }
  }

  function openNotificationsDropdown() {
    const panel = document.getElementById('notifications-panel');
    const bell = document.getElementById('btn-notifications-bell');
    if (!panel) return;
    // Close mobile drawer if open
    const drawer = document.getElementById('mobile-nav-drawer');
    if (drawer && drawer.classList.contains('open')) {
      drawer.classList.remove('open');
    }
    panel.style.display = 'flex';
    if (bell) bell.setAttribute('aria-expanded', 'true');
    renderNotificationsList();
  }

  function closeNotificationsDropdown() {
    const panel = document.getElementById('notifications-panel');
    const bell = document.getElementById('btn-notifications-bell');
    if (!panel) return;
    panel.style.display = 'none';
    if (bell) bell.setAttribute('aria-expanded', 'false');
  }

  function renderNotificationsList() {
    const container = document.getElementById('notifications-list');
    if (!container) return;

    const notifications = state.notifications || [];

    if (notifications.length === 0) {
      const notLoggedInMsg = (!state.currentUser && isFirebaseConfigured())
        ? 'Sign in with your campus account to view notifications and claim updates.'
        : 'You are all caught up! No notifications right now.';

      container.innerHTML = `
        <div class="notifications-empty-state">
          <div class="notifications-empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </div>
          <p class="notifications-empty-title">All caught up</p>
          <p class="notifications-empty-desc">${escapeHtml(notLoggedInMsg)}</p>
        </div>
      `;
      updateNotificationBadge();
      return;
    }

    container.innerHTML = notifications.map(n => {
      const isUnread = !n.read;
      const timeStr = formatNotificationDate(n.createdAt);

      let iconHtml = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
      let iconClass = 'notif-icon-default';

      if (n.type === 'claim_approved' || n.type === 'item_found') {
        iconHtml = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        iconClass = 'notif-icon-success';
      } else if (n.type === 'claim_rejected') {
        iconHtml = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        iconClass = 'notif-icon-danger';
      } else if (n.type === 'new_claim') {
        iconHtml = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
        iconClass = 'notif-icon-warning';
      }

      return `
        <div class="notification-item ${isUnread ? 'unread' : ''}" onclick="FMT.handleNotificationClick('${escapeHtml(n.id)}')">
          <div class="notification-icon ${iconClass}">
            ${iconHtml}
          </div>
          <div class="notification-body">
            <div class="notification-item-header">
              <h5 class="notification-item-title">${escapeHtml(n.title || 'Notification')}</h5>
              ${isUnread ? `<span class="notification-unread-dot" title="Unread"></span>` : ''}
            </div>
            <p class="notification-item-message">${escapeHtml(n.message || '')}</p>
            <div class="notification-item-meta">
              <span class="notification-item-time">${timeStr}</span>
              ${isUnread ? `
                <button type="button" class="btn-notif-mark-read" onclick="event.stopPropagation(); FMT.handleMarkNotificationRead('${escapeHtml(n.id)}')" title="Mark as read">
                  Mark read
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    updateNotificationBadge();
  }

  async function handleMarkNotificationRead(notificationId) {
    const notif = (state.notifications || []).find(n => n.id === notificationId);
    if (notif) {
      notif.read = true;
      updateNotificationBadge();
      renderNotificationsList();
    }
    if (isFirebaseConfigured()) {
      try {
        await markNotificationRead(notificationId);
      } catch (err) {
        console.warn('[FINDMYTHING] Error marking notification read:', err);
      }
    }
  }

  async function markAllNotificationsRead() {
    const unread = (state.notifications || []).filter(n => !n.read);
    if (unread.length === 0) return;

    unread.forEach(n => { n.read = true; });
    updateNotificationBadge();
    renderNotificationsList();

    if (isFirebaseConfigured()) {
      for (const n of unread) {
        try {
          await markNotificationRead(n.id);
        } catch (err) {
          console.warn('[FINDMYTHING] Failed to mark notification read:', err);
        }
      }
    }
  }

  async function handleNotificationClick(notificationId) {
    const notif = (state.notifications || []).find(n => n.id === notificationId);
    if (!notif) return;

    if (!notif.read) {
      await handleMarkNotificationRead(notificationId);
    }

    closeNotificationsDropdown();

    if (notif.link === '#admin-claims' || notif.type === 'new_claim') {
      if (isAdmin()) {
        openAdminClaimsModal();
      }
    } else if (notif.type === 'claim_approved' || notif.type === 'claim_rejected') {
      openMyClaimsModal();
    } else if (notif.type === 'item_found') {
      navigateTo('found');
      if (notif.relatedItemId) {
        setTimeout(() => openItemDetail(notif.relatedItemId), 250);
      }
    }
  }

  // --- 14. Authentication Modal & Form Actions ---
  function openAuthModal(initialTab = 'login') {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      switchAuthTab(initialTab);
      modal.classList.add('open');
    }
  }

  function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('open');
  }

  function switchAuthTab(tab) {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const cardLogin = document.getElementById('auth-card-login');
    const cardRegister = document.getElementById('auth-card-register');

    if (tab === 'login') {
      if (tabLogin) tabLogin.classList.add('active');
      if (tabRegister) tabRegister.classList.remove('active');
      if (cardLogin) cardLogin.classList.add('active');
      if (cardRegister) cardRegister.classList.remove('active');
    } else {
      if (tabRegister) tabRegister.classList.add('active');
      if (tabLogin) tabLogin.classList.remove('active');
      if (cardRegister) cardRegister.classList.add('active');
      if (cardLogin) cardLogin.classList.remove('active');
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const submitBtn = document.getElementById('btn-submit-login');

    if (!email || !password) {
      showToast('Please enter your email and password.', 'warning');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Signing in...`;
    }

    try {
      if (isFirebaseConfigured()) {
        const result = await loginUser({ email, password });
        closeAuthModal();
        showToast(`Welcome back, ${result.profile?.displayName || result.user.email}!`, 'success');
      } else {
        // Fallback for local preview mode
        const isMockAdmin = email.toLowerCase().includes('admin');
        const mockProfile = {
          uid: 'mock-uid-' + Date.now(),
          email: email,
          displayName: email.split('@')[0],
          role: isMockAdmin ? 'admin' : 'student',
          studentId: '903-124-567',
          phone: '+1 (555) 234-5678',
          emailVerified: true
        };
        state.currentUser = { uid: mockProfile.uid, email: mockProfile.email, emailVerified: true };
        state.currentUserProfile = mockProfile;
        updateAuthUI(state.currentUser, mockProfile);
        closeAuthModal();
        showToast(`Signed in in local preview mode as ${mockProfile.displayName} (${mockProfile.role})`, 'success');
      }
    } catch (err) {
      console.error('[FINDMYTHING] Login error:', err);
      showToast(err.message || 'Invalid credentials. Please try again.', 'warning');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In to FINDMYTHING';
      }
    }
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const studentId = document.getElementById('reg-student-id').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-password-confirm').value;
    const submitBtn = document.getElementById('btn-submit-register');

    if (!name || !studentId || !email || !password) {
      showToast('Please fill out all required fields.', 'warning');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match. Please verify.', 'warning');
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters long.', 'warning');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span> Creating student profile...`;
    }

    try {
      if (isFirebaseConfigured()) {
        const result = await registerStudent({
          email,
          password,
          displayName: name,
          studentId,
          phone
        });
        closeAuthModal();
        showToast(`Account created! A verification email was sent to ${email}.`, 'success', 6000);
      } else {
        // Fallback for local preview
        const mockProfile = {
          uid: 'mock-uid-' + Date.now(),
          email: email,
          displayName: name,
          role: 'student',
          studentId: studentId,
          phone: phone,
          emailVerified: false
        };
        state.currentUser = { uid: mockProfile.uid, email: mockProfile.email, emailVerified: false };
        state.currentUserProfile = mockProfile;
        updateAuthUI(state.currentUser, mockProfile);
        closeAuthModal();
        showToast(`Student profile created in preview mode for ${name}.`, 'success');
      }
    } catch (err) {
      console.error('[FINDMYTHING] Registration error:', err);
      showToast(err.message || 'Error creating account. Please try again.', 'warning');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Student Account';
      }
    }
  }

  async function handleLogout() {
    try {
      await logoutUser();
      state.currentUser = null;
      state.currentUserProfile = null;
      updateAuthUI(null, null);
      showToast('You have been signed out.', 'info');
    } catch (err) {
      console.error('[FINDMYTHING] Logout error:', err);
    }
  }

  async function resendVerification() {
    try {
      if (isFirebaseConfigured()) {
        await resendVerificationEmail();
        showToast('Verification email resent! Please check your campus inbox.', 'success');
      } else {
        showToast('Verification email simulated in preview mode.', 'info');
      }
    } catch (err) {
      showToast(err.message || 'Failed to send verification email.', 'warning');
    }
  }

  async function promptForgotPassword() {
    const email = prompt('Enter your campus email address for a password reset link:');
    if (!email) return;
    try {
      if (isFirebaseConfigured()) {
        await sendPasswordReset(email.trim());
        showToast(`Password reset link dispatched to ${email}.`, 'success');
      } else {
        showToast(`Password reset link simulated for ${email}.`, 'info');
      }
    } catch (err) {
      showToast(err.message || 'Error requesting password reset.', 'warning');
    }
  }

  // --- 15. Manage Status & Item Resolution by Reporter or Admin ---
  async function toggleCurrentItemStatus() {
    if (!state.activeDetailItem) return;
    const item = state.activeDetailItem;
    const newStatus = item.status === 'resolved' ? 'active' : 'resolved';

    try {
      await updateItemStatus(item, newStatus);
      item.status = newStatus;
      if (!isFirebaseConfigured()) saveFallbackItems();
      openItemDetail(item.id);
      renderDashboard();
      renderItemsDirectory();
      updateNavigationBadges();
      showToast(`Status updated to: ${newStatus.toUpperCase()}`, 'success');
    } catch (err) {
      showToast(err.message || 'Unable to update status.', 'warning');
    }
  }

  async function deleteCurrentItem() {
    if (!state.activeDetailItem) return;
    const item = state.activeDetailItem;
    if (!confirm(`Are you sure you want to delete notice #${item.id} (${item.title})?`)) return;

    try {
      await deleteItem(item);
      state.items = state.items.filter(i => i.id !== item.id);
      if (!isFirebaseConfigured()) saveFallbackItems();
      closeItemDetailModal();
      renderDashboard();
      renderItemsDirectory();
      updateNavigationBadges();
      showToast(`Report #${item.id} has been deleted.`, 'info');
    } catch (err) {
      showToast(err.message || 'Unable to delete notice.', 'warning');
    }
  }

  async function handleFoundSighting(itemId) {
    if (state.isSubmitting) return;

    if (!state.currentUser && isFirebaseConfigured()) {
      showToast('Please sign in to report that you found this item.', 'warning');
      openAuthModal('login');
      return;
    }

    const item = state.items.find(i => i.id === itemId);
    if (!item) {
      showToast('Item report not found.', 'warning');
      return;
    }

    if (item.status === 'found' || item.status === 'resolved') {
      showToast(`This item has already been marked as ${item.status}.`, 'info');
      return;
    }

    // Check if duplicate found record already exists in catalog
    const rawId = String(item.id).replace(/^LST-/, '');
    const expectedFoundId = 'FND-' + rawId;
    const alreadyFound = state.items.find(i => i.id === expectedFoundId || i.originalLostItemId === item.id);
    if (alreadyFound) {
      showToast(`A found report (#${alreadyFound.id}) already exists for this item.`, 'info');
      return;
    }

    state.isSubmitting = true;
    const primaryBtn = document.getElementById('btn-detail-primary-action');
    const origBtnText = primaryBtn ? primaryBtn.textContent : '';
    if (primaryBtn) {
      primaryBtn.disabled = true;
      primaryBtn.innerHTML = `<span class="spinner"></span> Logging found report...`;
    }

    try {
      const result = await reportFoundSighting(item);

      // Optimistic local state update
      item.status = 'found';
      item.foundAt = new Date().toISOString();
      item.finderUid = state.currentUser ? state.currentUser.uid : 'anon';
      item.finderName = state.currentUserProfile?.displayName || state.currentUser?.displayName || 'Campus Student';
      item.linkedFoundItemId = result.foundItemId;

      if (!isFirebaseConfigured() && result.foundItem) {
        // Local offline fallback
        state.items.unshift(result.foundItem);
        saveFallbackItems();
        updateNavigationBadges();
        renderDashboard();
        renderItemsDirectory();

        // Local notification for owner if applicable
        if (item.reporterUid && state.currentUser && item.reporterUid !== state.currentUser.uid) {
          state.notifications.unshift({
            id: `notif-${Date.now()}`,
            userId: item.reporterUid,
            title: 'Your Lost Item Has Been Found! 🎉',
            message: `${item.finderName} reported finding your "${item.title}". It has been logged as Found Item #${result.foundItemId}.`,
            type: 'item_found',
            link: '#found',
            relatedItemId: result.foundItemId,
            originalLostItemId: item.id,
            read: false,
            createdAt: new Date()
          });
          updateNotificationBadge();
        }
      }

      closeItemDetailModal();
      showToast(`Great job! Found Report #${result.foundItemId} logged and the original owner has been notified.`, 'success', 6000);

      // Smoothly navigate to found items to view the new entry
      setTimeout(() => {
        navigateTo('found');
      }, 500);

    } catch (err) {
      console.error('[FINDMYTHING] Failed to report found sighting:', err);
      showToast(err.message || 'Unable to record found report. Please try again.', 'warning', 6000);
    } finally {
      state.isSubmitting = false;
      if (primaryBtn) {
        primaryBtn.disabled = false;
        primaryBtn.textContent = origBtnText || 'I Found This Item!';
      }
    }
  }

  // --- 16. Depots & Firebase Setup Modals ---
  function openDepotsModal() {
    const modal = document.getElementById('depots-modal');
    if (modal) modal.classList.add('open');
  }

  function closeDepotsModal() {
    const modal = document.getElementById('depots-modal');
    if (modal) modal.classList.remove('open');
  }

  function openFirebaseSetupModal() {
    const modal = document.getElementById('firebase-setup-modal');
    if (modal) modal.classList.add('open');
  }

  function closeFirebaseSetupModal() {
    const modal = document.getElementById('firebase-setup-modal');
    if (modal) modal.classList.remove('open');
  }

  // --- 17. Toast Notification Utility ---
  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = ICONS.check;
    if (type === 'warning') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else if (type === 'info') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    }

    toast.innerHTML = `
      <span>${iconSvg}</span>
      <span style="flex: 1;">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- 18. Event Bindings ---
  function bindEvents() {
    window.addEventListener('hashchange', handleRouting);

    const mobileBtn = document.getElementById('mobile-toggle-btn');
    const mobileDrawer = document.getElementById('mobile-nav-drawer');
    if (mobileBtn && mobileDrawer) {
      mobileBtn.addEventListener('click', () => {
        mobileDrawer.classList.toggle('open');
      });
    }

    const heroReportLost = document.getElementById('hero-btn-report-lost');
    const heroReportFound = document.getElementById('hero-btn-report-found');
    if (heroReportLost) heroReportLost.addEventListener('click', () => navigateTo('report', { type: 'lost' }));
    if (heroReportFound) heroReportFound.addEventListener('click', () => navigateTo('report', { type: 'found' }));

    const headerReport = document.getElementById('btn-header-report');
    if (headerReport) headerReport.addEventListener('click', () => navigateTo('report'));

    const dirReport = document.getElementById('btn-directory-report');
    if (dirReport) {
      dirReport.addEventListener('click', () => navigateTo('report', { type: state.activeDirectoryType }));
    }

    const emptyReport = document.getElementById('btn-empty-report');
    if (emptyReport) {
      emptyReport.addEventListener('click', () => navigateTo('report', { type: state.activeDirectoryType }));
    }

    const heroSearchForm = document.getElementById('hero-search-form');
    const heroSearchInput = document.getElementById('hero-search-input');
    if (heroSearchForm && heroSearchInput) {
      heroSearchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const term = heroSearchInput.value.trim();
        if (term) navigateTo('lost', { search: term });
      });
    }

    document.querySelectorAll('.popular-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const term = chip.dataset.searchTerm;
        navigateTo('lost', { search: term });
      });
    });

    const catBar = document.getElementById('category-pills-container');
    if (catBar) {
      catBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.category-pill-btn');
        if (!btn) return;
        const categoryId = btn.dataset.category;
        navigateTo('lost', { category: categoryId });
      });
    }

    // Directory filter listeners
    const filterSearch = document.getElementById('filter-search');
    const btnClearSearch = document.getElementById('btn-clear-search');
    if (filterSearch) {
      filterSearch.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if (btnClearSearch) btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
        renderItemsDirectory();
      });
    }

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        if (filterSearch) filterSearch.value = '';
        state.searchQuery = '';
        btnClearSearch.style.display = 'none';
        renderItemsDirectory();
      });
    }

    const filterCat = document.getElementById('filter-category');
    if (filterCat) filterCat.addEventListener('change', (e) => { state.activeCategory = e.target.value; renderItemsDirectory(); });

    const filterLoc = document.getElementById('filter-location');
    if (filterLoc) filterLoc.addEventListener('change', (e) => { state.activeLocation = e.target.value; renderItemsDirectory(); });

    const filterUrg = document.getElementById('filter-urgency');
    if (filterUrg) filterUrg.addEventListener('change', (e) => { state.activeUrgency = e.target.value; renderItemsDirectory(); });

    const filterStat = document.getElementById('filter-status');
    if (filterStat) filterStat.addEventListener('change', (e) => { state.activeStatus = e.target.value; renderItemsDirectory(); });

    const filterSort = document.getElementById('filter-sort');
    if (filterSort) filterSort.addEventListener('change', (e) => { state.sortBy = e.target.value; renderItemsDirectory(); });

    const btnReset = document.getElementById('btn-reset-filters');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        state.searchQuery = '';
        state.activeCategory = 'all';
        state.activeLocation = 'all';
        state.activeUrgency = 'all';
        state.activeStatus = 'active';
        state.sortBy = 'date-desc';

        if (filterSearch) filterSearch.value = '';
        if (filterCat) filterCat.value = 'all';
        if (filterLoc) filterLoc.value = 'all';
        if (filterUrg) filterUrg.value = 'all';
        if (filterStat) filterStat.value = 'active';
        if (filterSort) filterSort.value = 'date-desc';
        if (btnClearSearch) btnClearSearch.style.display = 'none';

        renderItemsDirectory();
        showToast('All search & filter criteria reset.', 'info');
      });
    }

    const btnGrid = document.getElementById('btn-view-grid');
    const btnList = document.getElementById('btn-view-list');
    if (btnGrid && btnList) {
      btnGrid.addEventListener('click', () => {
        state.viewMode = 'grid';
        btnGrid.classList.add('active');
        btnList.classList.remove('active');
        renderItemsDirectory();
      });
      btnList.addEventListener('click', () => {
        state.viewMode = 'list';
        btnList.classList.add('active');
        btnGrid.classList.remove('active');
        renderItemsDirectory();
      });
    }

    const optLost = document.getElementById('type-opt-lost');
    const optFound = document.getElementById('type-opt-found');
    if (optLost) optLost.addEventListener('click', () => setReportType('lost'));
    if (optFound) optFound.addEventListener('click', () => setReportType('found'));

    const reportForm = document.getElementById('report-item-form');
    if (reportForm) reportForm.addEventListener('submit', handleReportFormSubmit);

    const cancelReport = document.getElementById('btn-cancel-report');
    if (cancelReport) cancelReport.addEventListener('click', () => navigateTo('dashboard'));

    // Image Upload & Validation
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('form-image-file');
    const previewWrapper = document.getElementById('image-preview-wrapper');
    const previewImg = document.getElementById('form-preview-img');
    const previewName = document.getElementById('preview-filename');
    const btnRemovePreview = document.getElementById('btn-remove-preview');

    if (uploadZone && fileInput) {
      uploadZone.addEventListener('click', () => fileInput.click());
      uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = 'var(--primary-600)';
      });
      uploadZone.addEventListener('dragleave', () => {
        uploadZone.style.borderColor = 'var(--border-strong)';
      });
      uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = 'var(--border-strong)';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          processImageFile(e.dataTransfer.files[0]);
        }
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          processImageFile(e.target.files[0]);
        }
      });
    }

    function processImageFile(file) {
      const v = validateImageFile(file);
      if (!v.valid) {
        showToast(v.error, 'warning');
        return;
      }

      // Revoke prior object URL if any to free browser memory
      if (state.reportImagePreview && state.reportImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(state.reportImagePreview);
      }

      // Generate local browser object URL for instant, storage-free preview
      const objectUrl = URL.createObjectURL(file);
      state.reportImageFile = file;
      state.reportImagePreview = objectUrl;
      state.reportPresetType = null;

      if (previewImg) previewImg.src = objectUrl;
      if (previewName) previewName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB - Local Preview)`;
      if (uploadZone) uploadZone.style.display = 'none';
      if (previewWrapper) previewWrapper.style.display = 'flex';
      showToast('Photo selected and previewed locally.', 'info');
    }

    if (btnRemovePreview) {
      btnRemovePreview.addEventListener('click', () => {
        if (state.reportImagePreview && state.reportImagePreview.startsWith('blob:')) {
          URL.revokeObjectURL(state.reportImagePreview);
        }
        state.reportImagePreview = null;
        state.reportImageFile = null;
        state.reportPresetType = null;
        if (fileInput) fileInput.value = '';
        if (previewWrapper) previewWrapper.style.display = 'none';
        if (uploadZone) uploadZone.style.display = 'block';
      });
    }

    document.querySelectorAll('.preset-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const presetKey = btn.dataset.preset;
        const presetUrl = PRESET_IMAGES[presetKey];
        if (presetUrl) {
          if (state.reportImagePreview && state.reportImagePreview.startsWith('blob:')) {
            URL.revokeObjectURL(state.reportImagePreview);
          }
          state.reportPresetType = presetKey;
          state.reportImagePreview = presetUrl;
          state.reportImageFile = null;
          if (fileInput) fileInput.value = '';
          if (previewImg) previewImg.src = presetUrl;
          if (previewName) previewName.textContent = `${presetKey}-preset.jpg`;
          if (uploadZone) uploadZone.style.display = 'none';
          if (previewWrapper) previewWrapper.style.display = 'flex';
          showToast(`Attached sample photo for ${presetKey}.`, 'info');
        }
      });
    });

    const btnCloseDetail = document.getElementById('btn-close-detail-modal');
    const detailModal = document.getElementById('item-detail-modal');
    if (btnCloseDetail) btnCloseDetail.addEventListener('click', closeItemDetailModal);
    if (detailModal) {
      detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal) closeItemDetailModal();
      });
    }

    const btnShare = document.getElementById('btn-share-item');
    if (btnShare) {
      btnShare.addEventListener('click', () => {
        if (state.activeDetailItem) {
          const itemUrl = `${window.location.origin}${window.location.pathname}#item=${state.activeDetailItem.id}`;
          navigator.clipboard.writeText(itemUrl).then(() => {
            showToast('Item link copied to clipboard!', 'success');
          }).catch(() => {
            showToast(`Item Reference: #${state.activeDetailItem.id}`, 'info');
          });
        }
      });
    }

    const btnPrint = document.getElementById('btn-print-flyer');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => window.print());
    }

    const claimModal = document.getElementById('claim-modal');
    const btnCloseClaim = document.getElementById('btn-close-claim-modal');
    const btnCancelClaim = document.getElementById('btn-cancel-claim');
    const claimForm = document.getElementById('claim-verification-form');

    if (btnCloseClaim) btnCloseClaim.addEventListener('click', closeClaimModal);
    if (btnCancelClaim) btnCancelClaim.addEventListener('click', closeClaimModal);
    if (claimModal) {
      claimModal.addEventListener('click', (e) => {
        if (e.target === claimModal) closeClaimModal();
      });
    }
    if (claimForm) claimForm.addEventListener('submit', handleClaimSubmit);

    const depotsModal = document.getElementById('depots-modal');
    const linkDepots = document.getElementById('link-depots-modal');
    const mDepotsBtn = document.getElementById('m-depots-btn');
    const footerDepots = document.getElementById('footer-depots-link');
    const btnCloseDepots = document.getElementById('btn-close-depots-modal');

    if (linkDepots) linkDepots.addEventListener('click', (e) => { e.preventDefault(); openDepotsModal(); });
    if (mDepotsBtn) mDepotsBtn.addEventListener('click', openDepotsModal);
    if (footerDepots) footerDepots.addEventListener('click', (e) => { e.preventDefault(); openDepotsModal(); });
    if (btnCloseDepots) btnCloseDepots.addEventListener('click', closeDepotsModal);
    if (depotsModal) {
      depotsModal.addEventListener('click', (e) => {
        if (e.target === depotsModal) closeDepotsModal();
      });
    }

    // Close notifications panel on outside click
    document.addEventListener('click', (e) => {
      const wrap = document.getElementById('notifications-dropdown-wrap');
      if (wrap && !wrap.contains(e.target)) {
        closeNotificationsDropdown();
      }
    });

    // Keyboard ESC closes modals & dropdowns
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeNotificationsDropdown();
        closeItemDetailModal();
        closeClaimModal();
        closeDepotsModal();
        closeAuthModal();
        closeAdminClaimsModal();
        closeMyClaimsModal();
        closeFirebaseSetupModal();
      }
    });
  }

  // --- Exposed Global API for inline HTML handlers & tests ---
  window.FMT = {
    navigateTo: navigateTo,
    openItemDetail: openItemDetail,
    openClaimModal: openClaimModal,
    handleCardAction: function (itemId) {
      const item = state.items.find(i => i.id === itemId);
      if (!item) return;
      if (item.status === 'resolved' || item.status === 'found') {
        openItemDetail(itemId);
      } else if (item.type === 'found') {
        openClaimModal(itemId);
      } else if (item.type === 'lost') {
        handleFoundSighting(itemId);
      } else {
        openItemDetail(itemId);
      }
    },
    handleFoundSighting: handleFoundSighting,
    showToast: showToast,
    filterUrgent: function () {
      navigateTo('lost', { urgency: 'high' });
    },
    clearSearchTag: function () {
      state.searchQuery = '';
      const el = document.getElementById('filter-search');
      if (el) el.value = '';
      renderItemsDirectory();
    },
    clearCategoryTag: function () {
      state.activeCategory = 'all';
      const el = document.getElementById('filter-category');
      if (el) el.value = 'all';
      renderItemsDirectory();
    },
    clearLocationTag: function () {
      state.activeLocation = 'all';
      const el = document.getElementById('filter-location');
      if (el) el.value = 'all';
      renderItemsDirectory();
    },
    clearUrgencyTag: function () {
      state.activeUrgency = 'all';
      const el = document.getElementById('filter-urgency');
      if (el) el.value = 'all';
      renderItemsDirectory();
    },
    // Authentication handlers
    openAuthModal: openAuthModal,
    closeAuthModal: closeAuthModal,
    switchAuthTab: switchAuthTab,
    handleLoginSubmit: handleLoginSubmit,
    handleRegisterSubmit: handleRegisterSubmit,
    handleLogout: handleLogout,
    resendVerification: resendVerification,
    promptForgotPassword: promptForgotPassword,
    // Claim & Admin handlers
    openAdminClaimsModal: openAdminClaimsModal,
    closeAdminClaimsModal: closeAdminClaimsModal,
    filterAdminClaims: filterAdminClaims,
    handleAdminClaimDecision: handleAdminClaimDecision,
    openMyClaimsModal: openMyClaimsModal,
    closeMyClaimsModal: closeMyClaimsModal,
    // Notifications handlers
    toggleNotificationsDropdown: toggleNotificationsDropdown,
    openNotificationsDropdown: openNotificationsDropdown,
    closeNotificationsDropdown: closeNotificationsDropdown,
    handleMarkNotificationRead: handleMarkNotificationRead,
    markAllNotificationsRead: markAllNotificationsRead,
    handleNotificationClick: handleNotificationClick,
    // Status update & delete
    toggleCurrentItemStatus: toggleCurrentItemStatus,
    deleteCurrentItem: deleteCurrentItem,
    // Setup modal
    openFirebaseSetupModal: openFirebaseSetupModal,
    closeFirebaseSetupModal: closeFirebaseSetupModal,
    // State inspection helper for verification
    getState: function () {
      return state;
    },

    // Automated Self-Test Runner (Updated for Firebase Features)
    runTests: async function () {
      console.log("%c[FINDMYTHING TEST SUITE] Starting comprehensive test verification...", "color: #2563eb; font-weight: bold; font-size: 14px;");
      let passed = 0;
      let total = 0;

      function assert(condition, message) {
        total++;
        if (condition) {
          console.log(`%c✔ PASS: ${message}`, "color: #10b981; font-weight: 600;");
          passed++;
        } else {
          console.error(`✖ FAIL: ${message}`);
        }
      }

      // Test 1: Configuration check
      const configured = isFirebaseConfigured();
      assert(typeof configured === 'boolean', `Firebase configuration detector is operational (isFirebaseConfigured = ${configured})`);

      // Test 2: Sample & database items loaded
      assert(state.items.length >= 10, `Item catalog loaded with ${state.items.length} items (expected >= 10)`);

      // Test 3: Dropdowns and options populated
      const catSelect = document.getElementById('filter-category');
      assert(catSelect && catSelect.options.length > 5, "Category filter dropdown is populated with campus options");

      const locSelect = document.getElementById('filter-location');
      assert(locSelect && locSelect.options.length > 5, "Location filter dropdown is populated with campus facilities");

      // Test 4: Lost vs Found segregation
      const lostCount = state.items.filter(i => i.type === 'lost').length;
      const foundCount = state.items.filter(i => i.type === 'found').length;
      assert(lostCount > 0 && foundCount > 0, `Items correctly segregated into Lost (${lostCount}) and Found (${foundCount})`);

      // Test 5: Search engine matching
      const searchTest = state.items.filter(i => (i.title || '').toLowerCase().includes('airpods'));
      assert(searchTest.length > 0, `Search engine correctly matches keyword queries ('airpods' -> ${searchTest.length} results)`);

      // Test 6: Image selection, local object URL & format validation (Storage-free)
      const invalidTextFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });
      const textVal = validateImageFile(invalidTextFile);
      assert(!textVal.valid, "File validation rejects non-image formats (text/plain blocked)");

      const validJpgFile = new File([new Uint8Array(1024)], 'calculator.jpg', { type: 'image/jpeg' });
      const jpgVal = validateImageFile(validJpgFile);
      assert(jpgVal.valid, "File validation accepts valid JPEG photograph within 5MB limit");

      const oversizeFile = { type: 'image/jpeg', size: 6 * 1024 * 1024 };
      const overVal = validateImageFile(oversizeFile);
      assert(!overVal.valid, "File validation rejects photographs exceeding 5 MB limit");

      if (typeof URL.createObjectURL === 'function') {
        const testObjUrl = URL.createObjectURL(validJpgFile);
        assert(typeof testObjUrl === 'string' && testObjUrl.startsWith('blob:'), "Browser Object URL generated correctly for local preview without Storage upload");
        URL.revokeObjectURL(testObjUrl);
      }

      // Test 7: Confidentiality protection check
      const testFound = state.items.find(i => i.type === 'found' && i.distinctiveMarks);
      if (testFound) {
        openItemDetail(testFound.id);
        const maskedEl = document.getElementById('detail-distinctive-masked');
        const textEl = document.getElementById('detail-distinctive-text');
        const userIsAdmin = isAdmin();
        if (!userIsAdmin) {
          assert(maskedEl && maskedEl.style.display !== 'none', "Confidential distinctive traits are protected/masked from public view");
        } else {
          assert(textEl && textEl.style.display !== 'none', "Admin can inspect distinctive traits for verification");
        }
        closeItemDetailModal();
      }

      // Test 8: Item detail modal
      const testItem = state.items[0];
      openItemDetail(testItem.id);
      const detailModal = document.getElementById('item-detail-modal');
      assert(detailModal && detailModal.classList.contains('open'), "Item detail modal opens and populates correctly");
      closeItemDetailModal();

      // Test 9: Authentication modal toggling
      openAuthModal('login');
      const authModal = document.getElementById('auth-modal');
      const loginCard = document.getElementById('auth-card-login');
      assert(authModal && authModal.classList.contains('open') && loginCard && loginCard.classList.contains('active'), "Auth modal opens with Sign In tab active");
      switchAuthTab('register');
      const regCard = document.getElementById('auth-card-register');
      assert(regCard && regCard.classList.contains('active'), "Auth modal toggles seamlessly to Registration tab");
      closeAuthModal();

      // Test 10: Claim flow validation
      const foundItem = state.items.find(i => i.type === 'found');
      if (foundItem) {
        const prevUser = state.currentUser;
        state.currentUser = { uid: 'test-student-uid', email: 'test@campus.edu', emailVerified: true };
        openClaimModal(foundItem.id);
        const claimModal = document.getElementById('claim-modal');
        assert(claimModal && claimModal.classList.contains('open'), "Claim verification modal opens for authenticated students");
        closeClaimModal();
        state.currentUser = prevUser;
      }

      // Test 11: View routing
      navigateTo('lost');
      const viewLost = document.getElementById('view-items');
      assert(viewLost && viewLost.classList.contains('active'), "View routing to Lost directory functions correctly");
      navigateTo('dashboard');

      // Test 12: Notifications dropdown and unread tracking
      const notifBadge = document.getElementById('notification-badge');
      const notifBell = document.getElementById('btn-notifications-bell');
      assert(notifBadge !== null && notifBell !== null, "Notification bell button and badge mounted in header");
      const prevNotifs = state.notifications;
      state.notifications = [
        {
          id: 'test-notif-1',
          title: 'Claim Approved Test',
          message: 'Your test claim has been verified.',
          type: 'claim_approved',
          read: false,
          createdAt: new Date()
        }
      ];
      updateNotificationBadge();
      assert(getUnreadNotificationsCount() === 1, "Unread count accurately reflects 1 pending notification");
      assert(notifBadge.textContent === '1' && notifBadge.style.display !== 'none', "Notification badge displays count '1'");
      await handleMarkNotificationRead('test-notif-1');
      assert(getUnreadNotificationsCount() === 0, "Marking notification read updates unread counter to 0");
      state.notifications = prevNotifs;
      updateNotificationBadge();

      // Test 13: "I Found This Item" sighting workflow verification
      const dummyLost = {
        id: 'LST-TEST-999',
        type: 'lost',
        status: 'active',
        title: 'Test Lost Watch',
        category: 'electronics',
        location: 'Library',
        reporterUid: 'owner-test-uid',
        contactName: 'Alice Student',
        contactEmail: 'alice@campus.edu',
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30'
      };
      state.items.unshift(dummyLost);
      const prevTestUser = state.currentUser;
      const prevTestProfile = state.currentUserProfile;
      state.currentUser = { uid: 'finder-test-uid', email: 'finder@campus.edu' };
      state.currentUserProfile = { displayName: 'Bob Finder', role: 'student' };
      const sightingRes = await reportFoundSighting(dummyLost);
      assert(sightingRes.success, "'I Found This Item' sighting execution returns success");
      assert(sightingRes.foundItemId.startsWith('FND-'), "Found item ID generated deterministically with 'FND-' prefix");
      assert(sightingRes.foundItem && sightingRes.foundItem.originalLostItemId === 'LST-TEST-999', "Found record links to original lost item ID");
      state.items = state.items.filter(i => i.id !== 'LST-TEST-999' && i.id !== sightingRes.foundItemId);
      state.currentUser = prevTestUser;
      state.currentUserProfile = prevTestProfile;

      showToast(`Test Suite: All ${passed}/${total} checks verified successfully!`, 'success', 5000);
      console.log(`%c[FINDMYTHING TEST SUITE] Finished: ${passed}/${total} tests passed.`, "color: #2563eb; font-weight: bold;");
      return { passed, total, configured };
    }
  };

  // Run init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
