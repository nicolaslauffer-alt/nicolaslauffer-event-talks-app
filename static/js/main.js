// State Management
let releaseNotes = [];
let selectedNotes = new Set();
let isMultiSelectMode = false;
let currentFilterType = 'ALL';
let searchQuery = '';
let lastSyncedTime = null;
let currentComposeIds = [];
let activeTone = 'standard';

// DOM Elements
const themeToggle = document.getElementById('theme-toggle');
const refreshBtn = document.getElementById('refresh-btn');
const refreshSpinner = document.getElementById('refresh-spinner');
const btnText = refreshBtn.querySelector('.btn-text');
const searchInput = document.getElementById('search-input');
const searchClearBtn = document.getElementById('search-clear-btn');
const typeFiltersContainer = document.getElementById('type-filters');
const skeletonLoader = document.getElementById('skeleton-loader');
const notesTimeline = document.getElementById('notes-timeline');
const emptyState = document.getElementById('empty-state');
const resetFiltersBtn = document.getElementById('reset-filters-btn');
const statusMessage = document.getElementById('status-message');

// Stats Elements
const statTotalVal = document.querySelector('#stat-total .stat-value');
const statFeaturesVal = document.querySelector('#stat-features .stat-value');
const statDeprecationsVal = document.querySelector('#stat-deprecations .stat-value');
const statSyncedVal = document.querySelector('#stat-synced .stat-value');

// Selection Elements
const toggleSelectModeBtn = document.getElementById('toggle-select-mode-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');
const selectionSummaryContainer = document.getElementById('selection-summary-container');
const selectedCountText = document.getElementById('selected-count');
const tweetSelectedBtn = document.getElementById('tweet-selected-btn');
const clearSelectedBtn = document.getElementById('clear-selected-btn');

// Drawer Elements
const drawerOverlay = document.getElementById('drawer-overlay');
const tweetDrawer = document.getElementById('tweet-drawer');
const closeDrawerBtn = document.getElementById('close-drawer-btn');
const composerContext = document.getElementById('composer-context');
const tweetTextarea = document.getElementById('tweet-textarea');
const charProgressFill = document.getElementById('char-progress-fill');
const charCountText = document.getElementById('char-count-text');
const toneBtns = document.querySelectorAll('.tone-btn');
const tagPills = document.querySelectorAll('.tag-pill');
const tweetPreviewBody = document.getElementById('tweet-preview-body');
const copyTweetBtn = document.getElementById('copy-tweet-btn');
const postTweetBtn = document.getElementById('post-tweet-btn');
const copyIcon = document.getElementById('copy-icon');
const copyBtnText = document.getElementById('copy-btn-text');
const toast = document.getElementById('toast');

// Initialize the Application
function init() {
    setupTheme();
    setupEventListeners();
    fetchNotes(false);
}

// Theme Handling
function setupTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const darkIcon = themeToggle.querySelector('.theme-icon-dark');
    const lightIcon = themeToggle.querySelector('.theme-icon-light');
    if (theme === 'dark') {
        darkIcon.style.display = 'block';
        lightIcon.style.display = 'none';
    } else {
        darkIcon.style.display = 'none';
        lightIcon.style.display = 'block';
    }
}

// Event Listeners Setup
function setupEventListeners() {
    themeToggle.addEventListener('click', toggleTheme);
    
    refreshBtn.addEventListener('click', () => fetchNotes(true));
    
    // Search
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        searchClearBtn.style.display = searchQuery ? 'block' : 'none';
        renderNotes();
    });
    
    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        searchClearBtn.style.display = 'none';
        renderNotes();
        searchInput.focus();
    });
    
    resetFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        searchClearBtn.style.display = 'none';
        currentFilterType = 'ALL';
        renderNotes();
        renderFilters();
    });
    
    // Multi-Select Event Listeners
    toggleSelectModeBtn.addEventListener('click', toggleMultiSelectMode);
    exportCsvBtn.addEventListener('click', exportToCSV);
    
    clearSelectedBtn.addEventListener('click', clearSelection);
    
    tweetSelectedBtn.addEventListener('click', () => {
        if (selectedNotes.size > 0) {
            openTweetComposer(Array.from(selectedNotes));
        } else {
            showToast('Please select at least one update first!');
        }
    });
    
    // Drawer Composer Event Listeners
    closeDrawerBtn.addEventListener('click', closeTweetComposer);
    drawerOverlay.addEventListener('click', closeTweetComposer);
    
    tweetTextarea.addEventListener('input', () => {
        updateCharCount();
        updatePreview();
    });
    
    toneBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toneBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTone = btn.dataset.tone;
            // Regenerate text with new tone
            generateTweetText(currentComposeIds, activeTone);
        });
    });
    
    tagPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const hashtag = pill.dataset.tag;
            const currentText = tweetTextarea.value;
            // Append hashtag if it doesn't already exist
            if (!currentText.includes(hashtag)) {
                tweetTextarea.value = currentText.trim() + ' ' + hashtag;
                updateCharCount();
                updatePreview();
            }
        });
    });
    
    copyTweetBtn.addEventListener('click', copyTweetToClipboard);
    postTweetBtn.addEventListener('click', postTweetToX);
}

