import { useState, useEffect, FormEvent, ChangeEvent, DragEvent } from 'react';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import {
  Users,
  BookOpen,
  Award,
  Plus,
  Trash2,
  Edit,
  RotateCw,
  Eye,
  Settings,
  CheckCircle,
  XCircle,
  TrendingUp,
  Sliders,
  LogOut,
  Sparkles,
  ChevronRight,
  ClipboardList,
  AlertCircle,
  Upload,
  FileText,
  HelpCircle,
  Radio,
  Activity,
  ShieldAlert,
  Laptop,
  Clock,
  Monitor,
  Smartphone,
  Wifi,
  Network,
  Download
} from 'lucide-react';
import { Student, Exam, ExamResult, Question, Teacher, ActiveSession } from '../types';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
// @ts-ignore
import logoImg from '../assets/images/ma_logo_clean_1780675707006.png';

// Helper function to check if a question is an essay question (with robust fallback checking)
const isQuestionEssay = (q: any): boolean => {
  if (!q) return false;
  if (q.type === 'essay') return true;
  if (!q.options || q.options.length === 0) return true;
  
  const hasNoRealOptions = q.options.every((opt: any) => 
    !opt.text || 
    opt.text.trim() === '' || 
    opt.text.trim() === '-' || 
    opt.text.trim().toLowerCase() === 'kosong'
  );
  if (hasNoRealOptions) return true;

  const mcOptionsCount = q.options.filter((opt: any) => opt.text && opt.text.trim() !== '-' && opt.text.trim() !== '').length;
  if (mcOptionsCount <= 1) {
    return true;
  }

  return false;
};

// Robust parser that handles Word-style Plain Text, Excel Semicolon/Tab/Comma CSVs, and standard JSON
const parseMasalText = (text: string, fileName?: string): Question[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // 1. Check if it's JSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{') || (fileName && fileName.toLowerCase().endsWith('.json'))) {
    try {
      const raw = JSON.parse(trimmed);
      const items = Array.isArray(raw) ? raw : [raw];
      return items.map((item: any, idx: number) => {
        if (!item.text) {
          throw new Error(`Soal #${idx + 1} tidak memiliki teks.`);
        }
        const options = item.options || [];
        const isEssay = item.type === 'essay' || (!item.A && !item.optionA && options.length === 0);
        const qItem: Question = {
          id: `q_uploaded_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
          text: item.text,
          correctAnswer: (item.correctAnswer || item.kunci || 'A').toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E',
          type: (isEssay ? 'essay' : 'mc') as 'essay' | 'mc',
          options: isEssay ? [] : [
            { letter: 'A' as const, text: options.find((o: any) => o.letter === 'A')?.text || item.A || item.optionA || '-' },
            { letter: 'B' as const, text: options.find((o: any) => o.letter === 'B')?.text || item.B || item.optionB || '-' },
            { letter: 'C' as const, text: options.find((o: any) => o.letter === 'C')?.text || item.C || item.optionC || '-' },
            { letter: 'D' as const, text: options.find((o: any) => o.letter === 'D')?.text || item.D || item.optionD || '-' },
            { letter: 'E' as const, text: options.find((o: any) => o.letter === 'E')?.text || item.E || item.optionE || '-' }
          ]
        };
        return qItem;
      });
    } catch (e: any) {
      // If JSON fails, let's fall through to plaintext parsing
    }
  }

  // 2. Split into lines
  const lines = trimmed.split('\n');
  let isDelimiterCSV = false;
  let delimiter = ';';

  // Sample the first 5 lines to check if it's a spreadsheet format (Semicolon, Tab, or Comma CSV)
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.split(';').length >= 4) {
      isDelimiterCSV = true;
      delimiter = ';';
      break;
    }
    if (line.split('\t').length >= 3) {
      isDelimiterCSV = true;
      delimiter = '\t';
      break;
    }
    if (line.split(',').length >= 4) {
      isDelimiterCSV = true;
      delimiter = ',';
      break;
    }
  }

  // A. EXCEL/CSV Parser
  if (isDelimiterCSV) {
    return lines
      .map((line, idx) => {
        const cleanLine = line.trim();
        if (!cleanLine) return null;
        
        const parts = cleanLine.split(delimiter);
        if (parts.length < 2) {
          return null; // Skip invalid lines safely
        }

        const text = parts[0].replace(/^[\"\']|[\"\']$/g, '').trim(); // strip outer quotes if any
        
        // Determine if it is an Essay question in the CSV (e.g. no choice columns are filled)
        const hasA = parts[1] && parts[1].replace(/^[\"\']|[\"\']$/g, '').trim() !== '';
        const hasB = parts[2] && parts[2].replace(/^[\"\']|[\"\']$/g, '').trim() !== '';
        const hasC = parts[3] && parts[3].replace(/^[\"\']|[\"\']$/g, '').trim() !== '';
        const isEssay = !hasA && !hasB && !hasC;

        const a = (parts[1] || '').replace(/^[\"\']|[\"\']$/g, '').trim();
        const b = (parts[2] || '').replace(/^[\"\']|[\"\']$/g, '').trim();
        const c = (parts[3] || '').replace(/^[\"\']|[\"\']$/g, '').trim();
        const d = (parts[4] || '-').replace(/^[\"\']|[\"\']$/g, '').trim();
        const e = (parts[5] || '-').replace(/^[\"\']|[\"\']$/g, '').trim();
        
        let correct = 'A';
        if (parts.length >= 7) {
          correct = parts[6].replace(/^[\"\']|[\"\']$/g, '').trim().toUpperCase();
        } else {
          // Fallback check if the last element is just a letter representing correct key
          const lastPart = parts[parts.length - 1].replace(/^[\"\']|[\"\']$/g, '').trim().toUpperCase();
          if (['A', 'B', 'C', 'D', 'E'].includes(lastPart)) {
            correct = lastPart;
          }
        }

        if (!['A', 'B', 'C', 'D', 'E'].includes(correct)) {
          correct = 'A';
        }

        const qItem: Question = {
          id: `q_uploaded_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
          text,
          correctAnswer: correct as 'A' | 'B' | 'C' | 'D' | 'E',
          type: (isEssay ? 'essay' : 'mc') as 'essay' | 'mc',
          options: isEssay ? [] : [
            { letter: 'A' as const, text: a },
            { letter: 'B' as const, text: b },
            { letter: 'C' as const, text: c },
            { letter: 'D' as const, text: d },
            { letter: 'E' as const, text: e }
          ]
        };
        return qItem;
      })
      .filter((q): q is Question => q !== null);
  }

  // B. COOPERATIVE WORD / NOTEPAD Plain Text Document Parser (Flexible Block Parser)
  const questions: Question[] = [];
  let currentText: string[] = [];
  let currentOptions: { letter: string; text: string }[] = [];
  let currentCorrect: string = '';

  const saveCurrent = () => {
    const qText = currentText.join('\n').trim();
    if (qText) {
      // If there are no choice options detected, it's an essay (uraian) question!
      const isEssay = currentOptions.length === 0;

      const paddedOptions: { letter: 'A' | 'B' | 'C' | 'D' | 'E'; text: string; }[] = isEssay ? [] : [
        { letter: 'A', text: currentOptions.find((o) => o.letter === 'A')?.text || '-' },
        { letter: 'B', text: currentOptions.find((o) => o.letter === 'B')?.text || '-' },
        { letter: 'C', text: currentOptions.find((o) => o.letter === 'C')?.text || '-' },
        { letter: 'D', text: currentOptions.find((o) => o.letter === 'D')?.text || '-' },
        { letter: 'E', text: currentOptions.find((o) => o.letter === 'E')?.text || '-' }
      ];
      let correct = currentCorrect.trim().toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E';
      if (!['A', 'B', 'C', 'D', 'E'].includes(correct)) {
        correct = 'A'; // Defaults to A if no answer key matched
      }
      questions.push({
        id: `q_uploaded_${Date.now()}_${questions.length}_${Math.random().toString(36).substring(2, 5)}`,
        text: qText,
        correctAnswer: correct,
        type: isEssay ? 'essay' : 'mc',
        options: paddedOptions
      });
    }
    currentText = [];
    currentOptions = [];
    currentCorrect = '';
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const optionMatch = line.match(/^([A-Ea-e])[\s\.\:\-\)]+(.*)$/);
    const keyMatch = line.match(/^(kunci|kunci jawaban|jawaban|answer|key|kunci_jawaban)[\s\:\-\=\.]*([A-Ea-e])$/i);

    if (keyMatch) {
      currentCorrect = keyMatch[2].toUpperCase();
      saveCurrent();
    } else if (optionMatch) {
      const letter = optionMatch[1].toUpperCase();
      const optText = optionMatch[2].trim();
      currentOptions.push({ letter, text: optText });
    } else {
      // If we see a new question start, save the previous accumulated block
      const isNewQuestionStart = line.match(/^(\d+[\.\)\-\s]+|soal[\s\:\-\d]*)/i);
      if (isNewQuestionStart && currentText.length > 0) {
        saveCurrent();
      }

      // Remove numbers or helper indicators
      const cleanTextLine = line.replace(/^(\d+[\.\)\-\s]+|soal[\s\:\-\d]*)/i, '').trim();
      if (cleanTextLine) {
        currentText.push(cleanTextLine);
      }
    }
  }
  
  // Save trailing block
  saveCurrent();

  return questions;
};

interface TeacherDashboardProps {
  students: Student[];
  exams: Exam[];
  results: ExamResult[];
  teachers: Teacher[];
  activeSessions?: ActiveSession[];
  currentUserRole: 'admin' | 'proctor';
  currentTeacherName: string;
  onLogout: () => void;
  onUpdateStudents: (newStudents: Student[]) => void;
  onUpdateExams: (newExams: Exam[]) => void;
  onUpdateResults: (newResults: ExamResult[]) => void;
  onUpdateTeachers: (newTeachers: Teacher[]) => void;
  examMode?: 'online' | 'offline';
  onToggleExamMode?: (mode: 'online' | 'offline') => void;
}

type TabType = 'overview' | 'students' | 'exams' | 'tokens' | 'results' | 'teachers' | 'monitoring';

