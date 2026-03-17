import { Controller, Post, Get, Delete, Param, UseInterceptors, UploadedFile, Res, ParseIntPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import type { Response } from 'express';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload/:orderId')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @Param('orderId', ParseIntPipe) orderId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.filesService.saveFile(orderId, file);
  }

  @Get('order/:orderId')
  getByOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.filesService.findByOrder(orderId);
  }

  @Get(':filename')
  async serveFile(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = await this.filesService.getFile(filename);
    return res.sendFile(filePath);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.filesService.remove(id);
  }
}
