import * as XLSX from 'xlsx';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { MergedData, LogType } from '../types';

/**
 * Normalizes a string by removing Vietnamese accents, converting to lowercase, 
 * and removing special characters and spaces.
 * @param str The string to normalize.
 * @returns The normalized string.
 */
export const normalizeString = (str: any): string => {
    if (typeof str !== 'string' || !str) return '';
    // First, normalize to decompose combined characters, then remove diacritics
    let normalized = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Then, convert to lower case
    normalized = normalized.toLowerCase();
    // CRITICAL: Specifically handle the Vietnamese 'đ' character, converting it to 'd'
    normalized = normalized.replace(/đ/g, 'd');
    // Finally, remove all remaining non-alphanumeric characters
    return normalized.replace(/[^a-z0-9]/g, '');
};

/**
 * Reads a file (Excel or CSV) and returns its content as an array of arrays.
 * This version is robust and uses XLSX for both file types.
 * @param file The file to read.
 * @returns A promise that resolves to a 2D string array.
 */
const readFileAsArray = (file: File): Promise<(string|null)[][]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array', cellDates: false });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: (string|null)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
                
                // Filter out completely empty rows which can sometimes be read by the library
                const filteredJson = json.filter(row => row.some(cell => cell !== null && String(cell).trim() !== ''));
                resolve(filteredJson);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        
        // Read as ArrayBuffer for both Excel and CSV. XLSX handles both.
        reader.readAsArrayBuffer(file);
    });
};


/**
 * Detects the header row in a 2D array of data based on expected keywords.
 * @param data The 2D array of data.
 * @param keywords The keywords to look for in header cells.
 * @returns The index of the header row, or 0 if not found.
 */
const detectHeaderRow = (data: (string|null|undefined)[][], keywords: string[]): number => {
    for (let i = 0; i < Math.min(10, data.length); i++) {
        const row = data[i];
        let matchCount = 0;
        for (const cell of row) {
            const normalizedCell = normalizeString(cell);
            if (keywords.some(kw => normalizedCell.includes(normalizeString(kw)))) {
                matchCount++;
            }
        }
        if (matchCount >= 2) {
            return i;
        }
    }
    return 0; // Default to the first row if no better match is found
};


/**
 * Finds the original column name that matches a list of keywords.
 * @param headers An array of header strings.
 * @param keywords An array of keywords to search for.
 * @returns The original column name or null if not found.
 */
const findColumn = (headers: string[], keywords: string[]): string | null => {
    const normalizedHeaders = headers.map(h => ({ original: h, normalized: normalizeString(h) }));
    for (const keyword of keywords) {
        const normKey = normalizeString(keyword);
        const found = normalizedHeaders.find(h => h.normalized.includes(normKey));
        if (found) {
            return found.original;
        }
    }
    return null;
};

/**
 * Processes the raw data from the main file.
 * Groups students by project, forward-fills project names.
 * @param rawData Raw 2D array from the main file.
 * @returns Processed data ready for merging.
 */
const processMainData = (rawData: (string|null|undefined)[][]): any[] => {
    const headerRowIndex = detectHeaderRow(rawData, ["Tên đề tài", "Họ tên HV", "Người hướng dẫn"]);
    const headers = rawData[headerRowIndex].map(h => String(h || '').trim());
    const dataRows = rawData.slice(headerRowIndex + 1);

    const topicCol = findColumn(headers, ["Tên đề tài", "De tai"]);
    const nameCol = findColumn(headers, ["Họ tên HV", "Ten hoc vien"]);
    const guideCol = findColumn(headers, ["Người hướng dẫn"]);

    if (!topicCol || !nameCol) {
        throw new Error("File chính phải có cột 'Tên đề tài' và 'Họ tên HV'.");
    }

    // Convert to objects and forward-fill topic
    let lastTopic = '';
    const filledData = dataRows.map(row => {
        const obj: { [key: string]: any } = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        
        if (obj[topicCol]) {
            lastTopic = obj[topicCol];
        } else {
            obj[topicCol] = lastTopic;
        }
        return obj;
    }).filter(obj => obj[nameCol]); // Only keep rows with a student name

    // Group by topic
    const grouped = filledData.reduce((acc, row) => {
        const topic = row[topicCol];
        if (!acc[topic]) {
            acc[topic] = [];
        }
        acc[topic].push(row);
        return acc;
    }, {} as Record<string, any[]>);

    // Aggregate groups
    return Object.values(grouped).map(group => {
        const first = group[0];
        const studentNames = group.map(s => String(s[nameCol] || '').trim()).filter(Boolean).join(', ');
        const result: any = {
            'Tên đề tài': first[topicCol],
            'Họ tên HV': studentNames,
            'Số học viên': group.length,
            'Người hướng dẫn': guideCol ? first[guideCol] || '' : ''
        };
        return result;
    });
};

