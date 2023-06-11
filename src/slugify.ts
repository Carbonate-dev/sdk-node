export default function slugify(file: string): string {
    file = file.replace(/([^\w\s\d\-_~,;\[\]\(\).])/g, '');
    file = file.replace(/([.]{2,})/g, '');

    return file;
}