import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { FolderPlus, Trash2, UploadCloud, BookOpen, ArrowLeft, Loader, FileText } from "lucide-react";

export default function KnowledgeBases() {
  const [kbs, setKbs] = useState([]);
  const [selectedKb, setSelectedKb] = useState(null);
  
  // Creation States
  const [isCreating, setIsCreating] = useState(false);
  const [newKbName, setNewKbName] = useState("");
  const [newKbDesc, setNewKbDesc] = useState("");
  
  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchKbs();
  }, []);

  const fetchKbs = async () => {
    try {
      setLoading(true);
      const data = await api.get("/knowledge-base");
      setKbs(data);
      setError(null);
    } catch (e) {
      setError(e.message || "Failed to load knowledge bases.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectKb = async (kbId) => {
    try {
      setLoading(true);
      const data = await api.get(`/knowledge-base/${kbId}`);
      setSelectedKb(data);
    } catch (e) {
      alert(e.message || "Failed to fetch knowledge base details.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKb = async (e) => {
    e.preventDefault();
    if (!newKbName.trim()) return;

    try {
      setLoading(true);
      await api.post("/knowledge-base", {
        name: newKbName,
        description: newKbDesc
      });
      setNewKbName("");
      setNewKbDesc("");
      setIsCreating(false);
      await fetchKbs();
    } catch (e) {
      alert(e.message || "Failed to create knowledge base.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKb = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this knowledge base? All uploaded documents and chat histories in this KB will be permanently deleted.")) return;

    try {
      await api.delete(`/knowledge-base/${id}`);
      if (selectedKb?.id === id) {
        setSelectedKb(null);
      }
      await fetchKbs();
    } catch (e) {
      alert(e.message || "Failed to delete knowledge base.");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedKb) return;

    try {
      setIsUploading(true);
      setUploadError(null);
      await api.upload(`/knowledge-base/${selectedKb.id}/upload`, file);
      await handleSelectKb(selectedKb.id);
    } catch (e) {
      setUploadError(e.message || "File upload failed.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!selectedKb || !confirm("Are you sure you want to delete this document?")) return;

    try {
      setLoading(true);
      await api.delete(`/knowledge-base/${selectedKb.id}/documents/${docId}`);
      await handleSelectKb(selectedKb.id);
    } catch (e) {
      alert(e.message || "Failed to delete document.");
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  if (selectedKb) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        {/* Back header */}
        <button
          onClick={() => {
            setSelectedKb(null);
            fetchKbs();
          }}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors duration-200 glass-btn-secondary px-4 py-2 rounded-xl text-xs font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Knowledge Bases
        </button>

        {/* KB Title section */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              {selectedKb.name}
            </h1>
            <p className="text-zinc-400 text-sm mt-1">{selectedKb.description || "No description provided."}</p>
          </div>
          <button
            onClick={(e) => handleDeleteKb(selectedKb.id, e)}
            className="flex items-center gap-1.5 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-4 py-2 rounded-xl text-xs font-medium transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Delete KB
          </button>
        </div>

        {/* Main KB Content split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: Upload Files */}
          <div className="glass-panel rounded-2xl p-6 h-fit space-y-4">
            <h2 className="font-semibold text-lg text-white">Upload Documents</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Add files to your knowledge base. Invenix will automatically split, embed, and index them.
            </p>

            <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all duration-200 ${
              isUploading 
                ? "border-zinc-700 bg-zinc-900/10 pointer-events-none"
                : "border-zinc-800 hover:border-indigo-500/50 bg-white/2 hover:bg-indigo-500/3"
            }`}>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt,.md"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              {isUploading ? (
                <div className="flex flex-col items-center gap-2 text-zinc-400">
                  <Loader className="w-8 h-8 animate-spin text-indigo-400" />
                  <span className="text-xs">Processing & embedding...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-zinc-400 text-center">
                  <UploadCloud className="w-8 h-8 text-indigo-400" />
                  <span className="text-xs font-medium text-white">Choose file or drag here</span>
                  <span className="text-[10px] text-zinc-500">PDF, DOCX, TXT, MD up to 20MB</span>
                </div>
              )}
            </label>

            {uploadError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex gap-2">
                <span>⚠️ {uploadError}</span>
              </div>
            )}
          </div>

          {/* Right panel: File List */}
          <div className="lg:col-span-2 glass-panel rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-lg text-white flex items-center gap-2">
              <span>Uploaded Documents</span>
              <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full font-normal">
                {selectedKb.documents?.length || 0}
              </span>
            </h2>

            {selectedKb.documents && selectedKb.documents.length > 0 ? (
              <div className="divide-y divide-white/5 max-h-[450px] overflow-y-auto pr-1">
                {selectedKb.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-zinc-900 border border-white/5">
                        <FileText className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors duration-200">
                          {doc.file_name}
                        </p>
                        <p className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                          <span>{formatBytes(doc.file_size)}</span>
                          <span>•</span>
                          <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-zinc-500 text-sm gap-2">
                <FileText className="w-10 h-10 text-zinc-600" />
                <p>No documents uploaded yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Knowledge Bases
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Manage document folders and vector database partitions.</p>
        </div>
        
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 glass-btn-primary px-5 py-2.5 rounded-xl text-xs"
        >
          <FolderPlus className="w-4 h-4" />
          Create New KB
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreateKb} className="glass-panel rounded-2xl p-6 space-y-4 max-w-2xl animate-pulse-glow">
          <h2 className="font-semibold text-lg text-white">Create Knowledge Base</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1 font-medium">Name</label>
              <input
                type="text"
                required
                className="w-full glass-input rounded-xl px-4 py-2.5 text-sm"
                placeholder="e.g. Project Specs"
                value={newKbName}
                onChange={(e) => setNewKbName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1 font-medium">Description</label>
              <textarea
                className="w-full glass-input rounded-xl px-4 py-2.5 text-sm h-24 resize-none"
                placeholder="Optional description of the contents..."
                value={newKbDesc}
                onChange={(e) => setNewKbDesc(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="glass-btn-secondary px-4 py-2 rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="glass-btn-primary px-4 py-2 rounded-xl text-xs"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {loading && kbs.length === 0 ? (
        <div className="flex items-center justify-center p-20">
          <Loader className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      ) : error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-sm">
          Error: {error}
        </div>
      ) : kbs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {kbs.map((kb) => (
            <div
              key={kb.id}
              onClick={() => handleSelectKb(kb.id)}
              className="glass-panel glass-panel-hover rounded-2xl p-6 cursor-pointer flex flex-col justify-between h-48 border border-white/5 relative group"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors duration-200 truncate">
                  {kb.name}
                </h3>
                <p className="text-zinc-400 text-xs line-clamp-2 mt-1.5 leading-relaxed">
                  {kb.description || "No description provided."}
                </p>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-3 mt-3">
                <span className="text-[10px] text-zinc-500">
                  {kb.documents?.length || 0} Files
                </span>
                <button
                  onClick={(e) => handleDeleteKb(kb.id, e)}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-20 glass-panel rounded-2xl border border-dashed border-zinc-800 text-zinc-500 gap-4">
          <BookOpen className="w-12 h-12 text-zinc-600" />
          <div className="text-center">
            <h3 className="font-semibold text-white">No knowledge bases yet</h3>
            <p className="text-xs text-zinc-500 mt-1">Create one to start uploading files and querying them.</p>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="glass-btn-primary px-4 py-2 rounded-xl text-xs"
          >
            Create First KB
          </button>
        </div>
      )}
    </div>
  );
}
