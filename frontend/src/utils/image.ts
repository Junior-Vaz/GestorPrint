/**
 * Utilitários pra processar imagens no client antes de mandar pro backend.
 *
 * Por que: avatares e logos virariam JSON gigante se fossem em base64 cru
 * (foto de celular tem 3-8MB, base64 infla isso 33%). Pra avatar 96×96 o
 * usuário nunca precisa mais que ~50KB. Aqui redimensionamos via canvas e
 * exportamos como JPEG com qualidade controlada — fica 5-30KB típicos.
 */

export interface CompressOptions {
  /** Lado máximo (largura ou altura). Mantém aspect ratio. Default: 512 */
  maxSize?: number
  /** Qualidade JPEG (0-1). Default: 0.85 (bom balanço pra avatar) */
  quality?: number
  /** MIME type de saída. Default: 'image/jpeg' (melhor compressão) */
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png'
}

/**
 * Lê um File de input, redimensiona pra caber em `maxSize × maxSize`
 * (mantendo proporção), comprime e retorna data URL pronta pra mandar
 * ao backend dentro de JSON normal.
 *
 * Throws se o arquivo não for imagem ou se o canvas falhar (browser velho).
 */
export async function fileToCompressedDataUrl(
  file: File,
  opts: CompressOptions = {},
): Promise<string> {
  const { maxSize = 512, quality = 0.85, mimeType = 'image/jpeg' } = opts

  if (!file.type.startsWith('image/')) {
    throw new Error('Arquivo não é uma imagem')
  }

  // Carrega a imagem em memória usando object URL — mais leve que ler
  // tudo via FileReader.readAsDataURL antes de redimensionar.
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(objectUrl)
    const { width, height } = scaleDimensions(img.width, img.height, maxSize)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D não disponível neste navegador')

    // Fundo branco — JPEG não tem alpha, então PNG transparente vira preto
    // sem isso. Pra avatar redondo o fundo nem aparece (overflow:hidden).
    if (mimeType === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
    }
    ctx.drawImage(img, 0, 0, width, height)

    return canvas.toDataURL(mimeType, quality)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/** Carrega Image element a partir de URL e resolve quando completar */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Falha ao decodificar imagem'))
    img.src = src
  })
}

/** Calcula novas dimensões mantendo aspect ratio dentro do maxSize */
function scaleDimensions(w: number, h: number, maxSize: number) {
  if (w <= maxSize && h <= maxSize) return { width: w, height: h }
  const ratio = w > h ? maxSize / w : maxSize / h
  return {
    width:  Math.round(w * ratio),
    height: Math.round(h * ratio),
  }
}
