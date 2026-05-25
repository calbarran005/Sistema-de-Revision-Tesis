import {
  Controller, Get, Post, Param, Query, UseGuards, UseInterceptors,
  UploadedFile, UploadedFiles, Body, Req, ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SubmissionsService } from './submissions.service';

@ApiTags('Submissions')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('submissions')
export class SubmissionsController {
  constructor(private service: SubmissionsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Subir un avance de tesis (Word/PDF)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        description: { type: 'string' },
        templateId: { type: 'string' },
        academicPeriod: { type: 'string' },
        deliveryNumber: { type: 'number' },
      },
    },
  })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @CurrentUser('id') userId: string,
    @CurrentUser('studentProfile') studentProfile: any,
  ) {
    return this.service.uploadSubmission(file, studentProfile?.id, userId, body);
  }

  @Post('batch')
  @UseInterceptors(FilesInterceptor('files', 10, { limits: { fileSize: 50 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Subir varios avances por lote' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
        templateId: { type: 'string' },
        academicPeriod: { type: 'string' },
        deliveryNumber: { type: 'number' },
        studentId: { type: 'string', description: 'Opcional si es un estudiante subiendo sus propios archivos' },
      },
    },
  })
  async uploadBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: any,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.uploadBatchSubmissions(files, userId, body);
  }

  @Get()
  @ApiOperation({ summary: 'Listar avances (con filtros y paginación)' })
  findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Query() query: any,
  ) {
    return this.service.findAll(query, userRole, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de un avance con análisis IA y revisión humana' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    return this.service.findOne(id, userId, userRole);
  }

  @Get(':id/download-url')
  @ApiOperation({ summary: 'Obtener URL temporal para descargar/previsualizar el archivo' })
  getDownloadUrl(@Param('id') id: string) {
    return this.service.getPresignedUrl(id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Historial de versiones de un avance' })
  getVersionHistory(@Param('id') id: string) {
    return this.service.getVersionHistory(id);
  }
}
