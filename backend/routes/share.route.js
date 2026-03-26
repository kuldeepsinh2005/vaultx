const express = require('express');
const router = express.Router();
const { verifyJWT } = require('../middleware/auth.middleware');
const { enforceBillingClear } = require('../middleware/billing.middleware'); // Import here
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
  getSharedFolderContentsRecursive,
  getFolderContentsRecursive
} = require('../controllers/share.controller');

// 1. Basic Auth for everything
router.use(verifyJWT);

// 2. Public Key lookup (Usually safe to leave open so others can share TO this user)
router.post('/public-key', asyncHandler(getUserPublicKey));

// 3. Sharing Actions (BLOCK: Prevent generating new shares while in debt)
router.post('/', enforceBillingClear, asyncHandler(shareFile));
router.post('/bulk', enforceBillingClear, asyncHandler(shareFolderBulk));

// 4. Distribution/Downloads (BLOCK: Prevent owner from serving files via shares)
router.get('/presigned-download/:id', enforceBillingClear, asyncHandler(getSharedFileDownloadUrl));
router.get('/folder/:folderId/contents', enforceBillingClear, getSharedFolderContents);
router.get('/folder/:folderId/all-contents', enforceBillingClear, asyncHandler(getSharedFolderContentsRecursive));
router.get('/folder/:folderId/recursive-contents', enforceBillingClear, asyncHandler(getFolderContentsRecursive));

// 5. Management (ALLOW: Users should be able to revoke access even if locked)
router.get('/me', asyncHandler(getSharedWithMe));
router.get('/access-list', getAccessList);
router.post('/revoke', revokeAccess);
router.get('/item/:itemId/pending-sync', asyncHandler(getPendingSync));

module.exports = router;