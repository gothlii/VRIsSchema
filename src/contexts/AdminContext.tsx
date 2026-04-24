import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type AdminContextType = {
  isAdmin: boolean;
  adminUser: User | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AdminContext = createContext<AdminContextType>({
  isAdmin: false,
  adminUser: null,
  isReady: false,
  login: async () => {},
  logout: async () => {},
});

export function AdminProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!auth) {
      setIsReady(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAdminUser(user);
      setIsReady(true);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!auth) {
      throw new Error("Firebase Auth ar inte konfigurerat.");
    }

    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const logout = useCallback(async () => {
    if (!auth) return;
    await signOut(auth);
  }, []);

  return (
    <AdminContext.Provider
      value={{
        isAdmin: Boolean(adminUser),
        adminUser,
        isReady,
        login,
        logout,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => useContext(AdminContext);
