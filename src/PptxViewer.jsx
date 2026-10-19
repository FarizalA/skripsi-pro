import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Presentation, Upload, Trash2, ChevronLeft, ChevronRight, X, Maximize2,
  Minimize2, Loader2, Sparkles, Download, FileWarning, Layers, Clock,
  MousePointer2, Edit3, Play, Pause, PenTool, PlayCircle, Info, FileText
} from 'lucide-react';

/* ============================================================================
   0. DYNAMIC LOADERS (JSZIP & PDF.JS)
   ============================================================================ */
const loadJSZip = async () => {
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => reject(new Error("Gagal memuat library ZIP"));
    document.head.appendChild(script);
  });
};

const loadPdfJs = async () => {
  if (window.pdfjsLib) return window.pdfjsLib;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } catch (e) { reject(e); }
    };
    script.onerror = () => reject(new Error("Gagal memuat library PDF"));
    document.head.appendChild(script);
  });
};

/* ============================================================================
   1. PENYIMPANAN LOKAL (IndexedDB)
   ============================================================================ */
const PPTX_DB_NAME = 'SkripsiProPptxDB';
const PPTX_STORE = 'decks';

const openPptxDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(PPTX_DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(PPTX_STORE)) {
        db.createObjectStore(PPTX_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const savePptxDeck = async (deck) => {
  const db = await openPptxDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PPTX_STORE, 'readwrite');
    tx.objectStore(PPTX_STORE).put(deck);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const getPptxDecks = async () => {
  const db = await openPptxDB();
  return new Promise((resolve) => {
    const tx = db.transaction(PPTX_STORE, 'readonly');
    const req = tx.objectStore(PPTX_STORE).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.uploadedAt - a.uploadedAt));
    req.onerror = () => resolve([]);
  });
};

const deletePptxDeckDB = async (id) => {
  const db = await openPptxDB();
  return new Promise((resolve) => {
    const tx = db.transaction(PPTX_STORE, 'readwrite');
    tx.objectStore(PPTX_STORE).delete(id);
    tx.oncomplete = () => resolve();
  });
};

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const base64ToArrayBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const formatBytes = (bytes) => {
  if (!bytes) return '0 KB';
  const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ppt_${Date.now()}_${Math.random().toString(36).slice(2)}`);

const getDeckType = (deck) => deck.type || (/\.pdf$/i.test(deck.name) ? 'pdf' : 'pptx');

/* ============================================================================
   2. UTIL DASAR (satuan, warna, XML)
   ============================================================================ */
const EMU_PER_PX = 914400 / 96;
const emuToPx = (emu) => emu / EMU_PER_PX;
const ptToPx = (pt) => pt * (96 / 72);
const num = (v, fallback = 0) => { const n = parseFloat(v); return Number.isNaN(n) ? fallback : n; };

const firstDirectChild = (el, tagName) => {
  if (!el) return null;
  return Array.from(el.children).find((c) => c.tagName === tagName) || null;
};

const hexToRgb = (hex) => {
  let h = (hex || '#000000').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const int = parseInt(h, 16) || 0;
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
};
const rgbToHex = (r, g, b) => {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
};
const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
};
const hslToRgb = (h, s, l) => {
  let r, g, b;
  if (s === 0) { r = g = b = l; } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [r * 255, g * 255, b * 255];
};

// Menerapkan modifikasi warna OOXML (lumMod/lumOff/shade/tint) agar variasi terang/gelap dari 1 warna tema akurat
const applyColorMods = (hex, modsEl) => {
  if (!modsEl) return hex;
  const lumMod = modsEl.getElementsByTagName('a:lumMod')[0];
  const lumOff = modsEl.getElementsByTagName('a:lumOff')[0];
  const shade = modsEl.getElementsByTagName('a:shade')[0];
  const tint = modsEl.getElementsByTagName('a:tint')[0];
  if (!lumMod && !lumOff && !shade && !tint) return hex;
  const { r, g, b } = hexToRgb(hex);
  let [h, s, l] = rgbToHsl(r, g, b);
  if (lumMod) l *= num(lumMod.getAttribute('val'), 100000) / 100000;
  if (lumOff) l += num(lumOff.getAttribute('val'), 0) / 100000;
  if (shade) l *= num(shade.getAttribute('val'), 100000) / 100000;
  if (tint) { const f = num(tint.getAttribute('val'), 100000) / 100000; l = l * f + (1 - f); }
  l = Math.max(0, Math.min(1, l));
  const [nr, ng, nb] = hslToRgb(h, s, l);
  return rgbToHex(nr, ng, nb);
};

const contrastColor = (hex) => {
  if (!hex) return '#1e293b';
  const { r, g, b } = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#1e293b' : '#ffffff';
};

const FALLBACK_SCHEME = {
  dk1: '#1e293b', dk2: '#1e293b', lt1: '#ffffff', lt2: '#f1f5f9',
  accent1: '#2563eb', accent2: '#06b6d4', accent3: '#0ea5e9',
  accent4: '#f59e0b', accent5: '#ef4444', accent6: '#10b981',
  hlink: '#2563eb', folHlink: '#7c3aed', bg1: '#ffffff', tx1: '#1e293b', bg2: '#f1f5f9', tx2: '#1e293b',
};
const DEFAULT_CLRMAP = {
  bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2',
  accent1: 'accent1', accent2: 'accent2', accent3: 'accent3',
  accent4: 'accent4', accent5: 'accent5', accent6: 'accent6',
  hlink: 'hlink', folHlink: 'folHlink',
};

const resolveSchemeColor = (name, theme, clrMap) => {
  const map = clrMap || DEFAULT_CLRMAP;
  const mapped = map[name] || name;
  if (theme && theme[mapped]) return theme[mapped];
  if (theme && theme[name]) return theme[name];
  return FALLBACK_SCHEME[mapped] || FALLBACK_SCHEME[name] || null;
};

// Mengambil warna dari elemen a:srgbClr / a:schemeClr (dipakai untuk fill, garis, teks, dsb)
const resolveColorNode = (node, theme, clrMap) => {
  if (!node) return null;
  const srgb = node.getElementsByTagName('a:srgbClr')[0];
  if (srgb) return applyColorMods(`#${srgb.getAttribute('val')}`, srgb);
  const scheme = node.getElementsByTagName('a:schemeClr')[0];
  if (scheme) {
    const val = scheme.getAttribute('val');
    if (val === 'phClr') return null;
    const base = resolveSchemeColor(val, theme, clrMap) || '#64748b';
    return applyColorMods(base, scheme);
  }
  return null;
};

const parseThemeColors = (themeDoc) => {
  if (!themeDoc) return null;
  const scheme = themeDoc.getElementsByTagName('a:clrScheme')[0];
  if (!scheme) return null;
  const readNode = (tag) => {
    const el = firstDirectChild(scheme, tag);
    if (!el) return null;
    const srgb = el.getElementsByTagName('a:srgbClr')[0];
    if (srgb) return `#${srgb.getAttribute('val')}`;
    const sys = el.getElementsByTagName('a:sysClr')[0];
    if (sys) return `#${sys.getAttribute('lastClr') || (sys.getAttribute('val') === 'window' ? 'FFFFFF' : '000000')}`;
    return null;
  };
  return {
    dk1: readNode('a:dk1') || '#000000', lt1: readNode('a:lt1') || '#ffffff',
    dk2: readNode('a:dk2') || '#1e293b', lt2: readNode('a:lt2') || '#e2e8f0',
    accent1: readNode('a:accent1') || '#2563eb', accent2: readNode('a:accent2') || '#06b6d4',
    accent3: readNode('a:accent3') || '#0ea5e9', accent4: readNode('a:accent4') || '#f59e0b',
    accent5: readNode('a:accent5') || '#ef4444', accent6: readNode('a:accent6') || '#10b981',
    hlink: readNode('a:hlink') || '#2563eb', folHlink: readNode('a:folHlink') || '#7c3aed',
  };
};

