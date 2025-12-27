/**
 * CSV Parsing and Generation Utilities
 */

/**
 * Parse CSV text into array of row objects
 * Handles quoted values, commas within quotes, and escaped quotes
 */
export function parseCSV(csvText: string): Record<string, string>[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    // Parse header row
    const headers = parseCSVRow(lines[0]);
    const rows: Record<string, string>[] = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines

        const values = parseCSVRow(line);
        const row: Record<string, string> = {};

        headers.forEach((header, index) => {
            // Remove * suffix from required field markers
            const cleanHeader = header.replace(/\*$/, '').trim();
            row[cleanHeader] = values[index] || '';
        });

        rows.push(row);
    }

    return rows;
}

/**
 * Parse a single CSV row, handling quoted values
 */
function parseCSVRow(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"' && !inQuotes) {
            inQuotes = true;
        } else if (char === '"' && inQuotes) {
            if (nextChar === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            } else {
                inQuotes = false;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    values.push(current.trim());
    return values;
}

/**
 * Escape a value for CSV format (RFC 4180 compliant)
 */
export function escapeCSV(value: string): string {
    if (!value) return '';

    // If contains comma, newline, or quote, wrap in quotes and escape quotes
    if (value.includes(',') || value.includes('\n') || value.includes('"')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

/**
 * Generate CSV content from headers and rows
 */
export function generateCSV(headers: string[], rows: string[][]): string {
    const headerLine = headers.map(escapeCSV).join(',');
    const dataLines = rows.map(row => row.map(escapeCSV).join(','));
    return [headerLine, ...dataLines].join('\n');
}
