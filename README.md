# DinoBot Neural Engine

*Made by Krshs90, Bug fixed by Google Antigravity, ReadMe by Gemini 3.1 Pro*

[![Python](https://img.shields.io/badge/Python-3.8%2B-blue?style=for-the-badge&logo=python)](#)
[![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)](#)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.103-009688?style=for-the-badge&logo=fastapi)](#)
[![Selenium](https://img.shields.io/badge/Selenium-4.12-43B02A?style=for-the-badge&logo=selenium)](#)
[![NEAT](https://img.shields.io/badge/NEAT-Python-orange?style=for-the-badge)](#)

## Overview

DinoBot Neural Engine is a high-performance, multithreaded AI training platform designed to autonomously master the Chrome Dinosaur game. It leverages the NEAT (NeuroEvolution of Augmenting Topologies) algorithm to evolve neural networks over successive generations.

Unlike traditional single-threaded automation scripts, this project features a modern full-stack architecture:
* **Headless Parallel Evaluation**: Simulates multiple game instances concurrently using headless Chrome browsers.
* **WebSocket Telemetry**: Streams real-time training metrics, engine logs, and base64 video frames from the hidden browsers to the frontend.
* **React Dashboard**: Provides a professional, minimalist control center to monitor and manipulate the training process on the fly.

![Live Simulation Previews](dashboard.png)

## Architecture

* **Backend Engine (`backend/engine.py`)**: Orchestrates the NEAT population, manages a persistent thread pool of headless Selenium workers, and intercepts internal game states via DOM injection to bypass standard visual processing overhead.
* **API Layer (`backend/main.py`)**: A FastAPI server that exposes REST endpoints for simulation control (Play/Pause/FPS) and a persistent WebSocket connection for high-frequency telemetry streaming.
* **Frontend Dashboard (`frontend/`)**: A Vite/React application styled with Tailwind CSS, offering a terminal-style log viewer, live metrics, and a 2x2 grid preview of the hidden evaluation threads.

## Features

* **Parallel Training**: Evaluates 4 genomes simultaneously, significantly accelerating the evolutionary process.
* **Zero-Interference Execution**: Runs entirely in the background (`--headless=new`). The host operating system's focus and display are unaffected.
* **Live Configuration**: Adjust the preview capture framerate dynamically without interrupting the training loop.
* **State Management**: Robust pause/resume functionality that accurately halts both the neural network evolution and the internal game clocks.
* **Automated Persistence**: Automatically halts and saves the optimal weights (`best_genome.pkl`) to disk once the target fitness threshold (100,000) is achieved.

## Installation and Execution

The platform is designed for turnkey deployment. A single batch script manages dependency resolution and launches both the backend and frontend servers.

### Prerequisites
* Python 3.8+
* Node.js (v18+)
* Google Chrome installed locally

### Quick Start

1. Clone the repository.
2. Execute the bootstrap script:
   ```cmd
   run.bat
   ```
3. The script will automatically:
   * Install Python requirements (`requirements.txt`).
   * Install Node.js packages (`npm install`).
   * Start the FastAPI engine on port 8000.
   * Start the Vite development server.
   * Open `http://localhost:5173` in your default browser.

### Manual Start
If you prefer to start the services manually:

**Backend:**
```bash
pip install -r requirements.txt
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Configuration

The neural network topology, mutation rates, and population size are governed by `config-feedforward.txt`. 

To modify the target victory condition, adjust the `fitness_threshold` parameter within the configuration file.

## License

This project is open-source and available under the MIT License.
