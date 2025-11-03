// Configuration
const API_BASE_URL = '/deploy-report';
const MAX_DATE_RANGE_DAYS = 30;

// State
let currentData = null;
let voiceSession = null;

// DOM Elements
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const startDateError = document.getElementById('start-date-error');
const endDateError = document.getElementById('end-date-error');
const rangeError = document.getElementById('range-error');
const generateBtn = document.getElementById('generate-btn');
const contentGrid = document.getElementById('content-grid');
const commitsContainer = document.getElementById('commits-container');
const summaryContainer = document.getElementById('summary-container');
const summaryFooter = document.getElementById('summary-footer');
const commitCount = document.getElementById('commit-count');
const summaryTitle = document.getElementById('summary-title');
const errorDisplay = document.getElementById('error-display');
const errorMessage = document.getElementById('error-message');
const emptyState = document.getElementById('empty-state');
const voiceFab = document.getElementById('voice-fab');
const voiceModal = document.getElementById('voice-modal');
const closeVoiceModal = document.getElementById('close-voice-modal');
const conversationContainer = document.getElementById('conversation-container');
const examplePrompts = document.getElementById('example-prompts');
const micBtn = document.getElementById('mic-btn');
const micStatus = document.getElementById('mic-status');
const waveformContainer = document.getElementById('waveform-container');
const voiceError = document.getElementById('voice-error');
const voiceErrorMessage = document.getElementById('voice-error-message');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeDates();
    setupEventListeners();
});

function initializeDates() {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    endDateInput.value = formatDate(today);
    startDateInput.value = formatDate(sevenDaysAgo);
    endDateInput.max = formatDate(today);
    startDateInput.max = formatDate(today);
}

function setupEventListeners() {
    // Date inputs
    startDateInput.addEventListener('change', validateDates);
    endDateInput.addEventListener('change', validateDates);
    
    // Generate button
    generateBtn.addEventListener('click', handleGenerateReport);
    
    // Voice modal
    voiceFab.addEventListener('click', openVoiceModal);
    closeVoiceModal.addEventListener('click', closeVoice);
    
    // Prompt chips
    document.querySelectorAll('.prompt-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const prompt = chip.getAttribute('data-prompt');
            sendVoicePrompt(prompt);
        });
    });
    
    // Microphone button
    micBtn.addEventListener('click', toggleVoiceRecording);
}

// Date Validation
function validateDates() {
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);
    
    // Clear previous errors
    startDateError.textContent = '';
    endDateError.textContent = '';
    rangeError.style.display = 'none';
    
    let isValid = true;
    
    // Basic validation
    if (!startDateInput.value) {
        startDateError.textContent = 'Start date is required';
        isValid = false;
    }
    
    if (!endDateInput.value) {
        endDateError.textContent = 'End date is required';
        isValid = false;
    }
    
    if (!isValid) {
        generateBtn.disabled = true;
        return;
    }
    
    // Range validation
    if (startDate > endDate) {
        endDateError.textContent = 'End date must be after start date';
        isValid = false;
    }
    
    // 30-day limit validation
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    if (daysDiff > MAX_DATE_RANGE_DAYS) {
        rangeError.textContent = `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days. You selected ${daysDiff} days.`;
        rangeError.style.display = 'block';
        isValid = false;
    }
    
    generateBtn.disabled = !isValid;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// API Integration
