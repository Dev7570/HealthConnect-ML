const fs = require('fs');

const appFile = 'c:\\Users\\Dev Gupta\\Desktop\\pro2\\healthconnect\\src\\App.js';
let content = fs.readFileSync(appFile, 'utf8');

// Replacements array
const mappings = [
  // Backgrounds
  { search: /:\s*"#F1F5F9"/g, replace: ': `var(--bg-main)`' },
  { search: /:\s*"#f0f2f5"/g, replace: ': `var(--bg-main)`' },
  { search: /:\s*"#f9fafb"/g, replace: ': `var(--bg-main)`' },
  { search: /:\s*"white"/g, replace: ': `var(--bg-card)`' },
  { search: /:\s*"#ffffff"/g, replace: ': `var(--bg-card)`' },
  { search: /:\s*"#FFFFFF"/g, replace: ': `var(--bg-card)`' },
  { search: /:\s*"#F9FAFB"/g, replace: ': `var(--bg-card-hover)`' },

  // Text
  { search: /:\s*"#111827"/g, replace: ': `var(--text-primary)`' },
  { search: /:\s*"#1F2937"/g, replace: ': `var(--text-primary)`' },
  { search: /:\s*"#374151"/g, replace: ': `var(--text-secondary)`' },
  { search: /:\s*"#4B5563"/g, replace: ': `var(--text-secondary)`' },
  { search: /:\s*"#6B7280"/g, replace: ': `var(--text-muted)`' },
  { search: /:\s*"#9CA3AF"/g, replace: ': `var(--text-muted)`' },

  // Borders
  { search: /:\s*"#E5E7EB"/g, replace: ': `var(--border-light)`' },
  { search: /:\s*"#F3F4F6"/g, replace: ': `var(--border-light)`' }
];

mappings.forEach(m => {
  content = content.replace(m.search, m.replace);
});

// Write it back
fs.writeFileSync(appFile, content);
console.log("Migration script complete");
