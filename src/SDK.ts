import { Browser } from './browser/browser';
import Api from './api/api';
import { FailedExtractionException, InvalidXpathException, BrowserException } from './exceptions/exceptions';
import slugify from './slugify';
import { TestLogger } from './logger/test_logger';
import * as fs from "fs";
import {WriteStream} from "fs";
import Logger from "./logger/logger";
import {NullLogger} from "./logger/null_logger";
import {action} from "webdriverio/build/commands/browser/action";

export class SDK {
    browser: Browser;
    client: Api;
    testPrefix: string | null = null;
    testName: string | null = null;
    cacheDir: string | null;
    logger: Logger;
    networkWhitelist: string[] = [];
    instructionCache: { [key: string]: any } = {};

    constructor(
        browser: Browser,
        cacheDir: string | null = null,
        apiUserId: string | null = null,
        apiKey: string | null = null,
        logging: WriteStream | false | null | string | Logger = null,
        client: Api | null = null,
    ) {
        this.browser = browser;
        this.client = client || new Api(apiUserId, apiKey);
        this.cacheDir = cacheDir || process.env.CARBONATE_CACHE_DIR || null;

        // Path to file or IO object
        if (logging === false) {
            this.logger = new NullLogger();
        }
        else if (logging === null || typeof logging === 'string' || logging instanceof WriteStream) {
            this.logger = new TestLogger(logging);
        }
        // Custom logger
        else {
            this.logger = logging;
        }
    }

    getTestName(): string {
        if (!this.testName) {
            throw new Error("You must call startTest() or use the custom jest environment");
        }

        if (this.testPrefix) {
            return this.testPrefix + ': ' + this.testName;
        }

        return this.testName;
    }

    async waitForLoad(skipFunc: () => Promise<boolean>): Promise<void> {
        let i = 0;

        while (await this.browser.evaluateScript('window.carbonate_dom_updating') || await this.browser.evaluateScript('window.carbonate_active_xhr')) {
            if (await skipFunc()) {
                this.logger.info("Found cached element, skipping DOM wait");
                break;
            }

            if (await this.browser.evaluateScript('window.carbonate_dom_updating')) {
                this.logger.info("Waiting for DOM update to finish");
            } else {
                this.logger.info("Waiting for active Network to finish");
            }

            if (i > 20) {
                throw new BrowserException("Waited too long for DOM/XHR update to finish");
            }

            await new Promise(resolve => setTimeout(resolve, 500));
            i += 1;
        }
    }

    getCachePath(instruction: string): string | null {
        if (!this.cacheDir || !this.testName) {
            return null;
        }

        return this.cacheDir + '/' + slugify(this.testName) + '/' + slugify(instruction) + '.json';
    }

    cachedActions(instruction: string): any[] {
        let cachePath = this.getCachePath(instruction);

        if (cachePath && fs.existsSync(cachePath)) {
            // Open the file as parse the json
            const actions = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            this.logger.debug("Using locally cached actions", {actions: actions});
            return actions;
        }

        return [];
    }

    async extractActions(instruction: string): Promise<any[]> {
        const actions = await this.client.extractActions(this.getTestName(), instruction, await this.browser.getHtml());

        if (actions.length > 0) {
            this.logger.info("Successfully extracted actions", {actions: actions});
            this.cacheInstruction(actions, instruction);

            return actions;
        }

        throw new FailedExtractionException('Could not extract actions');
    }

    cacheInstruction(result: any, instruction: string): void {
        if (this.cacheDir != null) {
            this.instructionCache[instruction] = result;
        }
    }

