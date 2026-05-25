import { Controller, Get, Post, Param, Body, Query, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TemplatesService } from './templates.service';

@ApiTags('Templates')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private service: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar documentos patrón' })
  findAll(@Query('programId') programId?: string) { return this.service.findAll(programId); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  uploadTemplate(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @CurrentUser('id') userId: string,
  ) { return this.service.uploadTemplate(file, body, userId); }

  @Post(':id/rubrics')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  createRubric(@Param('id') templateId: string, @Body() body: any) {
    return this.service.createRubric(templateId, body);
  }
}
