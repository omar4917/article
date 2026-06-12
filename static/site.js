/**
 * site.js — The Pitch Report | Public Site Logic
 * Fetches data from the FastAPI backend instead of localStorage.
 * Handles homepage rendering, article page rendering, filtering, and sharing.
 */

(function () {
  'use strict';

  const API_BASE = '/api/v1';

  // ═══════ HELPERS ═══════
  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function readTime(text) {
    const words = (text || '').split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 220)) + ' min read';
  }

  function catClass(category) {
    const map = {
      'Debates': 'cat-debates',
      'Opinion': 'cat-opinion',
      'Analysis': 'cat-analysis',
      'Transfers': 'cat-transfers',
      'News': 'cat-news'
    };
    return map[category] || 'cat-news';
  }

  function catEmoji(category) {
    const map = {
      'Debates': '🔥',
      'Opinion': '💬',
      'Analysis': '📊',
      'Transfers': '💰',
      'News': '📰'
    };
    return map[category] || '📰';
  }

  function excerptFromContent(content, maxLen = 160) {
    const text = content.replace(/<[^>]+>/g, '').replace(/[#*_`>\-]/g, '').replace(/\s+/g, ' ').trim();
    return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }

  // ═══════ API CALLS ═══════
  async function fetchArticles(category) {
    try {
      let url = `${API_BASE}/articles?status=published&page_size=100`;
      if (category && category !== 'all') {
        url += `&category=${encodeURIComponent(category)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch articles');
      const data = await res.json();
      return data.articles || [];
    } catch (err) {
      console.error('Error fetching articles:', err);
      return [];
    }
  }

  async function fetchArticleBySlug(slug) {
    try {
      const res = await fetch(`${API_BASE}/articles/${encodeURIComponent(slug)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error('Error fetching article:', err);
      return null;
    }
  }

  async function fetchCategories() {
    try {
      const res = await fetch(`${API_BASE}/articles/categories`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  // ═══════ HOMEPAGE ═══════
  function isHomepage() {
    const path = window.location.pathname;
    return path.endsWith('index.html') || path.endsWith('/') || path === '';
  }

  async function renderHomepage() {
    const articles = await fetchArticles();
    const heroEl = document.getElementById('hero-section');
    const gridEl = document.getElementById('articles-grid');
    const emptyEl = document.getElementById('empty-state');
    const filterBar = document.getElementById('filter-bar');

    if (!heroEl || !gridEl) return;

    if (articles.length === 0) {
      heroEl.style.display = 'none';
      gridEl.parentElement.style.display = 'none';
      filterBar.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }

    emptyEl.style.display = 'none';
    heroEl.style.display = 'block';
    gridEl.parentElement.style.display = 'block';
    filterBar.style.display = 'flex';

    // Hero — latest article
    const latest = articles[0];
    document.getElementById('hero-category').textContent = `${catEmoji(latest.category)} ${latest.category}`;
    document.getElementById('hero-category').className = `hero-badge ${catClass(latest.category)}`;
    document.getElementById('hero-title').textContent = latest.title;
    document.getElementById('hero-excerpt').textContent = latest.excerpt || excerptFromContent(latest.content);
    document.getElementById('hero-author').textContent = latest.author;
    document.getElementById('hero-date').textContent = formatDate(latest.published_at || latest.created_at);
    document.getElementById('hero-read-time').textContent = readTime(latest.content);
    document.getElementById('hero-link').href = `article.html?slug=${encodeURIComponent(latest.slug)}`;

    // Grid — remaining articles
    gridEl.innerHTML = '';
    const rest = articles.slice(1);
    rest.forEach(a => {
      const card = document.createElement('div');
      card.className = 'article-card';
      card.onclick = () => window.location.href = `article.html?slug=${encodeURIComponent(a.slug)}`;
      card.innerHTML = `
        <span class="article-card-category ${catClass(a.category)}">${catEmoji(a.category)} ${a.category}</span>
        <h3 class="article-card-title">${escapeHtml(a.title)}</h3>
        <p class="article-card-excerpt">${escapeHtml(a.excerpt || excerptFromContent(a.content))}</p>
        <div class="article-card-meta">
          <span>${escapeHtml(a.author)}</span>
          <span class="meta-dot">·</span>
          <span>${formatDate(a.published_at || a.created_at)}</span>
          <span class="meta-dot">·</span>
          <span>${readTime(a.content)}</span>
        </div>
      `;
      gridEl.appendChild(card);
    });

    // Build filter chips
    await buildFilterChips();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function buildFilterChips() {
    const categories = await fetchCategories();
    const container = document.getElementById('filter-chips');
    if (!container) return;

    container.innerHTML = '<button class="filter-chip active" data-category="all">All</button>';
    categories.forEach(cat => {
      const chip = document.createElement('button');
      chip.className = 'filter-chip';
      chip.dataset.category = cat;
      chip.textContent = `${catEmoji(cat)} ${cat}`;
      container.appendChild(chip);
    });

    // Attach filter click handlers
    container.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', async () => {
        container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        await filterArticles(chip.dataset.category);
      });
    });
  }

  async function filterArticles(category) {
    const articles = await fetchArticles(category);
    const gridEl = document.getElementById('articles-grid');
    const heroEl = document.getElementById('hero-section');

    if (!gridEl) return;

    if (articles.length === 0) {
      heroEl.style.display = 'none';
      gridEl.innerHTML = '<div class="posts-empty"><p>No articles in this category yet.</p></div>';
      return;
    }

    // Update hero with first article
    const latest = articles[0];
    heroEl.style.display = 'block';
    document.getElementById('hero-category').textContent = `${catEmoji(latest.category)} ${latest.category}`;
    document.getElementById('hero-category').className = `hero-badge ${catClass(latest.category)}`;
    document.getElementById('hero-title').textContent = latest.title;
    document.getElementById('hero-excerpt').textContent = latest.excerpt || excerptFromContent(latest.content);
    document.getElementById('hero-author').textContent = latest.author;
    document.getElementById('hero-date').textContent = formatDate(latest.published_at || latest.created_at);
    document.getElementById('hero-read-time').textContent = readTime(latest.content);
    document.getElementById('hero-link').href = `article.html?slug=${encodeURIComponent(latest.slug)}`;

    // Grid
    gridEl.innerHTML = '';
    articles.slice(1).forEach(a => {
      const card = document.createElement('div');
      card.className = 'article-card';
      card.onclick = () => window.location.href = `article.html?slug=${encodeURIComponent(a.slug)}`;
      card.innerHTML = `
        <span class="article-card-category ${catClass(a.category)}">${catEmoji(a.category)} ${a.category}</span>
        <h3 class="article-card-title">${escapeHtml(a.title)}</h3>
        <p class="article-card-excerpt">${escapeHtml(a.excerpt || excerptFromContent(a.content))}</p>
        <div class="article-card-meta">
          <span>${escapeHtml(a.author)}</span>
          <span class="meta-dot">·</span>
          <span>${formatDate(a.published_at || a.created_at)}</span>
          <span class="meta-dot">·</span>
          <span>${readTime(a.content)}</span>
        </div>
      `;
      gridEl.appendChild(card);
    });
  }

  // ═══════ ARTICLE PAGE ═══════
  function isArticlePage() {
    return window.location.pathname.includes('article.html');
  }

  async function renderArticlePage() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');

    if (!slug) {
      document.getElementById('article-title').textContent = 'Article Not Found';
      document.getElementById('article-body').innerHTML = '<p>No article specified. <a href="index.html">Go home</a>.</p>';
      return;
    }

    const article = await fetchArticleBySlug(slug);

    if (!article) {
      document.getElementById('article-title').textContent = 'Article Not Found';
      document.getElementById('article-body').innerHTML = '<p>This article doesn\'t exist. <a href="index.html">Go home</a>.</p>';
      return;
    }

    // Set page title
    document.title = `${article.title} — The Pitch Report`;

    // Render header
    const catEl = document.getElementById('article-category');
    catEl.textContent = `${catEmoji(article.category)} ${article.category}`;
    catEl.className = `article-badge ${catClass(article.category)}`;

    document.getElementById('article-title').textContent = article.title;
    document.getElementById('article-author').textContent = article.author;
    document.getElementById('article-date').textContent = formatDate(article.published_at || article.created_at);
    document.getElementById('article-read-time').textContent = readTime(article.content);

    // Render body (markdown → html)
    const bodyEl = document.getElementById('article-body');
    if (window.MarkdownParser) {
      const parsed = window.MarkdownParser.parseFrontmatter(article.content);
      bodyEl.innerHTML = window.MarkdownParser.markdownToHtml(parsed.content);
    } else {
      bodyEl.innerHTML = `<p>${escapeHtml(article.content)}</p>`;
    }

    // Share button
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
          showToast('Link copied to clipboard!');
        }).catch(() => {
          showToast('Could not copy link.');
        });
      });
    }
  }

  // ═══════ INIT ═══════
  if (isHomepage()) {
    renderHomepage();
  } else if (isArticlePage()) {
    renderArticlePage();
  }

})();
