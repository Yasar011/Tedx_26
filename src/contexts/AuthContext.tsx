"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged, signOut as fbSignOut, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { UserProfile } from "@/lib/types";

const PROFILE_LOAD_TIMEOUT_MS = 8000;

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileError: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  profile: null,
  loading: true,
  profileError: null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
      if (!user) {
        setProfile(null);
        setProfileLoading(false);
        setProfileError(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    settledRef.current = false;
    setProfileLoading(true);
    setProfileError(null);

    // Firestore's real-time listener does NOT call the error callback when
    // the entire Firestore API is disabled for the project — it just
    // retries silently forever, which would otherwise hang the whole app
    // on a spinner. This timeout is the safety net for that case.
    const timeoutId = setTimeout(() => {
      if (settledRef.current) return;
      settledRef.current = true;
      setProfileLoading(false);
      setProfileError(
        "Timed out waiting for Cloud Firestore. It may not be enabled yet for this Firebase project."
      );
    }, PROFILE_LOAD_TIMEOUT_MS);

    const unsub = onSnapshot(
      doc(db, "users", firebaseUser.uid),
      (snap) => {
        if (settledRef.current) return;
        settledRef.current = true;
        clearTimeout(timeoutId);
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
        setProfileLoading(false);
      },
      (error) => {
        if (settledRef.current) return;
        settledRef.current = true;
        clearTimeout(timeoutId);
        setProfileLoading(false);
        setProfileError(error.message);
      }
    );
    return () => {
      clearTimeout(timeoutId);
      unsub();
    };
  }, [firebaseUser]);

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      loading: authLoading || (!!firebaseUser && profileLoading),
      profileError,
      signOut: () => fbSignOut(auth),
    }),
    [firebaseUser, profile, authLoading, profileLoading, profileError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
