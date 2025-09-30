
export enum LogType {
    Info = 'INFO',
    Success = 'SUCCESS',
    Warning = 'WARNING',
    Error = 'ERROR',
}

export interface LogEntry {
    message: string;
    type: LogType;
    timestamp: Date;
}

export interface DashboardStats {
    totalProjects: number;
    totalStudents: number;
    withinLimit: number; // Đảm bảo tỉ lệ cho phép
    l1Edit: number; // Vượt tỉ lệ, cần chỉnh sửa (Lần 1)
    l2Process: number; // Tỉ lệ cần xử lý (Lần 2)
    l2Exceeded: number; // Vượt tỉ lệ tối đa (Lần 2)
}

export interface MergedData {
  [key: string]: string | number | undefined;
  hotenhv: string;
  tendetai: string;
  sohocvien: number;
  nguoihuongdan?: string;
  tv?: number;
}

// Defines a structure to hold arrays of projects, categorized by their processing status.
export type CategorizedProjects = {
    [key in keyof Omit<DashboardStats, 'totalProjects' | 'totalStudents'>]: MergedData[]
};
