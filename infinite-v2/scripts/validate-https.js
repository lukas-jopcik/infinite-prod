#!/usr/bin/env node

/**
 * HTTPS Validation Script
 * 
 * This script validates that all resources in production code use HTTPS.
 * It scans HTML, JSX, TSX, and JS files for HTTP references and reports violations.
 * 
 * Usage: node scripts/validate-https.js [--fix] [--verbose]
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Configuration
const CONFIG = {
  // Directories to scan
  scanDirs: [
    'app',
    'components', 
    'lib',
    'public',
    'styles'
  ],
  
  // File extensions to check
  fileExtensions: ['.tsx', '.ts', '.jsx', '.js', '.html', '.css'],
  
  // Directories to exclude
  excludeDirs: [
    'node_modules',
    '.next',
    '.git',
    'dist',
    'build',
    'coverage'
  ],
  
  // Patterns that are allowed (exceptions)
  allowedPatterns: [
    /^\/\//, // Protocol-relative URLs
    /^\/[^\/]/, // Relative URLs starting with /
    /^\./, // Relative URLs starting with .
    /^#/, // Hash fragments
    /^data:/, // Data URLs
    /^blob:/, // Blob URLs
    /^mailto:/, // Email links
    /^tel:/, // Phone links
    /localhost/, // Localhost (development)
    /127\.0\.0\.1/, // Local IP
    /192\.168\./, // Private network
    /10\./, // Private network
    /172\.(1[6-9]|2[0-9]|3[01])\./, // Private network
    /node_modules/, // Dependencies
    /\.test\./, // Test files
    /\.spec\./, // Spec files
    /__tests__/, // Test directories
    /\.d\.ts$/, // TypeScript declaration files
  ],
  
  // HTTP patterns to detect
  httpPatterns: [
    /http:\/\/[^\s"'`<>]+/gi,
    /src=["']http:\/\/[^"']+["']/gi,
    /href=["']http:\/\/[^"']+["']/gi,
    /url\(["']?http:\/\/[^"')]+["']?\)/gi,
    /fetch\(["']http:\/\/[^"')]+["']?\)/gi,
    /axios\.get\(["']http:\/\/[^"')]+["']?\)/gi,
    /axios\.post\(["']http:\/\/[^"')]+["']?\)/gi,
  ]
}

// Command line options
const options = {
  fix: process.argv.includes('--fix'),
  verbose: process.argv.includes('--verbose'),
  help: process.argv.includes('--help')
}

if (options.help) {
  console.log(`
HTTPS Validation Script

Usage: node scripts/validate-https.js [options]

Options:
  --fix      Attempt to fix HTTP URLs by converting to HTTPS
  --verbose  Show detailed output including allowed patterns
  --help     Show this help message

Examples:
  node scripts/validate-https.js
  node scripts/validate-https.js --verbose
  node scripts/validate-https.js --fix --verbose
`)
  process.exit(0)
}

// Results tracking
const results = {
  totalFiles: 0,
  filesWithIssues: 0,
  totalIssues: 0,
  issues: [],
  fixed: 0
}

/**
 * Check if a path should be excluded
 */
function shouldExclude(filePath) {
  return CONFIG.excludeDirs.some(dir => filePath.includes(dir))
}

/**
 * Check if a URL pattern is allowed
 */
function isAllowedPattern(url) {
  return CONFIG.allowedPatterns.some(pattern => pattern.test(url))
}

/**
 * Extract HTTP URLs from text content
 */
function extractHttpUrls(content, filePath) {
  const urls = []
  
  CONFIG.httpPatterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(content)) !== null) {
      const url = match[0]
      const lineNumber = content.substring(0, match.index).split('\n').length
      
      if (!isAllowedPattern(url)) {
        urls.push({
          url,
          line: lineNumber,
          match: match[0],
          file: filePath
        })
      }
    }
  })
  
  return urls
}

/**
 * Fix HTTP URLs by converting to HTTPS
 */
