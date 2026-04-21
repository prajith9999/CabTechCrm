import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Download } from 'lucide-react';
import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5101/api').replace(/\/$/, '');

export default function PDFViewerModal({ attachmentId, onClose }) {
  const [pdfUrl, setPdfUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let url = '';
    const fetchPdf = async () => {
      try {
        const response = await axios.get(`${API_BASE}/Integration/attachments/${attachmentId}`, {
          responseType: 'blob'
        });
        url = URL.createObjectURL(response.data);
        setPdfUrl(url);
      } catch (e) {
        console.error("Failed to load PDF", e);
      } finally {
        setLoading(false);
      }
    };
    fetchPdf();
    
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachmentId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-none shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col flex-1 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">Document Viewer</h2>
          <div className="flex items-center gap-2">
            {pdfUrl && (
              <>
                <a href={pdfUrl} target="_blank" rel="noreferrer" className="p-2 text-slate-600 hover:text-indigo-600 transition-colors">
                  <ExternalLink size={20} />
                </a>
                <a href={pdfUrl} download={`document-${attachmentId}.pdf`} className="p-2 text-slate-600 hover:text-indigo-600 transition-colors">
                  <Download size={20} />
                </a>
              </>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-none transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-100 relative">
            {loading ? (
               <div className="absolute inset-0 flex items-center justify-center text-slate-500">Loading document...</div>
            ) : pdfUrl ? (
               <iframe src={pdfUrl} className="w-full h-full border-none" title="PDF Viewer" />
            ) : (
               <div className="absolute inset-0 flex items-center justify-center text-red-500">Failed to load document</div>
            )}
        </div>
      </div>
    </div>
  );
}
