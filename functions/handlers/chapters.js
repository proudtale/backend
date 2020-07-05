const { db } = require("../util/admin");
const { validateFormat } = require("../util/validators");

// This api is still in progress.
exports.getAllChapters = (req, res) => {
  db.collection("chapters")
    .orderBy("createdAt")
    .get()
    .then((data) => {
      let chapters = [];
      data.forEach((doc) => {
        chapters.push({
          chapterId: doc.id,
          bookId: req.params.bookId,
          title: doc.data().title,
          body: doc.data().body,
          createdAt: doc.data().createdAt,
          commentCount: doc.data().commentCount,
          likeCount: doc.data().likeCount,
        });
      });
      return res.json(chapters);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
// This api is still in progress.
exports.getAllChaptersOfABook = (req, res) => {
  db.collection("chapters")
    .where("bookId", "==", req.params.bookId)
    .orderBy("createdAt")
    .get()
    .then((data) => {
      let chapters = [];
      data.forEach((doc) => {
        chapters.push({
          chapterId: doc.id,
          title: doc.data().title,
          body: doc.data().body,
          createdAt: doc.data().createdAt,
          commentCount: doc.data().commentCount,
          likeCount: doc.data().likeCount,
        });
      });
      return res.json(chapters);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

//Post one chapter
exports.postOneChapter = (req, res) => {
  const { valid, errors } = validateFormat(req.body, ["body", "title"]);
  if (!valid) return res.status(400).json(errors);

  const newChapter = {
    bookId: req.params.bookId,
    title: req.body.title,
    body: req.body.body,
    createdAt: new Date().toUTCString(),
    likeCount: 0,
    commentCount: 0,
  };

  //we need to check that the book they want ot write for exists & that theyre authorized to write
  db.doc(`/books/${req.params.bookId}`)
    .get()
    .then((data) => {
      if (data.exists && data.data().userHandle === req.user.handle) {
        data.ref.update({ chapterCount: data.data().chapterCount + 1 });
        return db
          .collection("books").doc(newChapter.bookId).collection("chapters")
          .add(newChapter)
          .then((doc) => {
            const resChapter = newChapter;
            resChapter.chapterId = doc.id;
            res.json(resChapter);
          });
      } else if (!data.exists) {
        return res
          .status(404)
          .json({ err: "The book you are writing for cannot be found" });
      } else {
        return res.status(403).json({ err: "Unauthorized" });
      }
    })
    .catch((err) => {
      res.status(500).json({ error: "Something went wrong :(" });
      console.error(err);
    });
};

// Fetch one chapter
exports.getChapter = (req, res) => {
  let chapterData = {};
  db.doc(`/books/${req.params.bookId}/chapters/${req.params.chapterId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Chapters not found" });
      }
      chapterData = doc.data();
      chapterData.chapterId = doc.id;
      return db
        .collection("books").doc(req.params.bookId).collection("chapterComments")
        // .orderBy("createdAt", "desc")
        .where("chapterId", "==", req.params.chapterId)
        .get();
    })
    .then((data) => {
      chapterData.comments = [];
      data.forEach((doc) => {
        chapterData.comments.push(doc.data());
      });
      return res.json(chapterData);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
// This api is still in progress.
exports.editChapter = (req, res) => {
  const { valid, errors } = validateFormat(req.body, ["body", "title"]);
  if (!valid) return res.status(400).json(errors);

  const updateChapter = {
    body: req.body.body,
    title: req.body.title,
    userHandle: req.user.handle,
    editedAt: new Date().toISOString(),
    edited: true,
  };

  db.doc(`/books/${req.params.bookId}`)
    .get()
    .then((data) => {
      if (data.exists && data.data().userHandle === req.params.handle) {
        db.doc(`/chapters/${req.params.chapterId}`)
          .update(updateChapter)
          .then(() => {
            return res.json(updateChapter);
          });
      } else if (!data.exists) {
        return res
          .status(404)
          .json({ err: "The book you are writing for cannot be found" });
      } else {
        return res.status(403).json({ err: "Unauthorized" });
      }
    })
    .catch((err) => {
      return res.status(500).json({ error: err.code });
    });
};


// This api is still in progress. 
exports.commentOnChapter = (req, res) => {
  if (isEmpty(req.body.body))
    return res.status(400).json({ comment: "Must not be empty" });

  const newComment = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    chapterId: req.params.chapterId,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
  };
  console.log(newComment);

  db.doc(`/chapters/${req.params.chapterId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Chapter not found" });
      }
      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => {
      return db.collection("chapterComments").add(newComment);
    })
    .then(() => {
      res.json(newComment);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ error: "Something went wrong" });
    });
};
// This api is still in progress.
exports.likeChapter = (req, res) => {
  const likeDocument = db
    .collection("chapterLikes")
    .where("userHandle", "==", req.user.handle)
    .where("chapterId", "==", req.params.chapterId)
    .limit(1);

  const chapterDocument = db.doc(`/chapters/${req.params.chapterId}`);

  let chapterData;

  chapterDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        chapterData = doc.data();
        chapterData.chapterId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: "Chapter not found" });
      }
    })
    .then((data) => {
      if (data.empty) {
        return db
          .collection("chapterLikes")
          .add({
            chapterId: req.params.chapterId,
            userHandle: req.user.handle,
          })
          .then(() => {
            chapterData.likeCount++;
            return chapterDocument.update({ likeCount: chapterData.likeCount });
          })
          .then(() => {
            return res.json(chapterData);
          });
      } else {
        return res.status(400).json({ error: "Chapter already liked" });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
// This api is still in progress.
exports.unlikeChapter = (req, res) => {
  const likeDocument = db
    .collection("chapterLikes")
    .where("userHandle", "==", req.user.handle)
    .where("chapterId", "==", req.params.chapterId)
    .limit(1);

  const chapterDocument = db.doc(`/chapters/${req.params.chapterId}`);

  let chapterData;

  chapterDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        chapterData = doc.data();
        chapterData.chapterId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: "Chapter not found" });
      }
    })
    .then((data) => {
      if (data.empty) {
        return res.status(400).json({ error: "Chapter not liked" });
      } else {
        return db
          .doc(`/chapterLikes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            chapterData.likeCount--;
            return chapterDocument.update({ likeCount: chapterData.likeCount });
          })
          .then(() => {
            res.json(chapterData);
          });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
// This api is still in progress.
exports.deleteChapter = (req, res) => {
  const document = db.doc(`/chapters/${req.params.chapterId}`);
  let handle = "";
  db.doc(`/books/${req.params.bookId}`)
    .get()
    .then((data) => {
      if (!data.exists)
        return res
          .status(400)
          .json({ error: "Cannot find the book you are deleting from" });

      data.ref.update({ chapterCount: data.data().chapterCount - 1 });
      handle = data.data().userHandle;
      return document.get();
    })
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Chapter not found" });
      }
      if (handle !== req.user.handle) {
        return res.status(403).json({ error: "Unauthorized" });
      } else {
        return document.delete();
      }
    })
    .then(() => {
      res.json({ message: "Chapter deleted successfully" });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
