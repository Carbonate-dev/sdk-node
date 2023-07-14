import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import SDK from "../../../src/SDK";
import Api from "../../../src/api/api"
import Puppeteer from "../../../src/browser/puppeteer"
jest.mock("../../../src/api/api");

describe("SelectTest", () => {
    let api = new Api();
    let browser = new Puppeteer(page);
    let sdk = new SDK(browser, null, null, null, null, api)

    setSDK(sdk);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("It should select the option", async () => {
        api.extractActions = jest.fn().mockResolvedValue([
            { action: "click", xpath: '//select/option[text()="Two"]' },
        ]);
        api.extractAssertions = jest.fn().mockResolvedValue([
            { assertion: "carbonate_assert(document.querySelector('select').value == '2');" },
        ]);

        await sdk.load("file:///" + __dirname + "/../../fixtures/select.html");

        await sdk.action('select Two from the dropdown')

        expect(
            await sdk.assertion('the dropdown should be set to Two')
        ).toBe(true);

        expect(api.extractActions).toBeCalledTimes(1);
        expect(api.extractAssertions).toBeCalledTimes(1);
    });

    test("It should fail when the assertion is wrong", async () => {
        api.extractActions = jest.fn().mockResolvedValue([
            { action: "click", xpath: '//select/option[text()="Two"]' },
        ]);
        api.extractAssertions = jest.fn().mockResolvedValue([
            { assertion: "carbonate_assert(document.querySelector('select').value == '3');" },
        ]);

        await sdk.load("file:///" + __dirname + "/../../fixtures/select.html");

        await sdk.action('select Two from the dropdown')

        expect(
            await sdk.assertion('the dropdown should be set to Three')
        ).toBe(false);

        expect(api.extractActions).toBeCalledTimes(1);
        expect(api.extractAssertions).toBeCalledTimes(1);
    });

    test("It should select the option through the select", async () => {
        api.extractActions = jest.fn().mockResolvedValue([
            { action: "click", xpath: '//select' },
            { action: "click", xpath: '//select/option[text()="Two"]' },
        ]);
        api.extractAssertions = jest.fn().mockResolvedValue([
            { assertion: "carbonate_assert(document.querySelector('select').value == '2');" },
        ]);

        await sdk.load("file:///" + __dirname + "/../../fixtures/select.html");

        await sdk.action('select Two from the dropdown')

        expect(
            await sdk.assertion('the dropdown should be set to Two')
        ).toBe(true);

        expect(api.extractActions).toBeCalledTimes(1);
        expect(api.extractAssertions).toBeCalledTimes(1);
    });
});
