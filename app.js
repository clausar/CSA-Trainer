// Generate unique ID for questions
function generateQuestionId() {
    return 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Initialize question stats if not exists
function initQuestionStats(questionId) {
    if (!questionStats[questionId]) {
        questionStats[questionId] = {
            zen: { appeared: 0, correct: 0, wrong: 0 },
            exam: { appeared: 0, correct: 0, wrong: 0 },
            examOfficial: { appeared: 0, correct: 0, wrong: 0 }
        };
    }
}

// Save question stats to localStorage
function saveQuestionStats() {
    try {
        localStorage.setItem('csa_question_stats', JSON.stringify(questionStats));
    } catch (e) {
        console.error('Error saving question stats:', e);
    }
}

// Load question stats from localStorage
function loadQuestionStats() {
    try {
        const saved = localStorage.getItem('csa_question_stats');
        if (saved) {
            questionStats = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Error loading question stats:', e);
        questionStats = {};
    }
}

// Save zen deck to localStorage
function saveZenDeck() {
    try {
        localStorage.setItem('csa_zen_deck', JSON.stringify(zenDeck));
        console.log('Zen deck saved:', zenDeck.length, 'cards');
    } catch (e) {
        console.error('Error saving zen deck:', e);
    }
}

// Load zen deck from localStorage
function loadZenDeck() {
    try {
        const saved = localStorage.getItem('csa_zen_deck');
        if (saved) {
            zenDeck = JSON.parse(saved);
            console.log('Zen deck loaded:', zenDeck.length, 'cards');
        }
    } catch (e) {
        console.error('Error loading zen deck:', e);
        zenDeck = [];
    }
}

// Save flashcards to localStorage
function saveFlashcards() {
    try {
        localStorage.setItem('csa_flashcards', JSON.stringify(flashcards));
        console.log('Flashcards saved to localStorage:', flashcards.length, 'questions');
    } catch (e) {
        console.error('Error saving flashcards to localStorage:', e);
    }
}

let currentMode = '';
let currentCardIndex = 0;
let sessionCards = [];
let selectedOptions = [];
let stats = {
    correct: 0,
    wrong: 0
};
let examConfig = {
    timeLimit: 30,
    numQuestions: 10,
    passPercentage: 70
};
let timerInterval = null;
let timeRemaining = 0;
let questionStats = {};
let isOfficialExam = false;
let appSettings = {
    includeDeprecated: true,
    verifiedOnly: false
};
let sessionStartTime = 0;
let sessionResults = [];
let zenDeck = []; // Spaced repetition deck for zen mode

// Load question stats on startup
loadQuestionStats();
loadSettings();
loadZenDeck();

// Restore screen after a short delay to ensure DOM is ready
setTimeout(() => {
    try {
        restoreScreen();
    } catch (e) {
        console.error('Error restoring screen:', e);
        showScreen('home-screen');
    }
    
    // Hide loader and show app after everything is ready
    setTimeout(() => {
        const loader = document.getElementById('app-loader');
        const container = document.querySelector('.container');
        
        if (container) {
            container.classList.add('ready');
        }
        if (loader) {
            loader.classList.add('hidden');
            
            // Remove loader from DOM after animation
            setTimeout(() => {
                if (loader.parentNode) {
                    loader.remove();
                }
            }, 300);
        }
    }, 150); // Extra delay to ensure modal is opened if needed
}, 50);

// Save current screen state
function saveCurrentScreen() {
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen) {
        localStorage.setItem('csa_current_screen', activeScreen.id);
    }
    
    // Save active modal if any
    const activeModal = document.querySelector('.modal.active');
    if (activeModal) {
        localStorage.setItem('csa_current_modal', activeModal.id);
        
        // If it's the question details modal, save the question ID
        if (activeModal.id === 'question-details-modal' && currentDetailQuestionId) {
            localStorage.setItem('csa_current_question_id', currentDetailQuestionId);
        }
    } else {
        localStorage.removeItem('csa_current_modal');
        localStorage.removeItem('csa_current_question_id');
    }
}

// Restore screen state on page load
function restoreScreen() {
    const savedScreen = localStorage.getItem('csa_current_screen');
    const savedModal = localStorage.getItem('csa_current_modal');
    const savedQuestionId = localStorage.getItem('csa_current_question_id');
    
    // Don't restore flashcard-screen (exam/zen mode) - always go to home
    if (savedScreen === 'flashcard-screen') {
        showScreen('home-screen');
        return;
    }
    
    if (savedScreen) {
        const screenElement = document.getElementById(savedScreen);
        
        // Check if the screen still exists
        if (screenElement) {
            showScreen(savedScreen);
            
            // Special handling for database screen - reload the list
            if (savedScreen === 'database-screen') {
                showDatabase();
                
                // If there was a question details modal open, restore it
                if (savedModal === 'question-details-modal' && savedQuestionId) {
                    // Check if the question still exists
                    const question = flashcards.find(q => q.id === savedQuestionId);
                    if (question) {
                        setTimeout(() => {
                            showQuestionDetails(savedQuestionId);
                        }, 100);
                    }
                }
                // If add question modal was open, restore it
                else if (savedModal === 'add-question-modal') {
                    setTimeout(() => {
                        document.getElementById('add-question-modal').classList.add('active');
                    }, 100);
                }
            }
            // Special handling for settings screen - update stats
            else if (savedScreen === 'settings-screen') {
                updateSettingsStats();
                
                // If add question modal was open from settings, restore it
                if (savedModal === 'add-question-modal') {
                    setTimeout(() => {
                        document.getElementById('add-question-modal').classList.add('active');
                    }, 100);
                }
            }
        } else {
            // Screen doesn't exist, try to find parent screen
            // Map of child screens to their parent screens
            const screenHierarchy = {
                'exam-config-screen': 'home-screen',
                'flashcard-screen': 'home-screen',
                'results-screen': 'home-screen',
                'settings-screen': 'home-screen',
                'database-screen': 'home-screen'
            };
            
            const parentScreen = screenHierarchy[savedScreen];
            if (parentScreen && document.getElementById(parentScreen)) {
                showScreen(parentScreen);
            } else {
                // Fallback to home screen
                showScreen('home-screen');
            }
        }
    }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
    saveCurrentScreen();
}

function showExamConfig() {
    showScreen('exam-config-screen');
}

function toggleOfficialSettings() {
    const checkbox = document.getElementById('official-settings');
    const card = document.getElementById('official-settings-card');
    
    // Toggle checkbox state
    checkbox.checked = !checkbox.checked;
    const isOfficial = checkbox.checked;
    
    const timeInput = document.getElementById('exam-time');
    const questionsInput = document.getElementById('exam-questions');
    const passInput = document.getElementById('exam-pass');
    
    if (isOfficial) {
        card.classList.add('active');
        timeInput.value = 90;
        questionsInput.value = 60;
        passInput.value = 70;
        
        timeInput.disabled = true;
        questionsInput.disabled = true;
        passInput.disabled = true;
    } else {
        card.classList.remove('active');
        timeInput.disabled = false;
        questionsInput.disabled = false;
        passInput.disabled = false;
    }
}

function toggleDomainsFilter() {
    const card = document.getElementById('domains-card');
    card.classList.toggle('active');
    
    // Open domains modal
    openDomainsModal();
}

let domainConfig = {
    random: true,
    domains: {}
};

const officialDomainDistribution = {
    'Platform Overview and Navigation': 7,
    'Instance Configuration': 10,
    'Configuring Applications for Collaboration': 20,
    'Self Service & Automation': 20,
    'Database Management and Platform Security': 30,
    'Data Migration and Integration': 13
};

function openDomainsModal() {
    const modal = document.getElementById('domains-modal');
    const domainsList = document.getElementById('domains-list');
    const isOfficial = document.getElementById('official-settings').checked;
    
    // Always use the 6 official domains
    const officialDomains = [
        'Platform Overview and Navigation',
        'Instance Configuration',
        'Configuring Applications for Collaboration',
        'Self Service & Automation',
        'Database Management and Platform Security',
        'Data Migration and Integration'
    ];
    
    // If official settings, use official distribution
    if (isOfficial) {
        domainConfig.random = false;
        domainConfig.domains = {};
        
        officialDomains.forEach(cat => {
            domainConfig.domains[cat] = {
                enabled: true,
                percentage: officialDomainDistribution[cat] || 0
            };
        });
    }
    
    // Build domains list with all 6 official domains
    domainsList.innerHTML = officialDomains.map(cat => {
        const isEnabled = domainConfig.domains[cat]?.enabled || false;
        const percentage = domainConfig.domains[cat]?.percentage || 0;
        
        // Count how many questions exist for this domain
        const questionsInDomain = flashcards.filter(q => q.type === cat).length;
        
        return `
        <div class="domain-item ${isOfficial ? 'disabled' : ''}" id="cat-${cat.replace(/\s+/g, '-')}">
            <label>
                <input type="checkbox" 
                       id="check-${cat.replace(/\s+/g, '-')}" 
                       onchange="toggleDomain('${cat}')"
                       ${isEnabled ? 'checked' : ''}
                       ${isOfficial ? 'disabled' : ''}>
                <span class="domain-name">${cat} <span style="color: #95a5a6; font-size: 0.85rem;">(${questionsInDomain} questions)</span></span>
            </label>
            <div class="domain-percentage">
                <label>Percentage:</label>
                <input type="number" 
                       id="percent-${cat.replace(/\s+/g, '-')}" 
                       min="0" 
                       max="100" 
                       value="${percentage}"
                       onchange="updatePercentageTotal()"
                       ${!isEnabled || isOfficial ? 'disabled' : ''}>
                <span>%</span>
            </div>
        </div>
    `;
    }).join('');
    
    // Set random checkbox
    const randomCheckbox = document.getElementById('random-domains');
    randomCheckbox.checked = domainConfig.random;
    randomCheckbox.disabled = isOfficial;
    
    // Update UI based on random mode or official mode
    if (domainConfig.random || isOfficial) {
        domainsList.style.opacity = '0.5';
        domainsList.style.pointerEvents = 'none';
    } else {
        domainsList.style.opacity = '1';
        domainsList.style.pointerEvents = 'auto';
    }
    
    // Add official badge if official settings
    if (isOfficial) {
        const modalHeader = modal.querySelector('.modal-header h2');
        if (!modalHeader.querySelector('.official-badge')) {
            modalHeader.innerHTML = '📚 Domain Distribution <span class="official-badge">Official CSA</span>';
        }
    }
    
    updatePercentageTotal();
    modal.classList.add('active');
    saveCurrentScreen();
}

function closeDomainsModal() {
    document.getElementById('domains-modal').classList.remove('active');
    saveCurrentScreen();
}

function toggleDomain(domain) {
    const checkbox = document.getElementById(`check-${domain.replace(/\s+/g, '-')}`);
    const percentInput = document.getElementById(`percent-${domain.replace(/\s+/g, '-')}`);
    
    if (!domainConfig.domains[domain]) {
        domainConfig.domains[domain] = { enabled: false, percentage: 0 };
    }
    
    domainConfig.domains[domain].enabled = checkbox.checked;
    percentInput.disabled = !checkbox.checked;
    
    if (!checkbox.checked) {
        percentInput.value = 0;
        domainConfig.domains[domain].percentage = 0;
    }
    
    updatePercentageTotal();
}

function toggleRandomDomains() {
    const randomCheckbox = document.getElementById('random-domains');
    const domainsList = document.getElementById('domains-list');
    
    domainConfig.random = randomCheckbox.checked;
    
    if (domainConfig.random) {
        domainsList.style.opacity = '0.5';
        domainsList.style.pointerEvents = 'none';
    } else {
        domainsList.style.opacity = '1';
        domainsList.style.pointerEvents = 'auto';
    }
}

function updatePercentageTotal() {
    // Use the 6 official domains
    const officialDomains = [
        'Platform Overview and Navigation',
        'Instance Configuration',
        'Configuring Applications for Collaboration',
        'Self Service & Automation',
        'Database Management and Platform Security',
        'Data Migration and Integration'
    ];
    
    let total = 0;
    
    officialDomains.forEach(cat => {
        const percentInput = document.getElementById(`percent-${cat.replace(/\s+/g, '-')}`);
        if (percentInput && !percentInput.disabled) {
            const value = parseInt(percentInput.value) || 0;
            total += value;
            
            if (!domainConfig.domains[cat]) {
                domainConfig.domains[cat] = { enabled: false, percentage: 0 };
            }
            domainConfig.domains[cat].percentage = value;
        }
    });
    
    document.getElementById('total-percentage').textContent = total;
    
    const warning = document.getElementById('percentage-warning');
    if (!domainConfig.random && total !== 100 && total > 0) {
        warning.style.display = 'block';
    } else {
        warning.style.display = 'none';
    }
}

function saveDomainsConfig() {
    if (!domainConfig.random) {
        const total = parseInt(document.getElementById('total-percentage').textContent);
        if (total !== 100) {
            showCustomAlert('Invalid Configuration', 'Total percentage must equal 100%', '⚠️');
            return;
        }
    }
    
    closeDomainsModal();
    console.log('Domain config saved:', domainConfig);
}

function startExamWithConfig() {
    examConfig.timeLimit = parseInt(document.getElementById('exam-time').value);
    examConfig.numQuestions = parseInt(document.getElementById('exam-questions').value);
    examConfig.passPercentage = parseInt(document.getElementById('exam-pass').value);
    isOfficialExam = document.getElementById('official-settings').checked;
    
    if (examConfig.numQuestions > flashcards.length) {
        alert(`Only ${flashcards.length} questions available. Adjusting to maximum.`);
        examConfig.numQuestions = flashcards.length;
    }
    
    startMode('exam');
}

function startTimer() {
    timeRemaining = examConfig.timeLimit * 60;
    isPaused = false;
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        if (!isPaused) {
            timeRemaining--;
            updateTimerDisplay();
            
            if (timeRemaining <= 600) { // 10 minutes = 600 seconds
                document.getElementById('timer-display').classList.add('warning');
            }
            
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                alert('Time is up!');
                showResults();
            }
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    const timerDisplay = document.getElementById('timer-display');
    timerDisplay.textContent = display;
    
    // Add zen-mode class if in zen mode
    if (currentMode === 'zen') {
        timerDisplay.classList.add('zen-mode');
    } else {
        timerDisplay.classList.remove('zen-mode');
    }
}

let isPaused = false;

function togglePauseExam() {
    console.log('togglePauseExam called, currentMode:', currentMode, 'isPaused:', isPaused);
    
    // Only allow pause in exam mode
    if (currentMode !== 'exam') {
        console.log('Not in exam mode, returning');
        return;
    }
    
    isPaused = !isPaused;
    console.log('isPaused toggled to:', isPaused);
    
    const timerDisplay = document.getElementById('timer-display');
    
    if (isPaused) {
        timerDisplay.classList.add('paused');
        // Show pause overlay
        showPauseOverlay();
    } else {
        timerDisplay.classList.remove('paused');
        // Hide pause overlay
        hidePauseOverlay();
    }
}

function showPauseOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'pause-overlay';
    overlay.className = 'pause-overlay';
    overlay.innerHTML = `
        <div class="pause-content">
            <div class="pause-icon">⏸️</div>
            <h2>Exam Paused</h2>
            <p>The timer is paused. Click the button below to resume.</p>
            <button class="btn btn-primary" onclick="togglePauseExam()">Resume Exam</button>
        </div>
    `;
    document.body.appendChild(overlay);
}

