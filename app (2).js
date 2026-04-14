let mediaRecorder;
let recordedChunks = [];
let timerInterval;
let startTime;
let stream;
let captureCanvas = document.createElement('canvas');
let captureContext = captureCanvas.getContext('2d');
let aiChatInterval;
let isProcessingAIMessage = false;
let pendingCaptureRequests = 0;
let maxSimultaneousCaptureRequests = 2;
let previousMessages = []; // Store previous AI-generated messages
let previousUsernames = []; // Store previously used usernames
let extraUserMessageForAI = null;  // Holds a user message to include in the next AI prompt check
let uniqueUsernames = new Set(); // Track unique usernames for viewer count
let isChatEnabled = false; // Track if chat is enabled
let chatSettings = {
    angry: false,
    memelike: false,
    happy: false,
    botlike: false,
    silly: false,
    sad: false,
    confused: false,
    fan: false,
    footballFans: false, // New football fans setting
    leaguesFans: false, // New leagues fans setting
    goodViewers: false, // Added positive viewers setting
    muted: false, // New setting for muting chat
    disableDonations: false, // New setting for disabling donations
    teamFans: false, // New team fans setting
    modsEnabled: false,
    adminsEnabled: false,
    spanish: false,
    french: false,
    german: false,
    portuguese: false,
    russian: false,
    turkish: false,
    italian: false,
    polish: false,
    ukrainian: false,
};
let activePoll = null;
let pollTimer = null;
let totalVotes = 0;
let aiCheckInterval = 3.5; // Default interval in seconds
let donationTimer = null;
let streamerUsername = null; // Store the streamer's username

// DOM elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const downloadBtn = document.getElementById('downloadBtn');
const streamVideoBtn = document.getElementById('streamVideoBtn');
const timer = document.getElementById('timer');
const recordingStatus = document.getElementById('recordingStatus');
const preview = document.getElementById('preview');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const popoutBtn = document.getElementById('popoutBtn');
const createPollBtn = document.getElementById('createPollBtn');
const pollForm = document.getElementById('pollForm');
const activePollContainer = document.getElementById('activePollContainer');
const streamSourceSelect = document.getElementById('streamSourceSelect');
const streamUrlInput = document.getElementById('streamUrlInput');
const streamSourceContainer = document.getElementById('streamSourceContainer');

// Event listeners
startBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);
downloadBtn.addEventListener('click', downloadRecording);
streamVideoBtn.addEventListener('click', toggleStreamOptions);
sendBtn.addEventListener('click', sendMessage);
popoutBtn.addEventListener('click', openChatPopup);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Add event listeners for chat settings
document.getElementById('angryViewers').addEventListener('change', updateChatSettings);
document.getElementById('memeViewers').addEventListener('change', updateChatSettings);
document.getElementById('happyViewers').addEventListener('change', updateChatSettings);
document.getElementById('botViewers').addEventListener('change', updateChatSettings);
document.getElementById('sillyViewers').addEventListener('change', updateChatSettings);
document.getElementById('sadViewers').addEventListener('change', updateChatSettings);
document.getElementById('confusedViewers').addEventListener('change', updateChatSettings);
document.getElementById('fanViewers').addEventListener('change', updateChatSettings);
document.getElementById('footballFansViewers').addEventListener('change', updateChatSettings);
document.getElementById('leaguesFansViewers').addEventListener('change', updateChatSettings);
document.getElementById('goodViewers').addEventListener('change', updateChatSettings);
document.getElementById('teamFansViewers').addEventListener('change', updateChatSettings);
document.getElementById('mutedChat').addEventListener('change', toggleChatMute);
document.getElementById('disableDonations').addEventListener('change', toggleDonations);
document.getElementById('modsEnabled').addEventListener('change', updateChatSettings);
document.getElementById('adminsEnabled').addEventListener('change', updateChatSettings);
document.getElementById('spanishViewers').addEventListener('change', updateChatSettings);
document.getElementById('frenchViewers').addEventListener('change', updateChatSettings);
document.getElementById('germanViewers').addEventListener('change', updateChatSettings);
document.getElementById('portugueseViewers').addEventListener('change', updateChatSettings);
document.getElementById('russianViewers').addEventListener('change', updateChatSettings);
document.getElementById('turkishViewers').addEventListener('change', updateChatSettings);
document.getElementById('italianViewers').addEventListener('change', updateChatSettings);
document.getElementById('polishViewers').addEventListener('change', updateChatSettings);
document.getElementById('ukrainianViewers').addEventListener('change', updateChatSettings);

// Add event listeners for creating polls
document.getElementById('createPollBtn').addEventListener('click', togglePollForm);
document.getElementById('addOptionBtn').addEventListener('click', addPollOption);
document.getElementById('pollForm').addEventListener('submit', createPoll);

streamVideoBtn.addEventListener('click', toggleStreamOptions);
streamSourceSelect.addEventListener('change', handleStreamSourceChange);
document.getElementById('streamStartBtn').addEventListener('click', startStreaming);

function updateChatSettings(e) {
    const setting = e.target.id.replace('Viewers', '').toLowerCase();
    chatSettings[setting] = e.target.checked;
}

function toggleChatMute(e) {
    chatSettings.muted = e.target.checked;
    
    // Stop or restart AI chat generation based on mute setting
    if (chatSettings.muted) {
        stopAIChatGeneration();
    } else if ((mediaRecorder && mediaRecorder.state === 'recording') || 
               (preview.src && !preview.srcObject)) {
        // Restart AI chat generation if we're recording or streaming a video
        startAIChatGeneration();
    }
}

function toggleDonations(e) {
    chatSettings.disableDonations = e.target.checked;
    
    // Stop or restart donation generation based on setting
    if (chatSettings.disableDonations) {
        stopDonationGeneration();
    } else if ((mediaRecorder && mediaRecorder.state === 'recording') || 
               (preview.src && !preview.srcObject)) {
        // Restart donation generation if we're recording or streaming a video
        startDonationGeneration();
    }
}

// Function to start recording
async function startRecording() {
    recordedChunks = [];
    
    // Try to get the streamer username
    try {
        const user = await window.websim.getUser();
        if (user && user.username) {
            streamerUsername = user.username;
            console.log("Streamer identified as:", streamerUsername);
        }
    } catch (error) {
        console.error("Could not fetch streamer username:", error);
    }
    
    try {
        // Check if mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Request permission to record screen with appropriate constraints
        if (isMobile) {
            // Mobile devices mostly support camera recording rather than screen recording
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: true
            });
            recordingStatus.textContent = "Recording from camera...";
        } else {
            // Desktop screen recording
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: { 
                    cursor: "always",
                    displaySurface: "monitor"
                },
                audio: true
            });
        }
        
        // Add event listener for when the user stops sharing
        stream.getVideoTracks()[0].addEventListener('ended', () => {
            // Treat this the same as clicking the stop button
            stopRecording();
        });
        
        // Set up media recorder
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = function(e) {
            if (e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };
        
        mediaRecorder.onstop = function() {
            // Create preview video
            const blob = new Blob(recordedChunks, {
                type: 'video/webm'
            });
            const url = URL.createObjectURL(blob);
            preview.src = url;
            
            // Update UI
            recordingStatus.textContent = "Recording finished";
            downloadBtn.disabled = false;
            
            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
        };
        
        // Start recording
        mediaRecorder.start();
        
        // Update UI
        startBtn.disabled = true;
        stopBtn.disabled = false;
        if (!isMobile) {
            recordingStatus.textContent = "Recording...";
        }
        
        // Start timer
        startTime = Date.now();
        startTimer();
        
        // Show preview of what's being recorded
        preview.srcObject = stream;
        
        // Enable chat when recording starts
        isChatEnabled = true;
        
        // Start AI chat based on video content
        startAIChatGeneration();
        
        // Start donation generation
        startDonationGeneration();
        
    } catch (error) {
        console.error("Error starting recording:", error);
        if (error.name === 'NotFoundError' || 
            error.name === 'NotAllowedError' || 
            error.message.includes('getDisplayMedia is not a function')) {
            recordingStatus.textContent = "Error: Please allow camera/microphone permissions. Some browsers may not support screen recording or via camera.";
        } else {
            recordingStatus.textContent = "Failed to start recording: " + error.message;
        }
    }
}

// Updated stopRecording function to also handle streamed videos
function stopRecording() {
    // Stop timer and AI chat generation regardless of source type
    clearInterval(timerInterval);
    stopAIChatGeneration();
    stopDonationGeneration();
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    } else if (preview.src && !preview.srcObject) {
        // For video file streaming mode: pause playback and update UI
        preview.pause();
        downloadBtn.disabled = false;
        recordingStatus.textContent = "Video streaming finished";
    } else {
        // For YouTube iframe streaming
        const youtubeFrame = document.getElementById('youtubeFrame');
        if (youtubeFrame && youtubeFrame.style.display !== 'none') {
            youtubeFrame.src = '';
            downloadBtn.disabled = false;
            recordingStatus.textContent = "Video streaming finished";
        }
    }
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    
    // Disable chat when recording stops
    isChatEnabled = false;
}

