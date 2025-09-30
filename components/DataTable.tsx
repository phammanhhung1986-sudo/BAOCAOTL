import React from 'react';

interface DataTableProps {
    data: Record<string, any>[];
}

export const DataTable: React.FC<DataTableProps> = ({ data }) => {
    if (!data || data.length === 0) {
        return <div className="text-center p-8 text-gray-500">Không có dữ liệu để hiển thị.</div>;
    }

    // Robust header detection: scan all rows to find all possible columns.
    // This prevents columns from being missed if they aren't present in the first row.
    const allHeadersSet = new Set<string>();
    data.forEach(row => {
        Object.keys(row).forEach(key => allHeadersSet.add(key));
    });
    const allHeaders = Array.from(allHeadersSet);

    // Advanced header sorting logic
    const chapterHeaders = allHeaders
        .filter(h => h.startsWith('c') && !isNaN(parseInt(h.substring(1))))
        .sort((a, b) => parseInt(a.substring(1)) - parseInt(b.substring(1)));
        
    const standardHeaders = allHeaders.filter(h => !chapterHeaders.includes(h));

    // Define a preferred order for standard headers
    const preferredOrder = ['tendetai', 'hotenhv', 'sohocvien', 'nguoihuongdan', 'tv'];
    standardHeaders.sort((a, b) => {
        const indexA = preferredOrder.indexOf(a.toLowerCase());
        const indexB = preferredOrder.indexOf(b.toLowerCase());
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    const headers = [...standardHeaders, ...chapterHeaders];

    const headerDisplayNames: { [key: string]: string } = {
        tendetai: 'Tên đề tài',
        hotenhv: 'Họ tên HV',
        sohocvien: 'Số HV',
        nguoihuongdan: 'Người hướng dẫn',
        tv: 'TV',
    }

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 animate-fade-in">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Dữ liệu đã gộp</h2>
            <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-sm text-left text-gray-600">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0">
                        <tr>
                            {headers.map((header) => (
                                <th key={header} scope="col" className="px-6 py-3 whitespace-nowrap">
                                    {headerDisplayNames[header.toLowerCase()] || header.toUpperCase()}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, rowIndex) => (
                            <tr key={rowIndex} className="bg-white border-b hover:bg-blue-50 transition-colors">
                                {headers.map((header, colIndex) => (
                                    <td key={`${rowIndex}-${colIndex}`} className="px-6 py-4 whitespace-nowrap">
                                        {typeof row[header] === 'number' ? row[header].toFixed(2) : row[header]}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
