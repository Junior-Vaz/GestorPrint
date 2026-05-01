import { Injectable } from '@nestjs/common';

// Lê a versão direto do package.json. `require` funciona aqui porque o
// tsconfig usa module=commonjs (sem precisar habilitar resolveJsonModule).
// O fallback "0.0.0" cobre o caso bizarro de o JSON não ter campo version.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg: { version?: string } = require('../package.json');

@Injectable()
export class AppService {
  // GET /api → identificação do serviço.
  // Útil pra healthchecks externos e verificação rápida de qual versão está
  // rodando em cada ambiente (dev/staging/prod).
  getInfo() {
    return {
      name:    'GestorPrint API',
      version: pkg.version ?? '0.0.0',
    };
  }
}
