/**
 * BigQuery Release Notes Web Application
 * Vanilla JavaScript (ES6)
 */

document.addEventListener("DOMContentLoaded", () => {
  // Application State
  const state = {
    updates: [],
    categories: ["All"],
    activeCategory: "All",
    searchQuery: "",
    selectedUpdate: null,
    isLoading: false,
    feedMeta: {}
  };

  // DOM Elements
  const refreshBtn = document.getElementById("refreshBtn");
  const refreshSpinner = document.getElementById("refreshSpinner");
  const refreshBtnText = document.getElementById("refreshBtnText");
  const exportCsvBtn = document.getElementById("exportCsvBtn");
  const exportCsvStatsBtn = document.getElementById("exportCsvStatsBtn");
  const statusText = document.getElementById("statusText");
  const searchInput = document.getElementById("searchInput");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  const categoryPillsContainer = document.getElementById("categoryPills");
  const statsInfo = document.getElementById("statsInfo");
  const updatesContainer = document.getElementById("updatesContainer");
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");
  const errorMessage = document.getElementById("errorMessage");
  const errorDetail = document.getElementById("errorDetail");
  const retryBtn = document.getElementById("retryBtn");
  const emptyState = document.getElementById("emptyState");
  const resetFilterBtn = document.getElementById("resetFilterBtn");

  // Composer DOM Elements
  const composerEmptyPrompt = document.getElementById("composerEmptyPrompt");
  const composerActiveForm = document.getElementById("composerActiveForm");
  const composerTag = document.getElementById("composerTag");
  const composerDate = document.getElementById("composerDate");
  const tweetContent = document.getElementById("tweetContent");
  const charMeterFill = document.getElementById("charMeterFill");
  const charCount = document.getElementById("charCount");
  const composerDocLink = document.getElementById("composerDocLink");
  const copyTweetBtn = document.getElementById("copyTweetBtn");
  const tweetBtn = document.getElementById("tweetBtn");
  const clearSelectionBtn = document.getElementById("clearSelectionBtn");
  const hashtagChips = document.getElementById("hashtagChips");
  const toastContainer = document.getElementById("toastContainer");

  /**
   * Shows a temporary toast message
   */
  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(15px)";
      toast.style.transition = "all 0.25s ease";
      setTimeout(() => toast.remove(), 260);
    }, 3200);
  }

  /**
   * Fetches feed data from backend API
   */
  async function fetchFeed(forceRefresh = false) {
    if (state.isLoading) return;
    state.isLoading = true;

    // Trigger visual spinner on refresh button
    refreshSpinner.classList.add("spinning");
    refreshBtn.disabled = true;
    refreshBtnText.textContent = forceRefresh ? "Refreshing..." : "Loading...";
    statusText.textContent = forceRefresh ? "Fetching latest feed..." : "Loading release notes...";

    if (!state.updates.length) {
      loadingState.style.display = "flex";
      errorState.style.display = "none";
      emptyState.style.display = "none";
    }

    try {
      const url = forceRefresh ? "/api/feed?refresh=true" : "/api/feed";
      const response = await fetch(url);
      
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || `Server responded with HTTP ${response.status}`);
      }

      const data = await response.json();
      state.updates = data.updates || [];
      state.categories = data.categories || ["All"];
      state.feedMeta = {
        title: data.feed_title,
        updated: data.feed_updated,
        fetchedAt: data.fetched_at || new Date().toLocaleTimeString()
      };

      statusText.textContent = `Updated: ${state.feedMeta.fetchedAt}`;
      loadingState.style.display = "none";
      errorState.style.display = "none";

      updateCategoryBadges();
      renderUpdates();

      if (forceRefresh) {
        showToast("BigQuery release notes refreshed successfully!", "success");
      }

      // If an update was previously selected, refresh its data in composer
      if (state.selectedUpdate) {
        const stillExists = state.updates.find(u => u.id === state.selectedUpdate.id);
        if (stillExists) {
          selectUpdate(stillExists, false);
        }
      }
    } catch (err) {
      console.error("Error fetching release notes:", err);
      statusText.textContent = "Feed unavailable";
      
      if (!state.updates.length) {
        loadingState.style.display = "none";
        errorState.style.display = "flex";
        errorMessage.textContent = "Failed to fetch release notes";
        errorDetail.textContent = err.message || "Please check your network connection and retry.";
      } else {
        showToast(`Refresh failed: ${err.message}`, "error");
      }
    } finally {
      state.isLoading = false;
      refreshSpinner.classList.remove("spinning");
      refreshBtn.disabled = false;
      refreshBtnText.textContent = "Refresh";
    }
  }

  /**
   * Updates category pill counts
   */
  function updateCategoryBadges() {
    const counts = { All: state.updates.length };
    state.updates.forEach(u => {
      counts[u.category] = (counts[u.category] || 0) + 1;
    });

    // Update existing category pills
    const pills = categoryPillsContainer.querySelectorAll(".pill");
    pills.forEach(pill => {
      const cat = pill.getAttribute("data-category");
      let badge = pill.querySelector(".badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "badge";
        pill.appendChild(badge);
      }
      badge.textContent = counts[cat] || 0;
    });
  }

  /**
   * Filters updates based on current search query and category
   */
  function getFilteredUpdates() {
    const q = state.searchQuery.trim().toLowerCase();
    const cat = state.activeCategory;

    return state.updates.filter(item => {
      const matchesCategory = (cat === "All" || item.category === cat);
      if (!matchesCategory) return false;

      if (!q) return true;

      const inSummary = item.summary && item.summary.toLowerCase().includes(q);
      const inDate = item.entry_title && item.entry_title.toLowerCase().includes(q);
      const inCat = item.category && item.category.toLowerCase().includes(q);
      return inSummary || inDate || inCat;
    });
  }

  /**
   * Renders the updates grouped by release date
   */
  function renderUpdates() {
    const filtered = getFilteredUpdates();
    updatesContainer.innerHTML = "";

    // Update stats bar
    const totalDates = new Set(filtered.map(i => i.entry_title)).size;
    statsInfo.innerHTML = `Showing <strong>${filtered.length}</strong> updates across <strong>${totalDates}</strong> release dates`;

    if (filtered.length === 0) {
      emptyState.style.display = "flex";
      return;
    }
    emptyState.style.display = "none";

    // Group items by entry_title (Date)
    const groups = new Map();
    filtered.forEach(item => {
      if (!groups.has(item.entry_title)) {
        groups.set(item.entry_title, {
          title: item.entry_title,
          link: item.entry_link,
          items: []
        });
      }
      groups.get(item.entry_title).items.push(item);
    });

    // Render groups
    groups.forEach(group => {
      const groupEl = document.createElement("div");
      groupEl.className = "date-group";

      const headerEl = document.createElement("div");
      headerEl.className = "date-group-header";
      headerEl.innerHTML = `
        <div class="date-badge">
          <svg class="date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>${escapeHtml(group.title)}</span>
        </div>
        ${group.link ? `<a href="${group.link}" target="_blank" rel="noopener noreferrer" class="date-link">View in Google Docs &nearr;</a>` : ""}
      `;
      groupEl.appendChild(headerEl);

      group.items.forEach(item => {
        const isSelected = state.selectedUpdate && state.selectedUpdate.id === item.id;
        const card = document.createElement("article");
        card.className = `update-card ${isSelected ? "selected" : ""}`;
        card.id = `card-${item.id}`;

        // Ensure category name is clean CSS class
        const catClass = item.category || "General";

        card.innerHTML = `
          <div class="card-top">
            <span class="category-tag ${catClass}">${escapeHtml(item.category)}</span>
            <div class="card-actions-top">
              <button class="copy-card-btn" data-id="${item.id}" title="Copy card content to clipboard">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Copy to clipboard</span>
              </button>
              <button class="select-btn" data-id="${item.id}" title="Select this update to tweet">
                ${isSelected ? "✓ Selected" : "Select to Tweet"}
              </button>
            </div>
          </div>
          <div class="card-body">
            ${item.html}
          </div>
          <div class="card-footer">
            <span class="footer-meta">${escapeHtml(item.entry_title)}</span>
            <button class="quick-tweet-btn" data-id="${item.id}" title="Tweet this update directly">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Tweet
            </button>
          </div>
        `;

        // Make all links inside card-body open safely in new tab
        card.querySelectorAll(".card-body a").forEach(a => {
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noopener noreferrer");
        });

        // Click on the entire card selects the update
        card.addEventListener("click", (e) => {
          // If clicked a link inside card body, let browser navigate
          if (e.target.closest("a")) return;
          
          // If clicked copy-card button, copy card content
          if (e.target.closest(".copy-card-btn")) {
            e.stopPropagation();
            const copyBtn = e.target.closest(".copy-card-btn");
            copyCardContent(item, copyBtn);
            return;
          }

          // If clicked quick-tweet button, select and open intent
          if (e.target.closest(".quick-tweet-btn")) {
            e.stopPropagation();
            selectUpdate(item, true);
            openTweetIntent();
            return;
          }

          selectUpdate(item, true);
        });

        groupEl.appendChild(card);
      });

      updatesContainer.appendChild(groupEl);
    });
  }

  /**
   * Selects a specific update to feature in the Tweet composer
   */
  function selectUpdate(item, scrollToComposer = false) {
    state.selectedUpdate = item;

    // Highlight card
    document.querySelectorAll(".update-card").forEach(c => c.classList.remove("selected"));
    document.querySelectorAll(".select-btn").forEach(b => b.textContent = "Select to Tweet");

    const activeCard = document.getElementById(`card-${item.id}`);
    if (activeCard) {
      activeCard.classList.add("selected");
      const btn = activeCard.querySelector(".select-btn");
      if (btn) btn.textContent = "✓ Selected";
    }

    // Populate composer
    composerEmptyPrompt.style.display = "none";
    composerActiveForm.style.display = "flex";
    clearSelectionBtn.style.display = "inline-block";

    composerTag.className = `category-tag ${item.category || "General"}`;
    composerTag.textContent = item.category;
    composerDate.textContent = item.entry_title;

    tweetContent.value = item.tweet_text;
    updateCharCounter();

    if (item.entry_link) {
      composerDocLink.href = item.entry_link;
      composerDocLink.textContent = item.entry_link;
      composerDocLink.parentElement.style.display = "flex";
    } else {
      composerDocLink.parentElement.style.display = "none";
    }

    // Reset hashtag active states according to current text
    updateHashtagChipsState();

    if (scrollToComposer && window.innerWidth <= 1024) {
      document.querySelector(".composer-sidebar").scrollIntoView({ behavior: "smooth" });
    }
  }

  /**
   * Clears selection
   */
  function deselectUpdate() {
    state.selectedUpdate = null;
    document.querySelectorAll(".update-card").forEach(c => c.classList.remove("selected"));
    document.querySelectorAll(".select-btn").forEach(b => b.textContent = "Select to Tweet");

    composerEmptyPrompt.style.display = "block";
    composerActiveForm.style.display = "none";
    clearSelectionBtn.style.display = "none";
    tweetContent.value = "";
  }

  /**
   * Updates character counter & visual progress bar
   */
  function updateCharCounter() {
    const text = tweetContent.value;
    const len = text.length;
    charCount.textContent = `${len} / 280`;

    const percentage = Math.min(100, (len / 280) * 100);
    charMeterFill.style.width = `${percentage}%`;

    charMeterFill.classList.remove("warning", "danger");
    charCount.classList.remove("over");

    if (len > 280) {
      charMeterFill.classList.add("danger");
      charCount.classList.add("over");
    } else if (len > 240) {
      charMeterFill.classList.add("warning");
    }
  }

  /**
   * Toggles hashtag chip state
   */
  function updateHashtagChipsState() {
    const text = tweetContent.value;
    hashtagChips.querySelectorAll(".chip").forEach(chip => {
      const tag = chip.getAttribute("data-tag");
      if (text.includes(tag)) {
        chip.classList.add("active");
      } else {
        chip.classList.remove("active");
      }
    });
  }

  /**
   * Opens the official Twitter/X Web Intent
   */
  function openTweetIntent() {
    const text = tweetContent.value.trim();
    if (!text) {
      showToast("Please enter some text to tweet", "error");
      return;
    }
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(tweetUrl, "_blank", "noopener,noreferrer,width=600,height=500");
    showToast("Opening 𝕏 / Twitter intent...", "info");
  }

  /**
   * Helper to safely escape HTML strings
   */
  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --- Event Listeners ---

  // Refresh Button
  refreshBtn.addEventListener("click", () => fetchFeed(true));
  retryBtn.addEventListener("click", () => fetchFeed(true));

  // Search Input
  searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    clearSearchBtn.style.display = state.searchQuery ? "block" : "none";
    renderUpdates();
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    state.searchQuery = "";
    clearSearchBtn.style.display = "none";
    renderUpdates();
    searchInput.focus();
  });

  resetFilterBtn.addEventListener("click", () => {
    searchInput.value = "";
    state.searchQuery = "";
    state.activeCategory = "All";
    clearSearchBtn.style.display = "none";
    categoryPillsContainer.querySelectorAll(".pill").forEach(p => {
      p.classList.toggle("active", p.getAttribute("data-category") === "All");
    });
    renderUpdates();
  });

  // Category Filter Pills
  categoryPillsContainer.addEventListener("click", (e) => {
    const pill = e.target.closest(".pill");
    if (!pill) return;
    const cat = pill.getAttribute("data-category");
    state.activeCategory = cat;

    categoryPillsContainer.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");

    renderUpdates();
  });

  // Tweet composer textarea live input
  tweetContent.addEventListener("input", () => {
    updateCharCounter();
    updateHashtagChipsState();
  });

  // Quick Hashtag Chips
  hashtagChips.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const tag = chip.getAttribute("data-tag");
    let current = tweetContent.value;

    if (current.includes(tag)) {
      // Remove hashtag
      current = current.replace(new RegExp(`\\s*${tag}\\b`, "g"), "").trim();
    } else {
      // Append hashtag
      current = current.trim() + " " + tag;
    }

    tweetContent.value = current;
    updateCharCounter();
    updateHashtagChipsState();
  });

  // Copy Tweet Button
  copyTweetBtn.addEventListener("click", async () => {
    const text = tweetContent.value.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Tweet copied to clipboard!", "success");
    } catch {
      // Fallback
      tweetContent.select();
      document.execCommand("copy");
      showToast("Tweet copied to clipboard!", "success");
    }
  });

  // Tweet Button
  tweetBtn.addEventListener("click", openTweetIntent);

  // Clear Selection Button
  clearSelectionBtn.addEventListener("click", deselectUpdate);

  // Export to CSV Buttons
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", exportToCsv);
  }
  if (exportCsvStatsBtn) {
    exportCsvStatsBtn.addEventListener("click", exportToCsv);
  }

  /**
   * Copies card content to the user's clipboard
   */
  async function copyCardContent(item, btn) {
    const lines = [
      `[${item.category}] ${item.entry_title}`,
      "",
      item.summary
    ];
    if (item.entry_link) {
      lines.push("", `Link: ${item.entry_link}`);
    }
    const textToCopy = lines.join("\n");

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      if (btn) {
        btn.classList.add("copied");
        const span = btn.querySelector("span");
        const originalText = span ? span.textContent : "Copy to clipboard";
        if (span) span.textContent = "Copied!";
        setTimeout(() => {
          btn.classList.remove("copied");
          if (span) span.textContent = originalText;
        }, 2000);
      }

      showToast("Card content copied to clipboard!", "success");
    } catch (err) {
      console.error("Failed to copy card content:", err);
      showToast("Failed to copy to clipboard", "error");
    }
  }

  /**
   * Exports the current contents of the page to a .csv file
   */
  function exportToCsv() {
    const items = getFilteredUpdates();
    if (!items || items.length === 0) {
      showToast("No updates to export", "error");
      return;
    }

    const headers = ["Date", "Category", "Summary", "Link", "Tweet Draft"];
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = items.map(item => [
      escapeCsv(item.entry_title),
      escapeCsv(item.category),
      escapeCsv(item.summary),
      escapeCsv(item.entry_link),
      escapeCsv(item.tweet_text)
    ]);

    // Prepend UTF-8 BOM for Microsoft Excel compatibility
    const csvContent = "\uFEFF" + [
      headers.map(escapeCsv).join(","),
      ...rows.map(r => r.join(","))
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `bigquery-release-notes-${dateStr}.csv`;

    const downloadLink = document.createElement("a");
    downloadLink.setAttribute("href", url);
    downloadLink.setAttribute("download", filename);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

    showToast(`Exported ${items.length} update${items.length === 1 ? "" : "s"} to CSV!`, "success");
  }

  // Initial Fetch on Page Load
  fetchFeed(false);
});