/**
 * Merges the processed main data with supplementary data from a transposed layout.
 * It correctly reads ratio data vertically from columns ('Tỉ lệ 1', 'Tỉ lệ 2') and maps it to projects.
 * @param dfMain Processed main data.
 * @param dfSupp Raw 2D array from supplementary file.
 * @returns The final merged dataset.
 */
const mergeMainAndRatios = (dfMain: any[], dfSupp: (string | null | undefined)[][]): MergedData[] => {
    // 1. Get headers and data rows from supplementary file
    const headerRowIndex = detectHeaderRow(dfSupp, ["TV", "Tỉ lệ"]);
    const headers = dfSupp[headerRowIndex].map(h => String(h || '').trim());
    const dataRows = dfSupp.slice(headerRowIndex + 1);

    // 2. Find the TV column index (this is read row-wise, per project)
    const tvColHeader = findColumn(headers, ["TV"]);
    const tvColIndex = tvColHeader ? headers.indexOf(tvColHeader) : -1;

    // 3. Find and sort all project ratio columns (e.g., 'Tỉ lệ 1', 'Tỉ lệ 2')
    const projectRatioColumns = headers
        .map((header, index) => ({ header, index, norm: normalizeString(header) }))
        .filter(c => c.norm.match(/^(tile|ti le)\d+$/))
        .sort((a, b) => {
            const numA = parseInt(a.norm.replace(/^(tile|ti le)/, ''), 10);
            const numB = parseInt(b.norm.replace(/^(tile|ti le)/, ''), 10);
            return numA - numB;
        });
    
    if (projectRatioColumns.length === 0 && tvColIndex === -1) {
         throw new Error("File bổ sung không tìm thấy cột 'TV' hoặc các cột tỉ lệ (ví dụ: 'Tỉ lệ 1', 'Tỉ lệ 2', ...).");
    }

    // 4. Iterate through main projects and map data
    const enrichedRows: MergedData[] = dfMain.map((mainRow, projectIndex) => {
        const newRow: MergedData = {
            hotenhv: mainRow['Họ tên HV'],
            tendetai: mainRow['Tên đề tài'],
            sohocvien: mainRow['Số học viên'],
            nguoihuongdan: mainRow['Người hướng dẫn'],
        };

        const suppDataRowForTV = dataRows[projectIndex];
        
        // 5. Assign TV value from the corresponding row
        if (suppDataRowForTV && tvColIndex !== -1) {
            const tvVal = suppDataRowForTV[tvColIndex];
            if (tvVal !== null && tvVal !== undefined) {
                const numVal = typeof tvVal === 'string' ? parseFloat(tvVal.replace(',', '.')) : (typeof tvVal === 'number' ? tvVal : undefined);
                if (numVal !== undefined && !isNaN(numVal)) {
                   newRow.tv = numVal;
                }
            }
        }
        
        // 6. Assign Chapter values by reading vertically from the corresponding 'Tỉ lệ X' column
        const ratioColumnForProject = projectRatioColumns[projectIndex];
        if (ratioColumnForProject) {
            const ratioColIndex = ratioColumnForProject.index;
            
            // Iterate down the column to get all chapter values for this one project
            dataRows.forEach((row, chapterIndex) => {
                const cellValue = row[ratioColIndex];
                if (cellValue !== null && cellValue !== undefined && String(cellValue).trim() !== '') {
                    const numValue = typeof cellValue === 'string' 
                        ? parseFloat(cellValue.replace(',', '.')) 
                        : (typeof cellValue === 'number' ? cellValue : undefined);

                    if (numValue !== undefined && !isNaN(numValue)) {
                        const cKey = `c${chapterIndex + 1}`;
                        newRow[cKey] = numValue;
                    }
                }
            });
        }
        
        return newRow;
    });
    
    return enrichedRows;
};



