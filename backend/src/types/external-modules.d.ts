declare namespace Express {
  namespace Multer {
    interface File {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      destination: string;
      filename: string;
      path: string;
      buffer: Uint8Array;
    }
  }
}

declare module 'passport-jwt' {
  export class Strategy {
    constructor(options: any, verify?: (...args: any[]) => void);
  }

  export const ExtractJwt: {
    fromAuthHeaderAsBearerToken(): (req: any) => string | null;
  };
}

declare module 'multer' {
  import type { Request } from 'express';

  export type DestinationCallback = (
    error: Error | null,
    destination: string,
  ) => void;
  export type FilenameCallback = (error: Error | null, filename: string) => void;

  export interface DiskStorageOptions {
    destination?:
      | string
      | ((req: Request, file: Express.Multer.File, cb: DestinationCallback) => void);
    filename?: (
      req: Request,
      file: Express.Multer.File,
      cb: FilenameCallback,
    ) => void;
  }

  export interface StorageEngine {}

  export function diskStorage(options: DiskStorageOptions): StorageEngine;
}
