import * as path from 'node:path';
import {defineConfig} from 'rspress/config';

export default defineConfig({
    root: path.join(__dirname, 'docs'),
    title: 'Quizzle Docs',
    description: 'Dokumentation für Quizzle - die kostenlose Quiz-Plattform für Schulen',
    base: '/',
    icon: '/quizzle-logo.png',
    logo: {
        light: '/quizzle-title.png',
        dark: '/quizzle-title.png',
    },
    themeConfig: {
        socialLinks: [
            {
                icon: 'github',
                mode: 'link',
                content: 'https://github.com/gnmyt/Quizzle',
            },
        ],
    },
});
