"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { organisationsApi } from "@/api/endpoints";
import { setActiveOrg } from "@/lib/organisation/active-org";
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
import { Badge } from "@/components/ui/Badge";
import { DekuLogo } from "@/components/ui/DekuLogo";

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
          setActiveOrg({ id: data.organisation_id, name: data.organisation_name || "Organisation" });
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
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <DekuLogo size={44} className="mx-auto mb-4" />
          <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-ink">
            Join your team on Deku Finance
          </h1>
          <p className="text-[14px] text-ink-muted mt-1">
            Accept the invitation to open your team&apos;s accounting workspace
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-line rounded-panel p-6 space-y-5">
          {successInfo ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-full bg-ok-wash text-ok mx-auto grid place-items-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-[17px] font-semibold tracking-tight text-ink">You&apos;re in</h3>
                <p className="text-[13.5px] text-ink-muted mt-1.5">
                  You joined <span className="font-medium text-ink">{successInfo.orgName}</span> as{" "}
                  <Badge variant="teal" className="capitalize">{successInfo.role}</Badge>
                </p>
              </div>
              <p className="text-[13px] text-ink-muted flex items-center justify-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-strong" />
                Taking you to the Gateway…
              </p>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="px-4 py-3 rounded-ctl bg-bad-wash text-bad text-[13px] flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] text-ink-muted mb-1.5">
                    Invitation token
                  </label>
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="deku-inv-xxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full h-10 bg-surface border border-line-strong rounded-ctl px-3 text-[13px] text-ink font-mono placeholder:text-ink-subtle focus:outline-none focus:border-brand"
                  />
                  <p className="text-[12.5px] text-ink-muted mt-1.5">
                    Paste the token from your invite link
                  </p>
                </div>

                {!user && (
                  <div className="px-4 py-3 rounded-ctl bg-warn-wash text-warn text-[13px] flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Sign in first</p>
                      <p className="mt-0.5">
                        Sign in or create an account to link it with this organisation.
                      </p>
                    </div>
                  </div>
                )}

                {user ? (
                  <Button
                    type="button"
                    onClick={() => handleAcceptToken()}
                    disabled={isLoading || !tokenInput}
                    size="lg"
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Checking the invitation…
                      </>
                    ) : (
                      <>
                        <Users className="w-4 h-4" />
                        Accept invitation
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Link
                      href={`/login?redirect=/join?token=${encodeURIComponent(tokenInput)}`}
                      className="w-full h-10 grid place-items-center rounded-ctl bg-surface hover:bg-canvas text-ink text-[13.5px] font-medium border border-line-strong transition-colors"
                    >
                      Sign in
                    </Link>
                    <Link
                      href={`/signup?redirect=/join?token=${encodeURIComponent(tokenInput)}`}
                      className="w-full h-10 grid place-items-center rounded-ctl bg-ink hover:bg-ink-soft text-white text-[13.5px] font-medium transition-colors"
                    >
                      Create account
                    </Link>
                  </div>
                )}
              </div>

              {/* Roles Matrix Explainer */}
              <div className="pt-4 border-t border-line space-y-1.5">
                <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-strong" />
                  Seven roles, kept separate
                </div>
                <p className="text-[12.5px] text-ink-muted leading-relaxed">
                  Roles are strictly segregated into Owner, CFO, Admin, Accountant, Analyst, Auditor, and Viewer.
                  Audit trails are cryptographically sealed under MCA Rule 3(1).
                </p>
              </div>
            </>
          )}
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link href="/login" className="text-[13px] text-ink-muted hover:text-ink transition-colors">
            Back to sign in
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
        <div className="min-h-screen bg-canvas flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-brand-strong" />
        </div>
      }
    >
      <JoinWorkspaceContent />
    </Suspense>
  );
}
