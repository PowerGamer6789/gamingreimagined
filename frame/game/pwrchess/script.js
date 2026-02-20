import { auth } from "/creds.js";

let board = [], turn = 'w', selected = null, isThinking = false, captures = { w: [], b: [] };
const GLYPHS = {'wk':'♔','wq':'♕','wr':'♖','wb':'♗','wn':'♘','wp':'♙','bk':'♚','bq':'♛','br':'♜','bb':'♝','bn':'♞','bp':'♟'};

window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('splash').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('splash').classList.add('hidden');
            document.getElementById('menu').classList.remove('hidden');
        }, 800);
    }, 2000);
});

window.openModal = () => document.getElementById('modal').classList.remove('hidden');
window.closeModal = () => document.getElementById('modal').classList.add('hidden');

window.startGame = (lvl, label) => {
    document.getElementById('bot-lvl').innerText = label.toUpperCase();
    document.getElementById('modal').classList.add('hidden');
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('game').classList.remove('hidden');
    init();
};

function init() {
    board = [
        ['br','bn','bb','bq','bk','bb','bn','br'],
        ['bp','bp','bp','bp','bp','bp','bp','bp'],
        ...Array(4).fill(null).map(() => Array(8).fill('')),
        ['wp','wp','wp','wp','wp','wp','wp','wp'],
        ['wr','wn','wb','wq','wk','wb','wn','wr']
    ];
    turn = 'w'; captures = { w: [], b: [] };
    render();
}

function render() {
    const el = document.getElementById('board');
    el.innerHTML = '';
    board.forEach((row, r) => {
        row.forEach((pc, c) => {
            const sq = document.createElement('div');
            sq.className = `square ${(r+c)%2===0?'w-sq':'b-sq'}`;
            if(selected && selected.r === r && selected.c === c) sq.classList.add('selected');
            if(pc) {
                const s = document.createElement('span');
                s.innerText = GLYPHS[pc];
                sq.appendChild(s);
            }
            sq.onclick = () => handleClick(r, c);
            el.appendChild(sq);
        });
    });
    document.getElementById('cap-w').innerHTML = captures.w.map(p => `<span>${GLYPHS[p]}</span>`).join('');
    document.getElementById('cap-b').innerHTML = captures.b.map(p => `<span>${GLYPHS[p]}</span>`).join('');
}

function handleClick(r, c) {
    if(turn !== 'w' || isThinking) return;
    if(selected) {
        const moves = getMoves(selected.r, selected.c);
        if(moves.some(m => m.r === r && m.c === c)) {
            executeMove(selected.r, selected.c, r, c);
            return;
        }
    }
    if(board[r][c] && board[r][c][0] === 'w') {
        selected = {r, c};
        render();
        getMoves(r, c).forEach(m => {
            const d = document.createElement('div'); d.className = 'dot';
            document.getElementById('board').children[m.r * 8 + m.c].appendChild(d);
        });
    } else {
        selected = null; render();
    }
}

function getMoves(r, c) {
    const p = board[r][c]; if(!p) return [];
    const moves = []; const dir = p[0] === 'w' ? -1 : 1;
    if(p[1] === 'p') {
        if(board[r+dir] && !board[r+dir][c]) {
            moves.push({r: r+dir, c});
            if(((p[0]==='w'&&r===6)||(p[0]==='b'&&r===1)) && !board[r+dir][c] && !board[r+2*dir][c]) moves.push({r: r+2*dir, c});
        }
        [-1, 1].forEach(s => {
            if(board[r+dir] && board[r+dir][c+s] && board[r+dir][c+s][0] !== p[0]) moves.push({r: r+dir, c: c+s});
        });
    }
    return moves;
}

function executeMove(r1, c1, r2, c2) {
    const p = board[r1][c1]; const cap = board[r2][c2];
    if(cap) captures[p[0]].push(cap);
    board[r2][c2] = p; board[r1][c1] = '';
    
    document.getElementById('history').innerHTML = `<div>${p.toUpperCase()} ${String.fromCharCode(97+c2)}${8-r2}</div>` + document.getElementById('history').innerHTML;
    selected = null; render();
    
    turn = 'b'; isThinking = true;
    document.getElementById('turn-badge').innerText = "Engine is moving...";
    setTimeout(enginePlay, 1000);
}

function enginePlay() {
    let allMoves = [];
    board.forEach((row, r) => row.forEach((pc, c) => {
        if(pc && pc[0] === 'b') {
            getMoves(r, c).forEach(m => allMoves.push({f: {r,c}, t: m}));
        }
    }));

    if(allMoves.length) {
        const m = allMoves[Math.floor(Math.random() * allMoves.length)];
        const p = board[m.f.r][m.f.c]; const cap = board[m.t.r][m.t.c];
        if(cap) captures['b'].push(cap);
        board[m.t.r][m.t.c] = p; board[m.f.r][m.f.c] = '';
    }

    turn = 'w'; isThinking = false;
    document.getElementById('turn-badge').innerText = "White to move";
    render();
}