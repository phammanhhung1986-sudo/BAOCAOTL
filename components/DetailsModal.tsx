
import React from 'react';
import { MergedData } from '../types';
import { DataTable } from './DataTable';
import { X } from 'lucide-react';

interface DetailsModalProps {
    title: string;
    data: MergedData[];
    onClose: () => void;
}

export const DetailsModal: React.FC<DetailsModalProps> = ({ title, data, onClose }) => {
    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-gray-light rounded-2xl shadow-2xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()} // Prevent closing when clicking inside modal
            >
                <header className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">{title}</h2>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                        aria-label="Đóng"
                    >
                        <X size={24} className="text-gray-600" />
                    </button>
                </header>
                <main className="flex-1 p-4 overflow-y-auto">
                    <DataTable data={data} />
                </main>
            </div>
        </div>
    );
};