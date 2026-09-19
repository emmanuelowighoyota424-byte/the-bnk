declare module 'qrcode' {
  export interface QRCodeToDataURLOptions {
    type?: string;
    rendererOpts?: Record<string, unknown>;
    errorCorrectionLevel?: 'low' | 'medium' | 'quartile' | 'high' | string;
    margin?: number;
    scale?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export function toDataURL(
    text: string,
    options?: QRCodeToDataURLOptions
  ): Promise<string>;

  const QRCode: {
    toDataURL: typeof toDataURL;
  };

  export default QRCode;
}
