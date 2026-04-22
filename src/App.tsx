/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  UserPlus, 
  Image as ImageIcon, 
  Zap, 
  ArrowRight, 
  Loader2,
  Download,
  BookOpen,
  Layout as LayoutIcon,
  Wand2,
  FileText,
  Sparkles,
  X,
  ChevronRight,
  ChevronLeft,
  Columns
} from 'lucide-react';
import { Character, Panel, MangaStyle, MangaPage, PageLayout } from './types';
import { generateMangaPanel, parseMangaStoryboard } from './services/gemini';
import { cn } from './lib/utils';

export default function App() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [pages, setPages] = useState<MangaPage[]>([
    { 
      id: 'p1', 
      title: '第1話', 
      layout: 'LAYOUT_3_A', 
      panels: [
        { id: '1', description: 'ヒーローが荒野に立っている', style: 'Standard Manga' }
      ] 
    }
  ]);
  const [selectedStyle, setSelectedStyle] = useState<MangaStyle>('Standard Manga');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [kikakushoText, setKikakushoText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [currentPagePreviewIdx, setCurrentPagePreviewIdx] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddCharacter = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const newChar: Character = {
        id: Math.random().toString(36).substr(2, 9),
        name: `キャラ ${characters.length + 1}`,
        imageUrl: base64,
      };
      setCharacters([...characters, newChar]);
    };
    reader.readAsDataURL(file);
  };

  const handleParseKikakusho = async () => {
    if (!kikakushoText) return;
    setIsParsing(true);
    try {
      const parsedPanels = await parseMangaStoryboard(kikakushoText);
      // Group panels into pages of 3 by default
      const newPages: MangaPage[] = [];
      const CHUNK_SIZE = 3;
      for (let i = 0; i < parsedPanels.length; i += CHUNK_SIZE) {
        const chunk = parsedPanels.slice(i, i + CHUNK_SIZE);
        newPages.push({
          id: Math.random().toString(36).substr(2, 9),
          title: `ページ ${newPages.length + (pages.length > 0 ? pages.length + 1 : 1)}`,
          layout: i === 0 ? 'TITLE_SINGLE' : (chunk.length === 3 ? 'LAYOUT_3_A' : 'LAYOUT_4_A'),
          panels: chunk.map(p => ({
            id: Math.random().toString(36).substr(2, 9),
            description: p.description,
            style: p.style as MangaStyle,
          }))
        });
      }
      setPages([...pages, ...newPages]);
      setIsAiModalOpen(false);
      setKikakushoText('');
    } catch (error: any) {
      console.error("Parsing failed", error);
      alert("生成または解析に失敗しました。APIキーが正しく設定されているか確認してください。");
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddPage = () => {
    const newPage: MangaPage = {
      id: Math.random().toString(36).substr(2, 9),
      title: `ページ ${pages.length + 1}`,
      layout: 'LAYOUT_3_A',
      panels: []
    };
    setPages([...pages, newPage]);
  };

  const handleDeletePage = (id: string) => {
    setPages(pages.filter(p => p.id !== id));
  };

  const handleAddPanelToPage = (pageId: string) => {
    setPages(pages.map(page => {
      if (page.id === pageId) {
        return {
          ...page,
          panels: [
            ...page.panels,
            { id: Math.random().toString(36).substr(2, 9), description: '', style: selectedStyle }
          ]
        };
      }
      return page;
    }));
  };

  const handleUpdatePanel = (pageId: string, panelId: string, updates: Partial<Panel>) => {
    setPages(pages.map(page => {
      if (page.id === pageId) {
        return {
          ...page,
          panels: page.panels.map(p => p.id === panelId ? { ...p, ...updates } : p)
        };
      }
      return page;
    }));
  };

  const handleDeletePanel = (pageId: string, panelId: string) => {
    setPages(pages.map(page => {
      if (page.id === pageId) {
        return {
          ...page,
          panels: page.panels.filter(p => p.id !== panelId)
        };
      }
      return page;
    }));
  };

  const handleUpdatePageLayout = (pageId: string, layout: PageLayout) => {
    setPages(pages.map(page => page.id === pageId ? { ...page, layout } : page));
  };

  const handleGenerate = async (pageId: string, panelId: string) => {
    const page = pages.find(p => p.id === pageId);
    const panel = page?.panels.find(p => p.id === panelId);
    if (!panel) return;

    const characterRef = characters[0]?.imageUrl;

    handleUpdatePanel(pageId, panelId, { isGenerating: true });
    try {
      const imageUrl = await generateMangaPanel(panel.description, panel.style, characterRef);
      handleUpdatePanel(pageId, panelId, { imageUrl, isGenerating: false });
    } catch (error) {
      console.error("Generation failed", error);
      handleUpdatePanel(pageId, panelId, { isGenerating: false });
      alert("生成に失敗しました。再試行してください。");
    }
  };

  const layouts: { type: PageLayout, label: string, icon: any }[] = [
    { type: 'TITLE_SINGLE', label: 'タイトル1P', icon: FileText },
    { type: 'TITLE_SPREAD', label: 'タイトル見開き', icon: Columns },
    { type: 'LAYOUT_3_A', label: '3コマ', icon: LayoutIcon },
    { type: 'LAYOUT_4_A', label: '4コマ', icon: LayoutIcon },
    { type: 'LAYOUT_5_A', label: '5コマ', icon: LayoutIcon },
  ];

  const renderPagePreview = (page: MangaPage) => {
    const isSpread = page.layout === 'TITLE_SPREAD';
    const width = isSpread ? 'w-[960px]' : 'w-[480px]';
    
    return (
      <div className={cn(
        "h-[640px] bg-white shadow-[0_0_100px_rgba(0,0,0,0.8)] p-6 flex flex-col gap-6 origin-center transition-all",
        width
      )}>
        <div className="flex justify-between items-end border-b-[3px] border-black pb-3">
          <h2 className="text-3xl font-black italic tracking-tighter uppercase text-black serif">{page.title}</h2>
          <div className="text-right text-black">
            <span className="text-[10px] font-bold block opacity-40 uppercase tracking-widest leading-none">CHAPTER 01</span>
            <span className="text-xs font-black">VOL. 01</span>
          </div>
        </div>

        <div className={cn(
          "grid flex-1 overflow-hidden gap-3",
          page.layout === 'TITLE_SPREAD' && "grid-cols-2 grid-rows-1",
          page.layout === 'TITLE_SINGLE' && "grid-cols-1 grid-rows-1",
          page.layout === 'LAYOUT_3_A' && "grid-cols-2 grid-rows-2",
          page.layout === 'LAYOUT_4_A' && "grid-cols-2 grid-rows-2",
          page.layout === 'LAYOUT_5_A' && "grid-cols-2 grid-rows-3",
        )}>
          {page.panels.map((panel, idx) => {
            let gridSpan = "";
            if (page.layout === 'TITLE_SPREAD') gridSpan = "col-span-2";
            if (page.layout === 'LAYOUT_3_A' && idx === 0) gridSpan = "col-span-2";
            if (page.layout === 'LAYOUT_5_A' && idx === 0) gridSpan = "col-span-2";

            return (
              <div 
                key={panel.id} 
                className={cn(
                  "border-[3px] border-black relative overflow-hidden bg-neutral-100 flex items-center justify-center",
                  gridSpan
                )}
              >
                {panel.imageUrl ? (
                  <img src={panel.imageUrl} className="w-full h-full object-contain" alt="" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-10 text-black">
                    <ImageIcon size={48} />
                    <span className="font-black italic text-sm">PANEL {idx + 1}</span>
                  </div>
                )}
                <div className="absolute top-2 right-2 border-2 border-black p-1 text-[8px] bg-white font-bold text-black uppercase">
                  P.{idx + 1}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="mt-auto pt-4 border-t-[3px] border-black flex items-center justify-between">
          <p className="text-[8px] font-bold text-black opacity-40 italic">© 2026 nanobanana2 / AIS PRODUCTION</p>
          <div className="flex gap-4">
            <span className="text-[8px] font-bold text-black uppercase tracking-widest">LAYOUT: {page.layout}</span>
          </div>
        </footer>
      </div>
    );
  };

  const styles: MangaStyle[] = ['Hokuto no Ken', 'Dragon Ball', 'Standard Manga', 'Noir', 'Sci-Fi'];

  return (
    <div className="min-h-screen bg-surface-bg text-[#e5e5e5] font-sans flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-surface-border glass flex items-center justify-between sticky top-0 z-50 px-6">
        <div className="flex items-center gap-4">
          <div className="text-amber-500 font-black text-xl tracking-tighter">
            nanobanana<span className="text-white">2</span>
          </div>
          <div className="h-4 w-px bg-neutral-700 hidden sm:block"></div>
          <h1 className="text-sm text-neutral-400 serif hidden sm:block">Manga Creator</h1>
        </div>
        
        <nav className="flex items-center gap-1 bg-neutral-950/50 p-1 rounded-lg border border-surface-border">
          <button 
            onClick={() => setActiveTab('editor')}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2",
              activeTab === 'editor' ? "bg-neutral-800 text-amber-500 shadow-sm" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            <BookOpen size={14} /> エディター
          </button>
          <button 
            onClick={() => setActiveTab('preview')}
            className={cn(
              "px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2",
              activeTab === 'preview' ? "bg-neutral-800 text-amber-500 shadow-sm" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            <LayoutIcon size={14} /> プレビュー
          </button>
        </nav>

        <div className="flex items-center gap-4">
          <button className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-black rounded hover:bg-amber-500 transition-colors">
            エクスポート
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-surface-border bg-neutral-900/50 p-6 flex flex-col overflow-y-auto gap-8">
          <section>
            <h2 className="text-[10px] font-black uppercase tracking-widest mb-4 text-neutral-500">スタイル選択</h2>
            <div className="grid grid-cols-2 gap-2">
              {styles.map(style => (
                <button
                  key={style}
                  onClick={() => setSelectedStyle(style)}
                  className={cn(
                    "p-2 rounded text-center cursor-pointer transition-all border text-[10px] font-bold h-16 flex flex-col items-center justify-center gap-1",
                    selectedStyle === style 
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]" 
                      : "border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                  )}
                >
                  <span className="text-lg font-black italic leading-none">
                    {style === 'Hokuto no Ken' && '北'}
                    {style === 'Dragon Ball' && '龍'}
                    {style === 'Standard Manga' && '標'}
                    {style === 'Noir' && '闇'}
                    {style === 'Sci-Fi' && 'SF'}
                  </span>
                  <span className="truncate w-full block">
                    {style.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[10px] font-black uppercase tracking-widest mb-4 text-neutral-500">人物登録</h2>
            <div className="space-y-3">
              {characters.map(char => (
                <div key={char.id} className="flex items-center gap-3 p-2 bg-neutral-800/40 rounded border border-neutral-700/50 group relative">
                  <img 
                    src={char.imageUrl} 
                    alt={char.name} 
                    className="w-10 h-10 object-cover rounded border border-neutral-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">{char.name}</div>
                    <div className="text-[9px] text-neutral-500">登録済み / 参照用</div>
                  </div>
                  <button 
                    onClick={() => setCharacters(characters.filter(c => c.id !== char.id))}
                    className="absolute right-2 text-neutral-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <label className="flex items-center gap-3 p-3 border border-dashed border-neutral-700 rounded-lg cursor-pointer hover:bg-neutral-800/30 transition-all group">
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleAddCharacter}
                  ref={fileInputRef}
                />
                <div className="w-10 h-10 border border-dashed border-neutral-700 rounded flex items-center justify-center text-neutral-500 group-hover:text-amber-500 group-hover:border-amber-500/50">
                  <UserPlus size={18} />
                </div>
                <span className="text-xs text-neutral-500 group-hover:text-neutral-300">アップロード</span>
              </label>
            </div>
          </section>
          
          <div className="mt-auto p-4 bg-amber-500/5 rounded border border-amber-500/10">
            <p className="text-[10px] leading-relaxed text-neutral-500 italic">
              GPU ACCELERATION: ON<br/>
              STYLE ENGINE: NB2-V3
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-10 bg-black flex flex-col items-center">
          {activeTab === 'editor' ? (
            <div className="w-full max-w-4xl space-y-12">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight mb-1 serif">Storyboard Editor</h2>
                  <p className="text-neutral-500 text-xs font-medium">ページとコマを構成してください</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsAiModalOpen(true)}
                    className="flex items-center gap-2 bg-amber-600/10 text-amber-500 px-5 py-2.5 rounded-md text-xs font-bold hover:bg-amber-600/20 transition-all border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.05)]"
                  >
                    <Wand2 size={16} /> 企画書から自動生成
                  </button>
                  <button 
                    onClick={handleAddPage}
                    className="flex items-center gap-2 bg-neutral-800 text-white px-5 py-2.5 rounded-md text-xs font-bold hover:bg-neutral-700 transition-all border border-neutral-700"
                  >
                    <Plus size={16} /> ページを追加
                  </button>
                </div>
              </div>

              {/* Pages in Editor */}
              <div className="space-y-16">
                {pages.map((page, pageIdx) => (
                  <section key={page.id} className="relative">
                    <div className="flex items-center justify-between mb-6 pb-2 border-b border-neutral-800">
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-black text-amber-500 italic">PAGE 0{pageIdx + 1}</span>
                        <input 
                          value={page.title}
                          onChange={(e) => setPages(pages.map(p => p.id === page.id ? { ...p, title: e.target.value } : p))}
                          className="bg-transparent border-none text-white font-bold outline-none focus:ring-1 focus:ring-amber-500/30 rounded px-2"
                        />
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="flex bg-neutral-900 p-1 rounded-lg border border-neutral-800">
                          {layouts.map(layout => (
                            <button
                              key={layout.type}
                              onClick={() => handleUpdatePageLayout(page.id, layout.type)}
                              className={cn(
                                "px-3 py-1 rounded text-[10px] font-bold transition-all",
                                page.layout === layout.type ? "bg-amber-600 text-black" : "text-neutral-500 hover:text-neutral-300"
                              )}
                              title={layout.label}
                            >
                              <layout.icon size={14} />
                            </button>
                          ))}
                        </div>
                        <button 
                          onClick={() => handleDeletePage(page.id)}
                          className="text-neutral-600 hover:text-red-500 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      <AnimatePresence initial={false}>
                        {page.panels.map((panel, panelIdx) => (
                          <motion.div
                            key={panel.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-neutral-900/30 rounded-xl p-5 border border-neutral-800/50 flex flex-col md:flex-row gap-6 group"
                          >
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-neutral-600 tracking-widest">PANEL {panelIdx + 1}</span>
                                <button 
                                  onClick={() => handleDeletePanel(page.id, panel.id)}
                                  className="text-neutral-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              <textarea
                                placeholder="シーンを描写..."
                                className="w-full h-24 p-3 bg-black border border-neutral-800 rounded-lg text-sm text-neutral-300 focus:border-amber-600 outline-none transition-all resize-none font-medium leading-relaxed"
                                value={panel.description}
                                onChange={(e) => handleUpdatePanel(page.id, panel.id, { description: e.target.value })}
                              />
                              <div className="flex items-center justify-between">
                                <div className="text-[10px] font-bold text-neutral-500 uppercase">Style: {panel.style}</div>
                                <button
                                  disabled={panel.isGenerating || !panel.description}
                                  onClick={() => handleGenerate(page.id, panel.id)}
                                  className={cn(
                                    "px-4 py-1.5 rounded text-[10px] font-bold transition-all",
                                    panel.isGenerating 
                                      ? "bg-neutral-800 text-neutral-600 cursor-not-allowed"
                                      : "bg-neutral-100 text-black hover:bg-white"
                                  )}
                                >
                                  {panel.isGenerating ? "生成中..." : "描く"}
                                </button>
                              </div>
                            </div>
                            <div className="w-32 h-32 bg-black border border-neutral-800 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                              {panel.imageUrl ? (
                                <img src={panel.imageUrl} className="w-full h-full object-contain" />
                              ) : (
                                <ImageIcon className="text-neutral-800" size={24} />
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      <button 
                        onClick={() => handleAddPanelToPage(page.id)}
                        className="py-3 border border-dashed border-neutral-800 rounded-lg text-neutral-600 hover:text-neutral-400 hover:border-neutral-600 transition-all text-xs font-bold flex items-center justify-center gap-2"
                      >
                        <Plus size={14} /> コマを追加
                      </button>
                    </div>
                  </section>
                ))}
              </div>

              {/* AI Modal */}
              <AnimatePresence>
                {isAiModalOpen && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-20">
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsAiModalOpen(false)}
                      className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-full"
                    >
                      <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
                            <Sparkles size={20} />
                          </div>
                          <div>
                            <h3 className="font-bold text-white tracking-tight">AI Storyboard Generator</h3>
                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">企画書・構成案をAIが解析</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setIsAiModalOpen(false)}
                          className="p-2 text-neutral-500 hover:text-white transition-colors"
                        >
                          <X size={20} />
                        </button>
                      </div>

                      <div className="p-6 flex-1 overflow-y-auto">
                        <textarea
                          className="w-full h-80 p-6 bg-black border border-neutral-800 rounded-xl text-neutral-200 text-sm focus:border-amber-600 outline-none transition-all resize-none"
                          placeholder="企画書を貼り付け..."
                          value={kikakushoText}
                          onChange={(e) => setKikakushoText(e.target.value)}
                        />
                      </div>

                      <div className="p-6 border-t border-neutral-800 bg-neutral-950 flex justify-end gap-3">
                        <button onClick={() => setIsAiModalOpen(false)} className="px-6 py-2.5 rounded text-xs text-neutral-400">キャンセル</button>
                        <button
                          disabled={!kikakushoText || isParsing}
                          onClick={handleParseKikakusho}
                          className="px-8 py-2.5 bg-amber-600 text-black rounded text-xs font-bold hover:bg-amber-500"
                        >
                          {isParsing ? "解析中..." : "全コマ割りを生成"}
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-12 pb-20">
              <div className="flex items-center gap-4 bg-neutral-900/50 p-2 rounded-full border border-neutral-800">
                <button 
                  onClick={() => setCurrentPagePreviewIdx(Math.max(0, currentPagePreviewIdx - 1))}
                  disabled={currentPagePreviewIdx === 0}
                  className="p-2 hover:bg-amber-500/10 hover:text-amber-500 disabled:opacity-20 transition-all rounded-full"
                >
                  <ChevronLeft size={24} />
                </button>
                <div className="px-6 text-xs font-black tracking-[0.3em] uppercase text-neutral-400">
                  PAGE {currentPagePreviewIdx + 1} / {pages.length}
                </div>
                <button 
                  onClick={() => setCurrentPagePreviewIdx(Math.min(pages.length - 1, currentPagePreviewIdx + 1))}
                  disabled={currentPagePreviewIdx === pages.length - 1}
                  className="p-2 hover:bg-amber-500/10 hover:text-amber-500 disabled:opacity-20 transition-all rounded-full"
                >
                  <ChevronRight size={24} />
                </button>
              </div>

              {pages.length > 0 && (
                <motion.div
                  key={currentPagePreviewIdx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="relative"
                >
                  {renderPagePreview(pages[currentPagePreviewIdx])}
                </motion.div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="h-14 border-t border-surface-border bg-neutral-950 flex items-center justify-between px-6">
        <div className="flex gap-6 uppercase tracking-wider text-[9px] text-neutral-600 font-mono">
          <span>GPU ACCELERATION: ON</span>
          <span className="text-amber-500/50 text-[10px] font-bold">© 2026 MANGABANANA AI PRODUCTION</span>
        </div>
        <button className="flex items-center gap-2 bg-amber-600 text-black px-6 py-2 rounded text-xs font-black uppercase hover:bg-amber-500 transition-all">
          Finalize & Export <ArrowRight size={16} />
        </button>
      </footer>
    </div>
  );
}
