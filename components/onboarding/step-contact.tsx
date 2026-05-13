"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function StepContact({ register, errors }: any) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Contact Email</label>
        <Input 
          type="email"
          {...register("contactEmail", { required: "Contact email is required" })}
          placeholder="hello@acme.com"
          className={errors.contactEmail ? "border-red-500 focus-visible:ring-red-500/20" : ""}
        />
        {errors.contactEmail && <p className="text-xs font-bold text-red-500 ml-1">{errors.contactEmail.message}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">Phone Number</label>
          <Input 
            {...register("phone")}
            placeholder="+1 (555) 000-0000"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1">WhatsApp (optional)</label>
          <Input 
            {...register("whatsapp")}
            placeholder="+1 (555) 000-0000"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 ml-1">Physical Address</label>
        <Textarea 
          {...register("address")}
          placeholder="123 AI Street, Tech City, 90210"
        />
      </div>
    </div>
  );
}
