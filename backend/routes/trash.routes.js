const router = require("express").Router();
const { verifyJWT } = require("../middleware/auth.middleware");
const {
  getTrash,
  restoreFile,
  restoreFolder,
  permanentDeleteFile,
  permanentDeleteFolder
} = require("../controllers/trash.controller");

router.get("/", verifyJWT, getTrash);

router.patch("/file/:id/restore", verifyJWT, restoreFile);
router.patch("/folder/:id/restore", verifyJWT, restoreFolder);

router.delete("/file/:id", verifyJWT, permanentDeleteFile);
router.delete("/folder/:id", verifyJWT, permanentDeleteFolder);

module.exports = router;
