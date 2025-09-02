// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// Global variables for image handling
let selectedImage = null;
let selectedImageData = null;

// Initialize app functions
function initializeApp() {
    setWelcomeTime();
    setupEventListeners();
    setupInputHandlers();
    setupImageUpload();
}

// Set welcome message time
function setWelcomeTime() {
    const welcomeTime = document.getElementById('welcomeTime');
    if (welcomeTime) {
        welcomeTime.textContent = getCurrentTime();
    }
}

// Setup event listeners
function setupEventListeners() {
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    
    // Enter key event
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Input change event
    userInput.addEventListener('input', function() {
        updateCharCount();
        toggleSendButton();
    });
    
    // Send button click - Touch event support for mobile
    sendButton.addEventListener('click', sendMessage);
    sendButton.addEventListener('touchend', function(e) {
        e.preventDefault();
        sendMessage();
    });
}

// Setup input handlers
function setupInputHandlers() {
    updateCharCount();
    toggleSendButton();
}

// Update character count
function updateCharCount() {
    const userInput = document.getElementById('userInput');
    const charCount = document.getElementById('charCount');
    const currentLength = userInput.value.length;
    
    charCount.textContent = currentLength + '/500';
    
    if (currentLength > 450) {
        charCount.style.color = '#ef4444';
    } else if (currentLength > 400) {
        charCount.style.color = '#f59e0b';
    } else {
        charCount.style.color = '#64748b';
    }
}

// Toggle send button state
function toggleSendButton() {
    updateSendButtonState();
}

// Send message function - Enhanced error handling for Android
async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const message = userInput.value.trim();
    
    if (message === '' && !selectedImage) return;
    
    // Prevent multiple submissions
    if (userInput.disabled) return;
    
    // Save last message for identity check
    userInput.setAttribute('data-last-message', message);
    
    // Disable input during processing
    disableInput(true);
    
    // Add user message to chat (with image if present)
    if (selectedImage) {
        addMessageWithImage(message || 'Görsel gönderildi', 'user', selectedImageData);
    } else {
        addMessage(message, 'user');
    }
    
    // Clear input and image
    userInput.value = '';
    updateCharCount();
    if (selectedImage) {
        removeImage();
    }
    
    // Show typing indicator
    showTypingIndicator(true);
    
    try {
        // Process message with AI identity modifications
        const processedMessage = processAIIdentity(message);
        
        // Send to AI API with enhanced error handling
        const response = await sendToAI(processedMessage, selectedImageData);
        
        // Hide typing indicator
        showTypingIndicator(false);
        
        // Process AI response for identity
        const processedResponse = processAIResponse(response);
        
        // Add AI response to chat
        addMessage(processedResponse, 'ai');
        
    } catch (error) {
        console.error('Send Message Error:', error);
        console.error('Error Stack:', error.stack);
        showTypingIndicator(false);
        
        // More specific error messages
        let errorMessage = 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.';
        
        if (error.name === 'NetworkError' || error.message.includes('fetch')) {
            errorMessage = 'Bağlantı hatası. İnternet bağlantınızı kontrol edip tekrar deneyin.';
        } else if (error.name === 'TypeError') {
            errorMessage = 'Bir teknik sorun oluştu. Sayfayı yenileyin ve tekrar deneyin.';
        }
        
        addMessage(errorMessage, 'ai');
    }
    
    // Re-enable input
    disableInput(false);
}

// Process AI Identity - Remove duplicate function
function processAIIdentity(message) {
    const identityKeywords = ['kim', 'ismin', 'adın', 'kurucu', 'şirket', 'yapımcı', 'geliştirici', 'sahib', 'kurdu'];
    const hasIdentityQuestion = identityKeywords.some(function(keyword) {
        return message.toLowerCase().includes(keyword);
    });

    if (hasIdentityQuestion) {
        return 'Kullanıcının mesajı: ' + message;
    }

    return message;
}

// Process AI Response - Add missing function
function processAIResponse(response) {
    // Basic response processing
    if (typeof response !== 'string') {
        return 'Yanıt alınamadı. Lütfen tekrar deneyin.';
    }
    return response;
}

