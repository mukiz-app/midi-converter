import { FirebaseApp, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import {
  Firestore,
  getFirestore
} from "firebase/firestore";
import {
  Functions,
  getFunctions
} from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCFN1sC8eHZl8OHQEisUU2JOPNW-4Ywb_Q",
  authDomain: "mukiz-231605.firebaseapp.com",
  databaseURL: "https://mukiz-231605.firebaseio.com",
  projectId: "mukiz-231605",
  storageBucket: "mukiz-231605.firebasestorage.app",
  messagingSenderId: "150287454176",
  appId: "1:150287454176:web:2e2ce0b5f8419d78e9a585",
  measurementId: "G-N2CZ06HG1M"
};

const modules = (() => {
  try {
    const app = initializeApp(firebaseConfig)
    const auth = getAuth(app)
    const firestore = getFirestore(app)
    const functions = getFunctions(app)

    return {
      app,
      auth,
      firestore,
      functions,
    }
  } catch (e) {
    console.warn(`Failed to initialize Firebase: ${e}`)
  }

  return {
    app: null,
    auth: null,
    firestore: null,
    functions: null,
  }
})()

export const app = modules.app as FirebaseApp
export const auth = modules.auth as Auth
export const firestore = modules.firestore as Firestore
export const functions = modules.functions as Functions
