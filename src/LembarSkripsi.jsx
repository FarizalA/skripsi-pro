import React, { useState, useRef, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { TableKit } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Image from '@tiptap/extension-image';
import {
  FileText, Sparkles, Loader2, Send, Bot, Wand2, PenLine, Scissors, ClipboardList,
  Undo2, Redo2, Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Quote,
  Link2, ImagePlus, Table2, Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
  Eraser, Minus, Highlighter, Palette, Columns, Rows, Trash2, ScrollText, Flame, ShieldAlert
} from 'lucide-react';
import { callGeminiAPI } from './utils';
import { playKatanaSlash, playDarkGong } from './audioEffects';

/**
 * Editor "Lembar Kerja Skripsi" bergaya Ruang Kaligrafi Samurai / Blood Ink Sanctuary.
 * Rich-text engine memakai Tiptap dengan styling obsidian, blood-red neon, dan Mincho typography.
 */

const BAB_TABS = [
  { key: 'bab1', label: 'Bab 1', kanji: '序章', full: 'Bab 1: Pendahuluan' },
  { key: 'bab2', label: 'Bab 2', kanji: '典拠', full: 'Bab 2: Tinjauan Pustaka' },
  { key: 'bab3', label: 'Bab 3', kanji: '術式', full: 'Bab 3: Metodologi' },
  { key: 'bab4', label: 'Bab 4', kanji: '経典', full: 'Bab 4: Hasil & Pembahasan' },
  { key: 'bab5', label: 'Bab 5', kanji: '遺物', full: 'Bab 5: Penutup' },
];

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];

// Render **bold** markdown sederhana jadi HTML aman untuk bubble chat
const renderSafeHtml = (textStr) => {
  if (typeof textStr !== 'string') return '';
  return textStr.replace(/\*\*(.*?)\*\*/g, '<b class="text-red-400 font-black">$1</b>');
};

// Ubah teks polos jadi HTML yang valid untuk disisipkan ke editor Tiptap.
const aiTextToHtml = (raw) => {
  if (typeof raw !== 'string' || !raw.trim()) return '<p></p>';
  const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inlineFormat = (line) => escapeHtml(line)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\s)\*(\S(?:.*?\S)?)\*(?=\s|$)/g, '$1<em>$2</em>');

  const lines = raw.replace(/^#{1,6}\s*/gm, '').split(/\r?\n/);
  let html = '';
  let listBuffer = [];
  let listType = null;
  let paraBuffer = [];

  const flushList = () => {
    if (listBuffer.length) {
      const tag = listType === 'ol' ? 'ol' : 'ul';
      html += `<${tag}>${listBuffer.map(li => `<li>${li}</li>`).join('')}</${tag}>`;
    }
    listBuffer = [];
    listType = null;
  };
  const flushPara = () => {
    if (paraBuffer.length) html += `<p>${paraBuffer.join('<br>')}</p>`;
    paraBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { flushList(); flushPara(); continue; }
    const ulMatch = line.match(/^[-*]\s+(.*)/);
    const olMatch = line.match(/^\d+[.)]\s+(.*)/);
    if (ulMatch) {
      flushPara();
      if (listType !== 'ul') flushList();
      listType = 'ul';
      listBuffer.push(inlineFormat(ulMatch[1]));
    } else if (olMatch) {
      flushPara();
      if (listType !== 'ol') flushList();
      listType = 'ol';
      listBuffer.push(inlineFormat(olMatch[1]));
    } else {
      flushList();
      paraBuffer.push(inlineFormat(line));
    }
  }
  flushList();
  flushPara();
  return html || '<p></p>';
};

const Divider = () => <div className="w-px h-5 bg-red-950/80 mx-0.5 sm:mx-1 shrink-0" />;

