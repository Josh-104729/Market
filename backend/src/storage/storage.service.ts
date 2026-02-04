import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
const sharp = require('sharp');

const B2 = require('backblaze-b2');

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private b2: any;
  private bucketId: string;
  private bucketName: string;
  private publicUrl: string;
  private authorized: boolean = false;

  constructor(private configService: ConfigService) {
    this.b2 = new B2({
      applicationKeyId: this.configService.get<string>('B2_APPLICATION_KEY_ID'),
      applicationKey: this.configService.get<string>('B2_APPLICATION_KEY'),
    });

    this.bucketId = this.configService.get<string>('B2_BUCKET_ID');
    this.bucketName = this.configService.get<string>('B2_BUCKET_NAME');
    this.publicUrl = this.configService.get<string>('B2_PUBLIC_URL');
  }

  private async authorize() {
    if (this.authorized) {
      return;
    }

    try {
      await this.b2.authorize();
      this.authorized = true;
      this.logger.log('Backblaze B2 authorized successfully');
    } catch (error) {
      this.logger.error('Failed to authorize Backblaze B2', error);
      throw error;
    }
  }

  /**
   * Compress and resize image for service cards
   * Service card size: h-48 (192px height), maintaining aspect ratio
   * Max width: 400px (typical card width)
   */
  private async compressServiceImage(buffer: Buffer, mimetype: string): Promise<Buffer> {
    try {
      const compressed = await sharp(buffer)
        .resize(400, 192, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
      
      return compressed;
    } catch (error) {
      this.logger.warn(`Failed to compress image, using original: ${error.message}`);
      return buffer; // Return original if compression fails
    }
  }

  /**
   * Upload a file to Backblaze B2
   * @param file - Multer file object (with buffer)
   * @param folder - Folder path in bucket (e.g., 'services', 'posts', 'categories')
   * @param compress - Whether to compress the image (for service images)
   * @returns Public URL of the uploaded file
   */
  async uploadFile(file: Express.Multer.File, folder: string, compress: boolean = false): Promise<string> {
    try {
      // Ensure we're authorized
      await this.authorize();

      // Generate unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      let fileName = `${folder}/${uniqueSuffix}-${file.originalname}`;
      let fileBuffer = file.buffer;
      let contentType = file.mimetype;
      let contentLength = file.size;

      // Compress service images
      if (compress && folder === 'services' && file.mimetype.startsWith('image/')) {
        fileBuffer = await this.compressServiceImage(file.buffer, file.mimetype);
        // Change extension to .jpg for compressed images
        const baseName = file.originalname.replace(/\.[^/.]+$/, '');
        fileName = `${folder}/${uniqueSuffix}-${baseName}.jpg`;
        contentType = 'image/jpeg';
        contentLength = fileBuffer.length;
      }

      // Get upload URL
      const { data: uploadUrlData } = await this.b2.getUploadUrl({
        bucketId: this.bucketId,
      });

      // Upload file using buffer
      await this.b2.uploadFile({
        uploadUrl: uploadUrlData.uploadUrl,
        uploadAuthToken: uploadUrlData.authorizationToken,
        fileName: fileName,
        data: fileBuffer,
        contentLength: contentLength,
        contentType: contentType,
      });

      // Construct public URL (ensure publicUrl ends with /)
      const baseUrl = this.publicUrl.endsWith('/') ? this.publicUrl : `${this.publicUrl}/`;
      const publicUrl = `${baseUrl}${fileName}`;
      
      this.logger.log(`File uploaded successfully: ${fileName}${compress ? ' (compressed)' : ''}`);
      return publicUrl;
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Upload multiple files to Backblaze B2
   * @param files - Array of Multer file objects
   * @param folder - Folder path in bucket
   * @returns Array of public URLs
   */
  async uploadFiles(files: Express.Multer.File[], folder: string): Promise<string[]> {
    try {
      const uploadPromises = files.map((file) => this.uploadFile(file, folder));
      const urls = await Promise.all(uploadPromises);
      return urls;
    } catch (error) {
      this.logger.error(`Failed to upload files: ${error.message}`, error.stack);
      throw new Error(`Failed to upload files: ${error.message}`);
    }
  }

  /**
   * Delete a file from Backblaze B2
   * @param fileUrl - Public URL of the file to delete
   * @returns true if deleted successfully
   */
  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      await this.authorize();

      // Extract file path from URL
      // URL format: https://f000.backblazeb2.com/file/bucket-name/folder/filename
      // or: https://your-public-url/folder/filename
      let fileName: string;
      
      if (fileUrl.includes(`/file/${this.bucketName}/`)) {
        // Standard B2 URL format
        const urlParts = fileUrl.split(`/file/${this.bucketName}/`);
        fileName = urlParts[1];
      } else if (fileUrl.startsWith(this.publicUrl)) {
        // Custom public URL format
        fileName = fileUrl.replace(this.publicUrl, '').replace(/^\//, '');
      } else {
        // Try to extract from URL by finding bucket name
        const bucketIndex = fileUrl.indexOf(`/${this.bucketName}/`);
        if (bucketIndex !== -1) {
          fileName = fileUrl.substring(bucketIndex + this.bucketName.length + 2);
        } else {
          // Fallback: extract everything after the last '/file/' or last '/'
          const fileIndex = fileUrl.lastIndexOf('/file/');
          if (fileIndex !== -1) {
            fileName = fileUrl.substring(fileIndex + 6);
          } else {
            const lastSlash = fileUrl.lastIndexOf('/');
            fileName = fileUrl.substring(lastSlash + 1);
          }
        }
      }

      // List files to get fileId
      const { data: fileList } = await this.b2.listFileNames({
        bucketId: this.bucketId,
        startFileName: fileName,
        maxFileCount: 100,
      });

      // Find exact match
      const file = fileList.files.find(f => f.fileName === fileName);
      
      if (!file) {
        this.logger.warn(`File not found: ${fileName}`);
        return false;
      }

      // Delete file
      await this.b2.deleteFileVersion({
        fileId: file.fileId,
        fileName: fileName,
      });

      this.logger.log(`File deleted successfully: ${fileName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`, error.stack);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Delete multiple files from Backblaze B2
   * @param fileUrls - Array of public URLs
   * @returns Array of deletion results
   */
  async deleteFiles(fileUrls: string[]): Promise<boolean[]> {
    try {
      const deletePromises = fileUrls.map((url) => this.deleteFile(url));
      const results = await Promise.all(deletePromises);
      return results;
    } catch (error) {
      this.logger.error(`Failed to delete files: ${error.message}`, error.stack);
      throw new Error(`Failed to delete files: ${error.message}`);
    }
  }
}

