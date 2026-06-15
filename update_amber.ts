import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import fs from 'fs';

let configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
let config = JSON.parse(configStr);

const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  console.log("Searching for users named Amber...");
  
  const usersSnap = await getDocs(query(collection(db, 'users'), where('name', '==', 'Amber')));
  console.log("Found", usersSnap.docs.length, "users named Amber");

  for (const docSnap of usersSnap.docs) {
    const data = docSnap.data();
    const avatarUrl = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhFNgNudbKpXFVSNQL6aaNYVfUfgDAWsKr5HziGgpha6eI6CCHlJhNUgxPMdRbvGV5oMz9_4vfexZDA-6Qh9S1MrQ1j3L7hFvwTBYxSOW9kT7hblyRd0hRD82S2psqUVwyKW37-4oXGbiFaGurk58S4X2P0usXZsqK1rceJTEvcCcjwEXICwvTMOZ4zCvo/s1600/2314627059_f4565a6d45_b.jpg";
    console.log("Updating user:", docSnap.id);
    await updateDoc(docSnap.ref, { avatar: avatarUrl, avatarUrl: avatarUrl });
  }

  console.log("Done");
  process.exit(0);
}
run().catch(console.error);
