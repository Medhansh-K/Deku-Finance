"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { organisationsApi } from "@/api/endpoints";
import {
  Users,
  Building2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

function JoinWorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [tokenInput, setTokenInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successInfo, setSuccessInfo] = useState<{
    orgName: string;
    role: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    const queryToken = searchParams.get("token");
    if (queryToken) {
      setTokenInput(queryToken);
      if (user) {
        handleAcceptToken(queryToken);
      }
    }
  }, [searchParams, user]);

  const handleAcceptToken = async (tokenToUse?: string) => {
    const token = (tokenToUse || tokenInput).trim();
    if (!token) {
      setErrorMsg("Please enter a valid invitation token.");
      return;
    }

    setErrorMsg("");
    setIsLoading(true);

    try {
      const res = await organisationsApi.acceptInvitation({ token });
      if (res && res.success) {
        const data = res.data || {};
        setSuccessInfo({
          orgName: data.organisation_name || "Organisation",
          role: data.role || "Member",
          message: data.message || "Invitation accepted successfully!",
        });

        if (data.organisation_id) {
          localStorage.setItem("deku_active_org_id", data.organisation_id);
          localStorage.setItem("deku_active_org_name", data.organisation_name || "Organisation");
        }

        setTimeout(() => {
          router.push("/gateway");
        }, 1800);
      } else {
        setErrorMsg("Failed to redeem invitation token. It may have expired or already been accepted.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error validating invitation token. Please check with your organisation admin.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-[#0A1A1A] text-slate-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#5BB5BB] to-emerald-400 text-slate-950 shadow-xl shadow-[#5BB5BB]/20 mb-4 font-black text-2xl tracking-tight">
            出
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            Deku Financial OS
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#5BB5BB]/20 text-[#5BB5BB] border border-[#5BB5BB]/30 uppercase tracking-widest">
              Workbench
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Accept team invitation to enter collaborative accounting workspace
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-2xl space-y-6">
          {successInfo ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/40">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Welcome to the Workbench!</h3>
                <p className="text-xs text-slate-400 mt-1">
                  You joined <strong className="text-slate-200">{successInfo.orgName}</strong> as{" "}
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#5BB5BB]/20 text-[#5BB5BB] uppercase">
                    {successInfo.role}
                  </span>
                </p>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5BB5BB]" />
                Redirecting to gateway executive dashboard...
              </p>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Invitation Security Token
                  </label>
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="deku-inv-xxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#5BB5BB] focus:ring-1 focus:ring-[#5BB5BB]"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Enter or paste the token received in your team invite link
                  </p>
                </div>

                {!user && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <p className="font-semibold">Authentication Required</p>
                      <p className="text-[11px] text-amber-200/80 mt-0.5">
                        Please sign in or create an account to link your credentials with this organisation workbench.
                      </p>
                    </div>
                  </div>
                )}

                {user ? (
                  <Button
                    type="button"
                    onClick={() => handleAcceptToken()}
                    disabled={isLoading || !tokenInput}
                    className="w-full bg-[#5BB5BB] hover:bg-[#4EA5A5] text-slate-950 font-bold text-xs py-3 rounded-xl shadow-lg shadow-[#5BB5BB]/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verifying Invitation...
                      </>
                    ) : (
                      <>
                        <Users className="w-4 h-4" />
                        Accept Invitation &amp; Enter Workbench
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Link
                      href={`/login?redirect=/join?token=${encodeURIComponent(tokenInput)}`}
                      className="w-full text-center px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition"
                    >
                      Sign In
                    </Link>
                    <Link
                      href={`/signup?redirect=/join?token=${encodeURIComponent(tokenInput)}`}
                      className="w-full text-center px-4 py-2.5 rounded-xl bg-[#5BB5BB] hover:bg-[#4EA5A5] text-slate-950 text-xs font-bold transition shadow-md shadow-[#5BB5BB]/10"
                    >
                      Create Account
                    </Link>
                  </div>
                )}
              </div>

              {/* Roles Matrix Explainer */}
              <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-2">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#5BB5BB]" />
                  7-Tier Enterprise Multi-Tenant Security
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Roles are strictly segregated into Owner, CFO, Admin, Accountant, Analyst, Auditor, and Viewer. 
                  Audit trails are cryptographically sealed under MCA Rule 3(1).
                </p>
              </div>
            </>
          )}
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link href="/login" className="text-xs text-slate-400 hover:text-white transition">
            ← Return to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function JoinWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-[#5BB5BB]" />
        </div>
      }
    >
      <JoinWorkspaceContent />
    </Suspense>
  );
}
