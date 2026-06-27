import { acceptTeamInvitation } from "@/lib/actions/team";
import { createHash } from "crypto";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, Mail, Shield, User, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InvitePageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function InviteTeamPage({ searchParams }: InvitePageProps) {
  const resolvedSearchParams = await searchParams;
  const token = resolvedSearchParams.token;

  if (!token) {
    return <ErrorCard title="Invalid Link" description="The invitation link you followed is invalid or missing a token." />;
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const serviceClient = createServiceClient();

  // Fetch invitation details
  const { data: invite, error } = await serviceClient
    .from("team_invitations")
    .select("*, businesses(name), inviter:profiles!team_invitations_invited_by_fkey(full_name, email)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !invite) {
    return <ErrorCard title="Invalid Invitation" description="This invitation link does not exist, or has been deleted." />;
  }

  if (invite.status === "revoked") {
    return <ErrorCard title="Invitation Revoked" description="This invitation has been revoked by the workspace administrator." />;
  }

  if (invite.status === "accepted") {
    return (
      <SuccessCard 
        title="Already Joined" 
        description="This invitation has already been accepted." 
        ctaText="Go to Dashboard" 
        ctaLink="/dashboard" 
      />
    );
  }

  const isExpired = new Date(invite.expires_at) < new Date() || invite.status === "expired";
  if (isExpired) {
    // Auto update status to expired in db
    await serviceClient.from("team_invitations").update({ status: "expired" }).eq("id", invite.id);
    return <ErrorCard title="Invitation Expired" description="This invitation link has expired. Workspace invitations expire after 7 days." />;
  }

  // Get current user session
  const clientSupabase = await createClient();
  const { data: { user } } = await clientSupabase.auth.getUser();

  const businessName = invite.businesses?.name || "Workspace";
  const inviterName = invite.inviter?.full_name || invite.inviter?.email || "An administrator";
  const role = invite.role;

  // Next redirect URL after login/signup
  const nextRedirect = `/invite/team?token=${token}`;
  const signUpUrl = `/signup?next=${encodeURIComponent(nextRedirect)}`;
  const loginUrl = `/login?next=${encodeURIComponent(nextRedirect)}`;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-indigo-600 p-8 text-center text-white relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <Bot className="w-8 h-8 text-white animate-pulse" />
              <span className="text-xl font-extrabold text-white tracking-tight">Agentify</span>
            </Link>
            <h2 className="text-xl font-bold">You've Been Invited!</h2>
            <p className="text-xs text-indigo-100 mt-1">To join the {businessName} workspace</p>
          </div>

          <div className="p-8 text-center">
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              <span className="font-semibold text-slate-800">{inviterName}</span> has invited you to join <span className="font-semibold text-slate-800">{businessName}</span> as a <span className="font-semibold text-indigo-600 capitalize">{role}</span>.
            </p>

            <p className="text-xs text-slate-400 mb-8">
              Please sign up for an account or log in with your existing account to accept the invitation.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <Button asChild className="rounded-2xl h-11 font-bold bg-indigo-600 hover:bg-indigo-700">
                <Link href={signUpUrl}>Create Account</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-2xl h-11 font-bold border-slate-200 text-slate-700 hover:bg-slate-50">
                <Link href={loginUrl}>Log In</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // User is logged in, show Accept screen
  async function acceptAction() {
    "use server";
    const res = await acceptTeamInvitation(token!);
    if (res.success) {
      redirect("/dashboard");
    } else {
      redirect(`/invite/team?token=${token}&error=${res.error}`);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-indigo-600 p-8 text-center text-white relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <Bot className="w-8 h-8 text-white" />
            <span className="text-xl font-extrabold text-white tracking-tight">Agentify</span>
          </Link>
          <h2 className="text-xl font-bold">Accept Invitation</h2>
          <p className="text-xs text-indigo-100 mt-1">{businessName}</p>
        </div>

        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-indigo-600 animate-bounce" />
          </div>

          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            You are logged in as <span className="font-semibold text-slate-800">{user.email}</span>.
          </p>

          <p className="text-sm text-slate-600 leading-relaxed mb-8">
            Click accept below to join <span className="font-semibold text-slate-800">{businessName}</span> as a <span className="font-semibold text-indigo-600 capitalize">{role}</span>.
          </p>

          <form action={acceptAction}>
            <Button type="submit" className="w-full rounded-2xl h-12 font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all">
              Accept and Join Workspace
            </Button>
          </form>

          <p className="text-xs text-slate-400 mt-5">
            By accepting, you will gain access to this business workspace resources in accordance with your role.
          </p>
        </div>
      </div>
    </div>
  );
}

function ErrorCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2>
        <p className="text-sm text-slate-500 leading-relaxed mb-8">{description}</p>
        <Button asChild className="rounded-2xl h-11 font-bold bg-slate-900 hover:bg-slate-800 px-6">
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  );
}

function SuccessCard({ title, description, ctaText, ctaLink }: { title: string; description: string; ctaText: string; ctaLink: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2>
        <p className="text-sm text-slate-500 leading-relaxed mb-8">{description}</p>
        <Button asChild className="rounded-2xl h-11 font-bold bg-indigo-600 hover:bg-indigo-700 px-6">
          <Link href={ctaLink}>{ctaText}</Link>
        </Button>
      </div>
    </div>
  );
}