const parseClrMap = (masterDoc) => {
  const el = masterDoc?.getElementsByTagName('p:clrMap')[0];
  if (!el) return null;
  const map = {};
  Object.keys(DEFAULT_CLRMAP).forEach((k) => { map[k] = el.getAttribute(k) || DEFAULT_CLRMAP[k]; });
  return map;
};

const resolveRelPath = (basePath, relTarget) => {
  const baseParts = basePath.split('/');
  baseParts.pop();
  relTarget.split('/').forEach((part) => {
    if (part === '..') baseParts.pop();
    else if (part !== '.') baseParts.push(part);
  });
  return baseParts.join('/');
};

const mimeFromExt = (ext) => ({
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp',
}[(ext || '').toLowerCase()] || null);

/* ============================================================================
   3. FILL / GARIS / GEOMETRI SHAPE
   ============================================================================ */
const parseGradient = (gradEl, theme, clrMap) => {
  const gsLst = firstDirectChild(gradEl, 'a:gsLst');
  if (!gsLst) return null;
  const stops = Array.from(gsLst.children)
    .filter((c) => c.tagName === 'a:gs')
    .map((gs) => ({ pos: num(gs.getAttribute('pos'), 0) / 1000, color: resolveColorNode(gs, theme, clrMap) || '#94a3b8' }))
    .sort((a, b) => a.pos - b.pos);
  if (!stops.length) return null;
  const lin = firstDirectChild(gradEl, 'a:lin');
  const ooxmlAngle = lin ? num(lin.getAttribute('ang'), 5400000) / 60000 : 90;
  const cssAngle = (ooxmlAngle + 90) % 360;
  const stopsCss = stops.map((s) => `${s.color} ${s.pos}%`).join(', ');
  return { type: 'gradient', css: `linear-gradient(${cssAngle}deg, ${stopsCss})` };
};

async function resolveImageSrc(rId, ctx) {
  if (!rId) return null;
  const rel = ctx.rels.find((r) => r.getAttribute('Id') === rId);
  if (!rel) return null;
  const target = rel.getAttribute('Target');
  if (!target || /^https?:\/\//i.test(target)) return null;
  const mediaPath = resolveRelPath(ctx.slidePath, target);
  const mediaFile = ctx.zip.file(mediaPath);
  if (!mediaFile) return null;
  const mime = mimeFromExt(mediaPath.split('.').pop());
  if (!mime) return null; // format seperti EMF/WMF tidak bisa dirender langsung oleh browser
  const base64 = await mediaFile.async('base64');
  return `data:${mime};base64,${base64}`;
}

async function resolveFill(propEl, ctx) {
  if (!propEl) return null;
  if (firstDirectChild(propEl, 'a:noFill')) return { type: 'none' };
  const solid = firstDirectChild(propEl, 'a:solidFill');
  if (solid) return { type: 'solid', color: resolveColorNode(solid, ctx.theme, ctx.clrMap) };
  const grad = firstDirectChild(propEl, 'a:gradFill');
  if (grad) return parseGradient(grad, ctx.theme, ctx.clrMap);
  const blip = firstDirectChild(propEl, 'a:blipFill');
  if (blip) {
    const rId = blip.getElementsByTagName('a:blip')[0]?.getAttribute('r:embed');
    const src = await resolveImageSrc(rId, ctx);
    return src ? { type: 'image', src } : null;
  }
  const pattern = firstDirectChild(propEl, 'a:pattFill');
  if (pattern) {
    const fg = firstDirectChild(pattern, 'a:fgClr');
    return { type: 'solid', color: (fg ? resolveColorNode(fg, ctx.theme, ctx.clrMap) : null) || '#94a3b8' };
  }
  return null;
}

function resolveLine(propEl, ctx) {
  const ln = propEl ? firstDirectChild(propEl, 'a:ln') : null;
  if (!ln || firstDirectChild(ln, 'a:noFill')) return null;
  const solid = firstDirectChild(ln, 'a:solidFill');
  const color = solid ? resolveColorNode(solid, ctx.theme, ctx.clrMap) : null;
  if (!color) return null;
  const w = ln.getAttribute('w');
  return { color, width: w ? Math.max(0.75, emuToPx(num(w))) : 1 };
}

function getPrstGeom(propEl) {
  const g = propEl ? firstDirectChild(propEl, 'a:prstGeom') : null;
  if (g) return g.getAttribute('prst') || 'rect';
  if (propEl && firstDirectChild(propEl, 'a:custGeom')) return 'rect';
  return null;
}

const CLIP_PATHS = {
  triangle: 'polygon(50% 0%, 0% 100%, 100% 100%)',
  diamond: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  pentagon: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
  hexagon: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
  rightArrow: 'polygon(0% 25%, 60% 25%, 60% 0%, 100% 50%, 60% 100%, 60% 75%, 0% 75%)',
  leftArrow: 'polygon(100% 25%, 40% 25%, 40% 0%, 0% 50%, 40% 100%, 40% 75%, 100% 75%)',
  chevron: 'polygon(0% 0%, 75% 0%, 100% 50%, 75% 100%, 0% 100%, 25% 50%)',
  homePlate: 'polygon(0% 0%, 75% 0%, 100% 50%, 75% 100%, 0% 100%)',
  star5: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  parallelogram: 'polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)',
  trapezoid: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)',
};

function geomClipStyle(prst) {
  if (!prst || prst === 'rect') return {};
  if (prst === 'ellipse') return { borderRadius: '50%' };
  if (prst.toLowerCase().includes('round')) return { borderRadius: '12%' };
  if (CLIP_PATHS[prst]) return { clipPath: CLIP_PATHS[prst] };
  return {};
}

/* ============================================================================
   4. TEKS & TABEL
   ============================================================================ */
function parseRunProps(rPrEl, theme, clrMap) {
  if (!rPrEl) return {};
  const sz = rPrEl.getAttribute('sz');
  const solidFill = firstDirectChild(rPrEl, 'a:solidFill');
  return {
    bold: rPrEl.getAttribute('b') === '1',
    italic: rPrEl.getAttribute('i') === '1',
    size: sz ? Math.round(num(sz) / 100) : null,
    color: solidFill ? resolveColorNode(solidFill, theme, clrMap) : null,
  };
}

function parseTextBody(txBodyEl, theme, clrMap) {
  if (!txBodyEl) return [];
  return Array.from(txBodyEl.getElementsByTagName('a:p')).reduce((acc, pNode) => {
    const pPr = firstDirectChild(pNode, 'a:pPr');
    const hasBullet = !!(pPr && (pPr.getElementsByTagName('a:buChar')[0] || pPr.getElementsByTagName('a:buAutoNum')[0]));
    const noBullet = !!(pPr && pPr.getElementsByTagName('a:buNone')[0]);
    const level = pPr ? num(pPr.getAttribute('lvl'), 0) : 0;
    const runs = Array.from(pNode.getElementsByTagName('a:r')).map((r) => ({
      text: r.getElementsByTagName('a:t')[0]?.textContent || '',
      ...parseRunProps(firstDirectChild(r, 'a:rPr'), theme, clrMap),
    }));
    if (runs.some((r) => r.text.trim().length > 0)) {
      acc.push({ bullet: hasBullet && !noBullet, level, runs });
    }
    return acc;
  }, []);
}

