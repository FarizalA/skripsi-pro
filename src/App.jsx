import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import logoImg from './assets/logo.png';
import samuraiHeroImg from './assets/samurai_hero.jpg';
import oniSumieImg from './assets/oni_sumie.jpg';
import bloodMoonImg from './assets/blood_moon.jpg';
import cursedBossImg from './assets/cursed_boss.jpg';
import PresentasiSkripsi from './PptxViewer';
import LembarSkripsi from './LembarSkripsi';
import { 
  LayoutDashboard, FolderOpen, MessageSquare, Plus, Trash2, 
  FileText, ChevronRight, ChevronLeft, ArrowLeft, UploadCloud, Download, 
  Loader2, Sparkles, ChevronDown, ChevronUp, Bot, Send, X, Eye, 
  Table, Edit, Lightbulb, Database, DownloadCloud, Share2, GitMerge, 
  ScanSearch, AlignLeft, Search, StickyNote, ShieldAlert, Mic, Play, Square, Zap, ShieldCheck,
  ListChecks, Target, CheckSquare, Copy, Crown, TrendingUp, Lock, Activity,
  PanelLeftClose, PanelLeftOpen, Presentation, Skull, Flame, Sword, Swords, Clock, Hourglass, Compass,
  Scroll, ScrollText
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { saveFileDB, getFilesDB, deleteFileDB, fileToBase64, getMimeType, formatBytes, safeParseArray, safeParseObject, callGeminiAPI, checkFirestoreDocExists } from './utils';
import { playKatanaSlash, playDarkGong, playCursedWhisper } from './audioEffects';

// LabStatistikApp di-load malas (lazy) supaya kodenya (termasuk StatEngine yang berat)
// baru di-download pas user beneran buka Lab Statistik, bukan ikut ke bundle awal.
const LabStatistikApp = lazy(() => import('./LabStatistikApp'));

// Konfigurasi Firebase Asli Anda
const firebaseConfig = {
  apiKey: "AIzaSyBxtO_UofmPpH9-kNJqE0N4r2HMmhZQRgo",
  authDomain: "skripsipro-1ceef.firebaseapp.com",
  projectId: "skripsipro-1ceef",
  storageBucket: "skripsipro-1ceef.firebasestorage.app",
  messagingSenderId: "111244547925",
  appId: "1:111244547925:web:6c4a7e1cdb3543dd9541dc",
  measurementId: "G-GXBC2MJWW9"
};

// Menyalakan Mesin Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

function SkripsiProApp({ onNavigateLab }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // MENGGUNAKAN SAFE PARSER AGAR TIDAK CRASH JIKA LOCALSTORAGE KORUP
  const [quickNotes, setQuickNotes] = useState(() => safeParseArray('sp_quicknotes', []));
  const [memoCards, setMemoCards] = useState(() => safeParseArray('sp_memo_cards', [
    { id: '1', title: 'Urgensi Penelitian', content: '', colorIndex: 0 },
    { id: '2', title: 'Batasan Masalah', content: '', colorIndex: 1 }
  ]));
  const [matrixData, setMatrixData] = useState(() => safeParseArray('sp_matrix', []));
  const [filesData, setFilesData] = useState([]); 
  
  const [canvasNodes, setCanvasNodes] = useState(() => safeParseArray('sp_canvas_nodes', []));
  const [canvasEdges, setCanvasEdges] = useState(() => safeParseArray('sp_canvas_edges', []));
  const [selectedCanvasNode, setSelectedCanvasNode] = useState(null);
  const [isCanvasDetailCollapsed, setIsCanvasDetailCollapsed] = useState(false);
  const [connectingNodeId, setConnectingNodeId] = useState(null);
  const [dragInfo, setDragInfo] = useState(null);
  const isDraggingRef = useRef(false);
  const lastClickRef = useRef({ time: 0, id: null });
  const canvasContainerRef = useRef(null);

  const [kuesionerData, setKuesionerData] = useState(() => safeParseArray('sp_kuesioner', []));
  const [activeIndicatorId, setActiveIndicatorId] = useState(null);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);

  const [matrixSearchTerm, setMatrixSearchTerm] = useState(''); 
  const [fileSearchTerm, setFileSearchTerm] = useState(''); 

  const [draftContent, setDraftContent] = useState(() => safeParseObject('sp_draft_content', { bab1: '', bab2: '', bab3: '', bab4: '', bab5: '' }));
  const [activeDraftBab, setActiveDraftBab] = useState('bab1');

  const [panicQuery, setPanicQuery] = useState('');
  const [panicAnswer, setPanicAnswer] = useState('');
  const [isPanicSearching, setIsPanicSearching] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [teleprompterAnswer, setTeleprompterAnswer] = useState('');
  const [isTeleprompterThinking, setIsTeleprompterThinking] = useState(false);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);

  const [predictedQuestions, setPredictedQuestions] = useState('');
  const [isPredicting, setIsPredicting] = useState(false);
  const [showPredictionModal, setShowPredictionModal] = useState(false);

  const [newQuickNote, setNewQuickNote] = useState(''); 
  const [isEnhancingNote, setIsEnhancingNote] = useState(null); 
  const [editingQuickNoteId, setEditingQuickNoteId] = useState(null);
  const [editingQuickNoteText, setEditingQuickNoteText] = useState('');
  
  const [activeFolder, setActiveFolder] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [expandedFiles, setExpandedFiles] = useState([]);
  const [summarizingId, setSummarizingId] = useState(null);

  const [brainstormTopic, setBrainstormTopic] = useState('');
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [brainstormResults, setBrainstormResults] = useState('');

  const initialMatrixForm = { fileId: '', judul: '', penulis: '', teori: '', variabel: '', metode: '', temuan: '', gap: '' };
  const [matrixForm, setMatrixForm] = useState(initialMatrixForm);
  const [showMatrixForm, setShowMatrixForm] = useState(false);
  const [editingMatrixId, setEditingMatrixId] = useState(null);
  const [isAutoFillingMatrix, setIsAutoFillingMatrix] = useState(false);

  const [isExporting, setIsExporting] = useState(false);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'model', text: 'Halo! Saya Peneliti AI SkripsiPro. Saya sudah membaca skripsimu. Apa yang bisa saya bantu hari ini?' }
  ]);
  const chatScrollRef = useRef(null);

  const [fileChat, setFileChat] = useState({ isOpen: false, file: null, messages: [], input: '', isTyping: false });
  const fileChatScrollRef = useRef(null);

  // --- TOMBOL MELAYANG (FAB) YANG BISA DIGESER KE SELURUH LAYAR ---
  const [fabPos, setFabPos] = useState(() => {
    const size = window.innerWidth < 640 ? 56 : 64;
    const saved = safeParseObject('sp_fab_pos', null);
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      return {
        x: Math.min(Math.max(saved.x, 8), Math.max(8, window.innerWidth - size - 8)),
        y: Math.min(Math.max(saved.y, 8), Math.max(8, window.innerHeight - size - 8)),
      };
    }
    const gap = window.innerWidth < 640 ? 24 : 32;
    return { x: window.innerWidth - size - gap, y: window.innerHeight - size - gap };
  });
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [isFabDragging, setIsFabDragging] = useState(false);
  const fabDragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  const fabSize = viewport.w < 640 ? 56 : 64;

  // Jaga posisi tombol tetap di dalam layar saat jendela di-resize / layar diputar
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const size = w < 640 ? 56 : 64;
      setViewport({ w, h });
      setFabPos(prev => ({
        x: Math.min(Math.max(prev.x, 8), Math.max(8, w - size - 8)),
        y: Math.min(Math.max(prev.y, 8), Math.max(8, h - size - 8)),
      }));
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const handleFabPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    fabDragRef.current = { active: true, moved: false, startX: e.clientX, startY: e.clientY, originX: fabPos.x, originY: fabPos.y };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* diabaikan */ }
    setIsFabDragging(true);
  };

  const handleFabPointerMove = (e) => {
    const d = fabDragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 6) return; // toleransi klik, bukan geser
    d.moved = true;
    const maxX = Math.max(8, viewport.w - fabSize - 8);
    const maxY = Math.max(8, viewport.h - fabSize - 8);
    setFabPos({ x: Math.min(Math.max(d.originX + dx, 8), maxX), y: Math.min(Math.max(d.originY + dy, 8), maxY) });
  };

  const handleFabPointerUp = (e) => {
    const d = fabDragRef.current;
    if (!d.active) return;
    d.active = false;
    setIsFabDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* diabaikan */ }
    if (d.moved) setFabPos(prev => { localStorage.setItem('sp_fab_pos', JSON.stringify(prev)); return prev; });
  };

  // Klik hanya membuka chat kalau tombol tidak sedang digeser
  const handleFabClick = () => {
    if (fabDragRef.current.moved) { fabDragRef.current.moved = false; return; }
    setIsChatOpen(v => !v);
  };

  // Panel chat mengikuti posisi tombol, tapi selalu dijaga tetap di dalam layar
  const chatPanel = (() => {
    const w = Math.min(viewport.w < 640 ? viewport.w * 0.85 : 420, Math.max(240, viewport.w - 24));
    const h = Math.min(viewport.h < 640 ? viewport.h * 0.75 : 600, Math.max(240, viewport.h - 24));
    const left = Math.min(Math.max(fabPos.x + fabSize - w, 12), Math.max(12, viewport.w - w - 12));
    let top = fabPos.y - h - 16;
    if (top < 12) top = Math.min(fabPos.y + fabSize + 16, Math.max(12, viewport.h - h - 12));
    return { left, top, width: w, height: h };
  })();
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Menyimpan target item hasil klik pencarian (mis. 'note-123'), dipakai untuk auto-scroll & tandai kuning sebentar
  const [highlightTarget, setHighlightTarget] = useState(null);
  const searchInputRef = useRef(null);

  const [showQrisModal, setShowQrisModal] = useState(false);

  useEffect(() => { localStorage.setItem('sp_quicknotes', JSON.stringify(Array.isArray(quickNotes) ? quickNotes : [])); }, [quickNotes]);
  useEffect(() => { localStorage.setItem('sp_memo_cards', JSON.stringify(Array.isArray(memoCards) ? memoCards : [])); }, [memoCards]);
  useEffect(() => { localStorage.setItem('sp_matrix', JSON.stringify(Array.isArray(matrixData) ? matrixData : [])); }, [matrixData]);
  useEffect(() => { localStorage.setItem('sp_canvas_nodes', JSON.stringify(Array.isArray(canvasNodes) ? canvasNodes : [])); }, [canvasNodes]);
  useEffect(() => { localStorage.setItem('sp_canvas_edges', JSON.stringify(Array.isArray(canvasEdges) ? canvasEdges : [])); }, [canvasEdges]);
  useEffect(() => { localStorage.setItem('sp_draft_content', JSON.stringify(draftContent || {})); }, [draftContent]);
  useEffect(() => { localStorage.setItem('sp_kuesioner', JSON.stringify(Array.isArray(kuesionerData) ? kuesionerData : [])); }, [kuesionerData]);

  useEffect(() => {
    const handleMouseUp = () => {
      setDragInfo(null);
      setTimeout(() => { isDraggingRef.current = false; }, 50); 
    };
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
    }
  }, []);

  useEffect(() => {
    getFilesDB().then(data => setFilesData((Array.isArray(data) ? data : []).sort((a, b) => b.timestamp - a.timestamp)));
  }, []);

  // Setelah klik hasil pencarian, scroll otomatis ke item yang dituju lalu tandai kuning sebentar
  useEffect(() => {
    if (!highlightTarget) return;
    const scrollTimer = setTimeout(() => {
      const el = document.querySelector(`[data-search-target="${highlightTarget}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    const clearTimer = setTimeout(() => setHighlightTarget(null), 2800);
    return () => { clearTimeout(scrollTimer); clearTimeout(clearTimer); };
  }, [highlightTarget, activeTab]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages, isChatOpen]);

  useEffect(() => {
    if (fileChatScrollRef.current) fileChatScrollRef.current.scrollTop = fileChatScrollRef.current.scrollHeight;
  }, [fileChat.messages, fileChat.isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
        setSearchQuery('');
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [isSearchOpen]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'id-ID';

      recognitionRef.current.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        if(currentTranscript.trim()) setTranscript(currentTranscript);
      };

      recognitionRef.current.onerror = (event) => {
        if (event.error === 'network' || event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setIsListening(false);
            isListeningRef.current = false;
        }
        if (event.error === 'network') {
           setTranscript("⚠️ Error Jaringan: Gagal terhubung ke server suara Chrome.");
        } else if (event.error === 'not-allowed') {
           setTranscript("⚠️ Error: Izin mikrofon ditolak oleh browser.");
        }
      };
      
      recognitionRef.current.onend = () => {
         if (isListeningRef.current) {
             setTimeout(() => {
                 if (isListeningRef.current) { 
                     try { recognitionRef.current.start(); } catch(e) {}
                 }
             }, 400); 
         }
      };
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null; 
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    };
  }, []); 

  // AMAN DARI CRASH SAAT ARRAY KORUP
  const getThesisContext = () => {
    const validCanvas = Array.isArray(canvasNodes) ? canvasNodes : [];
    const validMatrix = Array.isArray(matrixData) ? matrixData : [];
    const validDraft = (draftContent && typeof draftContent === 'object') ? draftContent : {};

    const konteksCanvas = validCanvas.length > 0 ? validCanvas.map(n => `- Variabel ${n.title} (${n.type}). Indikator: ${n.indicators}`).join('\n') : '(Belum ada variabel di Canvas)';
    const konteksMatriks = validMatrix.length > 0 ? validMatrix.slice(0, 15).map(m => `- Temuan dari jurnal ${m.penulis}: ${m.temuan}. Gap: ${m.gap}`).join('\n') : '(Belum ada referensi jurnal di matriks)';
    const konteksDraft = Object.entries(validDraft).map(([bab, html]) => [bab, stripHtmlToText(html)]).filter(([, text]) => text && text.trim() !== '').map(([bab, text]) => `=== ISI ${bab.toUpperCase()} ===\n${text}`).join('\n\n');
    
    return `\n--- TEKS DRAFT SKRIPSI MAHASISWA ---\n${konteksDraft || '(Belum menulis apapun di lembar skripsi)'}\n\n--- VARIABEL PENELITIAN ---\n${konteksCanvas}\n\n--- JURNAL REFERENSI ---\n${konteksMatriks}`;
  };

  // FORMATTER STRING AMAN UNTUK MENCEGAH REPLACE() CRASH
  const renderSafeHtmlString = (textStr) => {
    if (typeof textStr !== 'string') return '';
    return textStr.replace(/\*\*(.*?)\*\*/g, '<b class="text-inherit font-black">$1</b>');
  };

  // Editor Lembar Skripsi sekarang menyimpan HTML (rich text mirip Word).
  // Helper ini mengubahnya jadi teks polos untuk konteks AI, pencarian, dan word count.
  const stripHtmlToText = (html) => {
    if (typeof html !== 'string' || !html.trim()) return '';
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
    } catch (e) {
      return html.replace(/<[^>]+>/g, ' ').trim();
    }
  };


  const handlePanicSearch = async (e) => {
    e.preventDefault();
    if(!panicQuery.trim()) return;
    setIsPanicSearching(true);
    setPanicAnswer('');
    try {
      const prompt = `Dosen Penguji bertanya atau menyerang dengan: "${panicQuery}". Berikan kalimat pembelaan diri yang santai dan masuk akal berdasarkan data skripsiku. 
PENTING: Gunakan bahasa lisan sehari-hari yang santai, gampang dicerna, setingkat anak SMP bisa paham. Hindari istilah akademis yang kaku. 
Jawab maksimal 3 kalimat pendek yang langsung to the point. **Cetak tebal (bold)** bagian intinya!`;
      const systemPrompt = `Anda adalah Asisten Pembelaan Sidang. Jawab murni berdasarkan data skripsi mahasiswa berikut:\n${getThesisContext()}`;
      const { text } = await callGeminiAPI(prompt, systemPrompt, []);
      setPanicAnswer(typeof text === 'string' ? text : "Gagal memproses data.");
    } catch(err) {
      setPanicAnswer("❌ Gagal mendapatkan jawaban: " + err.message);
    } finally {
      setIsPanicSearching(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return alert("Browser Anda tidak mendukung fitur mikrofon. Gunakan Google Chrome.");
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        setIsListening(true);
      }
    }
  };

  const handleLiveTeleprompter = async () => {
    if(!transcript.trim()) return alert("Tunggu sampai mikrofon menangkap ucapan dosen, atau ketik manual di kotaknya.");
    setIsTeleprompterThinking(true);
    setTeleprompterAnswer('');
    try {
      const prompt = `Dosen Penguji baru saja berkata: "${transcript}". Berikan contekan jawaban langsung untuk dibaca oleh mahasiswa saat ini juga. 
PENTING: Gunakan bahasa lisan sehari-hari yang santai, sopan, gampang dicerna (setingkat anak SMP paham), dan langsung ke inti. Jangan pakai istilah ilmiah yang kaku.
Format: 2-3 bullet point pendek yang sangat natural.`;
      const systemPrompt = `Anda adalah Asisten Sidang Skripsi. Jawab berdasar skripsi mahasiswa:\n${getThesisContext()}`;
      const { text } = await callGeminiAPI(prompt, systemPrompt, []);
      setTeleprompterAnswer(typeof text === 'string' ? text : "Gagal memproses.");
    } catch(err) {
      setTeleprompterAnswer("❌ Gagal merumuskan jawaban: " + err.message);
    } finally {
      setIsTeleprompterThinking(false);
    }
  };

  const handleGeneratePredictions = async () => {
    setShowPredictionModal(true);
    setIsPredicting(true);
    setPredictedQuestions('');
    try {
      const prompt = `Analisis data skripsi saya secara mendalam dan prediksi 5 pertanyaan kritis, menjebak, atau menohok yang kemungkinan besar akan ditanyakan dosen penguji.
PENTING:
1. Tuliskan 5 pertanyaan tersebut.
2. Untuk setiap pertanyaan, berikan "Saran Jawaban" untuk saya. 
3. Saran jawaban WAJIB menggunakan bahasa lisan sehari-hari yang santai, sopan, SANGAT SEDERHANA (minimal anak SMP bisa paham). Cetak tebal bagian kuncinya.`;
      const systemPrompt = `Anda adalah Dosen Penguji Simulasi. Gunakan data skripsi mahasiswa berikut:\n${getThesisContext()}`;
      const { text } = await callGeminiAPI(prompt, systemPrompt, []);
      setPredictedQuestions(typeof text === 'string' ? text : "Data tidak dikenali.");
    } catch(err) {
      setPredictedQuestions("❌ Gagal memprediksi pertanyaan: " + err.message);
    } finally {
      setIsPredicting(false);
    }
  };

  const addIndicator = (varId) => {
    const newInd = { id: `ind-${Date.now()}`, varId, name: 'Indikator Baru', questions: [] };
    setKuesionerData(prev => Array.isArray(prev) ? [...prev, newInd] : [newInd]);
    setActiveIndicatorId(newInd.id);
  };
  const updateIndicatorName = (id, name) => setKuesionerData(prev => (Array.isArray(prev) ? prev : []).map(ind => ind.id === id ? {...ind, name} : ind));
  const deleteIndicator = (id) => {
    if(window.confirm("Hapus indikator ini dan semua pertanyaannya?")) {
      setKuesionerData(prev => (Array.isArray(prev) ? prev : []).filter(ind => ind.id !== id));
      if(activeIndicatorId === id) setActiveIndicatorId(null);
    }
  };
  const addQuestion = (indId) => setKuesionerData(prev => (Array.isArray(prev) ? prev : []).map(ind => ind.id === indId ? {...ind, questions: [...(Array.isArray(ind.questions)?ind.questions:[]), {id: `q-${Date.now()}`, text: '', type: 'Likert'}]} : ind));
  const updateQuestion = (indId, qId, text) => setKuesionerData(prev => (Array.isArray(prev) ? prev : []).map(ind => ind.id === indId ? {...ind, questions: (Array.isArray(ind.questions)?ind.questions:[]).map(q => q.id === qId ? {...q, text} : q)} : ind));
  const deleteQuestion = (indId, qId) => setKuesionerData(prev => (Array.isArray(prev) ? prev : []).map(ind => ind.id === indId ? {...ind, questions: (Array.isArray(ind.questions)?ind.questions:[]).filter(q => q.id !== qId)} : ind));

  const handleGenerateQuestionsAI = async (indicator) => {
    if (!indicator.name || indicator.name === 'Indikator Baru') return alert("Ganti nama indikator terlebih dahulu.");
    setIsGeneratingQuestions(true);
    try {
        const validCanvas = Array.isArray(canvasNodes) ? canvasNodes : [];
        const variable = validCanvas.find(n => n.id === indicator.varId);
        const prompt = `Buatkan 4 butir pertanyaan kuesioner berskala Likert untuk indikator "${indicator.name}" yang bertujuan mengukur variabel "${variable?.title || ''}". 
Gunakan bahasa Indonesia baku, formal, mudah dipahami, dan tidak ambigu.
Output WAJIB HANYA berupa JSON objek dengan format: {"pertanyaan": ["pertanyaan 1", "pertanyaan 2", "pertanyaan 3", "pertanyaan 4"]}`;
        const sys = "Anda adalah Asisten Ahli Metodologi Penelitian.";
        const { text } = await callGeminiAPI(prompt, sys, [], false, null, true);
        const parsed = JSON.parse(text);
        const newQuestions = (parsed.pertanyaan || []).map(q => ({id: `q-${Date.now()}-${Math.random()}`, text: q, type: 'Likert'}));
        setKuesionerData(prev => (Array.isArray(prev) ? prev : []).map(item => item.id === indicator.id ? {...item, questions: [...(Array.isArray(item.questions)?item.questions:[]), ...newQuestions]} : item));
    } catch(err) {
        alert("Gagal mem-generate pertanyaan: " + err.message);
    } finally {
        setIsGeneratingQuestions(false);
    }
  };

  const copyKuesionerToClipboard = () => {
    if (!Array.isArray(kuesionerData) || kuesionerData.length === 0) return alert("Belum ada data kuesioner.");
    let text = "INSTRUMEN KUESIONER PENELITIAN\n\n";
    (Array.isArray(canvasNodes) ? canvasNodes : []).forEach(node => {
      const indicators = kuesionerData.filter(ind => ind.varId === node.id);
      if (indicators.length > 0) {
        text += `VARIABEL: ${node.title.toUpperCase()}\n`;
        indicators.forEach((ind, iIdx) => {
          text += `  Indikator ${iIdx + 1}: ${ind.name}\n`;
          (Array.isArray(ind.questions) ? ind.questions : []).forEach((q, qIdx) => {
            text += `    ${qIdx + 1}. ${q.text}\n`;
          });
          text += `\n`;
        });
      }
    });
    navigator.clipboard.writeText(text);
    alert("Kuesioner berhasil disalin ke Clipboard! Tinggal Paste ke Word.");
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isAiTyping) return;
    const userText = chatInput;
    setChatInput('');
    const newMessages = [...chatMessages, { role: 'user', text: userText }];
    setChatMessages(newMessages);
    setIsAiTyping(true);

    try {
      const systemPrompt = `Anda adalah Asisten Pembimbing Skripsi Profesional yang MENGENAL skripsi user secara mendalam.\nDATA SKRIPSI USER SAAT INI:\n${getThesisContext()}`;
      const { text: aiReply, sources } = await callGeminiAPI(userText, systemPrompt, chatMessages, true);
      setChatMessages([...newMessages, { role: 'model', text: typeof aiReply === 'string' ? aiReply : "Gagal memuat format respons.", sources: sources }]);
    } catch (error) {
      setChatMessages([...newMessages, { role: 'model', text: `❌ **Koneksi AI Gagal!**\nAlasan: *${error.message}*` }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleFileChatSubmit = async (e) => {
    e.preventDefault();
    if (!fileChat.input.trim() || fileChat.isTyping) return;

    const userText = fileChat.input;
    setFileChat(prev => ({ ...prev, input: '', messages: [...prev.messages, { role: 'user', text: userText }], isTyping: true }));

    try {
      const base64Data = await fileToBase64(fileChat.file.blob);
      const mimeType = getMimeType(fileChat.file.blob, fileChat.file.name); 
      const fileInlineData = { mimeType: mimeType, data: base64Data };

      const prompt = `Gunakan dokumen terlampir untuk menjawab pertanyaan berikut: "${userText}"`;
      const systemPrompt = "Anda adalah AI Penganalisis Dokumen. Jawab pertanyaan HANYA berdasarkan isi dokumen yang dilampirkan.";
      
      const { text: aiReply } = await callGeminiAPI(prompt, systemPrompt, fileChat.messages, false, fileInlineData);
      
      setFileChat(prev => ({ ...prev, messages: [...prev.messages, { role: 'model', text: typeof aiReply === 'string' ? aiReply : "Error format dokumen." }], isTyping: false }));
    } catch (error) {
      setFileChat(prev => ({ ...prev, messages: [...prev.messages, { role: 'model', text: `❌ Gagal: ${error.message}` }], isTyping: false }));
    }
  };

  const openFileChat = (fileObj) => {
    if (!fileObj.blob) return alert("File fisik tidak ditemukan. Silakan re-upload.");
    setFileChat({ isOpen: true, file: fileObj, messages: [{ role: 'model', text: `Halo! Saya sudah membaca **${fileObj.name}**. Tanyakan apa saja mengenai isi dokumen ini.` }], input: '', isTyping: false });
  };
  const closeFileChat = () => setFileChat(prev => ({ ...prev, isOpen: false }));

  const handleBrainstormTitles = async (e) => {
    e.preventDefault();
    if (!brainstormTopic.trim()) return;
    setIsBrainstorming(true);
    setBrainstormResults('');
    try {
      const prompt = `Bantu saya melakukan *brainstorming* untuk skripsi. Topik yang saya minati adalah: "${brainstormTopic}". Berikan 3 ide judul skripsi yang inovatif, akademis, spesifik.`;
      const systemPrompt = "Anda adalah dosen pembimbing ahli yang membantu menyusun judul skripsi inovatif. Gunakan format markdown yang rapi.";
      const { text: res } = await callGeminiAPI(prompt, systemPrompt, []);
      setBrainstormResults(typeof res === 'string' ? res : "Gagal memuat ide.");
    } catch (error) {
      setBrainstormResults(`❌ Gagal menghasilkan ide: ${error.message}`);
    } finally {
      setIsBrainstorming(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const filesWithBase64 = await Promise.all((Array.isArray(filesData) ? filesData : []).map(async (f) => {
        const base64 = await fileToBase64(f.blob);
        return { ...f, blob: null, base64 };
      }));
      const backup = { 
        quickNotes: Array.isArray(quickNotes) ? quickNotes : [], 
        memoCards: Array.isArray(memoCards) ? memoCards : [], 
        matrixData: Array.isArray(matrixData) ? matrixData : [], 
        filesData: filesWithBase64, 
        canvasNodes: Array.isArray(canvasNodes) ? canvasNodes : [], 
        canvasEdges: Array.isArray(canvasEdges) ? canvasEdges : [], 
        draftContent: (draftContent && typeof draftContent === 'object') ? draftContent : {}, 
        kuesionerData: Array.isArray(kuesionerData) ? kuesionerData : [] 
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `SkripsiPro_Backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } catch (error) {
      alert("Gagal mengekspor data: " + error.message);
    }
    setIsExporting(false);
  };

  const handleImportData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        if (Array.isArray(backup.quickNotes)) setQuickNotes(backup.quickNotes);
        if (Array.isArray(backup.memoCards)) setMemoCards(backup.memoCards);
        if (Array.isArray(backup.matrixData)) setMatrixData(backup.matrixData);
        if (Array.isArray(backup.canvasNodes)) setCanvasNodes(backup.canvasNodes);
        if (Array.isArray(backup.canvasEdges)) setCanvasEdges(backup.canvasEdges);
        if (backup.draftContent && typeof backup.draftContent === 'object') setDraftContent(backup.draftContent);
        if (Array.isArray(backup.kuesionerData)) setKuesionerData(backup.kuesionerData);

        if (Array.isArray(backup.filesData)) {
          for (let oldFile of (Array.isArray(filesData) ? filesData : [])) await deleteFileDB(oldFile.id);
          const newFiles = [];
          for (let f of backup.filesData) {
            const res = await fetch(`data:${f.type};base64,${f.base64}`);
            const blob = await res.blob();
            const newFile = { ...f, blob };
            delete newFile.base64; 
            await saveFileDB(newFile);
            newFiles.push(newFile);
          }
          setFilesData(newFiles.sort((a, b) => b.timestamp - a.timestamp));
        }
        alert("🎉 Data berhasil dipulihkan (Restore) dengan sempurna!");
      } catch (err) {
        alert("Gagal membaca file backup.");
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const handleMatrixChange = (e) => {
    const { name, value } = e.target;
    setMatrixForm(prev => ({ ...prev, [name]: value }));
  };

  const handleMatrixFileSelect = (e) => {
    const selectedFileId = e.target.value;
    const selectedFile = (Array.isArray(filesData) ? filesData : []).find(f => f.id === selectedFileId);
    setMatrixForm(prev => ({ ...prev, fileId: selectedFileId, judul: selectedFile ? selectedFile.name : prev.judul }));
  };

  const handleAutoFillMatrix = async () => {
    if (!matrixForm.fileId) return alert("Pilih jurnal dari dropdown terlebih dahulu!");
    const selectedFile = (Array.isArray(filesData) ? filesData : []).find(f => f.id === matrixForm.fileId);
    if (!selectedFile || !selectedFile.blob) return alert("File PDF fisik tidak ditemukan.");

    setIsAutoFillingMatrix(true);
    try {
      const base64Data = await fileToBase64(selectedFile.blob);
      const mimeType = getMimeType(selectedFile.blob, selectedFile.name); 
      const fileInlineData = { mimeType: mimeType, data: base64Data };

      const prompt = `Ekstrak JSON: {"judul":"", "penulis":"", "teori":"", "variabel":"", "metode":"", "temuan":"", "gap":""}`;
      const systemPrompt = "Anda adalah AI ekstraksi jurnal.";
      const { text: cleanJson } = await callGeminiAPI(prompt, systemPrompt, [], false, fileInlineData, true);
      const extractedData = JSON.parse(cleanJson);

      setMatrixForm(prev => ({ ...prev, ...extractedData }));
    } catch (error) {
      alert("Gagal melakukan Auto-Isi: " + error.message);
    } finally {
      setIsAutoFillingMatrix(false);
    } 
  };

  // MENGGUNAKAN FALLBACK ARRAY YANG AMAN UNTUK MENCEGAH CRASH ITERASI MATRIKS
  const handleSaveMatrixEntry = (e) => {
    e.preventDefault();
    if (!matrixForm.judul.trim() || !matrixForm.penulis.trim()) return alert("Judul dan Penulis wajib diisi!");
    
    setMatrixData(prev => {
      const safePrev = Array.isArray(prev) ? prev : []; // PENGAMAN
      if (editingMatrixId) {
        return safePrev.map(item => item.id === editingMatrixId ? { ...item, ...matrixForm } : item);
      } else {
        return [{ id: Date.now().toString(), ...matrixForm }, ...safePrev];
      }
    });

    setMatrixForm(initialMatrixForm);
    setShowMatrixForm(false);
    setEditingMatrixId(null);
  };

  const handleEditMatrixRow = (row) => { setMatrixForm(row); setEditingMatrixId(row.id); setShowMatrixForm(true); };
  const handleDeleteMatrixRow = (id) => { if(window.confirm("Hapus jurnal ini?")) setMatrixData(prev => (Array.isArray(prev) ? prev : []).filter(row => row.id !== id)); };

  const handleFileUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0 || !activeFolder) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: selectedFiles.length });

    const savedFiles = [];
    let failedCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileId = `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
      const newFile = { id: fileId, name: file.name, folder: activeFolder, size: file.size, type: file.type, blob: file, status: "Local File", timestamp: Date.now() };
      try {
        await saveFileDB(newFile);
        savedFiles.push(newFile);
      } catch (error) {
        failedCount++;
      }
      setUploadProgress({ current: i + 1, total: selectedFiles.length });
    }

    if (savedFiles.length > 0) {
      setFilesData(prev => [...savedFiles, ...(Array.isArray(prev) ? prev : [])]);
    }
    if (failedCount > 0) {
      alert(`${failedCount} dari ${selectedFiles.length} file gagal diunggah. Sisanya berhasil disimpan.`);
    }

    setIsUploading(false);
    setUploadProgress({ current: 0, total: 0 });
    e.target.value = '';
  };

  const handleDeleteFile = async (fileObj) => {
    if (!window.confirm(`Hapus file "${fileObj.name}"?`)) return;
    await deleteFileDB(fileObj.id);
    setFilesData(prev => (Array.isArray(prev) ? prev : []).filter(f => f.id !== fileObj.id));
  };

  const handlePreviewFile = (fileObj) => {
    if (!fileObj.blob) return alert("File tidak ditemukan.");
    const url = URL.createObjectURL(fileObj.blob);
    window.open(url, '_blank');
  };

  const handleDownloadFile = (fileObj) => {
    if (!fileObj.blob) return alert("File tidak ditemukan.");
    const url = URL.createObjectURL(fileObj.blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileObj.name; a.click(); URL.revokeObjectURL(url);
  };

  const toggleExpandFile = (id) => setExpandedFiles(prev => Array.isArray(prev) ? (prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]) : [id]);

  const handleSummarize = async (file) => {
    if (file.summary) {
      if (!expandedFiles.includes(file.id)) toggleExpandFile(file.id);
      return;
    }
    if (!file.blob) return alert("File asli tidak ditemukan.");
    
    setSummarizingId(file.id);
    if (!expandedFiles.includes(file.id)) setExpandedFiles(prev => Array.isArray(prev) ? [...prev, file.id] : [file.id]);

    try {
      const base64Data = await fileToBase64(file.blob);
      const mimeType = getMimeType(file.blob, file.name); 
      const fileInlineData = { mimeType, data: base64Data };

      const prompt = `Buatkan ringkasan: 1. Masalah 2. Metodologi 3. Hasil Utama`;
      const systemPrompt = "Anda adalah Peringkas Jurnal Akademis AI.";
      const { text: summaryText } = await callGeminiAPI(prompt, systemPrompt, [], false, fileInlineData);
      
      const updatedFile = { ...file, summary: typeof summaryText === 'string' ? summaryText : "Gagal memuat rangkuman." };
      await saveFileDB(updatedFile);
      setFilesData(prev => (Array.isArray(prev) ? prev : []).map(f => f.id === file.id ? updatedFile : f));
    } catch (error) {
      alert(`Gagal merangkum: ${error.message}`);
      setExpandedFiles(prev => (Array.isArray(prev) ? prev : []).filter(id => id !== file.id));
    } finally {
      setSummarizingId(null);
    }
  };

  const addCanvasNode = () => {
    const newNode = {
      id: `node-${Date.now()}`,
      x: window.innerWidth > 768 ? 200 : 50,
      y: 100,
      title: 'Variabel Baru',
      type: 'Independen (X)',
      definition: '',
      indicators: '',
      journals: '',
      linkedFiles: []
    };
    setCanvasNodes(prev => Array.isArray(prev) ? [...prev, newNode] : [newNode]);
    setSelectedCanvasNode(newNode.id);
    if (window.innerWidth < 1024) {
       setIsCanvasDetailCollapsed(true);
    } else {
       setIsCanvasDetailCollapsed(false);
    }
  };

  const handleNodeMouseDown = (e, id) => {
    if (connectingNodeId) return;
    if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) return;
    
    const node = (Array.isArray(canvasNodes) ? canvasNodes : []).find(n => n.id === id);
    if (!node) return;
    
    setSelectedCanvasNode(id);
    setDragInfo({ id: id, startX: e.clientX, startY: e.clientY, initialNodeX: node.x, initialNodeY: node.y });
  };

  const handleNodeTouchStart = (e, id) => {
    if (connectingNodeId) return;
    if (e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) return;

    const node = (Array.isArray(canvasNodes) ? canvasNodes : []).find(n => n.id === id);
    if (!node) return;

    setSelectedCanvasNode(id);
    if (window.innerWidth < 1024) {
       setIsCanvasDetailCollapsed(true);
    }
    const touch = e.touches[0];
    setDragInfo({ id: id, startX: touch.clientX, startY: touch.clientY, initialNodeX: node.x, initialNodeY: node.y });
  };

  const handleCanvasMouseMove = (e) => {
    if (!dragInfo) return;
    isDraggingRef.current = true;
    const dx = e.clientX - dragInfo.startX;
    const dy = e.clientY - dragInfo.startY;
    setCanvasNodes(prevNodes => (Array.isArray(prevNodes) ? prevNodes : []).map(node => {
      if (node.id === dragInfo.id) {
        return { ...node, x: Math.max(0, dragInfo.initialNodeX + dx), y: Math.max(0, dragInfo.initialNodeY + dy) };
      }
      return node;
    }));
  };

  const handleCanvasTouchMove = (e) => {
    if (!dragInfo) return;
    isDraggingRef.current = true;
    const touch = e.touches[0];
    const dx = touch.clientX - dragInfo.startX;
    const dy = touch.clientY - dragInfo.startY;
    setCanvasNodes(prevNodes => (Array.isArray(prevNodes) ? prevNodes : []).map(node => {
      if (node.id === dragInfo.id) {
        return { ...node, x: Math.max(0, dragInfo.initialNodeX + dx), y: Math.max(0, dragInfo.initialNodeY + dy) };
      }
      return node;
    }));
  };

  const handleConnectNode = (targetId) => {
    if (!connectingNodeId) {
      setConnectingNodeId(targetId);
      return;
    }
    if (connectingNodeId === targetId) {
      setConnectingNodeId(null);
      return;
    }
    const edgeExists = (Array.isArray(canvasEdges) ? canvasEdges : []).find(e => 
      (e.source === connectingNodeId && e.target === targetId) || 
      (e.source === targetId && e.target === connectingNodeId)
    );

    if (!edgeExists) {
      setCanvasEdges(prev => Array.isArray(prev) ? [...prev, { id: `edge-${Date.now()}`, source: connectingNodeId, target: targetId }] : [{ id: `edge-${Date.now()}`, source: connectingNodeId, target: targetId }]);
    }
    setConnectingNodeId(null);
  };

  const deleteSelectedNode = () => {
    if (!selectedCanvasNode) return;
    if (window.confirm('Hapus variabel ini beserta semua garis penghubungnya?')) {
      setCanvasNodes(prev => (Array.isArray(prev) ? prev : []).filter(n => n.id !== selectedCanvasNode));
      setCanvasEdges(prev => (Array.isArray(prev) ? prev : []).filter(e => e.source !== selectedCanvasNode && e.target !== selectedCanvasNode));
      setSelectedCanvasNode(null);
    }
  };

  const deleteEdge = (edgeId) => {
    setCanvasEdges(prev => (Array.isArray(prev) ? prev : []).filter(e => e.id !== edgeId));
  };

  const updateSelectedNode = (field, value) => {
    if (!selectedCanvasNode) return;
    setCanvasNodes(prev => (Array.isArray(prev) ? prev : []).map(n => n.id === selectedCanvasNode ? { ...n, [field]: value } : n));
  };

  const handleCanvasFileUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0 || !selectedCanvasNode) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: selectedFiles.length });

    const savedFiles = [];
    let failedCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileId = `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
      const newFile = { id: fileId, name: file.name, folder: 'Referensi Jurnal', size: file.size, type: file.type, blob: file, status: "Local File", timestamp: Date.now() };
      try {
        await saveFileDB(newFile);
        savedFiles.push(newFile);
      } catch (error) {
        failedCount++;
      }
      setUploadProgress({ current: i + 1, total: selectedFiles.length });
    }

    if (savedFiles.length > 0) {
      setFilesData(prev => [...savedFiles, ...(Array.isArray(prev) ? prev : [])]);

      const currentNode = (Array.isArray(canvasNodes) ? canvasNodes : []).find(n => n.id === selectedCanvasNode);
      const currentLinks = currentNode?.linkedFiles || [];
      const newIds = savedFiles.map(f => f.id).filter(id => !currentLinks.includes(id));
      if (newIds.length > 0) {
        updateSelectedNode('linkedFiles', [...currentLinks, ...newIds]);
      }
    }
    if (failedCount > 0) {
      alert(`${failedCount} dari ${selectedFiles.length} file gagal diunggah. Sisanya berhasil disimpan.`);
    }

    setIsUploading(false);
    setUploadProgress({ current: 0, total: 0 });
    e.target.value = '';
  };

  const addQuickNote = (e) => {
    e.preventDefault();
    if (!newQuickNote.trim()) return;
    setQuickNotes(prev => [{ id: Date.now().toString(), text: newQuickNote, timestamp: Date.now() }, ...(Array.isArray(prev) ? prev : [])]);
    setNewQuickNote('');
  };

  const deleteQuickNote = (id) => { setQuickNotes(prev => (Array.isArray(prev) ? prev : []).filter(n => n.id !== id)); };
  const handleEditQuickNote = (note) => { setEditingQuickNoteId(note.id); setEditingQuickNoteText(note.text); };
  const saveEditQuickNote = () => {
    if (!editingQuickNoteText.trim()) return;
    setQuickNotes(prev => (Array.isArray(prev) ? prev : []).map(n => n.id === editingQuickNoteId ? { ...n, text: editingQuickNoteText } : n));
    setEditingQuickNoteId(null); setEditingQuickNoteText('');
  };
  const cancelEditQuickNote = () => { setEditingQuickNoteId(null); setEditingQuickNoteText(''); };

  const handleEnhanceQuickNote = async (note) => {
    setIsEnhancingNote(note.id);
    try {
      const prompt = `Perbaiki, rapikan, dan kembangkan catatan kasar mahasiswa berikut menjadi 1-2 kalimat akademis yang terstruktur untuk bahan skripsi. Catatan asli: "${note.text}"`;
      const systemPrompt = "Anda adalah asisten skripsi. Ubah teks yang sangat berantakan atau kasual menjadi bahasa akademis formal yang tajam.";
      const { text: enhancedText } = await callGeminiAPI(prompt, systemPrompt, [], false, null, false);
      setQuickNotes(prev => (Array.isArray(prev) ? prev : []).map(n => n.id === note.id ? { ...n, text: (typeof enhancedText === 'string' ? enhancedText.trim() : note.text) } : n));
    } catch (error) {
      alert("Gagal merapikan catatan: " + error.message);
    } finally {
      setIsEnhancingNote(null);
    }
  };

  const SEARCH_CATEGORY_LIMIT = 6;

  const getSearchResults = () => {
    try {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    // Pencarian per-kata: setiap kata pada query harus ditemukan di salah satu kolom,
    // tanpa peduli urutan/posisi. Jadi "budget kurang" tetap cocok dengan
    // "budget penelitian masih kurang", bukan hanya frasa persis berurutan.
    const searchWords = q.split(/\s+/).filter(Boolean);
    const matchesAll = (...fields) => {
      const haystack = fields.filter(Boolean).map(f => String(f).toLowerCase()).join(' ');
      return searchWords.every(w => haystack.includes(w));
    };

    const validMatrix = (Array.isArray(matrixData) ? matrixData : []).filter(Boolean);
    const validFiles = (Array.isArray(filesData) ? filesData : []).filter(Boolean);
    const validCanvas = (Array.isArray(canvasNodes) ? canvasNodes : []).filter(Boolean);
    const validNotes = (Array.isArray(quickNotes) ? quickNotes : []).filter(Boolean);
    const validMemo = (Array.isArray(memoCards) ? memoCards : []).filter(Boolean);
    const validKuesioner = (Array.isArray(kuesionerData) ? kuesionerData : []).filter(Boolean);
    const validDraft = (draftContent && typeof draftContent === 'object') ? draftContent : {};

    const categories = [];
    // allMatches sudah berupa item hasil map (bukan raw data), supaya totalMatches = allMatches.length akurat.
    const pushCategory = (label, color, allMatches) => {
      if (allMatches.length === 0) return;
      categories.push({ label, color, totalMatches: allMatches.length, items: allMatches.slice(0, SEARCH_CATEGORY_LIMIT) });
    };


    // Navigasi menu/halaman: agar bisa langsung lompat ke halaman meski belum ada isinya
    const menuItems = [
      { tab: 'dashboard', title: 'Dashboard Utama', keywords: ['dashboard', 'beranda', 'utama', 'home'], icon: <LayoutDashboard size={16} className="text-slate-500" /> },
      { tab: 'quicknotes', title: 'Catatan Cepat', keywords: ['catatan', 'cepat', 'notes', 'quicknotes'], icon: <AlignLeft size={16} className="text-slate-500" /> },
      { tab: 'memo', title: 'Kotak Penting', keywords: ['kotak', 'penting', 'memo'], icon: <StickyNote size={16} className="text-slate-500" /> },
      { tab: 'files', title: 'File & Bab', keywords: ['file', 'dokumen', 'upload', 'unggah', 'folder'], icon: <FolderOpen size={16} className="text-slate-500" /> },
      { tab: 'matrix', title: 'Matriks Literatur', keywords: ['matriks', 'literatur', 'jurnal', 'referensi'], icon: <Table size={16} className="text-slate-500" /> },
      { tab: 'canvas', title: 'Canvas Variabel', keywords: ['canvas', 'variabel', 'kerangka'], icon: <Share2 size={16} className="text-slate-500" /> },
      { tab: 'kuesioner', title: 'Kuesioner', keywords: ['kuesioner', 'indikator', 'pertanyaan', 'survei'], icon: <ListChecks size={16} className="text-slate-500" /> },
      { tab: 'lembar', title: 'Lembar Skripsi', keywords: ['lembar', 'skripsi', 'draft', 'tulis', 'bab'], icon: <FileText size={16} className="text-slate-500" /> },
      { tab: 'sidang', title: 'Mode Sidang', keywords: ['sidang', 'panic', 'teleprompter', 'dosen', 'ujian'], icon: <ShieldAlert size={16} className="text-slate-500" /> },
    ];
    pushCategory('Menu', 'slate', menuItems.filter(m => matchesAll(m.title, ...m.keywords))
      .map(m => ({ icon: m.icon, title: m.title, subtitle: 'Buka halaman ini', tab: m.tab, color: 'slate' })));

    pushCategory('Catatan Cepat', 'blue', validNotes.filter(n => matchesAll(n.text))
      .map(n => ({ icon: <AlignLeft size={16} className="text-blue-500" />, title: (n.text || '').substring(0, 70) || '(Catatan kosong)', subtitle: 'Catatan Cepat', tab: 'quicknotes', color: 'blue', id: n.id })));

    pushCategory('Kotak Penting', 'rose', validMemo.filter(m => matchesAll(m.title, m.content))
      .map(m => ({ icon: <StickyNote size={16} className="text-rose-500" />, title: m.title || '(Tanpa judul)', subtitle: (m.content || '').substring(0, 70) || 'Belum ada isi', tab: 'memo', color: 'rose', id: m.id })));

    pushCategory('Matriks Literatur', 'emerald', validMatrix.filter(m => matchesAll(m.judul, m.penulis, m.teori, m.metode, m.temuan, m.gap, m.variabel))
      .map(m => ({ icon: <Table size={16} className="text-emerald-500" />, title: m.judul || '(Tanpa judul)', subtitle: `${m.penulis || '-'} • Gap: ${m.gap?.substring(0, 60) || '-'}...`, tab: 'matrix', color: 'emerald', id: m.id })));

    pushCategory('File & Bab', 'blue', validFiles.filter(f => matchesAll(f.name, f.folder, f.summary))
      .map(f => ({ icon: <FileText size={16} className="text-blue-500" />, title: f.name || '(Tanpa nama)', subtitle: `${f.folder || '-'} • ${formatBytes(f.size)}${f.summary ? ' • Ada Rangkuman' : ''}`, tab: 'files', color: 'blue', folder: f.folder, id: f.id })));

    pushCategory('Canvas Variabel', 'cyan', validCanvas.filter(n => matchesAll(n.title, n.definition, n.indicators, n.type, n.journals))
      .map(n => ({ icon: <Share2 size={16} className="text-cyan-500" />, title: n.title || '(Tanpa judul)', subtitle: `${n.type || '-'} • ${n.indicators?.substring(0, 60) || 'Belum ada indikator'}`, tab: 'canvas', color: 'cyan', nodeId: n.id })));

    pushCategory('Kuesioner', 'cyan', validKuesioner.filter(ind => {
        const questions = Array.isArray(ind.questions) ? ind.questions.filter(Boolean) : [];
        return matchesAll(ind.name, ...questions.map(item => item?.text));
      }).map(ind => {
        const questions = Array.isArray(ind.questions) ? ind.questions.filter(Boolean) : [];
        return { icon: <ListChecks size={16} className="text-cyan-500" />, title: ind.name || '(Indikator tanpa nama)', subtitle: `${questions.length} pertanyaan`, tab: 'kuesioner', color: 'cyan', indicatorId: ind.id };
      }));

    const babLabels = { bab1: 'Bab 1: Pendahuluan', bab2: 'Bab 2: Tinjauan Pustaka', bab3: 'Bab 3: Metodologi', bab4: 'Bab 4: Hasil & Pembahasan', bab5: 'Bab 5: Penutup' };
    pushCategory('Lembar Skripsi', 'sky', Object.entries(babLabels).filter(([bab, label]) => {
        const text = stripHtmlToText(validDraft[bab]);
        return matchesAll(label, text);
      }).map(([bab, label]) => {
        const text = stripHtmlToText(validDraft[bab]);
        return { icon: <FileText size={16} className="text-sky-500" />, title: label, subtitle: text ? text.substring(0, 70) + '...' : 'Belum ada isi', tab: 'lembar', color: 'sky', bab };
      }));

    return categories;
    } catch (err) {
      console.error('Pencarian gagal:', err);
      return [];
    }
  };

  const highlightMatch = (text, query) => {
    if (!text || !query) return text;
    const str = String(text);
    const words = query.toLowerCase().split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length);
    if (words.length === 0) return text;
    const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = str.split(regex);
    return (
      <>
        {parts.map((part, i) => words.includes(part.toLowerCase())
          ? <mark key={i} className="bg-amber-200 text-slate-900 rounded px-0.5">{part}</mark>
          : part
        )}
      </>
    );
  };

  const searchColorClasses = {
    slate: { icon: 'bg-slate-50 border-slate-200', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
    emerald: { icon: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    blue: { icon: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
    cyan: { icon: 'bg-cyan-50 border-cyan-200', badge: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
    rose: { icon: 'bg-rose-50 border-rose-200', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
    sky: { icon: 'bg-sky-50 border-sky-200', badge: 'bg-sky-100 text-sky-700 border-sky-200' },
  };

  const guideColorClasses = {
    blue: { bg: 'bg-blue-50/60', border: 'border-blue-100', iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
    sky: { bg: 'bg-sky-50/60', border: 'border-sky-100', iconBg: 'bg-sky-100', iconText: 'text-sky-600' },
    rose: { bg: 'bg-rose-50/60', border: 'border-rose-100', iconBg: 'bg-rose-100', iconText: 'text-rose-600' },
    indigo: { bg: 'bg-indigo-50/60', border: 'border-indigo-100', iconBg: 'bg-indigo-100', iconText: 'text-indigo-600' },
    emerald: { bg: 'bg-emerald-50/60', border: 'border-emerald-100', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
    cyan: { bg: 'bg-cyan-50/60', border: 'border-cyan-100', iconBg: 'bg-cyan-100', iconText: 'text-cyan-600' },
    teal: { bg: 'bg-teal-50/60', border: 'border-teal-100', iconBg: 'bg-teal-100', iconText: 'text-teal-600' },
    violet: { bg: 'bg-violet-50/60', border: 'border-violet-100', iconBg: 'bg-violet-100', iconText: 'text-violet-600' },
    orange: { bg: 'bg-orange-50/60', border: 'border-orange-100', iconBg: 'bg-orange-100', iconText: 'text-orange-600' },
  };

  const usageGuideSteps = [
    { tab: 'dashboard', number: '1', color: 'blue', icon: <LayoutDashboard size={18} />, title: 'Dashboard Utama', desc: 'Halaman pertama yang kamu lihat saat masuk aplikasi. Di sini tampil ringkasan progres: jumlah file yang sudah diunggah, jumlah jurnal yang sudah masuk ke Matriks, dan jumlah variabel yang sudah dibuat di Canvas. Jadikan halaman ini titik cek progres setiap kali kamu mulai mengerjakan skripsi.' },
    { tab: 'quicknotes', number: '2', color: 'sky', icon: <AlignLeft size={18} />, title: 'Catatan Cepat', desc: 'Klik menu ini di sidebar kiri, lalu ketik apa saja di kolom yang tersedia: ide dadakan, hasil diskusi dengan dosen pembimbing, atau daftar tugas harian. Tekan simpan setelah selesai. Tidak perlu judul atau kategori, cukup tulis apa adanya dan catatan akan tersimpan otomatis di perangkatmu.' },
    { tab: 'memo', number: '3', color: 'rose', icon: <StickyNote size={18} />, title: 'Kotak Penting', desc: 'Berisi kartu-kartu siap pakai seperti "Urgensi Penelitian" dan "Batasan Masalah". Klik salah satu kartu untuk mengetik atau mengedit isinya. Gunakan menu ini untuk menyimpan poin-poin kunci yang sering kamu buka ulang saat menyusun Bab 1 pendahuluan.' },
    { tab: 'files', number: '4', color: 'indigo', icon: <FolderOpen size={18} />, title: 'File & Bab', desc: 'Klik tombol unggah untuk memasukkan file PDF atau dokumen referensi, lalu kelompokkan file tersebut ke dalam folder sesuai bab (Bab 1–5) agar rapi. Setelah terunggah, buka file dan tekan tombol AI di sampingnya untuk meminta ringkasan atau analisis isi file secara otomatis.' },
    { tab: 'matrix', number: '5', color: 'emerald', icon: <Table size={18} />, title: 'Matriks Literatur', desc: 'Klik "Tambah Jurnal", lalu isi kolom Judul, Penulis, Teori, Variabel, Metode, Temuan, dan Research Gap untuk setiap jurnal yang sudah kamu baca. Kamu juga bisa memilih file yang sudah diunggah di menu File & Bab agar AI membantu mengisi kolom-kolom tersebut secara otomatis.' },
    { tab: 'canvas', number: '6', color: 'cyan', icon: <Share2 size={18} />, title: 'Canvas Variabel', desc: 'Tambahkan kotak (node) untuk setiap variabel penelitianmu, lalu tarik garis penghubung antar node untuk menggambarkan hubungan sebab-akibat antar variabel. Gunakan hasilnya sebagai dasar menyusun kerangka berpikir dan hipotesis di Bab 2.' },
    { tab: 'kuesioner', number: '7', color: 'teal', icon: <ListChecks size={18} />, title: 'Kuesioner', desc: 'Buat indikator penelitian berdasarkan variabel yang sudah kamu susun di Canvas, lalu tambahkan daftar pertanyaan di bawah setiap indikator tersebut. Hasilnya bisa langsung dipakai sebagai instrumen survei atau kuesioner penelitianmu.' },
    { tab: 'lembar', number: '8', color: 'violet', icon: <FileText size={18} />, title: 'Lembar Skripsi', desc: 'Pilih tab Bab 1 sampai Bab 5 di bagian atas, lalu tulis draf skripsimu langsung di kolom yang tersedia. Setelah menulis, tekan tombol analisis AI untuk mendapatkan saran perbaikan struktur kalimat maupun kelengkapan isi tulisan.' },
    { tab: 'sidang', number: '9', color: 'orange', icon: <ShieldAlert size={18} />, title: 'Mode Sidang', desc: 'Aktifkan menu ini saat sidang sedang berlangsung. Nyalakan mikrofon agar pertanyaan dosen penguji otomatis tercatat (teleprompter), atau ketik pertanyaannya secara manual jika lebih nyaman, lalu AI akan menyusun poin jawaban singkat yang bisa langsung kamu sampaikan.' },
  ];

  const renderDashboard = () => {
    const validFiles = Array.isArray(filesData) ? filesData : [];
    const validMatrix = Array.isArray(matrixData) ? matrixData : [];
    const validCanvas = Array.isArray(canvasNodes) ? canvasNodes : [];
    const validNotes = Array.isArray(quickNotes) ? quickNotes : [];
    const validMemos = Array.isArray(memoCards) ? memoCards : [];

    // Hitung progress bab yang sudah terisi di Lembar Skripsi
    const babKeys = ['bab1', 'bab2', 'bab3', 'bab4', 'bab5'];
    const completedBabs = babKeys.filter(k => {
      const text = stripHtmlToText((draftContent && draftContent[k]) || '');
      return text.trim().length > 50;
    });
    const completedBabCount = completedBabs.length;

    // Boss HP berkurang seiring semakin banyak Bab & Jurnal yang selesai
    const calculatedBossHp = Math.max(12, 100 - (completedBabCount * 16) - Math.min(18, validMatrix.length * 3));
    const warriorPower = 100 - calculatedBossHp;

    return (
      <div className="space-y-8 animate-in fade-in duration-700 pb-28 font-outfit text-slate-100">
        
        {/* HERO SECTION GHOST OF TSUSHIMA SAMURAI SHOWCASE */}
        <div className="relative rounded-[2.5rem] overflow-hidden border border-red-950/80 bg-gradient-to-b from-[#140809] via-[#0c0607] to-[#070405] shadow-[0_20px_60px_-15px_rgba(185,28,28,0.3)]">
          
          {/* Latar Belakang Gambar Kuil Bulan Darah dengan Vignette Gelap */}
          <div className="absolute inset-0 pointer-events-none opacity-25 mix-blend-screen">
            <img src={bloodMoonImg} alt="Blood Moon Shrine" className="w-full h-full object-cover object-center filter saturate-150" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070405] via-[#0c0607]/80 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#070405] via-transparent to-[#070405]"></div>
          </div>

          {/* Partikel Daun Maple Merah Darah (Momiji) Melayang */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <span className="leaf-particle text-red-600 text-xl" style={{ left: '15%', animationDuration: '9s', animationDelay: '0s' }}>🍁</span>
            <span className="leaf-particle text-rose-500 text-lg" style={{ left: '35%', animationDuration: '14s', animationDelay: '3s' }}>🍁</span>
            <span className="leaf-particle text-red-700 text-2xl" style={{ left: '60%', animationDuration: '11s', animationDelay: '1.5s' }}>🍁</span>
            <span className="leaf-particle text-red-500 text-base" style={{ left: '80%', animationDuration: '13s', animationDelay: '5s' }}>🍁</span>
            <span className="leaf-particle text-amber-600 text-sm" style={{ left: '92%', animationDuration: '16s', animationDelay: '2s' }}>🍂</span>
          </div>

          <div className="relative z-10 p-6 sm:p-8 lg:p-10">
            
            {/* Top Bar Label / Shogunate Tag */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-red-950/70 pb-5 mb-8">
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-red-950/80 text-red-400 border border-red-800/60 shadow-[0_0_12px_rgba(220,38,38,0.4)] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                  ⛩️ SHOGUNATE OF SKRIPSI // 修羅の道
                </span>
                <span className="text-xs font-mincho text-red-300/60 hidden sm:inline">卒業の呪い (Curse of Graduation)</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>AI SENSEI STANDBY</span>
              </div>
            </div>

            {/* Main Showcase Layout: Manga Card + Hero Character + Boss/Timer */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Kolom Kiri: Panel Manga Sumi-e Oni (Guardian AI) */}
              <div className="lg:col-span-4 flex flex-col space-y-4">
                <div className="relative rounded-3xl overflow-hidden border-2 border-red-900/60 bg-[#0d0708] shadow-[0_10px_30px_rgba(0,0,0,0.8)] group hover:border-red-600 transition-all duration-500">
                  <div className="relative h-64 sm:h-72 overflow-hidden bg-black">
                    <img 
                      src={oniSumieImg} 
                      alt="Hannya AI Guardian" 
                      className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105 filter contrast-125"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d0708] via-transparent to-black/40"></div>
                    <div className="absolute top-3 left-3 bg-red-950/90 text-red-300 text-[10px] font-black uppercase px-2.5 py-1 rounded-md border border-red-800/80 tracking-wider">
                      🎴 ONI MANGA CARD
                    </div>
                  </div>
                  <div className="p-5 relative -mt-6">
                    <h4 className="font-cinzel text-lg font-black text-red-400 tracking-wide flex items-center gap-2">
                      <Skull size={18} className="text-red-500" /> HANNYA GUARDIAN AI
                    </h4>
                    <p className="text-xs text-slate-300/80 leading-relaxed mt-2 font-medium">
                      Entitas penganalisis skripsi dari dunia bawah. Siap membongkar kelemahan metodologi, merangkum PDF, dan mengasah kalimat drafmu.
                    </p>
                    <button 
                      onClick={() => setIsChatOpen(true)}
                      className="w-full mt-4 py-2.5 px-4 rounded-xl btn-katana text-white text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Flame size={14} className="text-amber-300 animate-pulse" /> Panggil Penasihat AI
                    </button>
                  </div>
                </div>

                {/* Status Singkat Mahasiswa Samurai */}
                <div className="panel-samurai p-4 rounded-2xl flex items-center justify-between border border-red-950/70">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-800 flex items-center justify-center text-red-400">
                      <Sword size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-black text-red-400/80 tracking-wider">Tingkat Pendekar</p>
                      <p className="text-sm font-black text-white font-cinzel">Level {completedBabCount + 1}: Ronin Bab {completedBabCount + 1}</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-2.5 py-1 rounded-lg">
                    {warriorPower}% POWER
                  </span>
                </div>
              </div>

              {/* Kolom Tengah & Kanan: Karakter Utama + Boss Penguji & Action Bar */}
              <div className="lg:col-span-8 flex flex-col space-y-6">
                
                {/* Hero Banner dengan Gambar Samurai & Boss */}
                <div className="relative rounded-3xl overflow-hidden border border-red-900/40 bg-gradient-to-r from-[#170a0c] to-[#0a0506] p-6 sm:p-8">
                  
                  {/* Background Samurai Hero Artwork */}
                  <div className="absolute right-0 top-0 bottom-0 w-full sm:w-2/3 pointer-events-none opacity-40 sm:opacity-50 mix-blend-screen overflow-hidden">
                    <img 
                      src={samuraiHeroImg} 
                      alt="The Ghost Samurai" 
                      className="w-full h-full object-cover object-top filter contrast-125"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#170a0c] via-transparent to-transparent"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0506] via-transparent to-transparent"></div>
                  </div>

                  <div className="relative z-10 max-w-lg">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-red-950/90 text-red-400 border border-red-800/80 text-[11px] font-black uppercase tracking-widest mb-3">
                      <Flame size={14} className="text-amber-400" /> TAKDIR SIDANG AKHIR
                    </div>
                    
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-red-100 via-rose-200 to-red-400 leading-tight drop-shadow-[0_4px_10px_rgba(220,38,38,0.5)]">
                      THE CURSED DUEL
                    </h2>
                    
                    <p className="text-sm sm:text-base text-slate-300/90 font-mincho mt-3 leading-relaxed">
                      "Di hadapan Dosen Penguji, hanya lembaran bertinta darah dan logika tajam yang akan selamat. Cabut katanamu, selesaikan drafmu."
                    </p>

                    {/* Tombol Aksi Utama Samurai */}
                    <div className="flex flex-wrap gap-3 mt-6">
                      <button 
                        onClick={() => setActiveTab('lembar')}
                        className="btn-katana px-6 py-3.5 rounded-2xl text-white font-black text-sm tracking-wide uppercase flex items-center gap-2.5 shadow-xl"
                      >
                        <Sword size={18} /> Hujam Lembar Skripsi
                      </button>
                      <button 
                        onClick={() => onNavigateLab()}
                        className="btn-katana-ghost px-5 py-3.5 rounded-2xl font-bold text-sm tracking-wide uppercase flex items-center gap-2"
                      >
                        <Crown size={18} className="text-amber-400" /> Lab Statistik Pro
                      </button>
                      <button 
                        onClick={() => setActiveTab('sidang')}
                        className="px-5 py-3.5 rounded-2xl bg-black/60 hover:bg-red-950/60 border border-red-900/60 text-red-300 font-bold text-sm tracking-wide uppercase flex items-center gap-2 transition-all"
                      >
                        <ShieldAlert size={18} className="text-rose-500" /> Mode Sidang
                      </button>
                    </div>
                  </div>
                </div>

                {/* BOSS HEALTH BAR & COUNTDOWN TIMER (GHOST OF TSUSHIMA STYLE) */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  
                  {/* Boss Health Bar (Dosen Penguji) */}
                  <div className="sm:col-span-7 panel-samurai p-5 rounded-3xl border border-red-950/90 flex flex-col justify-between">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-red-700/80 shrink-0 bg-black">
                        <img src={cursedBossImg} alt="Dosen Penguji Boss" className="w-full h-full object-cover object-top" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-black uppercase text-red-400 tracking-wider">Final Boss // 最終試験</p>
                          <span className="text-xs font-black text-rose-400">{calculatedBossHp}% HP</span>
                        </div>
                        <h4 className="text-sm font-black text-white truncate font-cinzel">SENSEI PENGUJI - MASTER OF REVISION</h4>
                      </div>
                    </div>

                    {/* Bar HP Boss yang Berkurang saat Tugas Selesai */}
                    <div>
                      <div className="w-full h-3 bg-black/80 rounded-full overflow-hidden border border-red-950 p-0.5">
                        <div 
                          className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(239,68,68,0.8)]"
                          style={{ width: `${calculatedBossHp}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mt-2">
                        <span>{completedBabCount} dari 5 Bab Tertulis</span>
                        <span>{validMatrix.length} Jurnal Terdokumentasi</span>
                      </div>
                    </div>
                  </div>

                  {/* Countdown Timer Sidang (Like Release Date in Image 2) */}
                  <div className="sm:col-span-5 panel-samurai p-5 rounded-3xl border border-red-950/90 flex flex-col justify-between bg-gradient-to-br from-[#160809] to-[#0c0506]">
                    <div>
                      <p className="text-[10px] font-black uppercase text-amber-400/90 tracking-widest flex items-center gap-1.5">
                        <Clock size={12} className="text-amber-400" /> TENGGAT KELULUSAN
                      </p>
                      <p className="text-xs text-slate-300 font-mincho mt-1">Countdown Menuju Ujian Akhir</p>
                    </div>

                    <div className="my-2 py-2 px-3 bg-black/60 rounded-xl border border-red-900/50 flex items-center justify-around text-center">
                      <div>
                        <span className="block text-xl font-black text-white font-cinzel">14</span>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Hari</span>
                      </div>
                      <span className="text-red-500 font-bold">:</span>
                      <div>
                        <span className="block text-xl font-black text-white font-cinzel">08</span>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Jam</span>
                      </div>
                      <span className="text-red-500 font-bold">:</span>
                      <div>
                        <span className="block text-xl font-black text-white font-cinzel">45</span>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Mnt</span>
                      </div>
                      <span className="text-red-500 font-bold">:</span>
                      <div>
                        <span className="block text-xl font-black text-red-400 font-cinzel animate-pulse">20</span>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Dtk</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-center font-bold text-red-400/90 tracking-wide uppercase">
                      ⚠️ Waktu Berjalan, Asah Pena!
                    </p>
                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

        {/* 4 RELIK KUTUKAN // MODULAR CARDS SHOWCASE */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-black font-cinzel text-white flex items-center gap-2">
              <Scroll size={20} className="text-red-500" /> 4 SENJATA & RELIK PENELITIAN
            </h3>
            <span className="text-xs text-slate-400 font-mincho">四つの神器 (Four Sacred Relics)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            
            {/* Card 1: Dokumen & Bab */}
            <div 
              onClick={() => setActiveTab('files')}
              className="panel-samurai p-5 rounded-3xl border border-red-950/70 hover:border-red-600/80 cursor-pointer group transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-800/80 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
                  <FolderOpen size={24} />
                </div>
                <span className="text-[10px] font-black uppercase text-red-400/80 bg-red-950/40 px-2 py-1 rounded-md border border-red-900/40">ARSIP</span>
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">File & Bab Skripsi</p>
              <h4 className="text-2xl font-black font-cinzel text-white mt-1">{validFiles.length} <span className="text-sm font-normal text-slate-400">Berkas</span></h4>
              <p className="text-xs text-slate-300/70 mt-3 line-clamp-2">PDF referensi tersimpan di penyimpanan lokalmu dengan ringkasan otomatis.</p>
              <div className="mt-4 flex items-center text-xs font-bold text-red-400 group-hover:text-red-300">
                <span>Buka Arsip Dokumen</span>
                <ChevronRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 2: Matriks Literatur */}
            <div 
              onClick={() => setActiveTab('matrix')}
              className="panel-samurai p-5 rounded-3xl border border-red-950/70 hover:border-red-600/80 cursor-pointer group transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-800/80 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <Table size={24} />
                </div>
                <span className="text-[10px] font-black uppercase text-emerald-400/80 bg-emerald-950/40 px-2 py-1 rounded-md border border-emerald-900/40">MATRIKS</span>
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Jurnal & Research Gap</p>
              <h4 className="text-2xl font-black font-cinzel text-white mt-1">{validMatrix.length} <span className="text-sm font-normal text-slate-400">Jurnal</span></h4>
              <p className="text-xs text-slate-300/70 mt-3 line-clamp-2">Pembedahan teori, metodologi, dan celah penelitian terdahulu.</p>
              <div className="mt-4 flex items-center text-xs font-bold text-emerald-400 group-hover:text-emerald-300">
                <span>Buka Matriks Literatur</span>
                <ChevronRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 3: Canvas Variabel */}
            <div 
              onClick={() => setActiveTab('canvas')}
              className="panel-samurai p-5 rounded-3xl border border-red-950/70 hover:border-red-600/80 cursor-pointer group transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-800/80 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                  <Share2 size={24} />
                </div>
                <span className="text-[10px] font-black uppercase text-cyan-400/80 bg-cyan-950/40 px-2 py-1 rounded-md border border-cyan-900/40">KERANGKA</span>
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Canvas Variabel</p>
              <h4 className="text-2xl font-black font-cinzel text-white mt-1">{validCanvas.length} <span className="text-sm font-normal text-slate-400">Node</span></h4>
              <p className="text-xs text-slate-300/70 mt-3 line-clamp-2">Jejaring hubungan kausal variabel independen, dependen, dan indikator.</p>
              <div className="mt-4 flex items-center text-xs font-bold text-cyan-400 group-hover:text-cyan-300">
                <span>Rakit Kerangka Pemikiran</span>
                <ChevronRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 4: Lembar Skripsi Bab I - V */}
            <div 
              onClick={() => setActiveTab('lembar')}
              className="panel-samurai p-5 rounded-3xl border border-red-950/70 hover:border-red-600/80 cursor-pointer group transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-800/80 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                  <FileText size={24} />
                </div>
                <span className="text-[10px] font-black uppercase text-rose-400/80 bg-rose-950/40 px-2 py-1 rounded-md border border-rose-900/40">DRAF UTAMA</span>
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Lembar Bab I - V</p>
              <h4 className="text-2xl font-black font-cinzel text-white mt-1">{completedBabCount} / 5 <span className="text-sm font-normal text-slate-400">Bab</span></h4>
              <p className="text-xs text-slate-300/70 mt-3 line-clamp-2">Editor draf skripsi lengkap dengan tombol analisis dan bimbingan AI.</p>
              <div className="mt-4 flex items-center text-xs font-bold text-rose-400 group-hover:text-rose-300">
                <span>Buka Lembar Skripsi</span>
                <ChevronRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

          </div>
        </div>

        {/* ALTAR PENYELAMATAN DATA (BACKUP & RESTORE DENGAN RUNE JEPANG) */}
        <div className="panel-samurai p-6 sm:p-8 rounded-3xl border border-red-950/80 bg-gradient-to-r from-[#110708] to-[#0a0506]">
          <div className="flex items-center space-x-3 mb-3">
            <div className="p-2.5 bg-red-950/80 border border-red-800/80 text-red-400 rounded-xl shadow-sm">
              <Database size={22} />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white font-cinzel">ALTAR SEGEL JIWA (BACKUP & RESTORE)</h3>
              <p className="text-xs text-red-400 font-mincho">データ保護の祭壇 (Preservation Altar)</p>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-300/80 mb-6 font-medium leading-relaxed">
            Data skripsi, draf teks, matriks, dan dokumen PDF-mu tersimpan secara sakral di peramban lokal perangkatmu. Jangan biarkan kutukan kehilangan data menimpamu. Unduh Segel Backup (.json) secara berkala dan simpan di tempat yang aman (Google Drive/Flashdisk).
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={handleExportData} 
              disabled={isExporting} 
              className="flex-1 btn-katana text-white px-6 py-4 rounded-2xl font-black uppercase tracking-wider text-xs sm:text-sm transition-all shadow-lg flex items-center justify-center disabled:opacity-50"
            >
              {isExporting ? <Loader2 size={18} className="animate-spin mr-2" /> : <DownloadCloud size={18} className="mr-2" />} 
              {isExporting ? 'Mempersiapkan Segel...' : 'Unduh Segel Backup (.json)'}
            </button>
            <div className="relative flex-1">
              <input type="file" accept=".json" onChange={handleImportData} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <button className="w-full btn-katana-ghost px-6 py-4 rounded-2xl font-black uppercase tracking-wider text-xs sm:text-sm transition-all flex items-center justify-center">
                <UploadCloud size={18} className="mr-2" /> Pulihkan dari Kematian (Restore)
              </button>
            </div>
          </div>
        </div>

        {/* KODEKS MAHASISWA // PANDUAN LANGKAH-LANGKAH (PETUNJUK PEMAKAIAN) */}
        <div className="panel-samurai p-6 sm:p-8 rounded-3xl border border-red-950/80">
          <div className="flex items-center space-x-3 mb-3">
            <div className="p-2.5 bg-red-950/80 border border-red-800/80 text-amber-400 rounded-xl shadow-sm">
              <Compass size={22} />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white font-cinzel">KODEKS JALAN PENELITI (PANDUAN ALUR)</h3>
              <p className="text-xs text-amber-400 font-mincho">研究の道標 (Way of the Scholar)</p>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-300/80 mb-6 font-medium">
            Ikuti 9 tahap sakral ini dari atas ke bawah untuk menyelesaikan skripsimu dengan kehormatan tertinggi:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {usageGuideSteps.map((step) => {
              return (
                <div key={step.tab} className="rounded-2xl border border-red-950/60 bg-[#0d0708]/70 p-4 hover:border-red-800/70 transition-all">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-red-950 text-red-400 border border-red-900/60 text-xs font-black">
                      {step.number}
                    </div>
                    <p className="font-black text-white text-sm leading-tight font-cinzel">{step.title}</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    );
  };

  const renderQuickNotes = () => {
    const validNotes = Array.isArray(quickNotes) ? quickNotes : [];
    return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-red-950/80 pb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-rose-300 to-red-500 flex items-center gap-3 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">
            <Skull className="text-red-500 w-7 h-7 sm:w-8 sm:h-8 animate-pulse" /> 死神の筆記 // Catatan Cepat Shinigami
          </h2>
          <p className="text-xs sm:text-sm text-red-300/70 font-mincho mt-1 tracking-wider">
            人生は 消せない ノートの ような ものだ • Goreskan takdir penelitianmu sebelum kabut menelan ingatan
          </p>
        </div>
        <div className="text-right hidden sm:block">
          <span className="text-[10px] font-black font-cinzel text-red-400 bg-red-950/60 border border-red-800/80 px-3 py-1.5 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.2)]">
            {validNotes.length} GORESAN TERCATAT
          </span>
        </div>
      </div>

      <form onSubmit={(e) => { addQuickNote(e); playKatanaSlash(); }} className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
        <div className="relative flex-1">
          <input 
            type="text" 
            value={newQuickNote} 
            onChange={(e) => setNewQuickNote(e.target.value)} 
            placeholder="Torehkan ide/fenomena singkat di sini... (contoh: Karyawan burnout saat WFH)" 
            className="w-full px-5 py-4 rounded-2xl input-samurai text-red-100 placeholder-red-900/60 font-medium text-sm sm:text-base border border-red-900/60 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]" 
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-red-900/40 text-xs font-mincho pointer-events-none hidden md:inline">筆記</span>
        </div>
        <button 
          type="submit" 
          disabled={!newQuickNote.trim()} 
          className="btn-katana text-white px-7 py-4 rounded-2xl font-black font-cinzel tracking-wider text-xs sm:text-sm transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sword size={18} className="mr-2 rotate-45" /> TOREHKAN IDE
        </button>
      </form>

      <div className="panel-samurai rounded-3xl sm:rounded-[2rem] overflow-hidden border border-red-950/90 shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
        {validNotes.length === 0 ? (
          <div className="p-12 sm:p-20 text-center text-red-300/50 flex flex-col items-center bg-[#0d0709]/80 border border-dashed border-red-950/80 rounded-2xl m-4 sm:m-6">
            <Skull size={54} className="sm:w-16 sm:h-16 mb-4 text-red-700/60 animate-pulse" />
            <p className="text-lg sm:text-xl font-black font-cinzel text-red-200 mb-2 tracking-wide">LEMBAR MASIH KOSONG // 無</p>
            <p className="text-xs sm:text-sm text-red-400/60 max-w-md font-mincho">Belum ada kilatan ide yang digoreskan. Mulai catat fenomena dan temuan lapangamu di atas.</p>
          </div>
        ) : (
          <ul className="divide-y divide-red-950/60">
            {validNotes.map((note, idx) => (
              <li 
                key={note.id} 
                data-search-target={`note-${note.id}`} 
                className={`p-5 sm:p-6 hover:bg-red-950/20 flex flex-col md:flex-row md:items-center justify-between group transition-all gap-4 border-l-4 border-l-red-800 hover:border-l-red-500 ${highlightTarget === `note-${note.id}` ? 'bg-red-950/50 ring-2 ring-red-500 animate-pulse' : ''}`}
              >
                {editingQuickNoteId === note.id ? (
                  <div className="flex-1 flex flex-col sm:flex-row gap-3 w-full">
                    <input 
                      type="text" 
                      value={editingQuickNoteText} 
                      onChange={(e) => setEditingQuickNoteText(e.target.value)} 
                      className="flex-1 px-4 py-3 rounded-xl input-samurai text-sm font-medium text-white shadow-sm border border-red-500" 
                      autoFocus 
                    />
                    <div className="flex gap-2 self-end sm:self-auto">
                      <button onClick={() => { saveEditQuickNote(); playKatanaSlash(); }} className="px-5 py-3 btn-katana text-white rounded-xl text-xs sm:text-sm font-black font-cinzel shadow-md">Simpan</button>
                      <button onClick={cancelEditQuickNote} className="px-4 py-3 bg-red-950/80 text-red-300 rounded-xl text-xs sm:text-sm font-bold hover:bg-red-900 border border-red-900/60">Batal</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start space-x-3 sm:space-x-4 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-black/60 border border-red-900/80 text-red-400 font-cinzel font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_8px_rgba(220,38,38,0.3)]">
                        #{idx + 1}
                      </div>
                      <div className="flex-1">
                        <span className="text-slate-100 font-medium whitespace-pre-wrap leading-relaxed text-[13px] sm:text-[15px]">{note.text}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 self-end md:self-auto shrink-0 mt-2 md:mt-0">
                      <button 
                        onClick={() => { handleEnhanceQuickNote(note); playCursedWhisper(); }} 
                        disabled={isEnhancingNote === note.id} 
                        className="px-3 sm:px-4 py-2 text-rose-200 hover:text-white bg-red-950/70 hover:bg-red-800 rounded-xl transition-all shadow-md flex items-center text-xs sm:text-sm font-bold border border-red-800/80 hover:border-red-500 disabled:opacity-50" 
                        title="Minta Shinigami AI merapikan kalimat ini menjadi bahasa akademik tajam"
                      >
                        {isEnhancingNote === note.id ? <Loader2 size={14} className="mr-1.5 animate-spin text-red-400" /> : <Sparkles size={14} className="mr-1.5 text-rose-400" />} 
                        {isEnhancingNote === note.id ? 'Menebas...' : '✨ Tebas Rapi (AI)'}
                      </button>
                      <button 
                        onClick={() => handleEditQuickNote(note)} 
                        className="text-slate-400 hover:text-red-300 p-2 sm:p-2.5 rounded-xl bg-black/50 hover:bg-red-950/60 border border-red-950 transition-colors shadow-sm"
                      >
                        <Edit size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </button>
                      <button 
                        onClick={() => { deleteQuickNote(note.id); playKatanaSlash(); }} 
                        className="text-slate-400 hover:text-red-500 p-2 sm:p-2.5 rounded-xl bg-black/50 hover:bg-red-950/60 border border-red-950 transition-colors shadow-sm"
                      >
                        <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )};

  const memoColors = [
    { border: 'border-red-600', bg: 'bg-[#150709]', text: 'text-red-100', headerBg: 'bg-gradient-to-r from-red-950 via-[#26090d] to-[#160709]', placeholder: 'placeholder-red-700/60', badge: '血' },
    { border: 'border-rose-600', bg: 'bg-[#16080e]', text: 'text-rose-100', headerBg: 'bg-gradient-to-r from-rose-950 via-[#290a16] to-[#16080e]', placeholder: 'placeholder-rose-700/60', badge: '桜' },
    { border: 'border-amber-600', bg: 'bg-[#171006]', text: 'text-amber-100', headerBg: 'bg-gradient-to-r from-amber-950 via-[#2a1b07] to-[#171006]', placeholder: 'placeholder-amber-700/60', badge: '狐' },
    { border: 'border-emerald-600', bg: 'bg-[#06170d]', text: 'text-emerald-100', headerBg: 'bg-gradient-to-r from-emerald-950 via-[#0a2916] to-[#06170d]', placeholder: 'placeholder-emerald-700/60', badge: '林' },
    { border: 'border-cyan-600', bg: 'bg-[#061517]', text: 'text-cyan-100', headerBg: 'bg-gradient-to-r from-cyan-950 via-[#072428] to-[#061517]', placeholder: 'placeholder-cyan-700/60', badge: '霊' },
    { border: 'border-purple-600', bg: 'bg-[#130718]', text: 'text-purple-100', headerBg: 'bg-gradient-to-r from-purple-950 via-[#220a2a] to-[#130718]', placeholder: 'placeholder-purple-700/60', badge: '鬼' },
    { border: 'border-slate-700', bg: 'bg-[#0a0a0c]', text: 'text-slate-100', headerBg: 'bg-gradient-to-r from-slate-900 via-[#18181b] to-[#0a0a0c]', placeholder: 'placeholder-slate-700', badge: '影' },
  ];

  const addMemoCard = () => {
    const validMemos = Array.isArray(memoCards) ? memoCards : [];
    const randomColorIndex = Math.floor(Math.random() * memoColors.length);
    setMemoCards([{ id: Date.now().toString(), title: 'Mantra / Urgensi Baru', content: '', colorIndex: randomColorIndex, important: false }, ...validMemos]);
    playKatanaSlash();
  };
  const updateMemoCard = (id, field, value) => setMemoCards(prev => (Array.isArray(prev) ? prev : []).map(card => card.id === id ? { ...card, [field]: value } : card));
  const deleteMemoCard = (id) => { 
    if (window.confirm('Bakar dan musnahkan jimat Ofuda ini?')) {
      setMemoCards(prev => (Array.isArray(prev) ? prev : []).filter(card => card.id !== id));
      playKatanaSlash();
    }
  };
  const toggleMemoImportant = (id) => {
    setMemoCards(prev => (Array.isArray(prev) ? prev : []).map(card => card.id === id ? { ...card, important: !card.important } : card));
    playCursedWhisper();
  };

  const renderMemoCards = () => {
    const validMemos = Array.isArray(memoCards) ? memoCards : [];
    return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 border-b border-red-950/80 pb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-rose-300 to-red-500 flex items-center gap-3 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">
            <Flame className="text-red-500 w-7 h-7 sm:w-8 sm:h-8 animate-pulse" /> 呪符の結界 // Ofuda Talisman Board
          </h2>
          <p className="text-xs sm:text-sm text-red-300/70 font-mincho mt-1 tracking-wider">
            メモ を とる ことは、記憶 を 強化 する ことだ • Tempelkan mantra urgensi, gap penelitian, dan batasan masalah di dinding altar
          </p>
        </div>
        <button 
          onClick={addMemoCard} 
          className="w-full sm:w-auto btn-katana text-white px-7 py-3.5 rounded-2xl font-black font-cinzel tracking-wider text-xs sm:text-sm transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] flex items-center justify-center"
        >
          <Plus size={18} className="mr-2" /> TEMPEL JIMAT BARU
        </button>
      </div>

      {validMemos.length === 0 ? (
        <div className="p-12 sm:p-20 text-center text-red-300/50 bg-[#0d0709]/80 rounded-3xl sm:rounded-[2.5rem] border border-dashed border-red-950/90 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          <StickyNote size={54} className="sm:w-16 sm:h-16 mx-auto mb-4 text-red-700/60 opacity-60" />
          <p className="text-lg sm:text-xl font-black font-cinzel text-red-200 mb-2">DINDING KUIL MASIH KOSONG // 虚空</p>
          <p className="text-xs sm:text-sm text-red-400/60 font-mincho">Klik "Tempel Jimat Baru" untuk memagari topik penelitianmu dengan jimat Ofuda.</p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-5 sm:gap-6">
          {validMemos.map((card) => {
            const color = memoColors[card.colorIndex] || memoColors[0];
            const autoResize = (e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; };
            const isSearchHit = highlightTarget === `memo-${card.id}`;
            return (
              <div 
                key={card.id} 
                data-search-target={`memo-${card.id}`} 
                className={`relative mb-5 sm:mb-6 break-inside-avoid rounded-2xl sm:rounded-3xl border-2 ${color.border} ${color.bg} flex flex-col overflow-hidden transition-all duration-300 shadow-[0_15px_30px_rgba(0,0,0,0.8)] hover:shadow-[0_20px_40px_rgba(220,38,38,0.3)] hover:-translate-y-1 ${isSearchHit ? 'ring-4 ring-red-500 ring-offset-2 ring-offset-black animate-pulse' : card.important ? 'ring-2 ring-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : ''}`}
              >
                {/* Ancient Seal Pin */}
                <button
                  onClick={() => toggleMemoImportant(card.id)}
                  className={`absolute top-2.5 right-2.5 z-10 w-4 h-4 rounded-full border transition-all shadow-md ${card.important ? 'bg-red-500 border-red-300 shadow-[0_0_10px_rgba(239,68,68,0.9)] animate-pulse' : 'bg-black/70 border-red-800/80 hover:bg-red-600 hover:border-red-400'}`}
                  title={card.important ? 'Jimat Darah Aktif (Penting)' : 'Kunci sebagai Jimat Utama'}
                />

                {/* Header Card */}
                <div className={`flex items-start justify-between gap-2 pr-8 p-3.5 sm:p-4 border-b ${color.border} ${color.headerBg} relative`}>
                  <span className="font-mincho text-xs text-red-400/60 font-black mr-1 select-none">{color.badge}</span>
                  <textarea
                    value={card.title}
                    onChange={(e) => { updateMemoCard(card.id, 'title', e.target.value); autoResize(e); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                    ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                    rows={1}
                    title={card.title}
                    className={`flex-1 min-w-0 bg-transparent border-none focus:outline-none focus:ring-0 resize-none overflow-hidden font-black font-cinzel tracking-wider leading-snug text-xs sm:text-[13px] whitespace-pre-wrap break-words ${color.text} ${color.placeholder}`}
                    placeholder="JUDUL MANTRA..."
                  />
                  <button 
                    onClick={() => deleteMemoCard(card.id)} 
                    className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/60 transition-colors opacity-60 hover:opacity-100 shrink-0" 
                    title="Bakar Jimat"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Content Card */}
                <textarea
                  value={card.content}
                  onChange={(e) => { updateMemoCard(card.id, 'content', e.target.value); autoResize(e); }}
                  ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                  className={`w-full min-h-[7rem] sm:min-h-[9rem] p-4 sm:p-5 bg-transparent border-none focus:outline-none focus:ring-0 resize-none overflow-hidden text-[12px] sm:text-[13px] leading-relaxed ${color.text} ${color.placeholder} font-medium selection:bg-red-900 selection:text-white`}
                  placeholder="Torehkan catatan / argumen krusial di jimat ini..."
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  )};

  const renderFiles = () => {
    const validFiles = Array.isArray(filesData) ? filesData : [];
    const validExpandedFiles = Array.isArray(expandedFiles) ? expandedFiles : [];
    const folders = [
      { name: 'Bab 1: Pendahuluan', kanji: '序章', desc: 'Latar belakang & fondasi masalah' },
      { name: 'Bab 2: Tinjauan Pustaka', kanji: '典拠', desc: 'Teori pendukung & jurnal rujukan' },
      { name: 'Bab 3: Metodologi', kanji: '術式', desc: 'Desain, populasi, & instrumen' },
      { name: 'Referensi Jurnal', kanji: '経典', desc: 'Kitab penelitian terdahulu' },
      { name: 'Lampiran & Dataset', kanji: '遺物', desc: 'Data mentah & bukti empiris' },
    ];

    if (activeFolder) {
      const folderFiles = validFiles.filter(f => f.folder === activeFolder);
      const filteredFiles = folderFiles.filter(f => f.name.toLowerCase().includes(fileSearchTerm.toLowerCase()));

      return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-20">
          <div className="flex flex-col space-y-4 border-b border-red-950/80 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center space-x-3 sm:space-x-4">
                <button 
                  onClick={() => { setActiveFolder(null); setFileSearchTerm(''); playKatanaSlash(); }} 
                  className="p-3 bg-black/60 hover:bg-red-950/80 text-red-300 rounded-xl sm:rounded-2xl transition-all border border-red-900/60 shadow-md shrink-0"
                >
                  <ArrowLeft size={20} className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
                <div>
                  <h2 className="text-xl sm:text-3xl font-black font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-rose-300 to-red-500 leading-tight">
                    {activeFolder}
                  </h2>
                  <p className="text-xs sm:text-sm text-red-400/70 font-mincho mt-0.5">
                    {folderFiles.length} gulungan tersimpan di peti ini
                  </p>
                </div>
              </div>
              <div className="relative w-full sm:w-auto shrink-0">
                <input 
                  type="file" 
                  accept=".pdf, .txt, .csv, .docx" 
                  multiple 
                  onChange={(e) => { handleFileUpload(e); playKatanaSlash(); }} 
                  disabled={isUploading} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed" 
                />
                <button className={`w-full sm:w-auto justify-center btn-katana text-white px-6 py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black font-cinzel tracking-wider transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] flex items-center ${isUploading ? 'opacity-70' : ''}`}>
                  {isUploading ? <Loader2 size={16} className="sm:w-[18px] sm:h-[18px] mr-2 animate-spin" /> : <UploadCloud size={16} className="sm:w-[18px] sm:h-[18px] mr-2" />} 
                  {isUploading ? `Menyegel ${uploadProgress.current}/${uploadProgress.total}...` : 'SEGEL DOKUMEN BARU'}
                </button>
              </div>
            </div>
            <div className="relative w-full sm:w-80">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search size={16} className="sm:w-[18px] sm:h-[18px] text-red-700" /></div>
              <input 
                type="text" 
                placeholder="Cari nama gulungan..." 
                value={fileSearchTerm} 
                onChange={(e) => setFileSearchTerm(e.target.value)} 
                className="w-full pl-11 pr-4 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl input-samurai text-xs sm:text-sm text-red-100 placeholder-red-900/60 font-medium" 
              />
            </div>
          </div>

          <div className="panel-samurai rounded-3xl sm:rounded-[2rem] overflow-hidden border border-red-950/90 shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
            {filteredFiles.length === 0 ? (
              <div className="p-12 sm:p-20 text-center flex flex-col items-center bg-[#0d0709]/80">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black/60 rounded-full flex items-center justify-center text-red-600 mb-4 sm:mb-6 border border-red-900/80 shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                  {folderFiles.length === 0 ? <FileText size={32} className="sm:w-10 sm:h-10" /> : <Search size={32} className="sm:w-10 sm:h-10" />}
                </div>
                <p className="text-lg sm:text-xl text-red-200 font-black font-cinzel">
                  {folderFiles.length === 0 ? "PETI INI BELUM MEMILIKI GULUNGAN" : "TIDAK DITEMUKAN GULUNGAN TERKAIT"}
                </p>
                {folderFiles.length === 0 && <p className="text-xs sm:text-sm text-red-400/60 mt-2 font-mincho">Klik tombol 'Segel Dokumen Baru' di atas untuk mengunggah.</p>}
              </div>
            ) : (
              <ul className="divide-y divide-red-950/60">
                {filteredFiles.map(file => {
                  const isExpanded = validExpandedFiles.includes(file.id);
                  const isSummarizingThis = summarizingId === file.id;
                  return (
                    <li 
                      key={file.id} 
                      data-search-target={`file-${file.id}`} 
                      className={`flex flex-col hover:bg-red-950/20 transition-all border-l-4 border-l-red-900/60 hover:border-l-red-500 ${highlightTarget === `file-${file.id}` ? 'bg-red-950/50 ring-2 ring-red-500 animate-pulse' : ''}`}
                    >
                      <div className="p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between group gap-4">
                        <div className="flex items-center space-x-3 sm:space-x-4 w-full xl:w-auto overflow-hidden cursor-pointer flex-1" onClick={() => toggleExpandFile(file.id)}>
                          <div className="p-2 sm:p-3 bg-black/70 text-red-400 rounded-xl border border-red-900/80 shadow-[0_0_10px_rgba(220,38,38,0.25)] shrink-0">
                            <FileText size={20} className="sm:w-6 sm:h-6" />
                          </div>
                          <div className="truncate flex-1 min-w-0">
                            <p className="text-slate-100 font-bold text-sm sm:text-base truncate mb-0.5 group-hover:text-red-300 transition-colors">{file.name}</p>
                            <p className="text-[10px] sm:text-xs text-red-400/60 font-mono font-medium">{formatBytes(file.size)} • {file.status}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto shrink-0 mt-2 xl:mt-0 justify-start">
                          <button 
                            onClick={() => { handleSummarize(file); playCursedWhisper(); }} 
                            disabled={isSummarizingThis} 
                            className="flex-1 lg:flex-none justify-center px-3.5 sm:px-4 py-2 sm:py-2.5 text-rose-200 hover:text-white bg-red-950/70 hover:bg-red-800 rounded-xl transition-all shadow-md flex items-center text-[11px] sm:text-sm font-black font-cinzel border border-red-800/80 hover:border-red-500 whitespace-nowrap"
                          >
                            {isSummarizingThis ? <Loader2 size={14} className="sm:w-4 sm:h-4 mr-1.5 animate-spin text-red-400" /> : <Sparkles size={14} className="sm:w-4 sm:h-4 mr-1.5 text-rose-400" />} 
                            {file.summary ? 'Rangkuman' : '✨ Bedah AI'}
                          </button>
                          <button onClick={() => openFileChat(file)} className="p-2 sm:p-2.5 text-red-300 hover:text-white bg-black/50 hover:bg-red-950/80 rounded-xl border border-red-950 transition-all shadow-sm shrink-0" title="Konsultasi Dokumen dengan AI"><MessageSquare size={16} className="sm:w-5 sm:h-5" /></button>
                          <button onClick={() => handlePreviewFile(file)} className="p-2 sm:p-2.5 text-slate-300 hover:text-red-300 bg-black/50 hover:bg-red-950/80 rounded-xl border border-red-950 transition-all shadow-sm shrink-0" title="Lihat Isi Gulungan"><Eye size={16} className="sm:w-5 sm:h-5" /></button>
                          <button onClick={() => handleDownloadFile(file)} className="p-2 sm:p-2.5 text-slate-300 hover:text-red-300 bg-black/50 hover:bg-red-950/80 rounded-xl border border-red-950 transition-all shadow-sm shrink-0" title="Unduh File"><Download size={16} className="sm:w-5 sm:h-5" /></button>
                          <button onClick={() => toggleExpandFile(file.id)} className="p-2 sm:p-2.5 text-slate-300 hover:text-red-300 bg-black/50 hover:bg-red-950/80 rounded-xl border border-red-950 transition-all shadow-sm shrink-0">{isExpanded ? <ChevronUp size={16} className="sm:w-5 sm:h-5" /> : <ChevronDown size={16} className="sm:w-5 sm:h-5" />}</button>
                          <button onClick={() => { handleDeleteFile(file); playKatanaSlash(); }} className="p-2 sm:p-2.5 text-slate-400 hover:text-red-500 bg-black/50 hover:bg-red-950/80 rounded-xl border border-red-950 transition-all shadow-sm shrink-0" title="Musnahkan Dokumen"><Trash2 size={16} className="sm:w-5 sm:h-5" /></button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="bg-[#0b0507] px-5 sm:px-16 py-4 sm:py-6 border-t border-red-950/70 text-xs sm:text-sm">
                           {isSummarizingThis ? (
                             <div className="flex items-center text-red-400 space-x-2 sm:space-x-3 animate-pulse font-medium"><Sparkles size={16} className="sm:w-5 sm:h-5" /> <span className="text-xs sm:text-base font-cinzel">Arwah AI sedang membaca isi gulungan...</span></div>
                           ) : file.summary ? (
                             <div className="text-slate-200 whitespace-pre-wrap leading-loose font-medium">
                               <p className="font-black font-cinzel text-red-400 mb-2 sm:mb-3 flex items-center text-xs sm:text-sm tracking-wider">
                                 <Sparkles size={14} className="sm:w-[18px] sm:h-[18px] mr-2 text-rose-400"/> RANGKUMAN KITAB PENELITIAN:
                               </p>
                               <div className="p-4 bg-black/50 border border-red-900/40 rounded-xl text-red-100">
                                 {file.summary}
                                </div>
                             </div>
                           ) : (
                             <p className="text-red-400/50 italic text-xs sm:text-sm font-mincho">Belum ada rangkuman. Klik "✨ Bedah AI" untuk memanggil intisari jurnal ini.</p>
                           )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        <div className="border-b border-red-950/80 pb-4">
          <h2 className="text-2xl sm:text-3xl font-black font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-rose-300 to-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">
            封印の巻物 // Gulungan Arsip Bab & Dokumen
          </h2>
          <p className="text-xs sm:text-sm text-red-300/70 font-mincho mt-1 tracking-wider">
            Pilih peti pusaka di bawah untuk mendata dan membedah dokumen bab serta jurnal rujukanmu.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {folders.map((folder, idx) => {
            const count = validFiles.filter(f => f.folder === folder.name).length;
            return (
              <div 
                key={idx} 
                onClick={() => { setActiveFolder(folder.name); playDarkGong(); }} 
                className="panel-samurai p-6 rounded-3xl border border-red-950/90 shadow-[0_15px_35px_rgba(0,0,0,0.85)] hover:border-red-600/80 hover:shadow-[0_0_25px_rgba(220,38,38,0.3)] transition-all cursor-pointer group relative overflow-hidden" 
                style={{animationDelay: `${idx * 60}ms`}}
              >
                {/* Background decorative kanji */}
                <span className="absolute -bottom-4 -right-2 text-7xl font-mincho font-black text-red-950/20 group-hover:text-red-900/30 transition-colors pointer-events-none select-none">
                  {folder.kanji}
                </span>

                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-black/60 text-red-400 rounded-2xl group-hover:bg-red-950 group-hover:text-red-200 border border-red-900/70 transition-all duration-300 shadow-[0_0_12px_rgba(220,38,38,0.25)]">
                    <FolderOpen size={24} className="sm:w-7 sm:h-7" />
                  </div>
                  <span className="text-[10px] font-black font-cinzel text-red-400 bg-red-950/70 border border-red-800/80 px-2.5 py-1 rounded-full">
                    {folder.kanji}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black font-cinzel text-slate-100 mb-1 group-hover:text-red-300 transition-colors">{folder.name}</h3>
                <p className="text-xs text-red-300/60 font-mincho mb-4">{folder.desc}</p>
                <div className="flex items-center justify-between pt-3 border-t border-red-950/60 text-xs">
                  <span className="text-red-400/80 font-mono font-bold flex items-center">
                    <FileText size={13} className="mr-1.5 text-red-500" /> {count} Dokumen
                  </span>
                  <span className="text-red-500 text-[10px] font-cinzel font-black group-hover:translate-x-1 transition-transform">
                    BUKA PETI →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMatrix = () => {
    const validMatrix = Array.isArray(matrixData) ? matrixData : [];
    const validFiles = Array.isArray(filesData) ? filesData : [];
    
    const filteredMatrixData = validMatrix.filter(row => {
      const searchLower = matrixSearchTerm.toLowerCase();
      return ((row.judul && row.judul.toLowerCase().includes(searchLower)) || (row.penulis && row.penulis.toLowerCase().includes(searchLower)) || (row.teori && row.teori.toLowerCase().includes(searchLower)) || (row.variabel && row.variabel.toLowerCase().includes(searchLower)) || (row.metode && row.metode.toLowerCase().includes(searchLower)) || (row.temuan && row.temuan.toLowerCase().includes(searchLower)) || (row.gap && row.gap.toLowerCase().includes(searchLower)));
    });

    return (
      <div className="h-full flex flex-col space-y-4 sm:space-y-6 animate-in fade-in duration-500 pb-2">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 border-b border-red-950/80 pb-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-rose-300 to-red-500 flex items-center gap-3 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">
              <Table className="text-red-500 w-7 h-7 sm:w-8 sm:h-8" /> 血盟の書 // Matriks Literatur Sumpah Darah
            </h2>
            <p className="text-xs sm:text-sm text-red-300/70 font-mincho mt-1 tracking-wider">
              完璧なマトリクスにも隙間が存在する • Bedah celah, teori, dan kelemahan jurnal para pendahulu
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full xl:w-auto">
            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Search size={16} className="sm:w-[18px] sm:h-[18px] text-red-700" /></div>
              <input 
                type="text" 
                placeholder="Cari dalam naskah matriks..." 
                value={matrixSearchTerm} 
                onChange={(e) => setMatrixSearchTerm(e.target.value)} 
                className="w-full pl-11 pr-4 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl input-samurai text-xs sm:text-sm font-medium text-red-100 placeholder-red-900/60 shadow-inner" 
              />
            </div>
            <button 
              onClick={() => { setMatrixForm(initialMatrixForm); setEditingMatrixId(null); setShowMatrixForm(!showMatrixForm); playKatanaSlash(); }} 
              className="flex items-center justify-center btn-katana text-white px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black font-cinzel tracking-wider shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all w-full sm:w-auto whitespace-nowrap"
            >
              {showMatrixForm ? <X size={16} className="sm:w-5 sm:h-5 mr-2" /> : <Plus size={16} className="sm:w-5 sm:h-5 mr-2" />} 
              {showMatrixForm ? 'TUTUP FORMULIR' : 'CATAT LITERATUR BARU'}
            </button>
          </div>
        </div>
        
        {showMatrixForm && (
          <div className="panel-samurai p-6 sm:p-8 rounded-3xl sm:rounded-[2rem] border border-red-900/80 shadow-[0_20px_50px_rgba(0,0,0,0.95)] animate-in slide-in-from-top-4 duration-300 relative z-20">
            <form onSubmit={(e) => { handleSaveMatrixEntry(e); playKatanaSlash(); }}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-5 sm:mb-6 border-b border-red-950/80 pb-4">
                 <h3 className="text-lg sm:text-xl font-black font-cinzel text-red-200 flex items-center gap-2">
                   <Sword size={20} className="text-red-500" /> {editingMatrixId ? 'UBAH DATA LITERATUR' : 'TAMBAH LITERATUR KE MATRIKS'}
                 </h3>
                 {matrixForm.fileId && !editingMatrixId && (
                   <button 
                     type="button" 
                     onClick={() => { handleAutoFillMatrix(); playCursedWhisper(); }} 
                     disabled={isAutoFillingMatrix} 
                     className="w-full sm:w-auto justify-center text-xs sm:text-sm bg-red-950/80 hover:bg-red-900 text-rose-200 px-4 py-2.5 rounded-xl font-black font-cinzel tracking-wider flex items-center transition-all border border-red-700/80 disabled:opacity-50 shadow-md"
                   >
                     {isAutoFillingMatrix ? <Loader2 size={14} className="sm:w-4 sm:h-4 animate-spin mr-1.5 text-red-400" /> : <Sparkles size={14} className="sm:w-4 sm:h-4 mr-1.5 text-rose-400" />} 
                     {isAutoFillingMatrix ? 'Membaca Kitab...' : '✨ Auto-Ekstrak Celah (AI)'}
                   </button>
                 )}
              </div>
              <div className="mb-4 sm:mb-5">
                <label className="block text-xs sm:text-sm font-bold font-cinzel text-red-300/80 mb-2">Tautkan ke Dokumen Terunggah (Opsional)</label>
                <select 
                  name="fileId" 
                  value={matrixForm.fileId} 
                  onChange={handleMatrixFileSelect} 
                  className="w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl input-samurai text-xs sm:text-sm font-medium text-red-100"
                >
                  <option value="" className="bg-[#120709] text-slate-300">-- Ketik Judul Manual / Tidak Terhubung --</option>
                  {validFiles.map(f => (<option key={f.id} value={f.id} className="bg-[#120709] text-slate-100">{f.name}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-4 sm:mb-5">
                <div>
                  <label className="block text-xs sm:text-sm font-bold font-cinzel text-red-300/80 mb-2">Judul Jurnal <span className="text-red-500">*</span></label>
                  <input type="text" name="judul" value={matrixForm.judul || ''} onChange={handleMatrixChange} className="w-full px-4 sm:px-5 py-3 rounded-xl sm:rounded-2xl input-samurai text-xs sm:text-sm font-medium text-slate-100" placeholder="Judul artikel ilmiah..." required />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold font-cinzel text-red-300/80 mb-2">Penulis & Tahun <span className="text-red-500">*</span></label>
                  <input type="text" name="penulis" value={matrixForm.penulis || ''} onChange={handleMatrixChange} className="w-full px-4 sm:px-5 py-3 rounded-xl sm:rounded-2xl input-samurai text-xs sm:text-sm font-medium text-slate-100" placeholder="Contoh: Tanaka & Hiroshi (2024)" required />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-4 sm:mb-5">
                <div>
                  <label className="block text-xs sm:text-sm font-bold font-cinzel text-red-300/80 mb-2">Teori Utama</label>
                  <textarea name="teori" value={matrixForm.teori || ''} onChange={handleMatrixChange} rows={2} className="w-full px-4 py-3 rounded-xl sm:rounded-2xl input-samurai text-xs sm:text-sm font-medium text-slate-100 resize-y" placeholder="Grand theory / landasan..." />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold font-cinzel text-red-300/80 mb-2">Variabel / Fokus</label>
                  <textarea name="variabel" value={matrixForm.variabel || ''} onChange={handleMatrixChange} rows={2} className="w-full px-4 py-3 rounded-xl sm:rounded-2xl input-samurai text-xs sm:text-sm font-medium text-slate-100 resize-y" placeholder="X1, X2, Y, Z..." />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold font-cinzel text-red-300/80 mb-2">Metode / Algoritma</label>
                  <textarea name="metode" value={matrixForm.metode || ''} onChange={handleMatrixChange} rows={2} className="w-full px-4 py-3 rounded-xl sm:rounded-2xl input-samurai text-xs sm:text-sm font-medium text-slate-100 resize-y" placeholder="Regresi, SEM-PLS, Eksperimen..." />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-6 sm:mb-8">
                <div>
                  <label className="block text-xs sm:text-sm font-bold font-cinzel text-red-300/80 mb-2">Temuan Utama</label>
                  <textarea name="temuan" value={matrixForm.temuan || ''} onChange={handleMatrixChange} rows={3} className="w-full px-4 py-3 rounded-xl sm:rounded-2xl input-samurai text-xs sm:text-sm font-medium text-slate-100 resize-y" placeholder="Hasil empiris & signifikansi..." />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold font-cinzel text-red-300/80 mb-2">Research Gap / Celah Kritis</label>
                  <textarea name="gap" value={matrixForm.gap || ''} onChange={handleMatrixChange} rows={3} className="w-full px-4 py-3 rounded-xl sm:rounded-2xl input-samurai text-xs sm:text-sm font-medium text-red-200 border-red-600/80 resize-y" placeholder="Keterbatasan atau apa yang belum diteliti..." />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 sm:space-x-4">
                <button type="button" onClick={() => setShowMatrixForm(false)} className="w-full sm:w-auto px-6 py-3 rounded-xl sm:rounded-2xl text-red-300 hover:bg-red-950/60 text-sm font-bold transition-colors border border-red-900/50">Batal</button>
                <button type="submit" className="w-full sm:w-auto btn-katana text-white px-8 py-3 rounded-xl sm:rounded-2xl text-sm font-black font-cinzel tracking-wider transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)]">SEKAT KE BUKU MATRIKS</button>
              </div>
            </form>
          </div>
        )}

        <div className="flex-1 panel-samurai rounded-3xl sm:rounded-[2.5rem] overflow-hidden flex flex-col relative z-10 min-h-0 border border-red-950/90 shadow-[0_20px_50px_rgba(0,0,0,0.95)]">
          {filteredMatrixData.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 sm:p-20 text-center text-red-300/50 bg-[#0d0709]/80">
              {validMatrix.length === 0 ? (
                <>
                  <Table size={54} className="sm:w-16 sm:h-16 text-red-700/60 mb-4 animate-pulse" />
                  <p className="font-black font-cinzel text-lg sm:text-xl text-red-200 mb-2">MATRIKS BELUM DITULISKAN // 白紙</p>
                  <p className="text-xs sm:text-sm text-red-400/60 font-mincho">Klik "Catat Literatur Baru" untuk membedah jurnal pertama.</p>
                </>
              ) : (
                <>
                  <Search size={54} className="sm:w-16 sm:h-16 text-red-700/60 mb-4" />
                  <p className="font-black font-cinzel text-lg sm:text-xl text-red-200 mb-2">TIDAK DITEMUKAN HASIL DENGAN KATA KUNCI TERSEBUT</p>
                  <p className="text-xs sm:text-sm text-red-400/60 font-mincho">Coba gunakan nama penulis, teori, atau variabel lain.</p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto flex-1 custom-scrollbar w-full">
              <table className="w-full text-xs sm:text-sm text-left text-slate-200 font-medium">
                <thead className="text-[10px] sm:text-xs text-red-300 uppercase bg-[#14080b] sticky top-0 border-b border-red-950/90 z-10 font-black font-cinzel tracking-wider">
                  <tr>
                    <th scope="col" className="px-4 sm:px-6 py-4 sm:py-5 min-w-[200px] sm:min-w-[250px]">Judul & Penulis <span className="block text-[8px] font-mincho text-red-500 font-normal">題名・著者</span></th>
                    <th scope="col" className="px-4 sm:px-6 py-4 sm:py-5 min-w-[150px] sm:min-w-[200px]">Teori <span className="block text-[8px] font-mincho text-red-500 font-normal">基礎理論</span></th>
                    <th scope="col" className="px-4 sm:px-6 py-4 sm:py-5 min-w-[150px] sm:min-w-[200px]">Variabel <span className="block text-[8px] font-mincho text-red-500 font-normal">研究変数</span></th>
                    <th scope="col" className="px-4 sm:px-6 py-4 sm:py-5 min-w-[150px] sm:min-w-[200px]">Metode <span className="block text-[8px] font-mincho text-red-500 font-normal">研究手法</span></th>
                    <th scope="col" className="px-4 sm:px-6 py-4 sm:py-5 min-w-[200px] sm:min-w-[250px]">Temuan Utama <span className="block text-[8px] font-mincho text-red-500 font-normal">主要な発見</span></th>
                    <th scope="col" className="px-4 sm:px-6 py-4 sm:py-5 min-w-[200px] sm:min-w-[250px]">Research Gap <span className="block text-[8px] font-mincho text-red-500 font-normal">研究の空白</span></th>
                    <th scope="col" className="px-4 sm:px-5 py-4 sm:py-5 w-24 sm:w-28 text-center sticky right-0 bg-[#14080b] border-l border-red-950/90">Aksi <span className="block text-[8px] font-mincho text-red-500 font-normal">決断</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-950/50">
                  {filteredMatrixData.map((row) => {
                    const linkedFile = row.fileId ? validFiles.find(f => f.id === row.fileId) : null;
                    return (
                    <tr 
                      key={row.id} 
                      data-search-target={`matrix-${row.id}`} 
                      className={`hover:bg-red-950/20 transition-colors group ${highlightTarget === `matrix-${row.id}` ? 'bg-red-950/60 ring-2 ring-red-500 animate-pulse' : ''}`}
                    >
                      <td className="px-4 sm:px-6 py-4 sm:py-5 align-top">
                        <p className="font-black font-cinzel text-red-300 text-xs sm:text-sm mb-1">{row.penulis}</p>
                        <p className="text-[10px] sm:text-xs text-slate-300 leading-relaxed" title={row.judul}>{row.judul}</p>
                      </td>
                      <td className="px-4 sm:px-6 py-4 sm:py-5 align-top whitespace-pre-wrap leading-relaxed text-slate-300">{row.teori}</td>
                      <td className="px-4 sm:px-6 py-4 sm:py-5 align-top whitespace-pre-wrap leading-relaxed text-slate-300">{row.variabel}</td>
                      <td className="px-4 sm:px-6 py-4 sm:py-5 align-top whitespace-pre-wrap leading-relaxed text-slate-300">{row.metode}</td>
                      <td className="px-4 sm:px-6 py-4 sm:py-5 align-top whitespace-pre-wrap leading-relaxed text-slate-300">{row.temuan}</td>
                      <td className="px-4 sm:px-6 py-4 sm:py-5 align-top whitespace-pre-wrap text-rose-300 font-bold leading-relaxed border-l border-red-950/40 bg-red-950/10">
                        {row.gap}
                      </td>
                      <td className="px-2 sm:px-5 py-4 sm:py-5 align-top text-center whitespace-nowrap sticky right-0 bg-[#0d0709] group-hover:bg-[#150a0d] border-l border-red-950/70 transition-colors">
                        <div className="flex flex-col items-center justify-center space-y-2">
                            {linkedFile && <button onClick={() => { handlePreviewFile(linkedFile); playKatanaSlash(); }} className="text-slate-400 hover:text-emerald-400 p-1.5 rounded-xl hover:bg-emerald-950/50 transition-colors" title="Buka Jurnal"><Eye size={16} className="sm:w-[18px] sm:h-[18px]" /></button>}
                            <button onClick={() => { handleEditMatrixRow(row); playKatanaSlash(); }} className="text-slate-400 hover:text-red-400 p-1.5 rounded-xl hover:bg-red-950/50 transition-colors" title="Ubah Baris"><Edit size={16} className="sm:w-[18px] sm:h-[18px]" /></button>
                            <button onClick={() => { handleDeleteMatrixRow(row.id); playKatanaSlash(); }} className="text-slate-400 hover:text-rose-500 p-1.5 rounded-xl hover:bg-rose-950/50 transition-colors" title="Hapus Baris"><Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" /></button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCanvas = () => {
    const validNodes = Array.isArray(canvasNodes) ? canvasNodes : [];
    const validEdges = Array.isArray(canvasEdges) ? canvasEdges : [];
    const activeNodeData = validNodes.find(n => n.id === selectedCanvasNode);
    const getNodeStyle = (type) => {
      switch(type) {
        case 'Independen (X)': return 'bg-[#18070a] border-red-600 text-red-100 shadow-[0_0_15px_rgba(220,38,38,0.4)]';
        case 'Dependen (Y)': return 'bg-[#06180e] border-emerald-600 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.4)]';
        case 'Moderasi (Z)': return 'bg-[#181005] border-amber-600 text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.4)]';
        case 'Mediasi (M)': return 'bg-[#061619] border-cyan-600 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.4)]';
        default: return 'bg-[#120709] border-red-950 text-slate-200';
      }
    };

    return (
      <div className="h-full flex flex-col animate-in fade-in duration-300 relative">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 shrink-0 border-b border-red-950/80 pb-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-rose-300 to-red-500 flex items-center gap-3 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">
              <Share2 className="text-red-500 w-7 h-7 sm:w-8 sm:h-8" /> 冥府の曼荼羅 // Mandala Hubungan Variabel
            </h2>
            <p className="text-xs sm:text-sm text-red-300/70 font-mincho mt-1 tracking-wider">
              いま 描く 一歩が、まだ見ぬ 未来の 地図に なる • Hubungkan benang merah takdir antar variabel penelitianmu <span className="lg:hidden text-red-400 font-bold">(Ketuk 2x untuk detail).</span>
            </p>
          </div>
          <button 
            onClick={() => { addCanvasNode(); playKatanaSlash(); }} 
            className="flex justify-center items-center w-full sm:w-auto btn-katana text-white px-6 py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black font-cinzel tracking-wider shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all"
          >
            <Plus size={18} className="mr-2" /> TEMPA VARIABEL BARU
          </button>
        </div>

        <div className="flex-1 flex gap-6 overflow-hidden relative">
          <div 
            className="flex-1 bg-[#070304] rounded-3xl sm:rounded-[2.5rem] border border-red-950/80 overflow-auto relative custom-scrollbar touch-pan-x touch-pan-y shadow-[inset_0_0_50px_rgba(0,0,0,0.9)]" 
            ref={canvasContainerRef} 
            onMouseMove={handleCanvasMouseMove} 
            onTouchMove={handleCanvasTouchMove}
            style={{ backgroundImage: 'radial-gradient(rgba(220,38,38,0.18) 1.5px, transparent 1.5px)', backgroundSize: '36px 36px' }}
          >
            <div className="w-[1500px] h-[1500px] sm:w-[3000px] sm:h-[3000px] relative">
              <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                {validEdges.map(edge => {
                  const source = validNodes.find(n => n.id === edge.source); const target = validNodes.find(n => n.id === edge.target);
                  if (!source || !target) return null;
                  const xOffset = window.innerWidth < 640 ? 72 : 112;
                  const yOffset = window.innerWidth < 640 ? 28 : 40;
                  const x1 = source.x + xOffset; const y1 = source.y + yOffset; const x2 = target.x + xOffset; const y2 = target.y + yOffset;
                  return (
                    <g key={edge.id}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#dc2626" strokeWidth={window.innerWidth < 640 ? "2" : "3"} strokeDasharray="6 6" />
                      <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r={window.innerWidth < 640 ? "10" : "12"} fill="#7f1d1d" stroke="#ef4444" strokeWidth="1.5" className="pointer-events-auto cursor-pointer hover:fill-red-600 transition-colors shadow-sm" onClick={() => { deleteEdge(edge.id); playKatanaSlash(); }} />
                      <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 5} fill="white" fontSize={window.innerWidth < 640 ? "12" : "14"} textAnchor="middle" className="pointer-events-none font-black font-cinzel">×</text>
                    </g>
                  );
                })}
              </svg>
              {validNodes.map(node => {
                const linkedCount = (node.linkedFiles || []).length;
                const isDraggingThisNode = dragInfo && dragInfo.id === node.id;
                
                return (
                  <div 
                    key={node.id} 
                    style={{ transform: `translate(${node.x}px, ${node.y}px)` }} 
                    className={`absolute w-36 sm:w-56 border-2 rounded-2xl p-3 sm:p-4 shadow-xl cursor-grab active:cursor-grabbing z-10 ${isDraggingThisNode ? '' : 'transition-all duration-300'} ${getNodeStyle(node.type)} ${selectedCanvasNode === node.id ? 'ring-4 ring-red-500 ring-offset-2 ring-offset-black scale-105 shadow-[0_0_25px_rgba(239,68,68,0.7)]' : ''}`} 
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)} 
                    onTouchStart={(e) => handleNodeTouchStart(e, node.id)}
                    onClick={(e) => { 
                       e.stopPropagation();
                       if (isDraggingRef.current) return; 
                       if (connectingNodeId) { 
                           handleConnectNode(node.id); 
                           playKatanaSlash();
                           return;
                       } 
                       
                       const now = Date.now();
                       const isDouble = (now - lastClickRef.current.time < 300) && (lastClickRef.current.id === node.id);
                       lastClickRef.current = { time: now, id: node.id };

                       setSelectedCanvasNode(node.id);
                       playCursedWhisper();

                       if (window.innerWidth >= 1024) {
                           setIsCanvasDetailCollapsed(false);
                       } else {
                           if (isDouble) {
                               setIsCanvasDetailCollapsed(false); 
                           } else {
                               setIsCanvasDetailCollapsed(true); 
                           }
                       }
                    }}
                  >
                    {linkedCount > 0 && (
                      <div className="absolute -top-2.5 -right-2.5 bg-red-600 text-white text-[9px] font-black font-cinzel px-2 py-0.5 rounded-full shadow-[0_0_8px_rgba(220,38,38,0.8)] border border-red-300 flex items-center">
                        <FileText size={9} className="mr-1"/> {linkedCount}
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[9px] sm:text-[10px] font-black font-cinzel uppercase tracking-wider opacity-90 border-b border-current pb-0.5">{node.type}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleConnectNode(node.id); playKatanaSlash(); }} 
                        className="p-1 rounded-lg bg-black/60 hover:bg-red-950 text-red-300 border border-red-900/60 shadow-sm transition-colors"
                        title="Tautkan Benang Merah ke Variabel Lain"
                      >
                        <GitMerge size={12} className="sm:w-3.5 sm:h-3.5" />
                      </button>
                    </div>
                    <h3 className="font-black font-cinzel text-xs sm:text-sm leading-snug text-slate-100">{node.title || 'Variabel Baru'}</h3>
                  </div>
                );
              })}
            </div>
          </div>
          
          {selectedCanvasNode && !isCanvasDetailCollapsed && (
             <div className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsCanvasDetailCollapsed(true)}></div>
          )}

          <div className={`
             absolute inset-y-0 right-0 z-50 h-full lg:relative lg:h-auto lg:z-auto
             panel-samurai bg-[#0f0709]/95 lg:bg-[#0f0709]/85 backdrop-blur-2xl 
             rounded-l-[2rem] lg:rounded-[2.5rem] 
             shadow-[0_20px_50px_rgba(0,0,0,0.95)] border border-red-950/90 
             overflow-hidden flex flex-col shrink-0 transition-all duration-300 ease-in-out 
             ${!selectedCanvasNode 
                 ? 'w-0 opacity-0 translate-x-full pointer-events-none border-none lg:ml-[-1.5rem]' 
                 : isCanvasDetailCollapsed 
                     ? 'w-0 lg:w-16 opacity-0 lg:opacity-100 translate-x-full lg:translate-x-0' 
                     : 'w-[85vw] sm:w-[22rem] lg:w-[26rem] opacity-100 translate-x-0'}
          `}>
             <div className={`border-b border-red-950/80 py-4 sm:py-5 flex items-center shrink-0 bg-black/40 ${isCanvasDetailCollapsed ? 'flex-col justify-center px-2 gap-4' : 'justify-between px-4 sm:px-6'}`}>
                {isCanvasDetailCollapsed ? (
                    <button onClick={() => setIsCanvasDetailCollapsed(false)} className="p-2 text-red-400 hover:text-white bg-black/60 rounded-xl border border-red-950 shadow-sm transition-colors hidden lg:block" title="Perbesar Panel"><ChevronLeft size={20} /></button>
                ) : (
                    <>
                        <h3 className="font-black font-cinzel text-red-200 text-base sm:text-lg flex items-center">
                            <button onClick={() => setIsCanvasDetailCollapsed(true)} className="mr-2 sm:mr-3 p-1.5 text-red-400 hover:text-white bg-black/60 border border-red-950 rounded-lg transition-colors hidden lg:block" title="Perkecil Panel"><ChevronRight size={16} /></button>
                            <button onClick={() => setIsCanvasDetailCollapsed(true)} className="mr-2 p-1.5 text-red-400 hover:text-white bg-black/60 border border-red-950 rounded-lg transition-colors lg:hidden" title="Tutup Panel"><ChevronRight size={16} /></button>
                            SEKAT VARIABEL // 詳細
                        </h3>
                        <button onClick={() => { deleteSelectedNode(); playKatanaSlash(); }} disabled={!selectedCanvasNode} className="text-slate-400 hover:text-red-500 p-2 rounded-xl hover:bg-red-950/50 transition-colors" title="Musnahkan Variabel"><Trash2 size={16} className="sm:w-5 sm:h-5" /></button>
                    </>
                )}
             </div>
             {!isCanvasDetailCollapsed && activeNodeData && (
                <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4 sm:space-y-5 text-sm custom-scrollbar">
                   <div>
                     <label className="block font-black font-cinzel text-red-300/80 mb-2 text-xs sm:text-sm">Nama Variabel</label>
                     <input type="text" value={activeNodeData.title || ''} onChange={(e) => updateSelectedNode('title', e.target.value)} className="w-full px-4 py-3 rounded-xl sm:rounded-2xl input-samurai font-medium text-slate-100 text-sm" />
                   </div>
                   <div>
                     <label className="block font-black font-cinzel text-red-300/80 mb-2 text-xs sm:text-sm">Jenis Peran Variabel</label>
                     <select value={activeNodeData.type} onChange={(e) => updateSelectedNode('type', e.target.value)} className="w-full px-4 py-3 rounded-xl sm:rounded-2xl input-samurai font-medium text-slate-100 text-sm">
                        <option value="Independen (X)" className="bg-[#120709]">Independen (X) - Pengaruh Bebas</option>
                        <option value="Dependen (Y)" className="bg-[#120709]">Dependen (Y) - Dampak Terikat</option>
                        <option value="Moderasi (Z)" className="bg-[#120709]">Moderasi (Z) - Penguat/Pelemah</option>
                        <option value="Mediasi (M)" className="bg-[#120709]">Mediasi (M) - Jalur Perantara</option>
                     </select>
                   </div>
                   <div>
                     <label className="block font-black font-cinzel text-red-300/80 mb-2 text-xs sm:text-sm">Teori & Definisi Operasional</label>
                     <textarea value={activeNodeData.definition || ''} onChange={(e) => updateSelectedNode('definition', e.target.value)} rows={4} className="w-full px-4 py-3 rounded-xl sm:rounded-2xl input-samurai font-medium text-slate-100 resize-y leading-relaxed text-xs sm:text-sm" placeholder="Definisi menurut para ahli..." />
                   </div>
                   
                   <div className="pt-4 border-t border-red-950/80">
                     <label className="block font-black font-cinzel text-red-300/80 mb-2 text-xs sm:text-sm">Kitab Jurnal Pendukung</label>
                     
                     {(activeNodeData.linkedFiles || []).length > 0 && (
                       <div className="mb-3 space-y-2">
                         {(activeNodeData.linkedFiles || []).map(fileId => {
                           const linkedFile = (Array.isArray(filesData) ? filesData : []).find(f => f.id === fileId);
                           if (!linkedFile) return null;
                           return (
                             <div key={fileId} className="flex items-center justify-between bg-black/60 border border-red-950 rounded-xl p-2.5 text-xs text-slate-200">
                               <div className="flex items-center flex-1 overflow-hidden mr-2">
                                 <FileText size={14} className="shrink-0 mr-2 text-red-500"/>
                                 <span className="truncate font-bold" title={linkedFile.name}>{linkedFile.name}</span>
                               </div>
                               <div className="flex items-center space-x-1 shrink-0">
                                 <button onClick={() => { handlePreviewFile(linkedFile); playKatanaSlash(); }} className="text-slate-400 hover:text-red-400 p-1 rounded-lg" title="Pratinjau"><Eye size={14}/></button>
                                 <button onClick={() => updateSelectedNode('linkedFiles', activeNodeData.linkedFiles.filter(id => id !== fileId))} className="text-slate-400 hover:text-rose-500 p-1 rounded-lg" title="Lepas Tautan"><X size={14}/></button>
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     )}

                     <div className="flex gap-2 mb-3 w-full">
                        <select 
                           className="flex-1 min-w-0 truncate px-4 py-3 rounded-xl input-samurai font-medium text-slate-100 text-xs sm:text-sm"
                           onChange={(e) => {
                             if(!e.target.value) return;
                             const currentLinks = activeNodeData.linkedFiles || [];
                             if(!currentLinks.includes(e.target.value)) {
                               updateSelectedNode('linkedFiles', [...currentLinks, e.target.value]);
                               playKatanaSlash();
                             }
                             e.target.value = ''; 
                           }}
                         >
                           <option value="" className="bg-[#120709]">+ Tautkan Kitab Jurnal</option>
                           {(Array.isArray(filesData) ? filesData : []).map(f => (
                             <option key={f.id} value={f.id} disabled={(activeNodeData.linkedFiles || []).includes(f.id)} className="bg-[#120709]">
                               {f.name}
                             </option>
                           ))}
                         </select>

                         <div className="relative shrink-0">
                           <input type="file" accept=".pdf, .txt, .csv, .docx" multiple onChange={(e) => { handleCanvasFileUpload(e); playKatanaSlash(); }} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed" title="Upload beberapa PDF sekaligus ke Variabel ini"/>
                           <button className="btn-katana text-white px-3.5 py-3 rounded-xl font-bold flex items-center justify-center h-full shadow-md" title="Upload Dokumen Baru">
                              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                           </button>
                         </div>
                     </div>
                     
                     <textarea value={activeNodeData.journals || ''} onChange={(e) => updateSelectedNode('journals', e.target.value)} placeholder="Atau ketik catatan referensi manual di sini..." rows={3} className="w-full px-4 py-3 rounded-xl input-samurai font-medium text-slate-100 resize-y leading-relaxed text-xs sm:text-sm" />
                   </div>
                </div>
             )}
             {isCanvasDetailCollapsed && activeNodeData && (
                <div className="flex-1 flex flex-col items-center py-6 bg-transparent hidden lg:flex">
                    <span className="[writing-mode:vertical-lr] transform rotate-180 font-black font-cinzel text-red-500/60 tracking-[0.3em] uppercase text-sm mt-4">DETAIL VARIABEL</span>
                </div>
             )}
          </div>
        </div>
      </div>
    );
  };

  const renderKuesioner = () => {
    const validNodes = Array.isArray(canvasNodes) ? canvasNodes : [];
    const validKuesioner = Array.isArray(kuesionerData) ? kuesionerData : [];
    const activeIndicator = validKuesioner.find(ind => ind.id === activeIndicatorId);
    
    return (
      <div className="h-full flex flex-col animate-in fade-in duration-300 relative pb-2">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6 shrink-0 border-b border-red-950/80 pb-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-rose-300 to-red-500 flex items-center gap-3 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">
              <ListChecks className="text-red-500 w-7 h-7 sm:w-8 sm:h-8" /> 誓約の問診 // Kuesioner Sumpah Responden
            </h2>
            <p className="text-xs sm:text-sm text-red-300/70 font-mincho mt-1 tracking-wider">
              Petakan variabel menjadi indikator empiris, lalu bangkitkan butir pertanyaan kuesioner dengan mantra AI.
            </p>
          </div>
          <button 
            onClick={() => { copyKuesionerToClipboard(); playCursedWhisper(); }} 
            className="btn-katana-ghost px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black font-cinzel tracking-wider shadow-md flex items-center transition-all whitespace-nowrap"
          >
            <Copy size={16} className="mr-2" /> SALIN SELURUH BUTIR
          </button>
        </div>

        {validNodes.length === 0 ? (
           <div className="flex-1 panel-samurai rounded-3xl sm:rounded-[2.5rem] border border-red-950/80 flex flex-col items-center justify-center p-12 text-center bg-[#0d0709]/80 shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
             <Target size={54} className="sm:w-16 sm:h-16 text-red-700/60 mb-4 animate-pulse" />
             <h3 className="text-lg sm:text-xl font-black font-cinzel text-red-200 mb-2">VARIABEL BELUM DITEMPA // 空</h3>
             <p className="text-xs sm:text-sm text-red-400/60 font-mincho max-w-md">Buka menu <b>冥府の曼荼羅 (Canvas Variabel)</b> terlebih dahulu untuk merancang variabel sebelum diturunkan menjadi instrumen kuesioner.</p>
           </div>
        ) : (
          <div className="flex-1 flex flex-row panel-samurai rounded-3xl sm:rounded-[2.5rem] border border-red-950/90 overflow-hidden min-h-0 relative shadow-[0_20px_50px_rgba(0,0,0,0.95)]">
            
            {/* Sidebar Indikator */}
            <div className={`w-full lg:w-80 xl:w-96 bg-[#0a0507] lg:border-r border-red-950/80 flex-col shrink-0 h-full ${activeIndicatorId ? 'hidden lg:flex' : 'flex'}`}>
              <div className="p-4 sm:p-5 border-b border-red-950/80 bg-black/40 shrink-0">
                <h3 className="font-black font-cinzel text-red-300 flex items-center text-sm sm:text-base tracking-wider">
                  <Share2 size={16} className="mr-2 text-red-500"/> DAFTAR INDIKATOR // 尺度
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
                {validNodes.map(node => (
                  <div key={node.id} className="bg-[#120709] border border-red-950/80 rounded-2xl p-3 sm:p-4 shadow-md">
                    <div className="flex items-start justify-between mb-2.5 border-b border-red-950/60 pb-2">
                       <h4 className="font-bold font-cinzel text-slate-100 text-xs sm:text-sm leading-tight flex-1">
                         {node.title} 
                         <span className="block text-[9px] text-red-400/80 font-black uppercase tracking-wider mt-0.5">{node.type}</span>
                       </h4>
                    </div>
                    <div className="space-y-2">
                      {validKuesioner.filter(ind => ind.varId === node.id).map((ind, iIdx) => (
                         <button 
                            key={ind.id} 
                            onClick={() => { setActiveIndicatorId(ind.id); playKatanaSlash(); }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center group ${activeIndicatorId === ind.id ? 'bg-red-950/90 border border-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.4)]' : 'hover:bg-red-950/30 text-slate-300 border border-transparent'}`}
                         >
                            <span className="w-5 h-5 rounded-md bg-black/70 border border-red-800 text-red-400 flex items-center justify-center mr-2 shrink-0 text-[10px] font-mono font-bold">
                              {iIdx + 1}
                            </span>
                            <span className="truncate flex-1 font-medium">{ind.name}</span>
                         </button>
                      ))}
                      <button 
                        onClick={() => { addIndicator(node.id); playKatanaSlash(); }} 
                        className="w-full border border-dashed border-red-900/60 hover:border-red-500 text-red-400 hover:text-white bg-transparent hover:bg-red-950/40 px-3 py-2 rounded-xl text-[10px] sm:text-xs font-black font-cinzel tracking-wider transition-all flex items-center justify-center mt-2"
                      >
                        <Plus size={14} className="mr-1" /> + TAMBAH INDIKATOR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Area Editor Indikator & Pertanyaan */}
            <div className={`w-full lg:flex-1 flex-col min-w-0 bg-[#0d0709] relative h-full ${!activeIndicatorId ? 'hidden lg:flex' : 'flex'}`}>
              {activeIndicator ? (
                <>
                  <div className="lg:hidden px-4 py-3 border-b border-red-950/80 bg-black/50 flex items-center shrink-0">
                     <button onClick={() => setActiveIndicatorId(null)} className="flex items-center text-red-400 hover:text-white font-black font-cinzel text-xs py-1">
                        <ArrowLeft size={16} className="mr-1.5"/> KEMBALI KE DAFTAR
                     </button>
                  </div>

                  <div className="px-5 sm:px-8 py-4 sm:py-5 border-b border-red-950/80 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-black/40 shrink-0 z-10 gap-3 sm:gap-4">
                    <div className="flex-1 w-full sm:w-auto">
                      <p className="text-[10px] font-black font-cinzel text-red-400/80 uppercase tracking-widest mb-1">NAMA INDIKATOR // 尺度名</p>
                      <input 
                        type="text" 
                        value={activeIndicator.name || ''} 
                        onChange={(e) => updateIndicatorName(activeIndicator.id, e.target.value)}
                        className="w-full text-base sm:text-xl font-black font-cinzel text-white bg-transparent border-none focus:outline-none focus:ring-0 p-0 placeholder-red-900/50"
                        placeholder="Ketik nama indikator penelitian..."
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <button 
                        onClick={() => { handleGenerateQuestionsAI(activeIndicator); playCursedWhisper(); }} 
                        disabled={isGeneratingQuestions} 
                        className="flex-1 sm:flex-none justify-center btn-katana text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black font-cinzel tracking-wider transition-all flex items-center disabled:opacity-50 whitespace-nowrap shadow-md"
                      >
                        {isGeneratingQuestions ? <Loader2 size={14} className="animate-spin mr-2"/> : <Sparkles size={14} className="mr-2"/>} 
                        {isGeneratingQuestions ? 'Menebas Soal...' : '✨ MANTRA AI'}
                      </button>
                      <button 
                        onClick={() => { deleteIndicator(activeIndicator.id); playKatanaSlash(); }} 
                        className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-950/50 rounded-xl transition-all border border-red-950 shrink-0" 
                        title="Musnahkan Indikator"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#090405] custom-scrollbar">
                    {(!Array.isArray(activeIndicator.questions) || activeIndicator.questions.length === 0) ? (
                       <div className="h-full flex flex-col items-center justify-center text-center text-red-400/50 py-10">
                         <CheckSquare size={54} className="mb-4 text-red-700/60 opacity-40 animate-pulse" />
                         <p className="text-base sm:text-lg font-black font-cinzel text-red-200 mb-1">BELUM ADA BUTIR PERTANYAAN</p>
                         <p className="text-xs sm:text-sm font-mincho text-red-400/60">Gunakan tombol <b>"✨ MANTRA AI"</b> di atas atau tambah butir manual.</p>
                         <button 
                           onClick={() => { addQuestion(activeIndicator.id); playKatanaSlash(); }} 
                           className="mt-6 btn-katana text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-black font-cinzel tracking-wider shadow-md flex items-center"
                         >
                           <Plus size={14} className="mr-2"/> TAMBAH BUTIR MANUAL
                         </button>
                       </div>
                    ) : (
                      <div className="space-y-3 sm:space-y-4 max-w-4xl mx-auto pb-6">
                        {activeIndicator.questions.map((q, idx) => (
                          <div key={q.id} className="bg-[#120709] border border-red-950/80 rounded-2xl p-4 shadow-md flex items-start gap-3 sm:gap-4 group hover:border-red-600/70 transition-all">
                             <div className="w-8 h-8 rounded-full bg-black/80 text-red-400 flex items-center justify-center font-black font-cinzel text-xs shrink-0 border border-red-900/80 mt-1 shadow-sm">
                               {idx + 1}
                             </div>
                             <div className="flex-1 min-w-0">
                               <textarea 
                                 value={q.text || ''}
                                 onChange={(e) => updateQuestion(activeIndicator.id, q.id, e.target.value)}
                                 placeholder="Ketik pernyataan angket / kuesioner..."
                                 className="w-full text-xs sm:text-sm font-medium text-slate-100 bg-transparent border-none focus:outline-none focus:ring-0 p-0 resize-none custom-scrollbar leading-relaxed"
                                 rows={2}
                               />
                               <div className="mt-2 flex items-center text-[10px] font-bold text-red-400/70 font-cinzel">
                                 <span className="px-2 py-0.5 bg-black/60 rounded-md border border-red-950 uppercase tracking-wider">{q.type}</span>
                               </div>
                             </div>
                             <button 
                               onClick={() => { deleteQuestion(activeIndicator.id, q.id); playKatanaSlash(); }} 
                               className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-950/60 rounded-lg transition-all shrink-0"
                             >
                               <X size={16} />
                             </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => { addQuestion(activeIndicator.id); playKatanaSlash(); }} 
                          className="w-full border-2 border-dashed border-red-950/80 hover:border-red-500 text-red-400 hover:text-white bg-transparent hover:bg-red-950/30 px-4 py-3.5 rounded-2xl text-xs sm:text-sm font-black font-cinzel tracking-wider transition-all flex items-center justify-center"
                        >
                          <Plus size={16} className="mr-2" /> + TOREH BUTIR PERTANYAAN BARU
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-red-400/50 p-10 text-center">
                  <ListChecks size={54} className="mb-4 opacity-40 text-red-700/60" />
                  <h3 className="text-lg sm:text-xl font-black font-cinzel text-red-200 mb-2">PILIH SALAH SATU INDIKATOR</h3>
                  <p className="text-xs sm:text-sm font-mincho text-red-400/60">Klik indikator di sisi kiri untuk menyusun butir angket penelitianmu.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSidang = () => (
    <div className="h-full flex flex-col animate-in slide-in-from-bottom-4 duration-500 pb-0 gap-4 sm:gap-6">
      
      {/* ARENA HEADER: THE BOSS ENCOUNTER */}
      <div className="panel-samurai p-5 sm:p-6 rounded-3xl border border-red-900/80 shadow-[0_20px_50px_rgba(0,0,0,0.95)] flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative overflow-hidden">
        {/* Background Blood Moon flare */}
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-red-900/30 via-red-950/10 to-transparent pointer-events-none -z-10" />

        <div className="flex items-center space-x-4 z-10">
          <div className="relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-red-600 shadow-[0_0_25px_rgba(239,68,68,0.7)] group">
            <img src={cursedBossImg} alt="Dosen Penguji" className="w-full h-full object-cover filter contrast-125 brightness-90 group-hover:scale-110 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-black font-cinzel text-red-400 bg-black/80 px-1.5 py-0.5 rounded tracking-widest uppercase">BOSS</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black font-cinzel bg-red-950 border border-red-600 text-red-300 shadow-[0_0_8px_rgba(220,38,38,0.5)]">
                FINAL TRIAL // 最終決戦
              </span>
              <span className="text-[10px] text-red-400/80 font-mono font-bold animate-pulse flex items-center">
                <Flame size={12} className="mr-1 text-red-500" /> BOSS RAGE: 92% (EXTREME)
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-red-100 via-rose-200 to-red-400 mt-0.5 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]">
              SENSEI PENGUJI // THE CURSED INQUISITOR
            </h2>
            <p className="text-xs sm:text-sm text-red-300/80 font-mincho mt-0.5">
              "Keluarkan argumen terkuatmu, atau naskah ini akan dipenggal revisi total."
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 z-10 w-full lg:w-auto">
          <button 
            onClick={() => { handleGeneratePredictions(); playDarkGong(); }} 
            disabled={isPredicting} 
            className="w-full lg:w-auto justify-center btn-katana text-white px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-black font-cinzel tracking-wider shadow-[0_0_25px_rgba(220,38,38,0.5)] flex items-center transition-all hover:scale-105"
          >
            {isPredicting ? <Loader2 size={16} className="sm:w-[18px] sm:h-[18px] animate-spin mr-2 text-red-300" /> : <Sparkles size={16} className="sm:w-[18px] sm:h-[18px] mr-2 text-rose-300" />} 
            RAMALAN 5 SERANGAN DOSEN
          </button>
        </div>
      </div>

      {/* TWO BATTLE STANCES */}
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 flex-1 min-h-0">
        
        {/* LEFT: PANIC SEARCH PARRY */}
        <div className="flex-1 panel-samurai rounded-3xl sm:rounded-[2.5rem] border border-red-900/80 shadow-[0_20px_50px_rgba(0,0,0,0.9)] p-5 sm:p-7 flex flex-col">
           <div className="flex items-center justify-between mb-2">
             <h3 className="text-lg sm:text-xl font-black font-cinzel text-red-200 flex items-center drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">
               <Swords className="mr-2 sm:mr-3 text-red-500 w-5 h-5 sm:w-6 sm:h-6" /> TANGKISAN KILAT // PANIC PARRY
             </h3>
             <span className="text-[10px] font-black font-cinzel text-red-400 bg-black/60 border border-red-950 px-2 py-0.5 rounded">瞬速反論</span>
           </div>
           <p className="text-xs sm:text-sm text-red-300/70 mb-4 sm:mb-5 font-mincho">
             Ketik kata kunci serangan penguji. Shinigami AI akan mencari tangkisan argumen dari Bab 1-5 dan Kitab Jurnalmu.
           </p>
           
           <form onSubmit={(e) => { handlePanicSearch(e); playKatanaSlash(); }} className="flex gap-2 sm:gap-3 mb-4 sm:mb-5">
             <input 
               type="text" 
               value={panicQuery} 
               onChange={(e) => setPanicQuery(e.target.value)} 
               placeholder="Misal: Kenapa sampel cuma 30? / Mana uji validitasnya?" 
               className="flex-1 px-4 sm:px-5 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl input-samurai font-medium text-slate-100 placeholder-red-900/60 shadow-inner text-xs sm:text-sm" 
             />
             <button 
               type="submit" 
               disabled={isPanicSearching || !panicQuery.trim()} 
               className="btn-katana text-white px-5 sm:px-7 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-black font-cinzel disabled:opacity-40 shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all flex items-center justify-center"
               title="Tebas Tangkisan Sekarang"
             >
               <Zap size={20} className="sm:w-6 sm:h-6" />
             </button>
           </form>

           {isPanicSearching ? (
             <div className="flex-1 flex flex-col items-center justify-center text-red-500 animate-pulse py-8">
               <Loader2 size={36} className="sm:w-12 sm:h-12 animate-spin mb-3 text-red-500" />
               <p className="font-black font-cinzel text-xs sm:text-sm tracking-wider">MEMBEDAH DOKUMEN & MENCARI TANGKISAN MUTLAK...</p>
             </div>
           ) : panicAnswer ? (
             <div className="flex-1 bg-[#090405] rounded-2xl p-5 sm:p-6 border border-red-950/80 overflow-y-auto text-xs sm:text-[14px] leading-relaxed sm:leading-loose font-medium text-slate-200 custom-scrollbar shadow-inner">
               <div className="flex items-center justify-between mb-3 pb-2 border-b border-red-950/80 text-[11px] font-black font-cinzel text-red-400">
                 <span className="flex items-center"><Sword size={12} className="mr-1.5 text-red-500"/> POIN PERTAHANAN RESMI:</span>
                 <span className="text-emerald-400">SIAP DIUCAPKAN</span>
               </div>
               <div dangerouslySetInnerHTML={{__html: renderSafeHtmlString(panicAnswer)}} />
             </div>
           ) : (
             <div className="flex-1 flex flex-col items-center justify-center text-red-400/40 py-8 bg-[#090405]/60 rounded-2xl border border-dashed border-red-950/80">
               <ShieldCheck size={48} className="sm:w-16 sm:h-16 mb-3 opacity-30 text-red-700 animate-pulse" />
               <p className="font-black font-cinzel text-sm sm:text-base text-red-300">POSISI BERTAHAN SIAP // 構え</p>
               <p className="text-xs text-red-400/60 font-mincho mt-1">Masukkan pertanyaan dosen di atas untuk mengaktifkan tangkisan instan.</p>
             </div>
           )}
        </div>

        {/* RIGHT: TELEPROMPTER ARWAH */}
        <div className="flex-1 panel-samurai bg-[#0a0507]/95 rounded-3xl sm:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.95)] p-5 sm:p-7 flex flex-col relative overflow-hidden border border-red-900/80">
           <div className="flex justify-between items-center mb-4 relative z-10">
             <h3 className="text-lg sm:text-xl font-black font-cinzel text-white flex items-center drop-shadow-[0_0_10px_rgba(239,68,68,0.6)]">
               <Mic className="mr-2 sm:mr-3 text-red-500 w-5 h-5 sm:w-6 sm:h-6" /> TELEPROMPTER ARWAH // 霊眼
             </h3>
             <button 
               onClick={() => { toggleListening(); playCursedWhisper(); }} 
               className={`px-4 sm:px-5 py-2 rounded-full text-[9px] sm:text-xs font-black font-cinzel tracking-wider flex items-center transition-all shadow-md ${isListening ? 'bg-red-600 text-white animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.8)]' : 'bg-black/60 text-red-300 hover:bg-red-950/80 border border-red-900/60'}`}
             >
                {isListening ? <Square size={12} className="mr-1.5 fill-current" /> : <Play size={12} className="mr-1.5 fill-current" />} 
                {isListening ? 'STOP MIKROFON' : 'AKTIFKAN MIKROFON'}
             </button>
           </div>
           
           <div className="bg-[#050203] rounded-2xl p-3.5 sm:p-4 mb-3 sm:mb-4 border border-red-950/90 relative z-10 shadow-inner">
             <p className="text-[10px] font-black font-cinzel text-red-400/80 mb-1 uppercase tracking-widest flex items-center">
               <ScanSearch size={11} className="mr-1.5 text-red-500"/> SUARA PENGUJI // 審判の言霊:
             </p>
             <textarea 
               value={transcript} 
               onChange={(e) => setTranscript(e.target.value)} 
               placeholder="Tunggu dosen berbicara, atau ketik langsung di sini..." 
               className="w-full bg-transparent text-slate-100 text-xs sm:text-sm font-medium focus:outline-none resize-none h-14 sm:h-16 custom-scrollbar placeholder-red-900/40" 
             />
           </div>

           <button 
             onClick={() => { handleLiveTeleprompter(); playKatanaSlash(); }} 
             disabled={isTeleprompterThinking || !transcript.trim()} 
             className="w-full btn-katana text-white py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-black font-cinzel tracking-wider mb-3 sm:mb-4 flex items-center justify-center disabled:opacity-40 relative z-10 shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all text-xs sm:text-sm"
           >
             {isTeleprompterThinking ? <Loader2 size={16} className="animate-spin mr-2" /> : <Sparkles size={16} className="mr-2" />} 
             {isTeleprompterThinking ? 'MENYUSUN BISIKAN ARWAH...' : 'BUATKAN JAWABAN CEPAT!'}
           </button>

           <div className="flex-1 bg-black/80 rounded-2xl p-4 sm:p-6 border border-red-950 overflow-y-auto relative z-10 custom-scrollbar shadow-inner">
             {teleprompterAnswer ? (
                <div 
                  className="text-emerald-300 text-base sm:text-xl font-bold font-mincho leading-[1.8] sm:leading-[1.9] selection:bg-emerald-900 selection:text-white drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" 
                  dangerouslySetInnerHTML={{__html: renderSafeHtmlString(teleprompterAnswer)}} 
                />
             ) : (
                <div className="h-full flex flex-col items-center justify-center text-red-400/40 text-center py-6">
                  <p className="text-xs sm:text-sm font-mincho">Jawaban AI akan muncul di sini dengan teks besar dan kontras tinggi untuk dibaca langsung di depan penguji.</p>
                </div>
             )}
           </div>
        </div>
      </div>

      {/* PREDICTION MODAL (GULUNGAN KUTUKAN 5 SOAL) */}
      {showPredictionModal && (
        <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="panel-samurai bg-[#0f0709] rounded-3xl sm:rounded-[2.5rem] shadow-[0_0_60px_rgba(220,38,38,0.7)] w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 border-2 border-red-700/80">
            <div className="bg-black/80 px-6 sm:px-8 py-4 sm:py-5 flex justify-between items-center shrink-0 border-b border-red-950">
               <h3 className="font-black font-cinzel text-red-200 text-base sm:text-xl flex items-center tracking-wider">
                 <Sparkles size={20} className="mr-2.5 text-rose-400" /> RAMALAN 5 SERANGAN PENGUJI // 呪文の予知
               </h3>
               <button onClick={() => setShowPredictionModal(false)} className="text-slate-400 hover:text-white bg-red-950/80 hover:bg-red-800 p-2 rounded-full transition-colors border border-red-900">
                 <X size={16} />
               </button>
            </div>
            <div className="p-6 sm:p-8 flex-1 overflow-y-auto bg-[#0a0507] custom-scrollbar">
              {isPredicting ? (
                 <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-red-500 animate-pulse space-y-4">
                   <Loader2 size={44} className="sm:w-16 sm:h-16 animate-spin text-red-500" />
                   <p className="font-black font-cinzel text-sm sm:text-lg tracking-wider text-red-300">MEMBACA CELAH SKRIPSIMU DI LEMBAR TAKDIR...</p>
                 </div>
              ) : (
                 <div className="text-slate-200 text-sm sm:text-base leading-relaxed sm:leading-loose font-medium selection:bg-red-900 selection:text-white" dangerouslySetInnerHTML={{__html: renderSafeHtmlString(predictedQuestions)}} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#070405] text-slate-100 overflow-hidden relative font-outfit selection:bg-red-900 selection:text-white" style={{ fontFamily: "'Outfit', ui-sans-serif, system-ui, -apple-system, sans-serif", WebkitFontSmoothing: 'antialiased', textRendering: 'optimizeLegibility' }}>
      
      {/* SIDEBAR SAMURAI LAQUERED BLACK & BLOOD RED */}
      <aside className={`fixed inset-y-0 left-0 bg-[#0d0708] border-r border-red-950/90 z-50 transition-all duration-300 ease-in-out flex flex-col shadow-[10px_0_30px_rgba(0,0,0,0.8)] ${isSidebarCollapsed ? 'w-[5.5rem]' : 'w-[18rem]'} ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        
        {/* Header Sidebar Brand */}
        <div className={`p-5 flex items-center relative z-10 border-b border-red-950/60 ${isSidebarCollapsed ? 'justify-center flex-col gap-3 mt-1' : 'justify-between space-x-2'}`}>
          <div className="flex items-center space-x-3 overflow-hidden cursor-pointer" onClick={() => setIsSidebarCollapsed(false)}>
            <div className="relative shrink-0 w-11 h-11 rounded-xl bg-black border border-red-800/80 p-1 flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.4)]">
              <img src={logoImg} alt="SkripsiPro" className="w-full h-full object-contain filter drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col whitespace-nowrap">
                <span className="text-lg font-black tracking-wider leading-none font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-rose-300 to-red-500">
                  SKRIPSIPRO
                </span>
                <span className="block text-[9px] font-black text-red-400/80 tracking-widest mt-1 uppercase font-mincho">
                  修羅の論文 // SHINIGAMI QUEST
                </span>
              </div>
            )}
          </div>
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="hidden md:flex p-2 rounded-xl text-red-400/70 hover:bg-red-950/60 hover:text-red-300 transition-colors shrink-0">
            {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* Navigation Menus with Japanese Kanji Subtitles */}
        <nav className={`flex-1 space-y-1.5 mt-3 overflow-y-auto pb-6 relative z-10 custom-scrollbar ${isSidebarCollapsed ? 'px-2' : 'px-4'}`}>
          
          {/* 1. Dashboard */}
          <button 
            onClick={() => {setActiveTab('dashboard'); setIsMobileMenuOpen(false);}} 
            title="Dashboard" 
            className={`w-full flex items-center rounded-2xl transition-all duration-200 relative group ${isSidebarCollapsed ? 'justify-center py-3.5' : 'space-x-3 px-4 py-3'} ${activeTab === 'dashboard' ? 'bg-gradient-to-r from-red-950 via-[#250a0d] to-[#120507] border border-red-700/80 text-white font-bold shadow-[0_0_15px_rgba(220,38,38,0.35)]' : 'text-slate-400 hover:bg-red-950/30 hover:text-red-200 hover:border-red-900/40 font-medium'}`}
          >
            <LayoutDashboard size={18} className={`shrink-0 ${activeTab === 'dashboard' ? 'text-red-400' : 'group-hover:text-red-400'}`} /> 
            {!isSidebarCollapsed && (
              <div className="text-left flex-1 min-w-0">
                <span className="text-xs font-black block tracking-wide">Dashboard</span>
                <span className="text-[9px] text-red-400/70 block font-mincho">幕府 • Shogunate</span>
              </div>
            )}
          </button>
          
          {/* 2. Catatan Cepat */}
          <button 
            onClick={() => {setActiveTab('quicknotes'); setIsMobileMenuOpen(false);}} 
            title="Catatan Cepat" 
            className={`w-full flex items-center rounded-2xl transition-all duration-200 relative group ${isSidebarCollapsed ? 'justify-center py-3.5' : 'space-x-3 px-4 py-3'} ${activeTab === 'quicknotes' ? 'bg-gradient-to-r from-red-950 via-[#250a0d] to-[#120507] border border-red-700/80 text-white font-bold shadow-[0_0_15px_rgba(220,38,38,0.35)]' : 'text-slate-400 hover:bg-red-950/30 hover:text-red-200 hover:border-red-900/40 font-medium'}`}
          >
            <AlignLeft size={18} className={`shrink-0 ${activeTab === 'quicknotes' ? 'text-red-400' : 'group-hover:text-red-400'}`} /> 
            {!isSidebarCollapsed && (
              <div className="text-left flex-1 min-w-0">
                <span className="text-xs font-black block tracking-wide">Catatan Cepat</span>
                <span className="text-[9px] text-red-400/70 block font-mincho">墨筆 • Ink Notes</span>
              </div>
            )}
          </button>

          {/* 3. Note / Kotak Penting */}
          <button 
            onClick={() => {setActiveTab('memo'); setIsMobileMenuOpen(false);}} 
            title="Kotak Penting" 
            className={`w-full flex items-center rounded-2xl transition-all duration-200 relative group ${isSidebarCollapsed ? 'justify-center py-3.5' : 'space-x-3 px-4 py-3'} ${activeTab === 'memo' ? 'bg-gradient-to-r from-red-950 via-[#250a0d] to-[#120507] border border-red-700/80 text-white font-bold shadow-[0_0_15px_rgba(220,38,38,0.35)]' : 'text-slate-400 hover:bg-red-950/30 hover:text-red-200 hover:border-red-900/40 font-medium'}`}
          >
            <StickyNote size={18} className={`shrink-0 ${activeTab === 'memo' ? 'text-rose-400' : 'group-hover:text-rose-400'}`} />
            {!isSidebarCollapsed && (
              <div className="text-left flex-1 min-w-0">
                <span className="text-xs font-black block tracking-wide">Kotak Penting</span>
                <span className="text-[9px] text-rose-400/70 block font-mincho">符牒 • Talisman Memos</span>
              </div>
            )}
          </button>

          {/* 4. File & Bab */}
          <button 
            onClick={() => {setActiveTab('files'); setIsMobileMenuOpen(false); setActiveFolder(null);}} 
            title="File & Bab" 
            className={`w-full flex items-center rounded-2xl transition-all duration-200 relative group ${isSidebarCollapsed ? 'justify-center py-3.5' : 'space-x-3 px-4 py-3'} ${activeTab === 'files' ? 'bg-gradient-to-r from-red-950 via-[#250a0d] to-[#120507] border border-red-700/80 text-white font-bold shadow-[0_0_15px_rgba(220,38,38,0.35)]' : 'text-slate-400 hover:bg-red-950/30 hover:text-red-200 hover:border-red-900/40 font-medium'}`}
          >
            <FolderOpen size={18} className={`shrink-0 ${activeTab === 'files' ? 'text-red-400' : 'group-hover:text-red-400'}`} /> 
            {!isSidebarCollapsed && (
              <div className="text-left flex-1 min-w-0">
                <span className="text-xs font-black block tracking-wide">File & Bab</span>
                <span className="text-[9px] text-red-400/70 block font-mincho">経典 • Sacred Archives</span>
              </div>
            )}
          </button>
          
          {/* 5. Matriks Literatur */}
          <button 
            onClick={() => {setActiveTab('matrix'); setIsMobileMenuOpen(false);}} 
            title="Matriks Literatur" 
            className={`w-full flex items-center rounded-2xl transition-all duration-200 relative group ${isSidebarCollapsed ? 'justify-center py-3.5' : 'space-x-3 px-4 py-3'} ${activeTab === 'matrix' ? 'bg-gradient-to-r from-red-950 via-[#250a0d] to-[#120507] border border-red-700/80 text-white font-bold shadow-[0_0_15px_rgba(220,38,38,0.35)]' : 'text-slate-400 hover:bg-red-950/30 hover:text-red-200 hover:border-red-900/40 font-medium'}`}
          >
            <Table size={18} className={`shrink-0 ${activeTab === 'matrix' ? 'text-emerald-400' : 'group-hover:text-emerald-400'}`} /> 
            {!isSidebarCollapsed && (
              <div className="text-left flex-1 min-w-0">
                <span className="text-xs font-black block tracking-wide">Matriks Literatur</span>
                <span className="text-[9px] text-emerald-400/70 block font-mincho">曼荼羅 • Mandala Matrix</span>
              </div>
            )}
          </button>
          
          {/* 6. Canvas Variabel */}
          <button 
            onClick={() => {setActiveTab('canvas'); setIsMobileMenuOpen(false);}} 
            title="Canvas Variabel" 
            className={`w-full flex items-center rounded-2xl transition-all duration-200 relative group ${isSidebarCollapsed ? 'justify-center py-3.5' : 'space-x-3 px-4 py-3'} ${activeTab === 'canvas' ? 'bg-gradient-to-r from-red-950 via-[#250a0d] to-[#120507] border border-red-700/80 text-white font-bold shadow-[0_0_15px_rgba(220,38,38,0.35)]' : 'text-slate-400 hover:bg-red-950/30 hover:text-red-200 hover:border-red-900/40 font-medium'}`}
          >
            <Share2 size={18} className={`shrink-0 ${activeTab === 'canvas' ? 'text-cyan-400' : 'group-hover:text-cyan-400'}`} /> 
            {!isSidebarCollapsed && (
              <div className="text-left flex-1 min-w-0">
                <span className="text-xs font-black block tracking-wide">Canvas Variabel</span>
                <span className="text-[9px] text-cyan-400/70 block font-mincho">術式 • Causal Framework</span>
              </div>
            )}
          </button>

          {/* 7. Kuesioner */}
          <button 
            onClick={() => {setActiveTab('kuesioner'); setIsMobileMenuOpen(false);}} 
            title="Kuesioner" 
            className={`w-full flex items-center rounded-2xl transition-all duration-200 relative group ${isSidebarCollapsed ? 'justify-center py-3.5' : 'space-x-3 px-4 py-3'} ${activeTab === 'kuesioner' ? 'bg-gradient-to-r from-red-950 via-[#250a0d] to-[#120507] border border-red-700/80 text-white font-bold shadow-[0_0_15px_rgba(220,38,38,0.35)]' : 'text-slate-400 hover:bg-red-950/30 hover:text-red-200 hover:border-red-900/40 font-medium'}`}
          >
            <ListChecks size={18} className={`shrink-0 ${activeTab === 'kuesioner' ? 'text-amber-400' : 'group-hover:text-amber-400'}`} /> 
            {!isSidebarCollapsed && (
              <div className="text-left flex-1 min-w-0">
                <span className="text-xs font-black block tracking-wide">Kuesioner</span>
                <span className="text-[9px] text-amber-400/70 block font-mincho">尋問 • Inquisition</span>
              </div>
            )}
          </button>
          
          {/* 8. Lab Statistik Pro */}
          <button 
            onClick={() => { onNavigateLab(); setIsMobileMenuOpen(false); }} 
            title="Lab Statistik Pro" 
            className={`w-full flex items-center rounded-2xl transition-all duration-200 relative group text-slate-400 hover:bg-amber-950/30 hover:text-amber-200 border border-transparent hover:border-amber-900/50 font-medium ${isSidebarCollapsed ? 'justify-center py-3.5' : 'space-x-3 px-4 py-3'}`}
          >
            <Crown size={18} className="text-amber-400 shrink-0" /> 
            {!isSidebarCollapsed && (
              <div className="text-left flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black block tracking-wide text-amber-200">Lab Statistik</span>
                  <span className="text-[8px] bg-gradient-to-r from-amber-500 to-red-600 text-white px-1.5 py-0.2 rounded font-black uppercase">PRO</span>
                </div>
                <span className="text-[9px] text-amber-400/70 block font-mincho">禁忌の実験室 • Stats Lab</span>
              </div>
            )}
          </button>

          {/* 9. Lembar Skripsi */}
          <button 
            onClick={() => {setActiveTab('lembar'); setIsMobileMenuOpen(false);}} 
            title="Lembar Skripsi" 
            className={`w-full flex items-center rounded-2xl transition-all duration-200 relative group ${isSidebarCollapsed ? 'justify-center py-3.5' : 'space-x-3 px-4 py-3'} ${activeTab === 'lembar' ? 'bg-gradient-to-r from-red-950 via-[#250a0d] to-[#120507] border border-red-700/80 text-white font-bold shadow-[0_0_15px_rgba(220,38,38,0.35)]' : 'text-slate-400 hover:bg-red-950/30 hover:text-red-200 hover:border-red-900/40 font-medium'}`}
          >
            <FileText size={18} className={`shrink-0 ${activeTab === 'lembar' ? 'text-rose-400' : 'group-hover:text-rose-400'}`} /> 
            {!isSidebarCollapsed && (
              <div className="text-left flex-1 min-w-0">
                <span className="text-xs font-black block tracking-wide">Lembar Skripsi</span>
                <span className="text-[9px] text-rose-400/70 block font-mincho">血の巻物 • Blood Scroll</span>
              </div>
            )}
          </button>
          
          {/* 10. Presentasi Sidang */}
          <button 
            onClick={() => {setActiveTab('presentasi'); setIsMobileMenuOpen(false);}} 
            title="Presentasi Sidang" 
            className={`w-full flex items-center rounded-2xl transition-all duration-200 relative group ${isSidebarCollapsed ? 'justify-center py-3.5' : 'space-x-3 px-4 py-3'} ${activeTab === 'presentasi' ? 'bg-gradient-to-r from-red-950 via-[#250a0d] to-[#120507] border border-red-700/80 text-white font-bold shadow-[0_0_15px_rgba(220,38,38,0.35)]' : 'text-slate-400 hover:bg-red-950/30 hover:text-red-200 hover:border-red-900/40 font-medium'}`}
          >
            <Presentation size={18} className={`shrink-0 ${activeTab === 'presentasi' ? 'text-red-400' : 'group-hover:text-red-400'}`} />
            {!isSidebarCollapsed && (
              <div className="text-left flex-1 min-w-0">
                <span className="text-xs font-black block tracking-wide">Presentasi Sidang</span>
                <span className="text-[9px] text-red-400/70 block font-mincho">御前試合 • Imperial Duel</span>
              </div>
            )}
          </button>

          {/* 11. Mode Sidang (Special Blood Alert) */}
          <button 
            onClick={() => {setActiveTab('sidang'); setIsMobileMenuOpen(false);}} 
            title="Mode Sidang" 
            className={`w-full flex items-center rounded-2xl transition-all duration-200 relative group ${isSidebarCollapsed ? 'justify-center py-3.5' : 'space-x-3 px-4 py-3'} ${activeTab === 'sidang' ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)] border border-red-500 font-black' : 'text-rose-400 hover:bg-red-950/50 hover:text-white font-bold border border-red-950'}`}
          >
            <ShieldAlert size={18} className="shrink-0 text-red-300 animate-pulse" />
            {!isSidebarCollapsed && (
              <div className="text-left flex-1 min-w-0">
                <span className="text-xs font-black block tracking-wide">Mode Sidang</span>
                <span className="text-[9px] text-rose-300 block font-mincho">最終決戦 • Final Showdown</span>
              </div>
            )}
          </button>
        </nav>
        
        {/* Footer Sidebar (Donasi & WhatsApp) */}
        <div className={`relative z-10 transition-all border-t border-red-950/60 ${isSidebarCollapsed ? 'p-2 mb-2' : 'p-4'}`}>
           <button 
             onClick={() => setShowQrisModal(true)} 
             title="Traktir Developer" 
             className={`w-full btn-katana text-white rounded-xl shadow-md transition-all duration-300 flex items-center justify-center font-bold mb-2 ${isSidebarCollapsed ? 'p-2.5' : 'py-2.5 text-xs'}`}
           >
             <span className="text-base">☕</span> {!isSidebarCollapsed && <span className="ml-1.5 font-cinzel">Sake untuk Dev</span>}
           </button>
           <a 
             href="https://wa.me/6281353538346" 
             target="_blank" 
             rel="noopener noreferrer" 
             title="Bantuan WhatsApp" 
             className={`block rounded-xl border border-red-900/40 bg-red-950/30 hover:bg-red-950/60 hover:border-red-700/60 transition-all duration-300 shadow-sm ${isSidebarCollapsed ? 'p-2 flex justify-center' : 'p-2.5 hover:-translate-y-0.5'}`}
           >
             {isSidebarCollapsed ? (
               <span className="relative flex h-2.5 w-2.5">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
               </span>
             ) : (
               <div className="flex items-center justify-between">
                 <span className="text-[10px] text-red-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                   <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                   Bantuan WhatsApp
                 </span>
                 <ChevronRight size={12} className="text-red-400" />
               </div>
             )}
           </a>
        </div>
      </aside>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>}

      {/* MAIN VIEWPORT CONTAINER */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10 bg-gradient-to-b from-[#0c0607] via-[#070405] to-[#040203]">
        
        {/* Mobile Header Bar */}
        <header className="md:hidden bg-[#0d0708] border-b border-red-950/80 px-4 py-3 flex items-center justify-between shadow-lg gap-3">
          <div className="flex items-center space-x-2 text-red-400 min-w-0">
            <img src={logoImg} alt="SkripsiPro" className="w-7 h-7 object-contain shrink-0" />
            <span className="text-base font-black font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-red-200 to-red-500 truncate">
              SkripsiPro
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setIsSearchOpen(true)} title="Cari" className="p-2 bg-red-950/60 border border-red-900/60 rounded-xl text-red-300 shadow-sm"><Search size={18} /></button>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-red-950/60 border border-red-900/60 rounded-xl text-red-300 shadow-sm"><ChevronRight size={18} /></button>
          </div>
        </header>

        {/* Dynamic Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative custom-scrollbar">
          <div className={`mx-auto h-full ${['lembar', 'sidang', 'canvas', 'kuesioner', 'presentasi'].includes(activeTab) ? 'max-w-full' : 'max-w-7xl'}`}>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'quicknotes' && renderQuickNotes()}
            {activeTab === 'memo' && renderMemoCards()}
            {activeTab === 'files' && renderFiles()}
            {activeTab === 'matrix' && renderMatrix()}
            {activeTab === 'canvas' && renderCanvas()}
            {activeTab === 'kuesioner' && renderKuesioner()}
            {activeTab === 'lembar' && (
              <LembarSkripsi
                draftContent={draftContent}
                setDraftContent={setDraftContent}
                activeDraftBab={activeDraftBab}
                setActiveDraftBab={setActiveDraftBab}
                getThesisContext={getThesisContext}
              />
            )}
            {activeTab === 'presentasi' && <PresentasiSkripsi onAskAI={(prompt, systemPrompt) => callGeminiAPI(prompt, systemPrompt)} />}
            {activeTab === 'sidang' && renderSidang()}
          </div>
        </div>
      </main>

      {/* MODAL PENCARIAN UNIVERSAL DENGAN GAYA JEPANG GELAP */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-start justify-center pt-[8vh] sm:pt-[15vh] p-3 sm:p-4 backdrop-blur-md" onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}>
          <div className="bg-[#0e0708] w-full max-w-2xl rounded-3xl sm:rounded-[2rem] shadow-[0_0_50px_rgba(220,38,38,0.35)] border-2 border-red-900/80 overflow-hidden animate-in zoom-in-95 slide-in-from-top-4 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center px-4 sm:px-6 py-4 sm:py-5 border-b border-red-950/80 bg-[#14080a]">
              <div className="p-2 bg-red-950 border border-red-800 rounded-xl mr-3 sm:mr-4 shadow-sm shrink-0"><Search size={20} className="text-red-400" /></div>
              <input ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari di seluruh arsip, jurnal, dan bab..." className="flex-1 min-w-0 text-base sm:text-xl font-medium text-white bg-transparent focus:outline-none placeholder-red-300/40" />
              <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="ml-2 p-2 text-slate-400 hover:text-red-300 hover:bg-red-950/60 rounded-xl transition-colors shrink-0" title="Tutup"><X size={20} /></button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto custom-scrollbar bg-[#090506]">
              {(() => {
                if (searchQuery.length < 2) {
                  return <div className="p-10 text-center text-slate-400 font-medium font-mincho">Ketik kata kunci untuk mencari di seluruh naskah dan arsipmu.</div>;
                }
                const categories = getSearchResults();
                if (categories.length === 0) {
                  return <div className="p-10 text-center text-slate-400 font-medium font-mincho">Tidak ditemukan hasil untuk "{searchQuery}"</div>;
                }
                return (
                  <div className="py-2">
                    {categories.map((cat) => (
                      <div key={cat.label} className="mb-2">
                        <div className="px-6 pt-3 pb-1 flex items-center justify-between border-b border-red-950/50">
                          <span className="text-[11px] font-black uppercase tracking-widest text-red-400 font-cinzel">{cat.label}</span>
                          <span className="text-[11px] font-bold text-slate-400">{cat.totalMatches}</span>
                        </div>
                        <ul>
                          {cat.items.map((result, idx) => {
                            return (
                              <li key={idx}>
                                <button className="w-full px-6 py-3 flex items-center space-x-4 hover:bg-red-950/40 hover:pl-7 transition-all duration-200 text-left group" onClick={() => {
                                  setActiveTab(result.tab);
                                  if (result.tab === 'files' && result.folder) setActiveFolder(result.folder);
                                  if (result.tab === 'canvas' && result.nodeId) setSelectedCanvasNode(result.nodeId);
                                  if (result.tab === 'kuesioner' && result.indicatorId) setActiveIndicatorId(result.indicatorId);
                                  if (result.tab === 'lembar' && result.bab) setActiveDraftBab(result.bab);
                                  const targetPrefix = { quicknotes: 'note', memo: 'memo', matrix: 'matrix', files: 'file' }[result.tab];
                                  setHighlightTarget(targetPrefix && result.id ? `${targetPrefix}-${result.id}` : null);
                                  setIsSearchOpen(false); setSearchQuery('');
                                }}>
                                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-red-900/60 bg-red-950/60 text-red-400 group-hover:scale-110 transition-transform">{result.icon}</div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white font-bold truncate group-hover:text-red-300 transition-colors">{highlightMatch(result.title, searchQuery)}</p>
                                    <p className="text-slate-400 text-xs truncate mt-0.5 font-medium">{result.subtitle}</p>
                                  </div>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* FLOATING CHATBOT // HANNYA AI GUARDIAN */}
      <div className="fixed inset-0 z-40 pointer-events-none">
        {isChatOpen && (
          <div
            style={{ left: chatPanel.left, top: chatPanel.top, width: chatPanel.width, height: chatPanel.height }}
            className="absolute pointer-events-auto bg-[#0e0708] rounded-3xl sm:rounded-[2rem] shadow-[0_0_50px_rgba(220,38,38,0.45)] border-2 border-red-900/80 flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 zoom-in-95 duration-300 text-slate-100">
            
            {/* Header Chat Hannya AI */}
            <div className="relative bg-gradient-to-r from-red-950 via-[#280a0d] to-red-950 text-white px-5 sm:px-6 py-4 flex justify-between items-center border-b border-red-800/80 shrink-0">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-lg overflow-hidden border border-red-700/80 mr-2.5 shrink-0 bg-black">
                  <img src={oniSumieImg} alt="Hannya" className="w-full h-full object-cover object-top" />
                </div>
                <div>
                  <span className="font-black text-sm sm:text-base tracking-wide font-cinzel text-red-200">HANNYA AI GUARDIAN</span>
                  <span className="block text-[9px] text-red-400 font-mincho">鬼の知恵 // Penasihat Maut</span>
                </div>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="bg-red-950/80 hover:bg-red-900/90 p-1.5 rounded-full transition-colors border border-red-800/80 text-red-200"><X size={16}/></button>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#090506] custom-scrollbar" ref={chatScrollRef}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] sm:max-w-[85%] p-3.5 sm:p-4 rounded-xl sm:rounded-2xl text-[13px] sm:text-[14px] font-medium leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-gradient-to-r from-red-800 to-rose-950 text-white border border-red-700/70 rounded-br-sm' : 'bg-[#150a0c] border border-red-950/90 text-slate-200 rounded-bl-sm'}`} dangerouslySetInnerHTML={{__html: renderSafeHtmlString(msg.text)}} />
                </div>
              ))}
              {isAiTyping && (
                <div className="flex justify-start">
                  <div className="bg-[#150a0c] border border-red-950 p-3 rounded-xl rounded-bl-sm flex space-x-2 items-center text-xs text-red-400">
                    <Loader2 size={14} className="animate-spin text-red-500" />
                    <span className="font-mincho">Hannya sedang merapalkan mantra...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-3 bg-[#0e0708] border-t border-red-950 flex items-center space-x-2">
              <input 
                type="text" 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)} 
                placeholder="Tanyakan kelemahan skripsimu..." 
                className="flex-1 bg-[#150a0c] px-4 py-2.5 rounded-xl border border-red-900/60 focus:border-red-500 focus:outline-none text-white placeholder-slate-500 text-xs sm:text-sm font-medium" 
                disabled={isAiTyping} 
              />
              <button 
                type="submit" 
                disabled={!chatInput.trim() || isAiTyping} 
                className="btn-katana p-2.5 rounded-xl text-white shadow-md disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}

        {/* Floating FAB Action Button */}
        <div
          className="absolute pointer-events-auto touch-none select-none"
          style={{ left: fabPos.x, top: fabPos.y, width: fabSize, height: fabSize }}
        >
          {!isChatOpen && <span className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-500 to-amber-600 animate-pulse-cursed pointer-events-none"></span>}
          <button
            type="button"
            onPointerDown={handleFabPointerDown}
            onPointerMove={handleFabPointerMove}
            onPointerUp={handleFabPointerUp}
            onPointerCancel={handleFabPointerUp}
            onClick={handleFabClick}
            title="Panggil Penasihat Hannya AI"
            className={`relative w-full h-full rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,0.8)] border border-red-500/80 transition-all duration-300 ${isFabDragging ? 'cursor-grabbing scale-105' : 'cursor-grab hover:scale-110 active:scale-95'} ${isChatOpen ? 'bg-black text-red-400 rotate-90' : 'bg-gradient-to-tr from-red-950 via-rose-900 to-red-800 text-white'}`}
          >
            {isChatOpen ? <X size={22} /> : <Skull size={22} className="text-red-300 animate-pulse" />}
          </button>
        </div>
      </div>

      {/* MODAL QRIS DONASI */}
      {showQrisModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[300] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowQrisModal(false)}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 px-6 py-5 flex justify-between items-center text-white relative">
              <h3 className="font-black text-lg flex items-center relative z-10"><span className="text-2xl mr-2">☕</span> Traktir Developer</h3>
              <button onClick={() => setShowQrisModal(false)} className="bg-white/20 p-1.5 rounded-full z-10 hover:bg-white/30 transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 sm:p-8 flex flex-col items-center bg-slate-50 text-center">
              <p className="text-[13px] font-medium text-slate-600 mb-6 leading-relaxed">Jika SkripsiPro membantu Anda, dukung developer agar server dan sistem AI terus hidup! 🚀</p>
              <div className="bg-white p-3 rounded-3xl shadow-sm border border-slate-200 mb-6">
                <img 
                  src="https://i.imgur.com/4dEhfTK.png" 
                  alt="QRIS Donasi" 
                  className="w-48 h-48 object-contain" 
                />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-200 px-4 py-1.5 rounded-full border border-slate-300">Scan via Dana / OVO / M-Banking</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuthScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [accessCode, setAccessCode] = useState(''); 

  const WHATSAPP_NUMBER = "6281353538346"; 
  const WA_MESSAGE = "Halo Min, saya mau berlangganan SkripsiPro agar bisa akses full. Ini email saya: ";

  // Login dengan Google
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg('');
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const userEmail = result.user.email;
      
      const docExists = await checkFirestoreDocExists(firebaseConfig.projectId, "premium_users", userEmail);

      if (!docExists) {
        await signOut(auth);
        setErrorMsg(`Akses ditolak: Email ${userEmail} belum berlangganan.`);
      } else {
        localStorage.setItem('sp_session_type', 'google');
        window.location.reload(); 
      }
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') {
        setErrorMsg('Error login: ' + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Login dengan Kode Akses
  const handleCodeLogin = async (e) => {
    e.preventDefault();
    if (!accessCode.trim()) return;
    
    setIsLoading(true);
    setErrorMsg('');
    
    try {
      const codeUpper = accessCode.trim().toUpperCase();
      const docExists = await checkFirestoreDocExists(firebaseConfig.projectId, "premium_codes", codeUpper);

      if (docExists) {
        localStorage.setItem('sp_session_type', 'code');
        localStorage.setItem('sp_session_id', codeUpper);
        window.location.reload(); 
      } else {
        setErrorMsg(`Akses ditolak: Kode "${codeUpper}" tidak ditemukan / tidak valid.`);
      }
    } catch (error) {
      setErrorMsg('Error verifikasi kode: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070405] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-outfit">
      {/* Background Image Kuil Bulan Darah */}
      <div className="absolute inset-0 pointer-events-none opacity-25 mix-blend-screen">
        <img src={bloodMoonImg} alt="Blood Moon" className="w-full h-full object-cover object-center filter saturate-150" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070405] via-[#070405]/80 to-transparent"></div>
      </div>

      {/* Partikel Daun Maple Darah */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <span className="leaf-particle text-red-600 text-xl" style={{ left: '15%', animationDuration: '9s' }}>🍁</span>
        <span className="leaf-particle text-red-500 text-lg" style={{ left: '45%', animationDuration: '13s' }}>🍁</span>
        <span className="leaf-particle text-rose-600 text-2xl" style={{ left: '75%', animationDuration: '11s' }}>🍁</span>
      </div>

      <div className="max-w-md w-full relative z-10 bg-[#0e0708] rounded-3xl shadow-[0_0_50px_rgba(220,38,38,0.35)] border-2 border-red-900/80 overflow-hidden">
        <div className="p-8 text-center bg-gradient-to-b from-[#1c080a] to-[#0e0708] border-b border-red-950 text-white relative">
          <div className="w-16 h-16 mx-auto mb-3 p-1 rounded-2xl bg-black border border-red-800 shadow-[0_0_20px_rgba(220,38,38,0.5)]">
            <img src={logoImg} alt="SkripsiPro" className="w-full h-full object-contain filter drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
          </div>
          <h1 className="text-3xl font-black font-cinzel text-transparent bg-clip-text bg-gradient-to-r from-red-200 via-rose-300 to-red-500">
            SKRIPSIPRO
          </h1>
          <p className="text-xs font-black tracking-widest uppercase text-red-400 mt-1 font-mincho">
            修羅の論文 // THE CURSED TRIAL
          </p>
        </div>
        
        <div className="p-6 sm:p-8 space-y-6">
          {errorMsg && <div className="bg-red-950/80 text-red-300 p-3 rounded-xl text-xs font-bold border border-red-800">{errorMsg}</div>}
          
          <button onClick={handleGoogleLogin} disabled={isLoading} className="w-full flex items-center justify-center space-x-2 bg-black/60 border border-red-900/70 hover:border-red-600 hover:bg-red-950/40 text-slate-200 font-bold py-3 px-4 rounded-xl transition-all">
             {isLoading ? <Loader2 size={18} className="animate-spin text-red-500" /> : <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />}
             <span className="text-sm">Masuk dengan Google</span>
          </button>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-red-950"></div>
            <span className="flex-shrink-0 mx-3 text-red-400/80 text-[10px] font-black uppercase font-cinzel tracking-widest">Atau Segel Akses</span>
            <div className="flex-grow border-t border-red-950"></div>
          </div>

          <form onSubmit={handleCodeLogin} className="space-y-4">
            <input 
              type="text" 
              value={accessCode} 
              onChange={(e) => setAccessCode(e.target.value)} 
              placeholder="Masukkan Kode Segel" 
              className="w-full bg-[#150a0c] border border-red-900/70 focus:border-red-500 px-4 py-3 rounded-xl text-center font-black text-white uppercase tracking-widest text-sm focus:outline-none" 
            />
            <button 
              type="submit" 
              disabled={isLoading || !accessCode.trim()} 
              className="w-full btn-katana text-white font-black py-3 px-4 rounded-xl transition-all disabled:opacity-50 text-xs uppercase tracking-wider shadow-lg"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin mx-auto" /> : "⚡ Buka Segel Akses"}
            </button>
          </form>
        </div>

        <div className="bg-[#080405] p-4 text-center border-t border-red-950/80">
           <p className="text-xs text-slate-400 font-medium">
             Belum memiliki segel akses? <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WA_MESSAGE)}`} target="_blank" rel="noopener noreferrer" className="text-red-400 font-bold hover:underline">Hubungi Shogun Admin</a>
           </p>
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('SkripsiPro crashed:', error, info);
    this.setState({ error, errorInfo: info });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070102] text-stone-200 flex items-center justify-center p-6 text-center font-outfit">
          <div className="max-w-xl bg-[#0e0406] border border-red-900/80 rounded-3xl shadow-[0_0_50px_rgba(220,38,38,0.4)] p-8">
            <ShieldAlert size={48} className="mx-auto text-red-500 mb-4 animate-pulse" />
            <h2 className="text-2xl font-black text-stone-100 font-cinzel mb-2">Terjadi Gangguan Mistis</h2>
            <p className="text-sm text-stone-400 mb-4 font-mincho">
              Sistem mendeteksi benturan mantra. Silakan muat ulang atau pulihkan data bila perlu.
            </p>
            {this.state.error && (
              <div className="bg-[#180508] border border-red-950 p-4 rounded-xl text-left my-4 text-xs font-mono text-red-300 max-h-56 overflow-y-auto">
                <p className="font-bold text-red-400 mb-1">{this.state.error.toString()}</p>
                {this.state.error.stack && (
                  <pre className="text-[11px] text-stone-400 whitespace-pre-wrap">{this.state.error.stack}</pre>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-3 justify-center mt-6">
              <button
                onClick={() => window.location.reload()}
                className="btn-katana text-white font-bold py-3 px-6 rounded-xl font-cinzel text-xs tracking-wider shadow-lg"
              >
                Muat Ulang
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Reset localStorage akan membersihkan draft lokal yang mungkin korup. Lanjutkan?')) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                className="bg-[#1a0508] hover:bg-red-950 text-red-400 border border-red-900/80 font-bold py-3 px-5 rounded-xl font-cinzel text-xs tracking-wider transition-all"
              >
                Reset Cache Korup
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [currentApp, setCurrentApp] = useState('main'); 

  return (
    <>
      <style>{`
         .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
         .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
         .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
         .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
         .gradient-text { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
         .brand-gradient-text { background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
         .premium-gradient-text { background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
         .btn-shine { position: relative; overflow: hidden; }
         .btn-shine::after { content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%; transform: skewX(-20deg); background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 100%); transition: all 0.5s; }
         .btn-shine:hover::after { left: 100%; transition: all 0.5s; opacity: 1; }
         .card-hover { transition: all 0.3s ease; }
         .card-hover:hover { transform: translateY(-4px); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); }
         .animate-float { animation: float 3s ease-in-out infinite; }
         @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } }
         .animate-glow-ring { animation: glow-ring 2s infinite; }
         @keyframes glow-ring { 0% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(6, 182, 212, 0); } 100% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0); } }
      `}</style>
      
      <ErrorBoundary>
        {currentApp === 'main' ? (
          <SkripsiProApp onNavigateLab={() => setCurrentApp('lab')} />
        ) : (
          <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-blue-600"><Loader2 size={48} className="animate-spin" /></div>}>
            <LabStatistikApp onNavigateBack={() => setCurrentApp('main')} />
          </Suspense>
        )}
      </ErrorBoundary>
    </>
  );
}