import * as fs from "fs";
import Logger from "./logger";
import WritableStream = NodeJS.WritableStream;

export default class TestLogger implements Logger {
    private outputFile: WritableStream | null;
    private logs: Array<{ level: string; message: string; context: Record<string, any> }>;

    constructor(outputPath: WritableStream | string | null = null) {
        if (typeof outputPath === 'string') {
            outputPath = fs.createWriteStream(outputPath);
        }

        this.outputFile = outputPath;
        this.logs = [];
    }

    log(level: string, message: string, context: Record<string, any> = {}): void {
        if (this.outputFile) {
            const log = this.formatLog(level, message, context);
            this.outputFile.write(log + '\n');
        } else {
            this.logs.push({ level, message, context });
        }
    }

    formatLog(level: string, message: string, context: Record<string, any>): string {
        return `${level}: ${message} [${JSON.stringify(context)}]`;
    }

    clearLogs(): void {
        this.logs = [];
    }

    getLogs(): string {
        let logs = '';
        for (const log of this.logs) {
            logs += this.formatLog(log.level, log.message, log.context) + '\n';
        }

        return logs;
    }

    emergency(message: string, context: Record<string, any> = {}): void {
        this.log('emergency', message, context);
    }

    alert(message: string, context: Record<string, any> = {}): void {
        this.log('alert', message, context);
    }

    critical(message: string, context: Record<string, any> = {}): void {
        this.log('critical', message, context);
    }

    error(message: string, context: Record<string, any> = {}): void {
        this.log('error', message, context);
    }

    warning(message: string, context: Record<string, any> = {}): void {
        this.log('warning', message, context);
    }

    notice(message: string, context: Record<string, any> = {}): void {
        this.log('notice', message, context);
    }

    info(message: string, context: Record<string, any> = {}): void {
        this.log('info', message, context);
    }

    debug(message: string, context: Record<string, any> = {}): void {
        this.log('debug', message, context);
    }
}