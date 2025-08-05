// Polish-English Vocabulary Learning App
class VocabularyApp {
    constructor() {
        this.words = [];
        this.currentStudySet = [];
        this.currentWordIndex = 0;
        this.currentMode = '';
        this.selectedMatches = {};
        this.stats = {
            totalWords: 0,
            learnedWords: 0,
            dueWords: 0,
            successRate: 0,
            totalAttempts: 0,
            correctAttempts: 0
        };
        this.settings = {
            firstInterval: 1,
            secondInterval: 7,
            dailyGoal: 10,
            languageLevel: 'B1',
            infiniteLearning: true,
            autoAddWords: true,
            aiProvider: 'openai', // 'openai', 'anthropic', 'gemini'
            aiApiKey: '',
            aiModel: 'gpt-3.5-turbo',
            enableAIRecommendations: true,
            adaptiveDifficulty: true,
            enableImagen: true
        };
        
        // AI word generation
        this.wordCategories = ['dom', 'praca', 'jedzenie', 'transport', 'natura', 'technologia', 'sport', 'kultura'];
        this.currentCategory = 0;
        this.isGeneratingWords = false;
        
        // AI learning analytics
        this.learningPatterns = {
            difficultWords: [],
            preferredCategories: [],
            learningSpeed: 'medium',
            weakAreas: []
        };
        
        this.init();
    }

    init() {
        this.loadData();
        this.setupEventListeners();
        this.updateStats();
        this.showView('dashboard');
        this.loadDefaultWords();
    }

    // Data Management
    loadData() {
        const savedWords = localStorage.getItem('vocabularyWords');
        const savedStats = localStorage.getItem('vocabularyStats');
        const savedSettings = localStorage.getItem('vocabularySettings');
        const savedPatterns = localStorage.getItem('learningPatterns');
        
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
    }

