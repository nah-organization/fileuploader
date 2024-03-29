export const realbaseurl = process.env.FILEUPLOADER_REAL_URL ?? 'http://localhost/';

export const maxUploadSize = 2 * 1024 * 1024 * 1024; // 2GiB

export const topRedirect = process.env.FILEUPLOADER_TOP_REDIRECT ?? 'https://example.com/';

export const qrcodeBaseURL = process.env.MICRO_QR_URL ?? 'https://example.com/';
