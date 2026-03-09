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

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showExamConfig() {
    showScreen('exam-config-screen');
}

function toggleOfficialSettings() {
    const isOfficial = document.getElementById('official-settings').checked;
    const timeInput = document.getElementById('exam-time');
    const questionsInput = document.getElementById('exam-questions');
    const passInput = document.getElementById('exam-pass');
    
    if (isOfficial) {
        timeInput.value = 90;
        questionsInput.value = 60;
        passInput.value = 70;
        
        timeInput.disabled = true;
        questionsInput.disabled = true;
        passInput.disabled = true;
    } else {
        timeInput.disabled = false;
        questionsInput.disabled = false;
        passInput.disabled = false;
    }
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
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 60) {
            document.getElementById('timer-display').classList.add('warning');
        }
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert('Time is up!');
            showResults();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timer-display').textContent = display;
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
        
        document.getElementById('timer-display').textContent = 'ZEN';
        document.getElementById('timer-display').classList.add('zen-mode');
    } else if (mode === 'exam') {
        const numQuestions = Math.min(examConfig.numQuestions, availableCards.length);
        sessionCards = [...availableCards]
            .sort(() => Math.random() - 0.5)
            .slice(0, numQuestions);
        document.getElementById('timer-display').classList.remove('zen-mode');
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
    
    card.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        optionDiv.innerHTML = `
            <div class="option-letter">${String.fromCharCode(65 + index)}</div>
            <div class="option-text">${linkifyText(option)}</div>
        `;
        optionDiv.onclick = () => toggleOption(index, optionDiv);
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
    
    // Reset buttons state
    document.getElementById('submit-answer').style.display = 'block';
    document.getElementById('submit-answer').disabled = true;
    document.getElementById('next-button').style.display = 'none';
}

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
    const correctAnswers = card.correctAnswers.sort();
    const userAnswers = selectedOptions.sort();
    
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
    
    const isCorrect = JSON.stringify(correctAnswers) === JSON.stringify(userAnswers);
    
    // Save result for this question
    sessionResults.push({
        question: card,
        userAnswers: [...userAnswers],
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
        options.forEach((option, index) => {
            option.onclick = null;
            if (card.correctAnswers.includes(index)) {
                option.classList.add('correct');
            } else if (selectedOptions.includes(index)) {
                option.classList.add('wrong');
            }
        });
        
        // Update zen deck based on answer
        updateZenDeckPosition(card.id, isCorrect);
        
        document.getElementById('submit-answer').style.display = 'none';
        document.getElementById('next-button').style.display = 'block';
    }
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
                <div class="db-question"><strong>Q:</strong> ${card.question}</div>
                <div class="db-answer">${optionsHTML}</div>
                <div style="margin-top: 10px; color: #27ae60; font-weight: 600;">Correct: ${correctLetters}</div>
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
            <button type="button" class="option-delete-btn" onclick="deleteOption(this)" title="Delete option">×</button>
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
        <button type="button" class="option-delete-btn" onclick="deleteOption(this)" title="Delete option">×</button>
    `;
    container.appendChild(optionCard);
}

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
    
    optionCards.forEach((card, index) => {
        const checkbox = card.querySelector('.option-checkbox');
        const input = card.querySelector('.option-input-simple');
        const optionText = input.value.trim();
        
        if (optionText) {
            options.push(optionText);
            if (checkbox.checked) {
                correctAnswers.push(index);
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
        type: typeText
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
    // Extract correct answers and notes
    // More flexible pattern to handle different formats
    const optionPattern = /[\r\n]*\s*([A-Z])\.\s*([^\r\n]*)/g;
    let matches;
    const correctLetters = [];
    
    // Extract all answer letters
    while ((matches = optionPattern.exec(text)) !== null) {
        correctLetters.push(matches[1]);
    }
    
    // If no pattern found, try to extract just capital letters
    if (correctLetters.length === 0) {
        const letterPattern = /\b([A-Z])\b/g;
        while ((matches = letterPattern.exec(text)) !== null) {
            if (!correctLetters.includes(matches[1])) {
                correctLetters.push(matches[1]);
            }
        }
    }
    
    // Remove all option patterns to get remaining text (notes)
    let notes = text.replace(/[\r\n]*\s*[A-Z]\.\s*[^\r\n]*/g, '').trim();
    
    // Also remove standalone capital letters that were matched
    notes = notes.replace(/\b[A-Z]\b/g, '').trim();
    
    return { correctLetters, notes };
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
                const workbook = XLSX.read(data, { type: 'array' });
                console.log('Workbook loaded:', workbook.SheetNames);
                
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                console.log('Rows found:', jsonData.length);
                
                updateProgress(50, 'Processing questions...');
                
                // Find column indices
                const headers = jsonData[0];
                console.log('Headers:', headers);
                
                // Normalize headers: lowercase and trim spaces
                const normalizedHeaders = headers.map(h => h ? h.toString().toLowerCase().trim() : '');
                console.log('Normalized headers:', normalizedHeaders);
                
                const questionCol = normalizedHeaders.findIndex(h => h === 'question');
                const answerCol = normalizedHeaders.findIndex(h => h === 'answer');
                const verifiedCol = normalizedHeaders.findIndex(h => h === 'verified');
                const typeCol = normalizedHeaders.findIndex(h => h === 'type');
                const deprecatedCol = normalizedHeaders.findIndex(h => h === 'deprecated');
                
                console.log('Question column:', questionCol, 'Answer column:', answerCol);
                console.log('Optional columns - Verified:', verifiedCol, 'Type:', typeCol, 'Deprecated:', deprecatedCol);
                
                if (questionCol === -1 || answerCol === -1) {
                    showCustomAlert('Invalid Format', 'Excel file must have "Question" and "Answer" columns in the first row.', '❌', [
                        { text: 'OK', type: 'btn-primary' }
                    ]);
                    closeImportModal();
                    return;
                }
                
                const newQuestions = [];
                
                // Process each row
                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row[questionCol] || !row[answerCol]) {
                        console.log(`Row ${i + 1}: Empty, skipping`);
                        continue;
                    }
                    
                    console.log(`Processing row ${i + 1}...`);
                    
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
                    
                    const questionObj = {
                        id: generateQuestionId(),
                        question: questionData.question,
                        options: questionData.options,
                        correctAnswers: correctAnswers
                    };
                    
                    if (answerData.notes) {
                        questionObj.notes = answerData.notes;
                    }
                    
                    // Add optional fields - default to false/empty if not present
                    if (verifiedCol !== -1 && row[verifiedCol] !== undefined && row[verifiedCol] !== null && row[verifiedCol] !== '') {
                        const verifiedValue = row[verifiedCol].toString().toLowerCase().trim();
                        questionObj.verified = verifiedValue === 'true' || verifiedValue === '1' || verifiedValue === 'yes' || verifiedValue === 'verdadeiro' || verifiedValue === 'sim';
                    } else {
                        questionObj.verified = false;
                    }
                    
                    if (typeCol !== -1 && row[typeCol] !== undefined && row[typeCol] !== null && row[typeCol] !== '') {
                        questionObj.type = row[typeCol].toString().trim();
                    } else {
                        questionObj.type = '';
                    }
                    
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
                
                if (newQuestions.length === 0) {
                    showCustomAlert('No Questions Found', 'No valid questions found in the Excel file. Please check the format.', '⚠️', [
                        { text: 'OK', type: 'btn-primary' }
                    ]);
                    closeImportModal();
                    return;
                }
                
                updateProgress(85, 'Finalizing...');
                
                // Apply import mode
                let resultMessage = '';
                if (mode === 'replace') {
                    flashcards.length = 0;
                    flashcards.push(...newQuestions);
                    saveFlashcards();
                    console.log('Replaced all questions');
                    resultMessage = `Successfully replaced all questions!\n\nImported: ${newQuestions.length} questions`;
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
    
    question.options.forEach((option, index) => {
        const isCorrect = question.correctAnswers.includes(index);
        const optionDiv = document.createElement('div');
        optionDiv.className = 'detail-option-item' + (isCorrect ? ' correct-answer' : '');
        optionDiv.innerHTML = `
            <div class="detail-option-letter">${String.fromCharCode(65 + index)}</div>
            <div class="detail-option-text">${linkifyText(option)}</div>
            ${isCorrect ? '<span style="color: #28a745; font-weight: 700;">✓</span>' : ''}
        `;
        optionsContainer.appendChild(optionDiv);
    });
    
    // Show explanation if available
    const notesSection = document.getElementById('detail-notes-section');
    const notesDiv = document.getElementById('detail-notes');
    if (question.explanation && question.explanation.trim()) {
        notesDiv.innerHTML = linkifyText(question.explanation);
        notesSection.style.display = 'block';
    } else if (question.notes && question.notes.trim()) {
        // Backward compatibility with old "notes" field
        notesDiv.innerHTML = linkifyText(question.notes);
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
            infoHTML += `<div class="info-type-text"><strong>Type:</strong> ${question.type}</div>`;
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
}

function closeQuestionDetailsModal() {
    document.getElementById('question-details-modal').classList.remove('active');
    currentDetailQuestionId = null;
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
        
        const optionCard = document.createElement('div');
        optionCard.className = 'option-input-card' + (isCorrect ? ' checked' : '');
        optionCard.innerHTML = `
            <input type="checkbox" class="option-checkbox" onchange="toggleOptionHighlight(this)" ${isCorrect ? 'checked' : ''}>
            <input type="text" class="option-input-simple" placeholder="Option ${letter}" value="${option}">
            <button type="button" class="option-delete-btn" onclick="deleteOption(this)" title="Delete option">×</button>
        `;
        optionsContainer.appendChild(optionCard);
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
    
    optionCards.forEach((card, index) => {
        const checkbox = card.querySelector('.option-checkbox');
        const input = card.querySelector('.option-input-simple');
        const optionText = input.value.trim();
        
        if (optionText) {
            options.push(optionText);
            if (checkbox.checked) {
                correctAnswers.push(index);
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
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.querySelector('.search-btn');
    
    if (searchContainer.style.display === 'none') {
        searchContainer.style.display = 'block';
        searchInput.focus();
        searchBtn.classList.add('active');
    } else {
        searchContainer.style.display = 'none';
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
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    const dbList = document.getElementById('database-list');
    
    if (!searchTerm) {
        // Show all questions
        showDatabase();
        return;
    }
    
    // Filter questions
    const filteredCards = flashcards.filter(card => {
        // Search in question text
        if (card.question.toLowerCase().includes(searchTerm)) return true;
        
        // Search in options
        if (card.options.some(opt => opt.toLowerCase().includes(searchTerm))) return true;
        
        // Search in explanation/notes
        if (card.explanation && card.explanation.toLowerCase().includes(searchTerm)) return true;
        if (card.notes && card.notes.toLowerCase().includes(searchTerm)) return true;
        
        // Search in type
        if (card.type && card.type.toLowerCase().includes(searchTerm)) return true;
        
        return false;
    });
    
    // Display filtered results
    dbList.innerHTML = '';
    
    if (filteredCards.length === 0) {
        dbList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #95a5a6;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 64px; height: 64px; margin-bottom: 20px; opacity: 0.5;">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                </svg>
                <p style="font-size: 1.1rem; margin: 0;">No questions found</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">Try a different search term</p>
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
                <div class="db-question"><strong>Q:</strong> ${card.question}</div>
                <div class="db-answer">${optionsHTML}</div>
                <div style="margin-top: 10px; color: #27ae60; font-weight: 600;">Correct: ${correctLetters}</div>
            </div>
        `;
        dbList.appendChild(cardElement);
    });
    
    console.log(`Found ${filteredCards.length} questions matching "${searchTerm}"`);
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
                    <div style="margin-bottom: 20px;">
    `;
    
    question.options.forEach((option, i) => {
        const isCorrect = question.correctAnswers.includes(i);
        const wasSelected = result.userAnswers.includes(i);
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
            <div class="${className}" style="margin-bottom: 10px;">
                <div class="detail-option-letter">${String.fromCharCode(65 + i)}</div>
                <div class="detail-option-text">${linkifyText(option)}</div>
                ${badge}
            </div>
        `;
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
            modalHTML += `<div class="info-type-text"><strong>Type:</strong> ${question.type}</div>`;
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
}

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