// Function to download recording
function downloadRecording() {
    if (recordedChunks.length === 0) {
        return;
    }
    
    const blob = new Blob(recordedChunks, {
        type: 'video/webm'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // Get current date and time for filename
    const now = new Date();
    const filename = `screen-recording-${now.toISOString().split('T')[0]}-${now.getHours()}-${now.getMinutes()}.webm`;
    
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
}

// Timer function
function startTimer() {
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const seconds = Math.floor((elapsedTime / 1000) % 60);
        const minutes = Math.floor((elapsedTime / (1000 * 60)) % 60);
        
        timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

// Function to start AI chat generation based on screen content
function startAIChatGeneration() {
    // Clear any existing interval
    stopAIChatGeneration();
    
    // Don't start if chat is muted
    if (chatSettings.muted) {
        return;
    }
    
    // Use the selected interval for AI checks
    aiChatInterval = setInterval(() => {
        // Only allow a limited number of capture requests to be pending at once
        if (pendingCaptureRequests < maxSimultaneousCaptureRequests) {
            captureAndGenerateMessages();
        }
    }, aiCheckInterval * 1000);
    
    // Initial capture and message generation
    captureAndGenerateMessages();
}

function stopAIChatGeneration() {
    clearInterval(aiChatInterval);
}

async function captureAndGenerateMessages() {
    if (!preview.srcObject && !preview.src && !document.getElementById('youtubeFrame')) return;
    
    try {
        pendingCaptureRequests++;
        
        // Capture from different sources based on what's active
        let imageDataUrl;
        const youtubeFrame = document.getElementById('youtubeFrame');
        
        if (youtubeFrame && youtubeFrame.style.display !== 'none') {
            try {
                // Use HTML2Canvas to capture YouTube iframe content
                const iframe = document.getElementById('youtubeFrame');
                const canvas = await html2canvas(iframe, {
                    useCORS: true,
                    allowTaint: true,
                    logging: false
                });
                
                imageDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            } catch (error) {
                console.error("Error capturing from YouTube iframe:", error);
                // Fallback to default canvas if capture fails
                captureCanvas.width = 640;
                captureCanvas.height = 360;
                captureContext.fillStyle = "#000";
                captureContext.fillRect(0, 0, captureCanvas.width, captureCanvas.height);
                captureContext.fillStyle = "#fff";
                captureContext.font = "20px Arial";
                captureContext.textAlign = "center";
                captureContext.fillText("YouTube Stream", captureCanvas.width/2, captureCanvas.height/2);
                imageDataUrl = captureCanvas.toDataURL('image/jpeg', 0.7);
            }
        } else if (preview.srcObject) {
            // Capture from camera/screen recording
            captureCanvas.width = preview.videoWidth;
            captureCanvas.height = preview.videoHeight;
            captureContext.drawImage(preview, 0, 0, captureCanvas.width, captureCanvas.height);
            imageDataUrl = captureCanvas.toDataURL('image/jpeg', 0.7);
        } else if (preview.src) {
            // Capture from video file
            captureCanvas.width = preview.videoWidth;
            captureCanvas.height = preview.videoHeight;
            captureContext.drawImage(preview, 0, 0, captureCanvas.width, captureCanvas.height);
            imageDataUrl = captureCanvas.toDataURL('image/jpeg', 0.7);
        }
        
        // Request AI description only if chat is enabled
        if (isChatEnabled) {
            const completion = await getAIDescriptionsOfImage(imageDataUrl);
            
            if (completion && completion.length > 0) {
                for (let i = 0; i < completion.length; i++) {
                    setTimeout(() => {
                        const colorClass = `color-${Math.floor(Math.random() * 6) + 1}`;
                        addMessageToChat(completion[i].username, completion[i].message, colorClass, completion[i].isModAction, completion[i].isAdmin);
                    }, i * 2000);
                }
            }
        }
    } catch (error) {
        console.error("Error generating AI messages:", error);
    } finally {
        pendingCaptureRequests--;
    }
}

// Chat functionality
function addMessageToChat(username, message, colorClass, isModAction = false, isAdmin = false) {
    const messageElement = document.createElement('div');
    messageElement.className = `message${isModAction ? ' mod-action' : ''}`;

    if (isModAction) {
        messageElement.innerHTML = `
            <span class="mod-badge">
                <img src="/Mod Tag Sticker.png" class="badge-icon">MOD
            </span>
            <span class="message-content">${formatMessageWithEmotes(message)}</span>
        `;
    } else if (isAdmin) {
        messageElement.innerHTML = `
            <span class="admin-badge">
                <img src="/Admin Tag Sticker.png" class="badge-icon">ADMIN
            </span>
            <span class="username ${colorClass}">${username}:</span>
            <span class="message-content">${formatMessageWithEmotes(message)}</span>
        `;
    } else {
        messageElement.innerHTML = `
            <span class="username ${colorClass}">${username}:</span>
            <span class="message-content">${formatMessageWithEmotes(message)}</span>
        `;
    }

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Add username to set for viewer count (excluding 'You')
    if (username !== 'You') {
        uniqueUsernames.add(username);
        updateViewerCount();
    }

    // Also send to popup if it exists and is open
    if (chatPopupWindow && !chatPopupWindow.closed) {
        chatPopupWindow.postMessage({
            type: 'newMessage',
            message: {
                username: username,
                content: message,
                colorClass: colorClass,
                isModAction: isModAction,
                isAdmin: isAdmin
            }
        }, '*');
    }
}

// Function to format messages with emotes
function formatMessageWithEmotes(message) {
    const emotes = {
        'catJAM': 'catJAM.gif',
        'Kappa': 'Kappa.png',
        'L': 'L.png',
        'OMEGALUL': 'OMEGALUL.png',
        'poggers': 'poggers.png',
        'PogU': 'PogU.png',
        'W': 'W.png',
        'UCL': '0 UCL.gif',
        'laugh': 'laugh.gif',
        'cry': 'cry.gif',
        'typefaster': 'typefaster.gif',
        'PepeLaugh': 'PepeLaugh.png'
    };
    
    // Replace emote codes with image tags
    Object.keys(emotes).forEach(emoteName => {
        const emotePattern = new RegExp(`:${emoteName}:`, 'g');
        message = message.replace(emotePattern, `<img src="${emotes[emoteName]}" alt="${emoteName}" class="chat-emote" />`);
    });
    
    return message;
}

function updateViewerCount() {
    const count = Math.floor(uniqueUsernames.size * 1.5);
    document.getElementById('viewerCount').textContent = count;
    
    // Update popup viewer count if open
    if (chatPopupWindow && !chatPopupWindow.closed) {
        chatPopupWindow.postMessage({
            type: 'viewerCountUpdate',
            count: count
        }, '*');
    }
}

function sendMessage() {
    const message = chatInput.value.trim();
    
    // Only allow sending messages if recording or streaming is active and chat is enabled
    if (!message || !isChatEnabled) {
        return;
    }
    
    // Include the sent message in the next AI prompt (only for one check)
    extraUserMessageForAI = message;
    
    // Get the current streamer username or fallback
    const senderUsername = streamerUsername || 'Streamer';
    
    // Add message to chat 
    addMessageToChat(senderUsername, message, 'color-4');
    chatInput.value = '';
    
    // Generate AI responses to user message
    generateAIResponseToUserMessage(message, senderUsername);
}

// New function to generate AI responses to user messages
async function generateAIResponseToUserMessage(userMessage, username) {
    try {
        // Streamer context
        let streamerContext = streamerUsername ? 
            `The streamer's username is "${streamerUsername}". Some viewers might address them as "${streamerUsername}" or mention them in chat.` : 
            "The streamer's identity is unknown.";
            
        // Language enforcement
        const langRequirements = [];
        if (chatSettings.spanish) langRequirements.push('SPANISH language only');
        if (chatSettings.french) langRequirements.push('FRENCH language only');
        if (chatSettings.german) langRequirements.push('GERMAN language only');
        if (chatSettings.portuguese) langRequirements.push('PORTUGUESE language only');
        if (chatSettings.russian) langRequirements.push('RUSSIAN language only');
        if (chatSettings.turkish) langRequirements.push('TURKISH language only');
        if (chatSettings.italian) langRequirements.push('ITALIAN language only');
        if (chatSettings.polish) langRequirements.push('POLISH language only');
        if (chatSettings.ukrainian) langRequirements.push('UKRAINIAN language only');

        const langRule = langRequirements.length > 0 ? 
            `STRICT RULES:\n- Messages must be in ${langRequirements.join(' OR ')}\n- Usernames must match language origin` : 
            '';
            
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `...${langRule}
...existing prompt...`
                },
                {
                    role: "user",
                    content: `Generate 3-4 chat messages reacting to this message from ${username}: "${userMessage}"`
                }
            ],
            json: true
        });
        
        // Parse the AI response
        let result = JSON.parse(completion.content);
        
        // Add the messages to chat with slight delays
        result.messages.forEach((msgData, index) => {
            setTimeout(() => {
                const colorClass = `color-${Math.floor(Math.random() * 6) + 1}`;
                addMessageToChat(msgData.username, msgData.message, colorClass);
            }, index * 800); // Stagger messages slightly
        });
        
    } catch (error) {
        console.error("Error generating poll reaction:", error);
    }
}

let chatPopupWindow = null;

