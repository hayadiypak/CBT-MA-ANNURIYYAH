export interface Student {
  id: string;
  username: string;
  name: string;
  nisn: string;
  gender: 'Laki-laki' | 'Perempuan';
  classGroup: string;
  password?: string;
}

export interface Question {
  id: string;
  text: string;
  options: {
    letter: 'A' | 'B' | 'C' | 'D' | 'E';
    text: string;
  }[];
  correctAnswer: 'A' | 'B' | 'C' | 'D' | 'E';
  type?: 'mc' | 'essay';
}

export interface Exam {
  id: string;
  text?: string;
  title: string;
  subject: string;
  durationMinutes: number;
  token: string;
  questions: Question[];
  isActive: boolean;
  targetClass?: string;
}

export interface StudentAnswer {
  selectedOption: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  isDoubtful: boolean;
  essayAnswer?: string;
}

export interface ActiveSession {
  id: string;
  studentId: string;
  examId: string;
  startTime: number;
  answers: Record<string, StudentAnswer>; // questionId -> StudentAnswer
  isCompleted: boolean;
  completedTime?: number;
  score?: number;
  studentName?: string;
  studentNisn?: string;
  classGroup?: string;
  examTitle?: string;
  examSubject?: string;
  timeLeft?: number;
  totalQuestions?: number;
  answeredCount?: number;
  unansweredCount?: number;
  doubtfulCount?: number;
  lastActive?: number;
  status?: 'working' | 'force_submitted' | 'paused' | 'cheat_submitted';
  violationsCount?: number;
  deviceSessionId?: string;
}

export interface ExamResult {
  id: string;
  studentId: string;
  studentName: string;
  studentNisn: string;
  classGroup: string;
  examId: string;
  examTitle: string;
  examSubject: string;
  totalQuestions: number;
  correctCount: number;
  score: number;
  completedTime: number;
  violationsCount?: number;
  essayAnswers?: Record<string, string>;
}

export interface Teacher {
  id: string;
  username: string;
  name: string;
  password?: string;
  role: 'admin' | 'proctor';
}

