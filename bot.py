"""
Advanced Chrome Dino Bot — NEAT Machine Learning
Uses Chrome's built-in chrome://dino (no ads, no anti-cheat, no freezing).
Trains a population of neural networks to learn the game through evolution.
"""

import neat
import os
import sys
import time
import pickle
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options


# ─── Constants ───────────────────────────────────────────────────────────────
WINDOW_WIDTH = 900
WINDOW_HEIGHT = 650
GAME_URL = "https://wayou.github.io/t-rex-runner/"
BEST_GENOME_FILE = "best_genome.pkl"
MAX_GENERATIONS = 50

# ─── JavaScript Snippets ─────────────────────────────────────────────────────

# Checks if the Runner singleton exists and returns its API shape.
# chromedino.com uses `runner.obstacles`, but the real chrome://dino uses
# `runner.horizon.obstacles`. We auto-detect on first call.
JS_DETECT_API = """
if (!window.Runner || !window.Runner.instance_) return null;
var r = window.Runner.instance_;
if (r.horizon && r.horizon.obstacles) return "horizon";
if (r.obstacles) return "direct";
return "unknown";
"""

# Build state-extraction JS dynamically based on detected API path.
def build_state_js(api_style):
    if api_style == "horizon":
        obs_path = "r.horizon.obstacles"
    else:
        obs_path = "r.obstacles"

    return f"""
    if (!window.Runner || !window.Runner.instance_) return null;
    var r = window.Runner.instance_;
    if (r.crashed) return {{crashed: true, score: r.distanceRan || 0}};
    if (!r.playing) return {{playing: false}};

    var obstacles = {obs_path};
    if (!obstacles || obstacles.length === 0)
        return {{playing: true, obstacles: 0, speed: r.currentSpeed, score: r.distanceRan || 0}};

    var tRex = r.tRex;
    var trexX = tRex.xPos;
    var next = null;
    for (var i = 0; i < obstacles.length; i++) {{
        if (obstacles[i].xPos + obstacles[i].width > trexX) {{
            next = obstacles[i];
            break;
        }}
    }}
    if (!next)
        return {{playing: true, obstacles: 0, speed: r.currentSpeed, score: r.distanceRan || 0}};

    var isPtero = false;
    try {{ isPtero = next.typeConfig && next.typeConfig.type === 'PTERODACTYL'; }} catch(e) {{}}

    return {{
        crashed: false,
        playing: true,
        speed: r.currentSpeed,
        distance: next.xPos - trexX,
        width: next.width,
        yPos: next.yPos,
        isPtero: isPtero,
        jumping: tRex.jumping,
        ducking: tRex.ducking,
        score: r.distanceRan || 0
    }};
    """

# Action JS — Uses native KeyboardEvents to trigger the game listeners without needing OS focus.
JS_JUMP = """
function triggerKey(code, type) {
    document.dispatchEvent(new KeyboardEvent(type, {keyCode: code, which: code, bubbles: true}));
}
if (window.Runner && window.Runner.instance_) {
    var r = window.Runner.instance_;
    if (r.tRex.ducking) {
        triggerKey(40, 'keyup');
    }
    if (!r.tRex.jumping) {
        triggerKey(38, 'keydown');
        setTimeout(() => triggerKey(38, 'keyup'), 150);
    }
}
"""

JS_DUCK = """
function triggerKey(code, type) {
    document.dispatchEvent(new KeyboardEvent(type, {keyCode: code, which: code, bubbles: true}));
}
if (window.Runner && window.Runner.instance_) {
    var r = window.Runner.instance_;
    if (!r.tRex.ducking) {
        triggerKey(40, 'keydown');
    }
}
"""

JS_STAND = """
function triggerKey(code, type) {
    document.dispatchEvent(new KeyboardEvent(type, {keyCode: code, which: code, bubbles: true}));
}
if (window.Runner && window.Runner.instance_) {
    var r = window.Runner.instance_;
    if (r.tRex.ducking) {
        triggerKey(40, 'keyup');
    }
}
"""

JS_RESTART = """
if (window.Runner && window.Runner.instance_) {
    window.Runner.instance_.restart();
}
"""

JS_START = """
function triggerKey(code, type) {
    document.dispatchEvent(new KeyboardEvent(type, {keyCode: code, which: code, bubbles: true}));
}
if (window.Runner && window.Runner.instance_) {
    triggerKey(32, 'keydown');
    setTimeout(() => triggerKey(32, 'keyup'), 100);
}
"""


# ─── Browser Management ──────────────────────────────────────────────────────

