// Polish-English Vocabulary Learning App
// Debug logs for AI image generation (set to false or comment out to disable)
const AI_IMAGE_DEBUG = true; // <-- toggle this flag to enable/disable image debug logs easily
const AI_IMAGE_MIN_DIM = 256; // Pollinations/Flux require >= 256 for width/height
function AI_IMG_DBG(...args) {
    try {
        if (AI_IMAGE_DEBUG) console.log('[AI-IMG]', ...args);
    } catch (_) {}
}
class VocabularyApp {
    // Renderuje przykłady dla obecnego słowa albo linki wyszukiwania
    renderExamplesForCurrentWord() {
        const examplesContainer = document.getElementById('examples-container');
        if (!examplesContainer) return;

        const word = this.currentStudySet[this.currentWordIndex];
        if (!word) return;

        // Jeśli mamy examples z AI (JSON), pokaż je
        if (Array.isArray(word.examples) && word.examples.length > 0) {
            examplesContainer.innerHTML = '';
            word.examples.slice(0, 2).forEach(ex => {
                const item = document.createElement('div');
                item.className = 'example-item';
                const link = ex.url ? `<a href="${ex.url}" target="_blank" rel="noopener">${ex.source || ex.url}</a>` : '';
                const quote = ex.text || ex.quote || '';
                item.innerHTML = `${quote} ${link ? '— ' + link : ''}`;
                examplesContainer.appendChild(item);
            });
            return;
        }

        // W przeciwnym razie pokaż szybkie linki do wyszukiwarki przykładów
        const q = encodeURIComponent(word.english || '');
        const links = [
            { name: 'Tatoeba', url: `https://tatoeba.org/en/sentences/search?from=eng&to=pol&query=${q}` },
            { name: 'Linguee', url: `https://www.linguee.com/english-polish/search?source=english&query=${q}` },
            { name: 'Reverso', url: `https://context.reverso.net/translation/english-polish/${q}` },
            { name: 'YouGlish', url: `https://youglish.com/pronounce/${q}/english` },
            { name: 'Wiktionary', url: `https://en.wiktionary.org/wiki/${q}` }
        ];
        examplesContainer.innerHTML = links.map(l => 
            `<div class="example-item">🔎 <a href="${l.url}" target="_blank" rel="noopener">${l.name}</a></div>`
        ).join('');
    }

    toggleExamples() {
        this.examplesExpanded = !this.examplesExpanded;
        const examplesContainer = document.getElementById('examples-container');
        const toggleBtn = document.getElementById('toggle-examples');
        if (!examplesContainer || !toggleBtn) return;
        if (this.examplesExpanded) {
            examplesContainer.classList.add('active');
            examplesContainer.setAttribute('aria-hidden', 'false');
            toggleBtn.textContent = '📖 Ukryj przykłady';
            // Załaduj zawartość
            this.renderExamplesForCurrentWord();
        } else {
            toggleBtn.textContent = '📖 Pokaż przykłady';
            examplesContainer.classList.remove('active');
            examplesContainer.setAttribute('aria-hidden', 'true');
            examplesContainer.innerHTML = '';
        }
    }
    constructor() {
        this.imagePromptCache = {};
        this.imageUrlCache = {}; // cache resolved image URLs per word
        this._prefetchTimer = null;
        this._prefetchInFlight = new Set();
        this._imageRetryTimers = {};
        this._nextWordTimer = null; // ensure only one nextWord timer at a time
        this._answerLocked = false; // prevent double answer handling in typing mode
        this.words = [];
        this.currentStudySet = [];
        this.currentWordIndex = 0;
        this.currentMode = '';
        this.selectedMatches = {};
        this.examplesExpanded = false;
        this.userInteracted = false;
        this._forceFirstListeningSpeak = false;
        this.stats = {
            totalWords: 0,
            learnedWords: 0,
            dueWords: 0,
            successRate: 0,
            totalAttempts: 0,
            correctAttempts: 0
        };
        // ZMIANA: Dodano 'huggingface' jako dostawcę AI
        this.settings = {
            firstInterval: 1,
            secondInterval: 7,
            dailyGoal: 10,
            languageLevel: 'B1',
            infiniteLearning: true,
            autoAddWords: true,
            aiProvider: 'free', // 'openai', 'anthropic', 'gemini', 'huggingface'
            aiApiKey: '',
            aiModel: 'mymemory', // Domyślny model dla Hugging Face
            enableAIRecommendations: true,
            adaptiveDifficulty: true,
            enableImagen: true,
            aiImageProvider: 'free',
            // Base URL for local proxy that calls Google APIs server-side to avoid CORS and hide API keys
            proxyBaseUrl: '',
            autoFlipEnabled: false,
            autoFlipDelay: 3,
            // enableDikiVerification: true, // (removed) weryfikacja DIKI nieużywana
            enableAISelfCheck: true, // Samokontrola tłumaczenia przez AI
            flashcardAnimMs: 1000
        };
        
        // AI word generation - rozszerzone kategorie + dynamiczne
        this.baseCategories = [
            'dom', 'praca', 'jedzenie', 'transport', 'natura', 'technologia', 'sport', 'kultura',
            'zdrowie', 'edukacja', 'rodzina', 'emocje', 'czas', 'pogoda', 'hobby', 'zakupy',
            'podróże', 'ubrania', 'ciało', 'kolory', 'liczby', 'kierunki', 'muzyka', 'sztuka',
            'zwierzęta', 'rośliny', 'narzędzia', 'materiały', 'komunikacja', 'społeczeństwo'
        ];
        this.dynamicCategories = []; // Kategorie generowane przez AI
        this.wordCategories = [...this.baseCategories]; // Połączone kategorie
        this.currentCategory = 0;
        this.isGeneratingWords = false;
        this.categoryUsageStats = {}; // Statystyki użycia kategorii
        
        // AI learning analytics
        this.learningPatterns = {
            difficultWords: [],
            preferredCategories: [],
            learningSpeed: 'medium',
            weakAreas: []
        };
        
        this.init();
    }

    // Dodaj to do metody init() w klasie VocabularyApp
    init() {
        this.loadData();
        this.setupEventListeners();
        this.updateStats();
        this.showView('dashboard');
        this.loadDefaultWords();
        
        // Inicjalizacja syntezy mowy dla mobile
        this.initializeSpeechSynthesis();
        
        // Upewnij się, że TTS wznawia się po powrocie do karty (mobilne przeglądarki potrafią pauzować)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && 'speechSynthesis' in window) {
                try { speechSynthesis.resume(); } catch (e) {}
            }
        });
    }
// Dodaj tę metodę do klasy VocabularyApp
removeDuplicates() {
    const uniqueWords = [];
    const seenWords = new Set();
    const before = this.words.length;
    
    this.words.forEach(word => {
        const key = `${word.polish.toLowerCase()}-${word.english.toLowerCase()}`;
        if (!seenWords.has(key)) {
            seenWords.add(key);
            uniqueWords.push(word);
        }
    });
    
    const removed = before - uniqueWords.length;
    this.words = uniqueWords;
    this.saveData();
    this.updateStats();
    console.log(`Usunięto ${removed} duplikatów`);
}
    // Nowa metoda
    initializeSpeechSynthesis() {
        if (!('speechSynthesis' in window)) return;
        // Preload voices
        speechSynthesis.getVoices();
        // Unlock TTS on first user gesture (mobile w/ iOS included)
        const unlock = async () => {
            await this.ensureVoicesLoaded();
            this.unlockTTS();
        };
        ['pointerdown', 'touchstart', 'click'].forEach(evt => {
            document.addEventListener(evt, (e) => {
                this.userInteracted = true;
                unlock();
            }, { once: true, passive: true });
        });
    }

   // TTS helper: ensure voices are loaded on all platforms
   ensureVoicesLoaded() {
       return new Promise((resolve) => {
           try {
               const attemptLoad = (tries = 0) => {
                   const voices = speechSynthesis.getVoices();
                   if ((voices && voices.length > 0) || tries > 25) {
                       resolve(voices || []);
                       return;
                   }
                   setTimeout(() => attemptLoad(tries + 1), 100);
               };
               // Try immediately
               attemptLoad();
               // Also listen to event if it fires
               const handler = () => {
                   speechSynthesis.removeEventListener('voiceschanged', handler);
                   resolve(speechSynthesis.getVoices() || []);
               };
               speechSynthesis.addEventListener('voiceschanged', handler, { once: true });
           } catch (e) {
               resolve([]);
           }
       });
   }

   // Unlock TTS by speaking a silent utterance and preloading voices
   unlockTTS() {
       try {
           if (!('speechSynthesis' in window)) return;
           // Mark as unlocked immediately to avoid re-entry
           this._ttsUnlocked = true;
           // Ensure any pending queues are cleared (some browsers need it)
           try { speechSynthesis.cancel(); } catch (e) {}
           // Speak a very short silent utterance to unlock audio on mobile
           const u = new SpeechSynthesisUtterance(' ');
           u.volume = 0.01;
           u.rate = 1;
           u.pitch = 1;
           u.lang = 'en-US';
           u.onend = () => {
               // No-op, just unlocking
           };
           speechSynthesis.speak(u);
       } catch (e) {
           console.warn('unlockTTS failed', e);
       }
   }

    // Data Management
    loadData() {
        const savedWords = localStorage.getItem('vocabularyWords');
        const savedStats = localStorage.getItem('vocabularyStats');
        const savedSettings = localStorage.getItem('vocabularySettings');
        const savedPatterns = localStorage.getItem('learningPatterns');
        const savedDynamicCategories = localStorage.getItem('dynamicCategories');
        const savedCategoryStats = localStorage.getItem('categoryUsageStats');
        
        if (savedWords) {
            this.words = JSON.parse(savedWords);
        }
        if (savedStats) {
            this.stats = { ...this.stats, ...JSON.parse(savedStats) };
        }
        if (savedSettings) {
            this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        }
        if (savedPatterns) {
            this.learningPatterns = { ...this.learningPatterns, ...JSON.parse(savedPatterns) };
        }
        if (savedDynamicCategories) {
            this.dynamicCategories = JSON.parse(savedDynamicCategories);
            this.wordCategories = [...this.baseCategories, ...this.dynamicCategories];
        }
        if (savedCategoryStats) {
            this.categoryUsageStats = JSON.parse(savedCategoryStats);
        }
    }

    saveData() {
        localStorage.setItem('vocabularyWords', JSON.stringify(this.words));
        localStorage.setItem('vocabularyStats', JSON.stringify(this.stats));
        localStorage.setItem('vocabularySettings', JSON.stringify(this.settings));
        localStorage.setItem('learningPatterns', JSON.stringify(this.learningPatterns));
        localStorage.setItem('dynamicCategories', JSON.stringify(this.dynamicCategories));
        localStorage.setItem('categoryUsageStats', JSON.stringify(this.categoryUsageStats));
    }

    loadDefaultWords() {
        // Sprawdź czy użytkownik ma stare słowa bez obrazków
        const hasOldWords = this.words.some(word => !word.aiGenerated && !word.hasImage);
        
        if (this.words.length === 0 || hasOldWords) {
            if (hasOldWords) {
                console.log('Wykryto stare słowa bez obrazków - resetuję do AI słów...');
                this.words = []; // Wyczyść stare słowa
            }
            // Wygeneruj nowe słowa z AI z obrazkami
            this.generateInitialWords();
        }
    }

    async generateInitialWords() {
        console.log('Generuję początkowe słowa z AI...');
        try {
            // Wygeneruj 10 początkowych słów z różnych kategorii
            const initialWords = await this.getWordsFromAI('dom', this.settings.languageLevel, 5);
            const moreWords = await this.getWordsFromAI('jedzenie', this.settings.languageLevel, 5);
            
            this.words = [...initialWords, ...moreWords];
            this.saveData();
            this.updateStats();
            console.log('Wygenerowano początkowe słowa z AI');
        } catch (error) {
            console.error('Błąd generowania początkowych słów:', error);
            // Fallback - dodaj tylko kilka podstawowych słów jeśli AI nie działa
            this.words = [
                { polish: 'dom', english: 'house', status: 'new', attempts: 0, correct: 0, lastReview: null, nextReview: null, hasImage: true },
                { polish: 'kot', english: 'cat', status: 'new', attempts: 0, correct: 0, lastReview: null, nextReview: null, hasImage: true },
                { polish: 'woda', english: 'water', status: 'new', attempts: 0, correct: 0, lastReview: null, nextReview: null, hasImage: true }
            ];
            this.saveData();
        }
    }

    // Event Listeners
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                this.showView(view);
            });
        });

        // Study mode selection
        document.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.userInteracted = true;
                if (e.currentTarget.dataset.mode === 'listening') {
                    this._forceFirstListeningSpeak = true;
                }
                const mode = e.currentTarget.dataset.mode;
                this.startStudyMode(mode);
            });
        });

        // Back button
        document.getElementById('back-btn').addEventListener('click', () => {
            this.userInteracted = true;
            this.showView('dashboard');
        });

        // Flashcards
        // Debounce quick successive taps on the flip button to avoid double-toggle on mobile
