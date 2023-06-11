import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import {SDK} from "../../../src/SDK";
import Api from "../../../src/api/api"
import Puppeteer from "../../../src/browser/puppeteer"
import mocked = jest.mocked;

jest.mock("../../../src/api/api");

let browser: Puppeteer;
let sdk: SDK;
let api: Api;

const MockedClient = mocked(Api, {shallow: true});

beforeEach(() => {
    MockedClient.mockClear();
    api = new Api();
    browser = new Puppeteer(page);
    sdk = new SDK(browser, null, null, null, null, api);

    setSDK(sdk);
});

describe("NotFoundTest", () => {
    test("It should error if xpath is not found for an action", async () => {
        api.extractActions = jest.fn().mockResolvedValue([
            { action: "click", xpath: "//select//option[text()='Birthday']" },
        ]);

        await sdk.load("file:///" + __dirname + "/../../fixtures/select.html");

        await expect(
            sdk.action("chose Birthday as the event type")
        ).rejects.toThrowError("Could not find element for xpath: //select//option[text()='Birthday']");
    });

    test("It should error if xpath is not found for a lookup", async () => {
        api.extractLookup = jest.fn().mockResolvedValue({
            xpath: "//select//option[text()='Birthday']",
        });

        await sdk.load("file:///" + __dirname + "/../../fixtures/select.html");

        await expect(
            sdk.lookup("the event type dropdown")
        ).rejects.toThrowError("Could not find element for xpath: //select//option[text()='Birthday']");
    });
});
