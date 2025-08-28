// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAu0kHCdhUOTV5TLCXib7x9I9eKS3a-wic",
  authDomain: "stockcheck-ni9ig.firebaseapp.com",
  databaseURL: "https://stockcheck-ni9ig-default-rtdb.firebaseio.com",
  projectId: "stockcheck-ni9ig",
  storageBucket: "stockcheck-ni9ig.appspot.com",
  messagingSenderId: "972805689017",
  appId: "1:972805689017:web:819d7a0468fc463963d568"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