// Fetch Release Notes from Flask API
async function fetchNotes(forceRefresh = false) {
    // Show spinner & skeleton loading, hide timeline
    refreshSpinner.classList.add('spinning');
    refreshBtn.disabled = true;
    btnText.textContent = forceRefresh ? 'Refreshing...' : 'Loading...';
    
    skeletonLoader.style.display = 'flex';
    notesTimeline.style.display = 'none';
    emptyState.style.display = 'none';
    statusMessage.style.display = 'none';
    
    try {
        const url = `/api/notes${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            releaseNotes = data.updates;
            lastSyncedTime = new Date(data.timestamp * 1000);
            
            // Render UI
            updateStats();
            renderFilters();
            renderNotes();
            
            // Show status alert if cached or if warning exists
            if (data.cached) {
                statusMessage.innerHTML = `<span class="material-symbols-outlined">info</span> Displaying cached data (Synced: ${formatDateTime(lastSyncedTime)}). Click Refresh to fetch live.`;
                statusMessage.style.display = 'flex';
            } else if (data.error) {
                // If it returned data but had an error (e.g. offline cache return)
                statusMessage.innerHTML = `<span class="material-symbols-outlined">warning</span> ${data.error}`;
                statusMessage.style.display = 'flex';
            }
            
            if (forceRefresh) {
                showToast('Release notes updated successfully!');
            }
        } else {
            // Error from API
            showErrorState(data.error || 'Failed to fetch release notes.');
        }
    } catch (err) {
        console.error(err);
        showErrorState('Network error: Failed to connect to server.');
    } finally {
        refreshSpinner.classList.remove('spinning');
        refreshBtn.disabled = false;
        btnText.textContent = 'Refresh Feed';
        skeletonLoader.style.display = 'none';
    }
}

// Update Dashboard Statistics Card Values
function updateStats() {
    statTotalVal.textContent = releaseNotes.length;
    
    const featuresCount = releaseNotes.filter(n => n.type.toUpperCase() === 'FEATURE').length;
    statFeaturesVal.textContent = featuresCount;
    
    const deprecationsCount = releaseNotes.filter(n => 
        ['DEPRECATION', 'DEPRECATED', 'WARNING'].includes(n.type.toUpperCase())
    ).length;
    statDeprecationsVal.textContent = deprecationsCount;
    
    if (lastSyncedTime) {
        statSyncedVal.textContent = formatTimeAgo(lastSyncedTime);
        statSyncedVal.title = formatDateTime(lastSyncedTime);
    } else {
        statSyncedVal.textContent = 'Never';
    }
}

// Render dynamic type pills based on the parsed data categories
function renderFilters() {
    // Get unique categories and their count
    const counts = {};
    releaseNotes.forEach(n => {
        const t = n.type.toUpperCase();
        counts[t] = (counts[t] || 0) + 1;
    });
    
    // Sort categories, keeping FEATURE and DEPRECATION first if they exist
    const categories = Object.keys(counts).sort((a, b) => {
        if (a === 'FEATURE') return -1;
        if (b === 'FEATURE') return 1;
        if (a === 'DEPRECATION') return -1;
        if (b === 'DEPRECATION') return 1;
        return a.localeCompare(b);
    });
    
    let html = `<button class="filter-pill ${currentFilterType === 'ALL' ? 'active' : ''}" data-type="ALL">
        All <span class="pill-count">${releaseNotes.length}</span>
    </button>`;
    
    categories.forEach(cat => {
        const displayLabel = cat.charAt(0) + cat.slice(1).toLowerCase();
        html += `<button class="filter-pill ${currentFilterType === cat ? 'active' : ''}" data-type="${cat}">
            ${displayLabel} <span class="pill-count">${counts[cat]}</span>
        </button>`;
    });
    
    typeFiltersContainer.innerHTML = html;
    
    // Add Click listeners
    typeFiltersContainer.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            typeFiltersContainer.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentFilterType = pill.dataset.type;
            renderNotes();
        });
    });
}

// Render Release Notes sorted and grouped by Date
function renderNotes() {
    // Filter notes based on category and search query
    const filteredNotes = releaseNotes.filter(note => {
        const matchesType = currentFilterType === 'ALL' || note.type.toUpperCase() === currentFilterType;
        const matchesQuery = !searchQuery || 
            note.content_text.toLowerCase().includes(searchQuery) ||
            note.type.toLowerCase().includes(searchQuery) ||
            note.date.toLowerCase().includes(searchQuery);
        return matchesType && matchesQuery;
    });
    
    if (filteredNotes.length === 0) {
        notesTimeline.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }
    
    emptyState.style.display = 'none';
    notesTimeline.style.display = 'flex';
    
    // Group notes by date
    const grouped = {};
    filteredNotes.forEach(note => {
        if (!grouped[note.date]) {
            grouped[note.date] = [];
        }
        grouped[note.date].push(note);
    });
    
    // Render timeline
    let timelineHtml = '';
    
    // Sort dates (assuming standard feed order is correct, but let's process chronological grouping)
    Object.keys(grouped).forEach(dateStr => {
        timelineHtml += `
            <div class="timeline-date-group">
                <h2 class="timeline-date-title">
                    <span class="material-symbols-outlined">calendar_today</span>
                    ${dateStr}
                </h2>
                <div class="date-updates-list">
                    ${grouped[dateStr].map(note => renderNoteCard(note)).join('')}
                </div>
            </div>
        `;
    });
    
    notesTimeline.innerHTML = timelineHtml;
    
    // Bind card element events
    bindCardEvents();
}

// Render individual note HTML string
function renderNoteCard(note) {
    const isChecked = selectedNotes.has(note.id);
    const selectClass = isMultiSelectMode ? 'selectable' : '';
    const selectedClass = isChecked ? 'selected' : '';
    const catClass = note.type.toLowerCase();
    
    return `
        <div class="update-card ${catClass} ${selectClass} ${selectedClass}" data-id="${note.id}" id="${note.id}">
            <div class="card-selector">
                <input type="checkbox" id="check-${note.id}" ${isChecked ? 'checked' : ''} aria-label="Select update">
            </div>
            
            <div class="card-content-wrapper">
                <div class="card-header">
                    <div class="badge-and-date">
                        <span class="type-badge">${note.type}</span>
                        <span class="card-date">${note.date}</span>
                    </div>
                    
                    <div class="card-actions">
                        <button class="copy-card-btn" data-id="${note.id}" title="Copy plain text to clipboard">
                            <span class="material-symbols-outlined">content_copy</span>
                            <span>Copy</span>
                        </button>
                        <button class="tweet-single-btn" data-id="${note.id}">
                            <span class="material-symbols-outlined">campaign</span>
                            <span>Tweet</span>
                        </button>
                    </div>
                </div>
                
                <div class="card-body">
                    ${note.content_html}
                </div>
            </div>
        </div>
    `;
}

// Bind events for dynamically rendered cards
function bindCardEvents() {
    notesTimeline.querySelectorAll('.update-card').forEach(card => {
        const id = card.dataset.id;
        
        // Tweet single button handler
        card.querySelector('.tweet-single-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Avoid triggering card click selection
            openTweetComposer([id]);
        });
        
        // Copy card button handler
        card.querySelector('.copy-card-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            copySingleCardText(id, e.currentTarget);
        });
        
        // Card click handler for multi-select
        card.addEventListener('click', (e) => {
            if (!isMultiSelectMode) return;
            
            // Prevent duplicate trigger if checkbox itself was clicked
            if (e.target.type === 'checkbox') {
                const checked = e.target.checked;
                toggleNoteSelection(id, checked, card);
                return;
            }
            
            const checkbox = card.querySelector('input[type="checkbox"]');
            checkbox.checked = !checkbox.checked;
            toggleNoteSelection(id, checkbox.checked, card);
        });
    });
}

// Handle multi-select modes toggle
function toggleMultiSelectMode() {
    isMultiSelectMode = !isMultiSelectMode;
    
    if (isMultiSelectMode) {
        toggleSelectModeBtn.innerHTML = `
            <span class="material-symbols-outlined">close</span>
            <span>Disable Multi-Select</span>
        `;
        toggleSelectModeBtn.classList.remove('secondary-btn');
        toggleSelectModeBtn.classList.add('secondary-btn'); // keep look, toggle class if needed
        selectionSummaryContainer.style.display = 'flex';
    } else {
        toggleSelectModeBtn.innerHTML = `
            <span class="material-symbols-outlined">checklist</span>
            <span>Enable Multi-Select</span>
        `;
        selectionSummaryContainer.style.display = 'none';
        clearSelection();
    }
    
    // Re-render notes to add/remove checkbox selector padding and events
    renderNotes();
}

function toggleNoteSelection(id, isSelected, cardElement) {
    if (isSelected) {
        selectedNotes.add(id);
        cardElement.classList.add('selected');
    } else {
        selectedNotes.delete(id);
        cardElement.classList.remove('selected');
    }
    
    selectedCountText.textContent = selectedNotes.size;
}

function clearSelection() {
    selectedNotes.clear();
    selectedCountText.textContent = '0';
    notesTimeline.querySelectorAll('.update-card').forEach(card => {
        card.classList.remove('selected');
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = false;
    });
}

// Drawer Composer Handling
function openTweetComposer(noteIds) {
    currentComposeIds = noteIds;
    
    // Set context label
    if (noteIds.length === 1) {
        const note = releaseNotes.find(n => n.id === noteIds[0]);
        composerContext.textContent = `Drafting update for BQ Release: ${note.date}`;
    } else {
        composerContext.textContent = `Compiling thread for ${noteIds.length} updates`;
    }
    
    // Reset active tone buttons
    toneBtns.forEach(btn => {
        if (btn.dataset.tone === 'standard') {
            btn.classList.add('active');
            activeTone = 'standard';
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Generate tweet text
    generateTweetText(noteIds, activeTone);
    
    // Open drawer
    drawerOverlay.classList.add('open');
    tweetDrawer.classList.add('open');
    document.body.style.overflow = 'hidden'; // prevent body scrolling
}

function closeTweetComposer() {
    drawerOverlay.classList.remove('open');
    tweetDrawer.classList.remove('open');
    document.body.style.overflow = '';
}

// Generate the compiled Tweet content based on selected items and active tone
function generateTweetText(noteIds, tone) {
    if (noteIds.length === 0) return;
    
    const maxTweetLength = 280;
    let text = '';
    
    if (noteIds.length === 1) {
        const note = releaseNotes.find(n => n.id === noteIds[0]);
        let titleEmoji = '🚀';
        let intro = 'BigQuery Update';
        
        if (tone === 'professional') {
            titleEmoji = '📢';
            intro = 'Google Cloud BigQuery Update';
        } else if (tone === 'excited') {
            titleEmoji = '🔥';
            intro = 'HUGE BigQuery Release!';
        }
        
        let header = `${titleEmoji} ${intro} (${note.date})\n\n`;
        let footer = `\n\nRead more: ${note.link}`;
        
        // Hashtags
        let hashtags = ' #BigQuery #GoogleCloud';
        
        // Estimate content character budget
        const overhead = header.length + footer.length + hashtags.length;
        const budget = maxTweetLength - overhead - 5; // buffer
        
        let body = note.content_text;
        
        // Format based on type
        let badgeType = note.type.toUpperCase();
        let formattedBody = `[${badgeType}] ${body}`;
        if (tone === 'excited') {
            formattedBody = `✨ ${badgeType}: ${body} 🚀`;
        }
        
        if (formattedBody.length > budget) {
            formattedBody = formattedBody.substring(0, budget - 3) + '...';
        }
        
        text = header + formattedBody + footer + hashtags;
    } else {
        // Compile a thread / list
        let header = '';
        if (tone === 'standard') header = `🧵 BigQuery Latest Release Thread:\n\n`;
        else if (tone === 'professional') header = `📢 Summary of recent Google BigQuery updates:\n\n`;
        else if (tone === 'excited') header = `🔥 New features Alert! BigQuery Thread incoming 🧵👇\n\n`;
        
        let links = new Set();
        let bodyParts = [];
        
        noteIds.forEach((id, index) => {
            const note = releaseNotes.find(n => n.id === id);
            links.add(note.link);
            
            // Compile list item
            let num = index + 1;
            let itemText = `${num}/ [${note.type}] (${note.date}): ${note.content_text}`;
            bodyParts.push(itemText);
        });
        
        // Combine body items, but we need to watch out for X character limit.
        // Let's create a thread representation if it exceeds 280, or let's combine it as a summary.
        let bodyCombined = bodyParts.join('\n\n');
        let linkList = Array.from(links);
        let linkString = `\n\nDetails: ${linkList[0]}`;
        let hashtags = ' #BigQuery #GoogleCloud';
        
        const totalLen = header.length + bodyCombined.length + linkString.length + hashtags.length;
        
        if (totalLen > maxTweetLength) {
            // If it exceeds the limit, let's truncate the items so it fits in a single tweet summary,
            // advising they can copy and format threads manually.
            let budget = maxTweetLength - header.length - linkString.length - hashtags.length - 10;
            let truncatedParts = [];
            let currentLength = 0;
            
            for (let part of bodyParts) {
                let textToAppend = part;
                if (currentLength + textToAppend.length > budget) {
                    let partBudget = budget - currentLength;
                    if (partBudget > 15) {
                        truncatedParts.push(part.substring(0, partBudget - 3) + '...');
                    }
                    break;
                }
                truncatedParts.push(textToAppend);
                currentLength += textToAppend.length + 2; // + newlines
            }
            bodyCombined = truncatedParts.join('\n\n') + '\n...[Thread shortened]';
        }
        
        text = header + bodyCombined + linkString + hashtags;
    }
    
    tweetTextarea.value = text;
    updateCharCount();
    updatePreview();
}

// Update the visual circular character progress and display character limits
function updateCharCount() {
    const text = tweetTextarea.value;
    const len = text.length;
    const maxLen = 280;
    const remaining = maxLen - len;
    
    charCountText.textContent = remaining;
    
    // Visual Ring calculations
    const radius = 10;
    const circumference = 2 * Math.PI * radius; // 62.83
    
    // Cap progress percent at 100%
    const percent = Math.min(len / maxLen, 1);
    const offset = circumference - (percent * circumference);
    charProgressFill.style.strokeDashoffset = offset;
    
    // Color states based on character length
    const counterWrapper = document.querySelector('.char-counter');
    counterWrapper.classList.remove('warning', 'danger');
    
    if (remaining <= 0) {
        counterWrapper.classList.add('danger');
        charCountText.style.color = '#f43f5e';
    } else if (remaining <= 20) {
        counterWrapper.classList.add('warning');
        charCountText.style.color = '#f59e0b';
    } else {
        charCountText.style.color = 'var(--text-secondary)';
    }
    
    // Disable or enable X post button
    if (len === 0 || remaining < 0) {
        postTweetBtn.disabled = true;
        postTweetBtn.style.opacity = '0.5';
        postTweetBtn.style.cursor = 'not-allowed';
    } else {
        postTweetBtn.disabled = false;
        postTweetBtn.style.opacity = '1';
        postTweetBtn.style.cursor = 'pointer';
    }
}

// Render the high fidelity preview mirroring X post card
function updatePreview() {
    const text = tweetTextarea.value;
    
    if (!text.trim()) {
        tweetPreviewBody.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">No content yet. Start typing to see it previewed here!</span>';
        return;
    }
    
    // Escape HTML to prevent XSS in client-side preview
    let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
        
    // Highlight links (http/https)
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    escaped = escaped.replace(urlPattern, '<span class="highlight-link">$1</span>');
    
    // Highlight hashtags
    const hashtagPattern = /(#[a-zA-Z0-9_]+)/g;
    escaped = escaped.replace(hashtagPattern, '<span class="highlight-link">$1</span>');
    
    // Highlight mentions (if any)
    const mentionPattern = /(@[a-zA-Z0-9_]+)/g;
    escaped = escaped.replace(mentionPattern, '<span class="highlight-link">$1</span>');
    
    tweetPreviewBody.innerHTML = escaped;
}

// Copy Tweet body text to clipboard with animation
function copyTweetToClipboard() {
    const text = tweetTextarea.value;
    if (!text) return;
    
    navigator.clipboard.writeText(text).then(() => {
        // Visual Success indicators
        copyIcon.textContent = 'done';
        copyBtnText.textContent = 'Copied!';
        copyTweetBtn.style.borderColor = '#10b981';
        copyTweetBtn.style.color = '#10b981';
        
        showToast('Tweet content copied to clipboard!');
        
        // Revert back after delay
        setTimeout(() => {
            copyIcon.textContent = 'content_copy';
            copyBtnText.textContent = 'Copy Content';
            copyTweetBtn.style.borderColor = '';
            copyTweetBtn.style.color = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        showToast('Failed to copy to clipboard.');
    });
}

// Open Tweet Share Intent in a new tab
function postTweetToX() {
    const text = tweetTextarea.value;
    if (!text || text.length > 280) return;
    
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
}

// Helper: Show custom toast message
function showToast(message) {
    const toastMsg = toast.querySelector('.toast-message');
    toastMsg.textContent = message;
    
    toast.style.display = 'flex';
    // Trigger CSS animation reflow
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    
    // Hide toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Helper: Show error overlay if API/Network fails
function showErrorState(errorMsg) {
    skeletonLoader.style.display = 'none';
    notesTimeline.style.display = 'none';
    emptyState.style.display = 'none';
    
    statusMessage.innerHTML = `<span class="material-symbols-outlined">error</span> ${errorMsg}`;
    statusMessage.style.display = 'flex';
    
    // Ensure dashboard counts are cleared or showing dashes
    statTotalVal.textContent = '-';
    statFeaturesVal.textContent = '-';
    statDeprecationsVal.textContent = '-';
    statSyncedVal.textContent = 'Error';
}

// Helper: Formatter utilities
function formatDateTime(date) {
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval + "y ago";
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval + "mo ago";
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + "d ago";
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + "h ago";
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + "m ago";
    return "just now";
}

// Helper: Copy individual card text content to clipboard
function copySingleCardText(id, btnElement) {
    const note = releaseNotes.find(n => n.id === id);
    if (!note) return;
    
    const textToCopy = `[${note.type}] (${note.date})\n${note.content_text}\n\nRead more: ${note.link}`;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        const label = btnElement.querySelector('span:not(.material-symbols-outlined)');
        const icon = btnElement.querySelector('.material-symbols-outlined');
        
        btnElement.classList.add('copied');
        if (label) label.textContent = 'Copied!';
        if (icon) icon.textContent = 'done';
        
        showToast('Card text copied to clipboard!');
        
        setTimeout(() => {
            btnElement.classList.remove('copied');
            if (label) label.textContent = 'Copy';
            if (icon) icon.textContent = 'content_copy';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        showToast('Failed to copy text.');
    });
}

// Helper: Export currently filtered notes to CSV
function exportToCSV() {
    const filteredNotes = releaseNotes.filter(note => {
        const matchesType = currentFilterType === 'ALL' || note.type.toUpperCase() === currentFilterType;
        const matchesQuery = !searchQuery || 
            note.content_text.toLowerCase().includes(searchQuery) ||
            note.type.toLowerCase().includes(searchQuery) ||
            note.date.toLowerCase().includes(searchQuery);
        return matchesType && matchesQuery;
    });
    
    if (filteredNotes.length === 0) {
        showToast('No notes available to export.');
        return;
    }
    
    const headers = ['Date', 'Category', 'Direct Link', 'Update Plain Text'];
    
    const rows = filteredNotes.map(note => {
        const dateEsc = `"${note.date.replace(/"/g, '""')}"`;
        const typeEsc = `"${note.type.replace(/"/g, '""')}"`;
        const linkEsc = `"${note.link.replace(/"/g, '""')}"`;
        const textEsc = `"${note.content_text.replace(/"/g, '""')}"`;
        return [dateEsc, typeEsc, linkEsc, textEsc].join(',');
    });
    
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const filterLabel = currentFilterType.toLowerCase();
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `bigquery_release_notes_${filterLabel}_${dateStr}.csv`);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Successfully exported ${filteredNotes.length} updates to CSV!`);
}

// Run App
document.addEventListener('DOMContentLoaded', init);