function hidePauseOverlay() {
    const overlay = document.getElementById('pause-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    document.getElementById('timer-display').textContent = '';
    document.getElementById('timer-display').classList.remove('warning');
}

function startMode(mode) {
    currentMode = mode;
    currentCardIndex = 0;
    stats.correct = 0;
    stats.wrong = 0;
    sessionResults = [];
    sessionStartTime = Date.now();
    stopTimer();
    
    // Get filtered flashcards based on settings
    const availableCards = getFilteredFlashcards();
    
    if (availableCards.length === 0) {
        let message = 'No flashcards available with current filters.';
        if (appSettings.verifiedOnly && !appSettings.includeDeprecated) {
            message += '\n\nTry enabling deprecated questions or disabling verified-only mode in Settings.';
        } else if (appSettings.verifiedOnly) {
            message += '\n\nTry disabling verified-only mode in Settings.';
        } else if (!appSettings.includeDeprecated) {
            message += '\n\nTry enabling deprecated questions in Settings.';
        }
        
        showCustomAlert('No Questions Available', message, '⚠️', [
            { text: 'OK', type: 'btn-primary' }
        ]);
        return;
    }
    
    if (mode === 'zen') {
        // Initialize zen deck if empty or if cards changed
        if (zenDeck.length === 0 || !validateZenDeck(availableCards)) {
            zenDeck = availableCards.map(card => card.id);
            saveZenDeck();
            console.log('Initialized new zen deck with', zenDeck.length, 'cards');
        }
        
        // Build session cards from zen deck order
        sessionCards = zenDeck.map(id => availableCards.find(card => card.id === id)).filter(card => card !== undefined);
        
        const timerDisplay = document.getElementById('timer-display');
        timerDisplay.textContent = 'ZEN';
        timerDisplay.classList.add('zen-mode');
        timerDisplay.style.cursor = 'pointer';
        timerDisplay.onclick = showZenModeInfo;
    } else if (mode === 'exam') {
        const numQuestions = Math.min(examConfig.numQuestions, availableCards.length);
        
        // Check if we should use domain distribution
        if (!domainConfig.random && Object.keys(domainConfig.domains).length > 0) {
            sessionCards = selectQuestionsByDomain(availableCards, numQuestions);
        } else {
            // Random selection
            sessionCards = [...availableCards]
                .sort(() => Math.random() - 0.5)
                .slice(0, numQuestions);
        }
        
        const timerDisplay = document.getElementById('timer-display');
        timerDisplay.classList.remove('zen-mode');
        timerDisplay.style.cursor = 'default';
        timerDisplay.onclick = null;
        startTimer();
    }
    
    console.log(`Starting ${mode} mode with ${sessionCards.length} questions`);
    
    showScreen('flashcard-screen');
    loadCard();
}

// Validate if zen deck is still valid with current available cards
function validateZenDeck(availableCards) {
    const availableIds = new Set(availableCards.map(card => card.id));
    // Check if all cards in zen deck are still available
    return zenDeck.every(id => availableIds.has(id));
}

// Select questions based on domain distribution
function selectQuestionsByDomain(availableCards, totalQuestions) {
    const selectedCards = [];
    const remainingCards = [...availableCards];
    
    // Get enabled domains with their percentages
    const enabledDomains = Object.entries(domainConfig.domains)
        .filter(([domain, config]) => config.enabled && config.percentage > 0);
    
    console.log('Selecting questions by domain:', enabledDomains);
    
    // For each enabled domain, select the required number of questions
    for (const [domain, config] of enabledDomains) {
        const targetCount = Math.round((config.percentage / 100) * totalQuestions);
        
        // Get questions from this domain
        const domainQuestions = remainingCards.filter(card => card.type === domain);
        
        // Take as many as we can (up to targetCount)
        const questionsToTake = Math.min(targetCount, domainQuestions.length);
        
        // Randomly select from this domain
        const shuffled = [...domainQuestions].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, questionsToTake);
        
        selectedCards.push(...selected);
        
        // Remove selected questions from remaining pool
        selected.forEach(card => {
            const index = remainingCards.findIndex(c => c.id === card.id);
            if (index > -1) remainingCards.splice(index, 1);
        });
        
        console.log(`Domain "${domain}": wanted ${targetCount}, got ${questionsToTake}`);
    }
    
    // If we don't have enough questions yet, fill with random questions from remaining pool
    const stillNeeded = totalQuestions - selectedCards.length;
    if (stillNeeded > 0 && remainingCards.length > 0) {
        const shuffled = [...remainingCards].sort(() => Math.random() - 0.5);
        const additional = shuffled.slice(0, Math.min(stillNeeded, remainingCards.length));
        selectedCards.push(...additional);
        console.log(`Added ${additional.length} random questions to reach target`);
    }
    
    // Final shuffle of all selected questions
    return selectedCards.sort(() => Math.random() - 0.5);
}

function loadCard() {
    // In zen mode, cards never end - cycle through the deck
    if (currentMode === 'zen') {
        if (currentCardIndex >= sessionCards.length) {
            // Rebuild session cards from updated zen deck
            const availableCards = getFilteredFlashcards();
            sessionCards = zenDeck.map(id => availableCards.find(card => card.id === id)).filter(card => card !== undefined);
            currentCardIndex = 0;
            console.log('Zen deck cycled, restarting from beginning');
        }
    } else {
        // Exam mode: end when all questions answered
        if (currentCardIndex >= sessionCards.length) {
            showResults();
            return;
        }
    }
    
    const card = sessionCards[currentCardIndex];
    selectedOptions = [];
    
    // Create shuffled options with original indices
    const shuffledOptions = card.options.map((option, index) => ({
        text: option,
        originalIndex: index,
        isCorrect: card.correctAnswers.includes(index)
    }));
    
    // Shuffle the options array
    for (let i = shuffledOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
    }
    
    // Store the shuffled mapping for this card
    card.shuffledOptions = shuffledOptions;
    
    const numCorrectAnswers = card.correctAnswers.length;
    const selectionText = numCorrectAnswers === 1 
        ? 'Select 1 answer' 
        : `Select ${numCorrectAnswers} answers`;
    
    // Build status icons
    let statusIcons = '';
    if (card.verified === true) {
        statusIcons += `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px; opacity: 0.4;">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
        `;
    }
    if (card.deprecated === true) {
        statusIcons += `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px; opacity: 0.4; margin-left: 6px;">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
        `;
    }
    
    document.getElementById('question-text').innerHTML = `
        ${linkifyText(card.question)}
        <div style="margin-top: 15px; padding: 10px; background: rgba(102, 126, 234, 0.1); border-radius: 8px; font-size: 0.9rem; color: #667eea; font-weight: 600; display: flex; align-items: center; justify-content: space-between;">
            <span>📌 ${selectionText}</span>
            ${statusIcons ? `<div style="display: flex; align-items: center;">${statusIcons}</div>` : ''}
        </div>
    `;
    
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    
    shuffledOptions.forEach((option, displayIndex) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        optionDiv.innerHTML = `
            <div class="option-letter">${String.fromCharCode(65 + displayIndex)}</div>
            <div class="option-text">${linkifyText(option.text)}</div>
        `;
        optionDiv.onclick = () => toggleOption(displayIndex, optionDiv);
        optionsContainer.appendChild(optionDiv);
    });
    
    // Update progress display
    if (currentMode === 'zen') {
        // In zen mode, show position in current cycle
        document.getElementById('current-card').textContent = currentCardIndex + 1;
        document.getElementById('total-cards').textContent = sessionCards.length;
        const progress = ((currentCardIndex) / sessionCards.length) * 100;
        document.getElementById('progress').style.width = progress + '%';
    } else {
        // Exam mode: normal progress
        document.getElementById('current-card').textContent = currentCardIndex + 1;
        document.getElementById('total-cards').textContent = sessionCards.length;
        const progress = ((currentCardIndex) / sessionCards.length) * 100;
        document.getElementById('progress').style.width = progress + '%';
    }
    
    // Show domain chip if question has a type/domain
    const domainChip = document.getElementById('question-domain-chip');
    if (card.type && card.type.trim()) {
        domainChip.textContent = card.type;
        domainChip.style.display = 'block';
    } else {
        domainChip.style.display = 'none';
    }
    
    // Show context button only in zen mode if question has explanation/context
    const contextButton = document.getElementById('context-button');
    const contextCard = document.getElementById('question-context-card');
    const explanationText = card.explanation || card.notes || '';
    const parsed = parseExplanation(explanationText);
    
    if (currentMode === 'zen' && parsed.context && parsed.context.trim()) {
        contextButton.style.display = 'flex';
        document.getElementById('question-context-text').innerHTML = linkifyText(parsed.context);
    } else {
        contextButton.style.display = 'none';
        contextCard.style.display = 'none';
    }
    
    // Hide context card when loading new question
    contextCard.style.display = 'none';
    
    // Reset buttons state
    document.getElementById('submit-answer').style.display = 'block';
    document.getElementById('submit-answer').disabled = true;
    document.getElementById('next-button').style.display = 'none';
}

// Toggle question context visibility
function toggleQuestionContext() {
    const contextCard = document.getElementById('question-context-card');
    if (contextCard.style.display === 'none') {
        contextCard.style.display = 'block';
    } else {
        contextCard.style.display = 'none';
    }
}

function closeQuestionContext() {
    const contextCard = document.getElementById('question-context-card');
    contextCard.style.display = 'none';
}

// Close context card when clicking outside
document.addEventListener('click', function(event) {
    const contextCard = document.getElementById('question-context-card');
    const contextButton = document.getElementById('context-button');
    
    if (contextCard && contextButton && 
        contextCard.style.display === 'block' &&
        !contextCard.contains(event.target) && 
        !contextButton.contains(event.target)) {
        contextCard.style.display = 'none';
    }
});

function toggleOption(index, element) {
    const card = sessionCards[currentCardIndex];
    const maxSelections = card.correctAnswers.length;
    const optionIndex = selectedOptions.indexOf(index);
    
    console.log('toggleOption called - index:', index, 'maxSelections:', maxSelections);
    
    if (optionIndex > -1) {
        // Deselect
        selectedOptions.splice(optionIndex, 1);
        element.classList.remove('selected');
    } else {
        // Check if we've reached the maximum selections
        if (selectedOptions.length >= maxSelections) {
            // Remove the oldest selection
            const oldestIndex = selectedOptions.shift();
            const options = document.querySelectorAll('.option');
            options[oldestIndex].classList.remove('selected');
        }
        
        // Add new selection
        selectedOptions.push(index);
        element.classList.add('selected');
    }
    
    console.log('selectedOptions:', selectedOptions);
    console.log('Should enable button?', selectedOptions.length === maxSelections);
    
    // Enable submit only if exact number of answers selected
    const submitBtn = document.getElementById('submit-answer');
    submitBtn.disabled = selectedOptions.length !== maxSelections;
    
    console.log('Submit button disabled:', submitBtn.disabled);
    console.log('Submit button display:', window.getComputedStyle(submitBtn).display);
}

function submitAnswer() {
    const card = sessionCards[currentCardIndex];
    
    // Convert selected display indices to original indices
    const userOriginalAnswers = selectedOptions.map(displayIndex => 
        card.shuffledOptions[displayIndex].originalIndex
    ).sort();
    
    const correctAnswers = card.correctAnswers.sort();
    
    // Validate exact number of selections
    if (selectedOptions.length !== card.correctAnswers.length) {
        const numNeeded = card.correctAnswers.length;
        const selectionText = numNeeded === 1 ? '1 answer' : `${numNeeded} answers`;
        showCustomAlert(
            'Invalid Selection',
            `Please select exactly ${selectionText} before submitting.`,
            '⚠️',
            [{ text: 'OK', type: 'btn-primary' }]
        );
        return;
    }
    
    const isCorrect = JSON.stringify(correctAnswers) === JSON.stringify(userOriginalAnswers);
    
    // Save result for this question
    sessionResults.push({
        question: card,
        userAnswers: [...userOriginalAnswers],
        isCorrect: isCorrect
    });
    
    // Update stats - NOW track that this question appeared (only when answered)
    initQuestionStats(card.id);
    const mode = currentMode === 'zen' ? 'zen' : (isOfficialExam ? 'examOfficial' : 'exam');
    questionStats[card.id][mode].appeared++;
    
    if (isCorrect) {
        questionStats[card.id][mode].correct++;
        stats.correct++;
    } else {
        questionStats[card.id][mode].wrong++;
        stats.wrong++;
    }
    saveQuestionStats();
    
    // Different behavior for exam vs zen mode
    if (currentMode === 'exam') {
        // Exam mode: no feedback, go to next question immediately
        document.getElementById('submit-answer').style.display = 'none';
        document.getElementById('next-button').style.display = 'none';
        currentCardIndex++;
        loadCard();
    } else {
        // Zen mode: show feedback and update deck position
        const options = document.querySelectorAll('.option');
        
        // Parse explanation to get option explanations
        const explanationText = card.explanation || card.notes || '';
        const parsed = parseExplanation(explanationText);
        
        options.forEach((option, displayIndex) => {
            const originalIndex = card.shuffledOptions[displayIndex].originalIndex;
            const letter = String.fromCharCode(65 + originalIndex);
            const isCorrectOption = card.shuffledOptions[displayIndex].isCorrect;
            
            // Check if there's an explanation for this option
            let optionExplanation = null;
            if (card.optionExplanations && card.optionExplanations[letter]) {
                optionExplanation = card.optionExplanations[letter];
            } else {
                optionExplanation = parsed.optionExplanations[letter];
            }
            
            // Mark as correct or wrong
            if (isCorrectOption) {
                option.classList.add('correct');
            } else if (selectedOptions.includes(displayIndex)) {
                option.classList.add('wrong');
            }
            
            // If there's an explanation, make it clickable
            if (optionExplanation) {
                option.style.cursor = 'pointer';
                option.onclick = () => toggleZenOptionExplanation(displayIndex, option, optionExplanation);
            } else {
                option.onclick = null;
            }
        });
        
        // Update zen deck based on answer
        updateZenDeckPosition(card.id, isCorrect);
        
        document.getElementById('submit-answer').style.display = 'none';
        document.getElementById('next-button').style.display = 'block';
    }
}

