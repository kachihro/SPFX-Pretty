import * as fs from 'fs';
import * as path from 'path';
import { makePngIcon } from '../core/icons';
// The extension's own Marketplace icon, drawn by the same generator it ships.
fs.mkdirSync(path.join(__dirname, '..', '..', 'media'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', '..', 'media', 'icon.png'), makePngIcon({ size: 128, colour: '#C239B3', glyph: 'webpart' }));
