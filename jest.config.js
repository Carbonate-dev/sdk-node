/** @type {import('ts-jest').JestConfigWithTsJest} */
const tsPreset = require('ts-jest/jest-preset')
const puppeteerPreset = require('jest-puppeteer/jest-preset')

module.exports = {
  ...tsPreset,
  ...puppeteerPreset,
  // preset: 'jest-puppeteer',
  // preset: 'ts-jest',
  testEnvironment: "<rootDir>/src/jest/puppeteer.ts",
  testTimeout: 20000,
};