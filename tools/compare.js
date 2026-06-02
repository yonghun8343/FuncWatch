#!/usr/bin/env node
// tools/compare.js
'use strict';

const fs = require('fs');
const path = require('path');
const { analyzeFiles } = require('./lib/analysis');
const { printReport } = require('./lib/terminal-report');
const { generateHtml } = require('./lib/html-report');

function parseArgs(argv) {
  const args = argv.slice(2);
  const files = [];
  const options = { html: false, out: 'compare-report.html', alpha: 0.5, beta: 10 };

  for (let i = 0; i < args.length; i++) {
    if      (args[i] === '--html')                    { options.html = true; }
    else if (args[i] === '--out'   && args[i + 1])   { options.out   = args[++i]; }
    else if (args[i] === '--alpha' && args[i + 1])   { options.alpha = parseFloat(args[++i]); }
    else if (args[i] === '--beta'  && args[i + 1])   { options.beta  = parseFloat(args[++i]); }
    else if (!args[i].startsWith('--'))              { files.push(path.resolve(args[i])); }
  }

  return { files, options };
}

function main(argv) {
  const { files, options } = parseArgs(argv);

  if (files.length === 0) {
    process.stderr.write('Usage: node tools/compare.js <file.js> [--html] [--out report.html] [--alpha 0.5] [--beta 10]\n');
    process.exit(1);
  }

  for (const f of files) {
    if (!fs.existsSync(f)) {
      process.stderr.write(`File not found: ${f}\n`);
      process.exit(1);
    }
  }

  const result = analyzeFiles(files, { alpha: options.alpha, beta: options.beta });
  printReport(result);

  if (options.html) {
    const html = generateHtml(result);
    fs.writeFileSync(options.out, html, 'utf-8');
    console.log(`HTML report written to: ${path.resolve(options.out)}`);
  }
}

if (require.main === module) main(process.argv);

module.exports = { parseArgs };