function openChatPopup() {
    // Close any existing popup
    if (chatPopupWindow && !chatPopupWindow.closed) {
        chatPopupWindow.close();
    }
    
    // Create a new popup window
    chatPopupWindow = window.open('popup.html', 'StreamChat', 'width=350,height=600,resizable=yes');
    
    // Set up communication between windows
    window.addEventListener('message', function(event) {
        if (event.data.type === 'newUserMessage') {
            addMessageToChat('You', event.data.message, 'color-4');
        } else if (event.data.type === 'requestPollUpdate' && activePoll) {
            // Send current poll data when popup requests an update
            event.source.postMessage({
                type: activePoll ? 'pollUpdate' : 'pollRemoved',
                poll: activePoll ? JSON.parse(JSON.stringify(activePoll)) : null,
                totalVotes: totalVotes
            }, '*');
        } else if (event.data.type === 'newMessage') {
            if (chatPopupWindow && !chatPopupWindow.closed) {
                chatPopupWindow.postMessage({
                    type: 'newMessage',
                    message: {
                        username: event.data.message.username,
                        content: event.data.message.content,
                        colorClass: event.data.message.colorClass,
                        isModAction: event.data.message.isModAction
                    }
                }, '*');
            }
        }
    });
    
    // If there's an active poll, send it to the popup
    chatPopupWindow.addEventListener('load', function() {
        // Send viewer count to popup
        chatPopupWindow.postMessage({
            type: 'viewerCountUpdate',
            count: Math.floor(uniqueUsernames.size * 1.5)
        }, '*');
        
        if (activePoll) {
            chatPopupWindow.postMessage({
                type: 'newPoll',
                poll: JSON.parse(JSON.stringify(activePoll))
            }, '*');
            
            chatPopupWindow.postMessage({
                type: 'pollUpdate',
                poll: JSON.parse(JSON.stringify(activePoll)),
                totalVotes: totalVotes
            }, '*');
        }
    });
    
    // If there's an active poll, send it to the popup
}

// Poll functions
function togglePollForm() {
    const formContainer = document.getElementById('pollFormContainer');
    const isHidden = formContainer.style.display === 'none';
    
    formContainer.style.display = isHidden ? 'block' : 'none';
    createPollBtn.textContent = isHidden ? 'Cancel Poll' : 'Create Poll';
    
    // Reset form if hiding
    if (!isHidden) {
        pollForm.reset();
        const optionsContainer = document.getElementById('pollOptions');
        while (optionsContainer.children.length > 2) {
            optionsContainer.removeChild(optionsContainer.lastChild);
        }
    }
}

function addPollOption() {
    const optionsContainer = document.getElementById('pollOptions');
    const optionIndex = optionsContainer.children.length + 1;
    
    const optionContainer = document.createElement('div');
    optionContainer.className = 'option-container';
    
    const optionInput = document.createElement('input');
    optionInput.type = 'text';
    optionInput.name = `option${optionIndex}`;
    optionInput.placeholder = `Option ${optionIndex}`;
    optionInput.required = true;
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', function() {
        optionsContainer.removeChild(optionContainer);
    });
    
    optionContainer.appendChild(optionInput);
    optionContainer.appendChild(removeBtn);
    optionsContainer.appendChild(optionContainer);
}

function createPoll(e) {
    e.preventDefault();
    
    // If there's already an active poll, don't create a new one
    if (activePoll) {
        return;
    }
    
    const formData = new FormData(pollForm);
    const title = formData.get('pollTitle');
    const duration = parseInt(formData.get('duration'), 10);
    
    const options = [];
    let i = 1;
    while (formData.has(`option${i}`)) {
        const optionText = formData.get(`option${i}`).trim();
        if (optionText) {
            options.push({
                text: optionText,
                votes: 0
            });
        }
        i++;
    }
    
    // Need at least 2 options
    if (options.length < 2) {
        return;
    }
    
    // Create the poll
    activePoll = {
        title,
        options,
        duration,
        startTime: Date.now(),
        endTime: Date.now() + duration * 1000,
        isActive: true
    };
    
    totalVotes = 0;
    
    // Hide form and update button
    togglePollForm();
    
    // Show the active poll
    updateActivePoll();
    
    // Start the timer
    startPollTimer();
    
    // Notify the popout window about the new poll
    if (chatPopupWindow && !chatPopupWindow.closed) {
        chatPopupWindow.postMessage({
            type: 'newPoll',
            poll: JSON.parse(JSON.stringify(activePoll))
        }, '*');
    }
    
    // Generate AI messages about the poll
    generatePollMessages(title, options);
}

function updateActivePoll() {
    if (!activePoll) {
        activePollContainer.innerHTML = '';
        return;
    }
    
    // Calculate time remaining
    const timeRemaining = Math.max(0, activePoll.endTime - Date.now());
    const secondsRemaining = Math.ceil(timeRemaining / 1000);
    
    // Create the poll UI
    let pollHTML = `
        <div class="active-poll">
            <div class="active-poll-title">${activePoll.title}</div>
            <div class="poll-options">
    `;
    
    // Add options
    activePoll.options.forEach((option, index) => {
        const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
        
        pollHTML += `
            <div class="poll-option" onclick="voteOnPoll(${index})">
                <div class="poll-option-bar" style="width: ${percentage}%"></div>
                <div class="poll-option-text">
                    <span>${option.text}</span>
                    <span>${percentage}%</span>
                </div>
            </div>
        `;
    });
    
    pollHTML += `
            </div>
            <div class="poll-timer">
                <div class="poll-timer-bar" style="width: ${(timeRemaining / (activePoll.duration * 1000)) * 100}%"></div>
            </div>
            <div class="poll-votes">
                <span>${totalVotes} vote${totalVotes !== 1 ? 's' : ''}</span>
                <span>${secondsRemaining}s remaining</span>
            </div>
    `;
    
    // Add close button only for active polls
    if (activePoll.isActive) {
        pollHTML += `<button class="poll-close-btn" onclick="endPoll()">End Poll</button>`;
    } else {
        const winningText = activePoll.winningOption ? 
            `Poll ended, "${activePoll.winningOption.text}" won!` : 
            "Poll ended";
        pollHTML += `<div class="poll-status">${winningText}</div>`;
    }
    
    pollHTML += `</div>`;
    
    activePollContainer.innerHTML = pollHTML;
    
    // Update popout window
    if (chatPopupWindow && !chatPopupWindow.closed) {
        chatPopupWindow.postMessage({
            type: 'pollUpdate',
            poll: JSON.parse(JSON.stringify(activePoll)),
            totalVotes: totalVotes
        }, '*');
    }
}

function voteOnPoll(optionIndex) {
    if (!activePoll || !activePoll.isActive) return;
    
    // Increment votes for the selected option
    activePoll.options[optionIndex].votes++;
    totalVotes++;
    
    // Update UI
    updateActivePoll();
    
    // Update popout window
    if (chatPopupWindow && !chatPopupWindow.closed) {
        chatPopupWindow.postMessage({
            type: 'pollUpdate',
            poll: JSON.parse(JSON.stringify(activePoll)),
            totalVotes: totalVotes
        }, '*');
    }
    
    // Generate AI chat reactions to voting
    generatePollVoteMessage(activePoll.options[optionIndex].text);
}

function getRandomUsername() {
    const usernames = [
        'StreamFan', 'PixelGamer', 'TwitchViewer', 'ChatEnjoyer', 'StreamNinja',
        'GamingWizard', 'ViewerX', 'StreamLover', 'PogChampion', 'ChatMaster',
        'LurkerPro', 'StreamFollower', 'EmoteSpammer', 'SubScriber', 'TwitchPrime'
    ];
    
    // Generate a random username and add random numbers
    const baseUsername = usernames[Math.floor(Math.random() * usernames.length)];
    return `${baseUsername}${Math.floor(Math.random() * 1000)}`;
}