this._lastFlipBtnClick = 0;
document.querySelector('.flip-btn').addEventListener('click', (e) => {
            const now = Date.now();
            if (now - this._lastFlipBtnClick < 350) {
                // ignore rapid second tap
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            this._lastFlipBtnClick = now;
            this.userInteracted = true;
            this.flipCard();
        }, { passive: false });

        // Przykłady (fiszki)
        const toggleBtn = document.getElementById('toggle-examples');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleExamples());
        }

        document.querySelector('.btn-wrong').addEventListener('click', () => {
            if (this.currentMode === 'flashcards') {
                this.animateFlashcardFadeOut();
                setTimeout(() => this.recordAnswer(false), this.settings.flashcardAnimMs);
            } else {
                this.recordAnswer(false);
            }
        });

        document.querySelector('.btn-correct').addEventListener('click', () => {
            if (this.currentMode === 'flashcards') {
                this.animateFlashcardFadeOut();
                setTimeout(() => this.recordAnswer(true), this.settings.flashcardAnimMs);
            } else {
                this.recordAnswer(true);
            }
        });

        // Gesture controls dla fiszek
        this.setupFlashcardGestures();
        
        // Keyboard controls dla fiszek
        this.setupFlashcardKeyboard();

        // Typing mode
        document.getElementById('check-answer').addEventListener('click', () => {
            this.userInteracted = true;
            this.checkTypingAnswer();
        });

        document.getElementById('answer-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkTypingAnswer();
            }
        });

        // Listening mode
        document.getElementById('play-audio').addEventListener('click', () => {
            this.userInteracted = true;
            this.playAudio();
        });

        document.getElementById('check-listening').addEventListener('click', () => {
            this.userInteracted = true;
            this.checkListeningAnswer();
        });

        document.getElementById('listening-input').addEventListener('keypress', (e) => {
            this.userInteracted = true;
            if (e.key === 'Enter') {
                this.checkListeningAnswer();
            }
        });

        document.getElementById('listening-input').addEventListener('keydown', (e) => {
            this.userInteracted = true;
            if (e.key === ' ' && e.target.value === '') {
                e.preventDefault(); // Zapobiega dodaniu spacji do pola
                this.playAudio();
            }
        });

        // Match mode
        document.getElementById('check-matches').addEventListener('click', () => {
            this.checkMatches();
        });

        // Settings
        document.getElementById('import-btn').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });

        document.getElementById('import-file').addEventListener('change', (e) => {
            this.importWords(e.target.files[0]);
        });

        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportWords();
        });

        document.getElementById('reset-progress').addEventListener('click', () => {
            this.resetProgress();
        });

        document.getElementById('reset-all').addEventListener('click', () => {
            this.resetAll();
        });

        // Settings changes
        document.getElementById('first-interval').addEventListener('change', (e) => {
            this.settings.firstInterval = parseInt(e.target.value);
            this.saveData();
        });

        document.getElementById('second-interval').addEventListener('change', (e) => {
            this.settings.secondInterval = parseInt(e.target.value);
            this.saveData();
        });

        document.getElementById('daily-goal').addEventListener('change', (e) => {
            this.settings.dailyGoal = parseInt(e.target.value);
            this.saveData();
        });

        document.getElementById('language-level').addEventListener('change', (e) => {
            this.settings.languageLevel = e.target.value;
            this.saveData();
        });

        document.getElementById('infinite-learning').addEventListener('change', (e) => {
            this.settings.infiniteLearning = e.target.checked;
            this.saveData();
        });

        document.getElementById('auto-add-words').addEventListener('change', (e) => {
            this.settings.autoAddWords = e.target.checked;
            this.saveData();
        });

        // Auto-flip settings
        document.getElementById('auto-flip-enabled').addEventListener('change', (e) => {
            this.settings.autoFlipEnabled = e.target.checked;
            this.saveData();
            if (this.currentMode === 'flashcards') {
                this.setupAutoFlip(); // Restart auto-flip z nowymi ustawieniami
            }
        });

        document.getElementById('auto-flip-delay').addEventListener('change', (e) => {
            this.settings.autoFlipDelay = parseInt(e.target.value);
            this.saveData();
            if (this.currentMode === 'flashcards') {
                this.setupAutoFlip(); // Restart auto-flip z nowymi ustawieniami
            }
        });

        document.getElementById('generate-words').addEventListener('click', () => {
            this.generateNewWords();
        });

        // Flashcard animation speed
       const animSpeedInput = document.getElementById('flashcard-anim-speed');
       const animSpeedValue = document.getElementById('flashcard-anim-speed-value');
       if (animSpeedInput && animSpeedValue) {
           const updateAnimLabel = (val) => animSpeedValue.textContent = `${val} ms`;
           updateAnimLabel(this.settings.flashcardAnimMs);
           animSpeedInput.addEventListener('input', (e) => {
               updateAnimLabel(e.target.value);
           });
           animSpeedInput.addEventListener('change', (e) => {
               this.settings.flashcardAnimMs = parseInt(e.target.value);
               updateAnimLabel(this.settings.flashcardAnimMs);
               this.saveData();
           });
       }

       // AI settings
       document.getElementById('ai-provider').addEventListener('change', (e) => {
            this.settings.aiProvider = e.target.value;
            this.updateAIModelOptions();
            this.updateApiKeyFieldState();
            this.saveData();
        });

        document.getElementById('ai-api-key').addEventListener('change', (e) => {
            this.settings.aiApiKey = e.target.value;
            this.saveData();
        });

        document.getElementById('ai-model').addEventListener('change', (e) => {
            this.settings.aiModel = e.target.value;
            this.saveData();
        });

        document.getElementById('enable-ai-recommendations').addEventListener('change', (e) => {
            this.settings.enableAIRecommendations = e.target.checked;
            this.saveData();
        });

        document.getElementById('adaptive-difficulty').addEventListener('change', (e) => {
            this.settings.adaptiveDifficulty = e.target.checked;
            this.saveData();
        });

        document.getElementById('enable-imagen').addEventListener('change', (e) => {
            this.settings.enableImagen = e.target.checked;
            this.saveData();
        });

        

        // Proxy base URL setting
        const proxyInput = document.getElementById('proxy-base-url');
        if (proxyInput) {
            proxyInput.value = this.settings.proxyBaseUrl || '';
            proxyInput.addEventListener('change', (e) => {
                this.settings.proxyBaseUrl = e.target.value.trim();
                this.saveData();
            });
        }

        document.getElementById('test-ai-connection').addEventListener('click', () => {
            this.testAIConnection();
        });

        // Obsługa zmiany rozmiaru okna dla responsywnego canvas
        window.addEventListener('resize', () => {
            if (document.getElementById('progress-view').classList.contains('active')) {
                // Opóźnij przerysowanie aby uniknąć zbyt częstego odświeżania
                clearTimeout(this.resizeTimeout);
                this.resizeTimeout = setTimeout(() => {
                    this.renderProgressChart();
                }, 250);
            }
        });
    }

    // View Management
    showView(viewName) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        document.getElementById(`${viewName}-view`).classList.add('active');
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

        if (viewName === 'dashboard') {
            this.updateStats();
        } else if (viewName === 'progress') {
            this.showProgress();
        } else if (viewName === 'settings') {
            this.loadSettings();
        }
    }

    // Study Mode Management
    async startStudyMode(mode) {
        this.currentMode = mode;
        await this.prepareStudySet();
        this.currentWordIndex = 0;
        
        if (this.currentStudySet.length === 0) {
            alert('Brak słów do nauki! Dodaj więcej słów lub zresetuj postępy.');
            return;
        }

        this.showView('study');
        this.showStudyMode(mode);
        this.loadCurrentWord();
    }

    async prepareStudySet() {
        const now = new Date();
        
        // Get words that need review or are new
        this.currentStudySet = this.words.filter(word => {
            if (word.status === 'new') return true;
            if (word.nextReview && new Date(word.nextReview) <= now) return true;
            return false;
        });

        // Check if we need more words for infinite learning
        if (this.settings.infiniteLearning && this.settings.autoAddWords) {
            const newWords = this.currentStudySet.filter(w => w.status === 'new');
            if (newWords.length < this.settings.dailyGoal) {
                await this.generateNewWords(this.settings.dailyGoal - newWords.length);
                // Refresh the study set after adding new words
                this.currentStudySet = this.words.filter(word => {
                    if (word.status === 'new') return true;
                    if (word.nextReview && new Date(word.nextReview) <= now) return true;
                    return false;
                });
            }
        }

        // Shuffle the set
        this.currentStudySet = this.shuffleArray(this.currentStudySet);
        
        // Limit to daily goal for new words
        const newWords = this.currentStudySet.filter(w => w.status === 'new');
        const reviewWords = this.currentStudySet.filter(w => w.status !== 'new');
        
        if (newWords.length > this.settings.dailyGoal) {
            this.currentStudySet = [...reviewWords, ...newWords.slice(0, this.settings.dailyGoal)];
        }
    }

    showStudyMode(mode) {
        document.querySelectorAll('.study-mode').forEach(el => {
            el.classList.remove('active');
        });
        document.getElementById(`${mode}-mode`).classList.add('active');
    }

    loadCurrentWord() {
        if (this.currentWordIndex >= this.currentStudySet.length) {
            this.finishStudySession();
            return;
        }

        const word = this.currentStudySet[this.currentWordIndex];
        this.updateProgress();

        switch (this.currentMode) {
            case 'flashcards':
                this.loadFlashcard(word);
                break;
            case 'typing':
                this.loadTyping(word);
                break;
            case 'match':
                this.loadMatch();
                break;
            case 'listening':
                this.loadListening(word);
                break;
        }
    }

    // Flashcards Mode
    loadFlashcard(word) {
        // Zresetuj stan przycisku i panelu przykładów
        const toggleBtn = document.getElementById('toggle-examples');
        const examplesContainer = document.getElementById('examples-container');
        if (toggleBtn && examplesContainer) {
            this.examplesExpanded = false;
            toggleBtn.textContent = '📖 Pokaż przykłady';
            examplesContainer.classList.remove('active');
            examplesContainer.setAttribute('aria-hidden', 'true');
            examplesContainer.innerHTML = '';
        }

        const flashcard = document.getElementById('flashcard');
        const frontWord = document.getElementById('front-word');
        const backWord = document.getElementById('back-word');
        const wordImage = document.getElementById('word-image');

        // Hard reset to avoid back-face flash on new card
        const frontFace = flashcard.querySelector('.card-front');
        const backFace = flashcard.querySelector('.card-back');

        // Disable transitions and ensure front-facing immediately
        flashcard.classList.add('no-anim');
        if (frontFace) frontFace.style.transition = 'none';
        if (backFace) backFace.style.transition = 'none';
        flashcard.style.transition = 'none';

        // Ensure base visual state and show front
        flashcard.classList.remove('flipped');
        if (frontFace) frontFace.style.transform = 'rotateY(0deg)';
        if (backFace) backFace.style.transform = 'rotateY(180deg)';

        // Force reflow so browser applies the above instantly
        void flashcard.offsetWidth;

        // Re-enable animations in the next frames
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (frontFace) frontFace.style.transition = '';
                if (backFace) backFace.style.transition = '';
                flashcard.style.transition = '';
                if (frontFace) frontFace.style.transform = '';
                if (backFace) backFace.style.transform = '';
                flashcard.classList.remove('no-anim');
            });
        });

        // Reset visual state in case previous card slid out
        flashcard.style.transition = '';
        flashcard.style.transform = 'translateX(0) rotate(0deg)';
        flashcard.style.opacity = '1';
        flashcard.style.borderColor = 'transparent';

        // Trigger gentle appear animation for new word
        flashcard.classList.remove('appear');
        // next frame to restart CSS animation reliably
        requestAnimationFrame(() => {
            flashcard.classList.add('appear');
            // remove the class after animation ends to keep DOM clean
            setTimeout(() => flashcard.classList.remove('appear'), 300);
        });
        flashcard.classList.remove('flipped');
        frontWord.textContent = word.polish;
        backWord.textContent = word.english;
        // Reset stanu ręcznego obrotu dla nowej fiszki
        this.userFlippedCurrent = false;
        
        // Dodaj kolorową ramkę na podstawie trudności słowa
        this.setDifficultyBorder(flashcard, word);
        
        this.loadWordImage(wordImage, word.english, word.polish);
        // Prefetch next images to speed up navigation
        this.prefetchNextImages(3);
        
        // Auto-flip jeśli włączony
        this.setupAutoFlip();
    }

    setDifficultyBorder(flashcard, word) {
        // Usuń poprzednie klasy trudności
        flashcard.classList.remove('difficulty-easy', 'difficulty-medium', 'difficulty-hard');
        
        // Oblicz trudność na podstawie statystyk słowa
        const accuracy = word.attempts > 0 ? (word.correct / word.attempts) : 1;
        let difficultyClass = 'difficulty-easy';
        
        if (word.attempts === 0) {
            difficultyClass = 'difficulty-medium'; // Nowe słowa - żółte
        } else if (accuracy >= 0.8) {
            difficultyClass = 'difficulty-easy'; // Łatwe - zielone
        } else if (accuracy >= 0.5) {
            difficultyClass = 'difficulty-medium'; // Średnie - żółte
        } else {
            difficultyClass = 'difficulty-hard'; // Trudne - czerwone
        }
        
        flashcard.classList.add(difficultyClass);
    }

    flipCard() {
        this.userFlippedCurrent = true;
        document.getElementById('flashcard').classList.toggle('flipped');
    }

    setupAutoFlip() {
        // Wyczyść poprzedni timer
        if (this.autoFlipTimer) {
            clearTimeout(this.autoFlipTimer);
        }

        if (this.settings.autoFlipEnabled && this.currentMode === 'flashcards') {
            const flashcard = document.getElementById('flashcard');
            
            // Jeśli karta nie jest przewrócona, ustaw timer
            if (!flashcard.classList.contains('flipped')) {
                this.autoFlipTimer = setTimeout(() => {
                    // Auto-obrót tylko jeśli karta wciąż nieprzewrócona i użytkownik jej nie obrócił ręcznie
                    if (!this.userFlippedCurrent) {
                        this.flipCard();
                        this.showAutoFlipIndicator();
                    }
                }, this.settings.autoFlipDelay * 1000);
            }
        }
    }

    showAutoFlipIndicator() {
        // Pokaż subtelną animację że karta została automatycznie przewrócona
        const flashcard = document.getElementById('flashcard');
        flashcard.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.5)';
        
        setTimeout(() => {
            flashcard.style.boxShadow = '';
        }, 1000);
    }

    // Typing Mode
    loadTyping(word) {
        // Reset any pending next-word timer when a new word loads
        if (this._nextWordTimer) {
            clearTimeout(this._nextWordTimer);
            this._nextWordTimer = null;
        }
        this._answerLocked = false;
        const polishWord = document.getElementById('polish-word');
        const answerInput = document.getElementById('answer-input');
        const feedback = document.getElementById('feedback');
        const typingImage = document.getElementById('typing-image');

        polishWord.textContent = word.polish;
        answerInput.value = '';
        feedback.textContent = '';
        feedback.className = 'feedback';
        
        this.loadWordImage(typingImage, word.english, word.polish);
        answerInput.focus();
    }

    checkTypingAnswer() {
        if (this._answerLocked) return;
        this._answerLocked = true;

        // Hide mobile keyboard by removing focus from the input
        const answerInputEl = document.getElementById('answer-input');
        if (answerInputEl && typeof answerInputEl.blur === 'function') {
            answerInputEl.blur();
        }

        const word = this.currentStudySet[this.currentWordIndex];
        const userAnswer = document.getElementById('answer-input').value.trim().toLowerCase();
        const correctAnswer = word.english.toLowerCase();
        const feedback = document.getElementById('feedback');

        const isCorrect = userAnswer === correctAnswer;
        
        if (isCorrect) {
            feedback.textContent = 'Świetnie! Poprawna odpowiedź.';
            feedback.className = 'feedback correct';
        } else {
            feedback.textContent = `Niepoprawnie. Prawidłowa odpowiedź to: ${word.english}`;
            feedback.className = 'feedback incorrect';
        }

        // After keyboard hides, ensure feedback is visible
        setTimeout(() => {
            if (typeof feedback.scrollIntoView === 'function') {
                feedback.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 50);

        this.recordAnswer(isCorrect);
    }

    // Listening Mode
    loadListening(word) {
        const listeningInput = document.getElementById('listening-input');
        const feedback = document.getElementById('listening-feedback');
        const listeningImage = document.getElementById('listening-image');
        const audio = document.getElementById('word-audio');

        listeningInput.value = '';
        feedback.textContent = '';
        feedback.className = 'feedback';
        
        this.loadWordImage(listeningImage, word.english, word.polish);
        
        // Generate speech synthesis for the English word
        audio.src = this.generateAudioURL(word.english);
        
        // Show mobile-specific instruction
        const audioBtn = document.getElementById('play-audio');
        if (this.isMobileDevice()) {
            audioBtn.textContent = '🔊 Dotknij aby usłyszeć';
            // Zaplanuj JEDNO automatyczne odtworzenie (unikaj podwójnego echa)
            let shouldAutoSpeak = false;
            if (this._forceFirstListeningSpeak) {
                this._forceFirstListeningSpeak = false;
                shouldAutoSpeak = true;
            } else if (this.userInteracted) {
                shouldAutoSpeak = true;
            }
            if (shouldAutoSpeak) {
                setTimeout(() => {
                    this.speakWord(word.english);
                }, 300);
            }
            audioBtn.style.backgroundColor = '#4CAF50';
            audioBtn.style.animation = 'pulse 2s infinite';
        } else {
            audioBtn.textContent = '🔊 Odtwórz';
            audioBtn.style.backgroundColor = '';
            audioBtn.style.animation = '';
            // Automatycznie odtwórz każde nowe słowo raz (tylko na desktop)
            setTimeout(() => {
                this.speakWord(word.english);
            }, 500);
        }
        
        listeningInput.focus();
    }

    playAudio() {
        // Ensure TTS is unlocked before speaking (especially on mobile)
        if (!this._ttsUnlocked) {
            this.unlockTTS();
        }
        const word = this.currentStudySet[this.currentWordIndex];
        const audioBtn = document.getElementById('play-audio');
        
        // Visual feedback
        audioBtn.textContent = '🔊 Odtwarzanie...';
        audioBtn.disabled = true;
        
        // Dla iOS - wymuszenie interakcji
        if (this.isIOSDevice() || this.isArcAndroid()) {
            // Najpierw "obudź" syntezę mowy cichym dźwiękiem
            const silentUtterance = new SpeechSynthesisUtterance(' ');
            silentUtterance.volume = 0.01;
            speechSynthesis.speak(silentUtterance);
            
            // Poczekaj chwilę przed właściwym słowem
            setTimeout(() => {
                this.speakWord(word.english);
            }, 100);
        } else {
            this.speakWord(word.english);
        }
        
        // Przywróć przycisk po czasie
        setTimeout(() => {
            audioBtn.textContent = '🔊 Odtwórz ponownie';
            audioBtn.disabled = false;
        }, 2000);
    }

    // Dodaj metodę do wykrywania iOS
    isIOSDevice() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

   speakWord(text) {
       if (!this._ttsUnlocked) {
           this.unlockTTS();
       }
        if (!('speechSynthesis' in window)) {
            console.warn('Brak wsparcia dla syntezy mowy');
            this.ttsFallbackPlay(text);
            return;
        }

        // Anuluj tylko jeśli nie mobile (na mobile może to powodować problemy)
        if (!this.isMobileDevice()) {
            speechSynthesis.cancel();
        }
        
        // Funkcja do odtwarzania
        const speak = () => {
            let started = false;
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = this.isMobileDevice() ? 0.7 : 0.8;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            
            // Obsługa błędów
            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event.error);
                
                // Na iOS często pomaga poczekać i spróbować ponownie
                if (this.isMobileDevice() && event.error === 'interrupted') {
                    setTimeout(() => {
                        speechSynthesis.speak(utterance);
                    }, 100);
                }
            };
            
            utterance.onstart = () => { started = true; };
           utterance.onend = () => {
                console.log('Speech finished');
            };
            
            // Spróbuj znaleźć odpowiedni głos
            const voices = speechSynthesis.getVoices() || [];
            let selectedVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en'));
            if (!selectedVoice && utterance.lang) {
                selectedVoice = voices.find(v => v.lang && v.lang.toLowerCase() === utterance.lang.toLowerCase());
            }
            if (!selectedVoice && voices.length) {
                selectedVoice = voices[0];
            }
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }
            
            speechSynthesis.speak(utterance);
            // Retry once on mobile if it didn't start; then fallback
            if (this.isMobileDevice()) {
                setTimeout(() => {
                    if (!started) {
                        let retried = false;
                        try { speechSynthesis.cancel(); } catch (e) {}
                        try { speechSynthesis.speak(utterance); retried = true; } catch (e) {}
                        setTimeout(() => {
                            if (!started) {
                                this.ttsFallbackPlay(text);
                            }
                        }, retried ? 250 : 0);
                    }
                }, 250);
            }
        };
        
        // Sprawdź czy głosy są załadowane
        if (speechSynthesis.getVoices().length === 0) {
            // Poczekaj na załadowanie głosów
            speechSynthesis.addEventListener('voiceschanged', speak, { once: true });
            
            // Timeout dla urządzeń które nie wyemitują zdarzenia
            setTimeout(() => {
                if (speechSynthesis.getVoices().length > 0) {
                    speak();
                }
            }, 100);
        } else {
            // Głosy już załadowane
            setTimeout(speak, 10); // Krótkie opóźnienie dla stabilności
        }
    }

    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // Detekcja Arc na Androidzie (przeglądarka Arc by The Browser Company)
    isArcAndroid() {
        const ua = navigator.userAgent.toLowerCase();
        return ua.includes('arc') && ua.includes('android');
    }

    // Dźwięki dla trybu match
    playSuccessSound() {
        this.playTone(523.25, 0.2, 'sine'); // C5 - przyjemny dźwięk sukcesu
        setTimeout(() => this.playTone(659.25, 0.2, 'sine'), 100); // E5
    }

    playErrorSound() {
        this.playTone(220, 0.3, 'sawtooth'); // A3 - niższy dźwięk błędu
    }

    playCompletionSound() {
        // Melodia sukcesu: C-E-G-C (akord C-dur)
        this.playTone(523.25, 0.15, 'sine'); // C5
        setTimeout(() => this.playTone(659.25, 0.15, 'sine'), 150); // E5
        setTimeout(() => this.playTone(783.99, 0.15, 'sine'), 300); // G5
        setTimeout(() => this.playTone(1046.50, 0.4, 'sine'), 450); // C6
    }


    // Gesture controls dla fiszek
    setupFlashcardGestures() {
        const flashcard = document.getElementById('flashcard');
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let currentY = 0;
        let isDragging = false;
        let lastTapTime = 0;
        let lastTapX = 0;
        let lastTapY = 0;
        const DOUBLE_TAP_MAX_DELAY = 500; // ms (more forgiving on mobile)
        const DOUBLE_TAP_MAX_DISTANCE = 60; // px

        // Touch events
        flashcard.addEventListener('touchstart', (e) => {
            if (this.currentMode !== 'flashcards') return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isDragging = true;
            flashcard.style.transition = 'none';
        });

        flashcard.addEventListener('touchmove', (e) => {
            if (!isDragging || this.currentMode !== 'flashcards') return;
            e.preventDefault();
            
            currentX = e.touches[0].clientX - startX;
            currentY = e.touches[0].clientY - startY;
            
            // Ograniczenie do poziomego ruchu
            const rotation = currentX * 0.1;
            const opacity = Math.max(0.7, 1 - Math.abs(currentX) / 300);
            
            // Clamp horizontal movement to avoid expanding layout
            const maxX = Math.min(window.innerWidth * 0.45, 300);
            const clampedX = Math.max(-maxX, Math.min(maxX, currentX));
            flashcard.style.transform = `translateX(${clampedX}px) rotate(${rotation}deg)`;
            flashcard.style.opacity = opacity;
            
            // Pokaż wskazówki kolorami
            if (currentX > 50) {
                flashcard.style.borderColor = '#51cf66'; // Zielony - znam
            } else if (currentX < -50) {
                flashcard.style.borderColor = '#ff6b6b'; // Czerwony - nie znam
            } else {
                flashcard.style.borderColor = 'transparent';
            }
        });

        flashcard.addEventListener('touchend', (e) => {
            if (!isDragging || this.currentMode !== 'flashcards') return;
            isDragging = false;
            
            flashcard.style.transition = 'all 1s ease';
            flashcard.style.borderColor = 'transparent';
            
            // Double-tap to flip (mobile)
            const isInteractive = e.target.closest('button, input, a, select, textarea');
            const isTap = Math.abs(currentX) < 18 && Math.abs(currentY) < 18;
            if (!isInteractive && isTap) {
                // Prevent ghost click/dblclick on mobile that could toggle twice
                if (typeof e.preventDefault === 'function') e.preventDefault();
                if (typeof e.stopPropagation === 'function') e.stopPropagation();

                const now = Date.now();
                const touch = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
                const tapX = touch ? touch.clientX : startX;
                const tapY = touch ? touch.clientY : startY;
                const dxTap = Math.abs(tapX - lastTapX);
                const dyTap = Math.abs(tapY - lastTapY);
                if (lastTapTime && (now - lastTapTime) <= DOUBLE_TAP_MAX_DELAY && Math.max(dxTap, dyTap) <= DOUBLE_TAP_MAX_DISTANCE) {
                    // Double tap detected: flip
                    this.flipCard();
                    lastTapTime = 0;
                    lastTapX = 0;
                    lastTapY = 0;

                    // Reset transform/opacity and exit
                    flashcard.style.transform = 'translateX(0) rotate(0deg)';
                    flashcard.style.opacity = '1';
                    currentX = 0;
                    currentY = 0;
                    return;
                } else {
                    // Store first tap
                    lastTapTime = now;
                    lastTapX = tapX;
                    lastTapY = tapY;

                    // Reset to default position and exit (single tap)
                    flashcard.style.transform = 'translateX(0) rotate(0deg)';
                    flashcard.style.opacity = '1';
                    currentX = 0;
                    currentY = 0;
                    return;
                }
            }
            
            // Sprawdź kierunek swipe
            if (Math.abs(currentX) > 100) {
                if (currentX > 0) {
                    // Swipe right - znam
                    this.handleSwipeRight();
                } else {
                    // Swipe left - nie znam
                    this.handleSwipeLeft();
                }
            } else {
                // Powrót do pozycji (lekki fade-in jeśli poruszono)
                if (Math.abs(currentX) > 10) {
                    flashcard.style.transition = 'opacity 0.2s ease, transform 0.3s ease';
                    flashcard.style.opacity = '0.9';
                    setTimeout(() => {
                        flashcard.style.opacity = '1';
                    }, 50);
                }
                flashcard.style.transform = 'translateX(0) rotate(0deg)';
                flashcard.style.opacity = '1';
            }
            
            currentX = 0;
            currentY = 0;
        });

        // Mouse events dla desktop
        flashcard.addEventListener('mousedown', (e) => {
            if (this.currentMode !== 'flashcards') return;
            startX = e.clientX;
            startY = e.clientY;
            isDragging = true;
            flashcard.style.transition = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging || this.currentMode !== 'flashcards') return;
            
            currentX = e.clientX - startX;
            currentY = e.clientY - startY;
            
            const rotation = currentX * 0.1;
            const opacity = Math.max(0.7, 1 - Math.abs(currentX) / 300);
            
            // Clamp horizontal movement to avoid expanding layout
            const maxX = Math.min(window.innerWidth * 0.45, 300);
            const clampedX = Math.max(-maxX, Math.min(maxX, currentX));
            flashcard.style.transform = `translateX(${clampedX}px) rotate(${rotation}deg)`;
            flashcard.style.opacity = opacity;
            
            if (currentX > 50) {
                flashcard.style.borderColor = '#51cf66';
            } else if (currentX < -50) {
                flashcard.style.borderColor = '#ff6b6b';
            } else {
                flashcard.style.borderColor = 'transparent';
            }
        });

        // Double-click to flip (desktop only)
        const isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        if (!isCoarsePointer && !this.isMobileDevice()) {
            flashcard.addEventListener('dblclick', (e) => {
                if (this.currentMode !== 'flashcards') return;
                const isInteractive = e.target.closest('button, input, a, select, textarea');
                if (!isInteractive) {
                    this.flipCard();
                }
            });
        }

        document.addEventListener('mouseup', (e) => {
            if (!isDragging || this.currentMode !== 'flashcards') return;
            isDragging = false;
            
            flashcard.style.transition = 'all 1s ease';
            flashcard.style.borderColor = 'transparent';
            
            if (Math.abs(currentX) > 100) {
                if (currentX > 0) {
                    this.handleSwipeRight();
                } else {
                    this.handleSwipeLeft();
                }
            } else {
                flashcard.style.transform = 'translateX(0) rotate(0deg)';
                flashcard.style.opacity = '1';
            }
            
            currentX = 0;
            currentY = 0;
        });
    }

    animateFlashcardFadeOut() {
        const flashcard = document.getElementById('flashcard');
        if (!flashcard) return;
        flashcard.style.transition = `opacity ${this.settings.flashcardAnimMs}ms ease`;
        flashcard.style.opacity = '0';
    }

    animateFlashcardOut(direction = 'right') {
        const flashcard = document.getElementById('flashcard');
        if (!flashcard) return;
        const distance = direction === 'right' ? '100vw' : '-100vw';
        const angle = direction === 'right' ? '30deg' : '-30deg';
        flashcard.style.transition = `all ${this.settings.flashcardAnimMs}ms ease`;
        flashcard.style.transform = `translateX(${distance}) rotate(${angle})`;
        flashcard.style.opacity = '0';
    }

    handleSwipeRight() {
        // Swipe right - znam słowo
        const flashcard = document.getElementById('flashcard');
        flashcard.style.transform = 'translateX(100vw) rotate(30deg)';
        flashcard.style.opacity = '0';
        
        setTimeout(() => {
            this.recordAnswer(true);
            // Do not reset position here; next card will reset state in loadFlashcard
        }, this.settings.flashcardAnimMs);
    }

    handleSwipeLeft() {
        // Swipe left - nie znam słowa
        const flashcard = document.getElementById('flashcard');
        flashcard.style.transform = 'translateX(-100vw) rotate(-30deg)';
        flashcard.style.opacity = '0';
        
        setTimeout(() => {
            this.recordAnswer(false);
            // Do not reset position here; next card will reset state in loadFlashcard
        }, this.settings.flashcardAnimMs);
    }

    // Keyboard controls dla fiszek
    setupFlashcardKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Tylko w trybie fiszek
            if (this.currentMode !== 'flashcards') return;
            
            // Nie reaguj jeśli użytkownik pisze w polu tekstowym
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            const flashcard = document.getElementById('flashcard');
            
            switch(e.code) {
                case 'Space':
                case 'Enter':
                    e.preventDefault();
                    this.flipCard();
                    this.playKeyboardFlipSound();
                    break;
                    
                case 'ArrowLeft':
                    e.preventDefault();
                    if (flashcard.classList.contains('flipped')) {
                        this.handleKeyboardWrong();
                    }
                    break;
                    
                case 'ArrowRight':
                    e.preventDefault();
                    if (flashcard.classList.contains('flipped')) {
                        this.handleKeyboardCorrect();
                    }
                    break;
                    
                case 'KeyA': // Alternative: A = nie znam
                    e.preventDefault();
                    if (flashcard.classList.contains('flipped')) {
                        this.handleKeyboardWrong();
                    }
                    break;
                    
                case 'KeyD': // Alternative: D = znam
                    e.preventDefault();
                    if (flashcard.classList.contains('flipped')) {
                        this.handleKeyboardCorrect();
                    }
                    break;
            }
        });
    }

    playKeyboardFlipSound() {
        // Subtelny dźwięk przewrócenia karty
        this.playTone(400, 0.1, 'sine', 0.05);
        setTimeout(() => this.playTone(600, 0.1, 'sine', 0.05), 50);
    }

    handleKeyboardCorrect() {
        // Animacja sukcesu z klawiatury
        const flashcard = document.getElementById('flashcard');
        flashcard.style.transform = 'scale(1.05)';
        flashcard.style.borderColor = '#51cf66';
        
        setTimeout(() => {
            this.animateFlashcardFadeOut();
            flashcard.style.transform = 'scale(1)';
            flashcard.style.borderColor = '';
            setTimeout(() => this.recordAnswer(true), this.settings.flashcardAnimMs);
        }, 150);
    }

    handleKeyboardWrong() {
        // Animacja błędu z klawiatury
        const flashcard = document.getElementById('flashcard');
        flashcard.style.transform = 'scale(0.95)';
        flashcard.style.borderColor = '#ff6b6b';
        
        setTimeout(() => {
            this.animateFlashcardFadeOut();
            flashcard.style.transform = 'scale(1)';
            flashcard.style.borderColor = '';
            setTimeout(() => this.recordAnswer(false), this.settings.flashcardAnimMs);
        }, 150);
    }

    playTone(frequency, duration, waveType = 'sine', volume = 0.1) {
        if (!('AudioContext' in window) && !('webkitAudioContext' in window)) {
            return; // Brak wsparcia dla Web Audio API
        }

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            oscillator.type = waveType;

            // Envelope dla płynnego dźwięku
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
        } catch (error) {
            console.warn('Nie można odtworzyć dźwięku:', error);
        }
    }

    // Prosty fallback TTS: Streamelements (bez klucza). Uwaga: publiczne API, brak gwarancji SLA.
    async ttsFallbackPlay(text) {
        try {
            const voice = 'Brian'; // angielski męski, dość naturalny
            const url = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;
            const audio = new Audio();
            audio.src = url;
            audio.volume = 1.0;
            await audio.play();
        } catch (e) {
            console.warn('Fallback TTS failed', e);
        }
    }

    generateAudioURL(word) {
        // Placeholder for audio generation - in a real app, you'd use a TTS service
        return `data:audio/wav;base64,`;
    }

    checkListeningAnswer() {
        // Hide mobile keyboard by removing focus from the input
        const listeningInputEl = document.getElementById('listening-input');
        if (listeningInputEl && typeof listeningInputEl.blur === 'function') {
            listeningInputEl.blur();
        }

        const word = this.currentStudySet[this.currentWordIndex];
        const userAnswer = document.getElementById('listening-input').value.trim().toLowerCase();
        const correctAnswer = word.polish.toLowerCase();
        const feedback = document.getElementById('listening-feedback');

        const isCorrect = userAnswer === correctAnswer;
        
        if (isCorrect) {
            feedback.textContent = 'Świetnie! Poprawna odpowiedź.';
            feedback.className = 'feedback correct';

            // After keyboard hides, ensure feedback is visible
            setTimeout(() => {
                if (typeof feedback.scrollIntoView === 'function') {
                    feedback.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 50);
            
            this.recordAnswer(isCorrect);
            
            setTimeout(() => {
                this.nextWord();
            }, 2000);
        } else {
            feedback.textContent = `Niepoprawnie. Prawidłowa odpowiedź to: ${word.polish}`;
            feedback.className = 'feedback incorrect';

            // After keyboard hides, ensure feedback is visible
            setTimeout(() => {
                if (typeof feedback.scrollIntoView === 'function') {
                    feedback.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 50);
            
            this.recordAnswer(isCorrect);
            
            // Odtwórz słowo ponownie po błędnej odpowiedzi
            setTimeout(() => {
                this.speakWord(word.english);
                
                // Po odtworzeniu słowa przejdź do następnego
                setTimeout(() => {
                    this.nextWord();
                }, 2000);
            }, 1000);
        }
    }

    // Match Mode
    loadMatch() {
        const wordsToMatch = this.currentStudySet.slice(this.currentWordIndex, this.currentWordIndex + 5);
        const polishContainer = document.getElementById('polish-words');
        const englishContainer = document.getElementById('english-words');

        polishContainer.innerHTML = '';
        englishContainer.innerHTML = '';
        this.selectedMatches = {};
        this.matchedPairs = new Set(); // Śledzenie dopasowanych par

        const shuffledEnglish = this.shuffleArray([...wordsToMatch]);

        wordsToMatch.forEach((word, index) => {
            const polishEl = this.createMatchElement(word.polish, 'polish', index);
            polishContainer.appendChild(polishEl);
        });

        shuffledEnglish.forEach((word, index) => {
            const englishEl = this.createMatchElement(word.english, 'english', index);
            englishContainer.appendChild(englishEl);
        });

        // Ukryj przycisk "Sprawdź dopasowanie" - nie jest potrzebny
        const checkButton = document.getElementById('check-matches');
        if (checkButton) {
            checkButton.style.display = 'none';
        }

        // Dodaj informację o postępie
        this.updateMatchProgress(wordsToMatch.length, 0);
    }

    createMatchElement(text, type, index) {
        const element = document.createElement('div');
        element.className = 'match-word';
        element.textContent = text;
        element.dataset.type = type;
        element.dataset.index = index;
        element.dataset.word = text;

        element.addEventListener('click', () => {
            this.selectMatchWord(element);
        });

        return element;
    }

    selectMatchWord(element) {
        const type = element.dataset.type;
        const word = element.dataset.word;

        // Remove previous selection of same type
        document.querySelectorAll(`.match-word[data-type="${type}"].selected`).forEach(el => {
            el.classList.remove('selected');
        });

        element.classList.add('selected');
        this.selectedMatches[type] = word;

        // Check if we have both selections
        if (this.selectedMatches.polish && this.selectedMatches.english) {
            // Auto-check after short delay
            setTimeout(() => {
                this.checkSingleMatch();
            }, 500);
        }
    }

    checkSingleMatch() {
        const polishWord = this.selectedMatches.polish;
        const englishWord = this.selectedMatches.english;

        const correctPair = this.currentStudySet.find(w => 
            w.polish === polishWord && w.english === englishWord
        );

        const polishEl = document.querySelector(`.match-word[data-word="${polishWord}"]`);
        const englishEl = document.querySelector(`.match-word[data-word="${englishWord}"]`);

        if (correctPair) {
            // Poprawne dopasowanie - pokaż efekt i usuń słowa
            polishEl.classList.add('correct');
            englishEl.classList.add('correct');
            this.playSuccessSound();
            this.recordAnswer(true, correctPair);
            
            // Dodaj parę do dopasowanych
            this.matchedPairs.add(polishWord);
            this.matchedPairs.add(englishWord);
            
            // Usuń słowa po animacji
            setTimeout(() => {
                polishEl.style.opacity = '0';
                englishEl.style.opacity = '0';
                polishEl.style.transform = 'scale(0.8)';
                englishEl.style.transform = 'scale(0.8)';
                
                setTimeout(() => {
                    polishEl.remove();
                    englishEl.remove();
                    
                    // Sprawdź czy wszystkie słowa zostały dopasowane
                    this.checkIfAllMatched();
                }, 300);
            }, 1000);
            
        } else {
            // Błędne dopasowanie - pokaż błąd i przywróć
            polishEl.classList.add('incorrect');
            englishEl.classList.add('incorrect');
            this.playErrorSound();
            
            // Find the correct pair and record as incorrect
            const polishWordObj = this.currentStudySet.find(w => w.polish === polishWord);
            if (polishWordObj) {
                this.recordAnswer(false, polishWordObj);
            }
            
            // Przywróć po animacji błędu
            setTimeout(() => {
                polishEl.classList.remove('selected', 'correct', 'incorrect');
                englishEl.classList.remove('selected', 'correct', 'incorrect');
            }, 1500);
        }

        // Reset selections
        this.selectedMatches = {};
    }

    updateMatchProgress(total, matched) {
        const progressText = document.querySelector('#match-mode .progress-text');
        if (progressText) {
            progressText.textContent = `Dopasowano: ${matched}/${total}`;
        }
    }

    checkIfAllMatched() {
        // Sprawdź czy wszystkie słowa zostały dopasowane
        const remainingPolish = document.querySelectorAll('#polish-words .match-word').length;
        const remainingEnglish = document.querySelectorAll('#english-words .match-word').length;
        const totalWords = this.currentStudySet.slice(this.currentWordIndex, this.currentWordIndex + 5).length;
        const matchedWords = totalWords - remainingPolish;
        
        // Aktualizuj postęp
        this.updateMatchProgress(totalWords, matchedWords);
        
        if (remainingPolish === 0 && remainingEnglish === 0) {
            // Wszystkie słowa dopasowane - pokaż gratulacje i przejdź dalej
            setTimeout(() => {
                this.updateMatchProgress(totalWords, totalWords);
                this.playCompletionSound();
                setTimeout(() => {
                    this.currentWordIndex += 5;
                    this.loadCurrentWord();
                }, 1500);
            }, 500);
        }
    }

    checkMatches() {
        // Ta funkcja nie jest już potrzebna - słowa automatycznie przechodzą dalej
        // gdy wszystkie zostaną dopasowane
        this.checkIfAllMatched();
    }

    // Word Image Loading
    async loadWordImage(container, englishWord, polishWord) {
        // Cache hit: reuse already resolved URL
        const cacheKey = `${englishWord.toLowerCase()}|${(polishWord||'').toLowerCase()}`;
        if (this.imageUrlCache[cacheKey]) {
            const url = this.imageUrlCache[cacheKey];
            const img = new Image();
            img.onload = () => {
                container.style.backgroundImage = `url(${url})`;
                container.textContent = '';
            };
            img.onerror = () => { /* If cached URL fails now, try full flow again */ this._loadWordImageFlow(container, englishWord, polishWord, cacheKey); };
            img.src = url;
            return;
        }
        return this._loadWordImageFlow(container, englishWord, polishWord, cacheKey);
    }

    async _loadWordImageFlow(container, englishWord, polishWord, cacheKey) {
        container.style.backgroundImage = '';
        container.textContent = '🖼️';
        AI_IMG_DBG('loadWordImage start', { englishWord, polishWord, provider: this.settings.aiImageProvider });

        const proxify = (url) => {
            try {
                const base = (this.settings.proxyBaseUrl || '').replace(/\/$/, '');
                if (base && /^https?:\/\//.test(base)) {
                    return `${base}/api/proxy-image?url=${encodeURIComponent(url)}`;
                }
            } catch (_) {}
            return url;
        };

        const applyImage = (url) => {
            const img = new Image();
            const finalUrl = proxify(url);
            img.onload = () => {
                container.style.backgroundImage = `url(${finalUrl})`;
                container.textContent = '';
            };
            img.onerror = () => {
                this.loadFallbackImage(container, englishWord, polishWord);
            };
            img.src = url;
        };

        try {
            const provider = this.settings.aiImageProvider || 'free';

            if (provider === 'imagen-4') {
                if (this.settings.enableImagen && this.supportsImagenServer()) {
                    const url = await this.generateImageWithImagen4(englishWord, polishWord);
                    if (url) return applyImage(url);
                }
                // fallback do free
                const freeUrl = await this.generateFreeAIImage(englishWord, polishWord);
                if (freeUrl) return applyImage(freeUrl);
                return this.loadFallbackImage(container, englishWord, polishWord);
            }

            if (provider === 'gemini-flash-preview') {
                if (this.settings.aiApiKey || this.supportsImagenServer()) {
                    const url = await this.generateImageWithGeminiFlashPreview(englishWord, polishWord);
                    if (url) return applyImage(url);
                }
                const freeUrl = await this.generateFreeAIImage(englishWord, polishWord);
                if (freeUrl) return applyImage(freeUrl);
                return this.loadFallbackImage(container, englishWord, polishWord);
            }

            // default: free provider
            const aiImageUrl = await this.generateFreeAIImage(englishWord, polishWord);
            if (aiImageUrl) { this.imageUrlCache[cacheKey] = aiImageUrl; return applyImage(aiImageUrl); }
            return this.loadFallbackImage(container, englishWord, polishWord);
        } catch (error) {
            console.warn('Błąd generowania obrazu z AI:', error);
            this.loadFallbackImage(container, englishWord, polishWord);
        }
    }

   // Prefetch upcoming images to speed up next flashcards
   prefetchNextImages(count = 3) {
       try {
           if (!Array.isArray(this.currentStudySet) || this.currentStudySet.length === 0) return;
           const start = Math.max(0, (this.currentWordIndex || 0) + 1);
           const end = Math.min(this.currentStudySet.length, start + Math.max(0, count|0));
           clearTimeout(this._prefetchTimer);
           this._prefetchTimer = setTimeout(() => {
               for (let i = start; i < end; i++) {
                   const w = this.currentStudySet[i];
                   if (w) this.prefetchImageForWord(w);
               }
           }, 50);
       } catch (_) {}
   }

   async prefetchImageForWord(word) {
       try {
           const english = String(word.english || '').trim();
           const polish = String(word.polish || '').trim();
           const key = `${english.toLowerCase()}|${polish.toLowerCase()}`;
           if (!english || this.imageUrlCache[key] || this._prefetchInFlight.has(key)) return;
           this._prefetchInFlight.add(key);

           const warm = (url) => {
               if (!url) return;
               // warm browser cache via proxy if configured
               const base = (this.settings.proxyBaseUrl || '').replace(/\/$/, '');
               const warmUrl = (base && /^https?:\/\//.test(base))
                   ? `${base}/api/proxy-image?url=${encodeURIComponent(url)}`
                   : url;
               try {
                   const img = new Image();
                   img.src = warmUrl;
               } catch (_) {}
           };

           // Prefer Pollinations (free)
           let url = await this.generateFreeAIImage(english, polish);
           if (!url) url = await this.generateHuggingFaceImage(english, polish);
           if (!url) url = await this.generateUnsplashImage(english, polish);

           if (url) {
               this.imageUrlCache[key] = url;
               warm(url);
           }
       } catch (_) {
           // ignore prefetch errors
       } finally {
           try { this._prefetchInFlight.delete(`${String(word.english||'').toLowerCase()}|${String(word.polish||'').toLowerCase()}`); } catch (_) {}
       }
   }

    // Definition helper for image prompts
    async getImageSenseText(englishWord, polishWord) {
        AI_IMG_DBG('getImageSenseText called', { englishWord, polishWord });
        try {
            const key = `${englishWord.toLowerCase()}|${(polishWord || '').toLowerCase()}`;
            if (this.imagePromptCache[key]) return this.imagePromptCache[key];
            let definition = null;
            const provider = this.settings.aiProvider;
            const canUseAI = !!this.settings.aiApiKey && ['openai','anthropic','gemini'].includes(provider);
            if (canUseAI) {
                const prompt = `Disambiguate and define an English word for image generation.\nEnglish word: "${englishWord}"\nPolish translation: "${polishWord || ''}"\nWrite one short English definition sentence (max 22 words) that matches the Polish meaning. No examples, no extra text. Return only the sentence.`;
                try {
                    let resp;
                    if (provider === 'openai') resp = await this.callOpenAI(prompt);
                    else if (provider === 'anthropic') resp = await this.callAnthropic(prompt);
                    else if (provider === 'gemini') resp = await this.callGemini(prompt, { responseMimeType: 'text/plain' });
                    definition = String(resp || '').split('\n')[0].trim();
                    definition = definition.replace(/^```.*$/g, '').replace(/^['"“”]+|['"“”]+$/g, '').trim();
                    if (definition.length > 180) definition = definition.slice(0, 180);
                } catch (e) {
                    definition = null;
                }
            }
            if (!definition) {
                const category = this.guessWordCategory(polishWord || '') || 'general';
                definition = `the sense of ${englishWord} that corresponds to the Polish \"${polishWord || englishWord}\" (${category})`;
            }
            this.imagePromptCache[key] = definition;
            return definition;
        } catch (_) {
            return englishWord;
        }
    }

    // Generowanie obrazków z bezpłatnym AI (Pollinations AI)
    async generateFreeAIImage(englishWord, polishWord) {
        try {
            // Pollinations AI - bezpłatny serwis do generowania obrazków (z definicją dla jednoznaczności)
            const sense = await this.getImageSenseText(englishWord, polishWord);
            AI_IMG_DBG('Sense (Pollinations)', { englishWord, polishWord, sense });
            const prompt = `${englishWord} - ${sense}`;
            const encodedPrompt = encodeURIComponent(prompt);
            
            // Generujemy unikalny seed na podstawie EN+PL
            const seed = this.hashCode(`${englishWord}|${polishWord || ''}|imgv2`);
            const defaultUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${AI_IMAGE_MIN_DIM}&height=${AI_IMAGE_MIN_DIM}&seed=${seed}&nologo=true`;
            AI_IMG_DBG('Fetch Pollinations URL', { imageUrl: defaultUrl, prompt, seed });
            const okDefault = await this.tryLoadImage(defaultUrl, 8000);
            if (okDefault) return okDefault;

            // Jeśli standardowy backend nie działa, spróbuj model=flux jako alternatywy
            const fluxUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${AI_IMAGE_MIN_DIM}&height=${AI_IMAGE_MIN_DIM}&seed=${seed}&model=flux&nologo=true`;
            AI_IMG_DBG('Fetch Pollinations Flux URL', { imageUrl: fluxUrl, prompt, seed });
            const okFlux = await this.tryLoadImage(fluxUrl, 8000);
            if (okFlux) return okFlux;

            return null;
        } catch (error) {
            console.error('Błąd generowania obrazu z Pollinations:', error);
            return null;
        }
    }

    // Imagen 4 (zamiast Imagen 3)
    async generateImageWithImagen4(englishWord, polishWord) {
        try {
            if (!this.supportsImagenServer()) return null;
            const sense = await this.getImageSenseText(englishWord, polishWord);
            const prompt = `A simple, clear illustration of ${englishWord} (${sense}), clean white background, flat vector, clipart style, no text, no words, no letters, no captions, no watermark, label-free, pictorial only`;

            const url = `${this.settings.proxyBaseUrl || ''}/api/imagen4`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.settings.aiApiKey ? { 'x-api-key': this.settings.aiApiKey } : {})
                },
                body: JSON.stringify({
                    prompt,
                    config: {
                        numberOfImages: 1,
                        aspectRatio: '1:1',
                        safetyFilterLevel: 'BLOCK_ONLY_HIGH',
                        personGeneration: 'DONT_ALLOW'
                    }
                })
            });

            if (response.status === 429) {
                console.warn('Imagen proxy rate limited (429).');
                return null; // trigger fallback
            }
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(`Imagen proxy error: ${response.status} ${text}`);
            }

            const data = await response.json();
            const base64Data = data?.base64;
            if (base64Data) {
                const blob = this.base64ToBlob(base64Data, data?.mime || 'image/png');
                return URL.createObjectURL(blob);
            }
            if (data?.url) {
                return data.url;
            }
            return null;
        } catch (error) {
            console.error('Imagen generation failed:', error);
            return null;
        }
    }

    base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    // Czy dostępny jest serwer proxy do Imagen/Gemini (dla statycznych hostingów zwykle false)
    supportsImagenServer() {
        try {
            return !!(this.settings && this.settings.proxyBaseUrl && /^https?:\/\//.test(this.settings.proxyBaseUrl));
        } catch (_) {
            return false;
        }
    }

    async loadFallbackImage(container, englishWord, polishWord) {
        try {
            // Spróbuj drugi bezpłatny serwis AI - Hugging Face (Pollinations alt)
            const hfImageUrl = await this.generateHuggingFaceImage(englishWord, polishWord);
            if (hfImageUrl) {
                const img = new Image();
                img.onload = () => {
                    container.style.backgroundImage = `url(${hfImageUrl})`;
                    container.textContent = '';
                };
                img.onerror = async () => {
                    // Jeśli alt Pollinations padł, spróbuj Unsplash Source API
                    const unsplashUrl = await this.generateUnsplashImage(englishWord, polishWord);
                    if (unsplashUrl) {
                        container.style.backgroundImage = `url(${unsplashUrl})`;
                        container.textContent = '';
                    } else {
                        this.loadIconImage(container, englishWord);
                    }
                };
                img.src = hfImageUrl;
                return;
            }
        } catch (error) {
            console.warn('Błąd generowania obrazu z Hugging Face:', error);
        }

        // Trzeci fallback: Unsplash Source (bez klucza)
        try {
            const unsplashUrl = await this.generateUnsplashImage(englishWord, polishWord);
            if (unsplashUrl) {
                container.style.backgroundImage = `url(${unsplashUrl})`;
                container.textContent = '';
                return;
            }
        } catch (e) {
            console.warn('Unsplash fallback failed:', e);
        }
        
        // Ostateczny fallback - ikony i emoji
        this.loadIconImage(container, englishWord);
    }

    // Helper: try to load an image URL with timeout; resolve(url) on success else null
    async tryLoadImage(url, timeoutMs = 8000) {
        // Try via proxy (if configured) first to bypass adblock/CORS, but always return the original URL on success
        const buildProxy = (u) => {
            try {
                const base = (this.settings.proxyBaseUrl || '').replace(/\/$/, '');
                if (base && /^https?:\/\//.test(base)) {
                    return `${base}/api/proxy-image?url=${encodeURIComponent(u)}`;
                }
            } catch (_) {}
            return null;
        };
        const candidates = [];
        const viaProxy = buildProxy(url);
        if (viaProxy) candidates.push({ testUrl: viaProxy, retUrl: url });
        candidates.push({ testUrl: url, retUrl: url });

        for (const c of candidates) {
            const ok = await new Promise((resolve) => {
                try {
                    const img = new Image();
                    let done = false;
                    const t = setTimeout(() => {
                        if (done) return;
                        done = true;
                        resolve(false);
                    }, timeoutMs);
                    img.onload = () => {
                        if (done) return;
                        done = true;
                        clearTimeout(t);
                        resolve(true);
                    };
                    img.onerror = () => {
                        if (done) return;
                        done = true;
                        clearTimeout(t);
                        resolve(false);
                    };
                    img.src = c.testUrl;
                } catch (_) {
                    resolve(false);
                }
            });
            if (ok) return c.retUrl;
        }
        return null;
    }

    // Fallback generator bez klucza: Pollinations (default -> flux), a na końcu Unsplash
    async generateHuggingFaceImage(englishWord, polishWord) { // returns URL or null (disabled fallback per user)
        return null;
        // Try standard Pollinations first; if not available, try flux as fallback

        try {
            // Użyj tej samej strategii rozstrzygania znaczeń jak w głównym generatorze
            const sense = await this.getImageSenseText(englishWord, polishWord);
            const prompt = `${englishWord} - ${sense}`;
            AI_IMG_DBG('Sense (HF icon)', { englishWord, polishWord, sense });
            const encodedPrompt = encodeURIComponent(prompt);
            const seed = this.hashCode(`${englishWord}|${polishWord || ''}|iconv1`);
            
            // First try default Pollinations (no flux)
            const defaultUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${AI_IMAGE_MIN_DIM}&height=${AI_IMAGE_MIN_DIM}&seed=${seed}&nologo=true`;
            AI_IMG_DBG('Try HF default URL', { defaultUrl, prompt, seed });
            const okDefault = await this.tryLoadImage(defaultUrl, 8000);
            if (okDefault) return okDefault;

            // If default unavailable, try flux backend
            const fluxUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${AI_IMAGE_MIN_DIM}&height=${AI_IMAGE_MIN_DIM}&seed=${seed}&model=flux&nologo=true`;
            AI_IMG_DBG('Try HF flux URL', { fluxUrl, prompt, seed });
            const okFlux = await this.tryLoadImage(fluxUrl, 8000);
            if (okFlux) return okFlux;

            // Lastly, try Unsplash Source API as a generic photo fallback (no API key)
            const unsplash = await this.generateUnsplashImage(englishWord, polishWord);
            if (unsplash) return unsplash;

            return null;
        } catch (error) {
            return null;
        }
    }

    // Generic photo fallback: Unsplash Source API then Picsum (no API keys)
    async generateUnsplashImage(englishWord, polishWord) { // disabled per user
        return null;
        try {
            // Build a simple, likely-to-exist query
            const cleaned = String(englishWord || '').replace(/[^a-zA-Z\s]/g, ' ').trim();
            const tokens = cleaned.split(/\s+/).filter(Boolean);
            const primary = tokens.length > 1 ? tokens[tokens.length - 1] : (tokens[0] || 'object');
            const query = encodeURIComponent(`${primary},time,illustration`);

            // Unsplash Source will 302 to a concrete image URL
            const url = `https://source.unsplash.com/featured/${AI_IMAGE_MIN_DIM}x${AI_IMAGE_MIN_DIM}?${query}`;
            const ok = await this.tryLoadImage(url, 7000);
            if (ok) return ok;

            // Picsum placeholder as a last resort photo
            const seed = this.hashCode(`${englishWord}|${polishWord || ''}|unsplash`);
            const picsum = `https://picsum.photos/seed/${seed}/${AI_IMAGE_MIN_DIM}/${AI_IMAGE_MIN_DIM}`;
            const ok2 = await this.tryLoadImage(picsum, 5000);
            if (ok2) return ok2;

            return null;
        } catch (_) {
            return null;
        }
    }

    // Gemini 2.5 Flash Image Preview
    async generateImageWithGeminiFlashPreview(englishWord, polishWord) {
        try {
            const sense = await this.getImageSenseText(englishWord, polishWord);
            const prompt = `${englishWord} (${sense}). Simple, clear preview illustration, white background, flat, no text, no watermark`;
            const model = 'gemini-2.5-flash-image-preview';

            // If proxy available, prefer it (keeps key server-side)
            if (this.supportsImagenServer()) {
                const url = `${this.settings.proxyBaseUrl || ''}/api/gemini/flash-preview`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this.settings.aiApiKey ? { 'x-api-key': this.settings.aiApiKey } : {})
                    },
                    body: JSON.stringify({ prompt, model, generationConfig: { responseMimeType: 'application/json' } })
                });
                if (response.status === 429) {
                    console.warn('Gemini proxy rate limited (429).');
                    return null;
                }
                if (!response.ok) {
                    const text = await response.text().catch(() => '');
                    throw new Error(`Gemini Flash Preview proxy error: ${response.status} ${text}`);
                }
                const data = await response.json();
                if (data?.base64) {
                    const blob = this.base64ToBlob(data.base64, data?.mime || 'image/png');
                    return URL.createObjectURL(blob);
                }
                if (data?.url) return data.url;
                return null;
            }

            // Fallback: direct browser call to Google API (CORS usually allowed for generateContent). Note: exposes API key.
            if (!this.settings.aiApiKey) return null;
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.settings.aiApiKey)}`;

            const doRequest = async () => {
                const r = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } })
                });
                return r;
            };

            let response = await doRequest();
            if (response.status === 429) {
                // simple backoff once
                await new Promise(res => setTimeout(res, 800));
                response = await doRequest();
            }
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(`Gemini Flash Preview error: ${response.status} ${text}`);
            }
            const data = await response.json();
            const parts = data?.candidates?.[0]?.content?.parts || [];
            const imgPart = parts.find(p => p.inlineData && p.inlineData.mimeType && p.inlineData.data);
            if (imgPart && imgPart.inlineData) {
                const mime = imgPart.inlineData.mimeType || 'image/png';
                const base64 = imgPart.inlineData.data;
                const blob = this.base64ToBlob(base64, mime);
                return URL.createObjectURL(blob);
            }
            const linkPart = parts.find(p => typeof p.text === 'string' && p.text.startsWith('http'));
            if (linkPart) return linkPart.text.trim();
            return null;
        } catch (e) {
            console.warn('generateImageWithGeminiFlashPreview failed', e);
            return null;
        }
    }

    // Ładowanie ikon zamiast losowych obrazków
    loadIconImage(container, englishWord) {
        // Spróbuj załadować ikonę z Iconify API
        const iconName = this.getIconForWord(englishWord);
        if (iconName) {
            const iconUrl = `https://api.iconify.design/${iconName}.svg?width=100&height=100`;
            
            const img = new Image();
            img.onload = () => {
                container.style.backgroundImage = `url(${iconUrl})`;
                container.style.backgroundSize = '80px 80px';
                container.textContent = '';
            };
            img.onerror = () => {
                // Ostateczny fallback - emoji
                container.textContent = this.getWordEmoji(englishWord);
                container.style.backgroundImage = '';
            };
            img.src = iconUrl;
        } else {
            // Bezpośrednio emoji jeśli nie ma ikony
            container.textContent = this.getWordEmoji(englishWord);
            container.style.backgroundImage = '';
        }
    }

    // Mapowanie słów na ikony
    getIconForWord(englishWord) {
        const iconMap = {
            'house': 'mdi:home',
            'home': 'mdi:home',
            'window': 'mdi:window-closed',
            'door': 'mdi:door',
            'cat': 'mdi:cat',
            'dog': 'mdi:dog',
            'car': 'mdi:car',
            'bus': 'mdi:bus',
            'train': 'mdi:train',
            'airplane': 'mdi:airplane',
            'book': 'mdi:book',
            'computer': 'mdi:laptop',
            'phone': 'mdi:phone',
            'apple': 'mdi:food-apple',
            'water': 'mdi:water',
            'coffee': 'mdi:coffee',
            'tree': 'mdi:tree',
            'flower': 'mdi:flower',
            'sun': 'mdi:weather-sunny',
            'moon': 'mdi:weather-night',
            'star': 'mdi:star',
            'heart': 'mdi:heart',
            'music': 'mdi:music',
            'food': 'mdi:food',
            'school': 'mdi:school',
            'work': 'mdi:briefcase'
        };
        
        return iconMap[englishWord.toLowerCase()] || null;
    }

    // Dodatkowa funkcja pomocnicza do generowania hash z słowa
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }


    // Funkcja do pokazywania emoji związanych ze słowami
    getWordEmoji(englishWord) {
        const emojiMap = {
            'house': '🏠', 'home': '🏠', 'window': '🪟', 'door': '🚪',
            'cat': '🐱', 'dog': '🐶', 'bird': '🐦', 'fish': '🐟',
            'apple': '🍎', 'banana': '🍌', 'orange': '🍊', 'bread': '🍞',
            'milk': '🥛', 'water': '💧', 'coffee': '☕', 'tea': '🍵',
            'car': '🚗', 'bus': '🚌', 'train': '🚂', 'airplane': '✈️',
            'book': '📚', 'pen': '✏️', 'computer': '💻', 'phone': '📱',
            'sun': '☀️', 'moon': '🌙', 'star': '⭐', 'tree': '🌳',
            'flower': '🌸', 'heart': '❤️', 'smile': '😊', 'happy': '😊'
        };
        
        const word = englishWord.toLowerCase();
        return emojiMap[word] || '🖼️';
    }

    // Answer Recording and Spaced Repetition
    async recordAnswer(isCorrect, word = null) {
        const currentWord = word || this.currentStudySet[this.currentWordIndex];
        const now = new Date();

        currentWord.attempts++;
        if (isCorrect) {
            currentWord.correct++;
        } else {
            // Track difficult words for AI analysis
            this.trackDifficultWord(currentWord);
        }

        currentWord.lastReview = now.toISOString();

        // Get AI-recommended interval or use standard algorithm
        const interval = await this.getAIRecommendedInterval(currentWord, isCorrect);
        
        // Update word status and next review date
        if (isCorrect) {
            if (currentWord.status === 'new') {
                currentWord.status = 'learning';
            } else if (currentWord.status === 'learning') {
                currentWord.status = 'learned';
            }
            currentWord.nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000).toISOString();
        } else {
            // Reset to learning status if incorrect
            currentWord.status = 'learning';
            currentWord.nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000).toISOString();
        }

        this.updateGlobalStats();
        this.updateLearningPatterns(currentWord, isCorrect);
        
        // Aktualizuj statystyki kategorii
        const wordCategory = currentWord.category || this.guessWordCategory(currentWord.polish);
        this.updateCategoryStats(wordCategory, isCorrect);
        
        this.saveData();

        if (this.currentMode !== 'match' && this.currentMode !== 'listening') {
            if (this._nextWordTimer) clearTimeout(this._nextWordTimer);
            this._nextWordTimer = setTimeout(() => {
                this._nextWordTimer = null;
                this.nextWord();
            }, 2000);
        }
    }

    trackDifficultWord(word) {
        const accuracy = word.attempts > 0 ? (word.correct / word.attempts) : 0;
        if (accuracy < 0.5 && word.attempts >= 3) {
            if (!this.learningPatterns.difficultWords.includes(word.english)) {
                this.learningPatterns.difficultWords.push(word.english);
                // Keep only last 20 difficult words
                if (this.learningPatterns.difficultWords.length > 20) {
                    this.learningPatterns.difficultWords.shift();
                }
            }
        }
    }

    updateLearningPatterns(word, isCorrect) {
        // Update preferred categories based on success
        const category = this.guessWordCategory(word.polish);
        if (category !== 'inne') {
            const categoryIndex = this.learningPatterns.preferredCategories.findIndex(c => c.name === category);
            if (categoryIndex >= 0) {
                this.learningPatterns.preferredCategories[categoryIndex].successRate = 
                    (this.learningPatterns.preferredCategories[categoryIndex].successRate + (isCorrect ? 1 : 0)) / 2;
            } else {
                this.learningPatterns.preferredCategories.push({
                    name: category,
                    successRate: isCorrect ? 1 : 0
                });
            }
        }
    }

    nextWord() {
        this.currentWordIndex++;
        this.loadCurrentWord();
    }

    finishStudySession() {
        alert('Gratulacje! Ukończyłeś sesję nauki.');
        this.showView('dashboard');
    }

    updateProgress() {
        const progressFill = document.getElementById('study-progress');
        const progressText = document.getElementById('progress-text');
        
        const progress = (this.currentWordIndex / this.currentStudySet.length) * 100;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${this.currentWordIndex}/${this.currentStudySet.length}`;
    }

    // Statistics
    updateStats() {
        this.calculateStats();
        
        document.getElementById('total-words').textContent = this.stats.totalWords;
        document.getElementById('learned-words').textContent = this.stats.learnedWords;
        document.getElementById('due-words').textContent = this.stats.dueWords;
        document.getElementById('success-rate').textContent = `${this.stats.successRate}%`;
        
        // Update AI info
        document.getElementById('current-level').textContent = this.settings.languageLevel;
        document.getElementById('infinite-status').textContent = this.settings.infiniteLearning ? '🚀' : '⏸️';
        
        // Update category info
        this.updateCategoryDisplay();
    }

    calculateStats() {
        const now = new Date();
        
        this.stats.totalWords = this.words.length;
        this.stats.learnedWords = this.words.filter(w => w.status === 'learned').length;
        this.stats.dueWords = this.words.filter(w => {
            if (w.status === 'new') return true;
            if (w.nextReview && new Date(w.nextReview) <= now) return true;
            return false;
        }).length;

        const totalAttempts = this.words.reduce((sum, w) => sum + w.attempts, 0);
        const correctAttempts = this.words.reduce((sum, w) => sum + w.correct, 0);
        
        this.stats.successRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
    }

    updateCategoryDisplay() {
        // Aktualizuj informacje o kategoriach w dashboard
        const totalCategories = this.wordCategories.length;
        const dynamicCategories = this.dynamicCategories.length;
        const baseCategories = this.baseCategories.length;
        
        // Znajdź elementy w HTML (jeśli istnieją)
        const totalCategoriesEl = document.getElementById('total-categories');
        const dynamicCategoriesEl = document.getElementById('dynamic-categories');
        
        if (totalCategoriesEl) {
            totalCategoriesEl.textContent = totalCategories;
        }
        
        if (dynamicCategoriesEl) {
            dynamicCategoriesEl.textContent = `${dynamicCategories} AI + ${baseCategories} bazowych`;
        }
        
        // Wyświetl ostatnio dodane kategorie w konsoli dla debugowania
        if (this.dynamicCategories.length > 0) {
            console.log(`📚 Kategorie: ${totalCategories} łącznie (${dynamicCategories} dynamicznych AI)`);
            console.log(`🎯 Ostatnie AI kategorie:`, this.dynamicCategories.slice(-3));
        }
    }

    updateGlobalStats() {
        this.calculateStats();
    }

    // Progress View
    showProgress() {
        this.updateStats();
        this.renderWordStatusList();
        this.renderProgressChart();
    }

    renderWordStatusList() {
        const container = document.getElementById('word-status-list');
        container.innerHTML = '';

        this.words.forEach(word => {
            const item = document.createElement('div');
            item.className = 'status-item';
            
            const wordInfo = document.createElement('div');
            const strongEl = document.createElement('strong');
            strongEl.textContent = word.polish;
            wordInfo.appendChild(strongEl);
            wordInfo.appendChild(document.createTextNode(' - '));
            const engText = document.createTextNode(word.english);
            wordInfo.appendChild(engText);
            
            const badge = document.createElement('span');
            badge.className = `status-badge status-${word.status}`;
            badge.textContent = this.getStatusText(word.status);
            
            item.appendChild(wordInfo);
            item.appendChild(badge);
            container.appendChild(item);
        });
    }

    getStatusText(status) {
        const statusMap = {
            'new': 'Nowe',
            'learning': 'Uczę się',
            'learned': 'Nauczone'
        };
        return statusMap[status] || status;
    }

    renderProgressChart() {
        const canvas = document.getElementById('progress-canvas');
        const ctx = canvas.getContext('2d');
        
        // Ustaw responsywny rozmiar canvas
        this.setResponsiveCanvasSize(canvas);
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Simple bar chart
        const data = [
            { label: 'Nowe', value: this.words.filter(w => w.status === 'new').length, color: '#1976d2' },
            { label: 'Uczę się', value: this.words.filter(w => w.status === 'learning').length, color: '#f57c00' },
            { label: 'Nauczone', value: this.words.filter(w => w.status === 'learned').length, color: '#388e3c' }
        ];
        
        const maxValue = Math.max(...data.map(d => d.value));
        
        // Responsywne wymiary
        const screenWidth = window.innerWidth;
        let barWidth, barSpacing, fontSize;
        
        if (screenWidth <= 480) {
            // Bardzo małe ekrany
            barWidth = Math.min(50, (canvas.width - 60) / 4);
            barSpacing = 15;
            fontSize = '9px Inter';
        } else if (screenWidth <= 768) {
            // Średnie ekrany mobilne
            barWidth = Math.min(60, (canvas.width - 80) / 4);
            barSpacing = 20;
            fontSize = '10px Inter';
        } else {
            // Desktop
            barWidth = 80;
            barSpacing = 40;
            fontSize = '12px Inter';
        }
        
        const chartHeight = canvas.height - 80;
        const startX = (canvas.width - (data.length * barWidth + (data.length - 1) * barSpacing)) / 2;
        
        data.forEach((item, index) => {
            const x = startX + index * (barWidth + barSpacing);
            const barHeight = maxValue > 0 ? (item.value / maxValue) * chartHeight : 0;
            const y = canvas.height - 50 - barHeight;
            
            // Draw bar
            ctx.fillStyle = item.color;
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Draw label
            ctx.fillStyle = '#333';
            ctx.font = fontSize;
            ctx.textAlign = 'center';
            ctx.fillText(item.label, x + barWidth / 2, canvas.height - 30);
            
            // Draw value
            ctx.fillText(item.value.toString(), x + barWidth / 2, y - 10);
        });
    }

    setResponsiveCanvasSize(canvas) {
        const container = canvas.parentElement;
        const containerWidth = container.clientWidth;
        const screenWidth = window.innerWidth;
        
        // Ustaw rozmiar canvas na podstawie rozmiaru ekranu
        if (screenWidth <= 480) {
            // Bardzo małe ekrany
            canvas.width = Math.min(containerWidth - 10, 280);
            canvas.height = 160;
        } else if (screenWidth <= 768) {
            // Średnie ekrany mobilne
            canvas.width = Math.min(containerWidth - 20, 350);
            canvas.height = 180;
        } else {
            // Desktop
            canvas.width = Math.min(containerWidth - 40, 400);
            canvas.height = 200;
        }
        
        // Ustaw CSS dla lepszego wyświetlania
        canvas.style.width = canvas.width + 'px';
        canvas.style.height = canvas.height + 'px';
    }

    // Dynamic Category Management
    async generateDynamicCategory() {
        if (!this.settings.aiApiKey && this.settings.aiProvider !== 'free') {
            console.warn('Brak klucza API - nie można generować dynamicznych kategorii');
            return null;
        }

        try {
            // Analizuj słabsze obszary użytkownika
            const weakAreas = this.learningPatterns.weakAreas || [];
            const userLevel = this.settings.languageLevel;
            const existingCategories = this.wordCategories.join(', ');
            
            const prompt = `Jako ekspert w nauczaniu języka angielskiego, zaproponuj JEDNĄ nową kategorię słownictwa dla polskiego ucznia na poziomie ${userLevel}.

KONTEKST:
- Istniejące kategorie: ${existingCategories}
- Słabe obszary użytkownika: ${weakAreas.length > 0 ? weakAreas.join(', ') : 'brak danych'}
- Poziom: ${userLevel}

WYMAGANIA:
1. Kategoria powinna być praktyczna i użyteczna
2. Nie może duplikować istniejących kategorii
3. Powinna być odpowiednia dla poziomu ${userLevel}
4. Zwróć TYLKO nazwę kategorii po polsku (jedno słowo lub krótką frazę)

Przykłady dobrych kategorii: "medycyna", "finanse", "prawo", "psychologia", "architektura"

Odpowiedź (tylko nazwa kategorii):`;

            let response;
            switch (this.settings.aiProvider) {
                case 'free':
                    response = await this.generateCategoryFromTemplate(userLevel, weakAreas);
                    break;
                case 'openai':
                    response = await this.callOpenAI(prompt);
                    break;
                case 'anthropic':
                    response = await this.callAnthropic(prompt);
                    break;
                case 'gemini':
                    response = await this.callGemini(prompt);
                    break;
                case 'huggingface':
                    response = await this.callHuggingFace(prompt);
                    break;
                default:
                    return null;
            }

            const newCategory = response.trim().toLowerCase();
            
            // Walidacja kategorii
            if (this.isValidCategory(newCategory)) {
                return newCategory;
            }
            
            return null;
        } catch (error) {
            console.error('Błąd generowania dynamicznej kategorii:', error);
            return null;
        }
    }

    generateCategoryFromTemplate(level, weakAreas) {
        // Szablon kategorii dla darmowego trybu
        const categoryTemplates = {
            'A1': ['dom', 'jedzenie', 'rodzina', 'zwierzęta', 'kolory'],
            'A2': ['szkoła', 'praca', 'hobby', 'sport', 'zakupy'],
            'B1': ['zdrowie', 'technologia', 'podróże', 'kultura', 'środowisko'],
            'B2': ['biznes', 'polityka', 'nauka', 'media', 'psychologia'],
            'C1': ['filozofia', 'ekonomia', 'prawo', 'medycyna', 'inżynieria'],
            'C2': ['dyplomacja', 'literatura', 'architektura', 'astronomia', 'lingwistyka']
        };

        const availableCategories = categoryTemplates[level] || categoryTemplates['B1'];
        const unusedCategories = availableCategories.filter(cat => 
            !this.wordCategories.includes(cat)
        );

        if (unusedCategories.length > 0) {
            return unusedCategories[Math.floor(Math.random() * unusedCategories.length)];
        }

        return null;
    }

    isValidCategory(category) {
        // Sprawdź czy kategoria nie istnieje już
        if (this.wordCategories.includes(category)) {
            return false;
        }

        // Sprawdź długość i format
        if (!category || category.length < 3 || category.length > 20) {
            return false;
        }

        // Sprawdź czy zawiera tylko litery, spacje i polskie znaki
        const validPattern = /^[a-ząćęłńóśźż\s]+$/i;
        return validPattern.test(category);
    }

    async addDynamicCategory(category) {
        if (!this.dynamicCategories.includes(category)) {
            this.dynamicCategories.push(category);
            this.wordCategories = [...this.baseCategories, ...this.dynamicCategories];
            this.categoryUsageStats[category] = {
                wordsGenerated: 0,
                successRate: 0,
                lastUsed: new Date().toISOString()
            };
            this.saveData();
            console.log(`Dodano nową dynamiczną kategorię: ${category}`);
            return true;
        }
        return false;
    }

    updateCategoryStats(category, isCorrect = true) {
        if (!this.categoryUsageStats[category]) {
            this.categoryUsageStats[category] = {
                wordsGenerated: 0,
                successRate: 0,
                lastUsed: new Date().toISOString()
            };
        }

        const stats = this.categoryUsageStats[category];
        stats.wordsGenerated++;
        stats.lastUsed = new Date().toISOString();
        
        // Aktualizuj wskaźnik sukcesu (prosty algorytm)
        if (isCorrect) {
            stats.successRate = (stats.successRate + 1) / 2;
        } else {
            stats.successRate = stats.successRate * 0.9;
        }

        this.saveData();
    }

    async selectOptimalCategory() {
        // 1. Sprawdź czy potrzebujemy nowej dynamicznej kategorii
        const shouldGenerateNewCategory = await this.shouldGenerateNewCategory();
        
        if (shouldGenerateNewCategory) {
            const newCategory = await this.generateDynamicCategory();
            if (newCategory) {
                await this.addDynamicCategory(newCategory);
                console.log(`🎯 Wygenerowano nową kategorię: ${newCategory}`);
                return newCategory;
            }
        }

        // 2. Wybierz optymalną kategorię z istniejących
        return this.selectBestExistingCategory();
    }

    async shouldGenerateNewCategory() {
        // Generuj nową kategorię jeśli:
        // - Mamy mniej niż 50 kategorii łącznie
        // - Użytkownik ma dobry postęp (>70% accuracy)
        // - Ostatnia dynamiczna kategoria była dodana >7 dni temu
        // - Losowa szansa 20% przy każdym generowaniu

        if (this.wordCategories.length >= 50) {
            return false; // Limit kategorii
        }

        const userAccuracy = this.calculateAverageAccuracy();
        if (userAccuracy < 70) {
            return false; // Użytkownik powinien najpierw opanować istniejące kategorie
        }

        // Sprawdź kiedy ostatnio dodano dynamiczną kategorię
        const lastDynamicCategory = this.getLastDynamicCategoryDate();
        const daysSinceLastCategory = lastDynamicCategory ? 
            (Date.now() - new Date(lastDynamicCategory).getTime()) / (1000 * 60 * 60 * 24) : 999;

        if (daysSinceLastCategory < 7) {
            return false; // Za wcześnie na nową kategorię
        }

        // 20% szansy na nową kategorię
        return Math.random() < 0.2;
    }

    getLastDynamicCategoryDate() {
        if (this.dynamicCategories.length === 0) return null;
        
        const lastCategory = this.dynamicCategories[this.dynamicCategories.length - 1];
        return this.categoryUsageStats[lastCategory]?.lastUsed || null;
    }

    selectBestExistingCategory() {
        // Algorytm wyboru optymalnej kategorii:
        // 1. Preferuj kategorie z niskim użyciem
        // 2. Uwzględnij słabe obszary użytkownika
        // 3. Dodaj element losowości

        const categoryScores = this.wordCategories.map(category => {
            const stats = this.categoryUsageStats[category] || { wordsGenerated: 0, successRate: 0.5 };
            const wordsInCategory = this.words.filter(w => w.category === category).length;
            
            // Punktacja: niższe użycie = wyższy wynik
            let score = Math.max(0, 100 - wordsInCategory * 2);
            
            // Bonus dla słabych obszarów
            if (this.learningPatterns.weakAreas.includes(category)) {
                score += 30;
            }
            
            // Bonus dla kategorii z niskim wskaźnikiem sukcesu (potrzebują więcej praktyki)
            if (stats.successRate < 0.6) {
                score += 20;
            }
            
            // Element losowości
            score += Math.random() * 20;
            
            return { category, score };
        });

        // Sortuj według wyniku i wybierz najlepszą
        categoryScores.sort((a, b) => b.score - a.score);
        
        // Wybierz z top 3 kategorii (dodatkowa losowość)
        const topCategories = categoryScores.slice(0, 3);
        const selectedCategory = topCategories[Math.floor(Math.random() * topCategories.length)];
        
        console.log(`📊 Wybrano kategorię: ${selectedCategory.category} (wynik: ${selectedCategory.score.toFixed(1)})`);
        return selectedCategory.category;
    }

    // AI Word Generation
    async generateNewWords(count = 5) {
    if (this.isGeneratingWords) return;
    
    this.isGeneratingWords = true;
    const generateBtn = document.getElementById('generate-words');
    const originalText = generateBtn.textContent;
    
    // Update UI to show loading state
    generateBtn.disabled = true;
    generateBtn.classList.add('generating');
    generateBtn.textContent = '🤖 Generuję nowe słowa...';
    
    // Inteligentny wybór kategorii (w tym dynamicznych)
    const category = await this.selectOptimalCategory();
    
    try {
       let newWords = await this.getWordsFromAI(category, this.settings.languageLevel, count);
       // AI self-check of translations to catch semantic mismatches
       if (this.settings.enableAISelfCheck && this.settings.aiProvider !== 'free' && this.settings.aiApiKey) {
           try {
               newWords = await this.selfCheckAndFixTranslations(newWords);
           } catch (e) {
               console.warn('AI self-check failed, using original words:', e);
           }
       }
        
        // Ulepszone filtrowanie duplikatów
        const existingKeys = new Set(
            this.words.map(w => `${w.polish.toLowerCase()}-${w.english.toLowerCase()}`)
        );
        
        const uniqueWords = newWords.filter(newWord => {
            const key = `${newWord.polish.toLowerCase()}-${newWord.english.toLowerCase()}`;
            return !existingKeys.has(key);
        });
        
        // Jeśli mamy za mało unikalnych słów, spróbuj z innej kategorii
        if (uniqueWords.length < count) {
            const additionalCategories = this.wordCategories.filter(c => c !== category);
            for (const additionalCategory of additionalCategories) {
                if (uniqueWords.length >= count) break;
                
                const moreWords = await this.getWordsFromAI(
                    additionalCategory, 
                    this.settings.languageLevel, 
                    count - uniqueWords.length
                );
                
                moreWords.forEach(word => {
                    const key = `${word.polish.toLowerCase()}-${word.english.toLowerCase()}`;
                    if (!existingKeys.has(key)) {
                        uniqueWords.push(word);
                        existingKeys.add(key);
                    }
                });
            }
        }
        
        this.words.push(...uniqueWords);
        this.saveData();
        this.updateStats();
        
        if (uniqueWords.length > 0) {
            generateBtn.textContent = `✅ Dodano ${uniqueWords.length} słów z kategorii: ${category}!`;
            console.log(`Dodano ${uniqueWords.length} nowych słów`);
            
            // Show success message
            setTimeout(() => {
                generateBtn.textContent = originalText;
            }, 3000);
        } else {
            generateBtn.textContent = `⚠️ Brak nowych słów - spróbuj zmienić poziom`;
            setTimeout(() => {
                generateBtn.textContent = originalText;
            }, 3000);
        }
    } catch (error) {
        console.error('Błąd podczas generowania słów:', error);
        generateBtn.textContent = '❌ Błąd generowania';
        setTimeout(() => {
            generateBtn.textContent = originalText;
        }, 2000);
    } finally {
        this.isGeneratingWords = false;
        generateBtn.disabled = false;
        generateBtn.classList.remove('generating');
    }
}

    // ZMIANA: Zaktualizowano `getWordsFromAI` o opcję 'huggingface'
async getWordsFromAI(category, level, count) {
   // Note: downstream may run selfCheckAndFixTranslations if enabled

    // Obsługa trybu darmowego bez klucza API
    if (this.settings.aiProvider === 'free') {
        return await this.getFreeAIWords(category, level, count);
    }

    if (!this.settings.aiApiKey) {
        throw new Error('Brak klucza API. Wprowadź go w ustawieniach.');
    }
    
    // Generujemy prompt i odpytujemy AI o gotowe pary słów
    const prompt = this.buildAIPrompt(category, level, count);
    let aiResponse;
    switch (this.settings.aiProvider) {
        case 'openai': aiResponse = await this.callOpenAI(prompt); break;
        case 'anthropic': aiResponse = await this.callAnthropic(prompt); break;
        case 'gemini': aiResponse = await this.callGemini(prompt); break;
        case 'huggingface': aiResponse = await this.callHuggingFace(prompt); break;
        default: throw new Error('Nieznany dostawca AI');
    }

    // Parsujemy odpowiedź i otrzymujemy gotowe, sformatowane słowa
    const newWords = await this.parseAIResponse(aiResponse, category);
    
    if (newWords.length === 0) {
        console.warn("AI nie zwróciło żadnych poprawnych słów. Spróbuj ponownie lub zmień ustawienia AI.");
    }

    return newWords;
}

// Nowa funkcja dla całkowicie darmowych słów
async getFreeAIWords(category, level, count) {
    console.log(`Generowanie darmowych słów AI: ${count} słów z kategorii "${category}" poziom ${level}`);
    
    try {
        // Generuj słowa tematycznie na podstawie kategorii
        const words = [];
        
        // Podstawowe słowa dla każdej kategorii (używane do generowania powiązanych)
        const seedWords = {
            'dom': ['house', 'room', 'furniture'],
            'jedzenie': ['food', 'meal', 'cooking'],
            'transport': ['vehicle', 'travel', 'journey'],
            'praca': ['work', 'office', 'career'],
            'natura': ['nature', 'environment', 'outdoor'],
            'technologia': ['technology', 'computer', 'digital'],
            'sport': ['sport', 'exercise', 'fitness'],
            'kultura': ['culture', 'art', 'entertainment']
        };
        
        // Poziomy trudności
        const difficultyMap = {
            'A1': 'basic everyday',
            'A2': 'simple common',
            'B1': 'intermediate useful',
            'B2': 'advanced practical',
            'C1': 'proficient complex',
            'C2': 'mastery sophisticated'
        };
        
        const difficulty = difficultyMap[level] || 'intermediate useful';
        const categorySeeds = seedWords[category] || seedWords['dom'];
        
        // Generuj prompt dla tłumaczenia
        for (let i = 0; i < count; i++) {
            // Twórz kontekstowy prompt
            const contextPrompt = `${difficulty} ${category} vocabulary word ${i + 1}`;
            
            // Pobierz tłumaczenie z darmowego API
            try {
                // Najpierw wygeneruj angielskie słowo związane z kategorią
                const englishWord = await this.generateRelatedWord(category, level, i);
                
                if (englishWord) {
                    // Pobierz polskie tłumaczenie
                    const polishWord = await this.getPolishTranslation(englishWord);
                    
                    if (polishWord) {
                        words.push({
                            polish: polishWord,
                            english: englishWord,
                            status: 'new',
                            attempts: 0,
                            correct: 0,
                            lastReview: null,
                            nextReview: null,
                            category: category,
                            difficulty: this.mapLevelToDifficulty(level),
                            hasImage: true,
                            level: level,
                            aiGenerated: true
                        });
                    }
                }
            } catch (error) {
                console.warn(`Nie udało się wygenerować słowa ${i + 1}:`, error);
            }
        }
        
        // Jeśli nie udało się wygenerować wystarczającej liczby słów
        if (words.length < count) {
            console.warn(`Wygenerowano tylko ${words.length} z ${count} słów`);
        }
        
        return words;
        
    } catch (error) {
        console.error('Błąd w getFreeAIWords:', error);
        return [];
    }
}

// Pomocnicza funkcja do generowania powiązanych słów
async generateRelatedWord(category, level, index) {
    // Lista tematycznych słów dla każdej kategorii i poziomu
    const thematicWords = {
        'dom': {
            'A1': ['door', 'window', 'bed', 'chair', 'table', 'kitchen', 'bathroom', 'garden'],
            'A2': ['carpet', 'curtain', 'shelf', 'drawer', 'ceiling', 'stairs', 'attic', 'garage'],
            'B1': ['furniture', 'appliance', 'decoration', 'renovation', 'landlord', 'tenant', 'mortgage'],
            'B2': ['maintenance', 'plumbing', 'insulation', 'ventilation', 'foundation', 'blueprint']
        },
        'jedzenie': {
            'A1': ['bread', 'milk', 'egg', 'apple', 'water', 'meat', 'rice', 'salad'],
            'A2': ['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'ingredient', 'recipe'],
            'B1': ['nutrition', 'vitamin', 'protein', 'vegetarian', 'organic', 'calories', 'diet'],
            'B2': ['cuisine', 'gourmet', 'seasoning', 'marinate', 'garnish', 'culinary']
        },
        'transport': {
            'A1': ['car', 'bus', 'train', 'bike', 'walk', 'stop', 'ticket', 'road'],
            'A2': ['journey', 'passenger', 'driver', 'traffic', 'parking', 'fuel', 'route'],
            'B1': ['commute', 'vehicle', 'transportation', 'schedule', 'delay', 'destination'],
            'B2': ['infrastructure', 'congestion', 'sustainable', 'logistics', 'freight']
        }
        // Dodaj więcej kategorii według potrzeb
    };
    
    const categoryWords = thematicWords[category]?.[level] || thematicWords['dom']['A1'];
    
    // Wybierz słowo z listy (z rotacją)
    const wordIndex = index % categoryWords.length;
    return categoryWords[wordIndex];
}



// Mapowanie poziomu na trudność
mapLevelToDifficulty(level) {
    const map = {
        'A1': 'easy',
        'A2': 'easy',
        'B1': 'medium',
        'B2': 'medium',
        'C1': 'hard',
        'C2': 'hard'
    };
    return map[level] || 'medium';
}

// Alternatywne darmowe API - LibreTranslate
async getTranslationFromLibre(polishWord) {
    try {
        // Lista publicznych instancji LibreTranslate
        const servers = [
            'https://translate.argosopentech.com',
            'https://translate.terraprint.co'
        ];
        
        for (const server of servers) {
            try {
                const response = await fetch(`${server}/translate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        q: polishWord,
                        source: 'pl',
                        target: 'en',
                        format: 'text'
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.translatedText) {
                        return data.translatedText;
                    }
                }
            } catch (error) {
                continue; // Spróbuj następny serwer
            }
        }
        
        return null;
    } catch (error) {
        console.error('LibreTranslate error:', error);
        return null;
    }
}


    getIntelligentWordsByLevel(level, category, count) {
        // Rozszerzona baza słów z inteligentnym doborem
        const userProgress = this.analyzeUserProgress();
        const existingWords = this.words.map(w => w.english.toLowerCase());
        
        return this.getWordsByLevel(level, category, count, existingWords, userProgress);
    }

