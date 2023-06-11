export class CarbonateException extends Error {
    injectCarbonateLogs = true;
}

export class ApiException extends CarbonateException {}

export class BrowserException extends CarbonateException {}

export class FailedExtractionException extends CarbonateException {}

export class InvalidXpathException extends CarbonateException {}

export class TestException extends CarbonateException {
    constructor(logs: string) {
        super();
        this.stack = "Carbonate logs:\n" + logs
    }
}