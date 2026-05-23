# DinoBot V2: Browser-Native Neuroevolution

*Made by Krshs90*

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](#)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](#)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](#)
[![Neuroevolution](https://img.shields.io/badge/Neuroevolution-AI-blueviolet?style=for-the-badge)](#)

## Overview

Welcome to **DinoBot V2**! This is a completely rewritten, entirely browser-based Artificial Intelligence designed to master the classic Chrome Dinosaur game. 

Transitioning from the bulky Python/Selenium backend of V1, this new version runs a pure HTML5 Canvas headless simulation directly in your browser. By utilizing a **Genetic Algorithm** and **Neural Networks** written from scratch in vanilla JavaScript, it rapidly learns to play the game without requiring any backend servers, WebDriver setups, or Python dependencies.

![DinoBot V2 Preview](dashboard.png)

## Architecture

* **`index.html` & `style.css`**: Provides a beautiful, glassmorphism-styled dashboard UI and the rendering canvas. Includes a "Streamer Mode" for distraction-free recording.
* **`game.js`**: A custom headless physics engine mimicking the exact mechanics of the original T-Rex Runner (gravity, jumping, ducking, obstacles).
* **`agent.js`**: The AI Brain. Implements a Feedforward Neural Network optimized via a Genetic Algorithm (Neuroevolution). It tracks 5 core inputs (distance to obstacle, width, type, speed, and altitude) to make split-second decisions.
* **`main.js`**: The central orchestrator that links the AI, the physics engine, and the canvas renderer, driving the high-speed training loop.

## Features

* **Zero Setup**: No Python, no Selenium, no `npm install`. Just open `index.html` in your browser!
* **Blazing Fast Training**: Evaluates populations of up to 100 dinosaurs simultaneously at massive time-scales.
* **Neuroevolution**: Employs genetic selection and mutation on neural network weights to discover the optimal playstyle within just a few generations.
* **Streamer Mode**: A clean, single-dino view that hides the background training UI for recording satisfying, perfect gameplay.
* **Local Persistence**: Automatically saves the "Alpha" brain's neural network parameters to your browser's Local Storage.

## How to Play / Train

1. Open `index.html` in your browser.
2. The AI will immediately begin generating random brains and training.
3. Use the floating UI panel to:
   * **Adjust Speed**: Speed up the simulation to train faster or slow it down to 1x to watch the Alpha.
   * **Adjust Population**: Spawn up to 100 simultaneous instances for wider genetic diversity.
   * **Show Ghosts**: See all the concurrent "failed" runs fading out as the Alpha succeeds.
   * **Save Brain**: Persist the best network to your browser.
4. Click **Streamer Mode** to hide the UI and focus on the flawless Alpha dino. Press `ESC` to exit.

## License

This project is open-source and available under the MIT License.