// Track currently open zen explanation
let currentOpenZenExplanation = null;

// Toggle option explanation in zen mode
function toggleZenOptionExplanation(displayIndex, optionElement, explanationText) {
    const explanationId = `zen-explanation-${displayIndex}`;
    let explanationDiv = document.getElementById(explanationId);
    
    // If clicking the currently open one, close it
    if (currentOpenZenExplanation === displayIndex) {
        if (explanationDiv) {
            explanationDiv.remove();
        }
        optionElement.classList.remove('option-expanded');
        currentOpenZenExplanation = null;
        return;
    }
    
    // Close previously open explanation
    if (currentOpenZenExplanation !== null) {
        const prevExplanation = document.getElementById(`zen-explanation-${currentOpenZenExplanation}`);
        if (prevExplanation) {
            prevExplanation.remove();
        }
        const options = document.querySelectorAll('.option');
        if (options[currentOpenZenExplanation]) {
            options[currentOpenZenExplanation].classList.remove('option-expanded');
        }
    }
    
    // Create and show new explanation
    explanationDiv = document.createElement('div');
    explanationDiv.id = explanationId;
    explanationDiv.className = 'zen-option-explanation';
    explanationDiv.innerHTML = `
        <div class="zen-explanation-icon">💡</div>
        <div class="zen-explanation-text">${linkifyText(explanationText)}</div>
    `;
    
    // Insert after the option
    optionElement.parentNode.insertBefore(explanationDiv, optionElement.nextSibling);
    optionElement.classList.add('option-expanded');
    currentOpenZenExplanation = displayIndex;
}

// Update card position in zen deck based on spaced repetition logic
function updateZenDeckPosition(cardId, isCorrect) {
    // Remove card from current position
    const currentIndex = zenDeck.indexOf(cardId);
    if (currentIndex !== -1) {
        zenDeck.splice(currentIndex, 1);
    }
    
    if (isCorrect) {
        // Correct answer: move to end of deck
        zenDeck.push(cardId);
        console.log(`Card ${cardId} moved to end (correct)`);
    } else {
        // Wrong answer: move to position ~10 (or proportional to deck size)
        const deckSize = zenDeck.length;
        const targetPosition = Math.min(10, Math.floor(deckSize * 0.2)); // 20% into deck or position 10
        zenDeck.splice(targetPosition, 0, cardId);
        console.log(`Card ${cardId} moved to position ${targetPosition} (wrong)`);
    }
    
    saveZenDeck();
}

function nextCard() {
    document.getElementById('submit-answer').style.display = 'block';
    document.getElementById('next-button').style.display = 'none';
    
    // Clean up zen explanations
    currentOpenZenExplanation = null;
    document.querySelectorAll('.zen-option-explanation').forEach(el => el.remove());
    
    currentCardIndex++;
    loadCard();
}

function showResults() {
    console.log('showResults called');
    console.log('Session results:', sessionResults);
    console.log('Stats:', stats);
    
    stopTimer();
    
    const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
    const minutes = Math.floor(timeSpent / 60);
    const seconds = timeSpent % 60;
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const percentage = Math.round((stats.correct / sessionCards.length) * 100);
    
    // Determine if passed (only for exam mode)
    let passed = false;
    if (currentMode === 'exam') {
        passed = percentage >= examConfig.passPercentage;
    }
    
    console.log('Showing results screen...');
    
    // Update results screen
    const statusIcon = document.getElementById('results-status-icon');
    const title = document.getElementById('results-title');
    const subtitle = document.getElementById('results-subtitle');
    
    if (!statusIcon || !title || !subtitle) {
        console.error('Results screen elements not found!');
        alert('Error: Results screen not found. Going home...');
        goHome();
        return;
    }
    
    if (currentMode === 'exam') {
        if (passed) {
            statusIcon.textContent = '🎉';
            title.textContent = 'Congratulations!';
            title.style.color = '#27ae60';
            subtitle.textContent = `You passed with ${percentage}%`;
        } else {
            statusIcon.textContent = '😔';
            title.textContent = 'Not Passed';
            title.style.color = '#e74c3c';
            subtitle.textContent = `You scored ${percentage}% (Required: ${examConfig.passPercentage}%)`;
        }
    } else {
        statusIcon.textContent = '✨';
        title.textContent = 'Session Complete!';
        title.style.color = '#667eea';
        subtitle.textContent = `You scored ${percentage}%`;
    }
    
    document.getElementById('results-score').textContent = `${percentage}%`;
    document.getElementById('results-time').textContent = timeString;
    document.getElementById('results-correct').textContent = stats.correct;
    document.getElementById('results-wrong').textContent = stats.wrong;
    
    // Build questions list
    const questionsList = document.getElementById('results-questions-list');
    questionsList.innerHTML = '';
    
    sessionResults.forEach((result, index) => {
        const item = document.createElement('div');
        item.className = 'results-question-item';
        item.onclick = () => showResultQuestionDetail(index);
        
        const statusIcon = result.isCorrect ? '✓' : '✗';
        const statusColor = result.isCorrect ? '#27ae60' : '#e74c3c';
        
        item.innerHTML = `
            <span class="results-question-number">Question ${index + 1}</span>
            <span class="results-question-status" style="color: ${statusColor};">${statusIcon}</span>
        `;
        
        questionsList.appendChild(item);
    });
    
    console.log('Switching to results screen...');
    showScreen('results-screen');
    console.log('Results screen should be visible now');
}

function showSettings() {
    loadSettings(); // Ensure settings are loaded
    updateSettingsStats();
    showScreen('settings-screen');
}

function updateSettingsStats() {
    document.getElementById('stats-total').textContent = flashcards.length;
    document.getElementById('stats-correct').textContent = stats.correct;
    document.getElementById('stats-wrong').textContent = stats.wrong;
}

function goHome() {
    stopTimer();
    showScreen('home-screen');
}

function exitZenMode() {
    if (currentMode === 'zen') {
        // Save zen deck progress before exiting
        saveZenDeck();
        console.log('Zen mode progress saved');
        goHome();
    } else if (currentMode === 'exam') {
        // Show warning for exam mode
        showCustomAlert(
            'Exit Exam',
            'Do you want to finish the exam or cancel it?',
            '⚠️',
            [
                { text: 'Cancel', type: 'btn-secondary' },
                { 
                    text: 'Finish Exam', 
                    type: 'btn-primary', 
                    callback: () => finishExamEarly()
                },
                { 
                    text: 'Abandon', 
                    type: 'btn-danger', 
                    callback: () => goHome()
                }
            ]
        );
    } else {
        goHome();
    }
}

function finishExamEarly() {
    // Mark all unanswered questions as wrong
    for (let i = currentCardIndex; i < sessionCards.length; i++) {
        const card = sessionCards[i];
        
        // Add to session results as wrong (no answers given)
        sessionResults.push({
            question: card,
            userAnswers: [],
            isCorrect: false
        });
        
        // Update stats - count as appeared and wrong
        initQuestionStats(card.id);
        const mode = isOfficialExam ? 'examOfficial' : 'exam';
        questionStats[card.id][mode].appeared++;
        questionStats[card.id][mode].wrong++;
        
        stats.wrong++;
    }
    
    saveQuestionStats();
    stopTimer();
    showResults();
}

function resetZenDeck() {
    showCustomAlert(
        'Reset Zen Deck',
        'This will reset your spaced repetition progress and start fresh with all questions.\n\nAre you sure?',
        '⚠️',
        [
            { text: 'Cancel', type: 'btn-secondary' },
            { 
                text: 'Reset', 
                type: 'btn-danger', 
                callback: () => {
                    zenDeck = [];
                    saveZenDeck();
                    showCustomAlert('Success', 'Zen deck has been reset!', '✅', [
                        { text: 'OK', type: 'btn-primary' }
                    ]);
                    console.log('Zen deck reset');
                }
            }
        ]
    );
}

function resetStatistics() {
    showCustomAlert(
        'Reset Statistics',
        'This will permanently delete all question statistics:\n\n• Times appeared\n• Correct answers\n• Wrong answers\n\nThis action cannot be undone. Are you sure?',
        '⚠️',
        [
            { text: 'Cancel', type: 'btn-secondary' },
            { 
                text: 'Reset All', 
                type: 'btn-danger', 
                callback: () => {
                    questionStats = {};
                    saveQuestionStats();
                    updateSettingsStats();
                    showCustomAlert('Success', 'All statistics have been reset!', '✅', [
                        { text: 'OK', type: 'btn-primary' }
                    ]);
                    console.log('All statistics reset');
                }
            }
        ]
    );
}

function resetApp() {
    showCustomAlert(
        'Reset Entire App',
        '⚠️ WARNING ⚠️\n\nThis will permanently delete:\n\n• All questions\n• All statistics\n• Zen deck progress\n• All settings\n\nThe app will return to its original state (empty).\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?',
        '🚨',
        [
            { text: 'Cancel', type: 'btn-secondary' },
            { 
                text: 'Reset Everything', 
                type: 'btn-danger', 
                callback: () => {
                    // Clear all localStorage data
                    localStorage.removeItem('csa_flashcards');
                    localStorage.removeItem('csa_question_stats');
                    localStorage.removeItem('csa_zen_deck');
                    localStorage.removeItem('csa_app_settings');
                    
                    console.log('App reset complete - reloading page');
                    
                    // Show success message and reload
                    showCustomAlert(
                        'App Reset Complete',
                        'The app has been reset to its original state.\n\nThe page will now reload.',
                        '✅',
                        [
                            { 
                                text: 'OK', 
                                type: 'btn-primary',
                                callback: () => {
                                    window.location.reload();
                                }
                            }
                        ]
                    );
                }
            }
        ]
    );
}

