const ASSETS = {
    'k': 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg',
    'q': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
    'r': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
    'b': 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
    'n': 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
    'p': 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
    'K': 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
    'Q': 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
    'R': 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
    'B': 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
    'N': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
    'P': 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg'
};

let state = {
    board: [],
    selected: null,
    turn: 'W',
    isPvP: false,
    moves: 1,
    gameOver: false
};

window.onload = () => {
    setTimeout(() => {
        document.getElementById('splash').classList.add('hidden');
        document.getElementById('main-menu').classList.remove('hidden');
    }, 2000);

    document.getElementById('play-btn').onclick = () => document.getElementById('popup-overlay').classList.remove('hidden');
    document.getElementById('p2-btn').onclick = () => { state.isPvP = true; startGame(); };
    document.querySelectorAll('.diff-opt').forEach(btn => btn.onclick = () => { state.isPvP = false; startGame(); });
};

function closePopup() { document.getElementById('popup-overlay').classList.add('hidden'); }

function resetToMenu() {
    document.getElementById('game-view').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    state.gameOver = false;
}

function startGame() {
    closePopup();
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-view').classList.remove('hidden');
    initGame();
}

function initGame() {
    state.board = [
        ['r','n','b','q','k','b','n','r'],
        ['p','p','p','p','p','p','p','p'],
        ...Array(4).fill(null).map(() => Array(8).fill(null)),
        ['P','P','P','P','P','P','P','P'],
        ['R','N','B','Q','K','B','N','R']
    ];
    state.turn = 'W'; state.moves = 1; state.gameOver = false; state.selected = null;
    document.getElementById('log-content').innerHTML = '';
    document.getElementById('captured-white').innerHTML = '';
    document.getElementById('captured-black').innerHTML = '';
    document.getElementById('winner-overlay').classList.add('hidden');
    document.getElementById('status').innerText = "White's Turn";
    render();
}

const isWhite = (p) => p && p === p.toUpperCase();

function getMoves(r, c) {
    const p = state.board[r][c];
    if (!p) return [];
    const char = p.toLowerCase(), white = isWhite(p), moves = [];
    const onBoard = (nr, nc) => nr >= 0 && nr < 8 && nc >= 0 && nc < 8;

    if (char === 'p') {
        const dir = white ? -1 : 1;
        if (onBoard(r+dir, c) && !state.board[r+dir][c]) {
            moves.push([r+dir, c]);
            if (r === (white ? 6 : 1) && !state.board[r+2*dir][c]) moves.push([r+2*dir, c]);
        }
        for(let dc of [-1,1]) if (onBoard(r+dir, c+dc) && state.board[r+dir][c+dc] && isWhite(state.board[r+dir][c+dc]) !== white) moves.push([r+dir, c+dc]);
    } else if (char === 'n') {
        [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]].forEach(([dr, dc]) => {
            const nr = r+dr, nc = c+dc;
            if (onBoard(nr, nc) && (!state.board[nr][nc] || isWhite(state.board[nr][nc]) !== white)) moves.push([nr, nc]);
        });
    } else if (char === 'k') {
        for(let dr=-1; dr<=1; dr++) for(let dc=-1; dc<=1; dc++) {
            if (dr===0 && dc===0) continue;
            const nr = r+dr, nc = c+dc;
            if (onBoard(nr, nc) && (!state.board[nr][nc] || isWhite(state.board[nr][nc]) !== white)) moves.push([nr, nc]);
        }
    } else {
        let dirs = (char === 'r' || char === 'q' ? [[1,0],[-1,0],[0,1],[0,-1]] : []).concat(char === 'b' || char === 'q' ? [[1,1],[1,-1],[-1,1],[-1,-1]] : []);
        dirs.forEach(([dr, dc]) => {
            let nr = r+dr, nc = c+dc;
            while (onBoard(nr, nc)) {
                if (!state.board[nr][nc]) moves.push([nr, nc]);
                else { if (isWhite(state.board[nr][nc]) !== white) moves.push([nr, nc]); break; }
                nr += dr; nc += dc;
            }
        });
    }
    return moves;
}

function render() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';
    const dots = state.selected ? getMoves(state.selected.r, state.selected.c) : [];

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = document.createElement('div');
            sq.className = `square ${(r + c) % 2 === 0 ? 'white-sq' : 'black-sq'}`;
            if (state.selected?.r === r && state.selected?.c === c) sq.classList.add('selected');
            
            if (state.board[r][c]) {
                const img = document.createElement('img');
                img.src = ASSETS[state.board[r][c]];
                img.style.width = "85%";
                sq.appendChild(img);
            }
            
            if (dots.some(m => m[0] === r && m[1] === c)) {
                const dot = document.createElement('div');
                dot.className = 'dot';
                sq.appendChild(dot);
            }
            sq.onclick = () => handleSquareClick(r, c);
            boardEl.appendChild(sq);
        }
    }
}

function handleSquareClick(r, c) {
    if (state.gameOver) return;
    const p = state.board[r][c];
    if (state.selected) {
        const moves = getMoves(state.selected.r, state.selected.c);
        if (moves.some(m => m[0] === r && m[1] === c)) {
            executeMove(state.selected.r, state.selected.c, r, c);
            state.selected = null; render();
            if (!state.isPvP && state.turn === 'B' && !state.gameOver) setTimeout(aiMove, 500);
            return;
        }
    }
    if (p && ((state.turn === 'W' && isWhite(p)) || (state.turn === 'B' && state.isPvP && !isWhite(p)))) state.selected = {r, c};
    else state.selected = null;
    render();
}

function executeMove(fR, fC, tR, tC) {
    const piece = state.board[fR][fC], target = state.board[tR][tC], files = ['a','b','c','d','e','f','g','h'];
    const log = document.getElementById('log-content'), entry = document.createElement('div');
    entry.innerText = `${state.moves++}. ${state.turn}: ${piece.toUpperCase()}${files[fC]}${8-fR} > ${files[tC]}${8-tR}`;
    log.prepend(entry);

    if (target) {
        const grave = isWhite(target) ? 'captured-white' : 'captured-black';
        const img = document.createElement('img'); img.src = ASSETS[target];
        document.getElementById(grave).appendChild(img);
        if (target.toLowerCase() === 'k') endMatch(state.turn === 'W' ? "WHITE WINS!" : "BLACK WINS!");
    }

    state.board[tR][tC] = piece; state.board[fR][fC] = null;
    if (piece.toLowerCase() === 'p' && (tR === 0 || tR === 7)) state.board[tR][tC] = isWhite(piece) ? 'Q' : 'q';
    
    state.turn = (state.turn === 'W') ? 'B' : 'W';
    document.getElementById('status').innerText = `${state.turn === 'W' ? "White" : "Black"}'s Turn`;
}

function endMatch(msg) {
    state.gameOver = true;
    document.getElementById('winner-text').innerText = msg;
    document.getElementById('winner-overlay').classList.remove('hidden');
}

function aiMove() {
    if (state.gameOver) return;
    let moves = [];
    for(let r=0; r<8; r++) for(let c=0; c<8; c++) if (state.board[r][c] && !isWhite(state.board[r][c])) getMoves(r, c).forEach(m => moves.push({f:[r,c], t:m}));
    if (moves.length) {
        const captures = moves.filter(m => state.board[m.t[0]][m.t[1]] !== null);
        const move = captures.length ? captures[Math.floor(Math.random()*captures.length)] : moves[Math.floor(Math.random()*moves.length)];
        executeMove(move.f[0], move.f[1], move.t[0], move.t[1]);
        render();
    } else { endMatch("WHITE WINS!"); }
}