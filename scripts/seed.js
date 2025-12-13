const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const dbPath = path.join(process.cwd(), 'group_data.db');
const db = new Database(dbPath);

console.log('Seeding database at:', dbPath);

// Initialize Schema for seeding
db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('核心同工', '一般組員', '新朋友')),
      status TEXT NOT NULL CHECK(status IN ('穩定', '暫停', '觀察中')),
      birthday TEXT,
      phone TEXT,
      address TEXT,
      join_date TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      time TEXT,
      location TEXT,
      leader TEXT,
      worship_leader TEXT,
      topic TEXT,
      summary TEXT,
      offering_amount INTEGER DEFAULT 0
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
      meeting_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('出席', '請假', '缺席', '遲到')),
      PRIMARY KEY (meeting_id, member_id),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS care_logs (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('探訪', '電話', '訊息', '面談')),
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    )
`);

// Clear existing data (optional, be careful in prod)
// db.exec("DELETE FROM attendance");
// db.exec("DELETE FROM care_logs");
// db.exec("DELETE FROM meetings");
// db.exec("DELETE FROM members");

// Members
const members = [
    { id: uuidv4(), name: '陳小明', category: '核心同工', status: '穩定', birthday: '1990-05-15', phone: '0912345678' },
    { id: uuidv4(), name: '林美華', category: '一般組員', status: '穩定', birthday: '1995-08-20', phone: '0922333444' },
    { id: uuidv4(), name: '張志豪', category: '新朋友', status: '觀察中', birthday: '2000-01-10', phone: '0933444555' },
];

const insertMember = db.prepare(`
  INSERT INTO members (id, name, category, status, birthday, phone)
  VALUES (@id, @name, @category, @status, @birthday, @phone)
`);

members.forEach(m => {
    try {
        insertMember.run(m);
        console.log(`Added member: ${m.name}`);
    } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
            console.log(`Member ${m.name} already exists (by ID collision risk low) or logic skip.`);
        } else {
            console.log(`Skipping ${m.name}, might already exist or error: ${e.message}`);
        }
    }
});

// Create a meeting for this week
const meetingId = uuidv4();
try {
    db.prepare(`
      INSERT INTO meetings (id, date, time, location, leader, worship_leader, topic, offering_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(meetingId, '2025-02-14', '19:30', '教會副堂', '王牧師', '陳小明', '彼此相愛', 1200);
    console.log('Added meeting for 2025-02-14');
} catch (e) {
    console.log('Meeting insert error (maybe duplicate run):', e.message);
}

// Attendance
try {
    const stmt = db.prepare('INSERT INTO attendance (meeting_id, member_id, status) VALUES (?, ?, ?)');
    stmt.run(meetingId, members[0].id, '出席');
    stmt.run(meetingId, members[1].id, '遲到');
    stmt.run(meetingId, members[2].id, '缺席');
    console.log('Added attendance records');
} catch (e) {
    console.log('Attendance insert error:', e.message);
}

console.log('Seeding complete.');
