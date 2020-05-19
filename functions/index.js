const functions = require("firebase-functions");
const express = require("express");
const app = express();
const FBAuth = require("./util/fbAuth");

const cors = require("cors");
app.use(cors());

const { db } = require("./util/admin");

const {
  getAllScreams,
  postOneScream,
  editScream,
  getScream,
  commentOnScream,
  likeScream,
  unlikeScream,
  deleteScream,
} = require("./handlers/screams");
const {
  signup,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticatedUser,
  getUserDetails,
  getUserBookDetails,
  markNotificationsRead,
} = require("./handlers/users");
const {
  getAllBooks,
  postOneBook,
  editBookImage,
  initialPostBookImage,
  editBook,
  getBook,
  commentOnBook,
  favBook,
  unfavBook,
  deleteBook,
} = require("./handlers/books");
const {
  getAllChapters,
  getAllChaptersOfABook,
  postOneChapter,
  editChapter,
  getChapter,
  commentOnChapter,
  likeChapter,
  unlikeChapter,
  deleteChapter,
} = require("./handlers/chapters");

// Scream routes
app.get("/screams", getAllScreams);
app.post("/scream", FBAuth, postOneScream);
app.post("/scream/:screamId/edit", FBAuth, editScream);
app.get("/scream/:screamId", getScream);
app.delete("/scream/:screamId", FBAuth, deleteScream);
app.get("/scream/:screamId/like", FBAuth, likeScream);
app.get("/scream/:screamId/unlike", FBAuth, unlikeScream);
app.post("/scream/:screamId/comment", FBAuth, commentOnScream);

// users routes
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", FBAuth, uploadImage);
app.post("/user", FBAuth, addUserDetails);
app.get("/user", FBAuth, getAuthenticatedUser);
app.get("/user/:handle", getUserDetails);
app.get("/user/:handle/books", getUserBookDetails);
app.post("/notifications", FBAuth, markNotificationsRead);

//book routes
app.get("/books", getAllBooks);
app.post("/book", FBAuth, postOneBook);
app.post("/book/bookImage/:bookId", FBAuth, editBookImage);
app.post("/book/initialBookImage", FBAuth, initialPostBookImage);
app.post("/book/:bookId/edit", FBAuth, editBook);
app.get("/book/:bookId", getBook);
app.delete("/book/:bookId", FBAuth, deleteBook);
app.get("/book/:bookId/fav", FBAuth, favBook);
app.get("/book/:bookId/unfav", FBAuth, unfavBook);
app.post("/book/:bookId/comment", FBAuth, commentOnBook);

//chapter routes
app.get("/chapters", getAllChapters);
app.get("/books/:bookId/chapters", getAllChaptersOfABook);
app.post("/book/:bookId/chapter", FBAuth, postOneChapter);
app.delete("/book/:bookId/chapter/:chapterId", FBAuth, deleteChapter);
app.post("/chapter/:chapterId/edit", FBAuth, editChapter);
app.get("/chapter/:chapterId", getChapter);
app.get("/chapter/:chapterId/like", FBAuth, likeChapter);
app.get("/chapter/:chapterId/unfav", FBAuth, unlikeChapter);
app.post("/chapter/:chapterId/comment", FBAuth, commentOnChapter);

exports.api = functions.region("us-central1").https.onRequest(app);

exports.createNotificationOnLike = functions
  .region("us-central1")
  .firestore.document("likes/{id}")
  .onCreate((snapshot) => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "like",
            read: false,
            screamId: doc.id,
          });
        }
      })
      .catch((err) => console.error(err));
  });
exports.deleteNotificationOnUnLike = functions
  .region("us-central1")
  .firestore.document("likes/{id}")
  .onDelete((snapshot) => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch((err) => {
        console.error(err);
        return;
      });
  });
exports.createNotificationOnComment = functions
  .region("us-central1")
  .firestore.document("comments/{id}")
  .onCreate((snapshot) => {
    return db
      .doc(`/screams/${snapshot.data().screamId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "comment",
            read: false,
            screamId: doc.id,
          });
        }
      })
      .catch((err) => {
        console.error(err);
        return;
      });
  });

exports.onUserImageChange = functions
  .region("us-central1")
  .firestore.document("/users/{userId}")
  .onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log("image has changed");
      const batch = db.batch();
      return db
        .collection("screams")
        .where("userHandle", "==", change.before.data().handle)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const scream = db.doc(`/screams/${doc.id}`);
            batch.update(scream, { userImage: change.after.data().imageUrl });
          });
          return batch.commit();
        });
    } else return true;
  });

exports.onScreamDelete = functions
  .region("us-central1")
  .firestore.document("/screams/{screamId}")
  .onDelete((snapshot, context) => {
    const screamId = context.params.screamId;
    const batch = db.batch();
    return db
      .collection("comments")
      .where("screamId", "==", screamId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db.collection("likes").where("screamId", "==", screamId).get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection("notifications")
          .where("screamId", "==", screamId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => console.error(err));
  });

//TODO:add delete notifications to chain of deletes
exports.onBookDelete = functions
  .region("us-central1")
  .firestore.document("/books/{bookId}")
  .onDelete((snapshot, context) => {
    const bookId = context.params.bookId;
    const batch = db.batch();
    return db
      .collection("chapters")
      .where("bookId", "==", bookId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/chapters/${doc.id}`));
        });
        return db
          .collection("bookFavourites")
          .where("bookId", "==", bookId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/bookFavourites/${doc.id}`));
        });
        return db
          .collection("bookComments")
          .where("bookId", "==", bookId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/bookComments/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => console.error(err));
  });

// Change book image
exports.onBookImageChange = functions
.region("us-central1")
.firestore.document("/books/{bookId}")
.onUpdate((change) => {
  console.log(change.before.data());
  console.log(change.after.data());
  if (change.before.data().bookImage !== change.after.data().bookImage) {
    console.log("Book image has changed");
    const batch = db.batch();
    return db
      .collection("books")
      .where("userHandle", "==", change.before.data().handle)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          const book = db.doc(`/books/${doc.id}`);
          batch.update(book, { bookImage: change.after.data().bookImage });
        });
        return batch.commit();
      });
  } else return true;
});

exports.onChapterDelete = functions
  .region("us-central1")
  .firestore.document("/chapters/{chapterId}")
  .onDelete((snapshot, context) => {
    const chapterId = context.params.chapterId;
    const batch = db.batch();
    return db
      .collection("chapterLikes")
      .where("chapterId", "==", chapterId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/chapterLikes/${doc.id}`));
        });
        return db
          .collection("chapterComments")
          .where("chapterId", "==", chapterId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/chapterComments/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => console.error(err));
  });
