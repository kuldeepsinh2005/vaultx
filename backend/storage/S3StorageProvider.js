// backend/storage/S3StorageProvider.js
const StorageProvider = require("./StorageProvider");
const { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  CreateMultipartUploadCommand, 
  UploadPartCommand, 
  CompleteMultipartUploadCommand, 
  AbortMultipartUploadCommand 
} = require("@aws-sdk/client-s3");
const { createPresignedPost } = require("@aws-sdk/s3-presigned-post");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
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

  async getDownloadUrl(key, expiresIn = 300) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    
    // Generates the URL using your backend credentials
    return await getSignedUrl(this.s3, command, { expiresIn });
  }

/**
   * ✅ NEW: Generate a secure, temporary direct-UPLOAD URL (Valid for 5 mins change if needed)
   */
  async getUploadUrl(key, contentType = "application/octet-stream", expiresIn = 300) {
    // Note: We use PutObjectCommand instead of GetObjectCommand
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    
    return await getSignedUrl(this.s3, command, { expiresIn });
  }
  async getUploadUrlPost(key) {
    const { url, fields } = await createPresignedPost(this.s3, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ["content-length-range", 0, 5 * 1024 * 1024 * 1024] // Allow up to 5GB
      ],
      Expires: 300
    });
    
    // Returns the URL + the required cryptographic signature fields
    return { url, fields };
  }
  async initiateMultipartUpload(key, contentType = "application/octet-stream") {
    const command = new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const res = await this.s3.send(command);
    return res.UploadId; // We need this ID for all future steps
  }

  // 2️⃣ Generate Presigned URLs for every chunk
  async getMultipartUploadUrls(key, uploadId, partsCount) {
    const urls = [];
    for (let i = 1; i <= partsCount; i++) {
      const command = new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: i,
      });
      // 1-hour expiration
      const url = await getSignedUrl(this.s3, command, { expiresIn: 3600 });
      urls.push({ partNumber: i, url });
    }
    return urls;
  }

  // 3️⃣ Stitch the chunks together
  async completeMultipartUpload(key, uploadId, parts) {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts }, // Array of { PartNumber, ETag }
    });
    await this.s3.send(command);
  }

  // 4️⃣ Cancel upload if something fails
  async abortMultipartUpload(key, uploadId) {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
    });
    await this.s3.send(command);
  }
}

module.exports = S3StorageProvider;
