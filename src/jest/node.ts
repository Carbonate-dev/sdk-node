import createEnvironment from "./createEnvironment";
import { TestEnvironment } from "jest-environment-node";

module.exports = createEnvironment({
    baseEnvironment: TestEnvironment,
});