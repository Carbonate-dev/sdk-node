import {Action} from "../SDK";

export interface Browser {
    getHtml(): Promise<string>;

    load(url: string, whitelist: string[], record: boolean): Promise<void>;

    close(): Promise<void>;

    findByXpath(xpath: string): Promise<any[]>;

    findById(id: string): Promise<any[]>;

    evaluateScript(script: string): Promise<any>;

    performAction(action: Action, elements: any[]): Promise<void>;

    record(name: string, data: any): Promise<void>;
}
