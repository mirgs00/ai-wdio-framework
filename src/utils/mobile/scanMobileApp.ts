import fs from 'fs';
import path from 'path';
import { $$ } from '@wdio/globals';

/**
 * Scans all visible UI elements from the mobile app and saves their metadata.
 * Works for Android and iOS.
 */
export async function scanMobileApp(platform: 'android' | 'ios') {
    const elements = await $$('*'); // All elements in current view
    const metadata: any[] = [];

    for (const el of elements) {
        try {
            const id = platform === 'android'
                ? await el.getAttribute('resource-id')
                : await el.getAttribute('name');

            const label = platform === 'android'
                ? (await el.getAttribute('content-desc')) || (await el.getText())
                : (await el.getAttribute('label')) || (await el.getText());

            const className = await el.getAttribute('class');
            const bounds = await el.getAttribute('bounds'); // Android only

            metadata.push({
                id,
                label,
                className,
                bounds: bounds || null
            });
        } catch (err) {
            // ignore errors for elements we can't read
        }
    }

    const tmpDir = path.resolve('tmp');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir);
    }

    const filePath = path.join(tmpDir, `${platform}-elements.json`);
    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));

    console.log(`✅ Scanned ${metadata.length} elements from ${platform} app.`);
    console.log(`📄 Saved to: ${filePath}`);
}
