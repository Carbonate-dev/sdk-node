import { describe, expect, test, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals";
import SDK from "../../../src/SDK";
import Api from "../../../src/api/api"
import Puppeteer from "../../../src/browser/puppeteer"
import 'node-fetch';

jest.mock('node-fetch', () => jest.fn());
jest.mock("../../../src/api/api");

describe("InputTest", () => {
    let api = new Api();
    let browser = new Puppeteer(page);
    let sdk = new SDK(browser, null, null, null, null, api);

    setSDK(sdk);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const inputDataProvider = [
        ['color', '//input[@id="color"]', '#ff0000'],
        ['email', '//input[@id="email"]', 'test@example.org'],
        ['number', '//input[@id="number"]', '12'],
        ['password', '//input[@id="password"]', 'teststr'],
        ['range', '//input[@id="range"]', '50'],
        ['search', '//input[@id="search"]', 'teststr'],
        ['tel', '//input[@id="tel"]', '01234567890'],
        ['text', '//input[@id="text"]', 'teststr'],
        ['url', '//input[@id="url"]', 'http://example.org'],
        ['textarea', '//textarea[@id="textarea"]', "This\nis\na\ntest"],
    ];

    const dateDataProvider = [
        ['date', '//input[@id="date"]', '2022-01-01'],
        ['datetime-local', '//input[@id="datetime-local"]', '2022-01-01T00:00'],
        ['month', '//input[@id="month"]', '2022-01'],
        ['time', '//input[@id="time"]', '00:00:00'],
        ['week', '//input[@id="week"]', '2022-W01'],
    ];

    const checkDataProvider = [
        ['radio', '//input[@id="radio"]', '1'],
        ['checkbox', '//input[@id="checkbox"]', '1'],
    ];

    test.each([...inputDataProvider, ...dateDataProvider])
    ("It should fill in an input", async (name, xpath, value) => {
        api.extractActions = jest.fn().mockResolvedValue({
            actions: [
                { action: "type", xpath, text: value },
            ],
            version: 'test1',
        });
        api.extractAssertions = jest.fn().mockResolvedValue({
            assertions: [
                { assertion: `carbonate_assert(document.querySelector('#${name}').value == ${JSON.stringify(value)});` },
            ],
            version: 'test1',
        });

        await sdk.load("file:///" + __dirname + "/../../fixtures/input.html");

        await sdk.action(`type "teststr" into the ${name} input`)

        expect(
            await sdk.assertion(`the ${name} input should have the contents ${JSON.stringify(value)}`)
        ).toBe(true);

        expect(
            await sdk.getBrowser().evaluateScript(`window.hasChanged["${name}"]`)
        ).toBe(true);

        expect(api.extractActions).toBeCalledTimes(1);
        expect(api.extractAssertions).toBeCalledTimes(1);
    });


    test.each(checkDataProvider)
    ("It should click the element", async (name, xpath, value) => {
        api.extractActions = jest.fn().mockResolvedValue({
            actions: [
                { action: "click", xpath },
            ],
            version: 'test1',
        });
        api.extractAssertions = jest.fn().mockResolvedValue({
            assertions: [
                { assertion: `carbonate_assert(document.querySelector('#${name}').value == ${JSON.stringify(value)});` },
            ],
            version: 'test1',
        });

        await sdk.load("file:///" + __dirname + "/../../fixtures/input.html");

        await sdk.action(`click the ${name} element`)

        expect(
            await sdk.assertion(`the ${name} element should have the value "${value}"`)
        ).toBe(true);

        expect(
            await sdk.getBrowser().evaluateScript(`window.hasChanged["${name}"]`)
        ).toBe(true);

        expect(api.extractActions).toBeCalledTimes(1);
        expect(api.extractAssertions).toBeCalledTimes(1);
    });

    test("It should fill in an input when given a label", async () => {
        api.extractActions = jest.fn().mockResolvedValue({
            actions: [
                { action: "type", xpath: '//label[@for="input"]', text: 'teststr' },
            ],
            version: 'test1',
        });
        api.extractAssertions = jest.fn().mockResolvedValue({
            assertions: [
                { assertion: "carbonate_assert(document.querySelector('input').value == 'teststr');" },
            ],
            version: 'test1',
        });

        await sdk.load("file:///" + __dirname + "/../../fixtures/label.html");

        await sdk.action('type "teststr" into the input')

        expect(
            await sdk.assertion('the input should have the contents "teststr"')
        ).toBe(true);

        expect(api.extractActions).toBeCalledTimes(1);
        expect(api.extractAssertions).toBeCalledTimes(1);
    });
});
