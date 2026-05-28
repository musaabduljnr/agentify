import { Button } from "@/components/ui/button";
import { 
  Code2, 
  CheckCircle2, 
  Monitor, 
  ExternalLink,
  ChevronRight,
  Info,
  Link2
} from "lucide-react";
import { getCurrentBusinessSetup } from "@/lib/queries/business";
import { CopyButton } from "@/components/dashboard/embed/copy-button";

export default async function EmbedCodePage() {
  const { business, widgetConfig } = await getCurrentBusinessSetup();
  const businessId = business?.id || "business_id_missing";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://agentifyhq.vercel.app").replace(/\/$/, "");
  const hostedSlug = widgetConfig?.hosted_chat_slug || business?.slug || "business-slug";
  const hostedChatLink = `${appUrl}/chat/${hostedSlug}`;

  const embedCode = `<script 
  src="${appUrl}/widget.js"
  data-business-id="${businessId}"
  async>
</script>`;

  return (
    <>
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Embed Code</h1>
        <p className="text-slate-500">Add the code below to your website to activate your AI assistant.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-8 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Code2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Website Embed Code</h3>
                  <p className="text-xs text-slate-500 font-medium">For businesses that already have a website.</p>
                </div>
              </div>
              <CopyButton text={embedCode} />
            </div>
            <div className="p-8 bg-slate-900 overflow-x-auto">
              <pre className="text-indigo-300 font-mono text-sm leading-relaxed">
                {embedCode}
              </pre>
            </div>
            <div className="p-6 bg-slate-50 flex items-center gap-3">
              <Info className="w-5 h-5 text-indigo-600 shrink-0" />
              <p className="text-xs text-slate-600 font-medium">
                Copy this code and paste it into your website&apos;s <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-900">&lt;head&gt;</code> or just before the closing <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-900">&lt;/body&gt;</code> tag.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Link2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Shareable Chat Link</h3>
                  <p className="text-xs text-slate-500 font-medium">For WhatsApp, Instagram bios, Facebook, email, and businesses without a website.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <CopyButton text={hostedChatLink} />
                <Button asChild variant="outline" className="rounded-2xl border-2 border-slate-200 font-bold h-10">
                  <a href={hostedChatLink} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Preview
                  </a>
                </Button>
              </div>
            </div>
            <div className="p-8 bg-slate-950 overflow-x-auto">
              <pre className="text-emerald-300 font-mono text-sm leading-relaxed whitespace-pre-wrap break-all">
                {hostedChatLink}
              </pre>
            </div>
            <div className="p-6 bg-slate-50 flex items-center gap-3">
              <Info className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-xs text-slate-600 font-medium">
                Manage the slug, page title, and availability from <a href="/dashboard/widget" className="text-indigo-600 font-bold hover:underline">Widget Settings</a>.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Installation Guides
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {["WordPress", "Shopify", "Webflow", "Wix", "React", "HTML/Plain"].map((platform) => (
                <button 
                  key={platform}
                  className="bg-white p-6 rounded-3xl border border-slate-200 hover:border-indigo-600 hover:shadow-md transition-all text-left group"
                >
                  <h4 className="font-bold text-slate-900 mb-2">{platform}</h4>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                    View Guide <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Widget Status</h3>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${widgetConfig?.is_enabled ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm font-bold text-slate-700">
                {widgetConfig?.is_enabled ? 'Widget is Active' : 'Widget is Disabled'}
              </span>
            </div>
            {!widgetConfig?.is_enabled && (
              <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                Your widget is currently disabled. Enable it in the <a href="/dashboard/widget" className="text-indigo-600 font-bold hover:underline">Widget Settings</a> to make it visible on your site.
              </p>
            )}
          </div>

          <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-100 overflow-hidden relative">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <h3 className="text-xl font-bold mb-4 relative z-10">Local Testing</h3>
            <p className="text-indigo-100 text-sm mb-6 relative z-10 leading-relaxed">
              To test the widget locally:
            </p>
            <ol className="text-indigo-50 text-xs space-y-3 mb-8 relative z-10 list-decimal ml-4">
              <li>Create a file named <code className="bg-white/20 px-1 rounded">test-widget.html</code> in your project root.</li>
              <li>Paste the embed code into it.</li>
              <li>Open the file from the same local dev origin as your running app.</li>
            </ol>
            <div className="space-y-4 relative z-10">
              <Button className="w-full bg-white text-indigo-600 hover:bg-indigo-50 rounded-2xl font-bold h-12">
                Open Test Page
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Need help?</h3>
            <div className="space-y-4">
              <button className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl group hover:bg-indigo-50 transition-colors">
                <div className="flex items-center gap-3 text-left">
                  <Monitor className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
                  <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-900">Watch Video Guide</span>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-300" />
              </button>
              <button className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl group hover:bg-indigo-50 transition-colors">
                <div className="flex items-center gap-3 text-left">
                  <CheckCircle2 className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
                  <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-900">Installation FAQ</span>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-300" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