getWordsByLevel(level, category, count, existingWords = [], userProgress = null) {
    // To jest tylko awaryjny fallback gdy AI nie działa
    // Zwracamy minimalną liczbę podstawowych słów
    console.log(`Fallback: generowanie ${count} słów dla kategorii ${category} na poziomie ${level}`);
    
    // Tylko kilka podstawowych słów jako ostatnia deska ratunku
    const fallbackWords = [
        { polish: 'przykład', english: 'example' },
        { polish: 'słowo', english: 'word' },
        { polish: 'nauka', english: 'learning' },
        { polish: 'język', english: 'language' },
        { polish: 'angielski', english: 'English' }
    ];
    
    // Filtruj słowa które już istnieją
    const availableWords = fallbackWords.filter(word => 
        !existingWords.includes(word.english.toLowerCase())
    );
    
    // Jeśli nie ma dostępnych słów, zwróć pustą tablicę
    if (availableWords.length === 0) {
        console.warn('Brak dostępnych słów w fallback');
        return [];
    }
    
    // Zwróć tylko tyle słów ile potrzeba
    return availableWords.slice(0, Math.min(count, availableWords.length)).map(word => ({
        ...word,
        status: 'new',
        attempts: 0,
        correct: 0,
        lastReview: null,
        nextReview: null,
        category: category,
        difficulty: 'medium',
        hasImage: true,
        level: level,
        isFallback: true // Oznacz że to słowo z fallbacku
    }));
}

    calculateWordDifficulty(word, level) {
        const levelDifficulty = {
            'A1': 'easy',
            'A2': 'easy', 
            'B1': 'medium',
            'B2': 'medium',
            'C1': 'hard',
            'C2': 'hard'
        };
        return levelDifficulty[level] || 'medium';
    }

    addFallbackWords(count) {
        const fallbackWords = [
            { polish: 'przykład', english: 'example' },
            { polish: 'problem', english: 'problem' },
            { polish: 'rozwiązanie', english: 'solution' },
            { polish: 'informacja', english: 'information' },
            { polish: 'komunikacja', english: 'communication' }
        ];

        const wordsToAdd = fallbackWords.slice(0, count).map(word => ({
            ...word,
            status: 'new',
            attempts: 0,
            correct: 0,
            lastReview: null,
            nextReview: null
        }));

        this.words.push(...wordsToAdd);
        this.saveData();
    }

    // AI Integration Functions
 buildAIPrompt(category, level, count) {
    const existingWords = this.words.map(w => w.english).slice(-20).join(', ');

    // Dla Gemini użyj zwięzłego promptu i minimalnego formatu (zmniejsza ryzyko MAX_TOKENS)
    if (this.settings.aiProvider === 'gemini') {
        return `Jesteś leksykografem. Zwróć TYLKO JSON (tablica obiektów) bez markdown i bez komentarzy.

KONTEKST:
- Temat: ${category}
- Poziom: ${level} (CEFR)
- Unikaj słów już użytych: ${existingWords}

ZADANIE:
- Wygeneruj ${count} par PL→EN związanych z tematem.
- Każdy element: {"polish":"…","english":"…"} (dokładnie te dwa pola).
- Bez dodatkowych pól (brak sources, examples, notes itp.).

GUARDY:
- Nie zwracaj english == polish (wyjątki: "hotel", "internet", "radio").
- "parapet" (PL, okienny) → "windowsill" (lub "window ledge").
- "skosy" (we wnętrzach/poddasze) → "sloped ceilings" lub "pitched ceilings".
`;
    }

    // Domyślny (bogatszy) prompt dla pozostałych dostawców
    return `Jesteś leksykografem. Zwróć TYLKO JSON (tablica obiektów), bez dodatkowych komentarzy.

KONTEKST:
- Temat: ${category}
- Poziom: ${level} (CEFR)
- Unikaj słów już użytych: ${existingWords}

ZADANIE:
- Wygeneruj ${count} haseł PL→EN, ściśle związanych z tematem i dopasowanych do poziomu.

FORMAT (dokładnie):
[
  {
    "polish": "…",
    "english": "…",
    "verified": true|false,
    "sources": [{ "name": "…", "url": "…" }],
    "examples": [{ "text": "…dokładny cytat…", "source": "…", "url": "…", "exactQuote": true }],
    "notes": "krótka uwaga (np. o rejestrze lub rozróżnieniu znaczeń)"
  }
]

ZASADY PRZEGLĄDANIA (jeśli masz dostęp do sieci):
- verified=true TYLKO jeśli zweryfikujesz znaczenie w ≥2 wiarygodnych źródłach (Cambridge/Merriam‑Webster/Collins/Oxford/Wiktionary/PWN/Diki). Nie używaj linków wymyślonych.
- examples: 1–2 autentyczne zdania z Internetu; wklej dokładny cytat (exactQuote=true) i link do źródła.
- Jeśli nie możesz zweryfikować online: ustaw verified=false, sources=[], examples=[]. Nie wymyślaj cytatów ani linków.

GUARDY PRZECIW BŁĘDOM:
1) Nie zwracaj english == polish (po znormalizowaniu) chyba że to oczywisty internacjonalizm (np. "hotel", "internet", "radio").
2) "parapet" (PL, okienny) → "windowsill" (preferowane) lub "window ledge". Uwaga: ang. "parapet" to niska ścianka ochronna (na dachu/mostku/balkonie).
3) "skosy" (we wnętrzach/poddasze) → preferuj "sloped ceilings" lub "pitched ceilings". Gdy chodzi o ściany: "slanted walls/sloped walls" zależnie od kontekstu.
4) Przed zwrotem JSON wykonaj autokontrolę: brak nieuzasadnionych form english==polish; jeśli browsing działa – czy verified=true ma ≥2 sources i 1–2 examples z linkami.
`;
}

    async callOpenAI(prompt) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.aiApiKey}`
            },
            body: JSON.stringify({
                model: this.settings.aiModel,
                messages: [
                    {
                        role: 'system',
                        content: 'Jesteś ekspertem w nauczaniu języka angielskiego. Odpowiadaj tylko w formacie JSON.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async callAnthropic(prompt) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.settings.aiApiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`Anthropic API error: ${response.status}`);
        }

        const data = await response.json();
        return data.content[0].text;
    }

    // Ask the selected AI provider to validate/fix EN↔PL mapping
    async selfCheckAndFixTranslations(words) {
        try {
            if (!Array.isArray(words) || words.length === 0) return words;
            const examples = words.slice(0, 20).map(w => ({ polish: w.polish, english: w.english }));
            const instruction = `You are a bilingual lexicographer. Validate that each English word truly matches the Polish meaning (same sense). Return JSON array with items: {polish, english, fixedEnglish, verdict}. Rules:
