const StorageProvider = require("./StorageProvider");
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

class S3StorageProvider extends StorageProvider {
  constructor() {
    super();

    this.bucket = process.env.AWS_BUCKET;

    this.s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  /**
   * Save encrypted file bytes to S3
   */
  async save(buffer, { filename, contentType = "application/octet-stream" }) {
    const key = filename; // already constructed by controller

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    return {
      path: key,              // 👈 IMPORTANT: store S3 key
      size: buffer.length,
      provider: "s3",
    };
  }

  /**
   * Get readable stream from S3
   */
  async getStream(key) {
    const res = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    return res.Body; // readable stream
  }

  /**
   * Delete file from S3
   */
  async delete(key) {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }
}

module.exports = S3StorageProvider;
