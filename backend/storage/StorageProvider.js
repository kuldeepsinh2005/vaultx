// backend/storage/StorageProvider.js
class StorageProvider {
  /**
   * Save encrypted file bytes
   * @param {Buffer} buffer
   * @param {Object} options
   * @returns {Promise<{ path, size, provider }>}
   */
  async save(buffer, options) {
    throw new Error("save() not implemented");
  }

  /**
   * Get readable stream for file
   * @param {String} path
   */
  async getStream(path) {
    throw new Error("getStream() not implemented");
  }

  /**
   * Delete file
   * @param {String} path
   */
  async delete(path) {
    throw new Error("delete() not implemented");
  }
}

module.exports = StorageProvider;
