// Reads a passport photo page in the visitor's browser. Nothing is uploaded:
// the OCR engine (/public/ocr) runs on the device and only the result is used.
import { findMrzLines, parseMrz, countryName } from './mrz.js';

let workerPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Could not load the passport reader'));
    document.head.appendChild(s);
  });
}

async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      await loadScript('/ocr/tesseract.min.js');
      const worker = await window.Tesseract.createWorker('mrz', 1, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/core/',
        langPath: '/ocr/lang',
        gzip: false,
        logger: (m) => onProgress?.(m),
      });
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
        tessedit_pageseg_mode: '6',
      });
      return worker;
    })();
    workerPromise.catch(() => { workerPromise = null; });
  }
  return workerPromise;
}

// Start downloading the reader early (e.g. when the upload step opens).
export function warmUp() { getWorker().catch(() => {}); }

async function loadBitmap(file) {
  // createImageBitmap respects the photo's rotation (EXIF) in modern browsers
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

// Draw the whole page scaled to a fixed width, rotated by `angle` degrees (plus 180° if flipped).
function render(bitmap, width, angle, flip) {
  const scale = width / bitmap.width;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = Math.round(bitmap.height * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(((angle + (flip ? 180 : 0)) * Math.PI) / 180);
  ctx.drawImage(bitmap, -c.width / 2, -c.height / 2, c.width, c.height);
  return c;
}

function greyPixels(canvas, top, height) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const y0 = Math.round(canvas.height * top), h = Math.round(canvas.height * height);
  const d = ctx.getImageData(0, y0, canvas.width, h).data;
  const g = new Float32Array(canvas.width * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return { g, w: canvas.width, h };
}

// Find the tilt of the text lines: the angle where rows of dark pixels line up best.
function estimateSkew(bitmap, flip) {
  const c = render(bitmap, 700, 0, flip);
  const { g, w, h } = greyPixels(c, 0.5, 0.5);
  // Text strokes = pixels clearly darker than their surroundings (ignores dark tables/backgrounds).
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; }
  }
  const r = 8, pts = [];
  for (let y = r; y < h - r; y++) {
    for (let x = r; x < w - r; x++) {
      const sum = I[(y + r + 1) * (w + 1) + x + r + 1] - I[(y - r) * (w + 1) + x + r + 1] - I[(y + r + 1) * (w + 1) + x - r] + I[(y - r) * (w + 1) + x - r];
      const local = sum / ((2 * r + 1) ** 2);
      if (g[y * w + x] < local - 30) pts.push(x - w / 2, y - h / 2);
    }
  }
  if (pts.length < 200) return 0;
  let best = 0, bestScore = -1;
  for (let a = -6; a <= 6; a += 0.25) {
    const r = (a * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
    const hist = new Float32Array(h * 2);
    for (let i = 0; i < pts.length; i += 2) {
      const y = Math.round(pts[i] * sin + pts[i + 1] * cos + h);
      if (y >= 0 && y < hist.length) hist[y]++;
    }
    let sq = 0; for (const v of hist) sq += v * v;
    if (sq > bestScore) { bestScore = sq; best = a; }
  }
  return best;
}

// Cut a horizontal band from a rendered page, stretch its contrast.
function band(page, top, height) {
  const { g, w, h } = greyPixels(page, top, height);
  let min = 255, max = 0;
  for (const v of g) { if (v < min) min = v; if (v > max) max = v; }
  const range = Math.max(1, max - min);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let j = 0, i = 0; j < g.length; j++, i += 4) {
    const v = ((g[j] - min) / range) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Read the passport. Returns { ok, data, message }.
 * data has: surname, givenNames, dateOfBirth (yyyy-mm-dd), sex, nationality, issuingCountry,
 * passportNumber, passportExpiry, valid (check digits all passed).
 */
export async function readPassport(file, onStatus = () => {}) {
  if (!file.type.startsWith('image/')) {
    return { ok: false, message: 'To read your details automatically, upload a photo or scan (JPG or PNG) of your passport photo page.' };
  }
  onStatus('Preparing the passport reader…');
  let bitmap;
  try { bitmap = await loadBitmap(file); } catch {
    return { ok: false, message: 'This image could not be opened. iPhone HEIC photos may need converting to JPG first.' };
  }
  const worker = await getWorker((m) => {
    if (m.status === 'loading language traineddata' || m.status === 'loading tesseract core') onStatus('Preparing the passport reader…');
  });

  // Straighten the photo, then read the bottom of the page (where the passport's coded lines are).
  // If that fails, try wider areas and the photo upside down.
  let best = null;
  outer: for (const flip of [false, true]) {
    const angle = estimateSkew(bitmap, flip);
    const page = render(bitmap, 1800, angle, flip);
    for (const [top, height] of [[0.66, 0.34], [0.5, 0.5], [0, 1]]) {
      onStatus('Reading your passport…');
      const { data } = await worker.recognize(band(page, top, height));
      const lines = findMrzLines(data.text);
      if (!lines) continue;
      const parsed = parseMrz(lines[0], lines[1]);
      if (!best || parsed.score > best.score) best = parsed;
      if (parsed.valid) break outer;
    }
  }
  bitmap.close?.();

  if (!best || best.confidence < 0.67 || !best.surname) {
    return { ok: false, message: 'We couldn’t read this passport. Try a sharper, well-lit photo of the whole photo page, or type your details below.' };
  }
  return {
    ok: true,
    data: { ...best, nationality: countryName(best.nationality), issuingCountry: countryName(best.issuingCountry) },
    message: best.valid
      ? 'We’ve filled in your passport details. Please check they’re correct.'
      : 'We’ve filled in what we could read. Please check every detail carefully against your passport.',
  };
}
