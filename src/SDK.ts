import {Browser} from './browser/browser';
import Api from './api/api';
import {BrowserException, FailedExtractionException, InvalidXpathException} from './exceptions/exceptions';
import slugify from './slugify';
import {TestLogger} from './logger/test_logger';
import * as fs from "fs";
import Logger from "./logger/logger";
import {NullLogger} from "./logger/null_logger";
import {Circus} from "@jest/types";
import isWritableStream from "./isWriteStream";
import {ActionType} from "./actionType";
import WritableStream = NodeJS.WritableStream;

export interface Action {
    action: ActionType;
    xpath: string;
    text?: string;
    key?: string;
}

export interface Actions {
    actions: Action[];
    version: string;
}

export interface Assertion {
    assertion: string;
}

export interface Assertions {
    assertions: Assertion[];
    version: string;
}

export interface Lookup {
    xpath: string;
    version: string;
}

type SDKOptions = {
    apiUserId?: string | null,
    apiKey?: string | null,
    logging?: WritableStream | false | null | string | Logger,
    client?: Api | null,
    record?: boolean | null,
}

export default class SDK {
    browser: Browser;
    client: Api;
    testPrefix: string | null = null;
    testName: string | null = null;
    cacheDir: string | null;
    logger: Logger;
    networkWhitelist: string[] = [];
    instructionCache: { [key: string]: Actions|Assertions|Lookup } = {};
    startedAt: Date | null = null;
    actionIds: string[] = [];
    assertionIds: string[] = [];
    lookupIds: string[] = [];
    recordTests: boolean | null = null;

