"use client";

import { useState } from "react";
import { Globe, HelpCircle, FileText, Upload } from "lucide-react";
import { WebsiteSourceForm } from "./website-source-form";
import { FaqSourceForm } from "./faq-source-form";
import { ManualSourceForm } from "./manual-source-form";
import { DocumentSourceForm } from "./document-source-form";

const tabs = [
  { id: "website", label: "Website", icon: Globe },
  { id: "faq", label: "FAQs", icon: HelpCircle },
  { id: "manual", label: "Manual Text", icon: FileText },
  { id: "document", label: "Documents", icon: Upload },
];

export function KnowledgeTabs() {
  const [activeTab, setActiveTab] = useState("website");

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Tab Header */}
      <div className="border-b border-slate-100 px-6 pt-6">
        <div className="flex gap-1 overflow-x-auto flex-nowrap scrollbar-none pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-t-xl transition-all whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? "bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6 md:p-8">
        {activeTab === "website" && <WebsiteSourceForm />}
        {activeTab === "faq" && <FaqSourceForm />}
        {activeTab === "manual" && <ManualSourceForm />}
        {activeTab === "document" && <DocumentSourceForm />}
      </div>
    </div>
  );
}
