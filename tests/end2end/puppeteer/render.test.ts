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

describe("RenderTest", () => {
    test("It should wait for renders to finish for actions", async () => {
        api.extractActions = jest.fn().mockResolvedValue([
            { action: "type", xpath: '//label[@for="input"]', text: 'teststr' },
        ]);
        api.extractAssertions = jest.fn().mockResolvedValue([
            { assertion: "document.querySelector('input').value == 'teststr'" },
        ]);

        await sdk.load("file:///" + __dirname + "/../../fixtures/render.html");

        await sdk.action('type "teststr" into the input')

        expect(
            await sdk.assertion('the input should have the contents "teststr"')
        ).toBe(true);
    });

    test("It should wait for renders to finish for assertions", async () => {
        api.extractAssertions = jest.fn().mockResolvedValue([
            { assertion: "document.querySelector('label').innerText == 'Test'" },
        ]);

        await sdk.load("file:///" + __dirname + "/../../fixtures/render.html");

        expect(
            await sdk.assertion('there should be a label with the text "test"')
        ).toBe(true);
    });
});
