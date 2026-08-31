export interface PhotoStorage {
  put(input: {
    bytes: Uint8Array;
    mimeType: string;
  }): Promise<{ key: string }>;
  get(key: string): Promise<{ bytes: Uint8Array; mimeType: string }>;
  delete(key: string): Promise<void>;
}
