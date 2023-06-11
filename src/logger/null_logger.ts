import * as fs from "fs";
import Logger from "./logger";

export class NullLogger implements Logger {
    emergency(message: string, context: Record<string, any> = {}): void {
    }

    alert(message: string, context: Record<string, any> = {}): void {
    }

    critical(message: string, context: Record<string, any> = {}): void {
    }

    error(message: string, context: Record<string, any> = {}): void {
    }

    warning(message: string, context: Record<string, any> = {}): void {
    }

    notice(message: string, context: Record<string, any> = {}): void {
    }

    info(message: string, context: Record<string, any> = {}): void {
    }

    debug(message: string, context: Record<string, any> = {}): void {
    }
}