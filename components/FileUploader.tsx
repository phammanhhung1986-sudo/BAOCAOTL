
import React, { useRef, useState } from 'react';

interface FileUploaderProps {
    icon: React.ReactNode;
    title: string;
    onFileSelect: (file: File | null) => void;
    acceptedTypes: string;
    file: File | null;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ icon, title, onFileSelect, acceptedTypes, file }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileSelect(e.target.files[0]);
        }
    };

    const handleButtonClick = () => {
        inputRef.current?.click();
    };
    
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };
    
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFileSelect(e.dataTransfer.files[0]);
        }
    };


    const cardClasses = `relative bg-white rounded-2xl p-6 text-center flex flex-col items-center justify-center space-y-4 border transition-all duration-300 cursor-pointer ${isDragOver ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200'} shadow-md hover:shadow-xl`;

    return (
        <div 
          className={cardClasses} 
          onClick={handleButtonClick}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
            <input
                type="file"
                ref={inputRef}
                onChange={handleFileChange}
                accept={acceptedTypes}
                className="hidden"
            />
            <div className="w-16 h-16 flex items-center justify-center rounded-full bg-gray-100 mb-2">
                {icon}
            </div>
            <h3 className="text-lg font-bold text-gray-700">{title}</h3>
            {file ? (
                <p className="text-sm text-green-600 font-medium break-all">{file.name}</p>
            ) : (
                <p className="text-sm text-gray-500">Kéo thả hoặc nhấn để chọn file</p>
            )}
        </div>
    );
};
