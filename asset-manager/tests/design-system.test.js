/**
 * TDD RED: Design System Token Tests
 * These tests verify that the UIUX Pro Max design system tokens 
 * are properly defined in our CSS and component files.
 */

const fs = require('fs');
const path = require('path');

const GLOBALS_CSS = path.join(__dirname, '..', 'src', 'app', 'globals.css');
const SIDEBAR_TSX = path.join(__dirname, '..', 'src', 'components', 'Sidebar.tsx');
const LAYOUT_TSX = path.join(__dirname, '..', 'src', 'app', 'layout.tsx');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
    if (condition) {
        console.log(`  ✅ PASS: ${testName}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: ${testName}`);
        failed++;
    }
}

function readFile(filePath) {
    return fs.readFileSync(filePath, 'utf-8');
}

console.log('\n🎨 Design System Token Tests\n');

// --- globals.css tests ---
console.log('📄 globals.css');
const css = readFile(GLOBALS_CSS);

// Color tokens (UIUX Pro Max fintech palette)
assert(css.includes('--color-primary'), 'Has --color-primary token');
assert(css.includes('--color-sidebar-bg'), 'Has --color-sidebar-bg token');
assert(css.includes('--color-card-bg'), 'Has --color-card-bg token');
assert(css.includes('--color-accent'), 'Has --color-accent token');

// Typography (UIUX Pro Max: Inter font, proper line-height)
assert(css.includes('Inter'), 'Uses Inter font family');
assert(css.includes('line-height'), 'Defines line-height for readability');

// Glassmorphism utility (UIUX Pro Max style)
assert(css.includes('backdrop-filter') || css.includes('backdrop-blur'), 'Has glassmorphism/blur utility');

// Dark mode support
assert(css.includes('prefers-color-scheme: dark'), 'Supports dark mode');

// Smooth transitions baseline
assert(css.includes('transition'), 'Has transition utilities defined');

// --- Sidebar tests ---
console.log('\n📄 Sidebar.tsx');
const sidebar = readFile(SIDEBAR_TSX);

// UIUX Pro Max: No emoji icons, must use SVG (Lucide)
assert(!sidebar.match(/[\u{1F300}-\u{1F9FF}]/u), 'No emoji icons (uses Lucide SVG)');

// UIUX Pro Max: cursor-pointer on clickable elements
assert(sidebar.includes('cursor-pointer') || sidebar.includes('group'), 'Has hover interaction patterns');

// --- Layout tests ---
console.log('\n📄 layout.tsx');
const layout = readFile(LAYOUT_TSX);

// UIUX Pro Max: Uses Inter font
assert(layout.includes('Inter'), 'Layout uses Inter font');

// UIUX Pro Max: Has proper meta title
assert(layout.includes('Asset Manager'), 'Has descriptive title tag');

// --- Summary ---
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
process.exit(failed > 0 ? 1 : 0);