async function generatePollVoteMessage(optionText) {
    try {
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You're generating a single Twitch chat message reacting to someone voting in a poll.
                    The message should be brief (under 60 chars), conversational, and should reference the specific option.
                    Keep messages brief, conversational, and varied in tone.
                    Use casual chat expressions like "W", "L", "lmao", "lol", etc. 
                    Some should be excited, some should mention specific options.
                    Remember previous chat context: ${previousMessages.slice(-10).join(" | ")}
                    Reference previous opinions or predictions viewers had about the poll.
                    Have some viewers celebrate or complain based on whether their preferred option won.
                    Use previously established usernames when appropriate: ${previousUsernames.slice(-15).join(", ")}
                    If viewers previously showed preferences or opinions, have them be consistent with those in poll reactions.
                    Maintain continuity with how viewers were talking about the poll earlier.
                    You can include Twitch emotes in your messages using the format :emoteName:. Available emotes are:
                    - :catJAM: - An animated cat bobbing its head (use for excitement, music, rhythm, vibing)
                    - :Kappa: - The classic sarcastic face (use for sarcasm, skepticism, jokes)
                    - :L: - Red L emote (use for failures, losses, disappointments)
                    - :OMEGALUL: - Exaggerated laughing emote (use for extreme humor, laughing hard)
                    - :poggers: - Surprised/excited frog face (use for amazement, excitement)
                    - :PogU: - Surprised face emote (use for shock, amazement, excitement)
                    - :W: - Green W emote (use for wins, successes, good plays)
                    - :PepeLaugh: - Pepe the Frog laughing with tears (use for schadenfreude, when something funny/embarrassing happens to others)
                    - :UCL: - 0 UCL.gif
                    - :laugh: - laugh.gif
                    - :cry: - cry.gif
                    - :typefaster: - typefaster.gif
                    IMPORTANT: Don't mention the emote by name immediately after using it. Example: write ":W: let's go" NOT ":W: W let's go".
                    Respond directly with JSON, following this JSON schema, and no other text:
                    {
                        "username": "username1",
                        "message": "message1"
                    }`
                },
                {
                    role: "user",
                    content: `Generate a single chat message reacting to someone voting for the poll option: "${optionText}"`
                }
            ],
            json: true
        });

        // Parse the AI response
        let result = JSON.parse(completion.content);
        
        // Add the message to chat
        const colorClass = `color-${Math.floor(Math.random() * 6) + 1}`;
        addMessageToChat(result.username, result.message, colorClass);
        
    } catch (error) {
        console.error("Error generating poll reaction:", error);
    }
}

function startPollTimer() {
    // Clear any existing timer
    if (pollTimer) {
        clearInterval(pollTimer);
    }
    
    // Update the poll every second
    pollTimer = setInterval(() => {
        if (!activePoll) {
            clearInterval(pollTimer);
            return;
        }
        
        // Check if the poll has ended
        if (activePoll.isActive && Date.now() >= activePoll.endTime) {
            endPoll();
        } else {
            updateActivePoll();
            
            // Add AI votes periodically during active polls
            if (activePoll.isActive && Math.random() < 0.5) { // 50% chance each tick to add votes
                // Generate 1-3 votes each time
                const votesToAdd = Math.floor(Math.random() * 3) + 1;
                for (let i = 0; i < votesToAdd; i++) {
                    simulateAIVote();
                }
            }
        }
    }, 1000);
}

function simulateAIVote() {
    if (!activePoll || !activePoll.isActive) return;
    
    // Randomly select an option to vote for
    const optionIndex = Math.floor(Math.random() * activePoll.options.length);
    
    // Increment votes for that option
    activePoll.options[optionIndex].votes++;
    totalVotes++;
    
    // Update UI
    updateActivePoll();
    
    // Update popout window
    if (chatPopupWindow && !chatPopupWindow.closed) {
        chatPopupWindow.postMessage({
            type: 'pollUpdate',
            poll: JSON.parse(JSON.stringify(activePoll)),
            totalVotes: totalVotes
        }, '*');
    }
    
    // Occasionally have an AI chatter mention their vote
    if (Math.random() < 0.2) { // 20% chance to announce the vote
        generatePollVoteMessage(activePoll.options[optionIndex].text);
    }
}

function endPoll() {
    if (!activePoll) return;
    
    activePoll.isActive = false;
    activePoll.endTime = Date.now();
    
    // Find winning option
    let winningOption = activePoll.options[0];
    let winningIndex = 0;
    
    activePoll.options.forEach((option, index) => {
        if (option.votes > winningOption.votes) {
            winningOption = option;
            winningIndex = index;
        }
    });
    
    // Add winning option to poll data
    activePoll.winningOption = winningOption;
    activePoll.winningIndex = winningIndex;
    
    updateActivePoll();
    
    // Clear timer
    clearInterval(pollTimer);
    
    // Notify popup
    if (chatPopupWindow && !chatPopupWindow.closed) {
        chatPopupWindow.postMessage({
            type: 'pollEnded',
            poll: JSON.parse(JSON.stringify(activePoll)),
            totalVotes: totalVotes
        }, '*');
    }
    
    // Generate messages about poll results
    generatePollResultMessages(winningOption, winningIndex);
    
    // After 10 seconds, remove the poll
    setTimeout(() => {
        activePoll = null;
        updateActivePoll();
        
        // Notify popup
        if (chatPopupWindow && !chatPopupWindow.closed) {
            chatPopupWindow.postMessage({
                type: 'pollRemoved'
            }, '*');
        }
    }, 10000);
}

async function generatePollMessages(title, options) {
    try {
        // Streamer context
        let streamerContext = streamerUsername ? 
            `The streamer's username is "${streamerUsername}". Some viewers might address them as "${streamerUsername}" or mention them in chat.` : 
            "The streamer's identity is unknown.";
            
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You're generating reactions to a new poll in a Twitch chat.
                    Generate 3 short chat messages from different users reacting to a new poll.
                    All messages should mention or reference the winning option.
                    Keep messages brief (under 60 chars), conversational, and varied in tone.
                    Use casual chat expressions like "W", "L", "lmao", "lol", etc. 
                    Some should be excited, some should mention specific options.
                    Remember previous chat context: ${previousMessages.slice(-10).join(" | ")}
                    Reference previous opinions or predictions viewers had about the poll.
                    Have some viewers celebrate or complain based on whether their preferred option won.
                    Use previously established usernames when appropriate: ${previousUsernames.slice(-15).join(", ")}
                    Maintain continuity with how viewers were talking about the poll earlier.
                    You can include Twitch emotes in your messages using the format :emoteName:. Available emotes are:
                    - :catJAM: - An animated cat bobbing its head (use for excitement, music, rhythm, vibing)
                    - :Kappa: - The classic sarcastic face (use for sarcasm, skepticism, jokes)
                    - :L: - Red L emote (use for failures, losses, disappointments)
                    - :OMEGALUL: - Exaggerated laughing emote (use for extreme humor, laughing hard)
                    - :poggers: - Surprised/excited frog face (use for amazement, excitement)
                    - :PogU: - Surprised face emote (use for shock, amazement, excitement)
                    - :W: - Green W emote (use for wins, successes, good plays)
                    - :PepeLaugh: - Pepe the Frog laughing with tears (use for schadenfreude, when something funny/embarrassing happens to others)
                    - :UCL: - 0 UCL.gif
                    - :laugh: - laugh.gif
                    - :cry: - cry.gif
                    - :typefaster: - typefaster.gif
                    IMPORTANT: Don't mention the emote by name immediately after using it. Example: write ":W: let's go" NOT ":W: W let's go".
                    Respond directly with JSON, following this JSON schema, and no other text:
                    {
                        "messages": [
                            {"username": "username1", "message": "message1"},
                            {"username": "username2", "message": "message2"},
                            {"username": "username3", "message": "message3"}
                        ]
                    }`
                },
                {
                    role: "user",
                    content: `Generate chat reactions to this poll: "${title}" with options: ${options.map(o => `"${o.text}"`).join(', ')}`
                }
            ],
            json: true
        });
        
        // Parse the AI response
        let result = JSON.parse(completion.content);
        
        // Display messages with delays
        result.messages.forEach((msgData, index) => {
            setTimeout(() => {
                const colorClass = `color-${Math.floor(Math.random() * 6) + 1}`;
                addMessageToChat(msgData.username, msgData.message, colorClass);
            }, 500 + index * 1500 + Math.random() * 1000);
        });
    } catch (error) {
        console.error("Error generating poll reactions:", error);
    }
}

async function generatePollResultMessages(winningOption, winningIndex) {
    try {
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You're generating reactions to poll results in a Twitch chat.
                    Generate 3 short chat messages from different users reacting to the end of a poll.
                    All messages should mention or reference the winning option.
                    Keep messages brief (under 60 chars), conversational, and varied in tone.
                    Use casual chat expressions like "W", "L", "lmao", "lol", or "pog".
                    Some should be happy, some disappointed, some surprised.
                    Remember previous chat context: ${previousMessages.slice(-10).join(" | ")}
                    Reference previous opinions or predictions viewers had about the poll.
                    Have some viewers celebrate or complain based on whether their preferred option won.
                    Use previously established usernames when appropriate: ${previousUsernames.slice(-15).join(", ")}
                    Maintain continuity with how viewers were talking about the poll earlier.
                    You can include Twitch emotes in your messages using the format :emoteName:. Available emotes are:
                    - :catJAM: - An animated cat bobbing its head (use for excitement, music, rhythm, vibing)
                    - :Kappa: - The classic sarcastic face (use for sarcasm, skepticism, jokes)
                    - :L: - Red L emote (use for failures, losses, disappointments)
                    - :OMEGALUL: - Exaggerated laughing emote (use for extreme humor, laughing hard)
                    - :poggers: - Surprised/excited frog face (use for amazement, excitement)
                    - :PogU: - Surprised face emote (use for shock, amazement, excitement)
                    - :W: - Green W emote (use for wins, successes, good plays)
                    - :PepeLaugh: - Pepe the Frog laughing with tears (use for schadenfreude, when something funny/embarrassing happens to others)
                    - :UCL: - 0 UCL.gif
                    - :laugh: - laugh.gif
                    - :cry: - cry.gif
                    - :typefaster: - typefaster.gif
                    IMPORTANT: Don't mention the emote by name immediately after using it. Example: write ":W: let's go" NOT ":W: W let's go".
                    Respond directly with JSON, following this JSON schema, and no other text:
                    {
                        "messages": [
                            {"username": "username1", "message": "message1"},
                            {"username": "username2", "message": "message2"},
                            {"username": "username3", "message": "message3"}
                        ]
                    }`
                },
                {
                    role: "user",
                    content: `Generate chat reactions to this poll ending. The winning option was: "${winningOption.text}" with ${winningOption.votes} votes (${Math.round((winningOption.votes / totalVotes) * 100)}% of the total).`
                }
            ],
            json: true
        });
        
        // Parse the AI response
        let result = JSON.parse(completion.content);
        
        // Display messages with delays
        result.messages.forEach((msgData, index) => {
            setTimeout(() => {
                const colorClass = `color-${Math.floor(Math.random() * 6) + 1}`;
                addMessageToChat(msgData.username, msgData.message, colorClass);
            }, 500 + index * 1500 + Math.random() * 1000);
        });
    } catch (error) {
        console.error("Error generating poll result reactions:", error);
    }
}