/**
 * Main function to generate the merged Excel file.
 */
export const generateMergedExcel = async (
    mainFile: File, 
    suppFile: File,
    addLog: (message: string, type: LogType) => void
): Promise<{ data: MergedData[], buffer: ArrayBuffer }> => {
    
    addLog('Đọc File chính...', LogType.Info);
    const mainRawData = await readFileAsArray(mainFile);
    if (mainRawData.length === 0) throw new Error("File chính rỗng hoặc không đọc được.");
    
    addLog('Xử lý File chính...', LogType.Info);
    const mainProcessed = processMainData(mainRawData);
    
    addLog('Đọc File bổ sung...', LogType.Info);
    const suppRawData = await readFileAsArray(suppFile);
    if (suppRawData.length === 0) throw new Error("File bổ sung rỗng hoặc không đọc được.");

    addLog('Gộp dữ liệu...', LogType.Info);
    const mergedData = mergeMainAndRatios(mainProcessed, suppRawData);

    const finalDataForSheet = mergedData.map(row => {
        const newRow: any = {
            'Tên đề tài': row.tendetai,
            'Người hướng dẫn': row.nguoihuongdan,
            'Số học viên': row.sohocvien,
            'Họ tên HV': row.hotenhv,
            'TV': row.tv,
        };
        Object.keys(row)
            .filter(k => k.startsWith('c'))
            .sort((a,b) => parseInt(a.substring(1)) - parseInt(b.substring(1)))
            .forEach(key => {
                newRow[key.toUpperCase()] = row[key as keyof MergedData];
            });
        return newRow;
    });

    const newWorksheet = XLSX.utils.json_to_sheet(finalDataForSheet);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Gop');
    const buffer = XLSX.write(newWorkbook, { bookType: 'xlsx', type: 'array' });

    return { data: mergedData, buffer };
};

export const readDataFileForReporting = async (file: File): Promise<MergedData[]> => {
    const data = await readFileAsArray(file);
    if (data.length < 2) { // Must have header + at least one data row
        throw new Error("File dữ liệu không có đủ nội dung.");
    }

    const headers = data[0].map(h => normalizeString(h));
    const dataRows = data.slice(1);

    const findIndex = (keywords: string[]): number => {
        for (const kw of keywords) {
            const normalizedKw = normalizeString(kw);
            const index = headers.findIndex(h => h.includes(normalizedKw));
            if (index !== -1) return index;
        }
        return -1;
    };

    const tendetaiIndex = findIndex(['Tên đề tài', 'tendetai']);
    const hotenhvIndex = findIndex(['Họ tên HV', 'hotenhv']);
    const sohocvienIndex = findIndex(['Số học viên', 'sohocvien']);
    const nguoihuongdanIndex = findIndex(['Người hướng dẫn', 'nguoihuongdan']);
    const tvIndex = findIndex(['TV']);
    
    if (tendetaiIndex === -1 || hotenhvIndex === -1) {
        throw new Error("File dữ liệu phải chứa cột 'Tên đề tài' và 'Họ tên HV'.");
    }

    const reportData: MergedData[] = dataRows.map(row => {
        const rowData: MergedData = {
            tendetai: String(row[tendetaiIndex] || ''),
            hotenhv: String(row[hotenhvIndex] || ''),
            sohocvien: sohocvienIndex !== -1 ? parseInt(String(row[sohocvienIndex] || '0'), 10) : 1,
            nguoihuongdan: nguoihuongdanIndex !== -1 ? String(row[nguoihuongdanIndex] || '') : '',
        };

        if (tvIndex !== -1 && row[tvIndex] !== null && row[tvIndex] !== undefined) {
            const tvVal = String(row[tvIndex]).replace(',', '.');
            rowData.tv = parseFloat(tvVal);
        }

        headers.forEach((header, index) => {
            // header is already normalized here, e.g., 'c1', 'chuong1', 'tile1'
            if (header.match(/^(c|chuong|tile)\d+$/)) {
                if (row[index] !== null && row[index] !== undefined) {
                    const cVal = String(row[index]).replace(',', '.');
                    // We need to store it as c1, c2 etc for the report generator
                    const chapterNum = header.replace(/^(c|chuong|tile)/, '');
                    rowData[`c${chapterNum}`] = parseFloat(cVal);
                }
            }
        });
        
        return rowData;
    });

    return reportData.filter(d => d.tendetai && d.hotenhv);
};


