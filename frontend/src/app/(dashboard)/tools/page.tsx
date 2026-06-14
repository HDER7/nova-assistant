"use client";

import { useState } from "react";
import { FileText, Search, Loader2, UploadCloud, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";

interface AnalysisResult {
  filename: string;
  contentType: string;
  characters: number;
  analysis: string;
}
interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export default function ToolsPage() {
  const pushToast = useUIStore((s) => s.pushToast);

  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setAnalyzing(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (prompt) form.append("prompt", prompt);
      setResult(await api.postForm<AnalysisResult>("/api/documents/analyze", form));
    } catch {
      pushToast({ title: "No se pudo analizar el documento", variant: "error" });
    } finally {
      setAnalyzing(false);
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await api.get<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(query)}`);
      setResults(res.results);
      if (res.results.length === 0) pushToast({ title: "Sin resultados", variant: "default" });
    } catch {
      pushToast({ title: "Búsqueda no disponible", variant: "error" });
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Herramientas</h1>
        <p className="text-sm text-muted-foreground">Análisis de documentos y búsqueda web en tiempo real.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={analyze} className="nova-card space-y-3">
          <h2 className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4 text-primary" /> Análisis de documentos</h2>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background/40 px-4 py-8 text-center transition hover:border-primary/50">
            <UploadCloud className="h-7 w-7 text-primary" />
            <span className="text-sm">{file ? file.name : "Sube un PDF, TXT, CSV, JSON o imagen"}</span>
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} accept=".pdf,.txt,.csv,.json,.md,.xml,image/*" />
          </label>
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} className="nova-input" placeholder="¿Qué quieres saber del documento? (opcional)" />
          <button type="submit" disabled={analyzing || !file} className="nova-btn-primary w-full">
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Analizar
          </button>
          {result && (
            <div className="mt-2 rounded-xl border border-border bg-background/40 p-3">
              <p className="text-xs text-muted-foreground">{result.filename} · {result.characters} caracteres</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{result.analysis}</p>
            </div>
          )}
        </form>

        <form onSubmit={search} className="nova-card space-y-3">
          <h2 className="flex items-center gap-2 font-semibold"><Search className="h-4 w-4 text-primary" /> Búsqueda web</h2>
          <div className="flex gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="nova-input flex-1" placeholder="Buscar en la web…" />
            <button type="submit" disabled={searching} className="nova-btn-primary">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
          <div className="space-y-2">
            {results.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-border/60 bg-background/40 p-3 transition hover:border-primary/50">
                <p className="flex items-center gap-1 text-sm font-medium text-primary">{r.title} <ExternalLink className="h-3 w-3" /></p>
                <p className="mt-1 text-xs text-muted-foreground">{r.snippet}</p>
              </a>
            ))}
            {results.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Introduce una consulta para buscar.</p>}
          </div>
        </form>
      </div>
    </div>
  );
}
