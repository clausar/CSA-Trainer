const defaultFlashcards = [];

// Initialize from localStorage or defaults
const flashcards = (function() {
    const stored = localStorage.getItem('csa_flashcards');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            console.log('Loaded', parsed.length, 'flashcards from localStorage');
            return parsed.map(q => {
                if (!q.id) {
                    q.id = 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                }
                // Ensure verified and deprecated properties exist
                if (q.verified === undefined || q.verified === null) {
                    q.verified = false;
                }
                if (q.deprecated === undefined || q.deprecated === null) {
                    q.deprecated = false;
                }
                if (!q.type) {
                    q.type = '';
                }
                return q;
            });
        } catch (e) {
            console.error('Error loading from localStorage:', e);
        }
    }
    
    // First time - start with empty array
    console.log('First time load - starting with no questions');
    
    // Save empty array to localStorage
    try {
        localStorage.setItem('csa_flashcards', JSON.stringify([]));
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
    
    return [];
})();
