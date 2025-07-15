/**
 * Chat Export Feature
 * Allows users to export their chat history in various formats
 */

export class ChatExporter {
    constructor() {
        this.formats = ['json', 'txt', 'md', 'pdf'];
    }

    /**
     * Export chat history to specified format
     * @param {Array} chatHistory - Array of chat messages
     * @param {string} format - Export format (json, txt, md, pdf)
     * @param {Object} options - Export options
     */
    async export(chatHistory, format = 'txt', options = {}) {
        const {
            includeTimestamp = true,
            includePersona = false,
            includeSystemMessages = false,
            filename = `fera-chat-${Date.now()}`
        } = options;

        // Filter messages based on options
        const filteredHistory = this.filterMessages(chatHistory, {
            includeSystemMessages
        });

        let content;
        let mimeType;
        let extension;

        switch (format) {
            case 'json':
                content = this.exportToJSON(filteredHistory, { includeTimestamp, includePersona });
                mimeType = 'application/json';
                extension = 'json';
                break;
                
            case 'md':
                content = this.exportToMarkdown(filteredHistory, { includeTimestamp, includePersona });
                mimeType = 'text/markdown';
                extension = 'md';
                break;
                
            case 'pdf':
                content = await this.exportToPDF(filteredHistory, { includeTimestamp, includePersona });
                mimeType = 'application/pdf';
                extension = 'pdf';
                break;
                
            case 'txt':
            default:
                content = this.exportToText(filteredHistory, { includeTimestamp, includePersona });
                mimeType = 'text/plain';
                extension = 'txt';
                break;
        }

        // Download the file
        this.downloadFile(content, `${filename}.${extension}`, mimeType);
        
        return {
            success: true,
            format,
            messageCount: filteredHistory.length
        };
    }

    filterMessages(chatHistory, options) {
        return chatHistory.filter(message => {
            if (!options.includeSystemMessages && message.role === 'system') {
                return false;
            }
            return true;
        });
    }

    exportToJSON(chatHistory, options) {
        const exportData = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            app: 'FERA AI',
            messageCount: chatHistory.length,
            messages: chatHistory.map(message => {
                const exportedMessage = {
                    role: message.role,
                    content: this.extractTextContent(message.parts)
                };
                
                if (options.includeTimestamp && message.timestamp) {
                    exportedMessage.timestamp = message.timestamp;
                }
                
                if (message.parts.some(part => part.inlineData)) {
                    exportedMessage.hasAttachment = true;
                }
                
                return exportedMessage;
            })
        };

        return JSON.stringify(exportData, null, 2);
    }

    exportToText(chatHistory, options) {
        let content = '=== FERA AI 채팅 기록 ===\n';
        content += `내보낸 날짜: ${new Date().toLocaleString('ko-KR')}\n`;
        content += `메시지 수: ${chatHistory.length}\n`;
        content += '=' .repeat(50) + '\n\n';

        chatHistory.forEach((message, index) => {
            const role = message.role === 'user' ? '사용자' : 'FERA AI';
            const text = this.extractTextContent(message.parts);
            
            if (options.includeTimestamp && message.timestamp) {
                content += `[${new Date(message.timestamp).toLocaleString('ko-KR')}]\n`;
            }
            
            content += `${role}: ${text}\n`;
            
            if (message.parts.some(part => part.inlineData)) {
                content += '  [첨부파일 포함]\n';
            }
            
            content += '\n';
        });

        return content;
    }

    exportToMarkdown(chatHistory, options) {
        let content = '# FERA AI 채팅 기록\n\n';
        content += `**내보낸 날짜**: ${new Date().toLocaleString('ko-KR')}  \n`;
        content += `**메시지 수**: ${chatHistory.length}  \n\n`;
        content += '---\n\n';

        chatHistory.forEach((message, index) => {
            const role = message.role === 'user' ? '👤 **사용자**' : '🤖 **FERA AI**';
            const text = this.extractTextContent(message.parts);
            
            if (options.includeTimestamp && message.timestamp) {
                content += `*${new Date(message.timestamp).toLocaleString('ko-KR')}*\n\n`;
            }
            
            content += `${role}\n\n`;
            
            // Format code blocks properly
            const formattedText = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
                return `\`\`\`${lang || ''}\n${code}\`\`\``;
            });
            
            content += `${formattedText}\n\n`;
            
            if (message.parts.some(part => part.inlineData)) {
                content += '> 📎 *첨부파일 포함*\n\n';
            }
            
            content += '---\n\n';
        });

        return content;
    }

    async exportToPDF(chatHistory, options) {
        // Dynamic import for PDF generation
        const jsPDFModule = await import(/* @vite-ignore */ 'jspdf').catch(() => null);
        
        if (!jsPDFModule) {
            throw new Error('PDF export is not available. Please install jsPDF.');
        }
        
        const { jsPDF } = jsPDFModule;
        
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Add custom font for Korean support
        // Note: In production, you'd need to add a Korean font
        
        // Document setup
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        let yPosition = margin;

        // Title
        doc.setFontSize(20);
        doc.text('FERA AI 채팅 기록', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;

        // Metadata
        doc.setFontSize(10);
        doc.text(`내보낸 날짜: ${new Date().toLocaleString('ko-KR')}`, margin, yPosition);
        yPosition += 7;
        doc.text(`메시지 수: ${chatHistory.length}`, margin, yPosition);
        yPosition += 10;

        // Messages
        doc.setFontSize(12);
        
        chatHistory.forEach((message, index) => {
            // Check if we need a new page
            if (yPosition > pageHeight - margin * 2) {
                doc.addPage();
                yPosition = margin;
            }

            const role = message.role === 'user' ? '사용자' : 'FERA AI';
            const text = this.extractTextContent(message.parts);
            
            // Role
            doc.setFont(undefined, 'bold');
            doc.text(role + ':', margin, yPosition);
            yPosition += 7;
            
            // Message content
            doc.setFont(undefined, 'normal');
            const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
            
            lines.forEach(line => {
                if (yPosition > pageHeight - margin) {
                    doc.addPage();
                    yPosition = margin;
                }
                doc.text(line, margin + 5, yPosition);
                yPosition += 5;
            });
            
            yPosition += 5;
        });

        return doc.output('blob');
    }

    extractTextContent(parts) {
        return parts
            .filter(part => part.text)
            .map(part => part.text)
            .join('\n');
    }

    downloadFile(content, filename, mimeType) {
        const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    }

    // Get estimated file size
    getEstimatedSize(chatHistory, format) {
        let content;
        
        switch (format) {
            case 'json':
                content = this.exportToJSON(chatHistory, {});
                break;
            case 'md':
                content = this.exportToMarkdown(chatHistory, {});
                break;
            case 'txt':
            default:
                content = this.exportToText(chatHistory, {});
                break;
        }
        
        // Calculate size in bytes
        const sizeInBytes = new Blob([content]).size;
        
        // Format size
        if (sizeInBytes < 1024) {
            return `${sizeInBytes} B`;
        } else if (sizeInBytes < 1024 * 1024) {
            return `${(sizeInBytes / 1024).toFixed(1)} KB`;
        } else {
            return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
        }
    }
}

// Create singleton instance
export const chatExporter = new ChatExporter();