function showDatabase() {
    const dbList = document.getElementById('database-list');
    dbList.innerHTML = '';
    
    // Check if there are no questions
    if (flashcards.length === 0) {
        dbList.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #95a5a6;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 80px; height: 80px; margin-bottom: 20px; opacity: 0.5; color: #667eea;">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" y1="18" x2="12" y2="12"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
                <h3 style="color: #2c3e50; font-size: 1.3rem; margin-bottom: 15px;">No Questions Yet</h3>
                <p style="font-size: 1rem; margin-bottom: 25px; line-height: 1.6; color: #777;">
                    Your question database is empty. Get started by creating questions manually or importing them from Excel.
                </p>
                <div style="display: flex; flex-direction: column; gap: 12px; max-width: 300px; margin: 0 auto;">
                    <button class="btn btn-primary" onclick="openAddQuestionModal()" style="width: 100%;">
                        ➕ Create Question
                    </button>
                    <button class="btn btn-secondary" onclick="closeDatabase(); showSettings(); setTimeout(() => openImportModal(), 100);" style="width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                        📥 Import from Excel
                    </button>
                </div>
            </div>
        `;
        showScreen('database-screen');
        return;
    }
    
    // Update question count
    const questionCount = document.getElementById('question-count');
    if (questionCount) {
        const count = flashcards.length;
        questionCount.textContent = count === 1 ? '1 question' : `${count} questions`;
    }
    
    flashcards.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.className = 'db-card';
        cardElement.onclick = () => showQuestionDetails(card.id);
        cardElement.style.cursor = 'pointer';
        
        const correctLetters = card.correctAnswers.map(i => String.fromCharCode(65 + i)).join(', ');
        const optionsHTML = card.options.map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            const isCorrect = card.correctAnswers.includes(i);
            return `<div style="margin: 5px 0;"><strong>${letter}:</strong> ${opt} ${isCorrect ? '✓' : ''}</div>`;
        }).join('');
        
        cardElement.innerHTML = `
            <button class="db-card-delete" onclick="event.stopPropagation(); deleteQuestion('${card.id}')" title="Delete question">×</button>
            <div class="db-card-number">${index + 1}</div>
            <div class="db-card-content">
                <div class="db-card-header">
                    <div class="db-question"><strong>Q:</strong> ${card.question}</div>
                    <svg class="db-card-arrow" id="arrow-${card.id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" onclick="event.stopPropagation(); toggleCardOptions('${card.id}')">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
                <div class="db-card-options" id="options-${card.id}" style="display: none;">
                    <div class="db-answer">${optionsHTML}</div>
                    <div style="margin-top: 10px; color: #27ae60; font-weight: 600;">Correct: ${correctLetters}</div>
                </div>
            </div>
        `;
        dbList.appendChild(cardElement);
    });
    
    showScreen('database-screen');
}

function closeDatabase() {
    // Helper function to close database screen
    showScreen('home-screen');
}

function toggleCardOptions(cardId) {
    const optionsDiv = document.getElementById(`options-${cardId}`);
    const arrow = document.getElementById(`arrow-${cardId}`);
    
    if (!optionsDiv || !arrow) return;
    
    if (optionsDiv.style.display === 'none') {
        optionsDiv.style.display = 'block';
        arrow.classList.add('rotated');
    } else {
        optionsDiv.style.display = 'none';
        arrow.classList.remove('rotated');
    }
}

function deleteQuestion(questionId) {
    showCustomAlert(
        'Delete Question',
        'Are you sure you want to delete this question?\n\nThis action cannot be undone.',
        '⚠️',
        [
            { text: 'Cancel', type: 'btn-secondary' },
            { 
                text: 'Delete', 
                type: 'btn-danger', 
                callback: () => {
                    const index = flashcards.findIndex(q => q.id === questionId);
                    if (index !== -1) {
                        flashcards.splice(index, 1);
                        saveFlashcards();
                        showDatabase(); // Refresh the list
                        console.log('Question deleted. Total questions:', flashcards.length);
                    }
                }
            }
        ]
    );
}

function openAddQuestionModal() {
    document.getElementById('add-question-modal').classList.add('active');
    document.getElementById('new-question-text').value = '';
    document.getElementById('new-explanation-text').value = '';
    document.getElementById('new-question-type').value = '';
    document.getElementById('new-question-verified').checked = false;
    document.getElementById('new-question-deprecated').checked = false;
    document.getElementById('explanation-field').style.display = 'none';
    document.getElementById('explanation-toggle-icon').textContent = '+';
    document.getElementById('moreinfo-field').style.display = 'none';
    document.getElementById('moreinfo-toggle-icon').textContent = '+';
    // Reset to 1 default option
    const optionsContainer = document.getElementById('new-options-container');
    optionsContainer.innerHTML = `
        <div class="option-input-card">
            <input type="checkbox" class="option-checkbox" onchange="toggleOptionHighlight(this)">
            <input type="text" class="option-input-simple" placeholder="Option A">
            <div class="option-controls-zone">
                <svg class="option-expand-btn" onclick="toggleOptionExplanationInModal(this)" title="Add explanation" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <button type="button" class="option-delete-btn" onclick="deleteOption(this)" title="Delete option">×</button>
            </div>
            <div class="option-explanation-field" style="display: none;">
                <textarea class="option-explanation-textarea" placeholder="Explanation for this option (optional)..." rows="2"></textarea>
            </div>
        </div>
    `;
}

function toggleExplanationField() {
    const field = document.getElementById('explanation-field');
    const icon = document.getElementById('explanation-toggle-icon');
    
    if (field.style.display === 'none') {
        field.style.display = 'block';
        icon.textContent = '−';
    } else {
        field.style.display = 'none';
        icon.textContent = '+';
    }
}

function toggleMoreInfoField() {
    const field = document.getElementById('moreinfo-field');
    const icon = document.getElementById('moreinfo-toggle-icon');
    
    if (field.style.display === 'none') {
        field.style.display = 'block';
        icon.textContent = '−';
    } else {
        field.style.display = 'none';
        icon.textContent = '+';
    }
}

function closeAddQuestionModal() {
    document.getElementById('add-question-modal').classList.remove('active');
}

function addNewOption() {
    const container = document.getElementById('new-options-container');
    const optionCount = container.children.length;
    const letter = String.fromCharCode(65 + optionCount);
    
    const optionCard = document.createElement('div');
    optionCard.className = 'option-input-card';
    optionCard.innerHTML = `
        <input type="checkbox" class="option-checkbox" onchange="toggleOptionHighlight(this)">
        <input type="text" class="option-input-simple" placeholder="Option ${letter}">
        <div class="option-controls-zone">
            <svg class="option-expand-btn" onclick="toggleOptionExplanationInModal(this)" title="Add explanation" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            <button type="button" class="option-delete-btn" onclick="deleteOption(this)" title="Delete option">×</button>
        </div>
        <div class="option-explanation-field" style="display: none;">
            <textarea class="option-explanation-textarea" placeholder="Explanation for this option (optional)..." rows="2"></textarea>
        </div>
    `;
    container.appendChild(optionCard);
}

function toggleOptionExplanationInModal(svg) {
    const card = svg.closest('.option-input-card');
    const explanationField = card.querySelector('.option-explanation-field');
    const textarea = explanationField.querySelector('.option-explanation-textarea');
    const isExpanded = explanationField.style.display !== 'none';
    
    if (isExpanded) {
        explanationField.style.display = 'none';
        svg.classList.remove('rotated');
    } else {
        explanationField.style.display = 'block';
        svg.classList.add('rotated');
        autoResizeTextarea(textarea);
        textarea.focus();
    }
}

function autoResizeTextarea(textarea) {
    if (!textarea) return;
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set height to scrollHeight (content height)
    const newHeight = Math.max(textarea.scrollHeight, 50); // Minimum 50px
    textarea.style.height = newHeight + 'px';
}

// Add event listener to auto-resize textareas as user types
document.addEventListener('input', function(e) {
    if (e.target.classList.contains('option-explanation-textarea')) {
        autoResizeTextarea(e.target);
    }
});

function toggleOptionHighlight(checkbox) {
    const card = checkbox.closest('.option-input-card');
    if (checkbox.checked) {
        card.classList.add('checked');
    } else {
        card.classList.remove('checked');
    }
}

function deleteOption(button) {
    const container = document.getElementById('new-options-container');
    const card = button.closest('.option-input-card');
    
    // Don't allow deleting if only one option remains
    if (container.children.length <= 1) {
        showCustomAlert('Error', 'You must have at least one option.', '❌', [
            { text: 'OK', type: 'btn-primary' }
        ]);
        return;
    }
    
    card.remove();
    
    // Update placeholders
    const cards = container.querySelectorAll('.option-input-card');
    cards.forEach((c, index) => {
        const input = c.querySelector('.option-input-simple');
        const letter = String.fromCharCode(65 + index);
        input.placeholder = `Option ${letter}`;
    });
}

function saveNewQuestion() {
    const questionText = document.getElementById('new-question-text').value.trim();
    
    if (!questionText) {
        showCustomAlert('Error', 'Please enter a question.', '❌', [
            { text: 'OK', type: 'btn-primary' }
        ]);
        return;
    }
    
    const optionCards = document.querySelectorAll('#new-options-container .option-input-card');
    const options = [];
    const correctAnswers = [];
    const optionExplanations = {};
    
    optionCards.forEach((card, index) => {
        const checkbox = card.querySelector('.option-checkbox');
        const input = card.querySelector('.option-input-simple');
        const explanationTextarea = card.querySelector('.option-explanation-textarea');
        const optionText = input.value.trim();
        
        if (optionText) {
            options.push(optionText);
            if (checkbox.checked) {
                correctAnswers.push(index);
            }
            
            // Save option explanation if exists
            const explanationText = explanationTextarea?.value.trim();
            if (explanationText) {
                const letter = String.fromCharCode(65 + index);
                optionExplanations[letter] = explanationText;
            }
        }
    });
    
    if (options.length < 2) {
        showCustomAlert('Error', 'Please add at least 2 options.', '❌', [
            { text: 'OK', type: 'btn-primary' }
        ]);
        return;
    }
    
    if (correctAnswers.length === 0) {
        showCustomAlert('Error', 'Please check at least one correct answer.', '❌', [
            { text: 'OK', type: 'btn-primary' }
        ]);
        return;
    }
    
    const explanationText = document.getElementById('new-explanation-text').value.trim();
    const typeText = document.getElementById('new-question-type').value.trim();
    const isVerified = document.getElementById('new-question-verified').checked;
    const isDeprecated = document.getElementById('new-question-deprecated').checked;
    
    // Create new question
    const newQuestion = {
        id: generateQuestionId(),
        question: questionText,
        options: options,
        correctAnswers: correctAnswers,
        verified: isVerified,
        deprecated: isDeprecated,
        type: typeText,
        optionExplanations: optionExplanations
    };
    
    // Add explanation if provided
    if (explanationText) {
        newQuestion.explanation = explanationText;
    }
    
    flashcards.push(newQuestion);
    saveFlashcards();
    
    showCustomAlert('Success', 'Question added successfully!', '✅', [
        { text: 'OK', type: 'btn-primary', callback: () => showDatabase() }
    ]);
    
    closeAddQuestionModal();
}

let selectedFile = null;

function showCustomAlert(title, message, icon, buttons) {
    document.getElementById('alert-icon').textContent = icon;
    document.getElementById('alert-title').textContent = title;
    document.getElementById('alert-message').textContent = message;
    
    const buttonsContainer = document.getElementById('alert-buttons');
    buttonsContainer.innerHTML = '';
    
    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `btn ${btn.type || 'btn-secondary'}`;
        button.textContent = btn.text;
        button.onclick = () => {
            closeCustomAlert();
            if (btn.callback) btn.callback();
        };
        buttonsContainer.appendChild(button);
    });
    
    document.getElementById('custom-alert').classList.add('active');
}

function closeCustomAlert() {
    document.getElementById('custom-alert').classList.remove('active');
}

function openImportModal() {
    document.getElementById('import-modal').classList.add('active');
}

function closeImportModal() {
    document.getElementById('import-modal').classList.remove('active');
    document.getElementById('excel-file').value = '';
    document.getElementById('file-name').textContent = '';
    document.getElementById('import-btn').disabled = true;
    document.getElementById('processing-bar').style.display = 'none';
    selectedFile = null;
}

function handleFileSelect(event) {
    selectedFile = event.target.files[0];
    if (selectedFile) {
        document.getElementById('file-name').textContent = `Selected: ${selectedFile.name}`;
        document.getElementById('import-btn').disabled = false;
    }
}

function updateProgress(percent, text) {
    document.getElementById('progress-import').style.width = percent + '%';
    document.getElementById('processing-text').textContent = text;
}

function parseQuestionText(text) {
    // Extract options from question text
    // Pattern: newline/start + capital letter + period + space/text
    // More flexible to handle different line breaks and spacing
    const optionPattern = /[\r\n]+\s*([A-Z])\.\s*([^\r\n]+)/g;
    let matches;
    const options = [];
    const optionMap = {};
    
    // Find first option to split question from options
    const firstOptionMatch = text.match(/[\r\n]+\s*([A-Z])\./);
    let questionText = text;
    
    if (firstOptionMatch) {
        questionText = text.substring(0, firstOptionMatch.index).trim();
    }
    
    // Extract all options
    while ((matches = optionPattern.exec(text)) !== null) {
        const letter = matches[1];
        const optionText = matches[2].trim();
        options.push(optionText);
        optionMap[letter] = options.length - 1;
    }
    
    // If no options found with newlines, try without newlines (all on same line or with spaces)
    if (options.length === 0) {
        const inlinePattern = /([A-Z])\.\s*([^A-Z\.]+?)(?=\s+[A-Z]\.|$)/g;
        while ((matches = inlinePattern.exec(text)) !== null) {
            const letter = matches[1];
            const optionText = matches[2].trim();
            if (optionText.length > 0) {
                options.push(optionText);
                optionMap[letter] = options.length - 1;
            }
        }
        
        // If still no options, try to find question text before first letter pattern
        if (options.length > 0) {
            const firstMatch = text.match(/([A-Z])\./);
            if (firstMatch) {
                questionText = text.substring(0, firstMatch.index).trim();
            }
        }
    }
    
    return { question: questionText, options, optionMap };
}

function parseAnswerText(text) {
    // New strict format: only extract answer letters from lines starting with "Letter."
    // Each line that starts with a capital letter followed by a period is an answer
    // Everything else is ignored
    const lines = text.split(/[\r\n]+/);
    const correctLetters = [];
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        // Check if line starts with capital letter followed by period
        const match = trimmedLine.match(/^([A-Z])\./);
        if (match) {
            correctLetters.push(match[1]);
        }
    }
    
    return { correctLetters };
}

async function processImport() {
    console.log('processImport called');
    
    if (!selectedFile) {
        showCustomAlert('No File Selected', 'Please select an Excel file first.', '📁', [
            { text: 'OK', type: 'btn-primary' }
        ]);
        return;
    }
    
    console.log('File selected:', selectedFile.name);
    
    const mode = document.querySelector('input[name="import-mode"]:checked').value;
    console.log('Import mode:', mode);
    
    // If no questions exist, skip confirmation and import directly
    if (flashcards.length === 0) {
        console.log('No existing questions, importing directly');
        executeImport(mode);
        return;
    }
    
    // For Replace mode, count questions first to show in warning
    if (mode === 'replace') {
        // Quick count of questions in file
        try {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    if (typeof XLSX === 'undefined') {
                        showCustomAlert('Error', 'Excel library not loaded. Please refresh the page.', '❌', [
                            { text: 'OK', type: 'btn-primary' }
                        ]);
                        return;
                    }
                    
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                    
                    const headers = jsonData[0];
                    const normalizedHeaders = headers.map(h => h ? h.toString().toLowerCase().trim() : '');
                    const questionCol = normalizedHeaders.findIndex(h => h === 'question');
                    const answerCol = normalizedHeaders.findIndex(h => h === 'answer');
                    
                    if (questionCol === -1 || answerCol === -1) {
                        showCustomAlert('Invalid Format', 'Excel file must have "Question" and "Answer" columns.', '❌', [
                            { text: 'OK', type: 'btn-primary' }
                        ]);
                        return;
                    }
                    
                    // Count valid rows
                    let validCount = 0;
                    for (let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (row[questionCol] && row[answerCol]) {
                            validCount++;
                        }
                    }
                    
                    showCustomAlert(
                        'Warning',
                        `This will DELETE ALL ${flashcards.length} existing questions and import ${validCount} new ones from the file.\n\nAre you sure you want to continue?`,
                        '⚠️',
                        [
                            { text: 'Cancel', type: 'btn-secondary' },
                            { text: 'Continue', type: 'btn-danger', callback: () => executeImport(mode) }
                        ]
                    );
                } catch (error) {
                    showCustomAlert('Error', 'Error reading file: ' + error.message, '❌', [
                        { text: 'OK', type: 'btn-primary' }
                    ]);
                }
            };
            reader.readAsArrayBuffer(selectedFile);
        } catch (error) {
            showCustomAlert('Error', error.message, '❌', [
                { text: 'OK', type: 'btn-primary' }
            ]);
        }
    } else {
        showCustomAlert(
            'Confirm Import',
            `This will add new questions to your existing ${flashcards.length} questions.\n\nContinue with import?`,
            '📥',
            [
                { text: 'Cancel', type: 'btn-secondary' },
                { text: 'Import', type: 'btn-primary', callback: () => executeImport(mode) }
            ]
        );
    }
}

async function executeImport(mode) {
    console.log('Starting import process...');
    
    // Show processing bar
    document.getElementById('processing-bar').style.display = 'block';
    document.getElementById('import-btn').disabled = true;
    updateProgress(10, 'Reading file...');
    
    try {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            console.log('File loaded, processing...');
            try {
                updateProgress(30, 'Parsing Excel data...');
                
                // Check if XLSX library is available
                if (typeof XLSX === 'undefined') {
                    console.error('XLSX library not loaded');
                    showCustomAlert('Error', 'Excel library not loaded. Please refresh the page and try again.', '❌', [
                        { text: 'OK', type: 'btn-primary' }
                    ]);
                    closeImportModal();
                    return;
                }
                
                console.log('XLSX library available');
                
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellFormula: false, cellHTML: false });
                console.log('Workbook loaded:', workbook.SheetNames);
                
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: '' });
                console.log('Rows found:', jsonData.length);
                
                updateProgress(50, 'Processing questions...');
                
                // Find column indices
                const headers = jsonData[0];
                console.log('Headers:', headers);
                
                // Normalize headers: lowercase and trim spaces
                const normalizedHeaders = headers.map(h => h ? h.toString().toLowerCase().trim() : '');
                console.log('Normalized headers:', normalizedHeaders);
                
                // Required columns
                const idCol = normalizedHeaders.findIndex(h => h === 'id');
                const questionCol = normalizedHeaders.findIndex(h => h === 'question');
                const answerCol = normalizedHeaders.findIndex(h => h === 'answer');
                
                // Optional columns
                const explanationCol = normalizedHeaders.findIndex(h => h === 'explanation');
                const categoryCol = normalizedHeaders.findIndex(h => h === 'category');
                const verifiedCol = normalizedHeaders.findIndex(h => h === 'verified');
                const deprecatedCol = normalizedHeaders.findIndex(h => h === 'deprecated');
                
                console.log('Required - ID:', idCol, 'Question:', questionCol, 'Answer:', answerCol);
                console.log('Optional - Explanation:', explanationCol, 'Category:', categoryCol, 'Verified:', verifiedCol, 'Deprecated:', deprecatedCol);
                
                // Validate required columns
                const missingColumns = [];
                if (idCol === -1) missingColumns.push('ID');
                if (questionCol === -1) missingColumns.push('Question');
                if (answerCol === -1) missingColumns.push('Answer');
                
                if (missingColumns.length > 0) {
                    let errorMessage = `Missing required columns: ${missingColumns.join(', ')}\n\nRequired columns (case insensitive):\n• ID\n• Question\n• Answer`;
                    
                    if (missingColumns.includes('ID')) {
                        errorMessage += '\n\n📘 The ID column is used to identify questions when updating existing ones. Click "Excel Formatting Rules" for more details.';
                    }
                    
                    showCustomAlert('Invalid Format', errorMessage, '❌', [
                        { text: 'See Format Guide', type: 'btn-secondary', callback: () => { closeImportModal(); setTimeout(() => openExcelFormattingGuide(), 100); } },
                        { text: 'OK', type: 'btn-primary' }
                    ]);
                    closeImportModal();
                    return;
                }
                
                const newQuestions = [];
                const seenIds = new Set();
                const duplicateIds = new Set();
                const rowsWithMissingIds = [];
                
                // Track skipped rows with details
                const skippedRows = {
                    missingQuestion: [],
                    missingAnswer: [],
                    onlyId: []
                };
                
                // Process each row
                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    const rowId = row[idCol] ? row[idCol].toString().trim() : '';
                    const hasQuestion = row[questionCol] && row[questionCol].toString().trim();
                    const hasAnswer = row[answerCol] && row[answerCol].toString().trim();
                    
                    // Skip completely empty rows
                    if (!rowId && !hasQuestion && !hasAnswer) {
                        console.log(`Row ${i + 1}: Completely empty, skipping`);
                        continue;
                    }
                    
                    // Track rows with only ID (silently ignored)
                    if (rowId && !hasQuestion && !hasAnswer) {
                        skippedRows.onlyId.push(i + 1);
                        console.log(`Row ${i + 1}: Only ID present, skipping`);
                        continue;
                    }
                    
                    // Track rows missing question or answer
                    if (!hasQuestion) {
                        skippedRows.missingQuestion.push(i + 1);
                        console.log(`Row ${i + 1}: Missing question, skipping`);
                        continue;
                    }
                    
                    if (!hasAnswer) {
                        skippedRows.missingAnswer.push(i + 1);
                        console.log(`Row ${i + 1}: Missing answer, skipping`);
                        continue;
                    }
                    
                    console.log(`Processing row ${i + 1}...`);
                    
                    // Check for missing ID (warning, not error)
                    if (!rowId) {
                        rowsWithMissingIds.push(i + 1);
                    } else {
                        // Check for duplicate IDs
                        if (seenIds.has(rowId)) {
                            duplicateIds.add(rowId);
                        }
                        seenIds.add(rowId);
                    }
                    
                    const questionData = parseQuestionText(row[questionCol].toString());
                    const answerData = parseAnswerText(row[answerCol].toString());
                    
                    console.log(`Row ${i + 1} - Options found:`, questionData.options.length);
                    console.log(`Row ${i + 1} - Correct letters:`, answerData.correctLetters);
                    
                    if (questionData.options.length === 0) {
                        console.warn(`Row ${i + 1}: No options found, skipping`);
                        continue;
                    }
                    
                    // Map answer letters to indices
                    const correctAnswers = answerData.correctLetters
                        .map(letter => questionData.optionMap[letter])
                        .filter(idx => idx !== undefined);
                    
                    if (correctAnswers.length === 0) {
                        console.warn(`Row ${i + 1}: No valid correct answers found, skipping`);
                        continue;
                    }
                    
                    // Use provided ID or generate new one
                    const questionId = rowId || generateQuestionId();
                    
                    const questionObj = {
                        id: questionId,
                        question: questionData.question,
                        options: questionData.options,
                        correctAnswers: correctAnswers,
                        optionExplanations: {} // Store explanations for each option
                    };
                    
                    // Add explanation if provided and parse it
                    if (explanationCol !== -1 && row[explanationCol] !== undefined && row[explanationCol] !== null && row[explanationCol] !== '') {
                        const explanationText = row[explanationCol].toString().trim();
                        const parsed = parseExplanation(explanationText);
                        
                        // Store context as explanation
                        if (parsed.context) {
                            questionObj.explanation = parsed.context;
                        }
                        
                        // Store option explanations
                        questionObj.optionExplanations = parsed.optionExplanations;
                    }
                    
                    // Add category (renamed from type)
                    if (categoryCol !== -1 && row[categoryCol] !== undefined && row[categoryCol] !== null && row[categoryCol] !== '') {
                        questionObj.type = row[categoryCol].toString().trim();
                    } else {
                        questionObj.type = '';
                    }
                    
                    // Add verified flag
                    if (verifiedCol !== -1 && row[verifiedCol] !== undefined && row[verifiedCol] !== null && row[verifiedCol] !== '') {
                        const verifiedValue = row[verifiedCol].toString().toLowerCase().trim();
                        questionObj.verified = verifiedValue === 'true' || verifiedValue === '1' || verifiedValue === 'yes' || verifiedValue === 'verdadeiro' || verifiedValue === 'sim';
                    } else {
                        questionObj.verified = false;
                    }
                    
                    // Add deprecated flag
                    if (deprecatedCol !== -1 && row[deprecatedCol] !== undefined && row[deprecatedCol] !== null && row[deprecatedCol] !== '') {
                        const deprecatedValue = row[deprecatedCol].toString().toLowerCase().trim();
                        questionObj.deprecated = deprecatedValue === 'true' || deprecatedValue === '1' || deprecatedValue === 'yes' || deprecatedValue === 'verdadeiro' || deprecatedValue === 'sim';
                    } else {
                        questionObj.deprecated = false;
                    }
                    
                    newQuestions.push(questionObj);
                    
                    updateProgress(50 + (i / jsonData.length) * 30, `Processing question ${i}/${jsonData.length - 1}...`);
                }
                
                console.log('Total questions processed:', newQuestions.length);
                
                // Check for duplicate IDs - this is a blocking error
                if (duplicateIds.size > 0) {
                    const duplicateList = Array.from(duplicateIds).join(', ');
                    showCustomAlert(
                        'Duplicate IDs Found',
                        `The following IDs appear more than once in your Excel file:\n\n${duplicateList}\n\nEach question must have a unique ID. Please fix these duplicates and try again.`,
                        '❌',
                        [{ text: 'OK', type: 'btn-primary' }]
                    );
                    closeImportModal();
                    return;
                }
                
                if (newQuestions.length === 0) {
                    showCustomAlert('No Questions Found', 'No valid questions found in the Excel file. Please check the format.', '⚠️', [
                        { text: 'OK', type: 'btn-primary' }
                    ]);
                    closeImportModal();
                    return;
                }
                
                updateProgress(85, 'Finalizing...');
                
                // Build skipped rows summary
                let skippedSummary = '';
                const totalSkipped = skippedRows.missingQuestion.length + skippedRows.missingAnswer.length;
                
                if (totalSkipped > 0) {
                    skippedSummary = `\n\n⚠️ ${totalSkipped} row(s) ignored:`;
                    if (skippedRows.missingQuestion.length > 0) {
                        skippedSummary += `\n• ${skippedRows.missingQuestion.length} missing Question`;
                    }
                    if (skippedRows.missingAnswer.length > 0) {
                        skippedSummary += `\n• ${skippedRows.missingAnswer.length} missing Answer`;
                    }
                }
                
                // Apply import mode
                let resultMessage = '';
                if (mode === 'replace') {
                    flashcards.length = 0;
                    flashcards.push(...newQuestions);
                    saveFlashcards();
                    console.log('Replaced all questions');
                    resultMessage = `Successfully replaced all questions!\n\nImported: ${newQuestions.length} questions`;
                    
                    if (skippedSummary) {
                        resultMessage += skippedSummary;
                    }
                    
                    if (rowsWithMissingIds.length > 0) {
                        resultMessage += `\n\n⚠️ ${rowsWithMissingIds.length} question(s) missing IDs - auto-generated IDs assigned.`;
                    }
                } else {
                    // Insert mode - skip duplicates
                    let addedCount = 0;
                    let duplicateCount = 0;
                    
                    newQuestions.forEach(newQ => {
                        const isDuplicate = flashcards.some(existingQ => 
                            existingQ.question.trim() === newQ.question.trim()
                        );
                        if (!isDuplicate) {
                            flashcards.push(newQ);
                            addedCount++;
                        } else {
                            duplicateCount++;
                        }
                    });
                    
                    saveFlashcards();
                    console.log('Added questions:', addedCount, 'Duplicates skipped:', duplicateCount);
                    
                    if (addedCount === 0) {
                        showCustomAlert('No New Questions', `All ${duplicateCount} questions from the file already exist in the database.`, 'ℹ️', [
                            { text: 'OK', type: 'btn-primary' }
                        ]);
                        closeImportModal();
                        return;
                    }
                    
                    resultMessage = `Successfully imported!\n\nNew questions added: ${addedCount}\nDuplicates skipped: ${duplicateCount}\nTotal questions now: ${flashcards.length}`;
                    
                    if (skippedSummary) {
                        resultMessage += skippedSummary;
                    }
                    
                    if (rowsWithMissingIds.length > 0) {
                        resultMessage += `\n\n⚠️ ${rowsWithMissingIds.length} question(s) missing IDs - auto-generated IDs assigned.`;
                    }
                }
                
                updateProgress(100, 'Complete!');
                
                setTimeout(() => {
                    showCustomAlert('Success', resultMessage, '✅', [
                        { text: 'OK', type: 'btn-primary', callback: () => updateSettingsStats() }
                    ]);
                    console.log('Import complete!');
                    closeImportModal();
                }, 500);
                
            } catch (error) {
                console.error('Error processing file:', error);
                showCustomAlert('Error', 'Error processing file: ' + error.message, '❌', [
                    { text: 'OK', type: 'btn-primary' }
                ]);
                closeImportModal();
            }
        };
        
        reader.onerror = function() {
            console.error('Error reading file');
            showCustomAlert('Error', 'Error reading the file. Please try again.', '❌', [
                { text: 'OK', type: 'btn-primary' }
            ]);
            closeImportModal();
        };
        
        reader.readAsArrayBuffer(selectedFile);
        
    } catch (error) {
        console.error('Error:', error);
        showCustomAlert('Error', error.message, '❌', [
            { text: 'OK', type: 'btn-primary' }
        ]);
        closeImportModal();
    }
}

let currentDetailQuestionId = null;

// Parse explanation to extract context and option explanations
function parseExplanation(explanationText) {
    if (!explanationText || !explanationText.trim()) {
        return { context: '', optionExplanations: {} };
    }
    
    // Pattern to match option letters (A., B., C., etc.)
    const optionPattern = /^([A-Z])\.\s*/gm;
    
    // Find all matches
    const matches = [];
    let match;
    while ((match = optionPattern.exec(explanationText)) !== null) {
        matches.push({
            letter: match[1],
            index: match.index
        });
    }
    
    // If no options found, entire text is context
    if (matches.length === 0) {
        // Remove "Context:" prefix if it exists
        let context = explanationText.trim();
        if (context.toLowerCase().startsWith('context:')) {
            context = context.substring(8).trim(); // Remove "Context:" (8 characters)
        }
        return { context: context, optionExplanations: {} };
    }
    
    // Extract context (everything before first option)
    let context = explanationText.substring(0, matches[0].index).trim();
    
    // Remove "Context:" prefix if it exists
    if (context.toLowerCase().startsWith('context:')) {
        context = context.substring(8).trim(); // Remove "Context:" (8 characters)
    }
    
    // Extract option explanations
    const optionExplanations = {};
    for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i];
        const nextMatch = matches[i + 1];
        
        const startIndex = currentMatch.index + currentMatch.letter.length + 1; // +1 for the dot
        const endIndex = nextMatch ? nextMatch.index : explanationText.length;
        
        const explanation = explanationText.substring(startIndex, endIndex).trim();
        optionExplanations[currentMatch.letter] = explanation;
    }
    
    return { context, optionExplanations };
}

function showQuestionDetails(questionId) {
    currentDetailQuestionId = questionId;
    const question = flashcards.find(q => q.id === questionId);
    
    if (!question) {
        console.error('Question not found:', questionId);
        return;
    }
    
    // Set question text
    document.getElementById('detail-question-text').innerHTML = linkifyText(question.question);
    
    // Set options
    const optionsContainer = document.getElementById('detail-options-container');
    optionsContainer.innerHTML = '';
    
    // Parse explanation to get option explanations
    const explanationText = question.explanation || question.notes || '';
    const parsed = parseExplanation(explanationText);
    
    question.options.forEach((option, index) => {
        const isCorrect = question.correctAnswers.includes(index);
        const letter = String.fromCharCode(65 + index);
        
        // Check if there's an explanation for this option
        let optionExplanation = null;
        
        // First check if optionExplanations object exists (new format)
        if (question.optionExplanations && question.optionExplanations[letter]) {
            optionExplanation = question.optionExplanations[letter];
        } else {
            // Fallback to parsing from explanation text (old format)
            optionExplanation = parsed.optionExplanations[letter];
        }
        
        const optionDiv = document.createElement('div');
        optionDiv.className = 'detail-option-wrapper';
        
        // Main option card
        let optionHTML = `
            <div class="detail-option-item ${isCorrect ? 'correct-answer' : ''}" ${optionExplanation ? `style="cursor: pointer;" onclick="toggleDetailOptionExplanation('${letter}')" id="detail-option-${letter}"` : ''}>
                <div class="detail-option-letter">${letter}</div>
                <div class="detail-option-text">${linkifyText(option)}</div>
                ${isCorrect ? '<span style="color: #28a745; font-weight: 700; margin-right: 8px;">✓</span>' : ''}
            </div>
        `;
        
        // Explanation card (if exists)
        if (optionExplanation) {
            optionHTML += `
                <div class="detail-option-explanation-card" id="detail-explanation-${letter}" style="display: none;">
                    <div class="detail-option-explanation-icon">💡</div>
                    <div class="detail-option-explanation-text">${linkifyText(optionExplanation)}</div>
                </div>
            `;
        }
        
        optionDiv.innerHTML = optionHTML;
        optionsContainer.appendChild(optionDiv);
    });
    
    // Show explanation section
    const notesSection = document.getElementById('detail-notes-section');
    const notesDiv = document.getElementById('detail-notes');
    
    if (parsed.context) {
        // Show the context (with "Context:" removed)
        notesDiv.innerHTML = `<div style="color: #2c3e50; line-height: 1.6; font-size: 0.95rem;">${linkifyText(parsed.context)}</div>`;
        notesSection.style.display = 'block';
    } else {
        notesSection.style.display = 'none';
    }
    
    // Show more information if available
    const moreInfoSection = document.getElementById('detail-more-info-section');
    const moreInfoDiv = document.getElementById('detail-more-info');
    const hasType = question.type && question.type.trim();
    const hasVerified = question.verified === true;
    const hasDeprecated = question.deprecated === true;
    
    // Check zen deck position
    const zenPosition = zenDeck.indexOf(question.id);
    const hasZenPosition = zenPosition !== -1;
    
    if (hasType || hasVerified || hasDeprecated || hasZenPosition) {
        let infoHTML = '';
        
        if (hasType) {
            infoHTML += `<div class="info-type-text"><strong>Domain:</strong> ${question.type}</div>`;
        }
        
        if (hasZenPosition) {
            const totalInDeck = zenDeck.length;
            const positionDisplay = zenPosition + 1; // Convert to 1-based
            infoHTML += `<div class="info-type-text" style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-left: 4px solid #667eea;"><strong>🧘 Zen Deck Position:</strong> ${positionDisplay} of ${totalInDeck}</div>`;
        }
        
        if (hasVerified || hasDeprecated) {
            infoHTML += '<div class="info-chips">';
            
            if (hasVerified) {
                infoHTML += `
                    <div class="info-chip verified">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        Verified
                    </div>
                `;
            }
            
            if (hasDeprecated) {
                infoHTML += `
                    <div class="info-chip deprecated">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        Deprecated
                    </div>
                `;
            }
            
            infoHTML += '</div>';
        }
        
        moreInfoDiv.innerHTML = infoHTML;
        moreInfoSection.style.display = 'block';
    } else {
        moreInfoSection.style.display = 'none';
    }
    
    // Reset filter to "All"
    document.getElementById('stats-mode-filter').value = 'all';
    
    // Update stats
    updateQuestionDetailsStats();
    
    // Show modal
    document.getElementById('question-details-modal').classList.add('active');
    saveCurrentScreen(); // Save state when modal opens
}

