// TypeScript type definitions for the attendance tracking system

export interface Member {
    id: string;
    name: string;
    role: "leader" | "member" | "new";
    joinDate: Date;
    careNotes?: string;
    intro?: string;
    phone?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface AttendanceRecord {
    memberId: string;
    memberName: string;
    present: boolean;
    prayerRequest?: string;
    careNote?: string;
}

export interface NewVisitor {
    name: string;
    phone?: string;
    notes?: string;
}

export interface WeeklyMeeting {
    id: string;
    date: Date;
    attendance: AttendanceRecord[];
    newVisitors: NewVisitor[];
    totalAttendance: number;
    notes?: string;
    type?: "normal" | "holiday" | "special";
    createdBy: string;
    createdAt: Date;
}

export interface AttendanceStats {
    memberId: string;
    memberName: string;
    totalMeetings: number;
    attendedMeetings: number;
    attendanceRate: number;
    consecutiveAbsences: number;
    needsCare: boolean;
}
