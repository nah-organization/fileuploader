import { Transform } from "stream";

export function sizeLimitTransform(maxSize: number): [Promise<number>, Transform] {
    let size = 0;
    const transform = new Transform({
        transform(chunk: Buffer, encoding, callback) {
            size += chunk.length;
            if (size > maxSize) {
                this.destroy();
                return;
            }
            this.push(chunk);
            callback();
        },
    });

    const promise = new Promise<number>((resolve, reject) => {
        transform.on('end', () => {
            resolve(size);
        });
        transform.on('close', () => {
            reject();
        });
    });

    return [promise, transform];
}
