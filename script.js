// --- State Management ---
const state = {
    queue: [],
    activeAgents: [],
    completed: [],
    isRunning: true,
    duration: 2000,
    idCounter: 1,
    priorityMode: 'reader' // 'reader' or 'writer'
};

// --- DOM Elements ---
const els = {
    queue: document.getElementById('waitingQueue'),
    emptyState: document.getElementById('queueEmptyState'),
    queueCount: document.getElementById('queueCountBadge'),
    cs: document.getElementById('criticalSection'),
    csStatus: document.getElementById('csStatusBadge'),
    readersCount: document.getElementById('activeReaders'),
    writersCount: document.getElementById('activeWriters'),
    completedList: document.getElementById('completedList'),
    durationSlider: document.getElementById('durationSlider'),
    pauseBtn: document.getElementById('pauseBtn'),
    pauseIcon: document.getElementById('pauseIcon')
};

// --- Logic ---

class Agent {
    constructor(type) {
        this.id = state.idCounter++;
        this.type = type; // 'reader' | 'writer'
    }
}

function createOrbitalEntity(agent, index, total) {
    const orb = document.createElement('div');
    orb.className = `active-entity ${agent.type}`;
    orb.id = `orb-${agent.id}`;
    orb.textContent = agent.type === 'reader' ? 'R' : 'W';
    
    // Calculate position on orbit
    const angle = (index / total) * 2 * Math.PI;
    const radius = 200; // Distance from center
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    
    orb.style.left = `calc(50% + ${x}px)`;
    orb.style.top = `calc(50% + ${y}px)`;
    orb.style.transform = 'translate(-50%, -50%)';
    
    return orb;
}

function renderActiveEntities() {
    const activeContainer = document.getElementById('activeContainer');
    const resourceCore = document.getElementById('resourceCore');
    activeContainer.innerHTML = '';
    
    const allActive = state.activeAgents;
    allActive.forEach((agent, index) => {
        const orb = createOrbitalEntity(agent, index, allActive.length);
        activeContainer.appendChild(orb);
    });
    
    updateStatusDisplay();
}

function updateStatusDisplay() {
    const readers = state.activeAgents.filter(a => a.type === 'reader');
    const writers = state.activeAgents.filter(a => a.type === 'writer');
    const resourceCore = document.getElementById('resourceCore');
    const statusIndicator = document.getElementById('csStatusBadge');
    
    els.readersCount.textContent = readers.length;
    els.writersCount.textContent = writers.length;
    
    // Update status indicator
    if (writers.length > 0) {
        statusIndicator.textContent = 'Status: Writing';
        statusIndicator.className = 'status-indicator writing';
        resourceCore.className = 'resource-core writing';
    } else if (readers.length > 0) {
        statusIndicator.textContent = `Status: Reading (${readers.length})`;
        statusIndicator.className = 'status-indicator';
        resourceCore.className = 'resource-core reading';
    } else {
        statusIndicator.textContent = 'Status: Idle';
        statusIndicator.className = 'status-indicator idle';
        resourceCore.className = 'resource-core';
    }
}

function createAgentElement(agent, location) {
    // Location: 'queue' or 'cs'
    const div = document.createElement('div');
    div.className = `agent-card agent-${agent.type}`;
    div.id = `agent-${agent.id}`;
    
    const iconLabel = agent.type === 'reader' ? 'R' : 'W';
    const textLabel = agent.type === 'reader' ? `Reader #${agent.id}` : `Writer #${agent.id}`;
    const subLabel = location === 'queue' ? 'Waiting...' : (agent.type === 'reader' ? 'Reading...' : 'Writing...');

    div.innerHTML = `
        <div class="agent-icon">${iconLabel}${agent.id}</div>
        <div>
            <div class="agent-info">${textLabel}</div>
            <div class="agent-sub">${subLabel}</div>
        </div>
    `;
    return div;
}

function renderQueue() {
    els.queue.innerHTML = '';
    if (state.queue.length === 0) {
        els.queue.appendChild(els.emptyState);
        els.queueCount.textContent = '0';
        return;
    }
    
    els.queueCount.textContent = state.queue.length;
    
    state.queue.forEach(agent => {
        els.queue.appendChild(createAgentElement(agent, 'queue'));
    });
}

