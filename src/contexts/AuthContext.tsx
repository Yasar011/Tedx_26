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
import { doc, onSnapshot, setDoc } from "firebase/firestore";
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
  // Guards the load-timeout only — NOT the snapshot handler, so live
  // profile updates (e.g. an Admin changing your role) keep flowing.
  const settledRef = useRef(false);
  // Ensures we only ever attempt to self-heal a missing profile once.
  const healAttemptedRef = useRef(false);

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
    healAttemptedRef.current = false;
    setProfileLoading(true);
    setProfileError(null);

    // Firestore's real-time listener does NOT call the error callback when
    // the Firestore API is disabled for the project — it just retries
    // silently forever, which would otherwise hang the app on a spinner.
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
        settledRef.current = true;
        clearTimeout(timeoutId);

        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
          setProfileError(null);
          setProfileLoading(false);
          return;
        }

        // Authenticated but no profile document. This happens when account
        // creation partially failed (e.g. the auth account was created while
        // Firestore was unavailable). Self-heal by writing the profile the
        // sign-up flow should have written, rather than hanging forever.
        setProfile(null);

        if (healAttemptedRef.current) {
          setProfileLoading(false);
          setProfileError(
            "Your sign-in works, but this account has no profile record and one could not be created automatically. An Admin needs to create it."
          );
          return;
        }

        healAttemptedRef.current = true;
        setDoc(doc(db, "users", firebaseUser.uid), {
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? "",
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Unnamed",
          role: "unassigned",
          departmentId: null,
          tedxId: null,
          status: "active",
          createdAt: Date.now(),
        }).catch((err) => {
          setProfileLoading(false);
          setProfileError(
            `This account has no profile record, and creating one was rejected: ${err.message}`
          );
        });
        // On success the snapshot listener re-fires with the new document.
      },
      (error) => {
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