// League configurations
const leagues2025 = {
    premierLeague: [
        { name: 'Arsenal', rivals: ['Tottenham Hotspur'] },
        { name: 'Aston Villa', rivals: ['Birmingham City'] },
        { name: 'Bournemouth', rivals: ['Southampton'] },
        { name: 'Brentford', rivals: ['Fulham'] },
        { name: 'Brighton', rivals: ['Crystal Palace'] },
        { name: 'Chelsea', rivals: ['Tottenham Hotspur', 'Arsenal'] },
        { name: 'Crystal Palace', rivals: ['Brighton'] },
        { name: 'Everton', rivals: ['Liverpool'] },
        { name: 'Fulham', rivals: ['Chelsea'] },
        { name: 'Ipswich Town', rivals: ['Norwich City'] },
        { name: 'Leicester City', rivals: ['Nottingham Forest'] },
        { name: 'Liverpool', rivals: ['Everton', 'Manchester United'] },
        { name: 'Manchester City', rivals: ['Manchester United'] },
        { name: 'Manchester United', rivals: ['Liverpool', 'Manchester City'] },
        { name: 'Newcastle United', rivals: ['Sunderland'] },
        { name: 'Nottingham Forest', rivals: ['Derby County'] },
        { name: 'Southampton', rivals: ['Portsmouth'] },
        { name: 'Tottenham Hotspur', rivals: ['Arsenal', 'Chelsea'] },
        { name: 'West Ham United', rivals: ['Millwall'] },
        { name: 'Wolves', rivals: ['West Bromwich Albion'] }
    ],
    laLiga: [
        { name: 'Alaves', rivals: ['Athletic Bilbao'] },
        { name: 'Athletic Bilbao', rivals: ['Real Sociedad'] },
        { name: 'Atletico Madrid', rivals: ['Real Madrid', 'Barcelona'] },
        { name: 'Barcelona', rivals: ['Real Madrid', 'Espanyol'] },
        { name: 'Celta Vigo', rivals: ['Deportivo La Coruña'] },
        { name: 'Espanyol', rivals: ['Barcelona'] },
        { name: 'Getafe', rivals: ['Leganes'] },
        { name: 'Girona', rivals: ['N/A'] },
        { name: 'Las Palmas', rivals: ['Tenerife'] },
        { name: 'Leganes', rivals: ['Getafe'] },
        { name: 'Mallorca', rivals: ['Real Madrid'] },
        { name: 'Osasuna', rivals: ['Real Zaragoza'] },
        { name: 'Rayo Vallecano', rivals: ['Getafe'] },
        { name: 'Real Betis', rivals: ['Sevilla'] },
        { name: 'Real Madrid', rivals: ['Barcelona', 'Atletico Madrid'] },
        { name: 'Real Sociedad', rivals: ['Athletic Bilbao'] },
        { name: 'Real Valladolid', rivals: ['Burgos'] },
        { name: 'Sevilla', rivals: ['Real Betis'] },
        { name: 'Valencia', rivals: ['Levante'] },
        { name: 'Villarreal', rivals: ['Valencia'] }
    ],
    serieA: [
        { name: 'AC Monza', rivals: ['Como'] },
        { name: 'Atalanta', rivals: ['Brescia'] },
        { name: 'Bologna', rivals: ['Modena'] },
        { name: 'Cagliari', rivals: ['Sassuolo'] },
        { name: 'Como', rivals: ['Lecco'] },
        { name: 'Empoli', rivals: ['Pisa'] },
        { name: 'Fiorentina', rivals: ['Juventus'] },
        { name: 'Genoa', rivals: ['Sampdoria'] },
        { name: 'Hellas Verona', rivals: ['Chievo'] },
        { name: 'Inter', rivals: ['AC Milan'] },
        { name: 'Juventus', rivals: ['Torino'] },
        { name: 'Lazio', rivals: ['Roma'] },
        { name: 'Lecce', rivals: ['Bari'] },
        { name: 'Milan', rivals: ['Inter'] },
        { name: 'Napoli', rivals: ['Roma'] },
        { name: 'Parma', rivals: ['Modena'] },
        { name: 'Roma', rivals: ['Lazio'] },
        { name: 'Torino', rivals: ['Juventus'] },
        { name: 'Udinese', rivals: ['Triestina'] },
        { name: 'Venezia FC', rivals: ['Padova'] }
    ],
    bundesliga: [
        { name: '1. FSV Mainz 05', rivals: ['Eintracht Frankfurt'] },
        { name: 'Borussia Mönchengladbach', rivals: ['1. FC Köln'] },
        { name: 'Bayer Leverkusen', rivals: ['Köln'] },
        { name: 'Bayern Munich', rivals: ['1860 Munich'] },
        { name: 'Bochum', rivals: ['Schalke 04'] },
        { name: 'Dortmund', rivals: ['Schalke 04'] },
        { name: 'Eintracht Frankfurt', rivals: ['Kickers Offenbach'] },
        { name: 'FC Augsburg', rivals: ['1860 Munich'] },
        { name: 'Heidenheim', rivals: ['N/A'] },
        { name: 'Hoffenheim', rivals: ['Karlsruher SC'] },
        { name: 'Holstein Kiel', rivals: ['Hamburger SV'] },
        { name: 'RB Leipzig', rivals: ['Red Bull Salzburg'] },
        { name: 'SC Freiburg', rivals: ['Karlsruher SC'] },
        { name: 'St. Pauli', rivals: ['FC St. Pauli'] },
        { name: 'SV Werder Bremen', rivals: ['Hamburger SV'] },
        { name: 'Union Berlin', rivals: ['Hertha BSC'] },
        { name: 'VfB Stuttgart', rivals: ['Karlsruher SC'] },
        { name: 'Wolfsburg', rivals: ['Eintracht Braunschweig'] }
    ],
    ligue1: [
        { name: 'Angers', rivals: ['Nantes'] },
        { name: 'Auxerre', rivals: ['Troyes'] },
        { name: 'Brest', rivals: ['Guingamp'] },
        { name: 'Le Havre', rivals: ['Rouen'] },
        { name: 'Lens', rivals: ['Lille'] },
        { name: 'Lille', rivals: ['Lens'] },
        { name: 'Lyon', rivals: ['Saint-Étienne'] },
        { name: 'Marseille', rivals: ['PSG'] },
        { name: 'Monaco', rivals: ['Nice'] },
        { name: 'Montpellier', rivals: ['Nimes'] },
        { name: 'Nantes', rivals: ['Angers'] },
        { name: 'Nice', rivals: ['Monaco'] },
        { name: 'PSG', rivals: ['Marseille'] },
        { name: 'Reims', rivals: ['Troyes'] },
        { name: 'Rennes', rivals: ['Nantes'] },
        { name: 'Saint-Étienne', rivals: ['Lyon'] },
        { name: 'Strasbourg', rivals: ['Metz'] },
        { name: 'Toulouse', rivals: ['Bordeaux'] }
    ]
};

// In the captureAndGenerateMessages or similar functions where team references are used,
// prioritize the 20-team leagues in the ratio 20:18
if (chatSettings.teamFans) {
    // When selecting teams, check for rivalries and incorporate them
    const selectedLeague = leagues2025.premierLeague;
    const randomTeam = selectedLeague[Math.floor(Math.random() * selectedLeague.length)];
    
    // Check if team has rivals
    if (randomTeam.rivals && randomTeam.rivals[0] !== 'N/A') {
        const rivalTeam = randomTeam.rivals[0];
        // Generate chants that reference the rivalry
        const rivalryChants = [
            `${randomTeam.name} forever! ${rivalTeam} suck!`,
            `We'll smash ${rivalTeam}!`,
            `Never trust a ${rivalTeam} fan!`,
            `${rivalTeam} = tinpot club!`,
            `${randomTeam.name} ultras! ${rivalTeam} who?`
        ];
        
        // Add rivalry messages to chat
        setTimeout(() => {
            const colorClass = `color-${Math.floor(Math.random() * 6) + 1}`;
            addMessageToChat(
                msgData.username, 
                `${msgData.message} ${rivalryChants[Math.floor(Math.random() * rivalryChants.length)]}`, 
                colorClass
            );
        }, index * 1200 + 800);
    }
}

