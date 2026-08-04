// Server-authoritative logic for all in-chat mini-games.
// Every game exposes: createInitialState(), applyMove(state, move, playerIndex) -> { state, error? },
// and each state carries `status` ("active" | "won" | "draw") and `winner` (0, 1, or null).
// playerIndex is 0 or 1 (index into the session's players[] array — NOT a userId).

export const GAME_TYPES = {
  ttt: "Tic Tac Toe",
  wordguess: "Word Guess",
  truthdare: "Truth or Dare",
  quiz: "Mini Quiz",
  chess: "Chess",
  ludo: "Ludo",
  uno: "UNO",
};

// Game types whose state contains hidden/secret info that must be tailored per-player
// before being sent to clients (see sanitizeStateForClient's playerIndex param).
export const PER_PLAYER_GAMES = new Set(["uno"]);

// ---------- Tic Tac Toe ----------
const ttt = {
  createInitialState() {
    return {
      board: Array(9).fill(null),
      turn: 0,
      status: "active",
      winner: null,
    };
  },
  applyMove(state, move, playerIndex) {
    if (state.status !== "active") return { state, error: "Game already finished" };
    if (state.turn !== playerIndex) return { state, error: "Not your turn" };
    const idx = move?.index;
    if (typeof idx !== "number" || idx < 0 || idx > 8 || state.board[idx] !== null) {
      return { state, error: "Invalid move" };
    }
    const board = [...state.board];
    board[idx] = playerIndex;
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    let winner = null;
    for (const [a, b, c] of lines) {
      if (board[a] !== null && board[a] === board[b] && board[b] === board[c]) winner = board[a];
    }
    const isDraw = !winner && board.every((c) => c !== null);
    return {
      state: {
        board,
        turn: 1 - playerIndex,
        status: winner !== null ? "won" : isDraw ? "draw" : "active",
        winner,
      },
    };
  },
};

// ---------- Word Guess (cooperative Hangman) ----------
const WORD_LIST = [
  "PYTHON", "GUITAR", "PLANET", "BRIDGE", "CANDLE", "DESERT", "FRIEND", "GARDEN",
  "HAMMER", "ISLAND", "JACKET", "KITCHEN", "LANTERN", "MIRROR", "NOODLE", "ORANGE",
  "PUZZLE", "QUIVER", "RIBBON", "SHADOW", "TUNNEL", "UMBRELLA", "VELVET", "WINDOW",
  "YELLOW", "ZEBRA", "CASTLE", "DOLPHIN", "ELEPHANT", "FEATHER",
];
const wordguess = {
  createInitialState() {
    const word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
    return {
      word,
      guessed: [],
      wrong: [],
      livesLeft: 6,
      turn: 0,
      status: "active",
      winner: null,
    };
  },
  applyMove(state, move, playerIndex) {
    if (state.status !== "active") return { state, error: "Game already finished" };
    if (state.turn !== playerIndex) return { state, error: "Not your turn" };
    const letter = (move?.letter || "").toUpperCase();
    if (!/^[A-Z]$/.test(letter)) return { state, error: "Invalid letter" };
    if (state.guessed.includes(letter) || state.wrong.includes(letter)) {
      return { state, error: "Already guessed" };
    }
    const guessed = [...state.guessed];
    const wrong = [...state.wrong];
    let livesLeft = state.livesLeft;
    if (state.word.includes(letter)) {
      guessed.push(letter);
    } else {
      wrong.push(letter);
      livesLeft -= 1;
    }
    const solved = state.word.split("").every((ch) => guessed.includes(ch));
    const status = solved ? "won" : livesLeft <= 0 ? "draw" : "active";
    return {
      state: {
        word: state.word,
        guessed,
        wrong,
        livesLeft,
        turn: 1 - playerIndex,
        status,
        // co-op game: "won" means both players win together, no single winner
        winner: solved ? "both" : livesLeft <= 0 ? null : null,
      },
    };
  },
};