function addToCompleted(agent) {
    const li = document.createElement('li');
    li.className = 'completed-item';
    
    const name = agent.type === 'reader' ? `Reader #${agent.id}` : `Writer #${agent.id}`;
    
    li.innerHTML = `
        <div style="display:flex; align-items:center;">
            <svg class="check-circle" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            <span style="font-weight: 500; font-size: 0.9rem;">${name}</span>
        </div>
        <span class="done-text">Done</span>
    `;
    
    els.completedList.prepend(li);
}

function updateCSVisuals() {
    renderActiveEntities();
}

function checkScheduler() {
    if (!state.isRunning) return;
    if (state.queue.length === 0) return;

    const writerActive = state.activeAgents.some(a => a.type === 'writer');
    const readersActive = state.activeAgents.some(a => a.type === 'reader');

    if (state.priorityMode === 'reader') {
        // Reader Priority Mode
        const candidate = state.queue[0];
        let canEnter = false;

        if (candidate.type === 'writer') {
            // Writer needs EMPTY CS
            if (!writerActive && !readersActive) {
                canEnter = true;
            }
        } else {
            // Reader needs NO WRITER
            if (!writerActive) {
                canEnter = true;
            }
        }

        if (canEnter) {
            processEntry(candidate);
        }
    } else {
        // Writer Priority Mode
        // Check if any writers are waiting
        const hasWaitingWriter = state.queue.some(a => a.type === 'writer');
        const candidate = state.queue[0];
        let canEnter = false;

        if (candidate.type === 'writer') {
            // Writer needs EMPTY CS
            if (!writerActive && !readersActive) {
                canEnter = true;
            }
        } else {
            // Reader can only enter if NO WRITER is active and NO WRITER is waiting
            if (!writerActive && !hasWaitingWriter) {
                canEnter = true;
            }
        }

        if (canEnter) {
            processEntry(candidate);
        }
    }
}

function processEntry(candidate) {
    // Move from queue to active
    state.queue.shift();
    renderQueue();

    state.activeAgents.push(candidate);
    renderActiveEntities();

    // Schedule Exit
    setTimeout(() => {
        state.activeAgents = state.activeAgents.filter(a => a.id !== candidate.id);
        const orb = document.getElementById(`orb-${candidate.id}`);
        if (orb) orb.remove();
        renderActiveEntities();
        addToCompleted(candidate);
    }, state.duration);
}

// --- Event Listeners ---

document.getElementById('addReaderBtn').addEventListener('click', () => {
    state.queue.push(new Agent('reader'));
    renderQueue();
});

document.getElementById('addWriterBtn').addEventListener('click', () => {
    state.queue.push(new Agent('writer'));
    renderQueue();
});

// Mode selector event listeners
document.getElementById('readerModeBtn').addEventListener('click', function() {
    state.priorityMode = 'reader';
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    this.classList.add('active');
});

document.getElementById('writerModeBtn').addEventListener('click', function() {
    state.priorityMode = 'writer';
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    this.classList.add('active');
});

document.getElementById('resetBtn').addEventListener('click', () => {
    state.queue = [];
    state.activeAgents = [];
    els.completedList.innerHTML = '';
    const activeContainer = document.getElementById('activeContainer');
    activeContainer.innerHTML = '';
    renderQueue();
    updateStatusDisplay();
});

document.getElementById('clearCompletedBtn').addEventListener('click', () => {
    els.completedList.innerHTML = '';
});

els.durationSlider.addEventListener('input', (e) => {
    state.duration = parseInt(e.target.value);
});

els.pauseBtn.addEventListener('click', () => {
    state.isRunning = !state.isRunning;
    if(!state.isRunning) {
        els.pauseIcon.innerHTML = '<path d="M8 5v14l11-7z"/>'; // Play icon
        els.pauseBtn.style.color = 'var(--accent-green)';
    } else {
        els.pauseIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'; // Pause icon
        els.pauseBtn.style.color = 'var(--text-main)';
    }
});

// Run Loop
setInterval(checkScheduler, 500);

// Initialize
renderQueue();
updateStatusDisplay();
