/**
 * Admin SDK init — server/daemon only. The Admin SDK bypasses security rules (spec §5).
 * Never import this from client code.
 */
import { initializeApp, getApps, cert, applicationDefault, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { config } from "../config.js";

let _app: App | undefined;
let _db: Firestore | undefined;

export function adminApp(): App {
  if (_app) return _app;
  if (getApps().length) {
    _app = getApps()[0]!;
    return _app;
  }
  // Daemon: GOOGLE_APPLICATION_CREDENTIALS points at a gitignored service-account JSON.
  // Cloud Functions: ambient credentials via applicationDefault().
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  _app = initializeApp({
    credential: credentialPath
      ? cert(credentialPath)
      : applicationDefault(),
    projectId: config.firebase.projectId,
  });
  return _app;
}

export function db(): Firestore {
  if (!_db) {
    _db = getFirestore(adminApp());
  }
  return _db;
}

/** Path helper: the root of a user's subtree. */
export function userDoc(uid: string) {
  return db().collection("users").doc(uid);
}
