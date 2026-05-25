import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private bucket: string;
  private templatesBucket: string;
  private reportsBucket: string;

  constructor(private config: ConfigService) {
    this.client = new Minio.Client({
      endPoint: config.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(config.get<string>('MINIO_PORT', '9000')),
      useSSL: config.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: config.get<string>('MINIO_ACCESS_KEY', 'santos_admin'),
      secretKey: config.get<string>('MINIO_SECRET_KEY', 'santos_minio_2024'),
    });

    this.bucket = config.get<string>('MINIO_BUCKET', 'santos-documents');
    this.templatesBucket = config.get<string>('MINIO_TEMPLATES_BUCKET', 'santos-templates');
    this.reportsBucket = config.get<string>('MINIO_REPORTS_BUCKET', 'santos-reports');
  }

  async onModuleInit() {
    await this.ensureBucketsExist();
  }

  private async ensureBucketsExist() {
    for (const bucket of [this.bucket, this.templatesBucket, this.reportsBucket]) {
      const exists = await this.client.bucketExists(bucket).catch(() => false);
      if (!exists) {
        await this.client.makeBucket(bucket, 'us-east-1').catch((err) => {
          this.logger.warn(`No se pudo crear bucket ${bucket}: ${err.message}`);
        });
        this.logger.log(`Bucket creado: ${bucket}`);
      }
    }
  }

  async uploadDocument(
    file: Express.Multer.File,
    folder: string = 'submissions',
  ): Promise<{ filePath: string; fileName: string; fileSize: number }> {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    const objectName = `${folder}/${uniqueName}`;

    await this.client.putObject(
      this.bucket,
      objectName,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype, 'x-original-name': encodeURIComponent(file.originalname) },
    );

    this.logger.log(`Archivo subido: ${objectName} (${file.size} bytes)`);
    return { filePath: objectName, fileName: file.originalname, fileSize: file.size };
  }

  async uploadTemplate(file: Express.Multer.File): Promise<{ filePath: string; fileName: string; fileSize: number }> {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    const objectName = `templates/${uniqueName}`;

    await this.client.putObject(
      this.templatesBucket,
      objectName,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype },
    );

    return { filePath: objectName, fileName: file.originalname, fileSize: file.size };
  }

  async uploadReport(buffer: Buffer, reportName: string): Promise<string> {
    const objectName = `reports/${uuidv4()}-${reportName}`;
    await this.client.putObject(this.reportsBucket, objectName, buffer, buffer.length, {
      'Content-Type': 'application/pdf',
    });
    return objectName;
  }

  async downloadFile(filePath: string, bucketOverride?: string): Promise<Buffer> {
    const bucket = bucketOverride || this.bucket;

    // Determinar bucket por el path
    const targetBucket = filePath.startsWith('templates/') ? this.templatesBucket
      : filePath.startsWith('reports/') ? this.reportsBucket
      : bucket;

    const chunks: Buffer[] = [];
    const stream = await this.client.getObject(targetBucket, filePath);

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async getPresignedUrl(filePath: string, expirySeconds: number = 3600): Promise<string> {
    const bucket = filePath.startsWith('templates/') ? this.templatesBucket
      : filePath.startsWith('reports/') ? this.reportsBucket
      : this.bucket;

    return this.client.presignedGetObject(bucket, filePath, expirySeconds);
  }

  async deleteFile(filePath: string): Promise<void> {
    const bucket = filePath.startsWith('templates/') ? this.templatesBucket
      : filePath.startsWith('reports/') ? this.reportsBucket
      : this.bucket;

    await this.client.removeObject(bucket, filePath);
  }

  getBuckets() {
    return { documents: this.bucket, templates: this.templatesBucket, reports: this.reportsBucket };
  }
}