function parseTable(tblEl, theme, clrMap) {
  const colWidths = Array.from(tblEl.getElementsByTagName('a:gridCol')).map((g) => emuToPx(num(g.getAttribute('w'), 914400)));
  const rows = Array.from(tblEl.getElementsByTagName('a:tr')).map((tr) => ({
    cells: Array.from(tr.getElementsByTagName('a:tc')).map((tc) => {
      const paragraphs = parseTextBody(tc.getElementsByTagName('a:txBody')[0], theme, clrMap);
      const tcPr = firstDirectChild(tc, 'a:tcPr');
      const solid = tcPr ? firstDirectChild(tcPr, 'a:solidFill') : null;
      const fill = solid ? { type: 'solid', color: resolveColorNode(solid, theme, clrMap) } : null;
      return { paragraphs, fill };
    }),
  }));
  return { colWidths: colWidths.length ? colWidths : (rows[0]?.cells || []).map(() => 1), rows };
}

/* ============================================================================
   5. POSISI / TRANSFORMASI (xfrm, grup, warisan posisi dari layout)
   ============================================================================ */
const FALLBACK_LAYOUT = {
  title: { l: 0.06, t: 0.05, w: 0.88, h: 0.20 },
  ctrTitle: { l: 0.10, t: 0.36, w: 0.80, h: 0.20 },
  subTitle: { l: 0.10, t: 0.56, w: 0.80, h: 0.14 },
  body: { l: 0.06, t: 0.27, w: 0.88, h: 0.66 },
  default: { l: 0.08, t: 0.08, w: 0.84, h: 0.84 },
};

function getXfrm(el, kind) {
  let xfrm = null;
  if (kind === 'graphicFrame') {
    xfrm = firstDirectChild(el, 'p:xfrm');
  } else {
    const propEl = firstDirectChild(el, kind === 'grp' ? 'p:grpSpPr' : 'p:spPr');
    xfrm = propEl ? firstDirectChild(propEl, 'a:xfrm') : null;
  }
  if (!xfrm) return null;
  const off = firstDirectChild(xfrm, 'a:off');
  const ext = firstDirectChild(xfrm, 'a:ext');
  const chOff = firstDirectChild(xfrm, 'a:chOff');
  const chExt = firstDirectChild(xfrm, 'a:chExt');
  const rot = xfrm.getAttribute('rot');
  return {
    off: off ? { x: num(off.getAttribute('x')), y: num(off.getAttribute('y')) } : null,
    ext: ext ? { cx: num(ext.getAttribute('cx')), cy: num(ext.getAttribute('cy')) } : null,
    chOff: chOff ? { x: num(chOff.getAttribute('x')), y: num(chOff.getAttribute('y')) } : null,
    chExt: chExt ? { cx: num(chExt.getAttribute('cx')), cy: num(chExt.getAttribute('cy')) } : null,
    rotDeg: rot ? num(rot) / 60000 : 0,
    flipH: xfrm.getAttribute('flipH') === '1',
    flipV: xfrm.getAttribute('flipV') === '1',
  };
}

function getPlaceholderInfo(spEl) {
  const ph = spEl.getElementsByTagName('p:ph')[0];
  if (!ph) return { type: null, idx: '' };
  return { type: ph.getAttribute('type') || 'body', idx: ph.getAttribute('idx') || '' };
}

// Mengumpulkan posisi placeholder (title/body/dst) dari slide LAYOUT, dipakai saat slide sendiri tidak menyetel posisi eksplisit
function collectPlaceholderPositions(doc) {
  const map = {};
  const spTree = doc?.getElementsByTagName('p:spTree')[0];
  if (!spTree) return map;
  Array.from(spTree.children).forEach((child) => {
    if (child.tagName !== 'p:sp') return;
    const { type, idx } = getPlaceholderInfo(child);
    if (!type) return;
    const xfrm = getXfrm(child, 'sp');
    if (xfrm?.off && xfrm?.ext) {
      map[`${type}:${idx}`] = xfrm;
      if (!map[type]) map[type] = xfrm;
    }
  });
  return map;
}

function toPxBox(node, frame) {
  if (node.fullBleed) return { left: 0, top: 0, width: frame.pxW, height: frame.pxH };
  const xfrm = node.xfrm;
  if (xfrm?.off && xfrm?.ext) {
    const scaleX = frame.pxW / (frame.chExtCx || 1);
    const scaleY = frame.pxH / (frame.chExtCy || 1);
    return {
      left: (xfrm.off.x - frame.chOffX) * scaleX,
      top: (xfrm.off.y - frame.chOffY) * scaleY,
      width: xfrm.ext.cx * scaleX,
      height: xfrm.ext.cy * scaleY,
    };
  }
  const key = node.phType && FALLBACK_LAYOUT[node.phType] ? node.phType : node.phType ? 'body' : 'default';
  const f = FALLBACK_LAYOUT[key];
  const topAdjust = key === 'default' ? (node.stackIndex || 0) * 0.07 * frame.pxH : 0;
  return { left: f.l * frame.pxW, top: f.t * frame.pxH + topAdjust, width: f.w * frame.pxW, height: f.h * frame.pxH };
}

/* ============================================================================
   6. PARSER POHON SHAPE (mendukung grup bersarang, tabel, gambar, konektor)
   ============================================================================ */
