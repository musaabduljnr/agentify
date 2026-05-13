"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function StepBusinessInfo({ register, errors }: any) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Business Name</label>
        <Input 
          {...register("businessName", { required: "Business name is required" })}
          placeholder="e.g. Acme Corp"
          className={errors.businessName ? "border-red-500 focus-visible:ring-red-500/20" : ""}
        />
        {errors.businessName && <p className="text-xs font-bold text-red-500 ml-1">{errors.businessName.message}</p>}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Industry</label>
        <Input 
          {...register("industry", { required: "Industry is required" })}
          placeholder="e.g. Real Estate, E-commerce"
          className={errors.industry ? "border-red-500 focus-visible:ring-red-500/20" : ""}
        />
        {errors.industry && <p className="text-xs font-bold text-red-500 ml-1">{errors.industry.message}</p>}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Website URL</label>
        <Input 
          {...register("websiteUrl", { required: "Website is required" })}
          placeholder="https://acme.com"
          className={errors.websiteUrl ? "border-red-500 focus-visible:ring-red-500/20" : ""}
        />
        {errors.websiteUrl && <p className="text-xs font-bold text-red-500 ml-1">{errors.websiteUrl.message}</p>}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Business Description</label>
        <Textarea 
          {...register("description", { required: "Description is required" })}
          placeholder="Briefly describe what your business does..."
          className={errors.description ? "border-red-500 focus-visible:ring-red-500/20" : ""}
        />
        {errors.description && <p className="text-xs font-bold text-red-500 ml-1">{errors.description.message}</p>}
      </div>
    </div>
  );
}
