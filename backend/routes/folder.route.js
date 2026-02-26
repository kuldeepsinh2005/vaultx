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
  getFolderTree,
  downloadFolder,
  getFolderCount,
  getFolderContentsRecursive,
} = require("../controllers/folder.controller");

router.post("/", verifyJWT, createFolder);
router.get("/", verifyJWT, getFolders);
router.patch('/:id/rename', verifyJWT, renameFolder);
router.patch("/:id/delete", verifyJWT, deleteFolder);
router.patch("/:id/move", verifyJWT, moveFolder);
router.get("/tree", verifyJWT, getFolderTree);
router.get("/:id/download", verifyJWT, downloadFolder);
router.get("/:id/count", verifyJWT, getFolderCount);
router.get("/:id/all-contents", verifyJWT, getFolderContentsRecursive);


module.exports = router;
