// Block Blast - H5 Version
// WeChat API Adapter Layer
const wx = {
    createCanvas() {
        return document.getElementById('gameCanvas');
    },
    getSystemInfoSync() {
        return {
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            pixelRatio: window.devicePixelRatio || 1,
            statusBarHeight: 0
        };
    },
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    vibrateShort(options) {
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    },
    vibrateLong() {
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
    },
    getStorageSync(key) {
        return localStorage.getItem(key);
    },
    setStorageSync(key, value) {
        localStorage.setItem(key, value);
    },
    createInnerAudioContext() {
        return null;
    },
    onShareAppMessage() {},
    showShareMenu() {},
    setUserCloudStorage() {},
    getLaunchOptionsSync() {
        return { query: {} };
    },
    getOpenDataContext() {
        return null;
    },
    shareAppMessage() {}
};

// Game Configuration
const CONFIG = {
    GRID: 8, 
    GAP: 2,
    BOMB_COLOR: '#ff0000', 
    EMPTY: '#1a1f36',
    GRID_BORDER: '#2a3150',
    GRID_BG: '#0f1426',
    COLORS: [
        { main: '#ff6b6b', light: '#ff8e8e', shadow: '#e55555' },
        { main: '#4ecdc4', light: '#6ee6dd', shadow: '#3db5ad' },  
        { main: '#45b7d1', light: '#6bc5d9', shadow: '#3a9bc1' },
        { main: '#f9ca24', light: '#fdd835', shadow: '#e6b800' },
        { main: '#a55eea', light: '#b575ed', shadow: '#9142e6' },
        { main: '#26de81', light: '#4de896', shadow: '#1dd16d' },
        { main: '#fd79a8', light: '#ff92b8', shadow: '#e84393' },
        { main: '#fdcb6e', light: '#fed892', shadow: '#e6b800' }
    ]
};

// Audio Manager
class AudioManager {
    constructor() {
        this.ctx = null;
    }

    playTone(freq, type, dur, vol = 0.1) {
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }

    playPlace() { 
        this.playTone(300, 'sine', 0.1);
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }
    
    playClear(n) { 
        this.playTone(400 + (n * 100), 'triangle', 0.15);
        if (navigator.vibrate) {
            navigator.vibrate(n >= 2 ? 100 : 50);
        }
    }
    
    playBomb() { 
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
    }
    
    playItem() { 
        this.playTone(800, 'square', 0.1);
        if (navigator.vibrate) {
            navigator.vibrate(80);
        }
    }
}

// Particle Class
class Particle {
    constructor(x, y, color, speed = 1, type = 'normal') {
        this.x = x; 
        this.y = y; 
        this.color = color;
        this.type = type;
        const a = Math.random() * 6.28;
        const s = (Math.random() * 4 + 2) * speed;
        this.vx = Math.cos(a) * s; 
        this.vy = Math.sin(a) * s;
        this.life = 1; 
        this.decay = Math.random() * 0.03 + 0.02;
        this.size = Math.random() * 4 + 2;
        this.rotation = Math.random() * 6.28;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
        this.gravity = type === 'spark' ? 0.1 : 0.05;
    }

    update() { 
        this.x += this.vx; 
        this.y += this.vy; 
        this.vy += this.gravity;
        this.vx *= 0.98;
        this.life -= this.decay;
        this.rotation += this.rotationSpeed;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life; 
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        if (this.type === 'spark') {
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
            if (typeof this.color === 'object') {
                gradient.addColorStop(0, this.color.light || '#ffffff');
                gradient.addColorStop(0.5, this.color.main || '#ffaa00');
                gradient.addColorStop(1, 'rgba(255, 170, 0, 0)');
            } else {
                gradient.addColorStop(0, '#ffffff');
                gradient.addColorStop(0.5, this.color);
                gradient.addColorStop(1, 'rgba(255, 170, 0, 0)');
            }
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, 6.28);
            ctx.fill();
        } else {
            if (typeof this.color === 'object') {
                ctx.fillStyle = this.color.main || '#ffffff';
            } else {
                ctx.fillStyle = this.color;
            }
            ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillRect(-this.size/2, -this.size/2, this.size/2, this.size/4);
        }
        
        ctx.restore();
    }
}

