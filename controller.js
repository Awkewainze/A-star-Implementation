var grid = require('game-grid');
var _ = require('underscore');

var canvas = document.getElementById("canvas");
var startButton = document.getElementById("start-button");
var pathOnly = document.getElementById("path-only");
var time = document.getElementById("time");
var sizeInput = document.getElementById("size");
var weight = document.getElementById("distance-weight");

var myStorage = window.localStorage;
var size = localStorage.getItem("size");
if(!size){
    size = 20;
    myStorage.setItem("size", size);
}
sizeInput.value = size;
sizeInput.onchange = (event) => {
    let x;
    if(x = parseFloat(event.target.value))
        myStorage.setItem("size", Math.floor(x));
}

pathOnly.checked = myStorage.getItem("path") === "true";
pathOnly.onchange = (event) => {
    myStorage.setItem("path", event.target.checked ? "true" : "false");
}
view = new grid.GridView(canvas, {size, scale: 40});
model = new grid.GridModel(size);

var running = false;

view.onCellClick(function(cell) {
    if(running)
        return;

    var modelCell = model.getCell(cell.x, cell.y);

    modelCell.state = nextState(modelCell.state);
    render();
});

view.paintGrid();

// ms between painting of tiles
DRAW_DELAY = 50;

startButton.onclick = function(){
    startButton.disabled = true;
    running = true;
    render();
    clearState();
    if(!getStartLocation() || !getEndLocation()){
        startButton.disabled = false;
        running = false;
        return;
    }

    calculateShortestPathStartToFinish();
}

function render(){
    var y = function(x){
        if(x.state === undefined){
            view.clearCell(x);
        } else {
            view.fillCell(x, getColorForState(x.state));
        }
    }
    model.cells.forEach(y);
}

function nextState(state){
    var newState = undefined;
    if(state === undefined){
        newState = "wall";
    } else if(state === "wall" && getStartLocation() === undefined) {
        newState = "start";
    } else if((state === "start" || state === "wall") && getEndLocation() === undefined) {
        newState = "end";
    }
    return newState;
};

function getColorForState(state){
    var color = "#000000";
    if(state === undefined){
        newState = "#ffffff";
    } else if(state === "start") {
        color = "#0000ff";
    } else if(state === "end") {
        color = "#ff0000";
    }
    return color;
}

function getStartLocation(){
    var y = function(x){ return x.state === "start"; };
    return model.cells.find(y);
}

function getEndLocation(){
    var y = function(x){ return x.state === "end"; };
    return model.cells.find(y);
}

function drawSearched(drawQueue, onFinished, skip){
    if(skip){
        onFinished();
        return;
    }
    var length = drawQueue.length;
    var self = setInterval(() => {
        if(length <= 0){
            clearInterval(self);
            onFinished();
            return;
        }
        length--;
        drawQueue.shift()();
    }, DRAW_DELAY);
}

function drawPath(arrayOfCells){
    var y = function(x){ view.fillCell(x, "#00ff00"); }
    arrayOfCells.forEach(y);
}

function calculateShortestPathStartToFinish(){
    var start = getStartLocation();
    var end = getEndLocation();

    if(start === undefined || end === undefined)
        return false;

    var result = aStar(start, end, "#8c8c8c");
    var drawQueue = result.drawQueue;
    var path = result.path;
    var length = drawQueue.length;
    let lastNode = path[path.length - 1];

    if(lastNode.x !== end.x && lastNode.y !== end.y){
        console.log("Could not reach end");
        startButton.disabled = false;
        running = false;
        return;
    }
    drawSearched(drawQueue, () => {
        drawPath(path);
        startButton.disabled = false;
        running = false;
    }, pathOnly.checked);
}

function distance(a, b){
    return Math.sqrt(((a.x - b.x) * (a.x - b.x)) + ((a.y - b.y) * (a.y - b.y)));
}

model.getDirectNeighborsForCell = function(x, y){
    var allNeighbors = [
        this.getNextCellUp(x,y),
        this.getNextCellRight(x,y),
        this.getNextCellDown(x,y),
        this.getNextCellLeft(x,y)
    ];

    // filter non null
    return _.filter(allNeighbors, function(cell){
        return cell != null;
    });
}

PriorityQueue = function(){
    this.backingStore = [];
    this.cellHeatMap = {};
}

PriorityQueue.prototype.queueON = function (cell, priority) {
    let length = this.backingStore.length;
    for(var i = 0; i < length; i++){
        if(this.backingStore[i].priority > priority) break;
    }
    this.backingStore.splice(i, 0, {cell, priority});
};

PriorityQueue.prototype.queueOLogN = function (cell, priority) {
    let cellKey = `${cell.x}${cell.y}`;
    if(!this.cellHeatMap[cellKey]) this.cellHeatMap[cellKey] = 0;
    this.cellHeatMap[cellKey]++;
    let high = this.backingStore.length;
    let low = 0;
    while(low < high){
        let mid = low + high - 1;
        if(this.backingStore[mid].priority > priority){
            high = mid;
        } else {
            low = mid + 1;
        }
    }
    this.backingStore.splice(low, 0, {cell, priority});
};

PriorityQueue.prototype.queue = PriorityQueue.prototype.queueOLogN;

PriorityQueue.prototype.dequeue = function () {
    return this.backingStore.shift();
};

PriorityQueue.prototype.length = function () {
    return this.backingStore.length;
};

function aStar(startCell, endCell, color){
    console.time("A*");
    var start = window.performance.now();
    var priorityQueue = new PriorityQueue();
    startCell.cost = 0;
    priorityQueue.queue(startCell, 0);
    var drawQueue = [];
    while(priorityQueue.length() > 0){
        var current = priorityQueue.dequeue().cell;
        if(current.x === endCell.x && current.y === endCell.y)
            break;
        if(current !== startCell && current !== endCell){
            let t = current;
            drawQueue.push(function(){
                view.fillCell(t, color);
            });
        }

        var neighbors = model.getDirectNeighborsForCell(current.x, current.y);
        for (let neighbor in neighbors) {
            neighbor = neighbors[neighbor];
            var new_cost = current.cost + 1;
            if( neighbor.state !== "wall" && (neighbor.cost === undefined || neighbor.cost > new_cost) ){
                if(!neighbor.explored){
                    neighbor.explored = true;
                }
                neighbor.cost = new_cost;
                var priority = new_cost + (distance(neighbor, endCell) * parseFloat(weight.value));
                priorityQueue.queue(neighbor, priority);
                neighbor.parent = current;
            }
        }
    }

    var path = [];
    while(current.parent !== undefined){
        path.push(current);
        current = current.parent;
    };

    path.reverse();
    path.pop();
    var end = window.performance.now();
    console.timeEnd("A*");

    time.innerText = (end - start).toFixed(1);
    return {path, drawQueue};
}

function clearState(){
    var y = function(x){ x.distance = undefined; x.cost = undefined; x.parent = undefined; x.explored = false; };
    return model.cells.forEach(y);
}

// Add missing functionality from game-grid (colored cells)
view.fillCell = function(cell, color) {
    var context = this.canvas.getContext("2d");
    var s = this.config.scale;
    if(color)
        context.fillStyle = color;
    context.fillRect(cell.x * s - s + 1, cell.y * s - s + 1, s - 1, s - 1);
}

canvas.removeAttribute("style");
