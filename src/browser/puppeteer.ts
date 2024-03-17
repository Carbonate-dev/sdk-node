// import {By, WebDriver as SeleniumWebDriver, WebElement} from 'selenium-webdriver';
import {ActionType} from '../actionType';
import Browser from './browser';
import {BrowserException, FailedExtractionException} from '../exceptions/exceptions';
import {ElementHandle, KeyInput, Page} from 'puppeteer';
import {Action} from "../SDK";
import {readFileSync} from "fs";

export default class Puppeteer implements Browser {
    private browser: Page;
    private injectJs: string;

    constructor(driver: Page) {
        this.browser = driver;
        const carbonateJs = readFileSync(require.resolve(__dirname + '/../../resources/carbonate.js'), 'utf-8');
        const rrwebJs = readFileSync(require.resolve(__dirname + '/../../resources/rrweb.js'), 'utf-8');
        this.injectJs = carbonateJs + rrwebJs;
    }

    async getHtml(): Promise<string> {
        return await this.evaluateScript('window.carbonate_getOuterHTML(document.body)');
    }

    async load(url: string, whitelist: string[], record: boolean): Promise<void> {
        if (await this.evaluateScript('typeof window.carbonate_dom_updating === "undefined"')) {
            await this.browser.evaluateOnNewDocument(this.injectJs);
        }

        await this.browser.goto(url);
        if (record) {
            await this.evaluateScript('window.carbonate_rrweb_start()')
        }
        await this.evaluateScript('window.carbonate_setXhrWhitelist(' + JSON.stringify(whitelist) + ')');
    }

    async close(): Promise<void> {
        await this.browser.close();
    }

    async findByXpath(xpath: string): Promise<ElementHandle<Node>[]> {
        return await this.browser.$x(xpath);
    }

    async findById(id: string): Promise<ElementHandle<Element>[]> {
        return this.browser.$$(`#${id}`);
    }

    async evaluateScript(script: string): Promise<any> {
        try {
            return (await this.browser.evaluate(script, [])) as any;
        } catch (e) {
            throw new BrowserException('Could not evaluate script: ' + script + ' - ' + e);
        }
    }

    async performAction(action: Action, elements: ElementHandle<Element>[]): Promise<void> {
        if (action.action === ActionType.CLICK) {
            let tagName = (await (
                await elements[0].getProperty('tagName')
            ).jsonValue()).toLowerCase();

            if (tagName === 'option') {
                const parentNode = await elements[0].getProperty('parentNode') as ElementHandle<ParentNode>

                await parentNode.select(
                    await (await elements[0].getProperty('value')).jsonValue() as string
                );
            }
            else {
                await elements[0].click();
            }
        } else if (action.action === ActionType.HOVER) {
            await elements[0].hover();
        } else if (action.action === ActionType.SCROLL) {
            await this.browser.evaluate((el) => el.scrollIntoView(), elements[0]);
        } else if (action.action === ActionType.VALUE) {
            if (!action.text) {
                throw new FailedExtractionException('No value provided for value action');
            }

            let tagName = (await (
                await elements[0].getProperty('tagName')
            ).jsonValue()).toLowerCase();

            if (tagName === 'select') {
                await elements[0].select(action.text);
            }

            await this.browser.evaluate((el, value) => {
                el.value = value;
                el.dispatchEvent(new Event('change'));
            }, elements[0], action.text);
        } else if (action.action === ActionType.TYPE) {
            if (!action.text) {
                throw new FailedExtractionException('No text provided for type action');
            }

            let tagName = (await (
                await elements[0].getProperty('tagName')
            ).jsonValue()).toLowerCase();

            const nonTypeable = ['date', 'datetime-local', 'month', 'time', 'week', 'color', 'range'];
            let type = (await (await elements[0].getProperty('type')).jsonValue() as string);

            if (tagName === 'input' && nonTypeable.includes(type.toLowerCase())) {
                await this.browser.evaluate((el, text) => {
                    (<HTMLInputElement>el).value = text;
                    el.dispatchEvent(new Event('change'));
                }, elements[0], action.text);

                return;
            }

            if (tagName === 'label') {
                let id = await this.browser.evaluate(el => el.getAttribute('for'), elements[0]);

                if (!id) {
                    throw new BrowserException('Could not find id for label');
                }

                elements = await this.findById(id);
            }

            await elements[0].type(action.text);
            await this.evaluateScript('!!document.activeElement ? document.activeElement.blur() : 0');

        } else if (action.action === ActionType.KEY) {
            if (!action.key) {
                throw new FailedExtractionException('No key provided for key action');
            }

            await elements[0].press(action.key as KeyInput);
        }
        else if (action.action === ActionType.JAVASCRIPT) {
            if (!action.text) {
                throw new FailedExtractionException('No JavaScript provided for JavaScript action');
            }

            await this.evaluateScript(action.text);
        }
    }

    async record(name: string,  data: any = {}): Promise<void> {
        await this.browser.evaluate(
            // @ts-ignore
            (name, data) => window.carbonate_rrweb.record.addCustomEvent(name, data),
            name, data
        );
    }
}