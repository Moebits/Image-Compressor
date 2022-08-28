declare module "*.png"
declare module "*.jpg"
declare module "*.gif"
declare module "*.mp3"
declare module "*.wav"
declare module "shade-blend-color"
declare module "react-reorder"
declare module "sharp-phash"
declare module "sharp-phash/distance"
declare module "image-pixels"
declare module "bing-translate-api"
declare module "pdf-poppler"

type OpenImageProps = {
    label: string
    image: {
      data: Blob
      pos: number
      palette: unknown[]
      imgData: Blob
      transparency: unknown
      text: unknown
      width: number
      height: number
      bits: number
      colorType: number
      compressionMethod: number
      interlaceMethod: number
      colors: number
      hasAlphaChannel: boolean
      pixelBitlength: number
      colorSpace: string
    }
    width: number
    height: number
    imgData: Blob
    obj: unknown
  }
  
  declare namespace PDFKit {
    interface PDFDocument {
      openImage(path: string): OpenImageProps
    }
  }