import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase/client";
import { UserProfile } from "./types";

/**
 * Fetches the users the signed-in person is actually allowed to read.
 *
 * Firestore evaluates security rules against every document a query would
 * return — it does not silently filter them out. So reading the whole
 * `users` collection as a volunteer fails the entire query with
 * PERMISSION_DENIED. Each role therefore has to ask only for the subset
 * its rules permit: everyone for Admin/Core, and own-department plus org
 * leadership for everyone else.
 */
export async function fetchVisibleUsers(profile: UserProfile): Promise<UserProfile[]> {
  if (profile.role === "admin" || profile.role === "core") {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map((d) => d.data() as UserProfile);
  }

  const [deptSnap, leadershipSnap] = await Promise.all([
    profile.departmentId
      ? getDocs(query(collection(db, "users"), where("departmentId", "==", profile.departmentId)))
      : Promise.resolve(null),
    getDocs(query(collection(db, "users"), where("role", "in", ["admin", "core"]))),
  ]);

  const deptUsers = deptSnap ? deptSnap.docs.map((d) => d.data() as UserProfile) : [];
  const leaders = leadershipSnap.docs.map((d) => d.data() as UserProfile);

  const seen = new Set<string>();
  return [...deptUsers, ...leaders].filter((u) => {
    if (seen.has(u.uid)) return false;
    seen.add(u.uid);
    return true;
  });
}
