/**
 * Hockey Soccer Game
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
const state = {
    width: 0,
    height: 0,
    scale: 1,
    score: { red: 0, blue: 0 },
    maxScore: 3,
    gameOver: false,
    turn: 'red', // 'red' or 'blue'
    isBallMoving: false,
    formations: {
        red: '4-4-2',
        blue: '4-4-2'
    },
    particles: []
};

// Input State
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let dragCurrent = { x: 0, y: 0 };

// Physics Constants
const FRICTION = 0.994; // Extremely low friction (ice)
const WALL_BOUNCE = 0.8;
const PLAYER_RADIUS_M = 1.5;
const BALL_RADIUS_M = 0.8;
const MAX_POWER = 120; // Massive power increase
const DRAG_SENSITIVITY = 1.5; // High sensitivity: short drag = big power
const STOP_THRESHOLD = 1.5; // Increased to ensure ball stops and turn switches

// Field Dimensions (Standard Football Pitch ~105m x 68m)
const PITCH_WIDTH = 105;
const PITCH_HEIGHT = 68;
const GOAL_WIDTH = 10;

// Entities
let ball = {
    x: 0, y: 0,
    mx: 0, my: 0, // Position in meters
    vx: 0, vy: 0,
    radius: 0
};

let players = [];

// Formations Data (Relative positions 0.0-1.0)
const FORMATIONS = {
    '4-4-2': [
        { x: 0.05, y: 0.5 },
        { x: 0.2, y: 0.2 }, { x: 0.2, y: 0.4 }, { x: 0.2, y: 0.6 }, { x: 0.2, y: 0.8 },
        { x: 0.45, y: 0.15 }, { x: 0.45, y: 0.38 }, { x: 0.45, y: 0.62 }, { x: 0.45, y: 0.85 },
        { x: 0.7, y: 0.35 }, { x: 0.7, y: 0.65 }
    ],
    '4-3-3': [
        { x: 0.05, y: 0.5 },
        { x: 0.2, y: 0.2 }, { x: 0.2, y: 0.4 }, { x: 0.2, y: 0.6 }, { x: 0.2, y: 0.8 },
        { x: 0.45, y: 0.3 }, { x: 0.45, y: 0.5 }, { x: 0.45, y: 0.7 },
        { x: 0.7, y: 0.2 }, { x: 0.7, y: 0.5 }, { x: 0.7, y: 0.8 }
    ],
    '4-2-3-1': [
        { x: 0.05, y: 0.5 },
        { x: 0.2, y: 0.2 }, { x: 0.2, y: 0.4 }, { x: 0.2, y: 0.6 }, { x: 0.2, y: 0.8 },
        { x: 0.35, y: 0.35 }, { x: 0.35, y: 0.65 },
        { x: 0.55, y: 0.2 }, { x: 0.55, y: 0.5 }, { x: 0.55, y: 0.8 },
        { x: 0.75, y: 0.5 }
    ],
    '3-3-4': [
        { x: 0.05, y: 0.5 },
        { x: 0.2, y: 0.3 }, { x: 0.2, y: 0.5 }, { x: 0.2, y: 0.7 },
        { x: 0.45, y: 0.2 }, { x: 0.45, y: 0.5 }, { x: 0.45, y: 0.8 },
        { x: 0.7, y: 0.2 }, { x: 0.7, y: 0.4 }, { x: 0.7, y: 0.6 }, { x: 0.7, y: 0.8 }
    ]
};

// Audio System
const SoundSystem = {
    ctx: null,
    init: function () {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },
    play: function (type) {
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const now = this.ctx.currentTime;

        if (type === 'shoot') {
            // "Puck Hit" - Softer, deeper sound
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'wall') {
            // "Wall Bounce" - Soft thud
            osc.type = 'sine';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.1);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'goal') {
            // "Goal Celebration" - Major Chord (Sine Waves)
            const createNote = (freq, delay) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.type = 'sine';
                osc.frequency.value = freq;

                const now = this.ctx.currentTime + delay;
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.2, now + 0.1); // Fade in
                gain.gain.exponentialRampToValueAtTime(0.01, now + 2.0); // Long fade out

                osc.start(now);
                osc.stop(now + 2.0);
            };

            // Play a C Major chord arpeggio + chord
            createNote(261.63, 0);   // C4
            createNote(329.63, 0.1); // E4
            createNote(392.00, 0.2); // G4
            createNote(523.25, 0.3); // C5 (High note)

            // Bass note
            createNote(130.81, 0);   // C3
        } else if (type === 'win') {
            // "Victory Melody"
            const notes = [440, 554, 659, 880]; // A Major
            notes.forEach((note, i) => {
                setTimeout(() => this.playTone(note, 'sine', 0.3), i * 200);
            });
        }
    },
    playTone: function (freq, type, duration) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = type;
        osc.frequency.value = freq;

        const now = this.ctx.currentTime;
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.start(now);
        osc.stop(now + duration);
    }
};

function init() {
    window.addEventListener('resize', resize);
    resize();

    // Setup UI listeners
    document.getElementById('formation-red').addEventListener('change', (e) => {
        state.formations.red = e.target.value;
        resetPositions();
    });
    document.getElementById('formation-blue').addEventListener('change', (e) => {
        state.formations.blue = e.target.value;
        resetPositions();
    });

    // Input Listeners
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        onMouseDown(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
        e.preventDefault();
        onMouseMove(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchend', onMouseUp);

    resetGame();
    requestAnimationFrame(loop);
}

function resize() {
    const margin = 40;
    const maxWidth = window.innerWidth - margin * 2;
    const maxHeight = window.innerHeight - margin * 2;

    const pitchRatio = PITCH_WIDTH / PITCH_HEIGHT;
    const windowRatio = maxWidth / maxHeight;

    if (windowRatio > pitchRatio) {
        state.height = maxHeight;
        state.width = maxHeight * pitchRatio;
    } else {
        state.width = maxWidth;
        state.height = maxWidth / pitchRatio;
    }

    canvas.width = state.width;
    canvas.height = state.height;

    state.scale = state.width / PITCH_WIDTH;

    resetPositions();
}

function resetPositions() {
    players = [];

    const addTeam = (teamColor, formationName, isLeft) => {
        const formation = FORMATIONS[formationName];
        if (!formation) return;

        formation.forEach(pos => {
            let x = isLeft ? pos.x * (PITCH_WIDTH / 2) : PITCH_WIDTH - (pos.x * (PITCH_WIDTH / 2));
            let y = pos.y * PITCH_HEIGHT;

            players.push({
                mx: x,
                my: y,
                team: teamColor,
                radius: PLAYER_RADIUS_M
            });
        });
    };

    addTeam('red', state.formations.red, true);
    addTeam('blue', state.formations.blue, false);
}

function resetGame() {
    ball.mx = PITCH_WIDTH / 2;
    ball.my = PITCH_HEIGHT / 2;
    ball.vx = 0;
    ball.vy = 0;
    ball.radius = BALL_RADIUS_M;
    state.turn = 'red'; // Reset turn
    state.isBallMoving = false;
    updateScoreboard();
    resetPositions();
}

function onMouseDown(e) {
    SoundSystem.init(); // Initialize audio on first interaction
    if (state.isBallMoving) return; // Cannot shoot while ball is moving

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / state.scale;
    const y = (e.clientY - rect.top) / state.scale;

    // Check if clicking near ball
    const dx = x - ball.mx;
    const dy = y - ball.my;
    // Increased hit area significantly for easier control
    if (Math.sqrt(dx * dx + dy * dy) < ball.radius * 5) {
        isDragging = true;
        dragStart = { x: ball.mx, y: ball.my };
        dragCurrent = { x: x, y: y };
    }
}

function onMouseMove(e) {
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    dragCurrent.x = (e.clientX - rect.left) / state.scale;
    dragCurrent.y = (e.clientY - rect.top) / state.scale;
}

function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;

    let vx = (dragStart.x - dragCurrent.x) * DRAG_SENSITIVITY;
    let vy = (dragStart.y - dragCurrent.y) * DRAG_SENSITIVITY;

    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > MAX_POWER) {
        const ratio = MAX_POWER / speed;
        vx *= ratio;
        vy *= ratio;
    }

    ball.vx = vx;
    ball.vy = vy;

    if (speed > 0.5) {
        state.isBallMoving = true;
        SoundSystem.play('shoot'); // Play shoot sound
    }
}

function update() {
    if (state.gameOver) return;

    // Apply Velocity
    ball.mx += ball.vx * (1 / 60);
    ball.my += ball.vy * (1 / 60);

    // Friction
    ball.vx *= FRICTION;
    ball.vy *= FRICTION;

    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

    // Turn Logic: Check if ball stopped
    if (state.isBallMoving) {
        if (speed < STOP_THRESHOLD || isNaN(speed)) {
            ball.vx = 0;
            ball.vy = 0;
            state.isBallMoving = false;
            // Switch turn
            state.turn = state.turn === 'red' ? 'blue' : 'red';
            updateScoreboard();
        }
    }

    // Dynamic Scoreboard Opacity
    const scoreboard = document.getElementById('scoreboard');
    if (scoreboard) {
        // Check if ball is near the top center (where scoreboard usually is)
        // Scoreboard is roughly top 10% of screen, center width
        // In game coordinates: PITCH_WIDTH/2, top 0-15 meters
        if (ball.my < 15 && Math.abs(ball.mx - PITCH_WIDTH / 2) < 20) {
            scoreboard.style.opacity = '0.2';
        } else {
            scoreboard.style.opacity = '1';
        }
    }

    // Wall Collisions
    if (ball.mx < 0) {
        if (ball.my > (PITCH_HEIGHT - GOAL_WIDTH) / 2 && ball.my < (PITCH_HEIGHT + GOAL_WIDTH) / 2) {
            scoreGoal('blue');
        } else {
            ball.mx = 0;
            ball.vx = -ball.vx * WALL_BOUNCE;
            SoundSystem.play('wall'); // Wall hit sound
        }
    } else if (ball.mx > PITCH_WIDTH) {
        if (ball.my > (PITCH_HEIGHT - GOAL_WIDTH) / 2 && ball.my < (PITCH_HEIGHT + GOAL_WIDTH) / 2) {
            scoreGoal('red');
        } else {
            ball.mx = PITCH_WIDTH;
            ball.vx = -ball.vx * WALL_BOUNCE;
            SoundSystem.play('wall'); // Wall hit sound
        }
    }

    if (ball.my < 0) {
        ball.my = 0;
        ball.vy = -ball.vy * WALL_BOUNCE;
        SoundSystem.play('wall'); // Wall hit sound
    } else if (ball.my > PITCH_HEIGHT) {
        ball.my = PITCH_HEIGHT;
        ball.vy = -ball.vy * WALL_BOUNCE;
        SoundSystem.play('wall'); // Wall hit sound
    }

    // Player Collisions
    players.forEach(p => {
        const dx = ball.mx - p.mx;
        const dy = ball.my - p.my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = ball.radius + p.radius;

        if (dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;

            const overlap = minDist - dist;
            ball.mx += nx * overlap;
            ball.my += ny * overlap;

            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx = ball.vx - 2 * dot * nx;
            ball.vy = ball.vy - 2 * dot * ny;

            ball.vx *= 0.8;
            ball.vy *= 0.8;
            SoundSystem.play('wall'); // Player hit sound (same as wall for now)
        }
    });
}

function scoreGoal(team) {
    SoundSystem.play('goal'); // Goal sound
    if (team === 'red') state.score.red++;
    else state.score.blue++;

    updateScoreboard();
    showGoalMessage(team);

    if (state.score.red >= state.maxScore || state.score.blue >= state.maxScore) {
        endGame(team);
    } else {
        // Reset ball to center but keep game going
        ball.vx = 0;
        ball.vy = 0;
        ball.mx = PITCH_WIDTH / 2;
        ball.my = PITCH_HEIGHT / 2;
        state.isBallMoving = false;
        // Goal scorer keeps turn? Or switch? Usually switch in kickoff.
        // Let's give turn to the one who conceded (standard football)
        state.turn = team === 'red' ? 'blue' : 'red';
        updateScoreboard();
    }
}

function updateScoreboard() {
    const scoreRed = document.getElementById('score-red');
    const scoreBlue = document.getElementById('score-blue');

    scoreRed.textContent = state.score.red;
    scoreBlue.textContent = state.score.blue;

    // Update active turn classes
    const redContainer = scoreRed.parentElement;
    const blueContainer = scoreBlue.parentElement;

    if (state.turn === 'red') {
        redContainer.classList.add('active-turn');
        blueContainer.classList.remove('active-turn');
    } else {
        blueContainer.classList.add('active-turn');
        redContainer.classList.remove('active-turn');
    }
}

function showGoalMessage(team) {
    const msg = document.getElementById('message-overlay');
    const msgText = document.getElementById('message-text');
    msgText.textContent = "GOL !";

    const color = team === 'red' ? '#ff1744' : '#2979ff';
    msgText.style.color = color;
    msgText.style.textShadow = `0 0 40px ${color}`;

    msg.classList.remove('hidden');
    msg.classList.add('show');
    setTimeout(() => {
        msg.classList.remove('show');
        setTimeout(() => msg.classList.add('hidden'), 300);
    }, 1500);
}

function endGame(winner) {
    SoundSystem.play('win'); // Win sound
    state.gameOver = true;
    const msgText = document.getElementById('message-text');
    msgText.textContent = `${winner === 'red' ? 'KIRMIZI' : 'MAVİ'} KAZANDI!`;
    msgText.style.color = winner === 'red' ? '#ff1744' : '#2979ff';
    msgText.style.textShadow = `0 0 40px ${winner === 'red' ? '#ff1744' : '#2979ff'}`;

    const msg = document.getElementById('message-overlay');
    msg.classList.remove('hidden');
    msg.classList.add('show');

    startConfetti(winner);
}

function startConfetti(winner) {
    const color = winner === 'red' ? '#ff1744' : '#2979ff';
    state.particles = [];
    // More particles, longer life
    for (let i = 0; i < 400; i++) {
        state.particles.push({
            x: Math.random() * PITCH_WIDTH,
            y: Math.random() * PITCH_HEIGHT,
            vx: (Math.random() - 0.5) * 30, // Faster explosion
            vy: (Math.random() - 0.5) * 30,
            life: 2.0 + Math.random() * 2.0, // Longer life (2-4 seconds)
            color: Math.random() > 0.3 ? color : '#ffffff'
        });
    }
}

function draw() {
    // Clear with Ice Background
    ctx.fillStyle = '#e0f7fa'; // Light Ice Blue
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Ice Reflections/Scratches (Subtle)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    // ... could add random scratches here, but simple gradient/rects is fine

    // Draw Field Lines (Neon)
    ctx.strokeStyle = '#00e5ff'; // Cyan Neon
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00e5ff';

    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // Center Line
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    // Center Circle
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 9.15 * state.scale, 0, Math.PI * 2);
    ctx.stroke();

    // Reset Shadow for other elements
    ctx.shadowBlur = 0;

    // Goals (Visuals)
    const goalY = (PITCH_HEIGHT - GOAL_WIDTH) / 2 * state.scale;
    const goalH = GOAL_WIDTH * state.scale;
    const goalDepth = 2 * state.scale;

    // Left Goal
    ctx.fillStyle = 'rgba(255, 23, 68, 0.2)'; // Red tint
    ctx.fillRect(0, goalY, -goalDepth, goalH);
    ctx.strokeStyle = '#ff1744';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, goalY, -goalDepth, goalH);

    // Right Goal
    ctx.fillStyle = 'rgba(41, 121, 255, 0.2)'; // Blue tint
    ctx.fillRect(canvas.width, goalY, goalDepth, goalH);
    ctx.strokeStyle = '#2979ff';
    ctx.strokeRect(canvas.width, goalY, goalDepth, goalH);

    // Draw Players (Neon Rings)
    players.forEach(p => {
        const color = p.team === 'red' ? '#ff1744' : '#2979ff';

        ctx.beginPath();
        ctx.arc(p.mx * state.scale, p.my * state.scale, p.radius * state.scale, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a'; // Dark center
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner glow
        ctx.beginPath();
        ctx.arc(p.mx * state.scale, p.my * state.scale, p.radius * 0.6 * state.scale, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    // Draw Ball (Glowing Puck/Ball)
    ctx.beginPath();
    ctx.arc(ball.mx * state.scale, ball.my * state.scale, ball.radius * state.scale, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a'; // Dark Puck Color
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Inner detail for puck look
    ctx.beginPath();
    ctx.arc(ball.mx * state.scale, ball.my * state.scale, ball.radius * 0.6 * state.scale, 0, Math.PI * 2);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Draw Drag Line (Turn Color)
    if (isDragging) {
        const turnColor = state.turn === 'red' ? '#ff1744' : '#2979ff';
        ctx.beginPath();
        ctx.moveTo(ball.mx * state.scale, ball.my * state.scale);
        ctx.lineTo(dragCurrent.x * state.scale, dragCurrent.y * state.scale);
        ctx.strokeStyle = turnColor;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 10;
        ctx.shadowColor = turnColor;
        ctx.setLineDash([15, 10]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
    }

    // Draw Particles
    if (state.particles) {
        state.particles.forEach((p, i) => {
            p.x += p.vx * (1 / 60);
            p.y += p.vy * (1 / 60);
            p.vy += 9.8 * (1 / 60);
            p.life -= 0.01;

            if (p.life > 0) {
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.life;
                ctx.fillRect(p.x * state.scale, p.y * state.scale, 0.4 * state.scale, 0.4 * state.scale);
                ctx.globalAlpha = 1.0;
            } else {
                state.particles.splice(i, 1);
            }
        });
    }
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

init();
