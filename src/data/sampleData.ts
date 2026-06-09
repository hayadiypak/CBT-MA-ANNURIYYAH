import { Student, Exam, ExamResult } from '../types';

export const defaultStudents: Student[] = [
  {
    id: 'user_1',
    username: 'janur',
    name: 'Ahmad Jaannuruzaki A',
    nisn: '1922',
    gender: 'Laki-laki',
    classGroup: 'X',
    password: '123'
  },
  {
    id: 'user_2',
    username: 'siti',
    name: 'Siti Aminah',
    nisn: '202611002',
    gender: 'Perempuan',
    classGroup: 'XII IPS 2',
    password: '123'
  },
  {
    id: 'user_3',
    username: 'rizqi',
    name: 'Muhammad Rizqi',
    nisn: '202611003',
    gender: 'Laki-laki',
    classGroup: 'XI IPA 2',
    password: '123'
  },
  {
    id: 'user_4',
    username: 'halizah',
    name: 'Nur Halizah',
    nisn: '202611004',
    gender: 'Perempuan',
    classGroup: 'XI IPS 1',
    password: '123'
  },
  {
    id: 'user_5',
    username: 'yusuf',
    name: 'Yusuf Ibrahim',
    nisn: '202611005',
    gender: 'Laki-laki',
    classGroup: 'X Merdeka',
    password: '123'
  }
];

