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

export function AdminButton() {
  const { isAdmin, login, logout } = useAdmin();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleLogin = () => {
    if (login(password)) {
      setOpen(false);
      setPassword("");
      setError(false);
    } else {
      setError(true);
    }
  };

  if (isAdmin) {
    return (
      <button
        onClick={logout}
        className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
      >
        <LogOut className="h-4 w-4" />
        Logga ut
      </button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(false); setPassword(""); }}>
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
            type="password"
            placeholder="Lösenord"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">Fel lösenord</p>}
          <Button onClick={handleLogin} disabled={!password}>Logga in</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
