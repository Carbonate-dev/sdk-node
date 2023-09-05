import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import { default as SDK, Api, Puppeteer, TestLogger } from "../../../src";
import * as path from "path";
import 'node-fetch';

jest.mock('node-fetch', () => jest.fn());
jest.mock("../../../src/api/api");

describe("WaitCachedTest", () => {
    let api = new Api();
    let browser = new Puppeteer(page);
    let sdk = new SDK(browser, __dirname + '/' + path.parse(__filename).name, {
        client: api
    });

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
