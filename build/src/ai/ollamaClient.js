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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSteps = generateSteps;
const axios_1 = __importDefault(require("axios"));
function generateSteps(instruction, dom) {
    return __awaiter(this, void 0, void 0, function* () {
        const prompt = `
Given this DOM snapshot:
${dom}

And the instruction:
"${instruction}"

Generate a Cucumber scenario in Gherkin syntax.
  `;
        const res = yield axios_1.default.post('http://localhost:11434/api/generate', {
            model: 'llama3',
            prompt,
            stream: false
        });
        return res.data.response.trim();
    });
}
