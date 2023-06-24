import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import {SDK} from "../../src/SDK";
import Api from "../../src/api/api"
import Puppeteer from "../../src/browser/puppeteer"
import puppeteer, {Browser as Client, ElementHandle, Page} from 'puppeteer';

let browser = new Puppeteer(page);
let sdk = new SDK(browser);

setSDK(sdk);

describe("CarbonateTestFormTest", () => {
    test("Birthday event type", async () => {
        await sdk.load(
            'https://carbonate.dev/demo-form'
        );

        await sdk.action('chose Birthday as the event type')

        expect(
            await sdk.assertion('the event type should be Birthday')
        ).toBe(true);

        let dropdown = await sdk.lookup('the event type dropdown');

        expect(
            await (await dropdown.getProperty('value')).jsonValue()
        ).toBe('Birthday');
    });
});
