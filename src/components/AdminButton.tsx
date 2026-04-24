import { useState } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, LogOut } from "lucide-react";
import { auth } from "@/lib/firebase";

export function AdminButton() {
  const { isAdmin, adminUser, isReady, login, logout } = useAdmin();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    setBusy(true);
    try {
      await login(email, password);
      setOpen(false);
      setEmail("");
      setPassword("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte logga in.");
    } finally {
      setBusy(false);
    }
  };

  if (!auth) {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-muted-foreground opacity-60"
      >
        <Lock className="h-4 w-4" />
        Admin ej aktiv
      </button>
    );
  }

  if (isAdmin) {
    return (
      <button
        onClick={() => void logout()}
        className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
      >
        <LogOut className="h-4 w-4" />
        {adminUser?.email ?? "Logga ut"}
      </button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setError("");
        setEmail("");
        setPassword("");
      }}
    >
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <Lock className="h-4 w-4" />
          Admin
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Admin-inloggning</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input
            type="email"
            placeholder="E-post"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            autoFocus
          />
          <Input
            type="password"
            placeholder="Losenord"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && void handleLogin()}
          />
          {!isReady ? (
            <p className="text-sm text-muted-foreground">Kontrollerar inloggning...</p>
          ) : null}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={() => void handleLogin()} disabled={!email || !password || busy || !isReady}>
            {busy ? "Loggar in..." : "Logga in"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
