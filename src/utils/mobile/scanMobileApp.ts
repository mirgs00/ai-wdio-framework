import fs from 'fs';
import path from 'path';
import { $$ } from '@wdio/globals';
import { remote } from 'webdriverio';

/**
 * Scans all visible UI elements from the mobile app and saves their metadata.
 * Works for Android and iOS.
 * Requires an active WebDriverIO/Appium session.
 */
export async function scanMobileApp(platform: 'android' | 'ios') {
  const elements = await $$('*'); // All elements in current view
  const metadata: any[] = [];

  for (const el of elements) {
    try {
      const id =
        platform === 'android'
          ? await el.getAttribute('resource-id')
          : await el.getAttribute('name');

      const label =
        platform === 'android'
          ? (await el.getAttribute('content-desc')) || (await el.getText())
          : (await el.getAttribute('label')) || (await el.getText());

      const className = await el.getAttribute('class');
      const bounds = await el.getAttribute('bounds'); // Android only

      metadata.push({
        id,
        label,
        className,
        bounds: bounds || null,
      });
    } catch (err) {
      // ignore errors for elements we can't read
    }
  }

  const tmpDir = path.resolve('tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const filePath = path.join(tmpDir, `${platform}-elements.json`);
  fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));

  console.log(`✅ Scanned ${metadata.length} elements from ${platform} app.`);
  console.log(`📄 Saved to: ${filePath}`);
}

async function main() {
  const platform = (process.argv[2] || 'android') as 'android' | 'ios';
  if (!['android', 'ios'].includes(platform)) {
    console.error('Usage: npx ts-node src/utils/mobile/scanMobileApp.ts <android|ios>');
    process.exit(1);
  }

  const capabilities =
    platform === 'android'
      ? {
          platformName: 'Android',
          'appium:automationName': 'UiAutomator2',
          'appium:deviceName': process.env.ANDROID_DEVICE || 'Android Emulator',
        }
      : {
          platformName: 'iOS',
          'appium:automationName': 'XCUITest',
          'appium:deviceName': process.env.IOS_DEVICE || 'iPhone 15',
        };

  const browser = await remote({ capabilities, logLevel: 'info' });

  try {
    await scanMobileApp(platform);
  } finally {
    await browser.deleteSession();
  }
}

if (require.main === module) {
  main().catch(console.error);
}
