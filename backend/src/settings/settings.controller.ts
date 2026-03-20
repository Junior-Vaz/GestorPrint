import { Controller, Get, Body, Patch, Post, UseInterceptors, UploadedFile, BadRequestException, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings(@CurrentTenant() tenantId: number) {
    return this.settingsService.getSettings(tenantId);
  }

  @Patch()
  updateSettings(@Body() updateData: UpdateSettingsDto, @CurrentTenant() tenantId: number) {
    return this.settingsService.updateSettings(updateData, tenantId);
  }

  @Post('logo')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req: any, file, cb) => {
        const tenantId = req.user?.tenantId || 1;
        const dir = `./uploads/${tenantId}`;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `logo-${uniqueSuffix}${ext}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
        return cb(new BadRequestException('Somente arquivos de imagem são permitidos!'), false);
      }
      cb(null, true);
    }
  }))
  async uploadLogo(@UploadedFile() file: Express.Multer.File, @CurrentTenant() tenantId: number) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }
    const logoUrl = `/api/files/${tenantId}/${file.filename}`;
    await this.settingsService.updateSettings({ logoUrl }, tenantId);
    return { logoUrl };
  }
}