function closeQuestionDetailsModal() {
    document.getElementById('question-details-modal').classList.remove('active');
    currentDetailQuestionId = null;
    currentOpenExplanation = null; // Reset open explanation when closing modal
    currentOpenDetailOption = null; // Reset open detail option when closing modal
    saveCurrentScreen(); // Save state when modal closes
}

// Toggle option explanation visibility (only one open at a time)
let currentOpenExplanation = null;
let currentOpenDetailOption = null;

function toggleOptionExplanation(letter) {
    const content = document.getElementById(`explanation-${letter}`);
    const arrow = document.getElementById(`arrow-${letter}`);
    
    if (!content || !arrow) return;
    
    // If clicking the currently open one, close it
    if (currentOpenExplanation === letter) {
        content.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
        currentOpenExplanation = null;
    } else {
        // Close previously open explanation
        if (currentOpenExplanation) {
            const prevContent = document.getElementById(`explanation-${currentOpenExplanation}`);
            const prevArrow = document.getElementById(`arrow-${currentOpenExplanation}`);
            if (prevContent) prevContent.style.display = 'none';
            if (prevArrow) prevArrow.style.transform = 'rotate(0deg)';
        }
        
        // Open the clicked one
        content.style.display = 'block';
        arrow.style.transform = 'rotate(180deg)';
        currentOpenExplanation = letter;
    }
}

