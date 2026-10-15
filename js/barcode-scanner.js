/* ============================================================
   barcode-scanner.js — camera ISBN scanner + ISBN helpers

   scanIsbn()        Opens a full-screen camera overlay and resolves with a
                     normalized ISBN string, or null if cancelled.
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

function buildOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'scanner';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Scan a book barcode');
  overlay.innerHTML = `
    <div class="scanner__panel">
      <video class="scanner__video" playsinline muted></video>
      <div class="scanner__guide" aria-hidden="true"></div>
      <p class="scanner__status" role="status" aria-live="polite">Starting camera…</p>
      <form class="scanner__manual" data-scanner-manual>
        <input type="text" inputmode="numeric" placeholder="Or type the ISBN" aria-label="Type an ISBN" />
        <button type="submit" class="btn btn--accent btn--small">Use</button>
      </form>
      <button type="button" class="btn btn--ghost scanner__cancel" data-scanner-cancel>Cancel</button>
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

export function scanIsbn() {
  return new Promise((resolve) => {
    const overlay = buildOverlay();
    const video = overlay.querySelector('video');
    const status = overlay.querySelector('.scanner__status');
    let stream = null;
    let timer = null;
    let done = false;

    function finish(result) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    }

    function accept(rawValue) {
      const isbn = normalizeIsbn(rawValue);
      if (isbn) {
        finish(isbn);
        return true;
      }
      status.textContent = `"${rawValue}" isn't an ISBN. Try the barcode on the back cover.`;
      return false;
    }

    function onKey(event) {
      if (event.key === 'Escape') finish(null);
    }

    document.addEventListener('keydown', onKey);
    overlay.querySelector('[data-scanner-cancel]').addEventListener('click', () => finish(null));
    overlay.querySelector('[data-scanner-manual]').addEventListener('submit', (event) => {
      event.preventDefault();
      const value = event.currentTarget.querySelector('input').value;
      if (!accept(value)) event.currentTarget.querySelector('input').select();
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

      status.textContent = 'Point the camera at the barcode on the back cover.';
      let lastRejected = '';
      const tick = async () => {
        if (done) return;
        try {
          for (const value of await detect(video)) {
            const isbn = normalizeIsbn(value);
            if (isbn) return finish(isbn);
            if (value !== lastRejected) {
              lastRejected = value;
              status.textContent = `"${value}" isn't an ISBN. Try the barcode on the back cover.`;
            }
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
