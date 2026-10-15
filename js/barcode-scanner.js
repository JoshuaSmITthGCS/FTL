/* ============================================================
   barcode-scanner.js — camera ISBN scanner + ISBN helpers

   scanIsbn()        Opens a full-screen camera overlay and resolves with a
                     normalized ISBN string, or null if cancelled.
   scanIsbnsContinuously(onScan)  Bulk mode: stays open, calls onScan(isbn) per book, resolves with the scan count.
   normalizeIsbn()   Strips hyphens/spaces; returns '' when not a valid ISBN.
   toIsbn13()        Converts a valid ISBN-10 or ISBN-13 to ISBN-13.
   isbnMatches()     True when two ISBN strings refer to the same book.
   lookupIsbn()      Open Library, then Google Books, lookup → { title, author, edition, subjects } | null.
   toIsbn10()        ISBN-10 for a 978-prefixed ISBN; used so a book is findable by either number.
   suggestSubject()  Maps lookup subject tags onto the library's subject list.

   Uses the native BarcodeDetector when available, otherwise lazy-loads ZXing.
   Camera access requires HTTPS (Firebase Hosting) or localhost.
   ============================================================ */

const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/+esm';

/* ---------- ISBN helpers ---------- */

export function normalizeIsbn(value) {
  const raw = String(value || '').replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{13}$/.test(raw)) {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(raw[i]) * (i % 2 ? 3 : 1);
    return (10 - (sum % 10)) % 10 === Number(raw[12]) ? raw : '';
  }
  if (/^\d{9}[\dX]$/.test(raw)) {
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += Number(raw[i]) * (10 - i);
    sum += raw[9] === 'X' ? 10 : Number(raw[9]);
    return sum % 11 === 0 ? raw : '';
  }
  return '';
}

export function toIsbn13(value) {
  const isbn = normalizeIsbn(value);
  if (isbn.length !== 10) return isbn;
  const base = `978${isbn.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 ? 3 : 1);
  return `${base}${(10 - (sum % 10)) % 10}`;
}

// ISBN-10 exists only for 978-prefixed ISBN-13s; returns '' otherwise.
export function toIsbn10(value) {
  const isbn = toIsbn13(value);
  if (!isbn.startsWith('978')) return '';
  const body = isbn.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(body[i]) * (10 - i);
  const check = (11 - (sum % 11)) % 11;
  return `${body}${check === 10 ? 'X' : check}`;
}

export function isbnMatches(a, b) {
  const x = toIsbn13(a);
  return Boolean(x) && x === toIsbn13(b);
}

/* ---------- Book info lookup (Open Library, then Google Books) ---------- */

async function lookupOpenLibrary(isbn13) {
  const key = `ISBN:${isbn13}`;
  const res = await fetch(`https://openlibrary.org/api/books?bibkeys=${key}&format=json&jscmd=data`);
  if (!res.ok) return null;
  const entry = (await res.json())[key];
  if (!entry?.title) return null;
  return {
    title: [entry.title, entry.subtitle].filter(Boolean).join(': '),
    author: (entry.authors || []).map((a) => a.name).join(', '),
    subjects: (entry.subjects || []).map((subject) => subject.name)
  };
}

