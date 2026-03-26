// backend/routes/folder.route.js
const express = require("express");
const router = express.Router();
const { verifyJWT } = require("../middleware/auth.middleware");
const { enforceBillingClear } = require("../middleware/billing.middleware");

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

// backend/routes/folder.route.js
router.post("/", verifyJWT, enforceBillingClear, createFolder); // Add here
router.get("/", verifyJWT, getFolders); // Viewing is usually okay, but you can add if you want total lockout
router.patch('/:id/rename', verifyJWT, enforceBillingClear, renameFolder); // Add here
router.patch("/:id/delete", verifyJWT, deleteFolder); // Usually allow deleting even if locked (to reduce bill)
router.patch("/:id/move", verifyJWT, enforceBillingClear, moveFolder); // Add here
router.get("/tree", verifyJWT, getFolderTree); 
router.get("/:id/download", verifyJWT, enforceBillingClear, downloadFolder); // CRITICAL
router.get("/:id/count", verifyJWT, getFolderCount);
router.get("/:id/all-contents", verifyJWT, enforceBillingClear, getFolderContentsRecursive); // Add here

module.exports = router;
