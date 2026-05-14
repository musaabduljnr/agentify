"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wrench, Loader2, CheckCircle2 } from "lucide-react";
import { repairCurrentBusinessSetup } from "@/lib/actions/repair-setup";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface RepairButtonProps {
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

export function RepairButton({ className, variant = "secondary", size = "default" }: RepairButtonProps) {
  const [isRepairing, setIsRepairing] = useState(false);
  const router = useRouter();

  const handleRepair = async () => {
    setIsRepairing(true);
    try {
      const result = await repairCurrentBusinessSetup();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Setup repaired successfully!");
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to repair setup");
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <Button 
      onClick={handleRepair}
      disabled={isRepairing}
      variant={variant}
      size={size}
      className={className}
    >
      {isRepairing ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Repairing...
        </>
      ) : (
        <>
          <Wrench className="w-4 h-4 mr-2" />
          Repair Setup
        </>
      )}
    </Button>
  );
}
