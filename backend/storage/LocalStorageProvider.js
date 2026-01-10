// backend/storage/LocalStorageProvider.js
const fs = require("fs");
const path = require("path");
const StorageProvider = require("./StorageProvider");

class LocalStorageProvider extends StorageProvider {
  constructor() {
    super();
    this.basePath = path.join(__dirname, "..", "..", "uploads");
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  async save(buffer, { filename }) {
    const filePath = path.join(this.basePath, filename);
    await fs.promises.writeFile(filePath, buffer);

    return {
      path: filePath,
      size: buffer.length,
      provider: "local",
    };
  }

  async getStream(filePath) {
    return fs.createReadStream(filePath);
  }

  async delete(filePath) {
    await fs.promises.unlink(filePath);
  }
}

module.exports = LocalStorageProvider;
