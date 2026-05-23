// ============================================================
// Headless Dino Game Engine
// ============================================================

var CANVAS_W = 800;
var CANVAS_H = 300;

// Game Constants
const GRAVITY = -0.6;
const JUMP_VEL = 11;
const FAST_DROP = -10;
const DINO_X = 50;

const DINO_W = 44;
const DINO_H = 47;
const DINO_DUCK_W = 59;
const DINO_DUCK_H = 26;

const BASE_SPEED = 6;
const MAX_SPEED = 13;
const SPEED_INC = 0.001;

// Obstacle Types
const OBS_TYPES = [
    { name: 'small_cactus', w: 34, h: 35, y: 0 },
    { name: 'large_cactus', w: 50, h: 50, y: 0 },
    { name: 'low_bird', w: 46, h: 40, y: 20 },
    { name: 'high_bird', w: 46, h: 40, y: 55 }
];

class Dino {
    constructor(id) {
        this.id = id;
        this.reset();
    }

    reset() {
        this.y = 0;
        this.vel = 0;
        this.isDucking = false;
        this.alive = true;
        this.score = 0;
        this.prevState = null;
        this.prevAction = null;
    }

    jump() {
        if (this.y === 0) {
            this.vel = JUMP_VEL;
        }
        this.isDucking = false;
    }

    duck() {
        if (this.y > 0) {
            // Fast drop
            this.vel = FAST_DROP;
        }
        this.isDucking = true;
    }

    stand() {
        this.isDucking = false;
    }

    update() {
        if (this.y > 0 || this.vel > 0) {
            this.vel += GRAVITY;
            this.y += this.vel;
        }

        if (this.y <= 0) {
            this.y = 0;
            this.vel = 0;
        }
    }

    getHitbox() {
        if (this.isDucking) {
            return {
                x: DINO_X,
                y: this.y,
                w: DINO_DUCK_W,
                h: DINO_DUCK_H
            };
        } else {
            return {
                x: DINO_X,
                y: this.y,
                w: DINO_W,
                h: DINO_H
            };
        }
    }
}

class Obstacle {
    constructor(x, speed) {
        this.x = x;
        // Choose a random obstacle type, but favor cacti early on
        let maxIndex = speed < 8 ? 1 : 3; 
        this.typeId = Math.floor(Math.random() * (maxIndex + 1));
        this.type = OBS_TYPES[this.typeId];
        this.scored = [];
    }

    getHitbox() {
        return {
            x: this.x,
            y: this.type.y,
            w: this.type.w,
            h: this.type.h
        };
    }
}

class GameSim {
    constructor(numDinos) {
        this.dinos = [];
        for (let i = 0; i < numDinos; i++) {
            this.dinos.push(new Dino(i));
        }
        this.obstacles = [];
        this.frameCount = 0;
        this.speed = BASE_SPEED;
        this.spawnInitialObstacles();
    }

    setPopulation(n) {
        while (this.dinos.length < n) {
            let d = new Dino(this.dinos.length);
            d.alive = false; 
            this.dinos.push(d);
        }
        if (n < this.dinos.length) {
            this.dinos.length = n;
        }
    }

    spawnInitialObstacles() {
        this.obstacles = [];
        let curX = CANVAS_W;
        for (let i = 0; i < 3; i++) {
            curX += 400 + Math.random() * 300;
            this.obstacles.push(new Obstacle(curX, this.speed));
        }
    }

    resetAll() {
        for (let d of this.dinos) d.reset();
        this.speed = BASE_SPEED;
        this.frameCount = 0;
        this.spawnInitialObstacles();
    }

    getNextObstacle() {
        for (let obs of this.obstacles) {
            if (obs.x + obs.type.w > DINO_X) return obs;
        }
        return this.obstacles[0];
    }

    getDinoState(dino) {
        let obs = this.getNextObstacle();
        if (!obs) return { dx: 800, w: 0, type: 0, speed: this.speed, dinoY: dino.y };
        let dx = obs.x - DINO_X;
        return {
            dx: dx,
            w: obs.type.w,
            type: obs.typeId,
            speed: this.speed,
            dinoY: dino.y
        };
    }

    checkCollision(dino) {
        let dBox = dino.getHitbox();
        // Slightly shrink hitboxes for fairness
        let pad = 4;

        for (let obs of this.obstacles) {
            let oBox = obs.getHitbox();
            if (
                dBox.x + pad < oBox.x + oBox.w - pad &&
                dBox.x + dBox.w - pad > oBox.x + pad &&
                dBox.y + pad < oBox.y + oBox.h - pad &&
                dBox.y + dBox.h - pad > oBox.y + pad
            ) {
                return true;
            }
        }
        return false;
    }

    // actions: array of 0 (stand), 1 (jump), 2 (duck)
    tick(actions) {
        this.frameCount++;
        if (this.speed < MAX_SPEED) {
            this.speed += SPEED_INC;
        }

        for (let obs of this.obstacles) {
            obs.x -= this.speed;
        }

        if (this.obstacles.length > 0 && this.obstacles[0].x + this.obstacles[0].type.w < 0) {
            this.obstacles.shift();
            let lastObs = this.obstacles[this.obstacles.length - 1];
            let nextDist = 300 + Math.random() * 400 * (this.speed / BASE_SPEED);
            this.obstacles.push(new Obstacle(lastObs.x + nextDist, this.speed));
        }

        let aliveCount = 0;
        for (let i = 0; i < this.dinos.length; i++) {
            let dino = this.dinos[i];
            if (!dino.alive) continue;

            let act = actions[i];
            if (act === 1) dino.jump();
            else if (act === 2) dino.duck();
            else dino.stand();

            dino.update();

            if (this.checkCollision(dino)) {
                dino.alive = false;
                continue;
            }

            dino.score += 0.1; // Passive score for staying alive
            
            // Obstacle pass score
            for (let obs of this.obstacles) {
                if (obs.x + obs.type.w < DINO_X && !obs.scored.includes(dino.id)) {
                    obs.scored.push(dino.id);
                    dino.score += 10;
                }
            }

            aliveCount++;
        }

        return aliveCount;
    }

    get anyAlive() {
        return this.dinos.some(d => d.alive);
    }
}