function toggleDetailOptionExplanation(letter) {
    const content = document.getElementById(`detail-explanation-${letter}`);
    const optionCard = document.getElementById(`detail-option-${letter}`);
    
    if (!content || !optionCard) return;
    
    // If clicking the currently open one, close it
    if (currentOpenDetailOption === letter) {
        content.style.display = 'none';
        optionCard.classList.remove('option-expanded');
        currentOpenDetailOption = null;
    } else {
        // Close previously open explanation
        if (currentOpenDetailOption) {
            const prevContent = document.getElementById(`detail-explanation-${currentOpenDetailOption}`);
            const prevOptionCard = document.getElementById(`detail-option-${currentOpenDetailOption}`);
            if (prevContent) prevContent.style.display = 'none';
            if (prevOptionCard) prevOptionCard.classList.remove('option-expanded');
        }
        
        // Open the clicked one
        content.style.display = 'flex';
        optionCard.classList.add('option-expanded');
        currentOpenDetailOption = letter;
    }
}

function updateQuestionDetailsStats() {
    if (!currentDetailQuestionId) return;
    
    initQuestionStats(currentDetailQuestionId);
    const stats = questionStats[currentDetailQuestionId];
    const mode = document.getElementById('stats-mode-filter').value;
    
    let appeared = 0;
    let correct = 0;
    let wrong = 0;
    
    if (mode === 'all') {
        appeared = stats.zen.appeared + stats.exam.appeared + stats.examOfficial.appeared;
        correct = stats.zen.correct + stats.exam.correct + stats.examOfficial.correct;
        wrong = stats.zen.wrong + stats.exam.wrong + stats.examOfficial.wrong;
    } else {
        appeared = stats[mode].appeared;
        correct = stats[mode].correct;
        wrong = stats[mode].wrong;
    }
    
    const accuracy = appeared > 0 ? Math.round((correct / appeared) * 100) : 0;
    
    const statsContainer = document.getElementById('detail-stats-container');
    statsContainer.innerHTML = `
        <div class="stat-detail-card">
            <div class="stat-detail-label">Times Appeared</div>
            <div class="stat-detail-value">${appeared}</div>
        </div>
        <div class="stat-detail-card correct">
            <div class="stat-detail-label">Correct</div>
            <div class="stat-detail-value">${correct}</div>
        </div>
        <div class="stat-detail-card wrong">
            <div class="stat-detail-label">Wrong</div>
            <div class="stat-detail-value">${wrong}</div>
        </div>
        <div class="stat-detail-card" style="grid-column: span 3;">
            <div class="stat-detail-label">Accuracy</div>
            <div class="stat-detail-value" style="font-size: 2.5rem;">${accuracy}%</div>
        </div>
    `;
}

function deleteQuestionFromDetails() {
    if (!currentDetailQuestionId) {
        console.error('No question ID set');
        return;
    }
    
    // Save the ID before closing modal
    const questionIdToDelete = currentDetailQuestionId;
    console.log('Deleting question:', questionIdToDelete);
    
    closeQuestionDetailsModal();
    
    showCustomAlert(
        'Delete Question',
        'Are you sure you want to delete this question?\n\nThis action cannot be undone.',
        '⚠️',
        [
            { text: 'Cancel', type: 'btn-secondary' },
            { 
                text: 'Delete', 
                type: 'btn-danger', 
                callback: () => {
                    console.log('Delete confirmed for:', questionIdToDelete);
                    const index = flashcards.findIndex(q => q.id === questionIdToDelete);
                    console.log('Found at index:', index);
                    if (index !== -1) {
                        flashcards.splice(index, 1);
                        saveFlashcards();
                        console.log('Question deleted. Total questions:', flashcards.length);
                        showDatabase();
                    } else {
                        console.error('Question not found in flashcards');
                    }
                }
            }
        ]
    );
}

function editQuestionFromDetails() {
    if (!currentDetailQuestionId) return;
    
    const question = flashcards.find(q => q.id === currentDetailQuestionId);
    if (!question) return;
    
    // Close details modal
    closeQuestionDetailsModal();
    
    // Open edit modal
    document.getElementById('add-question-modal').classList.add('active');
    
    // Populate question text
    document.getElementById('new-question-text').value = question.question;
    
    // Populate explanation if exists
    const explanationText = question.explanation || question.notes || '';
    document.getElementById('new-explanation-text').value = explanationText;
    if (explanationText) {
        document.getElementById('explanation-field').style.display = 'block';
        document.getElementById('explanation-toggle-icon').textContent = '−';
    } else {
        document.getElementById('explanation-field').style.display = 'none';
        document.getElementById('explanation-toggle-icon').textContent = '+';
    }
    
    // Populate more info fields
    const typeText = question.type || '';
    const isVerified = question.verified === true;
    const isDeprecated = question.deprecated === true;
    
    document.getElementById('new-question-type').value = typeText;
    document.getElementById('new-question-verified').checked = isVerified;
    document.getElementById('new-question-deprecated').checked = isDeprecated;
    
    if (typeText || isVerified || isDeprecated) {
        document.getElementById('moreinfo-field').style.display = 'block';
        document.getElementById('moreinfo-toggle-icon').textContent = '−';
    } else {
        document.getElementById('moreinfo-field').style.display = 'none';
        document.getElementById('moreinfo-toggle-icon').textContent = '+';
    }
    
    // Populate options
    const optionsContainer = document.getElementById('new-options-container');
    optionsContainer.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const letter = String.fromCharCode(65 + index);
        const isCorrect = question.correctAnswers.includes(index);
        const optionExplanation = question.optionExplanations?.[letter] || '';
        
        const optionCard = document.createElement('div');
        optionCard.className = 'option-input-card' + (isCorrect ? ' checked' : '');
        optionCard.innerHTML = `
            <input type="checkbox" class="option-checkbox" onchange="toggleOptionHighlight(this)" ${isCorrect ? 'checked' : ''}>
            <input type="text" class="option-input-simple" placeholder="Option ${letter}" value="${option}">
            <div class="option-controls-zone">
                <svg class="option-expand-btn" onclick="toggleOptionExplanationInModal(this)" title="Add explanation" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <button type="button" class="option-delete-btn" onclick="deleteOption(this)" title="Delete option">×</button>
            </div>
            <div class="option-explanation-field" style="display: none;">
                <textarea class="option-explanation-textarea" placeholder="Explanation for this option (optional)..." rows="2">${optionExplanation}</textarea>
            </div>
        `;
        optionsContainer.appendChild(optionCard);
        
        // Auto-resize textarea if it has content
        if (optionExplanation) {
            const textarea = optionCard.querySelector('.option-explanation-textarea');
            autoResizeTextarea(textarea);
        }
    });
    
    // Change modal title and button
    document.querySelector('#add-question-modal .modal-header h2').textContent = 'Edit Question';
    const saveBtn = document.querySelector('#add-question-modal .modal-footer .btn-primary');
    saveBtn.textContent = 'Save Changes';
    saveBtn.onclick = () => saveEditedQuestion(currentDetailQuestionId);
    
    // Update cancel button to restore original state
    const cancelBtn = document.querySelector('#add-question-modal .modal-footer .btn-secondary');
    cancelBtn.onclick = () => {
        closeAddQuestionModal();
        restoreAddQuestionModal();
    };
}

