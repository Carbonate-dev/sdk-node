import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import {SDK} from "../../../src/SDK";
import Api from "../../../src/api/api"
import Puppeteer from "../../../src/browser/puppeteer"
import puppeteer, {Browser as Client, ElementHandle, Page} from 'puppeteer';
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

describe("SelectTest", () => {
    test("It should select the option", async () => {
        api.extractActions = jest.fn().mockResolvedValue([
            { action: "click", xpath: '//select/option[text()="Two"]' },
        ]);
        api.extractAssertions = jest.fn().mockResolvedValue([
            { assertion: "document.querySelector('select').value == '2'" },
        ]);

        await sdk.load("file:///" + __dirname + "/../../fixtures/select.html");

        await sdk.action('select Two from the dropdown')

        expect(
            await sdk.assertion('the dropdown should be set to Two')
        ).toBe(true);
    });
});