const getConclusionData = (tv: number, projectType: 'ĐATN' | 'BCCĐ', isFirstCheck: boolean): { [key: string]: string } => {
    // Define the full text for each conclusion, which will be sent to the template
    const conclusionTexts = {
        ketluan1: 'Đảm bảo tỉ lệ cho phép, đề nghị Hội đồng đánh giá ĐATN / Cán bộ chấm thi BCCĐ đánh giá và kết luận.',
        ketluan2: 'Tỉ lệ trùng lặp trong khoảng cần xử lý (ĐATN: 25%-35%; BCCĐ: 30%-40%), đề nghị Hội đồng đánh giá ĐATN / Cán bộ chấm thi BCCĐ trừ điểm theo Quy định.',
        ketluan3: 'Vượt tỉ lệ, đề nghị học viên chỉnh sửa trong thời gian 03 ngày (ĐATN) / 02 ngày (BCCĐ) và nộp lại để kiểm tra lần tiếp theo.',
        ketluan4: 'Vượt tỉ lệ tối đa (ĐATN > 35%; BCCĐ > 40%): không được bảo vệ/không được chấm, điểm 0.',
    };

    const conclusions = {
        kl1_box: '☐',
        kl2_box: '☐',
        kl3_box: '☐',
        kl4_box: '☐',
        ...conclusionTexts
    };
    
    const CHECKED_BOX = '☑';

    // Logic to determine which box gets checked
    if (projectType === 'ĐATN') {
        if (tv < 25) {
            conclusions.kl1_box = CHECKED_BOX;
        } else if (tv >= 25 && tv <= 35) {
            if (isFirstCheck) {
                conclusions.kl3_box = CHECKED_BOX;
            } else {
                conclusions.kl2_box = CHECKED_BOX;
            }
        } else if (tv > 35) {
            if (isFirstCheck) {
                conclusions.kl3_box = CHECKED_BOX;
            } else {
                conclusions.kl4_box = CHECKED_BOX;
            }
        }
    } else { // BCCĐ
        if (tv < 30) {
            conclusions.kl1_box = CHECKED_BOX;
        } else if (tv >= 30 && tv <= 40) {
            if (isFirstCheck) {
                conclusions.kl3_box = CHECKED_BOX;
            } else {
                conclusions.kl2_box = CHECKED_BOX;
            }
        } else if (tv > 40) {
             if (isFirstCheck) {
                conclusions.kl3_box = CHECKED_BOX;
            } else {
                conclusions.kl4_box = CHECKED_BOX;
            }
        }
    }

    return conclusions;
};

/**
 * Generates multiple Word reports from a template and merged data.
 */
