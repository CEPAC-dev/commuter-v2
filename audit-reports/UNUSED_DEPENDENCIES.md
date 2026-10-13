| Dependency | direct | Verdict | Evidence |
| --- | --- | --- | --- |
| next-intl | ^4.13.1 | FALSE_POSITIVE | next.config.ts checks for createNextIntlPlugin; hits=src/components/layout/BottomNav.tsx:6; src/components/layout/DriverBottomNav.tsx:5; src/components/layout/UserNavbar.tsx:10 |
| rc-time-picker | ^3.7.3 | FALSE_POSITIVE | No direct repo references in src/scripts/tests/next.config/postcss/css outside package manifests. |
| react-time-picker | ^8.0.3 | FALSE_POSITIVE | No direct repo references in src/scripts/tests/next.config/postcss/css outside package manifests. |
| @types/bcryptjs | ^2.4.6 | FALSE_POSITIVE | package.json has bcryptjs ^2.4.6 and node_modules/bcryptjs/package.json types=umd/index.d.ts; hits= |
| tailwindcss | ^4 | FALSE_POSITIVE | CSS import + PostCSS config: postcss.config.mjs:3; src/app/globals.css:3  |
