/**
 * Multi-Session Management
 * Allows users to manage multiple chat sessions
 */

export class MultiSessionManager {
    constructor() {
        this.sessions = new Map();
        this.currentSessionId = null;
        this.maxSessions = 10;
        this.storageKey = 'fera_chat_sessions';
        
        this.loadSessions();
    }

    /**
     * Create a new session
     * @param {string} name - Session name
     * @param {Object} options - Session options
     * @returns {Object} New session object
     */
    createSession(name = null, options = {}) {
        const sessionId = this.generateSessionId();
        const timestamp = Date.now();
        
        const session = {
            id: sessionId,
            name: name || `세션 ${this.sessions.size + 1}`,
            createdAt: timestamp,
            lastActiveAt: timestamp,
            messageCount: 0,
            persona: options.persona || '',
            theme: options.theme || 'light',
            language: options.language || 'ko',
            chatHistory: [],
            metadata: {
                ...options.metadata
            }
        };
        
        this.sessions.set(sessionId, session);
        this.currentSessionId = sessionId;
        
        // Remove oldest session if limit exceeded
        if (this.sessions.size > this.maxSessions) {
            this.removeOldestSession();
        }
        
        this.saveSessions();
        
        return session;
    }

    /**
     * Get session by ID
     * @param {string} sessionId - Session ID
     * @returns {Object|null} Session object or null
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId) || null;
    }

    /**
     * Get current active session
     * @returns {Object|null} Current session or null
     */
    getCurrentSession() {
        if (!this.currentSessionId) {
            // Create default session if none exists
            const session = this.createSession('기본 세션');
            return session;
        }
        
        return this.sessions.get(this.currentSessionId);
    }

