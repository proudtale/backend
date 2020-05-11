const { db } = require("../util/admin");
const { validateFormat } = require("../util/validators");
//get all books
exports.getAllBooks = (req, res) => {
  db.collection("books")
    .orderBy("createdAt", "desc")
    .get()
    .then((data) => {
      let books = [];
      data.forEach((doc) => {
        books.push({
          bookId: doc.id,
          title: doc.data().title,
          desc: doc.data().desc,
          userHandle: doc.data().userHandle,
          createdAt: doc.data().createdAt,
          commentCount: doc.data().commentCount,
          favCount: doc.data().favCount,
          chapterCount: doc.data().chapterCount,
          bookImage: doc.data().bookImage,
        });
      });
      return res.json(books);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
//post a book
exports.postOneBook = (req, res) => {
  const { errors, valid } = validateFormat(req.body, ["title", "desc"]);
  if (!valid) return res.status(400).json(errors);

  // const noBookImg = "no-book-img.png";
  const newBook = {
    title: req.body.title,
    desc: req.body.desc,
    userHandle: req.user.handle,
    userImage: req.user.imageUrl,
    createdAt: new Date().toISOString(),
    favCount: 0,
    commentCount: 0,
    chapterCount: 0,
  };

  db.collection("books")
    .add(newBook)
    .then((doc) => {
      const resBook = newBook;
      resBook.bookId = doc.id;
      res.json(resBook);
    })
    .catch((err) => {
      res.status(500).json({ error: "Something went wrong :(" });
      res.json(err);
      console.error(err);
    });
};

//edit a book
exports.editBook = (req, res) => {
  const { errors, valid } = validateFormat(req.body, ["title", "desc"]);
  if (!valid) return res.status(400).json(errors);

  const updateBook = {
    desc: req.body.desc,
    title: req.body.title,
    userHandle: req.user.handle,
    bookImage: req.body.bookImage,
    editedAt: new Date().toISOString(),
    edited: true,
  };

  db.doc(`/books/${req.params.bookId}`)
    .update(updateBook)
    .then(() => {
      return res.json(updateBook);
    })
    .catch((err) => {
      return res.status(500).json({ error: err.code });
    });
};

// Fetch one book
exports.getBook = (req, res) => {
  let bookData = {};
  db.doc(`/books/${req.params.bookId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Book not found" });
      }
      bookData = doc.data();
      bookData.bookId = doc.id;
      return db
        .collection("bookComments")
        .orderBy("createdAt", "desc")
        .where("bookId", "==", req.params.bookId)
        .get();
    })
    .then((data) => {
      bookData.comments = [];
      data.forEach((doc) => {
        bookData.comments.push(doc.data());
      });
      return res.json(bookData);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
// Comment on a book
exports.commentOnBook = (req, res) => {
  if (req.body.body.trim() === "")
    return res.status(400).json({ comment: "Must not be empty" });

  if (
    isNaN(req.body.review) ||
    !(0 < parseInt(req.body.review) && parseInt(req.body.review) < 6)
  )
    return res
      .status(400)
      .json({ review: "Must be an integer between 1 to 5" });
  const newComment = {
    body: req.body.body,
    review: req.body.review,
    createdAt: new Date().toISOString(),
    bookId: req.params.bookId,
    userHandle: req.user.handle,
    bookImage: req.book.bookImage,
  };
  console.log(newComment);

  db.doc(`/books/${req.params.bookId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Book not found" });
      }
      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => {
      return db.collection("bookComments").add(newComment);
    })
    .then(() => {
      res.json(newComment);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ error: "Something went wrong" });
    });
};
// Like a book
exports.favBook = (req, res) => {
  const favDocument = db
    .collection("bookFavourites")
    .where("userHandle", "==", req.user.handle)
    .where("bookId", "==", req.params.bookId)
    .limit(1);

  const bookDocument = db.doc(`/books/${req.params.bookId}`);

  let bookData;

  bookDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        bookData = doc.data();
        bookData.bookId = doc.id;
        return favDocument.get();
      } else {
        return res.status(404).json({ error: "Book not found" });
      }
    })
    .then((data) => {
      if (data.empty) {
        return db
          .collection("bookFavourites")
          .add({
            bookId: req.params.bookId,
            userHandle: req.user.handle,
          })
          .then(() => {
            bookData.favCount++;
            return bookDocument.update({ favCount: bookData.favCount });
          })
          .then(() => {
            return res.json(bookData);
          });
      } else {
        return res.status(400).json({ error: "Book already favourited" });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
// Unlik a book
exports.unfavBook = (req, res) => {
  const favDocument = db
    .collection("bookFavourites")
    .where("userHandle", "==", req.user.handle)
    .where("bookId", "==", req.params.bookId)
    .limit(1);

  const bookDocument = db.doc(`/books/${req.params.bookId}`);

  let bookData;

  bookDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        bookData = doc.data();
        bookData.bookId = doc.id;
        return favDocument.get();
      } else {
        return res.status(404).json({ error: "Book not found" });
      }
    })
    .then((data) => {
      if (data.empty) {
        return res.status(400).json({ error: "Book not favourited" });
      } else {
        return db
          .doc(`/bookFavourites/${data.docs[0].id}`)
          .delete()
          .then(() => {
            bookData.favCount--;
            return bookDocument.update({ favCount: bookData.favCount });
          })
          .then(() => {
            res.json(bookData);
          });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
// Delete a book
exports.deleteBook = (req, res) => {
  const document = db.doc(`/books/${req.params.bookId}`);
  document
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Book not found" });
      }
      if (doc.data().userHandle !== req.user.handle) {
        return res.status(403).json({ error: "Unauthorized" });
      } else {
        return document.delete();
      }
    })
    .then(() => {
      return res.json({ message: "Book deleted successfully" });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

// Upload a book image for book
exports.uploadBookImage = (req, res) => {
  const BusBoy = require("busboy");
  const path = require("path");
  const os = require("os");
  const fs = require("fs");

  const busboy = new BusBoy({ headers: req.headers });

  let imageToBeUploaded = {};
  let imageFileName;

  busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
    console.log(fieldname, file, filename, encoding, mimetype);
    if (mimetype !== "image/jpeg" && mimetype !== "image/png") {
      return res.status(400).json({ error: "Wrong file type submitted" });
    }
    // my.image.png => ['my', 'image', 'png']
    const imageExtension = filename.split(".")[filename.split(".").length - 1];
    // 32756238461724837.png
    imageFileName = `${Math.round(
      Math.random() * 1000000000000
    ).toString()}.${imageExtension}`;
    const filepath = path.join(os.tmpdir(), imageFileName);
    imageToBeUploaded = { filepath, mimetype };
    file.pipe(fs.createWriteStream(filepath));
  });
  busboy.on("finish", () => {
    admin
      .storage()
      .bucket()
      .upload(imageToBeUploaded.filepath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imageToBeUploaded.mimetype
          }
        }
      })
      .then(() => {
        const bookImage = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
        return db.doc(`/users/${req.user.handle}`).update({ bookImage });
      })
      .then(() => {
        return res.json({ message: "image uploaded successfully" });
      })
      .catch(err => {
        console.error(err);
        return res.status(500).json({ error: "something went wrong" });
      });
  });
  busboy.end(req.rawBody);
};
