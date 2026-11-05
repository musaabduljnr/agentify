import type { Metadata } from "next";
import { StartForm } from "@/components/start/StartForm";

export const metadata: Metadata = {
  title: "Build a chatbot trained on your website",
  description: "Build a chatbot trained on your website, from $2/month.",
  robots: { index: false, follow: true },
};

export default function StartPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl text-center space-y-8">
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
          A chatbot trained on your website, from $2/month
        </h1>
        <StartForm />
      </div>
    </main>
  );
}