const ToolBtn = ({ onClick, active, disabled, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-1.5 sm:p-2 rounded-lg transition-all disabled:opacity-20 disabled:cursor-not-allowed shrink-0 ${
      active
        ? 'bg-red-950/90 text-red-300 border border-red-700/60 shadow-[0_0_12px_rgba(220,38,38,0.4)]'
        : 'text-stone-400 hover:text-stone-100 hover:bg-red-950/40 hover:border hover:border-red-900/50'
    }`}
  >
    {children}
  </button>
);

function EditorToolbar({ editor }) {
  if (!editor) return null;

  const headingValue = editor.isActive('heading', { level: 1 }) ? '1'
    : editor.isActive('heading', { level: 2 }) ? '2'
    : editor.isActive('heading', { level: 3 }) ? '3'
    : 'p';
  const fontSizeValue = editor.getAttributes('textStyle').fontSize || '';

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href || '';
    const url = window.prompt('Masukkan URL tautan:', previousUrl || 'https://');
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt('Masukkan URL gambar:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-[#0c0406]/95 border-b border-red-950/80 overflow-x-auto custom-scrollbar backdrop-blur-md">
      <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Urungkan (Undo)"><Undo2 size={15} /></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Ulangi (Redo)"><Redo2 size={15} /></ToolBtn>

      <Divider />

      <select
        value={headingValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'p') editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: Number(v) }).run();
        }}
        className="text-[11px] sm:text-xs font-bold border border-red-950/80 rounded-lg px-1.5 py-1.5 bg-[#140508] text-stone-200 focus:outline-none focus:ring-1 focus:ring-red-600 shrink-0 max-w-[90px] sm:max-w-none font-cinzel"
        title="Gaya Paragraf"
      >
        <option value="p">Normal</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>

      <select
        value={fontSizeValue}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) editor.chain().focus().unsetFontSize().run();
          else editor.chain().focus().setFontSize(v).run();
        }}
        className="text-[11px] sm:text-xs font-bold border border-red-950/80 rounded-lg px-1.5 py-1.5 bg-[#140508] text-stone-200 focus:outline-none focus:ring-1 focus:ring-red-600 w-[62px] shrink-0 font-cinzel"
        title="Ukuran teks"
      >
        <option value="">Uk.</option>
        {FONT_SIZES.map(s => <option key={s} value={s}>{s.replace('px', '')}</option>)}
      </select>

      <Divider />

      <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Tebal"><Bold size={15} /></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Miring"><Italic size={15} /></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Garis Bawah"><UnderlineIcon size={15} /></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Coret"><Strikethrough size={15} /></ToolBtn>

      <Divider />

      <label className="relative p-1.5 sm:p-2 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-red-950/40 cursor-pointer shrink-0" title="Warna tinta">
        <Palette size={15} />
        <input
          type="color"
          value={editor.getAttributes('textStyle').color || '#f3f4f6'}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </label>
      <ToolBtn onClick={() => editor.chain().focus().toggleHighlight({ color: '#7f1d1d' }).run()} active={editor.isActive('highlight')} title="Stabilo Darah"><Highlighter size={15} /></ToolBtn>

      <Divider />

      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Rata Kiri"><AlignLeft size={15} /></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Rata Tengah"><AlignCenter size={15} /></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Rata Kanan"><AlignRight size={15} /></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Rata Kanan-Kiri"><AlignJustify size={15} /></ToolBtn>

      <Divider />

      <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Daftar Poin"><List size={15} /></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Daftar Bernomor"><ListOrdered size={15} /></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Kutipan Mantra"><Quote size={15} /></ToolBtn>

      <Divider />

      <ToolBtn onClick={setLink} active={editor.isActive('link')} title="Sisipkan Tautan"><Link2 size={15} /></ToolBtn>
      <ToolBtn onClick={addImage} title="Sisipkan Gambar"><ImagePlus size={15} /></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Sisipkan Tabel Gulungan"><Table2 size={15} /></ToolBtn>

      <Divider />

      <ToolBtn onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} title="Superscript"><SuperscriptIcon size={15} /></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} title="Subscript"><SubscriptIcon size={15} /></ToolBtn>

      <Divider />

      <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Garis Pemisah Pedang"><Minus size={15} /></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Bersihkan Format"><Eraser size={15} /></ToolBtn>

      {editor.isActive('table') && (
        <>
          <Divider />
          <ToolBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Tambah Kolom"><Columns size={15} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="Tambah Baris"><Rows size={15} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().deleteColumn().run()} title="Hapus Kolom"><Columns size={15} className="text-red-500" /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().deleteRow().run()} title="Hapus Baris"><Rows size={15} className="text-red-500" /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().deleteTable().run()} title="Hapus Tabel"><Trash2 size={15} className="text-red-500" /></ToolBtn>
        </>
      )}
    </div>
  );
}

export default function LembarSkripsi({ draftContent, setDraftContent, activeDraftBab, setActiveDraftBab, getThesisContext }) {
  const draftObj = (draftContent && typeof draftContent === 'object') ? draftContent : {};
  const activeBabInfo = BAB_TABS.find(t => t.key === activeDraftBab) || BAB_TABS[0];

  const chatScrollRef = useRef(null);
  const activeDraftBabRef = useRef(activeDraftBab);
  useEffect(() => { activeDraftBabRef.current = activeDraftBab; }, [activeDraftBab]);

  const [mobileView, setMobileView] = useState('editor'); // 'editor' | 'chat'
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'model',
      text: '⚔️ **Kutukan Roh Dosen Aktif.**\nSaya penjaga dan pembedah lembar skripsi ini. Perintahkan saya untuk **merapikan ejaan**, **menyambung alur pemikiran**, **meringkas argumen**, atau **merevisi kutipan yang diseleksi**. Coret teks di gulungan sebelah kiri lalu lepaskan mantra tebasan.',
      canApply: false,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [busyAction, setBusyAction] = useState(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextStyleKit,
      TableKit.configure({ table: { resizable: true } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: 'Tuliskan argumen penelitianmu di atas kertas darah ini... Seleksi teks untuk memanggil roh pembimbing.' }),
      CharacterCount,
      Superscript,
      Subscript,
      Image,
    ],
    content: draftObj[activeDraftBab] || '<p></p>',
    editorProps: { attributes: { class: 'tiptap tiptap-page focus:outline-none' } },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      setDraftContent(prev => ({ ...((prev && typeof prev === 'object') ? prev : {}), [activeDraftBabRef.current]: html }));
    },
  });

  // Ganti isi editor saat pindah tab Bab
  useEffect(() => {
    if (!editor) return;
    const nextHtml = draftObj[activeDraftBab] || '<p></p>';
    if (editor.getHTML() !== nextHtml) {
      editor.commands.setContent(nextHtml, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDraftBab, editor]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages, isAiTyping]);

  const wordCount = editor?.storage?.characterCount?.words?.() ?? 0;

  const getSelectionSnapshot = () => {
    if (!editor) return { from: 0, to: 0, text: '' };
    const { from, to, empty } = editor.state.selection;
    const text = empty ? '' : editor.state.doc.textBetween(from, to, '\n');
    return { from, to, text };
  };

  const selection = editor ? getSelectionSnapshot() : { from: 0, to: 0, text: '' };

  const applyToDocument = (kind, rawText, snapshot) => {
    if (!editor) return;
    playKatanaSlash();
    const html = aiTextToHtml(rawText);
    if (kind === 'replace_all') {
      editor.chain().focus().setContent(html).run();
    } else if (kind === 'replace_selection' && snapshot && typeof snapshot.from === 'number') {
      editor.chain().focus().insertContentAt({ from: snapshot.from, to: snapshot.to }, html).run();
    } else {
      const pos = (snapshot && typeof snapshot.to === 'number') ? snapshot.to : editor.state.doc.content.size;
      editor.chain().focus().insertContentAt(pos, html).run();
    }
  };

  const handleApply = (msg, kind) => {
    applyToDocument(kind, msg.rawText, msg.snapshot);
    setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, applied: true } : m)));
  };

  const buildSystemPrompt = () => {
    const thesisContext = typeof getThesisContext === 'function' ? getThesisContext() : '';
    const currentText = editor?.getText({ blockSeparator: '\n\n' }) || '';
    return `Anda adalah asisten penulisan skripsi akademik berwujud Roh Samurai / Shadow Mentor yang bekerja LANGSUNG di dalam lembar kerja ${activeBabInfo.full}.
PENTING: Jika mahasiswa meminta Anda menuliskan, merevisi, merapikan, atau meringkas teks, jawab HANYA dengan hasil teks akhirnya saja (tanpa basa-basi pembuka/penutup, tanpa tanda kutip pembuka/penutup, tanpa heading markdown), agar bisa langsung diterapkan ke dokumen. Boleh pakai **bold** untuk istilah penting, dan "- " untuk daftar poin bila relevan. Jika mahasiswa hanya bertanya/berdiskusi, jawab tegas berwibawa khas mentor akademis samurai.
Gunakan bahasa Indonesia akademik yang baku, formal, tajam, dan elegan.

=== ISI ${activeBabInfo.full.toUpperCase()} SAAT INI ===
${currentText || '(masih kosong)'}

=== BAGIAN YANG SEDANG DISELEKSI MAHASISWA (jika ada) ===
${selection.text || '(tidak ada seleksi)'}
${thesisContext ? `\n=== KONTEKS SKRIPSI LEBIH LUAS (variabel & referensi jurnal) ===\n${thesisContext}` : ''}`;
  };

  const pushMessagesAndCall = async ({ userLabel, prompt, systemPrompt, canApply, snapshot }) => {
    setIsAiTyping(true);
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text: userLabel }]);
    try {
      const history = messages.slice(-8).map(m => ({ role: m.role, text: m.text }));
      const { text } = await callGeminiAPI(prompt, systemPrompt, history, false, null);
      const resultText = typeof text === 'string' && text.trim() ? text : 'Maaf, energi roh terputus. Silakan coba tebas lagi.';
      setMessages(prev => [...prev, {
        id: `m-${Date.now()}`, role: 'model', text: resultText, rawText: resultText, canApply, snapshot,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'model', text: `❌ Gagal: ${err.message}`, canApply: false }]);
    } finally {
      setIsAiTyping(false);
      setBusyAction(null);
    }
  };

  const runQuickAction = (kind) => {
    if (!editor || busyAction || isAiTyping) return;
    playDarkGong();
    const currentText = editor.getText({ blockSeparator: '\n\n' });
    setBusyAction(kind);

    if (kind === 'tidy') {
      if (!currentText.trim()) { setBusyAction(null); return; }
      pushMessagesAndCall({
        userLabel: `⚔️ Tebas & Rapikan seluruh teks ${activeBabInfo.label}`,
        prompt: `Rapikan draf ${activeBabInfo.full} berikut: perbaiki ejaan, tata bahasa, struktur kalimat, dan alur logikanya, TANPA mengubah makna aslinya. Pertahankan istilah teknis yang sudah ada.\nTeks asli:\n"""\n${currentText}\n"""`,
        systemPrompt: buildSystemPrompt(), canApply: true, snapshot: null,
      });
    } else if (kind === 'continue') {
      pushMessagesAndCall({
        userLabel: `📜 Lanjutkan tulisan ${activeBabInfo.label}`,
        prompt: `Lanjutkan draf ${activeBabInfo.full} berikut dengan 1-2 paragraf baru yang koheren, sesuai konteks dan gaya bahasa akademik yang sudah ada. Jangan mengulang teks yang sudah ada.\nTeks yang sudah ditulis:\n"""\n${currentText || '(masih kosong, mulai dengan paragraf pembuka yang relevan)'}\n"""`,
        systemPrompt: buildSystemPrompt(), canApply: true,
        snapshot: { from: editor.state.doc.content.size, to: editor.state.doc.content.size, text: '' },
      });
    } else if (kind === 'revise_selection') {
      if (!selection.text.trim()) { setBusyAction(null); return; }
      pushMessagesAndCall({
        userLabel: `🩸 Asah bagian terpilih: "${selection.text.trim().slice(0, 45)}..."`,
        prompt: `Revisi kutipan berikut dari draf ${activeBabInfo.full} agar lebih formal, jelas, dan sesuai kaidah akademik, TANPA mengubah maksud aslinya.\nKutipan asli:\n"""\n${selection.text}\n"""`,
        systemPrompt: buildSystemPrompt(), canApply: true, snapshot: { ...selection },
      });
    } else if (kind === 'summarize') {
      if (!currentText.trim()) { setBusyAction(null); return; }
      pushMessagesAndCall({
        userLabel: `⚡ Padatkan intisari ${activeBabInfo.label}`,
        prompt: `Ringkas draf ${activeBabInfo.full} berikut menjadi versi lebih padat namun tetap mempertahankan poin-poin pentingnya.\nTeks asli:\n"""\n${currentText}\n"""`,
        systemPrompt: buildSystemPrompt(), canApply: true, snapshot: null,
      });
    } else if (kind === 'review') {
      if (!currentText.trim()) { setBusyAction(null); return; }
      pushMessagesAndCall({
        userLabel: `👹 Ujian Roh Penguji (Review ${activeBabInfo.label})`,
        prompt: `Review draft ${activeBabInfo.full} ini selayaknya Dosen Penguji Utama yang sangat tajam dan kritis. Berikan format HANYA dengan header Markdown: ### 🗡️ Tebasan yang Sudah Tepat, ### ⚠️ Titik Lemah yang Menganga, ### 🔴 Celah Fatal (Bisa Menjatuhkanmu di Sidang), ### 💡 Ajaran & Saran Perbaikan.\nTeks:\n"""\n${currentText.substring(0, 6000)}\n"""`,
        systemPrompt: 'Anda Sensei Penguji Skripsi yang sangat teliti, tegas, dan berwawasan luas. Berikan kritik tajam dan berbobot dalam bahasa Indonesia.',
        canApply: false, snapshot: null,
      });
    }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    const userText = chatInput.trim();
    if (!userText || isAiTyping || !editor) return;
    playKatanaSlash();
    setChatInput('');
    const snapshot = selection.text.trim()
      ? { ...selection }
      : { from: editor.state.doc.content.size, to: editor.state.doc.content.size, text: '' };

    pushMessagesAndCall({ userLabel: userText, prompt: userText, systemPrompt: buildSystemPrompt(), canApply: true, snapshot });
  };

  const quickActionBtn = "flex items-center gap-1.5 bg-[#140508] hover:bg-red-950/80 text-stone-300 hover:text-red-200 border border-red-950/90 hover:border-red-700/60 px-2.5 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed font-cinzel";
  const applyBtn = "bg-[#180609] hover:bg-red-900/60 hover:border-red-500 border border-red-900/70 text-red-200 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all shadow-sm font-cinzel";

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500 pb-0" style={{ minHeight: 0 }}>
      <style>{`
        .tiptap-page { min-height: 520px; font-family: "Shippori Mincho", "Times New Roman", serif; color: #f3f4f6; }
        .tiptap-page p { margin: 0 0 1.1em 0; line-height: 1.95; font-size: 15px; }
        .tiptap-page h1 { font-size: 1.6em; font-weight: 900; margin: 1em 0 0.5em; color: #ef4444; font-family: "Cinzel", serif; border-bottom: 1px solid rgba(185,28,28,0.3); padding-bottom: 0.3em; letter-spacing: 0.05em; }
        .tiptap-page h2 { font-size: 1.35em; font-weight: 800; margin: 1em 0 0.5em; color: #f87171; font-family: "Cinzel", serif; }
        .tiptap-page h3 { font-size: 1.15em; font-weight: 700; margin: 1em 0 0.4em; color: #fca5a5; font-family: "Cinzel", serif; }
        .tiptap-page ul, .tiptap-page ol { padding-left: 1.5em; margin: 0 0 1.1em 0; }
        .tiptap-page li { margin-bottom: 0.35em; line-height: 1.8; }
        .tiptap-page blockquote { border-left: 3px solid #dc2626; padding-left: 1em; color: #fca5a5; font-style: italic; margin: 0 0 1.2em 0; background: rgba(185,28,28,0.08); border-radius: 0 8px 8px 0; padding-top: 6px; padding-bottom: 6px; }
        .tiptap-page a { color: #f87171; text-decoration: underline; text-decoration-color: #ef4444; }
        .tiptap-page hr { border: none; border-top: 1px solid rgba(185,28,28,0.3); margin: 1.5em 0; }
        .tiptap-page mark { background-color: rgba(220,38,38,0.35); color: #fff; border-radius: 2px; padding: 0 4px; }
        .tiptap-page table { border-collapse: collapse; width: 100%; margin: 0 0 1.2em 0; table-layout: fixed; }
        .tiptap-page th, .tiptap-page td { border: 1px solid #7f1d1d; padding: 8px 12px; vertical-align: top; }
        .tiptap-page th { background: #1c070a; color: #fca5a5; font-weight: 700; font-family: "Cinzel", serif; }
        .tiptap-page p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; color: #78716c; pointer-events: none; height: 0; font-style: italic; }
      `}</style>

      {/* Switcher Tab Mobile */}
      <div className="lg:hidden flex bg-[#0d0406] p-1 rounded-xl mb-3 border border-red-950/80 shrink-0">
        <button
          onClick={() => setMobileView('editor')}
          className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all font-cinzel ${mobileView === 'editor' ? 'bg-red-950 text-red-300 border border-red-700/60' : 'text-stone-400'}`}
        >
          📜 Gulungan Kitab
        </button>
        <button
          onClick={() => setMobileView('chat')}
          className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all font-cinzel ${mobileView === 'chat' ? 'bg-red-950 text-red-300 border border-red-700/60' : 'text-stone-400'}`}
        >
          👹 Roh Penguji AI
        </button>
      </div>

      <div className="flex-1 flex min-h-0 gap-4 sm:gap-6">
        {/* KIRI: Editor Gulungan Kaligrafi Darah */}
        <div className={`flex-1 min-h-0 flex-col ${mobileView === 'editor' ? 'flex' : 'hidden'} lg:flex`}>
          <div className="flex-1 flex flex-col min-h-0 bg-[#070102] rounded-3xl sm:rounded-[2rem] border border-red-950/80 shadow-[0_0_40px_rgba(0,0,0,0.85)] overflow-hidden">
            
            {/* Header Bab Tabs */}
            <div className="bg-[#0b0305] border-b border-red-950/80 px-3 sm:px-5 pt-3 sm:pt-4 pb-0 shrink-0">
              <div className="flex flex-wrap sm:flex-nowrap gap-2 overflow-x-auto custom-scrollbar pb-1">
                {BAB_TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      playKatanaSlash();
                      setActiveDraftBab(tab.key);
                    }}
                    className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full sm:rounded-t-2xl sm:rounded-b-none text-xs sm:text-sm font-black tracking-wider whitespace-nowrap transition-all border sm:border-b-0 sm:border-t-0 sm:border-x-0 font-cinzel flex items-center gap-2 ${
                      activeDraftBab === tab.key
                        ? 'bg-red-950/80 sm:bg-[#070102] border-red-600 sm:border-b-[3px] sm:border-b-red-600 text-red-300 shadow-[0_0_15px_rgba(220,38,38,0.3)]'
                        : 'bg-[#100305] sm:bg-transparent border-red-950/60 text-stone-500 hover:text-stone-200'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[10px] text-red-500 font-mincho opacity-80">{tab.kanji}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Toolbar */}
            <EditorToolbar editor={editor} />

            {/* Word & Page stats info bar */}
            <div className="px-4 sm:px-6 py-2 border-b border-red-950/70 flex justify-between items-center bg-[#0d0406] shrink-0 text-[11px] sm:text-xs">
              <div className="flex items-center gap-2.5 flex-wrap text-stone-400 font-bold font-cinzel">
                <span className="bg-[#140508] text-red-400 px-3 py-1 rounded-full border border-red-950/80 flex items-center gap-1.5">
                  <ScrollText size={12} /> {wordCount} Aksara
                </span>
                <span className="hidden sm:inline bg-[#140508] text-stone-300 px-3 py-1 rounded-full border border-red-950/80">
                  ~{Math.max(1, Math.ceil(wordCount / 250))} Gulungan Halaman
                </span>
                {selection.text.trim() && (
                  <span className="bg-red-950/90 text-red-300 px-3 py-1 rounded-full border border-red-700/60 shadow-[0_0_10px_rgba(220,38,38,0.3)] animate-pulse">
                    🗡️ {selection.text.trim().split(/\s+/).length} Aksara Tertebas
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-red-400/80 text-[11px] font-mincho">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping inline-block" />
                <span className="hidden sm:inline">Tersegel Otomatis di Darah</span>
              </div>
            </div>

            {/* Writing Parchment Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 bg-[#050102]">
              <div className="max-w-3xl mx-auto bg-[#0c0406] shadow-[0_0_60px_rgba(0,0,0,0.9)] border border-red-950/90 rounded-2xl p-8 sm:p-14 text-sm sm:text-base text-stone-200 leading-[1.95] relative overflow-hidden">
                {/* Ancient Japanese Blood Shinto corner watermark */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-red-900/15 via-red-950/5 to-transparent pointer-events-none" />
                <div className="absolute top-4 right-5 text-red-950/40 text-4xl font-mincho select-none pointer-events-none">
                  {activeBabInfo.kanji}
                </div>
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>
        </div>

        {/* KANAN: AI Chat Asisten - Shadow Oni Sensei */}
        <div className={`w-full lg:w-[380px] xl:w-[420px] shrink-0 min-h-0 flex-col ${mobileView === 'chat' ? 'flex' : 'hidden'} lg:flex`}>
          <div className="flex-1 flex flex-col min-h-0 bg-[#0a0204] rounded-3xl sm:rounded-[2rem] border border-red-950/90 shadow-[0_0_35px_rgba(0,0,0,0.9)] overflow-hidden">
            
            {/* Header Sensei */}
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-red-950/80 bg-gradient-to-r from-red-950/60 via-[#140407] to-black flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="bg-red-950/80 p-2 rounded-xl border border-red-700/60 text-red-400 shrink-0 shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                  <Bot size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-stone-100 font-cinzel tracking-wider flex items-center gap-1.5">
                    <span>Kutukan Roh Dosen</span>
                    <span className="text-[10px] text-red-500 font-mincho px-1.5 py-0.5 bg-red-950/60 rounded border border-red-900/50">呪術指南</span>
                  </h3>
                  <p className="text-[10px] sm:text-xs text-red-400/80 font-medium truncate font-cinzel">Pendamping Gaib {activeBabInfo.label}</p>
                </div>
              </div>
            </div>

            {/* Quick Spell Actions */}
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-red-950/80 flex flex-wrap gap-1.5 sm:gap-2 shrink-0 bg-[#0e0305]">
              <button onClick={() => runQuickAction('tidy')} disabled={!!busyAction || isAiTyping || !wordCount} className={quickActionBtn}>
                {busyAction === 'tidy' ? <Loader2 size={12} className="animate-spin text-red-400" /> : <Wand2 size={12} className="text-red-400" />} Tebas Ejaan
              </button>
              <button onClick={() => runQuickAction('continue')} disabled={!!busyAction || isAiTyping} className={quickActionBtn}>
                {busyAction === 'continue' ? <Loader2 size={12} className="animate-spin text-red-400" /> : <PenLine size={12} className="text-red-400" />} Sambung Tinta
              </button>
              <button onClick={() => runQuickAction('revise_selection')} disabled={!!busyAction || isAiTyping || !selection.text.trim()} className={quickActionBtn}>
                {busyAction === 'revise_selection' ? <Loader2 size={12} className="animate-spin text-red-400" /> : <Scissors size={12} className="text-red-400" />} Asah Seleksi
              </button>
              <button onClick={() => runQuickAction('summarize')} disabled={!!busyAction || isAiTyping || !wordCount} className={quickActionBtn}>
                {busyAction === 'summarize' ? <Loader2 size={12} className="animate-spin text-red-400" /> : <ClipboardList size={12} className="text-red-400" />} Padatkan
              </button>
              <button onClick={() => runQuickAction('review')} disabled={!!busyAction || isAiTyping || !wordCount} className={`${quickActionBtn} border-red-600/60 text-red-400`}>
                {busyAction === 'review' ? <Loader2 size={12} className="animate-spin text-red-400" /> : <Sparkles size={12} className="text-red-400" />} Ujian Roh
              </button>
            </div>

            {/* Chat stream list */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 space-y-3 bg-[#070102]">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[92%] p-3.5 rounded-2xl text-[12.5px] sm:text-sm leading-relaxed shadow-md ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-red-900 to-red-950 border border-red-700/60 text-stone-100 rounded-br-sm shadow-[0_0_15px_rgba(220,38,38,0.25)]'
                      : 'bg-[#100406] border border-red-950/90 text-stone-300 rounded-bl-sm font-mincho'
                  }`}>
                    <div dangerouslySetInnerHTML={{ __html: renderSafeHtml(msg.text) }} />
                    {msg.canApply && !msg.applied && (
                      <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-red-950/90">
                        <button onClick={() => handleApply(msg, 'insert_cursor')} className={applyBtn}>🗡️ Sisipkan Teks</button>
                        {msg.snapshot?.text && <button onClick={() => handleApply(msg, 'replace_selection')} className={applyBtn}>🩸 Ganti Terpilih</button>}
                        <button onClick={() => handleApply(msg, 'replace_all')} className={applyBtn}>🔁 Tukar Seluruh Bab</button>
                      </div>
                    )}
                    {msg.applied && <p className="text-[10px] font-bold text-emerald-400 mt-2 font-cinzel">✓ Mantra Berhasil Ditanam ke Gulungan</p>}
                  </div>
                </div>
              ))}
              {isAiTyping && (
                <div className="flex justify-start">
                  <div className="bg-[#120407] border border-red-950/80 rounded-2xl rounded-bl-sm p-3.5 flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-red-500" />
                    <span className="text-[11px] text-red-400 font-cinzel">Roh Dosen Sedang Menajamkan Kritik...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendChat} className="p-2.5 sm:p-3 border-t border-red-950/90 flex items-center gap-2 shrink-0 bg-[#0b0305]">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Perintahkan roh… misal: 'tuliskan latar belakang masalah'"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-red-950/80 bg-[#140508] focus:outline-none focus:ring-1 focus:ring-red-600 text-xs sm:text-sm font-medium text-stone-200 placeholder-stone-600 font-mincho"
              />
              <button
                type="submit"
                disabled={isAiTyping || !chatInput.trim()}
                className="bg-red-950 hover:bg-red-900 border border-red-700/60 disabled:opacity-30 text-red-200 p-2.5 sm:p-3 rounded-xl transition-all shrink-0 shadow-[0_0_12px_rgba(220,38,38,0.4)]"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
