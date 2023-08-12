import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import SDK from "../../../src/SDK";
import Api from "../../../src/api/api"
import Puppeteer from "../../../src/browser/puppeteer"
import {TestLogger} from "../../../src/logger";
import 'node-fetch';

jest.mock('node-fetch', () => jest.fn());
jest.mock("../../../src/api/api");

describe("RenderTest", () => {
    let api = new Api();
    let browser = new Puppeteer(page);
    let sdk = new SDK(browser, null, null, null, null, api);

    setSDK(sdk);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("It should wait for renders to finish before performing actions", async () => {
        api.extractActions = jest.fn().mockResolvedValue({
            actions: [
                { action: "type", xpath: '//label[@for="input"]', text: 'teststr' }
            ],
            version: 'test1',
        });
        await sdk.load("file:///" + __dirname + "/../../fixtures/render.html");

        await sdk.action('type "teststr" into the input')

        expect(
            await sdk.getBrowser().evaluateScript("document.querySelector('input').value == 'teststr'")
        ).toBe(true);

        expect(
            await (sdk.getLogger() as TestLogger).getLogs()
        ).toContain('Waiting for DOM update to finish');

        expect(api.extractActions).toBeCalledTimes(1);
    });

    test("It should wait for renders to finish before performing assertions", async () => {
        api.extractAssertions = jest.fn().mockResolvedValue({
            assertions: [
                { assertion: "carbonate_assert(document.querySelector('label').innerText == 'Test');" },
            ],
            version: 'test1',
        });

        await sdk.load("file:///" + __dirname + "/../../fixtures/render.html");

        expect(
            await sdk.assertion('there should be a label with the text "test"')
        ).toBe(true);

        expect(
            await (sdk.getLogger() as TestLogger).getLogs()
        ).toContain('Waiting for DOM update to finish');

        expect(api.extractAssertions).toBeCalledTimes(1);
    });
});
