document.addEventListener('DOMContentLoaded', () => {
    // --- PDF.js Worker 설정 ---
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;
     // --- DOM Elements ---
    const settingsButton = document.getElementById('settings-button');
    const themeToggle = document.getElementById('theme-toggle');
    const settingsModal = document.getElementById('settings-modal');
    const personaInput = document.getElementById('persona-input');
    const savePersonaButton = document.getElementById('save-persona-button');
    const closePersonaButton = document.getElementById('close-persona-button');
    const chatTabButton = document.getElementById('chat-tab-button');
    const imageTabButton = document.getElementById('image-tab-button');
    const chatUi = document.getElementById('chat-ui');
    const imageUi = document.getElementById('image-ui');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const fileButton = document.getElementById('file-button');
    const fileInput = document.getElementById('file-input');
    const filePreviewContainer = document.getElementById('file-preview-container');
    const previewImage = document.getElementById('preview-image');
    const previewPdfIcon = document.getElementById('preview-pdf-icon');
    const previewFilename = document.getElementById('preview-filename');
    const previewFilesize = document.getElementById('preview-filesize');
    const removePreviewButton = document.getElementById('remove-preview-button');
    const imagePrompt = document.getElementById('image-prompt');
    const generateImageButton = document.getElementById('generate-image-button');
    const imageResultContainer = document.getElementById('image-result-container');
    const imagePlaceholder = document.getElementById('image-placeholder');
    const imageLoader = document.getElementById('image-loader');
    const generatedImage = document.getElementById('generated-image');
     // --- State ---
    let chatHistory = [];
    let uploadedFile = { type: null, data: null, name: null };
    // Default persona will be set after i18n is loaded
    let defaultPersona = "";
    let currentPersona = localStorage.getItem('peraPersona') || defaultPersona;
    personaInput.value = currentPersona;
    const apiEndpoint = '/api/chat';
    const isDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
     // 고유한 세션 ID 생성 (페이지 로드 시 한 번만)
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;


    // 다크 모드 초기화
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // --- Functions ---

    // 모바일에서 헤더 자동 숨김/표시
    function initHeaderScroll() {
        if (window.innerWidth > 640) return; // 모바일에서만 작동

        const header = document.getElementById('main-header');
        const chatMessages = document.getElementById('chat-messages');
        let lastScrollTop = 0;
        let scrollTimer;
        let isScrolling = false;

        chatMessages.addEventListener('scroll', () => {
            if (!isScrolling) {
                isScrolling = true;

                clearTimeout(scrollTimer);

                const currentScrollTop = chatMessages.scrollTop;
                const scrollDiff = currentScrollTop - lastScrollTop;

                // 스크롤 다운 (20px 이상) - 헤더 숨김
                if (scrollDiff > 20 && currentScrollTop > 100) {
                    header.classList.add('header-hidden');
                }
                // 스크롤 업 또는 최상단 근처 - 헤더 표시
                else if (scrollDiff < -10 || currentScrollTop < 50) {
                    header.classList.remove('header-hidden');
                }

                lastScrollTop = currentScrollTop;

                // 스크롤 멈춤 감지
                scrollTimer = setTimeout(() => {
                    isScrolling = false;
                    // 최상단에서는 항상 헤더 표시
                    if (chatMessages.scrollTop < 50) {
                        header.classList.remove('header-hidden');
                    }
                }, 150);
            }
        });
    }

    // 터치 제스처 지원
    let touchStartX = 0;
    let touchEndX = 0;

    function handleSwipe() {
        const swipeThreshold = 100;
        const diff = touchEndX - touchStartX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // 오른쪽 스와이프 - 채팅으로 전환
                if (document.querySelector('.content-pane.is-active') === imageUi) {
                    switchTabs('chat');
                    // 스와이프 시에도 헤더 표시
                    const header = document.getElementById('main-header');
                    if (header) header.classList.remove('header-hidden');
                }
            } else {
                // 왼쪽 스와이프 - 이미지 생성으로 전환
                if (document.querySelector('.content-pane.is-active') === chatUi) {
                    switchTabs('image');
                    // 스와이프 시에도 헤더 표시
                    const header = document.getElementById('main-header');
                    if (header) header.classList.remove('header-hidden');
                }
            }
        }
    }

    // 모바일 키보드 대응
    function handleMobileKeyboard() {
        if (window.innerWidth <= 640) {
            const viewport = document.querySelector('meta[name="viewport"]');

            chatInput.addEventListener('focus', () => {
                viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');

                setTimeout(() => {
                    chatInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            });

            chatInput.addEventListener('blur', () => {
                viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
            });
        }
    }

    // 가상 키보드 높이 감지 - 개선된 버전
    function detectVirtualKeyboard() {
        let initialHeight = window.innerHeight;
        let resizeTimer;

        const handleResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const currentHeight = window.innerHeight;
                const keyboardHeight = initialHeight - currentHeight;

                if (keyboardHeight > 50) {
                    // 키보드가 열림
                    document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
                    document.body.classList.add('keyboard-open');

                    // 입력창이 보이도록 스크롤
                    const inputContainer = chatInput.closest('.mt-2');
                    if (inputContainer) {
                        setTimeout(() => {
                            inputContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        }, 100);
                    }
                } else {
                    // 키보드가 닫힘
                    document.documentElement.style.setProperty('--keyboard-height', '0px');
                    document.body.classList.remove('keyboard-open');
                }
            }, 100);
        };

        window.addEventListener('resize', handleResize);

        // 방향 전환 시 초기 높이 재설정
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                initialHeight = window.innerHeight;
            }, 500);
        });
    }

    // 테마 변경 함수
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    }

    // 테마 아이콘 업데이트
    function updateThemeIcon(theme) {
        const sunIcon = themeToggle.querySelector('.sun-icon');
        const moonIcon = themeToggle.querySelector('.moon-icon');

        if (theme === 'dark') {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        } else {
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        }
    }


    // 이미지 압축 함수 - 최적화된 버전
    async function compressImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.85) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // 비율 유지하며 크기 조정
                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // 압축된 크기 계산을 위해 blob 생성
                    canvas.toBlob((blob) => {
                        console.log(`이미지 압축 완료: ${formatFileSize(file.size)} → ${formatFileSize(blob.size)}`);
                        resolve({
                            blob,
                            dataUrl: canvas.toDataURL(file.type, quality),
                            width,
                            height,
                            originalSize: file.size,
                            compressedSize: blob.size
                        });
                    }, file.type, quality);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // 파일 크기 포맷 함수
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function switchTabs(targetTab) {
        const panes = { chat: chatUi, image: imageUi };
        const buttons = { chat: chatTabButton, image: imageTabButton };
         for (const tabName in buttons) {
            if (tabName === targetTab) {
                buttons[tabName].classList.add('bg-white', 'text-blue-600', 'shadow-sm');
                buttons[tabName].classList.remove('text-slate-600');
                buttons[tabName].setAttribute('aria-selected', 'true');
                buttons[tabName].setAttribute('tabindex', '0');
            } else {
                buttons[tabName].classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
                buttons[tabName].classList.add('text-slate-600');
                buttons[tabName].setAttribute('aria-selected', 'false');
                buttons[tabName].setAttribute('tabindex', '-1');
            }
        }

        const currentActivePane = document.querySelector('.content-pane.is-active');
        const newActivePane = panes[targetTab];
         if (currentActivePane === newActivePane) return;
         if (currentActivePane) {
            currentActivePane.classList.remove('is-active');
        }

        setTimeout(() => {
            if (currentActivePane) currentActivePane.classList.add('hidden');
            newActivePane.classList.remove('hidden');
            newActivePane.classList.add('is-active');

            // 탭 전환 시 헤더 표시
            const header = document.getElementById('main-header');
            if (header) {
                header.classList.remove('header-hidden');
            }
        }, 300);
    }
     function createAvatar(className, label, ariaLabel) {
        const avatar = document.createElement('div');
        avatar.className = className;
        avatar.textContent = label;
        avatar.setAttribute('role', 'img');
        avatar.setAttribute('aria-label', ariaLabel);
        return avatar;
    }
     function createInlineImage(inlineData) {
        const mimeType = /^image\/(png|jpeg|jpg|gif|webp)$/i.test(inlineData.mimeType)
            ? inlineData.mimeType
            : 'image/png';
        const imageData = String(inlineData.data || '').replace(/\s/g, '');
        const img = document.createElement('img');
        img.src = `data:${mimeType};base64,${imageData}`;
        img.className = 'rounded-lg mt-2 w-full h-auto';
        img.loading = 'lazy';
        img.alt = uploadedFile.name ? `업로드된 이미지: ${uploadedFile.name}` : '이미지 첨부';
        return img;
    }
     function appendTextPart(container, text) {
        if (text.includes('---PDF 시작---')) {
            const preview = document.createElement('div');
            preview.className = 'text-xs bg-slate-100 p-2 rounded-md mt-2 max-h-40 overflow-y-auto border';
             const pre = document.createElement('pre');
            pre.className = 'whitespace-pre-wrap font-sans';
            pre.textContent = text;
            preview.appendChild(pre);
            container.appendChild(preview);
            return;
        }
         const paragraph = document.createElement('p');
        paragraph.className = 'whitespace-pre-wrap';
        paragraph.textContent = text;
        container.appendChild(paragraph);
    }
     function addChatMessage(sender, parts) {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-start gap-3 message-bubble';
         const bubble = document.createElement('div');
        if (sender === 'user') {
            wrapper.classList.add('justify-end');
            bubble.className = 'bg-blue-500 text-white rounded-2xl rounded-tr-none p-3.5 text-sm shadow-md max-w-lg';
            parts.forEach(part => {
                if (part.text) appendTextPart(bubble, part.text);
                if (part.inlineData) bubble.appendChild(createInlineImage(part.inlineData));
            });
            wrapper.appendChild(bubble);
            wrapper.appendChild(createAvatar(
                'w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-md',
                '나',
                '사용자 아바타'
            ));
        } else {
            wrapper.classList.add('max-w-lg');
            bubble.className = 'bg-white/80 rounded-2xl rounded-tl-none p-3.5 text-sm text-slate-800 shadow-sm';
            parts.forEach(part => {
                if (part.text) appendTextPart(bubble, part.text);
                if (part.inlineData) bubble.appendChild(createInlineImage(part.inlineData));
            });
            wrapper.appendChild(createAvatar(
                'w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-md',
                'AI',
                'AI 아바타'
            ));
            wrapper.appendChild(bubble);
        }
        chatMessages.appendChild(wrapper);

        // 부드러운 스크롤 애니메이션으로 맨 아래로
        requestAnimationFrame(() => {
            wrapper.scrollIntoView({ behavior: 'smooth', block: 'end' });
        });
    }

    function toggleChatLoading(show) {
        let loadingEl = document.getElementById('loading-indicator');
        if (show) {
            if (!loadingEl) {
                loadingEl = document.createElement('div');
                loadingEl.id = 'loading-indicator';
                loadingEl.className = 'flex items-start gap-3 max-w-lg message-bubble';
                loadingEl.innerHTML = `
                    <div class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-md">AI</div>
                    <div class="bg-white/80 rounded-2xl rounded-tl-none p-3.5 text-sm text-slate-800 shadow-sm">
                        <div class="flex items-center space-x-1">
                            <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse loading-delay-1"></div>
                            <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse loading-delay-2"></div>
                        </div>
                    </div>
                `;
                chatMessages.appendChild(loadingEl);
                requestAnimationFrame(() => {
                    loadingEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
                });
            }
        } else {
            if (loadingEl) {
                loadingEl.remove();
            }
        }
    }

    async function handleSendMessage() {
        const message = chatInput.value.trim();
        if (!message && !uploadedFile.type) return;
         sendButton.disabled = true;
        toggleChatLoading(true);

        // 모바일에서 키보드 포커스 유지
        const isMobile = window.innerWidth <= 640;
        if (isMobile) {
            chatInput.setAttribute('readonly', 'readonly');
        }
         const userParts = [];
         if (uploadedFile.type === 'image') {
            userParts.push({ inlineData: { mimeType: uploadedFile.mimeType, data: uploadedFile.data.split(',')[1] } });
        } else if (uploadedFile.type === 'pdf') {
            try {
                const pdfText = await extractTextFromPdf(uploadedFile.data);
                userParts.push({ text: `[첨부된 PDF 파일 '${uploadedFile.name}'의 내용입니다. 이 내용을 바탕으로 답변해주세요.]:\n\n---PDF 시작---\n${pdfText}\n---PDF 끝---` });
            } catch (error) {
                addChatMessage('bot', [{ text: `PDF 파일을 읽는 중 오류가 발생했습니다: ${error.message}` }]);
                toggleChatLoading(false);
                sendButton.disabled = false;
                return;
            }
        }

        if (message) {
            const existingTextPart = userParts.find(p => p.text);
            if (existingTextPart) {
                existingTextPart.text += `\n\n[사용자 추가 메시지]: ${message}`;
            } else {
                userParts.push({ text: message });
            }
        }
         const initialMessage = document.getElementById('initial-message');
        if(initialMessage) initialMessage.remove();
         addChatMessage('user', userParts);
        chatInput.value = '';
        removePreview();

        // 모바일에서 전송 버튼에 진동 피드백 (지원하는 경우)
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(10);
        }

        chatHistory.push({ role: "user", parts: userParts });

        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatHistory: chatHistory,
                    model: 'gemini',
                    persona: currentPersona,
                    sessionId: sessionId // 세션 ID 추가
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = errorText;
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.message || JSON.stringify(errorData);
                } catch (e) { /* Ignore */ }
                throw new Error(errorMessage);
            }

            const result = await response.json();

            if (result.candidates && result.candidates.length > 0) {
                const botParts = result.candidates[0].content.parts;
                chatHistory.push(result.candidates[0].content);
                addChatMessage('bot', botParts);
            } else { throw new Error('응답을 받았지만 내용이 비어있습니다.'); }

        } catch (error) {
            let errorMessage = '오류가 발생했습니다';
            let fallbackMessage = '';
            let errorType = 'unknown';

            // 네트워크 연결 확인
            if (!navigator.onLine) {
                errorType = 'network';
                errorMessage = '🌐 네트워크 연결 오류';
                fallbackMessage = '인터넷 연결을 확인해주세요.';
            }
            // API 응답 에러
            else if (error.message.includes('429')) {
                errorType = 'rateLimit';
                errorMessage = '⏱️ 요청 한도 초과';
                fallbackMessage = '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.';
            } else if (error.message.includes('401') || error.message.includes('403')) {
                errorType = 'auth';
                errorMessage = '🔐 인증 오류';
                fallbackMessage = 'API 인증에 실패했습니다. 관리자에게 문의하세요.';
            } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
                errorType = 'server';
                errorMessage = '🖥️ 서버 오류';
                fallbackMessage = '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
            } else if (error.message.includes('timeout')) {
                errorType = 'timeout';
                errorMessage = '⏳ 요청 시간 초과';
                fallbackMessage = '응답 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.';
            } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorType = 'network';
                errorMessage = '🌐 네트워크 요청 실패';
                fallbackMessage = '서버에 연결할 수 없습니다. 네트워크 설정을 확인해주세요.';
            } else {
                errorType = 'general';
                fallbackMessage = error.message || '알 수 없는 오류가 발생했습니다.';
            }

            // 에러 로깅 (개발 환경에서만)
            if (isDev) {
                console.error(`Error Type: ${errorType}`, error);
            }

            addChatMessage('bot', [{
                text: `${errorMessage}\n\n${fallbackMessage}\n\n문제가 지속되면 페이지를 새로고침해주세요.`
            }]);
        } finally {
            toggleChatLoading(false);
            sendButton.disabled = false;

            // 모바일에서 키보드 포커스 처리
            const isMobile = window.innerWidth <= 640;
            if (isMobile) {
                chatInput.removeAttribute('readonly');
                // 약간의 지연 후 포커스와 스크롤
                setTimeout(() => {
                    chatInput.focus();
                    // 최신 메시지가 보이도록 스크롤
                    const lastMessage = chatMessages.lastElementChild;
                    if (lastMessage) {
                        lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    }
                }, 100);
            } else {
                chatInput.focus();
            }
        }
    }

    async function handleGenerateImage() {
        const prompt = imagePrompt.value.trim();
        if (!prompt) { return; }

        generateImageButton.disabled = true;
        imagePlaceholder.classList.add('opacity-0');
        generatedImage.classList.add('hidden');
        imageLoader.classList.remove('hidden');

        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatHistory: prompt, model: 'gemini-image', sessionId: sessionId })
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = errorText;
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.message || JSON.stringify(errorData);
                } catch (e) { /* Ignore */ }
                throw new Error(errorMessage);
            }

            const result = await response.json();
             const candidate = result?.candidates?.[0];
            const imagePart = candidate?.content?.parts?.find(part => part.inlineData);
            const imageData = imagePart?.inlineData?.data;
            const mimeType = imagePart?.inlineData?.mimeType || 'image/png';
             if (imageData) {
                const imageUrl = `data:${mimeType};base64,${imageData}`;
                generatedImage.src = imageUrl;
                generatedImage.classList.remove('hidden');
            } else {
                throw new Error('API 응답에서 이미지 데이터를 찾을 수 없습니다.');
            }

        } catch (error) {
            console.error('Image Generation Error:', error);
            const errorContainer = document.createElement('div');
            errorContainer.className = 'text-red-500 text-sm p-4 text-center';

            if (error.message.includes('429') || error.message.includes('한도')) {
                errorContainer.append('요청 한도를 초과했습니다.');
                errorContainer.appendChild(document.createElement('br'));
                errorContainer.append('잠시 후 다시 시도해주세요.');
            } else if (!navigator.onLine) {
                errorContainer.textContent = '인터넷 연결을 확인해주세요.';
            } else {
                errorContainer.append('이미지 생성 중 오류가 발생했습니다.');
                errorContainer.appendChild(document.createElement('br'));
                errorContainer.append(error.message);
            }

            const reloadButton = document.createElement('button');
            reloadButton.type = 'button';
            reloadButton.className = 'mt-2 text-blue-500 underline';
            reloadButton.textContent = '페이지 새로고침';
            reloadButton.addEventListener('click', () => location.reload());
            errorContainer.appendChild(document.createElement('br'));
            errorContainer.appendChild(reloadButton);
            imagePlaceholder.replaceChildren(errorContainer);
            imagePlaceholder.classList.remove('opacity-0');
        } finally {
            imageLoader.classList.add('hidden');
            generateImageButton.disabled = false;
        }
    }
     async function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
         removePreview();
         // 파일 크기 제한 (10MB)
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxFileSize) {
            alert(`파일 크기는 10MB를 초과할 수 없습니다. 현재 파일 크기: ${formatFileSize(file.size)}`);
            fileInput.value = '';
            return;
        }
         if (file.type.startsWith('image/')) {
            try {
                // 파일 크기가 1MB를 초과하면 압축
                if (file.size > 1024 * 1024) {
                    const compressed = await compressImage(file);
                    uploadedFile = {
                        type: 'image',
                        data: compressed.dataUrl,
                        mimeType: file.type,
                        name: file.name,
                        originalSize: file.size,
                        compressedSize: compressed.blob.size
                    };
                    previewImage.src = compressed.dataUrl;
                    previewFilename.textContent = file.name;
                    // 압축률 표시
                    const compressionRate = Math.round((1 - compressed.blob.size / file.size) * 100);
                    previewFilesize.textContent = `(${formatFileSize(compressed.blob.size)} - ${compressionRate}% 압축됨)`;
                } else {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        uploadedFile = {
                            type: 'image',
                            data: e.target.result,
                            mimeType: file.type,
                            name: file.name,
                            originalSize: file.size
                        };
                        previewImage.src = e.target.result;
                        previewFilename.textContent = file.name;
                        previewFilesize.textContent = `(${formatFileSize(file.size)})`;
                        previewImage.classList.remove('hidden');
                        previewPdfIcon.classList.add('hidden');
                        filePreviewContainer.classList.add('visible');
                    };
                    reader.readAsDataURL(file);
                    return;
                }
                previewImage.classList.remove('hidden');
                previewPdfIcon.classList.add('hidden');
                filePreviewContainer.classList.add('visible');
            } catch (error) {
                console.error('이미지 압축 실패:', error);
                addChatMessage('bot', [{ text: '이미지 처리 중 오류가 발생했습니다.' }]);
            }
        } else if (file.type === 'application/pdf') {
            uploadedFile = { type: 'pdf', data: file, name: file.name };
            previewFilename.textContent = file.name;
            previewFilesize.textContent = `(${formatFileSize(file.size)})`;
            previewImage.classList.add('hidden');
            previewPdfIcon.classList.remove('hidden');
            filePreviewContainer.classList.add('visible');
        }
    }
     function removePreview() {
        uploadedFile = { type: null, data: null, name: null };
        fileInput.value = '';
        filePreviewContainer.classList.remove('visible');
    }
     async function extractTextFromPdf(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n\n';
        }
        return fullText;
    }
     function openSettings() {
        personaInput.value = currentPersona;
        settingsModal.classList.remove('hidden');
    }
     function closeSettings() {
        settingsModal.classList.add('hidden');
    }
     function saveSettings() {
        currentPersona = personaInput.value;
        localStorage.setItem('peraPersona', currentPersona);
        closeSettings();
        chatMessages.innerHTML = '';
        chatHistory = [];
        const initialMessageDiv = document.createElement('div');
        initialMessageDiv.id = 'initial-message';
        chatMessages.appendChild(initialMessageDiv);
        // Use i18n if available, otherwise use fallback based on current language
        const message = window.i18n
            ? window.i18n.t('message.personaUpdated')
            : '페르소나가 업데이트되었습니다. 새로운 대화를 시작해보세요!';
        addChatMessage('bot', [{text: message}]);
    }

    // --- Event Listeners ---
    settingsButton.addEventListener('click', openSettings);
    themeToggle.addEventListener('click', toggleTheme);
    closePersonaButton.addEventListener('click', closeSettings);
    savePersonaButton.addEventListener('click', saveSettings);
    chatTabButton.addEventListener('click', () => switchTabs('chat'));
    imageTabButton.addEventListener('click', () => switchTabs('image'));

    // 키보드 네비게이션 지원
    chatTabButton.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
            imageTabButton.focus();
            switchTabs('image');
        }
    });

    imageTabButton.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            chatTabButton.focus();
            switchTabs('chat');
        }
    });

    // 전역 키보드 단축키
    document.addEventListener('keydown', (e) => {
        // Escape 키로 모달 닫기
        if (e.key === 'Escape') {
            if (!settingsModal.classList.contains('hidden')) {
                closeSettings();
            }
        }


        // Ctrl/Cmd + / 로 채팅 입력에 포커스
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            e.preventDefault();
            if (chatUi.classList.contains('is-active')) {
                chatInput.focus();
            } else if (imageUi.classList.contains('is-active')) {
                imagePrompt.focus();
            }
        }
    });
    fileButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    removePreviewButton.addEventListener('click', removePreview);
    sendButton.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    });
    generateImageButton.addEventListener('click', handleGenerateImage);
    imagePrompt.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            handleGenerateImage();
        }
    });

    // 모바일 최적화 초기화
    if ('ontouchstart' in window) {
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });

        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        });

        // 모바일 키보드 대응
        handleMobileKeyboard();
        detectVirtualKeyboard();
        initHeaderScroll();
    }

    // 화면 회전 감지
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            if (chatMessages) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }, 100);
    });

});
