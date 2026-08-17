import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

interface ApiTokenRow {
  id: number;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
}

interface CreatedToken extends ApiTokenRow {
  token: string;
}

const TOKENS_QUERY_KEY = "/api/auth/api-tokens";

const formatDate = (value: string | null) => {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};

/**
 * Personal API tokens for external agents (e.g. Atlas). The plaintext token is
 * shown exactly once, right after creation.
 */
export default function ApiTokensCard() {
  const [name, setName] = useState("");
  const [created, setCreated] = useState<CreatedToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<ApiTokenRow | null>(null);

  const tokensQuery = useQuery<ApiTokenRow[]>({ queryKey: [TOKENS_QUERY_KEY] });

  const createMutation = useMutation({
    mutationFn: async (tokenName: string) => {
      const response = await apiRequest("POST", TOKENS_QUERY_KEY, { name: tokenName });
      return (await response.json()) as CreatedToken;
    },
    onSuccess: (token) => {
      setCreated(token);
      setCopied(false);
      setName("");
      void queryClient.invalidateQueries({ queryKey: [TOKENS_QUERY_KEY] });
    },
    onError: (error: Error) => {
      toast({ title: "Could not create token", description: error.message, variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `${TOKENS_QUERY_KEY}/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Token revoked", description: "Anything using it will stop working immediately." });
      setPendingRevoke(null);
      void queryClient.invalidateQueries({ queryKey: [TOKENS_QUERY_KEY] });
    },
    onError: (error: Error) => {
      toast({ title: "Could not revoke token", description: error.message, variant: "destructive" });
    },
  });

  const copyToken = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Select the token and copy it manually.", variant: "destructive" });
    }
  };

  const tokens = tokensQuery.data ?? [];

  return (
    <Card className="mt-4 sm:mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          API tokens
        </CardTitle>
        <CardDescription>
          Let a trusted tool or assistant read your projects and track time on your behalf through the Tickd API.
          Tokens are shown once, so store them somewhere safe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (!trimmed) return;
            createMutation.mutate(trimmed);
          }}
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="api-token-name">Token name</Label>
            <Input
              id="api-token-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Atlas on my Mac"
              maxLength={80}
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={!name.trim() || createMutation.isPending} className="sm:w-auto">
            {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Create token
          </Button>
        </form>

        {created && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">Copy your new token now. It will not be shown again.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                value={created.token}
                onFocus={(event) => event.currentTarget.select()}
                className="font-mono text-xs"
                aria-label="New API token"
              />
              <Button type="button" variant="outline" onClick={copyToken} className="sm:w-auto">
                {copied ? <Check className="mr-2 h-4 w-4 text-green-600" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="mt-3 text-xs text-amber-800">
              Use it as <code className="rounded bg-white/70 px-1 py-0.5">Authorization: Bearer {created.prefix}…</code> against{" "}
              <code className="rounded bg-white/70 px-1 py-0.5">/api/v1</code>.
            </p>
            <div className="mt-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreated(null)}>
                Done, I saved it
              </Button>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold">Active tokens</h3>
          {tokensQuery.isLoading ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : tokensQuery.isError ? (
            <p className="mt-3 text-sm text-red-600">Could not load your tokens. Refresh to try again.</p>
          ) : tokens.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No tokens yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-200 rounded-md border border-gray-200">
              {tokens.map((token) => (
                <li key={token.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{token.name}</p>
                    <p className="text-xs text-gray-500">
                      <span className="font-mono">{token.prefix}…</span>
                      {" · "}created {formatDate(token.createdAt)}
                      {" · "}last used {formatDate(token.lastUsedAt)}
                      {token.expiresAt ? ` · expires ${formatDate(token.expiresAt)}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setPendingRevoke(token)}
                    disabled={revokeMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>

      <AlertDialog open={pendingRevoke !== null} onOpenChange={(open) => !open && setPendingRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke “{pendingRevoke?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Any tool using this token loses access immediately. This cannot be undone; you can create a new token at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep token</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(event) => {
                event.preventDefault();
                if (pendingRevoke) revokeMutation.mutate(pendingRevoke.id);
              }}
            >
              {revokeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
