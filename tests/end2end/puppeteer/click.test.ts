import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import SDK from "../../../src/SDK";
import Api from "../../../src/api/api"
import Puppeteer from "../../../src/browser/puppeteer"
import 'node-fetch';

jest.mock('node-fetch', () => jest.fn());
jest.mock("../../../src/api/api");

describe("ClickTest", () => {
    let api = new Api();
    let browser = new Puppeteer(page);
    let sdk = new SDK(browser, null, {
        client: api
    });

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
        api.extractActions = jest.fn().mockResolvedValue({
            actions: [
               { action: "click", xpath },
            ],
            version: 'test1',
        });
        api.extractAssertions = jest.fn().mockResolvedValue({
            assertions: [
                { assertion: `carbonate_assert(window['${name}_clicked'] === true);` },
            ],
            version: 'test1',
        });

        await sdk.load("file:///" + __dirname + "/../../fixtures/click.html");

        await sdk.action(`click the ${name}`)

        expect(
            await sdk.assertion(`the ${name} should have been clicked`)
        ).toBe(true);

        expect(api.extractActions).toBeCalledTimes(1);
        expect(api.extractAssertions).toBeCalledTimes(1);
    });
});
