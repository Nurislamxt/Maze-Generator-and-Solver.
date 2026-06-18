// Конфигурация Canvas
const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');
const logicalSize = 600; // Внутреннее разрешение холста
canvas.width = logicalSize;
canvas.height = logicalSize;

// DOM Элементы
const sizeSelect = document.getElementById('mazeSize');
const btnGenerate = document.getElementById('btnGenerate');
const btnSolve = document.getElementById('btnSolve');
const btnReset = document.getElementById('btnReset');

// Переменные состояния
let cols, rows, w;
let grid = [];
let current;
let stack = [];
let isMazeGenerated = false;
let animationInterval = null;
let animatedPath = [];

// Класс Клетки
class Cell {
    constructor(i, j) {
        this.i = i;
        this.j = j;
        // Стены: [top, right, bottom, left]
        this.walls = [true, true, true, true];
        this.visited = false;
        
        // Переменные для алгоритма A*
        this.f = 0;
        this.g = 0;
        this.h = 0;
        this.previous = undefined;
    }

    // Отрисовка клетки и стен
    show() {
        const x = this.i * w;
        const y = this.j * w;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        if (this.walls[0]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke(); } // Top
        if (this.walls[1]) { ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + w); ctx.stroke(); } // Right
        if (this.walls[2]) { ctx.beginPath(); ctx.moveTo(x + w, y + w); ctx.lineTo(x, y + w); ctx.stroke(); } // Bottom
        if (this.walls[3]) { ctx.beginPath(); ctx.moveTo(x, y + w); ctx.lineTo(x, y); ctx.stroke(); } // Left
    }

    // Получение не посещенных соседей для DFS (Генерация)
    checkNeighbors() {
        let neighbors = [];
        let top    = grid[index(this.i, this.j - 1)];
        let right  = grid[index(this.i + 1, this.j)];
        let bottom = grid[index(this.i, this.j + 1)];
        let left   = grid[index(this.i - 1, this.j)];

        if (top && !top.visited) neighbors.push(top);
        if (right && !right.visited) neighbors.push(right);
        if (bottom && !bottom.visited) neighbors.push(bottom);
        if (left && !left.visited) neighbors.push(left);

        if (neighbors.length > 0) {
            let r = Math.floor(Math.random() * neighbors.length);
            return neighbors[r];
        } else {
            return undefined;
        }
    }

    // Получение доступных соседей для A* (Поиск пути)
    getAccessibleNeighbors() {
        let neighbors = [];
        let top    = grid[index(this.i, this.j - 1)];
        let right  = grid[index(this.i + 1, this.j)];
        let bottom = grid[index(this.i, this.j + 1)];
        let left   = grid[index(this.i - 1, this.j)];

        // Если нет стены между текущей клеткой и соседом, сосед доступен
        if (top && !this.walls[0]) neighbors.push(top);
        if (right && !this.walls[1]) neighbors.push(right);
        if (bottom && !this.walls[2]) neighbors.push(bottom);
        if (left && !this.walls[3]) neighbors.push(left);

        return neighbors;
    }
}

// Конвертация 2D координат в 1D индекс массива
function index(i, j) {
    if (i < 0 || j < 0 || i > cols - 1 || j > rows - 1) return -1;
    return i + j * cols;
}

// Удаление стен между двумя соседними клетками (для DFS)
function removeWalls(a, b) {
    let x = a.i - b.i;
    if (x === 1) {
        a.walls[3] = false;
        b.walls[1] = false;
    } else if (x === -1) {
        a.walls[1] = false;
        b.walls[3] = false;
    }
    
    let y = a.j - b.j;
    if (y === 1) {
        a.walls[0] = false;
        b.walls[2] = false;
    } else if (y === -1) {
        a.walls[2] = false;
        b.walls[0] = false;
    }
}

// Эвристическая функция для A* (Манхэттенское расстояние)
function heuristic(a, b) {
    return Math.abs(a.i - b.i) + Math.abs(a.j - b.j);
}

// Удаление элемента из массива
function removeFromArray(arr, elt) {
    for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i] === elt) {
            arr.splice(i, 1);
        }
    }
}

// Инициализация сетки и сброс состояния
function setupGrid() {
    clearInterval(animationInterval);
    animatedPath = [];
    grid = [];
    stack = [];
    isMazeGenerated = false;
    btnSolve.disabled = true;
    
    let size = parseInt(sizeSelect.value);
    cols = size;
    rows = size;
    w = logicalSize / cols;

    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            grid.push(new Cell(i, j));
        }
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBase();
}

