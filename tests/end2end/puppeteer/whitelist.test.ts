import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import SDK from "../../../src/SDK";
import Api from "../../../src/api/api"
import Puppeteer from "../../../src/browser/puppeteer"
jest.mock("../../../src/api/api");

describe("WhitelistTest", () => {
    let api = new Api();
    let browser = new Puppeteer(page);
    let sdk = new SDK(browser, null, null, null, null, api);

    setSDK(sdk);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("It should not wait for whitelisted XHR", async () => {
        api.extractActions = jest.fn().mockResolvedValue([
            { action: "type", xpath: '//label[@for="input"]', text: 'teststr' },
        ]);
        api.extractAssertions = jest.fn().mockResolvedValue([
            { assertion: "carbonate_assert(document.querySelector('input').value == 'teststr');" },
        ]);

        sdk.whitelistNetwork('https://api.carbonate.dev/internal/test_wait*');

        await sdk.load("file:///" + __dirname + "/../../fixtures/whitelist_xhr.html");

        await sdk.action('type "teststr" into the input')

        expect(
            await sdk.assertion('the input should have the contents "teststr"')
        ).toBe(true);

        expect(api.extractActions).toBeCalledTimes(1);
        expect(api.extractAssertions).toBeCalledTimes(1);
    });

    test("It should not wait for whitelisted Fetch", async () => {
        api.extractActions = jest.fn().mockResolvedValue([
            { action: "type", xpath: '//label[@for="input"]', text: 'teststr' },
        ]);
        api.extractAssertions = jest.fn().mockResolvedValue([
            { assertion: "carbonate_assert(document.querySelector('input').value == 'teststr');" },
        ]);

        sdk.whitelistNetwork('https://api.carbonate.dev/internal/test_wait*');

        await sdk.load("file:///" + __dirname + "/../../fixtures/whitelist_fetch.html");

        await sdk.action('type "teststr" into the input')

        expect(
            await sdk.assertion('the input should have the contents "teststr"')
        ).toBe(true);

        expect(api.extractActions).toBeCalledTimes(1);
        expect(api.extractAssertions).toBeCalledTimes(1);
    });
});