    saveData() {
        localStorage.setItem('vocabularyWords', JSON.stringify(this.words));
        localStorage.setItem('vocabularyStats', JSON.stringify(this.stats));
        localStorage.setItem('vocabularySettings', JSON.stringify(this.settings));
        localStorage.setItem('learningPatterns', JSON.stringify(this.learningPatterns));
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
                const mode = e.currentTarget.dataset.mode;
                this.startStudyMode(mode);
            });
        });

        // Back button
        document.getElementById('back-btn').addEventListener('click', () => {
            this.showView('dashboard');
        });

        // Flashcards
        document.querySelector('.flip-btn').addEventListener('click', () => {
            this.flipCard();
        });

        document.querySelector('.btn-wrong').addEventListener('click', () => {
            this.recordAnswer(false);
        });

        document.querySelector('.btn-correct').addEventListener('click', () => {
            this.recordAnswer(true);
        });

        // Typing mode
        document.getElementById('check-answer').addEventListener('click', () => {
            this.checkTypingAnswer();
        });

        document.getElementById('answer-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkTypingAnswer();
            }
        });

        // Listening mode
        document.getElementById('play-audio').addEventListener('click', () => {
            this.playAudio();
        });

        document.getElementById('check-listening').addEventListener('click', () => {
            this.checkListeningAnswer();
        });

        document.getElementById('listening-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkListeningAnswer();
            }
        });

        document.getElementById('listening-input').addEventListener('keydown', (e) => {
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

        document.getElementById('generate-words').addEventListener('click', () => {
            this.generateNewWords();
        });

        // AI settings
        document.getElementById('ai-provider').addEventListener('change', (e) => {
            this.settings.aiProvider = e.target.value;
            this.updateAIModelOptions();
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

        document.getElementById('test-ai-connection').addEventListener('click', () => {
            this.testAIConnection();
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
        const flashcard = document.getElementById('flashcard');
        const frontWord = document.getElementById('front-word');
        const backWord = document.getElementById('back-word');
        const wordImage = document.getElementById('word-image');

        flashcard.classList.remove('flipped');
        frontWord.textContent = word.polish;
        backWord.textContent = word.english;
        
        this.loadWordImage(wordImage, word.english);
    }

    flipCard() {
        document.getElementById('flashcard').classList.toggle('flipped');
    }

    // Typing Mode
    loadTyping(word) {
        const polishWord = document.getElementById('polish-word');
        const answerInput = document.getElementById('answer-input');
        const feedback = document.getElementById('feedback');
        const typingImage = document.getElementById('typing-image');

        polishWord.textContent = word.polish;
        answerInput.value = '';
        feedback.textContent = '';
        feedback.className = 'feedback';
        
        this.loadWordImage(typingImage, word.english);
        answerInput.focus();
    }

    checkTypingAnswer() {
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

        this.recordAnswer(isCorrect);
        
        setTimeout(() => {
            this.nextWord();
        }, 2000);
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
        
        this.loadWordImage(listeningImage, word.english);
        
        // Generate speech synthesis for the English word
        audio.src = this.generateAudioURL(word.english);
        
        // Automatycznie odtwórz słowo tylko dla pierwszego słowa w sesji
        if (this.currentWordIndex === 0) {
            setTimeout(() => {
                this.speakWord(word.english);
            }, 500);
        } else {
            // Dla kolejnych słów pokaż wskazówkę
            feedback.textContent = '🔊 Kliknij przycisk lub naciśnij spację, aby usłyszeć słowo';
            feedback.className = 'feedback';
        }
        
        listeningInput.focus();
    }

    playAudio() {
        const word = this.currentStudySet[this.currentWordIndex];
        this.speakWord(word.english);
    }

    speakWord(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.8;
            speechSynthesis.speak(utterance);
        }
    }

    generateAudioURL(word) {
        // Placeholder for audio generation - in a real app, you'd use a TTS service
        return `data:audio/wav;base64,`;
    }

    checkListeningAnswer() {
        const word = this.currentStudySet[this.currentWordIndex];
        const userAnswer = document.getElementById('listening-input').value.trim().toLowerCase();
        const correctAnswer = word.polish.toLowerCase();
        const feedback = document.getElementById('listening-feedback');

        const isCorrect = userAnswer === correctAnswer;
        
        if (isCorrect) {
            feedback.textContent = 'Świetnie! Poprawna odpowiedź.';
            feedback.className = 'feedback correct';
        } else {
            feedback.textContent = `Niepoprawnie. Prawidłowa odpowiedź to: ${word.polish}`;
            feedback.className = 'feedback incorrect';
            
            // Odtwórz słowo ponownie po błędnej odpowiedzi
            setTimeout(() => {
                this.speakWord(word.english);
            }, 1000);
        }

        this.recordAnswer(isCorrect);
        
        setTimeout(() => {
            this.nextWord();
        }, 2000);
    }

    // Match Mode
    loadMatch() {
        const wordsToMatch = this.currentStudySet.slice(this.currentWordIndex, this.currentWordIndex + 5);
        const polishContainer = document.getElementById('polish-words');
        const englishContainer = document.getElementById('english-words');

        polishContainer.innerHTML = '';
        englishContainer.innerHTML = '';
        this.selectedMatches = {};

        const shuffledEnglish = this.shuffleArray([...wordsToMatch]);

        wordsToMatch.forEach((word, index) => {
            const polishEl = this.createMatchElement(word.polish, 'polish', index);
            polishContainer.appendChild(polishEl);
        });

        shuffledEnglish.forEach((word, index) => {
            const englishEl = this.createMatchElement(word.english, 'english', index);
            englishContainer.appendChild(englishEl);
        });
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
            polishEl.classList.add('correct');
            englishEl.classList.add('correct');
            this.recordAnswer(true, correctPair);
        } else {
            polishEl.classList.add('incorrect');
            englishEl.classList.add('incorrect');
            // Find the correct pair and record as incorrect
            const polishWordObj = this.currentStudySet.find(w => w.polish === polishWord);
            if (polishWordObj) {
                this.recordAnswer(false, polishWordObj);
            }
        }

        // Reset selections
        this.selectedMatches = {};
        
        setTimeout(() => {
            polishEl.classList.remove('selected', 'correct', 'incorrect');
            englishEl.classList.remove('selected', 'correct', 'incorrect');
        }, 1500);
    }

    checkMatches() {
        // Move to next set of words
        this.currentWordIndex += 5;
        this.loadCurrentWord();
    }

    // Word Image Loading
    async loadWordImage(container, englishWord) {
        container.style.backgroundImage = '';
        container.textContent = '🖼️';
        
        try {
            // Najpierw spróbuj wygenerować obrazek z bezpłatnym AI
            const aiImageUrl = await this.generateFreeAIImage(englishWord);
            if (aiImageUrl) {
                const img = new Image();
                img.onload = () => {
                    container.style.backgroundImage = `url(${aiImageUrl})`;
                    container.textContent = '';
                };
                img.onerror = () => {
                    this.loadFallbackImage(container, englishWord);
                };
                img.src = aiImageUrl;
                return;
            }
        } catch (error) {
            console.warn('Błąd generowania obrazu z AI:', error);
        }
        
        // Fallback do innych serwisów
        this.loadFallbackImage(container, englishWord);
    }

    // Generowanie obrazków z bezpłatnym AI (Pollinations AI)
    async generateFreeAIImage(word) {
        try {
            // Pollinations AI - bezpłatny serwis do generowania obrazków
            const prompt = `simple illustration of ${word}, educational style, clean white background, minimalist, suitable for language learning`;
            const encodedPrompt = encodeURIComponent(prompt);
            
            // Generujemy unikalny seed na podstawie słowa
            const seed = this.hashCode(word);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=150&height=150&seed=${seed}&nologo=true`;
            
            // Sprawdź czy obrazek się ładuje
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(imageUrl);
                img.onerror = () => resolve(null);
                img.src = imageUrl;
                
                // Timeout po 5 sekundach
                setTimeout(() => resolve(null), 5000);
            });
        } catch (error) {
            console.error('Błąd generowania obrazu z Pollinations:', error);
            return null;
        }
    }

    async generateImageWithImagen(word) {
        try {
            const prompt = `A simple, clear illustration of ${word}. Educational style, clean background, suitable for language learning.`;
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImage?key=${this.settings.aiApiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    config: {
                        numberOfImages: 1,
                        aspectRatio: "1:1",
                        safetyFilterLevel: "BLOCK_ONLY_HIGH",
                        personGeneration: "DONT_ALLOW"
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Imagen API error: ${response.status}`);
            }

            const data = await response.json();
            if (data.generatedImages && data.generatedImages[0]) {
                // Convert base64 to blob URL
                const base64Data = data.generatedImages[0].bytesBase64Encoded;
                const blob = this.base64ToBlob(base64Data, 'image/png');
                return URL.createObjectURL(blob);
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

    async loadFallbackImage(container, englishWord) {
        try {
            // Spróbuj drugi bezpłatny serwis AI - Hugging Face
            const hfImageUrl = await this.generateHuggingFaceImage(englishWord);
            if (hfImageUrl) {
                const img = new Image();
                img.onload = () => {
                    container.style.backgroundImage = `url(${hfImageUrl})`;
                    container.textContent = '';
                };
                img.onerror = () => {
                    this.loadIconImage(container, englishWord);
                };
                img.src = hfImageUrl;
                return;
            }
        } catch (error) {
            console.warn('Błąd generowania obrazu z Hugging Face:', error);
        }
        
        // Ostateczny fallback - ikony i emoji
        this.loadIconImage(container, englishWord);
    }

    // Drugi serwis AI - prostszy prompt
    async generateHuggingFaceImage(word) {
        try {
            // Używamy prostszego serwisu z ikonami
            const prompt = `${word} icon, simple, clean, white background`;
            const encodedPrompt = encodeURIComponent(prompt);
            const seed = this.hashCode(word);
            
            // Alternatywny serwis AI
            const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=150&height=150&seed=${seed}&model=flux&nologo=true`;
            
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(imageUrl);
                img.onerror = () => resolve(null);
                img.src = imageUrl;
                setTimeout(() => resolve(null), 3000);
            });
        } catch (error) {
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
        this.saveData();

        if (this.currentMode !== 'match') {
            setTimeout(() => {
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
            wordInfo.innerHTML = `<strong>${word.polish}</strong> - ${word.english}`;
            
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
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Simple bar chart
        const data = [
            { label: 'Nowe', value: this.words.filter(w => w.status === 'new').length, color: '#1976d2' },
            { label: 'Uczę się', value: this.words.filter(w => w.status === 'learning').length, color: '#f57c00' },
            { label: 'Nauczone', value: this.words.filter(w => w.status === 'learned').length, color: '#388e3c' }
        ];
        
        const maxValue = Math.max(...data.map(d => d.value));
        const barWidth = 80;
        const barSpacing = 40;
        const chartHeight = 150;
        
        data.forEach((item, index) => {
            const x = 50 + index * (barWidth + barSpacing);
            const barHeight = maxValue > 0 ? (item.value / maxValue) * chartHeight : 0;
            const y = canvas.height - 50 - barHeight;
            
            // Draw bar
            ctx.fillStyle = item.color;
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Draw label
            ctx.fillStyle = '#333';
            ctx.font = '12px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(item.label, x + barWidth / 2, canvas.height - 30);
            
            // Draw value
            ctx.fillText(item.value.toString(), x + barWidth / 2, y - 10);
        });
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
        
        const category = this.wordCategories[this.currentCategory];
        this.currentCategory = (this.currentCategory + 1) % this.wordCategories.length;
        
        try {
            const newWords = await this.getWordsFromAI(category, this.settings.languageLevel, count);
            
            // Filter out words that already exist
            const uniqueWords = newWords.filter(newWord => 
                !this.words.some(existingWord => 
                    existingWord.polish.toLowerCase() === newWord.polish.toLowerCase() ||
                    existingWord.english.toLowerCase() === newWord.english.toLowerCase()
                )
            );
            
            this.words.push(...uniqueWords);
            this.saveData();
            this.updateStats();
            
            if (uniqueWords.length > 0) {
                generateBtn.textContent = `✅ Dodano ${uniqueWords.length} słów!`;
                console.log(`Dodano ${uniqueWords.length} nowych słów z kategorii: ${category} (poziom: ${this.settings.languageLevel})`);
                
                // Show success message
                setTimeout(() => {
                    generateBtn.textContent = originalText;
                }, 2000);
            } else {
                generateBtn.textContent = '⚠️ Brak nowych słów do dodania';
                setTimeout(() => {
                    generateBtn.textContent = originalText;
                }, 2000);
            }
        } catch (error) {
            console.error('Błąd podczas generowania słów:', error);
            generateBtn.textContent = '❌ Błąd generowania';
            // Fallback to predefined words if AI fails
            this.addFallbackWords(count);
            setTimeout(() => {
                generateBtn.textContent = originalText;
            }, 2000);
        } finally {
            this.isGeneratingWords = false;
            generateBtn.disabled = false;
            generateBtn.classList.remove('generating');
        }
    }

    async getWordsFromAI(category, level, count) {
        if (!this.settings.aiApiKey) {
            console.warn('Brak klucza API - używam predefiniowanych słów');
            return this.getIntelligentWordsByLevel(level, category, count);
        }

        try {
            const prompt = this.buildAIPrompt(category, level, count);
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
                default:
                    throw new Error('Nieznany dostawca AI');
            }

            return this.parseAIResponse(response);
        } catch (error) {
            console.error('Błąd AI:', error);
            // Fallback to predefined words
            return this.getIntelligentWordsByLevel(level, category, count);
        }
    }

    getIntelligentWordsByLevel(level, category, count) {
        // Rozszerzona baza słów z inteligentnym doborem
        const userProgress = this.analyzeUserProgress();
        const existingWords = this.words.map(w => w.english.toLowerCase());
        
        return this.getWordsByLevel(level, category, count, existingWords, userProgress);
    }

    getWordsByLevel(level, category, count, existingWords = [], userProgress = null) {
        const wordSets = {
            'A1': {
                'dom': [
                    { polish: 'okno', english: 'window' },
                    { polish: 'drzwi', english: 'door' },
                    { polish: 'łóżko', english: 'bed' },
                    { polish: 'stół', english: 'table' },
                    { polish: 'krzesło', english: 'chair' },
                    { polish: 'ściana', english: 'wall' },
                    { polish: 'podłoga', english: 'floor' },
                    { polish: 'sufit', english: 'ceiling' },
                    { polish: 'lampa', english: 'lamp' },
                    { polish: 'dywan', english: 'carpet' },
                    { polish: 'szafa', english: 'wardrobe' },
                    { polish: 'lustro', english: 'mirror' },
                    { polish: 'zegar', english: 'clock' },
                    { polish: 'obraz', english: 'picture' },
                    { polish: 'kwiat', english: 'flower' }
                ],
                'jedzenie': [
                    { polish: 'chleb', english: 'bread' },
                    { polish: 'mleko', english: 'milk' },
                    { polish: 'jabłko', english: 'apple' },
                    { polish: 'mięso', english: 'meat' },
                    { polish: 'ser', english: 'cheese' },
                    { polish: 'masło', english: 'butter' },
                    { polish: 'jajko', english: 'egg' },
                    { polish: 'ryż', english: 'rice' },
                    { polish: 'ziemniak', english: 'potato' },
                    { polish: 'marchew', english: 'carrot' },
                    { polish: 'pomidor', english: 'tomato' },
                    { polish: 'banan', english: 'banana' },
                    { polish: 'pomarańcza', english: 'orange' },
                    { polish: 'kurczak', english: 'chicken' },
                    { polish: 'ryba', english: 'fish' }
                ],
                'transport': [
                    { polish: 'autobus', english: 'bus' },
                    { polish: 'pociąg', english: 'train' },
                    { polish: 'rower', english: 'bicycle' },
                    { polish: 'samolot', english: 'airplane' },
                    { polish: 'statek', english: 'ship' }
                ]
            },
            'A2': {
                'dom': [
                    { polish: 'kuchnia', english: 'kitchen' },
                    { polish: 'łazienka', english: 'bathroom' },
                    { polish: 'salon', english: 'living room' },
                    { polish: 'sypialnia', english: 'bedroom' },
                    { polish: 'balkon', english: 'balcony' }
                ],
                'praca': [
                    { polish: 'biuro', english: 'office' },
                    { polish: 'spotkanie', english: 'meeting' },
                    { polish: 'komputer', english: 'computer' },
                    { polish: 'telefon', english: 'telephone' },
                    { polish: 'dokument', english: 'document' }
                ]
            },
            'B1': {
                'technologia': [
                    { polish: 'oprogramowanie', english: 'software' },
                    { polish: 'aplikacja', english: 'application' },
                    { polish: 'sieć', english: 'network' },
                    { polish: 'baza danych', english: 'database' },
                    { polish: 'bezpieczeństwo', english: 'security' }
                ],
                'natura': [
                    { polish: 'środowisko', english: 'environment' },
                    { polish: 'ekosystem', english: 'ecosystem' },
                    { polish: 'różnorodność', english: 'diversity' },
                    { polish: 'zanieczyszczenie', english: 'pollution' },
                    { polish: 'odnawialny', english: 'renewable' }
                ]
            },
            'B2': {
                'kultura': [
                    { polish: 'dziedzictwo', english: 'heritage' },
                    { polish: 'tradycja', english: 'tradition' },
                    { polish: 'współczesny', english: 'contemporary' },
                    { polish: 'autentyczny', english: 'authentic' },
                    { polish: 'wpływ', english: 'influence' }
                ],
                'sport': [
                    { polish: 'wytrzymałość', english: 'endurance' },
                    { polish: 'osiągnięcie', english: 'achievement' },
                    { polish: 'rywalizacja', english: 'competition' },
                    { polish: 'strategia', english: 'strategy' },
                    { polish: 'motywacja', english: 'motivation' }
                ]
            },
            'C1': {
                'technologia': [
                    { polish: 'sztuczna inteligencja', english: 'artificial intelligence' },
                    { polish: 'algorytm', english: 'algorithm' },
                    { polish: 'automatyzacja', english: 'automation' },
                    { polish: 'innowacja', english: 'innovation' },
                    { polish: 'cyfryzacja', english: 'digitalization' }
                ],
                'kultura': [
                    { polish: 'intelektualny', english: 'intellectual' },
                    { polish: 'filozofia', english: 'philosophy' },
                    { polish: 'abstrakcyjny', english: 'abstract' },
                    { polish: 'konceptualny', english: 'conceptual' },
                    { polish: 'interpretacja', english: 'interpretation' }
                ]
            },
            'C2': {
                'praca': [
                    { polish: 'przedsiębiorczość', english: 'entrepreneurship' },
                    { polish: 'strategiczny', english: 'strategic' },
                    { polish: 'kompleksowy', english: 'comprehensive' },
                    { polish: 'efektywność', english: 'efficiency' },
                    { polish: 'optymalizacja', english: 'optimization' }
                ]
            }
        };

        const levelWords = wordSets[level] || wordSets['B1'];
        const categoryWords = levelWords[category] || levelWords[Object.keys(levelWords)[0]] || [];
        
        // Filtruj słowa, które użytkownik już ma
        const availableWords = categoryWords.filter(word => 
            !existingWords.includes(word.english.toLowerCase())
        );
        
        // Jeśli brak dostępnych słów, spróbuj innych kategorii
        if (availableWords.length < count) {
            const allLevelWords = Object.values(levelWords).flat();
            const additionalWords = allLevelWords.filter(word => 
                !existingWords.includes(word.english.toLowerCase()) &&
                !availableWords.some(aw => aw.english === word.english)
            );
            availableWords.push(...additionalWords);
        }
        
        // Shuffle and take requested count
        const shuffled = this.shuffleArray([...availableWords]);
        return shuffled.slice(0, count).map(word => ({
            ...word,
            status: 'new',
            attempts: 0,
            correct: 0,
            lastReview: null,
            nextReview: null,
            category: category,
            difficulty: this.calculateWordDifficulty(word, level),
            hasImage: true
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
        const userProgress = this.analyzeUserProgress();
        const difficultWords = this.learningPatterns.difficultWords.slice(0, 5);
        
        return `Jesteś ekspertem w nauczaniu języka angielskiego dla Polaków. Wygeneruj ${count} słów angielskich z kategorii "${category}" na poziomie ${level} (CEFR).

KONTEKST UŻYTKOWNIKA:
- Poziom: ${level}
- Kategoria: ${category}
- Trudne słowa: ${difficultWords.join(', ') || 'brak danych'}
- Tempo nauki: ${userProgress.learningSpeed}
- Słabe obszary: ${userProgress.weakAreas.join(', ') || 'brak danych'}

WYMAGANIA:
1. Słowa muszą być odpowiednie dla poziomu ${level}
2. Muszą być związane z kategorią "${category}"
3. Uwzględnij trudności użytkownika
4. Unikaj słów, które już zna
5. Dostosuj trudność do tempa nauki

FORMAT ODPOWIEDZI (tylko JSON, bez dodatkowego tekstu):
{
  "words": [
    {"polish": "słowo_polskie", "english": "english_word", "difficulty": "easy|medium|hard", "context": "przykładowe zdanie"},
    ...
  ]
}

Istniejące słowa użytkownika (unikaj duplikatów): ${this.words.map(w => w.english).slice(0, 20).join(', ')}`;
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

    async callGemini(prompt) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.settings.aiApiKey}`, {
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
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Nieprawidłowa odpowiedź z Gemini API');
        }
        return data.candidates[0].content.parts[0].text;
    }

    parseAIResponse(response) {
        try {
            // Clean response - remove markdown formatting if present
            const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleanResponse);
            
            if (!parsed.words || !Array.isArray(parsed.words)) {
                throw new Error('Invalid response format');
            }

            return parsed.words.map(word => ({
                polish: word.polish,
                english: word.english,
                status: 'new',
                attempts: 0,
                correct: 0,
                lastReview: null,
                nextReview: null,
                difficulty: word.difficulty || 'medium',
                context: word.context || '',
                aiGenerated: true,
                hasImage: true
            }));
        } catch (error) {
            console.error('Błąd parsowania odpowiedzi AI:', error);
            throw error;
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

            const response = await this.callOpenAI(prompt);
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
        
        // AI settings
        document.getElementById('ai-provider').value = this.settings.aiProvider;
        document.getElementById('ai-api-key').value = this.settings.aiApiKey;
        document.getElementById('ai-model').value = this.settings.aiModel;
        document.getElementById('enable-ai-recommendations').checked = this.settings.enableAIRecommendations;
        document.getElementById('adaptive-difficulty').checked = this.settings.adaptiveDifficulty;
        document.getElementById('enable-imagen').checked = this.settings.enableImagen;
        
        this.updateAIModelOptions();
    }

    updateAIModelOptions() {
        const modelSelect = document.getElementById('ai-model');
        modelSelect.innerHTML = '';
        
        const modelOptions = {
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
                { value: 'gemini-pro', text: 'Gemini Pro' },
                { value: 'gemini-1.5-flash', text: 'Gemini 1.5 Flash' },
                { value: 'gemini-1.5-pro', text: 'Gemini 1.5 Pro' }
            ]
        };
        
        const options = modelOptions[this.settings.aiProvider] || modelOptions['openai'];
        options.forEach(option => {
            const optionEl = document.createElement('option');
            optionEl.value = option.value;
            optionEl.textContent = option.text;
            modelSelect.appendChild(optionEl);
        });
        
        modelSelect.value = this.settings.aiModel;
    }

    async testAIConnection() {
        const testBtn = document.getElementById('test-ai-connection');
        const originalText = testBtn.textContent;
        
        if (!this.settings.aiApiKey) {
            alert('Najpierw wprowadź klucz API');
            return;
        }
        
        testBtn.disabled = true;
        testBtn.textContent = '🔄 Testowanie...';
        
        try {
            const testPrompt = 'Odpowiedz tylko "OK" jeśli otrzymujesz tę wiadomość.';
            let response;
            
            switch (this.settings.aiProvider) {
                case 'openai':
                    response = await this.callOpenAI(testPrompt);
                    break;
                case 'anthropic':
                    response = await this.callAnthropic(testPrompt);
                    break;
                case 'gemini':
                    response = await this.callGemini(testPrompt);
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