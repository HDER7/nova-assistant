"use client";

import { useState } from "react";
import {
  ShieldAlert, Crosshair, Siren, Fish, Bug, Binary, Loader2, Copy, Check, ScanSearch, FileSearch, Download,
} from "lucide-react";
import { api, downloadReport } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

type Tab = "ioc" | "triage" | "phishing" | "cve" | "decode" | "vt" | "file";

interface IocResult {
  ipv4: string[]; domains: string[]; urls: string[]; emails: string[];
  md5: string[]; sha1: string[]; sha256: string[]; cves: string[];
  defangedInput: boolean; total: number;
}
interface Analysis { analysis: string }
interface CveResult {
  id: string; description?: string; cvssScore?: number; severity?: string;
  published?: string; references: string[]; found: boolean; note?: string;
}
interface DecodeResult { mode: string; output: string; ok: boolean }
interface SocFileResult { filename: string; characters: number; iocs: IocResult; triage: string }
interface VtResult {
  indicator: string; type: string; verdict?: string;
  malicious: number; suspicious: number; harmless: number; undetected: number;
  reputation?: number; details?: string; link?: string; found: boolean; note?: string;
}

const TABS: { key: Tab; label: string; icon: typeof Crosshair }[] = [
  { key: "ioc", label: "IOCs", icon: Crosshair },
  { key: "triage", label: "Triage de alertas", icon: Siren },
  { key: "phishing", label: "Phishing", icon: Fish },
  { key: "cve", label: "CVE", icon: Bug },
  { key: "decode", label: "Decoder", icon: Binary },
  { key: "vt", label: "Reputación (VT)", icon: ScanSearch },
  { key: "file", label: "Análisis de archivo", icon: FileSearch },
];

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}
      className="text-muted-foreground hover:text-primary"
      title="Copiar"
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function IocGroup({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">{title} ({items.length})</span>
        <CopyBtn text={items.join("\n")} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((v) => <span key={v} className="rounded bg-muted/50 px-2 py-1 font-mono text-xs">{v}</span>)}
      </div>
    </div>
  );
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "text-danger", HIGH: "text-warning", MEDIUM: "text-primary", LOW: "text-muted-foreground",
};

