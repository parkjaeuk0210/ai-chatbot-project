// Response filtering middleware to protect FERA's identity
export function filterGeminiResponse(responseData) {
    try {
        // Deep clone to avoid modifying original
        const filtered = JSON.parse(JSON.stringify(responseData));
        
        // Define replacement patterns
        const replacements = [
            // Identity replacements
            { pattern: /Google에서 훈련한 대규모 언어 모델/gi, replacement: "FERA AI 비서" },
            { pattern: /Google에서 개발한/gi, replacement: "FERA Technologies에서 개발한" },
            { pattern: /저는 Google의/gi, replacement: "저는 FERA의" },
            { pattern: /Google AI/gi, replacement: "FERA AI" },
            { pattern: /구글에서/gi, replacement: "FERA Technologies에서" },
            { pattern: /구글의/gi, replacement: "FERA의" },
            
            // Model name replacements
            { pattern: /Gemini/gi, replacement: "FERA" },
            { pattern: /제미니/gi, replacement: "FERA" },
            { pattern: /Bard/gi, replacement: "FERA" },
            { pattern: /바드/gi, replacement: "FERA" },
            
            // Technical term replacements
            { pattern: /대규모 언어 모델/gi, replacement: "AI 비서" },
            { pattern: /언어 모델/gi, replacement: "AI 모델" },
            { pattern: /LLM/g, replacement: "AI" },
            { pattern: /Large Language Model/gi, replacement: "AI Assistant" },
            
            // Company references
            { pattern: /Google Cloud/gi, replacement: "FERA Cloud" },
            { pattern: /Google 팀/gi, replacement: "FERA 팀" },
            { pattern: /Alphabet/gi, replacement: "FERA Technologies" },
            
            // Common phrases
            { pattern: /제가 Google/gi, replacement: "제가 FERA" },
            { pattern: /저는 구글/gi, replacement: "저는 FERA" },
            { pattern: /Google이 만든/gi, replacement: "FERA Technologies가 만든" },
            { pattern: /구글이 만든/gi, replacement: "FERA Technologies가 만든" },
            
            // Training data references
            { pattern: /훈련 데이터/gi, replacement: "학습 자료" },
            { pattern: /사전 훈련/gi, replacement: "개발 과정" },
            { pattern: /파인튜닝/gi, replacement: "최적화" },
            
            // API references
            { pattern: /Gemini API/gi, replacement: "FERA API" },
            { pattern: /Vertex AI/gi, replacement: "FERA Platform" },
            { pattern: /PaLM/gi, replacement: "FERA" }
        ];
        
        // Apply replacements to all text content
        if (filtered.candidates && Array.isArray(filtered.candidates)) {
            filtered.candidates.forEach(candidate => {
                if (candidate.content && candidate.content.parts) {
                    candidate.content.parts.forEach(part => {
                        if (part.text) {
                            // Apply all replacements
                            replacements.forEach(({ pattern, replacement }) => {
                                part.text = part.text.replace(pattern, replacement);
                            });
                            
                            // Additional safety check for any remaining Google mentions
                            if (part.text.includes('Google') || part.text.includes('구글')) {
                                console.warn('Warning: Google mention still detected after filtering');
                                // Force replace any remaining mentions
                                part.text = part.text.replace(/Google/gi, 'FERA');
                                part.text = part.text.replace(/구글/gi, 'FERA');
                            }
                            
                            // Check for Gemini mentions
                            if (part.text.includes('Gemini') || part.text.includes('제미니')) {
                                console.warn('Warning: Gemini mention still detected after filtering');
                                part.text = part.text.replace(/Gemini/gi, 'FERA');
                                part.text = part.text.replace(/제미니/gi, 'FERA');
                            }
                        }
                    });
                }
            });
        }
        
        return filtered;
    } catch (error) {
        console.error('Error in response filtering:', error);
        // Return original data if filtering fails
        return responseData;
    }
}

// Check if response contains forbidden terms
export function containsForbiddenTerms(text) {
    const forbiddenTerms = [
        'Google', '구글', 'Gemini', '제미니', 'Bard', '바드',
        '대규모 언어 모델', 'LLM', 'Vertex AI', 'PaLM'
    ];
    
    return forbiddenTerms.some(term => 
        text.toLowerCase().includes(term.toLowerCase())
    );
}

// Log filtered content for monitoring
export function logFilteredContent(original, filtered) {
    if (process.env.NODE_ENV !== 'production') {
        const originalText = JSON.stringify(original);
        const filteredText = JSON.stringify(filtered);
        
        if (originalText !== filteredText) {
            console.log('Content filtered:', {
                before: originalText.substring(0, 200),
                after: filteredText.substring(0, 200)
            });
        }
    }
}