function fixHttpUrls(content, filePath) {
  let fixedContent = content
  let fixedCount = 0
  
  CONFIG.httpPatterns.forEach(pattern => {
    fixedContent = fixedContent.replace(pattern, (match) => {
      if (!isAllowedPattern(match)) {
        const httpsMatch = match.replace(/^http:\/\//, 'https://')
        if (options.verbose) {
          console.log(`  Fixing: ${match} → ${httpsMatch}`)
        }
        fixedCount++
        return httpsMatch
      }
      return match
    })
  })
  
  if (fixedCount > 0) {
    fs.writeFileSync(filePath, fixedContent, 'utf8')
    results.fixed += fixedCount
  }
  
  return fixedCount
}

/**
 * Scan a single file for HTTP URLs
 */
function scanFile(filePath) {
  if (shouldExclude(filePath)) {
    return
  }
  
  const ext = path.extname(filePath)
  if (!CONFIG.fileExtensions.includes(ext)) {
    return
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    results.totalFiles++
    
    const httpUrls = extractHttpUrls(content, filePath)
    
    if (httpUrls.length > 0) {
      results.filesWithIssues++
      results.totalIssues += httpUrls.length
      results.issues.push(...httpUrls)
      
      if (options.verbose) {
        console.log(`\n❌ ${filePath}`)
        httpUrls.forEach(issue => {
          console.log(`  Line ${issue.line}: ${issue.url}`)
        })
      }
      
      // Fix if requested
      if (options.fix) {
        const fixedCount = fixHttpUrls(content, filePath)
        if (fixedCount > 0) {
          console.log(`✅ Fixed ${fixedCount} HTTP URLs in ${filePath}`)
        }
      }
    } else if (options.verbose) {
      console.log(`✅ ${filePath}`)
    }
    
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message)
  }
}

/**
 * Recursively scan directory
 */
function scanDirectory(dirPath) {
  if (shouldExclude(dirPath)) {
    return
  }
  
  try {
    const items = fs.readdirSync(dirPath)
    
    items.forEach(item => {
      const fullPath = path.join(dirPath, item)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath)
      } else if (stat.isFile()) {
        scanFile(fullPath)
      }
    })
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error.message)
  }
}

/**
 * Generate report
 */
function generateReport() {
  console.log('\n' + '='.repeat(60))
  console.log('HTTPS VALIDATION REPORT')
  console.log('='.repeat(60))
  
  console.log(`\n📊 Summary:`)
  console.log(`  Total files scanned: ${results.totalFiles}`)
  console.log(`  Files with issues: ${results.filesWithIssues}`)
  console.log(`  Total HTTP URLs found: ${results.totalIssues}`)
  
  if (options.fix) {
    console.log(`  URLs fixed: ${results.fixed}`)
  }
  
  if (results.issues.length > 0) {
    console.log(`\n❌ Issues found:`)
    
    // Group by file
    const issuesByFile = {}
    results.issues.forEach(issue => {
      if (!issuesByFile[issue.file]) {
        issuesByFile[issue.file] = []
      }
      issuesByFile[issue.file].push(issue)
    })
    
    Object.entries(issuesByFile).forEach(([file, issues]) => {
      console.log(`\n  📄 ${file}`)
      issues.forEach(issue => {
        console.log(`    Line ${issue.line}: ${issue.url}`)
      })
    })
    
    console.log(`\n💡 Recommendations:`)
    console.log(`  1. Replace http:// with https:// in the URLs above`)
    console.log(`  2. Use relative URLs where possible`)
    console.log(`  3. Ensure all external services support HTTPS`)
    console.log(`  4. Run with --fix flag to automatically convert HTTP to HTTPS`)
    
    if (!options.fix) {
      console.log(`\n🔧 To fix automatically, run:`)
      console.log(`  node scripts/validate-https.js --fix`)
    }
  } else {
    console.log(`\n✅ No HTTP URLs found! All resources use HTTPS.`)
  }
  
  console.log('\n' + '='.repeat(60))
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Scanning for HTTP URLs in production code...')
  
  if (options.verbose) {
    console.log(`\n📁 Scanning directories: ${CONFIG.scanDirs.join(', ')}`)
    console.log(`📄 File extensions: ${CONFIG.fileExtensions.join(', ')}`)
    console.log(`🚫 Excluding: ${CONFIG.excludeDirs.join(', ')}`)
  }
  
  // Change to project root
  const projectRoot = path.resolve(__dirname, '..')
  process.chdir(projectRoot)
  
  // Scan configured directories
  CONFIG.scanDirs.forEach(dir => {
    const fullPath = path.join(projectRoot, dir)
    if (fs.existsSync(fullPath)) {
      if (options.verbose) {
        console.log(`\n📂 Scanning ${dir}/`)
      }
      scanDirectory(fullPath)
    } else if (options.verbose) {
      console.log(`⚠️  Directory ${dir} not found, skipping`)
    }
  })
  
  // Generate report
  generateReport()
  
  // Exit with error code if issues found
  if (results.totalIssues > 0 && !options.fix) {
    process.exit(1)
  } else if (results.totalIssues > 0 && options.fix && results.fixed === 0) {
    console.log('\n⚠️  Issues found but could not be automatically fixed')
    process.exit(1)
  }
  
  console.log('\n🎉 Validation completed successfully!')
}

// Run the script
if (require.main === module) {
  main()
}

module.exports = {
  scanFile,
  scanDirectory,
  extractHttpUrls,
  isAllowedPattern,
  shouldExclude
}
