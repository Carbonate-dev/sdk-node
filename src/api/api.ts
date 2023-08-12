import {ApiException} from "../exceptions/exceptions";
import {Actions, Assertions, Lookup} from "../SDK";
import fetch from "node-fetch";
import zlib from "zlib";

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
    ): Promise<Actions> {
        return await this.callApi('actions/extract', {
            test_name: testName,
            story: instruction,
            html: html,
        }) as Actions;
    }

    async extractAssertions(
        testName: string,
        instruction: string,
        html: string
    ): Promise<Assertions> {
        return await this.callApi('assertions/extract', {
            test_name: testName,
            story: instruction,
            html: html,
        }) as Assertions;
    }

    async extractLookup(
        testName: string,
        instruction: string,
        html: string
    ): Promise<Lookup> {
        return await this.callApi('lookup/extract', {
            test_name: testName,
            story: instruction,
            html: html,
        }) as Lookup;
    }

    async uploadRecording(testName: string, recording: any[], startedAt: Date, actionIds: string[], assertionIds: string[], lookupIds: string[]): Promise<boolean> {
        const recordingBuffer = Buffer.from(JSON.stringify(recording));
        const recordingBufferGzipped = zlib.gzipSync(recordingBuffer);

        return await this.callApi('test/recording', {
            'test_name': testName,
            'actions': actionIds,
            'assertions': assertionIds,
            'lookups': lookupIds,
            'started_at': startedAt.toISOString(),
            'packed': recordingBufferGzipped.toString('base64'),
        }) as boolean;
    }
}