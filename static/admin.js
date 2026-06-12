/**
 * admin.js — The Pitch Report | Admin Panel Logic
 * Authenticates via JWT API, manages articles through REST endpoints.
 * Replaces all localStorage CRUD with API calls.
 */

(function () {
  'use strict';

  const API_BASE = '/api/v1';
  const TOKEN_KEY = 'tpr_jwt_token';
  const USER_KEY = 'tpr_user';

  // ═══════ AUTH HELPERS ═══════
  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  }

  function setAuth(token, user) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearAuth() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  function authHeaders() {
    const token = getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }

  // ═══════ AUTH FLOW ═══════
  const authGate = document.getElementById('auth-gate');
  const adminArea = document.getElementById('admin-area');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const emailInput = document.getElementById('admin-email');
  const passInput = document.getElementById('admin-password');

  function unlock() {
    authGate.style.display = 'none';
    adminArea.style.display = 'block';
    refreshStats();
    renderPostsTable();

    // Set author from user
    const user = getUser();
    if (user) {
      const authorInput = document.getElementById('article-author');
      if (authorInput) authorInput.value = user.display_name || 'Editor';
    }
  }

  function lock() {
    authGate.style.display = 'block';
    adminArea.style.display = 'none';
    clearAuth();
    passInput.value = '';
  }

  // Check if already logged in
  if (getToken()) unlock();

  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const email = emailInput ? emailInput.value.trim() : '';
      const password = passInput ? passInput.value : '';

      if (!email || !password) {
        showToast('Please fill in both fields.');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const err = await res.json();
          showToast(err.detail || 'Login failed.');
          passInput.style.borderColor = 'var(--color-danger)';
          return;
        }

        const data = await res.json();
        setAuth(data.access_token, data.user);
        unlock();
        showToast('Welcome back, editor! 🎉');
      } catch (err) {
        showToast('Network error. Is the server running?');
        console.error('Login error:', err);
      }
    });
  }

  if (passInput) {
    passInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loginBtn.click();
      passInput.style.borderColor = '';
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', lock);
  }

  // ═══════ TABS ═══════
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');

      if (tab.dataset.tab === 'manage') renderPostsTable();
    });
  });

  // ═══════ MARKDOWN EDITOR / PREVIEW ═══════
  const mdEditorTab = document.getElementById('md-tab-edit');
  const mdPreviewTab = document.getElementById('md-tab-preview');
  const mdTextarea = document.getElementById('markdown-input');
  const mdPreviewArea = document.getElementById('markdown-preview-area');

  if (mdEditorTab && mdPreviewTab && mdTextarea && mdPreviewArea) {
    mdEditorTab.addEventListener('click', () => {
      mdEditorTab.classList.add('active');
      mdPreviewTab.classList.remove('active');
      mdTextarea.style.display = 'block';
      mdPreviewArea.style.display = 'none';
    });

    mdPreviewTab.addEventListener('click', () => {
      mdEditorTab.classList.remove('active');
      mdPreviewTab.classList.add('active');
      mdTextarea.style.display = 'none';
      mdPreviewArea.style.display = 'block';

      if (window.MarkdownParser) {
        const parsed = window.MarkdownParser.parseFrontmatter(mdTextarea.value);
        mdPreviewArea.innerHTML = window.MarkdownParser.markdownToHtml(parsed.content);
      } else {
        mdPreviewArea.textContent = mdTextarea.value;
      }
    });

    // Auto-parse frontmatter on input
    mdTextarea.addEventListener('input', () => {
      autoParseMarkdownFrontmatter();
    });
  }

  function autoParseMarkdownFrontmatter() {
    if (!mdTextarea || !window.MarkdownParser) return;
    const { meta } = window.MarkdownParser.parseFrontmatter(mdTextarea.value);

    if (meta.title) document.getElementById('article-title').value = meta.title;
    if (meta.category) {
      const select = document.getElementById('article-category');
      for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value.toLowerCase() === meta.category.toLowerCase()) {
          select.selectedIndex = i;
          break;
        }
      }
    }
    if (meta.author) document.getElementById('article-author').value = meta.author;
  }

  // ═══════ STATS ═══════
  async function refreshStats() {
    try {
      const res = await fetch(`${API_BASE}/articles/stats`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const stats = await res.json();
      document.getElementById('stat-total').textContent = stats.published;
      document.getElementById('stat-drafts').textContent = stats.drafts;
      document.getElementById('stat-categories').textContent = stats.categories;
    } catch (err) {
      console.error('Stats error:', err);
    }
  }

  // ═══════ CREATE / UPDATE ARTICLE ═══════
  const publishBtn = document.getElementById('publish-btn');
  const draftBtn = document.getElementById('draft-btn');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');
  const editingIdInput = document.getElementById('editing-article-id');

  async function saveArticle(status) {
    const title = document.getElementById('article-title').value.trim();
    const content = mdTextarea ? mdTextarea.value : '';
    const category = document.getElementById('article-category').value;
    const author = document.getElementById('article-author').value.trim() || 'Editor';
    const excerpt = document.getElementById('article-excerpt').value.trim() || null;
    const editingId = editingIdInput ? editingIdInput.value : '';

    if (!title) {
      showToast('Please enter a title.');
      return;
    }

    const payload = { title, content, category, author, status, excerpt };

    try {
      let res;
      if (editingId) {
        // Update
        res = await fetch(`${API_BASE}/articles/${editingId}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });
      } else {
        // Create
        res = await fetch(`${API_BASE}/articles`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        showToast(err.detail || 'Save failed.');
        return;
      }

      const saved = await res.json();
      showToast(editingId ? 'Article updated! ✅' : `Article ${status === 'published' ? 'published' : 'saved as draft'}! ✅`);
      clearForm();
      refreshStats();
    } catch (err) {
      showToast('Network error.');
      console.error('Save error:', err);
    }
  }

  if (publishBtn) publishBtn.addEventListener('click', () => saveArticle('published'));
  if (draftBtn) draftBtn.addEventListener('click', () => saveArticle('draft'));

  function clearForm() {
    document.getElementById('article-title').value = '';
    if (mdTextarea) mdTextarea.value = '';
    document.getElementById('article-category').selectedIndex = 0;
    const user = getUser();
    document.getElementById('article-author').value = user ? user.display_name : 'Editor';
    document.getElementById('article-excerpt').value = '';
    if (editingIdInput) editingIdInput.value = '';
    if (cancelEditBtn) cancelEditBtn.style.display = 'none';
  }

  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', clearForm);
  }

  // ═══════ MANAGE POSTS TABLE ═══════
  async function renderPostsTable() {
    const tbody = document.getElementById('posts-tbody');
    const emptyEl = document.getElementById('posts-empty');
    if (!tbody) return;

    try {
      // Fetch all articles (published + drafts)
      const [pubRes, draftRes] = await Promise.all([
        fetch(`${API_BASE}/articles?status=published&page_size=100`, { headers: authHeaders() }),
        fetch(`${API_BASE}/articles?status=draft&page_size=100`, { headers: authHeaders() }),
      ]);

      const pubData = pubRes.ok ? await pubRes.json() : { articles: [] };
      const draftData = draftRes.ok ? await draftRes.json() : { articles: [] };

      const articles = [...pubData.articles, ...draftData.articles];
      articles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      if (articles.length === 0) {
        tbody.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
      }

      if (emptyEl) emptyEl.style.display = 'none';

      tbody.innerHTML = articles.map(a => `
        <tr>
          <td><strong>${escapeHtml(a.title)}</strong></td>
          <td>${escapeHtml(a.category)}</td>
          <td><span class="status-badge status-${a.status}">${a.status}</span></td>
          <td>${formatDate(a.created_at)}</td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-secondary" onclick="window._adminEdit('${a.id}')">✏️ Edit</button>
              <button class="btn btn-sm btn-danger" onclick="window._adminDelete('${a.id}')">🗑 Delete</button>
            </div>
          </td>
        </tr>
      `).join('');

    } catch (err) {
      console.error('Table render error:', err);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // ═══════ EDIT ARTICLE ═══════
  window._adminEdit = async function (articleId) {
    try {
      // We need to fetch by ID — use the articles list approach
      const [pubRes, draftRes] = await Promise.all([
        fetch(`${API_BASE}/articles?status=published&page_size=100`, { headers: authHeaders() }),
        fetch(`${API_BASE}/articles?status=draft&page_size=100`, { headers: authHeaders() }),
      ]);

      const pubData = pubRes.ok ? await pubRes.json() : { articles: [] };
      const draftData = draftRes.ok ? await draftRes.json() : { articles: [] };
      const all = [...pubData.articles, ...draftData.articles];
      const article = all.find(a => a.id === articleId);

      if (!article) {
        showToast('Article not found.');
        return;
      }

      // Switch to "New Post" tab
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      document.querySelector('[data-tab="new-post"]').classList.add('active');
      document.getElementById('panel-new-post').classList.add('active');

      // Populate form
      document.getElementById('article-title').value = article.title;
      if (mdTextarea) mdTextarea.value = article.content;
      const catSelect = document.getElementById('article-category');
      for (let i = 0; i < catSelect.options.length; i++) {
        if (catSelect.options[i].value === article.category) {
          catSelect.selectedIndex = i;
          break;
        }
      }
      document.getElementById('article-author').value = article.author;
      document.getElementById('article-excerpt').value = article.excerpt || '';
      if (editingIdInput) editingIdInput.value = article.id;
      if (cancelEditBtn) cancelEditBtn.style.display = 'block';

      showToast('Editing: ' + article.title);
    } catch (err) {
      console.error('Edit error:', err);
      showToast('Failed to load article for editing.');
    }
  };

  // ═══════ DELETE ARTICLE ═══════
  window._adminDelete = async function (articleId) {
    if (!confirm('Are you sure you want to delete this article?')) return;

    try {
      const res = await fetch(`${API_BASE}/articles/${articleId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      if (res.ok || res.status === 204) {
        showToast('Article deleted.');
        renderPostsTable();
        refreshStats();
      } else {
        const err = await res.json();
        showToast(err.detail || 'Delete failed.');
      }
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Network error.');
    }
  };

})();
