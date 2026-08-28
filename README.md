# TEDxNIFT Jodhpur — Organizing Platform

Internal organizing & volunteer management platform for TEDxNIFT Jodhpur. Built with Next.js
(App Router), TypeScript, Tailwind CSS, Firebase Auth, and Cloud Firestore.

This repo currently implements **Phase 1** of the platform:

- Firebase Authentication (email/password)
- Role-based access control (Admin, Core Team, Department Head, Volunteer, Applicant)
- Configurable departments (Admin CRUD, no hard-coded list)
- Public volunteer application form at `/apply`, driven entirely by Firestore data
- Recruitment pipeline: Submitted → Under Review → Shortlisted → Interview → Core Review → Approved/Rejected/Waitlisted
- Department Head interview workflow (ratings, notes, recommendation)
- Core Organizing Team Approval Center (approve / reject / waitlist / send back)
- Automatic, unique TEDx Member ID generation on approval (`TEDX{YY}-{DEPT}-{NNNN}`)
- Role-based dashboards for every user type
- Admin Command Center with live counts and department recruitment health (real Firestore data, no mocked numbers)
- Append-only activity log / audit trail
- Firestore Security Rules enforcing all of the above server-side (not just UI hiding)

Later phases (tasks, Cloudinary file management, meetings, reports, knowledge base,
event-day control room, incident management) are planned next — see the master spec for the
full roadmap.

## ⚠️ One-time setup: enable Cloud Firestore

The Firebase project used by this app (`bus-fmhs`) does not have the Cloud Firestore API
enabled yet. Firebase **Authentication** works out of the box, but every Firestore read/write
(departments, applications, interviews, approvals, etc.) will fail with `PERMISSION_DENIED /
Cloud Firestore API has not been used in project bus-fmhs...` until this is done:

1. Go to the [Firebase Console](https://console.firebase.google.com/project/bus-fmhs/firestore) → **Build → Firestore Database → Create database**.
2. Choose a region close to your users and start in **production mode** (the app ships its own security rules — see below).
3. Deploy this repo's rules and indexes (see "Deploying Firestore rules & indexes" below).

This is a one-time step tied to the Firebase project, not the code — once enabled, every
feature that depends on Firestore will work immediately without a redeploy.

## Getting started

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in your Firebase project config (and Cloudinary
credentials once Phase 2 lands). `.env.local` is gitignored and never committed.

## Creating the first Admin account

Firestore Security Rules intentionally prevent anyone from self-assigning an elevated role —
new sign-ups always start as `unassigned` (or `applicant`, via `/apply`). This means the very
first Admin must be granted manually, once:

1. Sign up at `/login` → "Create Account".
2. Open the [Firebase Console](https://console.firebase.google.com/project/bus-fmhs/firestore) → Firestore Database → `users` collection.
3. Find your user document (matches your email) and change its `role` field from `unassigned` to `admin`.
4. Reload the app — you'll land on the Admin Command Center.

From then on, the Admin can promote/assign every other account from **Admin → Team**.

## Deploying Firestore rules & indexes

```bash
npm install -g firebase-tools   # if not already installed
firebase login
firebase deploy --only firestore:rules,firestore:indexes
```

## Deployment

The app is deployed on Vercel. Set the same environment variables from `.env.local` in the
Vercel project settings (Project → Settings → Environment Variables).

## Tech stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- Firebase Authentication + Cloud Firestore
- Cloudinary (file/media storage — Phase 2)
- Vercel (hosting)
