// State Management
let allData = null;
let selectedLink = "";

// Circular Progress Ring Configuration
const progressCircle = document.getElementById('progress-ring-circle');
const charCounterText = document.getElementById('char-counter');
const radius = 10;
const circumference = 2 * Math.PI * radius; // 62.83

if (progressCircle) {
    progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    progressCircle.style.strokeDashoffset = circumference;
}

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes(false);
    setupEventListeners();
});

// Event Listeners Registration
function setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    }

    // Retry button in error state
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => fetchReleaseNotes(true));
    }

    // Search keyword input
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (searchInput.value.trim().length > 0) {
                clearSearchBtn.style.display = 'block';
            } else {
                clearSearchBtn.style.display = 'none';
            }
            renderNotes();
        });
    }

    // Clear search button
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchBtn.style.display = 'none';
            searchInput.focus();
            renderNotes();
        });
    }

    // Filter Chips
    const chips = document.querySelectorAll('.chip');
    chips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            chips.forEach(c => c.classList.remove('active'));
            e.currentTarget.classList.add('active');
            renderNotes();
        });
    });

    // Close Modal Button
    const closeModalBtn = document.getElementById('close-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', hideTweetModal);
    }

    // Close Modal when clicking overlay
    const tweetModal = document.getElementById('tweet-modal');
    if (tweetModal) {
        tweetModal.addEventListener('click', (e) => {
            if (e.target === tweetModal) {
                hideTweetModal();
            }
        });
    }

    // Tweet Textarea Input (Character Counter)
    const tweetTextarea = document.getElementById('tweet-textarea');
    if (tweetTextarea) {
        tweetTextarea.addEventListener('input', updateCharCounter);
    }

    // Copy to Clipboard Button
    const copyBtn = document.getElementById('copy-tweet-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyTweetToClipboard);
    }

    // Post to Twitter Button
    const postBtn = document.getElementById('post-tweet-btn');
    if (postBtn) {
        postBtn.addEventListener('click', triggerTwitterIntent);
    }

    // Delegate "Tweet This" button clicks in notes container
    const notesContainer = document.getElementById('notes-container');
    if (notesContainer) {
        notesContainer.addEventListener('click', (e) => {
            const tweetBtn = e.target.closest('.card-tweet-btn');
            if (tweetBtn) {
                const date = tweetBtn.dataset.date;
                const type = tweetBtn.dataset.type;
                const link = tweetBtn.dataset.link;
                
                // Get the update card content
                const card = tweetBtn.closest('.update-card');
                const contentEl = card.querySelector('.card-content');
                
                openTweetComposer(date, type, link, contentEl);
            }
        });
    }
}

// Fetch Data from Flask API
async function fetchReleaseNotes(forceRefresh = false) {
    showLoading(true);
    
    // UI Feedback for refresh
    const refreshIcon = document.getElementById('refresh-icon');
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshIcon) refreshIcon.classList.add('spinning');
    if (refreshBtn) refreshBtn.disabled = true;

    try {
        const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'error') {
            throw new Error(data.message);
        }

        allData = data;
        
        // Update stats
        updateStats(data);
        
        // Render data
        renderNotes();
        
        // Update status badge
        updateStatusBadge(data);
        
        showError(false);
    } catch (error) {
        console.error("Error fetching release notes:", error);
        showError(true, error.message);
    } finally {
        showLoading(false);
        if (refreshIcon) refreshIcon.classList.remove('spinning');
        if (refreshBtn) refreshBtn.disabled = false;
    }
}