// Main Game Class
class BlockBlast {
    constructor() {
        this.canvas = wx.createCanvas();
        this.ctx = this.canvas.getContext('2d');
        
        const systemInfo = wx.getSystemInfoSync();
        this.screenWidth = systemInfo.screenWidth;
        this.screenHeight = systemInfo.screenHeight;
        this.pixelRatio = systemInfo.pixelRatio;
        
        this.topSafeArea = 40;
        
        this.canvas.width = this.screenWidth * this.pixelRatio;
        this.canvas.height = this.screenHeight * this.pixelRatio;
        this.ctx.scale(this.pixelRatio, this.pixelRatio);
        
        this.grid = [];
        this.blocks = [];
        this.particles = [];
        this.score = 0;
        this.highScore = this.getStoredHighScore();
        this.sessionHighScore = this.highScore;
        this.pendingRewards = [];
        this.dragBlock = null;
        this.dragOffset = { x: 0, y: 0 };
        this.fingerPosition = null;
        this.time = 0;
        this.difficulty = 5;
        this.lastMilestone = 0;
        this.isPlaying = false;
        this.gameState = 'menu';
        
        this.lastFrameTime = 0;
        this.targetFPS = 60;
        this.frameInterval = 1000 / this.targetFPS;
        
        this.frameCount = 0;
        this.fpsStartTime = Date.now();
        
        this.audioMgr = new AudioManager();
        this.wechatAPI = null;
        
        this.calculateGameArea();
        this.bindTouchEvents();
        this.showMainMenu();
        this.gameLoop();
    }

    drawRoundedRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
    }

    drawStylizedBlock(x, y, size, colorConfig, alpha = 1) {
        const radius = size * 0.15;
        
        this.ctx.save();
        this.ctx.globalAlpha = alpha;
        
        const gradient = this.ctx.createLinearGradient(x, y, x, y + size);
        gradient.addColorStop(0, colorConfig.light);
        gradient.addColorStop(1, colorConfig.shadow);
        
        this.ctx.fillStyle = gradient;
        this.drawRoundedRect(x, y, size, size, radius);
        this.ctx.fill();
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.drawRoundedRect(x, y, size, size * 0.3, radius);
        this.ctx.fill();
        
        this.ctx.restore();
    }

    drawEmptyCell(x, y, size) {
        const radius = size * 0.1;
        
        this.ctx.fillStyle = CONFIG.EMPTY;
        this.drawRoundedRect(x, y, size, size, radius);
        this.ctx.fill();
        
        this.ctx.strokeStyle = CONFIG.GRID_BORDER;
        this.ctx.lineWidth = 0.8;
        this.drawRoundedRect(x + 1, y + 1, size - 2, size - 2, radius);
        this.ctx.stroke();
    }

    calculateGameArea() {
        const padding = 20;
        const topSafeArea = this.topSafeArea;
        const bottomSafeArea = 20;
        const scoreAreaHeight = 100; // Reserve space for Score/Best/Level display
        
        const availableWidth = this.screenWidth - padding * 2;
        const availableHeight = this.screenHeight - padding * 2 - topSafeArea - bottomSafeArea - scoreAreaHeight;
        
        this.gameWidth = Math.min(availableWidth, 400);
        this.gameHeight = Math.min(this.gameWidth * 1.5, availableHeight);
        
        this.gameX = (this.screenWidth - this.gameWidth) / 2;
        this.gameY = topSafeArea + scoreAreaHeight + (availableHeight - this.gameHeight) / 2 + 20;
        
        this.cellSize = (this.gameWidth - CONFIG.GAP * (CONFIG.GRID + 1)) / CONFIG.GRID;
        this.gridStartX = this.gameX + CONFIG.GAP;
        this.gridStartY = this.gameY + CONFIG.GAP;
        this.gridWidth = this.gameWidth;
        this.gridHeight = this.gameWidth;
        
        this.spawnY = this.gameY + this.gridHeight + 30;
        this.spawnHeight = this.gameHeight - this.gridHeight - 30;
    }

    getStoredHighScore() {
        try {
            return parseInt(localStorage.getItem('bb_highscore') || '0');
        } catch(e) {
            return 0;
        }
    }

    saveHighScore() {
        try {
            localStorage.setItem('bb_highscore', this.highScore.toString());
        } catch(e) {
            console.log('Save failed:', e);
        }
    }

    showMainMenu() {
        this.gameState = 'menu';
        this.isPlaying = false;
    }

    startGame() {
        this.init();
    }

    init() {
        this.grid = [];
        for(let i = 0; i < CONFIG.GRID; i++) {
            this.grid.push(new Array(CONFIG.GRID).fill(null));
        }

        this.pendingRewards = [];
        this.score = 0;
        this.sessionHighScore = this.highScore;
        this.lastMilestone = 0;
        this.spawnBlocks();
        this.gameState = 'playing';
        this.isPlaying = true;
    }

    setDifficulty(val) {
        this.difficulty = val;
    }

    getShapePool() {
        const EASY = [
            [[1]], [[1,1]], [[1],[1]], [[1,1],[1,0]], [[1,1,1]], [[1],[1],[1]], [[1,0],[1,1]]
        ];
        
        const NORMAL = [
            [[1,1,1,1]], [[1],[1],[1],[1]], [[1,1],[1,1]], [[1,1,0],[0,1,1]], [[0,1,1],[1,1,0]],
            [[1,1,1],[0,1,0]], [[0,1,0],[1,1,1]], [[1,0,0],[1,1,1]], [[0,0,1],[1,1,1]], [[1,1,1],[1,0,1]]
        ];
        
        const HARD = [
            [[1,1,1,1,1]], [[1],[1],[1],[1],[1]], [[1,1,1],[1,1,1],[1,1,1]], [[1,0,0],[1,0,0],[1,1,1]],
            [[0,0,1],[0,0,1],[1,1,1]], [[1,1,0],[0,1,0],[0,1,1]], [[0,1,1],[0,1,0],[1,1,0]]
        ];
        
        if(this.difficulty <= 3) return [...EASY, ...EASY, ...NORMAL.slice(0, 3)];
        if(this.difficulty <= 7) return [...EASY.slice(0, 4), ...NORMAL, ...HARD.slice(0, 4)];
        return [...NORMAL, ...HARD, ...EASY.slice(0, 2)];
    }

    spawnBlocks() {
        this.blocks = [];
        const blockInfos = [];
        const usedShapes = [];
        const usedColors = [];
        
        for(let i = 0; i < 3; i++) {
            let isBomb = false;
            if (this.pendingRewards.length > 0 && this.pendingRewards[0] === 'bomb') {
                this.pendingRewards.shift();
                isBomb = true;
            }
            
            let shape = [[1]], color = CONFIG.BOMB_COLOR;
            
            if(!isBomb) {
                const pool = this.getShapePool();
                if(pool && pool.length > 0) {
                    shape = pool[Math.floor(Math.random() * pool.length)];
                }
                color = CONFIG.COLORS[Math.floor(Math.random() * CONFIG.COLORS.length)];
            }
            
            if(!shape || !Array.isArray(shape) || shape.length === 0 || !shape[0]) {
                shape = [[1]];
            }

            const rows = shape.length;
            const cols = shape[0].length;
            const blockWidth = cols * this.cellSize * 0.6 + (cols - 1) * CONFIG.GAP * 0.6;
            const blockHeight = rows * this.cellSize * 0.6 + (rows - 1) * CONFIG.GAP * 0.6;
            
            blockInfos.push({
                shape: shape, color: color, type: isBomb ? 'bomb' : 'normal',
                width: blockWidth, height: blockHeight, rows: rows, cols: cols
            });
        }
        
        const positions = this.calculateOptimalPositions(blockInfos);
        
        for(let i = 0; i < 3; i++) {
            const blockInfo = blockInfos[i];
            const position = positions[i];
            
            this.blocks.push({
                shape: blockInfo.shape, color: blockInfo.color, type: blockInfo.type,
                x: position.x, y: position.y, cx: position.x, cy: position.y,
                scale: 0.1, targetScale: 0.6, isDragging: false
            });
        }
        this.checkGameOver();
    }

    calculateOptimalPositions(blockInfos) {
        const positions = [];
        const padding = 40;
        const screenMargin = 15;
        const availableWidth = this.gameWidth - screenMargin * 2;
        const centerY = this.spawnY + this.spawnHeight / 2;
        
        let totalWidth = 0;
        for(let i = 0; i < blockInfos.length; i++) {
            totalWidth += blockInfos[i].width;
            if(i < blockInfos.length - 1) totalWidth += padding;
        }
        
        let actualPadding = padding;
        if(totalWidth > availableWidth) {
            const totalBlockWidth = blockInfos.reduce((sum, block) => sum + block.width, 0);
            const availableSpacing = availableWidth - totalBlockWidth;
            if(availableSpacing < 0) {
                actualPadding = 8;
            } else {
                actualPadding = Math.max(15, availableSpacing / Math.max(1, blockInfos.length - 1));
            }
            totalWidth = totalBlockWidth + actualPadding * (blockInfos.length - 1);
        }
        
        let currentX = this.gameX + screenMargin + (availableWidth - totalWidth) / 2;
        
        for(let i = 0; i < blockInfos.length; i++) {
            const blockInfo = blockInfos[i];
            let targetX = currentX + blockInfo.width / 2;
            
            positions.push({ x: targetX, y: centerY });
            currentX += blockInfo.width + actualPadding;
        }
        
        return positions;
    }

    getCompletableRows(dragBlock) {
        const completableRows = [];
        if(!dragBlock || !dragBlock.shape || dragBlock.type === 'bomb') return completableRows;
        
        const r = dragBlock.shape.length, c = dragBlock.shape[0].length;
        const w = c * (this.cellSize + CONFIG.GAP), h = r * (this.cellSize + CONFIG.GAP);
        const gx = Math.round((dragBlock.currentX - this.gridStartX - w/2) / (this.cellSize + CONFIG.GAP));
        const gy = Math.round((dragBlock.currentY - this.gridStartY - h/2) / (this.cellSize + CONFIG.GAP));
        
        if(!this.canPlace(dragBlock.shape, gx, gy)) return completableRows;
        
        const tempGrid = this.grid.map(row => [...row]);
        for(let i = 0; i < r; i++) {
            for(let j = 0; j < c; j++) {
                if(dragBlock.shape[i][j] && gy + i >= 0 && gy + i < CONFIG.GRID && gx + j >= 0 && gx + j < CONFIG.GRID) {
                    tempGrid[gy + i][gx + j] = dragBlock.color;
                }
            }
        }
        
        for(let y = 0; y < CONFIG.GRID; y++) {
            if(tempGrid[y].every(cell => cell !== null)) completableRows.push(y);
        }
        
        return completableRows;
    }

    getCompletableCols(dragBlock) {
        const completableCols = [];
        if(!dragBlock || !dragBlock.shape || dragBlock.type === 'bomb') return completableCols;
        
        const r = dragBlock.shape.length, c = dragBlock.shape[0].length;
        const w = c * (this.cellSize + CONFIG.GAP), h = r * (this.cellSize + CONFIG.GAP);
        const gx = Math.round((dragBlock.currentX - this.gridStartX - w/2) / (this.cellSize + CONFIG.GAP));
        const gy = Math.round((dragBlock.currentY - this.gridStartY - h/2) / (this.cellSize + CONFIG.GAP));
        
        if(!this.canPlace(dragBlock.shape, gx, gy)) return completableCols;
        
        const tempGrid = this.grid.map(row => [...row]);
        for(let i = 0; i < r; i++) {
            for(let j = 0; j < c; j++) {
                if(dragBlock.shape[i][j] && gy + i >= 0 && gy + i < CONFIG.GRID && gx + j >= 0 && gx + j < CONFIG.GRID) {
                    tempGrid[gy + i][gx + j] = dragBlock.color;
                }
            }
        }
        
        for(let x = 0; x < CONFIG.GRID; x++) {
            let full = true;
            for(let y = 0; y < CONFIG.GRID; y++) {
                if(!tempGrid[y][x]) { full = false; break; }
            }
            if(full) completableCols.push(x);
        }
        
        return completableCols;
    }

    canPlace(shape, gx, gy) {
        if(!shape || !shape[0]) return false;
        const r = shape.length, c = shape[0].length;
        for(let i = 0; i < r; i++) {
            for(let j = 0; j < c; j++) {
                if(shape[i][j]) {
                    const nx = gx + j, ny = gy + i;
                    if(nx < 0 || nx >= CONFIG.GRID || ny < 0 || ny >= CONFIG.GRID) return false;
                    if(this.grid[ny] && this.grid[ny][nx]) return false;
                }
            }
        }
        return true;
    }

    place(block, gx, gy) {
        if(!block.shape) return;
        const mul = 0.5 + this.difficulty * 0.1;
        let earned = 0;
        
        if(block.type === 'bomb') {
            this.audioMgr.playBomb();
            let count = 0;
            for(let y = 0; y < CONFIG.GRID; y++) {
                for(let x = 0; x < CONFIG.GRID; x++) {
                    if(this.grid[y][x]) {
                        this.grid[y][x] = null;
                        this.spawnExplosion(x, y, '#fff', 2);
                        count++;
                    }
                }
            }
            earned = (count * 20 + 500) * mul;
        } else {
            const r = block.shape.length, c = block.shape[0].length;
            let count = 0;
            for(let i = 0; i < r; i++) {
                for(let j = 0; j < c; j++) {
                    if(block.shape[i][j]) {
                        this.grid[gy + i][gx + j] = block.color;
                        count++;
                    }
                }
            }
            earned = count * mul;
            this.addScore(earned);
            this.checkLines();
            earned = 0;
        }
        
        if(earned > 0) this.addScore(earned);
        this.blocks = this.blocks.filter(x => x !== block);
        if(this.blocks.length === 0) this.spawnBlocks();
        else this.checkGameOver();
    }

    checkLines() {
        const mul = 0.5 + this.difficulty * 0.1;
        const rows = [], cols = [];
        
        for(let y = 0; y < CONFIG.GRID; y++) {
            if(this.grid[y].every(x => x)) rows.push(y);
        }
        
        for(let x = 0; x < CONFIG.GRID; x++) {
            let full = true;
            for(let y = 0; y < CONFIG.GRID; y++) {
                if(!this.grid[y][x]) full = false;
            }
            if(full) cols.push(x);
        }
        
        const lines = rows.length + cols.length;
        if(lines > 0) {
            this.audioMgr.playClear(lines);
            const set = new Set();
            
            rows.forEach(y => {
                for(let x = 0; x < CONFIG.GRID; x++) {
                    set.add(x + ',' + y);
                    this.spawnExplosion(x, y, this.grid[y][x]);
                    this.grid[y][x] = null;
                }
            });
            
            cols.forEach(x => {
                for(let y = 0; y < CONFIG.GRID; y++) {
                    if(!set.has(x + ',' + y)) {
                        this.spawnExplosion(x, y, this.grid[y][x] || '#fff');
                        this.grid[y][x] = null;
                    }
                }
            });
            
            const base = set.size * 10 + lines * 20 + (lines >= 2 ? 100 : 0);
            this.addScore(base * mul);
            
            if(lines >= 2) {
                setTimeout(() => this.giveBomb(), 600);
            }
        }
    }

    addScore(val) {
        this.score += Math.floor(val);
        const ms = Math.floor(this.score / 1000) * 1000;
        if(ms > this.lastMilestone && ms > 0 && this.difficulty < 10) {
            this.lastMilestone = ms;
            this.promptLevelUp(ms);
        }
        
        if(this.score > this.highScore) {
            this.highScore = this.score;
        }
    }

    promptLevelUp(ms) {
        this.gameState = 'levelup';
        this.isPlaying = false;
    }

    confirmLevelUp(accept) {
        if(accept) {
            this.setDifficulty(this.difficulty + 1);
            this.audioMgr.playItem();
        }
        this.gameState = 'playing';
        this.isPlaying = true;
    }

    giveBomb() {
        this.audioMgr.playItem();
        if(this.blocks.length < 3) {
            this.blocks.push({
                shape: [[1]], color: CONFIG.BOMB_COLOR, type: 'bomb',
                x: this.gameX + this.gameWidth / 2, y: this.spawnY + this.spawnHeight / 2,
                cx: this.gameX + this.gameWidth / 2, cy: this.spawnY + this.spawnHeight / 2,
                scale: 0.1, targetScale: 0.6, isDragging: false
            });
        } else {
            this.pendingRewards.push('bomb');
        }
        this.checkGameOver();
    }

    checkGameOver() {
        if(this.blocks.length === 0 || this.blocks.some(b => b.type === 'bomb')) return;
        
        let alive = false;
        for(let b of this.blocks) {
            if(!b.shape || !b.shape[0]) continue;
            for(let y = 0; y < CONFIG.GRID; y++) {
                for(let x = 0; x < CONFIG.GRID; x++) {
                    if(this.canPlace(b.shape, x, y)) { alive = true; break; }
                }
                if(alive) break;
            }
            if(alive) break;
        }
        
        if(!alive) {
            this.gameState = 'gameover';
            this.isPlaying = false;
            if(this.score > this.sessionHighScore) {
                this.saveHighScore();
            }
        }
    }

    spawnExplosion(gx, gy, color, speed = 1) {
        const cx = this.gridStartX + gx * (this.cellSize + CONFIG.GAP) + this.cellSize / 2;
        const cy = this.gridStartY + gy * (this.cellSize + CONFIG.GAP) + this.cellSize / 2;
        
        const fragmentCount = Math.min(2, 4 - this.particles.length);
        for(let i = 0; i < fragmentCount; i++) {
            this.particles.push(new Particle(cx, cy, color, speed, 'fragment'));
        }
        
        const sparkCount = Math.min(3, 6 - this.particles.length);
        for(let i = 0; i < sparkCount; i++) {
            this.particles.push(new Particle(cx, cy, color, speed * 1.5, 'spark'));
        }
        
        if (this.particles.length > 20) {
            this.particles.splice(0, this.particles.length - 20);
        }
    }

    draw() {
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.screenHeight);
        bgGradient.addColorStop(0, '#0a0e1a');
        bgGradient.addColorStop(0.5, '#1a1f36');
        bgGradient.addColorStop(1, '#0f1426');
        
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);
        
        if(this.gameState === 'menu') this.drawMenu();
        else if(this.gameState === 'playing') this.drawGame();
        else if(this.gameState === 'gameover') this.drawGameOver();
        else if(this.gameState === 'levelup') this.drawLevelUp();
    }

    drawMenu() {
        const topSafeArea = this.topSafeArea;
        const safeScreenHeight = this.screenHeight - topSafeArea;
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Block Blast', this.screenWidth / 2, topSafeArea + safeScreenHeight / 3);
        
        this.ctx.font = '24px Arial';
        this.ctx.fillText('Best: ' + this.highScore, this.screenWidth / 2, topSafeArea + safeScreenHeight / 2 - 40);
        
        this.drawButton(this.screenWidth / 2 - 100, topSafeArea + safeScreenHeight * 2 / 3 - 80, 200, 60, 'Start Game', '#ff4757');
    }

    drawGameOver() {
        this.drawGame();
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);
        
        const topSafeArea = this.topSafeArea;
        const safeScreenHeight = this.screenHeight - topSafeArea;
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 36px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Game Over', this.screenWidth / 2, topSafeArea + safeScreenHeight / 3);
        
        this.ctx.font = '24px Arial';
        this.ctx.fillText('Score: ' + this.score, this.screenWidth / 2, topSafeArea + safeScreenHeight / 2 - 40);
        
        this.drawButton(this.screenWidth / 2 - 100, topSafeArea + safeScreenHeight * 2 / 3 - 60, 200, 50, 'Restart', '#2ed573');
    }

    drawLevelUp() {
        this.drawGame();
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);
        
        const topSafeArea = this.topSafeArea;
        const safeScreenHeight = this.screenHeight - topSafeArea;
        
        this.ctx.fillStyle = '#ffd700';
        this.ctx.font = 'bold 32px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Level Up!', this.screenWidth / 2, topSafeArea + safeScreenHeight / 3);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '20px Arial';
        this.ctx.fillText('Congratulations on ' + this.lastMilestone + ' points!', this.screenWidth / 2, topSafeArea + safeScreenHeight / 2 - 20);
        this.ctx.fillText('Increase difficulty to ' + (this.difficulty + 1) + '?', this.screenWidth / 2, topSafeArea + safeScreenHeight / 2 + 20);
        
        this.drawButton(this.screenWidth / 2 - 110, topSafeArea + safeScreenHeight * 2 / 3, 100, 50, 'Accept', '#1e90ff');
        this.drawButton(this.screenWidth / 2 + 10, topSafeArea + safeScreenHeight * 2 / 3, 100, 50, 'Keep', '#666666');
    }

    drawButton(x, y, width, height, text, color) {
        const radius = height * 0.2;
        
        this.ctx.fillStyle = color;
        this.drawRoundedRect(x, y, width, height, radius);
        this.ctx.fill();
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.drawRoundedRect(x, y, width, height * 0.5, radius);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(text, x + width / 2, y + height / 2 + 6);
    }

    drawGame() {
        const topOffset = this.topSafeArea + 20;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Score: ' + this.score, 20, topOffset);
        
        if (this.score > this.sessionHighScore) {
            this.ctx.fillStyle = '#ffd700';
            this.ctx.fillText('Best: ' + this.sessionHighScore + ' (New Record!)', 20, topOffset + 30);
        } else {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText('Best: ' + this.sessionHighScore, 20, topOffset + 30);
        }
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText('Level: ' + this.difficulty, 20, topOffset + 60);
        
        let completableRows = [];
        let completableCols = [];
        let dragBlockColor = null;
        
        if(this.dragBlock && this.dragBlock.isDragging && this.dragBlock.type !== 'bomb') {
            completableRows = this.getCompletableRows(this.dragBlock);
            completableCols = this.getCompletableCols(this.dragBlock);
            dragBlockColor = this.dragBlock.color;
        }
        
        this.ctx.fillStyle = CONFIG.GRID_BG;
        this.drawRoundedRect(
            this.gridStartX - CONFIG.GAP, 
            this.gridStartY - CONFIG.GAP, 
            this.gridWidth + CONFIG.GAP * 2, 
            this.gridHeight + CONFIG.GAP * 2, 
            8
        );
        this.ctx.fill();
        
        for(let y = 0; y < CONFIG.GRID; y++) {
            for(let x = 0; x < CONFIG.GRID; x++) {
                const px = this.gridStartX + x * (this.cellSize + CONFIG.GAP);
                const py = this.gridStartY + y * (this.cellSize + CONFIG.GAP);
                
                const isRowCompletable = completableRows.includes(y);
                const isColCompletable = completableCols.includes(x);
                const shouldHighlight = isRowCompletable || isColCompletable;
                
                if(shouldHighlight && dragBlockColor) {
                    const pulseIntensity = Math.sin(this.time * 0.15) * 0.3 + 0.7;
                    
                    this.ctx.save();
                    this.ctx.globalAlpha = 0.6 * pulseIntensity;
                    this.drawStylizedBlock(px, py, this.cellSize, dragBlockColor, 1);
                    this.ctx.restore();
                    
                    this.ctx.save();
                    this.ctx.strokeStyle = dragBlockColor.light || '#ffffff';
                    this.ctx.lineWidth = 3;
                    this.ctx.globalAlpha = pulseIntensity;
                    this.drawRoundedRect(px - 2, py - 2, this.cellSize + 4, this.cellSize + 4, this.cellSize * 0.15);
                    this.ctx.stroke();
                    this.ctx.restore();
                } else {
                    if(this.grid[y] && this.grid[y][x]) {
                        this.drawStylizedBlock(px, py, this.cellSize, this.grid[y][x]);
                    } else {
                        this.drawEmptyCell(px, py, this.cellSize);
                    }
                }
            }
        }
        
        if(this.blocks && this.blocks.length > 0) {
            this.blocks.forEach(block => {
                if(!block || !block.shape || !Array.isArray(block.shape) || block.shape.length === 0 || !block.shape[0]) return;
                
                if(!block.isDragging) {
                    block.cx += (block.x - block.cx) * 0.2;
                    block.cy += (block.y - block.cy) * 0.2;
                    block.scale += (block.targetScale - block.scale) * 0.2;
                } else {
                    block.cx = block.currentX;
                    block.cy = block.currentY;
                    block.scale = block.targetScale;
                }
                
                const size = this.cellSize * block.scale;
                
                if(block.type === 'bomb') {
                    this.drawBomb(block.cx, block.cy, size);
                } else {
                    const rows = block.shape.length;
                    const cols = block.shape[0].length;
                    const totalWidth = cols * size + (cols - 1) * CONFIG.GAP * block.scale;
                    const totalHeight = rows * size + (rows - 1) * CONFIG.GAP * block.scale;
                    const startX = block.cx - totalWidth / 2;
                    const startY = block.cy - totalHeight / 2;
                    
                    for(let i = 0; i < rows; i++) {
                        for(let j = 0; j < cols; j++) {
                            if(block.shape[i][j]) {
                                const x = startX + j * (size + CONFIG.GAP * block.scale);
                                const y = startY + i * (size + CONFIG.GAP * block.scale);
                                const alpha = block.isDragging ? 0.9 : 1.0;
                                this.drawStylizedBlock(x, y, size, block.color, alpha);
                            }
                        }
                    }
                }
            });
        }
        
        this.particles.forEach(p => p.draw(this.ctx));
    }

    drawBomb(x, y, size) {
        const pulse = Math.sin(this.time * 0.08) * 0.15 + 1;
        const radius = size / 2 * pulse;
        
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        const outerGlow = this.ctx.createRadialGradient(x, y, 0, x, y, radius * 1.5);
        outerGlow.addColorStop(0, '#ff6b35');
        outerGlow.addColorStop(1, 'rgba(255, 107, 53, 0)');
        this.ctx.fillStyle = outerGlow;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        
        const gradient = this.ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
        gradient.addColorStop(0, '#fff3a0');
        gradient.addColorStop(0.3, '#ffcc00');
        gradient.addColorStop(0.7, '#ff6600');
        gradient.addColorStop(1, '#cc0000');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.save();
        this.ctx.globalAlpha = 0.8;
        const highlight = this.ctx.createRadialGradient(
            x - radius * 0.4, y - radius * 0.4, 0,
            x - radius * 0.4, y - radius * 0.4, radius * 0.6
        );
        highlight.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
        this.ctx.fillStyle = highlight;
        this.ctx.beginPath();
        this.ctx.arc(x - radius * 0.2, y - radius * 0.2, radius * 0.4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        
        this.ctx.save();
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.globalAlpha = Math.sin(this.time * 0.2) * 0.5 + 0.5;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
        
        for(let i = 0; i < 6; i++) {
            const angle = (this.time * 0.1 + i * Math.PI / 3) % (Math.PI * 2);
            const sparkX = x + Math.cos(angle) * radius * 0.6;
            const sparkY = y + Math.sin(angle) * radius * 0.6;
            
            this.ctx.save();
            this.ctx.globalAlpha = Math.sin(this.time * 0.15 + i) * 0.3 + 0.4;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(sparkX, sparkY, 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }
    }

    update() {
        this.time++;
        
        for(let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            if(this.particles[i].life <= 0) this.particles.splice(i, 1);
        }
    }

    gameLoop() {
        this.update();
        this.draw();
        
        requestAnimationFrame(() => this.gameLoop());
    }

    bindTouchEvents() {
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if(!e.touches || e.touches.length === 0) return;
            
            const touch = e.touches[0];
            const x = touch.clientX;
            const y = touch.clientY;
            
            if(this.gameState === 'menu') {
                const topSafeArea = this.topSafeArea;
                const safeScreenHeight = this.screenHeight - topSafeArea;
                
                if(this.isPointInButton(x, y, this.screenWidth / 2 - 100, topSafeArea + safeScreenHeight * 2 / 3 - 80, 200, 60)) {
                    this.startGame();
                }
            } else if(this.gameState === 'gameover') {
                const topSafeArea = this.topSafeArea;
                const safeScreenHeight = this.screenHeight - topSafeArea;
                
                if(this.isPointInButton(x, y, this.screenWidth / 2 - 100, topSafeArea + safeScreenHeight * 2 / 3 - 60, 200, 50)) {
                    this.startGame();
                }
            } else if(this.gameState === 'levelup') {
                const topSafeArea = this.topSafeArea;
                const safeScreenHeight = this.screenHeight - topSafeArea;
                
                if(this.isPointInButton(x, y, this.screenWidth / 2 - 110, topSafeArea + safeScreenHeight * 2 / 3, 100, 50)) {
                    this.confirmLevelUp(true);
                } else if(this.isPointInButton(x, y, this.screenWidth / 2 + 10, topSafeArea + safeScreenHeight * 2 / 3, 100, 50)) {
                    this.confirmLevelUp(false);
                }
            } else if(this.gameState === 'playing' && this.isPlaying) {
                this.handleTouchStart(x, y);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if(!e.touches || e.touches.length === 0) return;
            if(this.gameState !== 'playing' || !this.isPlaying) return;
            
            const touch = e.touches[0];
            this.handleTouchMove(touch.clientX, touch.clientY);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if(this.gameState !== 'playing' || !this.isPlaying) return;
            this.handleTouchEnd();
        }, { passive: false });
        
        // Mouse event support (for PC debugging)
        this.canvas.addEventListener('mousedown', (e) => {
            const x = e.clientX;
            const y = e.clientY;
            
            if(this.gameState === 'menu') {
                const topSafeArea = this.topSafeArea;
                const safeScreenHeight = this.screenHeight - topSafeArea;
                if(this.isPointInButton(x, y, this.screenWidth / 2 - 100, topSafeArea + safeScreenHeight * 2 / 3 - 80, 200, 60)) {
                    this.startGame();
                }
            } else if(this.gameState === 'gameover') {
                const topSafeArea = this.topSafeArea;
                const safeScreenHeight = this.screenHeight - topSafeArea;
                if(this.isPointInButton(x, y, this.screenWidth / 2 - 100, topSafeArea + safeScreenHeight * 2 / 3 - 60, 200, 50)) {
                    this.startGame();
                }
            } else if(this.gameState === 'levelup') {
                const topSafeArea = this.topSafeArea;
                const safeScreenHeight = this.screenHeight - topSafeArea;
                if(this.isPointInButton(x, y, this.screenWidth / 2 - 110, topSafeArea + safeScreenHeight * 2 / 3, 100, 50)) {
                    this.confirmLevelUp(true);
                } else if(this.isPointInButton(x, y, this.screenWidth / 2 + 10, topSafeArea + safeScreenHeight * 2 / 3, 100, 50)) {
                    this.confirmLevelUp(false);
                }
            } else if(this.gameState === 'playing' && this.isPlaying) {
                this.handleTouchStart(x, y);
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if(this.gameState !== 'playing' || !this.isPlaying) return;
            this.handleTouchMove(e.clientX, e.clientY);
        });

        this.canvas.addEventListener('mouseup', () => {
            if(this.gameState !== 'playing' || !this.isPlaying) return;
            this.handleTouchEnd();
        });
    }

    isPointInButton(x, y, buttonX, buttonY, buttonWidth, buttonHeight) {
        return x >= buttonX && x <= buttonX + buttonWidth && 
               y >= buttonY && y <= buttonY + buttonHeight;
    }

    handleTouchStart(x, y) {
        let bestBlock = null;
        let minDistance = Infinity;
        
        for(let block of this.blocks) {
            if(!block || !block.shape) continue;
            
            const dx = x - block.cx;
            const dy = y - block.cy;
            const distance = dx * dx + dy * dy;
            
            if(Math.abs(dx) < this.gameWidth / 6 && Math.abs(dy) < this.cellSize * 3) {
                if(distance < minDistance) {
                    minDistance = distance;
                    bestBlock = block;
                }
            }
        }
        
        if(bestBlock) {
            this.dragBlock = bestBlock;
            bestBlock.isDragging = true;
            bestBlock.targetScale = 1.0;
            bestBlock.scale = 1.0;
            
            const blockRows = bestBlock.shape.length;
            const blockCols = bestBlock.shape[0].length;
            const blockHeight = blockRows * this.cellSize + (blockRows - 1) * CONFIG.GAP;
            
            const baseOffset = 40;
            const safetyMargin = 20;
            const yOffset = -(blockHeight/2 + baseOffset + safetyMargin);
            
            this.dragOffset = { x: 0, y: yOffset };
            
            bestBlock.currentX = x + this.dragOffset.x;
            bestBlock.currentY = y + this.dragOffset.y;
            bestBlock.cx = bestBlock.currentX;
            bestBlock.cy = bestBlock.currentY;
            
            this.fingerPosition = { x: x, y: y };
            
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }
    }

    handleTouchMove(x, y) {
        if(!this.dragBlock) return;
        
        this.dragBlock.currentX = x + this.dragOffset.x;
        this.dragBlock.currentY = y + this.dragOffset.y;
        this.dragBlock.cx = this.dragBlock.currentX;
        this.dragBlock.cy = this.dragBlock.currentY;
        
        this.fingerPosition = { x: x, y: y };
    }

    handleTouchEnd() {
        if(!this.dragBlock) return;
        
        const block = this.dragBlock;
        if(block && block.shape && block.shape[0]) {
            const r = block.shape.length;
            const c = block.shape[0].length;
            const w = c * (this.cellSize + CONFIG.GAP);
            const h = r * (this.cellSize + CONFIG.GAP);
            const gx = Math.round((block.currentX - this.gridStartX - w/2) / (this.cellSize + CONFIG.GAP));
            const gy = Math.round((block.currentY - this.gridStartY - h/2) / (this.cellSize + CONFIG.GAP));
            
            let canPlace = false;
            if(block.type === 'bomb') {
                if(gx >= 0 && gx < CONFIG.GRID && gy >= 0 && gy < CONFIG.GRID) {
                    canPlace = true;
                }
            } else {
                canPlace = this.canPlace(block.shape, gx, gy);
            }
            
            if(canPlace) {
                this.audioMgr.playPlace();
                this.place(block, gx, gy);
            } else {
                block.isDragging = false;
                block.targetScale = 0.6;
            }
        } else if(block) {
            block.isDragging = false;
        }
        
        this.dragBlock = null;
        this.fingerPosition = null;
    }
}

// Start Game
window.game = new BlockBlast();
