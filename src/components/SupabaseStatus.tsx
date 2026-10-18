"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CheckCircle2,
  AlertTriangle,
  Database,
  ExternalLink,
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  Server,
  GitBranch,
} from "lucide-react";

interface StatusState {
  checking: boolean;
  connected: boolean;
  message: string;
  hasKey: boolean;
}

export default function SupabaseStatus() {
  const [status, setStatus] = useState<StatusState>({
    checking: true,
    connected: false,
    message: "Initializing connection test...",
    hasKey: false,
  });
  const [copiedUrl, setCopiedUrl] = useState(false);

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jylsaqqblbpwwxdkmlzd.supabase.co";
  const projectRef = "jylsaqqblbpwwxdkmlzd";
  const region = "Northeast Asia (Seoul) • ap-northeast-2";
  const repo = "Medhansh-K/Deku-Finance";

  const testConnection = async () => {
    setStatus((prev) => ({ ...prev, checking: true }));
    const hasKey = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim().length > 0 &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "your_supabase_anon_key_here"
    );

    if (!hasKey) {
      setStatus({
        checking: false,
        connected: false,
        hasKey: false,
        message: "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
      });
      return;
    }

    try {
      const supabase = createClient();
      // Test basic connection by querying auth session
      const { error } = await supabase.auth.getSession();
      if (error) {
        setStatus({
          checking: false,
          connected: false,
          hasKey: true,
          message: error.message,
        });
      } else {
        setStatus({
          checking: false,
          connected: true,
          hasKey: true,
          message: "Successfully connected to Supabase backend!",
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Connection failed";
      setStatus({
        checking: false,
        connected: false,
        hasKey: true,
        message: errorMessage,
      });
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(projectUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">Supabase Connection</h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                  status.connected
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : status.hasKey
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                }`}
              >
                {status.connected ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </>
                ) : status.hasKey ? (
                  <>
                    <AlertTriangle className="h-3 w-3" /> Rechecking
                  </>
                ) : (
                  <>
                    <KeyRound className="h-3 w-3" /> Anon Key Setup Needed
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Project: <span className="text-zinc-200 font-mono font-medium">{projectRef}</span> • {region}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <button
            onClick={testConnection}
            disabled={status.checking}
            className="flex flex-1 md:flex-none items-center justify-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700/80 px-3.5 py-2 text-xs font-medium text-zinc-200 transition-colors border border-zinc-700/60 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${status.checking ? "animate-spin" : ""}`} />
            Re-test
          </button>
          <a
            href={`https://supabase.com/dashboard/project/${projectRef}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 md:flex-none items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors shadow-lg shadow-emerald-900/30"
          >
            Open Dashboard
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
        <div className="rounded-xl bg-zinc-900/50 p-3.5 border border-zinc-800">
          <div className="text-xs text-zinc-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-zinc-500" />
              API URL
            </span>
            <button
              onClick={handleCopyUrl}
              className="text-zinc-400 hover:text-white transition-colors p-1"
              title="Copy URL"
            >
              {copiedUrl ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
          <div className="text-xs font-mono text-zinc-200 truncate mt-1">
            {projectUrl}
          </div>
        </div>

        <div className="rounded-xl bg-zinc-900/50 p-3.5 border border-zinc-800">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-zinc-500" />
            GitHub Repository
          </div>
          <div className="text-xs font-mono text-zinc-200 truncate mt-1">
            {repo}
          </div>
        </div>

        <div className="rounded-xl bg-zinc-900/50 p-3.5 border border-zinc-800">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-zinc-500" />
            Anon Key Status
          </div>
          <div className="text-xs font-medium mt-1">
            {status.hasKey ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Configured in .env.local
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Pending .env.local input
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action banner if key is missing */}
      {!status.hasKey && (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4">
          <div className="flex items-start gap-3">
            <KeyRound className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-300">
              <p className="font-semibold text-emerald-300 mb-1">
                Quick 1-step to complete the connection:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-zinc-300">
                <li>
                  In your open Supabase dashboard tab, click the green{" "}
                  <strong className="text-white bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">Connect</strong> button at top.
                </li>
                <li>
                  Copy your <strong className="text-white">anon public key</strong> (or find it in Project Settings → API).
                </li>
                <li>
                  Paste it in your <code className="bg-black/60 px-1.5 py-0.5 rounded text-emerald-300">.env.local</code> file under{" "}
                  <code className="text-white">NEXT_PUBLIC_SUPABASE_ANON_KEY=</code> and click <strong>Re-test</strong>!
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