// Send message to AI API - Enhanced for Android compatibility
async function sendToAI(message, imageData) {
    return new Promise(function(resolve, reject) {
        try {
            const formData = new FormData();
            formData.append('message', message);
            
            if (imageData) {
                // Convert base64 to blob for better Android compatibility
                if (typeof imageData === 'string' && imageData.startsWith('data:')) {
                    const base64Data = imageData.split(',')[1];
                    const mimeType = imageData.split(',')[0].split(':')[1].split(';')[0];
                    
                    // Create blob from base64
                    const byteCharacters = atob(base64Data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: mimeType });
                    
                    formData.append('image', blob, 'image.jpg');
                } else {
                    formData.append('image', imageData);
                }
                formData.append('hasImage', 'true');
            }
            
            // Use XMLHttpRequest for better Android compatibility
            const xhr = new XMLHttpRequest();
            
            xhr.open('POST', 'ask.php', true);
            
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        resolve(xhr.responseText);
                    } else {
                        reject(new Error('HTTP Error: ' + xhr.status + ' - ' + xhr.statusText));
                    }
                }
            };
            
            xhr.onerror = function() {
                reject(new Error('Network Error: Request failed'));
            };
            
            xhr.ontimeout = function() {
                reject(new Error('Timeout: Request timed out'));
            };
            
            xhr.timeout = 30000; // 30 second timeout
            
            xhr.send(formData);
            
        } catch (error) {
            reject(error);
        }
    });
}

// Add message to chat
function addMessage(message, sender) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + sender + '-message';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    
    if (sender === 'ai') {
        avatarDiv.innerHTML = '<i class="fas fa-robot"></i>';
    } else {
        avatarDiv.innerHTML = '<i class="fas fa-user"></i>';
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.textContent = message;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = getCurrentTime();
    
    contentDiv.appendChild(textDiv);
    contentDiv.appendChild(timeDiv);
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    scrollToBottom();
}

// Show/hide typing indicator
function showTypingIndicator(show) {
    const typingIndicator = document.getElementById('typingIndicator');
    if (show) {
        typingIndicator.style.display = 'flex';
        scrollToBottom();
    } else {
        typingIndicator.style.display = 'none';
    }
}

// Disable/enable input
function disableInput(disabled) {
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    
    userInput.disabled = disabled;
    sendButton.disabled = disabled;
    
    if (disabled) {
        userInput.placeholder = 'WebMios AI yanıt veriyor...';
        sendButton.style.opacity = '0.5';
    } else {
        userInput.placeholder = 'Mesajınızı buraya yazın...';
        sendButton.style.opacity = '1';
        userInput.focus();
        toggleSendButton();
    }
}

// Scroll chat to bottom
function scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    setTimeout(function() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 100);
}

// Get current time
function getCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return hours + ':' + minutes;
}

// Clear chat function
function clearChat() {
    const chatMessages = document.getElementById('chatMessages');
    
    // Show confirmation
    if (confirm('Sohbet geçmişini temizlemek istediğinizden emin misiniz?')) {
        // Clear all messages except welcome message
        chatMessages.innerHTML = '<div class="message ai-message">' +
            '<div class="message-avatar">' +
            '<i class="fas fa-robot"></i>' +
            '</div>' +
            '<div class="message-content">' +
            '<div class="message-text">' +
            'Merhaba! Ben WebMios AI, gelişmiş yapay zeka asistanınızım. Size nasıl yardımcı olabilirim?' +
            '</div>' +
            '<div class="message-time">' + getCurrentTime() + '</div>' +
            '</div>' +
            '</div>';
        
        // Focus input
        const userInput = document.getElementById('userInput');
        userInput.focus();
    }
}

// Handle connection errors
function handleConnectionError() {
    addMessage('Bağlantı hatası oluştu. İnternet bağlantınızı kontrol edip tekrar deneyin.', 'ai');
}

// Format text for better display
function formatText(text) {
    // Convert URLs to links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    text = text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Convert newlines to br tags
    text = text.replace(/\n/g, '<br>');
    
    return text;
}

// Add formatted message
function addFormattedMessage(message, sender) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + sender + '-message';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    
    if (sender === 'ai') {
        avatarDiv.innerHTML = '<i class="fas fa-robot"></i>';
    } else {
        avatarDiv.innerHTML = '<i class="fas fa-user"></i>';
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.innerHTML = formatText(message);
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = getCurrentTime();
    
    contentDiv.appendChild(textDiv);
    contentDiv.appendChild(timeDiv);
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    
    scrollToBottom();
}

