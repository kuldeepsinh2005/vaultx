const express = require('express');
const router = express.Router();
const { verifyJWT } = require('../middleware/auth.middleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { 
  getUserPublicKey, 
  shareFile, 
  getSharedWithMe,
  getSharedFileDownloadUrl,
  shareFolderBulk,
  getSharedFolderContents,
  getAccessList,
  revokeAccess,
  getPendingSync,
  getSharedFolderContentsRecursive
} = require('../controllers/share.controller');

// All share routes require authentication
router.use(verifyJWT);

router.post('/public-key', asyncHandler(getUserPublicKey));

router.post('/', asyncHandler(shareFile));

router.get('/me', asyncHandler(getSharedWithMe));

router.get('/presigned-download/:id', asyncHandler(getSharedFileDownloadUrl));

router.post('/bulk', asyncHandler(shareFolderBulk));

router.get('/folder/:folderId/contents', getSharedFolderContents);

router.get('/access-list', getAccessList);

router.post('/revoke', revokeAccess);

router.get('/item/:itemId/pending-sync', asyncHandler(getPendingSync));

router.get('/folder/:folderId/all-contents', asyncHandler(getSharedFolderContentsRecursive));

module.exports = router;