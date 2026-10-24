// Config dari Firebase kamu
const firebaseConfig = {
  apiKey: "AIzaSyCTZFaLrEeiMVD7_qe4OzAuoQx5qTFwU34",
  authDomain: "rifhskboy.firebaseapp.com",
  databaseURL: "https://rifhskboy-default-rtdb.firebaseio.com",
  projectId: "rifhskboy",
  storageBucket: "rifhskboy.firebasestorage.app",
  messagingSenderId: "315839861932",
  appId: "1:315839861932:web:126dc031d07e3a6dccfb09"
};

// Inisialisasi Firebase (Format Compat)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
