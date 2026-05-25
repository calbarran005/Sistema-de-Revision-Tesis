import { Controller, Get, Post, Put, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/roles.enum';
import { UsersService } from './users.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Users')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private service: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  findAll(@Query() pagination: PaginationDto, @Query('role') role?: string) {
    return this.service.findAll(pagination, { role });
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN)
  deactivate(@Param('id') id: string) { return this.service.deactivate(id); }

  @Post(':studentUserId/assign-advisor/:advisorUserId')
  @Roles(UserRole.ADMIN, UserRole.COORDINATOR)
  assignAdvisor(@Param('studentUserId') s: string, @Param('advisorUserId') a: string) {
    return this.service.assignAdvisor(s, a);
  }
}