// ---------- Truth or Dare ----------
const TRUTHS = [
  "What's a habit you're trying to break?",
  "What's the most embarrassing thing you've done this year?",
  "What's a secret talent nobody knows about?",
  "What's your biggest fear?",
  "What's the last lie you told?",
  "Who was your first crush?",
  "What's something you've never told your parents?",
  "What's your guilty pleasure?",
];
const DARES = [
  "Send a voice note singing your favorite song.",
  "Text your last contact 'I miss you' (platonically!).",
  "Post your most recent photo as your status.",
  "Type your next 3 messages using only emojis.",
  "Do 10 jumping jacks right now.",
  "Talk in a funny accent for the next 3 messages.",
  "Send a selfie with a silly face.",
];
const truthdare = {
  createInitialState() {
    return {
      turn: 0,
      awaitingChoice: true, // current turn player must pick truth/dare
      prompt: null,
      round: 1,
      status: "active",
      winner: null,
    };
  },
  applyMove(state, move, playerIndex) {
    if (state.status !== "active") return { state, error: "Game already finished" };
    if (state.turn !== playerIndex) return { state, error: "Not your turn" };
    if (state.awaitingChoice) {
      const choice = move?.choice;
      if (choice !== "truth" && choice !== "dare") return { state, error: "Choose truth or dare" };
      const list = choice === "truth" ? TRUTHS : DARES;
      const prompt = list[Math.floor(Math.random() * list.length)];
      return { state: { ...state, awaitingChoice: false, prompt, choice } };
    }
    // "done" move: pass turn to the other player for the next round
    if (move?.action !== "done") return { state, error: "Waiting for the prompt to be completed" };
    const finished = state.round >= 10; // 10 rounds total, then game ends amicably
    return {
      state: {
        turn: 1 - playerIndex,
        awaitingChoice: true,
        prompt: null,
        round: state.round + 1,
        status: finished ? "draw" : "active",
        winner: null,
      },
    };
  },
};

