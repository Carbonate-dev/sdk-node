export interface Browser {
    getHtml(): Promise<string>;

    load(url: string, whitelist: string[]): Promise<void>;

    close(): Promise<void>;

    findByXpath(xpath: string): Promise<any[]>;

    findById(id: string): Promise<any[]>;

    evaluateScript(script: string): Promise<any>;

    performAction(action: any, elements: any[]): Promise<void>;
}
