import {
  Controller, Post, Body, UseGuards, HttpCode, HttpStatus, Res,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChatbotService } from './chatbot.service';
import { AskDto } from './dto/ask.dto';
import { TtsDto } from './dto/ask.dto';

@ApiTags('Chatbot')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly service: ChatbotService) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pregunta al asistente virtual sobre el sistema (texto o voz)' })
  ask(@Body() dto: AskDto, @CurrentUser() user: { firstName?: string; role?: string }) {
    return this.service.ask(dto, user);
  }

  @Post('tts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Convierte la respuesta del asistente en audio (voz) para reproducir' })
  async tts(@Body() dto: TtsDto, @Res() res: Response) {
    const audio = await this.service.textToSpeech(dto.text);
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audio.length,
      'Cache-Control': 'no-store',
    });
    res.end(audio);
  }

  @Post('transcribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transcribe audio del micrófono a texto (voz a texto con Whisper)' })
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 25 * 1024 * 1024 } }))
  transcribe(@UploadedFile() file: Express.Multer.File) {
    return this.service.transcribe(file);
  }
}
