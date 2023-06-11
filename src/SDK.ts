import { Browser } from './browser/browser';
import Api from './api/api';
import { FailedExtractionException, InvalidXpathException, BrowserException } from './exceptions/exceptions';
import slugify from './slugify';
import { TestLogger } from './logger/test_logger';
import * as fs from "fs";
import {WriteStream} from "fs";
import Logger from "./logger/logger";
import {NullLogger} from "./logger/null_logger";

export class SDK {
    browser: Browser;
    client: Api;
    testName: string | null = null;
    cacheDir: string | null;
    logger: Logger;
    networkWhitelist: string[] = [];

    constructor(
        browser: Browser,
        cache_dir: string | null = null,
        api_user_id: string | null = null,
        api_key: string | null = null,
        logging: WriteStream | false | null | string | Logger = null,
        client: Api | null = null,
    ) {
        this.browser = browser;
        this.client = client || new Api(api_user_id, api_key);
        this.cacheDir = cache_dir || process.env.CARBONATE_CACHE_DIR || null;

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
            throw new Error("You must call start_test() or use the custom jest environment");
        }

        return this.testName;
    }

    async waitForLoad(skip_func: () => Promise<boolean>): Promise<void> {
        let i = 0;

        while (await this.browser.evaluateScript('window.__dom_updating') || await this.browser.evaluateScript('window.__active_xhr')) {
            if (await skip_func()) {
                this.logger.info("Found cached element, skipping DOM wait");
                break;
            }

            if (await this.browser.evaluateScript('window.__dom_updating')) {
                this.logger.info("Waiting for DOM update to finish");
            } else {
                this.logger.info("Waiting for active XHR to finish");
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

        console.log('actions 2')
        console.log(actions)

        if (actions.length > 0) {
            this.logger.info("Successfully extracted actions", {actions: actions});
            this.cacheInstruction(actions, instruction);

            return actions;
        }

        throw new FailedExtractionException('Could not extract actions');
    }

    cacheInstruction(result: any, instruction: string): void {
        if (this.cacheDir != null) {
            if (!this.testName) {
                throw new Error("Test name not set");
            }

            // Create the cache directory if it doesn't exist
            if (!fs.existsSync(this.cacheDir)) {
                fs.mkdirSync(this.cacheDir, {recursive: true});
            }

            // Create the test name directory if it doesn't exist
            if (!fs.existsSync(this.cacheDir + '/' + slugify(this.testName))) {
                fs.mkdirSync(this.cacheDir + '/' + slugify(this.testName), {recursive: true});
            }

            // Write the actions to a file
            fs.writeFileSync(this.getCachePath(instruction) as string, JSON.stringify(result));
        }
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

        const is_action_ready = async (action: any) => (await this.browser.findByXpath(action['xpath'])).length > 0;
        await this.waitForLoad(async () => actions.length > 0 && (await Promise.all(actions.map(is_action_ready))).every(_ => _));

        if (actions.length === 0) {
            this.logger.notice("No actions found, extracting from page");
            actions = await this.extractActions(instruction);
        }

        await this.performActions(actions);
    }

    async performActions(actions: any[]): Promise<any[]> {
        const previous_actions = [];
        for (const action of actions) {
            this.logger.info("Performing action", {action: action});
            const elements = await this.browser.findByXpath(action['xpath']);

            if (elements.length === 0) {
                throw new InvalidXpathException("Could not find element for xpath: " + action['xpath']);
            }

            if (elements.length > 1) {
                this.logger.warning(
                    "More than one element found for xpath",
                    {num: elements.length, xpath: action['xpath']}
                );
                return previous_actions;
            }

            await this.browser.performAction(action, elements);
            previous_actions.push(action);
        }

        return previous_actions;
    }

    async assertion(instruction: string): Promise<boolean> {
        this.logger.info("Querying assertion", {test_name: this.getTestName(), instruction: instruction});

        let assertions = this.cachedAssertions(instruction);

        const isAssertionReady = (assertion: any): boolean => {
            try {
                this.performAssertion(assertion);
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

    performAssertions(assertions: any[]): boolean {
        for (const assertion of assertions) {
            const result = this.performAssertion(assertion);

            if (!result) {
                return false;
            }
        }

        return true;
    }

    async performAssertion(assertion: any): Promise<boolean> {
        this.logger.info("Performing assertion", {assertion: assertion['assertion']});

        return await this.browser.evaluateScript('' + assertion['assertion']);
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
        const lookup = this.client.extractLookup(this.getTestName(), instruction, await this.browser.getHtml());

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

    startTest(test_name: string): void {
        if (this.logger instanceof TestLogger) {
            this.logger.clearLogs();
        }

        this.testName = test_name;
    }

    async endTest(): Promise<void> {
        await this.browser.close();
    }

    async load(url: string): Promise<void> {
        this.logger.info("Loading page", {url, whitelist: this.networkWhitelist});
        await this.browser.load(url, this.networkWhitelist);
    }

    async close(): Promise<void> {
        this.logger.info("Closing browser");
        await this.browser.close();
    }

    // async getScreenshot(): Promise<string> {
    //     this.logger.info("Taking screenshot");
    //     return await this.browser.getScreenshot();
    // }

    whitelistNetwork(url: string) {
        this.networkWhitelist.push(url);
    }

    handleTestFailure(): string | null {
        if (this.logger instanceof TestLogger) {
            return this.logger.getLogs()
        }

        return null;
    }
}