'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
    DownloadIcon,
    UploadIcon,
    CheckCircleIcon,
    AlertCircleIcon,
    Loader2Icon,
    FileIcon,
    ArrowLeftIcon
} from 'lucide-react';

interface Category {
    id: string;
    name: string;
    icon: string | null;
}

interface ImportIssueRow {
    rowNumber: number;
    data: Record<string, string>;
    errors: string[];
}

interface ValidationResult {
    totalRows: number;
    importableCount: number;
    blockedCount: number;
    summary: {
        validationErrors: number;
        fileDuplicates: number;
        existingConflicts: number;
    };
    importableRows: Array<{ rowNumber: number; data: Record<string, string> }>;
    blockedPreview: {
        validationErrors: ImportIssueRow[];
        fileDuplicates: ImportIssueRow[];
        existingConflicts: ImportIssueRow[];
    };
    categoryId: string;
    categoryName: string;
}

interface BulkImportModalProps {
    tenantSlug: string;
    categories: Category[];
    open: boolean;
    onClose: () => void;
}

type Step = 'select' | 'upload' | 'preview' | 'complete';
const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function getRowSummary(data: Record<string, string>) {
    const parts: string[] = [];

    if (data.name) {
        parts.push(data.name);
    }

    if (data.serialNumber) {
        parts.push(`SN ${data.serialNumber}`);
    }

    if (data.assetTag) {
        parts.push(`Tag ${data.assetTag}`);
    }

    return parts.join(' • ') || 'Row data';
}

