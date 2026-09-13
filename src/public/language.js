(function initializeLmsLanguage() {

    const STORAGE_KEY =
        "lmsLanguage";

    const DEFAULT_LANGUAGE =
        "id";

    const SUPPORTED_LANGUAGES =
        new Set([
            "id",
            "en-US"
        ]);


    const translations = {

        id: {
            "meta.homeTitle":
                "mrsteve.my.id",

            "language.selectorLabel":
                "Pilih bahasa",

            "home.portalSubtitle":
                "Portal Siswa & Guru",

            "home.teacherLogin":
                "Login Guru",

            "home.heroTitle":
                "Belajar lebih terarah dalam satu ruang.",

            "home.heroDescription":
                "Akses Classroom Feed, kerjakan quiz, pantau nilai dan poin, serta dapatkan informasi sekolah dengan lebih mudah.",

            "home.studentCodeLabel":
                "Kode siswa",

            "home.studentCodePlaceholder":
                "Masukkan kode siswa",

            "home.enter":
                "Masuk",

            "home.studentDashboard":
                "Dashboard Siswa",

            "home.welcome":
                "Selamat datang",

            "home.monitorActivity":
                "Pantau aktivitas belajar kamu.",

            "home.myPoints":
                "Poin Saya",

            "home.pointsExample":
                "120 poin",

            "home.myGrades":
                "Nilai Saya",

            "home.averageExample":
                "Rata-rata 86",

            "home.activeQuizTitle":
                "QUIZ AKTIF",

            "home.mathQuiz":
                "Quiz Matematika",

            "home.questionCount":
                "8 soal",

            "home.answeredCount":
                "5 dari 8 soal dijawab",

            "home.continue":
                "Lanjutkan →",

            "home.classroomFeed":
                "Classroom Feed",

            "home.feedExample":
                "Informasi kelas terbaru telah dibagikan.",

            "home.new":
                "Baru",

            "home.latestGrade":
                "Nilai terbaru",

            "home.mathematics":
                "Matematika",

            "home.quizReady":
                "Siap dikerjakan",

            "home.footerSystem":
                "Learning Management System",

            "home.checking":
                "Memeriksa",

            "home.checkingCode":
                "Memeriksa kode...",

            "home.invalidLength":
                "Kode siswa harus terdiri dari 5 karakter.",

            "home.invalidCode":
                "Kode siswa tidak valid.",

            "home.loginSuccess":
                "Login berhasil. Membuka dashboard...",

"home.connectionError":
    "Tidak dapat terhubung ke server.",

"studentDashboard.pageTitle":
    "Dashboard Siswa",

"studentDashboard.profile":
    "Profil",

"studentDashboard.myPoints":
    "Poin Saya",

"studentDashboard.myGrades":
    "Nilai Saya",

"studentDashboard.logout":
    "Keluar",

"studentDashboard.summary":
    "Ringkasan akun siswa",

"studentDashboard.welcome":
    "Selamat datang, {name}",

"studentDashboard.description":
    "Semua kebutuhan belajar, informasi sekolah, nilai, poin, dan aktivitas kelas tersedia dalam satu ruang siswa.",

"studentDashboard.onlineQuiz":
    "Quiz Online",

"studentDashboard.totalPoints":
    "Total poin",

"studentDashboard.upcomingAssignments":
    "Tugas mendatang",

"studentDashboard.assignmentPreparing":
    "Assignment Reminder sedang disiapkan",

"studentDashboard.assignmentDescription":
    "Tugas dari guru dan batas pengumpulan nantinya akan muncul otomatis di sini.",

"studentDashboard.informationBoard":
    "Papan Informasi",

"studentDashboard.latestInformation":
    "Informasi terbaru dari sekolah.",

"studentDashboard.refresh":
    "Muat Ulang",

"studentDashboard.viewAll":
    "Lihat Semua",

"studentDashboard.loadingAnnouncements":
    "Memuat pengumuman...",

"studentDashboard.allAnnouncements":
    "Semua Pengumuman",

"studentDashboard.closePanel":
    "Tutup panel",

"studentDashboard.classUnavailable":
    "Kelas belum tersedia",

"studentDashboard.oneAnnouncement":
    "1 pengumuman tersedia",

"studentDashboard.manyAnnouncements":
    "{count} pengumuman tersedia",

"studentDashboard.noAnnouncements":
    "Belum ada pengumuman",

"studentDashboard.announcementWillAppear":
    "Informasi resmi sekolah akan muncul di sini.",

"studentDashboard.by":
    "Oleh",

"studentDashboard.adminTeacher":
    "Admin / Guru",

"studentDashboard.announcementImage":
    "Gambar pengumuman",

"studentDashboard.moreClasses":
    "+{count} Kelas",

"studentDashboard.fetchFailed":
    "Gagal mengambil pengumuman",

"studentDashboard.dataUnavailable":
    "Data pengumuman tidak tersedia.",

"studentDashboard.cannotConnect":
    "Tidak dapat terhubung",

"studentDashboard.checkServer":
    "Periksa server lalu coba kembali.",

"studentDashboard.pageTitle":
    "Dashboard Siswa",

"studentDashboard.dashboard":
    "Dashboard",

"studentDashboard.profile":
    "Profil",

"studentDashboard.myPoints":
    "Poin Saya",

"studentDashboard.myGrades":
    "Nilai Saya",

"studentDashboard.quiz":
    "Quiz",

"studentDashboard.classroomFeed":
    "Feed Kelas",

"studentDashboard.logout":
    "Keluar",

"studentDashboard.summary":
    "Ringkasan akun siswa",

"studentDashboard.welcome":
    "Selamat datang, {name}",

"studentDashboard.description":
    "Semua kebutuhan belajar, informasi sekolah, nilai, poin, dan aktivitas kelas tersedia dalam satu ruang siswa.",

"studentDashboard.totalPoints":
    "Total poin",

"studentDashboard.upcomingAssignments":
    "Tugas mendatang",

"studentDashboard.assignmentPreparing":
    "Assignment Reminder sedang disiapkan",

"studentDashboard.assignmentDescription":
    "Tugas dari guru dan batas pengumpulan nantinya akan muncul otomatis di sini.",

"studentDashboard.latestInformation":
    "Informasi terbaru dari sekolah.",

"studentDashboard.viewAll":
    "Lihat Semua",

"studentDashboard.loadingAnnouncements":
    "Memuat pengumuman...",

"studentDashboard.allAnnouncements":
    "Semua Pengumuman",

"studentDashboard.closePanel":
    "Tutup panel",

"studentDashboard.classUnavailable":
    "Kelas belum tersedia",

"studentDashboard.oneAnnouncement":
    "1 pengumuman tersedia",

"studentDashboard.manyAnnouncements":
    "{count} pengumuman tersedia",

"studentDashboard.noAnnouncements":
    "Belum ada pengumuman",

"studentDashboard.announcementWillAppear":
    "Informasi resmi sekolah akan muncul di sini.",

"studentDashboard.by":
    "Oleh",

"studentDashboard.adminTeacher":
    "Admin / Guru",

"studentDashboard.announcementImage":
    "Gambar pengumuman",

"studentDashboard.moreClasses":
    "+{count} kelas",

"studentDashboard.fetchFailed":
    "Gagal mengambil pengumuman",

"studentDashboard.dataUnavailable":
    "Data pengumuman tidak tersedia.",

"studentDashboard.cannotConnect":
    "Tidak dapat terhubung",

"studentDashboard.checkServer":
    "Periksa server lalu coba kembali.",

studentProfile: {
    pageTitle: "Profil Siswa",
    loadingPage: "Halaman sedang dimuat",

    dashboard: "Dashboard",
    profile: "Profil",
    myPoints: "Poin Saya",
    myGrades: "Nilai Saya",
    quiz: "Quiz",
    classroomFeed: "Feed Kelas",
    logout: "Keluar",

    profileSummary:
        "Informasi akun dan ringkasan akademik",

    directory: "Direktori",
    directorySummary:
        "Cari dan lihat profil siswa atau guru",
    backToProfile: "Kembali ke Profil",

    loadingProfile: "Memuat profil...",
    studentAccount: "Akun siswa",
    customizeProfile: "Sesuaikan Profil",

    totalPoints: "Total Poin",
    averageScore: "Nilai Rata-rata",
    class: "Kelas",

    studentInformation: "Informasi Siswa",
    studentInformationDescription:
        "Data identitas yang terhubung dengan akun.",

    shortName: "Nama Pendek",
    studentCode: "Kode Siswa",
    dateOfBirth: "Tanggal Lahir",

    searchHeading:
        "Cari siswa dan guru sekolahmu",
    searchDescription:
        "Cari berdasarkan nama, kelas, atau mata pelajaran.",
    searchPlaceholder:
        "Cari nama, kelas, atau mata pelajaran...",
    search: "Cari",
    searchHint:
        "Ketik minimal 2 karakter untuk mulai mencari.",
    hiddenAcademicStats:
        "Pemilik profil menyembunyikan statistik akademiknya.",

    customizationTitle: "Sesuaikan Profil",
    customizationDescription:
        "Atur tampilan profil siswa kamu.",

    customizationNoticeTitle:
        "Kustomisasi profil",
    customizationNoticeDescription:
        "Atur foto profil, bio, dan warna tampilan akun kamu.",

    profilePicture: "Foto Profil",
    profilePictureDescription:
        "Pilih bagian foto yang ingin digunakan.",
    selectPhoto: "Pilih Foto",
    acceptedImageFormats:
        "JPG, PNG, atau WebP · Maksimal 2 MB",
    cropArea: "Area crop foto profil",
    profileZoom: "Zoom foto profil",
    cropHint:
        "Geser foto untuk mengatur bagian yang ditampilkan.",

    bioDescription:
        "Tambahkan deskripsi singkat tentang diri kamu.",
    bioPlaceholder: "Tulis bio singkat...",

    bannerColor: "Warna Banner",
    bannerColorDescription:
        "Pilih warna utama untuk banner profil.",

    blue: "Biru",
    purple: "Ungu",
    green: "Hijau",
    orange: "Oranye",
    yellow: "Kuning",
    red: "Merah",

    profilePrivacy: "Privasi Profil",
    profilePrivacyDescription:
        "Izinkan siswa lain melihat total poin dan nilai rata-rata kamu.",

    closePanel: "Tutup panel",
    close: "Tutup",
    saveChanges: "Simpan Perubahan",
    saving: "Menyimpan...",
    uploadingPhoto: "Mengunggah foto...",

    noBio: "Belum ada bio.",
    noScore: "Belum ada nilai",

    invalidImage:
        "Gunakan gambar JPG, PNG, atau WebP.",
    imageTooLarge:
        "Ukuran gambar maksimal 2 MB.",
    adjustPhoto:
        "Atur posisi foto, lalu tekan Simpan Perubahan.",
    imageCannotOpen:
        "Gambar tidak dapat dibuka.",
    imageCannotProcess:
        "Foto profil tidak dapat diproses.",
    imageCannotUpload:
        "Foto profil tidak dapat diunggah.",
    sessionExpired:
        "Sesi siswa telah berakhir.",

    bioTooLong:
        "Bio maksimal 120 karakter.",
    pastedTextTooLong:
        "Teks yang ditempel melebihi batas 3 baris.",

    saveSuccess:
        "Perubahan berhasil disimpan.",
    saveFailed:
        "Profil tidak dapat disimpan.",
    loadFailed:
        "Gagal mengambil profil siswa.",

    studentAvatar: "Foto profil siswa",
},

studentDirectory: {
    student: "Siswa",
    teacher: "Guru",

    studentAccount: "Akun siswa",
    teacherAccount: "Akun guru",

    shortName: "Nama Pendek",
    studentCode: "Kode Siswa",
    class: "Kelas",
    dateOfBirth: "Tanggal Lahir",
    totalPoints: "Total Poin",
    averageScore: "Nilai Rata-rata",

    subjects: "Mata Pelajaran",
    classRole: "Peran Kelas",
    homeroomTeacher: "Wali Kelas",
    specialistTeacher: "Guru Spesialis",

    noSubjects: "Belum ada mapel",
    moreSubjects: "+{count} lainnya",
    noBio: "Belum ada bio.",
    noScore: "Belum ada nilai",

    hiddenAcademicStats:
        "Pemilik profil menyembunyikan statistik akademiknya.",

    avatarAlt: "Foto profil {name}",
    loadingStudent: "Memuat profil siswa...",
    loadingTeacher: "Memuat profil guru...",
    profileLoaded:
        "Profil {name} berhasil dimuat.",
    profileLoadFailed:
        "Profil tidak dapat dimuat.",

    minimumSearch:
    "Ketik minimal 2 karakter untuk mulai mencari.",

loadingAll:
    "Memuat seluruh Directory...",
loadingTeachers:
    "Memuat semua guru...",
loadingStudents:
    "Memuat semua siswa...",
loadingClass:
    "Memuat anggota kelas...",
searching:
    "Mencari siswa dan guru...",

searchFailed:
    "Pencarian gagal.",
directoryLoadFailed:
    "Directory tidak dapat dimuat.",

noMatches:
    "Tidak ada hasil yang cocok.",
noDirectoryMembers:
    "Tidak ada anggota Directory di {className}.",
classNotFound:
    "Kelas tersebut tidak ditemukan.",
noTeachers:
    "Belum ada guru di Directory.",
noStudents:
    "Belum ada siswa di Directory.",
directoryEmpty:
    "Directory masih kosong.",
noAccountsMatch:
    "Tidak ada siswa atau guru yang cocok.",

oneStudent:
    "1 siswa",
manyStudents:
    "{count} siswa",

oneTeacher:
    "1 guru",
manyTeachers:
    "{count} guru",

oneHomeroomTeacher:
    "1 wali kelas",
manyHomeroomTeachers:
    "{count} wali kelas",

found:
    "{summary} ditemukan.",
classFound:
    "{summary} di {className}.",
allFound:
    "{students} dan {teachers} di Directory."
},

studentPoints: {
    pageTitle: "Poin Siswa",
    loadingPage: "Halaman sedang dimuat",

    dashboard: "Dashboard",
    profile: "Profil",
    myPoints: "Poin Saya",
    myGrades: "Nilai Saya",
    quiz: "Quiz",
    classroomFeed: "Feed Kelas",
    logout: "Keluar",

    summary: "Ringkasan dan riwayat poin",
    classLabel: "Kelas: {className}",
    totalPoints: "Total Poin",
    currentBalance: "Saldo poin saat ini",
    positivePoints: "Poin Positif",
    positivePointsDescription: "Seluruh poin yang diperoleh",
    deduction: "Pengurangan",
    deductionDescription: "Seluruh poin yang dikurangi",
    activity: "Aktivitas",
    activityDescription: "Jumlah perubahan poin",

    positiveActivity: "Aktivitas Positif",
    positiveActivityDescription: "Persentase aktivitas yang menambah poin",
    largestGain: "Penambahan Terbesar",
    noPositiveActivity: "Belum ada aktivitas positif",
    largestDeduction: "Pengurangan Terbesar",
    noDeduction: "Belum ada pengurangan poin",
    last30Days: "Perubahan 30 Hari",
    last30DaysDescription: "Total perubahan dalam 30 hari terakhir",

    pointProgress: "Perkembangan Poin",
    pointProgressDescription: "Perubahan saldo poin dari waktu ke waktu.",
    loadingPointProgress: "Memuat perkembangan poin",
    noProgressData: "Belum ada data perkembangan.",
    noPointProgress: "Belum ada perkembangan poin",
    pointProgressWillAppear: "Grafik akan muncul setelah ada aktivitas poin.",
    pointTrend: "Tren poin: {points}",
    pointProgressChart: "Grafik perkembangan poin",
    pointTrendSummary: "Saldo sekarang {current} · Saldo tertinggi {highest} · Saldo terendah {lowest}",

    monthlyActivity: "Aktivitas Bulanan",
    monthlyActivityDescription: "Perbandingan poin positif dan negatif setiap bulan.",
    loadingMonthlyActivity: "Memuat aktivitas bulanan",
    noMonthlyActivity: "Belum ada aktivitas bulanan.",
    noMonthlyActivityTitle: "Belum ada aktivitas bulanan",
    monthlyActivityWillAppear: "Ringkasan akan muncul setelah ada transaksi.",
    latestMonthChange: "Perubahan bulan terbaru: {points}",

    pointHistory: "Riwayat Poin",
    pointHistoryDescription: "Cari, filter, dan tinjau seluruh perubahan poin.",
    search: "Cari",
    searchPlaceholder: "Cari alasan perubahan poin...",
    type: "Jenis",
    all: "Semua",
    positivePoint: "Poin positif",
    negativePoint: "Poin negatif",
    sort: "Urutkan",
    newest: "Terbaru",
    oldest: "Terlama",
    largestChange: "Perubahan terbesar",
    smallestChange: "Perubahan terkecil",
    reset: "Reset",
    loadingHistory: "Memuat riwayat poin",
    historySummary: "{visible} dari {total} aktivitas ditampilkan",
    noActivityFound: "Tidak ada aktivitas ditemukan",
    adjustSearchOrFilter: "Coba ubah pencarian atau filter.",
    noReason: "Tanpa alasan",

    document: "Dokumen",
    reportTitle: "Laporan Poin Siswa",
    reportDescription: "Ringkasan perkembangan dan riwayat poin siswa.",
    studentName: "Nama Siswa",
    class: "Kelas",
    reportDate: "Tanggal Laporan",
    currentTotalPoints: "Total Poin Saat Ini",
    totalActivity: "Jumlah Aktivitas",
    pointChangeHistory: "Riwayat Perubahan Poin",
    number: "No",
    reason: "Alasan",
    date: "Tanggal",
    change: "Perubahan",
    noHistory: "Belum ada riwayat.",
    noPointHistory: "Belum ada riwayat poin.",
    automaticDocument: "Dokumen ini dibuat secara otomatis berdasarkan data LMS.",
    generatedAt: "Dibuat {date}",
    verification: "Verifikasi",
    teacherAdmin: "Guru / Admin",

    dataStillLoading: "Data poin belum selesai dimuat.",
    loadFailed: "Gagal memuat poin",
    dataUnavailable: "Data poin tidak tersedia.",
    cannotConnect: "Tidak dapat terhubung",
    checkServer: "Periksa server lalu coba kembali.",
    chartLoadFailed: "Gagal memuat grafik."
},

studentExamScores: {
    pageTitle: "Nilai Saya",
    loadingPage: "Halaman sedang dimuat",
    dashboard: "Dashboard",
    profile: "Profil",
    myPoints: "Poin Saya",
    myGrades: "Nilai Saya",
    quiz: "Quiz",
    classroomFeed: "Feed Kelas",
    logout: "Keluar",
    summary: "Hasil ujian dan evaluasi belajar",
    heroDescription: "Pantau hasil ujian dan perkembangan akademik kamu.",

    totalScores: "Jumlah Nilai",
    total: "Total",
    totalScoresDescription: "Nilai ujian yang sudah diberikan",
    average: "Rata-rata",
    averageDescription: "Rata-rata dari seluruh nilai",
    highestScore: "Nilai Tertinggi",
    highestScoreDescription: "Nilai terbaik yang pernah dicapai",
    latestScore: "Nilai Terbaru",
    noLatestScore: "Belum ada nilai terbaru",

    strongestSubject: "Mapel Terkuat",
    needsImprovement: "Perlu Ditingkatkan",
    scoreTrend: "Tren Nilai",
    insufficientData: "Belum cukup data",
    noComparisonSubject: "Belum ada mapel pembanding",
    averageFromScores: "Rata-rata {average} dari {count} nilai",
    minimumTwoScores: "Minimal dua nilai diperlukan",
    trendUp: "Naik dibanding nilai sebelumnya",
    trendDown: "Turun dibanding nilai sebelumnya",
    trendSame: "Sama dengan nilai sebelumnya",

    subjectPerformance: "Performa per Mapel",
    subjectPerformanceDescription: "Rata-rata nilai pada setiap mata pelajaran.",
    loadingSubjectPerformance: "Memuat performa mata pelajaran",
    high: "85–100 Tinggi",
    medium: "70–84 Sedang",
    low: "Di bawah 70",
    noSubjectData: "Belum ada data mapel",
    subjectChartWillAppear: "Grafik akan muncul setelah nilai diberikan.",
    recordedScores: "{count} nilai tercatat",

    scoreProgress: "Perkembangan Nilai",
    scoreProgressDescription: "Perubahan nilai dari waktu ke waktu.",
    subject: "Mapel",
    allSubjects: "Semua mapel",
    loadingScoreProgress: "Memuat perkembangan nilai",
    noProgressData: "Belum ada data perkembangan.",
    noProgress: "Belum ada perkembangan",
    noScoresForFilter: "Belum ada nilai untuk filter ini.",
    scoreProgressChart: "Grafik perkembangan nilai",
    trendFooter: "Terbaru {latest} · Tertinggi {highest}",
    trendFooterWithChange: "Terbaru {latest} · Tertinggi {highest} · Perubahan {change}",

    scoreHistory: "Riwayat Nilai",
    scoreHistoryDescription: "Cari, filter, dan urutkan seluruh nilai ujian kamu.",
    search: "Cari",
    searchPlaceholder: "Cari mapel atau materi...",
    sort: "Urutkan",
    newest: "Terbaru",
    oldest: "Terlama",
    highest: "Nilai tertinggi",
    lowest: "Nilai terendah",
    reset: "Reset",
    loadingHistory: "Memuat riwayat nilai",
    historySummary: "{visible} dari {total} nilai ditampilkan",
    noScoreFound: "Tidak ada nilai ditemukan",
    adjustSearchOrFilter: "Coba ubah pencarian atau filter.",
    noMaterial: "Tanpa materi",
    noSubject: "Tanpa mapel",

    loginDataMissing: "Data login siswa tidak ditemukan.",
    fetchFailed: "Gagal mengambil nilai.",
    cannotConnect: "Tidak dapat terhubung ke server.",
    chartLoadFailed: "Gagal memuat grafik."
},

studentFeed: {
    title: "Feed Kelas",
    topbarDescription: "Diskusi dan komunikasi kelas",
    description: "Bagikan informasi, berdiskusi, reply, dan mention teman atau guru.",
    createPost: "Buat postingan",
    shareToClass: "Bagikan sesuatu ke kelas",
    sendTo: "Kirim ke",
    myClass: "Kelas Saya",
    postPlaceholder: "Mulai diskusi atau bagikan informasi ke kelas...",
    post: "Posting",
    latestFeed: "Feed terbaru",
    feedScope: "Postingan kelas dan global",
    all: "Semua",
    refresh: "Muat Ulang",
    notifications: "Notifikasi",
    notificationDescription: "Mention, reply, dan aktivitas terbaru dari Classroom Feed.",
    readAll: "Baca Semua",
    accessRestored: "Akses Classroom Feed Dipulihkan",
    accessRestoredDescription: "Kamu sudah dapat menggunakan Classroom Feed kembali.",
    understand: "Mengerti",
    addImage: "Tambahkan Gambar",
    imageDialogDescription: "Pilih satu file atau gunakan URL gambar.",
    imagePreview: "Preview Gambar",
    imagePreviewHint: "Pilih file atau periksa URL gambar.",
    chooseFile: "Pilih File",
    imageRequirements: "JPEG, PNG, atau WebP. Maksimal 2 MB.",
    or: "ATAU",
    imageUrlPlaceholder: "Tempel URL gambar HTTPS...",
    checkImage: "Cek Gambar",
    removeImage: "Hapus Gambar",
    cancel: "Batal",
    add: "Tambahkan",
    student: "Siswa",
    verifiedTeacher: "Admin atau guru terverifikasi",
    noReplies: "Belum ada reply.",
    noPosts: "Belum ada postingan.",
    global: "Global",
    showMore: "Lihat selengkapnya",
    showLess: "Tampilkan lebih sedikit",
    showReplies: "Tampilkan replies",
    hideReplies: "Sembunyikan replies",
    replyPlaceholder: "Tulis balasan...",
    reply: "Balas",
    delete: "Hapus",
    loading: "Memuat...",
    publishing: "Memposting...",
    uploadingImage: "Mengunggah gambar...",
    creatingPost: "Membuat postingan...",
    savingPost: "Menyimpan postingan...",
    postCreated: "Postingan berhasil dibuat.",
    postRequired: "Isi postingan atau tambahkan satu gambar.",
    postFailed: "Postingan gagal dipublikasikan: {message}",
    genericError: "Terjadi kesalahan.",
    addingReply: "Menambahkan...",
    send: "Kirim",
    replyFailed: "Reply gagal dipublikasikan: {message}",
    deletedElsewhere: "Postingan ini sudah dihapus di perangkat lain.",
    deletePostConfirm: "Yakin ingin menghapus postingan ini? Semua reply dan mention di dalamnya juga akan dihapus.",
    deleteReplyConfirm: "Yakin ingin menghapus reply ini?",
    deleting: "Menghapus...",
    feedLoadFailed: "Gagal mengambil postingan.",
    noNotifications: "Belum ada notifikasi",
    notificationHint: "Aktivitas baru akan muncul di sini.",
    notificationLoadFailed: "Gagal mengambil notifikasi.",
    unread: "Belum dibaca",
    accessDisabled: "Akses Classroom Feed Dinonaktifkan",
    bannedMessage: "Kamu tidak dapat mengakses Classroom Feed sampai larangan dicabut oleh Admin atau Guru.",
    accessLimited: "Akses Classroom Feed Dibatasi",
    mutedMessage: "Kamu sementara tidak dapat mengakses Classroom Feed."
    ,readingImage: "Membaca gambar..."
    ,imageReady: "Gambar siap ditambahkan."
    ,invalidImageUrl: "URL gambar tidak valid."
    ,imageHttpsRequired: "URL gambar harus menggunakan HTTPS."
    ,checkingImage: "Memeriksa gambar..."
    ,imageUrlChecked: "URL gambar berhasil diperiksa."
    ,activeMute: "Mute aktif"
    ,queuedMute: "Mute antrean {number}"
    ,active: "Aktif"
    ,queue: "Antrean"
    ,remainingTime: "Sisa waktu"
    ,duration: "Durasi"
    ,ends: "Berakhir"
    ,starts: "Mulai"
    ,afterPreviousMute: "Setelah mute sebelumnya"
    ,reason: "Alasan"
    ,noReason: "Tidak ada alasan."
    ,day: "Hari"
    ,hour: "Jam"
    ,minute: "Menit"
    ,second: "Detik"
    ,notificationReplyPrefix: "Kamu mendapat reply dalam Post:"
    ,addImageTooltip: "Tambahkan gambar",
clearFormatting: "Hapus formatting",
pollComingSoon: "Poll segera hadir",
comingSoon: "Segera hadir",
bulletList: "Daftar poin",
loadingFeed: "Memuat postingan...",
},

studentQuizzes: {
    pageTitle: "Quiz Siswa",
    loadingPage: "Halaman sedang dimuat",
    dashboard: "Dashboard",
    profile: "Profil",
    myPoints: "Poin Saya",
    myGrades: "Nilai Saya",
    quiz: "Quiz",
    classroomFeed: "Feed Kelas",
    logout: "Keluar",
    summary: "Asesmen singkat dan ulasan materi",
    myQuizzes: "Quiz Saya",
    heroDescription: "Kerjakan Quiz sebelum deadline dan lihat kembali hasil sebelumnya.",
    availableQuizzes: "Quiz tersedia",
    chooseQuiz: "Pilih Quiz",
    chooseQuizDescription: "Kerjakan Quiz aktif, periksa Quiz yang terlewat, atau lihat hasil sebelumnya.",
    refresh: "Refresh",
    quizStatus: "Status Quiz",
    activeTab: "Quiz Aktif",
    missingTab: "Quiz Terlewat",
    completedTab: "Quiz Selesai",
    loadingQuizList: "Memuat daftar Quiz...",

    defaultStudent: "Siswa",
    defaultClass: "Kelas",
    noDeadline: "Tanpa deadline",
    deadline: "Deadline",
    deadlineEnded: "Deadline berakhir",
    minutesRemaining: "{count} menit lagi",
    hoursRemaining: "{count} jam lagi",
    daysRemaining: "{count} hari lagi",

    noActiveQuiz: "Tidak ada Quiz aktif",
    noActiveQuizDescription: "Belum ada Quiz yang dapat dikerjakan sekarang.",
    availableAnytime: "Dapat dikerjakan kapan saja",
    questionCount: "{count} soal",
    noSubject: "Tanpa mapel",
    noMaterial: "Tanpa materi",
    startQuiz: "Kerjakan",

    noMissingQuiz: "Tidak ada Quiz terlewat",
    noMissingQuizDescription: "Kamu tidak mempunyai Quiz yang terlewat atau ditutup Guru.",
    quizUnavailable: "Quiz tidak tersedia",
    closedByTeacher: "Quiz ditutup oleh Guru",
    cannotAttempt: "Tidak dapat dikerjakan",

    noCompletedQuiz: "Belum ada Quiz selesai",
    noCompletedQuizDescription: "Hasil akan muncul setelah kamu mengirim jawaban Quiz.",
    score: "Nilai",
    correct: "Benar",
    essayNotAutoGraded: "Esai · Tidak dinilai otomatis",
    submitted: "Dikirim",
    viewResult: "Lihat Hasil",

    reloadingQuizzes: "Memuat ulang Quiz...",
    fetchFailed: "Gagal memuat Quiz.",
    loadFailed: "Gagal memuat Quiz",
    retry: "Coba Lagi"
},

studentQuizAttempt: {
    pageTitle: "Kerjakan Quiz",
    loadingPage: "Halaman sedang dimuat",
    back: "← Kembali",
    loadingQuiz: "Memuat Quiz...",
    answerSaved: "Jawaban tersimpan di perangkat",
    initialProgress: "0/0 dijawab",
    loadingInformation: "Memuat informasi Quiz...",
    instructions: "Instruksi",
    loadingQuestions: "Memuat soal...",
    finishedQuestion: "Selesai mengerjakan?",
    checkingAnswers: "Memeriksa jawaban...",
    submitQuiz: "Submit Quiz",
    submitQuestion: "Submit Quiz?",
    cannotChangeAfterSubmit: "Jawaban tidak dapat diubah setelah dikirim.",
    reviewAgain: "Periksa Lagi",

    noDeadline: "Tanpa deadline",
    documentTitle: "{title} · Quiz",
    noSubject: "Tanpa mapel",
    noMaterial: "Tanpa materi",
    questionCount: "{count} soal",
    deadline: "Deadline",
    questionNumber: "No. {number}",
    essay: "Esai",
    onePoint: "1 poin",
    questionImageAlt: "Gambar soal nomor {number}",
    imageLoadFailed: "Gambar tidak dapat dimuat.",
    yourAnswer: "Jawaban kamu",
    essayPlaceholder: "Tulis jawaban kamu...",
    shortAnswerPlaceholder: "Ketik jawaban kamu...",

    answeredProgress: "{answered}/{total} dijawab",
    allQuestionsAnswered: "Semua soal sudah dijawab.",
    unansweredSummary: "{count} soal masih kosong dan akan dihitung salah.",
    deadlineEnded: "Deadline berakhir",
    countdownDays: "{days} hari, {hours} jam, {minutes} menit lagi",
    countdownHours: "{hours} jam, {minutes} menit lagi",
    countdownMinutes: "{minutes} menit lagi",
    countdownSeconds: "{minutes} menit, {seconds} detik lagi",

    quizCannotOpenMessage: "Quiz tidak dapat dibuka.",
    quizCannotOpen: "Quiz tidak dapat dibuka",
    backToQuizDashboard: "Kembali ke Dashboard Quiz",
    submitWarningWithEmpty: "{count} soal masih kosong dan akan dihitung salah. Jawaban tidak dapat diubah setelah dikirim.",
    submitting: "Mengirim...",
    submitFailedMessage: "Gagal mengirim jawaban Quiz."
},

studentQuizResult: {
    pageTitle: "Hasil Quiz",
    loadingPage: "Halaman sedang dimuat",
    loadingResult: "Memuat hasil Quiz...",
    documentTitle: "{title} · Hasil Quiz",

    autoGradedSubtitle: "Jawaban kamu sudah dikirim dan dinilai secara otomatis.",
    essaySubmittedSubtitle: "Jawaban Esai kamu sudah berhasil dikirim.",
    essayOnlyScoreNote: "Jawaban Esai tidak dinilai otomatis. Nilai akhir akan dibagikan melalui halaman Nilai Saya setelah diperiksa oleh guru.",
    mixedScoreNote: "Nilai ini merupakan hasil autograde, bukan nilai akhir. Jawaban Esai tidak dinilai otomatis. Nilai akhir akan dibagikan melalui halaman Nilai Saya setelah diperiksa oleh guru.",
    autoGradeScoreNote: "Nilai ini merupakan hasil autograde, bukan nilai akhir. Nilai akhir akan dibagikan melalui halaman Nilai Saya.",
    scoreLabel: "SCORE",
    resultLabel: "HASIL",
    notAutoGraded: "Tidak dinilai otomatis",
    correctFormula: "{correct} dari {total} soal benar",
    essayOnlyQuiz: "Quiz ini hanya berisi soal Esai",

    subject: "Mapel",
    material: "Materi",
    submitted: "Dikirim",
    noSubject: "Tanpa mapel",
    noMaterial: "Tanpa materi",
    viewQuiz: "Lihat Quiz",
    backToQuizDashboard: "Kembali ke Dashboard Quiz",

    essayAnswer: "Jawaban Esai",
    correct: "Benar",
    incorrect: "Salah",
    multipleChoice: "Pilihan Ganda",
    essay: "Esai",
    shortAnswer: "Isian Singkat",
    correctAnswer: "Jawaban benar",
    questionNumber: "No. {number}",
    questionImageAlt: "Gambar soal nomor {number}",
    imageLoadFailed: "Gambar tidak dapat dimuat.",
    yourAnswer: "Jawaban kamu",

    reviewDescription: "Periksa jawaban yang benar dan bagian yang perlu dipelajari lagi.",
    grade: "Nilai",
    correctCount: "{correct}/{total} benar",
    answerDetailsUnavailable: "Detail jawaban tidak tersedia.",
    viewScoreSummary: "Lihat Ringkasan Nilai",

    resultCannotOpen: "Hasil Quiz tidak dapat dibuka",
    resultIdMissing: "ID hasil Quiz tidak ditemukan.",
    fetchFailed: "Gagal mengambil hasil Quiz."
}
        },


        "en-US": {
            "meta.homeTitle":
                "mrsteve.my.id",

            "language.selectorLabel":
                "Select language",

            "home.portalSubtitle":
                "Student & Teacher Portal",

            "home.teacherLogin":
                "Teacher Login",

            "home.heroTitle":
                "More focused learning, all in one place.",

            "home.heroDescription":
                "Access the Classroom Feed, take quizzes, track grades and points, and receive school information more easily.",

            "home.studentCodeLabel":
                "Student code",

            "home.studentCodePlaceholder":
                "Enter student code",

            "home.enter":
                "Enter",

            "home.studentDashboard":
                "Student Dashboard",

            "home.welcome":
                "Welcome",

            "home.monitorActivity":
                "Keep track of your learning activities.",

            "home.myPoints":
                "My Points",

            "home.pointsExample":
                "120 points",

            "home.myGrades":
                "My Grades",

            "home.averageExample":
                "Average 86",

            "home.activeQuizTitle":
                "Active Quiz",

            "home.mathQuiz":
                "Mathematics Quiz",

            "home.questionCount":
                "8 questions",

            "home.answeredCount":
                "5 of 8 questions answered",

            "home.continue":
                "Continue →",

            "home.classroomFeed":
                "Classroom Feed",

            "home.feedExample":
                "The latest class information has been shared.",

            "home.new":
                "New",

            "home.latestGrade":
                "Latest grade",

            "home.mathematics":
                "Mathematics",

            "home.quizReady":
                "Ready to begin",

            "home.footerSystem":
                "Learning Management System",

            "home.checking":
                "Checking",

            "home.checkingCode":
                "Checking code...",

            "home.invalidLength":
                "Student code must contain 5 characters.",

            "home.invalidCode":
                "Invalid student code.",

            "home.loginSuccess":
                "Login successful. Opening dashboard...",

"home.connectionError":
    "Unable to connect to the server.",

"studentDashboard.pageTitle":
    "Student Dashboard",

"studentDashboard.profile":
    "Profile",

"studentDashboard.myPoints":
    "My Points",

"studentDashboard.myGrades":
    "My Grades",

"studentDashboard.logout":
    "Log Out",

"studentDashboard.summary":
    "Student account overview",

"studentDashboard.welcome":
    "Welcome, {name}",

"studentDashboard.description":
    "Your learning tools, school information, grades, points, and class activities are available in one student workspace.",

"studentDashboard.onlineQuiz":
    "Online Quiz",

"studentDashboard.totalPoints":
    "Total points",

"studentDashboard.upcomingAssignments":
    "Upcoming assignments",

"studentDashboard.assignmentPreparing":
    "Assignment Reminder is being prepared",

"studentDashboard.assignmentDescription":
    "Assignments and submission deadlines from your teachers will automatically appear here.",

"studentDashboard.informationBoard":
    "Information Board",

"studentDashboard.latestInformation":
    "The latest information from your school.",

"studentDashboard.refresh":
    "Refresh",

"studentDashboard.viewAll":
    "View All",

"studentDashboard.loadingAnnouncements":
    "Loading announcements...",

"studentDashboard.allAnnouncements":
    "All Announcements",

"studentDashboard.closePanel":
    "Close panel",

"studentDashboard.classUnavailable":
    "Class unavailable",

"studentDashboard.oneAnnouncement":
    "1 announcement available",

"studentDashboard.manyAnnouncements":
    "{count} announcements available",

"studentDashboard.noAnnouncements":
    "No announcements yet",

"studentDashboard.announcementWillAppear":
    "Official school information will appear here.",

"studentDashboard.by":
    "By",

"studentDashboard.adminTeacher":
    "Admin / Teacher",

"studentDashboard.announcementImage":
    "Announcement image",

"studentDashboard.moreClasses":
    "+{count} Classes",

"studentDashboard.fetchFailed":
    "Unable to load announcements",

"studentDashboard.dataUnavailable":
    "Announcement data is unavailable.",

"studentDashboard.cannotConnect":
    "Unable to connect",

"studentDashboard.checkServer":
    "Check the server and try again.",

"studentDashboard.pageTitle":
    "Student Dashboard",

"studentDashboard.dashboard":
    "Dashboard",

"studentDashboard.profile":
    "Profile",

"studentDashboard.myPoints":
    "My Points",

"studentDashboard.myGrades":
    "My Grades",

"studentDashboard.quiz":
    "Quiz",

"studentDashboard.classroomFeed":
    "Classroom Feed",

"studentDashboard.logout":
    "Log Out",

"studentDashboard.summary":
    "Student account overview",

"studentDashboard.welcome":
    "Welcome, {name}",

"studentDashboard.description":
    "Your learning tools, school information, grades, points, and class activities are available in one student workspace.",

"studentDashboard.totalPoints":
    "Total points",

"studentDashboard.upcomingAssignments":
    "Upcoming assignments",

"studentDashboard.assignmentPreparing":
    "Assignment Reminder is being prepared",

"studentDashboard.assignmentDescription":
    "Assignments and submission deadlines from your teachers will automatically appear here.",

"studentDashboard.latestInformation":
    "The latest information from your school.",

"studentDashboard.viewAll":
    "View All",

"studentDashboard.loadingAnnouncements":
    "Loading announcements...",

"studentDashboard.allAnnouncements":
    "All Announcements",

"studentDashboard.closePanel":
    "Close panel",

"studentDashboard.classUnavailable":
    "Class unavailable",

"studentDashboard.oneAnnouncement":
    "1 announcement available",

"studentDashboard.manyAnnouncements":
    "{count} announcements available",

"studentDashboard.noAnnouncements":
    "No announcements yet",

"studentDashboard.announcementWillAppear":
    "Official school information will appear here.",

"studentDashboard.by":
    "By",

"studentDashboard.adminTeacher":
    "Admin / Teacher",

"studentDashboard.announcementImage":
    "Announcement image",

"studentDashboard.moreClasses":
    "+{count} classes",

"studentDashboard.fetchFailed":
    "Unable to load announcements",

"studentDashboard.dataUnavailable":
    "Announcement data is unavailable.",

"studentDashboard.cannotConnect":
    "Unable to connect",

"studentDashboard.checkServer":
    "Check the server and try again.",

studentProfile: {
    pageTitle: "Student Profile",
    loadingPage: "Page is loading",

    dashboard: "Dashboard",
    profile: "Profile",
    myPoints: "My Points",
    myGrades: "My Grades",
    quiz: "Quiz",
    classroomFeed: "Classroom Feed",
    logout: "Log Out",

    profileSummary:
        "Account information and academic summary",

    directory: "Directory",
    directorySummary:
        "Find and view student or teacher profiles",
    backToProfile: "Back to Profile",

    loadingProfile: "Loading profile...",
    studentAccount: "Student account",
    customizeProfile: "Customize Profile",

    totalPoints: "Total Points",
    averageScore: "Average Score",
    class: "Class",

    studentInformation: "Student Information",
    studentInformationDescription:
        "Identity information linked to this account.",

    shortName: "Display Name",
    studentCode: "Student Code",
    dateOfBirth: "Date of Birth",

    searchHeading:
        "Find students and teachers",
    searchDescription:
        "Search by name, class, or subject.",
    searchPlaceholder:
        "Search by name, class, or subject...",
    search: "Search",
    searchHint:
        "Enter at least 2 characters to start searching.",
    hiddenAcademicStats:
        "This user has hidden their academic statistics.",

    customizationTitle: "Customize Profile",
    customizationDescription:
        "Customize the appearance of your student profile.",

    customizationNoticeTitle:
        "Profile customization",
    customizationNoticeDescription:
        "Manage your profile picture, bio, and profile color.",

    profilePicture: "Profile Picture",
    profilePictureDescription:
        "Choose the photo you want to use.",
    selectPhoto: "Choose Photo",
    acceptedImageFormats:
        "JPG, PNG, or WebP · Maximum 2 MB",
    cropArea: "Profile picture crop area",
    profileZoom: "Profile picture zoom",
    cropHint:
        "Drag the photo to adjust the visible area.",

    bioDescription:
        "Add a short description about yourself.",
    bioPlaceholder: "Write a short bio...",

    bannerColor: "Banner Color",
    bannerColorDescription:
        "Choose the main color for your profile banner.",

    blue: "Blue",
    purple: "Purple",
    green: "Green",
    orange: "Orange",
    yellow: "Yellow",
    red: "Red",

    profilePrivacy: "Profile Privacy",
    profilePrivacyDescription:
        "Allow other students to view your total points and average score.",

    closePanel: "Close panel",
    close: "Close",
    saveChanges: "Save Changes",
    saving: "Saving...",
    uploadingPhoto: "Uploading photo...",

    noBio: "No bio yet.",
    noScore: "No scores yet",

    invalidImage:
        "Use a JPG, PNG, or WebP image.",
    imageTooLarge:
        "The maximum image size is 2 MB.",
    adjustPhoto:
        "Adjust the photo, then select Save Changes.",
    imageCannotOpen:
        "The image could not be opened.",
    imageCannotProcess:
        "The profile picture could not be processed.",
    imageCannotUpload:
        "The profile picture could not be uploaded.",
    sessionExpired:
        "Your student session has expired.",

    bioTooLong:
        "The bio cannot exceed 120 characters.",
    pastedTextTooLong:
        "The pasted text exceeds the 3-line limit.",

    saveSuccess:
        "Your changes have been saved.",
    saveFailed:
        "The profile could not be saved.",
    loadFailed:
        "The student profile could not be loaded.",

    studentAvatar: "Student profile picture"
},

studentDirectory: {
    student: "Student",
    teacher: "Teacher",

    studentAccount: "Student account",
    teacherAccount: "Teacher account",

    shortName: "Display Name",
    studentCode: "Student Code",
    class: "Class",
    dateOfBirth: "Date of Birth",
    totalPoints: "Total Points",
    averageScore: "Average Score",

    subjects: "Subjects",
    classRole: "Class Role",
    homeroomTeacher: "Homeroom Teacher",
    specialistTeacher: "Subject Teacher",

    noSubjects: "No subjects assigned",
    moreSubjects: "+{count} more",
    noBio: "No bio yet.",
    noScore: "No scores yet",

    hiddenAcademicStats:
        "This user has hidden their academic statistics.",

    avatarAlt: "{name}'s profile picture",
    loadingStudent: "Loading student profile...",
    loadingTeacher: "Loading teacher profile...",
    profileLoaded:
        "{name}'s profile has been loaded.",
    profileLoadFailed:
        "The profile could not be loaded.",

    minimumSearch:
    "Enter at least 2 characters to start searching.",

loadingAll:
    "Loading the entire Directory...",
loadingTeachers:
    "Loading all teachers...",
loadingStudents:
    "Loading all students...",
loadingClass:
    "Loading class members...",
searching:
    "Searching for students and teachers...",

searchFailed:
    "Search failed.",
directoryLoadFailed:
    "The Directory could not be loaded.",

noMatches:
    "No matching results found.",
noDirectoryMembers:
    "No Directory members found in {className}.",
classNotFound:
    "The class could not be found.",
noTeachers:
    "There are no teachers in the Directory yet.",
noStudents:
    "There are no students in the Directory yet.",
directoryEmpty:
    "The Directory is currently empty.",
noAccountsMatch:
    "No matching students or teachers found.",

oneStudent:
    "1 student",
manyStudents:
    "{count} students",

oneTeacher:
    "1 teacher",
manyTeachers:
    "{count} teachers",

oneHomeroomTeacher:
    "1 homeroom teacher",
manyHomeroomTeachers:
    "{count} homeroom teachers",

found:
    "{summary} found.",
classFound:
    "{summary} in {className}.",
allFound:
    "{students} and {teachers} in the Directory."
},

studentPoints: {
    pageTitle: "Student Points",
    loadingPage: "Page is loading",

    dashboard: "Dashboard",
    profile: "Profile",
    myPoints: "My Points",
    myGrades: "My Grades",
    quiz: "Quiz",
    classroomFeed: "Classroom Feed",
    logout: "Log Out",

    summary: "Point overview and history",
    classLabel: "Class: {className}",
    totalPoints: "Total Points",
    currentBalance: "Current point balance",
    positivePoints: "Positive Points",
    positivePointsDescription: "All points you have earned",
    deduction: "Deductions",
    deductionDescription: "All points that have been deducted",
    activity: "Activity",
    activityDescription: "Number of point changes",

    positiveActivity: "Positive Activity",
    positiveActivityDescription: "Percentage of activities that added points",
    largestGain: "Largest Gain",
    noPositiveActivity: "No positive activity yet",
    largestDeduction: "Largest Deduction",
    noDeduction: "No point deductions yet",
    last30Days: "Last 30 Days",
    last30DaysDescription: "Total change over the last 30 days",

    pointProgress: "Point Progress",
    pointProgressDescription: "Changes in your point balance over time.",
    loadingPointProgress: "Loading point progress",
    noProgressData: "No progress data yet.",
    noPointProgress: "No point progress yet",
    pointProgressWillAppear: "The chart will appear after point activity is recorded.",
    pointTrend: "Point change: {points}",
    pointProgressChart: "Point progress chart",
    pointTrendSummary: "Current balance {current} · Highest balance {highest} · Lowest balance {lowest}",

    monthlyActivity: "Monthly Activity",
    monthlyActivityDescription: "Comparison of positive and negative points each month.",
    loadingMonthlyActivity: "Loading monthly activity",
    noMonthlyActivity: "No monthly activity yet.",
    noMonthlyActivityTitle: "No monthly activity yet",
    monthlyActivityWillAppear: "A summary will appear after a transaction is recorded.",
    latestMonthChange: "Latest monthly change: {points}",

    pointHistory: "Point History",
    pointHistoryDescription: "Search, filter, and review all point changes.",
    search: "Search",
    searchPlaceholder: "Search point change reasons...",
    type: "Type",
    all: "All",
    positivePoint: "Positive points",
    negativePoint: "Negative points",
    sort: "Sort",
    newest: "Newest",
    oldest: "Oldest",
    largestChange: "Largest change",
    smallestChange: "Smallest change",
    reset: "Reset",
    loadingHistory: "Loading point history",
    historySummary: "Showing {visible} of {total} activities",
    noActivityFound: "No activity found",
    adjustSearchOrFilter: "Try changing the search or filter.",
    noReason: "No reason provided",

    document: "Document",
    reportTitle: "Student Point Report",
    reportDescription: "A summary of the student's point progress and history.",
    studentName: "Student Name",
    class: "Class",
    reportDate: "Report Date",
    currentTotalPoints: "Current Total Points",
    totalActivity: "Total Activity",
    pointChangeHistory: "Point Change History",
    number: "No.",
    reason: "Reason",
    date: "Date",
    change: "Change",
    noHistory: "No history yet.",
    noPointHistory: "No point history yet.",
    automaticDocument: "This document was generated automatically using LMS data.",
    generatedAt: "Generated {date}",
    verification: "Verification",
    teacherAdmin: "Teacher / Admin",

    dataStillLoading: "Point data is still loading.",
    loadFailed: "Unable to load points",
    dataUnavailable: "Point data is unavailable.",
    cannotConnect: "Unable to connect",
    checkServer: "Check the server and try again.",
    chartLoadFailed: "Unable to load chart."
},

studentExamScores: {
    pageTitle: "My Grades",
    loadingPage: "Page is loading",
    dashboard: "Dashboard",
    profile: "Profile",
    myPoints: "My Points",
    myGrades: "My Grades",
    quiz: "Quiz",
    classroomFeed: "Classroom Feed",
    logout: "Log Out",
    summary: "Exam results and learning evaluation",
    heroDescription: "Track your exam results and academic progress.",

    totalScores: "Total Grades",
    total: "Total",
    totalScoresDescription: "Exam grades that have been recorded",
    average: "Average",
    averageDescription: "Average across all grades",
    highestScore: "Highest Grade",
    highestScoreDescription: "Your best recorded grade",
    latestScore: "Latest Grade",
    noLatestScore: "No latest grade yet",

    strongestSubject: "Strongest Subject",
    needsImprovement: "Needs Improvement",
    scoreTrend: "Grade Trend",
    insufficientData: "Not enough data",
    noComparisonSubject: "No other subject to compare",
    averageFromScores: "Average {average} from {count} grades",
    minimumTwoScores: "At least two grades are required",
    trendUp: "Up from the previous grade",
    trendDown: "Down from the previous grade",
    trendSame: "Same as the previous grade",

    subjectPerformance: "Subject Performance",
    subjectPerformanceDescription: "Average grade for each subject.",
    loadingSubjectPerformance: "Loading subject performance",
    high: "85–100 High",
    medium: "70–84 Medium",
    low: "Below 70",
    noSubjectData: "No subject data yet",
    subjectChartWillAppear: "The chart will appear after grades are recorded.",
    recordedScores: "{count} grades recorded",

    scoreProgress: "Grade Progress",
    scoreProgressDescription: "Changes in grades over time.",
    subject: "Subject",
    allSubjects: "All subjects",
    loadingScoreProgress: "Loading grade progress",
    noProgressData: "No progress data yet.",
    noProgress: "No grade progress yet",
    noScoresForFilter: "No grades are available for this filter.",
    scoreProgressChart: "Grade progress chart",
    trendFooter: "Latest {latest} · Highest {highest}",
    trendFooterWithChange: "Latest {latest} · Highest {highest} · Change {change}",

    scoreHistory: "Grade History",
    scoreHistoryDescription: "Search, filter, and sort all your exam grades.",
    search: "Search",
    searchPlaceholder: "Search subjects or materials...",
    sort: "Sort",
    newest: "Newest",
    oldest: "Oldest",
    highest: "Highest grade",
    lowest: "Lowest grade",
    reset: "Reset",
    loadingHistory: "Loading grade history",
    historySummary: "Showing {visible} of {total} grades",
    noScoreFound: "No grades found",
    adjustSearchOrFilter: "Try changing the search or filter.",
    noMaterial: "No material",
    noSubject: "No subject",

    loginDataMissing: "Student login data was not found.",
    fetchFailed: "Unable to load grades.",
    cannotConnect: "Unable to connect to the server.",
    chartLoadFailed: "Unable to load chart."
},

studentFeed: {
    title: "Classroom Feed",
    topbarDescription: "Class discussions and communication",
    description: "Share information, join discussions, reply, and mention classmates or teachers.",
    createPost: "Create a post",
    shareToClass: "Share something with the class",
    sendTo: "Send to",
    myClass: "My Class",
    postPlaceholder: "Start a discussion or share information with the class...",
    post: "Post",
    latestFeed: "Latest Feed",
    feedScope: "Class and global posts",
    all: "All",
    refresh: "Refresh",
    notifications: "Notifications",
    notificationDescription: "Mentions, replies, and recent activity from the Classroom Feed.",
    readAll: "Read All",
    accessRestored: "Classroom Feed Access Restored",
    accessRestoredDescription: "You can now use the Classroom Feed again.",
    understand: "Got It",
    addImage: "Add Image",
    imageDialogDescription: "Choose a file or use an image URL.",
    imagePreview: "Image Preview",
    imagePreviewHint: "Choose a file or check the image URL.",
    chooseFile: "Choose File",
    imageRequirements: "JPEG, PNG, or WebP. Maximum 2 MB.",
    or: "OR",
    imageUrlPlaceholder: "Paste an HTTPS image URL...",
    checkImage: "Check Image",
    removeImage: "Remove Image",
    cancel: "Cancel",
    add: "Add",
    student: "Student",
    verifiedTeacher: "Verified admin or teacher",
    noReplies: "No replies yet.",
    noPosts: "No posts yet.",
    global: "Global",
    showMore: "Show more",
    showLess: "Show less",
    showReplies: "Show replies",
    hideReplies: "Hide replies",
    replyPlaceholder: "Write a reply...",
    reply: "Reply",
    delete: "Delete",
    loading: "Loading...",
    publishing: "Publishing...",
    uploadingImage: "Uploading image...",
    creatingPost: "Creating post...",
    savingPost: "Saving post...",
    postCreated: "Post published successfully.",
    postRequired: "Write a post or add one image.",
    postFailed: "Unable to publish post: {message}",
    genericError: "Something went wrong.",
    addingReply: "Adding...",
    send: "Send",
    replyFailed: "Unable to publish reply: {message}",
    deletedElsewhere: "This post was deleted on another device.",
    deletePostConfirm: "Delete this post? All replies and mentions inside it will also be deleted.",
    deleteReplyConfirm: "Delete this reply?",
    deleting: "Deleting...",
    feedLoadFailed: "Unable to load posts.",
    noNotifications: "No notifications yet",
    notificationHint: "New activity will appear here.",
    notificationLoadFailed: "Unable to load notifications.",
    unread: "Unread",
    accessDisabled: "Classroom Feed Access Disabled",
    bannedMessage: "You cannot access the Classroom Feed until a Teacher removes the ban.",
    accessLimited: "Classroom Feed Access Limited",
    mutedMessage: "You cannot access the Classroom Feed temporarily."
    ,readingImage: "Reading image..."
    ,imageReady: "Image is ready to add."
    ,invalidImageUrl: "Invalid image URL."
    ,imageHttpsRequired: "The image URL must use HTTPS."
    ,checkingImage: "Checking image..."
    ,imageUrlChecked: "Image URL checked successfully."
    ,activeMute: "Active mute"
    ,queuedMute: "Queued mute {number}"
    ,active: "Active"
    ,queue: "Queued"
    ,remainingTime: "Time remaining"
    ,duration: "Duration"
    ,ends: "Ends"
    ,starts: "Starts"
    ,afterPreviousMute: "After the previous mute"
    ,reason: "Reason"
    ,noReason: "No reason provided."
    ,day: "Day"
    ,hour: "Hour"
    ,minute: "Minute"
    ,second: "Second"
    ,notificationReplyPrefix: "You received a reply on the post:",
    addImageTooltip: "Add image",
clearFormatting: "Clear formatting",
pollComingSoon: "Poll coming soon",
comingSoon: "Coming soon",
bulletList: "Bullet list",
loadingFeed: "Loading posts...",
},

studentQuizzes: {
    pageTitle: "Student Quizzes",
    loadingPage: "Page is loading",
    dashboard: "Dashboard",
    profile: "Profile",
    myPoints: "My Points",
    myGrades: "My Grades",
    quiz: "Quiz",
    classroomFeed: "Classroom Feed",
    logout: "Log Out",
    summary: "Quick assessments and material reviews",
    myQuizzes: "My Quizzes",
    heroDescription: "Complete quizzes before their deadlines and review your previous results.",
    availableQuizzes: "Available quizzes",
    chooseQuiz: "Choose a Quiz",
    chooseQuizDescription: "Complete active quizzes, check missed quizzes, or review previous results.",
    refresh: "Refresh",
    quizStatus: "Quiz Status",
    activeTab: "Active Quizzes",
    missingTab: "Missing Quizzes",
    completedTab: "Completed Quizzes",
    loadingQuizList: "Loading quizzes...",

    defaultStudent: "Student",
    defaultClass: "Class",
    noDeadline: "No deadline",
    deadline: "Deadline",
    deadlineEnded: "Deadline ended",
    minutesRemaining: "{count} minutes remaining",
    hoursRemaining: "{count} hours remaining",
    daysRemaining: "{count} days remaining",

    noActiveQuiz: "No active quizzes",
    noActiveQuizDescription: "There are no quizzes available to complete right now.",
    availableAnytime: "Available anytime",
    questionCount: "{count} questions",
    noSubject: "No subject",
    noMaterial: "No material",
    startQuiz: "Take Quiz",

    noMissingQuiz: "No missing quizzes",
    noMissingQuizDescription: "You do not have any missed quizzes or quizzes closed by a teacher.",
    quizUnavailable: "Quiz unavailable",
    closedByTeacher: "Quiz closed by teacher",
    cannotAttempt: "Unavailable",

    noCompletedQuiz: "No completed quizzes yet",
    noCompletedQuizDescription: "Results will appear after you submit a quiz.",
    score: "Score",
    correct: "Correct",
    essayNotAutoGraded: "Essay · Not graded automatically",
    submitted: "Submitted",
    viewResult: "View Result",

    reloadingQuizzes: "Reloading quizzes...",
    fetchFailed: "Unable to load quizzes.",
    loadFailed: "Unable to load quizzes",
    retry: "Try Again"
},

studentQuizAttempt: {
    pageTitle: "Take Quiz",
    loadingPage: "Page is loading",
    back: "← Back",
    loadingQuiz: "Loading quiz...",
    answerSaved: "Answers saved on this device",
    initialProgress: "0/0 answered",
    loadingInformation: "Loading quiz information...",
    instructions: "Instructions",
    loadingQuestions: "Loading questions...",
    finishedQuestion: "Finished answering?",
    checkingAnswers: "Checking answers...",
    submitQuiz: "Submit Quiz",
    submitQuestion: "Submit Quiz?",
    cannotChangeAfterSubmit: "Answers cannot be changed after submission.",
    reviewAgain: "Review Again",

    noDeadline: "No deadline",
    documentTitle: "{title} · Quiz",
    noSubject: "No subject",
    noMaterial: "No material",
    questionCount: "{count} questions",
    deadline: "Deadline",
    questionNumber: "Question {number}",
    essay: "Essay",
    onePoint: "1 point",
    questionImageAlt: "Image for question {number}",
    imageLoadFailed: "Unable to load image.",
    yourAnswer: "Your answer",
    essayPlaceholder: "Write your answer...",
    shortAnswerPlaceholder: "Type your answer...",

    answeredProgress: "{answered}/{total} answered",
    allQuestionsAnswered: "All questions have been answered.",
    unansweredSummary: "{count} questions are unanswered and will be marked incorrect.",
    deadlineEnded: "Deadline ended",
    countdownDays: "{days} days, {hours} hours, {minutes} minutes remaining",
    countdownHours: "{hours} hours, {minutes} minutes remaining",
    countdownMinutes: "{minutes} minutes remaining",
    countdownSeconds: "{minutes} minutes, {seconds} seconds remaining",

    quizCannotOpenMessage: "Unable to open this quiz.",
    quizCannotOpen: "Unable to Open Quiz",
    backToQuizDashboard: "Back to Quiz Dashboard",
    submitWarningWithEmpty: "{count} questions are unanswered and will be marked incorrect. Answers cannot be changed after submission.",
    submitting: "Submitting...",
    submitFailedMessage: "Unable to submit quiz answers."
},

studentQuizResult: {
    pageTitle: "Quiz Result",
    loadingPage: "Page is loading",
    loadingResult: "Loading quiz result...",
    documentTitle: "{title} · Quiz Result",

    autoGradedSubtitle: "Your answers have been submitted and graded automatically.",
    essaySubmittedSubtitle: "Your essay answers have been submitted successfully.",
    essayOnlyScoreNote: "Essay answers are not graded automatically. Your final grade will appear on the My Grades page after review by a teacher.",
    mixedScoreNote: "This is an automatically graded score, not your final grade. Essay answers are not graded automatically. Your final grade will appear on the My Grades page after review by a teacher.",
    autoGradeScoreNote: "This is an automatically graded score, not your final grade. Your final grade will appear on the My Grades page.",
    scoreLabel: "SCORE",
    resultLabel: "RESULT",
    notAutoGraded: "Not graded automatically",
    correctFormula: "{correct} of {total} questions correct",
    essayOnlyQuiz: "This quiz contains essay questions only",

    subject: "Subject",
    material: "Material",
    submitted: "Submitted",
    noSubject: "No subject",
    noMaterial: "No material",
    viewQuiz: "View Quiz",
    backToQuizDashboard: "Back to Quiz Dashboard",

    essayAnswer: "Essay Answer",
    correct: "Correct",
    incorrect: "Incorrect",
    multipleChoice: "Multiple Choice",
    essay: "Essay",
    shortAnswer: "Short Answer",
    correctAnswer: "Correct answer",
    questionNumber: "Question {number}",
    questionImageAlt: "Image for question {number}",
    imageLoadFailed: "Unable to load image.",
    yourAnswer: "Your answer",

    reviewDescription: "Review the correct answers and the areas you need to study again.",
    grade: "Grade",
    correctCount: "{correct}/{total} correct",
    answerDetailsUnavailable: "Answer details are unavailable.",
    viewScoreSummary: "View Grade Summary",

    resultCannotOpen: "Unable to Open Quiz Result",
    resultIdMissing: "Quiz result ID was not found.",
    fetchFailed: "Unable to load the quiz result."
}
        }

    };


    function readLanguage() {

        try {

            const savedLanguage =
                localStorage.getItem(
                    STORAGE_KEY
                );


            if (
                SUPPORTED_LANGUAGES.has(
                    savedLanguage
                )
            ) {
                return savedLanguage;
            }

        } catch (error) {

            console.warn(
                "Bahasa tersimpan tidak dapat dibaca:",
                error
            );

        }


        return DEFAULT_LANGUAGE;

    }


    let currentLanguage =
        readLanguage();


    document.documentElement.lang =
        currentLanguage;


    if (
        currentLanguage !==
        DEFAULT_LANGUAGE
    ) {

        document.documentElement
            .classList.add(
                "lms-language-pending"
            );

    }


function getTranslationValue(
    dictionary,
    key
) {

    if (
        !dictionary ||
        typeof dictionary !== "object"
    ) {
        return undefined;
    }


    /*
     * Mendukung key datar lama:
     * "studentDashboard.profile"
     */
    if (
        Object.prototype.hasOwnProperty.call(
            dictionary,
            key
        )
    ) {

        return dictionary[key];

    }


    /*
     * Mendukung object bertingkat baru:
     * studentProfile.profile
     */
    return String(key)
        .split(".")
        .reduce(
            (
                currentValue,
                keyPart
            ) => {

                if (
                    currentValue === null ||
                    currentValue === undefined ||
                    typeof currentValue !==
                        "object"
                ) {
                    return undefined;
                }


                return currentValue[
                    keyPart
                ];

            },
            dictionary
        );

}


function t(
    key,
    variables = {}
) {

    const selectedTranslation =
        getTranslationValue(
            translations[
                currentLanguage
            ],
            key
        );


    const defaultTranslation =
        getTranslationValue(
            translations[
                DEFAULT_LANGUAGE
            ],
            key
        );


    const translatedText =
        selectedTranslation ??
        defaultTranslation ??
        key;


    return String(
        translatedText
    ).replace(
        /\{([a-zA-Z0-9_]+)\}/g,
        (
            match,
            variableName
        ) => {

            return Object.prototype
                .hasOwnProperty.call(
                    variables,
                    variableName
                )
                    ? String(
                        variables[
                            variableName
                        ]
                    )
                    : match;

        }
    );

}


    function applyTranslations(
        root = document
    ) {

        root.querySelectorAll(
            "[data-i18n]"
        ).forEach(
            element => {

                element.textContent =
                    t(
                        element.dataset.i18n
                    );

            }
        );


        root.querySelectorAll(
            "[data-i18n-placeholder]"
        ).forEach(
            element => {

                element.placeholder =
                    t(
                        element.dataset
                            .i18nPlaceholder
                    );

            }
        );


        root.querySelectorAll(
            "[data-i18n-aria-label]"
        ).forEach(
            element => {

                element.setAttribute(
                    "aria-label",
                    t(
                        element.dataset
                            .i18nAriaLabel
                    )
                );

            }
        );


        root.querySelectorAll(
            "[data-i18n-editor-placeholder]"
        ).forEach(
            element => {

                element.dataset.placeholder =
                    t(
                        element.dataset
                            .i18nEditorPlaceholder
                    );

            }
        );

        root.querySelectorAll(
    "[data-i18n-title]"
).forEach(element => {
    element.title = t(
        element.dataset.i18nTitle
    );
});


        document.querySelectorAll(
            "[data-language-option]"
        ).forEach(
            button => {

                const active =
                    button.dataset
                        .languageOption ===
                    currentLanguage;


                button.classList.toggle(
                    "is-active",
                    active
                );

                button.setAttribute(
                    "aria-pressed",
                    String(active)
                );

            }
        );


        document.documentElement.lang =
            currentLanguage;

        document.documentElement
            .classList.remove(
                "lms-language-pending"
            );

    }


    function setLanguage(
        language
    ) {

        if (
            !SUPPORTED_LANGUAGES.has(
                language
            )
        ) {
            return;
        }


        currentLanguage =
            language;


        try {

            localStorage.setItem(
                STORAGE_KEY,
                language
            );

        } catch (error) {

            console.warn(
                "Bahasa tidak dapat disimpan:",
                error
            );

        }


        applyTranslations();


        document.dispatchEvent(
            new CustomEvent(
                "lmslanguagechange",
                {
                    detail: {
                        language
                    }
                }
            )
        );

    }


    function setupLanguageButtons() {

        document.querySelectorAll(
            "[data-language-option]"
        ).forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        setLanguage(
                            button.dataset
                                .languageOption
                        );

                    }
                );

            }
        );

    }


    window.LMSLanguage = {
        t,
        setLanguage,
        applyTranslations,

        getLanguage() {
            return currentLanguage;
        }
    };


    function initializePageLanguage() {

        setupLanguageButtons();
        applyTranslations();

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initializePageLanguage,
            {
                once: true
            }
        );

    } else {

        initializePageLanguage();

    }


    /*
        Pengaman agar halaman tidak tetap tersembunyi
        jika terjadi error JavaScript tidak terduga.
    */
    setTimeout(
        () => {

            document.documentElement
                .classList.remove(
                    "lms-language-pending"
                );

        },
        2000
    );

})();