class DinoGame:
    """Manages the Selenium browser and exposes a clean game API."""

    def __init__(self):
        self.driver = None
        self.api_style = None
        self.state_js = None

    def start(self):
        print(f"[INIT] Launching Chrome ({WINDOW_WIDTH}x{WINDOW_HEIGHT})...")
        opts = Options()
        opts.add_argument(f"--window-size={WINDOW_WIDTH},{WINDOW_HEIGHT}")
        opts.add_argument("--disable-infobars")
        opts.add_argument("--mute-audio")
        opts.add_argument("--disable-popup-blocking")

        self.driver = svc_driver = webdriver.Chrome(options=opts)
        svc_driver.set_window_position(50, 50)

        # Navigate to the built-in dino game — zero ads, always available.
        # chrome://dino intentionally triggers ERR_INTERNET_DISCONNECTED;
        # Selenium raises an exception but the game still loads perfectly.
        try:
            svc_driver.get(GAME_URL)
        except Exception:
            pass  # Expected — the offline page IS the game
        print("[INIT] Loaded chrome://dino. Waiting for game to initialize...")
        time.sleep(2)

        # Auto-detect the JS API shape
        for _ in range(10):
            self.api_style = svc_driver.execute_script(JS_DETECT_API)
            if self.api_style and self.api_style != "unknown":
                break
            time.sleep(0.5)

        if not self.api_style or self.api_style == "unknown":
            # Default fallback
            self.api_style = "horizon"
            print("[WARN] Could not auto-detect API style; defaulting to 'horizon'.")
        else:
            print(f"[INIT] Detected obstacle API style: '{self.api_style}'")

        self.state_js = build_state_js(self.api_style)
        print("[INIT] Game environment ready.\n")

    def get_state(self):
        try:
            return self.driver.execute_script(self.state_js)
        except Exception as e:
            return {"crashed": True, "score": 0}

    def jump(self):
        try:
            self.driver.execute_script(JS_JUMP)
        except:
            pass

    def duck(self):
        try:
            self.driver.execute_script(JS_DUCK)
        except:
            pass

    def stand(self):
        try:
            self.driver.execute_script(JS_STAND)
        except:
            pass

    def restart(self):
        try:
            self.driver.execute_script(JS_RESTART)
        except:
            pass

    def press_start(self):
        try:
            self.driver.execute_script(JS_START)
        except:
            pass

    def close(self):
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass


# ─── NEAT Evaluation ─────────────────────────────────────────────────────────

game = DinoGame()


def eval_genomes(genomes, config):
    """Evaluate every genome in the current generation sequentially."""
    global game

    gen_best_fitness = 0
    gen_best_id = None

    for genome_id, genome in genomes:
        genome.fitness = 0.0
        net = neat.nn.FeedForwardNetwork.create(genome, config)

        # ── Ensure the game is in a fresh, running state ──
        state = game.get_state()
        if state and state.get("crashed"):
            game.restart()
            time.sleep(0.5)

        # Press start to begin a fresh run
        game.press_start()
        time.sleep(0.3)

        # Verify it actually started
        for retry in range(5):
            state = game.get_state()
            if state and state.get("playing"):
                break
            game.press_start()
            time.sleep(0.3)

        # ── Main gameplay loop for this genome ──
        alive = True
        frames = 0
        max_idle_frames = 300  # Safety: if nothing happens for 300 frames, bail

        while alive:
            state = game.get_state()
            if not state:
                time.sleep(0.01)
                frames += 1
                if frames > max_idle_frames:
                    break
                continue

            if state.get("crashed"):
                genome.fitness = state.get("score", 0)
                break

            if not state.get("playing"):
                # Not playing, not crashed — might be waiting to start
                game.press_start()
                time.sleep(0.2)
                frames += 1
                if frames > max_idle_frames:
                    break
                continue

            frames += 1
            # Use distanceRan as fitness — it's the actual game score metric
            genome.fitness = state.get("score", frames * 0.05)

            if state.get("obstacles") == 0:
                # No obstacles on screen yet — just keep running
                game.stand()
                time.sleep(0.01)
                continue

            # ── Feed the neural network ──
            speed = state["speed"]
            distance = state["distance"]
            width = state["width"]
            yPos = state["yPos"]

            outputs = net.activate((speed, distance, width, yPos))
            # outputs[0] = jump signal, outputs[1] = duck signal

            if outputs[0] > 0.5 and outputs[1] <= 0.5:
                game.jump()
            elif outputs[1] > 0.5:
                game.duck()
            else:
                game.stand()

            time.sleep(0.01)

        # Track generation bests
        if genome.fitness > gen_best_fitness:
            gen_best_fitness = genome.fitness
            gen_best_id = genome_id

        print(f"  Genome {genome_id:>3d}  |  fitness: {genome.fitness:>8.1f}")

    print(f"  ── Generation best: Genome {gen_best_id} with fitness {gen_best_fitness:.1f}")


# ─── Entry Point ─────────────────────────────────────────────────────────────

def run():
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               "config-feedforward.txt")
    config = neat.Config(
        neat.DefaultGenome,
        neat.DefaultReproduction,
        neat.DefaultSpeciesSet,
        neat.DefaultStagnation,
        config_path,
    )

    pop = neat.Population(config)
    pop.add_reporter(neat.StdOutReporter(True))
    stats = neat.StatisticsReporter()
    pop.add_reporter(stats)

    game.start()

    try:
        print("=" * 60)
        print("  NEAT Training — Chrome Dino Bot")
        print("  Population size: 10  |  Max generations: 50")
        print("  You can use other apps while this trains.")
        print("=" * 60 + "\n")

        winner = pop.run(eval_genomes, MAX_GENERATIONS)

        # Save the best genome so we can replay without retraining
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               BEST_GENOME_FILE), "wb") as f:
            pickle.dump(winner, f)

        print("\n" + "=" * 60)
        print(f"  Training complete! Best fitness: {winner.fitness:.1f}")
        print(f"  Best genome saved to {BEST_GENOME_FILE}")
        print("=" * 60)

    except KeyboardInterrupt:
        print("\n[STOP] Training interrupted by user.")
    finally:
        game.close()


if __name__ == "__main__":
    run()