- verdict = "ok" if match is semantically correct;
- verdict = "fix" if the English term is wrong/too broad/wrong sense; then provide fixedEnglish with the best single-word or short multi-word alternative that matches the Polish meaning used in everyday language.
- If multiple senses exist, pick the sense that corresponds to the Polish term (like a dictionary headword). Avoid paraphrases unless necessary.`;
            const payload = JSON.stringify(examples);
            const prompt = `${instruction}\n\nDATA:\n${payload}\n\nReturn ONLY JSON array.`;

            let respText = '';
            switch (this.settings.aiProvider) {
                case 'openai': respText = await this.callOpenAI(prompt); break;
                case 'anthropic': respText = await this.callAnthropic(prompt); break;
                case 'gemini': respText = await this.callGemini(prompt); break;
                default: return words;
            }
            const checked = await this.parseAIResponse(respText, 'inne');
            // parseAIResponse returns our internal shape; map back only the fixes
            const fixesByPl = new Map();
            try {
                const raw = JSON.parse(String(respText).replace(/```json|```/g, ''));
                if (Array.isArray(raw)) {
                    raw.forEach(item => {
                        if (item && typeof item === 'object' && item.polish && item.fixedEnglish && item.verdict) {
                            fixesByPl.set(String(item.polish).trim().toLowerCase(), {
                                verdict: String(item.verdict).trim().toLowerCase(),
                                fixedEnglish: String(item.fixedEnglish).trim()
                            });
                        }
                    });
                }
            } catch (_) {}

            return words.map(w => {
                const k = String(w.polish || '').trim().toLowerCase();
                const fix = fixesByPl.get(k);
                if (fix && fix.verdict === 'fix' && fix.fixedEnglish) {
                    return { ...w, english: fix.fixedEnglish, verified: true };
                }
                return w;
            });
        } catch (e) {
            console.warn('selfCheckAndFixTranslations error:', e);
            return words;
        }
    }

    async callGemini(prompt, options = {}) {
        // Użyj wybranego modelu z ustawień lub domyślnie Gemini 2.5 Flash
        const model = (this.settings.aiModel && String(this.settings.aiModel).startsWith('gemini-'))
            ? this.settings.aiModel
            : 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${this.settings.aiApiKey}`;

        const generationConfig = {
            temperature: 0.5,
            topK: 32,
            topP: 0.9,
            maxOutputTokens: 2048
        };
        if (options && options.responseMimeType) {
            generationConfig.responseMimeType = options.responseMimeType;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: prompt
                            }
                        ]
                    }
                ],
                generationConfig
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Jeśli API zwróciło blokadę bezpieczeństwa lub brak kandydatów – pokaż czytelną informację
        const candidates = Array.isArray(data.candidates) ? data.candidates : [];
        if (candidates.length === 0) {
            const pf = data.promptFeedback || {};
            const safety = pf.safetyRatings || pf.blockReason || pf.feedback || null;
            const msg = safety ? `Brak kandydatów (safety): ${JSON.stringify(safety)}` : 'Brak kandydatów w odpowiedzi';
            throw new Error(`Nieprawidłowa odpowiedź z Gemini API: ${msg}`);
        }

        // Bezpieczne wyciągnięcie tekstu z różnych możliwych kształtów odpowiedzi
        const first = candidates[0];
        let text = '';
        const parts = first && first.content && Array.isArray(first.content.parts) ? first.content.parts : null;
        if (parts) {
            const withText = parts.find(p => typeof p.text === 'string' && p.text.trim().length > 0);
            if (withText) {
                text = withText.text;
            } else {
                text = parts.map(p => p && p.text ? p.text : '').filter(Boolean).join('\n').trim();
            }
        }
        if (!text && first && first.content && typeof first.content.text === 'string') {
            text = first.content.text;
        }
        if (!text && typeof first.output === 'string') {
            text = first.output;
        }

        if (!text || !text.trim()) {
            const shortDump = (() => {
                try { return JSON.stringify(data).slice(0, 800); } catch (_) { return '[unserializable]'; }
            })();
            throw new Error(`Nieprawidłowa odpowiedź z Gemini API: brak treści tekstowej. Debug: ${shortDump}`);
        }

        return text.trim();
    }

    // NOWA FUNKCJA: Do obsługi Hugging Face API
