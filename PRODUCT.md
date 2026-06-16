# Sistem Presensi Pengajar (UAM) — Unified Product Requirements

This document outlines the core purpose, user roles, and technical mechanisms of the UII Ayo Mengajar (UAM) attendance system, incorporating the **Single-Scan Attendance** model implemented in June 2026.

---

## 1. Product Purpose
Sistem Presensi Pengajar is a specialized attendance monitoring system for UII Ayo Mengajar, a community teaching program where university students teach at TPA (Taman Pendidikan Al-Quran) locations. 

The system replaces manual sign-in sheets with a **fraud-proof, QR-based digital check-in** that provides administrators with real-time data while keeping the on-site process for teachers near zero friction.

---

## 2. Core Mechanism: Single-Scan Attendance
The system operates on a **"Session-Based"** model that eliminates the need for teachers to scan out individually.

### The Flow:
1.  **Opening the Session (First Teacher):** 
    *   The first teacher to arrive at a TPA scans the **Static QR Code** (physically printed at the location).
    *   The system validates their **GPS location** (geofencing).
    *   A new session is created, and this teacher is automatically recorded as present and designated as the "First Teacher".
2.  **Check-In (Subsequent Teachers):**
    *   Other teachers scan a **Dynamic QR Code** displayed on the First Teacher's phone.
    *   The Dynamic QR refreshes every 30 seconds to prevent fraudulent remote check-ins.
    *   The system validates their GPS location and records their "Masuk" time.
3.  **Closing the Session (Finalization):**
    *   At the end of the teaching day, the First Teacher clicks "Tutup Sesi".
    *   **Mandatory Report:** The First Teacher **must** enter the **Materi TPA** (e.g., "Surat Al-Fatihah ayat 1-7").
    *   **Uniform Exit:** Once submitted, the system automatically "stamps" the current time as the "Keluar" time for every teacher who scanned into that session.
    *   **No Individual Scan-Out:** Teachers do not need to scan a QR code to leave.

### Key Logic Changes:
*   **Abolished "Early Exit" (Pulang Awal):** There is no longer a penalty or status for leaving early, as all attendance is finalized at the moment the session is closed.
*   **Late Arrival (Terlambat):** Late arrivals are still tracked based on the time of the "Masuk" scan compared to the TPA schedule.

---

## 3. Users & Roles

### Pengajar (Teachers)
University student volunteers teaching on-site.
*   **Primary Tasks:** Scan QR to record presence, host sessions for others (if first to arrive), submit teaching materials, and view personal attendance history/streaks.
*   **Context:** On-site with a phone, often in a hurry between teaching blocks.

### Pengurus (Administrators)
Program coordinators monitoring the program from a desk.
*   **Primary Tasks:** Manage TPAs and Teachers, review real-time session activity, approve "Izin" (leave) requests, and generate evaluation reports.
*   **Context:** Desktop/Laptop browser, focused on high-level data and reporting.

---

## 4. Key Features

### Fraud Prevention
*   **GPS Geofencing:** Every attendance action is gated by a radius check.
*   **Dynamic QR:** Check-in tokens rotate constantly to prevent screenshots/sharing.
*   **First Teacher Gatekeeper:** One physical person must be "hosting" the session on-site.

### Reporting & Evaluation
*   **Automated Laporan:** Generates monthly attendance grids showing entry/exit times and status.
*   **One-Click Export:** Native PDF, Excel, and CSV downloads for program stakeholders.
*   **Statistics:** Tracks total sessions, on-time percentage, and absence rates per teacher/TPA.
*   **Streak System:** Encourages consistency via a "Teaching Streak" counter.

### Teacher Management
*   **Secure Creation:** Admin-only dashboard for creating accounts or bulk-importing teachers via CSV.
*   **Izin Request Flow:** Teachers can submit leave requests with digital justifications for admin approval.

---

## 5. Design Principles
1.  **Scan-first, think-second.** The primary action (attendance) must be instantaneous.
2.  **Status at a glance.** Dashboards surface what is happening *now*.
3.  **Respect the context gap.** Mobile-first for teachers; data-dense for admins.
4.  **Indonesian first, English never.** All labels and messages are in Bahasa Indonesia.
5.  **Single-Scan simplicity.** Eliminate administrative "homework" (scan-outs) to focus on teaching.