async function parseShapeNode(el, ctx) {
  const tag = el.tagName;
  const stackIndex = ctx.stackCounter.n++;

  if (tag === 'p:sp') {
    const { type: phType, idx: phIdx } = getPlaceholderInfo(el);
    let xfrm = getXfrm(el, 'sp');
    if ((!xfrm || !xfrm.off || !xfrm.ext) && phType) {
      const layoutXfrm = ctx.layoutPh[`${phType}:${phIdx}`] || ctx.layoutPh[phType];
      if (layoutXfrm) xfrm = layoutXfrm;
    }
    const spPr = firstDirectChild(el, 'p:spPr');
    const fill = await resolveFill(spPr, ctx);
    const line = resolveLine(spPr, ctx);
    const geom = getPrstGeom(spPr);
    const txBody = el.getElementsByTagName('p:txBody')[0];
    const paragraphs = parseTextBody(txBody, ctx.theme, ctx.clrMap);
    const bodyPr = txBody ? firstDirectChild(txBody, 'a:bodyPr') : null;
    const anchorAttr = bodyPr?.getAttribute('anchor');
    let anchor;
    if (anchorAttr === 't') anchor = 'flex-start';
    else if (anchorAttr === 'b') anchor = 'flex-end';
    else if (anchorAttr === 'ctr') anchor = 'center';
    else if (phType === 'title' || phType === 'ctrTitle' || phType === 'subTitle') anchor = 'center';
    else if (phType) anchor = 'flex-start';
    else anchor = 'center';
    if (!paragraphs.length && (!fill || fill.type === 'none') && !line) return null;
    return { type: 'shape', xfrm, phType, fill, line, geom, paragraphs, anchor, stackIndex };
  }

  if (tag === 'p:pic') {
    const xfrm = getXfrm(el, 'sp');
    const rId = el.getElementsByTagName('a:blip')[0]?.getAttribute('r:embed');
    const src = await resolveImageSrc(rId, ctx);
    if (!src) return null;
    const geom = getPrstGeom(firstDirectChild(el, 'p:spPr'));
    return { type: 'image', xfrm, src, geom, stackIndex };
  }

  if (tag === 'p:graphicFrame') {
    const xfrm = getXfrm(el, 'graphicFrame');
    const tbl = el.getElementsByTagName('a:tbl')[0];
    if (tbl) return { type: 'table', xfrm, table: parseTable(tbl, ctx.theme, ctx.clrMap), stackIndex };
    let label = 'Objek Tersemat';
    if (el.getElementsByTagName('c:chart')[0]) label = 'Grafik / Chart';
    else if (el.getElementsByTagName('dgm:relIds')[0]) label = 'SmartArt';
    return { type: 'placeholder', xfrm, label, stackIndex };
  }

  if (tag === 'p:grpSp') {
    const xfrm = getXfrm(el, 'grp');
    const children = [];
    for (const child of Array.from(el.children)) {
      if (['p:sp', 'p:pic', 'p:graphicFrame', 'p:grpSp', 'p:cxnSp'].includes(child.tagName)) {
        const node = await parseShapeNode(child, ctx);
        if (node) children.push(node);
      }
    }
    if (!children.length) return null;
    return { type: 'group', xfrm, children, stackIndex };
  }

  if (tag === 'p:cxnSp') {
    const xfrm = getXfrm(el, 'sp');
    const line = resolveLine(firstDirectChild(el, 'p:spPr'), ctx) || { color: '#94a3b8', width: 1.5 };
    return { type: 'connector', xfrm, line, stackIndex };
  }

  return null;
}

async function parseBg(bgEl, theme, clrMap, ctx) {
  if (!bgEl) return null;
  const bgPr = firstDirectChild(bgEl, 'p:bgPr');
  if (bgPr) {
    const fill = await resolveFill(bgPr, ctx);
    if (fill?.type === 'solid' && fill.color) return fill.color;
    if (fill?.type === 'gradient') return fill.css;
    if (fill?.type === 'image') return { image: fill.src };
  }
  const bgRef = firstDirectChild(bgEl, 'p:bgRef');
  if (bgRef) {
    const color = resolveColorNode(bgRef, theme, clrMap);
    if (color) return color;
  }
  return null;
}

async function parseSlide(zip, readXml, slidePath) {
  const slideDoc = await readXml(slidePath);
  if (!slideDoc) return null;

  const relsPath = `ppt/slides/_rels/${slidePath.split('/').pop()}.rels`;
  const relsDoc = await readXml(relsPath);
  const rels = relsDoc ? Array.from(relsDoc.getElementsByTagName('Relationship')) : [];

  let layoutDoc = null, masterDoc = null, themeDoc = null;
  const layoutRel = rels.find((r) => (r.getAttribute('Type') || '').includes('slideLayout'));
  if (layoutRel) {
    const layoutPath = resolveRelPath(slidePath, layoutRel.getAttribute('Target'));
    layoutDoc = await readXml(layoutPath);
    if (layoutDoc) {
      const layoutRelsDoc = await readXml(`ppt/slideLayouts/_rels/${layoutPath.split('/').pop()}.rels`);
      const layoutRels = layoutRelsDoc ? Array.from(layoutRelsDoc.getElementsByTagName('Relationship')) : [];
      const masterRel = layoutRels.find((r) => (r.getAttribute('Type') || '').includes('slideMaster'));
      if (masterRel) {
        const masterPath = resolveRelPath(layoutPath, masterRel.getAttribute('Target'));
        masterDoc = await readXml(masterPath);
        if (masterDoc) {
          const masterRelsDoc = await readXml(`ppt/slideMasters/_rels/${masterPath.split('/').pop()}.rels`);
          const masterRels = masterRelsDoc ? Array.from(masterRelsDoc.getElementsByTagName('Relationship')) : [];
          const themeRel = masterRels.find((r) => (r.getAttribute('Type') || '').includes('theme'));
          if (themeRel) themeDoc = await readXml(resolveRelPath(masterPath, themeRel.getAttribute('Target')));
        }
      }
    }
  }

  const theme = parseThemeColors(themeDoc);
  const clrMap = parseClrMap(masterDoc) || DEFAULT_CLRMAP;
  const layoutPh = collectPlaceholderPositions(layoutDoc);
  const ctx = { zip, slidePath, rels, theme, clrMap, layoutPh, stackCounter: { n: 0 } };

  const background =
    (await parseBg(slideDoc.getElementsByTagName('p:bg')[0], theme, clrMap, ctx)) ||
    (await parseBg(layoutDoc?.getElementsByTagName('p:bg')[0], theme, clrMap, ctx)) ||
    (await parseBg(masterDoc?.getElementsByTagName('p:bg')[0], theme, clrMap, ctx)) ||
    '#ffffff';

  const spTree = slideDoc.getElementsByTagName('p:spTree')[0];
  const shapes = [];
  if (spTree) {
    for (const child of Array.from(spTree.children)) {
      if (['p:sp', 'p:pic', 'p:graphicFrame', 'p:grpSp', 'p:cxnSp'].includes(child.tagName)) {
        const node = await parseShapeNode(child, ctx);
        if (node) shapes.push(node);
      }
    }
  }
  return { background, shapes };
}

async function parsePptxFile(arrayBuffer) {
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const parser = new DOMParser();
  const xmlCache = new Map();
  const readXml = async (path) => {
    if (xmlCache.has(path)) return xmlCache.get(path);
    const file = zip.file(path);
    if (!file) { xmlCache.set(path, null); return null; }
    const doc = parser.parseFromString(await file.async('text'), 'application/xml');
    xmlCache.set(path, doc);
    return doc;
  };

  const presDoc = await readXml('ppt/presentation.xml');
  const sldSz = presDoc?.getElementsByTagName('p:sldSz')[0];
  const slideW = sldSz ? num(sldSz.getAttribute('cx'), 9144000) : 9144000;
  const slideH = sldSz ? num(sldSz.getAttribute('cy'), 5143500) : 5143500;
  const virtualW = emuToPx(slideW);
  const virtualH = emuToPx(slideH);

  const presRelsDoc = await readXml('ppt/_rels/presentation.xml.rels');
  const relMap = {};
  presRelsDoc && Array.from(presRelsDoc.getElementsByTagName('Relationship')).forEach((r) => {
    relMap[r.getAttribute('Id')] = r.getAttribute('Target');
  });

  let slidePaths = presDoc
    ? Array.from(presDoc.getElementsByTagName('p:sldId'))
        .map((s) => relMap[s.getAttribute('r:id')])
        .filter(Boolean)
        .map((p) => (p.startsWith('slides/') ? `ppt/${p}` : p))
    : [];

  if (slidePaths.length === 0) {
    slidePaths = Object.keys(zip.files)
      .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
      .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
  }

  const slides = [];
  for (const slidePath of slidePaths) {
    const slide = await parseSlide(zip, readXml, slidePath);
    if (slide) slides.push(slide);
  }

  return { slideW, slideH, virtualW, virtualH, slides };
}

/* ============================================================================
   7. PARSER PDF (setiap halaman dirender apa adanya lewat pdf.js)
   ============================================================================ */