export const defaultExams: Exam[] = [
  {
    id: 'exam_1',
    title: 'Penilaian Akhir Semester (PAS) Fiqih XII',
    subject: 'Fiqih',
    durationMinutes: 30,
    token: 'FIQ12A',
    isActive: true,
    questions: [
      {
        id: 'q1_1',
        text: 'Secara bahasa, kata "fiqih" memiliki arti...',
        correctAnswer: 'B',
        options: [
          { letter: 'A', text: 'Ketundukan dan kepatuhan' },
          { letter: 'B', text: 'Pemahaman yang mendalam (Al-Fahm)' },
          { letter: 'C', text: 'Hukum-hukum tertulis' },
          { letter: 'D', text: 'Metodologi pengambilan keputusan' },
          { letter: 'E', text: 'Perbuatan yang terpuji' }
        ]
      },
      {
        id: 'q1_2',
        text: 'Sumber hukum Islam yang disepakati oleh mayoritas ulama setelah Al-Qur\'an dan Al-Hadits adalah...',
        correctAnswer: 'C',
        options: [
          { letter: 'A', text: 'Istihsan' },
          { letter: 'B', text: 'Maslahah Mursalah' },
          { letter: 'C', text: 'Ijma\' dan Qiyas' },
          { letter: 'D', text: 'Urf (Tradisional)' },
          { letter: 'E', text: 'Istishab' }
        ]
      },
      {
        id: 'q1_3',
        text: 'Berikut ini yang termasuk dalam rukun pernikahan dalam syariat Islam adalah, kecuali...',
        correctAnswer: 'E',
        options: [
          { letter: 'A', text: 'Adanya calon pengantin laki-laki' },
          { letter: 'B', text: 'Adanya calon pengantin perempuan' },
          { letter: 'C', text: 'Adanya Wali nikah' },
          { letter: 'D', text: 'Adanya dua orang saksi laki-laki yang adil' },
          { letter: 'E', text: 'Adanya jamuan makanan (Walimatul Ursy)' }
        ]
      },
      {
        id: 'q1_4',
        text: 'Seorang suami menjatuhkan talak kepada istrinya tanpa didahului oleh proses pengadilan, talak tersebut disebut talak...',
        correctAnswer: 'A',
        options: [
          { letter: 'A', text: 'Talak Raj\'i' },
          { letter: 'B', text: 'Talak Ba\'in Kubra' },
          { letter: 'C', text: 'Talak Ba\'in Sughra' },
          { letter: 'D', text: 'Talak Khulu\'' },
          { letter: 'E', text: 'Talak Fasakh' }
        ]
      },
      {
        id: 'q1_5',
        text: 'Zakat mal (harta) yang wajib dikeluarkan saat mencapai nisab emas sebesar 85 gram emas murni, persentasenya adalah...',
        correctAnswer: 'D',
        options: [
          { letter: 'A', text: '10%' },
          { letter: 'B', text: '5%' },
          { letter: 'C', text: '3.3%' },
          { letter: 'D', text: '2.5%' },
          { letter: 'E', text: '1.5%' }
        ]
      },
      {
        id: 'q1_6',
        text: 'Batas waktu tunggu (Iddah) bagi seorang wanita yang ditinggal mati oleh suaminya (dalam kondisi tidak hamil) adalah...',
        correctAnswer: 'D',
        options: [
          { letter: 'A', text: '3 kali suci' },
          { letter: 'B', text: '3 bulan 10 hari' },
          { letter: 'C', text: '4 bulan 5 hari' },
          { letter: 'D', text: '4 bulan 10 hari' },
          { letter: 'E', text: 'Hingga melahirkan' }
        ]
      },
      {
        id: 'q1_7',
        text: 'Istilah rujukan hukum di mana seorang mujtahid membandingkan suatu kasus baru yang belum ada hukumnya dengan kasus lama yang sudah ada hukumnya karena kesamaan "illah" (sebab hukum) disebut...',
        correctAnswer: 'B',
        options: [
          { letter: 'A', text: 'Ijma\'' },
          { letter: 'B', text: 'Qiyas' },
          { letter: 'C', text: 'Ijtihad' },
          { letter: 'D', text: 'Taqlid' },
          { letter: 'E', text: 'Saddudz Dzari\'ah' }
        ]
      },
      {
        id: 'q1_8',
        text: 'Hukum melakukan pengurusan jenazah bagi umat Muslim yang tinggal di satu kawasan atau kampung adalah...',
        correctAnswer: 'C',
        options: [
          { letter: 'A', text: 'Fardhu Ain' },
          { letter: 'B', text: 'Sunnah Muakkad' },
          { letter: 'C', text: 'Fardhu Kifayah' },
          { letter: 'D', text: 'Sunnah Ghairu Muakkad' },
          { letter: 'E', text: 'Mubah' }
        ]
      },
      {
        id: 'q1_9',
        text: 'Praktik transaksi sewa menyewa di mana kepemilikan barang tidak berpindah, melainkan hanya pemanfaatan atas jasanya saja disebut...',
        correctAnswer: 'A',
        options: [
          { letter: 'A', text: 'Ijarah' },
          { letter: 'B', text: 'Mudharabah' },
          { letter: 'C', text: 'Musyarakah' },
          { letter: 'D', text: 'Al-Wadi\'ah' },
          { letter: 'E', text: 'Murabahah' }
        ]
      },
      {
        id: 'q1_10',
        text: 'Dalam ketentuan ibadah haji, tindakan melontar Jumrah Aqabah dilakukan pada tanggal...',
        correctAnswer: 'C',
        options: [
          { letter: 'A', text: '8 Dzulhijjah' },
          { letter: 'B', text: '9 Dzulhijjah' },
          { letter: 'C', text: '10 Dzulhijjah' },
          { letter: 'D', text: '11 Dzulhijjah' },
          { letter: 'E', text: '12 Dzulhijjah' }
        ]
      }
    ]
  },
  {
    id: 'exam_2',
    title: 'Ujian Akhir Semester Matematika Peminatan',
    subject: 'Matematika',
    durationMinutes: 45,
    token: 'MATPAS',
    isActive: true,
    questions: [
      {
        id: 'q2_1',
        text: 'Tentukan turunan pertama dari fungsi f(x) = 3x^4 - 5x^2 + 2x - 7 !',
        correctAnswer: 'B',
        options: [
          { letter: 'A', text: 'f\'(x) = 12x^3 - 10x + 7' },
          { letter: 'B', text: 'f\'(x) = 12x^3 - 10x + 2' },
          { letter: 'C', text: 'f\'(x) = 12x^4 - 10x^2 + 2' },
          { letter: 'D', text: 'f\'(x) = 3x^3 - 5x + 2' },
          { letter: 'E', text: 'f\'(x) = 12x^3 - 5x + 2' }
        ]
      },
      {
        id: 'q2_2',
        text: 'Diketahui cos(A) = 4/5 dengan sudut A berada di kuadrat I. Nilai dari sin(2A) adalah...',
        correctAnswer: 'D',
        options: [
          { letter: 'A', text: '12/25' },
          { letter: 'B', text: '7/25' },
          { letter: 'C', text: '16/25' },
          { letter: 'D', text: '24/25' },
          { letter: 'E', text: '20/25' }
        ]
      },
      {
        id: 'q2_3',
        text: 'Nilai limit x mendekati tak hingga dari (2x^2 + 3x - 5) / (5x^2 - 4x + 1) adalah...',
        correctAnswer: 'A',
        options: [
          { letter: 'A', text: '2/5' },
          { letter: 'B', text: '-5' },
          { letter: 'C', text: '3/4' },
          { letter: 'D', text: 'Tak terhingga' },
          { letter: 'E', text: '0' }
        ]
      },
      {
        id: 'q2_4',
        text: 'Persamaan lingkaran yang berpusat di titik O(0,0) dan melalui titik (3, 4) adalah...',
        correctAnswer: 'C',
        options: [
          { letter: 'A', text: 'x^2 + y^2 = 7' },
          { letter: 'B', text: 'x^2 + y^2 = 12' },
          { letter: 'C', text: 'x^2 + y^2 = 25' },
          { letter: 'D', text: 'x^2 + y^2 = 49' },
          { letter: 'E', text: 'x^2 - y^2 = 25' }
        ]
      },
      {
        id: 'q2_5',
        text: 'Jika f(x) = x + 3 dan g(x) = 2x - 1, maka komposisi fungsi (g o f)(x) adalah...',
        correctAnswer: 'E',
        options: [
          { letter: 'A', text: '2x + 6' },
          { letter: 'B', text: '2x + 2' },
          { letter: 'C', text: '2x - 7' },
          { letter: 'D', text: '2x + 4' },
          { letter: 'E', text: '2x + 5' }
        ]
      }
    ]
  },
  {
    id: 'exam_3',
    title: 'Asesmen Capaian Belajar Tahunan',
    subject: 'Bahasa Indonesia',
    durationMinutes: 20,
    token: 'INDOKB',
    isActive: true,
    questions: [
      {
        id: 'q3_1',
        text: 'Teks yang berisi opini penulis disertai dengan fakta-fakta pendukung untuk meyakinkan pembaca disebut...',
        correctAnswer: 'A',
        options: [
          { letter: 'A', text: 'Teks Eksposisi' },
          { letter: 'B', text: 'Teks Prosedur Kompleks' },
          { letter: 'C', text: 'Teks Laporan Hasil Observasi' },
          { letter: 'D', text: 'Teks Negosiasi' },
          { letter: 'E', text: 'Teks Narasi' }
        ]
      },
      {
        id: 'q3_2',
        text: 'Ciri utama dari kalimat imperatif dalam sebuah wacana adalah...',
        correctAnswer: 'C',
        options: [
          { letter: 'A', text: 'Menjelaskan suatu deskripsi peristiwa secara panjang' },
          { letter: 'B', text: 'Ada kata tanya di akhir kalimat' },
          { letter: 'C', text: 'Berfungsi memberikan perintah, anjuran, atau larangan' },
          { letter: 'D', text: 'Mengungkapkan ekspresi keheranan' },
          { letter: 'E', text: 'Selalu diisi oleh kata hubung konsekuensi' }
        ]
      },
      {
        id: 'q3_3',
        text: 'Penulisan kata depan yang benar di bawah ini terdapat pada kalimat...',
        correctAnswer: 'A',
        options: [
          { letter: 'A', text: 'Buku pelajaran itu diletakkan di atas meja guru.' },
          { letter: 'B', text: 'Ibu membeli sayur ke pasar didaerah dekat rumah.' },
          { letter: 'C', text: 'Semua barang bekas disimpan digudang.' },
          { letter: 'D', text: 'Kakak sedang berjalan keluarnegeri.' },
          { letter: 'E', text: 'Adik bersembunyi dibalik lemari besar.' }
        ]
      },
      {
        id: 'q3_4',
        text: 'Sinonim dari kata "Eskalasi" dalam KBBI adalah...',
        correctAnswer: 'D',
        options: [
          { letter: 'A', text: 'Penurunan secara teratur' },
          { letter: 'B', text: 'Perpindahan tempat' },
          { letter: 'C', text: 'Pemberitahuan resmi' },
          { letter: 'D', text: 'Peningkatan atau pertambahan' },
          { letter: 'E', text: 'Pelemahan daya juang' }
        ]
      },
      {
        id: 'q3_5',
        text: 'Majas yang membandingkan suatu benda mati seolah-olah bernyawa dan berperilaku layaknya manusia disebut majas...',
        correctAnswer: 'B',
        options: [
          { letter: 'A', text: 'Metafora' },
          { letter: 'B', text: 'Personifikasi' },
          { letter: 'C', text: 'Hiperbola' },
          { letter: 'D', text: 'Litotes' },
          { letter: 'E', text: 'Sinekdoke' }
        ]
      }
    ]
  }
];

