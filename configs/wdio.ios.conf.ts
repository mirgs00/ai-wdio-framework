import { config as baseConfig } from './wdio.shared.conf';

export const config = {
    ...baseConfig,
    capabilities: [{
        platformName: 'iOS',
        'appium:deviceName': process.env.IOS_DEVICE || 'iPhone 15',
        'appium:platformVersion': process.env.IOS_VERSION || '17.0',
        'appium:automationName': 'XCUITest',
        'appium:app': process.env.IOS_APP || '/path/to/ios/app.app',
        'appium:autoAcceptAlerts': true
    }],
    services: [
        ['appium', { command: 'appium' }]
    ]
};