async function handleGenerateReport() {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    
    // Validate before API call
    validateDates();
    if (generateBtn.disabled) return;
    
    // Show loading state
    setLoading(true);
    hideErrorAndEmpty();
    contentGrid.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE_URL}?start=${startDate}&end=${endDate}`);
        
        if (!response.ok) {
            await handleErrorResponse(response);
            return;
        }
        
        const data = await response.json();
        currentData = data;
        displayReport(data);
        
    } catch (error) {
        console.error('Error fetching report:', error);
        showError('Failed to fetch report. Please try again.');
    } finally {
        setLoading(false);
    }
}

async function handleErrorResponse(response) {
    const status = response.status;
    let message = 'An error occurred';
    
    try {
        const data = await response.json();
        message = data.message || message;
    } catch {
        // If JSON parse fails, use status-based messages
    }
    
    switch (status) {
        case 400:
            showError('Invalid date range. Please check your dates.');
            break;
        case 413:
            showError(`Date range exceeds ${MAX_DATE_RANGE_DAYS} days. Please select a shorter range.`);
            break;
        case 429:
            showError('Too many requests. Please wait a moment and try again.');
            break;
        case 502:
            showError('Backend service error. Please try again later.');
            break;
        case 504:
            showError('Request timed out. Please try a shorter date range.');
            break;
        default:
            showError(message || 'An unexpected error occurred.');
    }
}

function setLoading(isLoading) {
    generateBtn.disabled = isLoading;
    
    const btnText = generateBtn.querySelector('.btn-text');
    const btnLoader = generateBtn.querySelector('.btn-loader');
    
    if (isLoading) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-block';
    } else {
        btnText.style.display = 'inline-block';
        btnLoader.style.display = 'none';
    }
}

function hideErrorAndEmpty() {
    errorDisplay.style.display = 'none';
    emptyState.style.display = 'none';
}

function showError(message) {
    errorMessage.textContent = message;
    errorDisplay.style.display = 'block';
}

function showEmptyState() {
    emptyState.style.display = 'block';
}

// Display Report
function displayReport(data) {
    contentGrid.style.display = 'grid';
    
    // Update summary title
    summaryTitle.textContent = `What We Shipped: ${data.start} - ${data.end}`;
    
    // Display commits
    if (data.commits && data.commits.length > 0) {
        commitCount.textContent = `${data.commits.length} commits`;
        renderCommits(data.commits);
    } else {
        commitCount.textContent = '0 commits';
        commitsContainer.innerHTML = '<div class="empty-state-small"><p>No commits found in this date range.</p></div>';
    }
    
    // Display summary
    if (data.summary_html) {
        summaryContainer.innerHTML = data.summary_html;
    } else {
        summaryContainer.innerHTML = '<p>No summary available.</p>';
    }
    
    // Display meta
    if (data.meta) {
        renderSummaryFooter(data.meta);
    }
}

function renderCommits(commits) {
    commitsContainer.innerHTML = '';
    
    commits.forEach(commit => {
        const card = createCommitCard(commit);
        commitsContainer.appendChild(card);
    });
}

function createCommitCard(commit) {
    const card = document.createElement('div');
    card.className = 'commit-card';
    
    const authorInitials = getAuthorInitials(commit.author);
    const formattedDate = formatCommitDate(commit.date);
    
    card.innerHTML = `
        <div class="commit-header">
            <span class="commit-date">${formattedDate}</span>
            ${commit.author ? `
                <span class="commit-author">
                    <span class="author-avatar">${authorInitials}</span>
                    ${commit.author.login || commit.author.name || 'Unknown'}
                </span>
            ` : ''}
        </div>
        <div class="commit-message">${escapeHtml(commit.summary_line)}</div>
        <div class="commit-sha">${commit.sha.substring(0, 7)}</div>
    `;
    
    return card;
}

function getAuthorInitials(author) {
    if (!author) return '?';
    
    const name = author.login || author.name || '';
    if (name.length === 0) return '?';
    
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function formatCommitDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const daysDiff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) return 'Today';
    if (daysDiff === 1) return 'Yesterday';
    if (daysDiff < 7) return `${daysDiff} days ago`;
    
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function renderSummaryFooter(meta) {
    summaryFooter.style.display = 'block';
    summaryFooter.innerHTML = `
        <div><strong>Generated:</strong> ${formatDateTime(meta.generated_at)}</div>
        <div><strong>Model:</strong> ${escapeHtml(meta.model || 'Unknown')}</div>
        <div><strong>Source:</strong> ${escapeHtml(meta.source || 'Unknown')}</div>
    `;
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Voice Agent
function openVoiceModal() {
    voiceModal.style.display = 'flex';
    clearConversation();
    checkMicrophonePermissions();
}

function closeVoice() {
    voiceModal.style.display = 'none';
    stopRecording();
    clearConversation();
}

function checkMicrophonePermissions() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
            hideVoiceError();
            micStatus.textContent = 'Ready to listen';
        })
        .catch(err => {
            console.error('Microphone permission denied:', err);
            showVoiceError('Microphone permission denied. Please allow access to use the voice agent.');
        });
}

function toggleVoiceRecording() {
    if (micBtn.classList.contains('recording')) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    micBtn.classList.add('recording');
    waveformContainer.classList.add('active');
    micStatus.textContent = 'Listening...';
    hideVoiceError();
    
    // TODO: Implement actual voice recording and WebSocket connection
    // This is a placeholder for the backend integration
    console.log('Recording started (placeholder)');
}

function stopRecording() {
    micBtn.classList.remove('recording');
    waveformContainer.classList.remove('active');
    micStatus.textContent = 'Ready to listen';
    
    // TODO: Implement actual recording stop and processing
    console.log('Recording stopped (placeholder)');
}

function sendVoicePrompt(prompt) {
    if (!prompt.trim()) return;
    
    // Add user message
    addMessageToConversation('user', prompt);
    
    // Hide example prompts after first message
    if (examplePrompts.style.display !== 'none') {
        examplePrompts.style.display = 'none';
    }
    
    // TODO: Send to backend voice agent
    // This is a placeholder
    setTimeout(() => {
        addMessageToConversation('agent', 
            'I can help you explore the release data. Please connect the voice agent backend to enable full functionality.'
        );
    }, 500);
}

function addMessageToConversation(role, text) {
    const message = document.createElement('div');
    message.className = `message ${role}`;
    
    const time = new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    message.innerHTML = `
        <div class="message-text">${escapeHtml(text)}</div>
        <div class="message-time">${time}</div>
    `;
    
    conversationContainer.appendChild(message);
    
    // Auto-scroll to bottom
    conversationContainer.scrollTop = conversationContainer.scrollHeight;
}

function clearConversation() {
    conversationContainer.innerHTML = '';
    examplePrompts.style.display = 'block';
}

function showVoiceError(message) {
    voiceErrorMessage.textContent = message;
    voiceError.style.display = 'block';
}

function hideVoiceError() {
    voiceError.style.display = 'none';
}

// Utility functions for future voice agent integration
async function connectVoiceAgent() {
    // TODO: Establish WebSocket connection to OpenAI Realtime API
    // This will be implemented when the backend is ready
    throw new Error('Voice agent backend not yet connected');
}

async function sendAudioToAgent(audioBlob) {
    // TODO: Send audio to backend voice agent
    throw new Error('Voice agent backend not yet connected');
}

