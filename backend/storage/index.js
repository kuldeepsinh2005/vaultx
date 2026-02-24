// backend/storage/index.js
const LocalStorageProvider = require("./LocalStorageProvider");
const S3StorageProvider = require("./S3StorageProvider");

let provider;

const getStorageProvider = () => {
  if (!provider) {
    if (process.env.STORAGE_PROVIDER === "s3") {
      provider = new S3StorageProvider();
    } else {
      provider = new LocalStorageProvider();
    }
  }
  return provider;
};

module.exports = { getStorageProvider };