async callHuggingFace(prompt) {
    // Użyj darmowego API bez klucza - np. przez proxy lub publiczne endpointy
    try {
        // Opcja 1: Użyj darmowego tłumaczenia z MyMemory
        const words = await this.generateWordsWithTranslation(prompt);
        // Zwróć bezpośrednio tablicę w formacie JSON, kompatybilną z parseAIResponse
        return JSON.stringify(words);
    } catch (error) {
        console.error('Błąd generowania słów:', error);
        throw error;
    }
}

async generateWordsWithTranslation(prompt) {
    // Wyciągnij informacje z promptu
    const categoryMatch = prompt.match(/kategorii "([^"]+)"/);
    const levelMatch = prompt.match(/poziomie (\w+)/);
    const countMatch = prompt.match(/Wygeneruj (\d+) słów/);
    
    const category = categoryMatch ? categoryMatch[1] : 'dom';
    const level = levelMatch ? levelMatch[1] : 'B1';
    const count = countMatch ? parseInt(countMatch[1]) : 5;
    
    // Użyj lokalnej bazy słów
    const baseWords = this.getIntelligentWordsByLevel(level, category, count);
    
    // Dla każdego słowa spróbuj uzyskać lepsze tłumaczenie
    const enhancedWords = [];
    
    for (const word of baseWords) {
        try {
            // Opcja: Użyj darmowego API MyMemory
            const translation = await this.getTranslationFromMyMemory(word.polish);
            if (translation) {
                word.english = translation;
                word.verified = true;
            }
        } catch (error) {
            console.warn('Używam lokalnego tłumaczenia dla:', word.polish);
        }
        enhancedWords.push(word);
    }
    
    return enhancedWords;
}

