
import React from 'react';
import { LogEntry, LogType } from '../types';
import { CheckCircle, Info, AlertTriangle, XCircle } from 'lucide-react';

const logConfig = {
    [LogType.Success]: {
        icon: <CheckCircle className="text-green-500" />,
        color: 'text-green-600',
    },
    [LogType.Info]: {
        icon: <Info className="text-blue-500" />,
        color: 'text-blue-600',
    },
    [LogType.Warning]: {
        icon: <AlertTriangle className="text-yellow-500" />,
        color: 'text-yellow-600',
    },
    [LogType.Error]: {
        icon: <XCircle className="text-red-500" />,
        color: 'text-red-600',
    },
};

export const StatusLog: React.FC<{ logs: LogEntry[] }> = ({ logs }) => {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex-1 flex flex-col">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Nhật ký hoạt động</h2>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400">
                        <p>Chưa có hoạt động nào.</p>
                    </div>
                ) : (
                    [...logs].reverse().map((log, index) => (
                        <div key={index} className="flex items-start space-x-3 animate-fade-in">
                            <div className="flex-shrink-0 pt-1">
                                {logConfig[log.type].icon}
                            </div>
                            <div>
                                <p className={`text-sm font-medium ${logConfig[log.type].color}`}>
                                    {log.message}
                                </p>
                                <p className="text-xs text-gray-400">
                                    {log.timestamp.toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
