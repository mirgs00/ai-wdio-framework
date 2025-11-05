"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const cucumber_framework_1 = require("@wdio/cucumber-framework");
const globals_1 = require("@wdio/globals");
(0, cucumber_framework_1.Given)(/^I navigate to "([^"]+)"$/, (url) => __awaiter(void 0, void 0, void 0, function* () {
    yield globals_1.browser.url(url);
}));
(0, cucumber_framework_1.When)(/^I enter "([^"]+)" into the (.+?) field$/, (value, fieldName) => __awaiter(void 0, void 0, void 0, function* () {
    const selector = `input[name="${fieldName}"], input[placeholder*="${fieldName}"]`;
    const input = yield (0, globals_1.$)(selector);
    yield input.setValue(value);
}));
(0, cucumber_framework_1.When)(/^I click the "([^"]+)" button$/, (text) => __awaiter(void 0, void 0, void 0, function* () {
    const button = yield (0, globals_1.$)(`button=${text}`);
    yield button.click();
}));
(0, cucumber_framework_1.Then)(/^I should see an error message containing "([^"]+)"$/, (message) => __awaiter(void 0, void 0, void 0, function* () {
    const body = yield (0, globals_1.$)('body');
    yield (0, globals_1.expect)(body).toHaveTextContaining(message);
}));