async function lookupGoogleBooks(isbn13) {
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}&maxResults=1`);
  if (!res.ok) return null;
  const info = (await res.json()).items?.[0]?.volumeInfo;
  if (!info?.title) return null;
  return {
    title: [info.title, info.subtitle].filter(Boolean).join(': '),
    author: (info.authors || []).join(', '),
    subjects: info.categories || []
  };
}

export async function lookupIsbn(isbn) {
  const isbn13 = toIsbn13(isbn);
  for (const lookup of [lookupOpenLibrary, lookupGoogleBooks]) {
    try {
      const info = await lookup(isbn13);
      if (info) return { ...info, edition: '' };
    } catch (error) {
      console.warn(`${lookup.name} failed:`, error);
    }
  }
  return null;
}

/* ---------- Subject suggestion ---------- */

// Keyword rules for the library's standard subjects, checked in order.
const SUBJECT_RULES = [
  ['Language', /\b(language|languages|spanish|french|chinese|german|japanese|italian|latin|arabic|portuguese|russian|esl|linguistics|grammar)\b/i],
  ['Business', /\b(business|economics|finance|accounting|marketing|management|entrepreneur\w*)\b/i],
  ['History', /\b(history|historical|civilization|war|revolution)\b/i],
  ['English', /\b(english|literature|literary|composition|rhetoric|poetry|writing)\b/i],
  ['Entertainment', /\b(film|movies?|music|theat(er|re)|drama|art|photography|performing arts)\b/i],
  ['Humanities', /\b(philosophy|ethics|religion|sociology|anthropology|psychology|political science|social science|humanities)\b/i]
];

// Returns one of `knownSubjects` (case-preserved) or '' when nothing fits.
export function suggestSubject(tags, knownSubjects) {
  const text = (tags || []).join(' | ');
  if (!text) return '';
  const known = new Map(knownSubjects.map((name) => [name.toLowerCase(), name]));

  // An existing subject named in the tags wins, e.g. a custom "Computer Science".
  for (const [lower, name] of known) {
    if (lower !== 'uncategorized' && text.toLowerCase().includes(lower)) return name;
  }
  for (const [name, pattern] of SUBJECT_RULES) {
    if (pattern.test(text) && known.has(name.toLowerCase())) return known.get(name.toLowerCase());
  }
  return '';
}

/* ---------- Scanner overlay ---------- */

function buildOverlay(continuous) {
  const overlay = document.createElement('div');
  overlay.className = `scanner${continuous ? ' scanner--continuous' : ''}`;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', continuous ? 'Scan several book barcodes' : 'Scan a book barcode');
  overlay.innerHTML = `
    <div class="scanner__panel">
      <video class="scanner__video" playsinline muted></video>
      <div class="scanner__guide" aria-hidden="true"></div>
      <p class="scanner__status" role="status" aria-live="polite">Starting camera…</p>
      ${continuous ? '<ul class="scanner__log" aria-label="Scanned books"></ul>' : ''}
      <form class="scanner__manual" data-scanner-manual>
        <input type="text" inputmode="numeric" placeholder="Or type the ISBN" aria-label="Type an ISBN" />
        <button type="submit" class="btn btn--accent btn--small">${continuous ? 'Add' : 'Use'}</button>
      </form>
      <button type="button" class="btn ${continuous ? 'btn--accent' : 'btn--ghost'} scanner__cancel" data-scanner-cancel>${continuous ? 'Done' : 'Cancel'}</button>
    </div>`;
  return overlay;
}

async function createDetector() {
  if ('BarcodeDetector' in window) {
    const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    return (video) => detector.detect(video).then((codes) => codes.map((c) => c.rawValue));
  }

  const { MultiFormatReader, BarcodeFormat, DecodeHintType, HTMLCanvasElementLuminanceSource, BinaryBitmap, HybridBinarizer } =
    await import(ZXING_URL);
  const reader = new MultiFormatReader();
  reader.setHints(new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A]]]));
  const canvas = document.createElement('canvas');
  return async (video) => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0);
    try {
      const bitmap = new BinaryBitmap(new HybridBinarizer(new HTMLCanvasElementLuminanceSource(canvas)));
      return [reader.decode(bitmap).getText()];
    } catch {
      return []; // NotFoundException on frames without a barcode
    }
  };
}

// Short beep + vibration so a good scan is confirmed without looking at the screen.
function createFeedback() {
  let audio = null;
  try {
    audio = new (window.AudioContext || window.webkitAudioContext)();
  } catch { /* no audio available */ }
  return () => {
    try {
      navigator.vibrate?.(60);
      if (!audio) return;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + 0.08);
    } catch { /* feedback is best-effort */ }
  };
}

/*
  Shared scanner session.
  Single mode:     resolves with the first valid ISBN, or null if cancelled.
  Continuous mode: stays open; calls onScan(isbn) for each book, one at a time, and
                   resolves with the number of scans when the user taps Done.
                   onScan resolves { kind: 'added' | 'copy' | 'unknown' | 'error', title, message, stop? };
                   stop: true closes the scanner right after that scan.
*/
function runScanner({ continuous = false, onScan = null } = {}) {
  return new Promise((resolve) => {
    const overlay = buildOverlay(continuous);
    const video = overlay.querySelector('video');
    const status = overlay.querySelector('.scanner__status');
    const log = overlay.querySelector('.scanner__log');
    const doneButton = overlay.querySelector('[data-scanner-cancel]');
    const beep = continuous ? createFeedback() : () => {};
    const idleMessage = continuous
      ? 'Scan each book in turn. Tap Done when finished.'
      : 'Point the camera at the barcode on the back cover.';
    let stream = null;
    let timer = null;
    let done = false;
    let scanned = 0;
    let queue = Promise.resolve();
    let armed = true; // the same barcode counts again only after it leaves the frame
    let emptyFrames = 0;

    function close(result) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    }

    async function finish() {
      if (!continuous) return close(null);
      doneButton.disabled = true;
      doneButton.textContent = 'Finishing…';
      await queue;
      close(scanned);
    }

    function logItem(text) {
      const item = document.createElement('li');
      item.className = 'scanner__item';
      const title = document.createElement('strong');
      const note = document.createElement('span');
      title.textContent = text;
      item.append(title, note);
      log.prepend(item);
      while (log.children.length > 30) log.lastChild.remove();
      return { item, title, note };
    }

    function enqueue(isbn) {
      scanned += 1;
      beep();
      const row = logItem(`ISBN ${isbn}`);
      row.note.textContent = 'Adding…';
      queue = queue.then(async () => {
        try {
          const result = await onScan(isbn);
          row.title.textContent = result.title || `ISBN ${isbn}`;
          row.note.textContent = result.message || '';
          row.item.dataset.kind = result.kind || 'added';
          if (result.stop) setTimeout(finish, 500); // brief pause so the scan is visibly confirmed
        } catch (error) {
          console.error('Bulk scan failed for', isbn, error);
          row.note.textContent = 'Could not save. Scan it again.';
          row.item.dataset.kind = 'error';
        }
      });
    }

    function accept(rawValue) {
      const isbn = normalizeIsbn(rawValue);
      if (!isbn) {
        status.textContent = `"${rawValue}" isn't an ISBN. Try the barcode on the back cover.`;
        return false;
      }
      if (continuous) {
        enqueue(isbn);
        status.textContent = idleMessage;
      } else {
        close(isbn);
      }
      return true;
    }

    function onKey(event) {
      if (event.key === 'Escape') finish();
    }

    document.addEventListener('keydown', onKey);
    doneButton.addEventListener('click', finish);
    overlay.querySelector('[data-scanner-manual]').addEventListener('submit', (event) => {
      event.preventDefault();
      const input = event.currentTarget.querySelector('input');
      if (accept(input.value)) input.value = '';
      else input.select();
    });
    document.body.appendChild(overlay);

    (async () => {
      let detect;
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        [stream, detect] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }
          }),
          createDetector()
        ]);
        if (done) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
      } catch (error) {
        console.warn('Camera unavailable:', error);
        status.textContent = error?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access, or type the ISBN below.'
          : 'Camera unavailable on this device. Type the ISBN below.';
        return;
      }

      status.textContent = idleMessage;
      let lastIsbn = '';
      let lastRejected = '';
      const tick = async () => {
        if (done) return;
        try {
          const values = await detect(video);
          emptyFrames = values.length ? 0 : emptyFrames + 1;
          if (emptyFrames >= 3) armed = true;

          for (const value of values) {
            const isbn = normalizeIsbn(value);
            if (!isbn) {
              if (value !== lastRejected) {
                lastRejected = value;
                status.textContent = `"${value}" isn't an ISBN. Try the barcode on the back cover.`;
              }
              continue;
            }
            if (!continuous) return close(isbn);
            // Ignore the book still in view; a different book, or the same one after it left, counts.
            if (isbn === lastIsbn && !armed) continue;
            lastIsbn = isbn;
            armed = false;
            enqueue(isbn);
          }
        } catch (error) {
          console.warn('Scan frame failed:', error);
        }
        timer = setTimeout(tick, 200);
      };
      tick();
    })();
  });
}

export function scanIsbn() {
  return runScanner();
}

export function scanIsbnsContinuously(onScan) {
  return runScanner({ continuous: true, onScan });
}
