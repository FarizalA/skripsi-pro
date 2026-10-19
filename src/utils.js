// utils.js — Helper umum (parsing file, IndexedDB lokal, dan pemanggilan AI)
// Dipisah dari App.jsx supaya bisa dipakai bareng oleh App.jsx & LabStatistikApp.jsx
// tanpa harus ikut ke-bundle dua kali.

// Menggunakan API SumoPod Langsung
const apiKey = "sk-JO3lIi4Ac1vwYL-8ND1qeg";
const openAiUrl = "https://ai.sumopod.com/v1/chat/completions";
const defaultModel = "gpt-4o-mini";

const loadPdfJs = () => {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error("Gagal memuat library PDF.js"));
    document.head.appendChild(script);
  });
};

const extractTextFromPdfBase64 = async (base64Data) => {
  const pdfjs = await loadPdfJs();
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  let text = '';
  const maxPages = Math.min(pdf.numPages, 15);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
};

const dbName = "SkripsiProLocalDB";
const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveFileDB = async (fileData) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(fileData);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getFilesDB = async () => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction('files', 'readonly');
    const req = tx.objectStore('files').getAll();
    req.onsuccess = () => resolve(req.result);
  });
};

export const deleteFileDB = async (id) => {
  const db = await initDB();
  return new Promise((resolve) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').delete(id);
    tx.oncomplete = () => resolve();
  });
};

export const fileToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result.split(',')[1];
      resolve(base64data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const getMimeType = (fileBlob, fileName) => {
  if (fileBlob.type) return fileBlob.type;
  const ext = fileName.split('.').pop().toLowerCase();
  const mimeTypes = { 'pdf': 'application/pdf', 'txt': 'text/plain', 'csv': 'text/csv', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  return mimeTypes[ext] || 'application/octet-stream';
};

export const formatBytes = (bytes) => {
  if (bytes === 0 || !bytes) return '0 Bytes';
  const k = 1024, dm = 2, sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// --- FUNGSI PENGAMAN PARSING LOCALSTORAGE ---
export const safeParseArray = (key, fallback = []) => {
  try {
    const data = localStorage.getItem(key);
    if (!data) return fallback;
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
};

export const safeParseObject = (key, fallback = {}) => {
  try {
    const data = localStorage.getItem(key);
    if (!data) return fallback;
    const parsed = JSON.parse(data);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
};

// Cek keberadaan 1 dokumen Firestore lewat REST API langsung (tanpa SDK firebase/firestore).
// Cocok untuk kasus baca sekali-jalan (bukan real-time) & Rules yang mengizinkan `allow read: if true`.
// Kalau dokumennya ada -> 200 (true), kalau gak ada -> 404 (false).
export const checkFirestoreDocExists = async (projectId, collectionId, docId) => {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionId}/${encodeURIComponent(docId)}`;
  const res = await fetch(url);
  if (res.status === 200) return true;
  if (res.status === 404) return false;
  throw new Error(`Gagal memeriksa data (HTTP ${res.status})`);
};

export const callGeminiAPI = async (promptText, systemPrompt, chatHistory = [], useSearch = false, fileInlineData = null, expectJson = false) => {
  const messages = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  chatHistory.forEach(m => {
    messages.push({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text });
  });

  let finalPromptText = promptText;
  let userContent = [];

  if (fileInlineData) {
    if (fileInlineData.mimeType.startsWith('image/')) {
      userContent.push({ type: "text", text: promptText || "Jelaskan gambar ini" });
      userContent.push({ type: "image_url", image_url: { url: `data:${fileInlineData.mimeType};base64,${fileInlineData.data}` } });
      finalPromptText = null; 
    } else if (fileInlineData.mimeType === 'application/pdf') {
      try {
        const pdfText = await extractTextFromPdfBase64(fileInlineData.data);
        finalPromptText = `${promptText}\n\n--- BERIKUT ADALAH ISI DOKUMEN PDF ---\n\n${pdfText}`;
      } catch (err) {
        throw new Error("Gagal membaca teks dari PDF.");
      }
    } else {
      try {
        const binaryString = atob(fileInlineData.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
        const decodedText = new TextDecoder('utf-8').decode(bytes);
        finalPromptText = `${promptText}\n\n--- BERIKUT ADALAH ISI DOKUMEN ---\n\n${decodedText}`;
      } catch (err) {
        throw new Error("Gagal mengurai teks dokumen.");
      }
    }
  }

  if (finalPromptText !== null) {
    userContent = finalPromptText;
  }

  if (userContent !== null && (typeof userContent === 'string' || userContent.length > 0)) {
    messages.push({ role: "user", content: userContent });
  }

  const payload = { 
    model: defaultModel,
    messages: messages
  };

  if (expectJson) {
    payload.response_format = { type: "json_object" };
  }

  const maxRetries = 5;
  const delays = [1000, 2000, 4000, 8000, 16000];

  for (let i = 0; i < maxRetries; i++) {
    try {
      // Mengirim request langsung ke URL SumoPod dengan menyertakan ApiKey
      const res = await fetch(openAiUrl, { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }, 
        body: JSON.stringify(payload) 
      });
      
      if (!res.ok) { 
        const errText = await res.text(); 
        throw new Error(`HTTP Error ${res.status}: ${errText}`); 
      }
      
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || "Gagal mendapatkan respon dari AI.";
      
      return { text, sources: [] };
    } catch (error) {
      if (i === maxRetries - 1) throw new Error(`Gagal menghubungi AI: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delays[i]));
    }
  }
};
