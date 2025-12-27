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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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

interface ValidationResult {
    totalRows: number;
    validCount: number;
    invalidCount: number;
    validRows: Array<{ rowNumber: number; data: Record<string, string> }>;
    invalidRows: Array<{ rowNumber: number; data: Record<string, string>; errors: string[] }>;
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

    // Handle file upload (Issue 4: wrapped in useCallback, Issue 5: file size validation)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

    const handleFileUpload = useCallback(async (file: File) => {
        if (!file.name.endsWith('.csv')) {
            setError('Please upload a CSV file');
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setError('File too large. Maximum 5MB allowed.');
            return;
        }

        setIsLoading(true);
        setError(null);

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
        if (!validationResult || validationResult.validCount === 0) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/tenants/${tenantSlug}/assets/import/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categoryId: validationResult.categoryId,
                    rows: validationResult.validRows.map(r => r.data),
                }),
            });

            const result = await response.json();

            if (!response.ok) {
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

    // Issue 1: Fixed dependency - use handleFileUpload in deps
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
                            <div className="flex items-center gap-4">
                                <Badge variant="outline">{validationResult.categoryName}</Badge>
                                <Badge className="bg-green-100 text-green-800">
                                    <CheckCircleIcon className="mr-1 h-3 w-3" />
                                    {validationResult.validCount} valid
                                </Badge>
                                {validationResult.invalidCount > 0 && (
                                    <Badge className="bg-red-100 text-red-800">
                                        <AlertCircleIcon className="mr-1 h-3 w-3" />
                                        {validationResult.invalidCount} errors
                                    </Badge>
                                )}
                            </div>

                            {validationResult.invalidRows.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-red-600">
                                        Errors (these rows will be skipped):
                                    </p>
                                    <div className="max-h-56 overflow-y-auto rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/10">
                                        <div className="divide-y divide-red-100 dark:divide-red-900/30">
                                            {validationResult.invalidRows.map(row => (
                                                <div key={row.rowNumber} className="px-4 py-3">
                                                    <div className="flex items-start gap-3">
                                                        <span className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-700 text-xs font-medium dark:bg-red-900/50">
                                                            {row.rowNumber}
                                                        </span>
                                                        <ul className="flex-1 space-y-1 text-sm text-red-600 dark:text-red-400">
                                                            {row.errors.map((error, idx) => (
                                                                <li key={idx} className="break-words">
                                                                    • {error}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
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
                                    disabled={isLoading || validationResult.validCount === 0}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        <>
                                            <UploadIcon className="mr-2 h-4 w-4" />
                                            Import {validationResult.validCount} Assets
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
