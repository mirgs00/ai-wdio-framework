import path from 'path';
import { config as baseConfig } from './wdio.shared.conf';

export const config = {
    ...baseConfig,
    capabilities: [{
        platformName: 'Android',
        'appium:deviceName': process.env.ANDROID_DEVICE || 'Android Emulator',
        'appium:platformVersion': process.env.ANDROID_VERSION || '13.0',
        'appium:automationName': 'UiAutomator2',
        'appium:app': process.env.ANDROID_APP || path.resolve(__dirname, '../../apps/SauceLabsSample.apk'),
        'appium:autoGrantPermissions': true
    }],
    specs: ['src/features/sample.feature'],
    cucumberOpts: {
        require: ['src/step-definitions/**/*.ts'],
        timeout: 60000
},
    services: [
        ['appium', { command: 'appium' }]
    ]
};
