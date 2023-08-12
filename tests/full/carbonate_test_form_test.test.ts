import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import SDK from "../../src/SDK";
import Api from "../../src/api/api"
import Puppeteer from "../../src/browser/puppeteer"

let browser = new Puppeteer(page);
let sdk = new SDK(browser, null);

setSDK(sdk);

describe("CarbonateTestFormTest", () => {
    test("Select birthday from the event type dropdown", async () => {
        await sdk.load(
            'https://carbonate.dev/demo-form.html'
        );

        await sdk.action('select Birthday from the event type dropdown')

        expect(
            await sdk.assertion('the event type dropdown should be set to Birthday')
        ).toBe(true);
    });

    test("Select birthday from the event type dropdown advanced", async () => {
        await sdk.load(
            'https://carbonate.dev/demo-form.html'
        );

        const dropdown = await sdk.lookup('The dropdown')

        await dropdown.select('Birthday')

        expect(
            await (await dropdown.getProperty('value')).jsonValue()
        ).toBe('Birthday');
    });
});
