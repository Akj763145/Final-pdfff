import { HashRouter, Routes, Route, Link, useNavigate } from 'react-router';
import React, { useState, useEffect, useRef } from 'react';
import { FileText, Upload, Trash2, Download, Lock, LogOut, File, AlertCircle, CheckCircle2, ChevronRight, Search, Loader2, Folder as FolderIcon, FolderPlus, ArrowLeft, Moon, Sun, MoreVertical, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

// --- Types ---
interface Folder {
  id: string;
  name: string;
  created_at: string;
}

interface PdfFile {
  id: string;
  filename: string;
  uploadDate: string;
  size: number;
  folderId: string | null;
  isLink?: boolean;
  link?: string | null;
}

// --- Helper Components ---
function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatDate(isoString: string) {
  return format(new Date(isoString), 'MMM d, yyyy • h:mm a');
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark') || 
                       localStorage.getItem('theme') === 'dark' || 
                       (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDark(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <button 
      onClick={toggle} 
      className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500 dark:text-zinc-400"
      aria-label="Toggle dark mode"
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}

// --- Client Portal ---
function ClientPortal() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [pdfs, setPdfs] = useState<PdfFile[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'downloads'>('all');
  const [downloadedPdfIds, setDownloadedPdfIds] = useState<string[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('downloadedPdfs');
    if (stored) {
      try {
        setDownloadedPdfIds(JSON.parse(stored));
      } catch (e) {}
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [foldersRes, pdfsRes] = await Promise.all([
        fetch('/api/folders'),
        fetch('/api/pdfs')
      ]);
      
      if (!foldersRes.ok || !pdfsRes.ok) {
        throw new Error('Failed to fetch data. Did you run the SQL script in Supabase?');
      }
      
      const foldersData = await foldersRes.json();
      const pdfsData = await pdfsRes.json();
      
      setFolders(foldersData);
      setPdfs(pdfsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (pdf: PdfFile) => {
    if (pdf.isLink && pdf.link) {
      window.open(pdf.link, '_blank');
    } else {
      const a = document.createElement('a');
      a.href = `/api/pdfs/${pdf.id}/download`;
      a.download = pdf.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    setDownloadedPdfIds(prev => {
      if (!prev.includes(pdf.id)) {
        const next = [...prev, pdf.id];
        localStorage.setItem('downloadedPdfs', JSON.stringify(next));
        return next;
      }
      return prev;
    });
  };

  const displayedPdfs = pdfs.filter(pdf => {
    if (viewMode === 'downloads') {
      if (!downloadedPdfIds.includes(pdf.id)) return false;
      return pdf.filename.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return (searchQuery ? true : (currentFolder ? pdf.folderId === currentFolder.id : !pdf.folderId)) &&
    pdf.filename.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200">
      <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-20 transition-colors duration-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 dark:bg-indigo-500 rounded-lg flex items-center justify-center shadow-sm shadow-indigo-200 dark:shadow-none">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Pdfplace</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link 
              to="/about" 
              className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              About
            </Link>
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                aria-label="Menu"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              
              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden z-50 py-1"
                  >
                    <button 
                      onClick={() => { 
                        setViewMode(viewMode === 'all' ? 'downloads' : 'all'); 
                        setCurrentFolder(null); 
                        setIsMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2 transition-colors ${viewMode === 'downloads' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                    >
                      <Download className="w-4 h-4" />
                      My Downloads
                    </button>
                    <Link 
                      to="/admin" 
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex items-center gap-2 transition-colors"
                    >
                      <Lock className="w-4 h-4" />
                      Admin Access
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        {(currentFolder || viewMode === 'downloads') && !searchQuery ? (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-12 flex items-center gap-4"
          >
            <button 
              onClick={() => {
                if (viewMode === 'downloads') setViewMode('all');
                else setCurrentFolder(null);
              }} 
              className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-sm dark:shadow-none"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </button>
            <div>
              <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                {viewMode === 'downloads' ? 'My Downloads' : currentFolder?.name}
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                {viewMode === 'downloads' ? 'Viewing your downloaded documents.' : 'Viewing documents in this genre.'}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight mb-4">
              Free pdf portal
            </h2>
            <p className="text-lg text-zinc-500 dark:text-zinc-400 mb-8">
              Access and download the latest resources, guides, and official documents securely from our cloud vault.
            </p>
            
            <div className="relative max-w-md mx-auto">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
              </div>
              <input
                type="text"
                placeholder="Search all documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-11 pr-4 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-500 transition-all shadow-sm dark:shadow-none"
              />
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8 p-4 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl flex items-start gap-3 text-red-700 dark:text-red-400 max-w-2xl mx-auto">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </motion.div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800/50 p-6 h-56 animate-pulse shadow-sm dark:shadow-none">
                <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl mb-5"></div>
                <div className="h-5 bg-zinc-100 dark:bg-zinc-800 rounded-md w-3/4 mb-3"></div>
                <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded-md w-1/2 mb-8"></div>
                <div className="h-11 bg-zinc-100 dark:bg-zinc-800 rounded-xl w-full mt-auto"></div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {!currentFolder && !searchQuery && viewMode === 'all' && folders.length > 0 && (
              <div className="mb-12">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">Genres / Folders</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {folders.map(folder => (
                    <button 
                      key={folder.id}
                      onClick={() => setCurrentFolder(folder)}
                      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl flex items-center gap-4 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:shadow-md hover:shadow-indigo-500/5 dark:hover:shadow-none transition-all group text-left"
                    >
                      <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 transition-colors shrink-0">
                        <FolderIcon className="w-6 h-6 fill-indigo-100 dark:fill-indigo-500/20" />
                      </div>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-50 truncate text-lg">{folder.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                {searchQuery ? 'Search Results' : (viewMode === 'downloads' ? 'Downloaded Documents' : (currentFolder ? 'Documents in Genre' : 'Uncategorized Documents'))}
              </h3>
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                {displayedPdfs.length} files
              </span>
            </div>

            {displayedPdfs.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 border-dashed p-16 text-center max-w-2xl mx-auto"
              >
                <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-5">
                  <File className="w-10 h-10 text-zinc-300 dark:text-zinc-600" />
                </div>
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">No documents found</h3>
                <p className="text-zinc-500 dark:text-zinc-400">
                  {searchQuery ? "Try adjusting your search terms." : "This section is currently empty."}
                </p>
              </motion.div>
            ) : (
              <motion.div 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0 },
                  show: {
                    opacity: 1,
                    transition: { staggerChildren: 0.05 }
                  }
                }}
              >
                <AnimatePresence>
                  {displayedPdfs.map(pdf => (
                    <motion.div 
                      key={pdf.id} 
                      layout
                      variants={{
                        hidden: { opacity: 0, y: 20 },
                        show: { opacity: 1, y: 0 }
                      }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col hover:shadow-xl hover:shadow-zinc-200/40 dark:hover:shadow-none hover:-translate-y-1 transition-all duration-300 group"
                    >
                      <div className="w-12 h-12 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center mb-5 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 transition-colors">
                        <FileText className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2 line-clamp-2 leading-tight" title={pdf.filename}>
                        {pdf.filename}
                      </h3>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
                        <span>{formatDate(pdf.uploadDate)}</span>
                      </div>
                      <div className="mt-auto flex gap-2">
                        <button
                          onClick={() => window.open(pdf.isLink && pdf.link ? pdf.link : `/api/pdfs/${pdf.id}/view`, '_blank')}
                          className="flex-1 flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 py-3 px-4 rounded-xl font-medium transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        <button
                          onClick={() => handleDownload(pdf)}
                          className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-indigo-600 dark:hover:bg-indigo-500 text-white dark:text-zinc-900 py-3 px-4 rounded-xl font-medium transition-colors shadow-sm dark:shadow-none"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-200 dark:border-zinc-800 py-8 text-center bg-white dark:bg-zinc-900 transition-colors duration-200">
        <p className="text-zinc-500 dark:text-zinc-400 font-medium">proudly made by bihari</p>
        <p className="text-zinc-400 dark:text-zinc-500 text-sm mt-1">By - Ayush and Ayush</p>
      </footer>
    </div>
  );
}

// --- Admin Login ---
function AdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (!res.ok) {
        throw new Error('Invalid password');
      }

      const data = await res.json();
      onLogin(data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-4 relative overflow-hidden transition-colors duration-200">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-3xl"></div>

      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2rem] shadow-xl shadow-zinc-200/50 dark:shadow-none border border-white dark:border-zinc-800 p-8 sm:p-10 relative z-10"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-zinc-900/20 dark:shadow-none">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Admin Access</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-3 text-sm">Enter your credentials to manage the document vault.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 bg-zinc-50/50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-500 outline-none transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500"
              placeholder="Enter password (admin)"
              required
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-sm rounded-xl flex items-center gap-2 border border-red-100 dark:border-red-500/20">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 px-4 rounded-xl font-semibold transition-all shadow-md shadow-indigo-600/20 dark:shadow-none disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors inline-flex items-center gap-1">
            &larr; Back to Portal
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

// --- Admin Dashboard ---
function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [pdfs, setPdfs] = useState<PdfFile[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [uploadFolderId, setUploadFolderId] = useState<string>('');
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkFilename, setLinkFilename] = useState('');
  const [uploadingLink, setUploadingLink] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'folder' | 'pdf', id: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setUploadFolderId(currentFolder ? currentFolder.id : '');
  }, [currentFolder]);

  const fetchData = async () => {
    try {
      const [foldersRes, pdfsRes] = await Promise.all([
        fetch('/api/folders'),
        fetch('/api/pdfs')
      ]);
      
      if (!foldersRes.ok || !pdfsRes.ok) {
        throw new Error('Failed to fetch data. Did you run the SQL script in Supabase?');
      }
      
      const foldersData = await foldersRes.json();
      const pdfsData = await pdfsRes.json();
      
      setFolders(foldersData);
      setPdfs(pdfsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (pdf: PdfFile) => {
    if (pdf.isLink && pdf.link) {
      window.open(pdf.link, '_blank');
      return;
    }
    const a = document.createElement('a');
    a.href = `/api/pdfs/${pdf.id}/download`;
    a.download = pdf.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    setError('');
    
    try {
      const res = await fetch('/api/admin/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newFolderName.trim() })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create folder');
      }

      setSuccess('Genre folder created successfully');
      setNewFolderName('');
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    setDeleteConfirm({ type: 'folder', id });
  };

  const confirmDeleteFolder = async (id: string) => {
    setDeleteConfirm(null);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/admin/folders/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }

      setSuccess('Folder and its documents deleted successfully');
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLinkUpload = async () => {
    if (!linkUrl.trim() || !linkFilename.trim()) {
      setError('Please provide both a link and a filename');
      return;
    }
    
    setUploadingLink(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch('/api/admin/upload-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          filename: linkFilename.trim(),
          link: linkUrl.trim(),
          folderId: uploadFolderId || null
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to upload link');
      }

      setSuccess('Link added successfully');
      setLinkUrl('');
      setLinkFilename('');
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingLink(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setError('');
    setSuccess('');
    setUploading(true);

    let successCount = 0;
    let failCount = 0;

    for (const file of files) {
      if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) {
        failCount++;
        continue;
      }

      const formData = new FormData();
      formData.append('pdf', file);
      if (uploadFolderId) {
        formData.append('folderId', uploadFolderId);
      }

      try {
        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    if (successCount > 0) {
      setSuccess(`Successfully uploaded ${successCount} file(s)`);
      fetchData();
    }
    if (failCount > 0) {
      setError(`Failed to upload ${failCount} file(s). Ensure they are PDFs under 10MB.`);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    setUploading(false);
    setTimeout(() => {
      setSuccess('');
      setError('');
    }, 5000);
  };

  const handleDeletePdf = async (id: string) => {
    setDeleteConfirm({ type: 'pdf', id });
  };

  const confirmDeletePdf = async (id: string) => {
    setDeleteConfirm(null);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/admin/pdfs/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }

      setSuccess('File deleted successfully');
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const displayedPdfs = pdfs.filter(pdf => 
    currentFolder ? pdf.folderId === currentFolder.id : !pdf.folderId
  );

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-20 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-zinc-900 dark:bg-zinc-100 rounded-lg flex items-center justify-center">
              <Lock className="w-4 h-4 text-white dark:text-zinc-900" />
            </div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <Link 
              to="/about" 
              className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 hidden sm:block"
            >
              About
            </Link>
            <Link 
              to="/" 
              className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 hidden sm:block"
            >
              View Portal
            </Link>
            <button 
              onClick={onLogout}
              className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1.5 transition-colors bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 px-3 py-1.5 rounded-lg"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        
        {/* Global Error/Success Messages */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 rounded-2xl flex items-start gap-3 border border-red-100 dark:border-red-500/20 shadow-sm dark:shadow-none">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="font-medium">{error}</p>
            </motion.div>
          )}
          {success && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-2xl flex items-start gap-3 border border-emerald-100 dark:border-emerald-500/20 shadow-sm dark:shadow-none">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="font-medium">{success}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Create Folder & Upload */}
          <div className="lg:col-span-4 space-y-6">
            
            {!currentFolder && (
              <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm dark:shadow-none">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-6 tracking-tight">Create Genre</h2>
                <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="e.g. Sci-Fi, Fantasy..." 
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    className="w-full px-4 py-3.5 bg-zinc-50/50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-500 outline-none transition-all text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500"
                  />
                  <button 
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim() || creatingFolder}
                    className="w-full bg-zinc-900 dark:bg-zinc-100 hover:bg-indigo-600 dark:hover:bg-indigo-500 text-white dark:text-zinc-900 py-3.5 px-4 rounded-xl font-semibold transition-all shadow-sm dark:shadow-none disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {creatingFolder ? <Loader2 className="w-5 h-5 animate-spin" /> : <FolderPlus className="w-5 h-5" />}
                    Create Folder
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm dark:shadow-none sticky top-24">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                  Upload Document(s)
                </h2>
                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                  <button
                    onClick={() => setUploadMode('file')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${uploadMode === 'file' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                  >
                    File
                  </button>
                  <button
                    onClick={() => setUploadMode('link')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${uploadMode === 'link' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                  >
                    Link
                  </button>
                </div>
              </div>
              
              <div className="mb-5">
                <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Destination Folder</label>
                <select
                  value={uploadFolderId}
                  onChange={(e) => setUploadFolderId(e.target.value)}
                  disabled={uploading}
                  className="w-full px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-500 outline-none transition-all text-zinc-900 dark:text-zinc-100 cursor-pointer disabled:opacity-50"
                >
                  <option value="">Uncategorized (Root)</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              
              {uploadMode === 'file' ? (
                <div 
                  className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 ${
                    uploading 
                      ? 'border-indigo-300 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/10' 
                      : 'border-zinc-300 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-500/10 bg-zinc-50/50 dark:bg-zinc-800/30'
                  }`}
                >
                  <div className={`w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center ${uploading ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'bg-white dark:bg-zinc-800 shadow-sm dark:shadow-none text-zinc-400 dark:text-zinc-500'}`}>
                    {uploading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                  </div>
                  
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
                    {uploading ? 'Uploading to cloud...' : 'Select PDF files'}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Max size: 10MB per file</p>
                  
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    ref={fileInputRef}
                    disabled={uploading}
                  />
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 py-3 px-4 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 shadow-sm dark:shadow-none"
                  >
                    Browse Files
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Filename</label>
                    <input
                      type="text"
                      value={linkFilename}
                      onChange={(e) => setLinkFilename(e.target.value)}
                      placeholder="e.g. Important Document.pdf"
                      disabled={uploadingLink}
                      className="w-full px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-500 outline-none transition-all text-zinc-900 dark:text-zinc-100 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Link URL</label>
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://example.com/document.pdf"
                      disabled={uploadingLink}
                      className="w-full px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-500 outline-none transition-all text-zinc-900 dark:text-zinc-100 disabled:opacity-50"
                    />
                  </div>
                  <button
                    onClick={handleLinkUpload}
                    disabled={uploadingLink || !linkUrl.trim() || !linkFilename.trim()}
                    className="w-full bg-zinc-900 dark:bg-zinc-100 hover:bg-indigo-600 dark:hover:bg-indigo-500 text-white dark:text-zinc-900 px-6 py-3 rounded-xl font-semibold transition-all shadow-sm dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {uploadingLink ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    {uploadingLink ? 'Adding Link...' : 'Add Link'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Vault Manager */}
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none overflow-hidden flex flex-col h-full min-h-[500px]">
              <div className="px-6 sm:px-8 py-6 border-b border-zinc-100 dark:border-zinc-800/50 flex items-center justify-between bg-white dark:bg-zinc-900">
                <div className="flex items-center gap-4">
                  {currentFolder && (
                    <button 
                      onClick={() => setCurrentFolder(null)} 
                      className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                    </button>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                      {currentFolder ? currentFolder.name : 'Manage Vault'}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      {currentFolder ? 'Manage documents in this genre.' : 'Select a genre or manage uncategorized documents.'}
                    </p>
                  </div>
                </div>
                <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold px-3 py-1.5 rounded-full">
                  {currentFolder ? displayedPdfs.length : folders.length + displayedPdfs.length} Items
                </div>
              </div>
              
              <div className="flex-1 bg-zinc-50/30 dark:bg-zinc-950/50 p-4 sm:p-6 space-y-8">
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-20 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800/50 rounded-2xl animate-pulse"></div>
                    ))}
                  </div>
                ) : (
                  <>
                    {!currentFolder && folders.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4 px-2">Genres / Folders</h3>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {folders.map(folder => (
                            <li 
                              key={folder.id} 
                              onClick={() => setCurrentFolder(folder)}
                              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:shadow-md hover:shadow-indigo-500/5 dark:hover:shadow-none transition-all flex items-center justify-between group cursor-pointer"
                            >
                              <div className="flex items-center gap-4 min-w-0">
                                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 transition-colors">
                                  <FolderIcon className="w-6 h-6 fill-indigo-100 dark:fill-indigo-500/20" />
                                </div>
                                <span className="font-semibold text-zinc-900 dark:text-zinc-50 truncate text-lg">{folder.name}</span>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                                className="p-2.5 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                                title="Delete folder"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div>
                      <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4 px-2">
                        {currentFolder ? 'Documents' : 'Uncategorized Documents'}
                      </h3>
                      
                      {displayedPdfs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 border-dashed rounded-3xl">
                          <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
                            <File className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
                          </div>
                          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">No documents here</h3>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Upload a PDF to get started.</p>
                        </div>
                      ) : (
                        <ul className="space-y-3">
                          <AnimatePresence>
                            {displayedPdfs.map(pdf => (
                              <motion.li 
                                key={pdf.id}
                                layout
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98, height: 0, marginBottom: 0 }}
                                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:px-6 rounded-2xl hover:border-indigo-200 dark:hover:border-indigo-500/30 hover:shadow-md hover:shadow-indigo-500/5 dark:hover:shadow-none transition-all flex items-center justify-between gap-4 group"
                              >
                                <div className="flex items-center gap-4 sm:gap-5 min-w-0">
                                  <div className="w-12 h-12 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 transition-colors">
                                    <FileText className="w-6 h-6" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50 truncate" title={pdf.filename}>
                                      {pdf.filename}
                                    </p>
                                    <div className="flex items-center gap-2 sm:gap-3 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                                      <span className="font-medium text-zinc-600 dark:text-zinc-300">{formatBytes(pdf.size)}</span>
                                      <span className="text-zinc-300 dark:text-zinc-600">&bull;</span>
                                      <span>{formatDate(pdf.uploadDate)}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={() => window.open(pdf.isLink && pdf.link ? pdf.link : `/api/pdfs/${pdf.id}/view`, '_blank')}
                                    className="p-2.5 text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-colors"
                                    title="View document"
                                  >
                                    <Eye className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleDownload(pdf)}
                                    className="p-2.5 text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-colors"
                                    title="Download document"
                                  >
                                    <Download className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePdf(pdf.id)}
                                    className="p-2.5 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                                    title="Delete document"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              </motion.li>
                            ))}
                          </AnimatePresence>
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-200 dark:border-zinc-800 py-8 text-center bg-white dark:bg-zinc-900 transition-colors duration-200">
        <p className="text-zinc-500 dark:text-zinc-400 font-medium">proudly made by bihari</p>
        <p className="text-zinc-400 dark:text-zinc-500 text-sm mt-1">By - Ayush and Ayush</p>
      </footer>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800"
            >
              <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-center text-zinc-900 dark:text-zinc-50 mb-2">
                {deleteConfirm.type === 'folder' ? 'Delete Genre?' : 'Delete Document?'}
              </h3>
              <p className="text-center text-zinc-500 dark:text-zinc-400 mb-8">
                {deleteConfirm.type === 'folder' 
                  ? 'Are you sure you want to delete this genre? ALL documents inside it will also be deleted permanently. This action cannot be undone.'
                  : 'Are you sure you want to delete this document? This action cannot be undone.'}
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteConfirm.type === 'folder' ? confirmDeleteFolder(deleteConfirm.id) : confirmDeletePdf(deleteConfirm.id)}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors shadow-sm shadow-red-600/20 dark:shadow-none"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- About Page ---
function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200">
      <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-20 transition-colors duration-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 dark:bg-indigo-500 rounded-lg flex items-center justify-center shadow-sm shadow-indigo-200 dark:shadow-none">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">Pdfplace</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link 
              to="/" 
              className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 flex-1 w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 md:p-12 shadow-sm dark:shadow-none"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight mb-6">
            About Us
          </h2>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8 leading-relaxed">
            Welcome to Pdfplace, your secure cloud vault for accessing and managing the latest resources, guides, and official documents. We are dedicated to providing a seamless and organized experience for all your PDF needs.
          </p>
          
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              Contact Information
            </h3>
            
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Email</p>
                  <a href="mailto:AK7631459148@GMAIL.COM" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    AK7631459148@GMAIL.COM
                  </a>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Phone</p>
                  <a href="tel:9708194665" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    9708194665
                  </a>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-200 dark:border-zinc-800 py-8 text-center bg-white dark:bg-zinc-900 transition-colors duration-200">
        <p className="text-zinc-500 dark:text-zinc-400 font-medium">proudly made by bihari</p>
        <p className="text-zinc-400 dark:text-zinc-500 text-sm mt-1">By - Ayush and Ayush</p>
      </footer>
    </div>
  );
}

// --- Main App Component ---
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ClientPortal />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/admin" element={<AdminRoute />} />
      </Routes>
    </HashRouter>
  );
}

function AdminRoute() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));

  const handleLogin = (newToken: string) => {
    localStorage.setItem('adminToken', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
  };

  if (!token) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return <AdminDashboard token={token} onLogout={handleLogout} />;
}