export const generateWordReports = async (
    mergedData: MergedData[],
    templateFile: File,
    isFirstCheck: boolean,
    projectTypeFromUI: 'ĐATN' | 'BCCĐ'
): Promise<Blob> => {
    const templateBuffer = await templateFile.arrayBuffer();
    const reportsZip = new PizZip();

    // --- Robust Logic for Determining Project Type and File Naming ---
    
    // Step 1: Normalize the filename to handle Vietnamese characters correctly.
    // This is the critical fix. 'ĐATN' becomes 'datn', allowing for a reliable check.
    const normalizedFileName = normalizeString(templateFile.name);

    // Step 2: Determine the effective project type with filename as the highest priority.
    let effectiveProjectType: 'ĐATN' | 'BCCĐ';
    if (normalizedFileName.includes('datn') || normalizedFileName.includes('kltn')) {
        effectiveProjectType = 'ĐATN'; // Priority 1: Filename contains 'datn' or 'kltn'.
    } else if (normalizedFileName.includes('bccd')) { // Note: 'bccđ' becomes 'bccd' after normalization.
        effectiveProjectType = 'BCCĐ'; // Priority 2: Filename contains 'bccd'.
    } else {
        effectiveProjectType = projectTypeFromUI; // Priority 3: Fallback to the UI selection.
    }

    // Step 3: Determine the base name for the output Word files using the same priority system.
    let baseName: string;
    if (normalizedFileName.includes('kltn')) {
        baseName = 'KQ_KLTN';
    } else if (normalizedFileName.includes('datn')) {
        baseName = 'KQ_ĐATN';
    } else if (normalizedFileName.includes('bccd')) {
        baseName = 'KQ_BCCĐ';
    } else {
        // Fallback name is based on the determined effectiveProjectType for consistency.
        baseName = `KQ_${effectiveProjectType}`;
    }
    // --- End of Refactored Logic ---

    for (const [index, row] of mergedData.entries()) {
        const templatePizZip = new PizZip(templateBuffer.slice(0));
        const doc = new Docxtemplater(templatePizZip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        const chapters = [];
        for (const key in row) {
            if (key.startsWith('c') && !isNaN(parseInt(key.substring(1)))) {
                const chapterNum = parseInt(key.substring(1));
                 if (chapterNum > 0) {
                    const value = row[key as keyof MergedData];
                    chapters.push({
                        stt: chapterNum,
                        chuong: `Chương ${chapterNum}`,
                        tyle: typeof value === 'number' ? value.toFixed(2) : '',
                        'ghi chu': '' // Match template placeholder
                    });
                 }
            }
        }
        
        // Step 4: Use the centrally determined 'effectiveProjectType' for the conclusion logic.
        const conclusionData = getConclusionData(row.tv || 0, effectiveProjectType, isFirstCheck);

        const templateData: { [key: string]: any } = {
            hoten_hv: row.hotenhv,
            ten_detai: row.tendetai,
            nguoi_huongdan: row.nguoihuongdan,
            loai_tai_lieu: effectiveProjectType === 'ĐATN' ? 'ĐATN/KLTN' : 'BCCĐ',
            TV: row.tv ? row.tv.toFixed(2) : '0.00',
            chuong_data: chapters.sort((a,b) => a.stt - b.stt),
            ...conclusionData,
        };

        doc.setData(templateData);

        try {
            doc.render();
        } catch (error: any) {
            console.error("Docxtemplater error on row:", row, error);
            if (error.properties && Array.isArray(error.properties.errors)) {
                const explanations = error.properties.errors.map((err: any) => {
                    return err.properties?.explanation || err.message;
                }).join('\n- ');
                const errorMessage = `Lỗi file mẫu Word. Vui lòng kiểm tra lại các placeholder:\n- ${explanations}\n\nLƯU Ý: Placeholder phải dùng dấu ngoặc đơn {placeholder} và không chứa khoảng trắng (ví dụ: dùng {hoten_hv} thay vì {Họ tên HV}). Để bảng tự động thêm dòng, hãy dùng cú pháp lặp {#chuong_data} ... {/chuong_data}.`;
                 throw new Error(errorMessage);
            }
            throw new Error(`Lỗi khi điền dữ liệu cho đề tài: "${row.tendetai}". Vui lòng kiểm tra file mẫu Word.`);
        }

        const out = doc.getZip().generate({
            type: "arraybuffer",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
        
        const fileName = `${baseName}_${index + 1}.docx`;
        reportsZip.file(fileName, out);
    }

    return reportsZip.generate({ type: "blob" });
};