// Моментальная генерация лабиринта (DFS алгоритм)
function generateMazeDFS() {
    setupGrid();
    current = grid[0];
    current.visited = true;

    // Цикл генерации
    while(true) {
        let next = current.checkNeighbors();
        if (next) {
            next.visited = true;
            stack.push(current);
            removeWalls(current, next);
            current = next;
        } else if (stack.length > 0) {
            current = stack.pop();
        } else {
            break; // Лабиринт завершен, стек пуст
        }
    }
    
    isMazeGenerated = true;
    btnSolve.disabled = false;
    drawBase();
}

// Алгоритм A* для поиска кратчайшего пути
function solveAStar() {
    if (!isMazeGenerated) return;
    
    btnGenerate.disabled = true;
    btnSolve.disabled = true;
    sizeSelect.disabled = true;

    // Подготовка клеток для нового поиска
    grid.forEach(cell => {
        cell.f = 0; cell.g = 0; cell.h = 0; cell.previous = undefined;
    });

    let startNode = grid[0];
    let endNode = grid[grid.length - 1];
    
    let openSet = [startNode];
    let closedSet = [];
    let path = [];
    
    let solved = false;

    // Основной цикл A*
    while (openSet.length > 0) {
        let winner = 0;
        for (let i = 0; i < openSet.length; i++) {
            if (openSet[i].f < openSet[winner].f) {
                winner = i;
            }
        }
        let currentOpen = openSet[winner];

        // Достигли конца
        if (currentOpen === endNode) {
            let temp = currentOpen;
            path.push(temp);
            while(temp.previous) {
                path.push(temp.previous);
                temp = temp.previous;
            }
            solved = true;
            break;
        }

        removeFromArray(openSet, currentOpen);
        closedSet.push(currentOpen);

        let neighbors = currentOpen.getAccessibleNeighbors();
        
        for (let i = 0; i < neighbors.length; i++) {
            let neighbor = neighbors[i];
            
            if (!closedSet.includes(neighbor)) {
                let tempG = currentOpen.g + 1;
                let newPath = false;
                
                if (openSet.includes(neighbor)) {
                    if (tempG < neighbor.g) {
                        neighbor.g = tempG;
                        newPath = true;
                    }
                } else {
                    neighbor.g = tempG;
                    newPath = true;
                    openSet.push(neighbor);
                }
                
                if (newPath) {
                    neighbor.h = heuristic(neighbor, endNode);
                    neighbor.f = neighbor.g + neighbor.h;
                    neighbor.previous = currentOpen;
                }
            }
        }
    }

    if (solved) {
        animatePath(path.reverse());
    } else {
        alert("Путь не найден!");
        resetUI();
    }
}

// Анимация отрисовки пути
function animatePath(fullPath) {
    let index = 0;
    animatedPath = [];
    clearInterval(animationInterval);
    
    // Вычисляем задержку в зависимости от размера пути
    let speed = Math.max(10, 100 - (cols * 1.5)); 
    
    animationInterval = setInterval(() => {
        if (index < fullPath.length) {
            animatedPath.push(fullPath[index]);
            drawBase(); // Перерисовываем с добавленной клеткой пути
            index++;
        } else {
            clearInterval(animationInterval);
            resetUI();
        }
    }, speed);
}

// Основная функция отрисовки лабиринта, начальной/конечной точек и пути
function drawBase() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Рисуем все клетки и стены
    for (let i = 0; i < grid.length; i++) {
        grid[i].show();
    }

    // Если лабиринт сгенерирован, рисуем старт (Зеленый) и финиш (Красный)
    if (grid.length > 0) {
        // Заливка клеток цветом
        const fillCell = (cell, color) => {
            ctx.fillStyle = color;
            // Делаем заливку чуть меньше ячейки, чтобы не перекрывать стены
            ctx.fillRect(cell.i * w + 2, cell.j * w + 2, w - 4, w - 4);
        };

        // Рисуем анимированный путь (Синий)
        for (let i = 0; i < animatedPath.length; i++) {
            fillCell(animatedPath[i], '#2196F3');
        }

        // Старт - всегда верхний левый угол
        fillCell(grid[0], '#4CAF50');
        // Финиш - всегда нижний правый угол
        fillCell(grid[grid.length - 1], '#f44336');
    }
}

// Восстановление элементов интерфейса после выполнения
function resetUI() {
    btnGenerate.disabled = false;
    btnSolve.disabled = false;
    sizeSelect.disabled = false;
}

// Слушатели событий
btnGenerate.addEventListener('click', generateMazeDFS);
btnSolve.addEventListener('click', solveAStar);
btnReset.addEventListener('click', () => {
    setupGrid();
    resetUI();
});
sizeSelect.addEventListener('change', setupGrid);

// Первичная инициализация пустой сетки при загрузке страницы
setupGrid();
