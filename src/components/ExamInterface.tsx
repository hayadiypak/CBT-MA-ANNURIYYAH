import { useState, useEffect, useRef } from 'react';
import { Clock, HelpCircle, AlertTriangle, CheckSquare, Type, Menu, X, ArrowLeft, ArrowRight } from 'lucide-react';
import { Exam, StudentAnswer, Student } from '../types';
import { doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
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

interface ExamInterfaceProps {
  student: Student;
  exam: Exam;
  onFinishExam: (answers: Record<string, StudentAnswer>, violationsCount?: number) => void;
  onCancel: () => void;
  examMode?: 'online' | 'offline';
}

export default function ExamInterface({ student, exam, onFinishExam, onCancel, examMode = 'online' }: ExamInterfaceProps) {
  const storageKeyPrefix = `cbt_exam_${student.nisn || student.id}_${exam.id}`;

  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = localStorage.getItem(`${storageKeyPrefix}_index`);
    return saved ? Number(saved) : 0;
  });

  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>(() => {
    const saved = localStorage.getItem(`${storageKeyPrefix}_answers`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    // Initialize answers dictionary
    const initial: Record<string, StudentAnswer> = {};
    exam.questions.forEach((q) => {
      initial[q.id] = { selectedOption: null, isDoubtful: false };
    });
    return initial;
  });

  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem(`${storageKeyPrefix}_time`);
    return saved ? Number(saved) : exam.durationMinutes * 60;
  });
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [confirmCheck, setConfirmCheck] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Anti-Cheat Security States
  const [violationCount, setViolationCount] = useState(() => {
    const saved = localStorage.getItem(`${storageKeyPrefix}_violations`);
    return saved ? Number(saved) : 0;
  });
  const [showCheatWarning, setShowCheatWarning] = useState(false);
  const [isSecureStarted, setIsSecureStarted] = useState(() => {
    const saved = localStorage.getItem(`${storageKeyPrefix}_secure_started`);
    return saved === 'true';
  });

  // Track dynamic time in useRef to avoid re-triggering network synchronization on every timer tick
  const timeLeftRef = useRef(timeLeft);
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // Active session tracking references for throttled sync
  const lastAnswersRef = useRef('');
  const lastSyncTimeRef = useRef(0);
  const isWarningActiveRef = useRef(false);
  const lastViolationTimeRef = useRef(0);

  // Keep a ref to answers to prevent stale closures in the timer callback
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
    localStorage.setItem(`${storageKeyPrefix}_answers`, JSON.stringify(answers));
  }, [answers, storageKeyPrefix]);

  // Keep violationCount synced to localStorage
  useEffect(() => {
    localStorage.setItem(`${storageKeyPrefix}_violations`, violationCount.toString());
  }, [violationCount, storageKeyPrefix]);

  useEffect(() => {
    localStorage.setItem(`${storageKeyPrefix}_secure_started`, isSecureStarted ? 'true' : 'false');
  }, [isSecureStarted, storageKeyPrefix]);

  // Save current index to localStorage
  useEffect(() => {
    localStorage.setItem(`${storageKeyPrefix}_index`, currentIndex.toString());
  }, [currentIndex, storageKeyPrefix]);

  // Auto-close sidebar on mobile screen size on initial load
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, []);

  // Clean storage helper
  const cleanUpStorage = () => {
    localStorage.removeItem(`${storageKeyPrefix}_answers`);
    localStorage.removeItem(`${storageKeyPrefix}_time`);
    localStorage.removeItem(`${storageKeyPrefix}_index`);
    localStorage.removeItem(`${storageKeyPrefix}_violations`);
    localStorage.removeItem(`${storageKeyPrefix}_secure_started`);
    // Delete Firestore active session document
    if (examMode === 'offline') {
      fetch(`/api/offline/active-sessions/delete/${student.id}`, { method: 'DELETE' }).catch(() => {});
    } else {
      deleteDoc(doc(db, 'active_sessions', student.id)).catch(() => {});
    }
  };

  const handleAutoSubmit = (forcedViolationCount?: number) => {
    cleanUpStorage();
    onFinishExam(answersRef.current, forcedViolationCount !== undefined ? forcedViolationCount : violationCount);
  };

  // Helper to trigger browser full screen modes
  const enterFullscreenMode = () => {
    const elem = document.documentElement;
    try {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).mozRequestFullScreen) {
        (elem as any).mozRequestFullScreen();
      } else if ((elem as any).msRequestFullscreen) {
        (elem as any).msRequestFullscreen();
      }
    } catch (e) {
      console.log('Fullscreen request blocked or unsupported:', e);
    }
  };

  const handleStartSecureMode = () => {
    setIsSecureStarted(true);
    enterFullscreenMode();
  };

  const handleDismissWarning = () => {
    isWarningActiveRef.current = false;
    setShowCheatWarning(false);
    enterFullscreenMode();
  };

  // 1. Live synchronization of student progress to Firestore with anti-cheat statuses
  useEffect(() => {
    const syncToFirestore = async () => {
      const now = Date.now();
      const answersStr = JSON.stringify(answers);
      const isAnswersChanged = answersStr !== lastAnswersRef.current;
      const isTimeElapsed = now - lastSyncTimeRef.current >= 15000; // Increased to 15 seconds to handle 500+ users concurrency easily

      if (!isAnswersChanged && !isTimeElapsed) {
        return;
      }

      lastAnswersRef.current = answersStr;
      lastSyncTimeRef.current = now;

      const totalQs = exam.questions.length;
      const ansCount = (Object.values(answers) as StudentAnswer[]).filter((a) => a.selectedOption !== null).length;
      const dbtCount = (Object.values(answers) as StudentAnswer[]).filter((a) => a.isDoubtful).length;
      const unansCount = totalQs - ansCount;

      const payload = {
        id: student.id,
        studentId: student.id,
        studentName: student.name,
        studentNisn: student.nisn,
        classGroup: student.classGroup,
        examId: exam.id,
        examTitle: exam.title,
        examSubject: exam.subject,
        timeLeft: timeLeftRef.current,
        totalQuestions: totalQs,
        answeredCount: ansCount,
        doubtfulCount: dbtCount,
        unansweredCount: unansCount,
        lastActive: now,
        status: violationCount >= 3 ? 'cheat_submitted' : 'working',
        answers: answers,
        violationsCount: violationCount,
        deviceSessionId: localStorage.getItem('cbt_device_id') || 'unknown'
      };

      if (examMode === 'offline') {
        try {
          await fetch('/api/offline/active-sessions/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } catch (err) {
          console.warn('Gagal sinkron proktor offline:', err);
        }
      } else {
        try {
          await setDoc(doc(db, 'active_sessions', student.id), payload);
        } catch (err) {
          console.error('Failed to sync active session to firestore:', err);
        }
      }
    };

    syncToFirestore();
  }, [answers, student.id, exam.id, violationCount, examMode]);

  // 1b. Anti-cheat locks keyboard shortcut handlers and blur listeners
  useEffect(() => {
    if (!isSecureStarted) return;

    // Prevent click-right context, text copying, cutting, selection starts
    const preventDefaultAction = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener('contextmenu', preventDefaultAction);
    document.addEventListener('copy', preventDefaultAction);
    document.addEventListener('cut', preventDefaultAction);
    document.addEventListener('paste', preventDefaultAction);

    // Block keyboard hotkeys (F12, Inspect Element keys, and basic clipboard modifiers)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }
      
      // Control + Shift + I/J/C or command/meta equivalents
      if (
        (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) ||
        (e.metaKey && e.altKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key))
      ) {
        e.preventDefault();
        return;
      }

      // Copy/Paste shortcut blocks (Ctrl+C, Ctrl+V, Cmd+C, Cmd+V, and select-all/print controls)
      if (
        (e.ctrlKey || e.metaKey) && 
        ['c', 'C', 'v', 'V', 'u', 'U', 's', 'S', 'a', 'A', 'p', 'P'].includes(e.key)
      ) {
        e.preventDefault();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    // Track tab-switching/blur infractions
    const handleViolationTrigger = () => {
      // Avoid tracking infractions if the app is embedded inside an iframe (like standard AI Studio developer preview)
      try {
        if (window.self !== window.top) {
          console.warn('[CBT Security] Skip screen locked violation check inside developer iframe sandbox.');
          return;
        }
      } catch (e) {
        return;
      }

      const now = Date.now();
      if (now - lastViolationTimeRef.current < 5000) {
        console.warn('[CBT Security] Infraction double-trigger suppressed (5s cooldown active).');
        return;
      }
      if (isWarningActiveRef.current) {
        console.warn('[CBT Security] Infraction suppressed (active warning disclaimer is shown).');
        return;
      }

      lastViolationTimeRef.current = now;
      isWarningActiveRef.current = true;

      setViolationCount((prev) => {
        const nextCount = prev + 1;
        localStorage.setItem(`${storageKeyPrefix}_violations`, nextCount.toString());

        // Sync immediately to Firestore for the teacher to track
        const totalQs = exam.questions.length;
        const ansCount = (Object.values(answersRef.current) as StudentAnswer[]).filter((a) => a.selectedOption !== null).length;
        const dbtCount = (Object.values(answersRef.current) as StudentAnswer[]).filter((a) => a.isDoubtful).length;
        const unansCount = totalQs - ansCount;

        const violationPayload = {
          id: student.id,
          studentId: student.id,
          studentName: student.name,
          studentNisn: student.nisn,
          classGroup: student.classGroup,
          examId: exam.id,
          examTitle: exam.title,
          examSubject: exam.subject,
          timeLeft: timeLeft,
          totalQuestions: totalQs,
          answeredCount: ansCount,
          doubtfulCount: dbtCount,
          unansweredCount: unansCount,
          lastActive: now,
          status: nextCount >= 3 ? 'cheat_submitted' : 'working',
          answers: answersRef.current,
          violationsCount: nextCount,
          deviceSessionId: localStorage.getItem('cbt_device_id') || 'unknown'
        };

        if (examMode === 'offline') {
          fetch('/api/offline/active-sessions/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(violationPayload)
          }).catch(() => {});
        } else {
          setDoc(doc(db, 'active_sessions', student.id), violationPayload).catch(() => {});
        }

        if (nextCount >= 3) {
          alert(`Ujian Anda telah dihentikan secara otomatis karena dideteksi keluar dari layar ujian sebanyak ${nextCount} kali.`);
          cleanUpStorage();
          onFinishExam(answersRef.current, nextCount);
        } else {
          setShowCheatWarning(true);
        }

        return nextCount;
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleViolationTrigger();
      }
    };

    const handleBlurEvent = () => {
      if (isWarningActiveRef.current) return;
      handleViolationTrigger();
    };

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      if (!isCurrentlyFullscreen && isSecureStarted && !isWarningActiveRef.current) {
        handleViolationTrigger();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlurEvent);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('contextmenu', preventDefaultAction);
      document.removeEventListener('copy', preventDefaultAction);
      document.removeEventListener('cut', preventDefaultAction);
      document.removeEventListener('paste', preventDefaultAction);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlurEvent);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isSecureStarted, storageKeyPrefix, student.id, exam.id]);

  // 2. Live listener for force-submit controls from teachers
  useEffect(() => {
    if (examMode === 'offline') {
      const checkForceSubmit = async () => {
        try {
          const res = await fetch('/api/offline/active-sessions');
          if (res.ok) {
            const json = await res.json();
            const mySession = (json.data || []).find((s: any) => s.studentId === student.id);
            if (mySession && mySession.status === 'force_submitted') {
              console.log('Exam force submitted by proctor offline.');
              alert('Ujian Anda telah diselesaikan secara paksa oleh Pengawas/Administrator!');
              cleanUpStorage();
              onFinishExam(answersRef.current);
            }
          }
        } catch (e) {
          // Ignore polling errors
        }
      };

      const interval = setInterval(checkForceSubmit, 3000);
      return () => clearInterval(interval);
    } else {
      const docRef = doc(db, 'active_sessions', student.id);
      const unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.status === 'force_submitted') {
            console.log('Exam force submitted by proctor.');
            alert('Ujian Anda telah diselesaikan secara paksa oleh Pengawas/Administrator!');
            cleanUpStorage();
            onFinishExam(answersRef.current);
          }
        }
      }, (err) => {
        console.warn('Real-time listener bypassed:', err);
      });
      return () => unsubscribe();
    }
  }, [student.id, examMode]);

  // Timer Countdown Effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        const nextTime = prev - 1;
        localStorage.setItem(`${storageKeyPrefix}_time`, nextTime.toString());
        return nextTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [storageKeyPrefix]);

  const currentQuestion = exam.questions[currentIndex];
  const currentAnswer = answers[currentQuestion.id] || { selectedOption: null, isDoubtful: false, essayAnswer: '' };

  const handleSelectOption = (letter: 'A' | 'B' | 'C' | 'D' | 'E') => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        selectedOption: letter
      }
    }));
  };

  const handleChangeEssayAnswer = (val: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        selectedOption: val.trim() !== '' ? 'A' : null,
        essayAnswer: val
      }
    }));
  };

  const handleToggleDoubtful = () => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        isDoubtful: !prev[currentQuestion.id].isDoubtful
      }
    }));
  };

  const handleNext = () => {
    if (currentIndex < exam.questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setShowSubmitModal(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Stats calculation
  const totalQuestions = exam.questions.length;
  const answeredCount = (Object.values(answers) as StudentAnswer[]).filter((a) => a.selectedOption !== null).length;
  const doubtfulCount = (Object.values(answers) as StudentAnswer[]).filter((a) => a.isDoubtful).length;
  const unansweredCount = totalQuestions - answeredCount;

  // Format seconds into HH:MM:SS
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Font class switcher
  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'sm':
        return 'text-sm leading-relaxed';
      case 'lg':
        return 'text-lg md:text-xl leading-relaxed';
      case 'md':
      default:
        return 'text-base leading-relaxed';
    }
  };

  if (!isSecureStarted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full border border-gray-100 shadow-2xl space-y-6 text-center">
          <div className="relative inline-flex items-center justify-center w-20 h-20 mb-3 rounded-full border-2 border-emerald-600 shadow-md overflow-hidden bg-white">
            <img 
              src={logoImg} 
              alt="Logo MA Annuriyyah" 
              className="w-full h-full object-cover z-10"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono font-bold text-emerald-600 tracking-wider">
              CBT MA ANNURIYYAH SECURE SYSTEM
            </span>
            <h2 className="text-xl font-extrabold text-gray-900 mt-1 leading-tight animate-pulse">
              Aktivasi Mode Ujian Aman
            </h2>
            <p className="text-xs text-gray-550 mt-2 leading-relaxed">
              Ujian ini dilindungi oleh sistem keamanan anti-contek real-time. Demi menjaga kejujuran akademik, pastikan Anda memahami peraturan ujian berikut:
            </p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-3.5 text-xs text-gray-650 max-h-60 overflow-y-auto">
            <div className="flex gap-2.5 items-start">
              <span className="w-5 h-5 rounded-full bg-red-50 text-red-650 flex-shrink-0 text-[10px] font-bold flex items-center justify-center">1</span>
              <div>
                <strong>Layar Penuh Otomatis:</strong> Jendela browser Anda wajib memasuki mode layar penuh. Menekan tombol <kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono text-[10px]">ESC</kbd> luar atau memperkecil browser dihukum sebagai pelanggaran hukum tes.
              </div>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="w-5 h-5 rounded-full bg-red-50 text-red-650 flex-shrink-0 text-[10px] font-bold flex items-center justify-center">2</span>
              <div>
                <strong>Dilarang Pindah Aplikasi / Tab:</strong> Mencoba membuka tab baru, berganti aplikasi pendukung (Google Chrome, WA, dll), atau meminimalkan jendela terdeteksi oleh Server secara otomatis.
              </div>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="w-5 h-5 rounded-full bg-red-50 text-red-650 flex-shrink-0 text-[10px] font-bold flex items-center justify-center">3</span>
              <div>
                <strong>Batas Toleransi Maksimal:</strong> Anda diberikan toleransi <strong>maksimal 3 kali peringatan melanggar</strong>. Melampaui batas tersebut menyebabkan jawaban langsung <strong>dikirim paksa</strong> oleh server dan akses ditutup!
              </div>
            </div>
            <div className="flex gap-2.5 items-start">
              <span className="w-5 h-5 rounded-full bg-red-50 text-red-650 flex-shrink-0 text-[10px] font-bold flex items-center justify-center">4</span>
              <div>
                <strong>Blokir Fitur Copy-Paste:</strong> Fitur klik kanan, copy, paste, select teks, serta tombol Inspect F12 dinonaktifkan total selama ujian.
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={handleStartSecureMode}
              className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm rounded-2xl tracking-wider uppercase shadow-md transition-all active:scale-95 cursor-pointer shadow-emerald-700/10"
            >
              Aktifkan Mode Aman & Mulai Ujian
            </button>
            <button
              onClick={() => {
                if (window.confirm('Keluar dari ujian sekarang?')) {
                  onCancel();
                }
              }}
              className="w-full py-2 text-gray-500 hover:text-gray-750 font-bold text-xs hover:bg-gray-100 rounded-xl transition-all"
            >
              Kembali ke Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans select-none pb-12">
      {/* Upper Navigation Bar */}
      <header className="bg-emerald-800 text-white shadow-md py-3 px-4 z-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (window.confirm('Yakin ingin membatalkan ujian? Semua progres pengerjaan akan hilang.')) {
                  cleanUpStorage();
                  onCancel();
                }
              }}
              className="p-1.5 hover:bg-emerald-700/50 rounded-lg text-emerald-100 hover:text-white transition-all mr-1 lg:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="relative w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full border border-amber-400 shadow-sm shadow-emerald-950/20 overflow-hidden bg-white">
              <img 
                src={logoImg} 
                alt="Logo MA Annuriyyah" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="hidden sm:block">
              <span className="text-xs uppercase tracking-wider text-emerald-200 block font-mono font-bold">
                CBT MA ANNURIYYAH
              </span>
              <span className="text-sm font-semibold truncate max-w-[250px] block">
                {exam.title}
              </span>
            </div>
            <div className="sm:hidden text-sm font-bold truncate max-w-[150px]">
              {exam.subject}
            </div>
          </div>

          {/* Size Adjusters and Live Timer */}
          <div className="flex items-center gap-4">
            {/* Font Control Toggle */}
            <div className="hidden lg:flex items-center bg-emerald-900/50 rounded-xl p-1 border border-emerald-700/30">
              <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-300 px-2 hidden md:inline">
                Ukuran Soal
              </span>
              <button
                onClick={() => setFontSize('sm')}
                className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                  fontSize === 'sm' ? 'bg-amber-500 text-white' : 'text-emerald-100 hover:bg-emerald-700/30'
                }`}
              >
                A-
              </button>
              <button
                onClick={() => setFontSize('md')}
                className={`w-7 h-7 rounded-lg text-sm font-semibold flex items-center justify-center transition-all ${
                  fontSize === 'md' ? 'bg-amber-500 text-white' : 'text-emerald-100 hover:bg-emerald-700/30'
                }`}
              >
                A
              </button>
              <button
                onClick={() => setFontSize('lg')}
                className={`w-7 h-7 rounded-lg text-base font-semibold flex items-center justify-center transition-all ${
                  fontSize === 'lg' ? 'bg-amber-500 text-white' : 'text-emerald-100 hover:bg-emerald-700/30'
                }`}
              >
                A+
              </button>
            </div>

            {/* Timer Box */}
            <div className="hidden lg:flex items-center gap-2 bg-black/25 px-4 py-1.5 rounded-xl border border-white/10">
              <Clock className={`w-4 h-4 ${timeLeft < 300 ? 'text-red-400 animate-pulse' : 'text-emerald-300'}`} />
              <span className={`font-mono font-bold tracking-wider text-sm ${timeLeft < 300 ? 'text-red-400' : 'text-emerald-100'}`}>
                {formatTime(timeLeft)}
              </span>
            </div>

            {/* Sidebar Toggle with live question count indicator */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/60 hover:bg-emerald-950/80 active:scale-95 border border-emerald-700/40 rounded-xl text-xs font-bold text-white transition-all shadow-xs cursor-pointer select-none"
            >
              <Menu className="w-4 h-4 text-emerald-200" />
              <span className="hidden sm:inline">Daftar Soal</span>
              <span>{currentIndex + 1}/{totalQuestions}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Splits Workspace */}
      <div className={`w-full mx-auto px-4 mt-6 flex-1 flex flex-col lg:flex-row gap-6 relative transition-all duration-300 ${isSidebarOpen ? 'max-w-7xl' : 'max-w-4xl'}`}>
        
        {/* Mobile Top Information Stack - ONLY VISIBLE ON MOBILE */}
        <div className="lg:hidden flex flex-col gap-4 w-full">
          {/* 1. Asesmen lingkup materi */}
          <div className="bg-emerald-800 text-white p-4 rounded-2xl shadow-xs">
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-emerald-200 block">
              Asesmen Lingkup Materi
            </span>
            <h2 className="text-sm font-extrabold mt-1 leading-tight">{exam.title}</h2>
            <p className="text-xs text-emerald-100/90 mt-0.5 font-medium">{exam.subject}</p>
          </div>

          {/* 2 & 3. Row container for Ukuran Soal & Timer Ujian side-by-side */}
          <div className="grid grid-cols-2 gap-3 w-full">
            {/* Ukuran soal */}
            <div className="bg-white border border-gray-150 p-3 rounded-2xl flex flex-col items-center justify-between shadow-xs">
              <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                <Type className="w-3.5 h-3.5 text-emerald-600" />
                Ukuran Soal
              </span>
              <div className="flex items-center bg-gray-50 rounded-xl p-0.5 border border-gray-200 mt-2">
                <button
                  onClick={() => setFontSize('sm')}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    fontSize === 'sm' ? 'bg-amber-500 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-150'
                  }`}
                >
                  A-
                </button>
                <button
                  onClick={() => setFontSize('md')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    fontSize === 'md' ? 'bg-amber-500 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-150'
                  }`}
                >
                  A
                </button>
                <button
                  onClick={() => setFontSize('lg')}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    fontSize === 'lg' ? 'bg-amber-500 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-150'
                  }`}
                >
                  A+
                </button>
              </div>
            </div>

            {/* Timer ujian */}
            <div className="bg-white border border-gray-150 p-3 rounded-2xl flex flex-col items-center justify-between shadow-xs">
              <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                Sisa Waktu
              </span>
              <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border font-mono font-extrabold text-xs tracking-wider mt-2 ${
                timeLeft < 300 
                  ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' 
                  : 'bg-emerald-50 border-emerald-150 text-emerald-800'
              }`}>
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>

          {/* 4. Daftar soal */}
          <div className="bg-white border border-gray-150 p-4 rounded-2xl space-y-2.5 shadow-xs">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-gray-500">Daftar Soal & Navigasi</span>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-mono">
                {currentIndex + 1} / {totalQuestions}
              </span>
            </div>
            
            {/* Horizontal numbers list scrolling */}
            <div className="flex gap-2 pb-2 pt-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
              {exam.questions.map((q, idx) => {
                const ans = answers[q.id];
                const hasAnswered = ans && ans.selectedOption !== null;
                const isDoubtful = ans && ans.isDoubtful;
                const isSelected = idx === currentIndex;

                let bgClass = 'bg-white border-gray-300 text-gray-700';
                if (hasAnswered && !isDoubtful) {
                  bgClass = 'bg-emerald-600 border-emerald-600 text-white shadow-2xs';
                } else if (isDoubtful) {
                  bgClass = 'bg-amber-500 border-amber-500 text-white shadow-2xs';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`flex-shrink-0 w-10 h-10 rounded-xl border text-xs font-bold flex flex-col items-center justify-center transition-all ${bgClass} ${
                      isSelected ? 'ring-3 ring-emerald-500/30 ring-offset-1' : ''
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {hasAnswered && (
                      <span className="text-[9px] uppercase font-bold -mt-0.5 opacity-90 font-mono">
                        {isQuestionEssay(q) ? '✍️' : ans.selectedOption}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Left Side: Question Pane */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col min-h-[450px]">
            {/* Card Subject SubHeader */}
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm font-mono shadow-sm shadow-emerald-600/10">
                  {currentIndex + 1}
                </span>
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 font-mono">
                  Butir Soal Ke-{currentIndex + 1} dari {totalQuestions}
                </span>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${
                isQuestionEssay(currentQuestion)
                  ? 'bg-blue-50 text-blue-800 border-blue-100'
                  : 'bg-amber-50 text-amber-800 border-amber-100'
              }`}>
                Model: {isQuestionEssay(currentQuestion) ? 'Esai / Uraian Mandiri' : 'Pilihan Ganda (Single Choice)'}
              </span>
            </div>

            {/* Question Text Body */}
            <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-6">
              <div className={`text-gray-800 font-medium tracking-tight ${getFontSizeClass()} select-text whitespace-pre-line`}>
                {currentIndex + 1}. {currentQuestion.text}
              </div>

              {/* Multiple Choice or Essay Blocks */}
              {isQuestionEssay(currentQuestion) ? (
                <div className="space-y-3 mt-6 animate-fade-in text-left">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Lembar Jawaban Esai / Uraian:
                  </label>
                  <textarea
                    rows={8}
                    value={currentAnswer.essayAnswer || ''}
                    onChange={(e) => handleChangeEssayAnswer(e.target.value)}
                    placeholder="Tulis lembar jawaban uraian Anda secara lengkap, padat & jelas..."
                    className="w-full p-4 bg-white border border-gray-250 rounded-2xl text-sm leading-relaxed focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-sans font-medium"
                  />
                  <div className="text-[11px] text-gray-400 font-mono flex justify-between items-center px-1">
                    <span>Mendukung karakter teks bebas & paragraf baru.</span>
                    <span>Panjang karakter: {(currentAnswer.essayAnswer || '').length} huruf</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 mt-6">
                  {currentQuestion.options.map((option) => {
                    const isOptionSelected = currentAnswer.selectedOption === option.letter;
                    return (
                      <button
                        key={option.letter}
                        onClick={() => handleSelectOption(option.letter)}
                        className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-4 ${
                          isOptionSelected
                            ? 'border-emerald-600 bg-emerald-50/20 text-emerald-900 font-medium shadow-2xs'
                            : 'border-gray-200 hover:border-emerald-200 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {/* Round Option Indicator */}
                        <span
                          className={`w-7 h-7 italic shrink-0 rounded-full border text-xs font-bold flex items-center justify-center transition-all font-mono ${
                            isOptionSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-white border-gray-350 text-gray-500'
                          }`}
                        >
                          {option.letter}
                        </span>
                        <span className="text-sm font-sans pt-0.5 leading-relaxed select-text">
                          {option.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Card Navigation / Controls */}
            <div className="p-4 md:p-6 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <button
                disabled={currentIndex === 0}
                onClick={handlePrev}
                className="w-full sm:w-auto px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all shadow-2xs hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white flex items-center justify-center gap-1.5 uppercase"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Sebelumnya
              </button>

              <button
                onClick={handleToggleDoubtful}
                className={`w-full sm:w-auto px-5 py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 uppercase ${
                  currentAnswer.isDoubtful
                    ? 'bg-amber-500 border-amber-600 text-white shadow-md shadow-amber-500/10'
                    : 'bg-white border-amber-200 text-amber-700 hover:bg-amber-50/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={currentAnswer.isDoubtful}
                  readOnly
                  className="w-3.5 h-3.5 accent-amber-600 pointer-events-none rounded"
                />
                Ragu-Ragu
              </button>

              <button
                onClick={handleNext}
                className={`w-full sm:w-auto px-6 py-2.5 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 uppercase ${
                  currentIndex === exam.questions.length - 1
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/10'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/10'
                }`}
              >
                {currentIndex === exam.questions.length - 1 ? 'Selesai Ujian' : 'Berikutnya'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Navigation Grid & Session Sidebar (Desktop Only) */}
        <aside
          className={`shrink-0 bg-white rounded-3xl p-6 border border-gray-100 self-start transition-all duration-300 hidden lg:block
            ${isSidebarOpen
              ? 'lg:w-80 lg:block lg:shadow-sm'
              : 'lg:hidden'
            }`}
        >
          {/* Close Sidebar button on Mobile */}
          <div className="flex lg:hidden justify-between items-center pb-4 mb-4 border-b border-gray-100">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Navigasi Ujian
            </span>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Student Info Box */}
            <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex flex-col">
              <span className="text-[10px] uppercase font-mono font-bold text-emerald-600">Peserta</span>
              <span className="text-sm font-bold text-gray-800 mt-0.5">{student.name}</span>
              <span className="text-xs text-gray-500 font-mono mt-0.5">NISN: {student.nisn}</span>
            </div>

            {/* Live Progress Widget */}
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-semibold tracking-wider uppercase font-mono">
              <div className="p-2 bg-gray-50 border border-gray-100 rounded-xl">
                <span className="text-gray-400 block">Kosong</span>
                <span className="text-xs font-bold text-gray-700 mt-0.5 block">{unansweredCount}</span>
              </div>
              <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                <span className="text-emerald-700 block">Isi</span>
                <span className="text-xs font-bold text-emerald-800 mt-0.5 block">{answeredCount - doubtfulCount}</span>
              </div>
              <div className="p-2 bg-amber-50 border border-amber-100 rounded-xl">
                <span className="text-amber-800 block font-bold">Ragu</span>
                <span className="text-xs font-bold text-amber-700 mt-0.5 block">{doubtfulCount}</span>
              </div>
            </div>

            {/* Navigator List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Nomor Soal Ujian
              </h4>
              <div className="grid grid-cols-5 gap-2.5">
                {exam.questions.map((q, idx) => {
                  const ans = answers[q.id];
                  const hasAnswered = ans && ans.selectedOption !== null;
                  const isDoubtful = ans && ans.isDoubtful;
                  const isSelected = idx === currentIndex;

                  // Determine background classes based on state
                  let bgClass = 'bg-white border-gray-250 text-gray-700 hover:border-gray-400';
                  if (hasAnswered && !isDoubtful) {
                    bgClass = 'bg-emerald-600 border-emerald-600 text-white shadow-2xs shadow-emerald-600/10';
                  } else if (isDoubtful) {
                    bgClass = 'bg-amber-500 border-amber-500 text-white shadow-2xs shadow-amber-500/10';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setCurrentIndex(idx);
                        // Auto close mobile sidebar
                        if (window.innerWidth < 1024) {
                          setIsSidebarOpen(false);
                        }
                      }}
                      className={`relative aspect-square rounded-xl border text-sm font-bold flex flex-col items-center justify-center transition-all ${bgClass} ${
                        isSelected ? 'ring-3 ring-emerald-500/30 ring-offset-2' : ''
                      }`}
                    >
                      <span>{idx + 1}</span>
                      {hasAnswered && (
                        <span className={`text-[10px] uppercase font-bold mt-0.5 ${isDoubtful || hasAnswered ? 'text-white' : 'text-gray-400'}`}>
                          {isQuestionEssay(q) ? '✍️' : ans.selectedOption}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Big Lock Finish Button */}
            <button
              onClick={() => setShowSubmitModal(true)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl tracking-wider transition-all uppercase shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20"
            >
              Selesaikan Tes Sekarang
            </button>
          </div>
        </aside>
      </div>

      {/* Layered CBT Submit Modal Backdrop */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full border border-gray-100 p-6 md:p-8 space-y-6 shadow-2xl relative my-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 border border-blue-100 text-blue-600 mb-3">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">
                Konfirmasi Menyelesaikan Tes
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Harap periksa kembali rangkuman jawaban ujian Anda di bawah.
              </p>
            </div>

            {/* Quick status cards */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 rounded-2xl">
              <div className="text-center">
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Sudah Diisi</span>
                <span className="text-lg font-extrabold text-emerald-600 mt-0.5 block">{answeredCount}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Ragu-Ragu</span>
                <span className="text-lg font-extrabold text-amber-500 mt-0.5 block">{doubtfulCount}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-gray-400 font-bold uppercase block font-mono">Belum Diisi</span>
                <span className="text-lg font-extrabold text-red-500 mt-0.5 block">{unansweredCount}</span>
              </div>
            </div>

            {/* Warning if incomplete */}
            {unansweredCount > 0 && (
              <div className="flex gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Peringatan!</strong> Masih ada <strong className="font-mono">{unansweredCount} soal</strong> yang belum dijawab. Nilai Anda akan berkurang jika membiarkannya kosong.
                </div>
              </div>
            )}

            {doubtfulCount > 0 && (
              <div className="flex gap-2.5 p-3.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 leading-relaxed">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Peringatan!</strong> Anda masih memiliki <strong className="font-mono">{doubtfulCount} soal</strong> bertanda Ragu-Ragu. Tanda ragu-ragu tidak membatalkan jawaban Anda, namun dianjurkan untuk dinormalkan kembali.
                </div>
              </div>
            )}

            {/* Checklist Agreement */}
            <div className="p-4 bg-gray-50 border border-gray-150 rounded-xl transition-all">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmCheck}
                  onChange={(e) => setConfirmCheck(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded accent-emerald-600 text-white shrink-0"
                />
                <span className="text-xs text-gray-600 leading-relaxed">
                  Saya menyatakan dengan sadar bahwa saya telah menyelesaikan ujian secara jujur dan siap merangkum hasil jawaban.
                </span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={!confirmCheck}
                onClick={() => handleAutoSubmit(violationCount)}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all disabled:opacity-45 disabled:hover:bg-blue-600 shadow-md shadow-blue-600/15"
              >
                Ya, Selesaikan Tes
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSubmitModal(false);
                  setConfirmCheck(false);
                }}
                className="p-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm rounded-xl transition-all"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Violation warning modal */}
      {showCheatWarning && (
        <div className="fixed inset-0 bg-red-950/85 backdrop-blur-md flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full border-4 border-red-500 p-6 md:p-8 space-y-6 shadow-2xl relative my-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 border border-red-100 text-red-600 mb-3 animate-pulse">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-red-700 tracking-tight">
                DETEKSI PELANGGARAN CBT!
              </h3>
              <p className="text-xs text-gray-550 mt-1 leading-relaxed">
                Anda dideteksi mencoba meninggalkan layar ujian, beralih ke tab/aplikasi lain, atau menutup mode layar penuh!
              </p>
            </div>

            {/* Warning Details Counter */}
            <div className="p-4 bg-red-50 border border-red-150 rounded-2xl text-center">
              <span className="text-[10px] uppercase font-mono font-bold text-red-750 block">Toleransi Peringatan Terlewati</span>
              <span className="text-3xl font-black text-red-605 mt-1.5 block font-mono animate-bounce">
                {violationCount} / 3
              </span>
              <span className="text-[10px] text-gray-500 block mt-1.5 font-sans font-medium">
                Pada pelanggaran ke-3, lembar ujian Anda akan langsung dikirim otomatis!
              </span>
            </div>

            <div className="flex gap-2.5 p-3.5 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-850 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Sanksi Tegas:</strong> Pelanggaran Anda dicatat secara real-time di server pengawas. Harap fokus penuh pada pengerjaan soal dan jangan berpindah layar!
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleDismissWarning}
                className="w-full py-3 bg-red-600 hover:bg-red-750 text-white font-extrabold text-sm rounded-xl tracking-wide uppercase transition-all shadow-md active:scale-95 cursor-pointer shadow-red-600/10"
              >
                Saya Mengerti & Berjanji Jujur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
