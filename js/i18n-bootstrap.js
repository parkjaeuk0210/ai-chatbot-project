import i18n from './i18n/i18n.js';

// Make i18n available globally before initialization
window.i18n = i18n;

// Initialize i18n asynchronously
(async function() {
    try {
        console.log('Starting i18n initialization...');

        // Initialize i18n with location detection
        const detectedLanguage = await i18n.init();
        console.log('i18n initialized with language:', detectedLanguage);

        // Show a brief notification about detected language (optional)
        if (detectedLanguage !== 'ko') {
            const langNames = {
                'en': 'English',
                'ja': '日本語',
                'zh': '中文',
                'id': 'Bahasa Indonesia'
            };
            console.log(`Language auto-detected: ${langNames[detectedLanguage] || detectedLanguage}`);
        }

    } catch (error) {
        console.error('Failed to initialize i18n:', error);
        // Fallback initialization
        i18n.updatePageTranslations();
    }
})();

// Listen for language changes to update dynamic content
window.addEventListener('languageChanged', (e) => {
    // Update initial message
    const initialMessage = document.querySelector('#initial-message p');
    if (initialMessage) {
        initialMessage.textContent = i18n.t('chat.initialMessage');
    }

    // Update placeholder text that might be dynamically set
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.placeholder = i18n.t('chat.placeholder');
    }

    const imagePrompt = document.getElementById('image-prompt');
    if (imagePrompt) {
        imagePrompt.placeholder = i18n.t('image.placeholder');
    }

    // Update app system instructions when language changes
    if (window.peraApp) {
        window.peraApp.systemInstructions = window.peraApp.getSystemInstructions();
    }

});

// Listen for i18n initialization complete
window.addEventListener('i18nInitialized', (e) => {
    console.log('i18n fully initialized, language:', e.detail.language);

    // Update system instructions if app is already initialized
    if (window.peraApp && window.peraApp.systemInstructions === null) {
        window.peraApp.systemInstructions = window.peraApp.getSystemInstructions();
    }
});