    writeCache(): void {
        if (this.cacheDir == null) {
            throw new Error("Cannot call writeCache without setting cacheDir");
        }

        if (!this.testName) {
            throw new Error("Test name not set, please call startTest first");
        }

        if (Object.keys(this.instructionCache).length === 0) {
            return;
        }

        // Create the cache directory if it doesn't exist
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, {recursive: true});
        }

        // Create the test name directory if it doesn't exist
        if (!fs.existsSync(this.cacheDir + '/' + slugify(this.testName))) {
            fs.mkdirSync(this.cacheDir + '/' + slugify(this.testName), {recursive: true});
        }

        for (let instruction in this.instructionCache) {
            // Write the actions to a file
            fs.writeFileSync(this.getCachePath(instruction) as string, JSON.stringify(this.instructionCache[instruction]));
        }

        this.instructionCache = {};
    }

    cachedAssertions(instruction: string): any[] {
        let cachePath = this.getCachePath(instruction);

        if (cachePath && fs.existsSync(cachePath)) {
            // Open the file as parse the json
            const actions = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            this.logger.debug("Using locally cached assertions", {actions: actions});
            return actions;
        }

        return [];
    }

    async extractAssertions(instruction: string): Promise<any[]> {
        const assertions = await this.client.extractAssertions(this.getTestName(), instruction, await this.browser.getHtml());

        if (assertions.length > 0) {
            this.logger.info("Successfully extracted assertions", {assertions: assertions});
            this.cacheInstruction(assertions, instruction);

            return assertions;
        }

        throw new FailedExtractionException('Could not extract assertions');
    }

    async action(instruction: string): Promise<void> {
        this.logger.info("Querying action", {test_name: this.getTestName(), instruction: instruction});
        let actions = this.cachedActions(instruction);

        const isActionReady = async (action: any) => (await this.browser.findByXpath(action['xpath'])).length > 0;
        await this.waitForLoad(async () => actions.length > 0 && (await Promise.all(actions.map(isActionReady))).every(_ => _));

        if (actions.length === 0) {
            this.logger.notice("No actions found, extracting from page");
            actions = await this.extractActions(instruction);
        }

        await this.performActions(actions);
    }

    async performActions(actions: any[]): Promise<any[]> {
        const previousActions = [];
        for (const action of actions) {
            this.logger.notice("Performing action", {action: action});
            const elements = await this.browser.findByXpath(action['xpath']);

            if (elements.length === 0) {
                throw new InvalidXpathException("Could not find element for xpath: " + action['xpath']);
            }

            if (elements.length > 1) {
                this.logger.warning(
                    "More than one element found for xpath",
                    {num: elements.length, xpath: action['xpath']}
                );
                return previousActions;
            }

            await this.browser.performAction(action, elements);
            previousActions.push(action);
        }

        return previousActions;
    }

    async assertion(instruction: string): Promise<boolean> {
        this.logger.info("Querying assertion", {test_name: this.getTestName(), instruction: instruction});

        let assertions = this.cachedAssertions(instruction);

        const isAssertionReady = async (assertion: any): Promise<boolean> => {
            try {
                await this.performAssertion(assertion);
                return true;
            } catch (e) {
                return false;
            }
        }

        await this.waitForLoad(async () => assertions.length > 0 && (await Promise.all(assertions.map(isAssertionReady))).every(_ => _));

        if (assertions.length === 0) {
            this.logger.notice("No assertions found, extracting from page");
            assertions = await this.extractAssertions(instruction);
        }

        return this.performAssertions(assertions);
    }

    async performAssertions(assertions: any[]): Promise<boolean> {
        for (const assertion of assertions) {
            const result = await this.performAssertion(assertion);

            if (!result) {
                return false;
            }
        }

        return true;
    }

    async performAssertion(assertion: any): Promise<boolean> {
        this.logger.notice("Performing assertion", {assertion: assertion['assertion']});

        return await this.browser.evaluateScript('window.carbonate_reset_assertion_result(); (function() { ' + assertion['assertion'] + ' })(); window.carbonate_assertion_result;');
    }

    cachedLookup(instruction: string): any {
        let cachePath = this.getCachePath(instruction);
        if (cachePath && fs.existsSync(cachePath)) {
            // Open the file as parse the json
            const lookup = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
            this.logger.debug("Using locally cached lookup", {lookup});
            return lookup;
        }

        return null;
    }

    async extractLookup(instruction: string): Promise<any> {
        const lookup = await this.client.extractLookup(this.getTestName(), instruction, await this.browser.getHtml());

        if (lookup !== null) {
            this.logger.info("Successfully extracted lookup", {lookup});
            this.cacheInstruction(lookup, instruction);

            return lookup;
        }

        throw new FailedExtractionException('Could not extract lookup');
    }

    async lookup(instruction: string): Promise<any> {
        this.logger.info("Querying lookup", {test_name: this.getTestName(), instruction});
        let lookup = this.cachedLookup(instruction);

        await this.waitForLoad(async () => lookup !== null && (await this.browser.findByXpath(lookup['xpath'])).length > 0);

        if (lookup === null) {
            this.logger.notice("No elements found, extracting from page");
            lookup = await this.extractLookup(instruction);
        }

        const elements = await this.browser.findByXpath(lookup['xpath']);

        if (elements.length === 0) {
            throw new InvalidXpathException("Could not find element for xpath: " + lookup['xpath']);
        }

        return elements[0];
    }

    startTest(testPrefix: string, testName: string): void {
        if (Object.keys(this.instructionCache).length > 0) {
            throw Error("Instruction cache not empty, did you forget to call endTest()?");
        }

        if (this.logger instanceof TestLogger) {
            this.logger.clearLogs();
        }

        this.testPrefix = testPrefix;
        this.testName = testName;
    }

    async endTest(): Promise<void> {
        if (this.cacheDir != null) {
            this.writeCache();
        }
    }

    async load(url: string): Promise<void> {
        this.logger.info("Loading page", {url, whitelist: this.networkWhitelist});
        await this.browser.load(url, this.networkWhitelist);
    }

    async close(): Promise<void> {
        this.logger.info("Closing browser");
        await this.browser.close();
    }

    whitelistNetwork(url: string) {
        this.networkWhitelist.push(url);
    }

    handleFailedTest(): string | null {
        this.instructionCache = {};

        if (this.logger instanceof TestLogger) {
            return this.logger.getLogs()
        }

        return null;
    }

    getLogger(): Logger {
        return this.logger;
    }

    getBrowser(): Browser {
        return this.browser;
    }
}