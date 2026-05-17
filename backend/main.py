import asyncio
import threading
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from engine import run_neat, app_state

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    # Start the NEAT training loop in a background thread
    t = threading.Thread(target=run_neat)
    t.daemon = True
    t.start()

@app.post("/start")
async def start_training():
    app_state["paused"] = False
    return {"status": "started"}

@app.post("/pause")
async def pause_training():
    app_state["paused"] = True
    return {"status": "paused"}

@app.post("/config")
async def update_config(request: Request):
    data = await request.json()
    if "preview_skip_frames" in data:
        app_state["preview_skip_frames"] = int(data["preview_skip_frames"])
    return {"status": "updated"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Send current state
            await websocket.send_json({
                "generation": app_state["generation"],
                "max_fitness": app_state["max_fitness"],
                "active_dinos": app_state["active_dinos"],
                "logs": app_state["logs"],
                "preview_frames": app_state["preview_frames"],
                "training": app_state["training"],
                "paused": app_state["paused"]
            })
            await asyncio.sleep(0.1) # 10fps stream
    except WebSocketDisconnect:
        pass
