// ...existing code...

// Modified message handler to trigger rival responses
function addMessageToChat(username, message, colorClass, isModAction = false, isAdmin = false) {
    // ...existing message creation code...

    // After adding message, check for team rivalries
    setTimeout(() => checkForRivalResponse(username, message), 1500);
}

// New function to generate rival responses
function generateRivalResponse(originalTeam, originalMessage) {
    const leagueNames = Object.keys(leagues2025);
    const randomLeague = leagues2025[leagueNames[Math.floor(Math.random() * leagueNames.length)]];
    const rivalEntry = randomLeague.find(team => team.name === originalTeam);
    
    if (!rivalEntry || !rivalEntry.rivals) return null;

    const rivalTeam = rivalEntry.rivals[Math.floor(Math.random() * rivalEntry.rivals.length)];
    if (!rivalTeam || rivalTeam === 'N/A') return null;

    const insults = [
        `${originalTeam} suck! ${rivalTeam} forever!`,
        `Tinpot club ${originalTeam}! ${rivalTeam} rules!`,
        `Farmers league team 😂 ${rivalTeam} much better`,
        `How's Europa League treating you? ${rivalTeam} in UCL!`,
        `Plastic fans smh ${rivalTeam} real history`
    ];

    const chants = [
        `We know what we are! ${rivalTeam} army!`,
        `Allez ${rivalTeam}! Allez!`,
        `Forza ${rivalTeam}! Forza!`,
        `${rivalTeam} til I die!`,
        `YNWA! Oh wait wrong club 😂`
    ];

    const responses = [
        ...insults,
        ...chants,
        `*laughs in ${rivalTeam} fan*`,
        `Small club energy 😴 ${rivalTeam} clear`,
        `${originalTeam}? More like ${originalTeam} B 😂`
    ];

    return {
        team: rivalTeam,
        message: responses[Math.floor(Math.random() * responses.length)]
    };
}

// New function to check for and create rival responses
function checkForRivalResponse(username, originalMessage) {
    // 30% chance to trigger rival response
    if (Math.random() < 0.3) return; 

    // Detect team from username
    const allTeams = Object.values(leagues2025).flat();
    const userTeam = allTeams.find(team => 
        username.toLowerCase().includes(team.name.toLowerCase().replace(/ /g, ''))
    );

    if (!userTeam) return;

    // Generate rival response
    const response = generateRivalResponse(userTeam.name, originalMessage);
    if (!response) return;

    // Create rival username based on language settings
    const lang = Object.entries({
        spanish: chatSettings.spanish,
        french: chatSettings.french,
        german: chatSettings.german
    }).find(([_, val]) => val)?.[0] || 'default';

    const rivalUsername = formatRivalUsername(response.team, lang);
    const colorClass = `color-${Math.floor(Math.random() * 6) + 1}`;

    // Add slight delay for realistic response timing
    setTimeout(() => {
        addMessageToChat(rivalUsername, response.message, colorClass);
    }, Math.random() * 2000 + 500);
}

// Helper to format team-specific usernames
function formatRivalUsername(team, lang) {
    const teamSlug = team.replace(/ /g, '');
    const suffixes = {
        spanish: ['Ultra', 'Fanatico', 'Socios', 'CF'],
        french: ['Ultra', 'Supporter', 'PSG', 'OL'],
        german: ['Fan', 'Tifosi', 'Ultras', 'BVB'],
        default: ['4Life', 'Army', 'FC', '1910']
    }[lang] || ['FC', 'Supporter', 'Fan', 'Official'];

    return `${teamSlug}${suffixes[Math.floor(Math.random() * suffixes.length)]}${Math.floor(Math.random() * 50)}`;
}

// ...existing code...