import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import SDK from "../../../src/SDK";
import Api from "../../../src/api/api"
import Puppeteer from "../../../src/browser/puppeteer"
import 'node-fetch';

jest.mock('node-fetch', () => jest.fn());
jest.mock("../../../src/api/api");

describe("NotFoundTest", () => {
    let api = new Api();
    let browser = new Puppeteer(page);
    let sdk = new SDK(browser, null, {
        client: api
    });

    setSDK(sdk);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("It should error if xpath is not found for an action", async () => {
        api.extractActions = jest.fn().mockResolvedValue({
            actions: [
                { action: "click", xpath: "//select//option[text()='Birthday']" },
            ],
            version: 'test1',
        });

        await sdk.load("file:///" + __dirname + "/../../fixtures/select.html");

        await expect(
            sdk.action("chose Birthday as the event type")
        ).rejects.toThrowError("Could not find element for xpath: //select//option[text()='Birthday']");

        expect(api.extractActions).toBeCalledTimes(1);
    });

    test("It should error if xpath is not found for a lookup", async () => {
        api.extractLookup = jest.fn().mockResolvedValue({
            xpath: "//select//option[text()='Birthday']",
            version: 'test1',
        });

        await sdk.load("file:///" + __dirname + "/../../fixtures/select.html");

        await expect(
            sdk.lookup("the event type dropdown")
        ).rejects.toThrowError("Could not find element for xpath: //select//option[text()='Birthday']");

        expect(api.extractLookup).toBeCalledTimes(1);
    });
});
