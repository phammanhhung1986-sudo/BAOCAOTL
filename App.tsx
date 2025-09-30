
import React, { useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { FileUploader } from './components/FileUploader';
import { StatusLog } from './components/StatusLog';
import { DataTable } from './components/DataTable';
import { Dashboard } from './components/Dashboard';
import { DetailsModal } from './components/DetailsModal';
import { generateMergedExcel, generateWordReports, readDataFileForReporting, normalizeString } from './services/fileProcessor';
import { LogEntry, LogType, DashboardStats, MergedData, CategorizedProjects } from './types';
import { DownloadCloud, FileText, Combine, BarChart2, Sheet } from 'lucide-react';
import saveAs from 'file-saver';

type ConclusionCategory = keyof Omit<DashboardStats, 'totalProjects' | 'totalStudents'>;

const getConclusionCategory = (tv: number, projectType: 'ĐATN' | 'BCCĐ', isFirstCheck: boolean): ConclusionCategory => {
    if (projectType === 'ĐATN') {
        if (tv < 25) return 'withinLimit';
        if (tv >= 25 && tv <= 35) return isFirstCheck ? 'l1Edit' : 'l2Process';
        // tv > 35
        return isFirstCheck ? 'l1Edit' : 'l2Exceeded';
    } else { // BCCĐ
        if (tv < 30) return 'withinLimit';
        if (tv >= 30 && tv <= 40) return isFirstCheck ? 'l1Edit' : 'l2Process';
        // tv > 40
        return isFirstCheck ? 'l1Edit' : 'l2Exceeded';
    }
};


const App: React.FC = () => {
    // Files for merging step
    const [mainFile, setMainFile] = useState<File | null>(null);
    const [supplementaryFile, setSupplementaryFile] = useState<File | null>(null);
    
    // Files for report generation step
    const [reportDataFile, setReportDataFile] = useState<File | null>(null);
    const [wordTemplateFile, setWordTemplateFile] = useState<File | null>(null);

    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [mergedData, setMergedData] = useState<MergedData[] | null>(null);
    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
    const [categorizedProjects, setCategorizedProjects] = useState<CategorizedProjects | null>(null);
    const [modalData, setModalData] = useState<{title: string, data: MergedData[]}|null>(null);

    const [isProcessing, setIsProcessing] = useState(false);
    const [activeView, setActiveView] = useState('files');
    const [isFirstCheck, setIsFirstCheck] = useState(true);
    const [projectType, setProjectType] = useState<'ĐATN' | 'BCCĐ'>('ĐATN');
    

    const addLog = useCallback((message: string, type: LogType) => {
        setLogs(prev => [...prev, { message, type, timestamp: new Date() }]);
    }, []);

    const handleMergeExcel = async () => {
        if (!mainFile || !supplementaryFile) {
            addLog("Vui lòng chọn đủ File chính và File bổ sung.", LogType.Error);
            return;
        }

        setIsProcessing(true);
        addLog("Bắt đầu quá trình gộp file Excel/CSV...", LogType.Info);
        try {
            const { data, buffer } = await generateMergedExcel(mainFile, supplementaryFile, (msg, type) => addLog(msg,type));
            setMergedData(data);
            addLog(`Gộp thành công ${data.length} đề tài.`, LogType.Success);
            
            saveAs(new Blob([buffer], { type: "application/octet-stream" }), "File_Gop.xlsx");
            addLog("Đã tải xuống file 'File_Gop.xlsx'.", LogType.Info);
            setActiveView('data');

            // Initialize stats for dashboard
             const stats: DashboardStats = {
                totalProjects: data.length,
                totalStudents: data.reduce((acc, row) => acc + (row['sohocvien'] || 0), 0),
                withinLimit: 0,
                l1Edit: 0,
                l2Process: 0,
                l2Exceeded: 0,
            };
            setDashboardStats(stats);


        } catch (error) {
            console.error(error);
            let errorMessage = "Lỗi không xác định.";
            if (error instanceof Error) {
                // Specific check for file read errors
                if (error.name === 'NotFoundError' || error.message.includes('file could not be read')) {
                    errorMessage = "Không thể đọc được file đã chọn. Vui lòng chọn lại file và thử lại ngay. Lỗi này thường xảy ra nếu file bị di chuyển hoặc trình duyệt mất quyền truy cập sau một thời gian.";
                } else {
                    errorMessage = error.message;
                }
            }
            addLog(`Gộp file thất bại: ${errorMessage}`, LogType.Error);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleGenerateReports = async () => {
        const canGenerate = wordTemplateFile && (!!mergedData || !!reportDataFile || (!!mainFile && !!supplementaryFile));
        if (!canGenerate) {
            addLog("Vui lòng cung cấp file mẫu Word và nguồn dữ liệu (file gộp hoặc các file đầu vào).", LogType.Error);
            return;
        }

        setIsProcessing(true);
        try {
            let dataForReport: MergedData[] | null = null;

            // Priority 1: Use the explicitly selected "File Dữ liệu"
            if (reportDataFile) {
                addLog("Đọc file dữ liệu được chọn...", LogType.Info);
                dataForReport = await readDataFileForReporting(reportDataFile);
                addLog(`Đọc thành công ${dataForReport.length} đề tài từ file dữ liệu.`, LogType.Success);
            } 
            // Priority 2: Use data from a previous merge operation if no specific data file is selected
            else if (mergedData) {
                addLog("Sử dụng dữ liệu đã gộp từ Bước 1.", LogType.Info);
                dataForReport = mergedData;
            } 
            // Priority 3: Generate data on-the-fly from Step 1 inputs if nothing else is available
            else if (mainFile && supplementaryFile) {
                addLog("Chưa có dữ liệu, tự động gộp file từ Bước 1...", LogType.Info);
                const { data } = await generateMergedExcel(mainFile, supplementaryFile, addLog);
                dataForReport = data;
                addLog(`Gộp tự động thành công ${data.length} đề tài.`, LogType.Success);
            }

            if (!dataForReport || dataForReport.length === 0) {
                addLog("Không tìm thấy dữ liệu hợp lệ để sinh báo cáo.", LogType.Warning);
                setIsProcessing(false);
                return;
            }
            
            if (!wordTemplateFile) { // Should be captured by canGenerate but for type safety
                 addLog("Lỗi: File mẫu Word không được chọn.", LogType.Error);
                 setIsProcessing(false);
                 return;
            }
            
            // Update state so the UI reflects the data used (e.g., data table)
            if (dataForReport !== mergedData) {
                setMergedData(dataForReport);
            }

            addLog(`Bắt đầu sinh ${dataForReport.length} báo cáo Word...`, LogType.Info);
            const zipBlob = await generateWordReports(dataForReport, wordTemplateFile, isFirstCheck, projectType);
            addLog(`Sinh báo cáo thành công.`, LogType.Success);
            
            saveAs(zipBlob, "Cac_Bao_Cao.zip");
            addLog("Đã tải xuống file 'Cac_Bao_Cao.zip'.", LogType.Info);

            // --- Post-generation Statistics Calculation ---
            addLog("Đang tính toán thống kê chi tiết...", LogType.Info);
            const normalizedFileName = normalizeString(wordTemplateFile.name);
            let effectiveProjectType: 'ĐATN' | 'BCCĐ';
            if (normalizedFileName.includes('datn') || normalizedFileName.includes('kltn')) {
                effectiveProjectType = 'ĐATN';
            } else if (normalizedFileName.includes('bccd')) {
                effectiveProjectType = 'BCCĐ';
            } else {
                effectiveProjectType = projectType;
            }
            
            const newStats: DashboardStats = {
                totalProjects: dataForReport.length,
                totalStudents: dataForReport.reduce((acc, row) => acc + (row['sohocvien'] || 0), 0),
                withinLimit: 0,
                l1Edit: 0,
                l2Process: 0,
                l2Exceeded: 0,
            };

            const newCategorizedProjects: CategorizedProjects = {
                withinLimit: [],
                l1Edit: [],
                l2Process: [],
                l2Exceeded: [],
            };

            for (const row of dataForReport) {
                const category = getConclusionCategory(row.tv || 0, effectiveProjectType, isFirstCheck);
                newStats[category]++;
                newCategorizedProjects[category].push(row);
            }
            
            setDashboardStats(newStats);
            setCategorizedProjects(newCategorizedProjects);
            addLog("Cập nhật thống kê thành công.", LogType.Success);
            setActiveView('stats');


        } catch (error) {
            console.error(error);
            let errorMessage = "Lỗi không xác định.";
             if (error instanceof Error) {
                // Specific check for file read errors
                if (error.name === 'NotFoundError' || error.message.includes('file could not be read')) {
                     errorMessage = "Không thể đọc được file đã chọn. Vui lòng chọn lại file và thử lại ngay. Lỗi này thường xảy ra nếu file bị di chuyển hoặc trình duyệt mất quyền truy cập sau một thời gian.";
                } else {
                    errorMessage = error.message;
                }
            }
            addLog(`Xử lý thất bại: ${errorMessage}`, LogType.Error);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleStatClick = (category: ConclusionCategory) => {
        if (!categorizedProjects) return;

        const categoryTitles: Record<ConclusionCategory, string> = {
            withinLimit: 'Đề tài Đảm bảo Tỉ lệ',
            l1Edit: 'Đề tài Cần Chỉnh sửa (L1)',
            l2Process: 'Đề tài Cần Xử lý (L2)',
            l2Exceeded: 'Đề tài Vượt Tỉ lệ Tối đa (L2)',
        };

        const data = categorizedProjects[category];
        const title = categoryTitles[category];

        if (data && data.length > 0) {
            setModalData({ title, data });
        } else {
            addLog(`Không có đề tài nào trong mục: ${title}`, LogType.Info);
        }
    };


    const renderContent = () => {
        switch (activeView) {
            case 'stats':
                return dashboardStats ? <Dashboard stats={dashboardStats} onStatClick={handleStatClick} /> : <div className="text-center text-gray-500 mt-10">Chưa có dữ liệu để thống kê. Vui lòng gộp file Excel trước.</div>;
            case 'data':
                return mergedData ? <DataTable data={mergedData} /> : <div className="text-center text-gray-500 mt-10">Chưa có dữ liệu. Vui lòng gộp file Excel.</div>;
            case 'files':
            default:
                return (
                     <div className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-700 mb-4 border-b-2 border-blue-500 pb-2">Bước 1 (Tùy chọn): Gộp và Tải File Excel</h2>
                            <p className="text-gray-600 mb-4">Cung cấp file chính và file bổ sung. Nhấn nút "Tạo Gộp Excel" nếu bạn muốn tải xuống file gộp trung gian.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FileUploader icon={<FileText size={48} className="text-blue-500"/>} title="File chính" onFileSelect={setMainFile} acceptedTypes=".xlsx, .xls, .csv" file={mainFile} />
                                <FileUploader icon={<Combine size={48} className="text-purple-500"/>} title="File bổ sung" onFileSelect={setSupplementaryFile} acceptedTypes=".xlsx, .xls, .csv" file={supplementaryFile} />
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-gray-700 mb-4 border-b-2 border-purple-500 pb-2">Bước 2: Sinh Báo Cáo Word</h2>
                            <p className="text-gray-600 mb-4">Cung cấp file mẫu Word. Ứng dụng sẽ tự động sử dụng dữ liệu từ Bước 1 hoặc từ "File Dữ liệu" nếu được cung cấp.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                               <FileUploader icon={<Sheet size={48} className="text-teal-500"/>} title="File Dữ liệu (Nếu có sẵn)" onFileSelect={setReportDataFile} acceptedTypes=".xlsx, .xls, .csv" file={reportDataFile} />
                               <FileUploader icon={<DownloadCloud size={48} className="text-green-500"/>} title="File Word mẫu" onFileSelect={setWordTemplateFile} acceptedTypes=".docx" file={wordTemplateFile} />
                            </div>
                            <div className="bg-white mt-6 p-6 rounded-2xl shadow-lg border border-gray-100 space-y-6">
                                <h3 className="text-lg font-bold text-gray-700">Tùy chọn Sinh Báo cáo</h3>
                                
                                {/* Core Option */}
                                <div className="flex items-center space-x-3">
                                    <span className="font-semibold text-gray-600">Lần kiểm tra:</span>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="checkbox" checked={isFirstCheck} onChange={(e) => setIsFirstCheck(e.target.checked)} className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500" />
                                        <span>Lần đầu</span>
                                    </label>
                                </div>

                                {/* Fallback Option */}
                                <div className="pt-4 border-t border-gray-200">
                                    <div className="flex items-center space-x-3">
                                        <span className="font-semibold text-gray-600">Loại tài liệu (dự phòng):</span>
                                        <select value={projectType} onChange={(e) => setProjectType(e.target.value as 'ĐATN' | 'BCCĐ')} className="p-2 border rounded-md focus:ring-2 focus:ring-blue-500 transition">
                                            <option value="ĐATN">ĐATN/KLTN</option>
                                            <option value="BCCĐ">BCCĐ</option>
                                        </select>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 pl-1">
                                        Chỉ sử dụng khi tên file Word mẫu không chứa "ĐATN", "KLTN", hay "BCCĐ".
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
        }
    };
    
    const canGenerateReports = wordTemplateFile && (!!mergedData || !!reportDataFile || (!!mainFile && !!supplementaryFile));

    return (
        <div className="flex h-screen bg-gray-50 font-sans">
            <Sidebar activeView={activeView} setActiveView={setActiveView} />
            <main className="flex-1 flex flex-col p-8 overflow-hidden">
                <header className="mb-8">
                    <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Báo cáo Pro</h1>
                    <p className="text-gray-500">Tự động hóa quy trình gộp file và sinh báo cáo</p>
                </header>
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
                    <div className="lg:col-span-2 flex flex-col overflow-y-auto pr-4">
                        {renderContent()}
                    </div>
                    <div className="lg:col-span-1 flex flex-col space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex flex-col space-y-4">
                            <h2 className="text-xl font-bold text-gray-800">Bảng điều khiển</h2>
                            <button
                                onClick={handleMergeExcel}
                                disabled={isProcessing || !mainFile || !supplementaryFile}
                                className="w-full flex items-center justify-center text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all duration-300 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                            >
                                <BarChart2 className="mr-2" />
                                {isProcessing ? 'Đang xử lý...' : '1. Tạo Gộp Excel'}
                            </button>
                             <button
                                onClick={handleGenerateReports}
                                disabled={isProcessing || !canGenerateReports}
                                className="w-full flex items-center justify-center text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all duration-300 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                            >
                                <FileText className="mr-2" />
                                {isProcessing ? 'Đang xử lý...' : '2. Sinh Báo cáo'}
                            </button>
                        </div>
                        <StatusLog logs={logs} />
                    </div>
                </div>
            </main>
             {modalData && (
                <DetailsModal 
                    title={modalData.title}
                    data={modalData.data}
                    onClose={() => setModalData(null)}
                />
            )}
        </div>
    );
};

export default App;
