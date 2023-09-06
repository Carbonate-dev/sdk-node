import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import { SDK, Api, Puppeteer } from "../../../src";
import 'node-fetch';

jest.mock('node-fetch', () => jest.fn());
jest.mock("../../../src/api/api");

describe("WaitFailedTest", () => {
    let api = new Api();
    let browser = new Puppeteer(page);
    let sdk = new SDK(browser, null, {
        client: api
    });

    setSDK(sdk);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("It should handle failed XHR when performing actions", async () => {
        api.extractActions = jest.fn().mockResolvedValue({
            actions: [
                {action: "type", xpath: '//label[@for="input"]', text: 'teststr'},
            ],
            version: 'test1',
        });

        await sdk.load("file:///" + __dirname + "/../../fixtures/wait_xhr_failed.html");

        await sdk.action('type "teststr" into the input');

        expect(
            await sdk.getBrowser().evaluateScript("document.querySelector('input').value == 'teststr'")
        ).toBe(true);

        expect(api.extractActions).toBeCalledTimes(1);
    });

    test("It should handle failed XHR when performing assertions", async () => {
        api.extractAssertions = jest.fn().mockResolvedValue({
            assertions: [
                {assertion: "carbonate_assert(document.querySelector('input').value == '');"},
            ],
            version: 'test1',
        });

        await sdk.load("file:///" + __dirname + "/../../fixtures/wait_xhr_failed.html");

        expect(
            await sdk.assertion('the input should be empty')
        ).toBe(true);

        expect(api.extractAssertions).toBeCalledTimes(1);
    });

    test("It should handle failed Fetch when performing actions", async () => {
        api.extractActions = jest.fn().mockResolvedValue({
            actions: [
                {action: "type", xpath: '//label[@for="input"]', text: 'teststr'},
            ],
            version: 'test1',
        });
        api.extractAssertions = jest.fn().mockResolvedValue({
            assertions: [
                {assertion: "carbonate_assert(document.querySelector('input').value == 'teststr');"},
            ],
            version: 'test1',
        });

        await sdk.load("file:///" + __dirname + "/../../fixtures/wait_fetch_failed.html");

        await sdk.action('type "teststr" into the input')

        expect(
            await sdk.getBrowser().evaluateScript("document.querySelector('input').value == 'teststr'")
        ).toBe(true);

        expect(api.extractActions).toBeCalledTimes(1);
    });

    test("It should handle failed Fetch when performing assertionns", async () => {
        api.extractAssertions = jest.fn().mockResolvedValue({
            assertions: [
                {assertion: "carbonate_assert(document.querySelector('input').value == '');"},
            ],
            version: 'test1',
        });

        await sdk.load("file:///" + __dirname + "/../../fixtures/wait_fetch_failed.html");

        expect(
            await sdk.assertion('the input should be empty')
        ).toBe(true);

        expect(api.extractAssertions).toBeCalledTimes(1);
    });
});