export default function TeacherDashboard({
  students,
  exams,
  results,
  teachers = [],
  activeSessions = [],
  currentUserRole = 'admin',
  currentTeacherName = 'Guru Utama',
  onLogout,
  onUpdateStudents,
  onUpdateExams,
  onUpdateResults,
  onUpdateTeachers,
  examMode = 'online',
  onToggleExamMode
}: TeacherDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [liveReviewSession, setLiveReviewSession] = useState<ActiveSession | null>(null);
  const [showTechnicianGuide, setShowTechnicianGuide] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'skema' | 'pc' | 'hp' | 'usb' | 'troubleshoot'>('skema');

  // Parse and merge student offline result files (.json)
  const handleImportOfflineFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let importedCount = 0;
    let failedCount = 0;
    const newResults = [...results];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (data._type === 'cbt_offline_result_verification' && data.resultId) {
          const expectedSignature = btoa(`${data.resultId}:${data.score}:${data.nisn}:${data.correctCount || 0}`);
          if (data.signature !== expectedSignature) {
            console.warn(`Peringatan Tanda Pengenal Tidak Valid untuk file: ${file.name}`);
          }

          const newResObj: ExamResult = {
            id: data.resultId,
            studentId: data.studentId,
            studentName: data.studentName,
            studentNisn: data.nisn || '',
            classGroup: data.classGroup || '',
            examId: data.examId,
            examTitle: data.examTitle,
            examSubject: data.examSubject || 'Lainnya',
            totalQuestions: Number(data.totalQuestions || 0),
            score: Number(data.score),
            correctCount: Number(data.correctCount || 0),
            violationsCount: Number(data.violationsCount || 0),
            completedTime: Number(data.completedTime || Date.now())
          };

          const existsIdx = newResults.findIndex(r => r.id === newResObj.id);
          if (existsIdx >= 0) {
            newResults[existsIdx] = newResObj;
          } else {
            newResults.push(newResObj);
          }
          importedCount++;
        } else {
          failedCount++;
        }
      } catch (err) {
        console.error('Gagal memproses berkas:', err);
        failedCount++;
      }
    }

    if (importedCount > 0) {
      onUpdateResults(newResults);
      alert(`Berhasil mengimpor ${importedCount} hasil ujian siswa offline! ${failedCount > 0 ? `Gagal memproses ${failedCount} file.` : ''}`);
    } else {
      alert('Tidak ada file hasil ujian offline valid yang ditemukan.');
    }
    e.target.value = '';
  };

  // Full local database backup export
  const handleBackupComputerDatabase = () => {
    const data = {
      _type: 'cbt_full_database_backup',
      exportedAt: new Date().toISOString(),
      results: results,
      students: students,
      exams: exams
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `BACKUP_DATABASE_CBT_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const uniqueClasses = Array.from(new Set(students.map((s) => s.classGroup))).filter(Boolean).sort();

  const handleDownloadDocxTemplate = async () => {
    try {
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "=== TEMPLATE / PANDUAN MENULIS SOAL DI MICROSOFT WORD ===",
                    bold: true,
                    size: 28,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Silakan edit file Word (.docx) ini untuk mempersiapkan soal ujian Anda.",
                    italics: true,
                    size: 20,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Ketik teks soal secara alami. Untuk Pilihan Ganda: ikuti dengan unsur A, B, C, D, E dan baris Kunci. Untuk Soal Esai: Cukup ketik pertanyaan soal saja tanpa opsi ataupun baris Kunci. Harap pisahkan antar butir soal dengan satu baris kosong.",
                    italics: true,
                    size: 20,
                  }),
                ],
              }),
              new Paragraph({ text: "" }),
              new Paragraph({
                children: [
                  new TextRun({ text: "1. Berikut adalah rukun Islam yang pertama yaitu...", bold: true, size: 22 }),
                ],
              }),
              new Paragraph({ children: [new TextRun({ text: "A. Membaca Syahadat", size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: "B. Mendirikan Shalat", size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: "C. Zakat", size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: "D. Puasa", size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: "E. Haji", size: 22 })] }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Kunci: A", bold: true, size: 22 }),
                ],
              }),
              new Paragraph({ text: "" }),
              new Paragraph({
                children: [
                  new TextRun({ text: "2. Berapakah jumlah rakaat shalat fardhu subuh?", bold: true, size: 22 }),
                ],
              }),
              new Paragraph({ children: [new TextRun({ text: "A. 1 Rakaat", size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: "B. 2 Rakaat", size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: "C. 3 Rakaat", size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: "D. 4 Rakaat", size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: "E. 5 Rakaat", size: 22 })] }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Kunci: B", bold: true, size: 22 }),
                ],
              }),
              new Paragraph({ text: "" }),
              new Paragraph({
                children: [
                  new TextRun({ text: "=== CONTOH FORMAT SOAL ESAI / URAIAN ===", bold: true, size: 22, color: "0066cc" }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Tulis langsung pertanyaan esai Anda di bawah ini tanpa mencantumkan pilihan ganda (A, B, C, D, E) dan tanpa menuliskan baris Kunci jawaban. Sistem otomatis akan mendeteksi soal tanpa pilihan ganda ini sebagai soal Esai.", italics: true, size: 18 }),
                ],
              }),
              new Paragraph({ text: "" }),
              new Paragraph({
                children: [
                  new TextRun({ text: "3. Jelaskan hubungan timbal balik antara iman, islam, dan ihsan dalam kehidupan sehari-hari seorang mukmin!", bold: true, size: 22 }),
                ],
              }),
              new Paragraph({ text: "" }),
              new Paragraph({
                children: [
                  new TextRun({ text: "👉 INFORMASI PENTING PELETAKAN JAWABAN ESAI BAGI GURU:", bold: true, size: 20, color: "cc0000" }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "• Di mana jawaban diletakkan? Saat siswa mengerjakan ujian CBT, sistem akan otomatis menyediakan Kotak Jawaban (Text Area) interaktif langsung di bawah soal di layar HP/Laptop mereka.", size: 18 }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "• Siswa akan mengetik jawabannya di sana. Jadi, Bapak/Ibu guru TIDAK PERLU menuliskan kunci jawaban, ataupun menyediakan titik-titik/ruang kosong untuk jawaban di file Word (.docx) ini.", size: 18 }),
                ],
              }),
            ],
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_soal_word.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Gagal mendownload template Word .docx", err);
    }
  };

  // Student Manager state
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentNisn, setNewStudentNisn] = useState('');
  const [newStudentGender, setNewStudentGender] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki');
  const [newStudentClass, setNewStudentClass] = useState('');
  const [newStudentUser, setNewStudentUser] = useState('');
  const [newStudentPass, setNewStudentPass] = useState('123');
  const [studentError, setStudentError] = useState<string | null>(null);

  // Student Edit / Update state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentNisn, setEditStudentNisn] = useState('');
  const [editStudentGender, setEditStudentGender] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki');
  const [editStudentClass, setEditStudentClass] = useState('');
  const [editStudentUser, setEditStudentUser] = useState('');
  const [editStudentPass, setEditStudentPass] = useState('');
  const [editStudentError, setEditStudentError] = useState<string | null>(null);

  // Teacher Edit / Update state
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editTeacherName, setEditTeacherName] = useState('');
  const [editTeacherUser, setEditTeacherUser] = useState('');
  const [editTeacherPass, setEditTeacherPass] = useState('');
  const [editTeacherRole, setEditTeacherRole] = useState<'admin' | 'proctor'>('proctor');
  const [editTeacherError, setEditTeacherError] = useState<string | null>(null);

  // Exam Manager state
  const [selectedExamIdForQuestions, setSelectedExamIdForQuestions] = useState<string | null>(null);
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamSubject, setNewExamSubject] = useState('Islam');
  const [newExamDuration, setNewExamDuration] = useState(30);
  const [newExamTargetClass, setNewExamTargetClass] = useState('Semua Kelas');
  const [customTargetClass, setCustomTargetClass] = useState('');

  // Question Form state
  const [newQText, setNewQText] = useState('');
  const [newQType, setNewQType] = useState<'mc' | 'essay'>('mc');
  const [newQOptA, setNewQOptA] = useState('');
  const [newQOptB, setNewQOptB] = useState('');
  const [newQOptC, setNewQOptC] = useState('');
  const [newQOptD, setNewQOptD] = useState('');
  const [newQOptE, setNewQOptE] = useState('');
  const [newQCorrect, setNewQCorrect] = useState<'A' | 'B' | 'C' | 'D' | 'E'>('A');

  // Result Detail Modal State
  const [viewResultDetail, setViewResultDetail] = useState<ExamResult | null>(null);

  // Essay grading support states
  const [essayGradingScores, setEssayGradingScores] = useState<Record<string, number>>({});
  const [tempFinalScore, setTempFinalScore] = useState<number | null>(null);
  const [isSavingGrade, setIsSavingGrade] = useState(false);

  // Synchronize state when opening result details
  useEffect(() => {
    if (viewResultDetail) {
      setTempFinalScore(viewResultDetail.score);
      setEssayGradingScores((viewResultDetail as any).essayScores || {});
    } else {
      setTempFinalScore(null);
      setEssayGradingScores({});
    }
  }, [viewResultDetail]);

  const handleSaveEssayGrades = () => {
    if (!viewResultDetail) return;
    setIsSavingGrade(true);
    try {
      const updatedResult: ExamResult = {
        ...viewResultDetail,
        score: tempFinalScore !== null ? tempFinalScore : viewResultDetail.score,
        essayScores: essayGradingScores
      } as any;

      const updatedResultsList = results.map(r => r.id === viewResultDetail.id ? updatedResult : r);
      onUpdateResults(updatedResultsList);
      setViewResultDetail(updatedResult);
      alert('Penilaian Uraian / Esai berhasil disimpan & Nilai Akhir siswa diperbarui!');
    } catch (err) {
      console.error('Failed to save essay grades:', err);
      alert('Gagal menyimpan penilaian!');
    } finally {
      setIsSavingGrade(false);
    }
  };

  // States for uploading questions
  const [inputMethod, setInputMethod] = useState<'manual' | 'upload'>('manual');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // States for creating exam with direct file upload
  const [examCreationMethod, setExamCreationMethod] = useState<'manual' | 'upload'>('manual');
  const [newExamFileError, setNewExamFileError] = useState<string | null>(null);
  const [newExamFileSuccess, setNewExamFileSuccess] = useState<string | null>(null);
  const [newExamDragActive, setNewExamDragActive] = useState(false);
  const [uploadedExamQuestions, setUploadedExamQuestions] = useState<Question[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  // Stats computation
  const avgScore = results.length > 0 ? Math.round(results.reduce((acc, curr) => acc + curr.score, 0) / results.length) : 0;
  const maxScore = results.length > 0 ? Math.max(...results.map((r) => r.score)) : 0;
  const passCount = results.filter((r) => r.score >= 75).length;
  const passPercentage = results.length > 0 ? Math.round((passCount / results.length) * 100) : 0;

  // Render Student Adding
  const handleAddStudent = (e: FormEvent) => {
    e.preventDefault();
    setStudentError(null);

    if (!newStudentName.trim() || !newStudentNisn.trim() || !newStudentClass.trim() || !newStudentUser.trim()) {
      setStudentError('Harap lengkapi semua isian formulir.');
      return;
    }

    if (students.some((s) => s.username === newStudentUser.toLowerCase())) {
      setStudentError('Username sudah dipakai oleh siswa lain.');
      return;
    }

    if (students.some((s) => s.nisn === newStudentNisn)) {
      setStudentError('NISN ini sudah didaftarkan.');
      return;
    }

    const newStudent: Student = {
      id: `student_${Date.now()}`,
      name: newStudentName.trim(),
      username: newStudentUser.trim().toLowerCase(),
      nisn: newStudentNisn.trim(),
      gender: newStudentGender,
      classGroup: newStudentClass.trim(),
      password: newStudentPass.trim()
    };

    onUpdateStudents([...students, newStudent]);

    // reset fields
    setNewStudentName('');
    setNewStudentNisn('');
    setNewStudentClass('');
    setNewStudentUser('');
    setNewStudentPass('123');
  };

  const startEditStudent = (student: Student) => {
    setEditingStudent(student);
    setEditStudentName(student.name);
    setEditStudentNisn(student.nisn);
    setEditStudentGender(student.gender as 'Laki-laki' | 'Perempuan');
    setEditStudentClass(student.classGroup);
    setEditStudentUser(student.username);
    setEditStudentPass(student.password);
    setEditStudentError(null);
  };

  const handleSaveStudentEdit = (e: FormEvent) => {
    e.preventDefault();
    setEditStudentError(null);

    if (!editingStudent) return;

    if (!editStudentName.trim() || !editStudentNisn.trim() || !editStudentClass.trim() || !editStudentUser.trim()) {
      setEditStudentError('Harap lengkapi semua isian formulir.');
      return;
    }

    const usernameLower = editStudentUser.trim().toLowerCase();

    if (students.some((s) => s.id !== editingStudent.id && s.username === usernameLower)) {
      setEditStudentError('Username sudah dipakai oleh siswa lain.');
      return;
    }

    if (students.some((s) => s.id !== editingStudent.id && s.nisn === editStudentNisn.trim())) {
      setEditStudentError('NISN ini sudah didaftarkan.');
      return;
    }

    if (editingStudent.username === 'janur' || editingStudent.id === 'user_1') {
      if (editStudentName.trim() !== 'Ahmad Jaannuruzaki A') {
        setEditStudentError('Nama Siswa Utama (Ahmad Jaannuruzaki A) tidak boleh diubah karena bersifat permanen!');
        return;
      }
      if (usernameLower !== 'janur') {
        setEditStudentError('Username Siswa Utama (janur) tidak boleh diubah karena bersifat permanen!');
        return;
      }
    }

    const updatedStudent: Student = {
      ...editingStudent,
      name: editStudentName.trim(),
      username: usernameLower,
      nisn: editStudentNisn.trim(),
      gender: editStudentGender,
      classGroup: editStudentClass.trim(),
      password: editStudentPass.trim()
    };

    onUpdateStudents(students.map((s) => (s.id === editingStudent.id ? updatedStudent : s)));
    setEditingStudent(null);
  };

  const handleDeleteStudent = (id: string) => {
    const toDelete = students.find((s) => s.id === id);
    if (toDelete && (toDelete.username === 'janur' || toDelete.id === 'user_1' || toDelete.name === 'Ahmad Jaannuruzaki A')) {
      alert('Akun siswa utama Ahmad Jaannuruzaki A bersifat permanen dan tidak boleh dihapus!');
      return;
    }
    if (window.confirm('Yakin ingin menghapus siswa ini?')) {
      onUpdateStudents(students.filter((s) => s.id !== id));
    }
  };

  // Teacher / Proctor Manager state and handlers
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherUser, setNewTeacherUser] = useState('');
  const [newTeacherPass, setNewTeacherPass] = useState('123');
  const [newTeacherRole, setNewTeacherRole] = useState<'admin' | 'proctor'>('proctor');
  const [teacherError, setTeacherError] = useState<string | null>(null);

  const handleAddTeacher = (e: FormEvent) => {
    e.preventDefault();
    setTeacherError(null);

    if (!newTeacherName.trim() || !newTeacherUser.trim() || !newTeacherPass.trim()) {
      setTeacherError('Semua kolom wajib diisi.');
      return;
    }

    const usernameLower = newTeacherUser.trim().toLowerCase();

    if (teachers.some((t) => t.username === usernameLower)) {
      setTeacherError('Username pengawas sudah terdaftar.');
      return;
    }

    const newTeacher: Teacher = {
      id: `teacher_${Date.now()}`,
      name: newTeacherName.trim(),
      username: usernameLower,
      password: newTeacherPass.trim(),
      role: newTeacherRole
    };

    onUpdateTeachers([...teachers, newTeacher]);

    setNewTeacherName('');
    setNewTeacherUser('');
    setNewTeacherPass('123');
    setNewTeacherRole('proctor');
  };

  const startEditTeacher = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setEditTeacherName(teacher.name);
    setEditTeacherUser(teacher.username);
    setEditTeacherPass(teacher.password);
    setEditTeacherRole(teacher.role as 'admin' | 'proctor');
    setEditTeacherError(null);
  };

  const handleSaveTeacherEdit = (e: FormEvent) => {
    e.preventDefault();
    setEditTeacherError(null);

    if (!editingTeacher) return;

    if (!editTeacherName.trim() || !editTeacherUser.trim() || !editTeacherPass.trim()) {
      setEditTeacherError('Semua kolom wajib diisi.');
      return;
    }

    const usernameLower = editTeacherUser.trim().toLowerCase();

    if (teachers.some((t) => t.id !== editingTeacher.id && t.username === usernameLower)) {
      setEditTeacherError('Username pengawas sudah terdaftar.');
      return;
    }

    if ((editingTeacher.username === 'admin' || editingTeacher.username === 'aedia') && (usernameLower !== editingTeacher.username || editTeacherRole !== 'admin')) {
      setEditTeacherError('Kredensial atau hak akses admin utama tidak dapat diubah/diturunkan!');
      return;
    }

    const updatedTeacher: Teacher = {
      ...editingTeacher,
      name: editTeacherName.trim(),
      username: usernameLower,
      password: editTeacherPass.trim(),
      role: editTeacherRole
    };

    onUpdateTeachers(teachers.map((t) => (t.id === editingTeacher.id ? updatedTeacher : t)));
    setEditingTeacher(null);
  };

  const handleDeleteTeacher = (id: string) => {
    const toDelete = teachers.find((t) => t.id === id);
    if (toDelete && (toDelete.username === 'aedia' || toDelete.username === 'admin')) {
      alert('Akun admin utama tidak boleh dihapus!');
      return;
    }

    if (window.confirm('Hapus akun pengawas/guru ini?')) {
      onUpdateTeachers(teachers.filter((t) => t.id !== id));
    }
  };

  const handleExportResultsCSV = () => {
    if (results.length === 0) {
      alert('Belum ada data nilai yang bisa diunduh.');
      return;
    }

    let csvContent = '\uFEFF'; 
    csvContent += '"Nama Siswa";"NISN";"Kelas";"Judul Ujian";"Mata Pelajaran";"Jumlah Soal";"Jawaban Benar";"Nilai Akhir";"Status";"Waktu Selesai"\n';

    results.forEach((res) => {
      const status = res.score >= 75 ? 'LULUS' : 'REMEDIAL';
      const dateStr = new Date(res.completedTime).toLocaleString('id-ID');
      
      const row = [
        `"${res.studentName.replace(/"/g, '""')}"`,
        `"${res.studentNisn}"`,
        `"${res.classGroup}"`,
        `"${res.examTitle.replace(/"/g, '""')}"`,
        `"${res.examSubject.replace(/"/g, '""')}"`,
        `"${res.totalQuestions}"`,
        `"${res.correctCount}"`,
        `"${res.score}"`,
        `"${status}"`,
        `"${dateStr}"`
      ];

      csvContent += row.join(';') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap_nilai_cbt_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintRecap = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Gagal membuka jendela cetak. Pastikan pop-up browser Anda diizinkan.');
      return;
    }

    const rows = results.map((res, index) => {
      const dateStr = new Date(res.completedTime).toLocaleDateString('id-ID');
      const timeStr = new Date(res.completedTime).toLocaleTimeString('id-ID');
      const status = res.score >= 75 ? 'LULUS' : 'REMEDIAL';
      return `
        <tr>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${index + 1}</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>${res.studentName}</strong><br><small style="color:#555">NISN: ${res.studentNisn}</small></td>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${res.classGroup}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${res.examTitle}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${res.correctCount} / ${res.totalQuestions}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd; font-weight: bold; color: ${res.score >= 75 ? '#065f46' : '#991b1b'}">${res.score}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd; font-weight: bold; font-size: 11px;">${status}</td>
          <td style="text-align: center; padding: 8px; border: 1px solid #ddd; font-size: 11px;">${dateStr} ${timeStr}</td>
        </tr>
      `;
    }).join('');

    const avgScore = results.length > 0 ? Math.round(results.reduce((acc, curr) => acc + curr.score, 0) / results.length) : 0;
    const maxScore = results.length > 0 ? Math.max(...results.map((r) => r.score)) : 0;
    const minScore = results.length > 0 ? Math.min(...results.map((r) => r.score)) : 0;
    const lulusCount = results.filter((r) => r.score >= 75).length;
    const kelulusanPercent = results.length > 0 ? Math.round((lulusCount / results.length) * 100) : 0;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>REKAPITULASI HASIL NILAI UJIAN - CBT ONLINE</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
            color: #333;
          }
          .kop {
            text-align: center;
            border-bottom: 3px double #333;
            padding-bottom: 12px;
            margin-bottom: 25px;
          }
          .kop h2 {
            margin: 0;
            font-size: 20px;
            font-weight: bold;
            letter-spacing: 1px;
          }
          .kop p {
            margin: 4px 0 0 0;
            font-size: 12px;
            color: #666;
          }
          .title-area {
            text-align: center;
            margin-bottom: 25px;
          }
          .title-area h3 {
            margin: 0;
            font-size: 16px;
            text-transform: uppercase;
            text-decoration: underline;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 25px;
          }
          .stats-card {
            background: #f9f9f9;
            border: 1px solid #e0e0e0;
            padding: 10px;
            border-radius: 6px;
            text-align: center;
          }
          .stats-card span {
            font-size: 10px;
            text-transform: uppercase;
            color: #666;
            display: block;
            margin-bottom: 4px;
          }
          .stats-card strong {
            font-size: 18px;
            color: #111;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-bottom: 35px;
          }
          th {
            background-color: #f5f5f5;
            color: #333;
            font-weight: bold;
            padding: 10px 8px;
            border: 1px solid #ddd;
            text-transform: uppercase;
            font-size: 11px;
          }
          .footer-section {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            font-size: 13px;
          }
          .signature-box {
            text-align: center;
            width: 200px;
          }
          .signature-space {
            height: 70px;
          }
          @media print {
            body { margin: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="kop">
          <h2>PANITIA UJIAN SEMESTER - CBT ONLINE</h2>
          <p>Sistem Management Ujian Sekolah Berbasis Komputer & Handphone (CBT-Cepat)</p>
        </div>
        
        <div class="title-area">
          <h3>REKAPITULASI DAFTAR NILAI UJIAN</h3>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #555;">Dicetak otomatis oleh Sistem CBT pada: ${new Date().toLocaleString('id-ID')}</p>
        </div>

        <div class="stats-grid">
          <div class="stats-card">
            <span>Rata-Rata Nilai</span>
            <strong>${avgScore}</strong>
          </div>
          <div class="stats-card">
            <span>Nilai Tertinggi</span>
            <strong>${maxScore}</strong>
          </div>
          <div class="stats-card">
            <span>Nilai Terendah</span>
            <strong>${minScore}</strong>
          </div>
          <div class="stats-card">
            <span>% Kelulusan (>=75)</span>
            <strong>${kelulusanPercent}%</strong>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 5%;">No</th>
              <th style="width: 25%;">Nama Siswa / NISN</th>
              <th style="width: 10%;">Kelas</th>
              <th style="width: 22%;">Ujian</th>
              <th style="width: 12%;">Benar/Salah</th>
              <th style="width: 8%;">Nilai</th>
              <th style="width: 10%;">Status</th>
              <th style="width: 18%;">Selesai Pada</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="8" style="text-align: center; padding: 20px; color:#999;">Belum ada data nilai ujian siswa.</td></tr>'}
          </tbody>
        </table>

        <div class="footer-section">
          <div class="signature-box">
            <p>Mengetahui,</p>
            <p><strong>Kepala Sekolah</strong></p>
            <div class="signature-space"></div>
            <p>____________________</p>
            <p style="font-size: 11px; color:#555">NIP. .........................</p>
          </div>
          <div class="signature-box">
            <p>Suka Makmur, ${new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
            <p><strong>Guru Mata Pelajaran</strong></p>
            <div class="signature-space"></div>
            <p><strong>${currentTeacherName}</strong></p>
            <p style="font-size: 11px; color:#555">NIP. .........................</p>
          </div>
        </div>

        <div class="no-print" style="margin-top: 30px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #059669; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Cetak Sekarang</button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
    }, 250);
  };

  const handlePrintIndividual = (res: ExamResult) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Gagal membuka jendela cetak. Pastikan pop-up browser Anda diizinkan.');
      return;
    }

    const dateStr = new Date(res.completedTime).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'});
    const timeStr = new Date(res.completedTime).toLocaleTimeString('id-ID');
    const status = res.score >= 75 ? 'LULUS (TUNTAS)' : 'REMEDIAL (BELUM TUNTAS)';

    let essaySectionHtml = '';
    if (res.essayAnswers && Object.keys(res.essayAnswers).length > 0) {
      essaySectionHtml = `
        <h4 style="margin: 25px 0 10px 0; font-size: 12px; text-transform: uppercase;">Jawaban Soal Esai & Penilaian Uraian</h4>
        <table class="details-table" style="margin-bottom: 25px; width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="width: 60%; padding: 8px; border: 1px solid #33s; text-align: left;">Pertanyaan & Jawaban Siswa</th>
              <th style="width: 20%; padding: 8px; border: 1px solid #33s; text-align: center;">Skor Guru</th>
              <th style="width: 20%; padding: 8px; border: 1px solid #33s; text-align: center;">Keterangan</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      Object.entries(res.essayAnswers).forEach(([qId, val], idx) => {
        const examObj = exams.find((ex) => ex.id === res.examId);
        const questionObj = examObj?.questions.find((q) => q.id === qId);
        const essayScore = (res as any).essayScores?.[qId] !== undefined ? (res as any).essayScores[qId] : '-';
        essaySectionHtml += `
          <tr>
            <td style="padding: 8px; border: 1px solid #333;">
              <strong>Uraian ${idx + 1}:</strong> ${questionObj?.text || 'Pertanyaan ' + (idx + 1)}<br/>
              <div style="margin-top: 5px; padding: 6px; background-color: #f9fafb; border-left: 3px solid #3b82f6; font-style: italic;">
                ${val || '(Siswa mengosongkan jawaban)'}
              </div>
            </td>
            <td style="padding: 8px; border: 1px solid #333; text-align: center; font-weight: bold; font-size: 14px; font-family: monospace;">
              ${essayScore}
            </td>
            <td style="padding: 8px; border: 1px solid #333; text-align: center; font-size: 11px; color: #555;">
              ${essayScore !== '-' ? 'Telah dinilai' : 'Belum dinilai'}
            </td>
          </tr>
        `;
      });
      
      essaySectionHtml += `
          </tbody>
        </table>
      `;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>LEMBAR HASIL UJIAN INDIVIDUAL - ${res.studentName}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
            color: #333;
          }
          .kop {
            text-align: center;
            border-bottom: 3px double #333;
            padding-bottom: 12px;
            margin-bottom: 25px;
          }
          .kop h2 {
            margin: 0;
            font-size: 18px;
            font-weight: bold;
          }
          .kop p {
            margin: 4px 0 0 0;
            font-size: 11px;
            color: #666;
          }
          .title {
            text-align: center;
            font-size: 15px;
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 20px;
            text-transform: uppercase;
          }
          .student-info {
            width: 100%;
            margin-bottom: 25px;
            border-collapse: collapse;
          }
          .student-info td {
            padding: 5px 0;
            font-size: 13px;
          }
          .score-box {
            border: 2px solid #333;
            padding: 15px;
            text-align: center;
            margin-bottom: 30px;
            border-radius: 8px;
            background: #fdfdfd;
          }
          .score-box span {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #555;
            display: block;
          }
          .score-box h1 {
            font-size: 48px;
            margin: 10px 0;
            font-weight: 950;
            font-family: monospace;
          }
          .score-box p {
            margin: 0;
            font-size: 13px;
            font-weight: bold;
          }
          .details-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-bottom: 35px;
          }
          .details-table td, .details-table th {
            padding: 8px 10px;
            border: 1px solid #333;
          }
          .details-table th {
            background: #eee;
            text-align: left;
          }
          .footer-section {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            font-size: 13px;
          }
          .signature-box {
            text-align: center;
            width: 200px;
          }
          .signature-space {
            height: 70px;
          }
          @media print {
            body { margin: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="kop">
          <h2>PANITIA UJIAN SEMESTER - CBT ONLINE</h2>
          <p>Sistem Hasil Penilaian Komputerisasi Otomatis</p>
        </div>

        <div class="title">LAPORAN HASIL EVALUASI BELAJAR (LHEB)</div>

        <table class="student-info">
          <tr>
            <td style="width: 20%;"><strong>Nama Siswa</strong></td>
            <td style="width: 3%;">:</td>
            <td style="width: 42%; font-weight: bold; font-size:14px;">${res.studentName}</td>
            <td style="width: 15%;"><strong>Ujian</strong></td>
            <td style="width: 3%;">:</td>
            <td style="width: 17%;">${res.examTitle}</td>
          </tr>
          <tr>
            <td><strong>NISN</strong></td>
            <td>:</td>
            <td>${res.studentNisn}</td>
            <td><strong>Mata Pelajaran</strong></td>
            <td>:</td>
            <td>${res.examSubject}</td>
          </tr>
          <tr>
            <td><strong>Kelas</strong></td>
            <td>:</td>
            <td>${res.classGroup}</td>
            <td><strong>Waktu Selesai</strong></td>
            <td>:</td>
            <td>${dateStr} (Pukul ${timeStr})</td>
          </tr>
        </table>

        <div class="score-box">
          <span>Nilai Akhir Siswa (Skala 100)</span>
          <h1>${res.score}</h1>
          <p style="color: ${res.score >= 75 ? '#065f46' : '#b91c1c'}">STATUS KETUNTASAN: ${status}</p>
        </div>

        <h4 style="margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase;">Rincian Butir Penilaian</h4>
        <table class="details-table">
          <tr>
            <th style="width: 50%;">Aspek Penilaian</th>
            <th style="width: 50%;">Hasil / Keterangan</th>
          </tr>
          <tr>
            <td>Jumlah Soal Ujian</td>
            <td><strong>${res.totalQuestions}</strong> butir soal</td>
          </tr>
          <tr>
            <td>Jumlah Jawaban Benar</td>
            <td style="color: #065f46; font-weight: bold;">${res.correctCount} butir</td>
          </tr>
          <tr>
            <td>Jumlah Jawaban Salah / Kosong</td>
            <td style="color: #b91c1c; font-weight: bold;">${res.totalQuestions - res.correctCount} butir</td>
          </tr>
          <tr>
            <td>KKM Mata Pelajaran</td>
            <td><strong>75</strong> (Tujuh Puluh Lima)</td>
          </tr>
        </table>

        ${essaySectionHtml}

        <div class="footer-section">
          <div class="signature-box">
            <p>Orang Tua / Wali Siswa,</p>
            <div class="signature-space"></div>
            <p>____________________</p>
          </div>
          <div class="signature-box">
            <p>Suka Makmur, ${dateStr}</p>
            <p><strong>Guru Mata Pelajaran / Pengawas</strong></p>
            <div class="signature-space"></div>
            <p><strong>${currentTeacherName}</strong></p>
            <p style="font-size: 11px; color:#555">NIP. .........................</p>
          </div>
        </div>

        <div class="no-print" style="margin-top: 30px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #0284c7; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Cetak Lembar Nilai Siswa</button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
    }, 250);
  };

  // Render Exam Adding
  const handleAddExam = (e: FormEvent) => {
    e.preventDefault();
    if (!newExamTitle.trim()) return;

    if (examCreationMethod === 'upload' && uploadedExamQuestions.length === 0) {
      alert('Harap unggah / drag-drop file soal yang valid terlebih dahulu untuk metode Impor.');
      return;
    }

    // Generate random 6 characters token
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let randToken = '';
    for (let i = 0; i < 6; i++) {
      randToken += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    const finalTargetClass = newExamTargetClass === 'custom' ? customTargetClass.trim() : newExamTargetClass;

    const newExam: Exam = {
      id: `exam_${Date.now()}`,
      title: newExamTitle,
      subject: newExamSubject,
      durationMinutes: Number(newExamDuration),
      token: randToken,
      questions: examCreationMethod === 'upload' ? uploadedExamQuestions : [],
      isActive: true,
      targetClass: finalTargetClass || 'Semua Kelas'
    };

    onUpdateExams([...exams, newExam]);
    setNewExamTitle('');
    setNewExamSubject('Lainnya');
    setNewExamDuration(30);
    setNewExamTargetClass('Semua Kelas');
    setCustomTargetClass('');

    // Clear upload states
    setUploadedExamQuestions([]);
    setUploadedFileName('');
    setNewExamFileSuccess(null);
    setNewExamFileError(null);
  };

  const handleDeleteExam = (id: string) => {
    if (currentUserRole !== 'admin') {
      alert('Hanya Administrator (Guru Utama) yang memiliki hak akses untuk menghapus paket ujian ini!');
      return;
    }
    if (window.confirm('Yakin ingin menghapus seluruh paket ujian ini beserta soalnya?')) {
      onUpdateExams(exams.filter((e) => e.id !== id));
      // Reset selected exam if deleted
      if (selectedExamIdForQuestions === id) {
        setSelectedExamIdForQuestions(null);
      }
    }
  };

  const handleToggleExamActive = (id: string) => {
    onUpdateExams(
      exams.map((e) => (e.id === id ? { ...e, isActive: !e.isActive } : e))
    );
  };

  const handleRandomizeToken = (id: string) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let randToken = '';
    for (let i = 0; i < 6; i++) {
      randToken += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    onUpdateExams(
      exams.map((e) => (e.id === id ? { ...e, token: randToken } : e))
    );
  };

  // Add Question to Selected Exam
  const handleAddQuestion = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedExamIdForQuestions) return;

    if (newQType === 'mc' && (!newQText.trim() || !newQOptA || !newQOptB || !newQOptC)) {
      alert('Untuk tipe pilihan ganda, teks soal dan minimal pilihan A, B, C wajib diisi.');
      return;
    }

    if (newQType === 'essay' && !newQText.trim()) {
      alert('Teks soal esai wajib diisi.');
      return;
    }

    const targetExam = exams.find((ex) => ex.id === selectedExamIdForQuestions);
    if (!targetExam) return;

    const newQuestion: Question = {
      id: `q_${Date.now()}`,
      text: newQText,
      correctAnswer: newQType === 'essay' ? 'A' : newQCorrect,
      type: newQType,
      options: newQType === 'essay' ? [] : [
        { letter: 'A', text: newQOptA },
        { letter: 'B', text: newQOptB },
        { letter: 'C', text: newQOptC },
        { letter: 'D', text: newQOptD || '-' },
        { letter: 'E', text: newQOptE || '-' }
      ]
    };

    onUpdateExams(
      exams.map((ex) =>
        ex.id === selectedExamIdForQuestions
          ? { ...ex, questions: [...ex.questions, newQuestion] }
          : ex
      )
    );

    // reset question fields
    setNewQText('');
    setNewQType('mc');
    setNewQOptA('');
    setNewQOptB('');
    setNewQOptC('');
    setNewQOptD('');
    setNewQOptE('');
    setNewQCorrect('A');
  };

  const handleDeleteQuestion = (questionId: string) => {
    if (!selectedExamIdForQuestions) return;
    if (window.confirm('Hapus soal ini?')) {
      onUpdateExams(
        exams.map((ex) =>
          ex.id === selectedExamIdForQuestions
            ? { ...ex, questions: ex.questions.filter((q) => q.id !== questionId) }
            : ex
        )
      );
    }
  };

  const processUploadedQuestions = (fileContent: string, fileName: string) => {
    try {
      setUploadError(null);
      setUploadSuccess(null);

      const parsedQuestions = parseMasalText(fileContent, fileName);

      if (parsedQuestions.length === 0) {
        throw new Error('Tidak ada butir soal valid yang dapat diekstrak. Mohon pastikan file Anda sesuai panduan format.');
      }

      // Add to list of exams
      onUpdateExams(
        exams.map((ex) =>
          ex.id === selectedExamIdForQuestions
            ? { ...ex, questions: [...ex.questions, ...parsedQuestions] }
            : ex
        )
      );

      setUploadSuccess(`Berhasil mengimpor ${parsedQuestions.length} butir soal ke paket ujian ini!`);
      setUploadError(null);
    } catch (err: any) {
      setUploadError(err.message || 'Gagal membaca isi file. Periksa kesesuaian format.');
      setUploadSuccess(null);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.name.toLowerCase().endsWith('.docx')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          processUploadedQuestions(result.value, file.name);
        } catch (err: any) {
          setUploadError(`Gagal membaca file Microsoft Word (.docx): ${err.message || err}`);
        }
      };
      reader.onerror = () => {
        setUploadError('Gagal membaca file dari komputer.');
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        processUploadedQuestions(content, file.name);
      };
      reader.onerror = () => {
        setUploadError('Gagal membaca file dari komputer.');
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.docx')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          processUploadedQuestions(result.value, file.name);
        } catch (err: any) {
          setUploadError(`Gagal membaca file Microsoft Word (.docx): ${err.message || err}`);
        }
      };
      reader.onerror = () => {
        setUploadError('Gagal membaca file dari komputer.');
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        processUploadedQuestions(content, file.name);
      };
      reader.onerror = () => {
        setUploadError('Gagal membaca file dari komputer.');
      };
      reader.readAsText(file);
    }
  };

  const parseNewExamQuestions = (fileContent: string, fileName: string) => {
    try {
      setNewExamFileError(null);
      setNewExamFileSuccess(null);

      const parsedQuestions = parseMasalText(fileContent, fileName);

      if (parsedQuestions.length === 0) {
        throw new Error('Tidak ada butir soal valid yang dapat diekstrak. Mohon pastikan file Anda sesuai panduan format.');
      }

      setUploadedExamQuestions(parsedQuestions);
      setUploadedFileName(fileName);
      setNewExamFileSuccess(`File "${fileName}" berhasil dibaca! Total ${parsedQuestions.length} butir soal siap dimasukkan.`);
      setNewExamFileError(null);
    } catch (err: any) {
      setNewExamFileError(err.message || 'Gagal membaca isi file. Periksa kesesuaian format.');
      setNewExamFileSuccess(null);
      setUploadedExamQuestions([]);
      setUploadedFileName('');
    }
  };

  const handleNewExamFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.name.toLowerCase().endsWith('.docx')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          parseNewExamQuestions(result.value, file.name);
        } catch (err: any) {
          setNewExamFileError(`Gagal membaca file Microsoft Word (.docx): ${err.message || err}`);
        }
      };
      reader.onerror = () => {
        setNewExamFileError('Gagal membaca file dari komputer.');
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        parseNewExamQuestions(content, file.name);
      };
      reader.onerror = () => {
        setNewExamFileError('Gagal membaca file dari komputer.');
      };
      reader.readAsText(file);
    }
  };

  const handleNewExamDragOver = (e: DragEvent) => {
    e.preventDefault();
    setNewExamDragActive(true);
  };

  const handleNewExamDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setNewExamDragActive(false);
  };

  const handleNewExamDrop = (e: DragEvent) => {
    e.preventDefault();
    setNewExamDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.docx')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          parseNewExamQuestions(result.value, file.name);
        } catch (err: any) {
          setNewExamFileError(`Gagal membaca file Microsoft Word (.docx): ${err.message || err}`);
        }
      };
      reader.onerror = () => {
        setNewExamFileError('Gagal membaca file dari komputer.');
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        parseNewExamQuestions(content, file.name);
      };
      reader.onerror = () => {
        setNewExamFileError('Gagal membaca file dari komputer.');
      };
      reader.readAsText(file);
    }
  };

  const handleResetResult = (resultId: string) => {
    if (window.confirm('Yakin ingin mereset/menghapus hasil tes siswa ini? Ini memungkinkan mereka masuk kembali untuk mengulang ujian.')) {
      onUpdateResults(results.filter((r) => r.id !== resultId));
    }
  };

  const subQuestionsCount = (sub: string) => {
    return exams.filter((e) => e.subject === sub).reduce((acc, curr) => acc + curr.questions.length, 0);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      {/* Top Banner Header */}
      <header className="bg-emerald-800 text-white shadow-md py-4 px-6 z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-full border-[2px] border-amber-400 shadow-sm shadow-emerald-950/20 overflow-hidden bg-white">
              <img 
                src={logoImg} 
                alt="Logo MA Annuriyyah" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                CBT MA Annuriyyah <span className="bg-amber-400 text-emerald-900 text-[10px] font-bold px-1.5 py-0.5 rounded-md">PROCTOR</span>
              </h2>
              <p className="text-xs text-emerald-100 font-mono">Halaman Pengendali Ujian (Teacher Hub)</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {currentUserRole === 'admin' && onToggleExamMode && (
              <div className="flex items-center gap-1 bg-emerald-900/60 p-1 border border-white/10 rounded-xl w-full sm:w-auto justify-center">
                <button
                  type="button"
                  onClick={() => onToggleExamMode('online')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    examMode === 'online'
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950/30'
                      : 'text-emerald-100 hover:text-white hover:bg-white/5 font-normal'
                  }`}
                  title="Gunakan Server Cloud (Firebase Live Sync)"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Ujian Online
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onToggleExamMode('offline');
                    setShowTechnicianGuide(true);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    examMode === 'offline'
                      ? 'bg-amber-500 text-zinc-950 shadow-sm shadow-emerald-950/30 font-extrabold animate-pulse'
                      : 'text-emerald-100 hover:text-white hover:bg-white/5 font-normal'
                  }`}
                  title="Gunakan Penyimpanan Lokal Tanpa Internet (Local Backup) & Lihat Manual"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-900" />
                  Ujian Offline
                </button>
              </div>
            )}

            <div className="bg-emerald-900/50 p-2 px-4 border border-white/10 rounded-xl text-center sm:text-left w-full sm:w-auto">
              <span className="text-[10px] font-mono uppercase tracking-wider block text-emerald-200">Logged in as</span>
              <strong className="text-xs sm:text-sm font-bold text-white block">
                {currentTeacherName} ({currentUserRole === 'admin' ? 'Admin' : 'Pengawas'})
              </strong>
            </div>
            
            <button
              onClick={onLogout}
              className="flex items-center justify-center gap-1.5 p-2 px-4 bg-red-600/30 hover:bg-red-600/40 text-red-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-red-500/20 cursor-pointer w-full sm:w-auto"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl w-full mx-auto p-4 md:p-6 flex-1 flex flex-col md:flex-row gap-6 relative">
        
        {/* Left Side Menu Options */}
        <aside className="w-full md:w-64 bg-white rounded-3xl p-6 shadow-sm border border-gray-150 self-start space-y-4">
          <h3 className="text-[10px] uppercase font-mono tracking-widest text-gray-400 font-bold px-2 mb-2">
            Main Directories
          </h3>

          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full text-left p-3 rounded-2xl text-sm font-semibold transition-all flex items-center justify-between ${
                activeTab === 'overview'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <TrendingUp className="w-4 h-4" />
                Dashboard Ringkasan
              </span>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              onClick={() => {
                setActiveTab('students');
                setStudentError(null);
              }}
              className={`w-full text-left p-3 rounded-2xl text-sm font-semibold transition-all flex items-center justify-between ${
                activeTab === 'students'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Users className="w-4 h-4" />
                Siswa Terdaftar
              </span>
              <span className="bg-gray-100 text-gray-600 text-xs py-0.5 px-2 rounded-full font-mono group-hover:bg-white">
                {students.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('exams')}
              className={`w-full text-left p-3 rounded-2xl text-sm font-semibold transition-all flex items-center justify-between ${
                activeTab === 'exams'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4" />
                Bank Soal Ujian
              </span>
              <span className="bg-gray-100 text-gray-600 text-xs py-0.5 px-2 rounded-full font-mono">
                {exams.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('tokens')}
              className={`w-full text-left p-3 rounded-2xl text-sm font-semibold transition-all flex items-center justify-between ${
                activeTab === 'tokens'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4" />
                Kontrol Aktivasi & Token
              </span>
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            </button>

            <button
              onClick={() => setActiveTab('monitoring')}
              className={`w-full text-left p-3 rounded-2xl text-sm font-semibold transition-all flex items-center justify-between ${
                activeTab === 'monitoring'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/10'
                  : 'text-gray-500 hover:text-rose-600 hover:bg-rose-50/50'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <Radio className="w-4 h-4" />
                Monitoring Ujian
              </span>
              <span className={`text-xs font-bold py-0.5 px-2 rounded-full font-mono ${activeTab === 'monitoring' ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-700'}`}>
                {activeSessions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('results')}
              className={`w-full text-left p-3 rounded-2xl text-sm font-semibold transition-all flex items-center justify-between ${
                activeTab === 'results'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Award className="w-4 h-4" />
                Rekap Hasil Ujian
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold py-0.5 px-2 rounded-full font-mono">
                {results.length}
              </span>
            </button>

            {currentUserRole === 'admin' && (
              <button
                onClick={() => {
                  setActiveTab('teachers');
                  setTeacherError(null);
                }}
                className={`w-full text-left p-3 rounded-2xl text-sm font-semibold transition-all flex items-center justify-between ${
                  activeTab === 'teachers'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Users className="w-4 h-4" />
                  Kelola Guru / Pengawas
                </span>
                <span className="bg-amber-100 text-amber-800 text-xs font-bold py-0.5 px-2 rounded-full font-mono">
                  {teachers.length}
                </span>
              </button>
            )}
          </nav>

          <div className="pt-6 border-t border-gray-150">
            <div className="bg-amber-50/50 p-4 border border-amber-100 rounded-2xl">
              <span className="text-[10px] uppercase tracking-wider text-amber-700 font-bold block mb-1">
                Kondisi Sekolah
              </span>
              <p className="text-[11px] text-amber-800 leading-relaxed font-sans">
                Gunakan menu <strong>Kontrol Aktivasi</strong> untuk melihat atau merubah kode token ujian yang harus dibagikan di papan tulis kelas.
              </p>
            </div>
          </div>
        </aside>

        {/* Right Content Space */}
        <main className="flex-1 min-w-0">
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-3xl p-5 shadow-xs border border-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block uppercase font-bold">Total Siswa</span>
                    <strong className="text-2xl font-black text-gray-800 block mt-0.5">{students.length}</strong>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-5 shadow-xs border border-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block uppercase font-bold">Paket Ujian</span>
                    <strong className="text-2xl font-black text-gray-800 block mt-0.5">{exams.length}</strong>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-5 shadow-xs border border-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block uppercase font-bold">Ujian Dikerjakan</span>
                    <strong className="text-2xl font-black text-gray-800 block mt-0.5">{results.length}</strong>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-5 shadow-xs border border-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block uppercase font-bold">Rata-Rata Nilai</span>
                    <strong className="text-2xl font-black text-gray-800 block mt-0.5">{avgScore}</strong>
                  </div>
                </div>
              </div>

              {/* Graphic Stats & Performance Panels */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* SVG Chart Panel: Subject Questions Count */}
                <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest font-mono mb-1">
                      Distribusi Soal Berdasarkan Mapel
                    </h3>
                    <p className="text-xs text-gray-400">Total butir soal aktif per subyek mata pelajaran di Bank Soal.</p>
                  </div>

                  {/* Clean Native Custom SVG Bar Chart */}
                  <div className="mt-6 flex flex-col justify-end h-64 border-b border-l border-gray-200/60 pb-1 pl-4 relative font-mono text-[10px]">
                    <div className="flex justify-around items-end h-full w-full pt-4">
                      {/* Fiqih bar */}
                      <div className="flex flex-col items-center w-16">
                        <span className="font-bold text-emerald-800 text-xs mb-1.5">{subQuestionsCount('Fiqih')}</span>
                        <div
                          style={{ height: `${Math.min(180, Math.max(10, subQuestionsCount('Fiqih') * 18))}px` }}
                          className="w-full bg-gradient-to-t from-emerald-600 to-teal-500 rounded-t-lg transition-all"
                        ></div>
                        <span className="text-gray-600 font-semibold mt-3 truncate w-full text-center">Fiqih</span>
                      </div>

                      {/* Matematika bar */}
                      <div className="flex flex-col items-center w-16">
                        <span className="font-bold text-emerald-800 text-xs mb-1.5">{subQuestionsCount('Matematika')}</span>
                        <div
                          style={{ height: `${Math.min(180, Math.max(10, subQuestionsCount('Matematika') * 18))}px` }}
                          className="w-full bg-gradient-to-t from-amber-500 to-yellow-400 rounded-t-lg transition-all"
                        ></div>
                        <span className="text-gray-600 font-semibold mt-3 truncate w-full text-center">Matematika</span>
                      </div>

                      {/* Bahasa Indonesia bar */}
                      <div className="flex flex-col items-center w-16">
                        <span className="font-bold text-emerald-800 text-xs mb-1.5">{subQuestionsCount('Bahasa Indonesia')}</span>
                        <div
                          style={{ height: `${Math.min(180, Math.max(10, subQuestionsCount('Bahasa Indonesia') * 18))}px` }}
                          className="w-full bg-gradient-to-t from-blue-600 to-sky-500 rounded-t-lg transition-all"
                        ></div>
                        <span className="text-gray-600 font-semibold mt-3 truncate w-full text-center">B. Indonesia</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Donut Widget: Student Passing Rates statistics */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest font-mono mb-1">
                      Grafik Kelulusan Siswa
                    </h3>
                    <p className="text-xs text-gray-400">Rasio kelulusan siswa (KKM ≥ 75).</p>
                  </div>

                  {/* Elegant Native Circular SVG Progress Indicator */}
                  <div className="my-6 flex flex-col items-center justify-center relative">
                    <svg className="w-36 h-36 transform -rotate-90">
                      {/* Gray track circle */}
                      <circle
                        cx="72"
                        cy="72"
                        r="60"
                        stroke="#e5e7eb"
                        strokeWidth="12"
                        fill="transparent"
                      />
                      {/* Green foreground circle representing passing rate */}
                      <circle
                        cx="72"
                        cy="72"
                        r="60"
                        stroke="#059669"
                        strokeWidth="12"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 60}
                        strokeDashoffset={2 * Math.PI * 60 * (1 - (results.length > 0 ? passPercentage / 100 : 0))}
                        className="transition-all duration-1000"
                      />
                    </svg>

                    <div className="absolute flex flex-col items-center">
                      <span className="text-2xl font-black text-emerald-700">{results.length > 0 ? `${passPercentage}%` : '0%'}</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Lulus KKM</span>
                    </div>
                  </div>

                  <div className="space-y-1 bg-gray-50 p-3 rounded-2xl text-[11px] font-sans">
                    <div className="flex justify-between text-gray-600">
                      <span>Memenuhi KKM (≥ 75):</span>
                      <strong className="text-emerald-700 font-semibold font-mono">{passCount} Siswa</strong>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Belum Tuntas (&lt; 75):</span>
                      <strong className="text-red-650 font-semibold font-mono">{results.length - passCount} Siswa</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Submissions Log */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 font-mono">
                  Sesi Ujian Selesai Terbaru
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-150 text-[11px] text-gray-450 uppercase font-mono tracking-wider font-semibold">
                        <th className="py-2.5">Siswa</th>
                        <th>Kelas</th>
                        <th>Mata Pelajaran</th>
                        <th>Waktu Selesai</th>
                        <th className="text-right">Skor Nilai</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {results.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-gray-400">
                            Belum ada rekap pengerjaan ujian siswa saat ini.
                          </td>
                        </tr>
                      ) : (
                        results.slice(0, 5).map((res) => (
                          <tr key={res.id} className="hover:bg-gray-50/50">
                            <td className="py-3 font-semibold text-gray-800">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{res.studentName}</span>
                                {res.violationsCount && res.violationsCount > 0 ? (
                                  <span className={`inline-flex items-center text-[8px] font-extrabold px-1 rounded border ${
                                    res.violationsCount >= 3
                                      ? 'bg-red-50 text-red-700 border-red-100'
                                      : 'bg-amber-50 text-amber-700 border-amber-100'
                                  }`}>
                                    ⚠️ {res.violationsCount}x
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td>{res.classGroup}</td>
                            <td>{res.examSubject}</td>
                            <td className="text-gray-500 text-xs font-mono">
                              {new Date(res.completedTime).toLocaleTimeString('id-ID')}
                            </td>
                            <td className="text-right font-mono">
                              <span
                                className={`font-bold p-1 px-2 text-xs rounded-lg ${
                                  res.score >= 75
                                    ? 'bg-emerald-50 text-emerald-800'
                                    : 'bg-red-50 text-red-800'
                                }`}
                              >
                                {res.score}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STUDENTS TAB */}
          {activeTab === 'students' && (
            <div className="space-y-6">
              
              {/* Form Add Student */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 font-mono">
                  Daftarkan Siswa Baru
                </h3>

                {studentError && (
                  <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2.5 rounded-xl mb-4 border border-red-100">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{studentError}</span>
                  </div>
                )}

                <form onSubmit={handleAddStudent} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                      Nama Lengkap Siswa
                    </label>
                    <input
                      type="text"
                      required
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      placeholder="Contoh: Ahmad Khoirul"
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                      Nomor Induk / NISN
                    </label>
                    <input
                      type="text"
                      required
                      value={newStudentNisn}
                      onChange={(e) => setNewStudentNisn(e.target.value)}
                      placeholder="Contoh: 202611599"
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                      Gender / Jenis Kelamin
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewStudentGender('Laki-laki')}
                        className={`py-2 px-1 text-xs font-semibold rounded-xl border transition-all ${
                          newStudentGender === 'Laki-laki'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        Laki-laki
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewStudentGender('Perempuan')}
                        className={`py-2 px-1 text-xs font-semibold rounded-xl border transition-all ${
                          newStudentGender === 'Perempuan'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        Perempuan
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                      Kelas
                    </label>
                    <input
                      type="text"
                      required
                      value={newStudentClass}
                      onChange={(e) => setNewStudentClass(e.target.value)}
                      placeholder="Contoh: XII IPA 2"
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                      Username Ujian
                    </label>
                    <input
                      type="text"
                      required
                      value={newStudentUser}
                      onChange={(e) => setNewStudentUser(e.target.value)}
                      placeholder="Saran: nama kecil"
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                      Password Ujian
                    </label>
                    <input
                      type="text"
                      required
                      value={newStudentPass}
                      onChange={(e) => setNewStudentPass(e.target.value)}
                      placeholder="Gunakan angka biasa"
                      className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    />
                  </div>

                  <div className="md:col-span-3 flex justify-end">
                    <button
                      type="submit"
                      className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1 uppercase"
                    >
                      <Plus className="w-4 h-4" />
                      Daftarkan Peserta
                    </button>
                  </div>
                </form>
              </div>

              {/* Table Student Register */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 font-mono">
                  Siswa Madrasah Terdaftar
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-150 text-[11px] text-gray-450 uppercase font-mono tracking-wider font-semibold">
                        <th className="py-3 px-3">Siswa</th>
                        <th className="py-3 px-3">NISN</th>
                        <th className="py-3 px-3">Kelas</th>
                        <th className="py-3 px-3">Jenis Kelamin</th>
                        <th className="py-3 px-3">Kredensial Log</th>
                        <th className="py-3 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {students.map((std) => (
                        <tr key={std.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3.5 px-3 align-middle font-semibold text-gray-800">{std.name}</td>
                          <td className="py-3.5 px-3 align-middle font-mono text-xs">{std.nisn}</td>
                          <td className="py-3.5 px-3 align-middle">{std.classGroup}</td>
                          <td className="py-3.5 px-3 align-middle">{std.gender}</td>
                          <td className="py-3.5 px-3 align-middle text-xs">
                            <div className="space-y-0.5">
                              <div>Username: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-emerald-800 font-bold font-mono">{std.username}</code></div>
                              <div>Pass: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-600 font-mono">{std.password}</code></div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 align-middle text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => startEditStudent(std)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-700 hover:text-emerald-800 rounded-xl text-xs font-bold transition-all border border-emerald-100 cursor-pointer shadow-xs"
                                title="Edit Siswa"
                              >
                                <Edit className="w-4 h-4 shrink-0" />
                                <span>Edit</span>
                              </button>
                              {std.username !== 'janur' && std.id !== 'user_1' ? (
                                <button
                                  onClick={() => handleDeleteStudent(std.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 active:scale-95 text-red-650 hover:text-red-750 rounded-xl text-xs font-bold transition-all border border-red-100 cursor-pointer shadow-xs"
                                  title="Hapus Siswa"
                                >
                                  <Trash2 className="w-4 h-4 shrink-0" />
                                  <span>Hapus</span>
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold tracking-wide uppercase text-gray-400 bg-gray-100 border border-gray-200 py-1.5 px-2.5 rounded-xl block text-center shadow-2xs font-mono">
                                  Permanen
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* EXAMS TAB (Bank Soal) */}
          {activeTab === 'exams' && (
            <div className="space-y-6">
              
              {/* Add Exam Package Form */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider font-mono">
                      Buat Paket Ujian Baru
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5 font-sans">Mendukung pembuatan kosong atau diimpor langsung dengan isi butir soal dari file.</p>
                  </div>

                  {/* Switcher Metode Pembuatan Paket */}
                  <div className="flex bg-gray-100 p-1 rounded-xl self-start sm:self-center border border-gray-200">
                    <button
                      onClick={() => {
                        setExamCreationMethod('manual');
                        setNewExamFileError(null);
                        setNewExamFileSuccess(null);
                      }}
                      type="button"
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        examCreationMethod === 'manual'
                          ? 'bg-white text-emerald-850 shadow-xs border border-gray-200/50'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      ✍️ Buat Kosong
                    </button>
                    <button
                      onClick={() => {
                        setExamCreationMethod('upload');
                        setNewExamFileError(null);
                        setNewExamFileSuccess(null);
                      }}
                      type="button"
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        examCreationMethod === 'upload'
                          ? 'bg-white text-emerald-850 shadow-xs border border-gray-200/50'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      📤 Impor Langsung File
                    </button>
                  </div>
                </div>

                <form onSubmit={handleAddExam} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                        Judul / Nama Ujian
                      </label>
                      <input
                        type="text"
                        required
                        value={newExamTitle}
                        onChange={(e) => setNewExamTitle(e.target.value)}
                        placeholder="Contoh: Ujian Tengah Semester (UTS) Fiqih Ganjil"
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                        Mata Pelajaran
                      </label>
                      <select
                        value={newExamSubject}
                        onChange={(e) => setNewExamSubject(e.target.value)}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-sans"
                      >
                        <option value="Fiqih">Fiqih</option>
                        <option value="Matematika">Matematika</option>
                        <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                        <option value="Akidah Akhlak">Akidah Akhlak</option>
                        <option value="Sejarah Kebudayaan Islam">Sejarah Kebudayaan Islam (SKI)</option>
                        <option value="Lainnya">Lainnya / Umum</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                        Target Kelas
                      </label>
                      <select
                        value={newExamTargetClass}
                        onChange={(e) => setNewExamTargetClass(e.target.value)}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-sans"
                      >
                        <option value="Semua Kelas">Semua Kelas</option>
                        {uniqueClasses.map((cls) => (
                          <option key={cls} value={cls}>{cls}</option>
                        ))}
                        <option value="custom">✍️ Tulis Manual...</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                        Durasi Waktu Ujian (Menit)
                      </label>
                      <input
                        type="number"
                        required
                        min={5}
                        max={180}
                        value={newExamDuration}
                        onChange={(e) => setNewExamDuration(Number(e.target.value))}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-sans"
                      />
                    </div>

                    {newExamTargetClass === 'custom' && (
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1">
                          Tulis Kelas Baru / Custom
                        </label>
                        <input
                          type="text"
                          required
                          value={customTargetClass}
                          onChange={(e) => setCustomTargetClass(e.target.value)}
                          placeholder="Masukkan nama kelas target, contoh: XII-IPA-3"
                          className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-sans"
                        />
                      </div>
                    )}
                  </div>

                  {examCreationMethod === 'upload' && (
                    <div className="pt-4 border-t border-gray-150 space-y-4">
                      <div className="flex flex-col gap-1">
                        <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider font-mono">
                          File Soal Untuk Paket Ujian ini
                        </label>
                        <span className="text-xs text-gray-450">Format didukung: <strong>Word (.docx)</strong>, <strong>Word/Notepad (.txt)</strong>, <strong>Excel (.csv)</strong>, atau <strong>JSON (.json)</strong></span>
                      </div>

                      {newExamFileError && (
                        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 p-3 rounded-2xl border border-red-100">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{newExamFileError}</span>
                        </div>
                      )}

                      {newExamFileSuccess && (
                        <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                          <CheckCircle className="w-4 h-4 shrink-0" />
                          <span>{newExamFileSuccess}</span>
                        </div>
                      )}

                      {/* Drag & Drop Visual Box for NEW EXAM */}
                      <div
                        onDragOver={handleNewExamDragOver}
                        onDragLeave={handleNewExamDragLeave}
                        onDrop={handleNewExamDrop}
                        className={`border-2 border-dashed rounded-3xl p-6 text-center transition-all relative ${
                          newExamDragActive
                            ? 'border-emerald-500 bg-emerald-50/40'
                            : 'border-gray-250 hover:border-emerald-500 bg-white hover:bg-emerald-50/[0.01]'
                        }`}
                      >
                        <input
                          id="new-exam-file-input"
                          type="file"
                          accept=".json,.csv,.txt,.docx"
                          onChange={handleNewExamFileChange}
                          className="hidden"
                        />
                        <label htmlFor="new-exam-file-input" className="cursor-pointer flex flex-col items-center">
                          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                            <Upload className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold text-gray-700 block select-none">
                            Tarik & lepas file Anda di sini, atau <span className="text-emerald-700 underline font-semibold">pilih file</span>
                          </span>
                        </label>
                      </div>

                       {/* Downloads help details */}
                      <div className="flex flex-col gap-3 py-4 px-4 bg-amber-50/50 border border-amber-100 rounded-2xl">
                        <span className="text-[11px] text-amber-800 font-sans leading-relaxed">
                          💡 <strong>Tips Guru:</strong> Sekarang Bapak/Ibu guru bisa langsung mengunggah file <strong>Microsoft Word (.docx)</strong> asli, dokumen teks biasa <strong>(.txt)</strong>, atau menggunakan spreadsheet <strong>Excel (.csv)</strong>. Cukup ketik soal secara alami di Word dengan opsi A/B/C/D/E dan kunci jawaban di bawah masing-masing soal!
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleDownloadDocxTemplate}
                            className="bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 py-1.5 px-3 rounded-lg text-xs font-bold transition-all shrink-0 font-sans shadow-2xs flex items-center gap-1.5"
                          >
                            🔵 Download Contoh Word (.DOCX)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const templateText = `=== PANDUAN MENULIS SOAL DI WORD / NOTEPAD (.TXT) ===\n` +
                                `Cukup ketik secara alami seperti biasa. Pisahkan antar soal dengan menekan ENTER dua kali (baris kosong).\n\n` +
                                `[FORMAT PILIHAN GANDA]\n` +
                                `Gunakan huruf opsi A., B., C., D., E. lalu diakhiri dengan Kunci: JAWABAN_KUNCI.\n` +
                                `Contoh:\n` +
                                `1. Berikut adalah rukun Islam yang pertama yaitu...\n` +
                                `A. Membaca Syahadat\n` +
                                `B. Mendirikan Shalat\n` +
                                `C. Zakat\n` +
                                `D. Puasa\n` +
                                `E. Haji\n` +
                                `Kunci: A\n\n` +
                                `2. Berapakah jumlah rakaat shalat fardhu subuh?\n` +
                                `A. 1 Rakaat\n` +
                                `B. 2 Rakaat\n` +
                                `C. 3 Rakaat\n` +
                                `D. 4 Rakaat\n` +
                                `E. 5 Rakaat\n` +
                                `Kunci: B\n\n` +
                                `[FORMAT ESAI / URAIAN MANDIRI]\n` +
                                `Tulis langsung pertanyaan esai Anda tanpa mencantumkan pilihan ganda (A, B, C, D, E) dan baris Kunci.\n` +
                                `Contoh:\n` +
                                `3. Jelaskan hubungan timbal balik antara iman, islam, dan ihsan dalam kehidupan sehari-hari seorang mukmin!\n\n` +
                                `👉 INFORMASI BAGAIMANA SISWA MENJAWAB SOAL ESAI:\n` +
                                `- Di mana siswa meletakkan jawaban esai? Saat ujian CBT berlangsung, sistem akan otomatis menyediakan kotak isian jawaban gratis (Text Area) langsung di bawah pertanyaan di layar HP/Laptop siswa.\n` +
                                `- Siswa mengetikkan jawabannya di sana saat tes. Oleh karena itu, Bapak/Ibu guru TIDAK PERLU membuat ruang kosong/titik-titik ataupun baris kunci jawaban untuk soal esai di file template ini.\n`;
                              const blob = new Blob([templateText], { type: 'text/plain;charset=utf-8' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = 'template_soal_word_notepad.txt';
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }}
                            className="bg-white hover:bg-amber-100/50 hover:text-amber-900 border border-amber-200 text-amber-850 py-1.5 px-3 rounded-lg text-xs font-bold transition-all shrink-0 font-sans shadow-2xs flex items-center gap-1"
                          >
                            📝 Download Contoh Word/Notepad (.TXT)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const templateText = `"Pertanyaan";"Pilihan A";"Pilihan B";"Pilihan C";"Pilihan D";"Pilihan E";"Kunci Jawaban"\n` +
                                `"Berikut rukun Islam yang pertama yaitu...";"Membaca Syahadat";"Mendirikan Shalat";"Zakat";"Puasa";"Haji";"A"\n` +
                                `"Berapakah rakaat shalat fardhu subuh?";"1 Rakaat";"2 Rakaat";"3 Rakaat";"4 Rakaat";"5 Rakaat";"B"\n`;
                              const blob = new Blob([templateText], { type: 'text/csv;charset=utf-8' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = 'template_soal_excel.csv';
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }}
                            className="bg-white hover:bg-emerald-100/50 hover:text-emerald-900 border border-emerald-250 text-emerald-850 py-1.5 px-3 rounded-lg text-xs font-bold transition-all shrink-0 font-sans shadow-2xs flex items-center gap-1"
                          >
                            📊 Download Contoh Excel (.CSV)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const template = [
                                {
                                  text: "Berikut adalah rukun Islam yang pertama yaitu...",
                                  correctAnswer: "A",
                                  options: [
                                    { letter: "A", text: "Membaca Syahadat" },
                                    { letter: "B", text: "Mendirikan Shalat" },
                                    { letter: "C", text: "Zakat" },
                                    { letter: "D", text: "Puasa" },
                                    { letter: "E", text: "Haji" }
                                  ]
                                },
                                {
                                  text: "Berapakah rakaat shalat fardhu subuh?",
                                  correctAnswer: "B",
                                  options: [
                                    { letter: "A", text: "1 Rakaat" },
                                    { letter: "B", text: "2 Rakaat" },
                                    { letter: "C", text: "3 Rakaat" },
                                    { letter: "D", text: "4 Rakaat" },
                                    { letter: "E", text: "5 Rakaat" }
                                  ]
                                }
                              ];
                              const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json;charset=utf-8' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = 'template_soal_cbt.json';
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }}
                            className="bg-white hover:bg-gray-50 border border-gray-250 text-gray-750 py-1.5 px-3 rounded-lg text-xs font-bold transition-all shrink-0 font-sans shadow-2xs"
                          >
                            ⚙️ Download JSON
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end border-t border-gray-100 pt-4">
                    <button
                      type="submit"
                      className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all uppercase flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      {examCreationMethod === 'upload' ? 'Buat Paket & Impor Soal' : 'Buat Paket Ujian'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Grid of Exams List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exams.map((ex) => {
                  const isSelectForQ = selectedExamIdForQuestions === ex.id;
                  return (
                    <div
                      key={ex.id}
                      className={`p-5 rounded-3xl border transition-all ${
                        isSelectForQ
                          ? 'bg-gradient-to-br from-white to-emerald-50/20 border-emerald-500'
                          : 'bg-white border-gray-100 hover:border-gray-200 shadow-5xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5 mb-2">
                        <div className="flex flex-wrap gap-1">
                          <span className="p-1 px-2.5 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                            {ex.subject}
                          </span>
                          <span className={`p-1 px-2.5 rounded-lg text-[10px] font-bold tracking-wider uppercase border ${
                            !ex.targetClass || ex.targetClass === 'Semua Kelas'
                              ? 'bg-blue-50 text-blue-700 border-blue-100/50'
                              : 'bg-amber-50 text-amber-800 border-amber-150'
                          }`}>
                            🎯 {ex.targetClass || 'Semua Kelas'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setSelectedExamIdForQuestions(ex.id)}
                            className={`p-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                              isSelectForQ
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                            }`}
                            title="Kelola Butir Soal"
                          >
                            <Eye className="w-4 h-4" />
                            Kelola Soal
                          </button>
                          {currentUserRole === 'admin' && (
                            <button
                              onClick={() => handleDeleteExam(ex.id)}
                              className="p-1.5 text-red-650 hover:bg-red-50 rounded-xl transition-all"
                              title="Hapus Paket"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <h4 className="text-base font-bold text-gray-800 tracking-tight leading-snug">
                        {ex.title}
                      </h4>

                      <div className="flex justify-between items-center text-xs mt-4 pt-4 border-t border-gray-100 text-gray-500">
                        <span className="font-semibold font-mono text-emerald-700">
                          {ex.questions.length} Butir Soal
                        </span>
                        <span>
                          Durasi: <strong className="text-gray-700">{ex.durationMinutes} Menit</strong>
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between bg-gray-50/70 hover:bg-gray-50 p-2 px-3 rounded-2xl border border-gray-150/40 text-[11px] transition-all">
                        <div className="flex items-center gap-1.5 w-full">
                          <span className="font-bold text-gray-400 uppercase tracking-wide text-[9px] shrink-0 font-mono">Bagi Ke:</span>
                          <select
                            value={ex.targetClass || 'Semua Kelas'}
                            onChange={(e) => {
                              const updatedClass = e.target.value;
                              onUpdateExams(
                                exams.map((exam) =>
                                  exam.id === ex.id ? { ...exam, targetClass: updatedClass } : exam
                                )
                              );
                            }}
                            className="bg-transparent text-gray-700 font-bold focus:outline-none cursor-pointer w-full text-left"
                          >
                            <option value="Semua Kelas">Semua Kelas (Umum)</option>
                            {uniqueClasses.map((cls) => (
                              <option key={cls} value={cls}>{cls}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Question Editor section for selected exam */}
              {selectedExamIdForQuestions && (
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-200">
                  <div className="flex justify-between items-start pb-4 border-b border-gray-100 mb-6">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 font-mono uppercase tracking-wider">Kelola Bank Soal</span>
                      <h3 className="text-base font-extrabold text-gray-800 leading-snug mt-0.5">
                        {exams.find((ex) => ex.id === selectedExamIdForQuestions)?.title}
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelectedExamIdForQuestions(null)}
                      className="p-1 text-xs font-semibold bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-600"
                    >
                      Selesai Kelola
                    </button>
                  </div>

                  {/* Selector Metode Input */}
                  <div className="flex flex-col sm:flex-row gap-2 mb-6">
                    <button
                      onClick={() => {
                        setInputMethod('manual');
                        setUploadError(null);
                        setUploadSuccess(null);
                      }}
                      type="button"
                      className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                        inputMethod === 'manual'
                          ? 'bg-emerald-600 text-white border-emerald-650 shadow-md shadow-emerald-600/10'
                          : 'bg-white border-gray-200 text-gray-650 hover:bg-gray-50'
                      }`}
                    >
                      ✍️ Input Satu Per Satu (Manual)
                    </button>
                    <button
                      onClick={() => {
                        setInputMethod('upload');
                        setUploadError(null);
                        setUploadSuccess(null);
                      }}
                      type="button"
                      className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                        inputMethod === 'upload'
                          ? 'bg-emerald-600 text-white border-emerald-650 shadow-md shadow-emerald-600/10'
                          : 'bg-white border-gray-200 text-gray-650 hover:bg-gray-50'
                      }`}
                    >
                      📤 Upload File / Impor Masal (JSON / CSV-Text)
                    </button>
                  </div>

                  {inputMethod === 'manual' && (
                    <form onSubmit={handleAddQuestion} className="space-y-4 mb-8 bg-gray-50/50 p-5 rounded-2xl border border-gray-200/50">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">
                        Input Butir Soal Baru
                      </h4>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                          Teks Soal / Pertanyaan
                        </label>
                        <textarea
                          required
                          rows={3}
                          value={newQText}
                          onChange={(e) => setNewQText(e.target.value)}
                          placeholder="Ketik isi pertanyaan ujian di sini..."
                          className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-sans"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                          Tipe Soal
                        </label>
                        <div className="flex gap-6 p-2 bg-white rounded-xl border border-gray-150 w-fit">
                          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
                            <input
                              type="radio"
                              name="newQType"
                              checked={newQType === 'mc'}
                              onChange={() => setNewQType('mc')}
                              className="w-4 h-4 accent-emerald-600 focus:ring-0"
                            />
                            Pilihan Ganda (MCQ)
                          </label>
                          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
                            <input
                              type="radio"
                              name="newQType"
                              checked={newQType === 'essay'}
                              onChange={() => setNewQType('essay')}
                              className="w-4 h-4 accent-emerald-600 focus:ring-0"
                            />
                            Esai / Uraian (Isian Jawaban Siswa)
                          </label>
                        </div>
                      </div>

                      {newQType === 'mc' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Pilihan A</label>
                            <input
                              type="text"
                              required={newQType === 'mc'}
                              value={newQOptA}
                              onChange={(e) => setNewQOptA(e.target.value)}
                              placeholder="Nilai Pilihan A"
                              className="w-full p-2.5 bg-white border border-gray-250 rounded-xl text-xs sm:text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Pilihan B</label>
                            <input
                              type="text"
                              required={newQType === 'mc'}
                              value={newQOptB}
                              onChange={(e) => setNewQOptB(e.target.value)}
                              placeholder="Nilai Pilihan B"
                              className="w-full p-2.5 bg-white border border-gray-250 rounded-xl text-xs sm:text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Pilihan C</label>
                            <input
                              type="text"
                              required={newQType === 'mc'}
                              value={newQOptC}
                              onChange={(e) => setNewQOptC(e.target.value)}
                              placeholder="Nilai Pilihan C"
                              className="w-full p-2.5 bg-white border border-gray-250 rounded-xl text-xs sm:text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Pilihan D</label>
                            <input
                              type="text"
                              value={newQOptD}
                              onChange={(e) => setNewQOptD(e.target.value)}
                              placeholder="Nilai Pilihan D (Boleh kosong)"
                              className="w-full p-2.5 bg-white border border-gray-250 rounded-xl text-xs sm:text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Pilihan E</label>
                            <input
                              type="text"
                              value={newQOptE}
                              onChange={(e) => setNewQOptE(e.target.value)}
                              placeholder="Nilai Pilihan E (Boleh kosong)"
                              className="w-full p-2.5 bg-white border border-gray-250 rounded-xl text-xs sm:text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Jawaban yang Benar</label>
                            <select
                              value={newQCorrect}
                              onChange={(e) => setNewQCorrect(e.target.value as 'A' | 'B' | 'C' | 'D' | 'E')}
                              className="w-full p-2.5 bg-white border border-gray-250 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-emerald-500"
                            >
                              <option value="A">Pilihan A</option>
                              <option value="B">Pilihan B</option>
                              <option value="C">Pilihan C</option>
                              <option value="D">Pilihan D</option>
                              <option value="E">Pilihan E</option>
                            </select>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all uppercase flex items-center justify-center gap-1"
                        >
                          <Plus className="w-4 h-4" />
                          Tambah Soal Ke Paket
                        </button>
                      </div>
                    </form>
                  )}

                  {inputMethod === 'upload' && (
                    <div className="space-y-4 mb-8 bg-gray-50/50 p-5 rounded-3xl border border-gray-200/50">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono flex items-center gap-2">
                        <Upload className="w-4 h-4 text-emerald-600" />
                        Impor Soal Masal dari File (.docx, .txt, .csv, .json)
                      </h4>

                      {uploadError && (
                        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 p-3 rounded-2xl border border-red-100">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{uploadError}</span>
                        </div>
                      )}

                      {uploadSuccess && (
                        <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                          <CheckCircle className="w-4 h-4 shrink-0" />
                          <span>{uploadSuccess}</span>
                        </div>
                      )}

                      {/* Drag & Drop Visual Box */}
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all relative ${
                          dragActive
                            ? 'border-emerald-500 bg-emerald-50/40'
                            : 'border-gray-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/[0.02]'
                        }`}
                      >
                        <input
                          id="question-file-input"
                          type="file"
                          accept=".json,.csv,.txt,.docx"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <label htmlFor="question-file-input" className="cursor-pointer flex flex-col items-center">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                            <Upload className="w-6 h-6" />
                          </div>
                          <span className="text-sm font-bold text-gray-800 block">
                            Tarik & lepas file Anda di sini, atau <span className="text-emerald-700 underline font-semibold">pilih file</span>
                          </span>
                          <span className="text-xs text-gray-400 mt-1 block font-sans">
                            Mendukung file format <strong>Word (.docx)</strong>, <strong>Word / Notepad (.txt)</strong>, <strong>Excel (.csv)</strong>, atau <strong>JSON (.json)</strong>
                          </span>
                        </label>
                      </div>

                      {/* Petunjuk Format & Template */}
                      <div className="bg-white p-5 rounded-2xl border border-gray-150 space-y-4">
                        <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5 font-mono">
                          <HelpCircle className="w-4 h-4 text-amber-500" />
                          Panduan Mengetik Soal (Sangat Mudah Untuk Guru!)
                        </h5>

                        {/* Full-width explanation for Essay */}
                        <div className="p-3 bg-blue-50/80 border border-blue-100 rounded-xl flex items-start gap-2.5 text-blue-900 shadow-sm leading-relaxed">
                          <span className="text-base select-none">✍️</span>
                          <div className="space-y-0.5">
                            <span className="font-bold text-[11px] block text-blue-950">Info Fitur Baru: Menulis Soal Esai / Uraian</span>
                            <p className="text-[10px] leading-relaxed text-blue-800">
                              Bapak/Ibu sekarang bisa mengunggah soal <strong>Esai (Uraian Mandiri)</strong>. Cukup tulis pertanyaan esai secara alami tanpa menuliskan pilihan ganda (A, B, C, D, E) dan tanpa menulis Kunci jawaban. Sistem akan mendeteksinya secara otomatis dan menyiapkannya sebagai soal esai dengan lembar kotak jawaban bagi siswa.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          {/* Word/Notepad style block */}
                          <div className="space-y-2 border-r border-gray-100 pr-2">
                            <span className="font-bold text-emerald-800 block text-[11px]">📝 Cara 1: Menggunakan Microsoft Word / Notepad (.TXT)</span>
                            <p className="text-gray-450 leading-relaxed text-[11px]">
                              Bapak/Ibu bisa mengetik soal secara alami di Microsoft Word, lalu pilih menu <strong>Save As &rarr; Plain Text (.txt)</strong>. Pisahkan antar soal dengan baris kosong:
                            </p>
                            <pre className="p-3 bg-gray-50 rounded-xl overflow-x-auto text-[10px] font-mono text-emerald-950 border border-gray-100 select-all leading-normal text-left h-28 overflow-y-auto">
{`1. Apa rukun Islam yang pertama?
A. Membaca Syahadat
B. Shalat
C. Zakat
D. Puasa
E. Haji
Kunci: A

2. Shalat ashar ada berapa rakaat?
A. 1 rakaat
B. 2 rakaat
C. 3 rakaat
D. 4 rakaat
E. 5 rakaat
Kunci: D`}
                            </pre>
                          </div>

                          {/* Semicolon format */}
                          <div className="space-y-2">
                            <span className="font-bold text-blue-800 block text-[11px]">📊 Cara 2: Menggunakan Excel (.CSV)</span>
                            <p className="text-gray-450 leading-relaxed text-[11px]">
                              Bapak/Ibu juga bisa menulis di Microsoft Excel lalu pilih <strong>Save As &rarr; CSV (Comma delimited / Semicolon-Separated)</strong>:
                            </p>
                            <pre className="p-3 bg-gray-50 rounded-xl overflow-x-auto text-[10px] font-mono text-emerald-950 border border-gray-100 select-all leading-normal text-left h-28 overflow-y-auto">
{`"Pertanyaan";"A";"B";"C";"D";"E";"Kunci"
"Apa rukun Islam ke-1?";"Syahadat";"Shalat";"Zakat";"Puasa";"Haji";"A"
"Fardhu Subuh berapa rakaat?";"1";"2";"3";"4";"5";"B"`}
                            </pre>
                            <span className="text-[10px] text-gray-400 block leading-tight font-sans">
                              * Susun urutan: Pertanyaan, Pilihan A, B, C, D, E, dan Kolom terakhir: Kunci Jawaban (A/B/C/D/E)
                            </span>
                          </div>
                        </div>

                        {/* Interactive template generator/downloader */}
                        <div className="pt-3 border-t border-gray-150 flex flex-col sm:flex-row gap-3 justify-between items-center">
                          <span className="text-[11px] text-amber-800 bg-amber-50 rounded-lg p-1.5 px-3 block">
                            💡 <strong>Keuntungan:</strong> Bapak/Ibu tidak perlu menginput satu-persatu lagi. Cukup ketik semua soal dalam 1 file lantas unggah di atas!
                          </span>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={handleDownloadDocxTemplate}
                              className="p-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5"
                            >
                              =5 Download Contoh Word (.DOCX)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const templateText = `=== PANDUAN MENULIS SOAL DI WORD / NOTEPAD (.TXT) ===\n` +
                                  `Cukup ketik secara alami seperti biasa. Pisahkan antar soal dengan menekan ENTER dua kali (baris kosong).\n\n` +
                                  `[FORMAT PILIHAN GANDA]\n` +
                                  `Gunakan huruf opsi A., B., C., D., E. lalu diakhiri dengan Kunci: JAWABAN_KUNCI.\n` +
                                  `Contoh:\n` +
                                  `1. Berikut adalah rukun Islam yang pertama yaitu...\n` +
                                  `A. Membaca Syahadat\n` +
                                  `B. Mendirikan Shalat\n` +
                                  `C. Zakat\n` +
                                  `D. Puasa\n` +
                                  `E. Haji\n` +
                                  `Kunci: A\n\n` +
                                  `2. Berapakah jumlah rakaat shalat fardhu subuh?\n` +
                                  `A. 1 Rakaat\n` +
                                  `B. 2 Rakaat\n` +
                                  `C. 3 Rakaat\n` +
                                  `D. 4 Rakaat\n` +
                                  `E. 5 Rakaat\n` +
                                  `Kunci: B\n\n` +
                                  `[FORMAT ESAI / URAIAN MANDIRI]\n` +
                                  `Tulis langsung pertanyaan esai Anda tanpa mencantumkan pilihan ganda (A, B, C, D, E) dan baris Kunci.\n` +
                                  `Contoh:\n` +
                                  `3. Jelaskan hubungan timbal balik antara iman, islam, dan ihsan dalam kehidupan sehari-hari seorang mukmin!\n\n` +
                                  `👉 INFORMASI BAGAIMANA SISWA MENJAWAB SOAL ESAI:\n` +
                                  `- Di mana siswa meletakkan jawaban esai? Saat ujian CBT berlangsung, sistem akan otomatis menyediakan kotak isian jawaban gratis (Text Area) langsung di bawah pertanyaan di layar HP/Laptop siswa.\n` +
                                  `- Siswa mengetikkan jawabannya di sana saat tes. Oleh karena itu, Bapak/Ibu guru TIDAK PERLU membuat ruang kosong/titik-titik ataupun baris kunci jawaban untuk soal esai di file template ini.\n`;
                                const blob = new Blob([templateText], { type: 'text/plain;charset=utf-8' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'template_soal_word_notepad.txt';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              }}
                              className="p-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-850 text-[11px] font-bold rounded-lg transition-all"
                            >
                              📝 Download Template Word (.TXT)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const templateText = `"Pertanyaan";"Pilihan A";"Pilihan B";"Pilihan C";"Pilihan D";"Pilihan E";"Kunci Jawaban"\n` +
                                  `"Matahari terbit dari arah mana?";"Timur";"Barat";"Selatan";"Utara";"Tengah";"A"\n` +
                                  `"Berapakah hasil dari 5 dikali 9?";"40";"45";"50";"55";"60";"B"\n`;
                                const blob = new Blob([templateText], { type: 'text/csv;charset=utf-8' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'template_soal_excel.csv';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              }}
                              className="p-2 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-[11px] font-bold rounded-lg transition-all"
                            >
                              📊 Download Template Excel (.CSV)
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Existing questions preview list */}
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-mono mb-4">
                    Butir Soal yang Tersimpan ({exams.find((ex) => ex.id === selectedExamIdForQuestions)?.questions.length})
                  </h4>

                  <div className="space-y-4">
                    {exams.find((ex) => ex.id === selectedExamIdForQuestions)?.questions.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-xs">
                        Belum ada soal pada paket ini. Harap input soal baru di formulir atas.
                      </div>
                    ) : (
                      exams.find((ex) => ex.id === selectedExamIdForQuestions)?.questions.map((question, idx) => (
                        <div key={question.id} className="p-4 rounded-2xl border border-gray-150 relative bg-white hover:shadow-2xs">
                          <button
                            onClick={() => handleDeleteQuestion(question.id)}
                            className="absolute top-3 right-3 p-1.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="Hapus Soal"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <div className="text-xs font-bold text-emerald-800 font-mono">
                            SOAL NOMOR #{idx + 1}
                          </div>

                          <div className="text-sm font-semibold text-gray-800 mt-2 whitespace-pre-line leading-relaxed pr-6 select-text">
                            {idx + 1}. {question.text}
                          </div>

                          {isQuestionEssay(question) ? (
                            <div className="mt-3 p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl text-blue-900 text-xs font-semibold flex items-center gap-2">
                              <span>📝</span> Tipe Soal: Esai / Uraian (Pengerjaan mandiri tanpa pilihan ganda)
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 mt-4 text-xs text-gray-600 font-sans">
                              {question.options.map((opt) => {
                                const isCorrect = opt.letter === question.correctAnswer;
                                return (
                                  <div
                                    key={opt.letter}
                                    className={`p-2 rounded-xl border ${
                                      isCorrect ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-900' : 'border-gray-200'
                                    }`}
                                  >
                                    <span className="font-mono font-bold">{opt.letter}.</span> {opt.text}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ACTIVE TOKENS & CONTROLS TAB */}
          {activeTab === 'tokens' && (
            <div className="space-y-6">
              
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider font-mono">
                      Kontrol Sesi & Token Ujian Aktif
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Atur status keaktifan paket ujian di akun siswa dan acak token disini.</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-150 text-[11px] text-gray-450 uppercase font-mono tracking-wider font-semibold">
                        <th className="py-2.5">Nama Ujian</th>
                        <th>Mapel</th>
                        <th>Status Siswa</th>
                        <th className="text-center font-mono">Token Aktif</th>
                        <th className="text-right">Tindakan Token</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {exams.map((ex) => (
                        <tr key={ex.id} className="hover:bg-gray-50/50">
                          <td className="py-4">
                            <strong className="text-gray-800 block text-sm tracking-tight leading-snug">{ex.title}</strong>
                            <span className="text-[10px] text-gray-400 block font-mono">{ex.questions.length} Soal | {ex.durationMinutes} Menit</span>
                          </td>
                          <td>
                            <span className="p-1 px-2 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase">
                              {ex.subject}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => handleToggleExamActive(ex.id)}
                              className={`p-1 px-3.5 rounded-full text-xs font-bold transition-all ${
                                ex.isActive
                                  ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                                  : 'bg-red-50 hover:bg-red-100 text-red-800'
                              }`}
                            >
                              {ex.isActive ? 'Sudah Aktif' : 'Nonaktif'}
                            </button>
                          </td>
                          <td className="text-center font-mono">
                            <span className="p-1 px-3.5 bg-amber-50 rounded-xl text-amber-700 font-extrabold text-sm tracking-widest border border-amber-100 shadow-3xs">
                              {ex.token}
                            </span>
                          </td>
                          <td className="text-right">
                            <button
                              onClick={() => handleRandomizeToken(ex.id)}
                              className="p-1.5 font-semibold bg-gray-100 hover:bg-emerald-50 rounded-xl hover:text-emerald-700 text-gray-500 transition-all flex items-center gap-1 text-xs ml-auto"
                              title="Hubungkan token baru"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                              Acak Token
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* EXAM RESULTS RECAP TAB */}
          {activeTab === 'results' && (
            <div className="space-y-6">
              
              {/* Tool Sinkronisasi & Impor Hasil Offline */}
              <div className="bg-gradient-to-r from-amber-50 to-amber-100/30 rounded-3xl p-5 border border-amber-200/50 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-sans mb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1 px-2.5 rounded-lg bg-amber-200 text-amber-900 text-[10px] font-extrabold uppercase tracking-wider">
                      OFFLINE INTEGRATION TOOL
                    </span>
                    <span className="text-xs font-bold text-amber-800">
                      Sinkronisasi & Impor Hasil Ujian Mandiri
                    </span>
                  </div>
                  <p className="text-xs text-gray-650 leading-relaxed max-w-2xl">
                    Sekolah tanpa internet? Guru bisa mengambil berkas hasil (<strong className="font-mono">HASIL_CBT_*.json</strong>) yang diunduh siswa dari komputernya lewat flashdisk/USB, lalu klik tombol impor di bawah ini untuk menggabungkan seluruh hasil ke rekap utama. Anda juga bisa mengekspor database lokal komputer ini.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowTechnicianGuide(true)}
                    className="bg-amber-100/80 hover:bg-amber-200 text-amber-900 border border-amber-300 py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Lihat Buku Manual setting jaringan PC, HP, dan Alur Ujian Offline"
                  >
                    📖 Panduan Teknisi
                  </button>

                  <label className="bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md cursor-pointer select-none">
                    📥 Impor Berkas Siswa (.json)
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportOfflineFiles}
                      multiple
                      className="hidden"
                    />
                  </label>
                  
                  <button
                    type="button"
                    onClick={handleBackupComputerDatabase}
                    className="bg-zinc-800 hover:bg-zinc-900 text-amber-300 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-zinc-700 cursor-pointer text-center shadow-sm"
                    title="Unduh semua database rekap, bank soal, dan siswa di komputer ini"
                  >
                    💾 Cadangkan Database (.json)
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-2 border-b border-gray-50">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider font-mono">
                    Rekapitulasi Hasil Jawaban Siswa
                  </h3>
                  {results.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handlePrintRecap}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer font-sans"
                      >
                        🖨️ Cetak Rekap Nilai (PDF)
                      </button>
                      <button
                        onClick={handleExportResultsCSV}
                        className="bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer font-sans"
                      >
                        📊 Ekspor ke Excel (.CSV)
                      </button>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-150 text-[11px] text-gray-450 uppercase font-mono tracking-wider font-semibold">
                        <th className="py-2.5">Siswa</th>
                        <th>Ujian</th>
                        <th>Benar/Total</th>
                        <th>Skor</th>
                        <th>Waktu Selesai</th>
                        <th className="text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {results.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-gray-400">
                            Belum ada rekap pengerjaan ujian siswa saat ini.
                          </td>
                        </tr>
                      ) : (
                        results.map((res) => (
                          <tr key={res.id} className="hover:bg-gray-50/50">
                            <td className="py-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <strong className="text-gray-800 block text-sm">{res.studentName}</strong>
                                {res.violationsCount && res.violationsCount > 0 ? (
                                  <span className={`inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border ${
                                    res.violationsCount >= 3
                                      ? 'bg-red-100 text-red-800 border-red-200'
                                      : 'bg-amber-100 text-amber-800 border-amber-200'
                                  }`}>
                                    ⚠️ {res.violationsCount}x Keluar
                                  </span>
                                ) : null}
                              </div>
                              <span className="text-[10px] text-gray-400 block font-mono">NISN: {res.studentNisn} | {res.classGroup}</span>
                            </td>
                            <td>
                              <span className="font-semibold text-gray-700 block leading-tight">{res.examTitle}</span>
                              <span className="text-[10px] text-emerald-800 px-1.5 py-0.5 bg-emerald-50 rounded font-bold uppercase">{res.examSubject}</span>
                            </td>
                            <td className="font-mono text-xs">
                              {res.correctCount} / {res.totalQuestions} Soal
                            </td>
                            <td className="font-mono font-bold">
                              <span
                                className={`p-1 px-2.5 text-xs rounded-xl font-bold ${
                                  res.score >= 75
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                    : 'bg-red-50 text-red-800 border border-red-100'
                                }`}
                              >
                                {res.score}
                              </span>
                            </td>
                            <td className="text-gray-500 text-xs font-mono">
                              {new Date(res.completedTime).toLocaleDateString('id-ID')}<br/>
                              {new Date(res.completedTime).toLocaleTimeString('id-ID')}
                            </td>
                            <td className="text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => setViewResultDetail(res)}
                                  className="p-1 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                >
                                  Detil
                                </button>
                                <button
                                  onClick={() => handleResetResult(res.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-55/40 hover:text-red-700 rounded-lg transition-all"
                                  title="Reset Nilai (Retake)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TEACHERS/PROCTORS TAB */}
          {activeTab === 'teachers' && currentUserRole === 'admin' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Form Add Teacher */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 self-start">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 font-mono flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-emerald-600" />
                    Tambah Guru / Pengawas Baru
                  </h3>

                  {teacherError && (
                    <div className="p-3.5 bg-red-50 border border-red-100 text-xs text-red-650 rounded-xl mb-4 font-sans">
                      {teacherError}
                    </div>
                  )}

                  <form onSubmit={handleAddTeacher} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider font-mono mb-1">
                        Nama Lengkap
                      </label>
                      <input
                        type="text"
                        value={newTeacherName}
                        onChange={(e) => setNewTeacherName(e.target.value)}
                        placeholder="Contoh: Drs. H. Musthofa, M.Pd"
                        className="w-full px-3.5 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-sans"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider font-mono mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          value={newTeacherUser}
                          onChange={(e) => setNewTeacherUser(e.target.value)}
                          placeholder="contoh: musthofa"
                          className="w-full px-3.5 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-sans"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider font-mono mb-1">
                          Password
                        </label>
                        <input
                          type="text"
                          value={newTeacherPass}
                          onChange={(e) => setNewTeacherPass(e.target.value)}
                          placeholder="••••"
                          className="w-full px-3.5 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-sans"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider font-mono mb-1">
                        Hak Akses (Role)
                      </label>
                      <select
                        value={newTeacherRole}
                        onChange={(e) => setNewTeacherRole(e.target.value as 'admin' | 'proctor')}
                        className="w-full px-3.5 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-sans"
                      >
                        <option value="proctor">Pengawas Ujian (Proctor)</option>
                        <option value="admin">Administrator (Guru Utama)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs tracking-wide uppercase transition-all shadow-md shadow-emerald-600/10 hover:shadow-lg flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Daftarkan Pengawas
                    </button>
                  </form>
                </div>

                {/* List Table of Teachers */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 lg:col-span-2">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 font-mono">
                    Daftar Guru / Pengawas Ujian Aktif
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-gray-150 text-[11px] text-gray-450 uppercase font-mono tracking-wider font-semibold">
                          <th className="py-3 px-3">Nama Guru / Pengawas</th>
                          <th className="py-3 px-3">Username</th>
                          <th className="py-3 px-3">Password (Kunci)</th>
                          <th className="py-3 px-3">Hak Akses</th>
                          <th className="py-3 px-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700">
                        {teachers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-gray-400">
                              Belum ada akun pengawas ditiap kelas.
                            </td>
                          </tr>
                        ) : (
                          teachers.map((teach) => (
                            <tr key={teach.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="py-3.5 px-3 align-middle">
                                <span className="text-gray-800 font-bold block">{teach.name}</span>
                                <span className="text-[10px] text-gray-400 block font-mono">ID: {teach.id}</span>
                              </td>
                              <td className="py-3.5 px-3 align-middle font-mono text-xs">{teach.username}</td>
                              <td className="py-3.5 px-3 align-middle font-mono text-xs text-gray-600">
                                <span className="bg-gray-100 px-1.5 py-0.5 rounded font-bold font-mono">{teach.password}</span>
                              </td>
                              <td className="py-3.5 px-3 align-middle">
                                <span
                                  className={`p-1 px-2.5 text-[10px] rounded-full font-bold uppercase tracking-wider font-sans ${
                                    teach.role === 'admin'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                      : 'bg-blue-50 text-blue-800 border border-blue-105'
                                  }`}
                                >
                                  {teach.role === 'admin' ? 'Guru Utama' : 'Pengawas'}
                                </span>
                              </td>
                              <td className="py-3.5 px-3 align-middle text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => startEditTeacher(teach)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-700 hover:text-emerald-850 rounded-xl text-xs font-bold transition-all border border-emerald-100 cursor-pointer shadow-xs"
                                    title="Edit Guru/Pengawas"
                                  >
                                    <Edit className="w-3.5 h-3.5 shrink-0" />
                                    <span>Edit</span>
                                  </button>
                                  {teach.username !== 'aedia' && teach.username !== 'admin' ? (
                                    <button
                                      onClick={() => handleDeleteTeacher(teach.id)}
                                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 active:scale-95 text-red-750 hover:text-red-800 rounded-xl text-xs font-bold transition-all border border-red-100 cursor-pointer shadow-xs"
                                      title="Hapus Guru/Pengawas"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                      <span>Hapus</span>
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-400 italic px-3">Utama</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* MONITORING TAB */}
          {activeTab === 'monitoring' && (
            <div className="space-y-6">
              {/* Header section with live stats */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-gray-900 font-sans flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-505 bg-rose-600"></span>
                    </span>
                    Live Monitoring Kontrol Ujian Siswa
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Memantau jalannya ujian, progres jawaban, dan kontrol aktif status pengerjaan siswa secara real-time.
                  </p>
                </div>
              </div>

              {/* Stats Cards Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-3xl p-6 border border-gray-105 shadow-2xs flex items-center gap-4">
                  <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
                    <Activity className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Siswa Aktif Ujian</span>
                    <span className="text-2xl font-extrabold text-gray-800 block mt-0.5">{activeSessions.length}<span className="text-xs font-medium text-gray-400 ml-1">Siswa</span></span>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-gray-105 shadow-2xs flex items-center gap-4">
                  <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
                    <Laptop className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Rata-Rata Progres</span>
                    <span className="text-2xl font-extrabold text-gray-800 block mt-0.5">
                      {activeSessions.length > 0 
                        ? Math.round(activeSessions.reduce((acc, s) => acc + (((s.answeredCount || 0) / (s.totalQuestions || 1)) * 100), 0) / activeSessions.length)
                        : 0}%
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-gray-105 shadow-2xs flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                    <Sliders className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Status Sinkronisasi</span>
                    <span className="text-xs uppercase font-bold tracking-wider text-emerald-600 flex items-center gap-1.5 mt-2 bg-emerald-50 border border-emerald-100 py-1 px-2.5 rounded-full w-max">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                      Real-time Terhubung
                    </span>
                  </div>
                </div>
              </div>

              {/* Live monitoring panel table */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Daftar Sesi Ujian Berlangsung</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5 font-sans">Siswa terdeteksi sedang membuka, memproses kelas pengerjaan lembar ujian di perangkat mereka.</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/60 uppercase text-[10px] tracking-wider text-gray-400 font-bold border-b border-gray-100">
                        <th className="py-3 px-4">Siswa</th>
                        <th className="py-3 px-4">Paket Ujian</th>
                        <th className="py-3 px-4">Status Koneksi</th>
                        <th className="py-3 px-4">Progres Jawaban</th>
                        <th className="py-3 px-4">Sisa Waktu</th>
                        <th className="py-3 px-4 text-right">Kontrol Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {activeSessions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-gray-400">
                            <span className="flex flex-col items-center gap-2">
                              <Radio className="w-10 h-10 text-rose-200 animate-pulse" />
                              <span className="text-xs font-semibold text-gray-450">Tidak ada siswa yang sedang aktif dalam pengerjaan ujian saat ini.</span>
                            </span>
                          </td>
                        </tr>
                      ) : (
                        activeSessions.map((session) => {
                          const total = session.totalQuestions || 0;
                          const answered = session.answeredCount || 0;
                          const unanswered = session.unansweredCount || 0;
                          const doubtful = session.doubtfulCount || 0;
                          const progressPct = total > 0 ? Math.round((answered / total) * 100) : 0;
                          
                          // Connectivity check (last active within 25s)
                          const isOnline = session.lastActive ? (Date.now() - session.lastActive < 25000) : false;

                          // Time formatter
                          const formatRemaining = (sec: number) => {
                            if (sec === undefined || sec <= 0) return '00:00:00';
                            const h = Math.floor(sec / 3600);
                            const m = Math.floor((sec % 3600) / 60);
                            const s = sec % 60;
                            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                          };

                          const liveTimeLeft = session.timeLeft || 0;
                          const isTimeCrucial = liveTimeLeft < 300; // less than 5 mins

                          return (
                            <tr key={session.id} className="hover:bg-gray-50/40 transition-all">
                              {/* Student Detail */}
                              <td className="py-4 px-4 align-middle">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-700 font-extrabold text-xs flex items-center justify-center border border-rose-100">
                                    {session.studentName ? session.studentName.substring(0, 2).toUpperCase() : 'SW'}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-gray-800 block leading-snug">{session.studentName}</span>
                                      {session.violationsCount && session.violationsCount > 0 ? (
                                        <span className={`inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border ${
                                          session.violationsCount >= 3
                                            ? 'bg-red-100 text-red-800 border-red-200 animate-pulse'
                                            : 'bg-amber-100 text-amber-800 border-amber-200'
                                        }`}>
                                          ⚠️ {session.violationsCount}x Keluar
                                        </span>
                                      ) : null}
                                    </div>
                                    <span className="text-[10px] text-gray-400 block font-mono">NISN: {session.studentNisn} | {session.classGroup}</span>
                                  </div>
                                </div>
                              </td>

                              {/* Exam Detail */}
                              <td className="py-4 px-4 align-middle">
                                <span className="font-semibold text-gray-700 block leading-tight truncate max-w-[180px]">{session.examTitle}</span>
                                <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded mt-0.5">{session.examSubject}</span>
                              </td>

                              {/* Client Online Pulse */}
                              <td className="py-4 px-4 align-middle">
                                {isOnline ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-xl">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                    ONLINE
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-bold bg-gray-50 border border-gray-200 px-2 py-1 rounded-xl">
                                    <span className="h-1.5 w-1.5 rounded-full bg-gray-300"></span>
                                    OFLINE / DC
                                  </span>
                                )}
                              </td>

                              {/* Live Answer progress */}
                              <td className="py-4 px-4 align-middle">
                                <div className="space-y-1 max-w-[140px]">
                                  <div className="flex justify-between items-center text-[10px] font-bold text-gray-450 font-mono">
                                    <span>{answered} / {total} Soal</span>
                                    <span>{progressPct}%</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
                                    <div 
                                      className="h-full bg-emerald-500 transition-all duration-300"
                                      style={{ width: `${progressPct}%` }}
                                    />
                                  </div>
                                  <div className="flex gap-1">
                                    <span className="text-[8px] px-1 bg-emerald-50 text-emerald-700 rounded font-bold font-mono">Pasti: {answered - doubtful}</span>
                                    {doubtful > 0 && <span className="text-[8px] px-1 bg-amber-50 text-amber-600 rounded font-bold font-mono">Ragu: {doubtful}</span>}
                                    {unanswered > 0 && <span className="text-[8px] px-1 bg-red-50 text-red-500 rounded font-bold font-mono">Sisa: {unanswered}</span>}
                                  </div>
                                </div>
                              </td>

                              {/* Live Timer Clock */}
                              <td className="py-4 px-4 align-middle font-mono text-xs font-bold font-semibold">
                                <span className={`inline-flex items-center gap-1 ${isTimeCrucial ? 'text-red-650 animate-pulse' : 'text-gray-700'}`}>
                                  <Clock className="w-3.5 h-3.5" />
                                  {formatRemaining(liveTimeLeft)}
                                </span>
                              </td>

                              {/* Actions controls */}
                              <td className="py-4 px-4 align-middle text-right">
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => setLiveReviewSession(session)}
                                    className="p-1.5 px-3 bg-gray-50 hover:bg-gray-100 active:scale-95 text-gray-700 border border-gray-250 hover:border-gray-350 rounded-xl text-xs font-semibold tracking-wide transition-all inline-flex items-center gap-1 cursor-pointer"
                                    title="Tinjau Jawaban Live"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-gray-500" />
                                    <span>Tinjau</span>
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (window.confirm(`Yakin ingin menyudahi (Selesai Paksa) ujian atas nama ${session.studentName}? Tindakan ini akan menghentikan tes siswa sekarang juga dan meringkas jawabannya.`)) {
                                        try {
                                          if (examMode === 'offline') {
                                            const updatedSes = { ...session, status: 'force_submitted' };
                                            await fetch('/api/offline/active-sessions/update', {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify(updatedSes)
                                            });
                                          } else {
                                            await updateDoc(doc(db, 'active_sessions', session.studentId), {
                                              status: 'force_submitted'
                                            });
                                          }
                                        } catch (err) {
                                          alert('Gagal mengeksekusi selesai paksa!');
                                        }
                                      }
                                    }}
                                    className="p-1.5 px-3 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-700 border border-amber-150 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                                    title="Selesaikan Secara Paksa"
                                  >
                                    <ShieldAlert className="w-3.5 h-3.5" />
                                    <span>Paksa Selesai</span>
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (window.confirm(`Yakin ingin mereset sesi aktif milik ${session.studentName}? Tanda pendaftaran sesi pengerjaannya akan dihapus dari server sehingga ia bisa memulai/daftar ulang pengerjaan di dashboard.`)) {
                                        try {
                                          if (examMode === 'offline') {
                                            await fetch(`/api/offline/active-sessions/delete/${session.studentId}`, {
                                              method: 'DELETE'
                                            });
                                          } else {
                                            await deleteDoc(doc(db, 'active_sessions', session.studentId));
                                          }
                                        } catch (e) {
                                          alert('Gagal mereset sesi aktif!');
                                        }
                                      }
                                    }}
                                    className="p-1.5 px-3 bg-red-50 hover:bg-red-100 active:scale-95 text-red-700 border border-red-150 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                                    title="Hapus Sesi Aktif"
                                  >
                                    <RotateCw className="w-3.5 h-3.5" />
                                    <span>Reset Sesi</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Live Review Session Answers Detail Modal Dialog */}
      {liveReviewSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-gray-150 p-6 md:p-8 space-y-5 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setLiveReviewSession(null)}
              className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-700 rounded-xl transition-all cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-gray-101 border-gray-150">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center font-extrabold text-sm border border-rose-100">
                <Laptop className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 tracking-tight">Live Tracker Jawaban Siswa</h3>
                <p className="text-xs text-gray-400">Analisis pengerjaan real-time dari siswa yang bersangkutan.</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl space-y-2.5 border border-gray-150 text-xs text-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-400 font-medium">Siswa:</span>
                <span className="font-bold text-gray-800">{liveReviewSession.studentName} ({liveReviewSession.classGroup})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-medium">Ujian:</span>
                <span className="font-bold text-gray-800 truncate max-w-[250px]">{liveReviewSession.examTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-medium">Status Pengisian:</span>
                <span className="font-semibold text-emerald-600 font-mono">
                  {liveReviewSession.answeredCount} dari {liveReviewSession.totalQuestions} Soal Terisi ({Math.round(((liveReviewSession.answeredCount || 0) / (liveReviewSession.totalQuestions || 1)) * 100)}%)
                </span>
              </div>
            </div>

            {/* Answer bubble representation */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest font-mono">Peta Respon Jawaban Siswa:</h4>
              
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-[180px] overflow-y-auto p-3 border border-gray-100 rounded-2xl bg-gray-50/50">
                {Array.from({ length: liveReviewSession.totalQuestions || 0 }).map((_, idx) => {
                  const sessionExam = exams.find(e => e.id === liveReviewSession.examId);
                  const question = sessionExam?.questions[idx];
                  const answer = question && liveReviewSession.answers ? liveReviewSession.answers[question.id] : null;
                  
                  const hasAnswered = answer && answer.selectedOption !== null;
                  const isDoubtful = answer && answer.isDoubtful;
                  
                  let bgClass = 'bg-gray-100 text-gray-400 border-gray-200';
                  if (hasAnswered) {
                    bgClass = isDoubtful 
                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-500/10' 
                      : 'bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-600/10';
                  }

                  return (
                    <div 
                      key={idx}
                      className={`py-2 rounded-xl border text-center font-mono font-bold leading-tight flex flex-col justify-center items-center ${bgClass}`}
                      title={isDoubtful ? 'Ragu-Ragu' : hasAnswered ? 'Sudah Diisi' : 'Belum Diisi'}
                    >
                      <span className="text-[9px] opacity-75">No.{idx + 1}</span>
                      <span className="text-xs mt-0.5">
                        {hasAnswered ? answer.selectedOption : '-'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 justify-center text-[10px] text-gray-500 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 bg-emerald-600 rounded-sm"></span>
                  <span>Terisi</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 bg-amber-500 rounded-sm"></span>
                  <span>Ragu-Ragu</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 bg-gray-100 border border-gray-200 rounded-sm"></span>
                  <span>Kosong</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setLiveReviewSession(null)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl tracking-wider uppercase shadow-md shadow-emerald-500/10 cursor-pointer"
              >
                Tutup Tinjauan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result detail Modal dialog popup */}
      {viewResultDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-gray-150 p-6 md:p-8 space-y-4 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setViewResultDetail(null)}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg"
            >
              <XCircle className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            </button>

            <div className="text-center pb-4 border-b border-gray-105">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">Lembar Hasil Ujian</span>
              <h3 className="text-lg font-black text-gray-800 mt-0.5">{viewResultDetail.studentName}</h3>
              <p className="text-xs text-gray-400 font-mono">NISN: {viewResultDetail.studentNisn} | Kelas: {viewResultDetail.classGroup}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center text-xs">
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-center">
                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Mata Pelajaran</span>
                <strong className="text-sm font-bold text-gray-700 mt-1 block leading-tight">{viewResultDetail.examTitle}</strong>
              </div>
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col justify-center items-center">
                <span className="text-[10px] text-emerald-800 font-bold block uppercase tracking-wider">Nilai Akhir</span>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={tempFinalScore !== null ? tempFinalScore : viewResultDetail.score}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                      setTempFinalScore(val === '' ? 0 : val);
                    }}
                    className="w-16 p-1 text-center font-black font-mono bg-white text-emerald-950 text-base rounded-lg border border-emerald-250 outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                  />
                  <span className="text-xs font-bold text-emerald-800 font-mono">/ 100</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 mt-4 text-left">
              <div className="flex justify-between items-center text-xs font-semibold py-1.5 border-b border-gray-100 text-gray-550">
                <span>Rincian Hasil Pengerjaan</span>
              </div>
              
              <div className="p-3.5 bg-gray-50 rounded-2xl flex justify-around text-center text-xs font-bold">
                <div>
                  <span className="text-gray-400 text-[10px] uppercase block">Total Soal</span>
                  <span className="text-base text-gray-800 mt-0.5 block">{viewResultDetail.totalQuestions}</span>
                </div>
                <div>
                  <span className="text-emerald-700 text-[10px] uppercase block">Jawaban Benar</span>
                  <span className="text-base text-emerald-600 mt-0.5 block">{viewResultDetail.correctCount}</span>
                </div>
                <div>
                  <span className="text-red-700 text-[10px] uppercase block">Jawaban Salah</span>
                  <span className="text-base text-red-600 mt-0.5 block">{viewResultDetail.totalQuestions - viewResultDetail.correctCount}</span>
                </div>
              </div>

              {/* Submitted Essay Answers Section */}
              {viewResultDetail.essayAnswers && Object.keys(viewResultDetail.essayAnswers).length > 0 && (
                <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider mb-2">Jawaban Soal Esai & Penilaian:</span>
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {Object.entries(viewResultDetail.essayAnswers).map(([qId, answer], essayIdx) => {
                      const examObj = exams.find((ex) => ex.id === viewResultDetail.examId);
                      const questionObj = examObj?.questions.find((q) => q.id === qId);
                      return (
                        <div key={qId} className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs space-y-1.5 text-left">
                          <div className="font-semibold text-blue-900 leading-relaxed">
                            Uraian {essayIdx + 1}: {questionObj?.text || 'Teks pertanyaan gantung'}
                          </div>
                          <div className="bg-white p-2.5 rounded-lg border border-blue-50 whitespace-pre-wrap font-sans text-gray-700 font-medium break-words leading-relaxed">
                            {answer || '(Siswa mengosongkan jawaban ini)'}
                          </div>

                          {/* Scoring row per question */}
                          <div className="flex items-center justify-between gap-2.5 bg-sky-50/70 p-2 rounded-lg border border-sky-100 mt-1.5">
                            <label className="text-[9px] uppercase font-bold text-sky-850">Nilai Soal Ini:</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                placeholder="N/A"
                                value={essayGradingScores[qId] !== undefined ? essayGradingScores[qId] : ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                  setEssayGradingScores(prev => ({
                                    ...prev,
                                    [qId]: val === '' ? 0 : val
                                  }));
                                }}
                                className="w-12 p-0.5 text-center font-bold font-mono bg-white text-gray-800 rounded border border-sky-200 outline-none text-xs focus:ring-1 focus:ring-blue-500 shadow-sm"
                              />
                              <span className="text-[10px] text-sky-700 font-semibold font-mono">/100</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Auto-grader calculation help */}
                  {Object.keys(essayGradingScores).length > 0 && (
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-emerald-50/70 p-2 px-3 rounded-lg border border-emerald-100 text-xs gap-1.5 mt-2">
                      <span className="text-emerald-900 font-medium font-sans animate-pulse">
                        💡 Rata-Rata Esai: <strong>{
                          Math.round(Object.keys(essayGradingScores).reduce((sum, key) => sum + (essayGradingScores[key] || 0), 0) / Object.keys(essayGradingScores).length)
                        }/100</strong>
                      </span>
                      <button 
                        type="button"
                        onClick={() => {
                          const keys = Object.keys(essayGradingScores);
                          const essayAvg = Math.round(keys.reduce((sum, key) => sum + (essayGradingScores[key] || 0), 0) / keys.length);
                          const mcScore = viewResultDetail.score; // base MCQ score
                          const blendedScore = Math.round((mcScore + essayAvg) / 2);
                          setTempFinalScore(blendedScore);
                        }}
                        className="text-[9px] bg-emerald-600 hover:bg-emerald-700 font-bold px-2 py-1 text-white rounded transition-all shadow-xs cursor-pointer"
                      >
                        Terapkan Rata-Rata (MC & Esai 50:50)
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 bg-amber-50 border border-amber-150 rounded-xl text-[11px] text-amber-800 leading-relaxed font-sans">
                Apakah siswa ini mengalami pemutusan server atau crash? Di dashboard utama Anda dapat menghapus baris hasil ini untuk mengizinkan remedial/mengulang ujian secara penuh.
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-4 space-y-1">
              <button
                onClick={handleSaveEssayGrades}
                disabled={isSavingGrade}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-750 disabled:bg-gray-400 text-white font-bold text-xs rounded-xl uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
              >
                💾 Simpan Penilaian & Update Nilai
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handlePrintIndividual(viewResultDetail)}
                  className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  🖨️ Cetak PDF
                </button>
                <button
                  onClick={() => setViewResultDetail(null)}
                  className="py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs rounded-xl uppercase cursor-pointer transition-all"
                >
                  Batal / Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-gray-150 p-6 md:p-8 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingStudent(null)}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg"
            >
              <XCircle className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            </button>

            <div className="text-center pb-4 border-b border-gray-105">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">Modul Editor Data</span>
              <h3 className="text-lg font-black text-gray-800 mt-0.5">Edit Profil Siswa</h3>
              <p className="text-xs text-gray-450 font-mono">ID: {editingStudent.id}</p>
            </div>

            {editStudentError && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100 font-sans">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editStudentError}</span>
              </div>
            )}

            <form onSubmit={handleSaveStudentEdit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1 font-mono">
                  Nama Lengkap Siswa
                </label>
                <input
                  type="text"
                  required
                  value={editStudentName}
                  onChange={(e) => setEditStudentName(e.target.value)}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-650 transition-all font-sans"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1 font-mono">
                    Nomor Induk / NISN
                  </label>
                  <input
                    type="text"
                    required
                    value={editStudentNisn}
                    onChange={(e) => setEditStudentNisn(e.target.value)}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-650 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1 font-mono">
                    Kelas
                  </label>
                  <input
                    type="text"
                    required
                    value={editStudentClass}
                    onChange={(e) => setEditStudentClass(e.target.value)}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-650 transition-all font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1 font-mono">
                  Gender / Jenis Kelamin
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditStudentGender('Laki-laki')}
                    className={`py-2 px-1 text-xs font-semibold rounded-xl border transition-all ${
                      editStudentGender === 'Laki-laki'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-750'
                        : 'border-gray-200 text-gray-550 hover:bg-gray-50'
                    }`}
                  >
                    Laki-laki
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStudentGender('Perempuan')}
                    className={`py-2 px-1 text-xs font-semibold rounded-xl border transition-all ${
                      editStudentGender === 'Perempuan'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-750'
                        : 'border-gray-200 text-gray-555 hover:bg-gray-50'
                    }`}
                  >
                    Perempuan
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1 font-mono">
                    Username Ujian
                  </label>
                  <input
                    type="text"
                    required
                    value={editStudentUser}
                    onChange={(e) => setEditStudentUser(e.target.value)}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-650 transition-all font-sans"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider mb-1 font-mono">
                    Password Ujian
                  </label>
                  <input
                    type="text"
                    required
                    value={editStudentPass}
                    onChange={(e) => setEditStudentPass(e.target.value)}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-650 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6 pt-2">
                <button
                  type="submit"
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all font-sans"
                >
                  <CheckCircle className="w-4 h-4" />
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="py-2.5 bg-gray-100 hover:bg-gray-150 text-gray-700 border border-gray-200 font-bold text-xs rounded-xl uppercase cursor-pointer transition-all font-sans"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Teacher Modal */}
      {editingTeacher && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-gray-150 p-6 md:p-8 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingTeacher(null)}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-lg"
            >
              <XCircle className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            </button>

            <div className="text-center pb-4 border-b border-gray-105">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">Modul Editor Data</span>
              <h3 className="text-lg font-black text-gray-800 mt-0.5">Edit Profil Guru / Pengawas</h3>
              <p className="text-xs text-gray-450 font-mono">ID: {editingTeacher.id}</p>
            </div>

            {editTeacherError && (
              <div className="flex items-center gap-2 text-xs text-red-650 bg-red-50 p-2.5 rounded-xl border border-red-100 font-sans">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editTeacherError}</span>
              </div>
            )}

            <form onSubmit={handleSaveTeacherEdit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider font-mono mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={editTeacherName}
                  onChange={(e) => setEditTeacherName(e.target.value)}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-650 transition-all font-sans"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider font-mono mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    disabled={editingTeacher.username === 'admin' || editingTeacher.username === 'aedia'}
                    value={editTeacherUser}
                    onChange={(e) => setEditTeacherUser(e.target.value)}
                    className="w-full p-2.5 bg-white disabled:bg-gray-100 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-650 transition-all font-mono"
                  />
                  {(editingTeacher.username === 'admin' || editingTeacher.username === 'aedia') && (
                    <span className="text-[9px] text-gray-400 block mt-1 leading-normal font-sans">Username admin utama dikunci demi keamanan sistem.</span>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider font-mono mb-1">
                    Password (Kunci)
                  </label>
                  <input
                    type="text"
                    required
                    value={editTeacherPass}
                    onChange={(e) => setEditTeacherPass(e.target.value)}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-650 transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-450 uppercase tracking-wider font-mono mb-1">
                  Hak Akses (Role)
                </label>
                <select
                  disabled={editingTeacher.username === 'admin' || editingTeacher.username === 'aedia'}
                  value={editTeacherRole}
                  onChange={(e) => setEditTeacherRole(e.target.value as 'admin' | 'proctor')}
                  className="w-full p-2.5 bg-white disabled:bg-gray-100 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-650 transition-all font-sans font-medium"
                >
                  <option value="proctor">Pengawas Ujian (Proctor)</option>
                  <option value="admin">Administrator (Guru Utama)</option>
                </select>
                {(editingTeacher.username === 'admin' || editingTeacher.username === 'aedia') && (
                  <span className="text-[9px] text-gray-400 block mt-1 leading-normal font-sans">Hak akses admin utama dilindungi oleh sistem.</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-6 pt-2">
                <button
                  type="submit"
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all font-sans"
                >
                  <CheckCircle className="w-4 h-4" />
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="py-2.5 bg-gray-100 hover:bg-gray-150 text-gray-700 border border-gray-200 font-bold text-xs rounded-xl uppercase cursor-pointer transition-all font-sans"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Technician Offline Setup Guide Modal */}
      {showTechnicianGuide && (
        <div className="fixed inset-0 bg-zinc-950/70 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fade-in font-sans">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-gray-150 shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 md:p-6 bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 flex justify-between items-center shrink-0 border-b border-amber-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-zinc-900 text-amber-400 text-[10px] font-extrabold uppercase p-1 px-2.5 rounded-lg font-mono">
                    MANUAL TEKNISI PROCTOR
                  </span>
                  <span className="text-xs font-bold text-amber-950 uppercase font-mono tracking-wider">
                    Mode Offline Mandiri
                  </span>
                </div>
                <h3 className="text-lg md:text-xl font-black tracking-tight text-zinc-950">
                  Panduan Sinkronisasi Jaringan Lokal (PC & HP)
                </h3>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowTechnicianGuide(false);
                }}
                className="p-1.5 hover:bg-zinc-900/10 rounded-xl transition-all cursor-pointer text-zinc-950"
                title="Tutup Panduan"
              >
                <XCircle className="w-6 h-6 text-zinc-950" />
              </button>
            </div>

            {/* Guide Tabs Navigation */}
            <div className="bg-gray-50 border-b border-gray-150 p-2 md:p-3 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
              <button
                onClick={() => setActiveGuideTab('skema')}
                className={`py-2 px-3 text-xs font-extrabold rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                  activeGuideTab === 'skema'
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 border-transparent hover:text-zinc-900'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                1. Skema & Topologi
              </button>
              <button
                onClick={() => setActiveGuideTab('pc')}
                className={`py-2 px-3 text-xs font-extrabold rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                  activeGuideTab === 'pc'
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 border-transparent hover:text-zinc-900'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                2. Setting PC Guru
              </button>
              <button
                onClick={() => setActiveGuideTab('hp')}
                className={`py-2 px-3 text-xs font-extrabold rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                  activeGuideTab === 'hp'
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 border-transparent hover:text-zinc-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                3. Sambungan HP Siswa
              </button>
              <button
                onClick={() => setActiveGuideTab('usb')}
                className={`py-2 px-3 text-xs font-extrabold rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                  activeGuideTab === 'usb'
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 border-transparent hover:text-zinc-900'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                4. Tarik Berkas Hasil
              </button>
              <button
                onClick={() => setActiveGuideTab('troubleshoot')}
                className={`py-2 px-3 text-xs font-extrabold rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                  activeGuideTab === 'troubleshoot'
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-150 border-transparent hover:text-zinc-900'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                5. Troubleshooting
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 select-text">

              {/* TAB 1: SKEMA TOPOLOGI */}
              {activeGuideTab === 'skema' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-gray-150">
                    <div className="p-2 bg-amber-50 rounded-xl text-amber-800 animate-pulse">
                      <Network className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-gray-800">Topologi Jaringan Lokal Mandiri (Client-Server LAN)</h4>
                      <p className="text-xs text-gray-400">Mekanisme ujian tanpa internet, mengoptimalkan infrastruktur lokal kelas.</p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed font-sans">
                    Ujian Offline CBT MA Annuriyyah dirancang agar sekolah tetap dapat melaksanakan evaluasi siswa secara kredibel dan aman meskipun koneksi internet terputus secara total di wilayah madrasah. Seluruh data ujian disalurkan secara lokal via gelombang WiFi nirkabel (WLAN).
                  </p>

                  {/* Flow Diagram Block */}
                  <div className="bg-zinc-900 text-gray-300 rounded-2xl p-5 font-mono text-xs border border-zinc-700/50 space-y-3 leading-loose shadow-inner opacity-95">
                    <div className="text-amber-400 font-bold pb-1 border-b border-zinc-800">● DIAGRAM ALIR & TOPOLOGI KONEKSI OFFLINE</div>
                    <div className="whitespace-pre overflow-x-auto text-[11px] leading-relaxed py-2">
{`   [ ROUTER/ACCESS POINT KELAS ]   <--- (WiFi Tanpa Internet)
                 |
        +--------+--------+------------------+
        |                 |                  |
   [PC SERVER GURU]  [HP/TAB SISWA 1]  [HP/LAPTOP SISWA 2]
    Acts as Host      Accessing URL:     Accessing URL:
    (Port: 3000)      http://192.168...  http://192.168...`}
                    </div>
                    <p className="text-[10px] text-gray-450 leading-normal">
                      *Catatan: Router/AP yang terpasang di kelas TIDAK memerlukan kabel internet (WAN/Indihome/Modem), cukup menyala untuk membuat SSID WiFi lokal agar seluruh perangkat bisa saling &quot;ping&quot; satu sama lain dalam satu segmen subnet.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl border border-gray-150 bg-gray-50/50 space-y-1.5 font-sans">
                      <span className="text-[10px] text-emerald-800 font-extrabold uppercase font-mono tracking-wider block">Kebutuhan PC Server Guru</span>
                      <ul className="text-xs text-gray-650 space-y-1.5 list-disc pl-4 leading-relaxed">
                        <li>Komputer/Laptop dengan OS Windows 10/11 atau macOS.</li>
                        <li>Browser modern terpasang (Google Chrome terbaik).</li>
                        <li>Memiliki adaptor WiFi internal atau port LAN internal.</li>
                      </ul>
                    </div>

                    <div className="p-4 rounded-2xl border border-gray-150 bg-gray-50/50 space-y-1.5 font-sans">
                      <span className="text-[10px] text-emerald-800 font-extrabold uppercase font-mono tracking-wider block">Kebutuhan Klien Siswa</span>
                      <ul className="text-xs text-gray-650 space-y-1.5 list-disc pl-4 leading-relaxed">
                        <li>Semua merk Smartphone Android, iPhone/iPad, atau Laptop siswa.</li>
                        <li>Minimal browser Google Chrome v80 atau Safari v13 ke atas.</li>
                        <li>Bisa tersinkronisasi murni dari penyimpanan internal (<strong className="font-mono">localStorage</strong>).</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SETTING PC SERVER GURU */}
              {activeGuideTab === 'pc' && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-gray-150">
                    <div className="p-2 bg-amber-50 rounded-xl text-amber-800">
                      <Monitor className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-gray-800">Langkah Pengaturan PC Server (Host Guru)</h4>
                      <p className="text-xs text-gray-500 font-sans">Mempersiapkan laptop proktor/guru agar bertindak sebagai gerbang server utama.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Step 1 */}
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-zinc-900 text-white font-extrabold text-xs shrink-0 flex items-center justify-center font-mono">1</div>
                      <div className="space-y-1 font-sans">
                        <strong className="text-xs text-gray-800 font-black">Sambungkan Ke Router Kelas</strong>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Hubungkan Laptop Guru ke perangkat Router yang menyalakan sinyal WiFi di ruang kelas (Contoh SSID: <span className="font-semibold text-gray-850">Wifi_CBT_MA_ANNURIYYAH</span>).
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-zinc-900 text-white font-extrabold text-xs shrink-0 flex items-center justify-center font-mono">2</div>
                      <div className="space-y-1.5 w-full font-sans">
                        <strong className="text-xs text-gray-800 font-black">Cari IP Address Laptop Guru</strong>
                        <p className="text-xs text-gray-550 leading-relaxed">
                          Buka terminal command prompt Windows untuk mengetahui alamat IP Anda saat ini:
                        </p>
                        <div className="bg-zinc-900 text-zinc-300 rounded-xl p-3 border border-zinc-700 font-mono text-[11px] leading-loose select-text">
                          <span className="text-gray-500">// Buka CMD, ketik ipconfig lalu tekan Enter:</span><br/>
                          C:\Users\Proctor&gt; <span className="text-amber-400 font-bold">ipconfig</span><br/><br/>
                          Wireless LAN adapter Wi-Fi:<br/>
                          &nbsp;&nbsp;&nbsp;IPv4 Address. . . . . . . . : <span className="text-emerald-400 font-bold bg-emerald-950/40 p-0.5 px-1.5 rounded-sm">192.168.1.100</span><br/>
                          &nbsp;&nbsp;&nbsp;Subnet Mask . . . . . . . . : 255.255.255.0
                        </div>
                        <p className="text-[10px] text-amber-850 bg-amber-50 border border-amber-200 p-2.5 rounded-xl leading-normal font-bold">
                          ⚠️ Catat IPv4 Address di atas (misal 192.168.1.100). Alamat IP inilah yang wajib diketik oleh seluruh siswa di url browser mereka!
                        </p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-zinc-900 text-white font-extrabold text-xs shrink-0 flex items-center justify-center font-mono">3</div>
                      <div className="space-y-1 w-full font-sans">
                        <strong className="text-xs text-gray-800 font-black">Buka Port 3000 pada Windows Defender Firewall (Sangat Penting!)</strong>
                        <p className="text-xs text-gray-550 leading-relaxed">
                          Secara default, OS Windows melarang laptop luar masuk ke laptop server Anda. Ikuti tahap pembukaan portal port jaringan berikut:
                        </p>
                        <ol className="text-xs text-gray-650 list-decimal pl-5 space-y-1 mt-1.5 leading-relaxed">
                          <li>Buka <span className="font-semibold text-gray-805">Control Panel</span> ➔ masuk ke <span className="font-semibold text-gray-805">Windows Defender Firewall</span>.</li>
                          <li>Klik tombol <span className="font-bold text-amber-800">Advanced Settings</span> di sebelah panel kiri.</li>
                          <li>Klik Menu <span className="font-bold text-gray-800">Inbound Rules</span> (Sudut kanan atas) ➔ kemudian klik <span className="font-bold text-emerald-800">New Rule...</span></li>
                          <li>Pilih jenis tipe Rule: <span className="font-bold text-zinc-900">Port</span> ➔ klik opsi Next.</li>
                          <li>Pilih <span className="font-bold">TCP</span>, pilih <span className="font-bold">Specific local ports</span> ➔ ketik: <strong className="font-mono text-amber-800 bg-amber-100 p-0.5 px-1.5 rounded-md text-[11px]">3000</strong>.</li>
                          <li>Silakan centang <span className="font-bold text-emerald-800">Allow the connection</span> ➔ klik Next.</li>
                          <li>Pastikan tercentang ketiganya: <span className="font-semibold">Domain, Private, Public</span> ➔ klik Next.</li>
                          <li>Beri nama aturan ini: <strong className="font-bold font-mono text-zinc-900">&quot;Server Offline CBT Annuriyyah&quot;</strong> lalu klik Finish.</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SAMBUNGAN HP SISWA */}
              {activeGuideTab === 'hp' && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-gray-150">
                    <div className="p-2 bg-amber-50 rounded-xl text-amber-800">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-gray-800">Instruksi Akses Klien Siswa (HP & Laptop)</h4>
                      <p className="text-xs text-gray-500 font-sans">Membantu siswa tersambung dengan sukses ke sistem CBT secara lokal.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                      <Wifi className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
                      <div className="space-y-1 font-sans">
                        <strong className="text-xs text-amber-950 block">Pastikan Berada Di WiFi Yang Tepat</strong>
                        <p className="text-[11px] text-gray-700 leading-relaxed">
                          Siswa WAJIB mematikan Paket Data Seluler (Quaker/Axis/Telkomsel dll) agar HP mereka terpaksa merutekan data murni melalui sinyal WiFi lokal kelas. Hubungkan ke SSID WiFi yang sudah ditentukan.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2.5 font-sans">
                      <strong className="text-xs text-gray-800 font-bold block">Cara Penulisan URL di Browser Siswa:</strong>
                      <p className="text-xs text-gray-500 leading-relaxed font-sans">
                        Suruh siswa membuka aplikasi browser <span className="font-bold text-gray-750">Google Chrome</span> atau <span className="font-bold text-gray-750">Safari</span> pada HP masing-masing, lalu ketikkan alamat IP Server Guru diikuti akhiran port <strong className="font-mono text-zinc-950 bg-gray-100 p-0.5 rounded-sm">:3000</strong>.
                      </p>

                      <div className="bg-zinc-100 p-4 rounded-2xl border border-gray-200 space-y-2 flex flex-col items-center">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest font-mono">CONTOH PENULISAN TERBAIK</span>
                        <div className="text-md md:text-lg font-mono font-black text-emerald-800 bg-white border border-emerald-350 p-2.5 px-6 rounded-xl shadow-xs text-center select-all">
                          http://192.168.1.100:3000
                        </div>
                        <span className="text-[10px] text-red-500 text-center leading-normal font-bold">
                          ❌ PERINGATAN: JANGAN MENGETIK &quot;https://&quot; (dengan akhiran &apos;s&apos;) ATAU TANPA &quot;http://&quot;. Browser akan mencari di internet dan berujung gagal!
                        </span>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-2xl border border-gray-150 p-4 space-y-1.5 font-sans">
                      <span className="text-xs font-bold text-gray-800 block">📱 Mengapa memakai PWA Mode (Aplikasi Tanpa Browser)?</span>
                      <p className="text-xs text-gray-650 leading-relaxed">
                        Saat siswa sudah masuk ke tautan tersebut, biarkan mereka mengetuk tombol menu titik 3 Chrome atau tombol share Safari, lalu pilih <span className="font-semibold text-zinc-900">Tambahkan ke Layar Utama</span>. Dengan cara ini, CBT akan terbuka secara Layar Penuh (Fullscreen), mencegah siswa opens tab browser lain selama pengerjaan ujian berlangsung.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: ALUR TARIK BERKAS HASIL */}
              {activeGuideTab === 'usb' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-gray-150">
                    <div className="p-2 bg-emerald-50 rounded-xl text-emerald-800 animate-bounce">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-gray-800">Sistem Penyimpanan Otomatis Server Offline (Real-Time Saves)</h4>
                      <p className="text-xs text-gray-500">Mekanisme autosave mutakhir — data siswa tersimpan otomatis ke PC/HP Server seketika selesai ujian!</p>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                    <Wifi className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5 animate-pulse" />
                    <div className="space-y-1 font-sans">
                      <strong className="text-sm text-emerald-950 block">🎉 FITUR BARU: Auto-Save Seketika Selesai Ujian</strong>
                      <p className="text-xs text-gray-850 leading-relaxed font-sans">
                        Sesuai instruksi madrasah, jika Anda menggunakan PC atau HP sebagai server offline, data hasil ujian siswa sekarang <strong>otomatis langsung terkirim dan disimpan di penyimpanan internal komputer server seketika setelah siswa menyelesaikan ujian!</strong> Siswa tidak perlu mengunggah berkas secara manual, dan proktor tidak perlu mengumpulkan USB.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 font-sans">
                    {/* Step A */}
                    <div className="p-4 rounded-2xl border border-gray-200 bg-zinc-900 text-gray-300 space-y-2 font-sans">
                      <div className="flex justify-between items-center pb-1.5 border-b border-zinc-800">
                        <span className="text-[10px] font-extrabold font-mono text-amber-400 font-sans uppercase">METODE UTAMA: SINKRONISASI JALUR WiFi (OTOMATIS)</span>
                        <span className="bg-emerald-400 text-zinc-900 text-[9px] font-extrabold p-0.5 px-2 rounded-md font-mono">REKOMENDASI</span>
                      </div>
                      <p className="text-xs leading-relaxed">
                        Saat siswa mengklik <strong className="text-emerald-300 font-bold">Selesai Ujian</strong> di HP/Laptop mereka, aplikasi mengirim payload data secara langsung ke endpoint API Express server guru (<code className="font-mono text-amber-300 text-[11px]">/api/offline/submit-result</code>) via jaringan Wifi lokal. Data hasil pengerjaan, skor kelulusan, dan status pelanggaran siswa disimpan di folder <strong className="font-mono text-white text-[11.5px]">/offline_data/results/</strong> di server Laptop/HP proktor seketika itu juga!
                      </p>
                    </div>

                    {/* Step B */}
                    <div className="p-4 rounded-2xl border border-gray-200 bg-zinc-900 text-gray-300 space-y-2">
                      <div className="flex justify-between items-center pb-1.5 border-b border-zinc-800">
                        <span className="text-[10px] font-extrabold font-mono text-amber-400 uppercase">METODE CADANGAN: UNDUH & IMPOR FILE (.JSON)</span>
                        <span className="bg-amber-400 text-zinc-900 text-[9px] font-extrabold p-0.5 px-2 rounded-md font-mono">BACKUP CADANGAN</span>
                      </div>
                      <p className="text-xs leading-relaxed">
                        Jika terdapat kendala interferensi sinyal WiFi yang menyebabkan putusnya jaringan lokal kelas:
                      </p>
                      <ol className="text-xs text-gray-400 list-decimal pl-5 space-y-1 leading-relaxed">
                        <li>Siswa mengunduh hasil ujinya lewat tombol <strong className="text-amber-300 font-semibold">📖 Unduh Hasil (.json)</strong> yang berada di dashboard siswa masing-masing secara luring (offline) tanpa internet.</li>
                        <li>Guru mengumpulkan berkas <code className="font-mono text-emerald-300">.json</code> tersebut lewat Flashdisk OTG atau media transfer lokal lainnya.</li>
                        <li>Proktor membuka menu <strong className="text-white">Dashboard Guru ➔ Daftar Hasil</strong> di laptop server, lalu klik tombol <span className="p-1 px-3 rounded-lg bg-amber-600 font-bold text-white text-[10px] inline-block">📥 Impor Berkas Siswa (.json)</span> untuk menggabungkan rekapitulasi data secara massal.</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: TROUBLESHOOTING */}
              {activeGuideTab === 'troubleshoot' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-gray-150">
                    <div className="p-2 bg-amber-50 rounded-xl text-amber-800">
                      <AlertCircle className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-gray-800">Penyelesaian Masalah (Troubleshooting & FAQ)</h4>
                      <p className="text-xs text-gray-500 font-sans">Mencari solusi cepat bagi kendala teknis krusial di lapangan.</p>
                    </div>
                  </div>

                  <div className="space-y-4 font-sans text-xs">
                    {/* Q1 */}
                    <div className="space-y-1.5 p-3.5 bg-gray-50 rounded-2xl border border-gray-150">
                      <strong className="text-red-700 block">Q1: HP/Laptop Siswa Loading Terus-Terusan Wi-Fi Mati atau RTO?</strong>
                      <p className="text-gray-600 leading-relaxed">
                        <strong>Penyebab Utama:</strong> Windows Firewall di Laptop Guru masih memproteksi/memblokir koneksi port masuk.<br/>
                        <strong>Solusi:</strong> Matikan sementara Windows Defender Firewall (Private Profile) di Laptop Guru melaui Control Panel, atau atur &quot;Inbound Rules&quot; seperti di petunjuk Tab 2. Pastikan HP siswa sudah terhubung ke WiFi yang sama dengan laptop guru, lalu ganti pengetikan alamat dengan diawali teks lengkap <code className="font-mono text-xs bg-gray-250 p-0.5 px-1 rounded-xs font-bold text-emerald-850">http://</code>.
                      </p>
                    </div>

                    {/* Q2 */}
                    <div className="space-y-1.5 p-3.5 bg-gray-50 rounded-2xl border border-gray-150">
                      <strong className="text-amber-800 block">Q2: IP Address Laptop Guru selalu berubah ketika Router mati/nyala kembali?</strong>
                      <p className="text-gray-600 leading-relaxed">
                        <strong>Solusi:</strong> Sangat dianjurkan untuk mengatur IP Address Laptop Guru secara manual (Static IP) di Control Panel adaptors Windows. Isikan Manual IP: <code className="font-mono font-bold bg-zinc-200 text-zinc-800 p-0.5 px-1 rounded-xs text-[11px]">192.168.1.100</code>, Subnet Mask: <code className="font-mono text-[11px]">255.255.255.0</code>. Dengan begitu link URL ujian bagi siswa akan konsisten dan tidak berubah sepanjang hari.
                      </p>
                    </div>

                    {/* Q3 */}
                    <div className="space-y-1.5 p-3.5 bg-gray-50 rounded-2xl border border-gray-150">
                      <strong className="text-emerald-800 block">Q3: Apakah siswa bisa memanipulasi/mengedit nilai di file JSON hasil unduhan mereka?</strong>
                      <p className="text-gray-600 leading-relaxed">
                        <strong>Proteksi Sandi (Anti-Kecurangan):</strong> <strong className="text-emerald-800 font-black">SISTEM KUNCI AMAN</strong>. Setiap file JSON yang dihasilkan dilengkapi dengan *Cryptographic Verification Signature* (Base64 enkresi biner). Jika berkas isian disunting atau diganti nama dan angkanya secara ilegal oleh siswa, sistem Impor Guru akan menolak file karena verifikasi sidik data rusak atau tidak sah.
                      </p>
                    </div>

                    {/* Q4 */}
                    <div className="space-y-1.5 p-3.5 bg-gray-50 rounded-2xl border border-gray-150">
                      <strong className="text-purple-800 block">Q4: Token Ujian di mode offline siswa apakah otomatis sinkron?</strong>
                      <p className="text-gray-600 leading-relaxed">
                        <strong>Jawaban:</strong> Ya, token otomatis menyatu secara lokal dengan data enkripsi bank soal. Guru cukup mengumumkan atau menuliskan Token aktif yang tertera di menu dashboard guru kepada pengawas ruangan/siswa.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-150 flex justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-900 border border-zinc-700 text-amber-300 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                🖨️ Cetak Panduan (PDF)
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowTechnicianGuide(false);
                }}
                className="py-2.5 px-6 bg-zinc-900 hover:bg-black text-white font-extrabold text-xs rounded-xl uppercase tracking-wider cursor-pointer shadow-md transition-all active:scale-98"
              >
                Pahami & Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