    /**
     * Switch to a different session
     * @param {string} sessionId - Session ID to switch to
     * @returns {boolean} Success status
     */
    switchSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            console.error('Session not found:', sessionId);
            return false;
        }
        
        this.currentSessionId = sessionId;
        
        // Update last active time
        const session = this.sessions.get(sessionId);
        session.lastActiveAt = Date.now();
        
        this.saveSessions();
        
        // Emit session change event
        this.emitSessionChange(session);
        
        return true;
    }

    /**
     * Update session data
     * @param {string} sessionId - Session ID
     * @param {Object} updates - Updates to apply
     */
    updateSession(sessionId, updates) {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        
        // Update allowed fields
        const allowedFields = ['name', 'persona', 'theme', 'language', 'metadata'];
        
        Object.keys(updates).forEach(key => {
            if (allowedFields.includes(key)) {
                session[key] = updates[key];
            }
        });
        
        session.lastActiveAt = Date.now();
        
        this.saveSessions();
    }

    /**
     * Add message to session
     * @param {string} sessionId - Session ID
     * @param {Object} message - Message object
     */
    addMessage(sessionId, message) {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        
        session.chatHistory.push({
            ...message,
            timestamp: Date.now()
        });
        
        session.messageCount++;
        session.lastActiveAt = Date.now();
        
        // Trim old messages if needed (keep last 100)
        if (session.chatHistory.length > 100) {
            session.chatHistory = session.chatHistory.slice(-100);
        }
        
        this.saveSessions();
    }

    /**
     * Delete a session
     * @param {string} sessionId - Session ID to delete
     * @returns {boolean} Success status
     */
    deleteSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            return false;
        }
        
        this.sessions.delete(sessionId);
        
        // If deleted session was current, switch to another
        if (this.currentSessionId === sessionId) {
            const sessionIds = Array.from(this.sessions.keys());
            this.currentSessionId = sessionIds[0] || null;
            
            // Create new session if none left
            if (!this.currentSessionId) {
                this.createSession('기본 세션');
            }
        }
        
        this.saveSessions();
        return true;
    }

    /**
     * Clear all messages in a session
     * @param {string} sessionId - Session ID
     */
    clearSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;
        
        session.chatHistory = [];
        session.messageCount = 0;
        session.lastActiveAt = Date.now();
        
        this.saveSessions();
    }

    /**
     * Get all sessions
     * @returns {Array} Array of session objects
     */
    getAllSessions() {
        return Array.from(this.sessions.values()).sort((a, b) => 
            b.lastActiveAt - a.lastActiveAt
        );
    }

    /**
     * Search sessions by name or content
     * @param {string} query - Search query
     * @returns {Array} Matching sessions
     */
    searchSessions(query) {
        const lowerQuery = query.toLowerCase();
        
        return this.getAllSessions().filter(session => {
            // Search in session name
            if (session.name.toLowerCase().includes(lowerQuery)) {
                return true;
            }
            
            // Search in messages
            return session.chatHistory.some(message => {
                const content = message.parts
                    .filter(part => part.text)
                    .map(part => part.text)
                    .join(' ')
                    .toLowerCase();
                
                return content.includes(lowerQuery);
            });
        });
    }

    /**
     * Export session data
     * @param {string} sessionId - Session ID
     * @returns {Object} Session data for export
     */
    exportSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        
        return {
            ...session,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
    }

    /**
     * Import session data
     * @param {Object} sessionData - Session data to import
     * @returns {string|null} Imported session ID or null
     */
    importSession(sessionData) {
        try {
            // Validate session data
            if (!sessionData.id || !sessionData.chatHistory) {
                throw new Error('Invalid session data');
            }
            
            // Generate new ID to avoid conflicts
            const newSessionId = this.generateSessionId();
            
            const session = {
                ...sessionData,
                id: newSessionId,
                importedAt: Date.now(),
                originalId: sessionData.id
            };
            
            this.sessions.set(newSessionId, session);
            this.saveSessions();
            
            return newSessionId;
        } catch (error) {
            console.error('Failed to import session:', error);
            return null;
        }
    }

    /**
     * Get session statistics
     * @param {string} sessionId - Session ID
     * @returns {Object} Session statistics
     */
    getSessionStats(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        
        const userMessages = session.chatHistory.filter(m => m.role === 'user').length;
        const aiMessages = session.chatHistory.filter(m => m.role === 'model').length;
        const totalChars = session.chatHistory.reduce((sum, message) => {
            const text = message.parts
                .filter(part => part.text)
                .map(part => part.text)
                .join('');
            return sum + text.length;
        }, 0);
        
        return {
            messageCount: session.messageCount,
            userMessages,
            aiMessages,
            totalCharacters: totalChars,
            averageMessageLength: session.messageCount > 0 ? Math.round(totalChars / session.messageCount) : 0,
            duration: Date.now() - session.createdAt,
            lastActive: new Date(session.lastActiveAt).toLocaleString('ko-KR')
        };
    }

    // Private methods
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    removeOldestSession() {
        let oldestSession = null;
        let oldestTime = Infinity;
        
        this.sessions.forEach(session => {
            if (session.lastActiveAt < oldestTime && session.id !== this.currentSessionId) {
                oldestTime = session.lastActiveAt;
                oldestSession = session;
            }
        });
        
        if (oldestSession) {
            this.sessions.delete(oldestSession.id);
        }
    }

    saveSessions() {
        try {
            const sessionsData = {
                sessions: Array.from(this.sessions.entries()),
                currentSessionId: this.currentSessionId
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(sessionsData));
        } catch (error) {
            console.error('Failed to save sessions:', error);
            
            // If storage is full, remove oldest sessions
            if (error.name === 'QuotaExceededError') {
                this.removeOldestSession();
                this.saveSessions();
            }
        }
    }

    loadSessions() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) return;
            
            const { sessions, currentSessionId } = JSON.parse(stored);
            
            this.sessions = new Map(sessions);
            this.currentSessionId = currentSessionId;
            
            // Clean up old sessions (older than 30 days)
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const toDelete = [];
            
            this.sessions.forEach((session, id) => {
                if (session.lastActiveAt < thirtyDaysAgo) {
                    toDelete.push(id);
                }
            });
            
            toDelete.forEach(id => this.sessions.delete(id));
            
            if (toDelete.length > 0) {
                this.saveSessions();
            }
        } catch (error) {
            console.error('Failed to load sessions:', error);
            this.sessions = new Map();
            this.currentSessionId = null;
        }
    }

    emitSessionChange(session) {
        // Emit custom event for session change
        const event = new CustomEvent('sessionChanged', {
            detail: { session }
        });
        
        window.dispatchEvent(event);
    }
}

// Create singleton instance
export const multiSessionManager = new MultiSessionManager();