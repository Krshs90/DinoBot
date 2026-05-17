import os
import time
import base64
import queue
import threading
import neat
import pickle
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

GAME_URL = "https://wayou.github.io/t-rex-runner/"
BEST_GENOME_FILE = "best_genome.pkl"
VICTORY_SCORE = 100000

# Global state for WebSocket broadcasting
app_state = {
    "generation": 0,
    "max_fitness": 0,
    "active_dinos": 0,
    "logs": [],
    "preview_frames": [None, None, None, None],
    "training": False,
    "paused": True,
    "preview_skip_frames": 30
}

def log_event(msg):
    ts = time.strftime("%H:%M:%S")
    formatted = f"[{ts}] {msg}"
    print(f"[ENGINE] {msg}")
    app_state["logs"].append(formatted)
    if len(app_state["logs"]) > 50:
        app_state["logs"].pop(0)

# JS snippets
JS_DETECT_API = """
if (!window.Runner || !window.Runner.instance_) return null;
var r = window.Runner.instance_;
if (r.horizon && r.horizon.obstacles) return "horizon";
if (r.obstacles) return "direct";
return "unknown";
"""

def build_state_js(api_style):
    obs_path = "r.horizon.obstacles" if api_style == "horizon" else "r.obstacles"
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
    if (!next) return {{playing: true, obstacles: 0, speed: r.currentSpeed, score: r.distanceRan || 0}};

    return {{
        crashed: false,
        playing: true,
        speed: r.currentSpeed,
        distance: next.xPos - trexX,
        width: next.width,
        yPos: next.yPos,
        score: r.distanceRan || 0
    }};
    """

JS_JUMP = "document.dispatchEvent(new KeyboardEvent('keydown', {keyCode: 38, bubbles: true})); setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', {keyCode: 38, bubbles: true})), 150);"
JS_DUCK = "document.dispatchEvent(new KeyboardEvent('keydown', {keyCode: 40, bubbles: true}));"
JS_STAND = "document.dispatchEvent(new KeyboardEvent('keyup', {keyCode: 40, bubbles: true}));"
JS_RESTART = "if (window.Runner && window.Runner.instance_) window.Runner.instance_.restart();"
JS_START = "document.dispatchEvent(new KeyboardEvent('keydown', {keyCode: 32, bubbles: true})); setTimeout(() => document.dispatchEvent(new KeyboardEvent('keyup', {keyCode: 32, bubbles: true})), 100);"


class DinoWorker:
    def __init__(self, worker_id):
        self.worker_id = worker_id
        self.driver = None
        self.state_js = None

    def start(self):
        opts = Options()
        opts.add_argument("--headless=new")
        opts.add_argument("--window-size=900,650")
        opts.add_argument("--disable-infobars")
        opts.add_argument("--mute-audio")
        self.driver = webdriver.Chrome(options=opts)
        self.driver.get(GAME_URL)
        time.sleep(2)
        
        api_style = self.driver.execute_script(JS_DETECT_API) or "horizon"
        self.state_js = build_state_js(api_style)

    def evaluate(self, genome_id, net, genome):
        app_state["active_dinos"] += 1
        
        state = self.get_state()
        if state and state.get("crashed"):
            self.driver.execute_script(JS_RESTART)
            time.sleep(0.5)

        self.driver.execute_script(JS_START)
        time.sleep(0.3)

        alive = True
        frames = 0
        genome.fitness = 0.0

        while alive and app_state["training"]:
            state = self.get_state()
            if not state:
                time.sleep(0.01)
                continue

            if state.get("crashed"):
                genome.fitness = state.get("score", 0)
                break

            if not state.get("playing"):
                self.driver.execute_script(JS_START)
                time.sleep(0.2)
                continue

            frames += 1
            genome.fitness = state.get("score", frames * 0.05)

            if genome.fitness > app_state["max_fitness"]:
                app_state["max_fitness"] = genome.fitness

            # Capture preview frame based on configured skip rate
            skip = app_state.get("preview_skip_frames", 30)
            if frames % skip == 0:
                try:
                    b64 = self.driver.get_screenshot_as_base64()
                    app_state["preview_frames"][self.worker_id] = b64
                except: pass

            if state.get("obstacles") == 0:
                self.driver.execute_script(JS_STAND)
                time.sleep(0.01)
                continue

            outputs = net.activate((state["speed"], state["distance"], state["width"], state["yPos"]))
            if outputs[0] > 0.5 and outputs[1] <= 0.5:
                self.driver.execute_script(JS_JUMP)
            elif outputs[1] > 0.5:
                self.driver.execute_script(JS_DUCK)
            else:
                self.driver.execute_script(JS_STAND)

            time.sleep(0.01)

        app_state["active_dinos"] -= 1
        log_event(f"Genome {genome_id} died. Score: {genome.fitness:.1f}")

    def get_state(self):
        while app_state.get("paused"):
            try:
                self.driver.execute_script("if(Runner.instance_.playing) Runner.instance_.stop();")
            except: pass
            time.sleep(0.5)
            
        try:
            self.driver.execute_script("if(!Runner.instance_.playing && !Runner.instance_.crashed && Runner.instance_.tRex.status != 'WAITING') Runner.instance_.play();")
        except: pass

        try:
            return self.driver.execute_script(self.state_js)
        except Exception:
            return {"crashed": True, "score": 0}

    def close(self):
        if self.driver:
            self.driver.quit()


class ThreadedEvaluator:
    def __init__(self, num_workers, config):
        self.num_workers = num_workers
        self.config = config
        self.workers = []
        self.threads = []
        self.queue = queue.Queue()
        log_event(f"Initializing {num_workers} headless browsers...")
        for i in range(num_workers):
            w = DinoWorker(i)
            w.start()
            self.workers.append(w)
            
            t = threading.Thread(target=self.worker_loop, args=(w,))
            t.daemon = True
            t.start()
            self.threads.append(t)
            
        log_event("Browsers ready.")

    def worker_loop(self, worker):
        while True:
            item = self.queue.get()
            if item is None: break
            genome_id, genome = item
            net = neat.nn.FeedForwardNetwork.create(genome, self.config)
            worker.evaluate(genome_id, net, genome)
            self.queue.task_done()

    def evaluate(self, genomes, config):
        app_state["generation"] += 1
        log_event(f"--- Starting Generation {app_state['generation']} ---")
        
        for genome_id, genome in genomes:
            self.queue.put((genome_id, genome))

        self.queue.join()

        # Check victory condition
        for genome_id, genome in genomes:
            if genome.fitness >= VICTORY_SCORE:
                log_event(f"VICTORY! Genome {genome_id} reached {VICTORY_SCORE}.")
                raise Exception("VICTORY")

    def close(self):
        for _ in self.workers:
            self.queue.put(None)
        for w in self.workers:
            w.close()


def run_neat():
    app_state["training"] = True
    config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config-feedforward.txt")
    config = neat.Config(neat.DefaultGenome, neat.DefaultReproduction, neat.DefaultSpeciesSet, neat.DefaultStagnation, config_path)

    pop = neat.Population(config)
    evaluator = ThreadedEvaluator(num_workers=4, config=config)

    try:
        winner = pop.run(evaluator.evaluate, 100)
        with open(BEST_GENOME_FILE, "wb") as f:
            pickle.dump(winner, f)
        log_event("Training completed. Best genome saved.")
    except Exception as e:
        if str(e) == "VICTORY":
            # Save the best in current population
            best = max(pop.population.values(), key=lambda g: g.fitness)
            with open(BEST_GENOME_FILE, "wb") as f:
                pickle.dump(best, f)
            log_event("Victory achieved! Model saved.")
    finally:
        app_state["training"] = False
        evaluator.close()
