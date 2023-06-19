import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import {SDK} from "../../../src/SDK";
import Api from "../../../src/api/api"
import Puppeteer from "../../../src/browser/puppeteer"
jest.mock("../../../src/api/api");

describe("ClickTest", () => {
    let api = new Api();
    let browser = new Puppeteer(page);
    let sdk = new SDK(browser, null, null, null, null, api);

    setSDK(sdk);

    beforeEach(() => {
        jest.clearAllMocks();
    });
    
    test.each([
        ['button', '//input[@id="button"]'],
        ['submit', '//input[@id="submit"]'],
        ['reset', '//input[@id="reset"]'],
        ['link', '//a[@id="link"]'],
    ])("It should click the element", async (name, xpath) => {
        api.extractActions = jest.fn().mockResolvedValue([
            { action: "click", xpath },
        ]);
        api.extractAssertions = jest.fn().mockResolvedValue([
            { assertion: `carbonate_assert(window['${name}_clicked'] === true);` },
        ]);

        await sdk.load("file:///" + __dirname + "/../../fixtures/click.html");

        await sdk.action(`click the ${name}`)

        expect(
            await sdk.assertion(`the ${name} should have been clicked`)
        ).toBe(true);

        expect(api.extractActions).toBeCalledTimes(1);
        expect(api.extractAssertions).toBeCalledTimes(1);
    });
});
