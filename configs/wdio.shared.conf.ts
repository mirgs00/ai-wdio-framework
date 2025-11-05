export const config: WebdriverIO.Config = {
    runner: 'local',
    specs: ['./src/features/**/*.feature'],
    maxInstances: 1,
    logLevel: 'info',
    framework: 'cucumber',
    cucumberOpts: {
        require: ['./src/step-definitions/**/*.ts'],
        timeout: 60000,
        format: ['pretty']
    },
    reporters: ['spec'],
    before: function () {
        require('ts-node').register({ files: true });
    }
};