// Dodaj funkcję do darmowego tłumaczenia z MyMemory
async getTranslationFromMyMemory(polishWord) {
    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(polishWord)}&langpair=pl|en`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('MyMemory API error');
        }
        
        const data = await response.json();
        if (data.responseData && data.responseData.translatedText) {
            return data.responseData.translatedText;
        }
        
        return null;
    } catch (error) {
        console.error('MyMemory translation error:', error);
        return null;
    }
}

// Tłumaczenie EN -> PL (na potrzeby trybu darmowego)
async getPolishTranslation(englishWord) {
    // Najpierw spróbuj MyMemory (en->pl)
    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(englishWord)}&langpair=en|pl`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data.responseData && data.responseData.translatedText) {
                return data.responseData.translatedText;
            }
        }
    } catch (error) {
        console.warn('MyMemory en->pl failed:', error);
    }

    // Fallback: LibreTranslate (en->pl)
    try {
        const servers = [
            'https://translate.argosopentech.com',
            'https://translate.terraprint.co'
        ];
        for (const server of servers) {
            try {
                const response = await fetch(`${server}/translate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q: englishWord, source: 'en', target: 'pl', format: 'text' })
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.translatedText) {
                        return data.translatedText;
                    }
                }
            } catch (e) {
                continue;
            }
        }
    } catch (error) {
        console.error('LibreTranslate en->pl error:', error);
    }

    return null;
}

// Ustawienie stanu pola klucza API wg providera
updateApiKeyFieldState() {
    const input = document.getElementById('ai-api-key');
    if (!input) return;
    const isFree = this.settings.aiProvider === 'free';
    input.disabled = isFree;
    input.placeholder = isFree ? 'Nie wymagany dla trybu darmowego' : 'Wprowadź swój klucz API';
}


   async parseAIResponse(response, category = 'inne') {
    // Parser odporny na code-fence'y, dopiski i częściowo uszkodzony JSON
    try {
        // Usuń znaczniki ``` i ```json
        let cleaned = String(response || '')
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim();

        // Spróbuj wyciąć fragment między pierwszym '[' a ostatnim ']'
        const firstBracket = cleaned.indexOf('[');
        const lastBracket = cleaned.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket > firstBracket) {
            cleaned = cleaned.slice(firstBracket, lastBracket + 1);
        }

        // Główna próba parsowania
        let parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) {
            throw new Error('Odpowiedź AI nie jest tablicą.');
        }

        // Walidacja elementów
        const validWords = parsed.filter(item =>
            typeof item === 'object' &&
            item !== null &&
            typeof item.polish === 'string' && item.polish.trim() !== '' &&
            typeof item.english === 'string' && item.english.trim() !== ''
        );
        if (validWords.length !== parsed.length) {
            console.warn('Niektóre obiekty od AI miały nieprawidłowy format i zostały odrzucone.');
        }

        // Mapowanie na wewnętrzny format
        return validWords.map(word => ({
            polish: word.polish,
            english: word.english,
            status: 'new',
            attempts: 0,
            correct: 0,
            lastReview: null,
            nextReview: null,
            aiGenerated: true,
            hasImage: true,
            verified: !!word.verified,
            sources: Array.isArray(word.sources) ? word.sources : [],
            examples: Array.isArray(word.examples)
                ? word.examples.map(ex => ({
                    text: ex.text || ex.quote || '',
                    source: ex.source || '',
                    url: ex.url || '',
                    exactQuote: !!ex.exactQuote
                }))
                : [],
            category: word.category || category,
            difficulty: this.mapLevelToDifficulty(this.settings.languageLevel),
            level: this.settings.languageLevel
        }));
    } catch (err) {
        // Próba ratunkowa: wyciągnij pary polish/english z tekstu zwykłym regexem
        try {
            const text = String(response || '');
            const pairRegex = /\"polish\"\s*:\s*\"([^\"]+)\"[\s\S]*?\"english\"\s*:\s*\"([^\"]+)\"/gi;
            const results = [];
            const seen = new Set();
            let m;
            while ((m = pairRegex.exec(text)) !== null) {
                const pl = m[1].trim();
                const en = m[2].trim();
                if (pl && en) {
                    const key = `${pl.toLowerCase()}|${en.toLowerCase()}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        results.push({ polish: pl, english: en });
                    }
                }
            }
            if (results.length > 0) {
                console.warn('JSON od AI był niepoprawny – odzyskano pary poprzez analizę tekstu.');
                return results.map(word => ({
                    polish: word.polish,
                    english: word.english,
                    status: 'new',
                    attempts: 0,
                    correct: 0,
                    lastReview: null,
                    nextReview: null,
                    aiGenerated: true,
                    hasImage: true,
                    verified: false,
                    sources: [],
                    examples: [],
                    category,
                    difficulty: this.mapLevelToDifficulty(this.settings.languageLevel),
                    level: this.settings.languageLevel
                }));
            }
        } catch (_) {
            // Ignoruj – przejdź do błędu głównego
        }
        console.error('Błąd parsowania odpowiedzi AI:', err, 'Otrzymana odpowiedź:', response);
        throw err;
    }
}

    analyzeUserProgress() {
        const totalWords = this.words.length;
        const learnedWords = this.words.filter(w => w.status === 'learned').length;
        const avgAccuracy = this.calculateAverageAccuracy();
        
        // Analyze learning speed
        let learningSpeed = 'medium';
        if (avgAccuracy > 80) learningSpeed = 'fast';
        else if (avgAccuracy < 50) learningSpeed = 'slow';
        
        // Find weak areas (categories with low success rate)
        const categoryStats = this.analyzeCategoryPerformance();
        const weakAreas = Object.entries(categoryStats)
            .filter(([category, stats]) => stats.accuracy < 60)
            .map(([category]) => category);
        
        // Update learning patterns
        this.learningPatterns.learningSpeed = learningSpeed;
        this.learningPatterns.weakAreas = weakAreas;
        
        return {
            totalWords,
            learnedWords,
            avgAccuracy,
            learningSpeed,
            weakAreas
        };
    }

    calculateAverageAccuracy() {
        const wordsWithAttempts = this.words.filter(w => w.attempts > 0);
        if (wordsWithAttempts.length === 0) return 0;
        
        const totalAccuracy = wordsWithAttempts.reduce((sum, word) => {
            return sum + (word.correct / word.attempts);
        }, 0);
        
        return Math.round((totalAccuracy / wordsWithAttempts.length) * 100);
    }

    analyzeCategoryPerformance() {
        const categoryStats = {};
        
        this.wordCategories.forEach(category => {
            const categoryWords = this.words.filter(w => 
                w.category === category || this.guessWordCategory(w.polish) === category
            );
            
            if (categoryWords.length > 0) {
                const totalAttempts = categoryWords.reduce((sum, w) => sum + w.attempts, 0);
                const totalCorrect = categoryWords.reduce((sum, w) => sum + w.correct, 0);
                
                categoryStats[category] = {
                    words: categoryWords.length,
                    accuracy: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0
                };
            }
        });
        
        return categoryStats;
    }

    guessWordCategory(polishWord) {
        const categoryKeywords = {
            'dom': ['dom', 'okno', 'drzwi', 'łóżko', 'stół', 'krzesło', 'kuchnia', 'łazienka'],
            'jedzenie': ['chleb', 'mleko', 'jabłko', 'mięso', 'ser', 'jedzenie'],
            'transport': ['autobus', 'pociąg', 'rower', 'samolot', 'samochód'],
            'praca': ['praca', 'biuro', 'spotkanie', 'komputer', 'dokument'],
            'technologia': ['oprogramowanie', 'aplikacja', 'sieć', 'komputer'],
            'natura': ['środowisko', 'ekosystem', 'natura', 'drzewo'],
            'sport': ['sport', 'piłka', 'bieganie', 'trening'],
            'kultura': ['kultura', 'muzyka', 'film', 'sztuka']
        };
        
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(keyword => polishWord.toLowerCase().includes(keyword))) {
                return category;
            }
        }
        
        return 'inne';
    }

    // AI-Enhanced Spaced Repetition
    async getAIRecommendedInterval(word, isCorrect) {
        if (!this.settings.enableAIRecommendations || !this.settings.aiApiKey) {
            return this.getStandardInterval(word, isCorrect);
        }

        try {
            const prompt = `Jako ekspert w spaced repetition, określ optymalny interwał powtórki dla słowa.

DANE SŁOWA:
- Słowo: ${word.polish} -> ${word.english}
- Próby: ${word.attempts}
- Poprawne: ${word.correct}
- Status: ${word.status}
- Trudność: ${word.difficulty || 'medium'}
- Ostatnia odpowiedź: ${isCorrect ? 'poprawna' : 'błędna'}

KONTEKST UŻYTKOWNIKA:
- Tempo nauki: ${this.learningPatterns.learningSpeed}
- Średnia dokładność: ${this.calculateAverageAccuracy()}%

Zwróć tylko liczbę dni (1-30) jako interwał do następnej powtórki:`;

            // ZMIANA: Wykorzystujemy dowolnego wybranego dostawcę, w tym HuggingFace
            let response;
            switch (this.settings.aiProvider) {
                case 'openai':
                    response = await this.callOpenAI(prompt);
                    break;
                case 'anthropic':
                    response = await this.callAnthropic(prompt);
                    break;
                case 'gemini':
                    response = await this.callGemini(prompt);
                    break;
                case 'huggingface':
                    response = await this.callHuggingFace(prompt);
                    break;
                default:
                    return this.getStandardInterval(word, isCorrect);
            }

            const interval = parseInt(response.trim());
            
            if (isNaN(interval) || interval < 1 || interval > 30) {
                return this.getStandardInterval(word, isCorrect);
            }
            
            return interval;
        } catch (error) {
            console.error('Błąd AI recommendations:', error);
            return this.getStandardInterval(word, isCorrect);
        }
    }

    getStandardInterval(word, isCorrect) {
        if (isCorrect) {
            if (word.status === 'new') return this.settings.firstInterval;
            if (word.status === 'learning') return this.settings.secondInterval;
            return Math.min(this.settings.secondInterval * 2, 30);
        } else {
            return this.settings.firstInterval;
        }
    }

    // Settings
    loadSettings() {
        document.getElementById('first-interval').value = this.settings.firstInterval;
        document.getElementById('second-interval').value = this.settings.secondInterval;
        document.getElementById('daily-goal').value = this.settings.dailyGoal;
        document.getElementById('language-level').value = this.settings.languageLevel;
        document.getElementById('infinite-learning').checked = this.settings.infiniteLearning;
        document.getElementById('auto-add-words').checked = this.settings.autoAddWords;
        
        // Auto-flip settings
        document.getElementById('auto-flip-enabled').checked = this.settings.autoFlipEnabled;
        document.getElementById('auto-flip-delay').value = this.settings.autoFlipDelay;
        const animSpeedInput = document.getElementById('flashcard-anim-speed');
        const animSpeedValue = document.getElementById('flashcard-anim-speed-value');
        if (animSpeedInput && animSpeedValue) {
            animSpeedInput.value = this.settings.flashcardAnimMs;
            animSpeedValue.textContent = `${this.settings.flashcardAnimMs} ms`;
        }
        
        // AI settings
        const imageProviderSelect = document.getElementById('ai-image-provider');
        const proxyInput = document.getElementById('proxy-base-url');
        if (proxyInput) {
            proxyInput.value = this.settings.proxyBaseUrl || '';
        }
        if (imageProviderSelect) {
            // Tymczasowo wyłączamy Imagen 4 i Gemini Flash Preview na życzenie użytkownika
            const imagenOpt = imageProviderSelect.querySelector('option[value="imagen-4"]');
            const flashOpt = imageProviderSelect.querySelector('option[value="gemini-flash-preview"]');
            if (imagenOpt) { imagenOpt.disabled = true; imagenOpt.textContent = 'Imagen 4 (wyłączone)'; }
            if (flashOpt) { flashOpt.disabled = true; flashOpt.textContent = 'Gemini 2.5 Flash Preview (wyłączone)'; }
            if (this.settings.aiImageProvider !== 'free') {
                this.settings.aiImageProvider = 'free';
                this.saveData();
            }

            imageProviderSelect.value = 'free';
            imageProviderSelect.addEventListener('change', (e) => {
                // Wymuszamy pozostanie przy darmowym providerze
                imageProviderSelect.value = 'free';
                this.settings.aiImageProvider = 'free';
                this.saveData();
            });
        }
        document.getElementById('ai-provider').value = this.settings.aiProvider;
        document.getElementById('ai-api-key').value = this.settings.aiApiKey;
        document.getElementById('ai-model').value = this.settings.aiModel;
        document.getElementById('enable-ai-recommendations').checked = this.settings.enableAIRecommendations;
        document.getElementById('adaptive-difficulty').checked = this.settings.adaptiveDifficulty;
        document.getElementById('enable-imagen').checked = this.settings.enableImagen;
        document.getElementById('enable-diki-verification').checked = this.settings.enableDikiVerification;
        
        this.updateAIModelOptions();
        this.updateApiKeyFieldState();
    }

    // ZMIANA: Dodano opcje dla Hugging Face