// ---------- Mini Quiz ----------
const QUESTIONS = [
  { q: "What is the capital of Japan?", options: ["Seoul", "Tokyo", "Beijing", "Bangkok"], answer: 1 },
  { q: "How many continents are there?", options: ["5", "6", "7", "8"], answer: 2 },
  { q: "What planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], answer: 1 },
  { q: "What's the chemical symbol for gold?", options: ["Ag", "Au", "Gd", "Go"], answer: 1 },
  { q: "Who wrote 'Romeo and Juliet'?", options: ["Dickens", "Shakespeare", "Tolstoy", "Homer"], answer: 1 },
  { q: "What's the largest ocean on Earth?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: 3 },
  { q: "How many legs does a spider have?", options: ["6", "8", "10", "12"], answer: 1 },
  { q: "What's the smallest prime number?", options: ["0", "1", "2", "3"], answer: 2 },
  { q: "Which gas do plants absorb from the air?", options: ["Oxygen", "Nitrogen", "CO2", "Helium"], answer: 2 },
  { q: "What's the freezing point of water in Celsius?", options: ["0", "10", "32", "-1"], answer: 0 },
];
function pickQuestions(n) {
  const shuffled = [...QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
const quiz = {
  createInitialState() {
    const questions = pickQuestions(5);
    return {
      questions: questions.map((q) => ({ q: q.q, options: q.options })), // answers hidden from client
      _answers: questions.map((q) => q.answer),
      currentIndex: 0,
      scores: [0, 0],
      answeredThisRound: {},
      status: "active",
      winner: null,
    };
  },
  applyMove(state, move, playerIndex) {
    if (state.status !== "active") return { state, error: "Game already finished" };
    if (state.answeredThisRound[playerIndex] !== undefined) {
      return { state, error: "You already answered this question" };
    }
    const choice = move?.choice;
    if (typeof choice !== "number") return { state, error: "Invalid answer" };
    const answeredThisRound = { ...state.answeredThisRound, [playerIndex]: choice };
    const bothAnswered = answeredThisRound[0] !== undefined && answeredThisRound[1] !== undefined;
    if (!bothAnswered) {
      return { state: { ...state, answeredThisRound } };
    }
    const correct = state._answers[state.currentIndex];
    const scores = [...state.scores];
    if (answeredThisRound[0] === correct) scores[0] += 1;
    if (answeredThisRound[1] === correct) scores[1] += 1;
    const nextIndex = state.currentIndex + 1;
    const isLast = nextIndex >= state.questions.length;
    return {
      state: {
        ...state,
        scores,
        currentIndex: isLast ? state.currentIndex : nextIndex,
        answeredThisRound: {},
        lastResult: { correct, picks: answeredThisRound },
        status: isLast ? "won" : "active",
        winner: isLast ? (scores[0] === scores[1] ? "both" : scores[0] > scores[1] ? 0 : 1) : null,
      },
    };
  },
};

// ---------- Chess (simplified: legal piece movement only, no check/checkmate/castling/en-passant) ----------
function chessInitialBoard() {
  // 8x8, row 0 = black back rank, row 7 = white back rank. null or {piece, color}
  const back = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = { piece: back[c], color: "b" };
    board[1][c] = { piece: "P", color: "b" };
    board[6][c] = { piece: "P", color: "w" };
    board[7][c] = { piece: back[c], color: "w" };
  }
  return board;
}
function chessPathClear(board, r1, c1, r2, c2) {
  const dr = Math.sign(r2 - r1);
  const dc = Math.sign(c2 - c1);
  let r = r1 + dr, c = c1 + dc;
  while (r !== r2 || c !== c2) {
    if (board[r][c]) return false;
    r += dr;
    c += dc;
  }
  return true;
}
function chessLegalShape(board, from, to, piece, color) {
  const [r1, c1] = from, [r2, c2] = to;
  const dr = r2 - r1, dc = c2 - c1;
  const target = board[r2][c2];
  if (target && target.color === color) return false;
  switch (piece) {
    case "P": {
      const dir = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;
      if (dc === 0 && !target) {
        if (dr === dir) return true;
        if (dr === 2 * dir && r1 === startRow && !board[r1 + dir][c1]) return true;
        return false;
      }
      if (Math.abs(dc) === 1 && dr === dir && target && target.color !== color) return true;
      return false;
    }
    case "N":
      return (Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2);
    case "B":
      return Math.abs(dr) === Math.abs(dc) && dr !== 0 && chessPathClear(board, r1, c1, r2, c2);
    case "R":
      return (dr === 0 || dc === 0) && (dr !== 0 || dc !== 0) && chessPathClear(board, r1, c1, r2, c2);
    case "Q":
      return (
        (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) &&
        (dr !== 0 || dc !== 0) &&
        chessPathClear(board, r1, c1, r2, c2)
      );
    case "K":
      return Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && (dr !== 0 || dc !== 0);
    default:
      return false;
  }
}
const chess = {
  createInitialState() {
    return {
      board: chessInitialBoard(),
      turn: 0, // 0 = white, 1 = black
      status: "active",
      winner: null,
      captured: { w: [], b: [] },
    };
  },
  applyMove(state, move, playerIndex) {
    if (state.status !== "active") return { state, error: "Game already finished" };
    if (state.turn !== playerIndex) return { state, error: "Not your turn" };
    const color = playerIndex === 0 ? "w" : "b";
    const { from, to } = move || {};
    if (!Array.isArray(from) || !Array.isArray(to)) return { state, error: "Invalid move" };
    const [r1, c1] = from, [r2, c2] = to;
    if ([r1, c1, r2, c2].some((n) => n < 0 || n > 7)) return { state, error: "Invalid move" };
    const cell = state.board[r1][c1];
    if (!cell || cell.color !== color) return { state, error: "Not your piece" };
    if (!chessLegalShape(state.board, from, to, cell.piece, color)) {
      return { state, error: "Illegal move" };
    }
    const board = state.board.map((row) => row.slice());
    const captured = { w: [...state.captured.w], b: [...state.captured.b] };
    const target = board[r2][c2];
    let winner = null;
    if (target) {
      captured[target.color].push(target.piece);
      if (target.piece === "K") winner = playerIndex; // simplified win condition: capture the king
    }
    board[r2][c2] = cell;
    board[r1][c1] = null;
    // simple auto-promotion to Queen
    if (cell.piece === "P" && (r2 === 0 || r2 === 7)) board[r2][c2] = { piece: "Q", color };
    return {
      state: {
        board,
        turn: 1 - playerIndex,
        status: winner !== null ? "won" : "active",
        winner,
        captured,
      },
    };
  },
};

// ---------- Ludo (simplified 2-player, single shared 52-square ring + 6-square home stretch each) ----------
const LUDO_RING = 52;
const LUDO_START = [0, 26]; // entry square on the ring for player 0 / player 1
const LUDO_HOME_ENTRY = [50, 24]; // last ring square before turning into home stretch, per player
function ludoInitialState() {
  return {
    // tokens[playerIndex] = array of 4 token positions.
    // -1 = in base (not yet out). 0-51 = ring square (absolute). 100-105 = home stretch (relative, 105 = home/finished).
    tokens: [
      [-1, -1, -1, -1],
      [-1, -1, -1, -1],
    ],
    turn: 0,
    dice: null,
    mustMove: false,
    status: "active",
    winner: null,
  };
}
function ludoTokenAbsoluteRing(playerIndex, pos) {
  if (pos < 0 || pos >= 100) return null; // in base or in home stretch
  return (LUDO_START[playerIndex] + pos) % LUDO_RING;
}
const ludo = {
  createInitialState: ludoInitialState,
  applyMove(state, move, playerIndex) {
    if (state.status !== "active") return { state, error: "Game already finished" };
    if (state.turn !== playerIndex) return { state, error: "Not your turn" };

    if (move?.action === "roll") {
      if (state.dice !== null) return { state, error: "Already rolled — move a token" };
      const dice = 1 + Math.floor(Math.random() * 6);
      const tokens = state.tokens[playerIndex];
      const canMove = tokens.some((pos) => {
        if (pos === -1) return dice === 6;
        if (pos >= 100 && pos < 105) return pos + dice <= 105;
        if (pos >= 0 && pos < 100) return true;
        return false;
      });
      if (!canMove) {
        // no legal move: pass turn automatically (unless rolled a 6, gets to try again)
        if (dice === 6) return { state: { ...state, dice, mustMove: false } };
        return { state: { ...state, dice: null, turn: 1 - playerIndex, mustMove: false } };
      }
      return { state: { ...state, dice, mustMove: true } };
    }

    if (move?.action === "move") {
      if (state.dice === null) return { state, error: "Roll the dice first" };
      const tokenIdx = move?.tokenIndex;
      if (typeof tokenIdx !== "number" || tokenIdx < 0 || tokenIdx > 3) {
        return { state, error: "Invalid token" };
      }
      const tokens = state.tokens.map((arr) => arr.slice());
      const pos = tokens[playerIndex][tokenIdx];
      const dice = state.dice;
      let newPos;
      if (pos === -1) {
        if (dice !== 6) return { state, error: "Need a 6 to leave base" };
        newPos = 0;
      } else if (pos >= 100) {
        newPos = pos + dice;
        if (newPos > 105) return { state, error: "Overshoot — pick another token" };
      } else {
        newPos = pos + dice;
        if (newPos >= LUDO_HOME_ENTRY[playerIndex] - LUDO_START[playerIndex] + (playerIndex === 0 ? 0 : 0) && newPos <= 50 + 5) {
          // entering home stretch once past this player's ring distance of 50
        }
        if (newPos > 50) newPos = 100 + (newPos - 51); // move into home stretch (100-105)
      }
      tokens[playerIndex][tokenIdx] = newPos;

      // capture: if landing on ring square occupied by opponent token (not on a safe/start square), send it back to base
      let captured = false;
      if (newPos >= 0 && newPos < 100) {
        const absRing = ludoTokenAbsoluteRing(playerIndex, newPos);
        const opp = 1 - playerIndex;
        for (let i = 0; i < 4; i++) {
          const oppPos = tokens[opp][i];
          if (oppPos >= 0 && oppPos < 100 && ludoTokenAbsoluteRing(opp, oppPos) === absRing) {
            tokens[opp][i] = -1;
            captured = true;
          }
        }
      }

      const allHome = tokens[playerIndex].every((p) => p === 105);
      const rolledSix = dice === 6;
      const nextTurn = allHome ? state.turn : rolledSix || captured ? playerIndex : 1 - playerIndex;
      return {
        state: {
          tokens,
          turn: nextTurn,
          dice: null,
          mustMove: false,
          status: allHome ? "won" : "active",
          winner: allHome ? playerIndex : null,
        },
      };
    }

    return { state, error: "Unknown action" };
  },
};

// ---------- UNO (simplified 2-player) ----------
const UNO_COLORS = ["red", "yellow", "green", "blue"];
const UNO_ACTIONS = ["skip", "reverse", "draw2"];
function buildUnoDeck() {
  const deck = [];
  for (const color of UNO_COLORS) {
    deck.push({ color, value: "0" });
    for (let n = 1; n <= 9; n++) {
      deck.push({ color, value: String(n) });
      deck.push({ color, value: String(n) });
    }
    for (const action of UNO_ACTIONS) {
      deck.push({ color, value: action });
      deck.push({ color, value: action });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: "wild", value: "wild" });
    deck.push({ color: "wild", value: "draw4" });
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function unoCardMatches(card, top, chosenColor) {
  if (card.color === "wild") return true;
  const topColor = chosenColor || top.color;
  return card.color === topColor || card.value === top.value;
}
function unoDrawCards(state, playerIndex, count) {
  for (let i = 0; i < count; i++) {
    if (state.drawPile.length === 0) {
      // reshuffle discard (minus top card) back into the draw pile
      const top = state.discard[state.discard.length - 1];
      const rest = state.discard.slice(0, -1);
      if (rest.length === 0) break; // nothing left to reshuffle, deck is exhausted
      for (let k = rest.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [rest[k], rest[j]] = [rest[j], rest[k]];
      }
      state.drawPile = rest;
      state.discard = [top];
    }
    const card = state.drawPile.pop();
    if (card) state.hands[playerIndex].push(card);
  }
}
const uno = {
  createInitialState() {
    const deck = buildUnoDeck();
    const hands = [[], []];
    for (let i = 0; i < 7; i++) {
      hands[0].push(deck.pop());
      hands[1].push(deck.pop());
    }
    // first discard card can't be an action/wild card, for a clean start
    let first = deck.pop();
    while (first.color === "wild" || UNO_ACTIONS.includes(first.value)) {
      deck.unshift(first);
      first = deck.pop();
    }
    return {
      hands,
      drawPile: deck,
      discard: [first],
      turn: 0,
      chosenColor: null,
      pendingChoice: null, // playerIndex awaiting a color choice after playing a wild card
      status: "active",
      winner: null,
    };
  },
  applyMove(state, move, playerIndex) {
    if (state.status !== "active") return { state, error: "Game already finished" };
    if (state.pendingChoice !== null) {
      if (state.pendingChoice !== playerIndex) return { state, error: "Waiting on the other player" };
      const color = move?.chooseColor;
      if (!UNO_COLORS.includes(color)) return { state, error: "Pick a valid color" };
      return { state: { ...state, chosenColor: color, pendingChoice: null, turn: 1 - playerIndex } };
    }
    if (state.turn !== playerIndex) return { state, error: "Not your turn" };
    const top = state.discard[state.discard.length - 1];

    if (move?.action === "draw") {
      const next = structuredClone(state);
      unoDrawCards(next, playerIndex, 1);
      next.turn = 1 - playerIndex;
      return { state: next };
    }

    const cardIdx = move?.cardIndex;
    const hand = state.hands[playerIndex];
    if (typeof cardIdx !== "number" || cardIdx < 0 || cardIdx >= hand.length) {
      return { state, error: "Invalid card" };
    }
    const card = hand[cardIdx];
    if (!unoCardMatches(card, top, state.chosenColor)) {
      return { state, error: "That card doesn't match the top of the pile" };
    }

    const next = structuredClone(state);
    next.hands[playerIndex] = hand.slice(0, cardIdx).concat(hand.slice(cardIdx + 1));
    next.discard = [...state.discard, card];
    next.chosenColor = null;

    if (next.hands[playerIndex].length === 0) {
      next.status = "won";
      next.winner = playerIndex;
      return { state: next };
    }

    const opponent = 1 - playerIndex;
    if (card.value === "wild" || card.value === "draw4") {
      if (card.value === "draw4") unoDrawCards(next, opponent, 4);
      // In a 2-player game the only opponent is skipped either way, so the
      // player who played the wild picks the next color and keeps the turn flow.
      next.pendingChoice = playerIndex;
      next.turn = playerIndex;
      return { state: next };
    }
    if (card.value === "draw2") {
      unoDrawCards(next, opponent, 2);
      next.turn = playerIndex; // opponent's turn is skipped in a 2-player game
      return { state: next };
    }
    if (card.value === "skip" || card.value === "reverse") {
      // Both skip and reverse just give the turn back to the current player in 2p.
      next.turn = playerIndex;
      return { state: next };
    }
    next.turn = opponent;
    return { state: next };
  },
};

const GAMES = { ttt, wordguess, truthdare, quiz, chess, ludo, uno };

export function createInitialState(type) {
  if (!GAMES[type]) throw new Error("Unknown game type");
  return GAMES[type].createInitialState();
}

export function applyMove(type, state, move, playerIndex) {
  if (!GAMES[type]) return { state, error: "Unknown game type" };
  return GAMES[type].applyMove(state, move, playerIndex);
}

// Strip server-only secret fields (like quiz answers, the opponent's UNO hand) before
// sending state to clients. playerIndex (0 or 1) is required for per-player games —
// see PER_PLAYER_GAMES — so each player only ever sees their own cards.
export function sanitizeStateForClient(type, state, playerIndex) {
  if (type === "quiz") {
    const { _answers, ...rest } = state;
    return rest;
  }
  if (type === "uno") {
    const { hands, drawPile, ...rest } = state;
    const myHand = typeof playerIndex === "number" ? hands[playerIndex] : null;
    const opponentIndex = typeof playerIndex === "number" ? 1 - playerIndex : null;
    return {
      ...rest,
      myHand,
      opponentCount: opponentIndex !== null ? hands[opponentIndex].length : hands[1].length,
      drawPileCount: drawPile.length,
    };
  }
  return state;
}
