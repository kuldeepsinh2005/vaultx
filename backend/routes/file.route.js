// backend/routes/file.route.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { verifyJWT } = require("../middleware/auth.middleware");
const {
  uploadFile,
  getMyFiles,
  downloadFile,
  moveFile,
  deleteFile,
  getPresignedDownloadUrl,
  getUploadTicket,
  finalizeUpload,
  initiateMultipart,
  completeMultipart,
  abortMultipart,
  renameFile
} = require("../controllers/file.controller");
const { enforceBillingClear } = require("../middleware/billing.middleware");

// Storage config
const upload = multer({ storage: multer.memoryStorage() });

// Routes
router.post(
  "/upload",
  verifyJWT,
  enforceBillingClear,  
  upload.single("file"),
  uploadFile
);

router.get("/my", verifyJWT, getMyFiles);

router.get("/download/:id", verifyJWT, enforceBillingClear,downloadFile);
router.patch("/:id/move", verifyJWT, moveFile);
router.patch("/:id/delete", verifyJWT, deleteFile); 
router.get("/presigned-download/:id", verifyJWT,enforceBillingClear, getPresignedDownloadUrl);
router.post("/upload-ticket", verifyJWT,enforceBillingClear, getUploadTicket);
router.post("/finalize", verifyJWT, enforceBillingClear, finalizeUpload);
// Add these to your routes
router.post("/multipart/initiate", verifyJWT, enforceBillingClear, initiateMultipart);
router.post("/multipart/complete", verifyJWT, enforceBillingClear, completeMultipart);
router.post("/multipart/abort", verifyJWT, enforceBillingClear, abortMultipart);
router.patch('/:id/rename', verifyJWT, renameFile);

module.exports = router;
