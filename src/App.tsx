import { useState, useEffect } from 'react';
import { RefreshCw, Trash2, Wrench, ShieldAlert, Share2, Smartphone, Download } from 'lucide-react';
import Login from './components/Login';
import StudentDashboard from './components/StudentDashboard';
import ExamInterface from './components/ExamInterface';
import TeacherDashboard from './components/TeacherDashboard';
import logoImg from './assets/images/ma_logo_clean_1780675707006.png';
import { defaultStudents, defaultExams, defaultResults } from './data/sampleData';
import { Student, Exam, ExamResult, StudentAnswer, Teacher, ActiveSession } from './types';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, where, getDocs, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

interface CurrentUser {
  id: string;
  name: string;
  role: 'student' | 'teacher';
  studentDetails?: Student;
  teacherDetails?: Teacher;
}

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);

  // PWA Installation states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Hidden utility: tap 5 times to reveal
  const [iconVisible, setIconVisible] = useState(() => {
    return localStorage.getItem('cbt_clean_icon_visible') === 'true';
  });
  const [tapCount, setTapCount] = useState(0);
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState<'draft' | 'total' | null>(null);

  // Reset tap count after 3 seconds of inactivity
  useEffect(() => {
    if (tapCount > 0) {
      const timer = setTimeout(() => {
        setTapCount(0);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [tapCount]);

  // Handle PWA installation trigger
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const isDismissed = localStorage.getItem('cbt_pwa_dismissed_v1');
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
      if (!isDismissed && !isStandalone) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Prompt new users shortly after application opens if they haven't dismissed yet and aren't already standalone
    const isDismissed = localStorage.getItem('cbt_pwa_dismissed_v1');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (!isDismissed && !isStandalone) {
      const timer = setTimeout(() => {
        setShowInstallBanner(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInvisibleTap = () => {
    setTapCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setIconVisible(true);
        localStorage.setItem('cbt_clean_icon_visible', 'true');
        setSuccessToast('Tombol Reset muncul di pojok kiri atas!');
        return 0;
      }
      return next;
    });
  };

  const handleCleanDraft = async () => {
    setIsCleaning('draft');
    await new Promise((resolve) => setTimeout(resolve, 1200));

    try {
      const preservedKeys = [
        'cbt_current_user',
        'cbt_active_exam',
        'cbt_exam_answers',
        'cbt_violation_count',
        'cbt_clean_icon_visible'
      ];
      
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !preservedKeys.includes(key)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      sessionStorage.clear();
      
      setSuccessToast('Draft formulir berhasil dibersihkan! Memuat ulang...');
      setIsDiagnosticModalOpen(false);
      
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      console.error('Failed to clean draft:', err);
    } finally {
      setIsCleaning(null);
    }
  };

  const handleResetTotal = async () => {
    setIsCleaning('total');
    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      localStorage.clear();
      sessionStorage.clear();
      
      setSuccessToast('Aplikasi berhasil direset total ke setelan pabrik!');
      setIsDiagnosticModalOpen(false);
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error('Failed to reset application:', err);
    } finally {
      setIsCleaning(null);
    }
  };

  const handleShare = async () => {
    const shareUrl = 'https://s.id/CBT_MA_ANNURIYYAH';
    const shareTitle = 'CBT MA Annuriyyah';
    const shareText = 'Ujian Online CBT MA Annuriyyah - Responsif, Cepat & Handal.';

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        setSuccessToast('Berhasil membagikan info CBT!');
      } catch (err) {
        // Log clean but subtle warning
        console.warn('Native share dismissed or failed:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setSuccessToast('Tautan CBT berhasil disalin ke papan klip!');
      } catch (err) {
        console.error('Failed to copy share link:', err);
        setSuccessToast('Silakan salin: https://s.id/CBT_MA_ANNURIYYAH');
      }
    }
  };

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Installed trigger result: ${outcome}`);
        setDeferredPrompt(null);
        setShowInstallBanner(false);
      } catch (err) {
        console.error('Error triggering PWA prompt:', err);
      }
    } else if (window.self !== window.top) {
      // If we are inside an iframe (like AI Studio preview), redirecting to a new tab is required
      // because browser security strictly forbids programmatic PWA install prompt inside iframes.
      window.open('https://s.id/CBT_MA_ANNURIYYAH', '_blank');
      setSuccessToast('Membuka tautan resmi CBT di tab baru untuk instalasi otomatis...');
      setShowInstallBanner(false);
    } else {
      setSuccessToast('Silakan buka menu browser Anda (titik tiga) lalu pilih "Tambahkan ke Layar Utama" atau "Instal Aplikasi".');
      setShowInstallBanner(false);
    }
  };

  const handleDismissInstall = () => {
    setShowInstallBanner(false);
    localStorage.setItem('cbt_pwa_dismissed_v1', 'true');
  };

  // Local storage for current user and active exam session to tolerate page reloads
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    const saved = localStorage.getItem('cbt_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [loading, setLoading] = useState(currentUser !== null);
  const [syncStatus, setSyncStatus] = useState<'connected' | 'offline'>(() => {
    return navigator.onLine ? 'connected' : 'offline';
  });
  const [examMode, setExamMode] = useState<'online' | 'offline'>(() => {
    const cached = localStorage.getItem('cbt_exam_mode') as 'online' | 'offline';
    if (!navigator.onLine) return 'offline';
    return cached || 'online';
  });

  const handleToggleExamMode = async (mode: 'online' | 'offline') => {
    setExamMode(mode);
    localStorage.setItem('cbt_exam_mode', mode);
    setSuccessToast(`Beralih ke ${mode === 'online' ? 'Mode Online (Koneksi Cloud Firestore)' : 'Mode Offline (Penyimpanan Mandiri Tanpa Internet)'}`);

    // Update local Express offline server system mode
    fetch('/api/offline/exam-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examMode: mode })
    }).catch(() => {});

    // If connected, sync this setting globally to Firestore so all students' devices receive it
    if (navigator.onLine) {
      try {
        await setDoc(doc(db, 'settings', 'exam_config'), {
          examMode: mode,
          updatedBy: currentUser?.name || 'Admin',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn('Gagal menyelaraskan status mode ujian ke server:', err);
      }
    }
  };

  // Real-time listener for global exam mode selection from Firestore
  useEffect(() => {
    if (!navigator.onLine) return;

    let active = true;
    const configDocRef = doc(db, 'settings', 'exam_config');
    
    const unsubscribe = onSnapshot(configDocRef, (snapshot) => {
      if (snapshot.exists() && active) {
        const data = snapshot.data();
        const serverMode = data.examMode as 'online' | 'offline';
        if (serverMode && serverMode !== examMode) {
          setExamMode(serverMode);
          localStorage.setItem('cbt_exam_mode', serverMode);
          setSuccessToast(`Mode Ujian otomatis disinkronkan oleh Admin: ${serverMode === 'online' ? 'ONLINE (Koneksi Cloud)' : 'OFFLINE (Tanpa Internet)'}`);
        }
      }
    }, (error) => {
      console.warn('Sync listener bypassed (or offline):', error);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [examMode]);

  // Listen to browser network changes to automatically act
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus('connected');
      setSuccessToast('Koneksi internet terdeteksi kembali! Anda dapat menyelaraskan dengan server.');
    };

    const handleOffline = () => {
      setSyncStatus('offline');
      setExamMode('offline');
      localStorage.setItem('cbt_exam_mode', 'offline');
      setSuccessToast('Koneksi internet terputus! Aplikasi otomatis beralih ke Mode Offline aman.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Local Express offline server background synchronizer
  useEffect(() => {
    if (examMode !== 'offline') return;

    const syncOfflineLocalServer = async () => {
      try {
        // Poll Exam-Mode
        const configRes = await fetch('/api/offline/exam-mode');
        if (configRes.ok) {
          const config = await configRes.json();
          if (config.examMode && config.examMode !== examMode) {
            setExamMode(config.examMode);
            localStorage.setItem('cbt_exam_mode', config.examMode);
          }
        }

        // Poll Exams
        const examsRes = await fetch('/api/offline/exams');
        if (examsRes.ok) {
          const json = await examsRes.json();
          if (json.data && Array.isArray(json.data)) {
            const strNew = JSON.stringify(json.data);
            const strOld = localStorage.getItem('cbt_offline_exams') || '';
            if (strNew !== strOld) {
              setExams(json.data);
              localStorage.setItem('cbt_offline_exams', strNew);
            }
          }
        }

        // Poll Students
        const studentsRes = await fetch('/api/offline/students');
        if (studentsRes.ok) {
          const json = await studentsRes.json();
          if (json.data && Array.isArray(json.data)) {
            const strNew = JSON.stringify(json.data);
            const strOld = localStorage.getItem('cbt_offline_students') || '';
            if (strNew !== strOld) {
              setStudents(json.data);
              localStorage.setItem('cbt_offline_students', strNew);
            }
          }
        }

        // Poll Results
        const resultsRes = await fetch('/api/offline/results');
        if (resultsRes.ok) {
          const json = await resultsRes.json();
          if (json.data && Array.isArray(json.data)) {
            const strNew = JSON.stringify(json.data);
            const strOld = localStorage.getItem('cbt_offline_results') || '';
            if (strNew !== strOld) {
              setResults(json.data);
              localStorage.setItem('cbt_offline_results', strNew);
            }
          }
        }

        // Poll Active sessions (important for teacher monitor panel offline!)
        const sessionsRes = await fetch('/api/offline/active-sessions');
        if (sessionsRes.ok) {
          const json = await sessionsRes.json();
          if (json.data && Array.isArray(json.data)) {
            const strNew = JSON.stringify(json.data);
            const strOld = localStorage.getItem('cbt_offline_active_sessions') || '';
            if (strNew !== strOld) {
              setActiveSessions(json.data);
              localStorage.setItem('cbt_offline_active_sessions', strNew);
            }
          }
        }
      } catch (err) {
        // Suppress polling log spam in console when server is briefly down
      }
    };

    // Run first immediately
    syncOfflineLocalServer();

    // Setup polling every 4 seconds
    const pollId = setInterval(syncOfflineLocalServer, 4000);

    return () => clearInterval(pollId);
  }, [examMode]);

  const [activeExam, setActiveExam] = useState<Exam | null>(() => {
    const saved = localStorage.getItem('cbt_active_exam');
    return saved ? JSON.parse(saved) : null;
  });

  // Real-time Firestore Sync optimized by User Role
  useEffect(() => {
    let active = true;

    // Background seeding on load - running once silently when first accessing empty database
    const checkAndSeed = async () => {
      if (!currentUser || currentUser.role !== 'teacher') return;
      
      // Only check and seed once per tab session to make first access extremely lightweight
      if (sessionStorage.getItem('cbt_database_seeded_checked')) return;
      sessionStorage.setItem('cbt_database_seeded_checked', 'true');

      try {
        const examsSnap = await getDocs(query(collection(db, 'exams'), limit(1)));
        if (examsSnap.empty && active) {
          console.log('Database empty. Seeding defaults for MA Annuriyyah...');
          for (const std of defaultStudents) {
            await setDoc(doc(db, 'students', std.id), std);
          }
          for (const ex of defaultExams) {
            await setDoc(doc(db, 'exams', ex.id), ex);
          }
          const initialTeachers: Teacher[] = [
            { id: 't_1', username: 'aedia', name: 'Aedia Janur', password: 'aedia', role: 'admin' }
          ];
          for (const t of initialTeachers) {
            await setDoc(doc(db, 'teachers', t.id), t);
          }
          console.log('Database seeded.');
        }
      } catch (err) {
        console.warn('Auto-seed check bypassed:', err);
      }
    };
    checkAndSeed();

    if (!currentUser) {
      setLoading(false);
      return;
    }

    if (examMode === 'offline') {
      const cachedStudents = localStorage.getItem('cbt_offline_students');
      const cachedExams = localStorage.getItem('cbt_offline_exams');
      const cachedResults = localStorage.getItem('cbt_offline_results');
      const cachedTeachers = localStorage.getItem('cbt_offline_teachers');
      const cachedSessions = localStorage.getItem('cbt_offline_active_sessions');

      setStudents(cachedStudents ? JSON.parse(cachedStudents) : defaultStudents);
      setExams(cachedExams ? JSON.parse(cachedExams) : defaultExams);
      setResults(cachedResults ? JSON.parse(cachedResults) : defaultResults);
      setTeachers(cachedTeachers ? JSON.parse(cachedTeachers) : [
        { id: 't_1', username: 'aedia', name: 'Aedia (Admin)', password: 'aedia', role: 'admin' }
      ]);
      setActiveSessions(cachedSessions ? JSON.parse(cachedSessions) : []);

      // Fast async fetch overlay from local Express offline server to load current database
      Promise.all([
        fetch('/api/offline/students').then(r => r.json()).catch(() => null),
        fetch('/api/offline/exams').then(r => r.json()).catch(() => null),
        fetch('/api/offline/results').then(r => r.json()).catch(() => null),
        fetch('/api/offline/teachers').then(r => r.json()).catch(() => null),
        fetch('/api/offline/active-sessions').then(r => r.json()).catch(() => null),
      ]).then(([studentsRes, examsRes, resultsRes, teachersRes, sessionsRes]) => {
        if (studentsRes && studentsRes.data) {
          setStudents(studentsRes.data);
          localStorage.setItem('cbt_offline_students', JSON.stringify(studentsRes.data));
        }
        if (examsRes && examsRes.data) {
          setExams(examsRes.data);
          localStorage.setItem('cbt_offline_exams', JSON.stringify(examsRes.data));
        }
        if (resultsRes && resultsRes.data) {
          setResults(resultsRes.data);
          localStorage.setItem('cbt_offline_results', JSON.stringify(resultsRes.data));
        }
        if (teachersRes && teachersRes.data && teachersRes.data.length > 0) {
          setTeachers(teachersRes.data);
          localStorage.setItem('cbt_offline_teachers', JSON.stringify(teachersRes.data));
        }
        if (sessionsRes && sessionsRes.data) {
          setActiveSessions(sessionsRes.data);
          localStorage.setItem('cbt_offline_active_sessions', JSON.stringify(sessionsRes.data));
        }
      }).finally(() => {
        setLoading(false);
      });
      return;
    }

    const unsubscribers: (() => void)[] = [];

    if (currentUser.role === 'teacher') {
      // PROCTORING/TEACHER SUBSCRIPTIONS (Fully real-time live panel)
      const loaded = { students: false, exams: false, results: false, teachers: false, activeSessions: false };
      
      const checkLoading = () => {
        if (loaded.students && loaded.exams && loaded.results && loaded.teachers && loaded.activeSessions) {
          setLoading(false);
        }
      };

      const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
        const list: Student[] = [];
        snapshot.forEach((snap) => list.push(snap.data() as Student));
        setStudents(list);
        loaded.students = true;
        checkLoading();
      }, (err) => {
        console.error('Students sync failed for teacher:', err);
        setStudents(defaultStudents);
        loaded.students = true;
        checkLoading();
      });
      unsubscribers.push(unsubStudents);

      const unsubExams = onSnapshot(collection(db, 'exams'), (snapshot) => {
        const list: Exam[] = [];
        snapshot.forEach((snap) => list.push(snap.data() as Exam));
        setExams(list);
        loaded.exams = true;
        checkLoading();
      }, (err) => {
        console.error('Exams sync failed for teacher:', err);
        setExams(defaultExams);
        loaded.exams = true;
        checkLoading();
      });
      unsubscribers.push(unsubExams);

      const unsubResults = onSnapshot(collection(db, 'results'), (snapshot) => {
        const list: ExamResult[] = [];
        snapshot.forEach((snap) => list.push(snap.data() as ExamResult));
        list.sort((a, b) => b.completedTime - a.completedTime);
        setResults(list);
        loaded.results = true;
        checkLoading();
      }, (err) => {
        console.error('Results sync failed for teacher:', err);
        setResults(defaultResults);
        loaded.results = true;
        checkLoading();
      });
      unsubscribers.push(unsubResults);

      const unsubTeachers = onSnapshot(collection(db, 'teachers'), (snapshot) => {
        const list: Teacher[] = [];
        snapshot.forEach((snap) => {
          const t = snap.data() as Teacher;
          // Auto-migrate "Ahmad Fauzi" to "Aedia Janur"
          if (t.name && (t.name.includes('Ahmad Fauzi') || t.name.includes('Fauzi'))) {
            t.name = 'Aedia Janur';
            setDoc(doc(db, 'teachers', t.id), t).catch(console.error);
          }
          list.push(t);
        });
        setTeachers(list);
        loaded.teachers = true;
        checkLoading();
      }, (err) => {
        console.error('Teachers sync failed for teacher:', err);
        loaded.teachers = true;
        checkLoading();
      });
      unsubscribers.push(unsubTeachers);

      const unsubActiveSessions = onSnapshot(collection(db, 'active_sessions'), (snapshot) => {
        const list: ActiveSession[] = [];
        snapshot.forEach((snap) => list.push(snap.data() as ActiveSession));
        setActiveSessions(list);
        loaded.activeSessions = true;
        checkLoading();
      }, (err) => {
        console.error('Active sessions sync failed:', err);
        loaded.activeSessions = true;
        checkLoading();
      });
      unsubscribers.push(unsubActiveSessions);

    } else {
      // STUDENTS SUBSCRIPTIONS (Super light, hyper-targeted)
      const loaded = { exams: false, results: false };
      
      const checkLoading = () => {
        if (loaded.exams && loaded.results) {
          setLoading(false);
        }
      };

      // Query active exams
      const unsubExams = onSnapshot(collection(db, 'exams'), (snapshot) => {
        const list: Exam[] = [];
        snapshot.forEach((snap) => list.push(snap.data() as Exam));
        setExams(list);
        loaded.exams = true;
        checkLoading();
      }, (err) => {
        console.error('Exams sync failed for student:', err);
        setExams(defaultExams);
        loaded.exams = true;
        checkLoading();
      });
      unsubscribers.push(unsubExams);

      // Filtered Results: Retrieve ONLY personal results. Zero download cross-clash!
      const qPersonalResults = query(collection(db, 'results'), where('studentId', '==', currentUser.id));
      const unsubResults = onSnapshot(qPersonalResults, (snapshot) => {
        const list: ExamResult[] = [];
        snapshot.forEach((snap) => list.push(snap.data() as ExamResult));
        list.sort((a, b) => b.completedTime - a.completedTime);
        setResults(list);
        loaded.results = true;
        checkLoading();
      }, (err) => {
        console.error('Personal results sync failed for student:', err);
        setResults(defaultResults.filter(r => r.studentId === currentUser.id));
        loaded.results = true;
        checkLoading();
      });
      unsubscribers.push(unsubResults);
    }

    return () => {
      active = false;
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [currentUser, examMode]);

  // Handle dynamic login on submit
  const handleLoginAttempt = async (
    role: 'student' | 'teacher',
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string; user?: CurrentUser }> => {
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (examMode === 'offline') {
      // Local authentication for offline mode
      if (role === 'teacher') {
        const cachedTeachers = localStorage.getItem('cbt_offline_teachers');
        const localTeachersList: Teacher[] = cachedTeachers ? JSON.parse(cachedTeachers) : [
          { id: 't_1', username: 'aedia', name: 'Aedia (Admin)', password: 'aedia', role: 'admin' }
        ];
        const found = localTeachersList.find(t => t.username.toLowerCase() === cleanUsername && t.password === cleanPassword);
        if (found) {
          return {
            success: true,
            user: { id: found.id, name: found.name, role: 'teacher', teacherDetails: found }
          };
        }
      } else {
        const cachedStudents = localStorage.getItem('cbt_offline_students');
        const localStudentsList: Student[] = cachedStudents ? JSON.parse(cachedStudents) : defaultStudents;
        const found = localStudentsList.find(
          s => (s.username.toLowerCase() === cleanUsername || s.nisn === cleanUsername) && s.password === cleanPassword
        );
        if (found) {
          return {
            success: true,
            user: { id: found.id, name: found.name, role: 'student', studentDetails: found }
          };
        }
      }
      return { success: false, error: 'Username/Password salah pada Mode Offline.' };
    }

    try {
      if (role === 'teacher') {
        const teachersRef = collection(db, 'teachers');
        const q = query(teachersRef, where('username', '==', cleanUsername), limit(1));
        const snap = await getDocs(q);

        if (!snap.empty) {
          const docData = snap.docs[0].data() as Teacher;
          if (docData.password.trim() === cleanPassword) {
            const user: CurrentUser = {
              id: docData.id,
              name: docData.name,
              role: 'teacher',
              teacherDetails: docData
            };
            return { success: true, user };
          }
        }

        if (cleanUsername === 'aedia' && cleanPassword === 'aedia') {
          const defaultAdmin: Teacher = {
            id: 't_1',
            username: 'aedia',
            name: 'Aedia Janur',
            password: 'aedia',
            role: 'admin'
          };
          setDoc(doc(db, 'teachers', defaultAdmin.id), defaultAdmin).catch(console.error);
          return {
            success: true,
            user: { id: defaultAdmin.id, name: defaultAdmin.name, role: 'teacher', teacherDetails: defaultAdmin }
          };
        }

        return { success: false, error: 'Kredensial Guru / Admin salah. Silakan periksa password Anda.' };
      } else {
        const studentsRef = collection(db, 'students');

        let q = query(studentsRef, where('username', '==', cleanUsername), limit(1));
        let snap = await getDocs(q);

        if (snap.empty) {
          q = query(studentsRef, where('nisn', '==', cleanUsername), limit(1));
          snap = await getDocs(q);
        }

        if (!snap.empty) {
          const docData = snap.docs[0].data() as Student;
          if (docData.password.trim() === cleanPassword) {
            const user: CurrentUser = {
              id: docData.id,
              name: docData.name,
              role: 'student',
              studentDetails: docData
            };
            return { success: true, user };
          }
        }

        if (cleanUsername === 'janur' && cleanPassword === '123') {
          const defaultJanur = defaultStudents[0];
          setDoc(doc(db, 'students', defaultJanur.id), defaultJanur).catch(console.error);
          return {
            success: true,
            user: { id: defaultJanur.id, name: defaultJanur.name, role: 'student', studentDetails: defaultJanur }
          };
        }

        return { success: false, error: 'Username/NISN atau Password siswa salah. Pastikan sudah didaftarkan.' };
      }
    } catch (e) {
      console.warn('Network query failed. Falling back to secure local backup authentication...', e);
      if (role === 'teacher') {
        const found = [
          { id: 't_1', username: 'aedia', name: 'Aedia Janur', password: 'aedia', role: 'admin' }
        ].find(t => t.username === cleanUsername && t.password === cleanPassword);
        if (found) {
          return {
            success: true,
            user: { id: found.id, name: found.name, role: 'teacher', teacherDetails: found as Teacher }
          };
        }
      } else {
        const found = defaultStudents.find(
          s => (s.username.toLowerCase() === cleanUsername || s.nisn === cleanUsername) && s.password === cleanPassword
        );
        if (found) {
          return {
            success: true,
            user: { id: found.id, name: found.name, role: 'student', studentDetails: found }
          };
        }
      }
      return { success: false, error: 'Terjadi kegagalan koneksi atau kredensial salah.' };
    }
  };

  // Sync user session to localStorage for reload tolerance
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('cbt_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('cbt_current_user');
    }
  }, [currentUser]);

  // Migrate cached browser session with former name Ahmad Fauzi to Aedia Janur instantaneously
  useEffect(() => {
    if (currentUser && currentUser.name && (currentUser.name.includes('Ahmad Fauzi') || currentUser.name.includes('Fauzi'))) {
      setCurrentUser(prev => {
        if (!prev) return null;
        const updated = {
          ...prev,
          name: 'Aedia Janur'
        };
        if (updated.teacherDetails) {
          updated.teacherDetails.name = 'Aedia Janur';
        }
        return updated;
      });
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeExam) {
      localStorage.setItem('cbt_active_exam', JSON.stringify(activeExam));
    } else {
      localStorage.removeItem('cbt_active_exam');
    }
  }, [activeExam]);

  const handleLoginSuccess = (user: CurrentUser) => {
    // If logging in as teacher, re-fetch correct details to ensure no stale data from old session
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveExam(null);
  };

  const handleStartExam = (selectedExam: Exam) => {
    setActiveExam(selectedExam);
  };

  const handleCancelExam = () => {
    setActiveExam(null);
  };

  // Processing student exam responses after submit button triggers
  const handleFinishExam = async (studentAnswers: Record<string, StudentAnswer>, violationsCount?: number) => {
    if (!activeExam || !currentUser || !currentUser.studentDetails) return;

    // Filter questions by type
    const mcQuestions = activeExam.questions.filter((q) => q.type !== 'essay');
    const essayQuestions = activeExam.questions.filter((q) => q.type === 'essay');

    // Calculate accuracy ratio for multiple choice questions
    let correctCount = 0;
    mcQuestions.forEach((question) => {
      const response = studentAnswers[question.id];
      if (response && response.selectedOption === question.correctAnswer) {
        correctCount += 1;
      }
    });

    const totalMc = mcQuestions.length;
    const score = totalMc > 0 ? Math.round((correctCount / totalMc) * 100) : 100;

    // Extract student essay answers
    const essayAnswers: Record<string, string> = {};
    essayQuestions.forEach((question) => {
      const response = studentAnswers[question.id];
      essayAnswers[question.id] = response?.essayAnswer || '-';
    });

    const totalQuestions = activeExam.questions.length;

    // Construct persistent ExamResult representation
    const newResult: ExamResult = {
      id: `result_${Date.now()}`,
      studentId: currentUser.id,
      studentName: currentUser.name,
      studentNisn: currentUser.studentDetails.nisn,
      classGroup: currentUser.studentDetails.classGroup,
      examId: activeExam.id,
      examTitle: activeExam.title,
      examSubject: activeExam.subject,
      totalQuestions,
      correctCount,
      score,
      completedTime: Date.now(),
      violationsCount: violationsCount || 0,
      essayAnswers
    };

    if (examMode === 'offline') {
      const updated = [newResult, ...results];
      setResults(updated);
      localStorage.setItem('cbt_offline_results', JSON.stringify(updated));
      
      // Auto-save/POST to our Offline Express Server over WLAN
      fetch('/api/offline/submit-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newResult)
      })
      .then(res => {
        if (res.ok) {
          setSuccessToast('Ujian selesai! Jawaban dan nilai Anda berhasil tersimpan otomatis di PC Server!');
        } else {
          setSuccessToast('Ujian selesai! Jawaban disimpan pada memori lokal browser (Gagal kirim ke Server).');
        }
      })
      .catch(err => {
        console.warn('Gagal kirim hasil ujian ke server offline:', err);
        setSuccessToast('Ujian selesai! disimpan lokal (Hubungi Operator/Pengawas untuk unduh manual).');
      });

      setActiveExam(null);
      return;
    }

    // Update Firestore directly
    try {
      await setDoc(doc(db, 'results', newResult.id), newResult);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `results/${newResult.id}`);
    }

    setActiveExam(null);
  };

  // State modifiers invoked by Teacher Dashboard now sync via Firestore writes
  const handleUpdateStudents = async (updatedStudents: Student[]) => {
    if (examMode === 'offline') {
      setStudents(updatedStudents);
      localStorage.setItem('cbt_offline_students', JSON.stringify(updatedStudents));
      fetch('/api/offline/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updatedStudents })
      }).catch(err => console.warn('Gagal mencadangkan siswa ke server offline:', err));
      return;
    }

    // 1. Identify which students were deleted
    const updatedIds = new Set(updatedStudents.map(s => s.id));
    const deletedStudents = students.filter(s => !updatedIds.has(s.id));
    for (const std of deletedStudents) {
      try {
        await deleteDoc(doc(db, 'students', std.id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `students/${std.id}`);
      }
    }

    // 2. Identify which students are new or updated
    const existingMap = new Map(students.map(s => [s.id, s]));
    for (const std of updatedStudents) {
      const existing = existingMap.get(std.id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(std)) {
        try {
          await setDoc(doc(db, 'students', std.id), std);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `students/${std.id}`);
        }
      }
    }
  };

  const handleUpdateExams = async (updatedExams: Exam[]) => {
    if (examMode === 'offline') {
      setExams(updatedExams);
      localStorage.setItem('cbt_offline_exams', JSON.stringify(updatedExams));
      fetch('/api/offline/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updatedExams })
      }).catch(err => console.warn('Gagal mencadangkan bank soal ke server offline:', err));
      return;
    }

    // 1. Identify which exams were deleted
    const updatedIds = new Set(updatedExams.map(e => e.id));
    const deletedExams = exams.filter(e => !updatedIds.has(e.id));
    for (const ex of deletedExams) {
      try {
        await deleteDoc(doc(db, 'exams', ex.id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `exams/${ex.id}`);
      }
    }

    // 2. Identify which exams are new or updated
    const existingMap = new Map(exams.map(e => [e.id, e]));
    for (const ex of updatedExams) {
      const existing = existingMap.get(ex.id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(ex)) {
        try {
          await setDoc(doc(db, 'exams', ex.id), ex);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `exams/${ex.id}`);
        }
      }
    }
  };

  const handleUpdateResults = async (updatedResults: ExamResult[]) => {
    if (examMode === 'offline') {
      setResults(updatedResults);
      localStorage.setItem('cbt_offline_results', JSON.stringify(updatedResults));
      return;
    }

    // 1. Identify which results were deleted
    const updatedIds = new Set(updatedResults.map(r => r.id));
    const deletedResults = results.filter(r => !updatedIds.has(r.id));
    for (const r of deletedResults) {
      try {
        await deleteDoc(doc(db, 'results', r.id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `results/${r.id}`);
      }
    }

    // 2. Identify which results are new or updated
    const existingMap = new Map(results.map(r => [r.id, r]));
    for (const r of updatedResults) {
      const existing = existingMap.get(r.id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(r)) {
        try {
          await setDoc(doc(db, 'results', r.id), r);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `results/${r.id}`);
        }
      }
    }
  };

  const handleUpdateTeachers = async (updatedTeachers: Teacher[]) => {
    if (examMode === 'offline') {
      setTeachers(updatedTeachers);
      localStorage.setItem('cbt_offline_teachers', JSON.stringify(updatedTeachers));
      return;
    }

    // 1. Identify which teachers were deleted
    const updatedIds = new Set(updatedTeachers.map(t => t.id));
    const deletedTeachers = teachers.filter(t => !updatedIds.has(t.id));
    for (const t of deletedTeachers) {
      try {
        await deleteDoc(doc(db, 'teachers', t.id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `teachers/${t.id}`);
      }
    }

    // 2. Identify which teachers are new or updated
    const existingMap = new Map(teachers.map(t => [t.id, t]));
    for (const t of updatedTeachers) {
      const existing = existingMap.get(t.id);
      if (!existing || JSON.stringify(existing) !== JSON.stringify(t)) {
        try {
          await setDoc(doc(db, 'teachers', t.id), t);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `teachers/${t.id}`);
        }
      }
    }
  };

  // Route/View Switch logic
  const renderContent = () => {
    if (loading) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50 p-6">
          <div className="flex flex-col items-center gap-4 max-w-sm text-center font-sans">
            <div className="relative flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin"></div>
              <div className="absolute font-sans font-bold text-[10px] text-emerald-600 tracking-wider">CBT</div>
            </div>
            <h2 className="text-base font-bold text-gray-800 tracking-tight mt-2">
              {examMode === 'offline' ? 'Memulai Mode Offline' : 'Menghubungkan ke Server'}
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed font-sans">
              {examMode === 'offline'
                ? 'Sedang menyelaraskan bank soal dan kredensial sistem mandiri langsung dari memori internal...'
                : 'Sedang mensinkronisasikan bank soal, data siswa, dan kredensial ujian secara real-time...'}
            </p>
          </div>
        </div>
      );
    }

    if (activeExam) {
      return (
        <ExamInterface
          student={currentUser?.studentDetails!}
          exam={activeExam}
          onFinishExam={handleFinishExam}
          onCancel={handleCancelExam}
          examMode={examMode}
        />
      );
    }

    if (currentUser) {
      if (currentUser.role === 'teacher') {
        return (
          <TeacherDashboard
            students={students}
            exams={exams}
            results={results}
            teachers={teachers}
            activeSessions={activeSessions}
            currentUserRole={currentUser.teacherDetails?.role || 'admin'}
            currentTeacherName={currentUser.name}
            onLogout={handleLogout}
            onUpdateStudents={handleUpdateStudents}
            onUpdateExams={handleUpdateExams}
            onUpdateResults={handleUpdateResults}
            onUpdateTeachers={handleUpdateTeachers}
            examMode={examMode}
            onToggleExamMode={handleToggleExamMode}
          />
        );
      } else {
        return (
          <StudentDashboard
            student={currentUser.studentDetails!}
            exams={exams.filter((ex) => 
              ex.isActive && (
                !ex.targetClass || 
                ex.targetClass === 'Semua Kelas' || 
                ex.targetClass.toLowerCase() === currentUser.studentDetails?.classGroup.toLowerCase()
              )
            )}
            results={results}
            onLogout={handleLogout}
            onStartExam={handleStartExam}
            examMode={examMode}
          />
        );
      }
    }

    return <Login onLoginAttempt={handleLoginAttempt} onLoginSuccess={handleLoginSuccess} />;
  };

  return (
    <>
      {renderContent()}

      {/* Invisible 5-tap zone in top-left corner */}
      {!iconVisible && (
        <div 
          onClick={handleInvisibleTap}
          className="fixed top-0 left-0 w-16 h-16 z-[100] cursor-pointer bg-transparent select-none active:bg-gray-100/5 transition-colors"
          title="Diagnostic Area"
        />
      )}

      {/* Visible Floating Maintenance Button */}
      {iconVisible && (
        <button
          onClick={() => setIsDiagnosticModalOpen(true)}
          className="fixed top-3 left-3 z-[100] bg-white ring-2 ring-emerald-500/10 hover:ring-emerald-500/30 text-emerald-700 hover:text-emerald-800 shadow-xl shadow-emerald-900/10 hover:scale-110 active:scale-95 border border-emerald-100/60 p-2.5 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center animate-pulse"
          title="Bersihkan Cache & Reset Data"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      )}

      {/* Floating Share Button in Top Right Corner - Only visible on login screen */}
      {!loading && !activeExam && !currentUser && (
        <button
          onClick={handleShare}
          className="fixed top-3 right-3 z-[100] bg-white text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50/50 ring-2 ring-emerald-500/10 hover:ring-emerald-500/30 shadow-xl shadow-emerald-900/10 hover:scale-110 active:scale-95 border border-emerald-100/60 p-2.5 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center"
          title="Bagikan CBT MA Annuriyyah"
        >
          <Share2 className="w-5 h-5" />
        </button>
      )}

      {/* Modern Maintenance / Cache Reset Modal */}
      {isDiagnosticModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[110] flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 p-5 sm:p-7 md:p-8 space-y-5 sm:space-y-6 relative overflow-y-auto max-h-[95vh] sm:max-h-[90vh] transition-all transform scale-100">
            {/* Header */}
            <div className="flex gap-3 sm:gap-4 items-start">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 text-amber-600">
                <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="space-y-0.5 sm:space-y-1 flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-gray-900 font-sans tracking-tight">
                  Bersihkan Cache & Reset Data
                </h3>
                <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed font-sans mt-0.5 sm:mt-1">
                  Langkah ini dapat mengatasi error tampilan lama, form tidak merespon, atau masalah pembaruan sistem yang tidak muncul akibat file draft lama browser yang tersangkut.
                </p>
              </div>
            </div>

            {/* Warning Info */}
            <div className="p-3 bg-amber-50/20 border border-amber-100/50 rounded-xl sm:rounded-2xl flex gap-2 sm:gap-2.5 text-[11px] sm:text-xs text-amber-800 leading-relaxed font-sans">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0 animate-ping"></div>
              <p className="flex-1">Membantu memulihkan sistem CBT MA Annuriyyah agar tetap ringan dan responsif tinggi bagi hingga 500+ pengguna.</p>
            </div>

            {/* Options */}
            <div className="space-y-4">
              {/* Option 1 */}
              <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50/80 transition-all space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                  <span className="text-xs font-bold text-gray-800 font-sans">
                    Opsi 1: Bersihkan Draft Formulir
                  </span>
                  <button
                    disabled={isCleaning !== null}
                    onClick={handleCleanDraft}
                    className="w-full sm:w-auto px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {isCleaning === 'draft' ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Proses...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Bersihkan</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] sm:text-[11px] text-gray-500 leading-relaxed font-sans">
                  Menghapus semua draf lembar tetapi menjaga kredensial session login aktif, Aplikasi kemudian disegarkan otomatis untuk memuat aset murni yang ringan.
                </p>
              </div>

              {/* Option 2 */}
              <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-rose-100 bg-rose-50/10 hover:bg-rose-50/20 transition-all space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                  <span className="text-xs font-bold text-rose-950 font-sans">
                    Opsi 2: Reset Total Aplikasi
                  </span>
                  <button
                    disabled={isCleaning !== null}
                    onClick={handleResetTotal}
                    className="w-full sm:w-auto px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {isCleaning === 'total' ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Mereset...</span>
                      </>
                    ) : (
                      <>
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Reset Total</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] sm:text-[11px] text-rose-800/80 leading-relaxed font-sans">
                  Membersihkan seluruh data lokal perangkat Anda kembali ke setelan pabrik murni, siap menyinkronkan data bersih langsung secara instan.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2">
              <button
                disabled={isCleaning !== null}
                onClick={() => setIsDiagnosticModalOpen(false)}
                className="w-full sm:w-auto text-center px-5 py-2 text-xs text-gray-500 hover:text-gray-750 font-semibold rounded-xl bg-gray-50 hover:bg-gray-100 transition-all cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PWA Installation Popup Invitation */}
      {showInstallBanner && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[130] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 space-y-6 text-center relative overflow-hidden animate-fade-in animate-duration-200">
            {/* Elegant Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl -z-10" />
            
            {/* Official App Logo */}
            <div className="flex justify-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-1 shadow-xl shadow-emerald-950/10 flex items-center justify-center relative overflow-hidden">
                <img 
                  src={logoImg} 
                  alt="Logo CBT MA Annuriyyah" 
                  className="w-full h-full rounded-xl object-cover bg-white"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-gray-900 font-sans tracking-tight">
                Pasang Aplikasi CBT MA Annuriyyah
              </h3>
              <p className="text-xs text-sidebar-gray text-gray-550 leading-relaxed font-sans px-2">
                Pasang aplikasi resmi ujian di HP Anda untuk akses masuk yang lebih cepat, responsif, hemat kuota, dan stabil tanpa hambatan browser.
              </p>
            </div>

            {/* iOS Safari specific tips */}
            {/iPhone|iPad|iPod/i.test(navigator.userAgent) && (
              <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl text-[11px] text-amber-800 leading-relaxed font-sans text-left flex gap-2">
                <Share2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-900">Pengguna iOS Safari:</span> Ketuk tombol <strong className="text-emerald-700 font-extrabold">"Bagikan"</strong> di bar bawah lalu pilih <strong className="text-emerald-700 font-extrabold">"Tambah ke Layar Utama" (Add to Home Screen)</strong>.
                </div>
              </div>
            )}

            {/* Editor preview / iframe tips */}
            {window.self !== window.top && (
              <div className="p-3 bg-teal-50/60 border border-teal-100 rounded-xl text-[11px] text-teal-800 leading-relaxed font-sans text-left flex gap-2">
                <Smartphone className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-emerald-900">Uji Coba di Editor:</span> Menekan tombol di bawah akan otomatis membuka aplikasi di tab baru agar browser dapat memicu dialog instalasi otomatis 1-Klik langsung di HP Anda.
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleInstallApp}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg hover:shadow-emerald-600/10 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Instal Sekarang</span>
              </button>
              <button
                onClick={handleDismissInstall}
                className="w-full py-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-50 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Nanti Saja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast banner */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-[120] bg-slate-900 border border-slate-800 text-white text-xs font-sans px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
          <span>{successToast}</span>
          <button 
            onClick={() => setSuccessToast(null)} 
            className="ml-2.5 font-bold text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
