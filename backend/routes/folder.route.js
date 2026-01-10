// backend/routes/folder.route.js
const express = require("express");
const router = express.Router();
const { verifyJWT } = require("../middleware/auth.middleware");

const {
  createFolder,
  getFolders,
  renameFolder,
  deleteFolder,
  moveFolder,
  getFolderTree
} = require("../controllers/folder.controller");

router.post("/", verifyJWT, createFolder);
router.get("/", verifyJWT, getFolders);
router.patch("/:id", verifyJWT, renameFolder);
router.delete("/:id", verifyJWT, deleteFolder);
router.patch("/:id/move", verifyJWT, moveFolder);
router.get("/tree", verifyJWT, getFolderTree);

module.exports = router;
