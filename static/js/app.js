/**
 * QuoteWise — Vanilla JavaScript Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // App State
  const state = {
    searchQuery: '',
    selectedCategory: '',
    selectedAuthor: '',
    currentSpotlight: null,
    totalQuotes: 100,
  };

  // DOM Elements
  const spotlightText = document.getElementById('spotlightText');
  const spotlightAuthor = document.getElementById('spotlightAuthor');
  const spotlightCategory = document.getElementById('spotlightCategory');
  const spotlightCard = document.getElementById('spotlightCard');
  const randomQuoteBtn = document.getElementById('randomQuoteBtn');
  const copySpotlightBtn = document.getElementById('copySpotlightBtn');

  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const authorSelect = document.getElementById('authorSelect');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const categoryPillsContainer = document.getElementById('categoryPills');

  const quotesGrid = document.getElementById('quotesGrid');
  const resultsCount = document.getElementById('resultsCount');
  const emptyState = document.getElementById('emptyState');
  const resetFromEmptyBtn = document.getElementById('resetFromEmptyBtn');

  const statTotal = document.getElementById('statTotal');
  const statAuthors = document.getElementById('statAuthors');
  const statCategories = document.getElementById('statCategories');
  const toast = document.getElementById('toast');

  let toastTimer = null;

  // Category chip styling helper
  function getCategoryChipClass(category) {
    if (!category) return '';
    const lower = category.toLowerCase();
    if (lower.includes('science') || lower.includes('tech')) return 'chip-science';
    if (lower.includes('philosophy')) return 'chip-philosophy';
    if (lower.includes('inspiration') || lower.includes('courage')) return 'chip-inspiration';
    if (lower.includes('literature') || lower.includes('art')) return 'chip-literature';
    if (lower.includes('leadership') || lower.includes('wisdom')) return 'chip-leadership';
    if (lower.includes('humor') || lower.includes('wit')) return 'chip-humor';
    return '';
  }

  // Toast Notification
  function showToast(message = 'Quote copied to clipboard!') {
    toast.textContent = message;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  // Copy to Clipboard
  async function copyQuote(quoteText, author) {
    const formatted = `"${quoteText}"\n— ${author}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(formatted);
      } else {
        // Fallback for non-https or restricted contexts
        const textarea = document.createElement('textarea');
        textarea.value = formatted;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showToast();
    } catch (err) {
      console.error('Failed to copy quote: ', err);
      showToast('Could not copy to clipboard');
    }
  }

  // Fetch Summary Stats
  async function loadStats() {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) return;
      const data = await res.json();
      statTotal.textContent = data.total_quotes;
      statAuthors.textContent = data.total_authors;
      statCategories.textContent = data.total_categories;
      state.totalQuotes = data.total_quotes;
    } catch (e) {
      console.warn('Error fetching stats:', e);
    }
  }

  // Fetch Categories for Pills
  async function loadCategories() {
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) return;
      const categories = await res.json();

      let pillsHtml = `
        <button class="pill-btn ${state.selectedCategory === '' ? 'active' : ''}" data-category="">
          All Categories (${state.totalQuotes})
        </button>
      `;

      categories.forEach(cat => {
        const isActive = state.selectedCategory.toLowerCase() === cat.name.toLowerCase();
        pillsHtml += `
          <button class="pill-btn ${isActive ? 'active' : ''}" data-category="${encodeURIComponent(cat.name)}">
            ${cat.name} (${cat.count})
          </button>
        `;
      });

      categoryPillsContainer.innerHTML = pillsHtml;

      // Attach click listeners to category pills
      categoryPillsContainer.querySelectorAll('.pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const cat = btn.getAttribute('data-category');
          setCategoryFilter(cat ? decodeURIComponent(cat) : '');
        });
      });
    } catch (e) {
      console.error('Error loading categories:', e);
    }
  }

  // Fetch Authors for Select Dropdown
  async function loadAuthors() {
    try {
      const res = await fetch('/api/authors');
      if (!res.ok) return;
      const authors = await res.json();

      // Clear existing options except default
      authorSelect.innerHTML = '<option value="">All Authors (All)</option>';

      authors.forEach(author => {
        const option = document.createElement('option');
        option.value = author;
        option.textContent = author;
        authorSelect.appendChild(option);
      });
    } catch (e) {
      console.error('Error loading authors:', e);
    }
  }

  // Fetch and Render Random Quote (Spotlight)
  async function loadRandomQuote() {
    try {
      spotlightText.style.opacity = '0.3';
      
      const params = new URLSearchParams();
      if (state.selectedCategory) params.append('category', state.selectedCategory);
      if (state.selectedAuthor) params.append('author', state.selectedAuthor);

      const url = `/api/quotes/random${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        // Fallback to purely random if current filter has no random match
        const fallbackRes = await fetch('/api/quotes/random');
        const fallbackData = await fallbackRes.json();
        renderSpotlight(fallbackData);
        return;
      }

      const quote = await res.json();
      renderSpotlight(quote);
    } catch (e) {
      console.error('Error fetching random quote:', e);
    } finally {
      setTimeout(() => {
        spotlightText.style.opacity = '1';
      }, 150);
    }
  }

  function renderSpotlight(quote) {
    state.currentSpotlight = quote;
    spotlightText.textContent = quote.quote;
    spotlightAuthor.textContent = `— ${quote.author}`;
    spotlightCategory.textContent = quote.category;

    // Reset chip classes and apply specific style
    spotlightCategory.className = 'category-chip ' + getCategoryChipClass(quote.category);
  }

  // Fetch and Render Catalog Quotes
  async function loadQuotes() {
    try {
      const params = new URLSearchParams();
      if (state.searchQuery) params.append('q', state.searchQuery);
      if (state.selectedCategory) params.append('category', state.selectedCategory);
      if (state.selectedAuthor) params.append('author', state.selectedAuthor);

      const res = await fetch(`/api/quotes?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch quotes');

      const data = await res.json();
      renderQuotesGrid(data.quotes, data.count, data.total);
    } catch (e) {
      console.error('Error loading quotes:', e);
    }
  }

  function renderQuotesGrid(quotes, count, total) {
    resultsCount.textContent = `Showing ${count} of ${total} quotes`;

    if (!quotes || quotes.length === 0) {
      quotesGrid.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    const cardsHtml = quotes.map(q => {
      const initial = q.author.charAt(0).toUpperCase();
      const chipClass = getCategoryChipClass(q.category);
      
      return `
        <article class="quote-card" data-id="${q.id}">
          <div class="quote-card-header">
            <div class="author-avatar" title="${escapeHtml(q.author)}">${initial}</div>
            <button class="card-copy-btn" title="Copy quote" data-quote="${escapeHtml(q.quote)}" data-author="${escapeHtml(q.author)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
          <p class="quote-card-text">“${escapeHtml(q.quote)}”</p>
          <div class="quote-card-footer">
            <span class="quote-card-author" data-author="${escapeHtml(q.author)}" title="Filter by this author">
              ${escapeHtml(q.author)}
            </span>
            <span class="category-chip ${chipClass}" data-category="${escapeHtml(q.category)}" title="Filter by this category" style="cursor: pointer;">
              ${escapeHtml(q.category)}
            </span>
          </div>
        </article>
      `;
    }).join('');

    quotesGrid.innerHTML = cardsHtml;

    // Attach copy button listeners inside cards
    quotesGrid.querySelectorAll('.card-copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = btn.getAttribute('data-quote');
        const author = btn.getAttribute('data-author');
        copyQuote(text, author);
      });
    });

    // Clicking an author inside a card filters by that author
    quotesGrid.querySelectorAll('.quote-card-author').forEach(authorEl => {
      authorEl.addEventListener('click', () => {
        const authorName = authorEl.getAttribute('data-author');
        setAuthorFilter(authorName);
      });
    });

    // Clicking a category inside a card filters by that category
    quotesGrid.querySelectorAll('.category-chip').forEach(catEl => {
      catEl.addEventListener('click', () => {
        const catName = catEl.getAttribute('data-category');
        setCategoryFilter(catName);
      });
    });
  }

  // Filter Modifiers
  function setCategoryFilter(category) {
    state.selectedCategory = category;

    // Update category pills active class
    categoryPillsContainer.querySelectorAll('.pill-btn').forEach(btn => {
      const cat = btn.getAttribute('data-category');
      const decoded = cat ? decodeURIComponent(cat) : '';
      if (decoded.toLowerCase() === category.toLowerCase()) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    loadQuotes();
  }

  function setAuthorFilter(author) {
    state.selectedAuthor = author;
    authorSelect.value = author;
    loadQuotes();
  }

  function resetAllFilters() {
    state.searchQuery = '';
    state.selectedCategory = '';
    state.selectedAuthor = '';
    
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    authorSelect.value = '';

    // Reset pills
    categoryPillsContainer.querySelectorAll('.pill-btn').forEach((btn, index) => {
      if (index === 0) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    loadQuotes();
    loadRandomQuote();
  }

  // Utility to escape HTML strings safely
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Debounce helper
  function debounce(func, delay = 250) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  // Event Listeners
  randomQuoteBtn.addEventListener('click', () => {
    loadRandomQuote();
  });

  copySpotlightBtn.addEventListener('click', () => {
    if (state.currentSpotlight) {
      copyQuote(state.currentSpotlight.quote, state.currentSpotlight.author);
    }
  });

  // Live Search with Debounce
  const handleSearch = debounce((query) => {
    state.searchQuery = query.trim();
    loadQuotes();
  }, 220);

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    clearSearchBtn.style.display = val ? 'block' : 'none';
    handleSearch(val);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    state.searchQuery = '';
    loadQuotes();
    searchInput.focus();
  });

  authorSelect.addEventListener('change', (e) => {
    state.selectedAuthor = e.target.value;
    loadQuotes();
  });

  resetFiltersBtn.addEventListener('click', resetAllFilters);
  resetFromEmptyBtn.addEventListener('click', resetAllFilters);

  // Initialize
  async function init() {
    await loadStats();
    await Promise.all([
      loadCategories(),
      loadAuthors(),
      loadRandomQuote(),
      loadQuotes()
    ]);
  }

  init();
});
