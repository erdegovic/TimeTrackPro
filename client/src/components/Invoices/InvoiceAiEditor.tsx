import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUltimateCapabilities } from "@shared/subscriptions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type InvoiceAiEditorProps = {
  current: Record<string, unknown>;
  context: "settings" | "client";
  onApply: (customization: Record<string, unknown>) => void;
  className?: string;
};

export function InvoiceAiEditor({ current, context, onApply, className = "" }: InvoiceAiEditorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [instruction, setInstruction] = useState("");
  const access = getUltimateCapabilities(user?.subscriptionPlan, user?.subscriptionStatus);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ultimate/invoice-customization/interpret", {
        instruction,
        current,
        context,
      });
      return response.json() as Promise<{ customization: Record<string, unknown>; summary: string }>;
    },
    onSuccess: (result) => {
      onApply(result.customization);
      setInstruction("");
      queryClient.invalidateQueries({ queryKey: ["/api/ultimate/status"] });
      toast({ title: "Invoice changes applied", description: result.summary || "Review the preview, then save." });
    },
    onError: (error: Error) => toast({
      title: "Could not edit the invoice",
      description: error.message,
      variant: "destructive",
    }),
  });

  if (!access.canUseAi) return null;

  return (
    <div className={`rounded-md border border-blue-200 bg-blue-50/60 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-950">Edit with Tickd AI</p>
          <p className="mt-1 text-xs leading-5 text-gray-600">Describe the result you want. Nothing is saved until you use the editor’s Save button.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <Textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder='Example: “Switch Payment Details and Notes, then move the payment accent line to the right.”'
          className="min-h-20 resize-y bg-white"
          maxLength={2000}
        />
        <Button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={instruction.trim().length < 3 || mutation.isPending}
          className="shrink-0"
        >
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Apply
        </Button>
      </div>
    </div>
  );
}
