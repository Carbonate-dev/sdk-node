import { describe, expect, test } from "@jest/globals";
import {SDK, Puppeteer} from "../../src";

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

        const dropdown = await sdk.lookup('The event type dropdown')

        await dropdown[0].select('Birthday')

        expect(
            await (await dropdown.getProperty('value')).jsonValue()
        ).toBe('Birthday');
    });
});
