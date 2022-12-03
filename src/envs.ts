export const hostname = process.env.FILEUPLOADER_HOSTNAME ?? 'localhost';

export const maxUploadSize = 2 * 1024 * 1024 * 1024; // 2GiB

export const topRedirect = process.env.FILEUPLOADER_TOP_REDIRECT ?? 'https://example.com/';
