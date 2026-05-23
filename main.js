// ============================================================
// Main Orchestrator — Rendering + Training Loop
// ============================================================

(function () {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const chartCanvas = document.getElementById('chartCanvas');
    const chartCtx = chartCanvas.getContext('2d');

    // Make canvas responsive but keep game aspect ratio
    let gameScale = 1;
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // Keep a reasonable scale so it's not too zoomed in
        gameScale = Math.min(2.0, canvas.height / 300);
        if (gameScale < 1) gameScale = 1;
        CANVAS_W = Math.ceil(canvas.width / gameScale);
        CANVAS_H = Math.ceil(canvas.height / gameScale);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Panel dragging
    const panel = document.getElementById('panel');
    const panelHeader = document.getElementById('panelHeader');
    let isDragging = false;
    let dragOffX = 0, dragOffY = 0;

    panelHeader.addEventListener('mousedown', (e) => {
        if (e.target.closest('.panel-btn')) return;
        isDragging = true;
        let rect = panel.getBoundingClientRect();
        dragOffX = e.clientX - rect.left;
        dragOffY = e.clientY - rect.top;
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let x = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, e.clientX - dragOffX));
        let y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragOffY));
        panel.style.left = x + 'px';
        panel.style.top = y + 'px';
        panel.style.right = 'auto';
    });
    window.addEventListener('mouseup', () => { isDragging = false; });

    // Minimize UI
    const minimizeBtn = document.getElementById('minimizeBtn');
    const panelBody = document.getElementById('panelBody');
    let panelMinimized = false;
    minimizeBtn.addEventListener('click', () => {
        panelMinimized = !panelMinimized;
        panelBody.classList.toggle('collapsed', panelMinimized);
        panel.classList.toggle('minimized', panelMinimized);
        minimizeBtn.textContent = panelMinimized ? '+' : '\u2014';
    });

    // UI Elements
    const genCountEl = document.getElementById('genCount');
    const bestScoreEl = document.getElementById('bestScore');
    const alphaScoreEl = document.getElementById('alphaScore');
    const aliveCountEl = document.getElementById('aliveCount');
    const epsilonValEl = document.getElementById('epsilonVal');
    const qStatesEl = document.getElementById('qStates');
    const showGhostsEl = document.getElementById('showGhosts');

    let speed = 1;
    let population = 50;
    let scoreHistory = [];

    const agent = new GeneticAgent(population);
    let sim = new GameSim(population);

    // Sprites
    const spriteSheet = new Image();
    spriteSheet.crossOrigin = 'anonymous';
    // Using standard open-source sprite sheet from chromium t-rex runner
    spriteSheet.src = 'https://raw.githubusercontent.com/wayou/t-rex-runner/gh-pages/assets/default_100_percent/100-offline-sprite.png';

    const spriteMap = {
        dinoStand: { x: 848, y: 2, w: 44, h: 47 },
        dinoRun1: { x: 936, y: 2, w: 44, h: 47 },
        dinoRun2: { x: 980, y: 2, w: 44, h: 47 },
        dinoDuck1: { x: 1112, y: 2, w: 59, h: 47 },
        dinoDuck2: { x: 1171, y: 2, w: 59, h: 47 },
        cactusSmall: { x: 228, y: 2, w: 34, h: 35 },
        cactusLarge: { x: 332, y: 2, w: 50, h: 50 },
        bird1: { x: 134, y: 2, w: 46, h: 40 },
        bird2: { x: 180, y: 2, w: 46, h: 40 },
        ground: { x: 2, y: 54, w: 1200, h: 12 }
    };

    // UI Buttons binding
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            speed = parseInt(btn.dataset.speed);
        });
    });

    document.querySelectorAll('.pop-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pop-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            population = parseInt(btn.dataset.pop);
            agent.setPopulation(population);
            sim.setPopulation(population);
        });
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
        agent.reset();
        scoreHistory = [];
        sim = new GameSim(population);
        updateUI();
    });

    const saveBtn = document.getElementById('saveBtn');
    saveBtn.addEventListener('click', () => {
        agent.save();
        let oldText = saveBtn.textContent;
        saveBtn.textContent = 'Saved!';
        setTimeout(() => saveBtn.textContent = oldText, 1000);
    });

    // Streamer Mode
    const streamerBtn = document.getElementById('streamerBtn');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = 'Press ESC to exit Streamer Mode';
    document.body.appendChild(toast);

    streamerBtn.addEventListener('click', () => {
        document.body.classList.add('streamer-mode');
        population = 1;
        agent.setPopulation(population);
        sim.setPopulation(population);
        speed = 1;
        
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.speed-btn[data-speed="1"]').classList.add('active');
        document.querySelectorAll('.pop-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.pop-btn[data-pop="1"]').classList.add('active');
        
        agent.epsilon = 0.0;
        
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('streamer-mode')) {
            document.body.classList.remove('streamer-mode');
            population = 50;
            agent.setPopulation(population);
            sim.setPopulation(population);
            document.querySelectorAll('.pop-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.pop-btn[data-pop="50"]').classList.add('active');
        }
    });

    // Training step
    function trainStep() {
        let actions = [];
        for (let i = 0; i < sim.dinos.length; i++) {
            let dino = sim.dinos[i];
            if (!dino.alive) {
                actions.push(0);
                continue;
            }

            let s = sim.getDinoState(dino);
            let inputs = [ 
                s.dx / 800, 
                s.w / 60, 
                s.type / 3, 
                (s.speed - 6) / 10, 
                s.dinoY > 0 ? 1 : 0 
            ];
            
            let action = agent.brains[i].predict(inputs);
            actions.push(action);
        }

        let aliveCount = sim.tick(actions);

        return aliveCount;
    }

    function endGeneration() {
        let fitnesses = [];
        let genBest = 0;
        for (let i = 0; i < sim.dinos.length; i++) {
            let d = sim.dinos[i];
            if (d.score > genBest) genBest = d.score;
            fitnesses.push({ score: d.score, brainIndex: i });
        }

        scoreHistory.push(genBest);
        if (scoreHistory.length > 50) scoreHistory.shift();

        agent.evolve(fitnesses);
        if (agent.gamesPlayed % 10 === 0) agent.save();

        sim.resetAll();
        agent.setPopulation(population);
        sim.setPopulation(population);
    }

    // Rendering
    let groundX = 0;

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.save();
        ctx.scale(gameScale, gameScale);
        
        // Ground Y is bottom. In canvas, y=0 is top.
        // So drawing Y = CANVAS_H - obj.y - obj.h
        const DRAW_Y = CANVAS_H - 40; // Ground line height

        // Draw Ground
        if (spriteSheet.complete) {
            groundX -= sim.speed;
            if (groundX <= -1200) groundX += 1200;
            ctx.drawImage(spriteSheet, spriteMap.ground.x, spriteMap.ground.y, spriteMap.ground.w, spriteMap.ground.h, groundX, DRAW_Y - spriteMap.ground.h + 2, spriteMap.ground.w, spriteMap.ground.h);
            ctx.drawImage(spriteSheet, spriteMap.ground.x, spriteMap.ground.y, spriteMap.ground.w, spriteMap.ground.h, groundX + 1200, DRAW_Y - spriteMap.ground.h + 2, spriteMap.ground.w, spriteMap.ground.h);
        } else {
            ctx.fillStyle = '#555';
            ctx.fillRect(0, DRAW_Y, CANVAS_W, 2);
        }

        // Draw Obstacles
        for (let obs of sim.obstacles) {
            let t = obs.type;
            let spr = null;
            if (obs.typeId === 0) spr = spriteMap.cactusSmall;
            else if (obs.typeId === 1) spr = spriteMap.cactusLarge;
            else if (obs.typeId === 2 || obs.typeId === 3) {
                let frame = Math.floor(sim.frameCount / 15) % 2;
                spr = frame === 0 ? spriteMap.bird1 : spriteMap.bird2;
            }

            let yPos = DRAW_Y - t.y - t.h;
            
            if (spriteSheet.complete && spr) {
                ctx.drawImage(spriteSheet, spr.x, spr.y, spr.w, spr.h, obs.x, yPos, spr.w, spr.h);
            } else {
                ctx.fillStyle = obs.typeId >= 2 ? '#ff6b6b' : '#73bf2e';
                ctx.fillRect(obs.x, yPos, t.w, t.h);
            }
        }

        let alphaDino = null;
        let bestAliveScore = -1;
        for (let d of sim.dinos) {
            if (d.alive && d.score > bestAliveScore) {
                bestAliveScore = d.score;
                alphaDino = d;
            }
        }

        if (showGhostsEl.checked) {
            for (let d of sim.dinos) {
                if (!d.alive || d === alphaDino) continue;
                drawDino(d, 0.2);
            }
        }

        if (alphaDino) {
            drawDino(alphaDino, 1.0);
        }

        // Score display
        let currentBest = Math.floor(Math.max(...sim.dinos.map(d => d.score), 0));
        ctx.fillStyle = document.body.classList.contains('streamer-mode') ? '#555' : '#fff';
        ctx.font = '900 24px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(currentBest.toString().padStart(5, '0'), CANVAS_W - 20, 40);

        ctx.restore();
    }

    function drawDino(dino, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        
        let yPos = CANVAS_H - 40 - dino.y; // base drawing Y

        if (spriteSheet.complete) {
            let spr = spriteMap.dinoStand;
            if (dino.isDucking) {
                let frame = Math.floor(sim.frameCount / 8) % 2;
                spr = frame === 0 ? spriteMap.dinoDuck1 : spriteMap.dinoDuck2;
                yPos -= spr.h; 
            } else if (dino.y > 0) {
                spr = spriteMap.dinoStand;
                yPos -= spr.h;
            } else {
                let frame = Math.floor(sim.frameCount / 8) % 2;
                spr = frame === 0 ? spriteMap.dinoRun1 : spriteMap.dinoRun2;
                yPos -= spr.h;
            }
            ctx.drawImage(spriteSheet, spr.x, spr.y, spr.w, spr.h, DINO_X, yPos, spr.w, spr.h);
        } else {
            ctx.fillStyle = '#4ecdc4';
            if (dino.isDucking) {
                ctx.fillRect(DINO_X, yPos - DINO_DUCK_H, DINO_DUCK_W, DINO_DUCK_H);
            } else {
                ctx.fillRect(DINO_X, yPos - DINO_H, DINO_W, DINO_H);
            }
        }
        
        ctx.restore();
    }

    // Chart
    function drawChart() {
        let w = chartCanvas.width, h = chartCanvas.height;
        chartCtx.clearRect(0, 0, w, h);
        if (scoreHistory.length < 2) return;

        let maxVal = Math.max(...scoreHistory, 1);
        chartCtx.strokeStyle = '#4ecdc4';
        chartCtx.lineWidth = 2;
        chartCtx.beginPath();
        for (let i = 0; i < scoreHistory.length; i++) {
            let x = (i / (scoreHistory.length - 1)) * w;
            let y = h - (scoreHistory[i] / maxVal) * (h - 10) - 5;
            if (i === 0) chartCtx.moveTo(x, y);
            else chartCtx.lineTo(x, y);
        }
        chartCtx.stroke();
        chartCtx.lineTo(w, h);
        chartCtx.lineTo(0, h);
        chartCtx.fillStyle = 'rgba(78, 205, 196, 0.1)';
        chartCtx.fill();
    }

    function updateUI() {
        genCountEl.textContent = agent.gamesPlayed;
        bestScoreEl.textContent = Math.floor(agent.bestScore);
        epsilonValEl.textContent = (agent.epsilon * 100).toFixed(1) + '%';
        qStatesEl.textContent = agent.stateCount;

        let alive = sim.dinos.filter(d => d.alive).length;
        aliveCountEl.textContent = alive + '/' + sim.dinos.length;

        let currentBest = Math.floor(Math.max(...sim.dinos.filter(d=>d.alive).map(d=>d.score), 0));
        alphaScoreEl.textContent = currentBest;

        drawChart();
    }

    // Main loop
    function mainLoop() {
        if (speed === 0) {
            let startTime = performance.now();
            while (performance.now() - startTime < 30) {
                let alive = trainStep();
                if (alive === 0) endGeneration();
            }
            render();
            updateUI();
        } else if (speed > 1) {
            for (let i = 0; i < speed; i++) {
                let alive = trainStep();
                if (alive === 0) endGeneration();
            }
            render();
            updateUI();
        } else {
            let alive = trainStep();
            if (alive === 0) endGeneration();
            render();
            updateUI();
        }

        requestAnimationFrame(mainLoop);
    }

    // Start
    setTimeout(() => {
        updateUI();
        requestAnimationFrame(mainLoop);
    }, 500);

})();
