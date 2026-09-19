import './style.css';

const STORAGE_KEY = 'sticky-board-v1';
const NOTE_GAP = 16;
const NOTE_HEIGHT = 154;
const COLORS = ['yellow', 'blue', 'pink', 'green'];

const board = document.querySelector('#board');
const template = document.querySelector('#noteTemplate');
const addNoteButton = document.querySelector('#addNoteButton');
const emptyAddButton = document.querySelector('#emptyAddButton');
const emptyState = document.querySelector('#emptyState');
const saveStatus = document.querySelector('#saveStatus');

let notes = loadNotes();
let dragging = null;

function loadNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveNotes(message = 'このブラウザに保存') {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  saveStatus.textContent = message;
  window.setTimeout(() => { saveStatus.textContent = 'このブラウザに保存'; }, 1200);
}

function noteWidth() {
  return window.matchMedia('(max-width: 480px)').matches
    ? Math.min(340, board.clientWidth - 28)
    : 220;
}

function isOverlapping(candidate, other) {
  const width = noteWidth();
  return candidate.x < other.x + width + NOTE_GAP
    && candidate.x + width + NOTE_GAP > other.x
    && candidate.y < other.y + NOTE_HEIGHT + NOTE_GAP
    && candidate.y + NOTE_HEIGHT + NOTE_GAP > other.y;
}

function findOpenPosition() {
  const width = noteWidth();
  const maxX = Math.max(NOTE_GAP, board.clientWidth - width - NOTE_GAP);
  const maxY = Math.max(NOTE_GAP, board.clientHeight - NOTE_HEIGHT - NOTE_GAP);
  const stepX = width + NOTE_GAP;
  const stepY = NOTE_HEIGHT + NOTE_GAP;

  for (let y = NOTE_GAP; y <= maxY; y += stepY) {
    for (let x = NOTE_GAP; x <= maxX; x += stepX) {
      const candidate = { x, y };
      if (!notes.some((note) => isOverlapping(candidate, note))) return candidate;
    }
  }

  // 画面が埋まった場合はボードを下へ伸ばして、既存付箋の下に置く。
  // 追加時に既存付箋へ重ねないことを優先する。
  const nextY = Math.max(
    NOTE_GAP,
    ...notes.map((note) => note.y + NOTE_HEIGHT + NOTE_GAP),
  );
  board.style.minHeight = `${nextY + NOTE_HEIGHT + NOTE_GAP}px`;
  return { x: NOTE_GAP, y: nextY };
}

function clampPosition(note, x, y) {
  const width = note.element?.offsetWidth || noteWidth();
  const height = note.element?.offsetHeight || NOTE_HEIGHT;
  return {
    x: Math.max(0, Math.min(x, Math.max(0, board.clientWidth - width))),
    y: Math.max(0, Math.min(y, Math.max(0, board.clientHeight - height))),
  };
}

function addNote() {
  const position = findOpenPosition();
  notes.push({
    id: crypto.randomUUID(),
    text: '',
    x: position.x,
    y: position.y,
    color: COLORS[notes.length % COLORS.length],
  });
  saveNotes('新しい付箋を追加しました');
  render();
  board.querySelector(`[data-id="${notes.at(-1).id}"] textarea`).focus();
}

function removeNote(id) {
  notes = notes.filter((note) => note.id !== id);
  saveNotes('付箋を削除しました');
  render();
}

function updateNote(id, patch) {
  notes = notes.map((note) => (note.id === id ? { ...note, ...patch } : note));
  saveNotes('編集内容を保存しました');
}

function changeNoteColor(id, color) {
  notes = notes.map((note) => (note.id === id ? { ...note, color } : note));
  saveNotes('付箋の色を変更しました');
  render();
}

function render() {
  board.querySelectorAll('.note').forEach((element) => element.remove());
  emptyState.hidden = notes.length > 0;

  notes.forEach((note) => {
    const fragment = template.content.cloneNode(true);
    const element = fragment.querySelector('.note');
    const textarea = fragment.querySelector('.note-text');
    const handle = fragment.querySelector('.drag-handle');
    const deleteButton = fragment.querySelector('.delete-button');
    const colorButtons = fragment.querySelectorAll('.color-choice');
    const position = clampPosition(note, note.x, note.y);

    note.x = position.x;
    note.y = position.y;
    element.dataset.id = note.id;
    element.dataset.color = note.color;
    element.style.transform = `translate(${note.x}px, ${note.y}px)`;
    textarea.value = note.text;
    // DOM参照は保存対象から除外する。JSON化するのは付箋の内容・色・座標だけ。
    Object.defineProperty(note, 'element', {
      value: element,
      writable: true,
      configurable: true,
      enumerable: false,
    });

    textarea.addEventListener('input', (event) => updateNote(note.id, { text: event.target.value }));
    deleteButton.addEventListener('click', () => removeNote(note.id));
    handle.addEventListener('pointerdown', (event) => startDrag(event, note));
    colorButtons.forEach((button) => {
      const isSelected = button.dataset.color === note.color;
      button.setAttribute('aria-pressed', String(isSelected));
      button.addEventListener('click', () => changeNoteColor(note.id, button.dataset.color));
    });
    board.append(element);
  });

  saveNotes();
}

function startDrag(event, note) {
  event.preventDefault();
  const point = boardPoint(event);
  dragging = { note, pointerId: event.pointerId, offsetX: point.x - note.x, offsetY: point.y - note.y };
  note.element.classList.add('dragging');
  note.element.setPointerCapture(event.pointerId);
}

function boardPoint(event) {
  const rect = board.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function moveDrag(event) {
  if (!dragging || event.pointerId !== dragging.pointerId) return;
  const point = boardPoint(event);
  const next = clampPosition(dragging.note, point.x - dragging.offsetX, point.y - dragging.offsetY);
  dragging.note.x = next.x;
  dragging.note.y = next.y;
  dragging.note.element.style.transform = `translate(${next.x}px, ${next.y}px)`;
}

function endDrag(event) {
  if (!dragging || event.pointerId !== dragging.pointerId) return;
  dragging.note.element.classList.remove('dragging');
  updateNote(dragging.note.id, { x: dragging.note.x, y: dragging.note.y });
  dragging = null;
}

function fitNotesToBoard() {
  notes.forEach((note) => {
    const next = clampPosition(note, note.x, note.y);
    note.x = next.x;
    note.y = next.y;
  });
  render();
}

addNoteButton.addEventListener('click', addNote);
emptyAddButton.addEventListener('click', addNote);
board.addEventListener('pointermove', moveDrag);
board.addEventListener('pointerup', endDrag);
board.addEventListener('pointercancel', endDrag);
window.addEventListener('resize', fitNotesToBoard);

render();