function IssuePreviewSection({
    title,
    description,
    rows,
    tone,
}: {
    title: string;
    description: string;
    rows: ImportIssueRow[];
    tone: 'red' | 'amber' | 'orange';
}) {
    if (rows.length === 0) {
        return null;
    }

    const toneClasses = {
        red: {
            border: 'border-red-200',
            background: 'bg-red-50/50 dark:bg-red-950/10',
            divider: 'divide-red-100 dark:divide-red-900/30',
            badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
            text: 'text-red-600 dark:text-red-400',
        },
        amber: {
            border: 'border-amber-200',
            background: 'bg-amber-50/50 dark:bg-amber-950/10',
            divider: 'divide-amber-100 dark:divide-amber-900/30',
            badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
            text: 'text-amber-700 dark:text-amber-300',
        },
        orange: {
            border: 'border-orange-200',
            background: 'bg-orange-50/50 dark:bg-orange-950/10',
            divider: 'divide-orange-100 dark:divide-orange-900/30',
            badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
            text: 'text-orange-700 dark:text-orange-300',
        },
    } as const;

    const classes = toneClasses[tone];

    return (
        <div className="space-y-2">
            <div>
                <p className={`text-sm font-medium ${classes.text}`}>{title}</p>
                <p className="text-xs text-zinc-500">{description}</p>
            </div>
            <div className={`max-h-56 overflow-y-auto rounded-lg border ${classes.border} ${classes.background}`}>
                <div className={`divide-y ${classes.divider}`}>
                    {rows.map((row) => (
                        <div key={row.rowNumber} className="px-4 py-3">
                            <div className="flex items-start gap-3">
                                <span
                                    className={`inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium ${classes.badge}`}
                                >
                                    {row.rowNumber}
                                </span>
                                <div className="min-w-0 flex-1 space-y-1">
                                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                                        {getRowSummary(row.data)}
                                    </p>
                                    <ul className={`space-y-1 text-sm ${classes.text}`}>
                                        {row.errors.map((error, idx) => (
                                            <li key={idx} className="break-words">
                                                • {error}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function BulkImportModal({
    tenantSlug,
    categories,
    open,
    onClose,
}: BulkImportModalProps) {
    const router = useRouter();
    const [step, setStep] = useState<Step>('select');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [importResult, setImportResult] = useState<{ created: number; categoryName: string } | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Reset state when modal closes
    const handleClose = () => {
        setStep('select');
        setSelectedCategory('');
        setValidationResult(null);
        setError(null);
        setImportResult(null);
        setIsLoading(false);
        setIsDragging(false);
        onClose();
    };

    // Download template for selected category
    const downloadTemplate = () => {
        const link = document.createElement('a');
        link.href = `/api/tenants/${tenantSlug}/assets/import/template?categoryId=${selectedCategory}`;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = useCallback(async (file: File) => {
        if (!file.name.endsWith('.csv')) {
            setError('Please upload a CSV file');
            return;
        }

        if (file.size > MAX_IMPORT_FILE_SIZE) {
            setError('File too large. Maximum 5MB allowed.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setValidationResult(null);
        setImportResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('categoryId', selectedCategory);

            const response = await fetch(`/api/tenants/${tenantSlug}/assets/import/validate`, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || 'Validation failed');
                return;
            }

            setValidationResult(result);
            setStep('preview');
        } catch (err) {
            console.error('Upload error:', err);
            setError('Failed to upload file');
        } finally {
            setIsLoading(false);
        }
    }, [selectedCategory, tenantSlug]);

    // Execute import
    const executeImport = async () => {
        if (!validationResult || validationResult.importableCount === 0) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/tenants/${tenantSlug}/assets/import/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categoryId: validationResult.categoryId,
                    rows: validationResult.importableRows.map((row) => ({
                        ...row.data,
                        __rowNumber: row.rowNumber,
                    })),
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                if (
                    response.status === 409 &&
                    validationResult &&
                    result.summary &&
                    result.blockedPreview
                ) {
                    const conflictCount =
                        typeof result.summary.existingConflicts === 'number'
                            ? result.summary.existingConflicts
                            : 0;

                    setValidationResult({
                        ...validationResult,
                        importableCount: Math.max(
                            validationResult.importableCount - conflictCount,
                            0
                        ),
                        blockedCount:
                            validationResult.blockedCount + conflictCount,
                        summary: {
                            validationErrors:
                                validationResult.summary.validationErrors,
                            fileDuplicates:
                                validationResult.summary.fileDuplicates,
                            existingConflicts:
                                validationResult.summary.existingConflicts +
                                conflictCount,
                        },
                        blockedPreview: {
                            validationErrors:
                                validationResult.blockedPreview
                                    .validationErrors,
                            fileDuplicates:
                                validationResult.blockedPreview.fileDuplicates,
                            existingConflicts: [
                                ...validationResult.blockedPreview
                                    .existingConflicts,
                                ...result.blockedPreview.existingConflicts,
                            ].slice(0, 20),
                        },
                    });
                }

                setError(result.error || 'Import failed');
                return;
            }

            setImportResult(result);
            setStep('complete');
            router.refresh();
        } catch (err) {
            console.error('Import error:', err);
            setError('Failed to import assets');
        } finally {
            setIsLoading(false);
        }
    };

    // Drag and drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file);
    }, [handleFileUpload]);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileUpload(file);
    }, [handleFileUpload]);

    const selectedCategoryName = categories.find(c => c.id === selectedCategory)?.name;
    const readyCount = validationResult?.importableCount ?? 0;
    const blockedCount = validationResult?.blockedCount ?? 0;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl">
                {/* Step 1: Select Category */}
                {step === 'select' && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Import Assets</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 py-4">
                            <div className="space-y-2">
                                <Label>Select Category</Label>
                                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a category..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map(cat => (
                                            <SelectItem key={cat.id} value={cat.id}>
                                                {cat.icon} {cat.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-sm text-zinc-500">
                                    Assets will be imported into this category with its custom fields.
                                </p>
                            </div>

                            {selectedCategory && (
                                <div className="rounded-lg border border-dashed p-4 bg-zinc-50 dark:bg-zinc-900">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">Download Template</p>
                                            <p className="text-sm text-zinc-500">
                                                Get a CSV template with the correct columns for {selectedCategoryName}
                                            </p>
                                        </div>
                                        <Button variant="outline" onClick={downloadTemplate}>
                                            <DownloadIcon className="mr-2 h-4 w-4" />
                                            Download
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={handleClose}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => setStep('upload')}
                                    disabled={!selectedCategory}
                                >
                                    Continue to Upload
                                </Button>
                            </div>
                        </div>
                    </>
                )}

                {/* Step 2: Upload File */}
                {step === 'upload' && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Upload CSV File</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 py-4">
                            <div className="flex items-center gap-2 text-sm text-zinc-600">
                                <Badge variant="outline">{selectedCategoryName}</Badge>
                            </div>

                            <div
                                className={`
                                    relative rounded-lg border-2 border-dashed p-12 text-center
                                    transition-colors cursor-pointer
                                    ${isDragging
                                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20'
                                        : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700'
                                    }
                                `}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => document.getElementById('file-input')?.click()}
                            >
                                <input
                                    id="file-input"
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleFileInput}
                                />
                                {isLoading ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2Icon className="h-10 w-10 text-violet-500 animate-spin" />
                                        <p className="text-sm text-zinc-600">Validating file...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <FileIcon className="h-10 w-10 text-zinc-400" />
                                        <p className="font-medium">Drop CSV file here or click to browse</p>
                                        <p className="text-sm text-zinc-500">Maximum 1,000 rows</p>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/20">
                                    {error}
                                </div>
                            )}

                            <div className="flex justify-between">
                                <Button variant="ghost" onClick={() => setStep('select')}>
                                    <ArrowLeftIcon className="mr-2 h-4 w-4" />
                                    Back
                                </Button>
                                <Button variant="outline" onClick={handleClose}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </>
                )}

                {/* Step 3: Preview */}
                {step === 'preview' && validationResult && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Preview Import</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 py-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <Badge variant="outline">{validationResult.categoryName}</Badge>
                                <Badge className="bg-green-100 text-green-800">
                                    <CheckCircleIcon className="mr-1 h-3 w-3" />
                                    {validationResult.importableCount} ready
                                </Badge>
                                {validationResult.summary.validationErrors > 0 && (
                                    <Badge className="bg-red-100 text-red-800">
                                        <AlertCircleIcon className="mr-1 h-3 w-3" />
                                        {validationResult.summary.validationErrors} validation issue{validationResult.summary.validationErrors === 1 ? '' : 's'}
                                    </Badge>
                                )}
                                {validationResult.summary.fileDuplicates > 0 && (
                                    <Badge className="bg-amber-100 text-amber-800">
                                        <AlertCircleIcon className="mr-1 h-3 w-3" />
                                        {validationResult.summary.fileDuplicates} duplicate{validationResult.summary.fileDuplicates === 1 ? '' : 's'} in file
                                    </Badge>
                                )}
                                {validationResult.summary.existingConflicts > 0 && (
                                    <Badge className="bg-orange-100 text-orange-800">
                                        <AlertCircleIcon className="mr-1 h-3 w-3" />
                                        {validationResult.summary.existingConflicts} existing conflict{validationResult.summary.existingConflicts === 1 ? '' : 's'}
                                    </Badge>
                                )}
                            </div>

                            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                                <p className="font-medium text-zinc-900 dark:text-white">
                                    {blockedCount > 0
                                        ? `${readyCount} row${readyCount === 1 ? '' : 's'} are ready to import. ${blockedCount} row${blockedCount === 1 ? '' : 's'} are blocked.`
                                        : `All ${readyCount} row${readyCount === 1 ? '' : 's'} are ready to import.`}
                                </p>
                                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                                    {blockedCount > 0
                                        ? 'Only the ready rows will be imported. Fix the blocked rows and upload the file again to bring them in too.'
                                        : 'No blocking issues found in this file.'}
                                </p>
                            </div>

                            <div className="space-y-4">
                                <IssuePreviewSection
                                    title="Validation issues"
                                    description="These rows have missing or invalid field values and cannot be imported yet."
                                    rows={validationResult.blockedPreview.validationErrors}
                                    tone="red"
                                />
                                <IssuePreviewSection
                                    title="Duplicate identifiers in this file"
                                    description="These rows reuse a serial number or asset tag somewhere else in the same CSV."
                                    rows={validationResult.blockedPreview.fileDuplicates}
                                    tone="amber"
                                />
                                <IssuePreviewSection
                                    title="Conflicts with existing assets"
                                    description="These rows use a serial number or asset tag that already exists in this tenant."
                                    rows={validationResult.blockedPreview.existingConflicts}
                                    tone="orange"
                                />
                            </div>

                            {blockedCount === 0 && readyCount > 0 && (
                                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300">
                                    Everything looks good. This import can proceed as-is.
                                </div>
                            )}

                            {error && (
                                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/20">
                                    {error}
                                </div>
                            )}

                            <div className="flex justify-between">
                                <Button variant="ghost" onClick={() => setStep('upload')}>
                                    <ArrowLeftIcon className="mr-2 h-4 w-4" />
                                    Upload Different File
                                </Button>
                                <Button
                                    onClick={executeImport}
                                    disabled={isLoading || validationResult.importableCount === 0}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        <>
                                            <UploadIcon className="mr-2 h-4 w-4" />
                                            Import {validationResult.importableCount} {validationResult.blockedCount > 0 ? 'Ready Rows' : 'Assets'}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </>
                )}

                {/* Step 4: Complete */}
                {step === 'complete' && importResult && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Import Complete</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 py-8 text-center">
                            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircleIcon className="h-8 w-8 text-green-600" />
                            </div>
                            <div>
                                <p className="text-lg font-medium">
                                    Successfully imported {importResult.created} assets
                                </p>
                                <p className="text-sm text-zinc-500">
                                    Added to {importResult.categoryName}
                                </p>
                                {validationResult?.blockedCount ? (
                                    <p className="mt-2 text-sm text-zinc-500">
                                        {validationResult.blockedCount} blocked row{validationResult.blockedCount === 1 ? '' : 's'} were skipped. Fix them and upload the file again to import the rest.
                                    </p>
                                ) : (
                                    <p className="mt-2 text-sm text-zinc-500">
                                        All rows from this upload were imported successfully.
                                    </p>
                                )}
                            </div>
                            <Button onClick={handleClose}>
                                Done
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