function saveEditedQuestion(questionId) {
    const questionText = document.getElementById('new-question-text').value.trim();
    
    if (!questionText) {
        showCustomAlert('Error', 'Please enter a question.', '❌', [
            { text: 'OK', type: 'btn-primary' }
        ]);
        return;
    }
    
    const optionCards = document.querySelectorAll('#new-options-container .option-input-card');
    const options = [];
    const correctAnswers = [];
    const optionExplanations = {};
    
    optionCards.forEach((card, index) => {
        const checkbox = card.querySelector('.option-checkbox');
        const input = card.querySelector('.option-input-simple');
        const explanationTextarea = card.querySelector('.option-explanation-textarea');
        const optionText = input.value.trim();
        
        if (optionText) {
            options.push(optionText);
            if (checkbox.checked) {
                correctAnswers.push(index);
            }
            
            // Save option explanation if exists
            const explanationText = explanationTextarea?.value.trim();
            if (explanationText) {
                const letter = String.fromCharCode(65 + index);
                optionExplanations[letter] = explanationText;
            }
        }
    });
    
    if (options.length < 2) {
        showCustomAlert('Error', 'Please add at least 2 options.', '❌', [
            { text: 'OK', type: 'btn-primary' }
        ]);
        return;
    }
    
    if (correctAnswers.length === 0) {
        showCustomAlert('Error', 'Please check at least one correct answer.', '❌', [
            { text: 'OK', type: 'btn-primary' }
        ]);
        return;
    }
    
    const explanationText = document.getElementById('new-explanation-text').value.trim();
    const typeText = document.getElementById('new-question-type').value.trim();
    const isVerified = document.getElementById('new-question-verified').checked;
    const isDeprecated = document.getElementById('new-question-deprecated').checked;
    
    // Find and update the question
    const index = flashcards.findIndex(q => q.id === questionId);
    if (index !== -1) {
        flashcards[index].question = questionText;
        flashcards[index].options = options;
        flashcards[index].correctAnswers = correctAnswers;
        flashcards[index].verified = isVerified;
        flashcards[index].deprecated = isDeprecated;
        flashcards[index].type = typeText;
        flashcards[index].optionExplanations = optionExplanations;
        
        if (explanationText) {
            flashcards[index].explanation = explanationText;
        } else {
            delete flashcards[index].explanation;
        }
        
        saveFlashcards();
        
        showCustomAlert('Success', 'Question updated successfully!', '✅', [
            { text: 'OK', type: 'btn-primary', callback: () => {
                restoreAddQuestionModal();
                showDatabase();
            }}
        ]);
        
        closeAddQuestionModal();
    }
}

function restoreAddQuestionModal() {
    // Restore original modal state
    document.querySelector('#add-question-modal .modal-header h2').textContent = 'Add New Question';
    const saveBtn = document.querySelector('#add-question-modal .modal-footer .btn-primary');
    saveBtn.textContent = 'Add Question';
    saveBtn.onclick = saveNewQuestion;
    
    const cancelBtn = document.querySelector('#add-question-modal .modal-footer .btn-secondary');
    cancelBtn.onclick = closeAddQuestionModal;
}

// Settings management
function saveSettings() {
    appSettings.includeDeprecated = document.getElementById('include-deprecated').checked;
    appSettings.verifiedOnly = document.getElementById('verified-only').checked;
    
    try {
        localStorage.setItem('csa_app_settings', JSON.stringify(appSettings));
        console.log('Settings saved:', appSettings);
    } catch (e) {
        console.error('Error saving settings:', e);
    }
}

function loadSettings() {
    try {
        const saved = localStorage.getItem('csa_app_settings');
        if (saved) {
            appSettings = JSON.parse(saved);
            console.log('Settings loaded from localStorage:', appSettings);
        } else {
            console.log('No saved settings, using defaults:', appSettings);
        }
    } catch (e) {
        console.error('Error loading settings:', e);
        appSettings = {
            includeDeprecated: true,
            verifiedOnly: false
        };
    }
    
    // Update UI if elements exist
    const includeDeprecatedEl = document.getElementById('include-deprecated');
    const verifiedOnlyEl = document.getElementById('verified-only');
    
    if (includeDeprecatedEl) {
        includeDeprecatedEl.checked = appSettings.includeDeprecated;
    }
    if (verifiedOnlyEl) {
        verifiedOnlyEl.checked = appSettings.verifiedOnly;
    }
    
    console.log('Final settings:', appSettings);
}

function getFilteredFlashcards() {
    let filtered = [...flashcards];
    
    // Filter out deprecated if setting is disabled
    if (!appSettings.includeDeprecated) {
        filtered = filtered.filter(q => {
            // If deprecated property doesn't exist, treat as false (not deprecated)
            return q.deprecated !== true;
        });
        console.log('Filtered out deprecated questions. Remaining:', filtered.length);
    }
    
    // Filter to only verified if setting is enabled
    if (appSettings.verifiedOnly) {
        filtered = filtered.filter(q => {
            // Only include if explicitly verified === true
            return q.verified === true;
        });
        console.log('Filtered to verified only. Remaining:', filtered.length);
    }
    
    return filtered;
}


// Debug function - call in console to check filtering
function debugFiltering() {
    console.log('=== FILTERING DEBUG ===');
    console.log('Total flashcards:', flashcards.length);
    console.log('Settings:', appSettings);
    
    const filtered = getFilteredFlashcards();
    console.log('Filtered flashcards:', filtered.length);
    
    if (filtered.length < flashcards.length) {
        console.log('\nFiltered OUT questions:');
        flashcards.forEach(q => {
            if (!filtered.includes(q)) {
                console.log('-', q.question.substring(0, 50) + '...', {
                    verified: q.verified,
                    deprecated: q.deprecated
                });
            }
        });
    }
    
    console.log('\nTo fix: Go to Settings and adjust filters');
    console.log('- Disable "Verified Questions Only" to see all questions');
    console.log('- Enable "Include Deprecated Questions" to see deprecated ones');
}


// Convert URLs in text to clickable links
function linkifyText(text) {
    if (!text) return text;
    
    // Regex to match URLs starting with https
    const urlRegex = /(https:\/\/[^\s]+)/g;
    
    return text.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" style="color: #667eea; text-decoration: underline; font-weight: 600;">${url}</a>`;
    });
}


// Search functionality
function toggleSearch() {
    const searchContainer = document.getElementById('search-container');
    const filterChipsContainer = document.getElementById('filter-chips-container');
    const searchBtn = document.querySelector('.search-btn');
    
    if (searchContainer.style.display === 'none') {
        searchContainer.style.display = 'block';
        filterChipsContainer.style.display = 'flex';
        searchBtn.classList.add('active');
        document.getElementById('search-input').focus();
    } else {
        searchContainer.style.display = 'none';
        filterChipsContainer.style.display = 'none';
        searchBtn.classList.remove('active');
        clearSearch();
    }
}

function clearSearch() {
    document.getElementById('search-input').value = '';
    currentSort = 'default';
    sortDirection = 'asc';
    document.getElementById('current-sort-label').textContent = 'Default';
    
    // Update dropdown active state
    document.querySelectorAll('.sort-dropdown-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.sort === 'default') {
            item.classList.add('active');
        }
    });
    
    // Reset direction button
    const directionBtn = document.getElementById('sort-direction');
    directionBtn.classList.remove('descending');
    directionBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <polyline points="19 12 12 19 5 12"></polyline>
        </svg>
        Ascending
    `;
    
    applyFiltersAndSort();
}

let currentSort = 'default';
let sortDirection = 'asc';

function toggleSortDropdown() {
    const dropdown = document.getElementById('sort-dropdown-menu');
    dropdown.classList.toggle('active');
}

function selectSort(event, sort, label) {
    event.stopPropagation();
    currentSort = sort;
    document.getElementById('current-sort-label').textContent = label;
    
    // Update active state
    document.querySelectorAll('.sort-dropdown-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Close dropdown
    document.getElementById('sort-dropdown-menu').classList.remove('active');
    
    applyFiltersAndSort();
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('sort-dropdown-menu');
    const dropdownChip = document.querySelector('.sort-dropdown-chip');
    if (dropdown && dropdownChip && !dropdownChip.contains(event.target)) {
        dropdown.classList.remove('active');
    }
});

function setSort(sort) {
    currentSort = sort;
    updateFilterChips();
    applyFiltersAndSort();
}

function toggleSortDirection() {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    const directionBtn = document.getElementById('sort-direction');
    if (sortDirection === 'desc') {
        directionBtn.classList.add('descending');
        directionBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
            Descending
        `;
    } else {
        directionBtn.classList.remove('descending');
        directionBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
            Ascending
        `;
    }
    applyFiltersAndSort();
}

function updateFilterChips() {
    // Update sort chips
    document.querySelectorAll('.sort-chip').forEach(chip => {
        if (chip.dataset.sort === currentSort) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

function applyFiltersAndSort() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    
    // Filter questions
    let filteredCards = flashcards.filter(card => {
        // Apply search filter
        if (searchTerm) {
            const matchesSearch = card.question.toLowerCase().includes(searchTerm) ||
                                card.options.some(opt => opt.toLowerCase().includes(searchTerm));
            if (!matchesSearch) return false;
        }
        
        return true;
    });
    
    // Sort questions
    if (currentSort === 'default') {
        // Default: sort by original question number (index in flashcards array)
        filteredCards.sort((a, b) => {
            const aIndex = flashcards.indexOf(a);
            const bIndex = flashcards.indexOf(b);
            const compareValue = aIndex - bIndex;
            return sortDirection === 'asc' ? compareValue : -compareValue;
        });
    } else if (currentSort === 'appearance') {
        // Appearance: sort by number of times appeared
        filteredCards.sort((a, b) => {
            const aStats = questionStats[a.id] || { zen: {appeared: 0}, exam: {appeared: 0}, examOfficial: {appeared: 0} };
            const bStats = questionStats[b.id] || { zen: {appeared: 0}, exam: {appeared: 0}, examOfficial: {appeared: 0} };
            const aTotal = aStats.zen.appeared + aStats.exam.appeared + aStats.examOfficial.appeared;
            const bTotal = bStats.zen.appeared + bStats.exam.appeared + bStats.examOfficial.appeared;
            const compareValue = aTotal - bTotal;
            return sortDirection === 'asc' ? compareValue : -compareValue;
        });
    } else if (currentSort === 'accuracy') {
        // Accuracy: sort by accuracy percentage
        filteredCards.sort((a, b) => {
            const aStats = questionStats[a.id] || { zen: {appeared: 0, correct: 0}, exam: {appeared: 0, correct: 0}, examOfficial: {appeared: 0, correct: 0} };
            const bStats = questionStats[b.id] || { zen: {appeared: 0, correct: 0}, exam: {appeared: 0, correct: 0}, examOfficial: {appeared: 0, correct: 0} };
            const aTotal = aStats.zen.appeared + aStats.exam.appeared + aStats.examOfficial.appeared;
            const bTotal = bStats.zen.appeared + bStats.exam.appeared + bStats.examOfficial.appeared;
            const aCorrect = aStats.zen.correct + aStats.exam.correct + aStats.examOfficial.correct;
            const bCorrect = bStats.zen.correct + bStats.exam.correct + bStats.examOfficial.correct;
            const aAccuracy = aTotal > 0 ? (aCorrect / aTotal) : 0;
            const bAccuracy = bTotal > 0 ? (bCorrect / bTotal) : 0;
            const compareValue = aAccuracy - bAccuracy;
            return sortDirection === 'asc' ? compareValue : -compareValue;
        });
    } else if (currentSort === 'zen-position') {
        // Zen Deck Order: sort by position in zen deck
        filteredCards.sort((a, b) => {
            const aPos = zenDeck.indexOf(a.id);
            const bPos = zenDeck.indexOf(b.id);
            if (aPos === -1 && bPos === -1) return 0;
            if (aPos === -1) return 1;
            if (bPos === -1) return -1;
            const compareValue = aPos - bPos;
            return sortDirection === 'asc' ? compareValue : -compareValue;
        });
    }
    
    // Display results
    displayFilteredCards(filteredCards);
}

function displayFilteredCards(filteredCards) {
    const dbList = document.getElementById('database-list');
    dbList.innerHTML = '';
    
    // Update question count
    const questionCount = document.getElementById('question-count');
    if (questionCount) {
        const count = filteredCards.length;
        questionCount.textContent = count === 1 ? '1 question' : `${count} questions`;
    }
    
    if (filteredCards.length === 0) {
        dbList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #95a5a6;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 64px; height: 64px; margin-bottom: 20px; opacity: 0.5;">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <p style="font-size: 1.1rem; margin: 0;">No questions found</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">Try adjusting your filters</p>
            </div>
        `;
        return;
    }
    
    filteredCards.forEach((card) => {
        const index = flashcards.indexOf(card);
        const cardElement = document.createElement('div');
        cardElement.className = 'db-card';
        cardElement.onclick = () => showQuestionDetails(card.id);
        cardElement.style.cursor = 'pointer';
        
        const correctLetters = card.correctAnswers.map(i => String.fromCharCode(65 + i)).join(', ');
        const optionsHTML = card.options.map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            const isCorrect = card.correctAnswers.includes(i);
            return `<div style="margin: 5px 0;"><strong>${letter}:</strong> ${opt} ${isCorrect ? '✓' : ''}</div>`;
        }).join('');
        
        cardElement.innerHTML = `
            <button class="db-card-delete" onclick="event.stopPropagation(); deleteQuestion('${card.id}')" title="Delete question">×</button>
            <div class="db-card-number">${index + 1}</div>
            <div class="db-card-content">
                <div class="db-card-header">
                    <div class="db-question"><strong>Q:</strong> ${card.question}</div>
                    <svg class="db-card-arrow" id="arrow-${card.id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" onclick="event.stopPropagation(); toggleCardOptions('${card.id}')">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
                <div class="db-card-options" id="options-${card.id}" style="display: none;">
                    <div class="db-answer">${optionsHTML}</div>
                    <div style="margin-top: 10px; color: #27ae60; font-weight: 600;">Correct: ${correctLetters}</div>
                </div>
            </div>
        `;
        dbList.appendChild(cardElement);
    });
}

function toggleSearch() {
    const searchContainer = document.getElementById('search-container');
    const filterChipsContainer = document.getElementById('filter-chips-container');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.querySelector('.search-btn');
    
    if (searchContainer.style.display === 'none') {
        searchContainer.style.display = 'block';
        filterChipsContainer.style.display = 'block';
        searchInput.focus();
        searchBtn.classList.add('active');
    } else {
        searchContainer.style.display = 'none';
        filterChipsContainer.style.display = 'none';
        searchInput.value = '';
        filterDatabase();
        searchBtn.classList.remove('active');
    }
}

