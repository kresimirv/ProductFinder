// Jest is the required test runner (REQUIREMENTS §3). The Angular CLI's default (Vitest)
// was removed. jest-preset-angular compiles components and templates for Jest.
const { createCjsPreset } = require('jest-preset-angular/presets');

/** @type {import('jest').Config} */
module.exports = {
  ...createCjsPreset(),
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
