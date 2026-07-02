import fetch from 'node-fetch';

const UPLOADCARE_PUBLIC_KEY = process.env.UPLOADCARE_PUBLIC_KEY;
const UPLOADCARE_SECRET_KEY = process.env.UPLOADCARE_SECRET_KEY;

/**
 * Upload a file (buffer) to Uploadcare and return the CDN URL.
 */
export async function uploadToUploadcare(buffer: Buffer, filename: string): Promise<string | null> {
    if (!UPLOADCARE_PUBLIC_KEY) {
        console.warn('[Uploadcare] No PUBLIC_KEY configured');
        return null;
    }

    try {
        const formData = new URLSearchParams();
        formData.append('UPLOADCARE_PUB_KEY', UPLOADCARE_PUBLIC_KEY);
        formData.append('UPLOADCARE_STORE', '1');
        
        // We use the "base" upload API for direct file uploads
        // Since we are using node-fetch, we need to build a Multipart request
        // For simplicity and to avoid more dependencies, we use the Uploadcare "base" endpoint with a buffer
        
        const res = await fetch('https://upload.uploadcare.com/base/', {
            method: 'POST',
            body: createMultipartBody(buffer, filename, UPLOADCARE_PUBLIC_KEY)
        });

        if (!res.ok) {
            const err = await res.text();
            console.error(`[Uploadcare] Upload failed (${res.status}): ${err}`);
            return null;
        }

        const data = await res.json() as any;
        const uuid = data.file;
        const cdnUrl = `https://ucarecdn.com/${uuid}/${filename}`;
        
        console.log(`[Uploadcare] Successfully uploaded ${filename} to ${cdnUrl}`);
        return cdnUrl;
    } catch (err: any) {
        console.error('[Uploadcare] Exception during upload:', err.message);
        return null;
    }
}

/**
 * Upload a file from a URL to Uploadcare and return the CDN URL.
 */
export async function uploadUrlToUploadcare(sourceUrl: string): Promise<string | null> {
    if (!UPLOADCARE_PUBLIC_KEY || !sourceUrl) return null;

    try {
        const startRes = await fetch(`https://upload.uploadcare.com/from_url/?pub_key=${UPLOADCARE_PUBLIC_KEY}&source_url=${encodeURIComponent(sourceUrl)}&store=1&check_URL_duplicates=1`, {
            method: 'POST'
        });

        const startData = await startRes.json() as any;
        const token = startData.token;
        if (!token) return null;

        // Poll for completion
        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const statusRes = await fetch(`https://upload.uploadcare.com/from_url/status/?token=${token}`);
            const statusData = await statusRes.json() as any;

            if (statusData.status === 'success') {
                const uuid = statusData.uuid;
                return `https://ucarecdn.com/${uuid}/`;
            }
            if (statusData.status === 'error') return null;
        }

        return null;
    } catch (e: any) {
        console.error('[Uploadcare] URL upload failed:', e.message);
        return null;
    }
}

function createMultipartBody(buffer: Buffer, filename: string, pubKey: string) {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const parts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="UPLOADCARE_PUB_KEY"\r\n\r\n${pubKey}\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="UPLOADCARE_STORE"\r\n\r\n1\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`,
        buffer,
        `\r\n--${boundary}--\r\n`
    ];
    return Buffer.concat(parts.map(p => typeof p === 'string' ? Buffer.from(p) : p));
}
