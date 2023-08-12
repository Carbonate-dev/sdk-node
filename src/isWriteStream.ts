import WritableStream = NodeJS.WritableStream;

export default function isWritableStream(obj: any): obj is WritableStream {
    return obj && typeof obj.write === 'function';
}