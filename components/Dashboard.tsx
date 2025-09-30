
import React from 'react';
import { Book, Users, AlertCircle, ShieldX, Edit, ShieldCheck } from 'lucide-react';
import { DashboardStats } from '../types';

type StatCategory = keyof Omit<DashboardStats, 'totalProjects' | 'totalStudents'>;

interface StatCardProps {
    icon: React.ReactNode;
    title: string;
    value: number;
    color: string;
    onClick?: () => void;
    isClickable: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon, title, value, color, onClick, isClickable }) => {
    const commonClasses = `p-6 rounded-2xl shadow-lg border flex items-start space-x-4 transition-all`;
    const clickableClasses = isClickable ? `transform hover:scale-105 hover:shadow-2xl cursor-pointer` : '';
    
    const Wrapper = isClickable ? 'button' : 'div';
    
    return (
        <Wrapper
            onClick={onClick}
            className={`${commonClasses} ${color} ${clickableClasses} ${isClickable ? '' : 'cursor-default'}`}
            disabled={!isClickable}
        >
            <div className="text-4xl">{icon}</div>
            <div>
                <p className="text-lg font-semibold">{title}</p>
                <p className="text-3xl font-bold">{value}</p>
            </div>
        </Wrapper>
    );
};

export const Dashboard: React.FC<{ stats: DashboardStats, onStatClick: (category: StatCategory) => void }> = ({ stats, onStatClick }) => {
    return (
        <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard
                icon={<Book />}
                title="Tổng số đề tài"
                value={stats.totalProjects}
                color="bg-blue-100 text-blue-800 border-blue-200"
                isClickable={false}
            />
            <StatCard
                icon={<Users />}
                title="Tổng số học viên"
                value={stats.totalStudents}
                color="bg-green-100 text-green-800 border-green-200"
                isClickable={false}
            />
            <StatCard
                icon={<ShieldCheck />}
                title="Đảm bảo tỉ lệ"
                value={stats.withinLimit}
                color="bg-cyan-100 text-cyan-800 border-cyan-200"
                onClick={() => onStatClick('withinLimit')}
                isClickable={true}
            />
            <StatCard
                icon={<Edit />}
                title="Cần chỉnh sửa (L1)"
                value={stats.l1Edit}
                color="bg-yellow-100 text-yellow-800 border-yellow-200"
                onClick={() => onStatClick('l1Edit')}
                isClickable={true}
            />
            <StatCard
                icon={<AlertCircle />}
                title="Cần xử lý (L2)"
                value={stats.l2Process}
                color="bg-orange-100 text-orange-800 border-orange-200"
                onClick={() => onStatClick('l2Process')}
                isClickable={true}
            />
            <StatCard
                icon={<ShieldX />}
                title="Vượt tối đa (L2)"
                value={stats.l2Exceeded}
                color="bg-red-100 text-red-800 border-red-200"
                onClick={() => onStatClick('l2Exceeded')}
                isClickable={true}
            />
        </div>
    );
};
