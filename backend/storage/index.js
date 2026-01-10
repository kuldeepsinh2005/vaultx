// backend/storage/index.js
const LocalStorageProvider = require("./LocalStorageProvider");

let provider;

const getStorageProvider = () => {
  if (!provider) {
    // Later: switch based on ENV (S3, GCS, etc.)
    // if (process.env.STORAGE_PROVIDER === "s3") ...

    provider = new LocalStorageProvider();
  }
  return provider;
};

module.exports = { getStorageProvider };
