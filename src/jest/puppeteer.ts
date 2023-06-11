import createEnvironment from "./createEnvironment";
import { TestEnvironment } from "jest-environment-puppeteer";

module.exports = createEnvironment({
    baseEnvironment: TestEnvironment,
});