function clearSearch() {
    document.getElementById('search-input').value = '';
    filterDatabase();
    document.getElementById('search-input').focus();
}

function filterDatabase() {
    applyFiltersAndSort();
}


function toggleResultsQuestions() {
    const list = document.getElementById('results-questions-list');
    const arrow = document.getElementById('results-questions-arrow');
    
    if (list.style.display === 'none') {
        list.style.display = 'block';
        arrow.style.transform = 'rotate(180deg)';
    } else {
        list.style.display = 'none';
        arrow.style.transform = 'rotate(0deg)';
    }
}

function showResultQuestionDetail(index) {
    const result = sessionResults[index];
    const question = result.question;
    
    // Parse explanation to get option explanations
    const explanationText = question.explanation || question.notes || '';
    const parsed = parseExplanation(explanationText);
    
    // Build modal content similar to question details but with user's answers
    let modalHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Question ${index + 1} - ${result.isCorrect ? 'Correct ✓' : 'Wrong ✗'}</h2>
                <button class="modal-close" onclick="closeResultDetailModal()">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label style="font-weight: 700; color: #2c3e50; margin-bottom: 10px;">Question:</label>
                    <p style="color: #555; line-height: 1.6; margin-bottom: 20px;">${linkifyText(question.question)}</p>
                </div>
                
                <div class="form-group">
                    <label style="font-weight: 700; color: #2c3e50; margin-bottom: 10px;">Your Answer:</label>
                    <div id="result-options-container" style="margin-bottom: 20px;">
    `;
    
    question.options.forEach((option, i) => {
        const isCorrect = question.correctAnswers.includes(i);
        const wasSelected = result.userAnswers.includes(i);
        const letter = String.fromCharCode(65 + i);
        
        // Check if there's an explanation for this option
        let optionExplanation = null;
        if (question.optionExplanations && question.optionExplanations[letter]) {
            optionExplanation = question.optionExplanations[letter];
        } else {
            optionExplanation = parsed.optionExplanations[letter];
        }
        
        let className = 'detail-option-item';
        let badge = '';
        
        if (isCorrect) {
            className += ' correct-answer';
            badge = '<span style="color: #28a745; font-weight: 700; margin-left: 10px;">✓ Correct</span>';
        } else if (wasSelected) {
            className += ' wrong-answer';
            badge = '<span style="color: #e74c3c; font-weight: 700; margin-left: 10px;">✗ Your choice</span>';
        }
        
        modalHTML += `
            <div class="detail-option-wrapper">
                <div class="${className}" ${optionExplanation ? `style="cursor: pointer; margin-bottom: 10px;" onclick="toggleResultOptionExplanation('${letter}')" id="result-option-${letter}"` : 'style="margin-bottom: 10px;"'}>
                    <div class="detail-option-letter">${letter}</div>
                    <div class="detail-option-text">${linkifyText(option)}</div>
                    ${badge}
                </div>
        `;
        
        // Add explanation card if exists
        if (optionExplanation) {
            modalHTML += `
                <div class="detail-option-explanation-card" id="result-explanation-${letter}" style="display: none;">
                    <div class="detail-option-explanation-icon">💡</div>
                    <div class="detail-option-explanation-text">${linkifyText(optionExplanation)}</div>
                </div>
            `;
        }
        
        modalHTML += `</div>`;
    });
    
    modalHTML += `
                    </div>
                </div>
    `;
    
    // Collapsible explanation section
    if (question.explanation || question.notes) {
        const explanation = question.explanation || question.notes;
        modalHTML += `
                <div class="form-group">
                    <div class="explanation-toggle" onclick="toggleResultExplanation()" style="margin-bottom: 10px;">
                        <span id="result-explanation-icon">+</span>
                        <span>💡 Explanation</span>
                    </div>
                    <div id="result-explanation-content" style="display: none; background: #f8f9fa; padding: 15px; border-radius: 8px; color: #555; line-height: 1.6;">
                        ${linkifyText(explanation)}
                    </div>
                </div>
        `;
    }
    
    // Collapsible more info section
    const hasType = question.type && question.type.trim();
    const hasVerified = question.verified === true;
    const hasDeprecated = question.deprecated === true;
    
    if (hasType || hasVerified || hasDeprecated) {
        modalHTML += `
                <div class="form-group">
                    <div class="explanation-toggle" onclick="toggleResultMoreInfo()" style="margin-bottom: 10px;">
                        <span id="result-moreinfo-icon">+</span>
                        <span>ℹ️ More Information</span>
                    </div>
                    <div id="result-moreinfo-content" style="display: none;">
        `;
        
        if (hasType) {
            modalHTML += `<div class="info-type-text"><strong>Domain:</strong> ${question.type}</div>`;
        }
        
        if (hasVerified || hasDeprecated) {
            modalHTML += '<div class="info-chips">';
            
            if (hasVerified) {
                modalHTML += `
                    <div class="info-chip verified">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        Verified
                    </div>
                `;
            }
            
            if (hasDeprecated) {
                modalHTML += `
                    <div class="info-chip deprecated">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        Deprecated
                    </div>
                `;
            }
            
            modalHTML += '</div>';
        }
        
        modalHTML += `
                    </div>
                </div>
        `;
    }
    
    // Collapsible statistics section
    initQuestionStats(question.id);
    const qStats = questionStats[question.id];
    const totalAppeared = qStats.zen.appeared + qStats.exam.appeared + qStats.examOfficial.appeared;
    const totalCorrect = qStats.zen.correct + qStats.exam.correct + qStats.examOfficial.correct;
    const accuracy = totalAppeared > 0 ? Math.round((totalCorrect / totalAppeared) * 100) : 0;
    
    modalHTML += `
                <div class="form-group">
                    <div class="explanation-toggle" onclick="toggleResultStats()" style="margin-bottom: 10px;">
                        <span id="result-stats-icon">+</span>
                        <span>📊 Statistics</span>
                    </div>
                    <div id="result-stats-content" style="display: none;">
                        <div class="stats-detail-grid">
                            <div class="stat-detail-card">
                                <div class="stat-detail-label">Times Appeared</div>
                                <div class="stat-detail-value">${totalAppeared}</div>
                            </div>
                            <div class="stat-detail-card correct">
                                <div class="stat-detail-label">Correct</div>
                                <div class="stat-detail-value">${totalCorrect}</div>
                            </div>
                            <div class="stat-detail-card wrong">
                                <div class="stat-detail-label">Wrong</div>
                                <div class="stat-detail-value">${totalAppeared - totalCorrect}</div>
                            </div>
                            <div class="stat-detail-card" style="grid-column: span 3;">
                                <div class="stat-detail-label">Accuracy</div>
                                <div class="stat-detail-value" style="font-size: 2.5rem;">${accuracy}%</div>
                            </div>
                        </div>
                    </div>
                </div>
    `;
    
    modalHTML += `
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" onclick="closeResultDetailModal()">Close</button>
            </div>
        </div>
    `;
    
    // Create and show modal
    const modal = document.createElement('div');
    modal.id = 'result-detail-modal';
    modal.className = 'modal active';
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);
}

function closeResultDetailModal() {
    const modal = document.getElementById('result-detail-modal');
    if (modal) {
        modal.remove();
    }
    currentOpenResultOption = null;
}

// Track currently open result option explanation
let currentOpenResultOption = null;

// Toggle option explanation in result detail modal
function toggleResultOptionExplanation(letter) {
    const content = document.getElementById(`result-explanation-${letter}`);
    const optionCard = document.getElementById(`result-option-${letter}`);
    
    if (!content || !optionCard) return;
    
    // If clicking the currently open one, close it
    if (currentOpenResultOption === letter) {
        content.style.display = 'none';
        optionCard.classList.remove('option-expanded');
        currentOpenResultOption = null;
    } else {
        // Close previously open explanation
        if (currentOpenResultOption) {
            const prevContent = document.getElementById(`result-explanation-${currentOpenResultOption}`);
            const prevOptionCard = document.getElementById(`result-option-${currentOpenResultOption}`);
            if (prevContent) prevContent.style.display = 'none';
            if (prevOptionCard) prevOptionCard.classList.remove('option-expanded');
        }
        
        // Open the clicked one
        content.style.display = 'flex';
        optionCard.classList.add('option-expanded');
        currentOpenResultOption = letter;
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('result-detail-modal');
    if (modal && event.target === modal) {
        closeResultDetailModal();
    }
});

function toggleResultExplanation() {
    const content = document.getElementById('result-explanation-content');
    const icon = document.getElementById('result-explanation-icon');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '−';
    } else {
        content.style.display = 'none';
        icon.textContent = '+';
    }
}

function toggleResultMoreInfo() {
    const content = document.getElementById('result-moreinfo-content');
    const icon = document.getElementById('result-moreinfo-icon');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '−';
    } else {
        content.style.display = 'none';
        icon.textContent = '+';
    }
}

function toggleResultStats() {
    const content = document.getElementById('result-stats-content');
    const icon = document.getElementById('result-stats-icon');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '−';
    } else {
        content.style.display = 'none';
        icon.textContent = '+';
    }
}

function openExcelFormattingGuide() {
    document.getElementById('excel-formatting-modal').classList.add('active');
}

function closeExcelFormattingGuide() {
    document.getElementById('excel-formatting-modal').classList.remove('active');
}

function showZenModeInfo() {
    showCustomAlert(
        '🧘 Zen Mode',
        `Zen Mode uses spaced repetition to help you learn efficiently.

How it works:
• Questions you answer correctly move to the END of the deck
• Questions you get wrong move to position ~10 (20% into deck)
• This ensures you review difficult questions more frequently
• The deck never ends - it cycles continuously for ongoing practice

Your current deck has ${zenDeck.length} questions.

Perfect for daily study sessions and long-term retention!`,
        '✨',
        [{ text: 'Got it!', type: 'btn-primary' }]
    );
}

// Keyboard handler for Enter key and number keys
function handleKeyPress(event) {
    // Check if we're on the flashcard screen
    const flashcardScreen = document.getElementById('flashcard-screen');
    if (!flashcardScreen || !flashcardScreen.classList.contains('active')) return;
    
    // Check if any modal is open
    const activeModal = document.querySelector('.modal.active');
    if (activeModal) return; // Don't handle keys if modal is open
    
    // Handle Enter key
    if (event.key === 'Enter') {
        const submitBtn = document.getElementById('submit-answer');
        const nextBtn = document.getElementById('next-button');
        
        // If submit button is visible and enabled, click it
        if (submitBtn.style.display !== 'none' && !submitBtn.disabled) {
            event.preventDefault();
            submitAnswer();
        }
        // If next button is visible (zen mode after answer), click it
        else if (nextBtn.style.display !== 'none') {
            event.preventDefault();
            nextCard();
        }
        return;
    }
    
    // Handle number keys (1-9) to select options
    const numberMatch = event.key.match(/^[1-9]$/);
    if (numberMatch) {
        const optionIndex = parseInt(event.key) - 1; // Convert 1-9 to 0-8
        const options = document.querySelectorAll('.option');
        
        // Check if this option exists and if we can still select options
        if (optionIndex < options.length) {
            const submitBtn = document.getElementById('submit-answer');
            const nextBtn = document.getElementById('next-button');
            
            // Only allow selection if submit button is visible (not after answering)
            if (submitBtn.style.display !== 'none' && nextBtn.style.display === 'none') {
                event.preventDefault();
                const optionElement = options[optionIndex];
                
                // Check if option is not already marked as correct/wrong (after submission)
                if (!optionElement.classList.contains('correct') && !optionElement.classList.contains('wrong')) {
                    toggleOption(optionIndex, optionElement);
                }
            }
        }
    }
}

// Add keyboard listener when page loads
document.addEventListener('keydown', handleKeyPress);

// Close modals when clicking outside
document.addEventListener('click', function(event) {
    // Custom alert
    const customAlert = document.getElementById('custom-alert');
    if (customAlert && customAlert.classList.contains('active')) {
        const alertContent = customAlert.querySelector('.alert-content');
        if (event.target === customAlert && !alertContent.contains(event.target)) {
            closeCustomAlert();
        }
    }
    
    // Import modal
    const importModal = document.getElementById('import-modal');
    if (importModal && importModal.classList.contains('active')) {
        const modalContent = importModal.querySelector('.modal-content');
        if (event.target === importModal && !modalContent.contains(event.target)) {
            closeImportModal();
        }
    }
    
    // Add question modal
    const addQuestionModal = document.getElementById('add-question-modal');
    if (addQuestionModal && addQuestionModal.classList.contains('active')) {
        const modalContent = addQuestionModal.querySelector('.modal-content');
        if (event.target === addQuestionModal && !modalContent.contains(event.target)) {
            closeAddQuestionModal();
        }
    }
    
    // Question details modal
    const questionDetailsModal = document.getElementById('question-details-modal');
    if (questionDetailsModal && questionDetailsModal.classList.contains('active')) {
        const modalContent = questionDetailsModal.querySelector('.modal-content');
        if (event.target === questionDetailsModal && !modalContent.contains(event.target)) {
            closeQuestionDetailsModal();
        }
    }
    
    // Excel formatting modal
    const excelFormattingModal = document.getElementById('excel-formatting-modal');
    if (excelFormattingModal && excelFormattingModal.classList.contains('active')) {
        const modalContent = excelFormattingModal.querySelector('.modal-content');
        if (event.target === excelFormattingModal && !modalContent.contains(event.target)) {
            closeExcelFormattingGuide();
        }
    }
    
    // Result question detail modal
    const resultQuestionModal = document.getElementById('result-question-modal');
    if (resultQuestionModal && resultQuestionModal.classList.contains('active')) {
        const modalContent = resultQuestionModal.querySelector('.modal-content');
        if (event.target === resultQuestionModal && !modalContent.contains(event.target)) {
            closeResultQuestionDetail();
        }
    }
    
    // Domains modal
    const domainsModal = document.getElementById('domains-modal');
    if (domainsModal && domainsModal.classList.contains('active')) {
        const modalContent = domainsModal.querySelector('.modal-content');
        if (event.target === domainsModal && !modalContent.contains(event.target)) {
            closeDomainsModal();
        }
    }
});