const languageExamples = {
    spanish: [
        'VillarrealFan', 'Barca_Ultra', 'Madridista93', 'Atleti4Life',
        'GironaSupreme', 'ValenciaCB', 'RealBetisSeville', 'AthleticBilbao1898',
        'SevillaFC', 'CeltaVigoGalicia', 'OsasunaPamplona', 'AlavesVitoria'
    ],
    french: [
        'PSGUltra', 'OLyonnais', 'MarseilleVieuxPort', 'ASMonaco1893',
        'LilleOSC58', 'RCSAlsace', 'StadeRennaisFC', 'FCNantesBreton',
        'MontpellierHSC', 'LensBTC', 'BrestStade29', 'ToulouseFC1937'
    ],
    german: [
        'BayernMucHansi', 'BVB09SignalIduna', 'LeverkusenWerkself',
        'RBLeipzigBull', 'VfBstuttgart', 'EintrachtFrankfurt',
        'SCFreiburgBreisgau', '1FCKoeln', 'UnionBerlinEisern',
        'WerderBremenSV', 'WolfsburgVFL', 'Mainz05zer'
    ],
    portuguese: [
        'BenficaLisbon', 'SportingCP1893', 'FCPorto', 'BragaArsenal',
        'VitoriaSC', 'BoavistaFC', 'GilVicente', 'RioAveFC'
    ],
    russian: [
        'SpartakMoscow1935', 'CSKAMoscow', 'ZenitPeterburg', 
        'LokomotivMoscow', 'DynamoMoscow', 'RubinKazan', 
        'KrasnodarBull', 'RostovSelma', 'SochiFC', 'AkhmatGrozny'
    ],
    turkish: [
        'Fener1907Istanbul', 'GalatasarayAS', 'BesiktasEagles',
        'TrabzonSeaStorm', 'BasaksehirFC', 'Ankaragucu', 
        'SivassporRed', 'Antalyaspor', 'Konyaspor', 'AdanaDemirspor'
    ],
    italian: [
        'JuveTorino', 'ACMilan1899', 'InterMilano1908', 
        'NapoliVesuvio', 'ASRoma1927', 'LazioEagle', 
        'FiorentinaViola', 'AtalantaBergamo', 'UdineseFriuli',
        'BolognaFC1909'
    ],
    polish: [
        'LegiaWarsaw', 'LechPoznan', 'WislaKrakow', 
        'GornikZabrze', 'LegnicaFan', 'ZaglebieLubin',
        'RakówCzęstochowa', 'StalMielec', 'Jagiellonia', 'PogonSzczecin'
    ],
    ukrainian: [
        'DynamoKyiv1927', 'ShakhtarDonetsk', 'DniproDnipropetrovsk',
        'ZoryaDonetsk', 'VorsklaPoltava', 'KarpatyLviv1963', 
        'MetalistKharkiv', 'ChornomoretsOdessa', 'KolosKovalivka',
        'RukhLviv'
    ]
};

async function streamVideo() {
    toggleStreamOptions();
}

function toggleStreamOptions() {
    const container = document.getElementById('streamSourceContainer');
    if (container.style.display === 'none' || container.style.display === '') {
        container.style.display = 'flex';
        streamVideoBtn.textContent = 'Cancel';
    } else {
        container.style.display = 'none';
        streamVideoBtn.textContent = 'Stream Video...';
    }
    
    // Reset the form
    handleStreamSourceChange();
}

function handleStreamSourceChange() {
    const sourceType = streamSourceSelect.value;
    const urlContainer = document.getElementById('streamUrlContainer');
    const fileContainer = document.getElementById('streamFileContainer');
    
    if (sourceType === 'file') {
        urlContainer.style.display = 'none';
        fileContainer.style.display = 'block';
    } else {
        urlContainer.style.display = 'block';
        fileContainer.style.display = 'none';
    }
}

function startStreaming() {
    const sourceType = streamSourceSelect.value;
    
    if (sourceType === 'file') {
        streamVideoFile();
    } else {
        streamYoutubeVideo();
    }
    
    // Hide the options after starting
    toggleStreamOptions();
}

function streamYoutubeVideo() {
    const youtubeUrl = streamUrlInput.value.trim();
    if (!youtubeUrl) {
        alert('Please enter a YouTube URL');
        return;
    }
    
    // Extract video ID from various YouTube URL formats
    let videoId = null;
    
    if (youtubeUrl.includes('youtu.be/')) {
        videoId = youtubeUrl.split('youtu.be/')[1];
        if (videoId.includes('?')) {
            videoId = videoId.split('?')[0];
        }
    } else if (youtubeUrl.includes('youtube.com/watch?v=')) {
        const urlParams = new URLSearchParams(youtubeUrl.split('?')[1]);
        videoId = urlParams.get('v');
    }
    
    if (!videoId) {
        alert('Invalid YouTube URL. Please use a standard YouTube URL.');
        return;
    }
    
    // Stop any ongoing screen recording if active
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        stopRecording();
    }
    
    // Reset state and UI for video streaming
    recordedChunks = [];
    clearInterval(timerInterval);
    startBtn.disabled = true;
    stopBtn.disabled = false;
    downloadBtn.disabled = true;
    recordingStatus.textContent = "Streaming YouTube video...";
    
    // Clear previous chat history when switching videos
    previousMessages = [];
    previousUsernames = [];
    uniqueUsernames.clear(); // Reset unique usernames
    updateViewerCount(); // Reset viewer count
    
    // Create embed URL
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}/?autoplay=1`;
    
    // Hide preview video element
    preview.srcObject = null;
    preview.src = '';
    preview.style.display = 'none';
    
    // Create iframe if it doesn't exist
    let youtubeFrame = document.getElementById('youtubeFrame');
    if (!youtubeFrame) {
        youtubeFrame = document.createElement('iframe');
        youtubeFrame.id = 'youtubeFrame';
        youtubeFrame.allow = 'autoplay; encrypted-media';
        youtubeFrame.allowFullscreen = true;
        youtubeFrame.style.width = '100%';
        youtubeFrame.style.height = '100%';
        youtubeFrame.style.border = 'none';
        preview.parentNode.appendChild(youtubeFrame);
    } else {
        youtubeFrame.style.display = 'block';
    }
    
    youtubeFrame.src = embedUrl;
    
    // Set up the timer and AI chat
    startTime = Date.now();
    startTimer();
    startAIChatGeneration();
    startDonationGeneration();
    
    // Enable chat for YouTube streaming
    isChatEnabled = true;
}

async function streamVideoFile() {
    const fileInput = document.getElementById('streamFileInput');
    if (fileInput.files.length === 0) {
        alert('Please select a video file');
        return;
    }
    
    const file = fileInput.files[0];
    if (file) {
        try {
            // Stop any ongoing screen recording if active
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                stopRecording();
            }
            
            // Reset state and UI for video file streaming
            recordedChunks = [];
            clearInterval(timerInterval);
            startBtn.disabled = true;
            stopBtn.disabled = false;
            downloadBtn.disabled = true;
            recordingStatus.textContent = "Streaming video...";
            
            // Clear previous chat history when switching videos
            previousMessages = [];
            previousUsernames = [];
            uniqueUsernames.clear(); // Reset unique usernames
            updateViewerCount(); // Reset viewer count
            
            // Hide YouTube iframe if it exists
            const youtubeFrame = document.getElementById('youtubeFrame');
            if (youtubeFrame) {
                youtubeFrame.style.display = 'none';
            }
            
            // Show the preview element
            preview.style.display = 'block';
            
            // Create object URL for the selected video file
            const videoURL = URL.createObjectURL(file);
            
            // Use the preview element for video playback
            preview.srcObject = null;
            preview.src = videoURL;
            preview.muted = false; // Enable sound for video files
            
            preview.onloadedmetadata = () => {
                startTime = Date.now();
                startTimer();
                preview.play();
                startAIChatGeneration();
                startDonationGeneration();
                preview.onended = () => {
                    stopRecording();
                    recordingStatus.textContent = "Video streaming finished";
                };
            };
        } catch (error) {
            console.error("Error streaming video:", error);
            recordingStatus.textContent = "Failed to stream video: " + error.message;
        }
    }
    
    // Enable chat for video file streaming
    isChatEnabled = true;
}

function startDonationGeneration() {
    // Clear any existing interval
    stopDonationGeneration();
    
    // Don't start if donations are disabled
    if (chatSettings.disableDonations) {
        return;
    }
    
    donationTimer = setInterval(() => {
        if (Math.random() < 0.08) { 
            generateDonation();
        }
    }, 2000);
}

function stopDonationGeneration() {
    clearInterval(donationTimer);
}

async function generateDonation() {
    try {
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `Generate a simulated donation for a livestream. Include a username, donation amount (either $1-$100 or 100-10000 bits), and a short message.
                    For bits, use the format "X bits" and for dollars use the format "$X". Choose randomly between bits and dollars.
                    Keep the donation message brief and realistic. Users might express appreciation, ask a question, make a request, or just say something funny.
                    You can include Twitch emotes in your messages using the format :emoteName:. Available emotes are:
                    - :catJAM: - An animated cat bobbing its head (use for excitement, music, rhythm, vibing)
                    - :Kappa: - The classic sarcastic face (use for sarcasm, skepticism, jokes)
                    - :L: - Red L emote (use for failures, losses, disappointments)
                    - :OMEGALUL: - Exaggerated laughing emote (use for extreme humor, laughing hard)
                    - :poggers: - Surprised/excited frog face (use for amazement, excitement)
                    - :PogU: - Surprised face emote (use for shock, amazement, excitement)
                    - :W: - Green W emote (use for wins, successes, good plays)
                    - :PepeLaugh: - Pepe the Frog laughing with tears (use for schadenfreude, when something funny/embarrassing happens to others)
                    - :UCL: - 0 UCL.gif
                    - :laugh: - laugh.gif
                    - :cry: - cry.gif
                    - :typefaster: - typefaster.gif
                    IMPORTANT: Don't mention the emote by name immediately after using it. Example: write ":W: let's go" NOT ":W: W let's go".
                    Respond directly with JSON, following this JSON schema, and no other text:
                    {
                        "username": "string",
                        "amount": "string",
                        "message": "string",
                        "type": "string" // either "bits" or "dollars"
                    }`
                },
                {
                    role: "user",
                    content: `Generate a realistic donation for a livestream. Previous messages in chat: ${previousMessages.slice(-10).join(" | ")}`
                }
            ],
            json: true
        });

        // Parse the AI response
        let result = JSON.parse(completion.content);
        
        // Add the donation to chat
        addDonationToChat(result.username, result.amount, result.message, result.type);
        
        // Generate chat reactions to the donation
        generateDonationReactions(result.username, result.amount, result.type);
        
    } catch (error) {
        console.error("Error generating donation:", error);
    }
}

async function generateDonationReactions(donorUsername, amount, donationType) {
    try {
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You're generating 2-3 chat messages from different viewers reacting to a donation in a Twitch stream.
                    Messages should be brief (under 60 chars), varied in tone, and reference the donation or donor.
                    Use casual chat expressions like "W", "L", "lmao", "lol", etc. 
                    Include short messages like "W ${donorUsername}" or "BIG W" for generous donations.
                    Be sure to include reactions like "lmao", "lol", "W", "Pog", or "L" in at least one message.
                    Include reactions like excitement, jokes about the amount, or emotes like "PogChamp" or "LUL".
                    IMPORTANT: These are messages from VIEWERS, not the streamer. They should NEVER say "thanks for the bits/donation" as if they're the streamer receiving it.
                    Generate unique usernames for each message.
                    Generate as unique usernames as possible – avoid common or overused examples.
                    Remember previous chat context: ${previousMessages.slice(-10).join(" | ")}
                    Use previously established usernames when appropriate: ${previousUsernames.slice(-15).join(", ")}
                    If certain viewers have shown consistent behavior or personalities, have them react consistently.
                    Reference any ongoing discussions or topics when reacting to the donation.
                    You can include Twitch emotes in your messages using the format :emoteName:. Available emotes are:
                    - :catJAM: - An animated cat bobbing its head (use for excitement, music, rhythm, vibing)
                    - :Kappa: - The classic sarcastic face (use for sarcasm, skepticism, jokes)
                    - :L: - Red L emote (use for failures, losses, disappointments)
                    - :OMEGALUL: - Exaggerated laughing emote (use for extreme humor, laughing hard)
                    - :poggers: - Surprised/excited frog face (use for amazement, excitement)
                    - :PogU: - Surprised face emote (use for shock, amazement, excitement)
                    - :W: - Green W emote (use for wins, successes, good plays)
                    - :PepeLaugh: - Pepe the Frog laughing with tears (use for schadenfreude, when something funny/embarrassing happens to others)
                    - :UCL: - 0 UCL.gif
                    - :laugh: - laugh.gif
                    - :cry: - cry.gif
                    - :typefaster: - typefaster.gif
                    IMPORTANT: Don't mention the emote by name immediately after using it. Example: write ":W: let's go" NOT ":W: W let's go".
                    Respond directly with JSON, following this JSON schema, and no other text:
                    {
                        "messages": [
                            {"username": "username1", "message": "message1"},
                            {"username": "username2", "message": "message2"},
                            {"username": "username3", "message": "message3"}
                        ]
                    }`
                },
                {
                    role: "user",
                    content: `Generate chat reactions to this donation: User "${donorUsername}" just donated ${amount} (${donationType})`
                }
            ],
            json: true
        });
        
        // Parse the AI response
        let result = JSON.parse(completion.content);
        
        // Add the messages to chat with slight delays
        result.messages.forEach((msgData, index) => {
            setTimeout(() => {
                const colorClass = `color-${Math.floor(Math.random() * 6) + 1}`;
                addMessageToChat(msgData.username, msgData.message, colorClass);
            }, index * 1200 + 800); 
        });
        
        if (chatSettings.teamFans) {
            // Select random league and team
            const leagues = Object.values(leagues2025);
            const randomLeague = leagues[Math.floor(Math.random() * leagues.length)];
            const randomTeam = randomLeague[Math.floor(Math.random() * randomLeague.length)];
            
            // Generate team-specific chant
            const chants = [
                `Allez ${randomTeam.name}!`,
                `Forza ${randomTeam.name}!`,
                `Vamos ${randomTeam.name}!`,
                `${randomTeam.name} Ultras!`,
                `${randomTeam.name} Till I Die!`,
                `YNWA!` // Keep Liverpool's special case
            ];
            
            result.messages.forEach((msgData, index) => {
                setTimeout(() => {
                    const chant = chants[Math.floor(Math.random() * chants.length)];
                    addMessageToChat(msgData.username, 
                        `${msgData.message} ${chant}`, 
                        colorClass);
                }, index * 1200 + 800);
            });
        }
        
        if (chatSettings.modsEnabled && Math.random() < 0.1) {
            const actions = ['delete', 'timeout'];
            const action = actions[Math.floor(Math.random()*actions.length)];
            setTimeout(() => {
                addMessageToChat('MOD', `Donation message deleted - content violation`, 'color-6', true);
            }, 1500);
        }
        
    } catch (error) {
        console.error("Error generating donation reactions:", error);
    }
}

