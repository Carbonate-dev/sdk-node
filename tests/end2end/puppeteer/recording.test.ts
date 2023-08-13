import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import SDK from "../../../src/SDK";
import Api from "../../../src/api/api"
import Puppeteer from "../../../src/browser/puppeteer"
import 'node-fetch';

jest.mock('node-fetch', () => jest.fn());
jest.mock("../../../src/api/api");

describe("RecordingTest", () => {
    let api = new Api();
    let browser = new Puppeteer(page);
    let sdk = new SDK(browser, null, {
        client: api
    })

    setSDK(sdk);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("It uploads if record is true", async () => {
        sdk.recordTests = true;
        api.extractActions = jest.fn().mockResolvedValue({
            actions: [
                { action: "click", xpath: '//select/option[text()="Two"]' },
            ],
            version: 'test1',
        });
        await sdk.load("file:///" + __dirname + "/../../fixtures/select.html");

        await sdk.action('select Two from the dropdown')
        await sdk.endTest();

        expect(api.uploadRecording).toBeCalledTimes(1);
    });

    test("It does not upload if record is null", async () => {
        sdk.recordTests = null;
        api.extractActions = jest.fn().mockResolvedValue({
            actions: [
                { action: "click", xpath: '//select/option[text()="Two"]' },
            ],
            version: 'test1',
        });
        await sdk.load("file:///" + __dirname + "/../../fixtures/select.html");

        await sdk.action('select Two from the dropdown')
        await sdk.endTest();

        expect(api.uploadRecording).toBeCalledTimes(0);
    });

    test("It uploads if record is null but the test failed", async () => {
        sdk.recordTests = null;
        api.extractActions = jest.fn().mockResolvedValue({
            actions: [
                { action: "click", xpath: '//select/option[text()="Two"]' },
            ],
            version: 'test1',
        });
        await sdk.load("file:///" + __dirname + "/../../fixtures/select.html");

        await sdk.action('select Two from the dropdown')
        await sdk.handleFailedTest([Error('test failed')]);

        expect(api.uploadRecording).toBeCalledTimes(1);
    });

    test("It does not record if record is false", async () => {
        sdk.recordTests = false;
        api.extractActions = jest.fn().mockResolvedValue({
            actions: [
                { action: "click", xpath: '//select/option[text()="Two"]' },
            ],
            version: 'test1',
        });
        await sdk.load("file:///" + __dirname + "/../../fixtures/select.html");

        await sdk.action('select Two from the dropdown')

        expect(await sdk.getRecording()).toEqual([]);
    });

    test("It logs console messages", async () => {
        sdk.recordTests = true;
        api.extractActions = jest.fn().mockResolvedValue({
            actions: [
                { action: "click", xpath: '//select/option[text()="Two"]' },
            ],
            version: 'test1',
        });
        await sdk.load("file:///" + __dirname + "/../../fixtures/select.html");

        await sdk.action('select Two from the dropdown')

        expect(await sdk.getRecording())
            .toContainEqual(
                expect.objectContaining({
                    data: expect.objectContaining({
                        plugin: "rrweb/console@1",
                    })
                })
            );
    });

    test("It logs action messages", async () => {
        sdk.recordTests = true;
        api.extractActions = jest.fn().mockResolvedValue({
            actions: [
                { action: "click", xpath: '//select/option[text()="Two"]' },
            ],
            version: 'test1',
        });
        await sdk.load("file:///" + __dirname + "/../../fixtures/select.html");

        await sdk.action('select Two from the dropdown')

        expect(await sdk.getRecording())
            .toContainEqual(
                expect.objectContaining({
                    data: expect.objectContaining({
                        tag: "carbonate-action",
                    })
                })
            );
    });
});