export default function SocPage() {
  const pushToast = useUIStore((s) => s.pushToast);
  const [tab, setTab] = useState<Tab>("ioc");
  const [loading, setLoading] = useState(false);

  const [iocText, setIocText] = useState("");
  const [ioc, setIoc] = useState<IocResult | null>(null);
  const [triageText, setTriageText] = useState("");
  const [triage, setTriage] = useState<string | null>(null);
  const [phishText, setPhishText] = useState("");
  const [phish, setPhish] = useState<string | null>(null);
  const [cveId, setCveId] = useState("");
  const [cve, setCve] = useState<CveResult | null>(null);
  const [decIn, setDecIn] = useState("");
  const [decMode, setDecMode] = useState("base64");
  const [dec, setDec] = useState<DecodeResult | null>(null);
  const [vtIn, setVtIn] = useState("");
  const [vt, setVt] = useState<VtResult | null>(null);
  const [socFile, setSocFile] = useState<File | null>(null);
  const [fileResult, setFileResult] = useState<SocFileResult | null>(null);

  async function run(fn: () => Promise<void>) {
    setLoading(true);
    try { await fn(); } catch { pushToast({ title: "Operación fallida", variant: "error" }); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShieldAlert className="h-6 w-6 text-primary" /> Centro SOC
        </h1>
        <p className="text-sm text-muted-foreground">
          Herramientas de analista: extracción de IOCs, triage de alertas y phishing con IA, CVE y decodificador.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                tab === t.key ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* IOC ANALYZER */}
      {tab === "ioc" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="nova-card space-y-3">
            <h2 className="font-semibold">Extractor de IOCs</h2>
            <p className="text-xs text-muted-foreground">Pega logs, alertas o texto. Refang automático (hxxp, [.]) y clasificación.</p>
            <textarea value={iocText} onChange={(e) => setIocText(e.target.value)} rows={10}
              className="nova-input resize-none font-mono text-xs" placeholder="Ej: conexión a hxxps://malware[.]example[.]com desde 10.0.0.5, hash 44d88612fea8a8f36de82e1278abb02f ..." />
            <button disabled={loading || !iocText.trim()} className="nova-btn-primary"
              onClick={() => run(async () => setIoc(await api.post<IocResult>("/api/soc/iocs", { text: iocText })))}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />} Analizar
            </button>
          </div>
          <div className="space-y-2">
            {ioc ? (
              ioc.total === 0 ? <p className="nova-card text-sm text-muted-foreground">No se detectaron IOCs.</p> : (
                <>
                  {ioc.defangedInput && <p className="nova-chip">entrada defanged detectada</p>}
                  <IocGroup title="IPv4" items={ioc.ipv4} />
                  <IocGroup title="Dominios" items={ioc.domains} />
                  <IocGroup title="URLs" items={ioc.urls} />
                  <IocGroup title="Emails" items={ioc.emails} />
                  <IocGroup title="SHA256" items={ioc.sha256} />
                  <IocGroup title="SHA1" items={ioc.sha1} />
                  <IocGroup title="MD5" items={ioc.md5} />
                  <IocGroup title="CVEs" items={ioc.cves} />
                </>
              )
            ) : <p className="nova-card text-sm text-muted-foreground">Los IOCs aparecerán aquí.</p>}
          </div>
        </div>
      )}

      {/* TRIAGE */}
      {tab === "triage" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="nova-card space-y-3">
            <h2 className="font-semibold">Triage de alertas / logs (IA)</h2>
            <textarea value={triageText} onChange={(e) => setTriageText(e.target.value)} rows={12}
              className="nova-input resize-none font-mono text-xs" placeholder="Pega aquí una alerta SIEM, un log de EDR/firewall, etc." />
            <button disabled={loading || !triageText.trim()} className="nova-btn-primary"
              onClick={() => run(async () => setTriage((await api.post<Analysis>("/api/soc/triage", { text: triageText })).analysis))}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Siren className="h-4 w-4" />} Analizar con IA
            </button>
          </div>
          <div className="nova-card">
            <h3 className="mb-2 text-sm font-semibold">Análisis</h3>
            {triage ? (
              <div className="space-y-2">
                <p className="whitespace-pre-wrap text-sm">{triage}</p>
                <button onClick={() => downloadReport("Triage-NOVA", triage)} className="nova-btn-ghost text-xs">
                  <Download className="h-3.5 w-3.5" /> Descargar PDF
                </button>
              </div>
            )
              : <p className="text-sm text-muted-foreground">NOVA evaluará severidad, IOCs, MITRE ATT&CK y acciones.</p>}
          </div>
        </div>
      )}

      {/* PHISHING */}
      {tab === "phishing" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="nova-card space-y-3">
            <h2 className="font-semibold">Analizador de phishing (IA)</h2>
            <textarea value={phishText} onChange={(e) => setPhishText(e.target.value)} rows={12}
              className="nova-input resize-none font-mono text-xs" placeholder="Pega las cabeceras y/o el cuerpo del correo sospechoso." />
            <button disabled={loading || !phishText.trim()} className="nova-btn-primary"
              onClick={() => run(async () => setPhish((await api.post<Analysis>("/api/soc/phishing", { text: phishText })).analysis))}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fish className="h-4 w-4" />} Analizar correo
            </button>
          </div>
          <div className="nova-card">
            <h3 className="mb-2 text-sm font-semibold">Veredicto</h3>
            {phish ? (
              <div className="space-y-2">
                <p className="whitespace-pre-wrap text-sm">{phish}</p>
                <button onClick={() => downloadReport("Phishing-NOVA", phish)} className="nova-btn-ghost text-xs">
                  <Download className="h-3.5 w-3.5" /> Descargar PDF
                </button>
              </div>
            )
              : <p className="text-sm text-muted-foreground">Veredicto, nivel de riesgo, IOCs y recomendaciones.</p>}
          </div>
        </div>
      )}

      {/* CVE */}
      {tab === "cve" && (
        <div className="nova-card max-w-2xl space-y-3">
          <h2 className="font-semibold">Consulta de CVE (NVD)</h2>
          <div className="flex gap-2">
            <input value={cveId} onChange={(e) => setCveId(e.target.value)} className="nova-input flex-1 font-mono" placeholder="CVE-2024-3094" />
            <button disabled={loading || !cveId.trim()} className="nova-btn-primary"
              onClick={() => run(async () => setCve(await api.get<CveResult>(`/api/soc/cve/${encodeURIComponent(cveId.trim())}`)))}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />} Buscar
            </button>
          </div>
          {cve && (cve.found ? (
            <div className="space-y-2 rounded-lg border border-border/60 bg-background/40 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold">{cve.id}</span>
                {cve.cvssScore != null && (
                  <span className={cn("font-mono text-sm font-bold", SEV_COLOR[(cve.severity || "").toUpperCase()] || "text-foreground")}>
                    CVSS {cve.cvssScore} · {cve.severity}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{cve.description}</p>
              {cve.references.length > 0 && (
                <div className="pt-2">
                  <p className="mb-1 text-xs font-semibold">Referencias</p>
                  {cve.references.map((r) => (
                    <a key={r} href={r} target="_blank" rel="noreferrer" className="block truncate text-xs text-primary hover:underline">{r}</a>
                  ))}
                </div>
              )}
            </div>
          ) : <p className="text-sm text-danger">{cve.note}</p>)}
        </div>
      )}

      {/* DECODER */}
      {tab === "decode" && (
        <div className="nova-card max-w-2xl space-y-3">
          <h2 className="font-semibold">Decodificador / Defang</h2>
          <textarea value={decIn} onChange={(e) => setDecIn(e.target.value)} rows={4}
            className="nova-input resize-none font-mono text-xs" placeholder="Pega base64, hex, URL-encoded, un JWT, o un IOC a defang/refang." />
          <div className="flex gap-2">
            <select value={decMode} onChange={(e) => setDecMode(e.target.value)} className="nova-input max-w-[180px]">
              <option value="base64">Base64</option>
              <option value="hex">Hex</option>
              <option value="url">URL</option>
              <option value="jwt">JWT</option>
              <option value="defang">Defang</option>
              <option value="refang">Refang</option>
            </select>
            <button disabled={loading || !decIn.trim()} className="nova-btn-primary"
              onClick={() => run(async () => setDec(await api.post<DecodeResult>("/api/soc/decode", { input: decIn, mode: decMode })))}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Binary className="h-4 w-4" />} Procesar
            </button>
          </div>
          {dec && (
            <div className={cn("rounded-lg border bg-background/40 p-3", dec.ok ? "border-border/60" : "border-danger/50")}>
              <pre className="whitespace-pre-wrap break-words font-mono text-xs">{dec.output}</pre>
            </div>
          )}
        </div>
      )}
      {/* VIRUSTOTAL */}
      {tab === "vt" && (
        <div className="nova-card max-w-2xl space-y-3">
          <h2 className="font-semibold">Reputación en VirusTotal</h2>
          <p className="text-xs text-muted-foreground">Pega una IP, dominio, URL o hash (MD5/SHA1/SHA256). Detección automática de tipo.</p>
          <div className="flex gap-2">
            <input value={vtIn} onChange={(e) => setVtIn(e.target.value)} className="nova-input flex-1 font-mono text-xs" placeholder="8.8.8.8 · evil.com · 44d88612fea8a8f36de82e1278abb02f" />
            <button disabled={loading || !vtIn.trim()} className="nova-btn-primary"
              onClick={() => run(async () => setVt(await api.post<VtResult>("/api/soc/vt", { indicator: vtIn })))}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />} Consultar
            </button>
          </div>
          {vt && (vt.found ? (
            <div className="space-y-3 rounded-lg border border-border/60 bg-background/40 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{vt.indicator} <span className="nova-chip ml-1">{vt.type}</span></span>
                <span className={cn("rounded-full px-3 py-1 text-sm font-bold",
                  vt.verdict === "Malicioso" ? "bg-danger/20 text-danger"
                  : vt.verdict === "Sospechoso" ? "bg-warning/20 text-warning"
                  : "bg-success/20 text-success")}>{vt.verdict}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-danger/10 p-2"><p className="font-mono text-lg font-bold text-danger">{vt.malicious}</p><p className="text-[10px] text-muted-foreground">Malicioso</p></div>
                <div className="rounded-lg bg-warning/10 p-2"><p className="font-mono text-lg font-bold text-warning">{vt.suspicious}</p><p className="text-[10px] text-muted-foreground">Sospechoso</p></div>
                <div className="rounded-lg bg-success/10 p-2"><p className="font-mono text-lg font-bold text-success">{vt.harmless}</p><p className="text-[10px] text-muted-foreground">Inofensivo</p></div>
                <div className="rounded-lg bg-muted/30 p-2"><p className="font-mono text-lg font-bold">{vt.undetected}</p><p className="text-[10px] text-muted-foreground">Sin detectar</p></div>
              </div>
              {vt.details && <p className="text-xs text-muted-foreground">{vt.details}</p>}
              {vt.reputation != null && <p className="text-xs">Reputación: <span className="font-mono">{vt.reputation}</span></p>}
              {vt.link && <a href={vt.link} target="_blank" rel="noreferrer" className="inline-block text-xs text-primary hover:underline">Ver en VirusTotal →</a>}
            </div>
          ) : <p className="text-sm text-danger">{vt.note}</p>)}
        </div>
      )}
      {/* FILE ANALYSIS */}
      {tab === "file" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="nova-card space-y-3">
            <h2 className="font-semibold">Análisis de archivo (logs)</h2>
            <p className="text-xs text-muted-foreground">Sube un log/alerta (TXT, CSV, JSON, PDF…). NOVA extrae IOCs y hace triage con IA.</p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background/40 px-4 py-6 text-center transition hover:border-primary/50">
              <FileSearch className="h-6 w-6 text-primary" />
              <span className="text-sm">{socFile ? socFile.name : "Elegir archivo de logs"}</span>
              <input type="file" className="hidden" onChange={(e) => setSocFile(e.target.files?.[0] || null)} accept=".txt,.log,.csv,.json,.md,.xml,.pdf" />
            </label>
            <button disabled={loading || !socFile} className="nova-btn-primary w-full"
              onClick={() => run(async () => { const f = new FormData(); f.append("file", socFile as File); setFileResult(await api.postForm<SocFileResult>("/api/soc/analyze-file", f)); })}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />} Analizar archivo
            </button>
          </div>
          <div className="space-y-2">
            {fileResult ? (
              <>
                <div className="nova-card">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Triage — {fileResult.filename}</h3>
                    <button onClick={() => downloadReport(`Informe-${fileResult.filename}`, `Archivo: ${fileResult.filename}\n\n${fileResult.triage}`)} className="nova-btn-ghost text-xs">
                      <Download className="h-3.5 w-3.5" /> PDF
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{fileResult.triage}</p>
                </div>
                <IocGroup title="IPv4" items={fileResult.iocs.ipv4} />
                <IocGroup title="Dominios" items={fileResult.iocs.domains} />
                <IocGroup title="URLs" items={fileResult.iocs.urls} />
                <IocGroup title="SHA256" items={fileResult.iocs.sha256} />
                <IocGroup title="MD5" items={fileResult.iocs.md5} />
                <IocGroup title="CVEs" items={fileResult.iocs.cves} />
              </>
            ) : <p className="nova-card text-sm text-muted-foreground">El análisis del archivo aparecerá aquí.</p>}
          </div>
        </div>
      )}

    </div>
  );
}
