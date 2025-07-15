/**
 * Offline Queue Management
 * Stores messages when offline and syncs when back online
 */

export class OfflineQueue {
    constructor() {
        this.dbName = 'fera-ai-offline';
        this.version = 1;
        this.db = null;
        this.isOnline = navigator.onLine;
        
        this.init();
        this.setupEventListeners();
    }

    async init() {
        try {
            this.db = await this.openDB();
            console.log('Offline queue initialized');
            
            // Process any pending messages if online
            if (this.isOnline) {
                this.processPendingMessages();
            }
        } catch (error) {
            console.error('Failed to initialize offline queue:', error);
        }
    }

    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create stores if they don't exist
                if (!db.objectStoreNames.contains('messages')) {
                    const messageStore = db.createObjectStore('messages', { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    messageStore.createIndex('timestamp', 'timestamp', { unique: false });
                    messageStore.createIndex('status', 'status', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('responses')) {
                    const responseStore = db.createObjectStore('responses', { 
                        keyPath: 'messageId' 
                    });
                    responseStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    setupEventListeners() {
        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('Back online - processing pending messages');
            this.processPendingMessages();
            this.notifyUser('온라인 상태로 전환되었습니다', 'success');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('Gone offline - messages will be queued');
            this.notifyUser('오프라인 상태입니다. 메시지가 대기열에 저장됩니다', 'warning');
        });
    }

    async addMessage(messageData) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const transaction = this.db.transaction(['messages'], 'readwrite');
        const store = transaction.objectStore('messages');
        
        const message = {
            ...messageData,
            timestamp: Date.now(),
            status: 'pending',
            retryCount: 0
        };
        
        return new Promise((resolve, reject) => {
            const request = store.add(message);
            request.onsuccess = () => {
                console.log('Message queued for offline sync:', request.result);
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getMessages(status = 'pending') {
        if (!this.db) return [];

        const transaction = this.db.transaction(['messages'], 'readonly');
        const store = transaction.objectStore('messages');
        const index = store.index('status');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(status);
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async updateMessageStatus(id, status, response = null) {
        if (!this.db) return;

        const transaction = this.db.transaction(['messages', 'responses'], 'readwrite');
        const messageStore = transaction.objectStore('messages');
        const responseStore = transaction.objectStore('responses');
        
        // Get the message
        const getMessage = messageStore.get(id);
        
        return new Promise((resolve, reject) => {
            getMessage.onsuccess = () => {
                const message = getMessage.result;
                if (!message) {
                    reject(new Error('Message not found'));
                    return;
                }
                
                // Update message status
                message.status = status;
                message.lastUpdated = Date.now();
                
                if (status === 'failed') {
                    message.retryCount = (message.retryCount || 0) + 1;
                }
                
                const updateRequest = messageStore.put(message);
                
                updateRequest.onsuccess = () => {
                    // Store response if provided
                    if (response && status === 'sent') {
                        responseStore.put({
                            messageId: id,
                            response: response,
                            timestamp: Date.now()
                        });
                    }
                    resolve();
                };
                
                updateRequest.onerror = () => reject(updateRequest.error);
            };
            
            getMessage.onerror = () => reject(getMessage.error);
        });
    }

    async processPendingMessages() {
        if (!this.isOnline) return;
        
        try {
            const pendingMessages = await this.getMessages('pending');
            console.log(`Processing ${pendingMessages.length} pending messages`);
            
            for (const message of pendingMessages) {
                // Skip if too many retries
                if (message.retryCount >= 3) {
                    await this.updateMessageStatus(message.id, 'failed');
                    continue;
                }
                
                try {
                    // Send the message
                    const response = await this.sendMessage(message);
                    
                    if (response.ok) {
                        const result = await response.json();
                        await this.updateMessageStatus(message.id, 'sent', result);
                        
                        // Notify success
                        this.notifyMessageSent(message);
                    } else {
                        throw new Error(`HTTP ${response.status}`);
                    }
                } catch (error) {
                    console.error(`Failed to send message ${message.id}:`, error);
                    await this.updateMessageStatus(message.id, 'failed');
                    
                    // Retry with exponential backoff
                    const retryDelay = Math.min(1000 * Math.pow(2, message.retryCount), 30000);
                    setTimeout(() => {
                        if (this.isOnline) {
                            this.processPendingMessages();
                        }
                    }, retryDelay);
                }
            }
        } catch (error) {
            console.error('Error processing pending messages:', error);
        }
    }

    async sendMessage(message) {
        const { chatHistory, model, persona, sessionId, url } = message.data;
        
        return fetch('/api/chat-secure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatHistory,
                model,
                persona,
                sessionId,
                url
            })
        });
    }

    notifyUser(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `offline-notification ${type}`;
        notification.textContent = message;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            background: ${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            z-index: 9999;
            animation: slideUp 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideDown 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    notifyMessageSent(message) {
        // Notify that offline message was sent
        if (window.feraApp && window.feraApp.chatManager) {
            window.feraApp.chatManager.addMessage(
                window.feraApp.chatMessages,
                'model',
                [{ text: '📤 오프라인 중 저장된 메시지가 전송되었습니다.' }]
            );
        }
    }

    async clearOldMessages(daysToKeep = 7) {
        if (!this.db) return;
        
        const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        const transaction = this.db.transaction(['messages', 'responses'], 'readwrite');
        const messageStore = transaction.objectStore('messages');
        const responseStore = transaction.objectStore('responses');
        
        // Get all messages
        const messages = await new Promise((resolve, reject) => {
            const request = messageStore.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        // Delete old messages
        for (const message of messages) {
            if (message.timestamp < cutoffTime && message.status !== 'pending') {
                messageStore.delete(message.id);
                responseStore.delete(message.id);
            }
        }
    }

    async getStorageInfo() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage,
                quota: estimate.quota,
                percentUsed: (estimate.usage / estimate.quota) * 100
            };
        }
        return null;
    }
}

// Create singleton instance
export const offlineQueue = new OfflineQueue();

// Add CSS for notifications
if (!document.querySelector('#offline-queue-styles')) {
    const style = document.createElement('style');
    style.id = 'offline-queue-styles';
    style.textContent = `
        @keyframes slideUp {
            from {
                transform: translate(-50%, 100%);
                opacity: 0;
            }
            to {
                transform: translate(-50%, 0);
                opacity: 1;
            }
        }
        
        @keyframes slideDown {
            from {
                transform: translate(-50%, 0);
                opacity: 1;
            }
            to {
                transform: translate(-50%, 100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}