function addDonationToChat(username, amount, message, type) {
    const donationElement = document.createElement('div');
    donationElement.className = 'donation-message';
    
    // Set appropriate CSS class based on donation type
    if (type === "bits") {
        donationElement.classList.add('bits-donation');
    } else {
        donationElement.classList.add('dollars-donation');
    }
    
    donationElement.innerHTML = `
        <div>
            <span class="donation-amount">${amount}</span>
            <span class="donation-username">${username}</span>
        </div>
        <div class="donation-text">${formatMessageWithEmotes(message)}</div>
    `;
    
    chatMessages.appendChild(donationElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add username to set for viewer count (excluding 'You')
    if (username !== 'You') {
        uniqueUsernames.add(username);
        updateViewerCount();
    }
    
    // Also send to popup if it exists and is open
    if (chatPopupWindow && !chatPopupWindow.closed) {
        chatPopupWindow.postMessage({
            type: 'newDonation',
            donation: {
                username: username,
                amount: amount,
                message: message,
                type: type
            }
        }, '*');
    }
}

async function getAIDescriptionsOfImage(imageDataUrl) {
    try {
        if (isProcessingAIMessage) return [];
        isProcessingAIMessage = true;
        
        // Build language-specific username requirements
        let languageRules = [];
        const languageExamples = {
            spanish: [
                'VillarrealFan', 'Barca_Ultra', 'Madridista93', 'Atleti4Life',
                'GironaSupreme', 'ValenciaCB', 'RealBetisSeville', 'AthleticBilbao1898',
                'SevillaFC', 'CeltaVigoGalicia', 'OsasunaPamplona', 'AlavesVitoria'
            ],
            french: [
                'PSGUltra', 'OLyonnais', 'MarseilleVieuxPort', 'ASMonaco1893',
                'LilleOSC58', 'RCSAlsace', 'StadeRennaisFC', 'FCNantesBreton',
                'MontpellierHSC', 'LensBTC', 'BrestStade29', 'ToulouseFC1937'
            ],
            german: [
                'BayernMucHansi', 'BVB09SignalIduna', 'LeverkusenWerkself',
                'RBLeipzigBull', 'VfBstuttgart', 'EintrachtFrankfurt',
                'SCFreiburgBreisgau', '1FCKoeln', 'UnionBerlinEisern',
                'WerderBremenSV', 'WolfsburgVFL', 'Mainz05zer'
            ],
            portuguese: [
                'BenficaLisbon', 'SportingCP1893', 'FCPorto', 'BragaArsenal',
                'VitoriaSC', 'BoavistaFC', 'GilVicente', 'RioAveFC'
            ],
            russian: [
                'SpartakMoscow1935', 'CSKAMoscow', 'ZenitPeterburg', 
                'LokomotivMoscow', 'DynamoMoscow', 'RubinKazan', 
                'KrasnodarBull', 'RostovSelma', 'SochiFC', 'AkhmatGrozny'
            ],
            turkish: [
                'Fener1907Istanbul', 'GalatasarayAS', 'BesiktasEagles',
                'TrabzonSeaStorm', 'BasaksehirFC', 'Ankaragucu', 
                'SivassporRed', 'Antalyaspor', 'Konyaspor', 'AdanaDemirspor'
            ],
            italian: [
                'JuveTorino', 'ACMilan1899', 'InterMilano1908', 
                'NapoliVesuvio', 'ASRoma1927', 'LazioEagle', 
                'FiorentinaViola', 'AtalantaBergamo', 'UdineseFriuli',
                'BolognaFC1909'
            ],
            polish: [
                'LegiaWarsaw', 'LechPoznan', 'WislaKrakow', 
                'GornikZabrze', 'LegnicaFan', 'ZaglebieLubin',
                'RakówCzęstochowa', 'StalMielec', 'Jagiellonia', 'PogonSzczecin'
            ],
            ukrainian: [
                'DynamoKyiv1927', 'ShakhtarDonetsk', 'DniproDnipropetrovsk',
                'ZoryaDonetsk', 'VorsklaPoltava', 'KarpatyLviv1963', 
                'MetalistKharkiv', 'ChornomoretsOdessa', 'KolosKovalivka',
                'RukhLviv'
            ]
        };
        
        Object.entries({
            spanish: chatSettings.spanish,
            french: chatSettings.french, 
            german: chatSettings.german,
            portuguese: chatSettings.portuguese,
            russian: chatSettings.russian,
            turkish: chatSettings.turkish,
            italian: chatSettings.italian,
            polish: chatSettings.polish,
            ukrainian: chatSettings.ukrainian
        }).forEach(([lang, enabled]) => {
            if (enabled) {
                languageRules.push(
                    `FOR ${lang.toUpperCase()} MESSAGES: ` +
                    `Usernames must look ${lang} (e.g. ${languageExamples[lang].join(', ')}). ` +
                    `Messages must be in ${lang} language ONLY. ` +
                    `Never mix languages in same message.`
                );
            }
        });

        // Build context based on chat settings
        let contextParts = [];
        
        if (chatSettings.angry) contextParts.push("Use an angry, irritated tone. Express frustration or annoyance.");
        if (chatSettings.memelike) contextParts.push("Use lots of meme references and internet culture slang.");
        if (chatSettings.happy) contextParts.push("Be extremely positive and enthusiastic. Use plenty of exclamation marks!");
        if (chatSettings.botlike) contextParts.push("Write very robotic, repetitive messages with occasional 'glitches'.");
        if (chatSettings.silly) contextParts.push("Be completely absurd and nonsensical. Make weird, illogical statements.");
        if (chatSettings.sad) contextParts.push("Sound melancholy, pessimistic or even depressed about what's happening.");
        if (chatSettings.confused) contextParts.push("Act confused or misinterpret what's happening. Ask lots of questions.");
        if (chatSettings.fan) contextParts.push("Act like a huge fan of the streamer. Compliment them constantly.");
        if (chatSettings.footballFans) {
            const eplTeams = leagues2025.premierLeague.map(team => team.name).join(', ');
            const laLigaTeams = leagues2025.laLiga.map(team => team.name).join(', ');
            const serieATeams = leagues2025.serieA.map(team => team.name).join(', ');
            contextParts.push(`Focus on 2025 season teams (EPL: ${eplTeams} | LaLiga: ${laLigaTeams} | Serie A: ${serieATeams}). Use current player names and rivalries.`);
        }
        if (chatSettings.leaguesFans) contextParts.push("Focus on esports/league reactions. Use team chants, player names ('Faker', 'Caps'), and tournament hype. Include references to Baron steals, pentakills, and pro strategies.");
        if (chatSettings.goodViewers) contextParts.push("Generate exceptionally positive, supportive messages. Focus on constructive feedback, compliments, and encouragement. Avoid any negativity or criticism.");
        if (chatSettings.teamFans) contextParts.push("Focus on specific sports team reactions. Use team chants ('YNWA', 'Come On City'), player nicknames ('Haaland', 'Salah'), and match excitement. Include references to derbies, title races, and passionate fan culture.");
        if (chatSettings.spanish) contextParts.push("Include Spanish language messages using Hispanic slang and expressions");
        if (chatSettings.french) contextParts.push("Include French language messages with common French idioms");
        if (chatSettings.german) contextParts.push("Include German language messages with proper grammar");
        if (chatSettings.portuguese) contextParts.push("Include Brazilian Portuguese messages with local expressions");
        if (chatSettings.russian) contextParts.push("Include Russian language messages using Cyrillic script");
        if (chatSettings.turkish) contextParts.push("Include Turkish language messages with Ottoman script");
        if (chatSettings.italian) contextParts.push("Include Italian language messages with Italian slang");
        if (chatSettings.polish) contextParts.push("Include Polish language messages with Polish script");
        if (chatSettings.ukrainian) contextParts.push("Include Ukrainian language messages using Cyrillic script");
        
        const chatContext = contextParts.length > 0 ? 
            "Chat personality settings: " + contextParts.join(" ") : 
            "Default chat personality: casual, mixed reactions, some spam, some emotes.";
        
        // Include extra user message in context if it exists
        const userMessageContext = extraUserMessageForAI ? 
            `A viewer just sent this message: "${extraUserMessageForAI}"` : 
            "";
        
        // Clear the extra user message after using it
        extraUserMessageForAI = null;
        
        // Streamer context
        let streamerContext = streamerUsername ? 
            `The streamer's username is "${streamerUsername}". Some viewers might address them as "${streamerUsername}" or mention them in chat.` : 
            "The streamer's identity is unknown.";
            
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are generating 2-4 Twitch chat messages based on what's happening in a livestream.
                    ${languageRules.join('\n')}
                    ${chatContext}
                    ${userMessageContext}
                    ${streamerContext}
                    You can include Twitch emotes in your messages using the format :emoteName:. Available emotes are:
                    - :catJAM: - An animated cat bobbing its head (use for excitement, music, rhythm, vibing)
                    - :Kappa: - The classic sarcastic face (use for sarcasm, skepticism, jokes)
                    - :L: - Red L emote (use for failures, losses, disappointments)
                    - :OMEGALUL: - Exaggerated laughing emote (use for extreme humor, laughing hard)
                    - :poggers: - Surprised/excited frog face (use for amazement, excitement)
                    - :PogU: - Surprised face emote (use for shock, amazement, excitement)
                    - :W: - Green W emote (use for wins, successes, good plays)
                    - :PepeLaugh: - Pepe the Frog laughing with tears (use for schadenfreude, when something funny/embarrassing happens to others)
                    - :UCL: - 0 UCL.gif
                    - :laugh: - laugh.gif
                    - :cry: - cry.gif
                    - :typefaster: - typefaster.gif
                    IMPORTANT: Don't mention the emote by name immediately after using it. Example: write ":W: let's go" NOT ":W: W let's go".
                    Respond directly with JSON, following this JSON schema, and no other text:
                    {
                        "messages": [
                            {"username": "username1", "message": "message1"},
                            {"username": "username2", "message": "message2"},
                            {"username": "username3", "message": "message3"},
                            {"username": "username4", "message": "message4"}
                        ]
                    }`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "What's happening in this stream image? Generate 2-4 realistic chat messages." },
                        { type: "image_url", image_url: { url: imageDataUrl } }
                    ]
                }
            ],
            json: true
        });
        
        // Parse and process the response
        let result;
        try {
            result = JSON.parse(completion.content);
            
            // Store messages for context in future requests
            result.messages.forEach(msg => {
                previousMessages.push(`${msg.username}: ${msg.message}`);
                previousUsernames.push(msg.username);
            });
            
            // Keep context arrays to a reasonable size
            if (previousMessages.length > 30) previousMessages = previousMessages.slice(-30);
            if (previousUsernames.length > 30) previousUsernames = previousUsernames.slice(-30);
            
            return result.messages;
        } catch (error) {
            console.error("Error parsing AI response:", error);
            console.error("Raw response:", completion.content);
            return [];
        }
    } catch (error) {
        console.error("Error getting AI descriptions:", error);
        return [];
    } finally {
        isProcessingAIMessage = false;
    }
}

// New function to generate AI responses to user messages
async function generateAIResponseToUserMessage(userMessage, username) {
    try {
        // Streamer context
        let streamerContext = streamerUsername ? 
            `The streamer's username is "${streamerUsername}". Some viewers might address them as "${streamerUsername}" or mention them in chat.` : 
            "The streamer's identity is unknown.";
            
        // Language enforcement
        const langRequirements = [];
        if (chatSettings.spanish) langRequirements.push('SPANISH language only');
        if (chatSettings.french) langRequirements.push('FRENCH language only');
        if (chatSettings.german) langRequirements.push('GERMAN language only');
        if (chatSettings.portuguese) langRequirements.push('PORTUGUESE language only');
        if (chatSettings.russian) langRequirements.push('RUSSIAN language only');
        if (chatSettings.turkish) langRequirements.push('TURKISH language only');
        if (chatSettings.italian) langRequirements.push('ITALIAN language only');
        if (chatSettings.polish) langRequirements.push('POLISH language only');
        if (chatSettings.ukrainian) langRequirements.push('UKRAINIAN language only');

        const langRule = langRequirements.length > 0 ? 
            `STRICT RULES:\n- Messages must be in ${langRequirements.join(' OR ')}\n- Usernames must match language origin` : 
            '';
            
        const completion = await websim.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `...${langRule}
...existing prompt...`
                },
                {
                    role: "user",
                    content: `Generate 3-4 chat messages reacting to this message from ${username}: "${userMessage}"`
                }
            ],
            json: true
        });
        
        // Parse the AI response
        let result = JSON.parse(completion.content);
        
        // Add the messages to chat with slight delays
        result.messages.forEach((msgData, index) => {
            setTimeout(() => {
                const colorClass = `color-${Math.floor(Math.random() * 6) + 1}`;
                addMessageToChat(msgData.username, msgData.message, colorClass);
            }, index * 800); // Stagger messages slightly
        });
        
    } catch (error) {
        console.error("Error generating poll reaction:", error);
    }
}

document.head.innerHTML += `
    <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
`;

window.addEventListener('load', () => {
    document.getElementById('currentYear').textContent = '2025';
});