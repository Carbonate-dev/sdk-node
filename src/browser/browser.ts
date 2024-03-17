import {ActionType} from "../actionType";

export default interface Browser {
    getHtml(): Promise<string>;

    load(url: string, whitelist: string[], record: boolean): Promise<void>;

    close(): Promise<void>;

    findByXpath(xpath: string): Promise<any[]>;

    findById(id: string): Promise<any[]>;

    evaluateScript(script: string): Promise<any>;

    performAction(type: ActionType, elements: any[], value?: string): Promise<void>;

    record(name: string, data: any): Promise<void>;
}
