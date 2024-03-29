// import {By, WebDriver as SeleniumWebDriver, WebElement} from 'selenium-webdriver';
import {Action} from '../action';
import {Browser} from './browser';
import {BrowserException} from '../exceptions/exceptions';
import {Browser as Client, ElementHandle, Page} from 'puppeteer';

export default class Puppeteer implements Browser {
    private browser: Page;
    private injectJs: string;

    constructor(driver: Page) {
        this.browser = driver;
        const injectJsPath = require.resolve(__dirname + '/../../resources/carbonate.js');
        this.injectJs = require('fs').readFileSync(injectJsPath, 'utf-8');
    }

    async getHtml(): Promise<string> {
        return await this.browser.evaluate(() => document.documentElement.innerHTML);
    }

    async load(url: string, whitelist: string[]): Promise<void> {
        if (await this.evaluateScript('typeof window.carbonate_dom_updating === "undefined"')) {
            await this.browser.evaluateOnNewDocument(this.injectJs);
        }

        await this.browser.goto(url);
        await this.evaluateScript('window.carbonate_set_xhr_whitelist(' + JSON.stringify(whitelist) + ')');
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

    async performAction(action: any, elements: ElementHandle<Element>[]): Promise<void> {
        if (action.action === Action.CLICK) {
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
        } else if (action.action === Action.TYPE) {
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
            this.evaluateScript('!!document.activeElement ? document.activeElement.blur() : 0');

        } else if (action.action === Action.KEY) {
            await elements[0].press(action.key);
        }
    }
}