async function parsePdfFile(arrayBuffer) {
  const pdfjsLib = await loadPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const targetWidth = 1600;
  let virtualW = 1280, virtualH = 720;
  const slides = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const canvasContext = canvas.getContext('2d');
    await page.render({ canvasContext, viewport }).promise;
    const src = canvas.toDataURL('image/jpeg', 0.85);
    if (i === 1) { virtualW = baseViewport.width; virtualH = baseViewport.height; }
    slides.push({
      background: '#ffffff',
      shapes: [{ type: 'image', xfrm: null, src, geom: null, fullBleed: true, stackIndex: 0 }],
    });
    canvas.width = 0; canvas.height = 0;
  }

  return { slideW: virtualW, slideH: virtualH, virtualW, virtualH, slides };
}

/* ============================================================================
   8. RENDER SATU SLIDE
   ============================================================================ */
function TextBlock({ paragraphs, phType, defaultColor, anchor }) {
  const isTitle = phType === 'title' || phType === 'ctrTitle';
  const defaultSize = isTitle ? 30 : phType === 'subTitle' ? 20 : 18;
  const align = phType === 'ctrTitle' || phType === 'subTitle' ? 'center' : (phType ? 'left' : 'center');
  const bulletColor = defaultColor === '#ffffff' ? 'rgba(255,255,255,0.75)' : '#64748b';
  return (
    <div
      style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        justifyContent: anchor || 'center', overflow: 'hidden', textAlign: align,
        padding: '3% 5%', boxSizing: 'border-box',
      }}
    >
      {paragraphs.map((p, i) => (
        <p key={i} style={{ margin: '3px 0', paddingLeft: p.bullet ? 20 + p.level * 18 : p.level * 18, position: 'relative', lineHeight: 1.35 }}>
          {p.bullet && <span style={{ position: 'absolute', left: p.level * 18, color: bulletColor }}>•</span>}
          {p.runs.map((r, j) => (
            <span
              key={j}
              style={{
                fontWeight: r.bold || isTitle ? 700 : 400,
                fontStyle: r.italic ? 'italic' : 'normal',
                fontSize: ptToPx(r.size || defaultSize),
                color: r.color || defaultColor,
              }}
            >
              {r.text}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

function TableNode({ node, box }) {
  const { colWidths, rows } = node.table;
  const totalW = colWidths.reduce((a, b) => a + b, 0) || 1;
  return (
    <div style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, overflow: 'auto' }}>
      <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 13 }}>
        <colgroup>
          {colWidths.map((w, i) => <col key={i} style={{ width: `${(w / totalW) * 100}%` }} />)}
        </colgroup>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.cells.map((c, ci) => (
                <td key={ci} style={{ border: '1px solid #cbd5e1', padding: '4px 8px', verticalAlign: 'middle', background: c.fill?.color || '#ffffff', color: '#1e293b' }}>
                  {c.paragraphs.map((p, pi) => (
                    <div key={pi} style={{ lineHeight: 1.3 }}>
                      {p.runs.map((run, rj) => (
                        <span key={rj} style={{ fontWeight: run.bold ? 700 : 400, fontStyle: run.italic ? 'italic' : 'normal', color: run.color || 'inherit' }}>
                          {run.text}
                        </span>
                      ))}
                    </div>
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShapeNode({ node, frame }) {
  if (!node) return null;
  const box = toPxBox(node, frame);
  const rotDeg = node.xfrm?.rotDeg || 0;
  const transformParts = [];
  if (node.xfrm?.flipH) transformParts.push('scaleX(-1)');
  if (node.xfrm?.flipV) transformParts.push('scaleY(-1)');
  if (rotDeg) transformParts.push(`rotate(${rotDeg}deg)`);
  const transform = transformParts.length ? transformParts.join(' ') : undefined;

  if (node.type === 'group') {
    const childFrame = {
      chOffX: node.xfrm?.chOff?.x ?? node.xfrm?.off?.x ?? 0,
      chOffY: node.xfrm?.chOff?.y ?? node.xfrm?.off?.y ?? 0,
      chExtCx: node.xfrm?.chExt?.cx || node.xfrm?.ext?.cx || 1,
      chExtCy: node.xfrm?.chExt?.cy || node.xfrm?.ext?.cy || 1,
      pxW: box.width, pxH: box.height,
    };
    return (
      <div style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, transform, transformOrigin: 'center center' }}>
        {node.children.map((c, i) => <ShapeNode key={i} node={c} frame={childFrame} />)}
      </div>
    );
  }

  if (node.type === 'image') {
    return (
      <img
        src={node.src}
        alt=""
        style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, objectFit: node.fullBleed ? 'contain' : 'fill', transform, transformOrigin: 'center center', ...geomClipStyle(node.geom) }}
      />
    );
  }

  if (node.type === 'shape') {
    const isGradient = node.fill?.type === 'gradient';
    const isImage = node.fill?.type === 'image';
    const bg = isGradient ? node.fill.css : (isImage ? undefined : (node.fill?.color || 'transparent'));
    let defaultColor;
    if (node.phType === 'title' || node.phType === 'ctrTitle') defaultColor = '#0f172a';
    else if (node.phType) defaultColor = '#334155';
    else defaultColor = contrastColor(node.fill?.type === 'solid' ? node.fill.color : (isGradient ? '#94a3b8' : null));
    return (
      <div
        style={{
          position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height,
          background: bg, backgroundImage: isImage ? `url(${node.fill.src})` : undefined,
          backgroundSize: 'cover', backgroundPosition: 'center',
          border: node.line ? `${node.line.width}px solid ${node.line.color}` : 'none',
          transform, transformOrigin: 'center center', ...geomClipStyle(node.geom),
        }}
      >
        {node.paragraphs?.length ? (
          <TextBlock paragraphs={node.paragraphs} phType={node.phType} defaultColor={defaultColor} anchor={node.anchor} />
        ) : null}
      </div>
    );
  }

  if (node.type === 'connector') {
    const x1 = node.xfrm?.flipH ? box.width : 0;
    const x2 = node.xfrm?.flipH ? 0 : box.width;
    const y1 = node.xfrm?.flipV ? box.height : 0;
    const y2 = node.xfrm?.flipV ? 0 : box.height;
    return (
      <svg style={{ position: 'absolute', left: box.left, top: box.top, width: box.width || 1, height: box.height || 1, overflow: 'visible' }}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={node.line?.color || '#94a3b8'} strokeWidth={node.line?.width || 1.5} />
      </svg>
    );
  }

  if (node.type === 'table') return <TableNode node={node} box={box} />;

  return (
    <div
      style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, transform, transformOrigin: 'center center' }}
      className="flex items-center justify-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wide text-center px-2 shadow-inner"
    >
      {node.label}
    </div>
  );
}

// Mengumpulkan seluruh teks slide (termasuk di dalam grup & tabel) untuk fitur review AI
function collectSlideText(nodes) {
  let out = [];
  for (const node of nodes || []) {
    if (!node) continue;
    if (node.type === 'shape' && node.paragraphs?.length) {
      out.push(node.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n'));
    } else if (node.type === 'table') {
      node.table.rows.forEach((row) => row.cells.forEach((cell) => {
        const t = cell.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n');
        if (t.trim()) out.push(t);
      }));
    } else if (node.type === 'group') {
      out = out.concat(collectSlideText(node.children));
    }
  }
  return out;
}

function SlideCanvas({ slide, virtualW, virtualH, slideW, slideH, className = '', laserMode = false }) {
  const outerRef = useRef(null);
  const [scale, setScale] = useState(0);
  const [laserPos, setLaserPos] = useState(null);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setScale(rect.width / virtualW);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [virtualW]);

  const handleMouseMove = (e) => {
    if (!laserMode || !outerRef.current) return;
    const rect = outerRef.current.getBoundingClientRect();
    setLaserPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const handleMouseLeave = () => setLaserPos(null);

  const rootFrame = { chOffX: 0, chOffY: 0, chExtCx: slideW || virtualW, chExtCy: slideH || virtualH, pxW: virtualW, pxH: virtualH };
  const bg = slide.background;
  const bgIsImage = bg && typeof bg === 'object' && bg.image;

  return (
    <div
      ref={outerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden bg-black ${className} ${laserMode ? 'cursor-none' : ''}`}
      style={{ aspectRatio: `${virtualW} / ${virtualH}`, width: '100%', maxWidth: '100%', maxHeight: '100%', margin: '0 auto' }}
    >
      {scale > 0 && (
        <div
          style={{
            width: virtualW, height: virtualH,
            background: bgIsImage ? `url(${bg.image}) center / cover no-repeat` : (bg || '#ffffff'),
            transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute',
            left: 0, top: 0, fontFamily: 'Inter, sans-serif',
          }}
        >
          {slide.shapes.map((node, i) => <ShapeNode key={i} node={node} frame={rootFrame} />)}
        </div>
      )}

      {laserMode && laserPos && (
        <div
          className="absolute pointer-events-none rounded-full bg-rose-500 shadow-[0_0_20px_8px_rgba(244,63,94,0.6)] mix-blend-screen"
          style={{ width: '12px', height: '12px', left: laserPos.x - 6, top: laserPos.y - 6, zIndex: 50, transition: 'width 0.1s, height 0.1s' }}
        />
      )}
    </div>
  );
}

function PresentationTimer({ isRunning }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let interval = null;
    if (isRunning) {
      interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (!isRunning && seconds !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning, seconds]);

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-white font-mono text-sm tracking-widest shadow-inner border border-white/10">
      <Clock size={16} className={isRunning ? 'animate-pulse text-cyan-400' : 'text-slate-400'} />
      {formatTime(seconds)}
    </div>
  );
}

/* ============================================================================
   9. VIEWER UTAMA (deck aktif: Glassmorphism, layar penuh, fitur sidang)
   ============================================================================ */
function DeckViewer({ deck, parsed, onClose, onAskAI }) {
  const [index, setIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [aiFeedback, setAiFeedback] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  const [laserMode, setLaserMode] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [notes, setNotes] = useState({});
  const [showNotes, setShowNotes] = useState(false);
  const [showUI, setShowUI] = useState(true);

  const stageRef = useRef(null);
  const touchStartX = useRef(null);
  const uiTimeoutRef = useRef(null);

  const total = parsed.slides.length;
  const goTo = useCallback((n) => setIndex(Math.max(0, Math.min(total - 1, n))), [total]);

  const handleNoteChange = (e) => {
    setNotes((prev) => ({ ...prev, [index]: e.target.value }));
  };

  useEffect(() => { setAiFeedback(''); }, [index]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === ' ') goTo(index + 1);
      if (e.key === 'ArrowLeft') goTo(index - 1);
      if (e.key === 'Escape') {
        setIsFullscreen(false);
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      }
      if (e.key === 'l' || e.key === 'L') setLaserMode((prev) => !prev);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, goTo]);

  useEffect(() => {
    const onFsChange = () => setIsNativeFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const startHideTimer = () => {
      if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
      uiTimeoutRef.current = setTimeout(() => {
        if (isFullscreen && !showNotes) setShowUI(false);
      }, 3000);
    };
    if (isFullscreen && !showNotes) startHideTimer();

    const handleMouseMove = (e) => {
      const isNearEdge = e.clientY < 150 || e.clientY > window.innerHeight - 150;
      if (isNearEdge) { setShowUI(true); startHideTimer(); }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
    };
  }, [isFullscreen, showNotes]);

  const toggleNativeFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      stageRef.current?.requestFullscreen?.().catch(console.warn);
      setIsFullscreen(true);
      setTimerRunning(true);
    }
  };

  const handleAskAI = async () => {
    if (!onAskAI) return;
    setIsAsking(true);
    setAiFeedback('');
    try {
      const slideText = collectSlideText(parsed.slides[index].shapes).join('\n');
      const prompt = `Berikut isi teks slide ke-${index + 1} dari presentasi skripsi berjudul "${deck.name}":\n\n${slideText || '(slide ini tidak memiliki teks, mungkin hanya gambar)'}\n\nBerikan tinjauan singkat (maksimal 4 kalimat) dalam Bahasa Indonesia: apakah isi slide ini cukup jelas untuk sidang, apakah teksnya terlalu padat, dan satu saran perbaikan konkret.`;
      const result = await onAskAI(prompt, 'Kamu adalah dosen pembimbing yang memberi masukan singkat, tajam, dan membangun untuk slide presentasi sidang skripsi mahasiswa.');
      setAiFeedback(typeof result === 'string' ? result : String(result ?? ''));
    } catch (err) {
      setAiFeedback('Gagal meminta tinjauan AI. Coba lagi.');
    } finally {
      setIsAsking(false);
    }
  };

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta > 50) goTo(index - 1);
    else if (delta < -50) goTo(index + 1);
    touchStartX.current = null;
  };

  if (isFullscreen) {
    return (
      <div
        ref={stageRef}
        className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-3xl flex flex-col items-center justify-center animate-in fade-in duration-700"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className={`relative flex items-center justify-center h-full transition-all duration-500 ease-out ${showNotes ? 'w-2/3 ml-0 mr-auto p-6 sm:p-16' : 'w-full p-0'}`}>
            <div className={`relative flex items-center justify-center bg-black overflow-hidden ${showNotes ? 'shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] rounded-xl ring-1 ring-white/20 w-full h-full' : 'w-full h-full'}`}>
              <SlideCanvas
                slide={parsed.slides[index]}
                virtualW={parsed.virtualW}
                virtualH={parsed.virtualH}
                slideW={parsed.slideW}
                slideH={parsed.slideH}
                laserMode={laserMode}
              />
            </div>

            <button onClick={() => goTo(index - 1)} className="absolute left-0 top-0 bottom-0 w-1/5 z-10 cursor-w-resize opacity-0"></button>
            <button onClick={() => goTo(index + 1)} className="absolute right-0 top-0 bottom-0 w-1/5 z-10 cursor-e-resize opacity-0"></button>
        </div>

        {showNotes && (
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-slate-900/60 backdrop-blur-2xl border-l border-white/10 p-8 flex flex-col z-40 shadow-2xl animate-in slide-in-from-right-10 duration-500">
             <div className="flex items-center justify-between mb-6">
                <h4 className="text-white font-black text-xl flex items-center gap-3">
                  <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl"><PenTool size={20}/></span>
                  Catatan Slide
                </h4>
                <div className="bg-white/10 px-3 py-1 rounded-full text-white/70 text-sm font-bold border border-white/5">Slide {index + 1}</div>
             </div>
             <textarea
               value={notes[index] || ''}
               onChange={handleNoteChange}
               placeholder="Tulis naskah presentasi atau poin-poin penting untuk slide ini..."
               className="flex-1 bg-black/20 text-slate-100 border border-white/10 rounded-2xl p-6 resize-none focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 leading-relaxed text-lg custom-scrollbar transition-all"
             />
             <div className="mt-6 flex items-center gap-2 text-xs text-white/40 bg-white/5 p-4 rounded-2xl">
               <Info size={16}/> Catatan ini otomatis tersimpan selama sesi simulasi berlangsung.
             </div>
          </div>
        )}

        <div className={`absolute bottom-8 left-6 flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-xl border border-white/10 p-2 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-50 max-w-[calc(100vw-3rem)] overflow-x-auto custom-scrollbar transition-all duration-500 ${showUI ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
          <button onClick={() => {
             setIsFullscreen(false);
             if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
          }} className="shrink-0 text-white hover:text-rose-400 p-2 rounded-full hover:bg-white/10 transition-colors" title="Tutup">
            <X size={20} />
          </button>
          <div className="shrink-0 w-[1px] h-6 bg-white/15"></div>
          <div className="shrink-0 text-white font-bold truncate max-w-[120px] sm:max-w-[220px] text-sm px-1">{deck.name}</div>
          <div className="shrink-0 w-[1px] h-6 bg-white/15"></div>
          <div className="shrink-0"><PresentationTimer isRunning={timerRunning} /></div>
          <button onClick={() => setTimerRunning(!timerRunning)} className="shrink-0 text-white hover:text-cyan-400 p-2 rounded-full hover:bg-white/10 transition-colors" title={timerRunning ? "Jeda Waktu" : "Mulai Waktu"}>
            {timerRunning ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button onClick={() => setLaserMode(!laserMode)} className={`shrink-0 p-2 rounded-full transition-all ${laserMode ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.6)]' : 'text-white hover:text-rose-400 hover:bg-white/10'}`} title="Laser Pointer (Shortcut: L)">
            <MousePointer2 size={20} />
          </button>
          <button onClick={() => setShowNotes(!showNotes)} className={`shrink-0 p-2 rounded-full transition-all ${showNotes ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.6)]' : 'text-white hover:text-indigo-400 hover:bg-white/10'}`} title="Catatan Speaker">
            <Edit3 size={20} />
          </button>
          {!isNativeFullscreen && (
            <button onClick={toggleNativeFullscreen} className="shrink-0 text-white hover:text-cyan-400 p-2 rounded-full hover:bg-white/10 transition-colors" title="Fullscreen Native">
              <Maximize2 size={20} />
            </button>
          )}
          <div className="shrink-0 w-[1px] h-6 bg-white/15"></div>
          <button onClick={() => goTo(index - 1)} disabled={index === 0} className="shrink-0 p-2 text-white hover:bg-white/10 rounded-full disabled:opacity-30 transition-all" title="Slide sebelumnya">
            <ChevronLeft size={20} />
          </button>
          <div className="shrink-0 flex flex-col items-center justify-center min-w-[3.5rem] text-white">
            <span className="text-sm font-black tabular-nums tracking-widest leading-tight">{index + 1}</span>
            <span className="text-[9px] uppercase font-bold tracking-widest opacity-50 leading-tight">of {total}</span>
          </div>
          <button onClick={() => goTo(index + 1)} disabled={index === total - 1} className="shrink-0 p-2 text-white hover:bg-white/10 rounded-full disabled:opacity-30 transition-all" title="Slide berikutnya">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-5xl mx-auto relative z-10">
      <div className="glass-panel p-6 sm:p-8 rounded-[2.5rem] shadow-xl shadow-blue-900/5 flex flex-col sm:flex-row items-center justify-between gap-6 mb-8 mt-4">
        <div className="min-w-0 flex-1">
          <button onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-indigo-600 mb-2 flex items-center gap-1.5 transition-colors bg-white/50 px-3 py-1 rounded-full w-fit">
            <ChevronLeft size={14} /> Kembali ke Koleksi
          </button>
          <h3 className="text-xl sm:text-2xl font-black text-slate-800 truncate bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-indigo-800">{deck.name}</h3>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => { setIsFullscreen(true); setTimerRunning(true); toggleNativeFullscreen(); }} className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-105 font-bold text-sm transition-all">
            <PlayCircle size={20} /> Mulai Simulasi
          </button>
        </div>
      </div>

      <div className="relative group w-full max-w-4xl mx-auto rounded-[2rem] overflow-hidden border border-white shadow-2xl shadow-slate-300/50 bg-white">
        <SlideCanvas slide={parsed.slides[index]} virtualW={parsed.virtualW} virtualH={parsed.virtualH} slideW={parsed.slideW} slideH={parsed.slideH} />
        <button onClick={() => goTo(index - 1)} disabled={index === 0} className="absolute left-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/80 backdrop-blur-md shadow-xl border border-white text-slate-800 opacity-0 group-hover:opacity-100 disabled:opacity-0 hover:scale-110 transition-all duration-300">
          <ChevronLeft size={28} />
        </button>
        <button onClick={() => goTo(index + 1)} disabled={index === total - 1} className="absolute right-6 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/80 backdrop-blur-md shadow-xl border border-white text-slate-800 opacity-0 group-hover:opacity-100 disabled:opacity-0 hover:scale-110 transition-all duration-300">
          <ChevronRight size={28} />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between mt-8 mb-6 max-w-4xl mx-auto gap-4 glass-panel p-4 rounded-[2rem]">
        <span className="text-sm font-black text-slate-600 tabular-nums px-4 py-2 bg-white/60 rounded-full border border-white">
          Slide {index + 1} / {total}
        </span>
        {onAskAI && (
          <button onClick={handleAskAI} disabled={isAsking} className="flex items-center gap-2 text-sm font-bold text-indigo-700 bg-white/60 hover:bg-white px-6 py-2.5 rounded-full border border-white shadow-sm hover:shadow-md hover:text-indigo-600 disabled:opacity-60 transition-all">
            {isAsking ? <Loader2 size={18} className="animate-spin text-indigo-500" /> : <Sparkles size={18} className="text-indigo-500" />}
            Minta AI Review Slide Ini
          </button>
        )}
      </div>

      {aiFeedback && (
        <div className="mb-8 max-w-4xl mx-auto p-6 rounded-[2rem] bg-gradient-to-br from-indigo-50/80 to-cyan-50/80 backdrop-blur-xl border border-white shadow-xl shadow-indigo-100/50 text-sm text-slate-700 leading-relaxed animate-in fade-in slide-in-from-top-4 duration-500 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-cyan-400"></div>
          <div className="flex items-center gap-2 text-xs font-black text-indigo-700 mb-3 tracking-widest uppercase">
            <Sparkles size={16} /> Analisis Pembimbing AI
          </div>
          <p className="text-base">{aiFeedback}</p>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-6 max-w-4xl mx-auto px-2">
        {parsed.slides.map((s, i) => (
          <button key={i} onClick={() => goTo(i)} className={`shrink-0 w-32 sm:w-40 rounded-[1.5rem] overflow-hidden border-4 transition-all duration-300 shadow-lg ${i === index ? 'border-indigo-400 shadow-indigo-200/50 scale-105' : 'border-white hover:border-slate-200 hover:scale-105'}`}>
            <SlideCanvas slide={s} virtualW={parsed.virtualW} virtualH={parsed.virtualH} slideW={parsed.slideW} slideH={parsed.slideH} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
   10. TAB UTAMA (Gaya Morpisem / Glassmorphism)
   ============================================================================ */
export default function App({ onAskAI }) {
  const [decks, setDecks] = useState([]);
  const [activeDeck, setActiveDeck] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const refreshDecks = useCallback(async () => setDecks(await getPptxDecks()), []);
  useEffect(() => { refreshDecks(); }, [refreshDecks]);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList).filter((f) => /\.(pptx|pdf)$/i.test(f.name));
    if (!files.length) { setError('Hanya file .pptx atau .pdf yang didukung.'); return; }
    setIsUploading(true);
    setError('');
    try {
      for (const file of files) {
        const base64 = await fileToBase64(file);
        const type = /\.pdf$/i.test(file.name) ? 'pdf' : 'pptx';
        await savePptxDeck({ id: newId(), name: file.name, size: file.size, uploadedAt: Date.now(), fileBase64: base64, type });
      }
      await refreshDecks();
    } catch (err) {
      setError('Gagal mengunggah file. Pastikan file tidak rusak.');
    } finally {
      setIsUploading(false);
    }
  };

  const openDeck = async (deck) => {
    setIsOpening(true);
    setError('');
    try {
      const buf = base64ToArrayBuffer(deck.fileBase64);
      const type = getDeckType(deck);
      const result = type === 'pdf' ? await parsePdfFile(buf) : await parsePptxFile(buf);
      if (!result.slides.length) throw new Error('empty');
      setParsed(result);
      setActiveDeck(deck);
    } catch (err) {
      setError('Gagal membaca isi presentasi ini. Format mungkin tidak didukung, file terenkripsi, atau rusak.');
    } finally {
      setIsOpening(false);
    }
  };

  const removeDeck = async (id, e) => {
    e.stopPropagation();
    await deletePptxDeckDB(id);
    if (activeDeck?.id === id) { setActiveDeck(null); setParsed(null); }
    await refreshDecks();
  };

  return (
    <div className="min-h-screen bg-[#060102] font-sans text-stone-200 p-4 sm:p-8 relative overflow-hidden">

      {activeDeck && parsed ? (
        <DeckViewer deck={activeDeck} parsed={parsed} onAskAI={onAskAI} onClose={() => { setActiveDeck(null); setParsed(null); }} />
      ) : (
        <div className="max-w-5xl mx-auto relative z-10 space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">

          <label
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
            className={`relative block rounded-[2.5rem] border-2 border-dashed p-10 sm:p-16 text-center cursor-pointer transition-all duration-500 shadow-[0_0_40px_rgba(0,0,0,0.85)] ${
              isDragging
                ? 'border-red-500 bg-red-950/40 scale-[1.02] shadow-[0_0_30px_rgba(220,38,38,0.4)]'
                : 'border-red-950/90 bg-[#0c0305] hover:border-red-700/60 hover:bg-[#120407] hover:-translate-y-1'
            }`}
          >
            <input type="file" accept=".pptx,.pdf" multiple onChange={(e) => handleFiles(e.target.files)} disabled={isUploading || isOpening} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />

            <div className="inline-flex p-6 bg-gradient-to-br from-red-600 to-red-950 text-white rounded-[2rem] shadow-[0_0_25px_rgba(220,38,38,0.5)] border border-red-500/40 mb-6 transition-transform hover:scale-110">
              {isUploading || isOpening ? <Loader2 size={48} className="animate-spin text-red-300" /> : <Upload size={48} className="text-red-200" />}
            </div>

            <p className="text-xl font-black text-stone-100 font-cinzel tracking-wider">
              {isUploading ? 'Sedang Memasukkan Gulungan...' : isOpening ? 'Membuka Mantra Presentasi...' : 'Tarik & Lepas Gulungan .pptx / .pdf Di Sini'}
            </p>
            <p className="text-xs sm:text-sm text-red-400 mt-3 font-medium bg-[#160508] px-4 py-1.5 rounded-full inline-block border border-red-950/90 font-cinzel">
              Atau klik untuk memilih file dari pusaka komputermu
            </p>
            <p className="text-xs text-stone-500 mt-4 max-w-md mx-auto font-mincho">
              Catatan: Elemen kompleks seperti grafik khusus atau smartart lama dirender otomatis sebaik mungkin di atas kanvas web.
            </p>
          </label>

          {error && (
            <div className="flex items-center gap-3 text-sm font-bold text-red-300 border border-red-800/80 bg-red-950/60 p-5 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.3)] animate-in slide-in-from-top-4 font-mincho">
              <FileWarning size={24} className="shrink-0 text-red-500" /> {error}
            </div>
          )}

          <div className="space-y-6">
            <h3 className="text-xl font-black text-stone-100 flex items-center gap-3 pl-2 font-cinzel tracking-wider">
              <Layers size={24} className="text-red-500"/> Gulungan Slide Presentasi
            </h3>

            {decks.length === 0 ? (
              <div className="text-center py-16 rounded-[2.5rem] border border-red-950/80 border-dashed bg-[#0a0204]">
                <Presentation size={48} className="mx-auto mb-4 text-red-950 opacity-60" />
                <p className="text-stone-300 font-bold text-lg font-cinzel">Ruang Koleksi Belum Ada Gulungan</p>
                <p className="text-stone-500 text-sm mt-1 font-mincho">Unggah slide PPTX / PDF untuk memulai latihan dan teleprompter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {decks.map((deck) => {
                  const type = getDeckType(deck);
                  return (
                    <div
                      key={deck.id}
                      onClick={() => openDeck(deck)}
                      className="bg-[#0c0305] p-6 rounded-[2rem] shadow-[0_0_25px_rgba(0,0,0,0.8)] hover:shadow-[0_0_30px_rgba(220,38,38,0.3)] hover:-translate-y-1.5 cursor-pointer group relative transition-all duration-300 border border-red-950/80 hover:border-red-600/70 overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-900/15 to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                      <button
                        onClick={(e) => removeDeck(deck.id, e)}
                        className="absolute top-4 right-4 p-2.5 rounded-full text-stone-500 hover:text-white hover:bg-red-900/80 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 z-10 shadow-sm border border-red-950/70"
                        title="Hapus file"
                      >
                        <Trash2 size={16} />
                      </button>

                      <div className="relative inline-flex p-3.5 bg-[#170508] border border-red-950/90 text-red-400 rounded-2xl mb-4 group-hover:scale-110 transition-transform shadow-sm">
                        {type === 'pdf' ? <FileText size={26} /> : <Presentation size={26} />}
                      </div>

                      <p className="relative font-black text-stone-100 pr-8 line-clamp-2 leading-snug text-base font-cinzel tracking-wide">{deck.name}</p>

                      <div className="relative flex items-center gap-2 text-xs text-stone-400 mt-4 font-bold bg-[#140508] w-fit px-3 py-1.5 rounded-full border border-red-950/80 font-cinzel">
                        <span className="uppercase text-red-400">{type}</span>
                        <span className="text-red-950">•</span>
                        <span>{formatBytes(deck.size)}</span>
                        <span className="text-red-950">•</span>
                        <span>{new Date(deck.uploadedAt).toLocaleDateString('id-ID')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.4);
          border-radius: 12px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(185, 28, 28, 0.4);
          border-radius: 12px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(220, 38, 38, 0.7);
        }
      `}} />
    </div>
  );
}