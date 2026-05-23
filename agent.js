// ============================================================
// Genetic Algorithm + Neural Network Agent for Dino
// ============================================================

class NeuralNet {
    constructor(inputNodes, hiddenNodes, outputNodes) {
        this.inputNodes = inputNodes;
        this.hiddenNodes = hiddenNodes;
        this.outputNodes = outputNodes;

        this.weightsIH = new Float32Array(this.inputNodes * this.hiddenNodes);
        this.weightsHO = new Float32Array(this.hiddenNodes * this.outputNodes);
        for(let i=0; i<this.weightsIH.length; i++) this.weightsIH[i] = Math.random() * 2 - 1;
        for(let i=0; i<this.weightsHO.length; i++) this.weightsHO[i] = Math.random() * 2 - 1;
    }

    predict(inputs) {
        let hidden = new Float32Array(this.hiddenNodes);
        for(let i=0; i<this.hiddenNodes; i++) {
            let sum = 0;
            for(let j=0; j<this.inputNodes; j++) {
                sum += inputs[j] * this.weightsIH[j * this.hiddenNodes + i];
            }
            hidden[i] = Math.max(0, sum); // ReLU
        }

        let outputs = new Float32Array(this.outputNodes);
        for(let i=0; i<this.outputNodes; i++) {
            let sum = 0;
            for(let j=0; j<this.hiddenNodes; j++) {
                sum += hidden[j] * this.weightsHO[j * this.outputNodes + i];
            }
            outputs[i] = sum;
        }
        
        let maxIdx = 0;
        let maxVal = outputs[0];
        for(let i=1; i<this.outputNodes; i++) {
            if(outputs[i] > maxVal) {
                maxVal = outputs[i];
                maxIdx = i;
            }
        }
        return maxIdx;
    }

    clone() {
        let nn = new NeuralNet(this.inputNodes, this.hiddenNodes, this.outputNodes);
        nn.weightsIH.set(this.weightsIH);
        nn.weightsHO.set(this.weightsHO);
        return nn;
    }

    mutate(rate) {
        for(let i=0; i<this.weightsIH.length; i++) {
            if(Math.random() < rate) {
                this.weightsIH[i] += Math.random() * 0.5 - 0.25;
            }
        }
        for(let i=0; i<this.weightsHO.length; i++) {
            if(Math.random() < rate) {
                this.weightsHO[i] += Math.random() * 0.5 - 0.25;
            }
        }
    }
}

class GeneticAgent {
    constructor(popSize) {
        this.popSize = popSize;
        this.brains = [];
        for(let i=0; i<this.popSize; i++) {
            this.brains.push(new NeuralNet(5, 8, 3));
        }
        this.gamesPlayed = 0;
        this.bestScore = 0;
        this.epsilon = 0.1; // Mutation rate
        this.bestBrain = null;
        this.load();
    }

    setPopulation(n) {
        while(this.brains.length < n) {
            let parent = this.bestBrain ? this.bestBrain.clone() : new NeuralNet(5, 8, 3);
            parent.mutate(this.epsilon);
            this.brains.push(parent);
        }
        if(this.brains.length > n) {
            this.brains.length = n;
        }
        this.popSize = n;
    }

    evolve(fitnesses) {
        fitnesses.sort((a, b) => b.score - a.score);
        
        if (fitnesses[0].score > this.bestScore) {
            this.bestScore = fitnesses[0].score;
            this.bestBrain = this.brains[fitnesses[0].brainIndex].clone();
        }

        let newBrains = [];
        
        if (this.bestBrain) {
            newBrains.push(this.bestBrain.clone());
        } else {
            newBrains.push(this.brains[fitnesses[0].brainIndex].clone());
        }

        for(let i=1; i<this.popSize; i++) {
            let parent = this.selectParent(fitnesses).clone();
            parent.mutate(this.epsilon);
            newBrains.push(parent);
        }

        this.brains = newBrains;
        this.gamesPlayed++;
    }

    selectParent(fitnesses) {
        let limit = Math.max(1, Math.floor(fitnesses.length * 0.2));
        let r = Math.floor(Math.random() * limit);
        return this.brains[fitnesses[r].brainIndex];
    }

    save() {
        try {
            if (this.bestBrain) {
                localStorage.setItem('dino_nn_ih', JSON.stringify(Array.from(this.bestBrain.weightsIH)));
                localStorage.setItem('dino_nn_ho', JSON.stringify(Array.from(this.bestBrain.weightsHO)));
            }
            localStorage.setItem('dino_eps', this.epsilon.toString());
            localStorage.setItem('dino_games', this.gamesPlayed.toString());
            localStorage.setItem('dino_best', this.bestScore.toString());
        } catch (e) { }
    }

    load() {
        try {
            let ih = localStorage.getItem('dino_nn_ih');
            let ho = localStorage.getItem('dino_nn_ho');
            if (ih && ho) {
                let best = new NeuralNet(5, 8, 3);
                best.weightsIH.set(JSON.parse(ih));
                best.weightsHO.set(JSON.parse(ho));
                this.bestBrain = best;
                this.brains[0] = best.clone();
            }
            this.epsilon = parseFloat(localStorage.getItem('dino_eps')) || 0.1;
            this.gamesPlayed = parseInt(localStorage.getItem('dino_games')) || 0;
            this.bestScore = parseFloat(localStorage.getItem('dino_best')) || 0;
        } catch (e) { }
    }

    reset() {
        this.brains = [];
        for(let i=0; i<this.popSize; i++) {
            this.brains.push(new NeuralNet(5, 8, 3));
        }
        this.bestBrain = null;
        this.gamesPlayed = 0;
        this.bestScore = 0;
        localStorage.removeItem('dino_nn_ih');
        localStorage.removeItem('dino_nn_ho');
        localStorage.removeItem('dino_eps');
        localStorage.removeItem('dino_games');
        localStorage.removeItem('dino_best');
    }

    get stateCount() {
        return 64; 
    }
}
