import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs principales del dashboard' })
  getKPIs(@Query('programId') programId?: string, @Query('period') period?: string) {
    return this.service.getKPIs({ programId, period });
  }

  @Get('submissions-by-month')
  getSubmissionsByMonth(@Query('year') year?: string) {
    return this.service.getSubmissionsByMonth(year ? parseInt(year) : undefined);
  }

  @Get('status-distribution')
  getStatusDistribution() { return this.service.getStatusDistribution(); }

  @Get('score-distribution')
  getScoreDistribution() { return this.service.getScoreDistribution(); }

  @Get('advisor-workload')
  getAdvisorWorkload() { return this.service.getAdvisorWorkload(); }

  @Get('recent-activity')
  getRecentActivity(@Query('limit') limit?: string) {
    return this.service.getRecentActivity(limit ? parseInt(limit) : 10);
  }
}