// Enhanced error handling
window.addEventListener('error', function(e) {
    console.error('JavaScript Error:', e.error);
    console.error('Error details:', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        error: e.error
    });
});

// Handle offline/online status
window.addEventListener('online', function() {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-indicator span');
    
    if (statusDot) statusDot.style.background = '#4ecdc4';
    if (statusText) statusText.textContent = 'Çevrimiçi';
});

window.addEventListener('offline', function() {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-indicator span');
    
    if (statusDot) statusDot.style.background = '#ef4444';
    if (statusText) statusText.textContent = 'Çevrimdışı';
});

// Performance optimization - debounce input events
function debounce(func, wait) {
    let timeout;
    return function executedFunction() {
        const args = arguments;
        const later = function() {
            clearTimeout(timeout);
            func.apply(null, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Apply debounce to character count update
const debouncedCharCount = debounce(updateCharCount, 100);

// Add message with image to chat
function addMessageWithImage(message, sender, imageData) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + sender + '-message';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    
    if (sender === 'ai') {
        avatarDiv.innerHTML = '<i class="fas fa-robot"></i>';
    } else {
        avatarDiv.innerHTML = '<i class="fas fa-user"></i>';
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Add image if present
    if (imageData) {
        const imageDiv = document.createElement('div');
        imageDiv.className = 'message-image';
        const img = document.createElement('img');
        img.src = imageData;
        img.alt = 'Yüklenen görsel';
        img.style.maxWidth = '200px';
        img.style.maxHeight = '200px';
        img.style.borderRadius = '8px';
        imageDiv.appendChild(img);
        contentDiv.appendChild(imageDiv);
    }
    
    // Add text if present
    if (message && message.trim()) {
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = message;
        contentDiv.appendChild(textDiv);
    }
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = getCurrentTime();
    
    contentDiv.appendChild(timeDiv);
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    
    scrollToBottom();
}

// Initialize focus on input when page loads
window.addEventListener('load', function() {
    const userInput = document.getElementById('userInput');
    if (userInput) {
        // Small delay for Android devices
        setTimeout(function() {
            userInput.focus();
        }, 100);
    }
});

// Setup image upload functionality
function setupImageUpload() {
    const imageInput = document.getElementById('imageInput');
    const imagePreview = document.getElementById('imagePreview');
    const previewImage = document.getElementById('previewImage');
    const imageName = document.getElementById('imageName');
    const fileInfo = document.getElementById('fileInfo');
    
    if (!imageInput) return;
    
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // Check file type
        if (!file.type.startsWith('image/')) {
            alert('Lütfen sadece görsel dosyası seçin.');
            return;
        }
        
        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Görsel boyutu 5MB\'den küçük olmalıdır.');
            return;
        }
        
        selectedImage = file;
        
        // Convert to base64 for display and API
        const reader = new FileReader();
        reader.onload = function(e) {
            selectedImageData = e.target.result;
            if (previewImage) previewImage.src = selectedImageData;
            if (imageName) imageName.textContent = file.name;
            if (imagePreview) imagePreview.style.display = 'block';
            
            // Show file info
            const sizeKB = Math.round(file.size / 1024);
            if (fileInfo) {
                fileInfo.textContent = 'Görsel: ' + sizeKB + 'KB';
                fileInfo.style.display = 'inline';
            }
            
            // Update UI
            updateSendButtonState();
        };
        
        reader.onerror = function() {
            alert('Görsel yüklenirken hata oluştu. Lütfen tekrar deneyin.');
        };
        
        reader.readAsDataURL(file);
    });
}

// Remove selected image
function removeImage() {
    selectedImage = null;
    selectedImageData = null;
    
    const imageInput = document.getElementById('imageInput');
    const imagePreview = document.getElementById('imagePreview');
    const fileInfo = document.getElementById('fileInfo');
    
    if (imageInput) imageInput.value = '';
    if (imagePreview) imagePreview.style.display = 'none';
    if (fileInfo) fileInfo.style.display = 'none';
    
    updateSendButtonState();
}

// Update send button state
function updateSendButtonState() {
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    
    if (!userInput || !sendButton) return;
    
    const message = userInput.value.trim();
    
    // Enable if there's text OR image
    sendButton.disabled = message.length === 0 && !selectedImage;
    
    // Visual feedback
    if (sendButton.disabled) {
        sendButton.style.opacity = '0.5';
    } else {
        sendButton.style.opacity = '1';
    }
}