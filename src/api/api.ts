import {ApiException} from "../exceptions/exceptions";
import {Action, Actions, Assertion, Assertions, Lookup} from "../SDK";

export default class Api {
    private apiUrl: string;
    private apiUserId: string;
    private apiKey: string;

    constructor(
        apiUserId: string | null = null,
        apiKey: string | null = null,
        apiUrl: string | null = null
    ) {
        this.apiUserId = apiUserId || process.env.CARBONATE_USER_ID as string;
        this.apiKey = apiKey || process.env.CARBONATE_API_KEY as string;
        this.apiUrl = apiUrl || 'https://api.carbonate.dev/' as string

        if (!this.apiUserId) {
            throw new Error(
                'No username provided, please either pass in apiUserId to the constructor or set the CARBONATE_USER_ID environment variable'
            );
        }

        if (!this.apiKey) {
            throw new Error(
                'No API key provided, please either pass in apiKey to the constructor or set the CARBONATE_API_KEY environment variable'
            );
        }
    }

    async callApi(url: string, data: Record<string, any>): Promise<any> {
        if (!data.test_name) {
            throw new Error(
                'No test name provided, please call start_test() with your test name'
            );
        }
        const response = await fetch(this.apiUrl + url, {
            method: 'POST',
            headers: {
                'X-Api-User-Id': this.apiUserId,
                'X-Api-Key': this.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })

        if (response.ok) {
            return response.json();
        }
        else {
            const statusCode = response.status;

            throw new ApiException(
                `Call to ${url} failed with status code ${statusCode}, body: ${response.statusText}`
            );
        }
    }

    async extractActions(
        testName: string,
        instruction: string,
        html: string
    ): Promise<Action[]> {
        const actions = await this.callApi('actions/extract', {
            test_name: testName,
            story: instruction,
            html: html,
        }) as Actions;

        if (actions === null) {
            return [];
        }

        return actions['actions'];
    }

    async extractAssertions(
        testName: string,
        instruction: string,
        html: string
    ): Promise<Assertion[]> {
        const assertion = await this.callApi('assertions/extract', {
            test_name: testName,
            story: instruction,
            html: html,
        }) as Assertions;

        if (assertion === null) {
            return [];
        }

        return assertion['assertions'];
    }

    async extractLookup(
        testName: string,
        instruction: string,
        html: string
    ): Promise<Lookup | null> {
        const lookup = await this.callApi('lookup/extract', {
            test_name: testName,
            story: instruction,
            html: html,
        }) as Lookup;

        return lookup;
    }
}