// Utility functions for the File to CSV Converter

// Enhanced CSV formatting with line break preservation
function formatCSVCell(cellValue) {
    if (cellValue == null || cellValue === undefined) {
        return '';
    }
    
    const cellStr = String(cellValue);
    
    // Check if the cell contains special characters that require quoting
    const needsQuoting = cellStr.includes(',') || 
                        cellStr.includes('"') || 
                        cellStr.includes('\n') || 
                        cellStr.includes('\r') ||
                        cellStr.includes('\r\n');
    
    if (needsQuoting) {
        // Escape existing quotes by doubling them and wrap in quotes
        return '"' + cellStr.replace(/"/g, '""') + '"';
    }
    
    return cellStr;
}

// Enhanced text to CSV conversion with better line break handling
function advancedTextToCSV(text) {
    // Normalize line endings
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n');
    
    // Try to detect the best delimiter
    const delimiters = [
        { char: '\t', name: 'tab' },
        { char: '|', name: 'pipe' },
        { char: ';', name: 'semicolon' },
        { char: ',', name: 'comma' },
        { regex: /\s{2,}/, name: 'multiple-spaces' }
    ];
    
    let bestDelimiter = delimiters[0];
    let maxScore = 0;
    
    // Analyze first few lines to determine best delimiter
    const sampleLines = lines.slice(0, Math.min(10, lines.length)).filter(line => line.trim());
    
    for (const delimiter of delimiters) {
        let score = 0;
        const columnCounts = [];
        
        for (const line of sampleLines) {
            let columns;
            if (delimiter.regex) {
                columns = line.split(delimiter.regex);
            } else {
                columns = line.split(delimiter.char);
            }
            
            // Filter out empty columns
            columns = columns.filter(col => col.trim());
            
            if (columns.length > 1) {
                columnCounts.push(columns.length);
                score += columns.length;
            }
        }
        
        // Check consistency of column counts
        if (columnCounts.length > 0) {
            const avgColumns = columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length;
            const consistency = columnCounts.filter(count => Math.abs(count - avgColumns) <= 1).length / columnCounts.length;
            score = score * consistency;
            
            if (score > maxScore) {
                maxScore = score;
                bestDelimiter = delimiter;
            }
        }
    }
    
    // Convert lines to CSV format
    const csvLines = [];
    
    for (const line of lines) {
        if (!line.trim()) continue;
        
        let columns;
        if (bestDelimiter.regex) {
            columns = line.split(bestDelimiter.regex);
        } else {
            columns = line.split(bestDelimiter.char);
        }
        
        // Process each column to handle line breaks and special characters
        const processedColumns = columns.map(col => formatCSVCell(col.trim()));
        csvLines.push(processedColumns.join(','));
    }
    
    return csvLines.join('\n');
}

// Enhanced Excel processing with better line break preservation
function processExcelWithLineBreaks(worksheet) {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    const rows = [];
    
    for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
        const row = [];
        for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
            const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
            const cell = worksheet[cellAddress];
            
            if (cell) {
                // Get the formatted value or raw value
                let cellValue = cell.w || cell.v || '';
                
                // Preserve line breaks in cell values
                if (typeof cellValue === 'string') {
                    // Normalize line endings
                    cellValue = cellValue.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                }
                
                row.push(cellValue);
            } else {
                row.push('');
            }
        }
        rows.push(row);
    }
    
    // Convert to CSV with proper formatting
    return rows.map(row => 
        row.map(cell => formatCSVCell(cell)).join(',')
    ).join('\n');
}

// File type detection utility
function detectFileType(filename) {
    const extension = filename.toLowerCase().split('.').pop();
    const typeMap = {
        'xlsx': 'excel',
        'xls': 'excel',
        'docx': 'word',
        'doc': 'word',
        'txt': 'text',
        'csv': 'csv',
        'tsv': 'text'
    };
    
    return typeMap[extension] || 'unknown';
}

// CSV validation utility
function validateCSV(csvString) {
    try {
        const parsed = Papa.parse(csvString, { header: false });
        
        if (parsed.errors && parsed.errors.length > 0) {
            const criticalErrors = parsed.errors.filter(error => error.type === 'Quotes');
            if (criticalErrors.length > 0) {
                return {
                    valid: false,
                    errors: criticalErrors
                };
            }
        }
        
        return {
            valid: true,
            rowCount: parsed.data.length,
            columnCount: parsed.data[0] ? parsed.data[0].length : 0
        };
    } catch (error) {
        return {
            valid: false,
            errors: [{ message: error.message }]
        };
    }
}

