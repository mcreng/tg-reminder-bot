require("dotenv").config();
const firebase = require("firebase/app");
require("firebase/firestore");

const config = {
  apiKey: process.env.FB_API_KEY,
  authDomain: process.env.FB_AUTH_DOMAIN,
  databaseURL: process.env.FB_DATABASE_URL,
  projectId: process.env.FB_PROJECT_ID,
  storageBucket: process.env.FB_STORAGE_BUCKET,
  messagingSenderId: process.env.FB_MESSAGING_SENDER_ID
};

/**
 * Upserts fields in the document referred to by this `DocumentReference`.
 *
 * @param data An object containing the fields and values with which to
 * upsert the document. Fields can contain dots to reference nested fields
 * within the document.
 * @return A Promise resolved once the data has been successfully written
 * to the backend (Note that it won't resolve while you're offline).
 */
firebase.firestore.DocumentReference.prototype.upsert = function(data) {
  this.get().then(docSnapshot => {
    if (docSnapshot.exists) {
      return this.update(data);
    } else {
      return this.set(data);
    }
  });
};

const app = firebase.initializeApp(config);
const firestore = firebase.firestore(app);

module.exports = firestore;
