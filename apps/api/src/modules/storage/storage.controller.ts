import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StorageService } from './storage.service';

@ApiTags('Storage')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
  constructor(private storage: StorageService) {}

  @Get('presigned-url')
  @ApiOperation({ summary: 'Obtener URL temporal de acceso a un archivo' })
  async getPresignedUrl(@Query('path') filePath: string) {
    const url = await this.storage.getPresignedUrl(filePath, 3600);
    return { url, expiresIn: 3600 };
  }
}
