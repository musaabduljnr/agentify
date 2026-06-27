"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptTeamInvitation } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";

interface AcceptInviteClientProps {
  token: string;
  email: string;
  businessName: string;
  role: string;
}

export function AcceptInviteClient({ token, email, businessName, role }: AcceptInviteClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleAccept = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await acceptTeamInvitation(token);
        if (res.error) {
          setError(res.error);
        } else if (res.success) {
          router.push("/dashboard");
          router.refresh();
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred. Please try again.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-medium border border-red-100 flex items-center gap-2 text-left">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      <Button
        onClick={handleAccept}
        disabled={isPending}
        className="w-full rounded-2xl h-12 font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Accepting...
          </>
        ) : (
          "Accept and Join Workspace"
        )}
      </Button>
    </div>
  );
}
