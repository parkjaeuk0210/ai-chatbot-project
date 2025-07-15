/**
 * Chat Search Feature
 * Provides search functionality across chat history
 */

export class ChatSearch {
    constructor() {
        this.searchIndex = new Map();
        this.highlightClass = 'search-highlight';
        this.maxResults = 50;
        
        this.initStyles();
    }

    initStyles() {
        if (!document.querySelector('#chat-search-styles')) {
            const style = document.createElement('style');
            style.id = 'chat-search-styles';
            style.textContent = `
                .search-highlight {
                    background-color: #fef3c7;
                    padding: 0 2px;
                    border-radius: 2px;
                    font-weight: 600;
                }
                
                [data-theme="dark"] .search-highlight {
                    background-color: #92400e;
                    color: #fef3c7;
                }
                
                .search-result-item {
                    padding: 12px;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    margin-bottom: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .search-result-item:hover {
                    background-color: #f9fafb;
                    border-color: #3b82f6;
                }
                
                [data-theme="dark"] .search-result-item {
                    border-color: #4b5563;
                }
                
                [data-theme="dark"] .search-result-item:hover {
                    background-color: #1f2937;
                }
                
                .search-snippet {
                    font-size: 14px;
                    color: #6b7280;
                    margin-top: 4px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                }
                
                .search-metadata {
                    font-size: 12px;
                    color: #9ca3af;
                    margin-top: 4px;
                }
                
                .search-no-results {
                    text-align: center;
                    padding: 32px;
                    color: #6b7280;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Build search index from chat history
     * @param {Array} chatHistory - Array of chat messages
     * @param {string} sessionId - Session ID
     */
    buildIndex(chatHistory, sessionId = 'default') {
        const index = new Map();
        
        chatHistory.forEach((message, messageIndex) => {
            const text = this.extractSearchableText(message);
            if (!text) return;
            
            // Tokenize and normalize text
            const tokens = this.tokenize(text);
            
            tokens.forEach(token => {
                if (!index.has(token)) {
                    index.set(token, []);
                }
                
                index.get(token).push({
                    sessionId,
                    messageIndex,
                    message,
                    text
                });
            });
        });
        
        this.searchIndex.set(sessionId, index);
    }

    /**
     * Search for query in chat history
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Array} Search results
     */
    search(query, options = {}) {
        const {
            sessionId = 'default',
            caseSensitive = false,
            wholeWord = false,
            regex = false,
            maxResults = this.maxResults,
            sortBy = 'relevance' // relevance, time
        } = options;

        if (!query || query.trim().length === 0) {
            return [];
        }

        let results = [];

        if (regex) {
            results = this.searchRegex(query, sessionId, caseSensitive);
        } else {
            results = this.searchText(query, sessionId, caseSensitive, wholeWord);
        }

        // Sort results
        if (sortBy === 'time') {
            results.sort((a, b) => b.messageIndex - a.messageIndex);
        } else {
            // Sort by relevance (score)
            results.sort((a, b) => b.score - a.score);
        }

        // Limit results
        return results.slice(0, maxResults);
    }

    searchText(query, sessionId, caseSensitive, wholeWord) {
        const normalizedQuery = caseSensitive ? query : query.toLowerCase();
        const queryTokens = this.tokenize(normalizedQuery);
        const results = new Map();

        const index = this.searchIndex.get(sessionId);
        if (!index) return [];

        // Search for each token
        queryTokens.forEach(token => {
            const entries = index.get(token) || [];
            
            entries.forEach(entry => {
                const key = `${entry.sessionId}-${entry.messageIndex}`;
                
                if (!results.has(key)) {
                    const score = this.calculateRelevanceScore(
                        entry.text,
                        query,
                        caseSensitive,
                        wholeWord
                    );
                    
                    if (score > 0) {
                        results.set(key, {
                            ...entry,
                            score,
                            snippet: this.createSnippet(entry.text, query, caseSensitive)
                        });
                    }
                }
            });
        });

        return Array.from(results.values());
    }

    searchRegex(query, sessionId, caseSensitive) {
        const results = [];
        
        try {
            const flags = caseSensitive ? 'g' : 'gi';
            const regex = new RegExp(query, flags);
            
            const messages = this.getMessagesForSession(sessionId);
            
            messages.forEach((entry, messageIndex) => {
                const matches = entry.text.match(regex);
                
                if (matches && matches.length > 0) {
                    results.push({
                        ...entry,
                        messageIndex,
                        score: matches.length,
                        snippet: this.createSnippet(entry.text, query, caseSensitive),
                        matches
                    });
                }
            });
        } catch (error) {
            console.error('Invalid regex:', error);
            return [];
        }

        return results;
    }

    /**
     * Highlight search results in text
     * @param {string} text - Text to highlight
     * @param {string} query - Search query
     * @param {boolean} caseSensitive - Case sensitive search
     * @returns {string} HTML with highlighted matches
     */
    highlightMatches(text, query, caseSensitive = false) {
        if (!query) return text;

        const flags = caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(`(${this.escapeRegex(query)})`, flags);
        
        return text.replace(regex, `<span class="${this.highlightClass}">$1</span>`);
    }

    /**
     * Create search UI component
     * @param {HTMLElement} container - Container element
     * @param {Function} onResultClick - Callback for result click
     */
    createSearchUI(container, onResultClick) {
        const searchUI = document.createElement('div');
        searchUI.className = 'search-ui glass-effect rounded-lg p-4';
        searchUI.innerHTML = `
            <div class="search-header mb-4">
                <div class="relative">
                    <input type="text" 
                           id="search-input" 
                           placeholder="메시지 검색..."
                           class="w-full px-4 py-2 pr-10 rounded-lg border border-gray-300 focus:outline-none focus:border-blue-500"
                    >
                    <button id="search-button" class="absolute right-2 top-2 text-gray-500 hover:text-blue-500">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                    </button>
                </div>
                <div class="mt-2 flex gap-2 text-sm">
                    <label class="flex items-center gap-1">
                        <input type="checkbox" id="search-case-sensitive" class="rounded">
                        <span>대소문자 구분</span>
                    </label>
                    <label class="flex items-center gap-1">
                        <input type="checkbox" id="search-whole-word" class="rounded">
                        <span>단어 단위</span>
                    </label>
                    <label class="flex items-center gap-1">
                        <input type="checkbox" id="search-regex" class="rounded">
                        <span>정규식</span>
                    </label>
                </div>
            </div>
            <div id="search-results" class="search-results max-h-96 overflow-y-auto"></div>
        `;

        container.appendChild(searchUI);

        // Event listeners
        const searchInput = searchUI.querySelector('#search-input');
        const searchButton = searchUI.querySelector('#search-button');
        const resultsContainer = searchUI.querySelector('#search-results');
        const caseSensitive = searchUI.querySelector('#search-case-sensitive');
        const wholeWord = searchUI.querySelector('#search-whole-word');
        const regex = searchUI.querySelector('#search-regex');

        const performSearch = () => {
            const query = searchInput.value;
            const results = this.search(query, {
                caseSensitive: caseSensitive.checked,
                wholeWord: wholeWord.checked,
                regex: regex.checked
            });

            this.displayResults(results, resultsContainer, query, onResultClick);
        };

        searchInput.addEventListener('input', debounce(performSearch, 300));
        searchButton.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });

        return searchUI;
    }

    displayResults(results, container, query, onResultClick) {
        container.innerHTML = '';

        if (results.length === 0) {
            container.innerHTML = `
                <div class="search-no-results">
                    <p>검색 결과가 없습니다</p>
                </div>
            `;
            return;
        }

        results.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            
            const role = result.message.role === 'user' ? '사용자' : 'AI';
            const timestamp = result.message.timestamp 
                ? new Date(result.message.timestamp).toLocaleString('ko-KR')
                : '';

            resultItem.innerHTML = `
                <div class="font-medium text-sm">${role}</div>
                <div class="search-snippet">${result.snippet}</div>
                <div class="search-metadata">${timestamp}</div>
            `;

            resultItem.addEventListener('click', () => {
                if (onResultClick) {
                    onResultClick(result);
                }
            });

            container.appendChild(resultItem);
        });
    }

    // Helper methods
    extractSearchableText(message) {
        if (!message.parts) return '';
        
        return message.parts
            .filter(part => part.text)
            .map(part => part.text)
            .join(' ');
    }

    tokenize(text) {
        // Simple tokenization - can be enhanced with better NLP
        return text
            .toLowerCase()
            .replace(/[^\w\s가-힣]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 1);
    }

    calculateRelevanceScore(text, query, caseSensitive, wholeWord) {
        const normalizedText = caseSensitive ? text : text.toLowerCase();
        const normalizedQuery = caseSensitive ? query : query.toLowerCase();
        
        let score = 0;
        
        if (wholeWord) {
            const regex = new RegExp(`\\b${this.escapeRegex(normalizedQuery)}\\b`, 'g');
            const matches = normalizedText.match(regex);
            score = matches ? matches.length : 0;
        } else {
            let index = normalizedText.indexOf(normalizedQuery);
            while (index !== -1) {
                score++;
                index = normalizedText.indexOf(normalizedQuery, index + 1);
            }
        }
        
        // Boost score for exact matches
        if (normalizedText === normalizedQuery) {
            score *= 2;
        }
        
        return score;
    }

    createSnippet(text, query, caseSensitive = false) {
        const maxLength = 150;
        const normalizedText = caseSensitive ? text : text.toLowerCase();
        const normalizedQuery = caseSensitive ? query : query.toLowerCase();
        
        const index = normalizedText.indexOf(normalizedQuery);
        
        if (index === -1) {
            return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
        }
        
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + query.length + 50);
        
        let snippet = text.substring(start, end);
        
        if (start > 0) snippet = '...' + snippet;
        if (end < text.length) snippet = snippet + '...';
        
        return this.highlightMatches(snippet, query, caseSensitive);
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    getMessagesForSession(sessionId) {
        // This would be implemented based on your session management
        // For now, return empty array
        return [];
    }
}

// Debounce helper
function debounce(func, wait) {
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

// Create singleton instance
export const chatSearch = new ChatSearch();