// Stats counter
function updateStats(data) {
    if (!data || !data.entries) return;
    
    const totalDays = data.entries.length;
    let totalUpdates = 0;
    let featuresCount = 0;
    let announcementsCount = 0;
    
    data.entries.forEach(entry => {
        totalUpdates += entry.items.length;
        entry.items.forEach(item => {
            const itemType = item.type.toLowerCase();
            if (itemType === 'feature') {
                featuresCount++;
            } else if (itemType === 'announcement') {
                announcementsCount++;
            }
        });
    });
    
    document.getElementById('stat-total-days').textContent = totalDays;
    document.getElementById('stat-total-updates').textContent = totalUpdates;
    document.getElementById('stat-features').textContent = featuresCount;
    document.getElementById('stat-announcements').textContent = announcementsCount;
}

// Status badge
function updateStatusBadge(data) {
    const badge = document.getElementById('status-badge');
    const text = document.getElementById('status-text');
    
    badge.className = 'status-badge';
    
    if (data.source === 'live') {
        badge.classList.add('live');
        text.textContent = 'Synced Live';
    } else if (data.source === 'cache') {
        badge.classList.add('live');
        const cachedTime = new Date(data.cached_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        text.textContent = `Cached (Synced ${cachedTime})`;
    } else if (data.source === 'cache_fallback') {
        badge.classList.add('error');
        text.textContent = 'Network Error (Using Cache)';
    }
}

// Render Notes with Filtering
function renderNotes() {
    const searchQuery = document.getElementById('search-input').value.toLowerCase().trim();
    const activeChip = document.querySelector('.chip.active');
    const activeChipType = activeChip ? activeChip.dataset.type : 'all';
    
    const container = document.getElementById('notes-container');
    container.innerHTML = '';
    
    if (!allData || !allData.entries || allData.entries.length === 0) {
        document.getElementById('empty-state').style.display = 'flex';
        return;
    }
    
    let totalRenderedUpdates = 0;
    
    allData.entries.forEach(entry => {
        // Filter items under this entry date
        const filteredItems = entry.items.filter(item => {
            const matchesType = (activeChipType === 'all' || item.type.toLowerCase() === activeChipType.toLowerCase());
            
            // Clean HTML tags to get text for matching
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = item.content_html;
            const plainText = tempDiv.textContent || tempDiv.innerText || "";
            
            const matchesSearch = !searchQuery || 
                item.type.toLowerCase().includes(searchQuery) || 
                plainText.toLowerCase().includes(searchQuery) ||
                entry.date.toLowerCase().includes(searchQuery);
                
            return matchesType && matchesSearch;
        });
        
        if (filteredItems.length > 0) {
            totalRenderedUpdates += filteredItems.length;
            
            const dayBlock = document.createElement('div');
            dayBlock.className = 'day-block';
            
            let dayHeaderHTML = `
                <div class="day-header">
                    <h2 class="day-title">${entry.date}</h2>
                    <div class="day-line"></div>
                </div>
                <div class="day-items-grid">
            `;
            
            let dayItemsHTML = '';
            filteredItems.forEach(item => {
                dayItemsHTML += `
                    <div class="update-card glass-card" data-type="${item.type}">
                        <div class="card-header-row">
                            <span class="type-tag">${item.type}</span>
                        </div>
                        <div class="card-content">
                            ${item.content_html}
                        </div>
                        <div class="card-footer">
                            <button class="card-tweet-btn" data-date="${entry.date}" data-type="${item.type}" data-link="${entry.link}">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                </svg>
                                <span>Tweet Update</span>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            dayBlock.innerHTML = dayHeaderHTML + dayItemsHTML + `</div>`;
            container.appendChild(dayBlock);
        }
    });
    
    // Toggle empty state
    const emptyState = document.getElementById('empty-state');
    if (totalRenderedUpdates === 0) {
        emptyState.style.display = 'flex';
    } else {
        emptyState.style.display = 'none';
    }
}

// UI State Switchers
function showLoading(isLoading) {
    const loadingState = document.getElementById('loading-state');
    if (loadingState) {
        loadingState.style.display = isLoading ? 'flex' : 'none';
    }
    
    const notesContainer = document.getElementById('notes-container');
    if (notesContainer && isLoading) {
        notesContainer.innerHTML = '';
        document.getElementById('empty-state').style.display = 'none';
    }
}

function showError(isError, message = "") {
    const errorState = document.getElementById('error-state');
    const errorMsg = document.getElementById('error-msg');
    
    if (errorState) {
        if (isError) {
            errorState.style.display = 'flex';
            if (errorMsg) errorMsg.textContent = message || "Something went wrong while connecting to the backend API.";
            document.getElementById('notes-container').innerHTML = '';
            document.getElementById('empty-state').style.display = 'none';
        } else {
            errorState.style.display = 'none';
        }
    }
}

// Tweet Composer Modal Management
function openTweetComposer(date, type, link, contentEl) {
    // Generate text draft from the element's actual visible text
    const text = contentEl.textContent || contentEl.innerText || "";
    
    // Normalize spaces and truncate if too long
    let cleanText = text.replace(/\s+/g, ' ').trim();
    
    // We want some space for tweet header and link
    const maxTextSnippetLength = 200;
    if (cleanText.length > maxTextSnippetLength) {
        cleanText = cleanText.substring(0, maxTextSnippetLength) + '...';
    }
    
    const tweetText = `BigQuery Release [${date}] • ${type}\n${cleanText}`;
    selectedLink = link;

    // Set preview details
    const textarea = document.getElementById('tweet-textarea');
    textarea.value = tweetText;
    
    const linkText = document.getElementById('tweet-link-text');
    if (linkText) linkText.textContent = link;
    
    // Reset copy button state
    const copyText = document.getElementById('copy-btn-text');
    if (copyText) copyText.textContent = 'Copy Text';

    updateCharCounter();
    
    // Show modal
    const modal = document.getElementById('tweet-modal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Lock background scroll
    textarea.focus();
}

function hideTweetModal() {
    const modal = document.getElementById('tweet-modal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto'; // Unlock background scroll
}

function updateCharCounter() {
    const textarea = document.getElementById('tweet-textarea');
    const length = textarea.value.length;
    
    charCounterText.textContent = `${length} / 280`;
    
    // Manage class colors and circle offset
    charCounterText.className = '';
    if (length > 280) {
        charCounterText.classList.add('limit-exceeded');
    } else if (length > 250) {
        charCounterText.classList.add('limit-warning');
    }
    
    // Update progress circle offset
    const progress = Math.min(length / 280, 1.0);
    const offset = circumference - (progress * circumference);
    
    if (progressCircle) {
        progressCircle.style.strokeDashoffset = offset;
        
        // Change color of the circle indicator dynamically
        if (length > 280) {
            progressCircle.style.stroke = '#f43f5e'; // red
        } else if (length > 250) {
            progressCircle.style.stroke = '#f59e0b'; // amber
        } else {
            progressCircle.style.stroke = '#3b82f6'; // blue
        }
    }
    
    // Disable/Enable the Post button
    const postBtn = document.getElementById('post-tweet-btn');
    if (postBtn) {
        postBtn.disabled = (length === 0 || length > 280);
    }
}

// Copy to Clipboard Action
async function copyTweetToClipboard() {
    const textarea = document.getElementById('tweet-textarea');
    const textToCopy = `${textarea.value}\n${selectedLink}`;
    
    const copyText = document.getElementById('copy-btn-text');
    
    try {
        await navigator.clipboard.writeText(textToCopy);
        if (copyText) {
            copyText.textContent = 'Copied!';
            setTimeout(() => {
                copyText.textContent = 'Copy Text';
            }, 2000);
        }
    } catch (err) {
        console.error('Failed to copy to clipboard', err);
        alert('Could not copy text automatically. Please select the text inside the box and copy manually.');
    }
}

// Trigger Twitter Intent
function triggerTwitterIntent() {
    const textarea = document.getElementById('tweet-textarea');
    const tweetText = textarea.value;
    
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(selectedLink)}`;
    window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
    
    // Close composer modal
    hideTweetModal();
}
