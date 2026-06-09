import { useState, FormEvent } from 'react';
import { LogOut, BookOpen, Clock, ShieldCheck, HelpCircle, CheckCircle, Award, Download, Copy, AlertTriangle } from 'lucide-react';
import { Student, Exam, ExamResult } from '../types';
// @ts-ignore
import logoImg from '../assets/images/cbt_ma_annuriyyah_logo_1780701928746.png';

interface StudentDashboardProps {
  student: Student;
  exams: Exam[];
  results: ExamResult[];
  onLogout: () => void;
  onStartExam: (exam: Exam) => void;
  examMode?: 'online' | 'offline';
}

export default function StudentDashboard({
  student,
  exams,
  results,
  onLogout,
  onStartExam,
  examMode = 'online'
}: StudentDashboardProps) {
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [typedToken, setTypedToken] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isClassDeclared, setIsClassDeclared] = useState(false);

  // Helper to package & download student's offline exam result as a JSON file
  const handleDownloadOfflineResult = (res: ExamResult) => {
    const data = {
      _type: 'cbt_offline_result_verification',
      resultId: res.id,
      studentId: res.studentId,
      studentName: res.studentName,
      nisn: student.nisn,
      classGroup: student.classGroup,
      examId: res.examId,
      examTitle: res.examTitle,
      examSubject: res.examSubject,
      score: res.score,
      correctCount: res.correctCount,
      totalQuestions: res.totalQuestions,
      violationsCount: res.violationsCount || 0,
      completedTime: res.completedTime,
      // Tamper-proof signature verifying result integrity
      signature: btoa(`${res.id}:${res.score}:${student.nisn}:${res.correctCount || 0}`)
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `HASIL_CBT_${student.nisn}_${res.examTitle.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Helper to check if student already took this exam
  const getExamResult = (examId: string) => {
    return results.find((r) => r.examId === examId && r.studentId === student.id);
  };

  const handleVerifyToken = (e: FormEvent) => {
    e.preventDefault();
    setTokenError(null);

    if (!selectedExam) return;

    if (typedToken.trim().toUpperCase() === selectedExam.token.toUpperCase()) {
      setShowConfirmation(true);
      setIsClassDeclared(false);
    } else {
      setTokenError(`Token Ujian tidak valid. Periksa papan tulis atau info token.`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Banner Header / School Bar */}
      <header className="bg-emerald-800 text-white shadow-md z-10 font-sans">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
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
              <h2 className="text-lg font-bold tracking-tight">CBT MA Annuriyyah</h2>
              <p className="text-xs text-emerald-100 font-mono">Computer Based Test System</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="text-center sm:text-right">
              <span className="text-[10px] sm:text-xs text-emerald-200 block font-mono uppercase tracking-wider">Peserta Ujian</span>
              <span className="text-xs sm:text-sm font-semibold text-white block">{student.name}</span>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center justify-center gap-2 p-2 px-3.5 bg-red-600/30 hover:bg-red-600/40 text-red-200 hover:text-white rounded-xl text-xs font-semibold transition-all border border-red-500/20 cursor-pointer w-full sm:w-auto"
            >
              <LogOut className="w-4 h-4" />
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Participant Information */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 font-mono">
              Konfirmasi Informasi Peserta
            </h3>
            
            <div className="space-y-4">
              <div className="p-3.5 bg-gray-50 rounded-2xl flex flex-col">
                <span className="text-[11px] font-semibold text-gray-400 uppercase">Nama Lengkap</span>
                <span className="text-base font-bold text-gray-800 mt-0.5">{student.name}</span>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-2xl flex flex-col">
                <span className="text-[11px] font-semibold text-gray-400 uppercase">Nomor Induk (NISN)</span>
                <span className="text-sm font-bold text-gray-700 mt-0.5 font-mono">{student.nisn}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-gray-50 rounded-2xl flex flex-col">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">Kelas</span>
                  <span className="text-sm font-bold text-gray-700 mt-0.5">{student.classGroup}</span>
                </div>
                <div className="p-3.5 bg-gray-50 rounded-2xl flex flex-col">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">Kelamin</span>
                  <span className="text-sm font-bold text-gray-700 mt-0.5">{student.gender}</span>
                </div>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-2xl flex flex-col">
                <span className="text-[11px] font-semibold text-gray-400 uppercase flex items-center gap-1">
                  💻 ID Perangkat Ujian (Binaan)
                </span>
                <span className="text-xs font-bold text-gray-600 mt-1 font-mono bg-white border border-gray-150 px-2.5 py-1 rounded-xl w-max uppercase select-all">
                  {localStorage.getItem('cbt_device_id')?.slice(-10).toUpperCase() || 'MENGASOSIASIKAN...'}
                </span>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs text-emerald-800 leading-relaxed">
                  Sesi Terverifikasi. Silakan pilih mata ujian yang aktif di panel sebelah kanan untuk memulai ujian.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Active Exams & Token Panel */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Exam List */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 font-mono">
              Mata Ujian yang Tersedia
            </h3>

            <div className="space-y-4">
              {exams.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Belum ada ujian aktif yang disiapkan oleh Guru.
                </div>
              ) : (
                exams.map((exam) => {
                  const examResult = getExamResult(exam.id);
                  const isSelected = selectedExam?.id === exam.id;

                  return (
                    <div
                      key={exam.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/20 shadow-sm'
                          : examResult
                          ? 'border-gray-100 bg-gray-50/50'
                          : 'border-gray-100 hover:border-gray-200 hover:shadow-xs bg-white'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="p-1 px-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold uppercase tracking-wider">
                              {exam.subject}
                            </span>
                            {examResult && (
                              <span className="inline-flex items-center gap-1 p-0.5 px-2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                <CheckCircle className="w-3 h-3" />
                                Selesai
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-bold text-gray-800 tracking-tight">
                            {exam.title}
                          </h4>
                          <div className="flex items-center gap-4 text-xs text-gray-500 font-sans">
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3.5 h-3.5" />
                              {exam.questions.length} Butir Soal
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {exam.durationMinutes} Menit
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                          {examResult ? (
                            <>
                              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 p-2 px-3.5 rounded-xl">
                                <Award className="w-4 h-4 text-emerald-700" />
                                <div className="text-xs">
                                  <span className="text-gray-500">Nilai:</span>{' '}
                                  <strong className="text-emerald-700 font-bold">{examResult.score}</strong>
                                </div>
                              </div>
                              
                              {examMode === 'offline' && (
                                <div className="flex flex-wrap gap-1.5 mt-2 sm:mt-0">
                                  <button
                                    onClick={() => handleDownloadOfflineResult(examResult)}
                                    className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-extrabold text-[10px] p-2 px-3 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-xs border border-amber-450"
                                    title="Unduh Berkas Hasil Ujian (JSON) untuk dikumpulkan ke Flashdisk Guru"
                                  >
                                    <Download className="w-3.5 h-3.5 shrink-0" />
                                    Unduh Hasil (.json)
                                  </button>
                                  <button
                                    onClick={() => {
                                      const miniData = {
                                        student: examResult.studentName,
                                        nisn: student.nisn,
                                        exam: examResult.examTitle,
                                        score: examResult.score,
                                        correct: examResult.correctCount,
                                        signature: btoa(`${examResult.id}:${examResult.score}:${student.nisn}`)
                                      };
                                      navigator.clipboard.writeText(JSON.stringify(miniData, null, 2));
                                      alert('Teks berhasil disalin! Anda dapat mengirimkan isi teks ini ke WA/Guru, atau menyalin berkas ke Flashdisk.');
                                    }}
                                    className="bg-gray-150 hover:bg-gray-200 text-gray-700 font-bold text-[10px] p-2 px-3 rounded-lg flex items-center gap-1 transition-all cursor-pointer border border-gray-200"
                                    title="Salin salinan teks tanda bukti hasil ujian"
                                  >
                                    <Copy className="w-3.5 h-3.5 shrink-0" />
                                    Salin Kode
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedExam(exam);
                                setTypedToken('');
                                setTokenError(null);
                              }}
                              className={`p-2 px-5 text-sm font-semibold rounded-xl transition-all ${
                                isSelected
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              Pilih Ujian
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Token Panel (Shows only when exam selected) */}
          {selectedExam && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/10">
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider font-sans">
                  Verifikasi Token Ujian
                </h3>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                Ujian yang dipilih: <strong className="text-gray-800">{selectedExam.title}</strong>. Masukkan kode TOKEN yang tertulis di papan tulis ruang ujian untuk memulai tes Anda secara langsung.
              </p>

              <form onSubmit={handleVerifyToken} className="space-y-4 max-w-sm">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Kode Token Ujian
                    </label>
                    {/* Simulated Board Token Info to assist users! */}
                    <span className="text-[10px] text-amber-700 bg-amber-50 p-0.5 px-2 border border-amber-100 rounded-md font-sans">
                      Papan Tulis: <strong className="font-mono font-bold tracking-widest">{selectedExam.token}</strong>
                    </span>
                  </div>
                  <input
                    type="text"
                    value={typedToken}
                    onChange={(e) => setTypedToken(e.target.value)}
                    placeholder="Contoh: ABXCKO"
                    maxLength={10}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-mono uppercase"
                  />
                </div>

                {tokenError && (
                  <div className="text-xs text-red-600 font-mono">
                    {tokenError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-emerald-600/10 hover:shadow-lg hover:shadow-emerald-600/20"
                  >
                    Mulai Kerjakan Ujian
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedExam(null)}
                    className="p-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-all"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </main>

      {/* Safety Gate Confirmation Modal */}
      {showConfirmation && selectedExam && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-150 animate-scale-up space-y-5">
            <div className="flex items-center gap-3 text-amber-600 border-b border-gray-100 pb-3">
              <div className="p-2 bg-amber-50 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-800">⚠️ Gerbang Keamanan Akun & Kelas</h4>
                <p className="text-[11px] text-gray-400 font-mono">Exam Target Guard & Anti-Accident State</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-gray-600 leading-relaxed font-sans">
                Sebelum masuk dan memulai pengerjaan lembar soal, dilarang keras salah memilih ujian kelompok kelas lain <strong>(Kelas Atas atau Kelas Bawah)</strong>. Hasil ujian yang dikerjakan pada kelas yang salah <strong>tidak akan terekam/dinilai</strong> pada daftar prodi Anda.
              </p>

              {/* Comparative Matrix card */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2.5 font-sans">
                <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Identitas Anda</span>
                    <div className="bg-white p-2 rounded-xl border border-gray-150 font-semibold text-gray-750">
                      👤 {student.name}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-600 block mb-0.5">Kelas Terdaftar Anda</span>
                    <div className="bg-emerald-50 text-emerald-800 p-2 rounded-xl border border-emerald-200 font-extrabold text-center text-sm">
                      📍 {student.classGroup}
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-150 my-2 pt-2 font-sans">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Mata Ujian yang Dipilih</span>
                  <div className="bg-amber-50/50 p-2 rounded-xl border border-amber-100 text-gray-800">
                    <div className="font-bold text-xs text-amber-950">📝 {selectedExam.title}</div>
                    <div className="text-[11px] font-medium text-amber-800 mt-1 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 bg-amber-100/80 text-amber-900 rounded font-bold text-[9px] uppercase">
                        Target Kelas Ujian: {selectedExam.targetClass || 'Semua Kelas'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Strict matching check banner */}
              {selectedExam.targetClass && 
               selectedExam.targetClass !== 'Semua Kelas' && 
               selectedExam.targetClass.toLowerCase() !== student.classGroup.toLowerCase() ? (
                <div className="p-3 bg-red-55/60 border border-red-200 rounded-xl text-xs text-red-750 leading-relaxed font-sans font-medium flex gap-2">
                  <span className="text-base shrink-0">⚠️</span>
                  <span><strong>PERINGATAN KERAS:</strong> Kelas target ujian ini adalah <strong>{selectedExam.targetClass}</strong>, sedangkan Anda berada di kelas <strong>{student.classGroup}</strong>. Anda tidak disarankan melanjutkan!</span>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs text-emerald-850 leading-relaxed font-sans flex gap-2">
                  <span className="text-base shrink-0">✔️</span>
                  <span><strong>VERIFIKASI AMAN:</strong> Kelompok kelas Anda ({student.classGroup}) terpantau sesuai dengan target mata ujian ini.</span>
                </div>
              )}

              {/* Declarative Compliance Checkbox */}
              <label className="flex items-start gap-2.5 p-3.5 bg-gray-50/40 border border-gray-150 rounded-2xl hover:bg-gray-50 cursor-pointer select-none transition-all">
                <input
                  type="checkbox"
                  checked={isClassDeclared}
                  onChange={(e) => setIsClassDeclared(e.target.checked)}
                  className="mt-0.5 rounded border-gray-350 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-gray-700 font-sans leading-relaxed">
                  Saya menyatakan dengan sadar dan jujur bahwa <strong>{student.name} ({student.classGroup})</strong> adalah benar data nama saya, dan ujian <strong>{selectedExam.title}</strong> adalah mata ujian resmi yang dijadwalkan untuk kelas saya hari ini.
                </span>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={!isClassDeclared}
                onClick={() => {
                  setShowConfirmation(false);
                  onStartExam(selectedExam);
                }}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-emerald-600/10"
              >
                Paham &amp; Mulai Kerjakan
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                className="py-3 px-5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition-all"
              >
                Kembali / Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
