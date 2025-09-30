
import React from 'react';
import { FileUp, Combine, BarChart3, Settings } from 'lucide-react';

interface SidebarProps {
    activeView: string;
    setActiveView: (view: string) => void;
}

const NavItem: React.FC<{ icon: React.ReactNode; label: string; isActive: boolean; onClick: () => void; }> = ({ icon, label, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center w-full p-4 rounded-xl transition-all duration-300 ${
                isActive ? 'bg-white/20 shadow-lg' : 'hover:bg-white/10'
            }`}
        >
            <div className="text-white">{icon}</div>
            <span className="text-xs text-white mt-1">{label}</span>
        </button>
    );
};

export const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView }) => {
    return (
        <aside className="w-24 bg-gradient-to-b from-blue-700 to-purple-800 p-4 flex flex-col items-center space-y-6">
            <div className="text-white text-2xl font-bold">B.P</div>
            <nav className="w-full space-y-4">
                <NavItem 
                    icon={<FileUp size={28} />} 
                    label="Chọn Files" 
                    isActive={activeView === 'files'}
                    onClick={() => setActiveView('files')}
                />
                <NavItem 
                    icon={<Combine size={28} />} 
                    label="Dữ liệu gộp" 
                    isActive={activeView === 'data'}
                    onClick={() => setActiveView('data')}
                />
                <NavItem 
                    icon={<BarChart3 size={28} />} 
                    label="Thống kê" 
                    isActive={activeView === 'stats'}
                    onClick={() => setActiveView('stats')}
                />
            </nav>
            <div className="mt-auto">
                 <NavItem 
                    icon={<Settings size={28} />} 
                    label="Cài đặt" 
                    isActive={activeView === 'settings'}
                    onClick={() => setActiveView('settings')}
                />
            </div>
        </aside>
    );
};
