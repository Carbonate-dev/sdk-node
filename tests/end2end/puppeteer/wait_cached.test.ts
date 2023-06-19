import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import {SDK} from "../../../src/SDK";
import Api from "../../../src/api/api"
import Puppeteer from "../../../src/browser/puppeteer"
import mocked = jest.mocked;
import * as path from "path";
import {TestLogger} from "../../../src/logger/test_logger";

describe("WaitTest", () => {
    let api = new Api();
    let browser = new Puppeteer(page);
    let sdk = new SDK(browser, __dirname + '/' + path.parse(__filename).name, null, null, null, api);

    setSDK(sdk);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("It should wait for XHR before performing actions", async () => {
        api.extractActions = jest.fn();

        await sdk.load("file:///" + __dirname + "/../../fixtures/wait_xhr.html");

        await sdk.action('type "teststr" into the input');

        expect(
            await sdk.getBrowser().evaluateScript("document.querySelector('input').value == 'teststr'")
        ).toBe(true);

        expect(
            await (sdk.getLogger() as TestLogger).getLogs()
        ).toContain('Waiting for active Network to finish');

        expect(api.extractActions).toBeCalledTimes(0);
    });

    test("It should wait for XHR before performing assertions", async () => {
        api.extractAssertions = jest.fn();

        await sdk.load("file:///" + __dirname + "/../../fixtures/wait_xhr.html");

        expect(
            await sdk.assertion('the input should be empty')
        ).toBe(true);

        expect(
            await (sdk.getLogger() as TestLogger).getLogs()
        ).toContain('Waiting for active Network to finish');

        expect(api.extractAssertions).toBeCalledTimes(0);
    });

    test("It should wait for Fetch before performing actions", async () => {
        api.extractActions = jest.fn();

        await sdk.load("file:///" + __dirname + "/../../fixtures/wait_fetch.html");

        await sdk.action('type "teststr" into the input')

        expect(
            await sdk.getBrowser().evaluateScript("document.querySelector('input').value == 'teststr'")
        ).toBe(true);

        expect(
            await (sdk.getLogger() as TestLogger).getLogs()
        ).toContain('Waiting for active Network to finish');

        expect(api.extractActions).toBeCalledTimes(0);
    });

    test("It should wait for Fetch before performing assertions", async () => {
        api.extractAssertions = jest.fn();

        await sdk.load("file:///" + __dirname + "/../../fixtures/wait_fetch.html");

        expect(
            await sdk.assertion('the input should be empty')
        ).toBe(true);

        expect(
            await (sdk.getLogger() as TestLogger).getLogs()
        ).toContain('Waiting for active Network to finish');

        expect(api.extractAssertions).toBeCalledTimes(0);
    });
});