export const defaultResults: ExamResult[] = [
  {
    id: 'res_1',
    studentId: 'user_1',
    studentName: 'Ahmad Jaannuruzaki A',
    studentNisn: '1922',
    classGroup: 'X',
    examId: 'exam_1',
    examTitle: 'Penilaian Akhir Semester (PAS) Fiqih XII',
    examSubject: 'Fiqih',
    totalQuestions: 10,
    correctCount: 9,
    score: 90,
    completedTime: Date.now() - 24 * 3600 * 1000 // 1 day ago
  },
  {
    id: 'res_2',
    studentId: 'user_2',
    studentName: 'Siti Aminah',
    studentNisn: '202611002',
    classGroup: 'XII IPS 2',
    examId: 'exam_1',
    examTitle: 'Penilaian Akhir Semester (PAS) Fiqih XII',
    examSubject: 'Fiqih',
    totalQuestions: 10,
    correctCount: 7,
    score: 70,
    completedTime: Date.now() - 22 * 3600 * 1000
  },
  {
    id: 'res_3',
    studentId: 'user_3',
    studentName: 'Muhammad Rizqi',
    studentNisn: '202611003',
    classGroup: 'XI IPA 2',
    examId: 'exam_2',
    examTitle: 'Ujian Akhir Semester Matematika Peminatan',
    examSubject: 'Matematika',
    totalQuestions: 5,
    correctCount: 4,
    score: 80,
    completedTime: Date.now() - 20 * 3600 * 1000
  },
  {
    id: 'res_4',
    studentId: 'user_4',
    studentName: 'Nur Halizah',
    studentNisn: '202611004',
    classGroup: 'XI IPS 1',
    examId: 'exam_2',
    examTitle: 'Ujian Akhir Semester Matematika Peminatan',
    examSubject: 'Matematika',
    totalQuestions: 5,
    correctCount: 3,
    score: 60,
    completedTime: Date.now() - 18 * 3600 * 1000
  }
];