// Enhanced Word document processing
function processWordWithTables(text) {
    // Try to detect table structures in Word document text
    const lines = text.split('\n').filter(line => line.trim());
    
    // Look for patterns that suggest tabular data
    const tablePatterns = [
        /\t+/,  // Tab-separated
        /\s{3,}/, // Multiple spaces
        /\|+/,   // Pipe-separated
        /;+/     // Semicolon-separated
    ];
    
    let bestPattern = null;
    let maxMatches = 0;
    
    for (const pattern of tablePatterns) {
        const matches = lines.filter(line => pattern.test(line)).length;
        if (matches > maxMatches) {
            maxMatches = matches;
            bestPattern = pattern;
        }
    }
    
    if (bestPattern && maxMatches > lines.length * 0.3) {
        // Detected tabular structure
        return advancedTextToCSV(text);
    } else {
        // Fallback: treat as simple text with line breaks preserved
        return lines.map(line => formatCSVCell(line)).join('\n');
    }
}

// Error handling utility
function handleFileError(error, filename) {
    const errorMap = {
        'corrupted': `The file "${filename}" appears to be corrupted or unreadable.`,
        'unsupported': `The file format of "${filename}" is not supported.`,
        'empty': `The file "${filename}" appears to be empty.`,
        'large': `The file "${filename}" is too large to process.`,
        'network': 'Network error occurred while processing the file.',
        'permission': 'Permission denied when trying to read the file.'
    };
    
    // Try to categorize the error
    const errorMsg = error.message.toLowerCase();
    
    if (errorMsg.includes('corrupted') || errorMsg.includes('invalid')) {
        return errorMap.corrupted;
    } else if (errorMsg.includes('unsupported') || errorMsg.includes('format')) {
        return errorMap.unsupported;
    } else if (errorMsg.includes('empty')) {
        return errorMap.empty;
    } else if (errorMsg.includes('size') || errorMsg.includes('large')) {
        return errorMap.large;
    } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        return errorMap.network;
    } else if (errorMsg.includes('permission') || errorMsg.includes('access')) {
        return errorMap.permission;
    }
    
    return `Error processing "${filename}": ${error.message}`;
}

// Performance monitoring utility
function measurePerformance(operation) {
    return async function(...args) {
        const startTime = performance.now();
        try {
            const result = await operation(...args);
            const endTime = performance.now();
            console.log(`Operation completed in ${(endTime - startTime).toFixed(2)}ms`);
            return result;
        } catch (error) {
            const endTime = performance.now();
            console.log(`Operation failed after ${(endTime - startTime).toFixed(2)}ms`);
            throw error;
        }
    };
}

// Recursively flatten nested HTML tables into a 2D array, robust for deeply nested tables
function flattenHtmlTable(table) {
    const rows = [];
    const trs = table.querySelectorAll(':scope > tbody > tr, :scope > tr');
    trs.forEach(tr => {
        const row = [];
        tr.childNodes.forEach(cell => {
            if (cell.nodeType === 1 && (cell.tagName === 'TD' || cell.tagName === 'TH')) {
                // If cell contains a nested table, flatten it recursively and join as a string
                const nestedTable = cell.querySelector('table');
                if (nestedTable) {
                    const nestedRows = flattenHtmlTable(nestedTable);
                    // Represent nested table as a multi-line string in a single cell
                    row.push(nestedRows.map(r => r.join(' | ')).join('\n'));
                } else {
                    row.push(cell.innerText.trim());
                }
            }
        });
        if (row.length > 0) rows.push(row);
    });
    return rows;
}

// Convert HTML table string to CSV, supporting nested tables
function htmlTableToCSV(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return '';
    const rows = flattenHtmlTable(table);
    return rows.map(row => row.map(formatCSVCell).join(',')).join('\n');
}

// Export utilities for use in the main application
window.FileConverterUtils = {
    formatCSVCell,
    advancedTextToCSV,
    processExcelWithLineBreaks,
    detectFileType,
    validateCSV,
    processWordWithTables,
    handleFileError,
    measurePerformance,
    htmlTableToCSV,
    flattenHtmlTable
};