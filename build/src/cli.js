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
const scenarioBuilder_1 = require("./test-gen/scenarioBuilder");
const child_process_1 = require("child_process");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const [url, ...instructionParts] = process.argv.slice(2);
        if (!url || instructionParts.length === 0) {
            console.error('❌ Usage: ts-node src/cli.ts <url> "<test instruction>"');
            process.exit(1);
        }
        const instruction = instructionParts.join(' ');
        const generatedFeaturePath = yield (0, scenarioBuilder_1.buildScenario)(url, instruction);
        console.log('🚀 Running test using WebdriverIO...');
        try {
            (0, child_process_1.execSync)(`npx wdio run ./wdio.conf.ts --spec ${generatedFeaturePath}`, {
                stdio: 'inherit'
            });
        }
        catch (err) {
            console.error('❌ WebdriverIO execution failed.');
            process.exit(1);
        }
    });
}
main();