    constructor(
        browser: Browser,
        cacheDir: string | null = null,
        options: SDKOptions = {},
    ) {
        this.browser = browser;
        this.client = options.client || new Api(options.apiUserId, options.apiKey);
        this.cacheDir = cacheDir || process.env.CARBONATE_CACHE_DIR || null;
        this.recordTests = options.record || process.env.CARBONATE_RECORD === 'true' || null;

        if (options.logging === false) {
            this.logger = new NullLogger();
        }
        else if (options.logging == null || typeof options.logging === 'string' || isWritableStream(options.logging)) {
            this.logger = new TestLogger(options.logging);
        }
        else {
            this.logger = options.logging;
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

        let loggedDomUpdating = false;
        let loggedNetworkUpdating = false;
        let domUpdating = false;

        while ((domUpdating = await this.browser.evaluateScript('window.carbonate_dom_updating')) || await this.browser.evaluateScript('window.carbonate_active_xhr')) {
            if (await skipFunc()) {
                this.logger.info("Found cached element, skipping DOM wait");
                break;
            }

            if (domUpdating) {
                if (!loggedDomUpdating) {
                    this.logger.info("Waiting for DOM update to finish");
                    loggedDomUpdating = true;
                }
            }
            else if (!loggedNetworkUpdating) {
                this.logger.info("Waiting for active Network to finish");
                loggedNetworkUpdating = true;
            }

            if (i > 240) {
                throw new BrowserException("Waited too long for DOM/XHR update to finish");
            }

            await new Promise(resolve => setTimeout(resolve, 250));
            i += 1;
        }
    }

    getCachePath(instruction: string): string | null {
        if (!this.cacheDir || !this.testName) {
            return null;
        }

        return this.cacheDir + '/' + slugify(this.testName) + '/' + slugify(instruction) + '.json';
    }

    cachedActions(instruction: string): Actions | null {
        let cachePath = this.getCachePath(instruction);

        if (cachePath && fs.existsSync(cachePath)) {
            // Open the file as parse the json
            const actions = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            this.logger.debug("Using locally cached actions", {actions: actions});
            return actions;
        }

        return null;
    }

    async extractActions(instruction: string): Promise<Actions> {
        const actions = await this.client.extractActions(this.getTestName(), instruction, await this.browser.getHtml());

        if (actions.actions.length > 0) {
            this.logger.info("Successfully extracted actions", {actions: actions.actions});
            this.cacheInstruction(actions, instruction);

            return actions;
        }

        throw new FailedExtractionException('Could not extract actions');
    }

    cacheInstruction(result: Actions|Assertions|Lookup, instruction: string): void {
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

    async record(name: string, data: any): Promise<void> {
        if (this.recordTests === false) {
            return;
        }

        return await this.browser.record(name, data);
    }

    cachedAssertions(instruction: string): Assertions | null {
        let cachePath = this.getCachePath(instruction);

        if (cachePath && fs.existsSync(cachePath)) {
            // Open the file as parse the json
            const assertions = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            this.logger.debug("Using locally cached assertions", {assertions: assertions});
            return assertions;
        }

        return null;
    }

    async extractAssertions(instruction: string): Promise<Assertions> {
        const assertions = await this.client.extractAssertions(this.getTestName(), instruction, await this.browser.getHtml());

        if (assertions.assertions.length > 0) {
            this.logger.info("Successfully extracted assertions", {assertions: assertions.assertions});
            this.cacheInstruction(assertions, instruction);

            return assertions;
        }

        throw new FailedExtractionException('Could not extract assertions');
    }

    async action(instruction: string): Promise<void> {
        this.logger.info("Querying action", {test_name: this.getTestName(), instruction: instruction});
        await this.browser.record('carbonate-instruction', {'instruction': instruction, 'type': 'action'});

        let actions = this.cachedActions(instruction);

        const isActionReady = async (action: Action) => (await this.browser.findByXpath(action.xpath)).length > 0;
        await this.waitForLoad(async () => actions != null && (await Promise.all(actions['actions'].map(isActionReady))).every(_ => _));

        if (actions == null) {
            this.logger.notice("No actions found, extracting from page");
            actions = await this.extractActions(instruction);
        }

        this.actionIds.push(actions.version);

        if ((await this.browser.findByXpath(actions.actions[0].xpath)).length === 0) {
            throw new InvalidXpathException("Could not find element for xpath: " + actions.actions[0].xpath);
        }

        await this.performActions(actions.actions);
    }

    async performActions(actions: Action[]): Promise<Action[]> {
        const previousActions = [];
        for (const action of actions) {
            this.logger.notice("Performing action", {action: action});
            const elements = await this.browser.findByXpath(action.xpath);

            if (elements.length === 0) {
                throw new InvalidXpathException("Could not find element for xpath: " + action.xpath);
            }

            if (elements.length > 1) {
                this.logger.warning(
                    "More than one element found for xpath",
                    {num: elements.length, xpath: action.xpath}
                );
                return previousActions;
            }

            await this.browser.record('carbonate-action', action);
            await this.browser.performAction(action, elements);
            previousActions.push(action);
        }

        return previousActions;
    }

    async assertion(instruction: string): Promise<boolean> {
        this.logger.info("Querying assertion", {test_name: this.getTestName(), instruction: instruction});
        await this.browser.record('carbonate-instruction', {'instruction': instruction, 'type': 'assertion'});

        let assertions = this.cachedAssertions(instruction);

        const isAssertionReady = async (assertion: Assertion): Promise<boolean> => {
            try {
                await this.performAssertion(assertion);
                return true;
            } catch (e) {
                return false;
            }
        }

        await this.waitForLoad(async () => assertions != null && (await Promise.all(assertions.assertions.map(isAssertionReady))).every(_ => _));

        if (assertions == null) {
            this.logger.notice("No assertions found, extracting from page");
            assertions = await this.extractAssertions(instruction);
        }

        this.assertionIds.push(assertions.version);
        return this.performAssertions(assertions.assertions);
    }

    async performAssertions(assertions: Assertion[]): Promise<boolean> {
        for (const assertion of assertions) {
            const result = await this.performAssertion(assertion);

            if (!result) {
                return false;
            }
        }

        return true;
    }

    async performAssertion(assertion: Assertion): Promise<boolean> {
        this.logger.notice("Performing assertion", {assertion: assertion['assertion']});
        await this.browser.record('carbonate-assertion', assertion);

        return await this.browser.evaluateScript('window.carbonate_reset_assertion_result(); (function() { ' + assertion['assertion'] + ' })(); window.carbonate_assertion_result;');
    }

    cachedLookup(instruction: string): Lookup | null {
        let cachePath = this.getCachePath(instruction);
        if (cachePath && fs.existsSync(cachePath)) {
            // Open the file as parse the json
            const lookup = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
            this.logger.debug("Using locally cached lookup", {lookup});
            return lookup;
        }

        return null;
    }

    async extractLookup(instruction: string): Promise<Lookup> {
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

        await this.waitForLoad(async () => lookup !== null && (await this.browser.findByXpath(lookup.xpath)).length > 0);

        if (lookup === null) {
            this.logger.notice("No elements found, extracting from page");
            lookup = await this.extractLookup(instruction);
        }

        this.lookupIds.push(lookup.version);
        const elements = await this.browser.findByXpath(lookup.xpath);

        if (elements.length === 0) {
            throw new InvalidXpathException("Could not find element for xpath: " + lookup.xpath);
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
        this.startedAt = new Date();
        this.actionIds = [];
        this.assertionIds = [];
        this.lookupIds = [];
    }

    async endTest(): Promise<void> {
        if (this.cacheDir != null) {
            this.writeCache();
        }

        if (this.recordTests === true) {
            await this.uploadRecording();
        }
    }

    async getRecording() {
        return await this.browser.evaluateScript('window.carbonate_rrweb_recording');
    }

    async uploadRecording(): Promise<void>
    {
        if (this.recordTests === false) {
            return;
        }

        const recording = await this.getRecording();

        this.client.uploadRecording(this.getTestName(), recording, this.startedAt ?? new Date(), this.actionIds, this.assertionIds, this.lookupIds);
    }

    async load(url: string): Promise<void> {
        this.logger.info("Loading page", {url, whitelist: this.networkWhitelist, record: this.recordTests});

        await this.browser.load(url, this.networkWhitelist, this.recordTests !== false);
        await this.browser.record('carbonate-load', {'url': url});
    }

    async close(): Promise<void> {
        this.logger.info("Closing browser");
        await this.browser.close();
    }

    whitelistNetwork(url: string) {
        this.networkWhitelist.push(url);
    }

    async handleFailedTest(errors: Circus.TestError[] | undefined): Promise<string | null> {
        this.instructionCache = {};

        if (errors !== undefined) {
            await Promise.all(
                errors.map(error => this.browser.record('carbonate-error', {
                    'message': error.message,
                    'trace': error.stack,
                }))
            );
        }

        await this.uploadRecording();

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