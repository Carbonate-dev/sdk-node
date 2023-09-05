import {EnvironmentContext, JestEnvironment, JestEnvironmentConfig} from "@jest/environment";
import { default as SDK } from "../../src";
import type { Circus } from '@jest/types';
import { TestException} from "../exceptions/exceptions";

declare type Timer = {
    id: number;
    ref: () => Timer;
    unref: () => Timer;
};

declare global {
    const setSDK: (sdk: SDK) => void
}

export default function createEnvironment({ baseEnvironment } : { baseEnvironment?: typeof JestEnvironment<Timer> } = {}) {
    const BaseEnvironment = baseEnvironment || require("jest-environment-node").default;

    return class Environment extends BaseEnvironment {
        sdk?: SDK;

        constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
            super(config, context);

            this.global.setSDK = this.setSDK.bind(this);
        }

        setSDK(sdk: SDK) {
            this.sdk = sdk;
        }

        getNames(parent: Circus.TestEntry | Circus.DescribeBlock | undefined): string[] {
            if (!parent) {
                return [];
            }

            if (parent.name === 'ROOT_DESCRIBE_BLOCK') {
                return [];
            }

            const parentName = this.getNames(parent.parent);
            return [
                ...parentName,
                parent.name
            ]
        }

        async handleTestEvent(event: Circus.Event, state: Circus.State) {
            if (event.name == 'test_fn_start') {
                this.global.testNames = this.getNames(event.test)

                if (!this.sdk) {
                    console.error("No SDK set, please call setSDK(sdk) in your test file");
                } else {
                    this.sdk.startTest(this.global.testNames[0], this.global.testNames.slice(1).join(": "));
                }
            }

            if (this.sdk) {
                if (event.name == "test_done") {
                    await this.sdk.endTest();
                }

                if (["test_failure", "test_fn_failure"].includes(event.name) && this.sdk) {
                    let logs = await this.sdk.handleFailedTest(state.currentlyRunningTest?.errors);

                    if (logs && state.currentlyRunningTest) {
                        let injectedLogs = false;
                        for (let error of state.currentlyRunningTest.errors) {
                            if (Array.isArray(error)) {
                                error = error[0];
                            }

                            if (error.injectCarbonateLogs) {
                                error.stack = logs + "\n" + error.stack;
                                injectedLogs = true;
                                break;
                            }
                        }

                        if (!injectedLogs) {
                            state.currentlyRunningTest.errors.unshift(new TestException(logs))
                        }
                    }
                }
            }
        }
    }
}

