import { Controller, Get, Post, Param, Query, UseGuards, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/roles.enum';
import { AiAnalysisService } from './ai-analysis.service';

@ApiTags('AI Analysis')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai-analysis')
export class AiAnalysisController {
  constructor(private service: AiAnalysisService) {}

  @Get('submission/:submissionId')
  @ApiOperation({ summary: 'Obtener análisis IA de un avance' })
  getAnalysis(@Param('submissionId') submissionId: string) {
    return this.service.getAnalysis(submissionId);
  }

  @Post('submission/:submissionId/start')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Iniciar evaluación IA de un avance (solo revisores)' })
  startAnalysis(@Param('submissionId') submissionId: string) {
    return this.service.startAnalysis(submissionId);
  }

  @Post('batch')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Evaluar múltiples avances con IA en lote (solo revisores)' })
  startBatchAnalysis(@Body() body: { submissionIds: string[] }) {
    return this.service.startBatchAnalysis(body.submissionIds);
  }

  @Get(':analysisId/findings')
  @ApiOperation({ summary: 'Obtener hallazgos de un análisis' })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'dimension', required: false })
  getFindings(
    @Param('analysisId') analysisId: string,
    @Query('severity') severity?: string,
    @Query('dimension') dimension?: string,
  ) {
    return this.service.getFindings(analysisId, { severity, dimension });
  }

  @Post('findings/:findingId/accept')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Aceptar hallazgo de IA' })
  acceptFinding(
    @Param('findingId') findingId: string,
    @Body() body: { note?: string },
  ) {
    return this.service.acceptFinding(findingId, body.note);
  }

  @Post('findings/:findingId/reject')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Rechazar/modificar hallazgo de IA' })
  rejectFinding(
    @Param('findingId') findingId: string,
    @Body() body: { note: string },
  ) {
    return this.service.rejectFinding(findingId, body.note);
  }

  @Post('submission/:submissionId/retry')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reintentar análisis fallido' })
  retryAnalysis(@Param('submissionId') submissionId: string) {
    return this.service.retryFailedAnalysis(submissionId);
  }

  @Get('queue/status')
  @Roles(UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Estado de la cola de análisis' })
  getQueueStatus() {
    return this.service.getQueueStatus();
  }
}
