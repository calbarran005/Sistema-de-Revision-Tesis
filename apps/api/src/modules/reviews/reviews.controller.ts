import { Controller, Get, Post, Put, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(private service: ReviewsService) {}

  @Post('submission/:submissionId/start')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Iniciar o recuperar revisión de un avance' })
  startReview(@Param('submissionId') id: string, @CurrentUser('id') userId: string) {
    return this.service.createOrGetReview(id, userId);
  }

  @Get('submission/:submissionId')
  @ApiOperation({ summary: 'Obtener revisión de un avance' })
  getReview(@Param('submissionId') id: string) {
    return this.service.findBySubmission(id);
  }

  @Post(':reviewId/comments')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  addComment(@Param('reviewId') reviewId: string, @Body() body: any) {
    return this.service.addComment(reviewId, body);
  }

  @Patch(':reviewId/checklist/:itemId')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  updateChecklist(@Param('reviewId') reviewId: string, @Param('itemId') itemId: string, @Body() body: any) {
    return this.service.updateChecklist(reviewId, itemId, body);
  }

  @Put(':reviewId/scores')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  updateScores(@Param('reviewId') reviewId: string, @Body() body: any) {
    return this.service.updateScores(reviewId, body);
  }

  @Post(':reviewId/finalize')
  @Roles(UserRole.ADVISOR, UserRole.COORDINATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Aprobar, rechazar u observar avance' })
  finalize(
    @Param('reviewId') reviewId: string,
    @Body() body: { decision: 'APPROVED' | 'REJECTED' | 'OBSERVED'; note: string; notificationEmail?: string },
  ) {
    return this.service.finalizeReview(reviewId, body.decision, body.note, body.notificationEmail);
  }
}