updateAIModelOptions() {
    const providerSelect = document.getElementById('ai-provider');
    const apiKeyInput = document.getElementById('ai-api-key');
    if (providerSelect && apiKeyInput) {
        // Ensure field state matches before repopulating models
        apiKeyInput.disabled = providerSelect.value === 'free';
        apiKeyInput.placeholder = providerSelect.value === 'free'
            ? 'Nie wymagany dla trybu darmowego'
            : 'Wprowadź swój klucz API';
    }
    const modelSelect = document.getElementById('ai-model');
    modelSelect.innerHTML = '';
    
    const modelOptions = {
        'free': [
            { value: 'mymemory', text: 'MyMemory (Darmowe tłumaczenie)' },
            { value: 'libre', text: 'LibreTranslate (Open Source)' },
            { value: 'local', text: 'Lokalna baza słów' }
        ],
        'openai': [
            { value: 'gpt-3.5-turbo', text: 'GPT-3.5 Turbo' },
            { value: 'gpt-4', text: 'GPT-4' },
            { value: 'gpt-4-turbo', text: 'GPT-4 Turbo' }
        ],
        'anthropic': [
            { value: 'claude-3-sonnet-20240229', text: 'Claude 3 Sonnet' },
            { value: 'claude-3-opus-20240229', text: 'Claude 3 Opus' },
            { value: 'claude-3-haiku-20240307', text: 'Claude 3 Haiku' }
        ],
        'gemini': [
            { value: 'gemini-2.5-flash', text: 'Gemini 2.5 Flash (Najnowszy)' },
            { value: 'gemini-2.5-pro', text: 'Gemini 2.5 Pro (Zaawansowany)' },
            { value: 'gemini-2.5-flash-lite', text: 'Gemini 2.5 Flash-Lite (Ekonomiczny)' }
        ],
        'huggingface': [
            { value: 'Qwen/Qwen2.5-0.5B-Instruct', text: 'Qwen 2.5 (0.5B) - Szybki' },
            { value: 'microsoft/Phi-3.5-mini-instruct', text: 'Phi 3.5 Mini' },
            { value: 'HuggingFaceH4/zephyr-7b-beta', text: 'Zephyr 7B (może wymagać czasu)' },
            { value: 'TinyLlama/TinyLlama-1.1B-Chat-v1.0', text: 'TinyLlama 1.1B' }
        ]
    };
    
    const currentProvider = this.settings.aiProvider;
    const options = modelOptions[currentProvider] || modelOptions['free'];
    
    options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.value;
        optionEl.textContent = option.text;
        modelSelect.appendChild(optionEl);
    });
    
    // Wybierz odpowiedni model domyślny/istniejący dla bieżącego providera
    const allowedValues = options.map(o => o.value);
    let desired = this.settings.aiModel;

    if (currentProvider === 'free') {
        desired = allowedValues.includes('mymemory') ? 'mymemory' : allowedValues[0];
    } else if (currentProvider === 'gemini') {
        if (!desired || !String(desired).startsWith('gemini-') || !allowedValues.includes(desired)) {
            desired = allowedValues.includes('gemini-2.5-flash') ? 'gemini-2.5-flash' : allowedValues[0];
        }
    } else if (currentProvider === 'openai') {
        if (!desired || !allowedValues.includes(desired)) {
            desired = allowedValues.includes('gpt-3.5-turbo') ? 'gpt-3.5-turbo' : allowedValues[0];
        }
    } else if (currentProvider === 'anthropic') {
        if (!desired || !allowedValues.includes(desired)) {
            desired = allowedValues.includes('claude-3-haiku-20240307') ? 'claude-3-haiku-20240307' : allowedValues[0];
        }
    } else if (currentProvider === 'huggingface') {
        if (!desired || allowedValues.includes(desired) === false) {
            desired = allowedValues[0];
        }
    }

    modelSelect.value = desired;
    this.settings.aiModel = modelSelect.value;
}

    // ZMIANA: Zaktualizowano `testAIConnection` o opcję 'huggingface'
    async testAIConnection() {
    
    const testBtn = document.getElementById('test-ai-connection');
    const originalText = testBtn.textContent;
    
    // Dla darmowego providera nie wymagaj klucza API
    if (this.settings.aiProvider !== 'free' && !this.settings.aiApiKey) {
        alert('Najpierw wprowadź klucz API');
        return;
    }
    
    testBtn.disabled = true;
    testBtn.textContent = '🔄 Testowanie...';
    
    try {
        const testPrompt = 'Odpowiedz tylko "OK" jeśli otrzymujesz tę wiadomość.';
        let response;
        
        switch (this.settings.aiProvider) {
            case 'free':
                // Test darmowego API
                const testTranslation = await this.getTranslationFromMyMemory('test');
                response = testTranslation ? 'OK' : 'FAIL';
                break;
            case 'openai':
                response = await this.callOpenAI(testPrompt);
                break;
            case 'anthropic':
                response = await this.callAnthropic(testPrompt);
                break;
            case 'gemini':
                response = await this.callGemini(testPrompt);
                break;
            case 'huggingface':
                response = await this.callHuggingFace(testPrompt);
                break;
        }
        
        testBtn.textContent = '✅ Połączenie OK';
        setTimeout(() => {
            testBtn.textContent = originalText;
        }, 3000);
        
    } catch (error) {
        console.error('Test AI failed:', error);
        testBtn.textContent = '❌ Błąd połączenia';
        setTimeout(() => {
            testBtn.textContent = originalText;
        }, 3000);
        alert(`Błąd połączenia z AI: ${error.message}`);
    } finally {
        testBtn.disabled = false;
    }
}
    // Import/Export
    importWords(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csv = e.target.result;
                const lines = csv.split('\n');
                const newWords = [];
                
                for (let i = 1; i < lines.length; i++) { // Skip header
                    const line = lines[i].trim();
                    if (line) {
                        const [polish, english] = line.split(',').map(s => s.trim().replace(/"/g, ''));
                        if (polish && english) {
                            newWords.push({
                                polish,
                                english,
                                status: 'new',
                                attempts: 0,
                                correct: 0,
                                lastReview: null,
                                nextReview: null
                            });
                        }
                    }
                }
                
                this.words.push(...newWords);
                this.saveData();
                this.updateStats();
                alert(`Zaimportowano ${newWords.length} nowych słów.`);
            } catch (error) {
                alert('Błąd podczas importowania pliku. Sprawdź format CSV.');
            }
        };
        reader.readAsText(file);
    }

    exportWords() {
        const csv = 'Polski,Angielski,Status,Próby,Poprawne\n' + 
            this.words.map(w => `"${w.polish}","${w.english}","${w.status}",${w.attempts},${w.correct}`).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'slownictwo.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    resetProgress() {
        if (confirm('Czy na pewno chcesz zresetować postępy? Wszystkie słowa zostaną oznaczone jako nowe.')) {
            this.words.forEach(word => {
                word.status = 'new';
                word.attempts = 0;
                word.correct = 0;
                word.lastReview = null;
                word.nextReview = null;
            });
            this.saveData();
            this.updateStats();
            alert('Postępy zostały zresetowane.');
        }
    }

    resetAll() {
        if (confirm('Czy na pewno chcesz usunąć wszystkie dane? Ta operacja jest nieodwracalna.')) {
            localStorage.clear();
            this.words = [];
            this.stats = {
                totalWords: 0,
                learnedWords: 0,
                dueWords: 0,
                successRate: 0,
                totalAttempts: 0,
                correctAttempts: 0
            };
            this.loadDefaultWords();
            this.updateStats();
            alert('Wszystkie dane zostały usunięte.');
        }
    }

    // Utility Functions
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VocabularyApp();
});